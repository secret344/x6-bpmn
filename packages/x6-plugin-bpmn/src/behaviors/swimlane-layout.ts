/**
 * 泳池 / 泳道布局辅助
 *
 * 负责处理三类与展示相关的通用逻辑：
 * 1. 首个 Pool 创建时，根据现有节点包围盒自动扩展边界；
 * 2. Pool / Lane 根据内部内容计算最小允许尺寸；
 * 3. 统一归一化 Pool、Lane 与普通节点的层级顺序。
 */

import type { Graph, Node, Cell } from '@antv/x6'
import { isBoundaryShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

type PositionableNode = Pick<Node, 'getPosition' | 'getSize'>

type MovableNode = Node & {
  resize?: (width: number, height: number, options?: unknown) => void
  setSize?: (width: number, height: number, options?: unknown) => void
  setPosition?: (x: number, y: number, options?: unknown) => void
  setZIndex?: (zIndex: number, options?: unknown) => void
  prop?: (path: string, value: unknown, options?: unknown) => void
}

const SWIMLANE_HEADER_SIZE = 30
const SWIMLANE_AUTO_WRAP_PADDING = 16
const SWIMLANE_MIN_CONTENT_PADDING = 0
const SWIMLANE_LAYER_BANDS = {
  pool: -200,
  lane: -100,
  node: 100,
  boundary: 200,
} as const

export function nodeRect(node: PositionableNode): Rect {
  const position = node.getPosition()
  const size = node.getSize()

  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  }
}

function rectRight(rect: Rect): number {
  return rect.x + rect.width
}

function rectBottom(rect: Rect): number {
  return rect.y + rect.height
}

function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null

  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rectRight(rect)))
  const bottom = Math.max(...rects.map((rect) => rectBottom(rect)))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function getTopLevelParent(node: Node): Cell | null | undefined {
  try {
    return node.getParent?.() as Cell | null | undefined
  } catch {
    return null
  }
}

function getNodeChildren(node: Node): Node[] {
  try {
    const children = node.getChildren?.() as Cell[] | null | undefined
    if (!Array.isArray(children)) return []

    return children.filter((child) => child.isNode?.()) as Node[]
  } catch {
    return []
  }
}

function getSwimlanePriority(node: Node): number {
  if (node.shape === BPMN_POOL) return 0
  if (node.shape === BPMN_LANE) return 1
  if (isBoundaryShape(node.shape)) return 3
  return 2
}

function getLayerBand(priority: number): number {
  if (priority === 0) return SWIMLANE_LAYER_BANDS.pool
  if (priority === 1) return SWIMLANE_LAYER_BANDS.lane
  if (priority === 3) return SWIMLANE_LAYER_BANDS.boundary
  return SWIMLANE_LAYER_BANDS.node
}

function applyNodeZIndex(node: Node, zIndex: number): void {
  const movableNode = node as MovableNode

  if (typeof movableNode.setZIndex === 'function') {
    movableNode.setZIndex(zIndex, { silent: false })
    return
  }

  if (typeof movableNode.prop === 'function') {
    movableNode.prop('zIndex', zIndex, { silent: false })
  }
}

function isHorizontalSwimlane(node: Node): boolean {
  try {
    return resolveSwimlaneIsHorizontal(node.getData?.(), node.getSize())
  } catch {
    return true
  }
}

function isRectContained(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  )
}

