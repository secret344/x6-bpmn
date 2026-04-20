/**
 * 泳道 Resize 行为
 *
 * 严格按 pool.md 的三阶段模型实现：
 * - preview：只更新 ghost，不写真实节点
 * - commit：拖拽结束后一次性提交真实几何
 * - reconcile：提交后只在当前层级内重排
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape, isSwimlaneShape } from '../export/bpmn-mapping'
import type { Rect } from './geometry'
import { compactLaneLayout } from './lane-management'
import {
  LANE_INDENTATION,
  asTRBL,
  computeLaneMinSize,
  computeLaneResizeMinHeight,
  computeLanesResize,
  computePoolContentRect,
  computePoolMinSize,
  computeResizeConstraints,
  nodeRect,
  trblToRect,
  type ResizeDirection,
  type TRBL,
} from './swimlane-layout'

type ResizeEventOptions = {
  direction?: string
  relativeDirection?: string
  silent?: boolean
  ui?: boolean
}

interface ResizePreviewState {
  node: Node
  direction: ResizeDirection
  originalRect: Rect
  previewRect: Rect
  childLaneRects: Map<Node, Rect>
  descendantNodeRects: Map<Node, Rect>
  poolPreviewConstraintSnapshot: PoolPreviewConstraintSnapshot | null
  previewElement: HTMLDivElement | null
  originalResize: ((width: number, height: number, options?: object) => unknown) | undefined
}

interface PoolPreviewConstraintSnapshot {
  poolMin: { width: number; height: number }
  poolContent: Rect | null
  contentInsetLeft: number
}

export interface SwimlaneResizeOptions {
  /** resize 提交完成后的回调 */
  onSwimlaneResized?: (node: Node, target: Node) => void
}

const RESIZE_AXIS_CHANGE_EPSILON = 8

/**
 * 选择下一个可提交的 preview 矩形。
 *
 * resize 过程中如果只发生了平移而没有尺寸变化，说明这是异常噪声，
 * 不应覆盖当前已经计算出的合法 ghost。
 */
function mergePreviewRect(
  currentPreviewRect: Rect,
  nextPreviewRect: Rect,
): Rect {
  return isTranslationOnlyPreviewUpdate(currentPreviewRect, nextPreviewRect)
    ? currentPreviewRect
    : nextPreviewRect
}

/**
 * 将 Lane 的 preview 矩形限制在合法分隔线约束内。
 */
export function clampLanePreviewRect(
  lane: Node,
  previewRect: Rect,
  direction: ResizeDirection,
  currentRect: Rect = nodeRect(lane),
): Rect {
  const constraints = computeResizeConstraints(lane, direction, true, currentRect)
  const previewTrbl = asTRBL(previewRect)

  if (constraints.min.top !== undefined && previewTrbl.top < constraints.min.top) {
    previewTrbl.top = constraints.min.top
  }
  if (constraints.min.right !== undefined && previewTrbl.right < constraints.min.right) {
    previewTrbl.right = constraints.min.right
  }
  if (constraints.min.bottom !== undefined && previewTrbl.bottom < constraints.min.bottom) {
    previewTrbl.bottom = constraints.min.bottom
  }
  if (constraints.min.left !== undefined && previewTrbl.left > constraints.min.left) {
    previewTrbl.left = constraints.min.left
  }

  if (constraints.max.top !== undefined && previewTrbl.top > constraints.max.top) {
    previewTrbl.top = constraints.max.top
  }
  if (constraints.max.bottom !== undefined && previewTrbl.bottom > constraints.max.bottom) {
    previewTrbl.bottom = constraints.max.bottom
  }

  return trblToRect(previewTrbl as TRBL)
}

/**
 * 安装泳道 resize 行为。
 *
 * 只监听：
 * - node:resize：建立 preview 并覆写本次拖拽的 resize
 * - node:resized：提交 preview 并执行当前层级重排
 */
