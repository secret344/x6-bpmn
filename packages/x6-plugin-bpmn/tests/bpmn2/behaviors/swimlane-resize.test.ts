import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Graph, Node } from '@antv/x6'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  emitGraphEvent,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  patchTransformResizing,
  restoreTransformResizing,
  setupSwimlaneResize,
} from '../../../src/behaviors/swimlane-resize'
import { BPMN_LANE, BPMN_POOL, BPMN_USER_TASK } from '../../../src/utils/constants'

registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

const graphsToDispose: Graph[] = []

function trackGraph<T extends Graph>(graph: T): T {
  graphsToDispose.push(graph)
  return graph
}

function getPreviewElement(graph: Graph, nodeId: string): HTMLDivElement | null {
  return (graph as unknown as { container?: HTMLElement }).container?.querySelector(
    `[data-bpmn-swimlane-resize-preview="true"][data-node-id="${nodeId}"]`,
  ) as HTMLDivElement | null
}

function invokePreviewResize(
  node: Node,
  width: number,
  height: number,
  direction: string,
): void {
  ;(node as unknown as { resize: (nextWidth: number, nextHeight: number, options?: object) => void }).resize(
    width,
    height,
    { direction, relativeDirection: direction },
  )
}

function invokePreviewResizeWithoutDirection(
  node: Node,
  width: number,
  height: number,
): void {
  ;(node as unknown as { resize: (nextWidth: number, nextHeight: number, options?: object) => void }).resize(
    width,
    height,
    {},
  )
}

afterEach(() => {
  while (graphsToDispose.length > 0) {
    destroyBehaviorTestGraph(graphsToDispose.pop() as Graph)
  }
})

