/**
 * Pool / Participant 容器约束行为
 *
 * 拖拽主链路优先复用 X6 原生能力：
 * 1. interacting：控制 Lane 不可直接拖拽；
 * 2. translating.restrict：在移动前裁剪 Pool / 选区位移；
 * 3. embedding：在候选父节点阶段约束 Lane / Flow Node / Boundary 的归属；
 * 4. node:moved 与 node:change:*：仅做 BPMN 归一化和非 UI 兜底恢复。
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { isBoundaryShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'
import {
  autoWrapFirstPool,
  clampSwimlaneToContent,
  nodeRect,
  normalizeSwimlaneLayers,
} from './swimlane-layout'
import { compactLaneLayout } from './lane-management'
import { isContainedFlowNode, setupSwimlanePolicy } from './swimlane-policy'
import { setupSwimlaneResize } from './swimlane-resize'
import {
  findContainingSwimlane,
  getAncestorPool,
  getAncestorSwimlane,
} from '../core/swimlane-membership'

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
  /** 越界或非法归属时是否恢复到最后一个合法状态，默认 true */
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
const SWIMLANE_HEADER_SIZE = 30

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

interface NodeChangeOptions {
  ui?: boolean
  silent?: boolean
  selection?: string
  translateBy?: string
  /** X6 Transform resize 方向标记 */
  direction?: string
  bpmnLayout?: boolean
}

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
  resetSelection?: (cells?: Cell | string | Array<Cell | string>, options?: { ui?: boolean }) => Graph
  getNodesUnderNode?: (node: Node, options?: { by?: string }) => Node[]
}

interface Point {
  x: number
  y: number
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

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rectRight(rect) &&
    point.y <= rectBottom(rect)
  )
}

