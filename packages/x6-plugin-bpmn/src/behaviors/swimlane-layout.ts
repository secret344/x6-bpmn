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

function setNodeRect(node: Node, rect: Rect): void {
  const movableNode = node as MovableNode
  movableNode.setPosition?.(rect.x, rect.y, { silent: false })

  if (typeof movableNode.resize === 'function') {
    movableNode.resize(rect.width, rect.height, { silent: false })
    return
  }

  movableNode.setSize?.(rect.width, rect.height, { silent: false })
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

export function clampSwimlaneToContent(node: Node): boolean {
  if (!isSwimlaneShape(node.shape)) return false

  const requiredRect = computeRequiredSwimlaneRect(node)
  if (!requiredRect) return false

  const currentRect = nodeRect(node)
  if (isRectContained(currentRect, requiredRect)) {
    return false
  }

  setNodeRect(node, mergeRectContaining(currentRect, requiredRect))
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