describe('setupSwimlaneResize', () => {
  it('应只监听 node:resize 与 node:resized', () => {
    const graph = {
      on: vi.fn(),
      off: vi.fn(),
      getPlugin: vi.fn(() => ({ options: { resizing: { enabled: true } } })),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    expect(graph.on).toHaveBeenCalledWith('node:resize', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:resized', expect.any(Function))
    expect(graph.on).toHaveBeenCalledTimes(2)

    dispose()
  })

  it('patchTransformResizing 应注入泳道最小尺寸并在 restore 后恢复原值', () => {
    const transform = {
      options: {
        resizing: {
          enabled: true,
          minWidth: 12,
          minHeight: 24,
        },
      },
    }
    const graph = {
      getPlugin: vi.fn(() => transform),
    } as unknown as Graph

    const saved = patchTransformResizing(graph)

    expect(typeof transform.options.resizing.minWidth).toBe('function')
    expect(typeof transform.options.resizing.minHeight).toBe('function')

    restoreTransformResizing(graph, saved)

    expect(transform.options.resizing.minWidth).toBe(12)
    expect(transform.options.resizing.minHeight).toBe(24)
  })

  it('在无 container 且读取 children 异常时，ghost preview 应安全降级', () => {
    const handlers: Record<string, (args: { node: Node; options?: object }) => void> = {}
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: Node; options?: object }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => ({ options: { resizing: { enabled: true } } })),
    } as unknown as Graph

    let width = 200
    let height = 120
    const pool = {
      id: 'pool-safe-fallback',
      shape: BPMN_POOL,
      getPosition: vi.fn(() => ({ x: 40, y: 40 })),
      getSize: vi.fn(() => ({ width, height })),
      getChildren: vi.fn(() => {
        throw new Error('children unavailable')
      }),
      resize: vi.fn((nextWidth: number, nextHeight: number) => {
        width = nextWidth
        height = nextHeight
        return pool
      }),
    } as unknown as Node

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: pool })

    expect(() => invokePreviewResize(pool, 180, 100, 'right')).not.toThrow()
    expect(width).toBe(200)
    expect(height).toBe(120)

    dispose()
  })

  it('非泳道节点开始 resize 时不应创建 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 80,
      y: 80,
      width: 120,
      height: 60,
    })

    const dispose = setupSwimlaneResize(graph)
    emitGraphEvent(graph, 'node:resize', { node: task })

    expect(getPreviewElement(graph, task.id)).toBeNull()

    dispose()
  })

  it('Pool 顶边拖拽应只更新 preview，mouseup 后再一次提交真实几何', () => {
    const graph = trackGraph(createBehaviorTestGraph())
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
      x: 200,
      y: 100,
      width: 100,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    const onSwimlaneResized = vi.fn()
    const dispose = setupSwimlaneResize(graph, { onSwimlaneResized })

    emitGraphEvent(graph, 'node:resize', { node: pool })
    invokePreviewResize(pool, 900, 180, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 400 })
    expect(getPreviewElement(graph, pool.id)?.style.top).toBe('100px')
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('340px')

    emitGraphEvent(graph, 'node:resized', { node: pool })

    expect(pool.getPosition()).toEqual({ x: 40, y: 100 })
    expect(pool.getSize()).toEqual({ width: 900, height: 340 })
    expect(getPreviewElement(graph, pool.id)).toBeNull()
    expect(onSwimlaneResized).toHaveBeenCalledWith(pool, pool)

    dispose()
  })

  it('Pool 左边拖拽应按 header 与内容共同钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
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
      x: 110,
      y: 100,
      width: 100,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: pool })
    invokePreviewResize(pool, 780, 400, 'left')

    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('50px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('890px')
    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })

    emitGraphEvent(graph, 'node:resized', { node: pool })

    expect(pool.getPosition()).toEqual({ x: 50, y: 40 })
    expect(pool.getSize()).toEqual({ width: 890, height: 400 })

    dispose()
  })

  it('Pool 右边与下边拖拽应按内容区右下边界钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-rb',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-rb',
      shape: BPMN_USER_TASK,
      x: 300,
      y: 180,
      width: 60,
      height: 40,
    })
    pool.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: pool })
    invokePreviewResize(pool, 240, 260, 'right')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('320px')

    invokePreviewResize(pool, 400, 120, 'bottom')
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('180px')

    dispose()
  })

  it('Pool preview 在未越过内容边界或缺少 direction 时应保持候选矩形', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-free',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-free',
      shape: BPMN_USER_TASK,
      x: 300,
      y: 180,
      width: 60,
      height: 40,
    })
    pool.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: pool })

    invokePreviewResizeWithoutDirection(pool, 360, 200)
    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('40px')
    expect(getPreviewElement(graph, pool.id)?.style.top).toBe('40px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('360px')
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('200px')

    invokePreviewResize(pool, 380, 260, 'left')
    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('60px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('380px')

    invokePreviewResize(pool, 400, 220, 'top')
    expect(getPreviewElement(graph, pool.id)?.style.top).toBe('80px')
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('220px')

    invokePreviewResize(pool, 380, 260, 'right')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('380px')

    invokePreviewResize(pool, 400, 220, 'bottom')
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('220px')

    dispose()
  })

  it('首 Lane 上边拖拽时应使用 ghost preview，mouseup 后投影到 Pool', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 200,
      y: 60,
      width: 100,
      height: 60,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane1.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 370, 40, 'top')

    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 370, height: 200 })
    expect(getPreviewElement(graph, lane1.id)?.style.top).toBe('60px')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('180px')

    emitGraphEvent(graph, 'node:resized', { node: lane1 })

    expect(pool.getPosition()).toEqual({ x: 40, y: 60 })
    expect(pool.getSize()).toEqual({ width: 400, height: 380 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 60 })
    expect(lane1.getSize()).toEqual({ width: 370, height: 180 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 370, height: 200 })

    dispose()
  })

  it('垂直布局末 Lane 右边拖拽时应按 Pool 内容右边界钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-v',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane1 = graph.addNode({
      id: 'lane-v1',
      shape: BPMN_LANE,
      x: 40,
      y: 70,
      width: 200,
      height: 190,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane2 = graph.addNode({
      id: 'lane-v2',
      shape: BPMN_LANE,
      x: 240,
      y: 70,
      width: 200,
      height: 190,
      data: { bpmn: { isHorizontal: false } },
    })
    const task = graph.addNode({
      id: 'task-v2',
      shape: BPMN_USER_TASK,
      x: 380,
      y: 100,
      width: 40,
      height: 60,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane2.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 60, 190, 'right')

    expect(lane2.getSize()).toEqual({ width: 200, height: 190 })
    expect(getPreviewElement(graph, lane2.id)?.style.width).toBe('180px')

    emitGraphEvent(graph, 'node:resized', { node: lane2 })

    expect(lane2.getPosition()).toEqual({ x: 240, y: 70 })
    expect(lane2.getSize()).toEqual({ width: 180, height: 190 })
    expect(pool.getSize()).toEqual({ width: 380, height: 220 })

    dispose()
  })

  it('水平布局末 Lane 下边拖拽应按内容底部钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-bottom',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-top',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-bottom',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-bottom',
      shape: BPMN_USER_TASK,
      x: 200,
      y: 380,
      width: 100,
      height: 40,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane2.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 370, 60, 'bottom')

    expect(getPreviewElement(graph, lane2.id)?.style.height).toBe('180px')

    dispose()
  })

  it('水平布局内侧共享边拖拽应按相邻 Lane 最小高度钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-inner-horizontal',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-inner-top',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-inner-bottom',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 370, 360, 'bottom')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('340px')

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 370, 360, 'top')
    expect(getPreviewElement(graph, lane2.id)?.style.top).toBe('100px')
    expect(getPreviewElement(graph, lane2.id)?.style.height).toBe('340px')

    dispose()
  })

  it('水平布局内侧共享边未越界时应保留候选 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-inner-horizontal-safe',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-inner-top-safe',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-inner-bottom-safe',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 370, 250, 'bottom')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('250px')

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 370, 300, 'top')
    expect(getPreviewElement(graph, lane2.id)?.style.top).toBe('140px')
    expect(getPreviewElement(graph, lane2.id)?.style.height).toBe('300px')

    dispose()
  })

  it('水平布局 Lane 左右边拖拽应按内容区左右边界钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-lr',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-lr',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const taskLeft = graph.addNode({
      id: 'task-left',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 100,
      width: 60,
      height: 40,
    })
    const taskRight = graph.addNode({
      id: 'task-right',
      shape: BPMN_USER_TASK,
      x: 360,
      y: 100,
      width: 40,
      height: 40,
    })
    pool.embed(lane)
    lane.embed(taskLeft)
    lane.embed(taskRight)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane })
    invokePreviewResize(lane, 300, 260, 'left')
    expect(getPreviewElement(graph, lane.id)?.style.left).toBe('100px')
    expect(getPreviewElement(graph, lane.id)?.style.width).toBe('340px')

    invokePreviewResize(lane, 260, 260, 'right')
    expect(getPreviewElement(graph, lane.id)?.style.left).toBe('70px')
    expect(getPreviewElement(graph, lane.id)?.style.width).toBe('330px')

    dispose()
  })

  it('Lane preview 兜底路径应在无内容或非 Pool 直系 Lane 时保持候选矩形', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const emptyPool = graph.addNode({
      id: 'pool-empty',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })
    const emptyLane = graph.addNode({
      id: 'lane-empty',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })
    const parentTask = graph.addNode({
      id: 'task-parent',
      shape: BPMN_USER_TASK,
      x: 520,
      y: 80,
      width: 200,
      height: 180,
    })
    const nestedPool = graph.addNode({
      id: 'pool-nested',
      shape: BPMN_POOL,
      x: 480,
      y: 40,
      width: 320,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const nestedLane = graph.addNode({
      id: 'lane-nested',
      shape: BPMN_LANE,
      x: 540,
      y: 80,
      width: 180,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const directTask = graph.addNode({
      id: 'task-direct-nested',
      shape: BPMN_USER_TASK,
      x: 620,
      y: 120,
      width: 60,
      height: 40,
    })
    emptyPool.embed(emptyLane)
    nestedPool.embed(parentTask)
    nestedPool.embed(directTask)
    parentTask.embed(nestedLane)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: emptyLane })
    invokePreviewResize(emptyLane, 200, 220, 'left')
    expect(getPreviewElement(graph, emptyLane.id)?.style.left).toBe('240px')
    expect(getPreviewElement(graph, emptyLane.id)?.style.width).toBe('200px')

    emitGraphEvent(graph, 'node:resize', { node: nestedLane })
    invokePreviewResize(nestedLane, 80, 120, 'right')
    expect(getPreviewElement(graph, nestedLane.id)?.style.left).toBe('540px')
    expect(getPreviewElement(graph, nestedLane.id)?.style.width).toBe('80px')

    dispose()
  })

  it('Lane preview 在缺少 direction 或 ancestor Pool 时应直接保留候选矩形', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const orphanLane = graph.addNode({
      id: 'lane-no-pool',
      shape: BPMN_LANE,
      x: 260,
      y: 80,
      width: 220,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: orphanLane })
    invokePreviewResizeWithoutDirection(orphanLane, 180, 90)
    expect(getPreviewElement(graph, orphanLane.id)?.style.left).toBe('260px')
    expect(getPreviewElement(graph, orphanLane.id)?.style.top).toBe('80px')
    expect(getPreviewElement(graph, orphanLane.id)?.style.width).toBe('180px')
    expect(getPreviewElement(graph, orphanLane.id)?.style.height).toBe('90px')

    invokePreviewResize(orphanLane, 120, 120, 'right')
    expect(getPreviewElement(graph, orphanLane.id)?.style.left).toBe('260px')
    expect(getPreviewElement(graph, orphanLane.id)?.style.width).toBe('120px')

    dispose()
  })

  it('垂直布局首 Lane 左边与同 Lane 上下边拖拽应按内容区钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-v-clamp',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane1 = graph.addNode({
      id: 'lane-v-left',
      shape: BPMN_LANE,
      x: 40,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane2 = graph.addNode({
      id: 'lane-v-right',
      shape: BPMN_LANE,
      x: 240,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    const taskTop = graph.addNode({
      id: 'task-v-top',
      shape: BPMN_USER_TASK,
      x: 80,
      y: 100,
      width: 80,
      height: 40,
    })
    const taskBottom = graph.addNode({
      id: 'task-v-bottom',
      shape: BPMN_USER_TASK,
      x: 80,
      y: 240,
      width: 80,
      height: 40,
    })
    pool.embed(lane1)
    pool.embed(lane2)
    lane1.embed(taskTop)
    lane1.embed(taskBottom)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 40, 230, 'left')
    expect(getPreviewElement(graph, lane1.id)?.style.left).toBe('80px')

    invokePreviewResize(lane1, 200, 20, 'top')
    expect(getPreviewElement(graph, lane1.id)?.style.top).toBe('100px')

    invokePreviewResize(lane1, 200, 40, 'bottom')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('210px')

    dispose()
  })

  it('垂直布局内侧共享边拖拽应按相邻 Lane 最小宽度钳制 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-inner-vertical',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane1 = graph.addNode({
      id: 'lane-inner-left',
      shape: BPMN_LANE,
      x: 40,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane2 = graph.addNode({
      id: 'lane-inner-right',
      shape: BPMN_LANE,
      x: 240,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 360, 230, 'right')
    expect(getPreviewElement(graph, lane1.id)?.style.width).toBe('340px')

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 360, 230, 'left')
    expect(getPreviewElement(graph, lane2.id)?.style.left).toBe('100px')
    expect(getPreviewElement(graph, lane2.id)?.style.width).toBe('340px')

    dispose()
  })

  it('垂直布局内侧共享边未越界时应保留候选 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-inner-vertical-safe',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 260,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane1 = graph.addNode({
      id: 'lane-inner-left-safe',
      shape: BPMN_LANE,
      x: 40,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane2 = graph.addNode({
      id: 'lane-inner-right-safe',
      shape: BPMN_LANE,
      x: 240,
      y: 70,
      width: 200,
      height: 230,
      data: { bpmn: { isHorizontal: false } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1 })
    invokePreviewResize(lane1, 250, 230, 'right')
    expect(getPreviewElement(graph, lane1.id)?.style.width).toBe('250px')

    emitGraphEvent(graph, 'node:resize', { node: lane2 })
    invokePreviewResize(lane2, 300, 230, 'left')
    expect(getPreviewElement(graph, lane2.id)?.style.left).toBe('140px')
    expect(getPreviewElement(graph, lane2.id)?.style.width).toBe('300px')

    dispose()
  })

  it('重复触发 node:resize 时应先清理旧 preview，并允许沿缓存方向继续更新 preview', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-repeat',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: pool })
    const firstPreview = getPreviewElement(graph, pool.id)
    invokePreviewResize(pool, 420, 220, 'right')
    invokePreviewResizeWithoutDirection(pool, 430, 220)

    emitGraphEvent(graph, 'node:resize', { node: pool })
    const secondPreview = getPreviewElement(graph, pool.id)

    expect(firstPreview).not.toBe(secondPreview)
    expect(firstPreview?.isConnected).toBe(false)

    dispose()
  })

  it('应支持恢复实例自带的 resize 覆写，并在非泳道 node:resized 时直接跳过', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const task = graph.addNode({
      id: 'task-restore',
      shape: BPMN_USER_TASK,
      x: 80,
      y: 80,
      width: 120,
      height: 60,
    })
    const pool = graph.addNode({
      id: 'pool-own-resize',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    }) as Node & { resize: (width: number, height: number, options?: object) => Node }

    const originalResize = pool.resize.bind(pool)
    pool.resize = ((width: number, height: number, options?: object) => originalResize(width, height, options))

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resized', { node: task, options: {} })
    emitGraphEvent(graph, 'node:resize', { node: pool })

    expect(pool.resize).not.toBe(originalResize)

    dispose()

    expect(pool.resize).not.toBe(originalResize)
  })

  it('fallback 路径应在无 Pool 的 Lane 上安全返回，并对收缩过度的 Pool 做内容兜底', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const orphanLane = graph.addNode({
      id: 'lane-orphan',
      shape: BPMN_LANE,
      x: 260,
      y: 80,
      width: 220,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const pool = graph.addNode({
      id: 'pool-clamp-fallback',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 320,
      data: { bpmn: { isHorizontal: true } },
    })
    const directTask = graph.addNode({
      id: 'task-direct',
      shape: BPMN_USER_TASK,
      x: 200,
      y: 320,
      width: 100,
      height: 60,
    })
    const lane1 = graph.addNode({
      id: 'lane-a',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-b',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-fallback',
      shape: BPMN_USER_TASK,
      x: 200,
      y: 360,
      width: 100,
      height: 60,
    })
    pool.embed(directTask)
    pool.embed(lane1)
    pool.embed(lane2)
    lane2.embed(task)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resized', { node: orphanLane, options: { direction: 'bottom' } })
    expect(orphanLane.getSize()).toEqual({ width: 220, height: 120 })

    emitGraphEvent(graph, 'node:resized', { node: pool, options: { direction: 'bottom' } })
    expect(pool.getPosition().y + pool.getSize().height).toBeGreaterThanOrEqual(380)

    dispose()
  })

  it('fallback 路径应在无 preview 状态时继续收敛 Pool 的 Lane 布局', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-a',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 80,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-b',
      shape: BPMN_LANE,
      x: 70,
      y: 120,
      width: 370,
      height: 100,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    pool.resize(460, 260)
    emitGraphEvent(graph, 'node:resized', { node: pool, options: { direction: 'right' } })

    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 430, height: 80 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 120 })
    expect(lane2.getSize()).toEqual({ width: 430, height: 180 })

    dispose()
  })

  it('dispose 时应移除 preview 并恢复实例 resize 覆写', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupSwimlaneResize(graph)
    emitGraphEvent(graph, 'node:resize', { node: pool })
    invokePreviewResize(pool, 420, 220, 'right')

    expect(getPreviewElement(graph, pool.id)).not.toBeNull()
    expect(Object.prototype.hasOwnProperty.call(pool, 'resize')).toBe(true)

    dispose()

    expect(getPreviewElement(graph, pool.id)).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(pool, 'resize')).toBe(false)
  })
})
