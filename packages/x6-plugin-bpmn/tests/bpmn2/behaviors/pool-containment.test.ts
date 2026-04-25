import { describe, expect, it, vi } from 'vitest'
import type { Graph, Node } from '@antv/x6'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  emitGraphEvent,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  __test__ as containmentTest,
  setupPoolContainment,
  validatePoolContainment,
} from '../../../src/behaviors/pool-containment'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_TRANSACTION, BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

describe('setupPoolContainment', () => {
  it('不应对 Lane 的 node:moved 事件做交互期违规校验', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => []),
    } as unknown as Graph
    const onViolation = vi.fn()
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: vi.fn(() => null),
      isNode: vi.fn(() => true),
    } as unknown as Node

    const dispose = setupPoolContainment(graph, { onViolation })

    handlers['node:moved']({ node: lane })

    expect(onViolation).not.toHaveBeenCalled()
    dispose()
  })

  it('普通流程节点移动出 Lane 后应被直接钳回容器内', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 100,
      width: 120,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    const dispose = setupPoolContainment(graph)

    task.setPosition(900, 500)
    emitGraphEvent(graph, 'node:moved', { node: task })

    expect(task.getPosition()).toEqual({ x: 820, y: 380 })

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('Pool 移动与另一 Pool 重叠时应被钳回到合法位置', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const leftPool = {
      id: 'pool-left',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 260, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const rightPool = {
      id: 'pool-right',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 420, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [leftPool, rightPool]),
    } as unknown as Graph

    const dispose = setupPoolContainment(graph, { constrainToContainer: true })

    handlers['node:moved']({ node: leftPool })

    expect((leftPool.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(219, 40, {
      bpmnContainmentSync: true,
      silent: true,
    })

    dispose()
  })

  it('带同步标记或泳道节点的 move/resize 事件应被忽略', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => []),
    } as unknown as Graph
    const onViolation = vi.fn()
    const swimlane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: vi.fn(() => null),
      isNode: vi.fn(() => true),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getParent: vi.fn(() => null),
      isNode: vi.fn(() => true),
      getPosition: vi.fn(() => ({ x: 100, y: 100 })),
      getSize: vi.fn(() => ({ width: 100, height: 60 })),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node

    const dispose = setupPoolContainment(graph, { onViolation })

    handlers['node:moved']({ node: task, options: { bpmnContainmentSync: true } })
    handlers['node:moved']({ node: swimlane, options: {} })
    handlers['node:resized']({ node: task, options: { bpmnContainmentSync: true } })
    handlers['node:resized']({ node: swimlane, options: {} })

    expect(onViolation).not.toHaveBeenCalled()
    expect((task as unknown as { setPosition: ReturnType<typeof vi.fn> }).setPosition).not.toHaveBeenCalled()
    expect((task as unknown as { setSize: ReturnType<typeof vi.fn> }).setSize).not.toHaveBeenCalled()

    dispose()
  })

  it('新增普通节点时应在 constrainToContainer 打开时立即执行位置与尺寸钳制', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 240 }),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 240 }),
      embed: vi.fn(),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 460, y: 260 }),
      getSize: () => ({ width: 120, height: 80 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [pool, lane, task]),
    } as unknown as Graph

    const dispose = setupPoolContainment(graph, { constrainToContainer: true })

    handlers['node:added']({ node: task })

    expect((task.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((task.setSize as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()

    dispose()
  })

  it('开启 constrainToContainer 时 resize 应钳制普通节点，删除非 Lane 应忽略', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 240 }),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 240 }),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 460, y: 260 }),
      getSize: () => ({ width: 120, height: 80 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [pool, lane, task]),
    } as unknown as Graph

    const dispose = setupPoolContainment(graph, { constrainToContainer: true })

    handlers['node:resized']({ node: task })
    handlers['node:removed']({ node: task })

    expect((task.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((task.setSize as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()

    dispose()
  })

  it('关闭 move/resize clamp 或缺少祖先 Pool 时应跳过对应分支', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const detachedLane = {
      id: 'lane-detached',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 200, height: 120 }),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 120, y: 100 }),
      getSize: () => ({ width: 100, height: 60 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [task, detachedLane]),
    } as unknown as Graph

    const dispose = setupPoolContainment(graph, { clampOnMove: false, clampOnResize: false, constrainToContainer: false })

    handlers['node:added']({ node: detachedLane })
    handlers['node:added']({ node: task })

    expect((task.setPosition as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect((task.setSize as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()

    dispose()
  })

  it('普通流程节点移入 Pool 空白区后应在 Pool 与 Lane 之间切换父链', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 420,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 390,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 70,
      width: 100,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    const dispose = setupPoolContainment(graph)

    task.setPosition(220, 190)
    emitGraphEvent(graph, 'node:moved', { node: task })
    expect(task.getParent()?.id).toBe(pool.id)

    task.setPosition(120, 70)
    emitGraphEvent(graph, 'node:moved', { node: task })
    expect(task.getParent()?.id).toBe(lane.id)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('Lane 处于选中交互态时不应重挂其内部流程节点', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 420, height: 260 }),
    } as unknown as Node
    const lane1 = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 390, height: 120 }),
    } as unknown as Node
    const lane2 = {
      id: 'lane-2',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 160 }),
      getSize: () => ({ width: 390, height: 140 }),
      embed: vi.fn(),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane2,
      getPosition: () => ({ x: 120, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node
    const graph = {
      getSelectedCells: () => [lane2],
      getNodes: () => [pool, lane1, lane2, task],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, task)

    expect(containmentTest.shouldSkipFlowNodeParentSyncDuringLaneInteraction(graph, task)).toBe(true)
    expect((lane2 as unknown as { embed: ReturnType<typeof vi.fn> }).embed).not.toHaveBeenCalled()
  })

  it('当前 Lane 仍合法包含节点时，不应被更小的重叠 Lane 抢挂', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 420, height: 260 }),
    } as unknown as Node
    const lane1 = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 120 }),
      embed: vi.fn(),
    } as unknown as Node
    const lane2 = {
      id: 'lane-2',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 220 }),
      embed: vi.fn(),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane2,
      getPosition: () => ({ x: 180, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node
    const graph = {
      getSelectedCells: () => [],
      getNodes: () => [pool, lane1, lane2, task],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, task)

    expect((lane1 as unknown as { embed: ReturnType<typeof vi.fn> }).embed).not.toHaveBeenCalled()
    expect((lane2 as unknown as { embed: ReturnType<typeof vi.fn> }).embed).not.toHaveBeenCalled()
  })

  it('事务跨 Lane 联动内部节点时，不应把内部节点重挂到目标 Lane', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 600,
      height: 320,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 570,
      height: 140,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 180,
      width: 570,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const transaction = graph.addNode({
      id: 'transaction-1',
      shape: BPMN_TRANSACTION,
      x: 120,
      y: 70,
      width: 240,
      height: 90,
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 90,
      width: 100,
      height: 50,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane1.embed(transaction)
    transaction.embed(task)

    transaction.setPosition(120, 210)
    task.setPosition(150, 230)

    expect(containmentTest.resolveFlowNodeClampRect(task)).toBeNull()
    containmentTest.syncFlowNodeSwimlaneParent(graph, task)

    expect(task.getParent()?.id).toBe(transaction.id)
    expect((lane2.getChildren() ?? []).map((child) => child.id)).not.toContain(task.id)

    destroyBehaviorTestGraph(graph)
  })

  it('事务内部节点 resize 跨 Lane 时，不应通过 resize 事件改挂到目标 Lane', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 600,
      height: 320,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 570,
      height: 140,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 180,
      width: 570,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const transaction = graph.addNode({
      id: 'transaction-1',
      shape: BPMN_TRANSACTION,
      x: 120,
      y: 70,
      width: 260,
      height: 210,
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 95,
      width: 100,
      height: 150,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane1.embed(transaction)
    transaction.embed(task)

    const dispose = setupPoolContainment(graph)

    task.setSize(100, 170)
    emitGraphEvent(graph, 'node:resized', { node: task })

    expect(task.getParent()?.id).toBe(transaction.id)
    expect((lane2.getChildren() ?? []).map((child) => child.id)).not.toContain(task.id)

    dispose()
    destroyBehaviorTestGraph(graph)
  })
})

