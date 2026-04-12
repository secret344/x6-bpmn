/**
 * 泳道交互策略
 *
 * 控制 Pool / Lane 的交互行为：
 * - Lane 不允许拖拽移动（只允许 resize），参照 pool.md 明确约束
 * - Pool 不允许内嵌到其他节点
 * - 泳道节点的 translating.restrict 约束
 *
 * Swimlane interaction policy
 *
 * Controls Pool/Lane interaction:
 * - Lane is non-movable (resize only)
 * - Pool cannot embed into other nodes
 * - Translating restrictions for swimlane nodes
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape, isSwimlaneShape, isBoundaryShape } from '../export/bpmn-mapping'
import { LANE_INDENTATION, nodeRect } from './swimlane-layout'
import type { Rect } from './geometry'

// ============================================================================
// 节点分类
// ============================================================================

/**
 * 判断指定图形是否为可被 Pool/Lane 包含的流程节点。
 *
 * 排除泳道自身（Pool / Lane）和边界事件。
 */
export function isContainedFlowNode(shape: string): boolean {
  if (isSwimlaneShape(shape)) return false
  if (isBoundaryShape(shape)) return false
  return true
}

// ============================================================================
// Lane 移动禁止
// ============================================================================

type InteractingValue =
  | boolean
  | Record<string, unknown>
  | ((cellView: { cell?: { shape?: string } }) => boolean | Record<string, unknown>)
  | null
  | undefined

/**
 * 注入 Lane 不可移动策略到 graph.options.interacting。
 *
 * 替换 graph.options.interacting 为一个包装函数：
 * - 对 Lane 节点返回 { nodeMovable: false }（或合并到原始 InteractionMap）
 * - 对非 Lane 节点委托给原始 interacting 行为
 */
export function patchLaneInteracting(
  graph: Graph,
  original: InteractingValue,
): void {
  if (!graph.options) return

  graph.options.interacting = (cellView: { cell?: { shape?: string } }) => {
    // 安全回退：cellView 异常时返回原始行为
    const shape = cellView?.cell?.shape
    if (!shape) {
      return resolveOriginal(original, cellView)
    }

    // Lane 节点：禁止移动
    if (isLaneShape(shape)) {
      // 如果原始行为为 false，保持 false（完全禁止交互）
      const resolved = resolveOriginal(original, cellView)
      if (resolved === false) return false

      // 合并到原始 InteractionMap（保留其他交互属性）
      if (typeof resolved === 'object' && resolved !== null) {
        return { ...resolved, nodeMovable: false }
      }

      return { nodeMovable: false }
    }

    // 非 Lane 节点：委托给原始行为
    return resolveOriginal(original, cellView)
  }
}

/**
 * 恢复原始 interacting 配置。
 */
export function restoreLaneInteracting(
  graph: Graph,
  original: InteractingValue,
): void {
  if (!graph.options) return
  graph.options.interacting = original as Graph['options']['interacting']
}

// ============================================================================
// 完整泳道策略安装
// ============================================================================

/**
 * 安装完整泳道策略。
 *
 * 包含：
 * - Lane 不可移动
 * - translating.restrict 约束节点在容器内移动
 */
export function setupSwimlanePolicy(
  graph: Graph,
): () => void {
  const originalInteracting = graph.options?.interacting
  const originalTranslating = graph.options?.translating
  const originalRestrict =
    typeof originalTranslating === 'object' && originalTranslating
      ? originalTranslating.restrict
      : undefined

  // 注入 Lane 不可移动
  patchLaneInteracting(graph, originalInteracting as InteractingValue)

  // 注入 translating.restrict（限制节点在容器区域内移动）
  if (graph.options) {
    graph.options.translating = {
      ...((typeof originalTranslating === 'object' && originalTranslating) || {}),
      restrict(this: any, cellView: any) {
        const swimlaneRestrict = resolveSwimlaneRestrictArea(this as Graph, cellView)
        const inheritedRestrict = resolveOriginalRestrictArea(
          this as Graph,
          originalRestrict,
          cellView,
        )

        return intersectRestrictArea(swimlaneRestrict, inheritedRestrict)
          ?? swimlaneRestrict
          ?? inheritedRestrict
          ?? null
      },
    }
  }

  return () => {
    restoreLaneInteracting(graph, originalInteracting as InteractingValue)
    if (graph.options) {
      graph.options.translating = originalTranslating
    }
  }
}

// ============================================================================
// 辅助：解析原始 interacting 值
// ============================================================================

function resolveOriginal(
  original: InteractingValue,
  cellView: { cell?: { shape?: string } },
): boolean | Record<string, unknown> {
  if (original === null || original === undefined) {
    return true
  }
  if (typeof original === 'boolean') {
    return original
  }
  if (typeof original === 'function') {
    return original(cellView) as boolean | Record<string, unknown>
  }
  if (typeof original === 'object') {
    return { ...original }
  }
  return true
}

