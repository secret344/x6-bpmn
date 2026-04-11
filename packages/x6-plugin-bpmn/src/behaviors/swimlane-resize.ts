import type { Graph, Node } from '@antv/x6'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'
import { isSwimlaneShape } from '../export/bpmn-mapping'
import {
  clampSwimlaneToContent,
  computeLaneMinSize,
  computePoolMinSize,
  normalizeSwimlaneLayers,
} from './swimlane-layout'
import { compactLaneLayout, reconcileLaneResize } from './lane-management'
import { getAncestorPool } from '../core/swimlane-membership'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'

interface TransformPluginLike {
  options?: {
    resizing?: Record<string, unknown>
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface GraphWithContainer {
  container?: HTMLElement
  matrix?: () => { a?: number; d?: number; e?: number; f?: number }
}

type ResizeOptionsLike = Record<string, unknown>
type ResizeMethod = (width: number, height: number, options?: ResizeOptionsLike) => Node

type MutableNode = Node & {
  resize: ResizeMethod
  setPosition: (x: number, y: number, options?: ResizeOptionsLike) => void
}

export interface SavedResizingMinBounds {
  minWidth: unknown
  minHeight: unknown
}

export interface SwimlaneResizeOptions {
  onSwimlaneResized?: (node: Node, pool: Node) => void
}

interface RectSnapshot {
  x: number
  y: number
  width: number
  height: number
}

interface ResizePreviewState {
  startRect: RectSnapshot
  previewRect: RectSnapshot
  direction?: string
  hadOwnResize: boolean
  ownResize?: unknown
  originalResize: ResizeMethod
  previewElement: HTMLDivElement | null
}

const HEADER_SIZE = 30
const MIN_LANE_SIZE = 60
const PREVIEW_ATTR = 'data-bpmn-swimlane-resize-preview'
const PREVIEW_NODE_ATTR = 'data-node-id'

function isHorizontalNode(node: Node): boolean {
  try {
    return resolveSwimlaneIsHorizontal(node.getData?.(), node.getSize())
  } catch /* istanbul ignore next -- 防御性回退：X6 节点正常不抛出 */ {
    return true
  }
}

function extractResizeDirection(options?: Record<string, unknown>): string | undefined {
  if (typeof options?.relativeDirection === 'string') {
    return options.relativeDirection
  }

  return typeof options?.direction === 'string' ? options.direction : undefined
}

function rectRight(rect: RectSnapshot): number {
  return rect.x + rect.width
}

function rectBottom(rect: RectSnapshot): number {
  return rect.y + rect.height
}

function snapshotNodeRect(node: Node): RectSnapshot {
  const position = node.getPosition()
  const size = node.getSize()
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  }
}

function cloneRect(rect: RectSnapshot): RectSnapshot {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

function unionRects(rects: RectSnapshot[]): RectSnapshot | undefined {
  if (rects.length === 0) {
    return undefined
  }

  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map(rectRight))
  const bottom = Math.max(...rects.map(rectBottom))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function getNodeChildren(node: Node): Node[] {
  try {
    const children = node.getChildren?.()
    if (!Array.isArray(children)) {
      return []
    }

    return children.filter((child) => child?.isNode?.()) as Node[]
  } catch {
    return []
  }
}

function collectPoolContentRect(pool: Node): RectSnapshot | undefined {
  const descendants: RectSnapshot[] = []

  for (const child of getNodeChildren(pool)) {
    if (child.shape === BPMN_LANE) {
      descendants.push(...getNodeChildren(child).map(snapshotNodeRect))
      continue
    }

    descendants.push(snapshotNodeRect(child))
  }

  return unionRects(descendants)
}

function getGraphContainer(graph: Graph): HTMLElement | null {
  const graphAny = graph as unknown as GraphWithContainer
  return graphAny.container ?? null
}

function getGraphMatrix(graph: Graph): { a: number; d: number; e: number; f: number } {
  const graphAny = graph as unknown as GraphWithContainer
  let matrix: { a?: number; d?: number; e?: number; f?: number } | undefined

  try {
    matrix = graphAny.matrix?.()
  } catch {
    matrix = undefined
  }

  return {
    a: matrix?.a ?? 1,
    d: matrix?.d ?? 1,
    e: matrix?.e ?? 0,
    f: matrix?.f ?? 0,
  }
}

function createPreviewElement(graph: Graph, node: Node): HTMLDivElement | null {
  const container = getGraphContainer(graph)
  if (!container || typeof document === 'undefined') {
    return null
  }

  const element = document.createElement('div')
  element.setAttribute(PREVIEW_ATTR, 'true')
  element.setAttribute(PREVIEW_NODE_ATTR, node.id)
  Object.assign(element.style, {
    position: 'absolute',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    border: '2px dashed #fa8c16',
    background: 'rgba(250, 173, 20, 0.08)',
    zIndex: '9999',
  })
  container.appendChild(element)
  return element
}

function updatePreviewElement(graph: Graph, element: HTMLDivElement | null, rect: RectSnapshot): void {
  if (!element) {
    return
  }

  const matrix = getGraphMatrix(graph)
  element.style.left = `${rect.x * matrix.a + matrix.e}px`
  element.style.top = `${rect.y * matrix.d + matrix.f}px`
  element.style.width = `${rect.width * matrix.a}px`
  element.style.height = `${rect.height * matrix.d}px`
}

function removePreviewElement(element: HTMLDivElement | null): void {
  element?.remove()
}

function buildPreviewRect(
  startRect: RectSnapshot,
  width: number,
  height: number,
  direction?: string,
): RectSnapshot {
  const rect = {
    x: startRect.x,
    y: startRect.y,
    width,
    height,
  }

  if (direction?.includes('left')) {
    rect.x = rectRight(startRect) - width
  }

  if (direction?.includes('top')) {
    rect.y = rectBottom(startRect) - height
  }

  return rect
}

function clampLeftEdge(rect: RectSnapshot, maxX: number): RectSnapshot {
  if (rect.x <= maxX) {
    return rect
  }

  const right = rectRight(rect)
  return {
    x: maxX,
    y: rect.y,
    width: right - maxX,
    height: rect.height,
  }
}

function clampTopEdge(rect: RectSnapshot, maxY: number): RectSnapshot {
  if (rect.y <= maxY) {
    return rect
  }

  const bottom = rectBottom(rect)
  return {
    x: rect.x,
    y: maxY,
    width: rect.width,
    height: bottom - maxY,
  }
}

function clampTopEdgeMin(rect: RectSnapshot, minY: number): RectSnapshot {
  if (rect.y >= minY) {
    return rect
  }

  const bottom = rectBottom(rect)
  return {
    x: rect.x,
    y: minY,
    width: rect.width,
    height: Math.max(bottom - minY, MIN_LANE_SIZE),
  }
}

function clampRightEdge(rect: RectSnapshot, minRight: number): RectSnapshot {
  if (rectRight(rect) >= minRight) {
    return rect
  }

  return {
    x: rect.x,
    y: rect.y,
    width: minRight - rect.x,
    height: rect.height,
  }
}

function clampRightEdgeMax(rect: RectSnapshot, maxRight: number): RectSnapshot {
  if (rectRight(rect) <= maxRight) {
    return rect
  }

  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(maxRight - rect.x, MIN_LANE_SIZE),
    height: rect.height,
  }
}

function clampBottomEdge(rect: RectSnapshot, minBottom: number): RectSnapshot {
  if (rectBottom(rect) >= minBottom) {
    return rect
  }

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: minBottom - rect.y,
  }
}

