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

const DEFAULT_REASON = '流程节点必须位于池/参与者内部'
const LANE_REASON = '泳道必须保留在所属池/参与者内部'

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
  return shape !== BPMN_POOL && !isBoundaryShape(shape)
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
  const activeDragNodeRefs = new Set<Node>()
  const activeDragViolationReason = new WeakMap<Node, string>()
  const lastViolationReason = new WeakMap<Node, string>()
  const restoringNodes = new WeakSet<Node>()
  const lockedSelectionDragNodes = new WeakSet<Node>()
  const lockedSelectionDragNodeRefs = new Set<Node>()

  const ownerDocument = (
    graph as Graph & { container?: { ownerDocument?: Document | null } }
  ).container?.ownerDocument

  function rememberValidState(node: Node, container?: Node | null): void {
    const position = node.getPosition()
    const size = node.getSize()
    lastValidState.set(node, {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      container: container ?? getSwimlaneAncestor(node),
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
    }
  }

  function clearViolation(node: Node): void {
    lastViolationReason.delete(node)
  }

  function beginDragState(node: Node): void {
    if (activeDragNodes.has(node)) return

    activeDragNodes.add(node)
    activeDragNodeRefs.add(node)
    activeDragViolationReason.delete(node)

    const baselineState = lastValidState.get(node) ?? captureCurrentValidState(node)
    if (!baselineState) return

    lastValidState.set(node, { ...baselineState })
    activeDragState.set(node, { ...baselineState })
  }

  function endDragState(node: Node): void {
    activeDragNodes.delete(node)
    activeDragNodeRefs.delete(node)
    activeDragState.delete(node)
    activeDragViolationReason.delete(node)
    lockedSelectionDragNodes.delete(node)
    lockedSelectionDragNodeRefs.delete(node)
  }

  function onBatchStop({ name }: { name?: string }): void {
    if (name !== 'move-selection') return

    for (const node of Array.from(activeDragNodeRefs)) {
      endDragState(node)
    }
  }

  function onPointerRelease(): void {
    for (const node of Array.from(activeDragNodeRefs)) {
      endDragState(node)
    }
  }

  function notifyViolation(result: PoolContainmentResult, node: Node): void {
    const key = result.reason as string
    if (activeDragNodes.has(node)) {
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
    const nextContainer = result.container ?? null
    if (nextContainer && (currentAncestor?.id !== nextContainer.id || !hasEmbeddedChild(nextContainer, node))) {
      if (currentAncestor?.id !== nextContainer.id) {
        currentAncestor?.unembed?.(node)
      }
      nextContainer.embed(node)
    }

    rememberValidState(node, nextContainer)
    clearViolation(node)
    return true
  }

  function restoreLastValidState(node: Node): void {
    const lastState = activeDragState.get(node) ?? lastValidState.get(node)
    if (!lastState) return

    restoringNodes.add(node)

    try {
      restoreNodeSize(node, { width: lastState.width, height: lastState.height })
      restoreNodePosition(node, { x: lastState.x, y: lastState.y })

      const currentAncestor = getSwimlaneAncestor(node)
      const expectedContainer = lastState.container ?? findContainingSwimlane(graph, node, node.id)
      if (!expectedContainer) return
      if (currentAncestor?.id === expectedContainer.id && hasEmbeddedChild(expectedContainer, node)) return

      if (currentAncestor?.id !== expectedContainer.id) {
        currentAncestor?.unembed?.(node)
      }
      expectedContainer.embed(node)
    } finally {
      restoringNodes.delete(node)
    }
  }

  function onNodeAdded({ node }: { node: Node }) {
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (syncContainment(node)) return
    if (removeInvalidOnAdd) {
      node.remove()
    }
  }

  function onNodeMoving({ node }: { node: Node }) {
    if (restoringNodes.has(node)) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    beginDragState(node)
    if (syncContainment(node)) return
    if (!constrainToContainer) return

    restoreLastValidState(node)
  }

  function onNodeMoved({ node }: { node: Node }) {
    if (restoringNodes.has(node)) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
      endDragState(node)
      return
    }

    try {
      if (syncContainment(node)) return
      if (!constrainToContainer) return

      restoreLastValidState(node)
    } finally {
      endDragState(node)
    }
  }

  function onNodeChanged({ node, options }: { node: Node; options?: { ui?: boolean; silent?: boolean; selection?: string } }) {
    if (restoringNodes.has(node)) return
    if (options?.ui || options?.silent) return
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return

    const isSelectionDrag = Boolean(options?.selection)
    if (isSelectionDrag) {
      beginDragState(node)
    }

    if (isSelectionDrag && lockedSelectionDragNodes.has(node)) {
      restoreLastValidState(node)
      return
    }

    if (syncContainment(node)) return
    if (!constrainToContainer) return

    if (isSelectionDrag) {
      lockedSelectionDragNodes.add(node)
      lockedSelectionDragNodeRefs.add(node)
    }

    restoreLastValidState(node)
  }

  try {
    for (const node of graph.getNodes()) {
      rememberValidState(node)
    }
  } catch {
    // graph.getNodes() 防御性兜底。
  }

  graph.on('node:added', onNodeAdded)
  graph.on('node:moving', onNodeMoving)
  graph.on('node:moved', onNodeMoved)
  graph.on('node:change:position', onNodeChanged)
  graph.on('node:change:size', onNodeChanged)
  graph.on('node:change:parent', onNodeChanged)
  graph.model?.on?.('batch:stop', onBatchStop)
  ownerDocument?.addEventListener?.('mouseup', onPointerRelease, true)
  ownerDocument?.addEventListener?.('touchend', onPointerRelease, true)

  return () => {
    graph.off('node:added', onNodeAdded)
    graph.off('node:moving', onNodeMoving)
    graph.off('node:moved', onNodeMoved)
    graph.off('node:change:position', onNodeChanged)
    graph.off('node:change:size', onNodeChanged)
    graph.off('node:change:parent', onNodeChanged)
    graph.model?.off?.('batch:stop', onBatchStop)
    ownerDocument?.removeEventListener?.('mouseup', onPointerRelease, true)
    ownerDocument?.removeEventListener?.('touchend', onPointerRelease, true)
  }
}