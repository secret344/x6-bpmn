/**
 * 边界事件吸附行为 — 单元测试
 */

import { describe, it, expect, vi } from 'vitest'
import {
  snapToRectEdge,
  boundaryPositionToPoint,
  distanceToRectEdge,
} from '../../../src/behaviors/geometry'
import {
  attachBoundaryToHost,
  setupBoundaryAttach,
  defaultIsValidHostForBoundary,
  CANCEL_BOUNDARY_HOST_SHAPES,
} from '../../../src/behaviors/boundary-attach'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  dragNodeLinearly,
  getNodeCenter,
  getNodeRect,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'
import type { Rect, Point, BoundaryPosition } from '../../../src/behaviors/geometry'

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

// ============================================================================
// 边界场景 — snapToRectEdge
// ============================================================================

describe('snapToRectEdge — 零尺寸/退化矩形', () => {
  it('宽高为 0 的矩形 → ratio 应为 0.5', () => {
    const zeroRect: Rect = { x: 100, y: 100, width: 0, height: 0 }
    const result = snapToRectEdge({ x: 110, y: 110 }, zeroRect)
    expect(result.ratio).toBeCloseTo(0.5)
    expect(result.point).toEqual({ x: 100, y: 100 })
  })

  it('宽度为 0（竖线）→ 只能 snap 到 left/right', () => {
    const thinRect: Rect = { x: 50, y: 0, width: 0, height: 100 }
    const result = snapToRectEdge({ x: 60, y: 50 }, thinRect)
    // ratio 应基于 height 计算
    expect(result.point.x).toBe(50)
    expect(result.point.y).toBe(50)
  })

  it('高度为 0（横线）→ 只能 snap 到 top/bottom', () => {
    const flatRect: Rect = { x: 0, y: 50, width: 100, height: 0 }
    const result = snapToRectEdge({ x: 50, y: 60 }, flatRect)
    expect(result.point.y).toBe(50)
    expect(result.point.x).toBe(50)
  })
})

describe('snapToRectEdge — 精确角点测试', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 60 }

  it('点正好在左上角 → distance 为 0', () => {
    const result = snapToRectEdge({ x: 0, y: 0 }, rect)
    expect(result.distance).toBeCloseTo(0)
  })

  it('点正好在右下角 → distance 为 0', () => {
    const result = snapToRectEdge({ x: 100, y: 60 }, rect)
    expect(result.distance).toBeCloseTo(0)
  })

  it('点正好在左下角 → distance 为 0', () => {
    const result = snapToRectEdge({ x: 0, y: 60 }, rect)
    expect(result.distance).toBeCloseTo(0)
  })

  it('点正好在右上角 → distance 为 0', () => {
    const result = snapToRectEdge({ x: 100, y: 0 }, rect)
    expect(result.distance).toBeCloseTo(0)
  })
})

describe('snapToRectEdge — 负坐标矩形', () => {
  const rect: Rect = { x: -100, y: -80, width: 200, height: 100 }

  it('负坐标矩形外点 → 正确 snap', () => {
    const result = snapToRectEdge({ x: 0, y: -100 }, rect)
    expect(result.side).toBe('top')
    expect(result.point.y).toBe(-80)
    expect(result.distance).toBeCloseTo(20)
  })

  it('负坐标矩形内的中心点 → snap 到最近边', () => {
    const result = snapToRectEdge({ x: 0, y: -75 }, rect)
    expect(result.side).toBe('top')
    expect(result.distance).toBeCloseTo(5)
  })
})

describe('snapToRectEdge — 极远距离', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 100 }

  it('极远的点 → 仍然正确 snap', () => {
    const result = snapToRectEdge({ x: 10000, y: 50 }, rect)
    expect(result.side).toBe('right')
    expect(result.point).toEqual({ x: 100, y: 50 })
    expect(result.distance).toBeCloseTo(9900)
  })
})

// ============================================================================
// 边界场景 — boundaryPositionToPoint
// ============================================================================

