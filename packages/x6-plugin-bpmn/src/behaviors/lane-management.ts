/**
 * 泳道管理行为
 *
 * 参照 bpmn.js 的 Pool / Lane 交互模式：
 * 1. Lane 不允许拖拽（仅可调整大小）；
 * 2. Lane 之间始终无空隙——调整尺寸时相邻 Lane 自动伸缩；
 * 3. 通过 addLaneToPool / addLaneAbove / addLaneBelow 编程添加 Lane。
 */

import type { Graph, Node, Cell } from '@antv/x6'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'
import { BPMN_LANE, BPMN_POOL } from '../utils/constants'
import { normalizeSwimlaneLayers } from './swimlane-layout'

// ============================================================================
// 常量
// ============================================================================

const HEADER_SIZE = 30
const DEFAULT_LANE_SIZE = 125
const MIN_LANE_SIZE = 60

// ============================================================================
// 工具函数
// ============================================================================

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function nodeRect(node: Pick<Node, 'getPosition' | 'getSize'>): Rect {
  const p = node.getPosition()
  const s = node.getSize()
  return { x: p.x, y: p.y, width: s.width, height: s.height }
}

function getChildLanes(graph: Graph, pool: Node): Node[] {
  try {
    return graph
      .getNodes()
      .filter((n) => n.shape === BPMN_LANE && n.getParent?.()?.id === pool.id)
  } catch {
    return []
  }
}

function isHorizontal(node: Node): boolean {
  try {
    return resolveSwimlaneIsHorizontal(node.getData?.(), node.getSize())
  } catch {
    return true
  }
}

/**
 * 按照主轴方向排序 Lane 列表（水平布局按 Y 排序，垂直布局按 X 排序）。
 */
function sortLanesByAxis(lanes: Node[], horizontal: boolean): Node[] {
  return lanes.slice().sort((a, b) => {
    const posA = a.getPosition()
    const posB = b.getPosition()
    return horizontal ? posA.y - posB.y : posA.x - posB.x
  })
}

// ============================================================================
// 无间隙布局 — 保证 Lane 紧密排列且完全覆盖 Pool 内容区
// ============================================================================

/**
 * 获取 Pool 内容区域（去掉 Header 的部分）。
 */
function poolContentRect(pool: Node): Rect {
  const r = nodeRect(pool)
  const hz = isHorizontal(pool)
  if (hz) {
    return {
      x: r.x + HEADER_SIZE,
      y: r.y,
      width: r.width - HEADER_SIZE,
      height: r.height,
    }
  }
  return {
    x: r.x,
    y: r.y + HEADER_SIZE,
    width: r.width,
    height: r.height - HEADER_SIZE,
  }
}

/**
 * 重新排列指定 Pool 的所有 Lane，使其紧密排列且完全覆盖内容区域。
 *
 * 在水平布局下，Lane 按 Y 坐标排列，宽度与 Pool 内容区宽度相同。
 * 最后一个 Lane 的高度自动伸展以填满剩余空间。
 */
export function compactLaneLayout(graph: Graph, pool: Node): void {
  const lanes = getChildLanes(graph, pool)
  if (lanes.length === 0) return

  const hz = isHorizontal(pool)
  const content = poolContentRect(pool)
  const sorted = sortLanesByAxis(lanes, hz)

  if (hz) {
    // 水平布局：Lane 纵向堆叠
    let currentY = content.y
    for (let i = 0; i < sorted.length; i++) {
      const lane = sorted[i]
      const size = lane.getSize()
      const laneHeight = i === sorted.length - 1
        ? content.y + content.height - currentY
        : Math.max(size.height, MIN_LANE_SIZE)

      lane.setPosition(content.x, currentY, { silent: false })
      lane.resize(content.width, laneHeight, { silent: false })
      currentY += laneHeight
    }

    // 如果 Lane 总高度超出 Pool，扩展 Pool
    if (currentY > content.y + content.height) {
      const poolRect = nodeRect(pool)
      pool.resize(poolRect.width, currentY - poolRect.y, { silent: false })
    }
  } else {
    // 垂直布局：Lane 横向堆叠
    let currentX = content.x
    for (let i = 0; i < sorted.length; i++) {
      const lane = sorted[i]
      const size = lane.getSize()
      const laneWidth = i === sorted.length - 1
        ? content.x + content.width - currentX
        : Math.max(size.width, MIN_LANE_SIZE)

      lane.setPosition(currentX, content.y, { silent: false })
      lane.resize(laneWidth, content.height, { silent: false })
      currentX += laneWidth
    }

    if (currentX > content.x + content.width) {
      const poolRect = nodeRect(pool)
      pool.resize(currentX - poolRect.x, poolRect.height, { silent: false })
    }
  }
}