function clampBottomEdgeMax(rect: RectSnapshot, maxBottom: number): RectSnapshot {
  if (rectBottom(rect) <= maxBottom) {
    return rect
  }

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: Math.max(maxBottom - rect.y, MIN_LANE_SIZE),
  }
}

function clampLeftEdgeMin(rect: RectSnapshot, minX: number): RectSnapshot {
  if (rect.x >= minX) {
    return rect
  }

  const right = rectRight(rect)
  return {
    x: minX,
    y: rect.y,
    width: Math.max(right - minX, MIN_LANE_SIZE),
    height: rect.height,
  }
}

function clampPoolPreviewRect(node: Node, candidateRect: RectSnapshot, direction?: string): RectSnapshot {
  if (!direction) {
    return candidateRect
  }

  const contentRect = collectPoolContentRect(node)
  if (!contentRect) {
    return candidateRect
  }

  let nextRect = cloneRect(candidateRect)

  if (direction.includes('top')) {
    nextRect = clampTopEdge(nextRect, contentRect.y)
  }

  if (direction.includes('left')) {
    const hasLanes = getNodeChildren(node).some((child) => child.shape === BPMN_LANE)
    const headerOffset = hasLanes ? HEADER_SIZE * 2 : HEADER_SIZE
    nextRect = clampLeftEdge(nextRect, contentRect.x - headerOffset)
  }

  if (direction.includes('right')) {
    nextRect = clampRightEdge(nextRect, rectRight(contentRect))
  }

  if (direction.includes('bottom')) {
    nextRect = clampBottomEdge(nextRect, rectBottom(contentRect))
  }

  return nextRect
}

