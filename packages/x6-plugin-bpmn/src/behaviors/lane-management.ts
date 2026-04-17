/**
 * Lane 管理行为（高级 API）
 *
 * 在 Pool 中添加、插入、布局 Lane 的便捷接口。
 * 底层由 swimlane-layout 提供约束与几何计算，由 swimlane-add 提供节点创建逻辑。
 *
 * Lane management behavior (high-level API)
 *
 * Convenience functions for adding, inserting, and laying out Lanes in a Pool.
 */

import type { Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape } from '../export/bpmn-mapping'
import { BPMN_LANE } from '../utils/constants'
import { buildSwimlaneAttrs } from '../shapes/swimlane-presentation'
import {
  LANE_INDENTATION,
  LANE_MIN_DIMENSIONS,
  normalizeSwimlaneLayers,
} from './swimlane-layout'

// ============================================================================
// 常量
// ============================================================================

/** 新增 Lane 的默认高度/宽度 */
const DEFAULT_LANE_SIZE = 125

/** Lane 最小高度/宽度 */
const MIN_LANE_SIZE = LANE_MIN_DIMENSIONS.height // 60

// ============================================================================
// 类型定义
// ============================================================================

export interface AddLaneOptions {
  label?: string
  size?: number
}

function findAncestorPool(node: Node): Node | null {
  let current: any = node.getParent?.()
  while (current) {
    if (current.isNode?.() && isPoolShape(current.shape)) {
      return current as Node
    }
    current = current.getParent?.()
  }
  return null
}

function sanitizeSize(size: number | undefined): number {
  if (size === undefined || size === null) return DEFAULT_LANE_SIZE
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_LANE_SIZE
  return Math.max(size, MIN_LANE_SIZE)
}

/**
 * 通过遍历图中所有节点查找指定 Pool 的直接子 Lane。
 *
 * 使用 getParent() 检测父子关系，兼容 embed 和 setParent 两种方式。
 */
function findChildLanes(graph: Graph, pool: Node): Node[] {
  return graph.getNodes().filter(
    (n: Node) => isLaneShape(n.shape) && n.getParent?.() === pool,
  )
}

// ============================================================================
// addLaneToPool — 向 Pool 中添加 Lane
// ============================================================================

/**
 * 向 Pool 中添加新 Lane。
 *
 * - 空 Pool：创建一条占满整个内容区的 Lane
 * - 已有 Lane：在底部（水平）或右侧（垂直）追加
 * - 空间不足时自动扩展 Pool
 *
 * @returns 新创建的 Lane 节点，非 Pool 节点调用返回 null
 */
export function addLaneToPool(
  graph: Graph,
  pool: Node,
  options?: AddLaneOptions,
): Node | null {
  if (!isPoolShape(pool.shape)) return null

  const label = options?.label
  const laneSize = sanitizeSize(options?.size)

  const poolPos = pool.getPosition()
  const poolSize = pool.getSize()

  const existingLanes = findChildLanes(graph, pool)

  if (existingLanes.length === 0) {
    // 空 Pool：创建一条占满整个内容区的 Lane
    const lane = createLaneInPool(graph, pool, {
      x: poolPos.x + LANE_INDENTATION,
      y: poolPos.y,
      width: poolSize.width - LANE_INDENTATION,
      height: poolSize.height,
    }, true, label)

    compactLaneLayout(graph, pool)
    return lane
  }

  // 已有 Lane：只支持纵向堆叠，始终在底部追加
  let maxBottom = poolPos.y
  for (const lane of existingLanes) {
    const lanePos = lane.getPosition()
    const laneSize2 = lane.getSize()
    maxBottom = Math.max(maxBottom, lanePos.y + laneSize2.height)
  }

  const remaining = (poolPos.y + poolSize.height) - maxBottom
  if (remaining < laneSize) {
    const expansion = laneSize - remaining
    pool.resize?.(poolSize.width, poolSize.height + expansion, { bpmnLayout: true })
    pool.setSize(poolSize.width, poolSize.height + expansion)
  }

  const newLane = createLaneInPool(graph, pool, {
    x: poolPos.x + LANE_INDENTATION,
    y: maxBottom,
    width: pool.getSize().width - LANE_INDENTATION,
    height: laneSize,
  }, true, label)

  compactLaneLayout(graph, pool)
  return newLane
}

// ============================================================================
// addLaneAbove / addLaneBelow — 在指定 Lane 的上方/下方插入
// ============================================================================

/**
 * 在指定 Lane 的上方（水平）或左侧（垂直）插入新 Lane。
 *
 * - 参照 Lane 和其后续 Lane 会向下/右移动
 * - Pool 会相应扩展
 */
export function addLaneAbove(
  graph: Graph,
  referenceLane: Node,
  options?: AddLaneOptions,
): Node | null {
  const pool = findAncestorPool(referenceLane)
  if (!pool) return null

  const label = options?.label ?? 'Lane'
  const laneSize = sanitizeSize(options?.size)

  const refPos = referenceLane.getPosition()
  const refSize = referenceLane.getSize()
  const poolSize = pool.getSize()

  const siblings = findChildLanes(graph, pool)
  for (const sibling of siblings) {
    const sibPos = sibling.getPosition()
    if (sibPos.y >= refPos.y) {
      sibling.setPosition(sibPos.x, sibPos.y + laneSize, { bpmnLayout: true })
    }
  }

  pool.resize?.(poolSize.width, poolSize.height + laneSize, { bpmnLayout: true })
  pool.setSize(poolSize.width, poolSize.height + laneSize)

  const newLane = createLaneInPool(graph, pool, {
    x: pool.getPosition().x + LANE_INDENTATION,
    y: refPos.y,
    width: pool.getSize().width - LANE_INDENTATION,
    height: laneSize,
  }, true, label)

  compactLaneLayout(graph, pool)
  return newLane
}