// ============================================================================
// 添加 Lane 到 Pool
// ============================================================================

export interface AddLaneOptions {
  /** Lane 标签文本 */
  label?: string
  /** Lane 在主轴方向的尺寸（水平布局为高度，垂直布局为宽度），默认 125 */
  size?: number
}

/**
 * 向 Pool 底部（水平）或右侧（垂直）追加一条 Lane。
 *
 * 如果 Pool 没有已有 Lane，则创建的 Lane 覆盖整个内容区。
 * 如果已有 Lane，则缩减最后一个 Lane 的尺寸（若空间足够）或扩展 Pool。
 */
export function addLaneToPool(
  graph: Graph,
  pool: Node,
  options: AddLaneOptions = {},
): Node | null {
  if (pool.shape !== BPMN_POOL) return null

  const hz = isHorizontal(pool)
  const content = poolContentRect(pool)
  const lanes = sortLanesByAxis(getChildLanes(graph, pool), hz)
  const laneSize = options.size ?? DEFAULT_LANE_SIZE
  const label = options.label ?? 'Lane'

  let x: number, y: number, w: number, h: number

  if (lanes.length === 0) {
    // 没有已有 Lane，新 Lane 覆盖整个内容区
    x = content.x
    y = content.y
    w = content.width
    h = content.height
  } else if (hz) {
    const lastLane = lanes[lanes.length - 1]
    const lastRect = nodeRect(lastLane)
    const lastBottom = lastRect.y + lastRect.height
    const availableSpace = content.y + content.height - lastBottom

    if (availableSpace >= laneSize) {
      // 内容区有足够空间
      x = content.x
      y = lastBottom
      w = content.width
      h = laneSize
    } else {
      // 需要扩展 Pool
      const poolRect = nodeRect(pool)
      const expandBy = laneSize - availableSpace
      pool.resize(poolRect.width, poolRect.height + expandBy, { silent: false })
      x = content.x
      y = lastBottom
      w = content.width
      h = laneSize
    }
  } else {
    const lastLane = lanes[lanes.length - 1]
    const lastRect = nodeRect(lastLane)
    const lastRight = lastRect.x + lastRect.width
    const availableSpace = content.x + content.width - lastRight

    if (availableSpace >= laneSize) {
      x = lastRight
      y = content.y
      w = laneSize
      h = content.height
    } else {
      const poolRect = nodeRect(pool)
      const expandBy = laneSize - availableSpace
      pool.resize(poolRect.width + expandBy, poolRect.height, { silent: false })
      x = lastRight
      y = content.y
      w = laneSize
      h = content.height
    }
  }

  const lane = graph.addNode({
    shape: BPMN_LANE,
    x,
    y,
    width: w,
    height: h,
    attrs: { headerLabel: { text: label } },
    data: { label, bpmn: { isHorizontal: hz } },
  })

  pool.embed(lane)
  normalizeSwimlaneLayers(graph)

  return lane
}

/**
 * 在指定 Lane 的上方（水平）或左侧（垂直）添加新 Lane。
 */
export function addLaneAbove(
  graph: Graph,
  referenceLane: Node,
  options: AddLaneOptions = {},
): Node | null {
  const pool = getParentPool(referenceLane)
  if (!pool) return null

  const hz = isHorizontal(pool)
  const laneSize = options.size ?? DEFAULT_LANE_SIZE
  const label = options.label ?? 'Lane'
  const refRect = nodeRect(referenceLane)

  // 将参照 Lane 向后移动，为新 Lane 腾出空间
  if (hz) {
    referenceLane.setPosition(refRect.x, refRect.y + laneSize, { silent: false })
  } else {
    referenceLane.setPosition(refRect.x + laneSize, refRect.y, { silent: false })
  }

  const lane = graph.addNode({
    shape: BPMN_LANE,
    x: refRect.x,
    y: refRect.y,
    width: hz ? refRect.width : laneSize,
    height: hz ? laneSize : refRect.height,
    attrs: { headerLabel: { text: label } },
    data: { label, bpmn: { isHorizontal: hz } },
  })

  pool.embed(lane)
  // 扩展 Pool 和重排所有 Lane
  expandPoolForLane(pool, laneSize, hz)
  compactLaneLayout(graph, pool)
  normalizeSwimlaneLayers(graph)

  return lane
}

/**
 * 在指定 Lane 的下方（水平）或右侧（垂直）添加新 Lane。
 */
