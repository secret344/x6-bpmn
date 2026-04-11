import type { Cell, Graph, Node } from '@antv/x6'
import { isBoundaryShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { defaultIsValidHostForBoundary } from './boundary-attach'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'
import { nodeRect, type Rect } from './swimlane-layout'
import { findContainingSwimlane, getAncestorPool } from '../core/swimlane-membership'

const SWIMLANE_HEADER_SIZE = 30

type Interactable = boolean | ((cellView: unknown) => boolean)

interface InteractionMap {
  nodeMovable?: Interactable
  [key: string]: unknown
}

type CellViewInteracting =
  | boolean
  | InteractionMap
  | ((cellView: unknown) => InteractionMap | boolean)

type RestrictResolver = (this: Graph, cellView: unknown) => Rect | number | null

interface TranslatingMap {
  restrict?: boolean | number | Rect | RestrictResolver | null
  [key: string]: unknown
}

type EmbeddingFindParentArgs = {
  node: Node
  view?: unknown
}

type EmbeddingFindParent =
  | 'bbox'
  | 'center'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | ((this: Graph, args: EmbeddingFindParentArgs) => Cell[])

type EmbeddingValidateArgs = {
  child: Node
  parent: Node
  childView?: unknown
  parentView?: unknown
}

type EmbeddingValidate = (this: Graph, args: EmbeddingValidateArgs) => boolean

interface EmbeddingMap {
  enabled?: boolean
  findParent?: EmbeddingFindParent
  validate?: EmbeddingValidate
  [key: string]: unknown
}

type GraphWithOptions = Graph & {
  options?: Record<string, unknown>
  container?: HTMLElement | null
  getSelectedCells?: () => Cell[]
  getNodesUnderNode?: (node: Node, options?: { by?: string }) => Node[]
}

export interface SwimlanePolicyOptions {
  isContainedNode?: (shape: string) => boolean
}

function area(rect: Rect): number {
  return rect.width * rect.height
}

function rectRight(rect: Rect): number {
  return rect.x + rect.width
}

function rectBottom(rect: Rect): number {
  return rect.y + rect.height
}

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  )
}

function overlapsRect(left: Rect, right: Rect): boolean {
  return (
    left.x < rectRight(right) &&
    rectRight(left) > right.x &&
    left.y < rectBottom(right) &&
    rectBottom(left) > right.y
  )
}

function intersectRects(left: Rect, right: Rect): Rect | null {
  const x = Math.max(left.x, right.x)
  const y = Math.max(left.y, right.y)
  const width = Math.min(rectRight(left), rectRight(right)) - x
  const height = Math.min(rectBottom(left), rectBottom(right)) - y

  if (width < 0 || height < 0) {
    return null
  }

  return { x, y, width, height }
}

function unionRects(rects: Rect[]): Rect | null {
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rectRight(rect)))
  const bottom = Math.max(...rects.map((rect) => rectBottom(rect)))
  return { x, y, width: right - x, height: bottom - y }
}

function isRectLike(value: unknown): value is Rect {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Rect>
  return (
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  )
}

function isHorizontalSwimlane(node: Node): boolean {
  try {
    return resolveSwimlaneIsHorizontal(node.getData?.(), node.getSize())
  } catch {
    return true
  }
}

function getSwimlaneContentRect(node: Node): Rect {
  const rect = nodeRect(node)
  if (isHorizontalSwimlane(node)) {
    return {
      x: rect.x + SWIMLANE_HEADER_SIZE,
      y: rect.y,
      width: Math.max(0, rect.width - SWIMLANE_HEADER_SIZE),
      height: rect.height,
    }
  }

  return {
    x: rect.x,
    y: rect.y + SWIMLANE_HEADER_SIZE,
    width: rect.width,
    height: Math.max(0, rect.height - SWIMLANE_HEADER_SIZE),
  }
}

