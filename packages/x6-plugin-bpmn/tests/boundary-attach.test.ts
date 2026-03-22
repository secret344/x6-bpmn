/**
 * 边界事件吸附行为 — 单元测试
 */

import { describe, it, expect } from 'vitest'
import {
  snapToRectEdge,
  boundaryPositionToPoint,
  distanceToRectEdge,
} from '../src/behaviors/geometry'
import type { Rect, Point, BoundaryPosition } from '../src/behaviors/geometry'

// ============================================================================
// geometry.ts 测试
// ============================================================================

describe('snapToRectEdge', () => {
  const rect: Rect = { x: 100, y: 100, width: 200, height: 100 }

  it('点在正上方 → snap 到 top 边', () => {
    const result = snapToRectEdge({ x: 200, y: 80 }, rect)
    expect(result.side).toBe('top')
    expect(result.point).toEqual({ x: 200, y: 100 })
    expect(result.ratio).toBeCloseTo(0.5)
    expect(result.distance).toBeCloseTo(20)
  })

  it('点在正下方 → snap 到 bottom 边', () => {
    const result = snapToRectEdge({ x: 200, y: 220 }, rect)
    expect(result.side).toBe('bottom')
    expect(result.point).toEqual({ x: 200, y: 200 })
    expect(result.ratio).toBeCloseTo(0.5)
    expect(result.distance).toBeCloseTo(20)
  })

  it('点在正左方 → snap 到 left 边', () => {
    const result = snapToRectEdge({ x: 80, y: 150 }, rect)
    expect(result.side).toBe('left')
    expect(result.point).toEqual({ x: 100, y: 150 })
    expect(result.ratio).toBeCloseTo(0.5)
    expect(result.distance).toBeCloseTo(20)
  })

  it('点在正右方 → snap 到 right 边', () => {
    const result = snapToRectEdge({ x: 320, y: 150 }, rect)
    expect(result.side).toBe('right')
    expect(result.point).toEqual({ x: 300, y: 150 })
    expect(result.ratio).toBeCloseTo(0.5)
    expect(result.distance).toBeCloseTo(20)
  })

  it('点在矩形内部（靠近 top 边）→ snap 到 top', () => {
    const result = snapToRectEdge({ x: 200, y: 105 }, rect)
    expect(result.side).toBe('top')
    expect(result.point).toEqual({ x: 200, y: 100 })
    expect(result.distance).toBeCloseTo(5)
  })

  it('点在矩形内部（靠近 right 边）→ snap 到 right', () => {
    const result = snapToRectEdge({ x: 295, y: 150 }, rect)
    expect(result.side).toBe('right')
    expect(result.point).toEqual({ x: 300, y: 150 })
    expect(result.distance).toBeCloseTo(5)
  })

  it('点在角落附近 → snap 到最近的边', () => {
    // 右下角外侧偏右
    const result = snapToRectEdge({ x: 310, y: 210 }, rect)
    expect(result.point.x).toBe(300)
    expect(result.point.y).toBe(200)
  })

  it('点正好在边框上 → distance 为 0', () => {
    const result = snapToRectEdge({ x: 200, y: 100 }, rect)
    expect(result.distance).toBeCloseTo(0)
    expect(result.side).toBe('top')
  })

  it('ratio 计算正确 — left 边', () => {
    const result = snapToRectEdge({ x: 80, y: 125 }, rect)
    expect(result.side).toBe('left')
    expect(result.ratio).toBeCloseTo(0.25)
  })

  it('ratio 计算正确 — bottom 边', () => {
    const result = snapToRectEdge({ x: 250, y: 220 }, rect)
    expect(result.side).toBe('bottom')
    expect(result.ratio).toBeCloseTo(0.75)
  })
})

describe('boundaryPositionToPoint', () => {
  const rect: Rect = { x: 100, y: 100, width: 200, height: 100 }

  it('top 边 ratio=0.5 → 中间', () => {
    const point = boundaryPositionToPoint({ side: 'top', ratio: 0.5 }, rect)
    expect(point).toEqual({ x: 200, y: 100 })
  })

  it('bottom 边 ratio=0 → 左下角', () => {
    const point = boundaryPositionToPoint({ side: 'bottom', ratio: 0 }, rect)
    expect(point).toEqual({ x: 100, y: 200 })
  })

  it('left 边 ratio=1 → 左下角', () => {
    const point = boundaryPositionToPoint({ side: 'left', ratio: 1 }, rect)
    expect(point).toEqual({ x: 100, y: 200 })
  })

  it('right 边 ratio=0.5 → 右侧中间', () => {
    const point = boundaryPositionToPoint({ side: 'right', ratio: 0.5 }, rect)
    expect(point).toEqual({ x: 300, y: 150 })
  })

  it('ratio 被 clamp 到 [0, 1]', () => {
    const point = boundaryPositionToPoint({ side: 'top', ratio: 1.5 }, rect)
    expect(point).toEqual({ x: 300, y: 100 })

    const point2 = boundaryPositionToPoint({ side: 'top', ratio: -0.5 }, rect)
    expect(point2).toEqual({ x: 100, y: 100 })
  })
})

describe('distanceToRectEdge', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 60 }

  it('点在外部', () => {
    expect(distanceToRectEdge({ x: 50, y: -10 }, rect)).toBeCloseTo(10)
  })

  it('点在边框上', () => {
    expect(distanceToRectEdge({ x: 50, y: 0 }, rect)).toBeCloseTo(0)
  })

  it('点在内部', () => {
    // 内部靠近 top，距离 top 5px
    const d = distanceToRectEdge({ x: 50, y: 5 }, rect)
    expect(d).toBeCloseTo(5)
  })
})

describe('snapToRectEdge → boundaryPositionToPoint 往返一致性', () => {
  const rect: Rect = { x: 50, y: 50, width: 160, height: 80 }

  const testPoints: Point[] = [
    { x: 130, y: 30 },  // above
    { x: 130, y: 150 }, // below
    { x: 20, y: 90 },   // left
    { x: 240, y: 90 },  // right
    { x: 80, y: 55 },   // near top-left inside
  ]

  for (const pt of testPoints) {
    it(`snap(${pt.x}, ${pt.y}) → position → point 往返`, () => {
      const snap = snapToRectEdge(pt, rect)
      const restored = boundaryPositionToPoint(
        { side: snap.side, ratio: snap.ratio },
        rect,
      )
      expect(restored.x).toBeCloseTo(snap.point.x, 5)
      expect(restored.y).toBeCloseTo(snap.point.y, 5)
    })
  }
})