export function addLaneBelow(
  graph: Graph,
  referenceLane: Node,
  options: AddLaneOptions = {},
): Node | null {
  const pool = getParentPool(referenceLane)
  if (!pool) return null

  const hz = isHorizontal(pool)
  const laneSize = options.size ?? DEFAULT_LANE_SIZE
  const label = options.label ?? 'Lane'
  const refRect = nodeRect(referenceLane)

  const x = hz ? refRect.x : refRect.x + refRect.width
  const y = hz ? refRect.y + refRect.height : refRect.y

  const lane = graph.addNode({
    shape: BPMN_LANE,
    x,
    y,
    width: hz ? refRect.width : laneSize,
    height: hz ? laneSize : refRect.height,
    attrs: { headerLabel: { text: label } },
    data: { label, bpmn: { isHorizontal: hz } },
  })

  pool.embed(lane)
  expandPoolForLane(pool, laneSize, hz)
  compactLaneLayout(graph, pool)
  normalizeSwimlaneLayers(graph)

  return lane
}

function getParentPool(lane: Node): Node | null {
  let current = lane.getParent?.() as Cell | null | undefined
  while (current) {
    if (current.isNode?.() && current.shape === BPMN_POOL) {
      return current as Node
    }
    current = current.getParent?.() as Cell | null | undefined
  }
  return null
}

function expandPoolForLane(pool: Node, extraSize: number, horizontal: boolean): void {
  const r = nodeRect(pool)
  if (horizontal) {
    pool.resize(r.width, r.height + extraSize, { silent: false })
  } else {
    pool.resize(r.width + extraSize, r.height, { silent: false })
  }
}

// ============================================================================
// Lane 调整大小时同步相邻 Lane — 保持无间隙
// ============================================================================

export interface LaneManagementOptions {
  /** Lane 调整大小后的回调 */
  onLaneResize?: (lane: Node, pool: Node) => void
}

/**
 * 安装 Lane 管理行为。
 *
 * - 监听 Lane 的 size 变化，自动同步相邻 Lane 以保持无间隙；
 * - 返回 dispose 函数用于清理。
 */
export function setupLaneManagement(
  graph: Graph,
  options: LaneManagementOptions = {},
): () => void {
  const adjustingLanes = new WeakSet<Node>()

  function onLaneSizeChanged({ node, options: changeOpts }: { node: Node; options?: Record<string, unknown> }) {
    if (node.shape !== BPMN_LANE) return
    if (adjustingLanes.has(node)) return
    if (changeOpts?.silent) return

    const pool = getParentPool(node)
    if (!pool) return

    adjustingLanes.add(node)
    try {
      adjustAdjacentLanes(graph, pool, node)
      options.onLaneResize?.(node, pool)
    } finally {
      adjustingLanes.delete(node)
    }
  }

  graph.on('node:change:size', onLaneSizeChanged)

  return () => {
    graph.off('node:change:size', onLaneSizeChanged)
  }
}

/**
 * 调整相邻 Lane 的尺寸，使所有 Lane 紧密排列无空隙。
 *
 * 当用户调整某个 Lane 的大小时，该 Lane 的下方/右侧 Lane 自动调整以补偿差值。
 */
function adjustAdjacentLanes(graph: Graph, pool: Node, changedLane: Node): void {
  const hz = isHorizontal(pool)
  const lanes = sortLanesByAxis(getChildLanes(graph, pool), hz)
  if (lanes.length <= 1) return

  const content = poolContentRect(pool)

  if (hz) {
    let currentY = content.y
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      const size = lane.getSize()

      lane.setPosition(content.x, currentY, { silent: false })

      if (i === lanes.length - 1) {
        // 最后一个 Lane 填充剩余空间
        const remainingHeight = content.y + content.height - currentY
        if (remainingHeight > 0 && remainingHeight !== size.height) {
          lane.resize(content.width, Math.max(remainingHeight, MIN_LANE_SIZE), { silent: false })
        }
      } else {
        lane.resize(content.width, Math.max(size.height, MIN_LANE_SIZE), { silent: false })
      }

      currentY += lane.getSize().height
    }

    // 若总高度超出 Pool，扩展 Pool
    if (currentY > content.y + content.height) {
      const poolRect = nodeRect(pool)
      pool.resize(poolRect.width, currentY - poolRect.y, { silent: false })
    }
  } else {
    let currentX = content.x
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      const size = lane.getSize()

      lane.setPosition(currentX, content.y, { silent: false })

      if (i === lanes.length - 1) {
        const remainingWidth = content.x + content.width - currentX
        if (remainingWidth > 0 && remainingWidth !== size.width) {
          lane.resize(Math.max(remainingWidth, MIN_LANE_SIZE), content.height, { silent: false })
        }
      } else {
        lane.resize(Math.max(size.width, MIN_LANE_SIZE), content.height, { silent: false })
      }

      currentX += lane.getSize().width
    }

    if (currentX > content.x + content.width) {
      const poolRect = nodeRect(pool)
      pool.resize(currentX - poolRect.x, poolRect.height, { silent: false })
    }
  }
}