describe('validatePoolContainment', () => {
  it('不存在 Pool 时，顶层普通流程节点应视为合法', () => {
    const graph = {
      getNodes: () => [],
    } as unknown as Graph
    const task = {
      shape: BPMN_USER_TASK,
      getParent: () => null,
      getPosition: () => ({ x: 120, y: 100 }),
      getSize: () => ({ width: 120, height: 60 }),
    } as unknown as Node

    expect(validatePoolContainment(graph, task)).toEqual({ valid: true })
  })

  it('Pool 与 Lane 形状应分别走各自的静态校验入口', () => {
    const graph = {
      getNodes: () => [],
    } as unknown as Graph
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 300, height: 200 }),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => ({
        isNode: () => true,
        shape: BPMN_POOL,
        getPosition: () => ({ x: 40, y: 40 }),
        getSize: () => ({ width: 300, height: 200 }),
      }),
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 270, height: 200 }),
    } as unknown as Node

    expect(validatePoolContainment(graph, pool)).toEqual({ valid: true })
    expect(validatePoolContainment(graph, lane)).toEqual({ valid: true })
  })

  it('存在 Pool 时，未处于任何泳道容器内的流程节点应判为非法', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 980,
      y: 500,
      width: 120,
      height: 60,
    })

    const result = validatePoolContainment(graph, task)

    expect(pool.id).toBe('pool-1')
    expect(result).toEqual({ valid: false, reason: '流程节点未处于 Pool 或 Lane 容器内' })

    destroyBehaviorTestGraph(graph)
  })

  it('Lane 校验应拒绝非 Pool 父节点和超出内容区的几何', () => {
    const nonPoolParent = {
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getPosition: () => ({ x: 0, y: 0 }),
      getSize: () => ({ width: 100, height: 100 }),
    } as unknown as Node
    const laneWithoutPool = {
      shape: BPMN_LANE,
      getParent: () => nonPoolParent,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 100 }),
    } as unknown as Node
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 200, height: 120 }),
    } as unknown as Node
    const overflowingLane = {
      shape: BPMN_LANE,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 300, height: 120 }),
    } as unknown as Node

    expect(containmentTest.validateLaneBounds(laneWithoutPool)).toEqual({
      valid: false,
      reason: 'Lane 必须直接属于 Pool',
    })
    expect(containmentTest.validateLaneBounds(overflowingLane)).toEqual({
      valid: false,
      reason: 'Lane 超出 Pool 内容区边界',
    })
  })

  it('Pool 校验应拒绝重叠的 Pool', () => {
    const graph = {
      getNodes: () => [
        {
          id: 'pool-2',
          shape: BPMN_POOL,
          getPosition: () => ({ x: 100, y: 100 }),
          getSize: () => ({ width: 240, height: 180 }),
        },
      ],
    } as unknown as Graph
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 240, height: 180 }),
    } as unknown as Node

    expect(containmentTest.validatePoolBounds(graph, pool)).toEqual({
      valid: false,
      reason: '当前实现中，Pool 之间不支持重叠或嵌套',
    })
  })

  it('矩形与钳制辅助函数应返回精确容器边界', () => {
    const node = {
      getPosition: () => ({ x: 320, y: 260 }),
      getSize: () => ({ width: 180, height: 120 }),
    } as unknown as Node

    expect(containmentTest.rectContains(
      { x: 70, y: 40, width: 370, height: 300 },
      { x: 100, y: 80, width: 120, height: 60 },
    )).toBe(true)
    expect(containmentTest.rectsOverlap(
      { x: 40, y: 40, width: 100, height: 100 },
      { x: 80, y: 80, width: 120, height: 120 },
    )).toBe(true)
    expect(containmentTest.clampNodeToContainer(node, { x: 70, y: 40, width: 370, height: 300 })).toEqual({
      x: 260,
      y: 220,
    })
    expect(containmentTest.clampNodeBoundsToContainer(node, { x: 70, y: 40, width: 260, height: 180 })).toEqual({
      x: 150,
      y: 100,
      width: 180,
      height: 120,
    })
  })

  it('reconcilePoolGeometry 应扩展 Pool 到最小内容尺寸并收敛泳道布局', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 120,
      height: 80,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 90,
      height: 80,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 220,
      y: 120,
      width: 120,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    containmentTest.reconcilePoolGeometry(graph, pool, new Set())

    expect(pool.getSize().width).toBeGreaterThanOrEqual(300)
    expect(pool.getSize().height).toBeGreaterThanOrEqual(140)

    destroyBehaviorTestGraph(graph)
  })

  it('应在 added, removed 与 resize 生命周期中收敛 Pool 几何并包裹首个 Pool', () => {
    const graph = createBehaviorTestGraph()
    const topLevelTask = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 280,
      y: 160,
      width: 120,
      height: 60,
    })
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 180,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 150,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane)

    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, { onViolation, constrainToContainer: false })

    emitGraphEvent(graph, 'node:added', { node: pool })
    expect(topLevelTask.getParent()?.id).toBe(pool.id)

    emitGraphEvent(graph, 'node:added', { node: lane })
    topLevelTask.setPosition(1000, 1000)
    emitGraphEvent(graph, 'node:change:size', { node: topLevelTask, options: { silent: true } })
    emitGraphEvent(graph, 'node:resized', { node: topLevelTask })
    emitGraphEvent(graph, 'node:removed', { node: lane })

    expect(onViolation).toHaveBeenCalled()

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('删除 Lane 后的 removed 生命周期不应覆盖既有高度分配结果', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 900, height: 525 }),
      resize: vi.fn(),
      setSize: vi.fn(),
      isNode: () => true,
    } as unknown as Node
    const remainingLane = {
      id: 'lane-2',
      shape: BPMN_LANE,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 870, height: 400 }),
      setPosition: vi.fn(),
      resize: vi.fn(),
      setSize: vi.fn(),
      isNode: () => true,
    } as unknown as Node
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane]),
    } as unknown as Graph
    const deletedLane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
    } as unknown as Node

    const dispose = setupPoolContainment(graph)

    handlers['node:removed']({ node: deletedLane })

    expect((remainingLane.resize as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect((remainingLane.setSize as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    dispose()
  })
})