function getNodeDepth(node: Node): number {
  let depth = 0
  let current = node.getParent?.() as Cell | null | undefined

  while (current) {
    depth += 1
    current = current.getParent?.() as Cell | null | undefined
  }

  return depth
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

function getGraphNodes(graph: Graph): Node[] {
  try {
    return graph.getNodes()
  } catch {
    return []
  }
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

function getGraphChildren(graph: Graph, parent: Node): Node[] {
  return getGraphNodes(graph)
    .filter((candidate) => candidate.id !== parent.id)
    .filter((candidate) => candidate.getParent?.()?.id === parent.id)
}

function hasPoolNodes(graph: Graph): boolean {
  return getGraphNodes(graph).some((node) => node.shape === BPMN_POOL)
}

function hasEmbeddedChild(parent: Node, child: Node): boolean {
  try {
    const children = parent.getChildren?.() as Cell[] | null | undefined
    return Array.isArray(children) && children.some((candidate) => candidate.id === child.id)
  } catch {
    return child.getParent?.()?.id === parent.id
  }
}

function detachNodeFromOtherSwimlanes(graph: Graph, node: Node, keepParentId?: string): void {
  for (const candidate of getGraphNodes(graph)) {
    if (!isSwimlaneShape(candidate.shape)) {
      continue
    }

    if (candidate.id === keepParentId) {
      continue
    }

    if (!hasEmbeddedChild(candidate, node)) {
      continue
    }

    candidate.unembed?.(node)
  }
}

function restoreNodePosition(node: Node, position: { x: number; y: number }): void {
  const current = node.getPosition()
  const deltaX = position.x - current.x
  const deltaY = position.y - current.y

  if (deltaX === 0 && deltaY === 0) return

  const translatableNode = node as TranslatableNode
  if (typeof translatableNode.translate === 'function') {
    translatableNode.translate(deltaX, deltaY, { bpmnLayout: true })
    return
  }

  node.setPosition(position.x, position.y, { bpmnLayout: true })
}

function restoreNodeSize(node: Node, size: { width: number; height: number }): void {
  const current = node.getSize()
  if (current.width === size.width && current.height === size.height) return

  const sizableNode = node as SizableNode
  if (typeof sizableNode.resize === 'function') {
    sizableNode.resize(size.width, size.height, { bpmnLayout: true })
    return
  }

  if (typeof sizableNode.setSize === 'function') {
    sizableNode.setSize(size.width, size.height, { bpmnLayout: true })
  }
}

function getGraphNodeById(graph: Graph, nodeId: string): Node | null {
  try {
    const cell = graph.getCellById?.(nodeId)
    if (cell?.isNode?.()) {
      return cell as Node
    }
  } catch {
    // getCellById 缺失时退回节点遍历。
  }

  return getGraphNodes(graph).find((candidate) => candidate.id === nodeId) ?? null
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

function resolveContainmentReason(shape: string, customReason?: string): string {
  if (customReason) return customReason
  return shape === BPMN_LANE ? LANE_REASON : DEFAULT_REASON
}

function isContainedNodeByDefault(shape: string): boolean {
  return !isBoundaryShape(shape)
}

function findCollidingPool(graph: Graph, node: Node, rect: Rect): Node | null {
  return (
    getGraphNodes(graph)
      .filter((candidate) => candidate.shape === BPMN_POOL)
      .filter((candidate) => candidate.id !== node.id)
      .find((candidate) => overlapsRect(nodeRect(candidate), rect)) ?? null
  )
}

function getOwningPool(graph: Graph, node: Node): Node | null {
  const ancestorPool = getAncestorPool(node)
  if (ancestorPool) {
    return ancestorPool
  }

  const container = findContainingSwimlane(graph, nodeRect(node), node.id)
  if (!container) {
    return null
  }

  return container.shape === BPMN_POOL ? container : getAncestorPool(container)
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
    if (findCollidingPool(graph, node, rect)) {
      return { valid: false, reason: POOL_REASON }
    }
    return { valid: true }
  }

  const ancestor = getAncestorSwimlane(node)
  const container = findContainingSwimlane(graph, rect, node.id)

  if (node.shape === BPMN_LANE) {
    const owningPool = getAncestorPool(node)
    const expectedPool = container?.shape === BPMN_POOL ? container : getAncestorPool(container)

    if (owningPool) {
      if (!containsRect(getSwimlaneContentRect(owningPool), rect)) {
        return { valid: false, reason }
      }

      return {
        valid: true,
          container: expectedPool?.id === owningPool.id ? (container as Node) : owningPool,
      }
    }

    if (!container || container.shape !== BPMN_POOL) {
      return { valid: false, reason }
    }

    return { valid: true, container }
  }

  const owningPool =
    getAncestorPool(node) ??
    (container?.shape === BPMN_POOL ? container : getAncestorPool(container))
  if (!owningPool) {
    return { valid: false, reason }
  }

  if (!containsRect(getSwimlaneContentRect(owningPool), rect)) {
    return { valid: false, reason }
  }

  if (ancestor && containsRect(nodeRect(ancestor), rect)) {
    return { valid: true, container: container as Node }
  }

  return { valid: true, container: container as Node }
}

function rememberValidState(
  graph: Graph,
  node: Node,
  targetStore: WeakMap<Node, NodeState>,
  container?: Node | null,
): void {
  const position = node.getPosition()
  const size = node.getSize()
  targetStore.set(node, {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    container: container ?? getAncestorSwimlane(node) ?? getOwningPool(graph, node),
  })
}

function restoreLastValidState(
  graph: Graph,
  node: Node,
  lastValidState: WeakMap<Node, NodeState>,
): void {
  const snapshot = lastValidState.get(node)
  if (!snapshot) return

  restoreNodeSize(node, { width: snapshot.width, height: snapshot.height })
  restoreNodePosition(node, { x: snapshot.x, y: snapshot.y })

  const currentContainer = getAncestorSwimlane(node)
  const expectedContainer = snapshot.container
  if (expectedContainer && currentContainer?.id !== expectedContainer.id) {
    currentContainer?.unembed?.(node)
    detachNodeFromOtherSwimlanes(graph, node, expectedContainer.id)
    expectedContainer.embed(node)
    normalizeSwimlaneLayers(graph)
  }
}

function normalizeSwimlaneGeometry(graph: Graph, node: Node): void {
  if (!isSwimlaneShape(node.shape)) return
  if (clampSwimlaneToContent(node)) {
    normalizeSwimlaneLayers(graph)
  }
}

function shouldSkipDescendantTranslation(graph: Graph, node: Node, options?: NodeChangeOptions): boolean {
  const translateBy = options?.translateBy
  if (!translateBy || translateBy === node.id) {
    return false
  }

  const source = getGraphNodeById(graph, translateBy)
  if (!source || !isSwimlaneShape(source.shape)) {
    return false
  }

  return isDescendantOfNode(node, source.id)
}

function collectSwimlaneDescendants(graph: Graph, node: Node): Node[] {
  const descendants: Node[] = []
  const queue = [...getGraphChildren(graph, node)]

  while (queue.length > 0) {
    const current = queue.shift() as Node
    descendants.push(current)
    queue.push(...getGraphChildren(graph, current))
  }

  return descendants
}

function findDescendantAtPoint(graph: Graph, node: Node, point: Point): Node | null {
  const candidates = collectSwimlaneDescendants(graph, node)
    .filter((candidate) => containsPoint(nodeRect(candidate), point))
    .sort((left, right) => {
      const depthDelta = getNodeDepth(right) - getNodeDepth(left)
      if (depthDelta !== 0) {
        return depthDelta
      }

      const leftRect = nodeRect(left)
      const rightRect = nodeRect(right)
      const leftArea = leftRect.width * leftRect.height
      const rightArea = rightRect.width * rightRect.height
      return leftArea - rightArea
    })

  return candidates[0] ?? null
}

function shouldRoutePoolOverlayClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target.closest('.x6-widget-transform')) {
    return false
  }

  return Boolean(
    target.closest('.x6-widget-selection-box') ||
      target.closest('.x6-widget-selection-inner') ||
      target.closest('.x6-widget-selection-content'),
  )
}

