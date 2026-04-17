/**
 * Pool 容器约束行为
 *
 * 只保留 pool.md 约定的两类职责：
 * - Lane 不可移动，只允许通过 size 变化参与布局收敛
 * - Pool / Lane / 普通流程节点的几何必须留在各自容器范围内
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { findContainingSwimlane } from '../core/swimlane-membership'
import {
  isBoundaryShape,
  isLaneShape,
  isPoolShape,
  isSwimlaneShape,
} from '../export/bpmn-mapping'
import { compactLaneLayout } from './lane-management'
import {
  LANE_INDENTATION,
  autoWrapFirstPool,
  asTRBL,
  computePoolMinSize,
  nodeRect,
} from './swimlane-layout'
import { setupSwimlanePolicy } from './swimlane-policy'
import type { Rect } from './geometry'

export interface PoolContainmentOptions {
  /** 是否在节点移动时自动限制到容器内（默认 true） */
  clampOnMove?: boolean
  /** 是否在节点 resize 时自动限制到容器内（默认 true） */
  clampOnResize?: boolean
  /** 是否在违规时直接修正到容器内（默认 true） */
  constrainToContainer?: boolean
  /** 发生违规时的回调 */
  onViolation?: (node: Node, reason: string) => void
}

export interface ContainmentValidationResult {
  valid: boolean
  reason?: string
}

/**
 * 静态校验节点是否处于合法的 Pool / Lane 容器中。
 */
export function validatePoolContainment(
  graph: Graph,
  node: Node,
): ContainmentValidationResult {
  if (isPoolShape(node.shape)) {
    return validatePoolBounds(graph, node)
  }

  if (isLaneShape(node.shape)) {
    return validateLaneBounds(node)
  }

  if (isSwimlaneShape(node.shape)) {
    return { valid: true }
  }

  const swimlaneParent = findSwimlaneParent(node)
  if (!swimlaneParent) {
    if (!hasPoolNodes(graph)) {
      return { valid: true }
    }
    return { valid: false, reason: '流程节点未处于 Pool 或 Lane 容器内' }
  }

  const containerRect = getContainmentRect(swimlaneParent)
  if (!rectContains(containerRect, nodeRect(node))) {
    const containerType = isPoolShape(swimlaneParent.shape) ? 'Pool' : 'Lane'
    return {
      valid: false,
      reason: `节点超出${containerType}容器边界`,
    }
  }

  return { valid: true }
}

/**
 * 安装 Pool 容器约束行为。
 *
 * 只处理三类事件：
 * - Lane 不可移动
 * - Pool / Lane size 变化后的布局收敛
 * - 普通节点越界后的直接 clamp
 */