function getGraphBounds(graph: Graph): Rect | null {
  const graphWithOptions = graph as GraphWithOptions
  const optionWidth = graphWithOptions.options?.width
  const optionHeight = graphWithOptions.options?.height
  const width = typeof optionWidth === 'number' ? optionWidth : graphWithOptions.container?.clientWidth
  const height = typeof optionHeight === 'number' ? optionHeight : graphWithOptions.container?.clientHeight

  if (typeof width !== 'number' || typeof height !== 'number') {
    return null
  }

  return { x: 0, y: 0, width, height }
}

function getGraphNodes(graph: Graph): Node[] {
  try {
    return graph.getNodes()
  } catch {
    return []
  }
}

export function isContainedFlowNode(shape: string): boolean {
  return !isSwimlaneShape(shape) && !isBoundaryShape(shape)
}

function resolveOriginalInteracting(
  prev: CellViewInteracting | undefined,
  cellView: unknown,
): InteractionMap | boolean {
  if (prev === undefined || prev === null) return true
  if (typeof prev === 'function') return prev(cellView)
  return prev
}

export function patchLaneInteracting(graph: Graph, original: unknown): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  const prev = original as CellViewInteracting | undefined

  opts.interacting = function laneAwareInteracting(cellView: unknown): InteractionMap | boolean {
    const cell =
      cellView && typeof cellView === 'object'
        ? (cellView as { cell?: { shape?: string } }).cell
        : undefined

    if (cell?.shape === BPMN_LANE) {
      const base = resolveOriginalInteracting(prev, cellView)
      if (typeof base === 'boolean') {
        return base ? { nodeMovable: false } : false
      }
      return { ...base, nodeMovable: false }
    }

    return resolveOriginalInteracting(prev, cellView)
  }
}

export function restoreLaneInteracting(graph: Graph, original: unknown): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  if (original === undefined) {
    delete (opts as { interacting?: CellViewInteracting }).interacting
    return
  }

  opts.interacting = original as CellViewInteracting
}

function getSelectedNodes(graph: Graph): Node[] {
  const graphWithOptions = graph as GraphWithOptions
  if (typeof graphWithOptions.getSelectedCells !== 'function') {
    return []
  }

  try {
    return graphWithOptions
      .getSelectedCells()
      .filter((cell) => cell.isNode?.()) as Node[]
  } catch {
    return []
  }
}

function getNodeUnionRect(nodes: Node[]): Rect | null {
  return unionRects(nodes.map((node) => nodeRect(node)))
}

function getOwningPool(graph: Graph, node: Node): Node | null {
  const ancestorPool = getAncestorPool(node)
  if (ancestorPool) {
    return ancestorPool
  }

  const container = findContainingSwimlane(graph, node, node.id)
  if (!container) {
    return null
  }

  return container.shape === BPMN_POOL ? container : getAncestorPool(container)
}

function resolveNodeRestrictArea(
  graph: Graph,
  node: Node,
  isContainedNode: (shape: string) => boolean,
): Rect | null {
  if (node.shape === BPMN_LANE) {
    return nodeRect(node)
  }

  if (node.shape === BPMN_POOL) {
    return null
  }

  if (!isContainedNode(node.shape)) {
    return null
  }

  const owningPool = getOwningPool(graph, node)
  if (!owningPool) {
    return nodeRect(node)
  }

  return getSwimlaneContentRect(owningPool)
}

function resolveSelectionRestrictArea(
  graph: Graph,
  isContainedNode: (shape: string) => boolean,
): Rect | null {
  const selectedNodes = getSelectedNodes(graph)
  if (selectedNodes.length === 0) {
    return null
  }

  if (selectedNodes.some((node) => node.shape === BPMN_LANE)) {
    return getNodeUnionRect(selectedNodes)
  }

  if (selectedNodes.some((node) => node.shape === BPMN_POOL)) {
    return null
  }

  const managedNodes = selectedNodes.filter((node) => isContainedNode(node.shape))
  if (managedNodes.length === 0) {
    return null
  }

  const poolIds = new Set<string>()
  let onlyPool: Node | null = null

  for (const node of managedNodes) {
    const pool = getOwningPool(graph, node)
    if (!pool) {
      return getNodeUnionRect(selectedNodes)
    }

    poolIds.add(pool.id)
    if (!onlyPool) {
      onlyPool = pool
    }
  }

  if (poolIds.size !== 1 || !onlyPool) {
    return getNodeUnionRect(selectedNodes)
  }

  return getSwimlaneContentRect(onlyPool)
}

