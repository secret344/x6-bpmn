import { describe, expect, it, vi } from 'vitest'

import {
  autoWrapFirstPool,
  clampSwimlaneToContent,
  collectLanes,
  collectFirstPoolWrapTargets,
  computeAutoWrapPoolRect,
  computeLaneContentMinSize,
  computeLanesResize,
  computeLaneMinSize,
  computePoolContentRect,
  computePoolMinSize,
  computeResizeConstraints,
  computeRequiredSwimlaneRect,
  getLanesRoot,
  normalizeSwimlaneLayers,
} from '../../../src/behaviors/swimlane-layout'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

function createMockNode(
  id: string,
  shape: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    parent?: any
    children?: any[]
    data?: Record<string, unknown>
    withResize?: boolean
  } = {},
) {
  let position = { x, y }
  let size = { width, height }
  const children = options.children ?? []
  const data = options.data
  const node: any = {
    id,
    shape,
    zIndex: 0,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    getParent: () => options.parent ?? null,
    getChildren: () => children,
    getData: () => data,
    getZIndex: () => node.zIndex,
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    setZIndex: vi.fn((nextZIndex: number) => {
      node.zIndex = nextZIndex
    }),
    prop: vi.fn((path: string, value: unknown) => {
      if (path === 'zIndex') {
        node.zIndex = value
      }
    }),
    toFront: vi.fn(),
    isNode: () => true,
  }

  if (options.withResize !== false) {
    node.resize = vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    })
  }

  return node
}

