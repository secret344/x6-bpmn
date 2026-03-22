/**
 * 边界事件吸附所需的几何计算工具
 *
 * 提供点到矩形边框的距离计算、最近边框点投影、
 * 边框位置比例编码/解码等基础几何操作。
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 二维坐标点 */
export interface Point {
  x: number
  y: number
}

/** 轴对齐矩形 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 矩形的四条边 */
export type RectSide = 'top' | 'right' | 'bottom' | 'left'

/** 边框上的位置描述（哪条边 + 在该边上的比例） */
export interface BoundaryPosition {
  side: RectSide
  /** 在该边上的位置比例 [0, 1]，从左→右 或 从上→下 */
  ratio: number
}

/** 最近边框点的完整信息 */
export interface SnapResult {
  /** 投影后的坐标 */
  point: Point
  /** 所在的边 */
  side: RectSide
  /** 在该边上的位置比例 */
  ratio: number
  /** 原始点到投影点的距离 */
  distance: number
}

// ============================================================================
// 核心计算函数
// ============================================================================

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/**
 * 计算一个点到矩形边框上最近点的信息。
 *
 * 无论点在矩形内部还是外部，都返回边框上距离最近的点。
 */
export function snapToRectEdge(point: Point, rect: Rect): SnapResult {
  const { x, y, width, height } = rect

  // 四条边上的最近点
  const candidates: SnapResult[] = [
    // top 边：y 固定为 rect.y，x 夹到 [x, x+width]
    (() => {
      const px = clamp(point.x, x, x + width)
      const py = y
      const ratio = width > 0 ? (px - x) / width : 0.5
      const dist = Math.hypot(point.x - px, point.y - py)
      return { point: { x: px, y: py }, side: 'top' as RectSide, ratio, distance: dist }
    })(),
    // bottom 边
    (() => {
      const px = clamp(point.x, x, x + width)
      const py = y + height
      const ratio = width > 0 ? (px - x) / width : 0.5
      const dist = Math.hypot(point.x - px, point.y - py)
      return { point: { x: px, y: py }, side: 'bottom' as RectSide, ratio, distance: dist }
    })(),
    // left 边：x 固定为 rect.x，y 夹到 [y, y+height]
    (() => {
      const px = x
      const py = clamp(point.y, y, y + height)
      const ratio = height > 0 ? (py - y) / height : 0.5
      const dist = Math.hypot(point.x - px, point.y - py)
      return { point: { x: px, y: py }, side: 'left' as RectSide, ratio, distance: dist }
    })(),
    // right 边
    (() => {
      const px = x + width
      const py = clamp(point.y, y, y + height)
      const ratio = height > 0 ? (py - y) / height : 0.5
      const dist = Math.hypot(point.x - px, point.y - py)
      return { point: { x: px, y: py }, side: 'right' as RectSide, ratio, distance: dist }
    })(),
  ]

  // 取距离最小的
  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].distance < best.distance) {
      best = candidates[i]
    }
  }
  return best
}

/**
 * 根据 BoundaryPosition（边 + 比例）计算矩形边框上的实际坐标。
 *
 * 用于宿主移动/resize 后重新定位边界事件。
 */
export function boundaryPositionToPoint(pos: BoundaryPosition, rect: Rect): Point {
  const { x, y, width, height } = rect
  const r = clamp(pos.ratio, 0, 1)

  switch (pos.side) {
    case 'top':
      return { x: x + width * r, y }
    case 'bottom':
      return { x: x + width * r, y: y + height }
    case 'left':
      return { x, y: y + height * r }
    case 'right':
      return { x: x + width, y: y + height * r }
  }
}

/**
 * 计算点到矩形边框的最短距离。
 *
 * - 点在外部：返回到最近边的欧几里得距离
 * - 点在内部：返回到最近边的距离（正值）
 */
export function distanceToRectEdge(point: Point, rect: Rect): number {
  return snapToRectEdge(point, rect).distance
}
