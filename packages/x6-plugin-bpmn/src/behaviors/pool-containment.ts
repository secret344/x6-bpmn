/**
 * Pool / Participant 容器约束行为
 *
 * 在存在 Pool 的协作图场景下，约束流程节点必须位于某个 Pool 内部。
 * 若命中更小的 Lane，则优先保持流程节点的 Lane 嵌套；但对流程节点而言，Lane 不是硬性边界。
 * 对 Lane 本身，则要求保持在所属 Pool 内，避免普通拖拽跨 Pool 改变 Process 分区归属。
 * 主库只负责限制与结果回调，不直接承担 UI 提示。
 */

import type { Graph, Node, Cell } from '@antv/x6'
import { isBoundaryShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'
import {
  autoWrapFirstPool,
  clampSwimlaneToContent,
  normalizeSwimlaneLayers,
} from './swimlane-layout'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface PoolContainmentResult {
  /** 是否通过容器约束 */
  valid: boolean
  /** 失败原因 */
  reason?: string
  /** 当前或建议归属的泳道容器 */
  container?: Node | null
}

export interface PoolContainmentOptions {
  /** 拖拽越界时是否自动回退到最后一个合法位置，默认 true */
  constrainToContainer?: boolean
  /** 新增节点不合法时是否直接移除，默认 true */
  removeInvalidOnAdd?: boolean
  /** 失败回调，由宿主决定是否提示 */
  onViolation?: (result: PoolContainmentResult, node: Node) => void
  /** 自定义失败文案 */
  reason?: string
  /** 自定义判断某个 shape 是否受容器约束 */
  isContainedNode?: (shape: string) => boolean
}

const DEFAULT_REASON = '当前实现中，流程节点需保留在池/参与者内部'
const LANE_REASON = '当前实现中，泳道需保留在所属池/参与者内部'
const POOL_REASON = '当前实现中，Pool 之间不支持重叠或嵌套'

type TranslatableNode = Node & {
  translate?: (tx: number, ty: number, options?: unknown) => void
}

type SizableNode = Node & {
  resize?: (width: number, height: number, options?: unknown) => void
  setSize?: (width: number, height: number, options?: unknown) => void
}

interface NodeState {
  x: number
  y: number
  width: number
  height: number
  container: Node | null
  childIds?: string[]
}

interface NodeChangeOptions {
  ui?: boolean
  silent?: boolean
  selection?: string
  translateBy?: string
  swimlaneCascade?: string
}

// ============================================================================
// Lane interacting 补丁：在 X6 框架层面禁止 Lane 拖拽
// ============================================================================

/**
 * CellViewInteracting 类型的本地镜像，用于避免对 X6 内部类型的直接依赖。
 * X6 的 interacting 选项支持 boolean / 对象 / 函数三种形式。
 */
type Interactable = boolean | ((cellView: unknown) => boolean)
interface InteractionMap {
  nodeMovable?: Interactable
  [key: string]: unknown
}
type CellViewInteracting = boolean | InteractionMap | ((cellView: unknown) => InteractionMap | boolean)

/**
 * 将 graph.options.interacting 替换为包含 Lane 不可拖拽限制的包装器。
 *
 * 保留原有 interacting 逻辑，仅对 Lane 节点追加 nodeMovable: false。
 */
export function patchLaneInteracting(graph: Graph, original: unknown): void {
  const opts = (graph as Graph & { options: Record<string, unknown> }).options
  if (!opts) return

  const prev = original as CellViewInteracting | undefined

  opts.interacting = function laneAwareInteracting(cellView: unknown): InteractionMap | boolean {
    const cell = cellView && typeof cellView === 'object'
      ? (cellView as { cell?: { shape?: string } }).cell
      : undefined

    // 对 Lane 节点禁止拖拽，仅允许调整大小
    if (cell?.shape === BPMN_LANE) {
      const base = resolveOriginalInteracting(prev, cellView)
      if (typeof base === 'boolean') {
        return base ? { nodeMovable: false } : false
      }
      return { ...base, nodeMovable: false }
    }

    // 非 Lane 节点，委托给原始 interacting
    return resolveOriginalInteracting(prev, cellView)
  }
}

/**
 * 恢复 graph.options.interacting 为安装前的原始值。
 */
export function restoreLaneInteracting(graph: Graph, original: unknown): void {
  const opts = (graph as Graph & { options: Record<string, unknown> }).options
  if (!opts) return
  opts.interacting = original
}

function resolveOriginalInteracting(
  prev: CellViewInteracting | undefined,
  cellView: unknown,
): InteractionMap | boolean {
  if (prev === undefined || prev === null) return true
  if (typeof prev === 'function') return prev(cellView)
  return prev
}

function nodeRect(node: Pick<Node, 'getPosition' | 'getSize'>): Rect {
  const position = node.getPosition()
  const size = node.getSize()
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  }
}

