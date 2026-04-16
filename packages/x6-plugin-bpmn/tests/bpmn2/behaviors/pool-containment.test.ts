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
import { BPMN_LANE, BPMN_POOL, BPMN_USER_TASK } from '../../../src/utils/constants'

registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

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

  it('应在缺少父泳道时跳过 clamp，并在 getNodes 异常时安全回退', () => {
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

  it('应在泳道父节点变化后同步普通流程节点父链，并忽略边界事件', () => {
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
      shape: 'bpmn-boundary-event-timer',
      isNode: () => true,
      getParent: () => task,
      getPosition: () => ({ x: 210, y: 180 }),
      getSize: () => ({ width: 36, height: 36 }),
    } as unknown as Node
    const graph = {
      getNodes: () => [pool, lane],
    } as unknown as Graph

    containmentTest.syncFlowNodeSwimlaneParent(graph, task)
    containmentTest.syncFlowNodeSwimlaneParent(graph, boundary)

    expect((pool.embed as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(task)
    expect((pool.embed as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
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