function clampLanePreviewRect(node: Node, candidateRect: RectSnapshot, direction?: string): RectSnapshot {
  if (!direction) {
    return candidateRect
  }

  const pool = getAncestorPool(node)
  if (!pool) {
    return candidateRect
  }

  const contentRect = collectPoolContentRect(pool)
  const hz = isHorizontalNode(pool)
  const lanes = getNodeChildren(pool).filter((child) => child.shape === BPMN_LANE)
  const sorted = [...lanes].sort((left, right) => {
    const leftPos = left.getPosition()
    const rightPos = right.getPosition()
    return hz ? leftPos.y - rightPos.y : leftPos.x - rightPos.x
  })
  const laneIndex = sorted.findIndex((lane) => lane.id === node.id)
  if (laneIndex < 0) {
    return candidateRect
  }

  const isFirst = laneIndex === 0
  const isLast = laneIndex === sorted.length - 1
  let nextRect = cloneRect(candidateRect)

  if (hz) {
    if (contentRect && direction.includes('left')) {
      nextRect = clampLeftEdge(nextRect, contentRect.x)
    }
    if (contentRect && direction.includes('right')) {
      nextRect = clampRightEdge(nextRect, rectRight(contentRect))
    }
    if (contentRect && isFirst && direction.includes('top')) {
      nextRect = clampTopEdge(nextRect, contentRect.y)
    }
    if (!isFirst && direction.includes('top')) {
      const previousRect = snapshotNodeRect(sorted[laneIndex - 1])
      nextRect = clampTopEdgeMin(nextRect, previousRect.y + MIN_LANE_SIZE)
    }
    if (!isLast && direction.includes('bottom')) {
      const nextLaneRect = snapshotNodeRect(sorted[laneIndex + 1])
      nextRect = clampBottomEdgeMax(nextRect, rectBottom(nextLaneRect) - MIN_LANE_SIZE)
    }
    if (contentRect && isLast && direction.includes('bottom')) {
      nextRect = clampBottomEdge(nextRect, rectBottom(contentRect))
    }
  } else {
    if (contentRect && direction.includes('top')) {
      nextRect = clampTopEdge(nextRect, contentRect.y)
    }
    if (contentRect && direction.includes('bottom')) {
      nextRect = clampBottomEdge(nextRect, rectBottom(contentRect))
    }
    if (contentRect && isFirst && direction.includes('left')) {
      nextRect = clampLeftEdge(nextRect, contentRect.x)
    }
    if (!isFirst && direction.includes('left')) {
      const previousRect = snapshotNodeRect(sorted[laneIndex - 1])
      nextRect = clampLeftEdgeMin(nextRect, previousRect.x + MIN_LANE_SIZE)
    }
    if (!isLast && direction.includes('right')) {
      const nextLaneRect = snapshotNodeRect(sorted[laneIndex + 1])
      nextRect = clampRightEdgeMax(nextRect, rectRight(nextLaneRect) - MIN_LANE_SIZE)
    }
    if (contentRect && isLast && direction.includes('right')) {
      nextRect = clampRightEdge(nextRect, rectRight(contentRect))
    }
  }

  return nextRect
}

function computeLegalPreviewRect(
  node: Node,
  startRect: RectSnapshot,
  width: number,
  height: number,
  direction?: string,
): RectSnapshot {
  const candidateRect = buildPreviewRect(startRect, width, height, direction)

  if (node.shape === BPMN_POOL) {
    return clampPoolPreviewRect(node, candidateRect, direction)
  }

  return clampLanePreviewRect(node, candidateRect, direction)
}

function getTransformPlugin(graph: Graph): TransformPluginLike | null {
  const graphAny = graph as unknown as {
    getPlugin?: (name: string) => unknown
  }
  if (typeof graphAny.getPlugin !== 'function') return null
  const plugin = graphAny.getPlugin('transform')
  if (!plugin || typeof plugin !== 'object') return null
  return plugin as TransformPluginLike
}

export function patchTransformResizing(graph: Graph): SavedResizingMinBounds | null {
  const transform = getTransformPlugin(graph)
  if (!transform?.options) return null

  if (!transform.options.resizing || typeof transform.options.resizing !== 'object') {
    transform.options.resizing = { enabled: true }
  }

  const resizing = transform.options.resizing
  const saved: SavedResizingMinBounds = {
    minWidth: resizing.minWidth,
    minHeight: resizing.minHeight,
  }

  resizing.minWidth = function bpmnMinWidth(this: Graph, node: Node): number {
    if (node.shape === BPMN_POOL) return computePoolMinSize(node).width
    if (node.shape === BPMN_LANE) return computeLaneMinSize(node).width
    return 0
  }

  resizing.minHeight = function bpmnMinHeight(this: Graph, node: Node): number {
    if (node.shape === BPMN_POOL) return computePoolMinSize(node).height
    if (node.shape === BPMN_LANE) return computeLaneMinSize(node).height
    return 0
  }

  return saved
}