function area(rect: Rect): number {
  return rect.width * rect.height
}

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

function overlapsRect(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function hasPoolNodes(graph: Graph): boolean {
  try {
    return graph.getNodes().some((node) => node.shape === BPMN_POOL)
  } catch {
    return false
  }
}

function hasEmbeddedChild(parent: Node | null | undefined, child: Node): boolean {
  /* istanbul ignore next -- 当前调用方只会在存在候选容器时传入 parent，此分支保留为防御性兜底 */
  if (!parent) return false

  try {
    if (typeof parent.getChildren !== 'function') {
      return child.getParent?.()?.id === parent.id
    }

    const children = parent.getChildren?.() as Cell[] | null | undefined
    return Array.isArray(children) && children.some((candidate) => candidate.id === child.id)
  } catch {
    return false
  }
}

function restoreNodePosition(node: Node, position: { x: number; y: number }): void {
  const current = node.getPosition()
  const deltaX = position.x - current.x
  const deltaY = position.y - current.y

  if (deltaX === 0 && deltaY === 0) return

  const translatableNode = node as TranslatableNode
  if (typeof translatableNode.translate === 'function') {
    try {
      // 保持视图同步，避免浏览器拖拽回退时只更新模型而不刷新渲染。
      translatableNode.translate(deltaX, deltaY, { silent: false })
      return
    } catch {
      // translate 失败时退回绝对定位，避免主链路中断。
    }
  }

  node.setPosition(position.x, position.y, { silent: false })
}

function restoreNodeSize(node: Node, size: { width: number; height: number }): void {
  const current = node.getSize()
  if (current.width === size.width && current.height === size.height) return

  const sizableNode = node as SizableNode

  if (typeof sizableNode.resize === 'function') {
    sizableNode.resize(size.width, size.height, { silent: false })
    return
  }

  if (typeof sizableNode.setSize === 'function') {
    sizableNode.setSize(size.width, size.height, { silent: false })
  }
}

export function isContainedFlowNode(shape: string): boolean {
  return !isSwimlaneShape(shape) && !isBoundaryShape(shape)
}

function isContainedNodeByDefault(shape: string): boolean {
  return !isBoundaryShape(shape)
}

function findCollidingPool(graph: Graph, node: Node, rect: Rect): Node | null {
  try {
    return graph.getNodes()
      .filter((candidate) => candidate.shape === BPMN_POOL)
      .filter((candidate) => candidate.id !== node.id)
      .find((candidate) => overlapsRect(nodeRect(candidate), rect)) ?? null
  } catch {
    return null
  }
}

function getPoolAncestor(node: Node | null | undefined): Node | null {
  let current = node as Cell | null | undefined
  while (current) {
    if (current.isNode?.() && current.shape === BPMN_POOL) {
      return current as Node
    }
    current = current.getParent?.() as Cell | null | undefined
  }
  return null
}

function resolveContainmentReason(shape: string, customReason?: string): string {
  if (customReason) return customReason
  return shape === BPMN_LANE ? LANE_REASON : DEFAULT_REASON
}

export function getSwimlaneAncestor(node: Node | null | undefined): Node | null {
  let current = node?.getParent?.() as Cell | null | undefined
  while (current) {
    if (current.isNode?.() && isSwimlaneShape(current.shape)) {
      return current as Node
    }
    current = current.getParent?.() as Cell | null | undefined
  }
  return null
}

export function findContainingSwimlane(
  graph: Graph,
  target: Rect | Pick<Node, 'getPosition' | 'getSize'>,
  excludeNodeId?: string,
): Node | null {
  const rect = 'x' in target ? target : nodeRect(target)

  try {
    const candidates = graph.getNodes()
      .filter((node) => isSwimlaneShape(node.shape))
      .filter((node) => node.id !== excludeNodeId)
      .filter((node) => containsRect(nodeRect(node), rect))
      .sort((left, right) => area(nodeRect(left)) - area(nodeRect(right)))

    const laneCandidate = candidates.find((node) => node.shape !== BPMN_POOL)
    if (laneCandidate) return laneCandidate

    return candidates[0] ?? null
  } catch {
    return null
  }
}

export function validatePoolContainment(
  graph: Graph,
  node: Node,
  options: Pick<PoolContainmentOptions, 'reason' | 'isContainedNode'> = {},
): PoolContainmentResult {
  const reason = resolveContainmentReason(node.shape, options.reason)
  const isContainedNode = options.isContainedNode ?? isContainedNodeByDefault

  if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
    return { valid: true }
  }

  const rect = nodeRect(node)

  if (node.shape === BPMN_POOL) {
    const collidingPool = findCollidingPool(graph, node, rect)
    if (collidingPool) {
      return { valid: false, reason: POOL_REASON }
    }

    return { valid: true }
  }

  const ancestor = getSwimlaneAncestor(node)
  const container = findContainingSwimlane(graph, rect, node.id)

  if (node.shape === BPMN_LANE) {
    const owningPool = getPoolAncestor(node)

    if (owningPool) {
      if (!containsRect(nodeRect(owningPool), rect)) {
        return { valid: false, reason }
      }

      if (!container) {
        return { valid: true, container: owningPool }
      }

      const containerPool = container.shape === BPMN_POOL ? container : getPoolAncestor(container)
      return {
        valid: true,
        container: containerPool?.id === owningPool.id ? container : owningPool,
      }
    }

    if (container) {
      return { valid: true, container }
    }

    return { valid: false, reason }
  }

  if (ancestor && containsRect(nodeRect(ancestor), rect)) {
    return { valid: true, container: container ?? ancestor }
  }

  if (container) {
    return { valid: true, container }
  }

  return { valid: false, reason }
}