function normalizeRestrictArea(graph: Graph, areaValue: unknown): Rect | number | null {
  if (isRectLike(areaValue) || typeof areaValue === 'number') {
    return areaValue
  }

  if (areaValue === true) {
    return getGraphBounds(graph)
  }

  return null
}

function mergeRestrictArea(graph: Graph, originalArea: unknown, bpmnArea: Rect | null): Rect | number | null {
  if (!bpmnArea) {
    return normalizeRestrictArea(graph, originalArea)
  }

  if (isRectLike(originalArea)) {
    return intersectRects(originalArea, bpmnArea) ?? bpmnArea
  }

  return bpmnArea
}

function resolveOriginalRestrictArea(
  graph: Graph,
  original: TranslatingMap['restrict'],
  cellView: unknown,
): unknown {
  if (typeof original === 'function') {
    return original.call(graph, cellView)
  }

  return original
}

export function patchTranslatingRestrict(
  graph: Graph,
  original: unknown,
  isContainedNode: (shape: string) => boolean,
): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  const previous = original && typeof original === 'object' ? (original as TranslatingMap) : {}
  const previousRestrict = previous.restrict

  ;(opts as unknown as { translating?: TranslatingMap }).translating = {
    ...previous,
    restrict(this: Graph, cellView: unknown) {
      const viewCell = cellView && typeof cellView === 'object'
        ? ((cellView as { cell?: Cell }).cell as Node | undefined)
        : undefined
      const bpmnArea = viewCell
        ? resolveNodeRestrictArea(graph, viewCell, isContainedNode)
        : resolveSelectionRestrictArea(graph, isContainedNode)
      const originalArea = resolveOriginalRestrictArea(graph, previousRestrict, cellView)
      return mergeRestrictArea(graph, originalArea, bpmnArea)
    },
  }
}

export function restoreTranslatingRestrict(graph: Graph, original: unknown): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  if (original === undefined) {
    delete (opts as unknown as { translating?: TranslatingMap }).translating
    return
  }

  ;(opts as unknown as { translating?: TranslatingMap }).translating = original as TranslatingMap
}

function resolveDefaultEmbeddingCandidates(graph: Graph, node: Node): Cell[] {
  const graphWithOptions = graph as GraphWithOptions
  if (typeof graphWithOptions.getNodesUnderNode === 'function') {
    try {
      return graphWithOptions.getNodesUnderNode(node, { by: 'bbox' })
    } catch {
      // 失败时退回基础遍历。
    }
  }

  const rect = nodeRect(node)
  return getGraphNodes(graph)
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => overlapsRect(nodeRect(candidate), rect))
}

function resolveOriginalFindParent(
  graph: Graph,
  original: EmbeddingMap['findParent'],
  args: EmbeddingFindParentArgs,
): Cell[] {
  if (typeof original === 'function') {
    return original.call(graph, args)
  }

  if (typeof original === 'string') {
    const graphWithOptions = graph as GraphWithOptions
    if (typeof graphWithOptions.getNodesUnderNode === 'function') {
      try {
        return graphWithOptions.getNodesUnderNode(args.node, { by: original })
      } catch {
        return resolveDefaultEmbeddingCandidates(graph, args.node)
      }
    }
  }

  return resolveDefaultEmbeddingCandidates(graph, args.node)
}

function resolveBpmnEmbeddingCandidates(
  graph: Graph,
  node: Node,
  isContainedNode: (shape: string) => boolean,
): Cell[] | null {
  if (node.shape === BPMN_POOL) {
    return []
  }

  const rect = nodeRect(node)

  if (node.shape === BPMN_LANE) {
    return getGraphNodes(graph)
      .filter((candidate) => candidate.shape === BPMN_POOL)
      .filter((candidate) => containsRect(getSwimlaneContentRect(candidate), rect))
      .sort((left, right) => area(nodeRect(left)) - area(nodeRect(right)))
  }

  if (isBoundaryShape(node.shape)) {
    return resolveDefaultEmbeddingCandidates(graph, node)
  }

  if (!isContainedNode(node.shape)) {
    return null
  }

  return getGraphNodes(graph)
    .filter((candidate) => isSwimlaneShape(candidate.shape))
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => containsRect(nodeRect(candidate), rect))
    .sort((left, right) => area(nodeRect(left)) - area(nodeRect(right)))
}