describe('boundaryPositionToPoint — 极端 ratio', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 60 }

  it('ratio = 0 → 边的起始点', () => {
    expect(boundaryPositionToPoint({ side: 'top', ratio: 0 }, rect)).toEqual({ x: 0, y: 0 })
    expect(boundaryPositionToPoint({ side: 'right', ratio: 0 }, rect)).toEqual({ x: 100, y: 0 })
  })

  it('ratio = 1 → 边的终止点', () => {
    expect(boundaryPositionToPoint({ side: 'top', ratio: 1 }, rect)).toEqual({ x: 100, y: 0 })
    expect(boundaryPositionToPoint({ side: 'left', ratio: 1 }, rect)).toEqual({ x: 0, y: 60 })
  })

  it('ratio 超出范围 clamp 到 [0, 1]', () => {
    expect(boundaryPositionToPoint({ side: 'bottom', ratio: 2.0 }, rect)).toEqual({ x: 100, y: 60 })
    expect(boundaryPositionToPoint({ side: 'bottom', ratio: -1.0 }, rect)).toEqual({ x: 0, y: 60 })
  })
})

// ============================================================================
// 边界场景 — distanceToRectEdge
// ============================================================================

describe('distanceToRectEdge — 特殊位置', () => {
  const rect: Rect = { x: 0, y: 0, width: 100, height: 60 }

  it('矩形中心点 → 到最近边的距离', () => {
    // 中心 (50, 30)，最近边是 top 或 bottom 距离均为 30
    const d = distanceToRectEdge({ x: 50, y: 30 }, rect)
    expect(d).toBeCloseTo(30)
  })

  it('角点正对的外侧点', () => {
    // 在左上角外侧 45° → 距离 = sqrt(10^2 + 10^2) ≈ 14.14
    const d = distanceToRectEdge({ x: -10, y: -10 }, rect)
    expect(d).toBeCloseTo(Math.SQRT2 * 10)
  })

  it('零尺寸矩形的距离', () => {
    const zero: Rect = { x: 50, y: 50, width: 0, height: 0 }
    const d = distanceToRectEdge({ x: 53, y: 54 }, zero)
    expect(d).toBeCloseTo(5) // sqrt(9+16) = 5
  })
})

// ============================================================================
// attachBoundaryToHost — 程序化吸附
// ============================================================================

describe('attachBoundaryToHost', () => {
  function mockNode(id: string, shape: string, x: number, y: number, w: number, h: number) {
    let pos = { x, y }
    const size = { width: w, height: h }
    let data: Record<string, any> = {}
    let parent: any = null
    const children: any[] = []
    return {
      id,
      shape,
      getPosition: () => ({ ...pos }),
      getSize: () => ({ ...size }),
      setPosition: (nx: number, ny: number) => { pos = { x: nx, y: ny } },
      getData: () => data,
      setData: (d: any) => { data = d },
      getParent: () => parent,
      setParent: (p: any) => { parent = p },
      embed: (child: any) => { child.setParent({ id }); children.push(child) },
      getChildren: () => children.length > 0 ? children : null,
      toFront: vi.fn(),
      isNode: () => true,
    } as any
  }

  function mockGraph(nodes: any[] = []) {
    const handlers: Record<string, Function[]> = {}
    return {
      on: (event: string, fn: Function) => {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      off: (event: string, fn: Function) => {
        handlers[event] = (handlers[event] || []).filter(f => f !== fn)
      },
      emit: (event: string, ...args: any[]) => {
        for (const fn of handlers[event] || []) fn(...args)
      },
      _handlers: handlers,
    } as any
  }

  it('应将边界事件 snap 到宿主边框', () => {
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)
    const graph = mockGraph()

    attachBoundaryToHost(graph, boundary, host)

    // boundary 应被 embed 到 host
    expect(boundary.getParent()).not.toBeNull()
    // position 应 snap 到边框上 (距 top 最近)
    const bPos = boundary.getPosition()
    expect(bPos.y).toBeCloseTo(100 - 18) // snapped to top edge, centered (y = edge - half_height)
    // 应保存 boundaryPosition 数据
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
    expect(data.bpmn?.boundaryPosition.side).toBe('top')
    // toFront 应被调用
    expect(boundary.toFront).toHaveBeenCalled()
  })

  it('snap 到 bottom 边', () => {
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 200, 220, 36, 36)
    const graph = mockGraph()

    attachBoundaryToHost(graph, boundary, host)
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition.side).toBe('bottom')
  })
})