export function setupPoolContainment(
  graph: Graph,
  options: PoolContainmentOptions = {},
): () => void {
  const {
    constrainToContainer = true,
    removeInvalidOnAdd = true,
    onViolation,
    reason,
    isContainedNode = isContainedNodeByDefault,
  } = options

  const lastValidState = new WeakMap<Node, NodeState>()
  const activeDragState = new WeakMap<Node, NodeState>()
  const activeDragNodes = new WeakSet<Node>()
  const activeDragNodeIds = new Set<string>()
  const activeDragNodeRefs = new Set<Node>()
  const activeDragViolationReason = new WeakMap<Node, string>()
  const lastViolationReason = new WeakMap<Node, string>()
  const restoringNodes = new WeakSet<Node>()
  const restoringNodeIds = new Set<string>()
  const adjustingSwimlanes = new WeakSet<Node>()
  const adjustingSwimlaneIds = new Set<string>()
  const pendingSwimlaneChildRepairs = new Set<Node>()
  const selectionDragNodes = new WeakSet<Node>()
  const selectionDragNodeIds = new Set<string>()
  const selectionDragNodeRefs = new Set<Node>()
  const lockedSelectionDragNodes = new WeakSet<Node>()
  const lockedSelectionDragNodeIds = new Set<string>()
  const lockedSelectionDragNodeRefs = new Set<Node>()
  const swimlaneDescendantBaselines = new WeakMap<Node, Map<string, { x: number; y: number }>>()

  const ownerDocument = (
    graph as Graph & { container?: { ownerDocument?: Document | null } }
  ).container?.ownerDocument

  // ---------- Lane 节点禁止拖拽（参照 bpmn.js 行为） ----------
  // 通过 X6 的 interacting 选项在框架层面阻止 Lane 拖拽，避免位置复位引发的视觉抖动。
  const originalInteracting = (graph as Graph & { options: Record<string, unknown> }).options?.interacting
  patchLaneInteracting(graph, originalInteracting)

  function hasTrackedNode(nodeSet: WeakSet<Node>, nodeIds: Set<string>, node: Node): boolean {
    return nodeSet.has(node) || nodeIds.has(node.id)
  }

  function addTrackedNode(nodeSet: WeakSet<Node>, nodeIds: Set<string>, node: Node): void {
    nodeSet.add(node)
    nodeIds.add(node.id)
  }

  function deleteTrackedNode(nodeSet: WeakSet<Node>, nodeIds: Set<string>, node: Node): void {
    nodeSet.delete(node)
    nodeIds.delete(node.id)
  }

  function deleteTrackedNodeRefs(nodeRefs: Set<Node>, node: Node): void {
    for (const trackedNode of Array.from(nodeRefs)) {
      if (trackedNode.id === node.id) {
        nodeRefs.delete(trackedNode)
      }
    }
  }

  function rememberValidState(node: Node, container?: Node | null): void {
    const position = node.getPosition()
    const size = node.getSize()
    lastValidState.set(node, {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      container: container ?? getSwimlaneAncestor(node),
      childIds: isSwimlaneShape(node.shape) ? getGraphChildren(node).map((child) => child.id) : undefined,
    })
  }

  function captureCurrentValidState(node: Node): NodeState | null {
    const result = validatePoolContainment(graph, node, { reason, isContainedNode })
    if (!result.valid) {
      return null
    }

    const position = node.getPosition()
    const size = node.getSize()
    return {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      container: result.container as Node | null,
      childIds: isSwimlaneShape(node.shape) ? getGraphChildren(node).map((child) => child.id) : undefined,
    }
  }

  function clearViolation(node: Node): void {
    lastViolationReason.delete(node)
  }

  function getGraphChildren(parent: Node): Node[] {
    try {
      return graph
        .getNodes()
        .filter((candidate) => candidate.id !== parent.id)
        .filter((candidate) => candidate.getParent?.()?.id === parent.id)
    } catch {
      return []
    }
  }

  function repairEmbeddedChild(parent: Node, child: Node): boolean {
    if (hasEmbeddedChild(parent, child)) {
      return false
    }

    addTrackedNode(restoringNodes, restoringNodeIds, child)
    try {
      child.getParent?.()?.unembed?.(child)
      parent.embed(child)
      return true
    } finally {
      deleteTrackedNode(restoringNodes, restoringNodeIds, child)
    }
  }

  function findGraphNodeById(nodeId: string | null | undefined): Node | null {
    /* istanbul ignore next -- 调用方已先过滤空 translateBy，空 id 保护仅作为内部兜底。 */
    if (!nodeId) return null

    try {
      const cell = graph.getCellById?.(nodeId)
      if (cell?.isNode?.()) {
        return cell as Node
      }
    } catch {
      // getCellById 缺失时退回到节点扫描。
    }

    try {
      return graph.getNodes().find((candidate) => candidate.id === nodeId) ?? null
    } catch {
      return null
    }
  }

  function collectSwimlaneDescendants(node: Node): Node[] {
    const descendants: Node[] = []
    const queue = [...getGraphChildren(node)]

    while (queue.length > 0) {
      const current = queue.shift() as Node
      descendants.push(current)
      queue.push(...getGraphChildren(current))
    }

    return descendants
  }

  function isDescendantOfNode(node: Node, ancestorId: string): boolean {
    let current = node.getParent?.() as Cell | null | undefined

    while (current) {
      if (current.id === ancestorId) {
        return true
      }

      current = current.getParent?.() as Cell | null | undefined
    }

    return false
  }

  function belongsToTrackedSwimlane(node: Node, ancestorId: string): boolean {
    let current = (activeDragState.get(node)?.container ?? lastValidState.get(node)?.container) as Node | null

    while (current) {
      if (current.id === ancestorId) {
        return true
      }

      current = getSwimlaneAncestor(current)
    }

    return false
  }

  function getSwimlaneCascadeSource(
    node: Node,
    changeType: 'position' | 'size' | 'parent',
    options?: NodeChangeOptions,
  ): Node | null {
    if (changeType !== 'position') return null

    const translateById = options?.translateBy
    if (!translateById || translateById === node.id) return null

    const translateSource = findGraphNodeById(translateById)
    return translateSource && isSwimlaneShape(translateSource.shape) ? translateSource : null
  }

  function getActiveAncestorSwimlaneDrag(node: Node): Node | null {
    let current = getSwimlaneAncestor(node)

    while (current) {
      if (hasTrackedNode(activeDragNodes, activeDragNodeIds, current)) {
        return current
      }

      current = getSwimlaneAncestor(current)
    }

    return null
  }

  function shouldCascadeTrackedSwimlaneChildren(node: Node): boolean {
    return node.shape === BPMN_POOL
  }

  function hasManagedSwimlaneAncestor(node: Node): boolean {
    let current = node.getParent?.() as Cell | null | undefined

    while (current) {
      if (
        current.isNode?.() &&
        isSwimlaneShape(current.shape) &&
        (hasTrackedNode(activeDragNodes, activeDragNodeIds, current as Node) ||
          hasTrackedNode(restoringNodes, restoringNodeIds, current as Node) ||
          hasTrackedNode(adjustingSwimlanes, adjustingSwimlaneIds, current as Node))
      ) {
        return true
      }

      current = current.getParent?.() as Cell | null | undefined
    }

    return false
  }

  function hasOtherManagedSwimlaneDrag(node: Node): boolean {
    for (const dragNode of Array.from(activeDragNodeRefs)) {
      if (dragNode.id !== node.id && isSwimlaneShape(dragNode.shape)) {
        return true
      }
    }

    return false
  }

  function beginDragState(node: Node): void {
    if (hasTrackedNode(activeDragNodes, activeDragNodeIds, node)) return

    addTrackedNode(activeDragNodes, activeDragNodeIds, node)
    activeDragNodeRefs.add(node)
    activeDragViolationReason.delete(node)

    const baselineState = lastValidState.get(node) ?? captureCurrentValidState(node)
    if (!baselineState) return

    lastValidState.set(node, { ...baselineState })
    activeDragState.set(node, { ...baselineState })
    if (shouldCascadeTrackedSwimlaneChildren(node)) {
      swimlaneDescendantBaselines.set(
        node,
        new Map(
          collectSwimlaneDescendants(node).map((descendant) => {
            const position = descendant.getPosition()
            return [descendant.id, { x: position.x, y: position.y }]
          }),
        ),
      )
    }
  }

  function endDragState(node: Node): void {
    deleteTrackedNode(activeDragNodes, activeDragNodeIds, node)
    deleteTrackedNodeRefs(activeDragNodeRefs, node)
    activeDragState.delete(node)
    swimlaneDescendantBaselines.delete(node)
    activeDragViolationReason.delete(node)
    deleteTrackedNode(selectionDragNodes, selectionDragNodeIds, node)
    deleteTrackedNodeRefs(selectionDragNodeRefs, node)
    deleteTrackedNode(lockedSelectionDragNodes, lockedSelectionDragNodeIds, node)
    deleteTrackedNodeRefs(lockedSelectionDragNodeRefs, node)
  }

  function onBatchStop({ name }: { name?: string }): void {
    if (name !== 'move-selection') return

    flushPendingSwimlaneChildRepairs()

    for (const node of Array.from(activeDragNodeRefs)) {
      if (isSwimlaneShape(node.shape)) {
        repairSwimlaneChildren(node)
        rememberValidState(node)
      }
      endDragState(node)
    }
  }

  function onPointerRelease(): void {
    flushPendingSwimlaneChildRepairs()

    for (const node of Array.from(activeDragNodeRefs)) {
      if (!activeDragViolationReason.has(node) && !selectionDragNodeIds.has(node.id)) {
        continue
      }

      if (isSwimlaneShape(node.shape)) {
        repairSwimlaneChildren(node)
        rememberValidState(node)
      }
      endDragState(node)
    }
  }

  function notifyViolation(result: PoolContainmentResult, node: Node): void {
    const key = result.reason as string
    if (hasTrackedNode(activeDragNodes, activeDragNodeIds, node)) {
      if (activeDragViolationReason.get(node) === key) return
      activeDragViolationReason.set(node, key)
    } else {
      if (lastViolationReason.get(node) === key) return
      lastViolationReason.set(node, key)
    }

    lastViolationReason.set(node, key)
    try {
      onViolation?.(result, node)
    } catch {
      // 宿主提示逻辑不应打断主链路。
    }
  }

  function syncContainment(node: Node): boolean {
    const result = validatePoolContainment(graph, node, { reason, isContainedNode })
    if (!result.valid) {
      notifyViolation(result, node)
      return false
    }

    const currentAncestor = getSwimlaneAncestor(node)
    const nextContainer = result.container
    if (nextContainer && (currentAncestor?.id !== nextContainer.id || !hasEmbeddedChild(nextContainer, node))) {
      currentAncestor?.unembed?.(node)
      nextContainer.embed(node)
      normalizeSwimlaneLayers(graph)
    }

    rememberValidState(node, nextContainer)
    clearViolation(node)
    return true
  }

  function restoreLastValidState(node: Node): void {
    const lastState = activeDragState.get(node) ?? lastValidState.get(node)
    if (!lastState) return

    addTrackedNode(restoringNodes, restoringNodeIds, node)

    try {
      restoreNodeSize(node, { width: lastState.width, height: lastState.height })
      restoreNodePosition(node, { x: lastState.x, y: lastState.y })

      const currentAncestor = getSwimlaneAncestor(node)
      const expectedContainer = lastState.container ?? findContainingSwimlane(graph, node, node.id)
      if (!expectedContainer) return
      const containerSatisfied =
        currentAncestor?.id === expectedContainer.id && hasEmbeddedChild(expectedContainer, node)

      if (!containerSatisfied) {
        currentAncestor?.unembed?.(node)
        expectedContainer.embed(node)
        normalizeSwimlaneLayers(graph)
      }

      if (isSwimlaneShape(node.shape)) {
        pendingSwimlaneChildRepairs.add(node)
        for (const child of getTrackedSwimlaneChildren(lastState, node)) {
          restoreLastValidState(child)
          rememberValidState(child)
        }
      }
    } finally {
      deleteTrackedNode(restoringNodes, restoringNodeIds, node)
    }
  }

  function cascadeSwimlaneChildren(node: Node, fallbackOnly = false): void {
    /* istanbul ignore next -- 该内部方法只在 Pool 拖拽路径调用，非 Pool 保护分支仅保留为防御性兜底。 */
    if (!shouldCascadeTrackedSwimlaneChildren(node)) return

    const baselineState = activeDragState.get(node) ?? lastValidState.get(node)
    const descendantBaselines = swimlaneDescendantBaselines.get(node) ?? new Map<string, { x: number; y: number }>()
    swimlaneDescendantBaselines.set(node, descendantBaselines)
    if (!baselineState) return

    const currentPosition = node.getPosition()
    const deltaX = currentPosition.x - baselineState.x
    const deltaY = currentPosition.y - baselineState.y
    if (deltaX === 0 && deltaY === 0) return

    let descendants: Node[] = []
    try {
      descendants = graph
        .getNodes()
        .filter((candidate) => candidate.id !== node.id)
        .filter((candidate) => {
          const currentDescendant = isDescendantOfNode(candidate, node.id)
          const trackedDescendant = belongsToTrackedSwimlane(candidate, node.id)

          if (fallbackOnly) {
            return !currentDescendant && trackedDescendant
          }

          return currentDescendant || trackedDescendant
        })
    } catch {
      descendants = []
    }

    for (const descendant of descendants) {
      const descendantBaseline = descendantBaselines.get(descendant.id) ?? descendant.getPosition()
      descendantBaselines.set(descendant.id, descendantBaseline)

      descendant.setPosition(descendantBaseline.x + deltaX, descendantBaseline.y + deltaY, {
        silent: false,
        swimlaneCascade: node.id,
      })
    }
  }

  function normalizeSwimlaneGeometry(node: Node): void {
    /* istanbul ignore next -- 调整过程中的重入保护依赖真实事件递归，单测下无法稳定制造。 */
    if (!isSwimlaneShape(node.shape) || hasTrackedNode(adjustingSwimlanes, adjustingSwimlaneIds, node)) return

    addTrackedNode(adjustingSwimlanes, adjustingSwimlaneIds, node)
    try {
      if (clampSwimlaneToContent(node)) {
        normalizeSwimlaneLayers(graph)
      }
    } finally {
      deleteTrackedNode(adjustingSwimlanes, adjustingSwimlaneIds, node)
    }
  }

  function repairSwimlaneChildren(node: Node, rememberChildren = true): void {
    if (!isSwimlaneShape(node.shape)) return

    let repairedChildEmbedding = false

    for (const child of getGraphChildren(node)) {
      repairedChildEmbedding = repairEmbeddedChild(node, child) || repairedChildEmbedding

      if (!containsRect(nodeRect(node), nodeRect(child))) {
        restoreLastValidState(child)
        continue
      }

      if (rememberChildren || !lastValidState.has(child)) {
        rememberValidState(child)
      }
    }

    if (repairedChildEmbedding) {
      normalizeSwimlaneLayers(graph)
    }
  }

  function getTrackedSwimlaneChildren(state: NodeState, node: Node): Node[] {
    /* istanbul ignore next -- getCellById 的宿主差异仅影响兜底路径，业务回归已覆盖后续父链扫描恢复。 */
    const trackedChildren = (state.childIds ?? [])
      .map((childId) => graph.getCellById?.(childId))
      .filter((cell): cell is Node => Boolean(cell?.isNode?.()))

    if (trackedChildren.length > 0) {
      return trackedChildren
    }

    return getGraphChildren(node)
  }

  function flushPendingSwimlaneChildRepairs(): void {
    for (const swimlane of Array.from(pendingSwimlaneChildRepairs)) {
      pendingSwimlaneChildRepairs.delete(swimlane)
      repairSwimlaneChildren(swimlane)

      for (const child of getGraphChildren(swimlane)) {
        restoreLastValidState(child)
        rememberValidState(child)
      }
    }
  }

  function handleFirstPool(node: Node): void {
    const wrappedNodes = autoWrapFirstPool(graph, node)
    for (const wrappedNode of wrappedNodes) {
      const currentAncestor = getSwimlaneAncestor(wrappedNode)
      currentAncestor?.unembed?.(wrappedNode)
      node.embed(wrappedNode)
      rememberValidState(wrappedNode, node)
    }

    normalizeSwimlaneGeometry(node)
    rememberValidState(node)
    normalizeSwimlaneLayers(graph)
  }

  function onNodeAdded({ node }: { node: Node }) {
    if (node.shape === BPMN_POOL) {
      if (!syncContainment(node)) {
        if (removeInvalidOnAdd) {
          node.remove()
        }
        return
      }

      handleFirstPool(node)
      return
    }

    if (isSwimlaneShape(node.shape)) {
      normalizeSwimlaneLayers(graph)
    }

    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (syncContainment(node)) return
    if (removeInvalidOnAdd) {
      node.remove()
    }
  }

  function onNodeMoving({ node }: { node: Node }) {
    if (hasTrackedNode(restoringNodes, restoringNodeIds, node)) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (hasManagedSwimlaneAncestor(node) || hasOtherManagedSwimlaneDrag(node)) return

    // Lane 节点不允许拖拽，仅允许调整大小（参照 bpmn.js 行为）。
    if (node.shape === BPMN_LANE) {
      const lastState = activeDragState.get(node) ?? lastValidState.get(node)
      if (lastState) {
        restoreNodePosition(node, { x: lastState.x, y: lastState.y })
      }
      return
    }

    beginDragState(node)
    if (syncContainment(node)) {
      // Pool 持续拖拽时，同步级联更新所有后代位置，避免内部节点抖动或滞后。
      if (shouldCascadeTrackedSwimlaneChildren(node)) {
        cascadeSwimlaneChildren(node)
      }
      repairSwimlaneChildren(node, !isSwimlaneShape(node.shape))
      return
    }
    if (!constrainToContainer) return

    restoreLastValidState(node)
    if (isSwimlaneShape(node.shape)) {
      flushPendingSwimlaneChildRepairs()
    }
  }

  function onNodeMoved({ node }: { node: Node }) {
    if (hasTrackedNode(restoringNodes, restoringNodeIds, node)) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
      endDragState(node)
      return
    }
    if (hasManagedSwimlaneAncestor(node) || hasOtherManagedSwimlaneDrag(node)) return

    try {
      if (syncContainment(node)) {
        if (shouldCascadeTrackedSwimlaneChildren(node)) {
          cascadeSwimlaneChildren(node)
        }

        if (isSwimlaneShape(node.shape) && activeDragViolationReason.has(node)) {
          const dragState = activeDragState.get(node) ?? lastValidState.get(node)
          /* istanbul ignore next -- syncContainment 成功后会立即记住合法状态，此处空状态仅保留为防御性兜底。 */
          if (dragState) {
            for (const child of getTrackedSwimlaneChildren(dragState, node)) {
              restoreLastValidState(child)
              rememberValidState(child)
            }
          }
        }

        repairSwimlaneChildren(node)
        return
      }
      if (!constrainToContainer) return

      restoreLastValidState(node)
      if (isSwimlaneShape(node.shape)) {
        flushPendingSwimlaneChildRepairs()
      }
    } finally {
      endDragState(node)
    }
  }

  function onNodeChanged(
    changeType: 'position' | 'size' | 'parent',
    { node, options }: { node: Node; options?: NodeChangeOptions },
  ) {
    if (
      hasTrackedNode(restoringNodes, restoringNodeIds, node) ||
      hasTrackedNode(adjustingSwimlanes, adjustingSwimlaneIds, node)
    ) return

    if (options?.silent) return
    if (options?.swimlaneCascade) return

    const swimlaneCascadeSource = getSwimlaneCascadeSource(node, changeType, options)
    const activeAncestorSwimlaneDrag = swimlaneCascadeSource
      ? getActiveAncestorSwimlaneDrag(swimlaneCascadeSource)
      : null
    if (swimlaneCascadeSource?.shape === BPMN_POOL) return
    if (activeAncestorSwimlaneDrag?.shape === BPMN_POOL) return

    if (swimlaneCascadeSource?.shape === BPMN_LANE) {
      restoreLastValidState(node)
      if (isSwimlaneShape(node.shape)) {
        normalizeSwimlaneLayers(graph)
      }
      return
    }

    const swimlaneNode = isSwimlaneShape(node.shape)
    const isSelectionDrag = Boolean(options?.selection)

    if (options?.ui && !swimlaneNode && !isSelectionDrag) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (hasManagedSwimlaneAncestor(node) || hasOtherManagedSwimlaneDrag(node)) return

    if (swimlaneNode) {
      if (changeType === 'position' || isSelectionDrag || options?.ui) {
        beginDragState(node)
        if (isSelectionDrag) {
          addTrackedNode(selectionDragNodes, selectionDragNodeIds, node)
          selectionDragNodeRefs.add(node)
        }
      }

      if (changeType === 'position' && shouldCascadeTrackedSwimlaneChildren(node)) {
        cascadeSwimlaneChildren(node, true)
      }

      if (isSelectionDrag && hasTrackedNode(lockedSelectionDragNodes, lockedSelectionDragNodeIds, node)) {
        restoreLastValidState(node)
        normalizeSwimlaneLayers(graph)
        return
      }

      if (changeType === 'size') {
        normalizeSwimlaneGeometry(node)
      }

      if (syncContainment(node)) {
        repairSwimlaneChildren(node)
        normalizeSwimlaneLayers(graph)
        return
      }

      if (!constrainToContainer) {
        normalizeSwimlaneLayers(graph)
        return
      }

      if (isSelectionDrag) {
        addTrackedNode(lockedSelectionDragNodes, lockedSelectionDragNodeIds, node)
        lockedSelectionDragNodeRefs.add(node)
      }

      restoreLastValidState(node)
      normalizeSwimlaneLayers(graph)
      return
    }

    if (isSelectionDrag) {
      beginDragState(node)
      addTrackedNode(selectionDragNodes, selectionDragNodeIds, node)
      selectionDragNodeRefs.add(node)
    }

    if (isSelectionDrag && hasTrackedNode(lockedSelectionDragNodes, lockedSelectionDragNodeIds, node)) {
      restoreLastValidState(node)
      return
    }

    if (syncContainment(node)) {
      repairSwimlaneChildren(node)
      return
    }
    if (!constrainToContainer) return

    if (isSelectionDrag) {
      addTrackedNode(lockedSelectionDragNodes, lockedSelectionDragNodeIds, node)
      lockedSelectionDragNodeRefs.add(node)
    }

    restoreLastValidState(node)
  }

  try {
    for (const node of graph.getNodes()) {
      rememberValidState(node)
    }
    normalizeSwimlaneLayers(graph)
  } catch {
    // graph.getNodes() 防御性兜底。
  }

  graph.on('node:added', onNodeAdded)
  graph.on('node:moving', onNodeMoving)
  graph.on('node:moved', onNodeMoved)
  const onNodePositionChanged = (payload: { node: Node; options?: NodeChangeOptions }) => {
    onNodeChanged('position', payload)
  }

  const onNodeSizeChanged = (payload: { node: Node; options?: NodeChangeOptions }) => {
    onNodeChanged('size', payload)
  }

  const onNodeParentChanged = (payload: { node: Node; options?: NodeChangeOptions }) => {
    onNodeChanged('parent', payload)
  }

  graph.on('node:change:position', onNodePositionChanged)
  graph.on('node:change:size', onNodeSizeChanged)
  graph.on('node:change:parent', onNodeParentChanged)
  graph.model?.on?.('batch:stop', onBatchStop)
  ownerDocument?.addEventListener?.('mouseup', onPointerRelease, true)
  ownerDocument?.addEventListener?.('touchend', onPointerRelease, true)

  return () => {
    graph.off('node:added', onNodeAdded)
    graph.off('node:moving', onNodeMoving)
    graph.off('node:moved', onNodeMoved)
    graph.off('node:change:position', onNodePositionChanged)
    graph.off('node:change:size', onNodeSizeChanged)
    graph.off('node:change:parent', onNodeParentChanged)
    graph.model?.off?.('batch:stop', onBatchStop)
    ownerDocument?.removeEventListener?.('mouseup', onPointerRelease, true)
    ownerDocument?.removeEventListener?.('touchend', onPointerRelease, true)
    restoreLaneInteracting(graph, originalInteracting)
  }
}