export function setupSwimlaneResize(
  graph: Graph,
  options?: SwimlaneResizeOptions,
): () => void {
  const { onSwimlaneResized } = options ?? {}
  const previewStates = new Map<string, ResizePreviewState>()
  const savedTransformResizing = patchTransformResizing(graph)
  const transformPlugin = (graph as any).getPlugin?.('transform')
  const resizeEventSource = transformPlugin
    && typeof transformPlugin.on === 'function'
    && typeof transformPlugin.off === 'function'
    ? transformPlugin
    : graph

  const clearPreviewState = (nodeId: string, restoreResize = true) => {
    const state = previewStates.get(nodeId)
    if (!state) {
      return
    }

    if (restoreResize && state.originalResize) {
      ;(state.node as any).resize = state.originalResize as any
    }

    state.previewElement?.remove()
    previewStates.delete(nodeId)
  }

  const ensurePreviewState = (node: Node, direction: ResizeDirection): ResizePreviewState => {
    const existing = previewStates.get(node.id)
    if (existing) {
      return existing
    }

    const created: ResizePreviewState = {
      node,
      direction,
      originalRect: nodeRect(node),
      previewRect: nodeRect(node),
      childLaneRects: captureChildLaneRects(node),
      descendantNodeRects: captureDescendantNodeRects(node),
      poolPreviewConstraintSnapshot: capturePoolPreviewConstraintSnapshot(node),
      previewElement: null,
      originalResize: typeof node.resize === 'function' ? node.resize.bind(node) : undefined,
    }
    previewStates.set(node.id, created)
    return created
  }

  const ensurePreviewStateFromRect = (
    node: Node,
    direction: ResizeDirection,
    originalRect: Rect,
  ): ResizePreviewState => {
    const created: ResizePreviewState = {
      node,
      direction,
      originalRect,
      previewRect: originalRect,
      childLaneRects: captureChildLaneRects(node),
      descendantNodeRects: captureDescendantNodeRects(node),
      poolPreviewConstraintSnapshot: capturePoolPreviewConstraintSnapshot(node),
      previewElement: null,
      originalResize: typeof node.resize === 'function' ? node.resize.bind(node) : undefined,
    }
    previewStates.set(node.id, created)
    return created
  }

  const beginPreview = ({
    node,
    options: eventOptions,
  }: {
    node: Node
    options?: ResizeEventOptions
  }) => {
    if (!isSwimlaneShape(node.shape)) {
      return
    }

    const direction = resolveResizeDirection(eventOptions)
    if (!direction) {
      return
    }

    const existingState = previewStates.get(node.id)
    if (existingState) {
      return
    }

    const state = ensurePreviewState(node, direction)
    state.originalRect = captureStablePreviewOriginalRect(node)
    state.previewRect = state.originalRect
    state.childLaneRects = captureChildLaneRects(node)
    state.descendantNodeRects = captureDescendantNodeRects(node)
    state.poolPreviewConstraintSnapshot = capturePoolPreviewConstraintSnapshot(node)
    state.previewElement = null
    state.originalResize = typeof node.resize === 'function' ? node.resize.bind(node) : undefined

    ;(node as any).resize = (nextWidth: number, nextHeight: number, resizeOptions?: ResizeEventOptions) => {
      const requestedRect = buildResizeRect(state.originalRect, nextWidth, nextHeight, state.direction)
      const nextPreviewRect = clampPreviewRect(
        node,
        requestedRect,
        state.direction,
        state.originalRect,
        state.poolPreviewConstraintSnapshot,
      )
      state.previewRect = mergePreviewRect(state.previewRect, nextPreviewRect)
      state.previewElement = renderPreviewElement(graph, node.id, state.previewRect, state.previewElement)
      return node
    }
  }

  const commitPreview = ({
    node,
    options: eventOptions,
  }: {
    node: Node
    options?: ResizeEventOptions
  }) => {
    if (!isSwimlaneShape(node.shape) || eventOptions?.silent) {
      return
    }

    const state = previewStates.get(node.id)
    const direction = state?.direction ?? resolveResizeDirection(eventOptions)
    if (!direction) {
      clearPreviewState(node.id, false)
      return
    }

    const liveRect = nodeRect(node)
    const previewRect = state && !sameRect(state.previewRect, state.originalRect)
      ? state.previewRect
      : liveRect
    const originalRect = state?.originalRect ?? liveRect

    if (eventOptions?.ui && state) {
      node.setPosition(originalRect.x, originalRect.y, { silent: true, bpmnPreview: true })
      node.setSize(originalRect.width, originalRect.height, { silent: true, bpmnPreview: true })
      restoreDescendantNodeRects(state.descendantNodeRects)
      return
    }

    if (state) {
      restoreDescendantNodeRects(state.descendantNodeRects)
    }

    clearPreviewState(node.id)

    commitResize(graph, node, previewRect, direction, originalRect)
    onSwimlaneResized?.(node, node)
  }

  const updateLivePreviewState = (
    node: Node,
    direction: ResizeDirection,
    initialOriginalRect: Rect | null,
    buildRequestedRect: (state: ResizePreviewState, liveRect: Rect) => Rect,
  ) => {
    const state = initialOriginalRect
      ? ensurePreviewStateFromRect(node, direction, initialOriginalRect)
      : ensurePreviewState(node, direction)
    const requestedRect = buildRequestedRect(state, nodeRect(node))
    const nextPreviewRect = clampPreviewRect(
      node,
      requestedRect,
      state.direction,
      state.originalRect,
      state.poolPreviewConstraintSnapshot,
    )
    state.previewRect = mergePreviewRect(state.previewRect, nextPreviewRect)
    state.previewElement = renderPreviewElement(graph, node.id, state.previewRect, state.previewElement)
    node.setPosition(state.originalRect.x, state.originalRect.y, { silent: true, bpmnPreview: true })
    node.setSize(state.originalRect.width, state.originalRect.height, { silent: true, bpmnPreview: true })
    restoreDescendantNodeRects(state.descendantNodeRects)
  }

  const isStaleLivePositionUpdate = (
    state: ResizePreviewState,
    liveRect: Rect,
  ) => {
    const originalTrbl = asTRBL(state.originalRect)
    const previewTrbl = asTRBL(state.previewRect)
    const liveTrbl = asTRBL(liveRect)

    if (
      state.direction.includes('n')
      && Math.abs(liveTrbl.top - originalTrbl.top) <= RESIZE_AXIS_CHANGE_EPSILON
      && Math.abs(previewTrbl.top - originalTrbl.top) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('s')
      && Math.abs(liveTrbl.bottom - originalTrbl.bottom) <= RESIZE_AXIS_CHANGE_EPSILON
      && Math.abs(previewTrbl.bottom - originalTrbl.bottom) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('w')
      && Math.abs(liveTrbl.left - originalTrbl.left) <= RESIZE_AXIS_CHANGE_EPSILON
      && Math.abs(previewTrbl.left - originalTrbl.left) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('e')
      && Math.abs(liveTrbl.right - originalTrbl.right) <= RESIZE_AXIS_CHANGE_EPSILON
      && Math.abs(previewTrbl.right - originalTrbl.right) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    return false
  }

  const isStaleLiveSizeUpdate = (
    state: ResizePreviewState,
    liveRect: Rect,
  ) => {
    const originalTrbl = asTRBL(state.originalRect)
    const previewTrbl = asTRBL(state.previewRect)
    const liveTrbl = asTRBL(liveRect)

    if (
      state.direction.includes('s')
      && Math.abs(liveTrbl.top - originalTrbl.top) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('e')
      && Math.abs(liveTrbl.left - originalTrbl.left) > RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('n')
      && previewTrbl.top > originalTrbl.top + RESIZE_AXIS_CHANGE_EPSILON
      && liveTrbl.top < originalTrbl.top - RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('s')
      && previewTrbl.bottom < originalTrbl.bottom - RESIZE_AXIS_CHANGE_EPSILON
      && liveTrbl.bottom > originalTrbl.bottom + RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('w')
      && previewTrbl.left > originalTrbl.left + RESIZE_AXIS_CHANGE_EPSILON
      && liveTrbl.left < originalTrbl.left - RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    if (
      state.direction.includes('e')
      && previewTrbl.right < originalTrbl.right - RESIZE_AXIS_CHANGE_EPSILON
      && liveTrbl.right > originalTrbl.right + RESIZE_AXIS_CHANGE_EPSILON
    ) {
      return true
    }

    return false
  }

  const liveSizeHandler = ({
    node,
    previous,
    options: eventOptions,
  }: {
    node: Node
    previous?: { width?: number; height?: number }
    options?: ResizeEventOptions
  }) => {
    if (eventOptions?.silent || !eventOptions?.ui || !isSwimlaneShape(node.shape)) {
      return
    }

    const direction = previewStates.get(node.id)?.direction ?? resolveResizeDirection(eventOptions)
    if (!direction) {
      return
    }

    const liveRect = nodeRect(node)
    const existingState = previewStates.get(node.id)
    const initialOriginalRect = previewStates.has(node.id)
      ? null
      : isLaneShape(node.shape)
        ? captureStablePreviewOriginalRect(node)
        : buildOriginalRectFromLiveSizeChange(liveRect, previous, direction)

    if (existingState) {
      existingState.originalRect = reconcileOriginalRectWithLiveSizeChange(existingState.originalRect, previous)
    }

    if (existingState && isStaleLiveSizeUpdate(existingState, liveRect)) {
      node.setPosition(existingState.originalRect.x, existingState.originalRect.y, { silent: true, bpmnPreview: true })
      node.setSize(existingState.originalRect.width, existingState.originalRect.height, { silent: true, bpmnPreview: true })
      if (isPoolShape(node.shape)) {
        restoreChildLaneRects(existingState.childLaneRects)
      }
      restoreDescendantNodeRects(existingState.descendantNodeRects)
      return
    }

    void eventOptions
    updateLivePreviewState(node, direction, initialOriginalRect, (state, liveRect) => ({
      ...buildResizeRect(state.originalRect, liveRect.width, liveRect.height, state.direction),
      x: state.direction.includes('e') || state.direction.includes('w') ? buildResizeRect(state.originalRect, liveRect.width, liveRect.height, state.direction).x : state.previewRect.x,
      y: state.direction.includes('n') || state.direction.includes('s') ? buildResizeRect(state.originalRect, liveRect.width, liveRect.height, state.direction).y : state.previewRect.y,
    }))
  }

  const livePositionHandler = ({
    node,
    previous,
    options: eventOptions,
  }: {
    node: Node
    previous?: { x?: number; y?: number }
    options?: ResizeEventOptions
  }) => {
    if (eventOptions?.silent || !eventOptions?.ui || !isSwimlaneShape(node.shape)) {
      return
    }

    const direction = previewStates.get(node.id)?.direction ?? resolveResizeDirection(eventOptions)
    if (!direction) {
      return
    }

    const liveRect = nodeRect(node)
    const existingState = previewStates.get(node.id)

    if (existingState) {
      existingState.originalRect = reconcileOriginalRectWithLivePositionChange(existingState.originalRect, previous)
    }

    if (existingState && isStaleLivePositionUpdate(existingState, liveRect)) {
      node.setPosition(existingState.originalRect.x, existingState.originalRect.y, { silent: true, bpmnPreview: true })
      node.setSize(existingState.originalRect.width, existingState.originalRect.height, { silent: true, bpmnPreview: true })
      if (isPoolShape(node.shape)) {
        restoreChildLaneRects(existingState.childLaneRects)
      }
      return
    }

    if (!existingState) {
      return
    }

    void eventOptions
    updateLivePreviewState(node, direction, null, (state, nextLiveRect) => buildResizeRectFromLivePosition(
      state.previewRect,
      nextLiveRect,
      state.direction,
    ))
  }

  const commitLivePreviewStates = () => {
    for (const state of Array.from(previewStates.values())) {
      restoreDescendantNodeRects(state.descendantNodeRects)
      clearPreviewState(state.node.id)
      commitResize(graph, state.node, state.previewRect, state.direction, state.originalRect)
      onSwimlaneResized?.(state.node, state.node)
    }
  }

  const handleWindowMouseUp = () => {
    window.requestAnimationFrame(() => {
      commitLivePreviewStates()
    })
  }

  window.addEventListener('mouseup', handleWindowMouseUp)

  resizeEventSource.on('node:resize', beginPreview)
  resizeEventSource.on('node:resized', commitPreview)
  graph.on('node:change:size', liveSizeHandler)
  graph.on('node:change:position', livePositionHandler)

  return () => {
    for (const nodeId of Array.from(previewStates.keys())) {
      clearPreviewState(nodeId)
    }
    window.removeEventListener('mouseup', handleWindowMouseUp)
    resizeEventSource.off('node:resize', beginPreview)
    resizeEventSource.off('node:resized', commitPreview)
    graph.off('node:change:size', liveSizeHandler)
    graph.off('node:change:position', livePositionHandler)
    restoreTransformResizing(graph, savedTransformResizing)
  }
}

/** patchTransformResizing 返回的保存状态 */
export interface TransformResizingSaved {
  minWidth: unknown
  minHeight: unknown
}

/**
 * 注入 Transform 插件的泳道最小尺寸约束。
 */
export function patchTransformResizing(graph: Graph): TransformResizingSaved | null {
  const plugin = (graph as any).getPlugin?.('transform')
  if (!plugin) return null

  const options = plugin.options
  if (!options) return null

  if (!options.resizing || typeof options.resizing !== 'object') {
    options.resizing = {}
  }
  const resizing = options.resizing as Record<string, unknown>

  const saved: TransformResizingSaved = {
    minWidth: resizing.minWidth,
    minHeight: resizing.minHeight,
  }

  resizing.minWidth = function (this: Graph, node: Node): number {
    if (!isSwimlaneShape(node.shape)) return 0
    if (isPoolShape(node.shape)) {
      return computePoolMinSize(node).width
    }
      return computeLaneMinSize(node).width
  }

  resizing.minHeight = function (this: Graph, node: Node): number {
    if (!isSwimlaneShape(node.shape)) return 0
    if (isPoolShape(node.shape)) {
      return computePoolMinSize(node).height
    }
      return computeLaneResizeMinHeight(node)
  }

  return saved
}

/**
 * 恢复 Transform 插件的原始 resizing 配置。
 */
export function restoreTransformResizing(
  graph: Graph,
  saved: TransformResizingSaved | null,
): void {
  if (!saved) return

  const plugin = (graph as any).getPlugin?.('transform')
  if (!plugin?.options) return

  const resizing = plugin.options.resizing as Record<string, unknown> | undefined
  if (!resizing) return

  if (saved.minWidth !== undefined) {
    resizing.minWidth = saved.minWidth
  } else {
    delete resizing.minWidth
  }

  if (saved.minHeight !== undefined) {
    resizing.minHeight = saved.minHeight
  } else {
    delete resizing.minHeight
  }
}

function commitResize(
  graph: Graph,
  node: Node,
  previewRect: Rect,
  direction: ResizeDirection,
  originalRect: Rect = nodeRect(node),
): void {
  const normalizedPreviewRect = normalizeResizeRect(originalRect, previewRect, direction)
  const clampedPreviewRect = clampPreviewRect(node, normalizedPreviewRect, direction, originalRect)

  if (isPoolShape(node.shape)) {
    commitPoolResize(graph, node, clampedPreviewRect, originalRect, direction)
    return
  }

  if (!isLaneShape(node.shape)) {
    return
  }

  const pool = findAncestorPool(node)
  const siblingAdjustments = isVerticalLaneResize(direction)
    ? computeSiblingResizeAdjustments(node, originalRect, clampedPreviewRect)
    : []
  const nextPoolRect = pool
    ? buildPoolRectFromLanePreview(node, pool, clampedPreviewRect, direction)
    : null

  graph.startBatch('bpmn-lane-resize-commit')
  try {
    if (pool && nextPoolRect) {
      applyBounds(pool, nextPoolRect)
      syncPoolLaneFrame(pool)
    }
    applyBounds(node, clampedPreviewRect)
    for (const adjustment of siblingAdjustments) {
      applyBounds(adjustment.node, adjustment.newBounds)
    }
    if (pool) {
      restackCommittedPoolLanes(pool)
    }
  } finally {
    graph.stopBatch('bpmn-lane-resize-commit')
  }
}

function commitPoolResize(
  graph: Graph,
  pool: Node,
  previewRect: Rect,
  previousRect: Rect = nodeRect(pool),
  direction: ResizeDirection = 'se',
): void {
  graph.startBatch('bpmn-pool-resize-commit')
  try {
    applyBounds(pool, previewRect)
    syncPoolLanes(pool, previousRect, previewRect)
    compactLaneLayout(graph, pool)

    if (!direction.includes('n') && !direction.includes('s')) {
      pool.setPosition(pool.getPosition().x, previousRect.y)
      pool.setSize(pool.getSize().width, previousRect.height)
      compactLaneLayout(graph, pool)
    }

    if (!direction.includes('e') && !direction.includes('w')) {
      pool.setPosition(previousRect.x, pool.getPosition().y)
      pool.setSize(previousRect.width, pool.getSize().height)
      compactLaneLayout(graph, pool)
    }

    if (direction.includes('n')) {
      stabilizePoolTopByContent(graph, pool)
    }
  } finally {
    graph.stopBatch('bpmn-pool-resize-commit')
  }
}

function stabilizePoolTopByContent(graph: Graph, pool: Node): void {
  const contentRect = computePoolContentRect(pool)
  if (!contentRect) {
    return
  }

  const currentRect = nodeRect(pool)
  if (currentRect.y <= contentRect.y) {
    return
  }

  const delta = currentRect.y - contentRect.y
  const lanes = safeGetChildren(pool)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))
    .sort((left, right) => left.getPosition().y - right.getPosition().y)

  pool.setPosition(currentRect.x, contentRect.y)
  pool.setSize(currentRect.width, currentRect.height + delta)

  if (lanes.length > 0) {
    const firstLane = lanes[0]
    firstLane.setPosition(firstLane.getPosition().x, firstLane.getPosition().y - delta)
    firstLane.setSize(firstLane.getSize().width, firstLane.getSize().height + delta)
  }

  compactLaneLayout(graph, pool)
}