describe('swimlane-layout helpers', () => {
  it('首个 Pool 自动包裹时只应收集顶层节点', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const embeddedTask = createMockNode('embedded-task', BPMN_USER_TASK, 60, 60, 100, 60, {
      parent: pool,
    })
    const graph = {
      getNodes: () => [pool, task, embeddedTask],
    } as any

    expect(collectFirstPoolWrapTargets(graph, pool).map((node) => node.id)).toEqual(['task'])
  })

  it('存在其他 Pool 时不应将节点视为首个 Pool 自动包裹目标', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const otherPool = createMockNode('pool-2', BPMN_POOL, 460, 0, 400, 240)
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const graph = {
      getNodes: () => [pool, otherPool, task],
    } as any

    expect(collectFirstPoolWrapTargets(graph, pool)).toEqual([])
  })

  it('读取图节点列表抛异常时应安全返回空目标集合', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const graph = {
      getNodes: () => {
        throw new Error('boom')
      },
    } as any

    expect(collectFirstPoolWrapTargets(graph, pool)).toEqual([])
  })

  it('读取父节点抛异常时，仍应把节点视作顶层节点', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    task.getParent = () => {
      throw new Error('boom')
    }
    const graph = {
      getNodes: () => [pool, task],
    } as any

    expect(collectFirstPoolWrapTargets(graph, pool).map((node) => node.id)).toEqual(['task'])
  })

  it('读取方向信息抛异常时应回退为水平泳池自动包裹', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 180, 120)
    pool.getData = () => {
      throw new Error('boom')
    }
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)

    expect(computeAutoWrapPoolRect(pool, [task])).toEqual({
      x: 134,
      y: 104,
      width: 172,
      height: 92,
    })
  })

  it('垂直 Pool 自动包裹时应把 header 计入上边距', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 180, 120, {
      data: { bpmn: { isHorizontal: false } },
    })
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)

    expect(computeAutoWrapPoolRect(pool, [task])).toEqual({
      x: 164,
      y: 74,
      width: 142,
      height: 122,
    })
  })

  it('自动包裹在无节点输入时应返回 null', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 180, 120)

    expect(computeAutoWrapPoolRect(pool, [])).toBeNull()
  })

  it('无内容子节点时不应生成最小内容边界', () => {
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 360, 120)

    expect(computeRequiredSwimlaneRect(lane)).toBeNull()
  })

  it('读取子节点抛异常时应安全返回空内容边界', () => {
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 360, 120)
    lane.getChildren = () => {
      throw new Error('boom')
    }

    expect(computeRequiredSwimlaneRect(lane)).toBeNull()
  })

  it('水平 Lane 的最小内容边界应把 header 计入左侧', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 360, 220, {
      children: [task],
    })

    expect(computeRequiredSwimlaneRect(lane)).toEqual({
      x: 150,
      y: 120,
      width: 140,
      height: 60,
    })
  })

  it('垂直 Lane 的最小内容边界应把 header 计入顶部', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 360, 220, {
      children: [task],
      data: { bpmn: { isHorizontal: false } },
    })

    expect(computeRequiredSwimlaneRect(lane)).toEqual({
      x: 180,
      y: 90,
      width: 110,
      height: 90,
    })
  })

  it('泳道最小内容边界应包含直属任务下挂的边界事件后代', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, 202, 82, 36, 36)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60, {
      children: [boundary],
    })
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120, {
      children: [task],
    })

    expect(computeRequiredSwimlaneRect(lane)).toEqual({
      x: 90,
      y: 70,
      width: 148,
      height: 60,
    })
  })

  it('非泳池泳道节点不应触发内容边界钳制', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)

    expect(clampSwimlaneToContent(task)).toBe(false)
    expect(task.setPosition).not.toHaveBeenCalled()
    expect(task.setSize).not.toHaveBeenCalled()
  })

  it('已包含全部内容的 Pool 不应重复调整尺寸', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const pool = createMockNode('pool', BPMN_POOL, 120, 80, 220, 140, {
      children: [task],
    })

    expect(clampSwimlaneToContent(pool)).toBe(false)
    expect(pool.resize).not.toHaveBeenCalled()
    expect(pool.setSize).not.toHaveBeenCalled()
  })

  it('无 resize 接口时应退化为 setSize 调整到最小内容边界', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const pool = createMockNode('pool', BPMN_POOL, 220, 160, 80, 40, {
      children: [task],
      withResize: false,
    })

    expect(clampSwimlaneToContent(pool)).toBe(true)
    expect(pool.setPosition).toHaveBeenLastCalledWith(150, 120, { bpmnLayout: true })
    expect(pool.setSize).toHaveBeenLastCalledWith(150, 80, { bpmnLayout: true })
  })

  it('无可包裹目标时应跳过首个 Pool 自动扩展', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 180, 120)
    const graph = {
      getNodes: () => [pool],
    } as any

    expect(autoWrapFirstPool(graph, pool)).toEqual([])
    expect(pool.setPosition).not.toHaveBeenCalled()
  })

  it('应按 Pool、Lane、普通节点、边界事件设置稳定 zIndex 分层', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, 200, 120, 36, 36)
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 360, 220)
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const graph = {
      getNodes: () => [task, boundary, lane, pool],
    } as any

    normalizeSwimlaneLayers(graph)

    expect(pool.getZIndex()).toBeLessThan(0)
    expect(lane.getZIndex()).toBeLessThan(0)
    expect(task.getZIndex()).toBeGreaterThan(0)
    expect(boundary.getZIndex()).toBeGreaterThan(task.getZIndex())
    expect(pool.getZIndex()).toBeLessThan(lane.getZIndex())
    expect(lane.getZIndex()).toBeLessThan(task.getZIndex())
  })

  it('缺少 setZIndex 时应退化为写入 zIndex 属性', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    delete pool.setZIndex
    const graph = {
      getNodes: () => [pool],
    } as any

    normalizeSwimlaneLayers(graph)

    expect(pool.prop).toHaveBeenCalledWith('zIndex', expect.any(Number), { silent: false })
    expect(pool.getZIndex()).toBeLessThan(0)
  })

  it('图层归一化遇到图节点读取异常时应保持静默', () => {
    const graph = {
      getNodes: () => {
        throw new Error('boom')
      },
    } as any

    expect(() => normalizeSwimlaneLayers(graph)).not.toThrow()
  })

  // ============================================================================
  // computePoolMinSize / computeLaneMinSize
  // ============================================================================

  it('Pool 包含 Task 时最小尺寸须涵盖 Task 包围盒', () => {
    // Pool(40,40,500,400) 含 Lane1(70,40,470,200)，Lane1 含 Task(140,70,100,60)
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 470, 200, {
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 240, 470, 200, {
      data: { bpmn: { isHorizontal: true } },
    })
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 400, {
      children: [lane1, lane2],
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computePoolMinSize(pool)
    // Task 右边界 = 140 + 100 = 240, 相对 Pool.x=40 → 200
    // HEADER_SIZE = 30, 所以 min width ≥ 200
    expect(min.width).toBeGreaterThanOrEqual(200)
    // Task 下边界 = 70 + 60 = 130, 相对 Pool.y=40 → 90
    // 2 个 Lane × MIN_LANE_SIZE(60) = 120 → min height ≥ 120
    expect(min.height).toBeGreaterThanOrEqual(120)
  })

  it('Pool 没有子节点时最小尺寸应为 HEADER_SIZE + MIN_LANE_SIZE', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 300, {
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computePoolMinSize(pool)
    // HEADER_SIZE=30, MIN_LANE_SIZE=60
    expect(min.width).toBeGreaterThanOrEqual(90)
    expect(min.height).toBeGreaterThanOrEqual(60)
  })

  it('Lane 无 Pool 父节点时最小尺寸仍基于自身内容', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 200, {
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computeLaneMinSize(lane)
    // 宽度仍受 Lane 基础最小宽度 300 约束
    expect(min.width).toBe(300)
    // 内容底部 = 70 + 60 = 130，相对 Lane.y=40 → 90
    expect(min.height).toBe(90)
  })

  it('Lane 最小高度只看自身内容，宽度跟随 Pool 内部子节点约束', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 400, {
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 200, {
      parent: pool,
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })
    pool.getChildren = () => [lane]

    const min = computeLaneMinSize(lane)
    // Pool 约束宽度为 170，但最终仍需满足 Lane 基础最小宽度 300
    expect(min.width).toBe(300)
    // Lane 内容底部 = 130，相对 Lane.y=40 → 90，只看自身
    expect(min.height).toBe(90)
  })

  it('Lane 最小高度不应被兄弟 Lane 串联，但宽度应受 Pool 内部最宽内容约束', () => {
    const lane1Task = createMockNode('task-1', BPMN_USER_TASK, 140, 70, 100, 60)
    const lane2Task = createMockNode('task-2', BPMN_USER_TASK, 140, 260, 300, 120)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 400, {
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 470, 180, {
      parent: pool,
      children: [lane1Task],
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 220, 470, 220, {
      parent: pool,
      children: [lane2Task],
      data: { bpmn: { isHorizontal: true } },
    })
    pool.getChildren = () => [lane1, lane2]

    const min1 = computeLaneMinSize(lane1)
    const min2 = computeLaneMinSize(lane2)

    // lane1 高度只看自身内容：70 + 60 - 40 = 90，不被 lane2 串联
    expect(min1.height).toBe(90)
    // lane 宽度受 Pool 内部最宽内容约束：440 - 40 - 30 = 370
    expect(min1.width).toBe(370)
    expect(min2.width).toBe(370)
  })

  it('Lane 顶边约束应同时受自身最小高度与当前层级相邻 Lane 约束', () => {
    const lane2Task = createMockNode('task-2', BPMN_USER_TASK, 200, 330, 100, 80)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 400)
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 370, 200, {
      parent: pool,
    })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 240, 370, 200, {
      parent: pool,
      children: [lane2Task],
    })
    pool.getChildren = () => [lane1, lane2]

    const constraints = computeResizeConstraints(lane2, 'n', true)

    expect(constraints.min.top).toBe(100)
    expect(constraints.max.top).toBe(380)
  })

  it('实时拖拽时即使当前节点位置临时越过兄弟泳道，顶边约束仍应按拖拽开始层级识别相邻 Lane', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 600)
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 370, 200, {
      parent: pool,
    })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 240, 370, 200, {
      parent: pool,
    })
    const lane3 = createMockNode('lane-3', BPMN_LANE, 70, 80, 370, 200, {
      parent: pool,
    })
    pool.getChildren = () => [lane1, lane2, lane3]

    const constraints = computeResizeConstraints(
      lane3,
      'n',
      true,
      { x: 70, y: 440, width: 370, height: 200 },
    )

    expect(constraints.min.top).toBe(300)
    expect(constraints.max.top).toBe(580)
  })

  it('中间 Lane 顶边向内拖拽不应被自身内容顶部额外限制', () => {
    const lane2Task = createMockNode('task-2', BPMN_USER_TASK, 200, 260, 100, 40)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 600)
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 370, 200, {
      parent: pool,
    })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 240, 370, 200, {
      parent: pool,
      children: [lane2Task],
    })
    const lane3 = createMockNode('lane-3', BPMN_LANE, 70, 440, 370, 200, {
      parent: pool,
    })
    pool.getChildren = () => [lane1, lane2, lane3]

    const constraints = computeResizeConstraints(lane2, 'n', true)

    expect(constraints.min.top).toBe(100)
    expect(constraints.max.top).toBe(380)
  })

  it('Lane 底边约束应同时受自身最小高度与当前层级相邻 Lane 约束', () => {
    const lane2Task = createMockNode('task-2', BPMN_USER_TASK, 200, 260, 100, 60)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 400)
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 370, 200, {
      parent: pool,
    })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 240, 370, 200, {
      parent: pool,
      children: [lane2Task],
    })
    pool.getChildren = () => [lane1, lane2]

    const constraints = computeResizeConstraints(lane1, 's', true)

    expect(constraints.min.bottom).toBe(100)
    expect(constraints.max.bottom).toBe(380)
  })

  it('贴着 Pool 外边界的 Lane 外侧边应改为驱动 Pool 边界，并受最小尺寸约束', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 220, {
      parent: pool,
    })
    pool.getChildren = () => [lane]

    const topConstraints = computeResizeConstraints(lane, 'n', true)
    const bottomConstraints = computeResizeConstraints(lane, 's', true)

    expect(topConstraints.min.top).toBeUndefined()
    expect(topConstraints.max.top).toBe(200)
    expect(bottomConstraints.min.bottom).toBe(100)
    expect(bottomConstraints.max.bottom).toBeUndefined()
  })

  it('Lane 左右边约束应取 Pool 内部子节点的整体边界', () => {
    const taskLeft = createMockNode('task-left', BPMN_USER_TASK, 100, 100, 60, 40)
    const taskRight = createMockNode('task-right', BPMN_USER_TASK, 360, 100, 40, 40)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 260)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 260, {
      parent: pool,
      children: [taskLeft, taskRight],
    })
    pool.getChildren = () => [lane]

    const leftConstraints = computeResizeConstraints(lane, 'w', true)
    const rightConstraints = computeResizeConstraints(lane, 'e', true)

    expect(leftConstraints.min.left).toBe(100)
    expect(rightConstraints.min.right).toBe(400)
  })

  it('空 Lane 最小尺寸不低于 MIN_LANE_SIZE', () => {
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 200, {
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computeLaneMinSize(lane)
    expect(min.width).toBeGreaterThanOrEqual(60)
    expect(min.height).toBeGreaterThanOrEqual(60)
  })

  it('Pool 含非 Lane 直接子节点时最小尺寸须涵盖该子节点', () => {
    // Pool has a Task directly (not inside a Lane)
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 400, {
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computePoolMinSize(pool)
    // Task 右边界 = 240, 相对 Pool.x=40 → 200
    expect(min.width).toBeGreaterThanOrEqual(200)
    // Task 下边界 = 130, 相对 Pool.y=40 → 90
    expect(min.height).toBeGreaterThanOrEqual(90)
  })

  it('应递归收集后代 Lane，并能解析到最外层的泳道根节点', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 400)
    const outerLane = createMockNode('outer-lane', BPMN_LANE, 70, 40, 470, 300, {
      parent: pool,
    })
    const innerLane = createMockNode('inner-lane', BPMN_LANE, 100, 80, 440, 120, {
      parent: outerLane,
    })
    outerLane.getChildren = () => [innerLane]
    pool.getChildren = () => [outerLane]

    expect(collectLanes(pool).map((lane) => lane.id)).toEqual(['inner-lane', 'outer-lane'])
    expect(getLanesRoot(innerLane).id).toBe('pool')
  })

  it('应递归计算 Pool 内部所有内容节点的包围盒', () => {
    const taskInLane = createMockNode('task-in-lane', BPMN_USER_TASK, 180, 120, 80, 60)
    const nestedTask = createMockNode('nested-task', BPMN_USER_TASK, 260, 260, 90, 70)
    const childLane = createMockNode('child-lane', BPMN_LANE, 100, 220, 360, 140, {
      children: [nestedTask],
    })
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 320, {
      children: [taskInLane, childLane],
    })
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 500, 360, {
      children: [lane],
    })

    expect(computePoolContentRect(pool)).toEqual({
      x: 180,
      y: 120,
      width: 170,
      height: 210,
    })
  })

  it('空垂直 Lane 的最小内容尺寸应回退到垂直泳道下限', () => {
    const lane = createMockNode('lane', BPMN_LANE, 40, 0, 120, 360, {
      data: { bpmn: { isHorizontal: false } },
    })

    const min = computeLaneContentMinSize(lane, false)

    expect(min.minWidth).toBeGreaterThan(0)
    expect(min.minHeight).toBeGreaterThan(0)
  })

  it('Lane 最小内容尺寸应包含直属任务下挂的边界事件后代', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, 420, 82, 36, 36)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60, {
      children: [boundary],
    })
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120, {
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })

    expect(computeLaneContentMinSize(lane)).toEqual({
      minWidth: 386,
      minHeight: 90,
    })
  })

  it('Pool 右侧 resize 约束应包含直属任务下挂的边界事件后代', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, 202, 82, 36, 36)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60, {
      children: [boundary],
    })
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220, {
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120, {
      parent: pool,
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })
    pool.getChildren = () => [lane]

    expect(computePoolContentRect(pool)).toEqual({
      x: 120,
      y: 70,
      width: 118,
      height: 60,
    })
    expect(computeResizeConstraints(lane, 'e', true).min.right).toBe(238)
  })

  it('balanced resize 应只调整当前层级的相邻 Lane', () => {
    const parent = createMockNode('pool', BPMN_POOL, 40, 40, 500, 360)
    const lane1 = createMockNode('lane-1', BPMN_LANE, 70, 40, 470, 100, { parent })
    const lane2 = createMockNode('lane-2', BPMN_LANE, 70, 140, 470, 100, { parent })
    const lane3 = createMockNode('lane-3', BPMN_LANE, 70, 240, 470, 100, { parent })
    parent.getChildren = () => [lane1, lane2, lane3]

    const adjustments = computeLanesResize(lane2, {
      x: 70,
      y: 120,
      width: 470,
      height: 160,
    })

    expect(adjustments).toEqual([
      {
        node: lane1,
        newBounds: { x: 70, y: 40, width: 470, height: 80 },
      },
      {
        node: lane3,
        newBounds: { x: 70, y: 280, width: 470, height: 60 },
      },
    ])
  })

  it('首个 Pool 自动包裹时应真正扩展到顶层节点包围盒', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 180, 120)
    const task = createMockNode('task', BPMN_USER_TASK, 180, 120, 110, 60)
    const graph = {
      getNodes: () => [pool, task],
    } as any

    const wrapped = autoWrapFirstPool(graph, pool)

    expect(wrapped.map((node) => node.id)).toEqual(['task'])
    expect(pool.setPosition).toHaveBeenLastCalledWith(134, 104, { bpmnLayout: true })
    expect(pool.resize).toHaveBeenLastCalledWith(172, 92, { bpmnLayout: true })
  })

  it('泳道内容越界时应扩展到所需内容边界', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 200, 180, 110, 60)
    const lane = createMockNode('lane', BPMN_LANE, 240, 220, 40, 30, {
      children: [task],
    })

    expect(clampSwimlaneToContent(lane)).toBe(true)
    expect(lane.setPosition).toHaveBeenLastCalledWith(170, 180, { bpmnLayout: true })
    expect(lane.resize).toHaveBeenLastCalledWith(140, 70, { bpmnLayout: true })
  })
})