function mergeRectContaining(current: Rect, required: Rect): Rect {
  const left = Math.min(current.x, required.x)
  const top = Math.min(current.y, required.y)
  const right = Math.max(rectRight(current), rectRight(required))
  const bottom = Math.max(rectBottom(current), rectBottom(required))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function setNodeRect(node: Node, rect: Rect, options?: { bpmnLayout?: boolean }): void {
  const movableNode = node as MovableNode
  const eventOptions = options?.bpmnLayout ? { bpmnLayout: true } : { silent: false }
  movableNode.setPosition?.(rect.x, rect.y, eventOptions)

  if (typeof movableNode.resize === 'function') {
    movableNode.resize(rect.width, rect.height, eventOptions)
    return
  }

  movableNode.setSize?.(rect.width, rect.height, eventOptions)
}

export function collectFirstPoolWrapTargets(graph: Graph, pool: Node): Node[] {
  try {
    const pools = graph.getNodes().filter((node) => node.shape === BPMN_POOL)
    if (pools.length !== 1 || pools[0].id !== pool.id) {
      return []
    }

    return graph.getNodes().filter((node) => {
      if (node.id === pool.id) return false
      return !getTopLevelParent(node)
    })
  } catch {
    return []
  }
}

export function computeAutoWrapPoolRect(pool: Node, nodes: Node[]): Rect | null {
  const contentRect = unionRects(nodes.map((node) => nodeRect(node)))
  if (!contentRect) return null

  if (isHorizontalSwimlane(pool)) {
    return {
      x: contentRect.x - SWIMLANE_HEADER_SIZE - SWIMLANE_AUTO_WRAP_PADDING,
      y: contentRect.y - SWIMLANE_AUTO_WRAP_PADDING,
      width: contentRect.width + SWIMLANE_HEADER_SIZE + SWIMLANE_AUTO_WRAP_PADDING * 2,
      height: contentRect.height + SWIMLANE_AUTO_WRAP_PADDING * 2,
    }
  }

  return {
    x: contentRect.x - SWIMLANE_AUTO_WRAP_PADDING,
    y: contentRect.y - SWIMLANE_HEADER_SIZE - SWIMLANE_AUTO_WRAP_PADDING,
    width: contentRect.width + SWIMLANE_AUTO_WRAP_PADDING * 2,
    height: contentRect.height + SWIMLANE_HEADER_SIZE + SWIMLANE_AUTO_WRAP_PADDING * 2,
  }
}

export function computeRequiredSwimlaneRect(node: Node): Rect | null {
  const childRects = getNodeChildren(node).map((child) => nodeRect(child))
  const contentRect = unionRects(childRects)
  if (!contentRect) return null

  if (isHorizontalSwimlane(node)) {
    return {
      x: contentRect.x - SWIMLANE_HEADER_SIZE - SWIMLANE_MIN_CONTENT_PADDING,
      y: contentRect.y - SWIMLANE_MIN_CONTENT_PADDING,
      width: contentRect.width + SWIMLANE_HEADER_SIZE + SWIMLANE_MIN_CONTENT_PADDING * 2,
      height: contentRect.height + SWIMLANE_MIN_CONTENT_PADDING * 2,
    }
  }

  return {
    x: contentRect.x - SWIMLANE_MIN_CONTENT_PADDING,
    y: contentRect.y - SWIMLANE_HEADER_SIZE - SWIMLANE_MIN_CONTENT_PADDING,
    width: contentRect.width + SWIMLANE_MIN_CONTENT_PADDING * 2,
    height: contentRect.height + SWIMLANE_HEADER_SIZE + SWIMLANE_MIN_CONTENT_PADDING * 2,
  }
}

/**
 * 计算 Pool 在当前子内容约束下允许的最小尺寸。
 *
 * 规则：
 * - 宽度 = HEADER_SIZE + max(每个子节点右边界 - Pool.x - HEADER_SIZE, 0)
 * - 高度 = max(子 Lane 数量 × MIN_LANE_SIZE, 每个子节点下边界 - Pool.y)
 * - MIN_LANE_SIZE 来自 lane-management，此处保持数值一致（60）。
 */
export function computePoolMinSize(
  pool: Node,
): { width: number; height: number } {
  const MIN_LANE_SIZE = 60
  const pos = pool.getPosition()
  const hz = isHorizontalSwimlane(pool)
  const children = getNodeChildren(pool)

  // 收集所有 Lane 和非 Lane 子节点
  const lanes = children.filter((child) => child.shape === BPMN_LANE)
  const allDescendants: Rect[] = []

  for (const child of children) {
    // 对 Lane：递归收集 Lane 内部子节点
    if (child.shape === BPMN_LANE) {
      for (const grandchild of getNodeChildren(child)) {
        allDescendants.push(nodeRect(grandchild))
      }
    } else {
      allDescendants.push(nodeRect(child))
    }
  }

  const contentRect = unionRects(allDescendants)

  if (hz) {
    // 水平布局：header 在左侧
    const laneMinHeight = Math.max(lanes.length, 1) * MIN_LANE_SIZE
    const contentRight = contentRect ? rectRight(contentRect) - pos.x : SWIMLANE_HEADER_SIZE
    const contentBottom = contentRect ? rectBottom(contentRect) - pos.y : MIN_LANE_SIZE
    return {
      width: Math.max(contentRight, SWIMLANE_HEADER_SIZE + MIN_LANE_SIZE),
      height: Math.max(contentBottom, laneMinHeight),
    }
  }

  // 垂直布局：header 在顶部
  const laneMinWidth = Math.max(lanes.length, 1) * MIN_LANE_SIZE
  const contentRight = contentRect ? rectRight(contentRect) - pos.x : MIN_LANE_SIZE
  const contentBottom = contentRect ? rectBottom(contentRect) - pos.y : SWIMLANE_HEADER_SIZE
  return {
    width: Math.max(contentRight, laneMinWidth),
    height: Math.max(contentBottom, SWIMLANE_HEADER_SIZE + MIN_LANE_SIZE),
  }
}

/**
 * 计算 Lane 允许的最小尺寸。
 *
 * Pool 边界方向（水平布局的宽度、垂直布局的高度）与 Pool 受到相同的内容约束；
 * 非 Pool 边界方向（内侧边）仅使用 MIN_LANE_SIZE，允许自由拖拽。
 */
export function computeLaneMinSize(
  lane: Node,
): { width: number; height: number } {
  const MIN_LANE_SIZE = 60
  const hz = isHorizontalSwimlane(lane)

  // 获取所属 Pool 的全局内容最小尺寸
  const parent = lane.getParent?.()
  const pool = parent?.isNode?.() && (parent as Node).shape === BPMN_POOL
    ? parent as Node
    : null

  if (!pool) {
    return { width: MIN_LANE_SIZE, height: MIN_LANE_SIZE }
  }

  const poolMin = computePoolMinSize(pool)

  if (hz) {
    // 水平布局：宽度与 Pool 边界一致（受 Pool 内容约束），高度仅 MIN_LANE_SIZE（内侧边自由）
    return {
      width: Math.max(poolMin.width - SWIMLANE_HEADER_SIZE, MIN_LANE_SIZE),
      height: MIN_LANE_SIZE,
    }
  }

  // 垂直布局：高度与 Pool 边界一致，宽度仅 MIN_LANE_SIZE
  return {
    width: MIN_LANE_SIZE,
    height: Math.max(poolMin.height - SWIMLANE_HEADER_SIZE, MIN_LANE_SIZE),
  }
}

export function clampSwimlaneToContent(node: Node): boolean {
  if (!isSwimlaneShape(node.shape)) return false

  const requiredRect = computeRequiredSwimlaneRect(node)
  if (!requiredRect) return false

  const currentRect = nodeRect(node)
  if (isRectContained(currentRect, requiredRect)) {
    return false
  }

  // 使用 bpmnLayout 标记避免触发 pool-containment 的级联事件处理
  setNodeRect(node, mergeRectContaining(currentRect, requiredRect), { bpmnLayout: true })
  return true
}

export function autoWrapFirstPool(graph: Graph, pool: Node): Node[] {
  const targets = collectFirstPoolWrapTargets(graph, pool)
  if (targets.length === 0) return []

  setNodeRect(pool, computeAutoWrapPoolRect(pool, targets) as Rect)

  return targets
}

export function normalizeSwimlaneLayers(graph: Graph): void {
  try {
    graph.getNodes()
      .slice()
      .sort((left, right) => getSwimlanePriority(left) - getSwimlanePriority(right))
      .forEach((node, index) => {
        const priority = getSwimlanePriority(node)
        applyNodeZIndex(node, getLayerBand(priority) + index)
      })
  } catch {
    // 图层归一化是展示增强，不应打断主链路。
  }
}
