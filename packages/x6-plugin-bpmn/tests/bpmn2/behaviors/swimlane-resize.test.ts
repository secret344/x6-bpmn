import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Graph, Node } from '@antv/x6'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  emitGraphEvent,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  __test__ as resizeTest,
  clampLanePreviewRect,
  patchTransformResizing,
  restoreTransformResizing,
  setupSwimlaneResize,
} from '../../../src/behaviors/swimlane-resize'
import { BPMN_LANE, BPMN_POOL, BPMN_START_EVENT, BPMN_USER_TASK } from '../../../src/utils/constants'

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
  ;(node as unknown as {
    resize: (nextWidth: number, nextHeight: number, options?: object) => void
  }).resize(width, height, { direction, relativeDirection: direction })
}

async function flushAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function createMockResizeNode(
  id: string,
  shape: string,
  rect: { x: number; y: number; width: number; height: number },
  options: {
    parent?: any
    children?: any[]
    data?: Record<string, unknown>
  } = {},
): any {
  let position = { x: rect.x, y: rect.y }
  let size = { width: rect.width, height: rect.height }
  const children = options.children ?? []
  let parent = options.parent ?? null

  return {
    id,
    shape,
    isNode: () => true,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((x: number, y: number) => {
      position = { x, y }
    }),
    translate: vi.fn((tx: number, ty: number) => {
      position = { x: position.x + tx, y: position.y + ty }
      for (const child of children) {
        if (typeof child.translate === 'function') {
          child.translate(tx, ty)
          continue
        }

        if (typeof child.getPosition === 'function' && typeof child.setPosition === 'function') {
          const childPosition = child.getPosition()
          child.setPosition(childPosition.x + tx, childPosition.y + ty)
        }
      }
    }),
    setSize: vi.fn((width: number, height: number) => {
      size = { width, height }
    }),
    resize: vi.fn((width: number, height: number) => {
      size = { width, height }
    }),
    getChildren: () => children,
    getParent: () => parent,
    getData: () => options.data ?? { bpmn: { isHorizontal: true } },
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
  }
}

afterEach(() => {
  while (graphsToDispose.length > 0) {
    destroyBehaviorTestGraph(graphsToDispose.pop() as Graph)
  }
})