function syncPoolLanes(pool: Node, previousRect: Rect, nextRect: Rect): void {
  const lanes = safeGetChildren(pool)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))
    .sort((left, right) => left.getPosition().y - right.getPosition().y)

  if (lanes.length === 0) {
    return
  }

  const contentX = nextRect.x + LANE_INDENTATION
  const contentWidth = Math.max(0, nextRect.width - LANE_INDENTATION)

  if (lanes.length === 1) {
    applyBounds(lanes[0], {
      x: contentX,
      y: nextRect.y,
      width: contentWidth,
      height: nextRect.height,
    })
    return
  }

  const topDelta = nextRect.y - previousRect.y
  const bottomDelta = nextRect.y + nextRect.height - (previousRect.y + previousRect.height)
  const firstLane = lanes[0]
  const lastLane = lanes[lanes.length - 1]
  const firstSize = firstLane.getSize()
  const lastSize = lastLane.getSize()

  for (const lane of lanes) {
    lane.setPosition(contentX, lane.getPosition().y)
    lane.setSize(contentWidth, lane.getSize().height)
  }

  firstLane.setPosition(contentX, nextRect.y)
  firstLane.setSize(
    contentWidth,
    Math.max(computeLaneMinSize(firstLane).height, firstSize.height - topDelta),
  )

  lastLane.setSize(
    contentWidth,
    Math.max(computeLaneMinSize(lastLane).height, lastSize.height + bottomDelta),
  )
}