function mergeEmbeddingCandidates(primary: Cell[] | null, fallback: Cell[]): Cell[] {
  if (primary === null) {
    return fallback
  }

  const merged: Cell[] = []
  const seen = new Set<string>()

  for (const candidate of [...primary, ...fallback]) {
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    merged.push(candidate)
  }

  return merged
}

function resolveOriginalEmbeddingValidate(
  graph: Graph,
  original: EmbeddingMap['validate'],
  args: EmbeddingValidateArgs,
): boolean {
  if (typeof original === 'function') {
    return original.call(graph, args)
  }

  return true
}

function resolveBpmnEmbeddingValidate(
  child: Node,
  parent: Node,
  isContainedNode: (shape: string) => boolean,
): boolean | undefined {
  if (child.shape === BPMN_POOL) {
    return false
  }

  if (child.shape === BPMN_LANE) {
    return parent.shape === BPMN_POOL
  }

  if (isBoundaryShape(child.shape)) {
    return defaultIsValidHostForBoundary(parent.shape, child.shape)
  }

  if (isContainedNode(child.shape)) {
    return isSwimlaneShape(parent.shape)
  }

  return undefined
}

export function patchEmbeddingOptions(
  graph: Graph,
  original: unknown,
  isContainedNode: (shape: string) => boolean,
): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  const previous = original && typeof original === 'object' ? (original as EmbeddingMap) : {}
  const previousFindParent = previous.findParent
  const previousValidate = previous.validate

  ;(opts as unknown as { embedding?: EmbeddingMap }).embedding = {
    ...previous,
    enabled: true,
    findParent(this: Graph, args: EmbeddingFindParentArgs) {
      const fallback = resolveOriginalFindParent(graph, previousFindParent, args)
      const bpmn = resolveBpmnEmbeddingCandidates(graph, args.node, isContainedNode)
      return mergeEmbeddingCandidates(bpmn, fallback)
    },
    validate(this: Graph, args: EmbeddingValidateArgs) {
      const bpmnResult = resolveBpmnEmbeddingValidate(args.child, args.parent, isContainedNode)
      if (bpmnResult === false) {
        return false
      }

      const originalResult = resolveOriginalEmbeddingValidate(graph, previousValidate, args)
      if (!originalResult) {
        return false
      }

      return bpmnResult ?? originalResult
    },
  }
}

export function restoreEmbeddingOptions(graph: Graph, original: unknown): void {
  const opts = (graph as GraphWithOptions).options
  if (!opts) return

  if (original === undefined) {
    delete (opts as unknown as { embedding?: EmbeddingMap }).embedding
    return
  }

  ;(opts as unknown as { embedding?: EmbeddingMap }).embedding = original as EmbeddingMap
}

export function setupSwimlanePolicy(
  graph: Graph,
  options: SwimlanePolicyOptions = {},
): () => void {
  const graphOptions = (graph as GraphWithOptions).options
  const isContainedNode = options.isContainedNode ?? isContainedFlowNode
  const originalInteracting = graphOptions?.interacting
  const originalTranslating = graphOptions?.translating
  const originalEmbedding = graphOptions?.embedding

  patchLaneInteracting(graph, originalInteracting)
  patchTranslatingRestrict(graph, originalTranslating, isContainedNode)
  patchEmbeddingOptions(graph, originalEmbedding, isContainedNode)

  return () => {
    restoreEmbeddingOptions(graph, originalEmbedding)
    restoreTranslatingRestrict(graph, originalTranslating)
    restoreLaneInteracting(graph, originalInteracting)
  }
}