/**
 * 在指定 Lane 的下方（水平）或右侧（垂直）插入新 Lane。
 *
 * - 后续 Lane 会向下/右移动
 * - Pool 可能扩展
 */
export function addLaneBelow(
  graph: Graph,
  referenceLane: Node,
  options?: AddLaneOptions,
): Node | null {
  const pool = findAncestorPool(referenceLane)
  if (!pool) return null

  const label = options?.label ?? 'Lane'
  const laneSize = sanitizeSize(options?.size)

  const refPos = referenceLane.getPosition()
  const refSize = referenceLane.getSize()
  const poolPos = pool.getPosition()
  const poolSize = pool.getSize()

  const insertY = refPos.y + refSize.height

  const siblings = findChildLanes(graph, pool)
  for (const sibling of siblings) {
    const sibPos = sibling.getPosition()
    if (sibPos.y >= insertY) {
      sibling.setPosition(sibPos.x, sibPos.y + laneSize, { bpmnLayout: true })
    }
  }

  const totalNeeded = insertY + laneSize
  const poolBottom = poolPos.y + poolSize.height
  if (totalNeeded > poolBottom) {
    const expansion = totalNeeded - poolBottom
    pool.resize?.(poolSize.width, poolSize.height + expansion, { bpmnLayout: true })
    pool.setSize(poolSize.width, poolSize.height + expansion)
  }

  const newLane = createLaneInPool(graph, pool, {
    x: pool.getPosition().x + LANE_INDENTATION,
    y: insertY,
    width: pool.getSize().width - LANE_INDENTATION,
    height: laneSize,
  }, true, label)

  compactLaneLayout(graph, pool)
  return newLane
}

// ============================================================================
// compactLaneLayout — 紧凑布局
// ============================================================================

/**
 * 紧凑 Lane 布局，确保 Lane 无间隙地填满 Pool 内容区。
 *
 * - Lane 按位置排序后紧密排列
 * - 最后一条 Lane 吸收剩余空间
 * - Lane 总尺寸超过 Pool 时扩展 Pool
 */
export function compactLaneLayout(
  graph: Graph,
  pool: Node,
  direction?: string,
): void {
  void direction
  let lanes: Node[]
  try {
    lanes = findChildLanes(graph, pool)
  } catch {
    return
  }

  if (lanes.length === 0) return

  const poolPos = pool.getPosition()
  const poolSize = pool.getSize()

  lanes.sort((a, b) => a.getPosition().y - b.getPosition().y)

  const contentX = poolPos.x + LANE_INDENTATION
  const contentWidth = poolSize.width - LANE_INDENTATION
  let cursor = poolPos.y

  for (const lane of lanes) {
    const laneSize = lane.getSize()
    lane.setPosition(contentX, cursor, { bpmnLayout: true })
    lane.resize?.(contentWidth, laneSize.height, { bpmnLayout: true })
    lane.setSize(contentWidth, laneSize.height)
    cursor += laneSize.height
  }

  const totalHeight = cursor - poolPos.y
  const poolBottom = poolPos.y + poolSize.height

  if (totalHeight > poolSize.height) {
    pool.resize?.(poolSize.width, totalHeight, { bpmnLayout: true })
    pool.setSize(poolSize.width, totalHeight)
  } else if (cursor < poolBottom) {
    const lastLane = lanes[lanes.length - 1]
    const lastLanePos = lastLane.getPosition()
    const lastLaneSize = lastLane.getSize()
    const remaining = poolBottom - lastLanePos.y - lastLaneSize.height
    lastLane.resize?.(contentWidth, lastLaneSize.height + remaining, { bpmnLayout: true })
    lastLane.setSize(contentWidth, lastLaneSize.height + remaining)
  }

  normalizePoolSubtreeLayers(graph, pool)
}

// ============================================================================
// 内部工具
// ============================================================================

function createLaneInPool(
  graph: Graph,
  pool: Node,
  bounds: { x: number; y: number; width: number; height: number },
  isHorizontal: boolean,
  label?: string,
): Node {
  const attrs = buildSwimlaneAttrs(BPMN_LANE, label ?? 'Lane', isHorizontal)

  const node = graph.addNode({
    shape: BPMN_LANE,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    attrs,
    zIndex: -1,
    parent: pool.id,
    data: {
      bpmn: {
        isHorizontal,
      },
    },
  })

  // 确保父子关系生效（X6 的 addNode 通过 parent 字段会自动 embed，
  // 但部分场景下手动 embed 更可靠）
  try {
    if (typeof pool.embed === 'function') {
      pool.embed(node)
    } else if (typeof (pool as Node & { addChild?: (child: Node) => void }).addChild === 'function') {
      ;(pool as Node & { addChild?: (child: Node) => void }).addChild(node)
    }
  } catch { /* 忽略重复 embed */ }

  return node
}

function normalizePoolSubtreeLayers(graph: Graph, pool: Node): void {
  try {
    normalizeSwimlaneLayers(graph)
  } catch {
    // 测试桩图节点可能未实现完整的图层 API，此时跳过 zIndex 归一化。
  }
  frontEmbeddedContent(pool)
}

function frontEmbeddedContent(container: Node): void {
  const children = container.getChildren?.() ?? []

  for (const child of children) {
    if (!child?.isNode?.()) {
      continue
    }

    const childNode = child as Node & { toFront?: () => void }
    if (!isPoolShape(childNode.shape) && !isLaneShape(childNode.shape)) {
      childNode.toFront?.()
    }

    frontEmbeddedContent(childNode)
  }
}