function syncPoolLaneFrame(pool: Node): void {
  const lanes = safeGetChildren(pool)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))

  if (lanes.length === 0) {
    return
  }

  const poolRect = nodeRect(pool)
  const contentX = poolRect.x + LANE_INDENTATION
  const contentWidth = Math.max(0, poolRect.width - LANE_INDENTATION)

  for (const lane of lanes) {
    lane.setPosition(contentX, lane.getPosition().y)
    lane.setSize(contentWidth, lane.getSize().height)
  }
}

function restackCommittedPoolLanes(pool: Node): void {
  const lanes = safeGetChildren(pool)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))
    .sort((left, right) => left.getPosition().y - right.getPosition().y)

  if (lanes.length === 0) {
    return
  }

  const poolRect = nodeRect(pool)
  const contentX = poolRect.x + LANE_INDENTATION
  const contentWidth = Math.max(0, poolRect.width - LANE_INDENTATION)
  let cursorY = poolRect.y

  // Lane resize commit should only move the involved divider/boundary.
  // Re-stack positions and widths, but keep committed heights unchanged.
  for (const lane of lanes) {
    const size = lane.getSize()
    lane.setPosition(contentX, cursorY)
    lane.setSize(contentWidth, size.height)
    cursorY += size.height
  }
}

function clampPreviewRect(
  node: Node,
  previewRect: Rect,
  direction: ResizeDirection,
  currentRect: Rect,
  poolPreviewConstraintSnapshot: PoolPreviewConstraintSnapshot | null = null,
): Rect {
  if (isLaneShape(node.shape)) {
    return clampLanePreviewRect(node, previewRect, direction, currentRect)
  }

  if (isPoolShape(node.shape)) {
    return clampPoolPreviewRect(node, previewRect, direction, currentRect, poolPreviewConstraintSnapshot)
  }

  return previewRect
}