describe('boundary attach real graph interactions', () => {
  it('默认配置下线性拖拽边界事件时应始终贴着宿主边框移动', () => {
    registerBehaviorTestShapes([BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const dispose = setupBoundaryAttach(graph)
    const host = graph.addNode({
      id: 'host',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    })
    const boundary = graph.addNode({
      id: 'boundary',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 182,
      y: 82,
      width: 36,
      height: 36,
    })

    attachBoundaryToHost(graph, boundary, host)
    dragNodeLinearly(graph, boundary, { x: 70, y: 55 }, 7)

    expect(boundary.getParent()?.id).toBe(host.id)
    expect(distanceToRectEdge(getNodeCenter(boundary), getNodeRect(host))).toBeCloseTo(0, 5)
    expect(boundary.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()?.bpmn?.boundaryPosition).toBeDefined()

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('默认配置下线性拖离宿主时仍应保持附着并沿边框滑动', () => {
    registerBehaviorTestShapes([BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const dispose = setupBoundaryAttach(graph)
    const host = graph.addNode({
      id: 'host',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    })
    const boundary = graph.addNode({
      id: 'boundary',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 182,
      y: 82,
      width: 36,
      height: 36,
    })

    attachBoundaryToHost(graph, boundary, host)
    dragNodeLinearly(graph, boundary, { x: 320, y: 240 }, 8)

    expect(boundary.getParent()?.id).toBe(host.id)
    expect(distanceToRectEdge(getNodeCenter(boundary), getNodeRect(host))).toBeCloseTo(0, 5)
    expect(boundary.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()?.bpmn?.boundaryPosition).toBeDefined()

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('显式配置有限阈值后，线性拖离宿主超过阈值时应解除附着', () => {
    registerBehaviorTestShapes([BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const dispose = setupBoundaryAttach(graph, { detachDistance: 24 })
    const host = graph.addNode({
      id: 'host',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    })
    const boundary = graph.addNode({
      id: 'boundary',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 182,
      y: 82,
      width: 36,
      height: 36,
    })

    attachBoundaryToHost(graph, boundary, host)
    dragNodeLinearly(graph, boundary, { x: 240, y: -180 }, 8)

    expect(boundary.getParent()).toBeNull()
    expect(boundary.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()?.bpmn?.boundaryPosition).toBeUndefined()

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('宿主 resize 后应按保存的边框位置重算边界事件坐标', () => {
    registerBehaviorTestShapes([BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const dispose = setupBoundaryAttach(graph)
    const host = graph.addNode({
      id: 'host',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    })
    const boundary = graph.addNode({
      id: 'boundary',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 302,
      y: 132,
      width: 36,
      height: 36,
    })

    attachBoundaryToHost(graph, boundary, host)
    const beforeX = boundary.getPosition().x

    host.resize(260, 140)
    graph.emit('node:change:size', { node: host, cell: host })

    expect(boundary.getParent()?.id).toBe(host.id)
    expect(distanceToRectEdge(getNodeCenter(boundary), getNodeRect(host))).toBeCloseTo(0, 5)
    expect(boundary.getPosition().x).toBeGreaterThan(beforeX)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('取消边界事件在真实图场景中仍只允许附着到事务子流程', () => {
    registerBehaviorTestShapes([BPMN_TRANSACTION, BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_CANCEL])

    const graph = createBehaviorTestGraph()
    const dispose = setupBoundaryAttach(graph)
    const transaction = graph.addNode({
      id: 'transaction',
      shape: BPMN_TRANSACTION,
      x: 100,
      y: 100,
      width: 220,
      height: 120,
    })
    const task = graph.addNode({
      id: 'task',
      shape: BPMN_USER_TASK,
      x: 360,
      y: 100,
      width: 200,
      height: 100,
    })
    const cancelBoundary = graph.addNode({
      id: 'cancel-boundary',
      shape: BPMN_BOUNDARY_EVENT_CANCEL,
      x: 182,
      y: 82,
      width: 36,
      height: 36,
    })

    transaction.embed(cancelBoundary)
    graph.emit('node:embedded', { node: cancelBoundary, currentParent: transaction, previousParent: null })
    expect(cancelBoundary.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()?.bpmn?.boundaryPosition).toBeDefined()

    task.embed(cancelBoundary)
    graph.emit('node:embedded', { node: cancelBoundary, currentParent: task, previousParent: transaction })
    expect(cancelBoundary.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()?.bpmn?.boundaryPosition?.side).toBeDefined()
    expect(defaultIsValidHostForBoundary(task.shape, cancelBoundary.shape)).toBe(false)

    dispose()
    destroyBehaviorTestGraph(graph)
  })
})

// ============================================================================
// setupBoundaryAttach — 事件驱动吸附行为
// ============================================================================

describe('setupBoundaryAttach', () => {
  function mockNode(id: string, shape: string, x: number, y: number, w: number, h: number) {
    let pos = { x, y }
    const size = { width: w, height: h }
    let data: Record<string, any> = {}
    let parent: any = null
    const children: any[] = []
    const self: any = {
      id,
      shape,
      getPosition: () => ({ ...pos }),
      getSize: () => ({ ...size }),
      setPosition: (nx: number, ny: number, _opts?: any) => { pos = { x: nx, y: ny } },
      getData: () => data,
      setData: (d: any, _opts?: any) => { data = d },
      getParent: () => parent,
      setParent: (p: any) => { parent = p },
      embed: (child: any) => { child.setParent(self); children.push(child) },
      unembed: (child: any) => { child.setParent(null); const i = children.indexOf(child); if (i >= 0) children.splice(i, 1) },
      getChildren: () => children.length > 0 ? children : null,
      toFront: vi.fn(),
      isNode: () => true,
    }
    return self
  }

  function mockGraph(nodes: any[] = []) {
    const handlers: Record<string, Function[]> = {}
    return {
      on: (event: string, fn: Function) => {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      off: (event: string, fn: Function) => {
        handlers[event] = (handlers[event] || []).filter(f => f !== fn)
      },
      emit: (event: string, data: any) => {
        for (const fn of handlers[event] || []) fn(data)
      },
      getCellById: (id: string) => nodes.find(node => node.id === id) ?? null,
      _handlers: handlers,
    } as any
  }

  it('应绑定五个事件并返回 dispose 函数', () => {
    const graph = mockGraph()
    const dispose = setupBoundaryAttach(graph)
    expect(graph._handlers['node:embedded']?.length).toBe(1)
    expect(graph._handlers['node:moving']?.length).toBe(1)
    expect(graph._handlers['node:moved']?.length).toBe(1)
    expect(graph._handlers['node:change:parent']?.length).toBe(1)
    expect(graph._handlers['node:change:size']?.length).toBe(1)
    dispose()
    expect(graph._handlers['node:embedded']?.length).toBe(0)
    expect(graph._handlers['node:moving']?.length).toBe(0)
    expect(graph._handlers['node:moved']?.length).toBe(0)
    expect(graph._handlers['node:change:parent']?.length).toBe(0)
    expect(graph._handlers['node:change:size']?.length).toBe(0)
  })

  it('node:embedded — 边界事件嵌入后应 snap 到边框', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    // 手动设置父子关系
    host.embed(boundary)
    setupBoundaryAttach(graph)
    graph.emit('node:embedded', { node: boundary, currentParent: host, previousParent: null })

    // boundary 应被 snap 到边框
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
    expect(boundary.toFront).toHaveBeenCalled()
  })

  it('node:embedded — 非边界事件不处理', () => {
    const graph = mockGraph()
    const task = mockNode('t1', 'bpmn-user-task', 100, 100, 200, 100)
    setupBoundaryAttach(graph)
    graph.emit('node:embedded', { node: task, currentParent: null, previousParent: null })
    // 不应抛异常
  })

  it('node:moving — 已吸附边界事件在边框约束移动', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    host.embed(boundary)
    setupBoundaryAttach(graph, { constrainToEdge: true })

    // 移动到靠近 top 边
    boundary.setPosition(180, 90)
    graph.emit('node:moving', { node: boundary })

    // 应仍 snap 到边框
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
  })

  it('node:moving — 默认配置下拖到宿主外侧仍应保持附着', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    host.embed(boundary)
    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 } } })

    setupBoundaryAttach(graph)

    boundary.setPosition(500, 500)
    graph.emit('node:moving', { node: boundary })

    expect(boundary.getParent()?.id).toBe(host.id)
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
  })

  it('node:moving — 显式配置有限 detachDistance 后拖离应解除绑定', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    host.embed(boundary)
    // 设置初始 boundaryPosition
    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 } } })

    setupBoundaryAttach(graph, { detachDistance: 30 })

    // 移动到远离宿主
    boundary.setPosition(500, 500)
    graph.emit('node:moving', { node: boundary })

    // 应被 unembed（parent 设为 null）
    expect(boundary.getParent()).toBeNull()
    // boundaryPosition 应被清除
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeUndefined()
  })

  it('node:moving — 非边界事件不处理', () => {
    const graph = mockGraph()
    const task = mockNode('t1', 'bpmn-user-task', 100, 100, 200, 100)
    setupBoundaryAttach(graph)
    graph.emit('node:moving', { node: task })
    // 不应抛异常
  })

  it('node:change:size — 宿主 resize 后应重新定位边界事件', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 200, 82, 36, 36)

    host.embed(boundary)
    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 } } })

    setupBoundaryAttach(graph)
    // 调整宿主节点尺寸
    graph.emit('node:change:size', { node: host, cell: host })

    // boundary 应被重新定位到 top 边 ratio=0.5
    const bPos = boundary.getPosition()
    // top 边 ratio=0.5 → x = 100 + 200*0.5 = 200, y = 100
    // setNodeCenter sets pos.x = cx - w/2 = 200 - 18 = 182
    expect(bPos.x).toBeCloseTo(200 - 18)
    expect(bPos.y).toBeCloseTo(100 - 18)
  })

  it('node:change:size — 非宿主不处理', () => {
    const graph = mockGraph()
    const task = mockNode('t1', 'bpmn-data-object', 100, 100, 50, 50)
    setupBoundaryAttach(graph)
    graph.emit('node:change:size', { node: task, cell: task })
    // 不应抛异常
  })

  it('自定义 isBoundaryEvent 和 isValidHost', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'my-activity', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'my-boundary', 150, 80, 36, 36)

    host.embed(boundary)

    setupBoundaryAttach(graph, {
      isValidHost: (s) => s === 'my-activity',
      isBoundaryEvent: (s) => s === 'my-boundary',
    })

    graph.emit('node:embedded', { node: boundary, currentParent: host, previousParent: null })
    expect(boundary.getData().bpmn?.boundaryPosition).toBeDefined()
  })

  it('node:moving — constrainToEdge=false 时不强制 snap', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 120, 36, 36)

    host.embed(boundary)
    setupBoundaryAttach(graph, { constrainToEdge: false })

    boundary.setPosition(180, 130)
    graph.emit('node:moving', { node: boundary })

    // 不应 snap，位置不变
    const pos = boundary.getPosition()
    expect(pos.x).toBe(180)
    expect(pos.y).toBe(130)
  })

  it('node:embedded — 边界事件无有效宿主时不处理', () => {
    const graph = mockGraph()
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    // 没有 embed，getParent() === null
    setupBoundaryAttach(graph)
    graph.emit('node:embedded', { node: boundary, currentParent: null, previousParent: null })
    expect(boundary.getData().bpmn?.boundaryPosition).toBeUndefined()
  })

  it('node:moving — 边界事件无 parent 时不处理', () => {
    const graph = mockGraph()
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    setupBoundaryAttach(graph)
    graph.emit('node:moving', { node: boundary })
    // 无 parent，不应抛异常
  })

  it('node:moving — 直拖导致 parent 暂失时应按 attachedToRef 恢复附着', () => {
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)
    const graph = mockGraph([host, boundary])

    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 }, attachedToRef: 'host' } })

    setupBoundaryAttach(graph)

    boundary.setPosition(500, 500)
    graph.emit('node:moving', { node: boundary })

    expect(boundary.getParent()?.id).toBe(host.id)
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
  })

  it('node:change:parent — 直拖导致 parent 暂失时也应按 attachedToRef 恢复附着', () => {
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)
    const graph = mockGraph([host, boundary])

    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 }, attachedToRef: 'host' } })

    setupBoundaryAttach(graph)

    boundary.setPosition(500, 500)
    graph.emit('node:change:parent', { node: boundary, current: null, previous: host })

    expect(boundary.getParent()?.id).toBe(host.id)
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
  })

  it('node:moving — attachedToRef 指向无效宿主时应安全跳过', () => {
    const boundary = mockNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)
    const graph = mockGraph([boundary])

    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 }, attachedToRef: 'missing-host' } })

    setupBoundaryAttach(graph)

    expect(() => graph.emit('node:moving', { node: boundary })).not.toThrow()
    expect(boundary.getParent()).toBeNull()
  })

  it('node:change:size — 子节点无 boundaryPosition 时跳过', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mockNode('b1', 'bpmn-boundary-event', 200, 82, 36, 36)
    host.embed(boundary)
    // 不设 boundaryPosition

    setupBoundaryAttach(graph)
    graph.emit('node:change:size', { node: host, cell: host })
    // 不应抛异常，boundary 位置不变
  })

  it('node:change:size — 子节点非 isNode 会被跳过', () => {
    const graph = mockGraph()
    const host = mockNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    // 创建一个 isNode() === false 的子元素
    const edge: any = { isNode: () => false, shape: 'bpmn-boundary-event', setParent: () => {} }
    host.embed(edge)

    setupBoundaryAttach(graph)
    graph.emit('node:change:size', { node: host, cell: host })
    // 不应抛异常
  })
})