describe('pool containment helpers', () => {
  it('应暴露父泳道查找、Pool 查找与容器矩形辅助函数', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 300 }),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 300 }),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 120, y: 100 }),
      getSize: () => ({ width: 120, height: 60 }),
    } as unknown as Node

    expect(containmentTest.hasPoolNodes({ getNodes: () => [task, pool] } as unknown as Graph)).toBe(true)
    expect(containmentTest.findSwimlaneParent(task)).toBe(lane)
    expect(containmentTest.findAncestorPool(task)).toBe(pool)
    expect(containmentTest.getContainmentRect(pool)).toEqual({
      x: 70,
      y: 40,
      width: 370,
      height: 300,
    })
    expect(containmentTest.getContainmentRect(lane)).toEqual({
      x: 70,
      y: 40,
      width: 370,
      height: 300,
    })
  })

  it('应在缺少父泳道时跳过普通节点 clamp，并在 getNodes 异常时安全回退', () => {
    const freeTask = {
      shape: BPMN_USER_TASK,
      getParent: () => null,
      getPosition: () => ({ x: 500, y: 500 }),
      getSize: () => ({ width: 120, height: 60 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node

    containmentTest.clampFlowNodePosition(freeTask)
    containmentTest.clampFlowNodeBounds(freeTask)

    expect((freeTask as any).setPosition).not.toHaveBeenCalled()
    expect((freeTask as any).setSize).not.toHaveBeenCalled()
    expect(containmentTest.safeGetNodes({ getNodes: () => { throw new Error('boom') } } as unknown as Graph)).toEqual([])
    expect(containmentTest.hasPoolNodes({ getNodes: () => { throw new Error('boom') } } as unknown as Graph)).toBe(false)
  })

  it('Lane 缺少父节点时应视为非法，Pool 几何重入时应直接返回', () => {
    const detachedLane = {
      shape: BPMN_LANE,
      getParent: () => null,
    } as unknown as Node
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 240 }),
      resize: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node

    expect(containmentTest.validateLaneBounds(detachedLane)).toEqual({
      valid: false,
      reason: 'Lane 必须直接属于 Pool',
    })

    containmentTest.reconcilePoolGeometry({ getNodes: () => [] } as unknown as Graph, pool, new Set(['pool-1']))

    expect((pool.resize as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect((pool.setSize as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('图中不存在 Pool 时顶层普通节点应被视为合法', () => {
    const task = {
      shape: BPMN_USER_TASK,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 100, y: 100 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node

    expect(containmentTest.validatePoolBounds({ getNodes: () => [task] } as unknown as Graph, task)).toEqual({ valid: true })
  })

  it('Pool 无重叠时不应钳制位置，存在嵌套后代时应整体平移', () => {
    const nestedTask = {
      id: 'nested-task',
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 120, y: 120 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      isNode: () => true,
      getChildren: () => [nestedTask],
      getPosition: () => ({ x: 70, y: 70 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const annotation = {
      id: 'annotation-1',
      isNode: () => false,
    } as any
    const task = {
      id: 'task-1',
      isNode: () => true,
      getChildren: () => [annotation],
      getPosition: () => ({ x: 90, y: 90 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [lane, task, annotation],
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const farPool = {
      id: 'pool-2',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 400, y: 400 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node
    const overlappingPool = {
      id: 'pool-3',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 40, y: 150 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node

    const noOverlapGraph = { getNodes: () => [pool, farPool, task] } as unknown as Graph
    expect(containmentTest.resolveClampedPoolPosition(noOverlapGraph, pool)).toBeNull()
    containmentTest.clampPoolPosition(noOverlapGraph, pool)
    expect((pool.setPosition as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()

    const clampedGraph = { getNodes: () => [pool, overlappingPool] } as unknown as Graph
    containmentTest.clampPoolPosition(clampedGraph, pool)

    expect((pool.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(40, -11, {
      silent: true,
      bpmnContainmentSync: true,
    })
    expect((lane.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(70, 19, {
      silent: true,
      bpmnContainmentSync: true,
    })
    expect((task.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(90, 39, {
      silent: true,
      bpmnContainmentSync: true,
    })
    expect((nestedTask.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(120, 69, {
      silent: true,
      bpmnContainmentSync: true,
    })
    expect(containmentTest.collectDescendantNodes(pool).map((node) => node.id)).toEqual([
      'lane-1',
      'task-1',
      'nested-task',
    ])
  })

  it('Pool 双侧重叠回到原位时不应平移后代，并应覆盖右移与下移求解', () => {
    const leafTask = {
      id: 'leaf-task',
      isNode: () => true,
      getPosition: () => ({ x: 90, y: 90 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const pool = {
      id: 'pool-main',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [leafTask],
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
      setPosition: vi.fn(),
    } as unknown as Node
    const leftOverlapPool = {
      id: 'pool-left',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: -100, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node
    const rightOverlapPool = {
      id: 'pool-right',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 241, y: 40 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node
    const topOverlapPool = {
      id: 'pool-top',
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 40, y: -100 }),
      getSize: () => ({ width: 200, height: 160 }),
    } as unknown as Node

    expect(containmentTest.resolveClampedPoolPosition(
      { getNodes: () => [pool, leftOverlapPool] } as unknown as Graph,
      pool,
    )).toEqual({ x: 101, y: 40 })
    expect(containmentTest.resolveClampedPoolPosition(
      { getNodes: () => [pool, topOverlapPool] } as unknown as Graph,
      pool,
    )).toEqual({ x: 40, y: 61 })

    containmentTest.clampPoolPosition(
      { getNodes: () => [pool, leftOverlapPool, rightOverlapPool] } as unknown as Graph,
      pool,
    )

    expect((pool.setPosition as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect((leafTask.setPosition as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect(containmentTest.collectDescendantNodes(pool).map((node) => node.id)).toEqual(['leaf-task'])
  })

  it('containment 违规、后代选区跳过与 addChild 重挂应命中对应分支', () => {
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 200, height: 120 }),
    } as unknown as Node
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 230, height: 120 }),
      getChildren: () => [lane],
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 240, y: 120 }),
      getSize: () => ({ width: 80, height: 60 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node
    const onViolation = vi.fn()

    containmentTest.reportContainmentViolation({ getNodes: () => [pool, lane, task] } as unknown as Graph, task, onViolation)
    containmentTest.clampFlowNodeBounds(task)
    containmentTest.reportContainmentViolation({ getNodes: () => [pool, lane, task] } as unknown as Graph, {
      ...task,
      getPosition: () => ({ x: 260, y: 150 }),
      getSize: () => ({ width: 120, height: 90 }),
    } as unknown as Node)

    expect(onViolation).toHaveBeenCalled()
    expect((task.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((task.setSize as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()

    const alreadyInside = {
      ...task,
      getPosition: () => ({ x: 120, y: 100 }),
      getSize: () => ({ width: 80, height: 40 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
    } as unknown as Node
    containmentTest.clampFlowNodeBounds(alreadyInside)
    expect((alreadyInside.setPosition as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()

    const selectedLane = {
      id: 'selected-lane',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
    } as unknown as Node
    const descendantTask = {
      id: 'descendant',
      shape: BPMN_USER_TASK,
      getParent: () => selectedLane,
    } as unknown as Node
    expect(containmentTest.shouldSkipFlowNodeParentSyncDuringLaneInteraction({ getSelectedCells: () => [selectedLane] } as unknown as Graph, descendantTask)).toBe(true)
    expect(containmentTest.shouldSkipFlowNodeParentSyncDuringLaneInteraction({ getSelectedCells: () => [selectedLane] } as unknown as Graph, task)).toBe(false)

    const staleParent = { id: 'stale', isNode: () => true, unembed: vi.fn() }
    const addChild = vi.fn()
    const reparentTarget = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      getParent: () => staleParent,
    } as unknown as Node
    const nextParent = { id: 'lane-2', addChild, isNode: () => true } as unknown as Node
    containmentTest.reparentFlowNode(reparentTarget, nextParent)
    expect(staleParent.unembed).toHaveBeenCalledWith(reparentTarget)
    expect(addChild).toHaveBeenCalledWith(reparentTarget)

    containmentTest.reparentFlowNode(reparentTarget, { id: 'lane-3', isNode: () => true } as unknown as Node)
  })

  it('ensurePoolMinSize 在缺少 resize 时应仅回退为 setSize', () => {
    const task = {
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getPosition: () => ({ x: 220, y: 180 }),
      getSize: () => ({ width: 120, height: 80 }),
      getChildren: () => [],
    }
    const pool = {
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 120, height: 80 }),
      setSize: vi.fn(),
      getChildren: () => [task],
      isNode: () => true,
    } as unknown as Node

    containmentTest.ensurePoolMinSize(pool)

    expect((pool.setSize as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })

  it('重挂普通流程节点时应支持 addChild 回退并吞掉中间态异常', () => {
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getParent: () => null,
      getPosition: () => ({ x: 0, y: 0 }),
      getSize: () => ({ width: 100, height: 60 }),
      __setParent: vi.fn(),
    } as unknown as Node
    const parentWithAddChild = {
      id: 'lane-1',
      shape: BPMN_LANE,
      addChild: vi.fn((child: typeof task & { __setParent?: (parent: unknown) => void }) => {
        child.__setParent?.(parentWithAddChild)
      }),
    } as unknown as Node

    containmentTest.reparentFlowNode(task, parentWithAddChild)

    expect((parentWithAddChild as unknown as { addChild: ReturnType<typeof vi.fn> }).addChild).toHaveBeenCalledWith(task)
    expect((task as unknown as { __setParent: ReturnType<typeof vi.fn> }).__setParent).toHaveBeenCalledWith(parentWithAddChild)

    const taskWithParent = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      getParent: () => ({
        id: 'lane-old',
        isNode: () => true,
        unembed: () => {
          throw new Error('transient cleanup error')
        },
      }),
      getPosition: () => ({ x: 0, y: 0 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node

    expect(() => containmentTest.reparentFlowNode(taskWithParent, parentWithAddChild)).not.toThrow()
  })

  it('后代判定和无变化钳制应走到 while 迭代与 null 返回分支', () => {
    const ancestor = {
      id: 'lane-root',
      getParent: () => null,
    }
    const middle = {
      id: 'task-middle',
      getParent: () => ancestor,
    }
    const node = {
      id: 'task-leaf',
      getParent: () => middle,
      getPosition: () => ({ x: 120, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node

    expect(containmentTest.isNodeDescendantOf(node, ancestor as unknown as Node)).toBe(true)
    expect(containmentTest.clampNodeBoundsToContainer(node, { x: 100, y: 60, width: 200, height: 120 })).toBeNull()
  })

  it('父链同步应覆盖无目标父节点、非节点选区、非泳道选区与非后代分支', () => {
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 120 }),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 500, y: 500 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node
    const graph = {
      getNodes: () => [task],
      getSelectedCells: () => [
        { isNode: () => false },
        { isNode: () => true, shape: BPMN_USER_TASK, id: 'task-2', getParent: () => null },
      ],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, task)

    expect(containmentTest.shouldSkipFlowNodeParentSyncDuringLaneInteraction(graph, task)).toBe(false)
    expect(containmentTest.isNodeDescendantOf(task, lane)).toBe(false)
  })

  it('脱离宿主后的边界事件重新挂到 Lane 后，越出 Lane 时应按 Pool 内容区钳制', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 420,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 390,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const boundary = graph.addNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 390,
      y: 190,
      width: 36,
      height: 36,
      data: { bpmn: {} },
    })
    pool.embed(lane)
    lane.embed(boundary)

    const dispose = setupPoolContainment(graph)

    boundary.setPosition(430, 290)
    emitGraphEvent(graph, 'node:moved', { node: boundary })

    expect(boundary.getParent()?.id).toBe(pool.id)
    expect(boundary.getPosition()).toEqual({ x: 424, y: 264 })

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('容器钳制写回位置与尺寸时应使用静默更新，避免重复触发 position 事件', () => {
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 390, height: 120 }),
    } as unknown as Node
    const node = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 430, y: 290 }),
      getSize: () => ({ width: 36, height: 36 }),
      setPosition: vi.fn(),
      setSize: vi.fn(),
      getData: () => ({ bpmn: {} }),
    } as unknown as Node

    containmentTest.clampFlowNodePosition(node)
    containmentTest.clampFlowNodeBounds(node)

    expect((node.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenNthCalledWith(
      1,
      424,
      124,
      expect.objectContaining({ silent: true, bpmnContainmentSync: true }),
    )
    expect((node.setPosition as unknown as ReturnType<typeof vi.fn>)).toHaveBeenNthCalledWith(
      2,
      424,
      124,
      expect.objectContaining({ silent: true, bpmnContainmentSync: true }),
    )
    expect((node.setSize as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      36,
      36,
      expect.objectContaining({ silent: true, bpmnContainmentSync: true }),
    )
  })

  it('应在泳道父节点变化后同步普通流程节点父链，并仅跳过仍附着宿主的边界事件', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 420, height: 260 }),
      embed: vi.fn(),
    } as unknown as Node
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 390, height: 120 }),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 220, y: 190 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node
    const boundary = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 210, y: 180 }),
      getSize: () => ({ width: 36, height: 36 }),
      getData: () => ({ bpmn: {} }),
    } as unknown as Node
    const graph = {
      getNodes: () => [pool, lane, boundary],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, task)
    containmentTest.syncFlowNodeSwimlaneParent(graph, boundary)

    expect((pool.embed as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(task)
    expect((pool.embed as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(boundary)
    expect((pool.embed as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)
  })

  it('仍附着宿主的边界事件不应被重挂到泳道父链', () => {
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: () => true,
      getParent: () => null,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 390, height: 120 }),
      embed: vi.fn(),
    } as unknown as Node
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: () => true,
      getParent: () => lane,
      getPosition: () => ({ x: 180, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    } as unknown as Node
    const boundary = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      isNode: () => true,
      getParent: () => task,
      getPosition: () => ({ x: 210, y: 70 }),
      getSize: () => ({ width: 36, height: 36 }),
      getData: () => ({ bpmn: { attachedToRef: task.id } }),
    } as unknown as Node
    const graph = {
      getSelectedCells: () => [],
      getNodes: () => [lane],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, boundary)

    expect(containmentTest.hasAttachedBoundaryHost(boundary)).toBe(true)
    expect((lane.embed as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('应只在普通流程节点违规时触发违规回调', () => {
    const graph = createBehaviorTestGraph()
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 460,
      y: 100,
      width: 120,
      height: 60,
    })
    pool.embed(lane)

    const onViolation = vi.fn()

    containmentTest.reportContainmentViolation(graph, lane, onViolation)
    containmentTest.reportContainmentViolation(graph, task, onViolation)

    expect(onViolation).toHaveBeenCalledTimes(1)
    expect(onViolation).toHaveBeenCalledWith(task, '流程节点未处于 Pool 或 Lane 容器内')

    destroyBehaviorTestGraph(graph)
  })
})