function clampPoolPreviewRect(
  pool: Node,
  previewRect: Rect,
  direction: ResizeDirection,
  currentRect: Rect = nodeRect(pool),
  poolPreviewConstraintSnapshot: PoolPreviewConstraintSnapshot | null = null,
): Rect {
  const currentTrbl = asTRBL(currentRect)
  const previewTrbl = asTRBL(previewRect)
  const poolMin = poolPreviewConstraintSnapshot?.poolMin ?? computePoolMinSize(pool)
  const poolContent = poolPreviewConstraintSnapshot?.poolContent ?? computePoolContentRect(pool)
  const contentInsetLeft = poolPreviewConstraintSnapshot?.contentInsetLeft ?? computePoolContentInsetLeft(pool, currentRect)

  if (direction.includes('n')) {
    previewTrbl.top = Math.min(previewTrbl.top, currentTrbl.bottom - poolMin.height)
    if (poolContent) {
      previewTrbl.top = Math.min(previewTrbl.top, poolContent.y)
    }
  }
  if (direction.includes('s')) {
    previewTrbl.bottom = Math.max(previewTrbl.bottom, currentTrbl.top + poolMin.height)
  }
  if (direction.includes('w')) {
    previewTrbl.left = Math.min(previewTrbl.left, currentTrbl.right - poolMin.width)
    if (poolContent) {
      previewTrbl.left = Math.min(previewTrbl.left, poolContent.x - contentInsetLeft)
    }
  }
  if (direction.includes('e')) {
    previewTrbl.right = Math.max(previewTrbl.right, currentTrbl.left + poolMin.width)
  }

  return trblToRect(previewTrbl as TRBL)
}

function buildResizeRect(
  currentRect: Rect,
  nextWidth: number,
  nextHeight: number,
  direction: ResizeDirection,
): Rect {
  const currentTrbl = asTRBL(currentRect)
  const nextTrbl: TRBL = {
    top: currentTrbl.top,
    right: currentTrbl.right,
    bottom: currentTrbl.bottom,
    left: currentTrbl.left,
  }

  if (direction.includes('n')) {
    nextTrbl.top = currentTrbl.bottom - Math.max(0, nextHeight)
  } else if (direction.includes('s')) {
    nextTrbl.bottom = currentTrbl.top + Math.max(0, nextHeight)
  }

  if (direction.includes('w')) {
    nextTrbl.left = currentTrbl.right - Math.max(0, nextWidth)
  } else if (direction.includes('e')) {
    nextTrbl.right = currentTrbl.left + Math.max(0, nextWidth)
  }

  return trblToRect(nextTrbl)
}

