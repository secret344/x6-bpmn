import { describe, expect, it, vi } from 'vitest'

import {
  autoWrapFirstPool,
  clampSwimlaneToContent,
  collectFirstPoolWrapTargets,
  computeAutoWrapPoolRect,
  computeLaneMinSize,
  computePoolMinSize,
  computeRequiredSwimlaneRect,
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

  it('Lane 无 Pool 父节点时最小尺寸始终为 MIN_LANE_SIZE', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 200, {
      children: [task],
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computeLaneMinSize(lane)
    // 无 Pool 父节点时退化为 MIN_LANE_SIZE
    expect(min.width).toBe(60)
    expect(min.height).toBe(60)
  })

  it('Lane 有 Pool 父节点时，Pool 边界方向受内容约束，内侧边仅 MIN_LANE_SIZE', () => {
    // 水平布局：宽度（Pool 边界方向）受 Pool 内容约束，高度（内侧边方向）仅 MIN_LANE_SIZE
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
    // Pool 内容右边界 = 240，相对 Pool.x=40 → 200，减去 HEADER_SIZE=30 → 170
    expect(min.width).toBeGreaterThanOrEqual(170)
    // 高度（内侧边方向）仅 MIN_LANE_SIZE
    expect(min.height).toBe(60)
  })

  it('垂直 Pool 中 Lane 的 Pool 边界方向（高度）受内容约束，宽度仅 MIN_LANE_SIZE', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 70, 100, 100, 60)
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 500, {
      data: { bpmn: { isHorizontal: false } },
    })
    const lane = createMockNode('lane', BPMN_LANE, 40, 70, 200, 470, {
      parent: pool,
      children: [task],
      data: { bpmn: { isHorizontal: false } },
    })
    pool.getChildren = () => [lane]

    const min = computeLaneMinSize(lane)
    // 宽度（内侧边方向）仅 MIN_LANE_SIZE
    expect(min.width).toBe(60)
    // 高度（Pool 边界方向）受 Pool 内容约束
    // Pool 内容底部 = 100 + 60 = 160，相对 Pool.y=40 → 120，减去 HEADER_SIZE=30 → 90
    expect(min.height).toBeGreaterThanOrEqual(90)
  })

  it('空 Lane 最小尺寸不低于 MIN_LANE_SIZE', () => {
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 470, 200, {
      data: { bpmn: { isHorizontal: true } },
    })

    const min = computeLaneMinSize(lane)
    expect(min.width).toBeGreaterThanOrEqual(60)
    expect(min.height).toBeGreaterThanOrEqual(60)
  })

  it('垂直 Pool 最小尺寸须覆盖垂直布局路径', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 140, 70, 100, 60)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 200, 370, {
      children: [task],
      data: { bpmn: { isHorizontal: false } },
    })
    const lane2 = createMockNode('lane2', BPMN_LANE, 270, 40, 200, 370, {
      data: { bpmn: { isHorizontal: false } },
    })
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 430, 400, {
      children: [lane1, lane2],
      data: { bpmn: { isHorizontal: false } },
    })

    const min = computePoolMinSize(pool)
    // 垂直布局 header 在顶部：laneMinWidth = 2 × 60 = 120
    expect(min.width).toBeGreaterThanOrEqual(120)
    // SWIMLANE_HEADER_SIZE + MIN_LANE_SIZE = 90
    expect(min.height).toBeGreaterThanOrEqual(90)
    // Task 右边界 = 240, 相对 Pool.x=40 → 200
    expect(min.width).toBeGreaterThanOrEqual(200)
  })

  it('垂直 Pool 无子节点时最小尺寸应取回退值', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 300, {
      data: { bpmn: { isHorizontal: false } },
    })

    const min = computePoolMinSize(pool)
    // 垂直布局：contentRect 为 null → width=MIN_LANE_SIZE, height=HEADER+MIN_LANE
    expect(min.width).toBeGreaterThanOrEqual(60)
    expect(min.height).toBeGreaterThanOrEqual(90)
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
})