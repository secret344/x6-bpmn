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

  it('内部方向与矩形辅助函数应覆盖别名、混合方向与标准化逻辑', () => {
    expect(resizeTest.resolveRawResizeDirection('top-left')).toBe('nw')
    expect(resizeTest.resolveRawResizeDirection('right-bottom')).toBe('se')
    expect(resizeTest.resolveRawResizeDirection('unknown')).toBeNull()
    expect(resizeTest.resolveResizeDirection({ direction: 'top', relativeDirection: 'top-left' })).toBe('nw')

    const originalRect = { x: 70, y: 40, width: 870, height: 200 }
    const previewRect = { x: 10, y: 20, width: 930, height: 220 }

    expect(resizeTest.hasHorizontalResizeChange(originalRect, previewRect)).toBe(true)
    expect(resizeTest.hasVerticalResizeChange(originalRect, previewRect)).toBe(true)
    expect(resizeTest.pickHorizontalDirection('nw')).toBe('w')
    expect(resizeTest.pickVerticalDirection('se')).toBe('s')
    expect(resizeTest.isVerticalLaneResize('ne')).toBe(true)
    expect(resizeTest.sameRect(originalRect, { ...originalRect })).toBe(true)
    expect(resizeTest.normalizeResizeRect(originalRect, previewRect, 'n')).toEqual({
      x: 70,
      y: 20,
      width: 870,
      height: 220,
    })
    expect(resizeTest.buildResizeRect(originalRect, 930, 220, 'nw')).toEqual(previewRect)
    expect(
      resizeTest.resolveResizeDirection({ relativeDirection: 'bottom' }),
    ).toBe('s')
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

  it('restoreTransformResizing 应在原值不存在时移除注入的最小尺寸约束', () => {
    const transform = {
      options: {
        resizing: {},
      },
    }
    const graph = {
      getPlugin: vi.fn(() => transform),
    } as unknown as Graph

    const saved = patchTransformResizing(graph)
    expect(saved).toEqual({ minWidth: undefined, minHeight: undefined })

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
})