describe('setupSwimlaneResize', () => {
  it('应监听 resize 生命周期与浏览器拖拽回退所需的几何变化事件', () => {
    const graph = {
      on: vi.fn(),
      off: vi.fn(),
      getPlugin: vi.fn(() => ({ options: { resizing: { enabled: true } } })),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    expect(graph.on).toHaveBeenCalledWith('node:resize', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:resized', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:change:size', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:change:position', expect.any(Function))
    expect(graph.on).toHaveBeenCalledTimes(4)

    dispose()
  })

  it('transform 插件提供 resize 事件源时应优先注册到插件，并覆盖无 direction 与无 resize 的回退路径', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const pluginHandlers: Record<string, (args: any) => void> = {}
    const lane = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    delete lane.resize
    const transform = {
      options: { resizing: {} },
      on: vi.fn((event: string, handler: (args: any) => void) => {
        pluginHandlers[event] = handler
      }),
      off: vi.fn(),
    }
    const graph = {
      container: document.createElement('div'),
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn((name: string) => (name === 'transform' ? transform : null)),
      getNodes: vi.fn(() => [lane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    expect(transform.on).toHaveBeenCalledWith('node:resize', expect.any(Function))
    expect(transform.on).toHaveBeenCalledWith('node:resized', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:change:size', expect.any(Function))
    expect(graph.on).toHaveBeenCalledWith('node:change:position', expect.any(Function))

    pluginHandlers['node:resize']({ node: lane, options: {} })
    pluginHandlers['node:resized']({ node: lane, options: {} })
    pluginHandlers['node:resize']({ node: lane, options: { direction: 'bottom' } })
    pluginHandlers['node:resize']({ node: lane, options: { direction: 'bottom' } })
    pluginHandlers['node:resized']({ node: lane, options: { direction: 'bottom' } })

    dispose()

    expect(transform.off).toHaveBeenCalledWith('node:resize', expect.any(Function))
    expect(transform.off).toHaveBeenCalledWith('node:resized', expect.any(Function))
  })

  it('重复 beginPreview、无 state commit 与 transform 空配置恢复应覆盖回退分支', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const lane = createMockResizeNode('lane-repeat', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const graph = {
      container: document.createElement('div'),
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [lane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: lane, options: { direction: 'bottom' } })
    handlers['node:resize']({ node: lane, options: { direction: 'bottom' } })
    invokePreviewResize(lane as unknown as Node, 870, 240, 'bottom')
    handlers['node:resized']({ node: lane, options: { direction: 'bottom' } })

    const detachedLane = createMockResizeNode('lane-detached-commit', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 220,
    })
    handlers['node:resized']({ node: detachedLane, options: { direction: 'bottom' } })
    handlers['node:resized']({ node: detachedLane, options: { direction: 'bottom', silent: true } })
    expect(detachedLane.setSize).toHaveBeenCalled()

    dispose()

    const transform = { options: {} as Record<string, unknown> }
    const transformGraph = { getPlugin: vi.fn(() => transform) } as unknown as Graph
    const saved = patchTransformResizing(transformGraph)
    expect(typeof (transform.options as any).resizing.minWidth).toBe('function')
    expect(typeof (transform.options as any).resizing.minHeight).toBe('function')
    expect((transform.options as any).resizing.minWidth({ shape: BPMN_USER_TASK } as Node)).toBe(0)
    expect((transform.options as any).resizing.minHeight({ shape: BPMN_USER_TASK } as Node)).toBe(0)
    restoreTransformResizing(transformGraph, saved)
    expect('minWidth' in ((transform.options as any).resizing as Record<string, unknown>)).toBe(false)
    expect('minHeight' in ((transform.options as any).resizing as Record<string, unknown>)).toBe(false)

    restoreTransformResizing({ getPlugin: vi.fn(() => null) } as unknown as Graph, saved)
    restoreTransformResizing({ getPlugin: vi.fn(() => ({ options: {} })) } as unknown as Graph, saved)
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
    emitGraphEvent(graph, 'node:resize', { node: task, options: { direction: 'bottom' } })

    expect(getPreviewElement(graph, task.id)).toBeNull()

    dispose()
  })

  it('缺少容器时开始预览不应渲染 preview 元素', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const lane = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const graph = {
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [lane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: lane, options: { direction: 'bottom' } })
    invokePreviewResize(lane as unknown as Node, 870, 240, 'bottom')

    dispose()
  })

  it('live 几何事件在无 preview state、无 direction 与 pool stale 分支下应安全回退', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const childLane = createMockResizeNode('lane-child', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    })
    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    }, { children: [childLane] })
    childLane.__setParent(pool)
    const loneLane = createMockResizeNode('lane-standalone', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    delete loneLane.resize
    const graph = {
      container: document.createElement('div'),
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, childLane, loneLane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:change:size']({ node: loneLane, previous: { width: 870, height: 200 }, options: { ui: true } })
    loneLane.setSize(870, 240)
    handlers['node:change:size']({ node: loneLane, previous: { width: 870, height: 200 }, options: { ui: true, direction: 'bottom', relativeDirection: 'bottom' } })
    expect(getPreviewElement(graph, loneLane.id)?.style.height).toBe('240px')

    handlers['node:change:position']({ node: createMockResizeNode('fresh-lane', BPMN_LANE, { x: 70, y: 40, width: 870, height: 200 }), previous: { x: 70, y: 40 }, options: { ui: true } })

    handlers['node:resize']({ node: pool, options: { direction: 'bottom' } })
    pool.setPosition(40, 20)
    pool.setSize(900, 430)
    childLane.setPosition(70, 20)
    handlers['node:change:size']({ node: pool, previous: { width: 900, height: 400 }, options: { ui: true, direction: 'bottom', relativeDirection: 'bottom' } })
    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(childLane.getPosition()).toEqual({ x: 70, y: 40 })

    dispose()
  })

  it('Pool live size 在无 resize 实现时应走原始矩形回推，live position 无 state 但有 direction 时也应安全返回', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const poolWithResizeChild = createMockResizeNode('pool-live-child-with-resize', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    })
    const poolWithResize = createMockResizeNode('pool-live-with-resize', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    }, { children: [poolWithResizeChild] })
    const poolChild = createMockResizeNode('pool-live-child', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    })
    const pool = createMockResizeNode('pool-live-no-resize', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    }, { children: [poolChild] })
    delete pool.resize
    poolChild.__setParent(pool)
    const freshLane = createMockResizeNode('fresh-live-position', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const graph = {
      container: document.createElement('div'),
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [poolWithResize, poolWithResizeChild, pool, poolChild, freshLane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    poolWithResize.setSize(900, 430)
    handlers['node:change:size']({
      node: poolWithResize,
      previous: { width: 900, height: 400 },
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })

    pool.setSize(900, 430)
    handlers['node:change:size']({
      node: pool,
      previous: { width: 900, height: 400 },
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('430px')

    handlers['node:change:position']({
      node: freshLane,
      previous: { x: 70, y: 40 },
      options: { direction: 'right', relativeDirection: 'right', ui: true },
    })

    dispose()
  })

  it('Lane preview clamp 应按分隔线约束裁剪 preview 边界', () => {
    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 500,
      height: 260,
    })
    const task = createMockResizeNode('task-1', BPMN_USER_TASK, {
      x: 180,
      y: 120,
      width: 120,
      height: 60,
    })
    const lane1 = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 470,
      height: 120,
    }, { parent: pool })
    const lane2 = createMockResizeNode('lane-2', BPMN_LANE, {
      x: 70,
      y: 160,
      width: 470,
      height: 140,
    }, { parent: pool })
    pool.getChildren = () => [lane1, lane2, task]

    expect(clampLanePreviewRect(lane2 as unknown as Node, { x: 70, y: 80, width: 470, height: 220 }, 'n')).toEqual({
      x: 70,
      y: 100,
      width: 470,
      height: 200,
    })
    expect(clampLanePreviewRect(lane1 as unknown as Node, { x: 70, y: 120, width: 470, height: 40 }, 'n')).toEqual({
      x: 70,
      y: 100,
      width: 470,
      height: 60,
    })
    expect(clampLanePreviewRect(lane1 as unknown as Node, { x: 70, y: 40, width: 470, height: 240 }, 's')).toEqual({
      x: 70,
      y: 40,
      width: 470,
      height: 200,
    })
    expect(clampLanePreviewRect(lane1 as unknown as Node, { x: 250, y: 40, width: 290, height: 120 }, 'w')).toEqual({
      x: 180,
      y: 40,
      width: 360,
      height: 120,
    })
    expect(clampLanePreviewRect(lane1 as unknown as Node, { x: 70, y: 40, width: 200, height: 120 }, 'e')).toEqual({
      x: 70,
      y: 40,
      width: 230,
      height: 120,
    })
  })

  it('Pool 边界 resize 应只更新 preview，提交后再同步 Pool 与贴边 Lane', () => {
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
    pool.embed(lane)

    const onSwimlaneResized = vi.fn()
    const dispose = setupSwimlaneResize(graph, { onSwimlaneResized })

    emitGraphEvent(graph, 'node:resize', { node: pool, options: { direction: 'bottom' } })
    invokePreviewResize(pool, 900, 500, 'bottom')

    expect(pool.getSize()).toEqual({ width: 900, height: 400 })
    expect(getPreviewElement(graph, pool.id)?.style.height).toBe('500px')

    emitGraphEvent(graph, 'node:resized', { node: pool, options: { direction: 'bottom' } })

    expect(pool.getSize()).toEqual({ width: 900, height: 500 })
    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane.getSize()).toEqual({ width: 870, height: 500 })
    expect(getPreviewElement(graph, pool.id)).toBeNull()
    expect(onSwimlaneResized).toHaveBeenCalledWith(pool, pool)

    dispose()
  })

  it('Lane 右上角 live size 应先保留 east 方向增长，等待后续 position 对齐 top 边', () => {
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
    pool.embed(lane)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane, options: { direction: 'top-right' } })
    lane.setSize(930, 560, {
      ui: true,
      direction: 'top-right',
      relativeDirection: 'top-right',
    })

    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane.getSize()).toEqual({ width: 870, height: 400 })
    expect(getPreviewElement(graph, lane.id)?.style.width).toBe('930px')
    expect(getPreviewElement(graph, lane.id)?.style.height).toBe('560px')
    expect(getPreviewElement(graph, lane.id)?.style.top).toBe('-120px')

    dispose()
  })

  it('Pool 左边向内拖拽应受内容左边界减去泳道头部缩进钳制', () => {
    const laneTask = createMockResizeNode('task-1', BPMN_USER_TASK, {
      x: 300,
      y: 120,
      width: 100,
      height: 60,
    })
    const lane = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    }, {
      children: [laneTask],
      data: { bpmn: { isHorizontal: true } },
    })
    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    }, {
      children: [lane],
      data: { bpmn: { isHorizontal: true } },
    })
    lane.__setParent(pool)
    laneTask.__setParent(lane)

    const nextRect = resizeTest.clampPoolPreviewRect(
      pool as unknown as Node,
      { x: 600, y: 40, width: 340, height: 400 },
      'w',
      { x: 40, y: 40, width: 900, height: 400 },
    )

    expect(nextRect.x).toBe(270)
    expect(nextRect.width).toBe(670)
  })

  it('Lane 分隔线 resize 应在提交后按当前层级零和重排', () => {
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
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1, options: { direction: 'bottom' } })
    invokePreviewResize(lane1, 870, 260, 'bottom')

    expect(lane1.getSize()).toEqual({ width: 870, height: 200 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('260px')

    emitGraphEvent(graph, 'node:resized', { node: lane1, options: { direction: 'bottom' } })

    expect(pool.getSize()).toEqual({ width: 900, height: 400 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 260 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 300 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 140 })
    expect(getPreviewElement(graph, lane1.id)).toBeNull()

    dispose()
  })

  it('Lane 左边 resize 提交后应同步收敛到 Pool 外边界', () => {
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
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1, options: { direction: 'left' } })
    invokePreviewResize(lane1, 930, 200, 'left')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 400 })
    expect(getPreviewElement(graph, lane1.id)?.style.left).toBe('10px')
    expect(getPreviewElement(graph, lane1.id)?.style.width).toBe('930px')

    emitGraphEvent(graph, 'node:resized', { node: lane1, options: { direction: 'left' } })

    expect(pool.getPosition()).toEqual({ x: -20, y: 40 })
    expect(pool.getSize()).toEqual({ width: 960, height: 400 })
    expect(lane1.getPosition()).toEqual({ x: 10, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 930, height: 200 })
    expect(lane2.getPosition()).toEqual({ x: 10, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 930, height: 200 })
    expect(getPreviewElement(graph, lane1.id)).toBeNull()

    dispose()
  })

  it('贴 Pool 上边的首 Lane 顶边 resize 应同步扩展 Pool 上边界', () => {
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
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane1, options: { direction: 'top' } })
    invokePreviewResize(lane1, 870, 250, 'top')

    expect(getPreviewElement(graph, lane1.id)?.style.top).toBe('-10px')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('250px')

    emitGraphEvent(graph, 'node:resized', { node: lane1, options: { direction: 'top' } })

    expect(pool.getPosition()).toEqual({ x: 40, y: -10 })
    expect(pool.getSize()).toEqual({ width: 900, height: 450 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: -10 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 250 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 200 })

    dispose()
  })

  it('视图存在平移缩放时 preview 应按容器内屏幕坐标渲染', () => {
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
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane)

    const container = (graph as unknown as { container?: HTMLElement }).container as HTMLElement
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 60,
      width: 800,
      height: 600,
      top: 60,
      left: 100,
      right: 900,
      bottom: 660,
      toJSON: () => '',
    } as unknown as DOMRect)
    ;(graph as unknown as { localToClient: (point: { x: number; y: number }) => { x: number; y: number } }).localToClient = ({ x, y }) => ({
      x: x * 1.5 + 120,
      y: y * 1.5 + 80,
    })

    const dispose = setupSwimlaneResize(graph)

    emitGraphEvent(graph, 'node:resize', { node: lane, options: { direction: 'bottom' } })
    invokePreviewResize(lane, 870, 260, 'bottom')

    const preview = getPreviewElement(graph, lane.id)
    expect(preview?.style.left).toBe('125px')
    expect(preview?.style.top).toBe('80px')
    expect(preview?.style.width).toBe('1305px')
    expect(preview?.style.height).toBe('390px')

    dispose()
  })

  it('UI 事件流应先回滚真实几何，并在 mouseup 回退提交 preview', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')
    let mouseupHandler: (() => void) | undefined
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'mouseup') {
          mouseupHandler = handler as () => void
        }
      }) as typeof window.addEventListener)
    const removeEventListenerSpy = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation((() => {}) as typeof window.removeEventListener)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }) as typeof window.requestAnimationFrame)

    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const lane = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    }, { parent: pool })
    const children = [lane]
    pool.getChildren = () => children

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, lane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const onSwimlaneResized = vi.fn()
    const dispose = setupSwimlaneResize(graph, { onSwimlaneResized })

    handlers['node:resize']({ node: pool, options: { direction: 'top', ui: true } })
    ;(pool as { resize: (width: number, height: number, options?: object) => void }).resize(900, 450, {
      direction: 'top',
      relativeDirection: 'top',
    })

    expect(getPreviewElement(graph, pool.id)?.style.top).toBe('-10px')
    handlers['node:resized']({ node: pool, options: { direction: 'top', ui: true } })

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 400 })
    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane.getSize()).toEqual({ width: 870, height: 400 })

    mouseupHandler?.()

    expect(pool.getPosition()).toEqual({ x: 40, y: -10 })
    expect(pool.getSize()).toEqual({ width: 900, height: 450 })
    expect(lane.getPosition()).toEqual({ x: 70, y: -10 })
    expect(lane.getSize()).toEqual({ width: 870, height: 450 })
    expect(getPreviewElement(graph, pool.id)).toBeNull()
    expect(onSwimlaneResized).toHaveBeenCalledWith(pool, pool)

    dispose()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    requestAnimationFrameSpy.mockRestore()
  })

  it('实时 position/size 事件应驱动 Lane preview，并在 mouseup 后统一提交', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')
    let mouseupHandler: (() => void) | undefined
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'mouseup') {
          mouseupHandler = handler as () => void
        }
      }) as typeof window.addEventListener)
    const removeEventListenerSpy = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation((() => {}) as typeof window.removeEventListener)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }) as typeof window.requestAnimationFrame)

    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const lane1 = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    }, { parent: pool })
    const lane2 = createMockResizeNode('lane-2', BPMN_LANE, {
      x: 70,
      y: 240,
      width: 870,
      height: 200,
    }, { parent: pool })
    const children = [lane1, lane2]
    pool.getChildren = () => children

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, lane1, lane2]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: lane1, options: { direction: 'top', ui: true } })
    lane1.setPosition(70, 20)
    handlers['node:change:position']({
      node: lane1,
      previous: { x: 70, y: 40 },
      options: { direction: 'top-left', relativeDirection: 'top', ui: true },
    })
    lane1.setSize(870, 220)
    handlers['node:change:size']({
      node: lane1,
      previous: { width: 870, height: 200 },
      options: { direction: 'top-left', relativeDirection: 'top', ui: true },
    })

    expect(getPreviewElement(graph, lane1.id)?.style.top).toBe('20px')
    expect(getPreviewElement(graph, lane1.id)?.style.height).toBe('220px')
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 200 })

    mouseupHandler?.()

    expect(pool.getPosition()).toEqual({ x: 40, y: 20 })
    expect(pool.getSize()).toEqual({ width: 900, height: 420 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 20 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 220 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 200 })

    dispose()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    requestAnimationFrameSpy.mockRestore()
  })

  it('下边 live size 翻转时应忽略被错误带走的 top 锚边，提交后保持收缩而不是反向放大', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')
    let mouseupHandler: (() => void) | undefined
    const addEventListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation(((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'mouseup') {
          mouseupHandler = handler as () => void
        }
      }) as typeof window.addEventListener)
    const removeEventListenerSpy = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation((() => {}) as typeof window.removeEventListener)
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }) as typeof window.requestAnimationFrame)

    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const lane1 = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    }, { parent: pool })
    const lane2 = createMockResizeNode('lane-2', BPMN_LANE, {
      x: 70,
      y: 240,
      width: 870,
      height: 200,
    }, { parent: pool })
    const children = [lane1, lane2]
    pool.getChildren = () => children

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, lane1, lane2]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: lane2, options: { direction: 'bottom', ui: true } })

    lane2.setSize(870, 160)
    handlers['node:change:size']({
      node: lane2,
      previous: { width: 870, height: 200 },
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })

    expect(getPreviewElement(graph, lane2.id)?.style.top).toBe('240px')
    expect(getPreviewElement(graph, lane2.id)?.style.height).toBe('160px')

    lane2.setPosition(70, -20)
    lane2.setSize(870, 720)
    handlers['node:change:size']({
      node: lane2,
      previous: { width: 870, height: 160 },
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })

    expect(getPreviewElement(graph, lane2.id)?.style.top).toBe('240px')
    expect(getPreviewElement(graph, lane2.id)?.style.height).toBe('160px')
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 160 })

    mouseupHandler?.()

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 360 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 200 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 160 })

    dispose()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    requestAnimationFrameSpy.mockRestore()
  })

  it('Pool 左侧 live preview 应基于拖拽起点快照约束，并回滚嵌套后代几何污染', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')

    const pool = createMockResizeNode('pool-1', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const task = createMockResizeNode('task-1', BPMN_USER_TASK, {
      x: 300,
      y: 120,
      width: 100,
      height: 60,
    })
    const lane = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    }, {
      parent: pool,
      children: [task],
    })

    pool.getChildren = () => [lane]
    task.__setParent(lane)

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, lane, task]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: pool, options: { direction: 'left', ui: true } })

    pool.setPosition(600, 40)
    lane.setPosition(630, 40)
    task.setPosition(860, 120)
    handlers['node:change:position']({
      node: pool,
      previous: { x: 40, y: 40 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })

    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('270px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('670px')
    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(task.getPosition()).toEqual({ x: 300, y: 120 })

    pool.setSize(340, 400)
    handlers['node:change:size']({
      node: pool,
      previous: { width: 900, height: 400 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })

    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('270px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('670px')
    expect(task.getPosition()).toEqual({ x: 300, y: 120 })

    dispose()
  })

  it('Pool 左侧向内拖拽不应越过最左内容节点减去泳道头部缩进', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')

    const pool = createMockResizeNode('pool-left-clamp', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const start = createMockResizeNode('start-left-clamp', BPMN_START_EVENT, {
      x: 120,
      y: 120,
      width: 36,
      height: 36,
    })
    const lane = createMockResizeNode('lane-left-clamp', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    }, {
      parent: pool,
      children: [start],
      data: { bpmn: { isHorizontal: true } },
    })

    pool.getChildren = () => [lane]
    start.__setParent(lane)

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, lane, start]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: pool, options: { direction: 'left', ui: true } })

    pool.setPosition(140, 40)
    handlers['node:change:position']({
      node: pool,
      previous: { x: 40, y: 40 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })

    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('90px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('850px')
    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(start.getPosition()).toEqual({ x: 120, y: 120 })

    pool.setSize(800, 400)
    handlers['node:change:size']({
      node: pool,
      previous: { width: 900, height: 400 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })

    expect(getPreviewElement(graph, pool.id)?.style.left).toBe('90px')
    expect(getPreviewElement(graph, pool.id)?.style.width).toBe('850px')
    expect(start.getPosition()).toEqual({ x: 120, y: 120 })

    dispose()
  })

  it('stale live position 应覆盖 north/south/east/west 分支，并在 Pool 场景恢复子 Lane', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')

    const poolChild = createMockResizeNode('pool-child', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 400,
    })
    const pool = createMockResizeNode('pool-stale-position', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    }, { children: [poolChild] })
    poolChild.__setParent(pool)
    const northLane = createMockResizeNode('lane-stale-n', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const southLane = createMockResizeNode('lane-stale-s', BPMN_LANE, {
      x: 70,
      y: 260,
      width: 870,
      height: 180,
    })
    const eastLane = createMockResizeNode('lane-stale-e', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })

    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, poolChild, northLane, southLane, eastLane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: northLane, options: { direction: 'top', ui: true } })
    invokePreviewResize(northLane as unknown as Node, 870, 160, 'top')
    handlers['node:change:position']({
      node: northLane,
      previous: { x: 70, y: 40 },
      options: { direction: 'top', relativeDirection: 'top', ui: true },
    })

    handlers['node:resize']({ node: southLane, options: { direction: 'bottom', ui: true } })
    invokePreviewResize(southLane as unknown as Node, 870, 140, 'bottom')
    handlers['node:change:position']({
      node: southLane,
      previous: { x: 70, y: 260 },
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })

    handlers['node:resize']({ node: pool, options: { direction: 'left', ui: true } })
    invokePreviewResize(pool as unknown as Node, 840, 400, 'left')
    poolChild.setPosition(200, 100)
    handlers['node:change:position']({
      node: pool,
      previous: { x: 40, y: 40 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })
    expect(poolChild.getPosition()).toEqual({ x: 70, y: 40 })

    handlers['node:resize']({ node: eastLane, options: { direction: 'right', ui: true } })
    invokePreviewResize(eastLane as unknown as Node, 810, 200, 'right')
    handlers['node:change:position']({
      node: eastLane,
      previous: { x: 70, y: 40 },
      options: { direction: 'right', relativeDirection: 'right', ui: true },
    })

    dispose()
  })

  it('stale live size 应覆盖 south/east 轴漂移与 north/west/east 反向放大回退', () => {
    const handlers: Record<string, (args: any) => void> = {}
    const container = document.createElement('div')
    const southLane = createMockResizeNode('lane-stale-size-s', BPMN_LANE, {
      x: 70,
      y: 260,
      width: 870,
      height: 180,
    })
    const eastShiftLane = createMockResizeNode('lane-stale-size-e-shift', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const northLane = createMockResizeNode('lane-stale-size-n', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const westLane = createMockResizeNode('lane-stale-size-w', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const eastGrowLane = createMockResizeNode('lane-stale-size-e-grow', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 200,
    })
    const graph = {
      container,
      options: {},
      on: vi.fn((event: string, handler: (args: any) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getPlugin: vi.fn(() => null),
      getNodes: vi.fn(() => [southLane, eastShiftLane, northLane, westLane, eastGrowLane]),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph

    const dispose = setupSwimlaneResize(graph)

    handlers['node:resize']({ node: southLane, options: { direction: 'bottom', ui: true } })
    invokePreviewResize(southLane as unknown as Node, 870, 140, 'bottom')
    southLane.setSize(870, 260)
    handlers['node:change:size']({
      node: southLane,
      previous: undefined,
      options: { direction: 'bottom', relativeDirection: 'bottom', ui: true },
    })

    handlers['node:resize']({ node: eastShiftLane, options: { direction: 'right', ui: true } })
    invokePreviewResize(eastShiftLane as unknown as Node, 930, 200, 'right')
    eastShiftLane.setPosition(40, 40)
    eastShiftLane.setSize(930, 200)
    handlers['node:change:size']({
      node: eastShiftLane,
      previous: { width: 870, height: 200 },
      options: { direction: 'right', relativeDirection: 'right', ui: true },
    })

    handlers['node:resize']({ node: northLane, options: { direction: 'top', ui: true } })
    invokePreviewResize(northLane as unknown as Node, 870, 160, 'top')
    northLane.setPosition(70, 20)
    northLane.setSize(870, 220)
    handlers['node:change:size']({
      node: northLane,
      previous: { width: 870, height: 160 },
      options: { direction: 'top', relativeDirection: 'top', ui: true },
    })

    handlers['node:resize']({ node: westLane, options: { direction: 'left', ui: true } })
    invokePreviewResize(westLane as unknown as Node, 810, 200, 'left')
    westLane.setPosition(40, 40)
    westLane.setSize(900, 200)
    handlers['node:change:size']({
      node: westLane,
      previous: { width: 810, height: 200 },
      options: { direction: 'left', relativeDirection: 'left', ui: true },
    })

    handlers['node:resize']({ node: eastGrowLane, options: { direction: 'right', ui: true } })
    invokePreviewResize(eastGrowLane as unknown as Node, 810, 200, 'right')
    eastGrowLane.setSize(930, 200)
    handlers['node:change:size']({
      node: eastGrowLane,
      previous: undefined,
      options: { direction: 'right', relativeDirection: 'right', ui: true },
    })

    dispose()
  })

  it('内部方向与矩形辅助函数应覆盖别名、混合方向与标准化逻辑', () => {
    expect(resizeTest.resolveRawResizeDirection(undefined)).toBeNull()
    expect(resizeTest.resolveRawResizeDirection('top')).toBe('n')
    expect(resizeTest.resolveRawResizeDirection('right')).toBe('e')
    expect(resizeTest.resolveRawResizeDirection('bottom')).toBe('s')
    expect(resizeTest.resolveRawResizeDirection('left')).toBe('w')
    expect(resizeTest.resolveRawResizeDirection('top-left')).toBe('nw')
    expect(resizeTest.resolveRawResizeDirection('left-top')).toBe('nw')
    expect(resizeTest.resolveRawResizeDirection('top-right')).toBe('ne')
    expect(resizeTest.resolveRawResizeDirection('right-top')).toBe('ne')
    expect(resizeTest.resolveRawResizeDirection('bottom-right')).toBe('se')
    expect(resizeTest.resolveRawResizeDirection('right-bottom')).toBe('se')
    expect(resizeTest.resolveRawResizeDirection('bottom-left')).toBe('sw')
    expect(resizeTest.resolveRawResizeDirection('left-bottom')).toBe('sw')
    expect(resizeTest.resolveRawResizeDirection('n')).toBe('n')
    expect(resizeTest.resolveRawResizeDirection('e')).toBe('e')
    expect(resizeTest.resolveRawResizeDirection('s')).toBe('s')
    expect(resizeTest.resolveRawResizeDirection('w')).toBe('w')
    expect(resizeTest.resolveRawResizeDirection('ne')).toBe('ne')
    expect(resizeTest.resolveRawResizeDirection('nw')).toBe('nw')
    expect(resizeTest.resolveRawResizeDirection('se')).toBe('se')
    expect(resizeTest.resolveRawResizeDirection('sw')).toBe('sw')
    expect(resizeTest.resolveRawResizeDirection('unknown')).toBeNull()
    expect(resizeTest.resolveResizeDirection({ direction: 'top', relativeDirection: 'top-left' })).toBe('nw')

    const originalRect = { x: 70, y: 40, width: 870, height: 200 }
    const previewRect = { x: 10, y: 20, width: 930, height: 220 }

    expect(resizeTest.hasHorizontalResizeChange(originalRect, previewRect)).toBe(true)
    expect(resizeTest.hasVerticalResizeChange(originalRect, previewRect)).toBe(true)
    expect(resizeTest.hasHorizontalResizeChange(originalRect, { ...originalRect, width: 930 })).toBe(true)
    expect(resizeTest.hasVerticalResizeChange(originalRect, { ...originalRect, height: 220 })).toBe(true)
    expect(resizeTest.isTranslationOnlyPreviewUpdate(
      { x: 70, y: 110, width: 1250, height: 375 },
      { x: 70, y: 250, width: 1250, height: 375 },
    )).toBe(true)
    expect(resizeTest.mergePreviewRect(
      { x: 70, y: 110, width: 1250, height: 375 },
      { x: 70, y: 250, width: 1250, height: 375 },
    )).toEqual({ x: 70, y: 110, width: 1250, height: 375 })
    expect(resizeTest.pickHorizontalDirection('nw')).toBe('w')
    expect(resizeTest.pickHorizontalDirection('e')).toBe('e')
    expect(resizeTest.pickHorizontalDirection('s')).toBeNull()
    expect(resizeTest.pickVerticalDirection('n')).toBe('n')
    expect(resizeTest.pickVerticalDirection('se')).toBe('s')
    expect(resizeTest.pickVerticalDirection('e')).toBeNull()
    expect(resizeTest.isVerticalLaneResize('ne')).toBe(true)
    expect(resizeTest.sameRect(originalRect, { ...originalRect })).toBe(true)
    expect(resizeTest.normalizeResizeRect(originalRect, previewRect, 'n')).toEqual({
      x: 70,
      y: 20,
      width: 870,
      height: 220,
    })
    expect(resizeTest.normalizeResizeRect(originalRect, previewRect, 's')).toEqual({
      x: 70,
      y: 40,
      width: 870,
      height: 220,
    })
    expect(resizeTest.normalizeResizeRect(originalRect, previewRect, 'e')).toEqual({
      x: 70,
      y: 40,
      width: 930,
      height: 200,
    })
    expect(resizeTest.buildResizeRect(originalRect, 930, 220, 'nw')).toEqual(previewRect)
    expect(
      resizeTest.buildResizeRectFromLivePosition(
        { x: 70, y: 20, width: 880, height: 500 },
        { x: 70, y: 20, width: 870, height: 400 },
        'ne',
      ),
    ).toEqual({ x: 70, y: 20, width: 880, height: 500 })
    expect(
      resizeTest.buildResizeRectFromLivePosition(
        { x: 10, y: 40, width: 930, height: 220 },
        { x: 10, y: 40, width: 870, height: 200 },
        'sw',
      ),
    ).toEqual({ x: 10, y: 40, width: 930, height: 220 })
    expect(
      resizeTest.resolveResizeDirection({ relativeDirection: 'bottom' }),
    ).toBe('s')
    expect(
      resizeTest.buildResizeRectFromLivePosition(
        { x: 70, y: 40, width: 870, height: 200 },
        { x: 120, y: 80, width: 820, height: 160 },
        'se',
      ),
    ).toEqual({ x: 70, y: 40, width: 870, height: 200 })
  })

  it('内部 Pool/Lane 辅助函数应同步边界、兄弟泳道和快照恢复', () => {
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
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 160,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane3 = graph.addNode({
      id: 'lane-3',
      shape: BPMN_LANE,
      x: 70,
      y: 280,
      width: 870,
      height: 160,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)
    pool.embed(lane3)

    const snapshots = resizeTest.captureChildLaneRects(pool)
    lane1.setPosition(80, 50)
    lane1.setSize(850, 110)
    resizeTest.restoreChildLaneRects(snapshots)
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 120 })

    expect(
      resizeTest.buildPoolRectFromLanePreview(lane1, pool, { x: 10, y: 20, width: 930, height: 140 }, 'nw'),
    ).toEqual({ x: -20, y: 20, width: 960, height: 420 })
    expect(
      resizeTest.buildPoolRectFromLanePreview(lane1, pool, { x: 70, y: 40, width: 930, height: 120 }, 'e'),
    ).toEqual({ x: 40, y: 40, width: 960, height: 400 })
    expect(resizeTest.isBoundaryLane(lane1, 'top')).toBe(true)
    expect(resizeTest.isBoundaryLane(lane3, 'bottom')).toBe(true)
    expect(
      resizeTest.computeSiblingResizeAdjustments(
        lane2,
        { x: 70, y: 160, width: 870, height: 120 },
        { x: 70, y: 140, width: 870, height: 160 },
      ),
    ).toEqual([
      {
        node: lane1,
        newBounds: { x: 70, y: 40, width: 870, height: 100 },
      },
      {
        node: lane3,
        newBounds: { x: 70, y: 300, width: 870, height: 140 },
      },
    ])

    resizeTest.applyBounds(lane3, { x: 70, y: 300, width: 870, height: 140 })
    expect(lane3.getPosition()).toEqual({ x: 70, y: 300 })
    expect(lane3.getSize()).toEqual({ width: 870, height: 140 })

    const laneChild = createMockResizeNode('lane-child', BPMN_USER_TASK, {
      x: 220,
      y: 330,
      width: 120,
      height: 60,
    })
    const laneWithContent = createMockResizeNode('lane-with-content', BPMN_LANE, {
      x: 70,
      y: 240,
      width: 870,
      height: 120,
    }, {
      children: [laneChild],
      data: { bpmn: { isHorizontal: true } },
    })
    laneChild.__setParent(laneWithContent)

    resizeTest.applyBounds(laneWithContent, { x: 70, y: 300, width: 870, height: 60 })
    expect(laneWithContent.getPosition()).toEqual({ x: 70, y: 300 })
    expect(laneWithContent.getSize()).toEqual({ width: 870, height: 60 })
    expect(laneChild.getPosition()).toEqual({ x: 220, y: 330 })

    expect(resizeTest.findAncestorPool(lane2)?.id).toBe(pool.id)
    expect(
      resizeTest.safeGetChildren({
        getChildren: () => {
          throw new Error('boom')
        },
      } as unknown as Node),
    ).toEqual([])
    expect(
      resizeTest.computeSiblingResizeAdjustments(
        {
          id: 'orphan-lane',
          shape: BPMN_LANE,
          getParent: () => ({
            isNode: () => true,
            getChildren: () => [lane1, lane3],
          }),
        } as unknown as Node,
        { x: 70, y: 160, width: 870, height: 120 },
        { x: 70, y: 140, width: 870, height: 160 },
      ),
    ).toEqual([])
    expect(resizeTest.captureChildLaneRects(lane1)).toEqual(new Map())
    expect(
      resizeTest.findAncestorPool({
        getParent: () => ({
          isNode: () => true,
          shape: BPMN_USER_TASK,
          getParent: () => null,
        }),
      } as unknown as Node),
    ).toBeNull()
    expect(
      resizeTest.computeSiblingResizeAdjustments(
        {
          id: 'orphan-root-lane',
          shape: BPMN_LANE,
          getParent: () => null,
          getPosition: () => ({ x: 70, y: 40 }),
          getSize: () => ({ width: 870, height: 120 }),
        } as unknown as Node,
        { x: 70, y: 40, width: 870, height: 120 },
        { x: 70, y: 20, width: 870, height: 160 },
      ),
    ).toEqual([])
  })

  it('后代快照与兄弟排序辅助函数应恢复嵌套泳道树的原始几何', () => {
    const pool = createMockResizeNode('pool', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const laneUpper = createMockResizeNode('lane-upper', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 120,
    }, { parent: pool })
    const laneLower = createMockResizeNode('lane-lower', BPMN_LANE, {
      x: 70,
      y: 220,
      width: 870,
      height: 220,
    }, { parent: pool })
    const task = createMockResizeNode('task-1', BPMN_USER_TASK, {
      x: 180,
      y: 260,
      width: 120,
      height: 60,
    }, { parent: laneLower })
    const nestedLane = createMockResizeNode('lane-nested', BPMN_LANE, {
      x: 100,
      y: 320,
      width: 780,
      height: 80,
    }, { parent: laneLower })

    laneLower.getChildren = () => [task, nestedLane, { isNode: () => false }]
    pool.getChildren = () => [laneLower, laneUpper]

    expect(resizeTest.getLaneSiblingsSorted(pool as unknown as Node).map((lane) => lane.id)).toEqual([
      'lane-upper',
      'lane-lower',
    ])

    const descendantSnapshots = resizeTest.captureDescendantNodeRects(laneLower as unknown as Node)
    task.setPosition(240, 340)
    task.setSize(180, 90)
    nestedLane.setPosition(130, 350)
    nestedLane.setSize(730, 70)
    resizeTest.restoreDescendantNodeRects(descendantSnapshots)

    expect(task.getPosition()).toEqual({ x: 180, y: 260 })
    expect(task.getSize()).toEqual({ width: 120, height: 60 })
    expect(nestedLane.getPosition()).toEqual({ x: 100, y: 320 })
    expect(nestedLane.getSize()).toEqual({ width: 780, height: 80 })
    expect(resizeTest.captureStablePreviewOriginalRect({
      shape: BPMN_LANE,
      getParent: () => ({
        isNode: () => true,
        getPosition: () => ({ x: 40, y: 40 }),
        getSize: () => ({ width: 900, height: 400 }),
        getChildren: () => [laneUpper],
      }),
      getPosition: () => ({ x: 70, y: 500, width: 0, height: 0 }),
      getSize: () => ({ width: 870, height: 100 }),
      id: 'detached-lane',
    } as unknown as Node)).toEqual({
      x: 70,
      y: 500,
      width: 870,
      height: 100,
    })
  })

  it('内部提交辅助函数应处理空泳道、单泳道与内容稳定化分支', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const emptyPool = graph.addNode({
      id: 'empty-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 180,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })

    resizeTest.commitPoolResize(graph, emptyPool, { x: 40, y: 60, width: 220, height: 140 }, {
      x: 40,
      y: 40,
      width: 180,
      height: 120,
    }, 'n')
    expect(emptyPool.getPosition()).toEqual({ x: 40, y: 60 })
    expect(emptyPool.getSize()).toEqual({ width: 180, height: 140 })

    resizeTest.commitPoolResize(graph, emptyPool, { x: 40, y: 60, width: 220, height: 140 })
    expect(emptyPool.getSize()).toEqual({ width: 220, height: 140 })

    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 100,
      width: 900,
      height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 100,
      width: 870,
      height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 180,
      y: 80,
      width: 120,
      height: 60,
    })
    pool.embed(lane)
    lane.embed(task)

    resizeTest.commitPoolResize(graph, pool, { x: 40, y: 100, width: 960, height: 320 }, {
      x: 40,
      y: 100,
      width: 900,
      height: 300,
    }, 'e')
    expect(lane.getPosition()).toEqual({ x: 70, y: 100 })
    expect(lane.getSize()).toEqual({ width: 930, height: 320 })

    resizeTest.stabilizePoolTopByContent(graph, pool)
    expect(pool.getPosition()).toEqual({ x: 40, y: 80 })
    expect(pool.getSize().height).toBe(340)
    expect(lane.getPosition()).toEqual({ x: 70, y: 80 })
    expect(lane.getSize().height).toBe(340)
    expect(task.getPosition()).toEqual({ x: 180, y: 80 })

    const standaloneTask = graph.addNode({
      id: 'task-standalone',
      shape: BPMN_USER_TASK,
      x: 500,
      y: 500,
      width: 120,
      height: 60,
    })
    const batchGraph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as unknown as Graph
    resizeTest.commitResize(batchGraph, standaloneTask, { x: 480, y: 480, width: 140, height: 80 }, 'se')
    expect(batchGraph.startBatch).not.toHaveBeenCalled()
    expect(batchGraph.stopBatch).not.toHaveBeenCalled()
  })

  it('Pool preview clamp 应覆盖 east 方向下限与非法 lane inset 的回退', () => {
    const malformedLane = {
      shape: BPMN_LANE,
      isNode: () => true,
      getPosition: () => ({ x: Number.NaN, y: 40 }),
      getSize: () => ({ width: 120, height: 120 }),
    }
    const pool = {
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 180, height: 120 }),
      getChildren: () => [malformedLane],
    } as unknown as Node

    expect(
      resizeTest.clampPoolPreviewRect(
        pool,
        { x: 40, y: 40, width: 60, height: 120 },
        'e',
        { x: 40, y: 40, width: 180, height: 120 },
      ),
    ).toEqual({ x: 40, y: 40, width: 90, height: 120 })
    expect(
      resizeTest.clampPoolPreviewRect(
        pool,
        { x: 90, y: 40, width: 90, height: 120 },
        'w',
        { x: 40, y: 40, width: 180, height: 120 },
      ),
    ).toEqual({ x: 90, y: 40, width: 90, height: 120 })
  })

  it('Pool 顶边稳定、Lane 同步与重排 helper 应覆盖空集合、单 Lane 与多 Lane 场景', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const emptyPool = graph.addNode({
      id: 'empty-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 300,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    resizeTest.syncPoolLaneFrame(emptyPool)
    resizeTest.restackCommittedPoolLanes(emptyPool)

    const pool = graph.addNode({
      id: 'pool-helper',
      shape: BPMN_POOL,
      x: 40,
      y: 100,
      width: 900,
      height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-helper-1',
      shape: BPMN_LANE,
      x: 70,
      y: 100,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-helper-2',
      shape: BPMN_LANE,
      x: 70,
      y: 220,
      width: 870,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    resizeTest.syncPoolLanes(pool, { x: 40, y: 100, width: 900, height: 300 }, { x: 40, y: 80, width: 960, height: 340 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 80 })
    expect(lane2.getSize().width).toBe(930)

    resizeTest.syncPoolLaneFrame(pool)
    expect(lane1.getPosition().x).toBe(70)
    expect(lane2.getSize().width).toBe(870)

    lane1.setSize(930, 140)
    lane2.setPosition(70, 240)
    lane2.setSize(930, 200)
    resizeTest.restackCommittedPoolLanes(pool)
    expect(lane1.getPosition()).toEqual({ x: 70, y: 100 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })

    const singleLanePool = graph.addNode({
      id: 'single-lane-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 500,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    const singleLane = graph.addNode({
      id: 'single-lane',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 470,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    singleLanePool.embed(singleLane)
    resizeTest.syncPoolLanes(singleLanePool, { x: 40, y: 40, width: 500, height: 240 }, { x: 40, y: 20, width: 520, height: 280 })
    expect(singleLane.getPosition()).toEqual({ x: 70, y: 20 })
    expect(singleLane.getSize()).toEqual({ width: 490, height: 280 })

    const stablePool = graph.addNode({
      id: 'stable-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    const stableLane = graph.addNode({
      id: 'stable-lane',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    stablePool.embed(stableLane)
    resizeTest.stabilizePoolTopByContent(graph, stablePool)
    expect(stablePool.getPosition()).toEqual({ x: 40, y: 40 })
  })

  it('Pool preview clamp 在 north 与 west 方向应受内容边界钳制', () => {
    const pool = createMockResizeNode('pool-clamp', BPMN_POOL, {
      x: 40,
      y: 100,
      width: 400,
      height: 220,
    }, {
      children: [createMockResizeNode('lane', BPMN_LANE, { x: 70, y: 100, width: 370, height: 220 })],
      data: { bpmn: { isHorizontal: true } },
    })

    expect(resizeTest.clampPoolPreviewRect(
      pool as unknown as Node,
      { x: 40, y: 180, width: 400, height: 140 },
      'n',
      { x: 40, y: 100, width: 400, height: 220 },
      {
        poolMin: { width: 200, height: 120 },
        poolContent: { x: 120, y: 60, width: 80, height: 80 },
        contentInsetLeft: 30,
      } as any,
    ).y).toBe(60)
    expect(resizeTest.clampPoolPreviewRect(
      pool as unknown as Node,
      { x: 200, y: 100, width: 240, height: 220 },
      'w',
      { x: 40, y: 100, width: 400, height: 220 },
      {
        poolMin: { width: 200, height: 120 },
        poolContent: { x: 150, y: 120, width: 80, height: 60 },
        contentInsetLeft: 30,
      } as any,
    ).x).toBe(120)
  })

  it('边界 Lane 判定在缺少父节点或没有泳道兄弟时应返回 false', () => {
    const detachedLane = createMockResizeNode('lane-detached', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 120,
    })
    detachedLane.__setParent(null)

    const parent = {
      isNode: () => true,
      getChildren: () => [],
    }
    const loneLane = createMockResizeNode('lane-lone', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 120,
    }, { parent })

    expect(resizeTest.isBoundaryLane(detachedLane as Node, 'top')).toBe(false)
    expect(resizeTest.isBoundaryLane(loneLane as Node, 'bottom')).toBe(false)
  })

  it('原始矩形与稳定化辅助函数应覆盖 undefined previous、首尾 Lane 与空内容/无 Lane 分支', () => {
    expect(resizeTest.buildOriginalRectFromLiveSizeChange(
      { x: 70, y: 40, width: 870, height: 200 },
      undefined,
      'se',
    )).toEqual({ x: 70, y: 40, width: 870, height: 200 })
    expect(resizeTest.buildOriginalRectFromLivePositionChange(
      { x: 70, y: 40, width: 870, height: 200 },
      undefined,
      'se',
    )).toEqual({ x: 70, y: 40, width: 870, height: 200 })
    expect(resizeTest.reconcileOriginalRectWithLiveSizeChange(
      { x: 70, y: 40, width: 870, height: 200 },
      undefined,
    )).toEqual({ x: 70, y: 40, width: 870, height: 200 })
    expect(resizeTest.reconcileOriginalRectWithLivePositionChange(
      { x: 70, y: 40, width: 870, height: 200 },
      undefined,
    )).toEqual({ x: 70, y: 40, width: 870, height: 200 })

    const pool = createMockResizeNode('stable-helper-pool', BPMN_POOL, {
      x: 40,
      y: 40,
      width: 900,
      height: 400,
    })
    const firstLane = createMockResizeNode('stable-helper-first', BPMN_LANE, {
      x: 70,
      y: 40,
      width: 870,
      height: 120,
    }, { parent: pool })
    const lastLane = createMockResizeNode('stable-helper-last', BPMN_LANE, {
      x: 70,
      y: 160,
      width: 870,
      height: 280,
    }, { parent: pool })
    pool.getChildren = () => [firstLane, lastLane]

    expect(resizeTest.captureStablePreviewOriginalRect(firstLane as unknown as Node)).toEqual({
      x: 70,
      y: 40,
      width: 870,
      height: 120,
    })
    expect(resizeTest.captureStablePreviewOriginalRect(lastLane as unknown as Node)).toEqual({
      x: 70,
      y: 160,
      width: 870,
      height: 280,
    })

    const graph = trackGraph(createBehaviorTestGraph())
    const emptyPool = graph.addNode({
      id: 'stable-helper-empty-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 160,
      data: { bpmn: { isHorizontal: true } },
    })
    resizeTest.stabilizePoolTopByContent(graph, emptyPool)
    expect(emptyPool.getPosition()).toEqual({ x: 40, y: 40 })

    const alignedPool = graph.addNode({
      id: 'stable-helper-aligned-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 160,
      data: { bpmn: { isHorizontal: true } },
    })
    const alignedTask = graph.addNode({
      id: 'stable-helper-aligned-task',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 40,
      width: 80,
      height: 40,
    })
    alignedPool.embed(alignedTask)
    resizeTest.stabilizePoolTopByContent(graph, alignedPool)
    expect(alignedPool.getPosition()).toEqual({ x: 40, y: 40 })

    const taskOnlyPool = graph.addNode({
      id: 'stable-helper-task-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 120,
      width: 260,
      height: 160,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'stable-helper-task',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 80,
      width: 80,
      height: 40,
    })
    taskOnlyPool.embed(task)
    resizeTest.stabilizePoolTopByContent(graph, taskOnlyPool)
    expect(taskOnlyPool.getPosition()).toEqual({ x: 40, y: 80 })

    const layeredPool = graph.addNode({
      id: 'stable-helper-layered-pool',
      shape: BPMN_POOL,
      x: 40,
      y: 140,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })
    const layeredLaneTop = graph.addNode({
      id: 'stable-helper-layered-top',
      shape: BPMN_LANE,
      x: 70,
      y: 140,
      width: 370,
      height: 100,
      data: { bpmn: { isHorizontal: true } },
    })
    const layeredLaneBottom = graph.addNode({
      id: 'stable-helper-layered-bottom',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const layeredTask = graph.addNode({
      id: 'stable-helper-layered-task',
      shape: BPMN_USER_TASK,
      x: 160,
      y: 100,
      width: 80,
      height: 40,
    })
    layeredPool.embed(layeredLaneTop)
    layeredPool.embed(layeredLaneBottom)
    layeredLaneTop.embed(layeredTask)
    resizeTest.stabilizePoolTopByContent(graph, layeredPool)
    expect(layeredPool.getPosition()).toEqual({ x: 40, y: 100 })
    expect(layeredLaneTop.getPosition()).toEqual({ x: 70, y: 100 })
  })

  it('Lane 提交导致 Pool 左边界变化时，应先把新内容边界投影到兄弟 Lane', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 160,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    resizeTest.commitResize(
      graph,
      lane1,
      { x: 100, y: 40, width: 840, height: 120 },
      'w',
      { x: 70, y: 40, width: 870, height: 120 },
    )

    expect(pool.getPosition()).toEqual({ x: 70, y: 40 })
    expect(pool.getSize()).toEqual({ width: 870, height: 240 })
    expect(lane1.getPosition()).toEqual({ x: 100, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 840, height: 120 })
    expect(lane2.getPosition()).toEqual({ x: 100, y: 160 })
    expect(lane2.getSize()).toEqual({ width: 840, height: 120 })
  })

  it('三条 Lane 时下方 Lane 顶边提交后应只与相邻上方 Lane 重分配高度', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 360,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 160,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane3 = graph.addNode({
      id: 'lane-3',
      shape: BPMN_LANE,
      x: 70,
      y: 280,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)
    pool.embed(lane3)

    resizeTest.commitResize(
      graph,
      lane3,
      { x: 70, y: 240, width: 870, height: 160 },
      'n',
      { x: 70, y: 280, width: 870, height: 120 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 360 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 120 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 160 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 80 })
    expect(lane3.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane3.getSize()).toEqual({ width: 870, height: 160 })
  })

  it('三条 Lane 时下方 Lane 底边提交后不应改动上方 Lane 高度', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 360,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 160,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane3 = graph.addNode({
      id: 'lane-3',
      shape: BPMN_LANE,
      x: 70,
      y: 280,
      width: 870,
      height: 120,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)
    pool.embed(lane3)

    resizeTest.commitResize(
      graph,
      lane3,
      { x: 70, y: 280, width: 870, height: 75 },
      's',
      { x: 70, y: 280, width: 870, height: 120 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 315 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 120 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 160 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 120 })
    expect(lane3.getPosition()).toEqual({ x: 70, y: 280 })
    expect(lane3.getSize()).toEqual({ width: 870, height: 75 })
  })

  it('三条 Lane 时中间 Lane 先缩到最小后，下方 Lane 再自底边向内缩到内容限制区不应改动顶部 Lane 高度', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 900,
      height: 585,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 870,
      height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 870,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane3 = graph.addNode({
      id: 'lane-3',
      shape: BPMN_LANE,
      x: 70,
      y: 500,
      width: 870,
      height: 125,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)
    pool.embed(lane3)

    const addedTask = graph.addNode({
      id: 'task-added-lane-3',
      shape: BPMN_USER_TASK,
      x: 180,
      y: 540,
      width: 100,
      height: 60,
      data: {},
    })
    lane3.embed(addedTask)

    resizeTest.commitResize(
      graph,
      lane2,
      { x: 70, y: 240, width: 870, height: 60 },
      's',
      { x: 70, y: 240, width: 870, height: 260 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 585 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 200 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 60 })
    expect(lane3.getPosition()).toEqual({ x: 70, y: 300 })
    expect(lane3.getSize()).toEqual({ width: 870, height: 325 })

    resizeTest.commitResize(
      graph,
      lane3,
      { x: 70, y: 300, width: 870, height: 80 },
      's',
      { x: 70, y: 300, width: 870, height: 325 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 900, height: 560 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 870, height: 200 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 240 })
    expect(lane2.getSize()).toEqual({ width: 870, height: 60 })
    expect(lane3.getPosition()).toEqual({ x: 70, y: 300 })
    expect(lane3.getSize()).toEqual({ width: 870, height: 300 })
  })

  it('下边拖拽提交时即使 live rect 带入错误 y，也不应翻转两条 Lane 的上下顺序', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 1100,
      height: 460,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 1070,
      height: 140,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 180,
      width: 1070,
      height: 320,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    resizeTest.commitResize(
      graph,
      lane1,
      { x: 70, y: 720, width: 1070, height: 60 },
      's',
      { x: 70, y: 40, width: 1070, height: 140 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 1100, height: 460 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 1070, height: 60 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 100 })
    expect(lane2.getSize()).toEqual({ width: 1070, height: 400 })
  })

  it('两条 Lane 时下方 Lane 自底边缩小不应因为上方 Lane 内容最小值而改写合法 ghost', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 1280,
      height: 480,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 1250,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 260,
      width: 1250,
      height: 260,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane1)
    pool.embed(lane2)

    const lane1Task = graph.addNode({
      id: 'lane-1-task',
      shape: BPMN_USER_TASK,
      x: 180,
      y: 170,
      width: 120,
      height: 80,
      data: {},
    })
    lane1.embed(lane1Task)

    resizeTest.commitResize(
      graph,
      lane1,
      { x: 70, y: 40, width: 1250, height: 70 },
      's',
      { x: 70, y: 40, width: 1250, height: 220 },
    )

    expect(pool.getSize()).toEqual({ width: 1280, height: 480 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 1250, height: 70 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 110 })
    expect(lane2.getSize()).toEqual({ width: 1250, height: 410 })

    resizeTest.commitResize(
      graph,
      lane2,
      { x: 70, y: 110, width: 1250, height: 375 },
      's',
      { x: 70, y: 110, width: 1250, height: 410 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 1280, height: 445 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 1250, height: 70 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 110 })
    expect(lane2.getSize()).toEqual({ width: 1250, height: 375 })
  })

  it('restoreTransformResizing 应在原值不存在时移除注入的最小尺寸约束', () => {
    const transform = {
      options: {
        resizing: {},
      },
    }
    const graph = {
      getPlugin: vi.fn(() => transform),
    } as unknown as Graph
    const pool = {
      shape: BPMN_POOL,
      isNode: () => true,
      getChildren: () => [],
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 240 }),
      getData: () => ({ bpmn: { isHorizontal: true } }),
    } as unknown as Node
    const lane = {
      shape: BPMN_LANE,
      isNode: () => true,
      getChildren: () => [],
      getParent: () => pool,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 240 }),
      getData: () => ({ bpmn: { isHorizontal: true } }),
    } as unknown as Node

    const saved = patchTransformResizing(graph)
    expect(saved).toEqual({ minWidth: undefined, minHeight: undefined })
    expect((transform.options.resizing as { minWidth: (node: Node) => number }).minWidth(pool)).toBeGreaterThan(0)
    expect((transform.options.resizing as { minHeight: (node: Node) => number }).minHeight(pool)).toBeGreaterThan(0)
    expect((transform.options.resizing as { minWidth: (node: Node) => number }).minWidth(lane)).toBeGreaterThanOrEqual(60)
    expect((transform.options.resizing as { minHeight: (node: Node) => number }).minHeight(lane)).toBeGreaterThanOrEqual(60)

    restoreTransformResizing(graph, saved)

    expect('minWidth' in transform.options.resizing).toBe(false)
    expect('minHeight' in transform.options.resizing).toBe(false)
    expect(patchTransformResizing({ getPlugin: vi.fn(() => null) } as unknown as Graph)).toBeNull()
    expect(patchTransformResizing({ getPlugin: vi.fn(() => ({ options: null })) } as unknown as Graph)).toBeNull()

    const transformWithFreshResizing = {
      options: {},
    }
    const freshGraph = {
      getPlugin: vi.fn(() => transformWithFreshResizing),
    } as unknown as Graph
    const freshSaved = patchTransformResizing(freshGraph)
    expect(freshSaved).toEqual({ minWidth: undefined, minHeight: undefined })
    expect(
      (transformWithFreshResizing.options as { resizing: { minWidth: (node: Node) => number } }).resizing.minWidth({
        shape: BPMN_USER_TASK,
      } as unknown as Node),
    ).toBe(0)
  })

  it('内部预览投影与 Pool 预览 clamp 应处理缺失投影和非法坐标', () => {
    const container = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 60,
      width: 800,
      height: 600,
      top: 60,
      left: 100,
      right: 900,
      bottom: 660,
      toJSON: () => '',
    } as unknown as DOMRect)

    expect(
      resizeTest.projectPreviewRectToContainer({} as Graph, container, { x: 10, y: 20, width: 30, height: 40 }),
    ).toEqual({ left: 10, top: 20, width: 30, height: 40 })
    expect(
      resizeTest.projectPreviewRectToContainer({
        localToClient: () => ({ x: Number.NaN, y: Number.NaN }),
      } as unknown as Graph, container, { x: 10, y: 20, width: 30, height: 40 }),
    ).toEqual({ left: 10, top: 20, width: 30, height: 40 })

    const pool = {
      shape: BPMN_POOL,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 180, height: 120 }),
      getChildren: () => [],
    } as unknown as Node
    expect(
      resizeTest.clampPoolPreviewRect(pool, { x: 40, y: 10, width: 140, height: 150 }, 'n'),
    ).toEqual({ x: 40, y: 10, width: 140, height: 150 })
  })

  it('内部 live 原始矩形恢复应在 top/left resize 时用固定底边和右边回推', () => {
    expect(
      resizeTest.buildOriginalRectFromLiveSizeChange(
        { x: 70, y: 565, width: 870, height: 60 },
        { width: 870, height: 85 },
        'n',
      ),
    ).toEqual({ x: 70, y: 540, width: 870, height: 85 })

    expect(
      resizeTest.buildOriginalRectFromLiveSizeChange(
        { x: 130, y: 40, width: 810, height: 120 },
        { width: 870, height: 120 },
        'w',
      ),
    ).toEqual({ x: 70, y: 40, width: 870, height: 120 })

    expect(
      resizeTest.buildOriginalRectFromLivePositionChange(
        { x: 70, y: 565, width: 870, height: 60 },
        { y: 540 },
        'n',
      ),
    ).toEqual({ x: 70, y: 540, width: 870, height: 85 })

    expect(
      resizeTest.buildOriginalRectFromLivePositionChange(
        { x: 130, y: 40, width: 810, height: 120 },
        { x: 70 },
        'w',
      ),
    ).toEqual({ x: 70, y: 40, width: 870, height: 120 })

    expect(
      resizeTest.reconcileOriginalRectWithLivePositionChange(
        resizeTest.reconcileOriginalRectWithLiveSizeChange(
          { x: 70, y: 530, width: 870, height: 85 },
          { height: 85 },
        ),
        { y: 540 },
      ),
    ).toEqual({ x: 70, y: 540, width: 870, height: 85 })
  })

  it('preview 初始矩形应从 lane 栈稳定分隔线回推被噪声污染的 live 几何', () => {
    const pool = createMockResizeNode('pool', BPMN_POOL, {
      x: 40,
      y: 120,
      width: 900,
      height: 650,
    })
    const lane1 = createMockResizeNode('lane-1', BPMN_LANE, {
      x: 70,
      y: 120,
      width: 870,
      height: 400,
    }, { parent: pool })
    const lane2 = createMockResizeNode('lane-2', BPMN_LANE, {
      x: 70,
      y: 545,
      width: 870,
      height: 125,
    }, { parent: pool })
    const lane3 = createMockResizeNode('lane-3', BPMN_LANE, {
      x: 70,
      y: 645,
      width: 870,
      height: 125,
    }, { parent: pool })

    pool.getChildren = () => [lane1, lane2, lane3]

    expect(resizeTest.captureStablePreviewOriginalRect(lane2 as Node)).toEqual({
      x: 70,
      y: 520,
      width: 870,
      height: 125,
    })
  })

})