export function setupPoolContainment(
  graph: Graph,
  options?: PoolContainmentOptions,
): () => void {
  const {
    clampOnMove = true,
    clampOnResize = true,
    constrainToContainer = true,
    onViolation,
  } = options ?? {}
  const disposers: Array<() => void> = []
  const isFinalizingPools = new Set<string>()

  disposers.push(setupSwimlanePolicy(graph))

  if (clampOnMove) {
    const movedHandler = ({
      node,
      options: eventOptions,
    }: {
      node: Node
      options?: { bpmnContainmentSync?: boolean; silent?: boolean }
    }) => {
      if (eventOptions?.bpmnContainmentSync || eventOptions?.silent) {
        return
      }

      if (isSwimlaneShape(node.shape)) {
        return
      }

      if (constrainToContainer) {
        clampFlowNodePosition(node)
      }
      syncFlowNodeSwimlaneParent(graph, node)
      reportContainmentViolation(graph, node, onViolation)
    }

    graph.on('node:change:position', movedHandler)
    graph.on('node:moved', movedHandler)
    disposers.push(() => graph.off('node:change:position', movedHandler))
    disposers.push(() => graph.off('node:moved', movedHandler))
  }

  if (clampOnResize) {
    const resizedHandler = ({
      node,
      options: eventOptions,
    }: {
      node: Node
      options?: { bpmnContainmentSync?: boolean; silent?: boolean }
    }) => {
      if (eventOptions?.silent || eventOptions?.bpmnContainmentSync) {
        return
      }

      if (isSwimlaneShape(node.shape)) {
        return
      }

      if (constrainToContainer) {
        clampFlowNodeBounds(node)
      }
      syncFlowNodeSwimlaneParent(graph, node)
      reportContainmentViolation(graph, node, onViolation)
    }

    graph.on('node:change:size', resizedHandler)
    graph.on('node:resized', resizedHandler)
    disposers.push(() => graph.off('node:change:size', resizedHandler))
    disposers.push(() => graph.off('node:resized', resizedHandler))
  }

  const addedHandler = ({ node }: { node: Node }) => {
    if (isPoolShape(node.shape)) {
      const wrapped = autoWrapFirstPool(graph, node)
      for (const child of wrapped) {
        try {
          node.embed?.(child)
        } catch {
          // 忽略重复 embed 的瞬时中间态
        }
      }
      reconcilePoolGeometry(graph, node, isFinalizingPools)
      return
    }

    if (isLaneShape(node.shape)) {
      const pool = findAncestorPool(node)
      if (pool) {
        reconcilePoolGeometry(graph, pool, isFinalizingPools)
      }
      return
    }

    if (constrainToContainer) {
      clampFlowNodePosition(node)
      clampFlowNodeBounds(node)
    }
    syncFlowNodeSwimlaneParent(graph, node)
    reportContainmentViolation(graph, node, onViolation)
  }

  const removedHandler = ({ node }: { node: Node }) => {
    if (!isLaneShape(node.shape)) {
      return
    }

    const parent = node.getParent()
    if (parent?.isNode?.() && isPoolShape((parent as Node).shape)) {
      ensurePoolMinSize(parent as Node)
    }
  }

  graph.on('node:added', addedHandler)
  graph.on('node:removed', removedHandler)
  disposers.push(() => graph.off('node:added', addedHandler))
  disposers.push(() => graph.off('node:removed', removedHandler))

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}

function validatePoolBounds(graph: Graph, pool: Node): ContainmentValidationResult {
  const poolRect = nodeRect(pool)
  const overlappingPool = safeGetNodes(graph).find(
    (candidate) =>
      candidate.id !== pool.id &&
      isPoolShape(candidate.shape) &&
      rectsOverlap(poolRect, nodeRect(candidate)),
  )

  if (overlappingPool) {
    return { valid: false, reason: '当前实现中，Pool 之间不支持重叠或嵌套' }
  }

  return { valid: true }
}

function validateLaneBounds(lane: Node): ContainmentValidationResult {
  const parent = lane.getParent()
  if (!parent?.isNode?.()) {
    return { valid: false, reason: 'Lane 必须直接属于 Pool' }
  }

  const parentNode = parent as Node
  if (!isPoolShape(parentNode.shape)) {
    return { valid: false, reason: 'Lane 必须直接属于 Pool' }
  }

  if (!rectContains(getPoolContentRect(parentNode), nodeRect(lane))) {
    return { valid: false, reason: 'Lane 超出 Pool 内容区边界' }
  }

  return { valid: true }
}

function hasPoolNodes(graph: Graph): boolean {
  return safeGetNodes(graph).some((node) => isPoolShape(node.shape))
}