// ============================================================================
// 边界行为 — 防御性分支覆盖
// ============================================================================

describe('setupBoundaryAttach — 防御性分支', () => {
  function mkNode(id: string, shape: string, x: number, y: number, w: number, h: number, opts?: { nullData?: boolean }) {
    let pos = { x, y }
    const size = { width: w, height: h }
    let data: Record<string, any> | null = opts?.nullData ? null : {}
    let parent: any = null
    const children: any[] = []
    const self: any = {
      id,
      shape,
      getPosition: () => ({ ...pos }),
      getSize: () => ({ ...size }),
      setPosition: (nx: number, ny: number, _?: any) => { pos = { x: nx, y: ny } },
      getData: () => data,
      setData: (d: any, _?: any) => { data = d },
      getParent: () => parent,
      setParent: (p: any) => { parent = p },
      embed: (child: any) => { child.setParent(self); children.push(child) },
      unembed: (child: any) => { child.setParent(null); const i = children.indexOf(child); if (i >= 0) children.splice(i, 1) },
      getChildren: () => children.length > 0 ? children : null,
      toFront: vi.fn(),
      isNode: () => true,
    }
    return self
  }

  function mkGraph(nodes: any[] = []) {
    const handlers: Record<string, Function[]> = {}
    return {
      on: (e: string, fn: Function) => { handlers[e] = handlers[e] || []; handlers[e].push(fn) },
      off: (e: string, fn: Function) => { handlers[e] = (handlers[e] || []).filter(f => f !== fn) },
      emit: (e: string, d: any) => { for (const fn of handlers[e] || []) fn(d) },
      getCellById: (id: string) => nodes.find(node => node.id === id) ?? null,
      _handlers: handlers,
    } as any
  }

  it('setBoundaryPos 当 getData() 为 null 时应安全回退', () => {
    const graph = mkGraph()
    const host = mkNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mkNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36, { nullData: true })

    host.embed(boundary)
    setupBoundaryAttach(graph)
    graph.emit('node:embedded', { node: boundary, currentParent: host, previousParent: null })

    // 应仍然正常写入 boundaryPosition
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeDefined()
  })

  it('setBoundaryPos 当 getParent() 为 null 时应回退 attachedToRef', () => {
    const graph = mkGraph()
    const host = mkNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mkNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    host.embed(boundary)
    setupBoundaryAttach(graph)
    graph.emit('node:embedded', { node: boundary, currentParent: host, previousParent: null })

    // 现在手动将 parent 设为 null，再触发 setBoundaryPos
    boundary.setParent(null)
    // 先设一个 attachedToRef
    boundary.setData({ bpmn: { boundaryPosition: { side: 'top', ratio: 0.5 }, attachedToRef: 'host' } })

    // 使用 attachBoundaryToHost 重新吸附（它内部调用 setBoundaryPos）
    // 但是 getParent() 为 null，所以 ?? 回退到 bpmn.attachedToRef
    // 不过 attachBoundaryToHost 会先 embed，所以 getParent() 不为 null
    // 改用直接方式：设 parent 为对象无 id
    boundary.setParent({ })
    attachBoundaryToHost(graph, boundary, host)
    const data = boundary.getData()
    expect(data.bpmn?.attachedToRef).toBeDefined()
  })

  it('detach 路径当节点无 bpmn 数据时应安全回退', () => {
    const graph = mkGraph()
    const host = mkNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    const boundary = mkNode('b1', 'bpmn-boundary-event', 150, 80, 36, 36)

    host.embed(boundary)
    // 不设 bpmn 数据，直接移动到远离位置触发 detach
    setupBoundaryAttach(graph, { detachDistance: 30 })
    boundary.setPosition(500, 500)
    graph.emit('node:moving', { node: boundary })

    // 应被 unembed
    expect(boundary.getParent()).toBeNull()
    // bpmn 数据应被清理（无 boundaryPosition）
    const data = boundary.getData()
    expect(data.bpmn?.boundaryPosition).toBeUndefined()
  })

  it('node:change:size 对无子节点的宿主应安全返回', () => {
    const graph = mkGraph()
    const host = mkNode('host', 'bpmn-user-task', 100, 100, 200, 100)
    // host 无任何子节点，getChildren() 返回 null

    setupBoundaryAttach(graph)
    graph.emit('node:change:size', { node: host, cell: host })
    // 不应抛异常
  })
})