function buildResizeRectFromLivePosition(
  baseRect: Rect,
  liveRect: Rect,
  direction: ResizeDirection,
): Rect {
  const baseTrbl = asTRBL(baseRect)
  const liveTrbl = asTRBL(liveRect)
  const nextTrbl: TRBL = {
    top: baseTrbl.top,
    right: baseTrbl.right,
    bottom: baseTrbl.bottom,
    left: baseTrbl.left,
  }

  // position 事件只可信会直接随坐标变化的边：top / left。
  // 右边和下边的真实变化来自 size 事件；若在这里用 liveRect.right / bottom
  // 回写，会把 corner resize 中已经累计出的 east / south 尺寸增长冲掉。
  if (direction.includes('n')) {
    nextTrbl.top = liveTrbl.top
  }
  if (direction.includes('w')) {
    nextTrbl.left = liveTrbl.left
  }

  return trblToRect(nextTrbl)
}

function buildOriginalRectFromLiveSizeChange(
  liveRect: Rect,
  previous: { width?: number; height?: number } | undefined,
  direction: ResizeDirection,
): Rect {
  const originalRect: Rect = {
    x: liveRect.x,
    y: liveRect.y,
    width: previous?.width ?? liveRect.width,
    height: previous?.height ?? liveRect.height,
  }

  if (direction.includes('n') && previous?.height !== undefined) {
    originalRect.y = liveRect.y + liveRect.height - previous.height
  }

  if (direction.includes('w') && previous?.width !== undefined) {
    originalRect.x = liveRect.x + liveRect.width - previous.width
  }

  return originalRect
}

function buildOriginalRectFromLivePositionChange(
  liveRect: Rect,
  previous: { x?: number; y?: number } | undefined,
  direction: ResizeDirection,
): Rect {
  const originalRect: Rect = {
    x: previous?.x ?? liveRect.x,
    y: previous?.y ?? liveRect.y,
    width: liveRect.width,
    height: liveRect.height,
  }

  if (direction.includes('n') && previous?.y !== undefined) {
    originalRect.height = liveRect.y + liveRect.height - previous.y
  }

  if (direction.includes('w') && previous?.x !== undefined) {
    originalRect.width = liveRect.x + liveRect.width - previous.x
  }

  return originalRect
}

function reconcileOriginalRectWithLiveSizeChange(
  originalRect: Rect,
  previous: { width?: number; height?: number } | undefined,
): Rect {
  return {
    ...originalRect,
    width: previous?.width ?? originalRect.width,
    height: previous?.height ?? originalRect.height,
  }
}

function reconcileOriginalRectWithLivePositionChange(
  originalRect: Rect,
  previous: { x?: number; y?: number } | undefined,
): Rect {
  return {
    ...originalRect,
    x: previous?.x ?? originalRect.x,
    y: previous?.y ?? originalRect.y,
  }
}

function renderPreviewElement(
  graph: Graph,
  nodeId: string,
  rect: Rect,
  existing: HTMLDivElement | null,
): HTMLDivElement | null {
  const container = (graph as Graph & { container?: HTMLElement }).container
  if (!container) {
    return null
  }

  if (!container.style.position) {
    container.style.position = 'relative'
  }

  const element = existing ?? document.createElement('div')
  const previewBox = projectPreviewRectToContainer(graph, container, rect)
  element.dataset.bpmnSwimlaneResizePreview = 'true'
  element.dataset.nodeId = nodeId
  element.style.position = 'absolute'
  element.style.left = `${previewBox.left}px`
  element.style.top = `${previewBox.top}px`
  element.style.width = `${previewBox.width}px`
  element.style.height = `${previewBox.height}px`
  element.style.border = '1px dashed #1677ff'
  element.style.background = 'rgba(22, 119, 255, 0.08)'
  element.style.pointerEvents = 'none'
  element.style.boxSizing = 'border-box'
  element.style.zIndex = '20'

  if (!existing) {
    container.appendChild(element)
  }

  return element
}

function projectPreviewRectToContainer(
  graph: Graph,
  container: HTMLElement,
  rect: Rect,
): { left: number; top: number; width: number; height: number } {
  const graphWithProjection = graph as Graph & {
    localToClient?: (point: { x: number; y: number }) => { x: number; y: number }
  }

  if (typeof graphWithProjection.localToClient !== 'function') {
    return {
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }
  }

  const topLeft = graphWithProjection.localToClient({ x: rect.x, y: rect.y })
  const bottomRight = graphWithProjection.localToClient({
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  })

  if (
    !Number.isFinite(topLeft.x)
    || !Number.isFinite(topLeft.y)
    || !Number.isFinite(bottomRight.x)
    || !Number.isFinite(bottomRight.y)
  ) {
    return {
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }
  }

  const containerRect = container.getBoundingClientRect()

  return {
    left: topLeft.x - containerRect.left,
    top: topLeft.y - containerRect.top,
    width: Math.max(0, bottomRight.x - topLeft.x),
    height: Math.max(0, bottomRight.y - topLeft.y),
  }
}

function resolveResizeDirection(
  options?: ResizeEventOptions,
): ResizeDirection | null {
  const direction = resolveRawResizeDirection(options?.direction)
  const relativeDirection = resolveRawResizeDirection(options?.relativeDirection)

  return relativeDirection ?? direction
}

function resolveRawResizeDirection(
  raw?: string,
): ResizeDirection | null {
  if (!raw) {
    return null
  }

  const normalized = raw.toLowerCase()
  const mapping: Record<string, ResizeDirection> = {
    top: 'n',
    right: 'e',
    bottom: 's',
    left: 'w',
    'top-right': 'ne',
    'right-top': 'ne',
    'top-left': 'nw',
    'left-top': 'nw',
    'bottom-right': 'se',
    'right-bottom': 'se',
    'bottom-left': 'sw',
    'left-bottom': 'sw',
    n: 'n',
    e: 'e',
    s: 's',
    w: 'w',
    ne: 'ne',
    nw: 'nw',
    se: 'se',
    sw: 'sw',
  }

  return mapping[normalized] ?? null
}