function resolveSwimlaneRestrictArea(
  graph: Graph,
  cellView: { cell?: unknown } | null | undefined,
): Rect | null {
  const cell = cellView?.cell
  if (cell && isNodeLike(cell)) {
    return resolveNodeRestrictArea(cell as Node)
  }

  return resolveSelectionRestrictArea(graph)
}

function resolveOriginalRestrictArea(
  graph: Graph,
  originalRestrict: unknown,
  cellView: { cell?: unknown } | null | undefined,
): Rect | null {
  if (!originalRestrict) {
    return null
  }

  const inherited =
    typeof originalRestrict === 'function'
      ? originalRestrict.call(graph, cellView)
      : originalRestrict

  if (!inherited || typeof inherited === 'boolean' || typeof inherited === 'number') {
    return null
  }

  return isRectLike(inherited) ? inherited : null
}

function resolveNodeRestrictArea(node: Node): Rect | null {
  if (isLaneShape(node.shape)) {
    return nodeRect(node)
  }

  if (isPoolShape(node.shape) || !isContainedFlowNode(node.shape)) {
    return null
  }

  const ancestorPool = findAncestorPool(node)
  if (ancestorPool) {
    return getContainmentRect(ancestorPool)
  }

  const swimlaneParent = findSwimlaneParent(node)
  return swimlaneParent ? getContainmentRect(swimlaneParent) : null
}

function resolveSelectionRestrictArea(graph: Graph): Rect | null {
  const selectedCells = (graph as Graph & { getSelectedCells?: () => Cell[] }).getSelectedCells?.() ?? []
  const selectedNodes = selectedCells.filter((cell): cell is Node => cell.isNode())

  if (selectedNodes.length === 0) {
    return null
  }

  if (selectedNodes.some((node) => isLaneShape(node.shape))) {
    return getNodesUnionRect(selectedNodes)
  }

  if (selectedNodes.some((node) => isPoolShape(node.shape))) {
    return null
  }

  if (!selectedNodes.every((node) => isContainedFlowNode(node.shape))) {
    return null
  }

  const firstPool = findAncestorPool(selectedNodes[0])
  if (firstPool) {
    for (const node of selectedNodes.slice(1)) {
      const currentPool = findAncestorPool(node)
      if (!currentPool || currentPool.id !== firstPool.id) {
        return null
      }
    }

    return getContainmentRect(firstPool)
  }

  const firstParent = findSwimlaneParent(selectedNodes[0])
  if (!firstParent) {
    return null
  }

  for (const node of selectedNodes.slice(1)) {
    const currentParent = findSwimlaneParent(node)
    if (!currentParent || currentParent.id !== firstParent.id) {
      return null
    }
  }

  return getContainmentRect(firstParent)
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

function getContainmentRect(container: Node): Rect {
  if (isPoolShape(container.shape)) {
    const rect = nodeRect(container)
    return {
      x: rect.x + LANE_INDENTATION,
      y: rect.y,
      width: Math.max(0, rect.width - LANE_INDENTATION),
      height: rect.height,
    }
  }

  return nodeRect(container)
}

function getNodesUnionRect(nodes: Node[]): Rect | null {
  if (nodes.length === 0) {
    return null
  }

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const node of nodes) {
    const rect = nodeRect(node)
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

function intersectRestrictArea(left: Rect | null, right: Rect | null): Rect | null {
  if (!left || !right) {
    return null
  }

  const nextLeft = Math.max(left.x, right.x)
  const nextTop = Math.max(left.y, right.y)
  const nextRight = Math.min(left.x + left.width, right.x + right.width)
  const nextBottom = Math.min(left.y + left.height, right.y + right.height)

  return {
    x: nextLeft,
    y: nextTop,
    width: Math.max(0, nextRight - nextLeft),
    height: Math.max(0, nextBottom - nextTop),
  }
}

function isNodeLike(value: unknown): value is Node {
  return Boolean(
    value
      && typeof value === 'object'
      && typeof (value as Node).getPosition === 'function'
      && typeof (value as Node).getSize === 'function',
  )
}

function isRectLike(value: unknown): value is Rect {
  return Boolean(
    value
      && typeof value === 'object'
      && typeof (value as Rect).x === 'number'
      && typeof (value as Rect).y === 'number'
      && typeof (value as Rect).width === 'number'
      && typeof (value as Rect).height === 'number',
  )
}

export const __test__ = {
  resolveSwimlaneRestrictArea,
  resolveOriginalRestrictArea,
  resolveNodeRestrictArea,
  resolveSelectionRestrictArea,
  findAncestorPool,
  findSwimlaneParent,
  getContainmentRect,
  getNodesUnionRect,
  intersectRestrictArea,
}