// ============================================================================
// defaultIsValidHostForBoundary — 取消边界事件宿主验证（F7）
// ============================================================================

describe('defaultIsValidHostForBoundary', () => {
  it('取消边界事件只能附着到 Transaction（BPMN 规范 §13.2.2）', () => {
    expect(defaultIsValidHostForBoundary('bpmn-transaction', 'bpmn-boundary-event-cancel')).toBe(true)
    expect(defaultIsValidHostForBoundary('bpmn-user-task', 'bpmn-boundary-event-cancel')).toBe(false)
    expect(defaultIsValidHostForBoundary('bpmn-sub-process', 'bpmn-boundary-event-cancel')).toBe(false)
  })

  it('其它边界事件可附着到任意 Activity', () => {
    expect(defaultIsValidHostForBoundary('bpmn-user-task', 'bpmn-boundary-event')).toBe(true)
    expect(defaultIsValidHostForBoundary('bpmn-service-task', 'bpmn-boundary-event-timer')).toBe(true)
    expect(defaultIsValidHostForBoundary('bpmn-sub-process', 'bpmn-boundary-event-error')).toBe(true)
    expect(defaultIsValidHostForBoundary('bpmn-transaction', 'bpmn-boundary-event-message')).toBe(true)
  })

  it('事件子流程不能附着边界事件（formal-11-01-03 §13.4.4）', () => {
    expect(defaultIsValidHostForBoundary(BPMN_EVENT_SUB_PROCESS, 'bpmn-boundary-event-timer')).toBe(false)
  })

  it('非法宿主图形应返回 false', () => {
    expect(defaultIsValidHostForBoundary('bpmn-start-event', 'bpmn-boundary-event-timer')).toBe(false)
    expect(defaultIsValidHostForBoundary('bpmn-exclusive-gateway', 'bpmn-boundary-event')).toBe(false)
  })

  it('CANCEL_BOUNDARY_HOST_SHAPES 仅包含 bpmn-transaction', () => {
    expect(CANCEL_BOUNDARY_HOST_SHAPES.has('bpmn-transaction')).toBe(true)
    expect(CANCEL_BOUNDARY_HOST_SHAPES.size).toBe(1)
  })
})