function hasHorizontalResizeChange(originalRect: Rect, previewRect: Rect): boolean {
  return Math.abs(previewRect.x - originalRect.x) > RESIZE_AXIS_CHANGE_EPSILON
    || Math.abs(previewRect.width - originalRect.width) > RESIZE_AXIS_CHANGE_EPSILON
}

function hasVerticalResizeChange(originalRect: Rect, previewRect: Rect): boolean {
  return Math.abs(previewRect.y - originalRect.y) > RESIZE_AXIS_CHANGE_EPSILON
    || Math.abs(previewRect.height - originalRect.height) > RESIZE_AXIS_CHANGE_EPSILON
}

function isTranslationOnlyPreviewUpdate(
  currentPreviewRect: Rect,
  nextPreviewRect: Rect,
): boolean {
  const movedX = Math.abs(nextPreviewRect.x - currentPreviewRect.x) > RESIZE_AXIS_CHANGE_EPSILON
  const movedY = Math.abs(nextPreviewRect.y - currentPreviewRect.y) > RESIZE_AXIS_CHANGE_EPSILON
  const resizedWidth = Math.abs(nextPreviewRect.width - currentPreviewRect.width) > RESIZE_AXIS_CHANGE_EPSILON
  const resizedHeight = Math.abs(nextPreviewRect.height - currentPreviewRect.height) > RESIZE_AXIS_CHANGE_EPSILON

  return (movedX || movedY) && !resizedWidth && !resizedHeight
}

function pickHorizontalDirection(direction: ResizeDirection): 'e' | 'w' | null {
  if (direction.includes('w')) {
    return 'w'
  }
  if (direction.includes('e')) {
    return 'e'
  }
  return null
}

function pickVerticalDirection(direction: ResizeDirection): 'n' | 's' | null {
  if (direction.includes('n')) {
    return 'n'
  }
  if (direction.includes('s')) {
    return 's'
  }
  return null
}

function isVerticalLaneResize(direction: ResizeDirection): boolean {
  return direction.includes('n') || direction.includes('s')
}

function buildPoolRectFromLanePreview(
  lane: Node,
  pool: Node,
  previewRect: Rect,
  direction: ResizeDirection,
): Rect | null {
  const currentPoolRect = nodeRect(pool)
  const nextPoolTrbl = asTRBL(currentPoolRect)
  let changed = false

  if (direction.includes('w')) {
    nextPoolTrbl.left = previewRect.x - LANE_INDENTATION
    changed = true
  }

  if (direction.includes('e')) {
    nextPoolTrbl.right = previewRect.x + previewRect.width
    changed = true
  }

  if (direction.includes('n') && isBoundaryLane(lane, 'top')) {
    nextPoolTrbl.top = previewRect.y
    changed = true
  }

  if (direction.includes('s') && isBoundaryLane(lane, 'bottom')) {
    nextPoolTrbl.bottom = previewRect.y + previewRect.height
    changed = true
  }

  return changed ? trblToRect(nextPoolTrbl) : null
}

function isBoundaryLane(lane: Node, edge: 'top' | 'bottom'): boolean {
  const parent = lane.getParent()
  if (!parent?.isNode()) {
    return false
  }

  const siblingLanes = getLaneSiblingsSorted(parent as Node)

  if (siblingLanes.length === 0) {
    return false
  }

  if (edge === 'top') {
    return siblingLanes[0].id === lane.id
  }

  return siblingLanes[siblingLanes.length - 1].id === lane.id
}

function computeSiblingResizeAdjustments(
  shape: Node,
  currentRect: Rect,
  newBounds: Rect,
): Array<{ node: Node; newBounds: Rect }> {
  const parent = shape.getParent()
  if (!parent?.isNode()) {
    return computeLanesResize(shape, newBounds)
  }

  const siblings = getLaneSiblingsSorted(parent as Node)
  const currentIndex = siblings.findIndex((lane) => lane.id === shape.id)
  if (currentIndex < 0) {
    return []
  }

  const currentTrbl = asTRBL(currentRect)
  const nextTrbl = asTRBL(newBounds)
  const result: Array<{ node: Node; newBounds: Rect }> = []

  if (nextTrbl.top !== currentTrbl.top && currentIndex > 0) {
    const previousLane = siblings[currentIndex - 1]
    const previousRect = nodeRect(previousLane)
    result.push({
      node: previousLane,
      newBounds: {
        x: previousRect.x,
        y: previousRect.y,
        width: previousRect.width,
        height: nextTrbl.top - previousRect.y,
      },
    })
  }

  if (nextTrbl.bottom !== currentTrbl.bottom && currentIndex < siblings.length - 1) {
    const followingLane = siblings[currentIndex + 1]
    const followingRect = nodeRect(followingLane)
    const followingBottom = followingRect.y + followingRect.height
    result.push({
      node: followingLane,
      newBounds: {
        x: followingRect.x,
        y: nextTrbl.bottom,
        width: followingRect.width,
        height: followingBottom - nextTrbl.bottom,
      },
    })
  }

  return result
}

function sameRect(left: Rect, right: Rect): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
}

function getLaneSiblingsSorted(container: Node): Node[] {
  return safeGetChildren(container)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))
    .sort((left, right) => left.getPosition().y - right.getPosition().y)
}

