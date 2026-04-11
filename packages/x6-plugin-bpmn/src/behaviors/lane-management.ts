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

/**
 * 校验 Lane 尺寸：非正数 / NaN / Infinity 回退默认值，最终 clamp 到 MIN_LANE_SIZE。
 */
function validateLaneSize(size?: number): number {
  const raw = size ?? DEFAULT_LANE_SIZE
  const safe = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LANE_SIZE
  return Math.max(safe, MIN_LANE_SIZE)
}

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

function rectRight(rect: Rect): number {
  return rect.x + rect.width
}

function rectBottom(rect: Rect): number {
  return rect.y + rect.height
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
      width: Math.max(0, r.width - HEADER_SIZE),
      height: Math.max(0, r.height),
    }
  }
  return {
    x: r.x,
    y: r.y + HEADER_SIZE,
    width: Math.max(0, r.width),
    height: Math.max(0, r.height - HEADER_SIZE),
  }
}

/**
 * 重新排列指定 Pool 的所有 Lane，使其紧密排列且完全覆盖内容区域。
 *
 * 在水平布局下，Lane 按 Y 坐标排列，宽度与 Pool 内容区宽度相同。
 * 最后一个 Lane 的高度自动伸展以填满剩余空间。
 *
 * 内部 resize / setPosition 均使用 bpmnLayout: true 自定义标记：
 * X6 不识别该标记（事件正常传播、视图正常更新），
 * 但 pool-containment / lane-management 处理器检测到后跳过重入，避免跨行为级联。
 *
 * @param direction 可选的 resize 方向（来自 X6 Transform）。
 *   - 包含 'top'（水平布局）或 'left'（垂直布局）时：首 Lane 吸收 Pool 扩展空间。
 *   - 默认（未传或包含 'bottom' / 'right'）：末 Lane 填充剩余空间。
 */