function repairMovedSwimlaneDescendants(
  graph: Graph,
  node: Node,
  lastValidState: WeakMap<Node, NodeState>,
  isContainedNode: (shape: string) => boolean,
  delta: { x: number; y: number },
): void {
  if (delta.x === 0 && delta.y === 0) {
    return
  }

  for (const descendant of collectSwimlaneDescendants(graph, node)) {
    const snapshot = lastValidState.get(descendant)
    if (!snapshot) {
      continue
    }

    if (!isContainedNode(descendant.shape)) {
      rememberValidState(graph, descendant, lastValidState)
      continue
    }

    const expectedPosition = {
      x: snapshot.x + delta.x,
      y: snapshot.y + delta.y,
    }
    const currentPosition = descendant.getPosition()

    if (currentPosition.x !== expectedPosition.x || currentPosition.y !== expectedPosition.y) {
      restoreNodePosition(descendant, expectedPosition)
    }

    rememberValidState(graph, descendant, lastValidState)
  }
}

function handleFirstPool(
  graph: Graph,
  node: Node,
  lastValidState: WeakMap<Node, NodeState>,
): void {
  const wrappedNodes = autoWrapFirstPool(graph, node)
  for (const wrappedNode of wrappedNodes) {
    const currentAncestor = getAncestorSwimlane(wrappedNode)
    currentAncestor?.unembed?.(wrappedNode)
    detachNodeFromOtherSwimlanes(graph, wrappedNode, node.id)
    node.embed(wrappedNode)
    rememberValidState(graph, wrappedNode, lastValidState, node)
  }

  normalizeSwimlaneGeometry(graph, node)
  normalizeSwimlaneLayers(graph)
  rememberValidState(graph, node, lastValidState)
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
  const lastViolationReason = new WeakMap<Node, string>()
  // 重入保护：防止 onNodeSizeChanged → finalizeNode('size') → compactLaneLayout →
  // 偫发 node:change:size → 再次进入 onNodeSizeChanged 的无限循环。
  let isFinalizingSize = false
  const disposeSwimlanePolicy = setupSwimlanePolicy(graph, { isContainedNode })

  function rememberPoolSubtreeState(pool: Node): void {
    rememberValidState(graph, pool, lastValidState)

    for (const descendant of collectSwimlaneDescendants(graph, pool)) {
      rememberValidState(graph, descendant, lastValidState)
    }
  }

  function compactPoolAfterLaneRemoval(pool: Node): void {
    compactLaneLayout(graph, pool)

    for (const child of getGraphChildren(graph, pool)) {
      if (isSwimlaneShape(child.shape)) {
        normalizeSwimlaneGeometry(graph, child)
      }
    }

    normalizeSwimlaneGeometry(graph, pool)
    normalizeSwimlaneLayers(graph)
    rememberPoolSubtreeState(pool)
  }

  const disposeSwimlaneResize = setupSwimlaneResize(graph, {
    onSwimlaneResized: (_node, pool) => {
      rememberPoolSubtreeState(pool)
    },
  })

  function clearViolation(node: Node): void {
    lastViolationReason.delete(node)
  }

  function notifyViolation(result: PoolContainmentResult, node: Node): void {
    const violationReason = result.reason as string
    if (lastViolationReason.get(node) === violationReason) {
      return
    }

    lastViolationReason.set(node, violationReason)
    onViolation?.(result, node)
  }

  function syncContainment(node: Node): boolean {
    const result = validatePoolContainment(graph, node, { reason, isContainedNode })
    if (!result.valid) {
      notifyViolation(result, node)
      return false
    }

    const currentContainer = getAncestorSwimlane(node)
    const nextContainer = result.container ?? null
    if (nextContainer && (currentContainer?.id !== nextContainer.id || !hasEmbeddedChild(nextContainer, node))) {
      currentContainer?.unembed?.(node)
      detachNodeFromOtherSwimlanes(graph, node, nextContainer.id)
      nextContainer.embed(node)
      normalizeSwimlaneLayers(graph)
    }

    rememberValidState(graph, node, lastValidState, nextContainer)
    clearViolation(node)
    return true
  }

  function finalizeNode(node: Node, changeType: 'move' | 'size' | 'parent', direction?: string): void {
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
      rememberValidState(graph, node, lastValidState)
      return
    }

    if (changeType === 'size') {
      if (node.shape === BPMN_POOL) {
        compactLaneLayout(graph, node, direction)
        // compactLaneLayout 使用 bpmnLayout: true 标记避免级联，但事件仍正常传播；
        // 需要主动对子 Lane 做 clamp：子 Lane 的内容（Task 等）可能超出缩小后的 Lane 边界。
        // 同时更新子 Lane 的 lastValidState，避免后续 Lane resize 校验失败时
        // 恢复到 compactLaneLayout 之前的过时尺寸。
        for (const child of getGraphChildren(graph, node)) {
          if (isSwimlaneShape(child.shape)) {
            normalizeSwimlaneGeometry(graph, child)
            rememberValidState(graph, child, lastValidState)
          }
        }
      }
      normalizeSwimlaneGeometry(graph, node)
    }

    if (syncContainment(node)) {
      if (isSwimlaneShape(node.shape)) {
        normalizeSwimlaneLayers(graph)
        // resize 收敛会以 bpmnLayout 标记更新兄弟泳道几何。
        // 这里同步刷新同一 Pool 下兄弟 Lane 的 lastValidState，
        // 避免后续校验回滚到收敛前的过时尺寸。
        if (changeType === 'size') {
          const ownerPool = getAncestorPool(node)
          /* istanbul ignore next -- 防御性守卫：syncContainment 成功后泳道一定已嵌入 Pool，getPoolAncestor 不可能为 null */
          if (ownerPool) {
            for (const sibling of getGraphChildren(graph, ownerPool)) {
              if (sibling.id !== node.id && isSwimlaneShape(sibling.shape)) {
                rememberValidState(graph, sibling, lastValidState)
              }
            }
          }
        }
      }
      return
    }

    if (!constrainToContainer) {
      return
    }

    restoreLastValidState(graph, node, lastValidState)
    if (changeType === 'size') {
      normalizeSwimlaneGeometry(graph, node)
    }
    if (isSwimlaneShape(node.shape)) {
      normalizeSwimlaneLayers(graph)
    }
  }

  function onNodeAdded({ node }: { node: Node }): void {
    if (node.shape === BPMN_POOL) {
      if (!syncContainment(node)) {
        if (removeInvalidOnAdd) {
          node.remove()
        }
        return
      }

      handleFirstPool(graph, node, lastValidState)
      return
    }

    if (isSwimlaneShape(node.shape)) {
      normalizeSwimlaneLayers(graph)
    }

    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
      rememberValidState(graph, node, lastValidState)
      return
    }

    if (syncContainment(node)) {
      return
    }

    if (removeInvalidOnAdd) {
      node.remove()
    }
  }

  function onNodeMoved({ node }: { node: Node; options?: NodeChangeOptions }): void {
    const previousState = lastValidState.get(node)
    finalizeNode(node, 'move')

    if (previousState && isSwimlaneShape(node.shape)) {
      const currentPosition = node.getPosition()
      repairMovedSwimlaneDescendants(graph, node, lastValidState, isContainedNode, {
        x: currentPosition.x - previousState.x,
        y: currentPosition.y - previousState.y,
      })
    }
  }

  function onNodePositionChanged({ node, options }: { node: Node; options?: NodeChangeOptions }): void {
    if (options?.silent || options?.bpmnLayout) return
    if (shouldSkipDescendantTranslation(graph, node, options)) return

    if (options?.ui) {
      return
    }

    finalizeNode(node, 'move')
  }

  // 选区拖拽结束时，Selection 插件不触发 node:moved，只触发 model batch:stop('move-selection')。
  // 此处对选区内的节点执行延迟的碰撞校验和约束恢复。
  function onBatchStop({ name }: { name: string }): void {
    if (name !== 'move-selection') return

    const selected = getSelectedNodes(graph)
    for (const node of selected) {
      const previousState = lastValidState.get(node)
      finalizeNode(node, 'move')

      if (previousState && isSwimlaneShape(node.shape)) {
        const currentPosition = node.getPosition()
        repairMovedSwimlaneDescendants(graph, node, lastValidState, isContainedNode, {
          x: currentPosition.x - previousState.x,
          y: currentPosition.y - previousState.y,
        })
      }
    }
  }

  function onNodeSizeChanged({ node, options }: { node: Node; options?: NodeChangeOptions }): void {
    if (options?.silent || options?.bpmnLayout) return
    /* istanbul ignore next -- 防御性重入保护：内部 resize 均为 bpmnLayout，正常不会重入 */
    if (isFinalizingSize) return

    isFinalizingSize = true
    try {
      finalizeNode(node, 'size', options?.direction)
    } finally {
      isFinalizingSize = false
    }
  }

  function onNodeParentChanged({ node, options }: { node: Node; options?: NodeChangeOptions }): void {
    if (options?.silent || options?.bpmnLayout) return
    finalizeNode(node, 'parent')
  }

  function onNodeRemoved({ node }: { node: Node }): void {
    if (node.shape !== BPMN_LANE) {
      return
    }

    const snapshot = lastValidState.get(node)
    const snapshotContainer = snapshot?.container
    const pool = snapshotContainer?.shape === BPMN_POOL
      ? snapshotContainer
      : snapshotContainer
        ? getAncestorPool(snapshotContainer)
        : null

    if (!pool) {
      return
    }

    compactPoolAfterLaneRemoval(pool)
  }

  function onContainerClick(event: MouseEvent): void {
    const graphWithOptions = graph as GraphWithOptions
    const selected = getSelectedNodes(graph)
    if (selected.length !== 1) {
      return
    }

    const selectedNode = selected[0]
    if (selectedNode.shape !== BPMN_POOL) {
      return
    }

    if (!shouldRoutePoolOverlayClick(event.target)) {
      return
    }

    const localPoint = graph.clientToLocal(event.clientX, event.clientY) as Point
    const targetNode = findDescendantAtPoint(graph, selectedNode, localPoint)
    if (!targetNode || targetNode.id === selectedNode.id) {
      return
    }

    graphWithOptions.resetSelection?.(targetNode, { ui: true })
  }

  for (const node of getGraphNodes(graph)) {
    const result = validatePoolContainment(graph, node, { reason, isContainedNode })
    if (result.valid) {
      rememberValidState(graph, node, lastValidState, result.container ?? null)
    }
  }
  normalizeSwimlaneLayers(graph)

  graph.on('node:added', onNodeAdded)
  graph.on('node:moved', onNodeMoved)
  graph.on('node:change:position', onNodePositionChanged)
  graph.on('node:change:size', onNodeSizeChanged)
  graph.on('node:change:parent', onNodeParentChanged)
  graph.on('node:removed', onNodeRemoved)
  graph.model?.on?.('batch:stop', onBatchStop)
  ;(graph as GraphWithOptions).container?.addEventListener('click', onContainerClick)

  return () => {
    graph.off('node:added', onNodeAdded)
    graph.off('node:moved', onNodeMoved)
    graph.off('node:change:position', onNodePositionChanged)
    graph.off('node:change:size', onNodeSizeChanged)
    graph.off('node:change:parent', onNodeParentChanged)
    graph.off('node:removed', onNodeRemoved)
    graph.model?.off?.('batch:stop', onBatchStop)
    ;(graph as GraphWithOptions).container?.removeEventListener('click', onContainerClick)
    disposeSwimlaneResize()
    disposeSwimlanePolicy()
  }
}