export function restoreTransformResizing(
  graph: Graph,
  saved: SavedResizingMinBounds | null,
): void {
  if (!saved) return

  const transform = getTransformPlugin(graph)
  if (!transform?.options?.resizing) return

  const resizing = transform.options.resizing
  if (saved.minWidth === undefined) {
    delete resizing.minWidth
  } else {
    resizing.minWidth = saved.minWidth
  }

  if (saved.minHeight === undefined) {
    delete resizing.minHeight
  } else {
    resizing.minHeight = saved.minHeight
  }
}

function restoreNodeResize(node: Node, state: ResizePreviewState): void {
  const mutableNode = node as unknown as MutableNode & { resize?: unknown }
  if (state.hadOwnResize) {
    mutableNode.resize = state.ownResize as ResizeMethod
    return
  }

  delete (mutableNode as { resize?: unknown }).resize
}

function commitPreviewRect(node: Node, rect: RectSnapshot, originalResize: ResizeMethod): void {
  const mutableNode = node as unknown as MutableNode
  mutableNode.setPosition(rect.x, rect.y, { bpmnLayout: true })
  originalResize(rect.width, rect.height, { bpmnLayout: true })
}

function finalizeResize(
  graph: Graph,
  node: Node,
  direction: string | undefined,
  resizeStartRect: RectSnapshot | undefined,
  onSwimlaneResized?: (node: Node, pool: Node) => void,
): void {
  const pool =
    node.shape === BPMN_POOL
      ? node
      : reconcileLaneResize(graph, node, direction, resizeStartRect) ?? getAncestorPool(node)

  if (!pool) {
    return
  }

  if (node.shape === BPMN_POOL) {
    compactLaneLayout(graph, pool, direction)
    if (clampSwimlaneToContent(pool)) {
      compactLaneLayout(graph, pool, direction)
    }
  }

  normalizeSwimlaneLayers(graph)
  onSwimlaneResized?.(node, pool)
}

export function setupSwimlaneResize(
  graph: Graph,
  options: SwimlaneResizeOptions = {},
): () => void {
  const saved = patchTransformResizing(graph)
  const previewStates = new WeakMap<Node, ResizePreviewState>()
  const activePreviewNodes = new Set<Node>()

  function cleanupPreview(node: Node, state: ResizePreviewState): void {
    restoreNodeResize(node, state)
    removePreviewElement(state.previewElement)
    previewStates.delete(node)
    activePreviewNodes.delete(node)
  }

  function onNodeResizeStarted({ node }: { node: Node }): void {
    if (!isSwimlaneShape(node.shape)) {
      return
    }

    const existing = previewStates.get(node)
    if (existing) {
      cleanupPreview(node, existing)
    }

    const mutableNode = node as unknown as MutableNode & { resize?: unknown }
    const originalResize = mutableNode.resize.bind(node)
    const startRect = snapshotNodeRect(node)
    const previewElement = createPreviewElement(graph, node)
    const state: ResizePreviewState = {
      startRect,
      previewRect: startRect,
      hadOwnResize: Object.prototype.hasOwnProperty.call(mutableNode, 'resize'),
      ownResize: mutableNode.resize,
      originalResize,
      previewElement,
    }

    updatePreviewElement(graph, previewElement, startRect)

    mutableNode.resize = ((width: number, height: number, resizeOptions?: ResizeOptionsLike) => {
      const direction = extractResizeDirection(resizeOptions) ?? state.direction
      state.direction = direction
      state.previewRect = computeLegalPreviewRect(node, state.startRect, width, height, direction)
      updatePreviewElement(graph, state.previewElement, state.previewRect)
      return node
    }) as ResizeMethod

    previewStates.set(node, state)
    activePreviewNodes.add(node)
  }

  function onNodeResized({
    node,
    options: resizeOptions,
  }: {
    node: Node
    options?: Record<string, unknown>
  }): void {
    if (!isSwimlaneShape(node.shape)) {
      return
    }

    const state = previewStates.get(node)
    if (!state) {
      finalizeResize(graph, node, extractResizeDirection(resizeOptions), undefined, options.onSwimlaneResized)
      return
    }

    const direction = extractResizeDirection(resizeOptions) ?? state.direction
    cleanupPreview(node, state)
    graph.batchUpdate('bpmn-swimlane-resize', () => {
      commitPreviewRect(node, state.previewRect, state.originalResize)
      finalizeResize(graph, node, direction, state.startRect, options.onSwimlaneResized)
    })
  }

  graph.on('node:resize', onNodeResizeStarted)
  graph.on('node:resized', onNodeResized)

  return () => {
    for (const node of Array.from(activePreviewNodes)) {
      const state = previewStates.get(node)
      /* istanbul ignore next -- activePreviewNodes 与 previewStates 始终同步，此处仅防御性兜底 */
      if (state) {
        cleanupPreview(node, state)
      }
    }

    graph.off('node:resize', onNodeResizeStarted)
    graph.off('node:resized', onNodeResized)
    restoreTransformResizing(graph, saved)
  }
}