function findSwimlaneParent(node: Node): Node | null {
  let current: Cell | null = node.getParent()

  while (current) {
    if (current.isNode() && isSwimlaneShape((current as Node).shape)) {
      return current as Node
    }
    current = current.getParent()
  }

  return null
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

function getContainmentRect(container: Node): Rect {
  if (isPoolShape(container.shape)) {
    return getPoolContentRect(container)
  }
  return nodeRect(container)
}

function getPoolContentRect(pool: Node): Rect {
  const rect = nodeRect(pool)
  return {
    x: rect.x + LANE_INDENTATION,
    y: rect.y,
    width: Math.max(0, rect.width - LANE_INDENTATION),
    height: rect.height,
  }
}

function reconcilePoolGeometry(
  graph: Graph,
  pool: Node,
  isFinalizingPools: Set<string>,
): void {
  if (isFinalizingPools.has(pool.id)) {
    return
  }

  isFinalizingPools.add(pool.id)
  try {
    ensurePoolMinSize(pool)

    compactLaneLayout(graph, pool)
  } finally {
    isFinalizingPools.delete(pool.id)
  }
}

function ensurePoolMinSize(pool: Node): void {
  const size = pool.getSize()
  const minSize = computePoolMinSize(pool)
  const nextWidth = Math.max(size.width, minSize.width)
  const nextHeight = Math.max(size.height, minSize.height)

  if (nextWidth === size.width && nextHeight === size.height) {
    return
  }

  if (typeof pool.resize === 'function') {
    pool.resize(nextWidth, nextHeight, { bpmnLayout: true })
  }
  pool.setSize(nextWidth, nextHeight, { bpmnLayout: true })
}

function reportContainmentViolation(
  graph: Graph,
  node: Node,
  onViolation?: (node: Node, reason: string) => void,
): void {
  if (isSwimlaneShape(node.shape)) {
    return
  }

  const result = validatePoolContainment(graph, node)
  if (!result.valid) {
    onViolation?.(node, result.reason ?? '节点超出泳道容器边界')
  }
}

function clampFlowNodePosition(node: Node): void {
  const containerRect = resolveFlowNodeClampRect(node)
  if (!containerRect) {
    return
  }

  const clamped = clampNodeToContainer(node, containerRect)
  if (clamped) {
    node.setPosition(clamped.x, clamped.y, { silent: true, bpmnContainmentSync: true })
  }
}

function clampFlowNodeBounds(node: Node): void {
  const containerRect = resolveFlowNodeClampRect(node)
  if (!containerRect) {
    return
  }

  const clamped = clampNodeBoundsToContainer(node, containerRect)
  if (clamped) {
    node.setPosition(clamped.x, clamped.y, { silent: true, bpmnContainmentSync: true })
    node.setSize(clamped.width, clamped.height, { silent: true, bpmnContainmentSync: true })
  }
}

function resolveFlowNodeClampRect(node: Node): Rect | null {
  const container = findSwimlaneParent(node)
  if (!container) {
    return null
  }

  const containerRect = getContainmentRect(container)
  if (!isLaneShape(container.shape) || rectContains(containerRect, nodeRect(node))) {
    return containerRect
  }

  const ancestorPool = findAncestorPool(node)
  if (!ancestorPool) {
    return containerRect
  }

  return getContainmentRect(ancestorPool)
}

function syncFlowNodeSwimlaneParent(graph: Graph, node: Node): void {
  if (isSwimlaneShape(node.shape) || hasAttachedBoundaryHost(node)) {
    return
  }

  if (shouldSkipFlowNodeParentSyncDuringLaneInteraction(graph, node)) {
    return
  }

  const targetParent = findContainingSwimlane(graph, node, node.id)
  if (!targetParent) {
    return
  }

  const currentParent = findSwimlaneParent(node)
  if (currentParent?.id === targetParent.id) {
    return
  }

  reparentFlowNode(node, targetParent)
}

function hasAttachedBoundaryHost(node: Node): boolean {
  if (!isBoundaryShape(node.shape)) {
    return false
  }

  const parent = node.getParent()
  if (parent?.isNode?.() && !isSwimlaneShape((parent as Node).shape)) {
    return true
  }

  const attachedToRef = node.getData<{ bpmn?: { attachedToRef?: string } }>()?.bpmn?.attachedToRef
  return Boolean(attachedToRef)
}

function shouldSkipFlowNodeParentSyncDuringLaneInteraction(graph: Graph, node: Node): boolean {
  const selectedCells = (graph as Graph & {
    getSelectedCells?: () => Cell[]
  }).getSelectedCells?.() ?? []

  for (const selectedCell of selectedCells) {
    if (!selectedCell.isNode()) {
      continue
    }

    const selectedNode = selectedCell as Node
    if (!isLaneShape(selectedNode.shape)) {
      continue
    }

    if (isNodeDescendantOf(node, selectedNode)) {
      return true
    }
  }

  return false
}

function isNodeDescendantOf(node: Node, ancestor: Node): boolean {
  let current: Cell | null = node.getParent()

  while (current) {
    if (current.id === ancestor.id) {
      return true
    }
    current = current.getParent()
  }

  return false
}

function reparentFlowNode(node: Node, parent: Node): void {
  try {
    const currentParent = node.getParent()
    if (currentParent?.isNode?.() && currentParent.id !== parent.id) {
      const currentParentNode = currentParent as Node & {
        unembed?: (child: Node) => void
      }
      currentParentNode.unembed?.(node)
    }

    if (typeof parent.embed === 'function') {
      parent.embed(node)
      return
    }

    const parentWithAddChild = parent as Node & {
      addChild?: (child: Node) => void
    }
    if (typeof parentWithAddChild.addChild === 'function') {
      parentWithAddChild.addChild(node)
    }
  } catch {
    // 忽略拖拽中间态的重复挂载异常
  }
}

/**
 * 检查外部矩形是否完全包含内部矩形。
 */
function rectContains(outer: Rect, inner: Rect): boolean {
  const outerTrbl = asTRBL(outer)
  const innerTrbl = asTRBL(inner)
  return (
    innerTrbl.left >= outerTrbl.left &&
    innerTrbl.top >= outerTrbl.top &&
    innerTrbl.right <= outerTrbl.right &&
    innerTrbl.bottom <= outerTrbl.bottom
  )
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  const leftTrbl = asTRBL(left)
  const rightTrbl = asTRBL(right)
  return !(
    leftTrbl.right <= rightTrbl.left ||
    rightTrbl.right <= leftTrbl.left ||
    leftTrbl.bottom <= rightTrbl.top ||
    rightTrbl.bottom <= leftTrbl.top
  )
}

/**
 * 将节点位置限制在容器内。
 */
function clampNodeToContainer(
  node: Node,
  containerRect: Rect,
): { x: number; y: number } | null {
  const nodeBounds = nodeRect(node)
  const container = asTRBL(containerRect)

  const maxX = Math.max(container.left, container.right - nodeBounds.width)
  const maxY = Math.max(container.top, container.bottom - nodeBounds.height)
  const nextX = Math.min(Math.max(nodeBounds.x, container.left), maxX)
  const nextY = Math.min(Math.max(nodeBounds.y, container.top), maxY)

  if (nextX === nodeBounds.x && nextY === nodeBounds.y) {
    return null
  }

  return { x: nextX, y: nextY }
}

/**
 * 将节点位置与尺寸限制在容器内。
 */
function clampNodeBoundsToContainer(
  node: Node,
  containerRect: Rect,
): Rect | null {
  const nodeBounds = nodeRect(node)
  const container = asTRBL(containerRect)

  const nextWidth = Math.min(nodeBounds.width, containerRect.width)
  const nextHeight = Math.min(nodeBounds.height, containerRect.height)
  const maxX = Math.max(container.left, container.right - nextWidth)
  const maxY = Math.max(container.top, container.bottom - nextHeight)
  const nextX = Math.min(Math.max(nodeBounds.x, container.left), maxX)
  const nextY = Math.min(Math.max(nodeBounds.y, container.top), maxY)

  if (
    nextX === nodeBounds.x &&
    nextY === nodeBounds.y &&
    nextWidth === nodeBounds.width &&
    nextHeight === nodeBounds.height
  ) {
    return null
  }

  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight,
  }
}

function safeGetNodes(graph: Graph): Node[] {
  try {
    return graph.getNodes()
  } catch {
    return []
  }
}

export const __test__ = {
  validatePoolBounds,
  validateLaneBounds,
  hasPoolNodes,
  findSwimlaneParent,
  findAncestorPool,
  getContainmentRect,
  getPoolContentRect,
  reconcilePoolGeometry,
  ensurePoolMinSize,
  reportContainmentViolation,
  clampFlowNodePosition,
  clampFlowNodeBounds,
  resolveFlowNodeClampRect,
  syncFlowNodeSwimlaneParent,
  hasAttachedBoundaryHost,
  shouldSkipFlowNodeParentSyncDuringLaneInteraction,
  isNodeDescendantOf,
  reparentFlowNode,
  rectContains,
  rectsOverlap,
  clampNodeToContainer,
  clampNodeBoundsToContainer,
  safeGetNodes,
}
