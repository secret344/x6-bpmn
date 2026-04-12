/**
 * 泳道布局核心工具
 *
 * 提供 Pool / Lane 统一容器模型所需的几何计算、约束推导和布局工具。
 *
 * 设计原则（参照 pool.md）：
 * - Pool 和 Lane 统一为"容器节点 + 同层 lane 集合 + 内部内容"模型
 * - 三类约束严格分离：Pool 外边界、Lane 分隔线、Lane 自身内容下限
 * - 尺寸变化默认只在当前层级收敛（相对 bpmn-js 的有意简化）
 *
 * Swimlane layout core utilities
 *
 * Provides geometry calculations, constraint derivation, and layout tools
 * for the unified Pool/Lane container model.
 */

import type { Node } from '@antv/x6'
import type { Graph } from '@antv/x6'
import type { Rect } from './geometry'
import { isLaneShape, isPoolShape, isSwimlaneShape, isBoundaryShape } from '../export/bpmn-mapping'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'

// ============================================================================
// 重新导出几何类型，供外部模块使用
// ============================================================================
export type { Rect } from './geometry'

// ============================================================================
// 常量（参照 bpmn-js ResizeBehavior / LaneUtil）
// ============================================================================

/** Lane 头部缩进宽度（嵌套 Lane 时子 Lane 相对父 Lane 的偏移） */
export const LANE_INDENTATION = 30

/** 水平 Lane 最小尺寸 */
export const LANE_MIN_DIMENSIONS = { width: 300, height: 60 } as const

/** 垂直 Lane 最小尺寸 */
export const VERTICAL_LANE_MIN_DIMENSIONS = { width: 60, height: 300 } as const

/** 水平 Pool（Participant）最小尺寸 */
export const PARTICIPANT_MIN_DIMENSIONS = { width: 300, height: 150 } as const

/** 垂直 Pool（Participant）最小尺寸 */
export const VERTICAL_PARTICIPANT_MIN_DIMENSIONS = { width: 150, height: 300 } as const

/** 水平 Lane 内部内容留白（left 包含头部宽度 + 间距） */
export const LANE_PADDING = { top: 20, left: 50, right: 20, bottom: 20 } as const

/** 垂直 Lane 内部内容留白 */
export const VERTICAL_LANE_PADDING = { top: 50, left: 20, right: 20, bottom: 20 } as const

/** 新增 Lane 的默认高度 / 宽度 */
export const DEFAULT_LANE_SIZE = 120

/** 几何邻接判定阈值：相邻边（如 lane.bottom 与 otherLane.top） */
export const ADJACENT_EDGE_TOLERANCE = 10

/** 几何邻接判定阈值：同侧边（如两个 lane 的 top 齐平） */
export const SAME_EDGE_TOLERANCE = 5

// ============================================================================
// 节点几何工具
// ============================================================================

/**
 * 从 X6 Node 提取矩形几何。
 */
export function nodeRect(node: Pick<Node, 'getPosition' | 'getSize'>): Rect {
  const pos = node.getPosition()
  const size = node.getSize()
  return { x: pos.x, y: pos.y, width: size.width, height: size.height }
}

/**
 * 将矩形转为 TRBL（top/right/bottom/left）表示。
 */
export interface TRBL {
  top: number
  right: number
  bottom: number
  left: number
}

export function asTRBL(rect: Rect): TRBL {
  return {
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    left: rect.x,
  }
}

/**
 * 将 TRBL 转回矩形。
 */
export function trblToRect(trbl: TRBL): Rect {
  return {
    x: trbl.left,
    y: trbl.top,
    width: trbl.right - trbl.left,
    height: trbl.bottom - trbl.top,
  }
}

/**
 * 计算两个矩形的 TRBL 差值。
 */
export function subtractTRBL(a: TRBL, b: TRBL): TRBL {
  return {
    top: a.top - b.top,
    right: a.right - b.right,
    bottom: a.bottom - b.bottom,
    left: a.left - b.left,
  }
}