function captureStablePreviewOriginalRect(node: Node): Rect {
  const rect = nodeRect(node)
  const parent = node.getParent()
  if (!parent?.isNode() || !isLaneShape(node.shape)) {
    return rect
  }

  const siblings = getLaneSiblingsSorted(parent as Node)
  const currentIndex = siblings.findIndex((lane) => lane.id === node.id)
  if (currentIndex < 0) {
    return rect
  }

  const parentRect = nodeRect(parent as Node)
  const stableTop = currentIndex > 0
    ? nodeRect(siblings[currentIndex - 1]).y + nodeRect(siblings[currentIndex - 1]).height
    : parentRect.y
  const stableBottom = currentIndex < siblings.length - 1
    ? nodeRect(siblings[currentIndex + 1]).y
    : parentRect.y + parentRect.height

  return {
    x: rect.x,
    y: stableTop,
    width: rect.width,
    height: stableBottom - stableTop,
  }
}

function normalizeResizeRect(
  originalRect: Rect,
  previewRect: Rect,
  direction: ResizeDirection,
): Rect {
  const movesTopEdge = direction.includes('n')
  const movesBottomEdge = direction.includes('s')
  const movesLeftEdge = direction.includes('w')
  const movesRightEdge = direction.includes('e')

  return {
    x: movesLeftEdge ? previewRect.x : originalRect.x,
    y: movesTopEdge ? previewRect.y : originalRect.y,
    width: movesLeftEdge || movesRightEdge ? previewRect.width : originalRect.width,
    height: movesTopEdge || movesBottomEdge ? previewRect.height : originalRect.height,
  }
}

function captureChildLaneRects(node: Node): Map<Node, Rect> {
  if (!isPoolShape(node.shape)) {
    return new Map()
  }

  return new Map(
    safeGetChildren(node)
      .filter((child): child is Node => child.isNode())
      .filter((child) => isLaneShape(child.shape))
      .map((child) => [child, nodeRect(child)] as const),
  )
}

function restoreChildLaneRects(childLaneRects: Map<Node, Rect>): void {
  for (const [lane, rect] of childLaneRects) {
    lane.setPosition(rect.x, rect.y, { silent: true, bpmnPreview: true })
    lane.setSize(rect.width, rect.height, { silent: true, bpmnPreview: true })
  }
}

function captureDescendantNodeRects(node: Node): Map<Node, Rect> {
  const descendantNodeRects = new Map<Node, Rect>()

  const visit = (current: Node): void => {
    for (const child of safeGetChildren(current)) {
      if (!child?.isNode?.()) {
        continue
      }

      const childNode = child as Node
      descendantNodeRects.set(childNode, nodeRect(childNode))
      visit(childNode)
    }
  }

  visit(node)

  return descendantNodeRects
}

function restoreDescendantNodeRects(descendantNodeRects: Map<Node, Rect>): void {
  for (const [node, rect] of descendantNodeRects) {
    node.setPosition(rect.x, rect.y, { silent: true, bpmnPreview: true })
    node.setSize(rect.width, rect.height, { silent: true, bpmnPreview: true })
  }
}

function capturePoolPreviewConstraintSnapshot(node: Node): PoolPreviewConstraintSnapshot | null {
  if (!isPoolShape(node.shape)) {
    return null
  }

  return {
    poolMin: computePoolMinSize(node),
    poolContent: computePoolContentRect(node),
    contentInsetLeft: computePoolContentInsetLeft(node),
  }
}

function computePoolContentInsetLeft(pool: Node, poolRect: Rect = nodeRect(pool)): number {
  const laneChildren = safeGetChildren(pool)
    .filter((child): child is Node => child.isNode())
    .filter((child) => isLaneShape(child.shape))

  if (laneChildren.length === 0) {
    return 0
  }

  let minInsetLeft = Infinity

  for (const lane of laneChildren) {
    minInsetLeft = Math.min(minInsetLeft, lane.getPosition().x - poolRect.x)
  }

  if (!Number.isFinite(minInsetLeft)) {
    return 0
  }

  return Math.max(0, minInsetLeft)
}

function applyBounds(node: Node, rect: Rect): void {
  node.setPosition(rect.x, rect.y)
  node.setSize(rect.width, rect.height)
}

function findAncestorPool(node: Node): Node | null {
  let current: Cell | null = node.getParent()

  while (current) {
    if (current.isNode() && isPoolShape((current as Node).shape)) {
      return current as Node
    }
    current = current.getParent()
  }

  return null
}

function safeGetChildren(node: Node): Cell[] {
  try {
    return node.getChildren?.() ?? []
  } catch {
    return []
  }
}

export const __test__ = {
  commitResize,
  commitPoolResize,
  stabilizePoolTopByContent,
  syncPoolLanes,
  syncPoolLaneFrame,
  restackCommittedPoolLanes,
  clampPoolPreviewRect,
  buildResizeRect,
  buildResizeRectFromLivePosition,
  buildOriginalRectFromLiveSizeChange,
  buildOriginalRectFromLivePositionChange,
  reconcileOriginalRectWithLiveSizeChange,
  reconcileOriginalRectWithLivePositionChange,
  resolveResizeDirection,
  resolveRawResizeDirection,
  projectPreviewRectToContainer,
  hasHorizontalResizeChange,
  hasVerticalResizeChange,
  isTranslationOnlyPreviewUpdate,
  mergePreviewRect,
  pickHorizontalDirection,
  pickVerticalDirection,
  isVerticalLaneResize,
  buildPoolRectFromLanePreview,
  isBoundaryLane,
  computeSiblingResizeAdjustments,
  sameRect,
  getLaneSiblingsSorted,
  captureStablePreviewOriginalRect,
  normalizeResizeRect,
  captureChildLaneRects,
  restoreChildLaneRects,
  captureDescendantNodeRects,
  restoreDescendantNodeRects,
  applyBounds,
  findAncestorPool,
  safeGetChildren,
}