export function compactLaneLayout(graph: Graph, pool: Node, direction?: string): void {
  const lanes = getChildLanes(graph, pool)
  if (lanes.length === 0) return

  const hz = isHorizontal(pool)
  const content = poolContentRect(pool)
  const sorted = sortLanesByAxis(lanes, hz)

  if (hz) {
    // 判断填充模式：top 方向 resize 时首 Lane 吸收差额，否则末 Lane 填充
    const fillFirst = direction != null && direction.includes('top')

    let currentY = content.y
    for (let i = 0; i < sorted.length; i++) {
      const lane = sorted[i]
      const size = lane.getSize()
      let laneHeight: number

      if (fillFirst && i === 0) {
        // 首 Lane 吸收 Pool 顶部扩展空间
        let othersTotal = 0
        for (let j = 1; j < sorted.length; j++) {
          othersTotal += Math.max(sorted[j].getSize().height, MIN_LANE_SIZE)
        }
        laneHeight = Math.max(content.height - othersTotal, MIN_LANE_SIZE)
      } else if (!fillFirst && i === sorted.length - 1) {
        // 末 Lane 填充下方剩余空间（默认行为）
        laneHeight = Math.max(content.y + content.height - currentY, MIN_LANE_SIZE)
      } else {
        laneHeight = Math.max(size.height, MIN_LANE_SIZE)
      }

      lane.setPosition(content.x, currentY, { bpmnLayout: true })
      lane.resize(content.width, laneHeight, { bpmnLayout: true })
      currentY += laneHeight
    }

    // 如果 Lane 总高度超出 Pool，扩展 Pool
    if (currentY > content.y + content.height) {
      const poolRect = nodeRect(pool)
      const overflow = currentY - (content.y + content.height)

      if (fillFirst) {
        pool.setPosition(poolRect.x, poolRect.y - overflow, { bpmnLayout: true })
      }

      pool.resize(poolRect.width, poolRect.height + overflow, { bpmnLayout: true })
    }
  } else {
    // 判断填充模式：left 方向 resize 时首 Lane 吸收差额
    const fillFirst = direction != null && direction.includes('left')

    let currentX = content.x
    for (let i = 0; i < sorted.length; i++) {
      const lane = sorted[i]
      const size = lane.getSize()
      let laneWidth: number

      if (fillFirst && i === 0) {
        let othersTotal = 0
        for (let j = 1; j < sorted.length; j++) {
          othersTotal += Math.max(sorted[j].getSize().width, MIN_LANE_SIZE)
        }
        laneWidth = Math.max(content.width - othersTotal, MIN_LANE_SIZE)
      } else if (!fillFirst && i === sorted.length - 1) {
        laneWidth = Math.max(content.x + content.width - currentX, MIN_LANE_SIZE)
      } else {
        laneWidth = Math.max(size.width, MIN_LANE_SIZE)
      }

      lane.setPosition(currentX, content.y, { bpmnLayout: true })
      lane.resize(laneWidth, content.height, { bpmnLayout: true })
      currentX += laneWidth
    }

    if (currentX > content.x + content.width) {
      const poolRect = nodeRect(pool)
      const overflow = currentX - (content.x + content.width)

      if (fillFirst) {
        pool.setPosition(poolRect.x - overflow, poolRect.y, { bpmnLayout: true })
      }

      pool.resize(poolRect.width + overflow, poolRect.height, { bpmnLayout: true })
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
  // 校验 size：至少为 MIN_LANE_SIZE，非正数 / NaN 时回退默认值
  const laneSize = validateLaneSize(options.size)
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
      // 这里只是为新 Lane 预留空间，等 Lane 插入后会统一 compact；
      // 使用 bpmnLayout 标记，让事件正常传播（视图更新）但行为处理器跳过。
      pool.resize(poolRect.width, poolRect.height + expandBy, { bpmnLayout: true })
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
      pool.resize(poolRect.width + expandBy, poolRect.height, { bpmnLayout: true })
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

  // 重新排列所有 Lane，确保最后一条 Lane 填满 Pool 内容区，不留空隙
  compactLaneLayout(graph, pool)

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
  const laneSize = validateLaneSize(options.size)
  const label = options.label ?? 'Lane'
  const refRect = nodeRect(referenceLane)

  // 将参照 Lane 向后移动，为新 Lane 腾出空间；使用 bpmnLayout 标记避免中间态触发级联
  if (hz) {
    referenceLane.setPosition(refRect.x, refRect.y + laneSize, { bpmnLayout: true })
  } else {
    referenceLane.setPosition(refRect.x + laneSize, refRect.y, { bpmnLayout: true })
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
  const laneSize = validateLaneSize(options.size)
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
    pool.resize(r.width, r.height + extraSize, { bpmnLayout: true })
  } else {
    pool.resize(r.width + extraSize, r.height, { bpmnLayout: true })
  }
}

// ============================================================================
// Lane 调整大小时同步相邻 Lane — 保持无间隙
// ============================================================================

export interface LaneManagementOptions {
  /** Lane 调整大小后的回调 */
  onLaneResize?: (lane: Node, pool: Node) => void
}

function updatePoolRect(pool: Node, rect: Rect): void {
  const current = nodeRect(pool)

  if (current.x !== rect.x || current.y !== rect.y) {
    pool.setPosition(rect.x, rect.y, { bpmnLayout: true })
  }

  if (current.width !== rect.width || current.height !== rect.height) {
    pool.resize(rect.width, rect.height, { bpmnLayout: true })
  }
}

function contentRectFromPoolRect(poolRect: Rect, horizontal: boolean): Rect {
  if (horizontal) {
    return {
      x: poolRect.x + HEADER_SIZE,
      y: poolRect.y,
      width: Math.max(0, poolRect.width - HEADER_SIZE),
      height: Math.max(0, poolRect.height),
    }
  }

  return {
    x: poolRect.x,
    y: poolRect.y + HEADER_SIZE,
    width: Math.max(0, poolRect.width),
    height: Math.max(0, poolRect.height - HEADER_SIZE),
  }
}

function unionLaneRects(lanes: Node[]): Rect | null {
  /* istanbul ignore next -- reconcileLaneResize 的 lanes 集合至少包含当前 Lane，此处分支仅防御外部误用 */
  if (lanes.length === 0) {
    return null
  }

  const rects = lanes.map((lane) => nodeRect(lane))
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map(rectRight))
  const bottom = Math.max(...rects.map(rectBottom))

  return {
    x: left,
    y: top,
    width: Math.max(right - left, MIN_LANE_SIZE),
    height: Math.max(bottom - top, MIN_LANE_SIZE),
  }
}

function siblingLaneRects(lanes: Node[], currentLaneId: string): Rect[] {
  return lanes
    .filter((lane) => lane.id !== currentLaneId)
    .map((lane) => nodeRect(lane))
}

function projectPoolContentBounds(
  lanes: Node[],
  lane: Node,
  laneIndex: number,
  horizontal: boolean,
  direction?: string,
): Rect | null {
  const laneBounds = unionLaneRects(lanes)
  /* istanbul ignore next -- reconcileLaneResize 至少会传入当前 Lane，此处分支仅防御空数组 */
  if (!laneBounds) {
    return null
  }

  if (!direction) {
    return laneBounds
  }

  const currentRect = nodeRect(lane)
  const siblingRects = siblingLaneRects(lanes, lane.id)
  const siblingLeft = siblingRects.length > 0 ? Math.min(...siblingRects.map((rect) => rect.x)) : currentRect.x
  const siblingTop = siblingRects.length > 0 ? Math.min(...siblingRects.map((rect) => rect.y)) : currentRect.y
  const siblingRight = siblingRects.length > 0 ? Math.max(...siblingRects.map(rectRight)) : rectRight(currentRect)
  const siblingBottom = siblingRects.length > 0 ? Math.max(...siblingRects.map(rectBottom)) : rectBottom(currentRect)
  const nextBounds = { ...laneBounds }

  if (horizontal) {
    if (direction.includes('left') && rectRight(currentRect) <= siblingRight) {
      nextBounds.x = currentRect.x
      nextBounds.width = Math.max(laneBounds.x + laneBounds.width - currentRect.x, MIN_LANE_SIZE)
    }

    if (direction.includes('right') && currentRect.x >= siblingLeft) {
      nextBounds.width = Math.max(rectRight(currentRect) - laneBounds.x, MIN_LANE_SIZE)
    }

    if (laneIndex === 0 && direction.includes('top')) {
      nextBounds.y = currentRect.y
      nextBounds.height = Math.max(siblingBottom - currentRect.y, MIN_LANE_SIZE)
    }

    if (laneIndex === lanes.length - 1 && direction.includes('bottom')) {
      nextBounds.height = Math.max(rectBottom(currentRect) - laneBounds.y, MIN_LANE_SIZE)
    }

    return nextBounds
  }

  if (direction.includes('top') && rectBottom(currentRect) <= siblingBottom) {
    nextBounds.y = currentRect.y
    nextBounds.height = Math.max(laneBounds.y + laneBounds.height - currentRect.y, MIN_LANE_SIZE)
  }

  if (direction.includes('bottom') && currentRect.y >= siblingTop) {
    nextBounds.height = Math.max(rectBottom(currentRect) - laneBounds.y, MIN_LANE_SIZE)
  }

  if (laneIndex === 0 && direction.includes('left')) {
    nextBounds.x = currentRect.x
    nextBounds.width = Math.max(siblingRight - currentRect.x, MIN_LANE_SIZE)
  }

  if (laneIndex === lanes.length - 1 && direction.includes('right')) {
    nextBounds.width = Math.max(rectRight(currentRect) - laneBounds.x, MIN_LANE_SIZE)
  }

  return nextBounds
}

function setLaneRect(lane: Node, rect: Rect): void {
  const current = nodeRect(lane)

  /* istanbul ignore next -- 当前调用方会同时调整共享边界对应的位置与尺寸，此处分支仅为通用封装保留 */
  if (current.x !== rect.x || current.y !== rect.y) {
    lane.setPosition(rect.x, rect.y, { bpmnLayout: true })
  }

  /* istanbul ignore next -- 当前调用方会同时调整共享边界对应的位置与尺寸，此处分支仅为通用封装保留 */
  if (current.width !== rect.width || current.height !== rect.height) {
    lane.resize(rect.width, rect.height, { bpmnLayout: true })
  }
}

function syncPreviousLaneBoundary(lanes: Node[], laneIndex: number, horizontal: boolean): void {
  if (laneIndex <= 0) {
    return
  }

  const previousLane = lanes[laneIndex - 1]
  const currentLane = lanes[laneIndex]
  const previousRect = nodeRect(previousLane)
  const currentRect = nodeRect(currentLane)

  if (horizontal) {
    const currentBottom = rectBottom(currentRect)
    const nextTop = Math.max(currentRect.y, previousRect.y + MIN_LANE_SIZE)
    const nextHeight = Math.max(currentBottom - nextTop, MIN_LANE_SIZE)
    const previousHeight = Math.max(nextTop - previousRect.y, MIN_LANE_SIZE)

    if (nextTop !== currentRect.y || nextHeight !== currentRect.height) {
      setLaneRect(currentLane, {
        x: currentRect.x,
        y: nextTop,
        width: currentRect.width,
        height: nextHeight,
      })
    }

    if (previousHeight !== previousRect.height) {
      previousLane.resize(previousRect.width, previousHeight, { bpmnLayout: true })
    }

    return
  }

  const currentRight = rectRight(currentRect)
  const nextLeft = Math.max(currentRect.x, previousRect.x + MIN_LANE_SIZE)
  const nextWidth = Math.max(currentRight - nextLeft, MIN_LANE_SIZE)
  const previousWidth = Math.max(nextLeft - previousRect.x, MIN_LANE_SIZE)

  if (nextLeft !== currentRect.x || nextWidth !== currentRect.width) {
    setLaneRect(currentLane, {
      x: nextLeft,
      y: currentRect.y,
      width: nextWidth,
      height: currentRect.height,
    })
  }

  if (previousWidth !== previousRect.width) {
    previousLane.resize(previousWidth, previousRect.height, { bpmnLayout: true })
  }
}

function updatePoolToFitLanes(
  pool: Node,
  lanes: Node[],
  lane: Node,
  laneIndex: number,
  horizontal: boolean,
  direction?: string,
): void {
  const laneBounds = projectPoolContentBounds(lanes, lane, laneIndex, horizontal, direction)
  /* istanbul ignore next -- reconcileLaneResize 至少会传入当前 Lane，此处分支仅防御空数组 */
  if (!laneBounds) {
    return
  }

  const nextPoolRect = horizontal
    ? {
        x: laneBounds.x - HEADER_SIZE,
        y: laneBounds.y,
        width: laneBounds.width + HEADER_SIZE,
        height: laneBounds.height,
      }
    : {
        x: laneBounds.x,
        y: laneBounds.y - HEADER_SIZE,
        width: laneBounds.width,
        height: laneBounds.height + HEADER_SIZE,
      }

  const poolContent = contentRectFromPoolRect(nodeRect(pool), horizontal)
  if (
    poolContent.x === laneBounds.x
    && poolContent.y === laneBounds.y
    && poolContent.width === laneBounds.width
    && poolContent.height === laneBounds.height
  ) {
    return
  }

  updatePoolRect(pool, nextPoolRect)
}

/**
 * 将 Lane 的用户 resize 结果投影为 Pool 几何变化，再统一收敛兄弟 Lane。
 *
 * 语义约束：
 * 1. 左右边拖拽本质上修改 Participant 宽度；
 * 2. 顶/底边在外侧边界时修改 Participant 高度；
 * 3. 内侧 top/left 拖拽仅改变前一条兄弟 Lane 的尺寸，随后统一重排。
 */
export function reconcileLaneResize(
  graph: Graph,
  lane: Node,
  direction?: string,
  resizeStartRect?: { x: number; y: number; width: number; height: number },
): Node | null {
  void direction
  void resizeStartRect

  const pool = getParentPool(lane)
  if (!pool) return null

  const lanes = sortLanesByAxis(getChildLanes(graph, pool), isHorizontal(pool))
  const laneIndex = lanes.findIndex((candidate) => candidate.id === lane.id)
  if (laneIndex < 0) {
    compactLaneLayout(graph, pool)
    return pool
  }

  const poolRect = nodeRect(pool)
  const horizontal = isHorizontal(pool)
  void poolRect

  syncPreviousLaneBoundary(lanes, laneIndex, horizontal)
  updatePoolToFitLanes(pool, lanes, lane, laneIndex, horizontal, direction)

  compactLaneLayout(graph, pool)
  return pool
}

/**
 * 安装 Lane 管理行为。
 *
 * - 监听 Lane 的 resize 完成事件，将结果投影到 Pool，再统一收敛布局；
 * - 返回 dispose 函数用于清理。
 */
export function setupLaneManagement(
  graph: Graph,
  options: LaneManagementOptions = {},
): () => void {
  function onLaneResized({ node, options: resizeOpts }: { node: Node; options?: Record<string, unknown> }) {
    if (node.shape !== BPMN_LANE) return
    if (resizeOpts?.silent || resizeOpts?.bpmnLayout) return

    const pool = reconcileLaneResize(
      graph,
      node,
      typeof resizeOpts?.direction === 'string' ? resizeOpts.direction : undefined,
    )
    if (!pool) return

    normalizeSwimlaneLayers(graph)
    options.onLaneResize?.(node, pool)
  }

  graph.on('node:resized', onLaneResized)

  return () => {
    graph.off('node:resized', onLaneResized)
  }
}