/**
 * 按 TRBL 增量调整矩形。
 */
export function resizeTRBL(rect: Rect, delta: TRBL): Rect {
  return {
    x: rect.x + delta.left,
    y: rect.y + delta.top,
    width: rect.width - delta.left + delta.right,
    height: rect.height - delta.top + delta.bottom,
  }
}

// ============================================================================
// 节点方向判定
// ============================================================================

/**
 * 判断泳道节点是否为水平布局。
 */
export function isSwimlaneHorizontal(node: Node): boolean {
  return resolveSwimlaneIsHorizontal(node.getData(), node.getSize())
}

// ============================================================================
// Lane 树遍历工具（参照 bpmn-js LaneUtil）
// ============================================================================

/**
 * 获取直接子 Lane 列表。
 */
export function getChildLanes(parent: Node): Node[] {
  const children = parent.getChildren()
  if (!children) return []
  return children.filter(
    (child): child is Node => child.isNode() && isLaneShape(child.shape),
  )
}

/**
 * 递归收集所有后代 Lane。
 */
export function collectLanes(shape: Node, collected?: Node[]): Node[] {
  const result = collected ?? []
  const children = getChildLanes(shape)

  for (const child of children) {
    collectLanes(child, result)
    result.push(child)
  }

  return result
}

/**
 * 获取泳道根节点（向上找到 Pool 或自身为 Pool 则返回自身）。
 */
export function getLanesRoot(shape: Node): Node {
  let current: Node = shape
  let parent = current.getParent()

  while (parent) {
    if (!parent.isNode()) break
    const parentNode = parent as Node
    if (isPoolShape(parentNode.shape) || isSwimlaneShape(parentNode.shape)) {
      current = parentNode
      parent = parentNode.getParent()
    } else {
      break
    }
  }

  return current
}

function getAncestorPool(shape: Node): Node | null {
  let current = shape.getParent()

  while (current) {
    if (!current.isNode()) return null
    const node = current as Node
    if (isPoolShape(node.shape)) {
      return node
    }
    current = node.getParent()
  }

  return null
}

function getLevelLanes(shape: Node): Node[] {
  const parent = shape.getParent()
  if (parent?.isNode()) {
    return getChildLanes(parent as Node)
  }

  return [shape]
}

export function computePoolContentRect(pool: Node): Rect | null {
  const children = safeGetChildren(pool)
  const contentNodes: Node[] = []
  collectContentRecursive(children, contentNodes)

  if (contentNodes.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxRight = -Infinity
  let maxBottom = -Infinity

  for (const node of contentNodes) {
    const pos = node.getPosition()
    const size = node.getSize()
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxRight = Math.max(maxRight, pos.x + size.width)
    maxBottom = Math.max(maxBottom, pos.y + size.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxRight - minX,
    height: maxBottom - minY,
  }
}

// ============================================================================
// 约束类型 1：当前容器自身内容下限
// ============================================================================

/**
 * 计算 Lane 基于其内部内容节点的最小尺寸。
 *
 * 只看当前 Lane 自己的直接非 Lane 子节点，不参考 Pool 或兄弟 Lane。
 * 这是三类约束中的"类型 3"。
 */
export function computeLaneContentMinSize(
  lane: Node,
  isHorizontal?: boolean,
): { minWidth: number; minHeight: number } {
  const horizontal = isHorizontal ?? safeDetectHorizontal(lane)
  const dims = horizontal ? LANE_MIN_DIMENSIONS : VERTICAL_LANE_MIN_DIMENSIONS
  const children = lane.getChildren()
  if (!children || children.length === 0) {
    return { minWidth: dims.width, minHeight: dims.height }
  }

  const contentNodes = collectCurrentContainerContentNodes(children)
  if (contentNodes.length === 0) {
    return { minWidth: dims.width, minHeight: dims.height }
  }

  const lanePos = lane.getPosition()

  let maxRight = lanePos.x + dims.width
  let maxBottom = lanePos.y + dims.height

  for (const childNode of contentNodes) {
    const cPos = childNode.getPosition()
    const cSize = childNode.getSize()
    maxRight = Math.max(maxRight, cPos.x + cSize.width)
    maxBottom = Math.max(maxBottom, cPos.y + cSize.height)
  }

  return {
    minWidth: Math.max(dims.width, maxRight - lanePos.x),
    minHeight: Math.max(dims.height, maxBottom - lanePos.y),
  }
}

/**
 * 计算 Lane 的最小尺寸（Type 3 约束）。
 *
 * 仅基于 Lane 自身直接非 Lane 子节点计算，不引用 Pool 或兄弟 Lane 内容。
 * 返回 { width, height }。
 */
export function computeLaneMinSize(lane: Node): { width: number; height: number } {
  const ownMin = computeLaneContentMinSize(lane, true)
  const pool = getAncestorPool(lane)
  const poolMinWidth = pool
    ? Math.max(LANE_MIN_DIMENSIONS.width, computePoolMinSize(pool).width - LANE_INDENTATION)
    : ownMin.minWidth

  return {
    width: poolMinWidth,
    height: Math.max(LANE_MIN_DIMENSIONS.height, ownMin.minHeight),
  }
}

/**
 * 计算 Lane 在 resize 交互中的纵向最小高度。
 *
 * 按 Pool/Lane 交互规则，Lane 分隔线纵向拖拽只受 Lane 基础最小高度约束，
 * 不让 Pool 内部任务节点参与 Lane 高度 resize 的联动钳制。
 */
export function computeLaneResizeMinHeight(lane: Node): number {
  return safeDetectHorizontal(lane)
    ? LANE_MIN_DIMENSIONS.height
    : VERTICAL_LANE_MIN_DIMENSIONS.height
}

// ============================================================================
// 约束类型 2：Pool 外边界约束
// ============================================================================

/**
 * 计算 Pool 基于其内部所有内容的最小尺寸。
 *
 * 遍历 Pool 内所有 Lane 和内容节点，确保 Pool 外轮廓不会缩到内容之内。
 * 这是三类约束中的"类型 1"。
 */
export function computePoolMinSize(
  pool: Node,
  isHorizontalParam?: boolean,
): { width: number; height: number } {
  void isHorizontalParam
  const poolPos = pool.getPosition()
  const children = safeGetChildren(pool)

  // 收集所有 Lane
  const lanes = children.filter(
    (c): c is Node => c.isNode?.() === true && isLaneShape((c as Node).shape),
  ) as Node[]

  // 递归收集所有内容节点
  const contentNodes: Node[] = []
  collectContentRecursive(children, contentNodes)

  let maxRight = poolPos.x + LANE_INDENTATION + LANE_MIN_DIMENSIONS.height
  let maxBottom = poolPos.y + Math.max(lanes.length, 1) * LANE_MIN_DIMENSIONS.height

  // 内容节点约束
  for (const node of contentNodes) {
    const cPos = node.getPosition()
    const cSize = node.getSize()
    maxRight = Math.max(maxRight, cPos.x + cSize.width)
    maxBottom = Math.max(maxBottom, cPos.y + cSize.height)
  }

  return {
    width: Math.max(LANE_INDENTATION + LANE_MIN_DIMENSIONS.height, maxRight - poolPos.x),
    height: Math.max(LANE_MIN_DIMENSIONS.height, maxBottom - poolPos.y),
  }
}

// ============================================================================
// 约束类型 3：Lane 分隔线约束（Resize 约束计算）
// ============================================================================

/** Resize 约束结果 */
export interface ResizeConstraints {
  /** 最小边界（不能再缩小） */
  min: Partial<TRBL>
  /** 最大边界（balanced 模式下不能再扩大，否则相邻 Lane 会低于最小尺寸） */
  max: Partial<TRBL>
}

export interface LaneResizeConstraintContext {
  laneTrbl: TRBL
  laneMin: { width: number; height: number }
  laneResizeMinHeight: number
  laneContent: Rect | null
  poolMin: { width: number; height: number } | null
  poolTrbl: TRBL | null
  poolContent: Rect | null
  siblingLanes: Node[]
  laneIndex: number
  previousLane: Node | null
  nextLane: Node | null
}

/** Resize 方向字面量 */
export type ResizeDirection = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * 计算泳道 resize 约束。
 *
 * 只处理当前层级的上下共享边界。
 *
 * - Lane 自身最小高度只看当前 Lane 内容
 * - Lane 宽度和 Pool 外边界只看 Pool 内部子节点
 * - 不再兼容横向堆叠 Lane 的左右相邻约束
 */
export function computeResizeConstraints(
  laneShape: Node,
  direction: ResizeDirection,
  balanced: boolean,
  currentRect: Rect = nodeRect(laneShape),
): ResizeConstraints {
  const context = buildLaneResizeConstraintContext(laneShape, currentRect)
  const minTrbl: Partial<TRBL> = {}
  const maxTrbl: Partial<TRBL> = {}

  if (direction.includes('n')) {
    applyLaneTopResizeConstraints(context, minTrbl, maxTrbl)
  }

  if (direction.includes('s')) {
    applyLaneBottomResizeConstraints(context, minTrbl, maxTrbl)
  }

  if (direction.includes('w')) {
    applyLaneLeftResizeConstraints(context, minTrbl)
  }

  if (direction.includes('e')) {
    applyLaneRightResizeConstraints(laneShape, context, minTrbl)
  }

  if (!balanced) {
    return { min: minTrbl, max: maxTrbl }
  }

  return { min: minTrbl, max: maxTrbl }
}

export function buildLaneResizeConstraintContext(
  laneShape: Node,
  currentRect: Rect = nodeRect(laneShape),
): LaneResizeConstraintContext {
  const laneTrbl = asTRBL(currentRect)
  const laneMin = computeLaneMinSize(laneShape)
  const laneResizeMinHeight = computeLaneResizeMinHeight(laneShape)
  const laneContent = computeRequiredSwimlaneRect(laneShape)
  const pool = getAncestorPool(laneShape)
  const poolMin = pool ? computePoolMinSize(pool) : null
  const poolTrbl = pool ? asTRBL(nodeRect(pool)) : null
  const poolContent = pool ? computePoolContentRect(pool) : null
  const siblingLanes = getOrderedLevelLanes(laneShape, currentRect)
  const laneIndex = siblingLanes.findIndex((lane) => lane.id === laneShape.id)

  return {
    laneTrbl,
    laneMin,
    laneResizeMinHeight,
    laneContent,
    poolMin,
    poolTrbl,
    poolContent,
    siblingLanes,
    laneIndex,
    previousLane: laneIndex > 0 ? siblingLanes[laneIndex - 1] : null,
    nextLane: laneIndex >= 0 && laneIndex < siblingLanes.length - 1 ? siblingLanes[laneIndex + 1] : null,
  }
}

export function getOrderedLevelLanes(shape: Node, currentRect?: Rect): Node[] {
  return getLevelLanes(shape)
    .slice()
    .sort((left, right) => {
      const leftY = left.id === shape.id && currentRect ? currentRect.y : left.getPosition().y
      const rightY = right.id === shape.id && currentRect ? currentRect.y : right.getPosition().y
      return leftY - rightY
    })
}

function applyLaneTopResizeConstraints(
  context: LaneResizeConstraintContext,
  minTrbl: Partial<TRBL>,
  maxTrbl: Partial<TRBL>,
): void {
  maxTrbl.top = context.laneTrbl.bottom - context.laneResizeMinHeight

  if (context.previousLane) {
    const previousTrbl = asTRBL(nodeRect(context.previousLane))
    minTrbl.top = previousTrbl.top + computeLaneResizeMinHeight(context.previousLane)
    return
  }

  if (
    context.poolTrbl
    && context.poolMin
    && Math.abs(context.laneTrbl.top - context.poolTrbl.top) <= SAME_EDGE_TOLERANCE
  ) {
    maxTrbl.top = Math.min(maxTrbl.top, context.poolTrbl.bottom - context.poolMin.height)
  }

  if (context.poolContent && context.laneIndex === 0) {
    maxTrbl.top = Math.min(maxTrbl.top, context.poolContent.y)
  }
}

function applyLaneBottomResizeConstraints(
  context: LaneResizeConstraintContext,
  minTrbl: Partial<TRBL>,
  maxTrbl: Partial<TRBL>,
): void {
  minTrbl.bottom = context.laneTrbl.top + context.laneResizeMinHeight

  if (context.nextLane) {
    const nextTrbl = asTRBL(nodeRect(context.nextLane))
    maxTrbl.bottom = nextTrbl.bottom - computeLaneResizeMinHeight(context.nextLane)
    return
  }

  if (
    context.poolTrbl
    && context.poolMin
    && Math.abs(context.laneTrbl.bottom - context.poolTrbl.bottom) <= SAME_EDGE_TOLERANCE
  ) {
    minTrbl.bottom = Math.max(minTrbl.bottom, context.poolTrbl.top + context.poolMin.height)
  }

  if (context.poolContent && context.laneIndex === context.siblingLanes.length - 1) {
    minTrbl.bottom = Math.max(minTrbl.bottom, context.poolContent.y + context.poolContent.height)
  }
}

function applyLaneLeftResizeConstraints(
  context: LaneResizeConstraintContext,
  minTrbl: Partial<TRBL>,
): void {
  if (context.poolContent) {
    minTrbl.left = context.poolContent.x
  }
}

function applyLaneRightResizeConstraints(
  laneShape: Node,
  context: LaneResizeConstraintContext,
  minTrbl: Partial<TRBL>,
): void {
  const pool = getAncestorPool(laneShape)
  if (context.poolMin && pool) {
    minTrbl.right = pool.getPosition().x + context.poolMin.width
  }
  if (context.poolContent) {
    minTrbl.right = Math.max(
      minTrbl.right ?? context.poolContent.x + context.poolContent.width,
      context.poolContent.x + context.poolContent.width,
    )
  }
}

// ============================================================================
// Balanced Resize 联动计算（参照 bpmn-js computeLanesResize）
// ============================================================================

/** Balanced resize 联动调整项 */
export interface LaneResizeAdjustment {
  node: Node
  newBounds: Rect
}

/**
 * 计算 balanced resize 时需要联动调整的相邻 Lane。
 *
 * 仅在当前层级内处理上下相邻 Lane，不再兼容横向堆叠的 Lane 集合。
 */
export function computeLanesResize(
  shape: Node,
  newBounds: Rect,
): LaneResizeAdjustment[] {
  const siblings = getLevelLanes(shape)
    .slice()
    .sort((left, right) => left.getPosition().y - right.getPosition().y)
  const currentIndex = siblings.findIndex((lane) => lane.id === shape.id)
  if (currentIndex < 0) {
    return []
  }

  const currentRect = nodeRect(shape)
  const currentTrbl = asTRBL(currentRect)
  const nextTrbl = asTRBL(newBounds)
  const result: LaneResizeAdjustment[] = []

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

// ============================================================================
// 内部工具
// ============================================================================

// ============================================================================
// 安全工具
// ============================================================================

/** 安全获取子节点列表（try-catch） */
function safeGetChildren(node: Node): any[] {
  try {
    return node.getChildren?.() ?? []
  } catch {
    return []
  }
}

/** 安全检测方向（try-catch 回退为水平） */
function safeDetectHorizontal(node: Node): boolean {
  try {
    const data = node.getData?.()
    const size = node.getSize()
    return resolveSwimlaneIsHorizontal(data, size)
  } catch {
    return true
  }
}

/** 递归收集非 Lane 内容节点 */
function collectContentRecursive(items: any[], result: Node[]): void {
  for (const item of items) {
    if (!item?.isNode?.()) continue
    const node = item as Node
    if (isSwimlaneShape(node.shape)) {
      // 递归进入 Lane 的子节点
      const children = safeGetChildren(node)
      collectContentRecursive(children, result)
    } else {
      result.push(node)
      const children = safeGetChildren(node)
      collectContentRecursive(children, result)
    }
  }
}

/** 收集当前容器直属内容节点及其嵌套后代 */
function collectCurrentContainerContentNodes(items: any[]): Node[] {
  const result: Node[] = []

  for (const item of items) {
    if (!item?.isNode?.()) continue
    collectEmbeddedContentRecursive(item as Node, result)
  }

  return result
}

/** 递归收集直属内容节点的非泳道后代 */
function collectEmbeddedContentRecursive(node: Node, result: Node[]): void {
  if (isSwimlaneShape(node.shape)) {
    return
  }

  result.push(node)

  const children = safeGetChildren(node)
  for (const child of children) {
    if (!child?.isNode?.()) continue
    collectEmbeddedContentRecursive(child as Node, result)
  }
}

// ============================================================================
// 首个 Pool 自动包裹
// ============================================================================

/** 自动包裹的四周 padding */
const AUTO_WRAP_PADDING = 16

/**
 * 收集可被首个 Pool 自动包裹的顶层节点。
 *
 * 规则：
 * - 如果图中存在多个 Pool，返回空——多 Pool 场景不自动包裹
 * - 只收集无父节点的非 Pool 节点
 */
export function collectFirstPoolWrapTargets(graph: Graph, pool: Node): Node[] {
  let allNodes: Node[]
  try {
    allNodes = graph.getNodes()
  } catch {
    return []
  }

  // 检查是否有其他 Pool
  const otherPool = allNodes.find(
    (n) => n !== pool && isPoolShape(n.shape),
  )
  if (otherPool) return []

  const targets: Node[] = []
  for (const node of allNodes) {
    if (node === pool) continue
    if (isPoolShape(node.shape)) continue

    // 检查是否为顶层节点（无父）
    let parent: any = null
    try {
      parent = node.getParent?.()
    } catch {
      // parent 读取失败视为顶层
    }
    if (!parent) {
      targets.push(node)
    }
  }

  return targets
}

/**
 * 计算自动包裹矩形（将目标节点集合包入 Pool）。
 *
 * 水平 Pool：左侧为 header（LANE_INDENTATION），四周留 AUTO_WRAP_PADDING
 * 垂直 Pool：顶部为 header（LANE_INDENTATION），四周留 AUTO_WRAP_PADDING
 *
 * @returns 包裹矩形，目标为空时返回 null
 */
export function computeAutoWrapPoolRect(
  pool: Node,
  targets: Node[],
): Rect | null {
  if (targets.length === 0) return null

  const isHorizontal = safeDetectHorizontal(pool)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of targets) {
    const pos = node.getPosition()
    const size = node.getSize()
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + size.width)
    maxY = Math.max(maxY, pos.y + size.height)
  }

  if (isHorizontal) {
    return {
      x: minX - AUTO_WRAP_PADDING - LANE_INDENTATION,
      y: minY - AUTO_WRAP_PADDING,
      width: maxX - minX + AUTO_WRAP_PADDING * 2 + LANE_INDENTATION,
      height: maxY - minY + AUTO_WRAP_PADDING * 2,
    }
  } else {
    return {
      x: minX - AUTO_WRAP_PADDING,
      y: minY - AUTO_WRAP_PADDING - LANE_INDENTATION,
      width: maxX - minX + AUTO_WRAP_PADDING * 2,
      height: maxY - minY + AUTO_WRAP_PADDING * 2 + LANE_INDENTATION,
    }
  }
}

/**
 * 自动将首个 Pool 扩展以包裹画布上的顶层节点。
 *
 * @returns 被包裹的顶层节点列表（无目标时为空数组）
 */
export function autoWrapFirstPool(graph: Graph, pool: Node): Node[] {
  const targets = collectFirstPoolWrapTargets(graph, pool)
  if (targets.length === 0) return []

  const rect = computeAutoWrapPoolRect(pool, targets)
  if (!rect) return []

  pool.setPosition(rect.x, rect.y, { bpmnLayout: true })
  if (pool.resize) {
    pool.resize(rect.width, rect.height, { bpmnLayout: true })
  } else {
    pool.setSize(rect.width, rect.height, { bpmnLayout: true })
  }

  return targets
}

// ============================================================================
// 泳道内容边界计算
// ============================================================================

/**
 * 计算泳道所需的最小内容边界。
 *
 * 基于 Header 侧偏移（水平 → left = LANE_INDENTATION，垂直 → top = LANE_INDENTATION）
 * 和子节点包围盒返回绝对坐标矩形。
 *
 * @returns 内容边界矩形，无子节点时返回 null
 */
export function computeRequiredSwimlaneRect(node: Node): Rect | null {
  let children: any[]
  try {
    children = node.getChildren?.() ?? []
  } catch {
    return null
  }

  const contentNodes = collectCurrentContainerContentNodes(children)

  if (contentNodes.length === 0) return null

  const isHorizontal = safeDetectHorizontal(node)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const child of contentNodes) {
    const pos = child.getPosition()
    const size = child.getSize()
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + size.width)
    maxY = Math.max(maxY, pos.y + size.height)
  }

  // Header 侧扩展
  if (isHorizontal) {
    minX -= LANE_INDENTATION
  } else {
    minY -= LANE_INDENTATION
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * 将泳道节点钳制到其最小内容边界。
 *
 * 如果泳道已包含所有内容则不做调整。
 *
 * @returns 是否做了调整
 */
export function clampSwimlaneToContent(node: Node): boolean {
  if (!isSwimlaneShape(node.shape)) return false

  const required = computeRequiredSwimlaneRect(node)
  if (!required) return false

  const pos = node.getPosition()
  const size = node.getSize()

  // 计算合并后的包围盒
  const newX = Math.min(pos.x, required.x)
  const newY = Math.min(pos.y, required.y)
  const newRight = Math.max(pos.x + size.width, required.x + required.width)
  const newBottom = Math.max(pos.y + size.height, required.y + required.height)
  const newWidth = newRight - newX
  const newHeight = newBottom - newY

  // 已包含所有内容，无需调整
  if (newX === pos.x && newY === pos.y && newWidth === size.width && newHeight === size.height) {
    return false
  }

  node.setPosition(newX, newY, { bpmnLayout: true })
  if (node.resize) {
    node.resize(newWidth, newHeight, { bpmnLayout: true })
  } else {
    node.setSize(newWidth, newHeight, { bpmnLayout: true })
  }

  return true
}

// ============================================================================
// 图层归一化
// ============================================================================

/** Pool zIndex 基础值 */
const Z_POOL = -2
/** Lane zIndex 基础值 */
const Z_LANE = -1
/** 普通节点 zIndex 基础值 */
const Z_NODE = 1
/** 边界事件 zIndex 基础值 */
const Z_BOUNDARY = 2

/**
 * 归一化泳道相关节点的 zIndex 分层。
 *
 * 保证 Pool < Lane < Task < BoundaryEvent 的稳定堆叠顺序。
 */
export function normalizeSwimlaneLayers(graph: Graph): void {
  let allNodes: Node[]
  try {
    allNodes = graph.getNodes()
  } catch {
    return
  }

  for (const node of allNodes) {
    let z: number
    if (isPoolShape(node.shape)) {
      z = Z_POOL
    } else if (isLaneShape(node.shape)) {
      z = Z_LANE
    } else if (isBoundaryShape(node.shape)) {
      z = Z_BOUNDARY
    } else {
      z = Z_NODE
    }

    if (typeof node.setZIndex === 'function') {
      node.setZIndex(z)
    } else {
      node.prop('zIndex', z, { silent: false })
    }
  }
}
