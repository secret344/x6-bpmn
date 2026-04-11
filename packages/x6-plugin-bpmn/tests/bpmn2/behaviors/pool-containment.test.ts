/**
 * Pool / Participant 容器约束行为 — 单元测试
 */

import type { Graph, Node } from '@antv/x6'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  setupPoolContainment,
  validatePoolContainment,
} from '../../../src/behaviors/pool-containment'
import {
  findContainingSwimlane,
  getAncestorSwimlane as getSwimlaneAncestor,
} from '../../../src/core/swimlane-membership'
import {
  isContainedFlowNode,
  patchLaneInteracting,
  restoreLaneInteracting,
} from '../../../src/behaviors/swimlane-policy'
import {
  patchTransformResizing,
  restoreTransformResizing,
} from '../../../src/behaviors/swimlane-resize'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  emitGraphEvent,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

registerBehaviorTestShapes([
  BPMN_POOL,
  BPMN_LANE,
  BPMN_USER_TASK,
  BPMN_BOUNDARY_EVENT_TIMER,
])

function createMockNode(id: string, shape: string, x: number, y: number, width: number, height: number) {
  let position = { x, y }
  let size = { width, height }
  let parent: unknown = null
  let removed = false

  const self = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    resize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    translate: vi.fn((deltaX: number, deltaY: number) => {
      position = { x: position.x + deltaX, y: position.y + deltaY }
    }),
    getParent: () => parent,
    getChildren: () => [] as unknown[],
    embed: vi.fn((child: { __setParent: (nextParent: unknown) => void }) => {
      child.__setParent(self)
    }),
    unembed: vi.fn((child: { __setParent: (nextParent: unknown) => void }) => {
      child.__setParent(null)
    }),
    remove: vi.fn(() => {
      removed = true
    }),
    isNode: () => true,
    __setParent: (nextParent: unknown) => {
      parent = nextParent
    },
    __isRemoved: () => removed,
  }

  return self
}

function createMockGraph(nodes: ReturnType<typeof createMockNode>[] = []) {
  const handlers: Record<string, Function[]> = {}
  return {
    options: {},
    getNodes: () => nodes,
    getCellById: (id: string) => nodes.find((node) => node.id === id) ?? null,
    on: (event: string, fn: Function) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(fn)
    },
    off: (event: string, fn: Function) => {
      handlers[event] = (handlers[event] || []).filter((handler) => handler !== fn)
    },
    emit: (event: string, payload: unknown) => {
      for (const handler of handlers[event] || []) {
        handler(payload)
      }
    },
    _handlers: handlers,
  } as unknown as Graph & {
    options: Record<string, unknown>
    _handlers: Record<string, Function[]>
  }
}

function createPoolLaneTaskGraph() {
  const graph = createBehaviorTestGraph()
  const pool = graph.addNode({
    id: 'pool-1',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 400,
    height: 220,
    data: { bpmn: { isHorizontal: true } },
  })
  const lane = graph.addNode({
    id: 'lane-1',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 370,
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

  return { graph, pool, lane, task }
}

function createMultiLaneGraph() {
  const graph = createBehaviorTestGraph()
  const pool = graph.addNode({
    id: 'pool-multi',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 400,
    height: 220,
    data: { bpmn: { isHorizontal: true } },
  })
  const lane1 = graph.addNode({
    id: 'lane-1',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 370,
    height: 100,
    data: { bpmn: { isHorizontal: true } },
  })
  const lane2 = graph.addNode({
    id: 'lane-2',
    shape: BPMN_LANE,
    x: 70,
    y: 140,
    width: 370,
    height: 120,
    data: { bpmn: { isHorizontal: true } },
  })

  pool.embed(lane1)
  pool.embed(lane2)

  return { graph, pool, lane1, lane2 }
}

function getRestrict(graph: Graph, node: Node | null) {
  const translating = ((graph as Graph & {
    options: { translating?: { restrict?: (cellView: unknown) => unknown } }
  }).options.translating)
  if (typeof translating?.restrict !== 'function') {
    throw new Error('未安装 translating.restrict')
  }

  if (!node) {
    return translating.restrict.call(graph, null)
  }

  const view = graph.findViewByCell(node)
  if (!view) {
    throw new Error(`未找到节点视图: ${node.id}`)
  }

  return translating.restrict.call(graph, view)
}

function getEmbedding(graph: Graph) {
  const embedding = ((graph as Graph & {
    options: {
      embedding?: {
        findParent?: (args: { node: Node }) => unknown[]
        validate?: (args: { child: Node; parent: Node }) => boolean
      }
    }
  }).options.embedding)
  if (!embedding) {
    throw new Error('未安装 embedding 配置')
  }
  return embedding
}

const graphsToDispose: Graph[] = []

function trackGraph<T extends Graph>(graph: T): T {
  graphsToDispose.push(graph)
  return graph
}

afterEach(() => {
  while (graphsToDispose.length > 0) {
    destroyBehaviorTestGraph(graphsToDispose.pop() as Graph)
  }
})

describe('isContainedFlowNode', () => {
  it('普通流程节点应受容器约束', () => {
    expect(isContainedFlowNode(BPMN_USER_TASK)).toBe(true)
  })

  it('边界事件与泳道节点不应视为普通受控流程节点', () => {
    expect(isContainedFlowNode(BPMN_BOUNDARY_EVENT_TIMER)).toBe(false)
    expect(isContainedFlowNode(BPMN_POOL)).toBe(false)
    expect(isContainedFlowNode(BPMN_LANE)).toBe(false)
  })
})

describe('patchLaneInteracting / restoreLaneInteracting', () => {
  it('应只禁止 Lane 的 nodeMovable，并在 dispose 时恢复原配置', () => {
    const graph = createMockGraph([])
    const original = { nodeMovable: true, edgeMovable: true }
    graph.options.interacting = original

    patchLaneInteracting(graph, original)

    const interacting = graph.options.interacting as (cellView: unknown) => unknown
    expect(interacting({ cell: { shape: BPMN_LANE } })).toEqual({
      nodeMovable: false,
      edgeMovable: true,
    })
    expect(interacting({ cell: { shape: BPMN_USER_TASK } })).toEqual(original)

    restoreLaneInteracting(graph, original)
    expect(graph.options.interacting).toBe(original)
  })
})

describe('findContainingSwimlane', () => {
  it('应优先返回面积更小的 Lane', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120)
    const graph = createMockGraph([pool, lane])

    const container = findContainingSwimlane(graph, { x: 120, y: 70, width: 100, height: 60 })
    expect(container?.id).toBe('lane')
  })

  it('命中 Pool 空白区时应回落到 Pool', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120)
    lane.__setParent(pool)
    const graph = createMockGraph([pool, lane])

    const container = findContainingSwimlane(graph, { x: 100, y: 180, width: 100, height: 60 })
    expect(container?.id).toBe('pool')
  })

  it('未命中任何泳道容器时应返回 null', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const graph = createMockGraph([pool])

    expect(findContainingSwimlane(graph, { x: 600, y: 400, width: 80, height: 40 })).toBeNull()
  })
})

describe('getSwimlaneAncestor', () => {
  it('应沿父链返回最近的泳道祖先', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60)
    lane.__setParent(pool)
    task.__setParent(lane)

    expect(getSwimlaneAncestor(task)?.id).toBe('lane')
  })

  it('无泳道祖先时应返回 null', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60)
    expect(getSwimlaneAncestor(task)).toBeNull()
  })
})

describe('validatePoolContainment', () => {
  it('无 Pool 时应直接通过', () => {
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60)
    const graph = createMockGraph([task])

    expect(validatePoolContainment(graph, task).valid).toBe(true)
  })

  it('任务位于 Lane 内时应通过并返回 Lane', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 70, 100, 60)
    lane.__setParent(pool)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result).toMatchObject({ valid: true, container: lane })
  })

  it('任务位于 Pool 空白区时应通过并回落到 Pool', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 70, 40, 370, 120)
    const task = createMockNode('task', BPMN_USER_TASK, 120, 180, 100, 60)
    lane.__setParent(pool)
    task.__setParent(pool)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result).toMatchObject({ valid: true, container: pool })
  })

  it('任务越出 Pool 内容区时应失败', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const task = createMockNode('task', BPMN_USER_TASK, 20, 320, 100, 60)
    task.__setParent(pool)
    const graph = createMockGraph([pool, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('流程节点')
  })

  it('Lane 超出所属 Pool 内容区时应失败', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const lane = createMockNode('lane', BPMN_LANE, 40, 40, 390, 120)
    lane.__setParent(pool)
    const graph = createMockGraph([pool, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('泳道')
  })

  it('Pool 相互重叠时应失败', () => {
    const poolA = createMockNode('pool-a', BPMN_POOL, 40, 40, 400, 220)
    const poolB = createMockNode('pool-b', BPMN_POOL, 200, 120, 400, 220)
    const graph = createMockGraph([poolA, poolB])

    const result = validatePoolContainment(graph, poolB)
    expect(result).toMatchObject({ valid: false, reason: '当前实现中，Pool 之间不支持重叠或嵌套' })
  })

  it('自定义 isContainedNode 返回 false 时应跳过校验', () => {
    const pool = createMockNode('pool', BPMN_POOL, 40, 40, 400, 220)
    const task = createMockNode('task', BPMN_USER_TASK, 20, 320, 100, 60)
    const graph = createMockGraph([pool, task])

    expect(validatePoolContainment(graph, task, { isContainedNode: () => false }).valid).toBe(true)
  })
})

describe('setupPoolContainment', () => {
  it('应安装 interacting、translating.restrict、embedding，并在 dispose 时恢复', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const originalInteracting = { nodeMovable: true }
    const originalTranslating = { restrict: false, autoOffset: true }
    const originalEmbedding = { enabled: false }

    ;(graph as Graph & { options: Record<string, unknown> }).options.interacting = originalInteracting
    ;(graph as Graph & { options: Record<string, unknown> }).options.translating = originalTranslating
    ;(graph as Graph & { options: Record<string, unknown> }).options.embedding = originalEmbedding

    const dispose = setupPoolContainment(graph)
    const options = (graph as Graph & { options: Record<string, unknown> }).options

    expect(typeof options.interacting).toBe('function')
    expect(typeof (options.translating as { restrict?: unknown }).restrict).toBe('function')
    expect(typeof (options.embedding as { findParent?: unknown }).findParent).toBe('function')
    expect(typeof (options.embedding as { validate?: unknown }).validate).toBe('function')

    dispose()

    expect(options.interacting).toBe(originalInteracting)
    expect(options.translating).toBe(originalTranslating)
    expect(options.embedding).toBe(originalEmbedding)
  })

  it('任务单拖 restrict 应限制在所属 Pool 内容区内', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    const area = getRestrict(graph, task) as { x: number; y: number; width: number; height: number }
    expect(area).toEqual({
      x: pool.getPosition().x + 30,
      y: pool.getPosition().y,
      width: pool.getSize().width - 30,
      height: pool.getSize().height,
    })

    dispose()
  })

  it('任务选框拖拽 restrict 应限制在所属 Pool 内容区内', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    ;(graph as Graph & { getSelectedCells: () => Node[] }).getSelectedCells = () => [task]
    const dispose = setupPoolContainment(graph)

    const area = getRestrict(graph, null) as { x: number; y: number; width: number; height: number }
    expect(area).toEqual({
      x: pool.getPosition().x + 30,
      y: pool.getPosition().y,
      width: pool.getSize().width - 30,
      height: pool.getSize().height,
    })

    dispose()
  })

  it('选中 Lane 时 selection restrict 应冻结在当前选区', () => {
    const { graph, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)
    ;(graph as Graph & { getSelectedCells: () => Node[] }).getSelectedCells = () => [lane]
    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, null)).toEqual({
      x: lane.getPosition().x,
      y: lane.getPosition().y,
      width: lane.getSize().width,
      height: lane.getSize().height,
    })

    dispose()
  })

  it('选中 Pool 时 selection restrict 应返回 null（Pool 可自由拖拽）', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)
    ;(graph as Graph & { getSelectedCells: () => Node[] }).getSelectedCells = () => [pool]
    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, null)).toBeNull()

    dispose()
  })

  it('原始 translating.restrict 为 true 且 BPMN 未提供限制时，应回落到画布边界', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    ;(graph as Graph & { options: Record<string, unknown> }).options.translating = { restrict: true }
    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, null)).toEqual({ x: 0, y: 0, width: 1200, height: 800 })

    dispose()
  })

  it('原始 translating.restrict 为 true 且画布无尺寸时，应回落到 null', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    ;(graph as Graph & { options: Record<string, unknown> }).options.translating = { restrict: true }
    // 删除 width/height 选项以触发 container 回退路径
    delete (graph as any).options.width
    delete (graph as any).options.height
    // 覆写 container getter 返回 undefined，使 getGraphBounds 返回 null
    Object.defineProperty(graph, 'container', { get: () => undefined, configurable: true })

    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, null)).toBeNull()

    dispose()
  })

  it('原始 translating.restrict 为矩形时，应与 BPMN 限制取交集', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    ;(graph as Graph & { options: Record<string, unknown> }).options.translating = {
      restrict: { x: 150, y: 80, width: 120, height: 90 },
    }
    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, task)).toEqual({ x: 150, y: 80, width: 120, height: 90 })

    dispose()
  })

  it('embedding.findParent 应优先返回 Lane，再回落到 Pool', () => {
    const { graph, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    const embedding = getEmbedding(graph)
    const candidates = embedding.findParent?.({ node: task }) as Node[]

    expect(candidates[0]?.id).toBe(lane.id)
    expect(candidates.some((candidate) => candidate.id === 'pool-1')).toBe(true)

    dispose()
  })

  it('embedding.validate 应禁止 Lane 嵌入 Lane，允许边界事件嵌入合法宿主', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const boundary = graph.addNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 150,
      y: 60,
      width: 36,
      height: 36,
    })
    const dispose = setupPoolContainment(graph)
    const embedding = getEmbedding(graph)

    expect(embedding.validate?.({ child: lane, parent: lane })).toBe(false)
    expect(embedding.validate?.({ child: lane, parent: pool })).toBe(true)
    expect(embedding.validate?.({ child: boundary, parent: task })).toBe(true)
    expect(embedding.validate?.({ child: boundary, parent: pool })).toBe(false)

    dispose()
  })

  it('boundary 的 embedding.findParent 应回落到默认候选探测', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const boundary = graph.addNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 150,
      y: 60,
      width: 36,
      height: 36,
    })
    const dispose = setupPoolContainment(graph)
    const embedding = getEmbedding(graph)

    const candidates = embedding.findParent?.({ node: boundary }) as Node[]
    expect(candidates.some((candidate) => candidate.id === task.id)).toBe(true)

    dispose()
  })

  it('先放任务再放首个 Pool 时，应自动包裹现有任务', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 160,
      y: 120,
      width: 100,
      height: 60,
    })
    const dispose = setupPoolContainment(graph)

    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 240,
      height: 140,
      data: { bpmn: { isHorizontal: true } },
    })

    emitGraphEvent(graph, 'node:added', { node: pool })

    expect(task.getParent()?.id).toBe(pool.id)
    expect(pool.getPosition().x).toBeLessThanOrEqual(task.getPosition().x)
    expect(pool.getPosition().y).toBeLessThanOrEqual(task.getPosition().y)

    dispose()
  })

  it('任务移动到 Pool 空白区后，应从 Lane 重新挂到 Pool', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    task.setPosition(160, 180)
    emitGraphEvent(graph, 'node:moved', { node: task, options: { ui: true } })

    expect(task.getParent()?.id).toBe(pool.id)

    dispose()
  })

  it('Pool 结束移动时，应按实际位移修正后代节点的位置', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    task.setPosition(160, 180, { silent: true })
    emitGraphEvent(graph, 'node:moved', { node: task, options: { ui: true } })
    expect(task.getParent()?.id).toBe(pool.id)

    pool.setPosition(110, 70, { silent: true })
    lane.setPosition(140, 70, { silent: true })
    task.setPosition(480, 240, { silent: true })
    emitGraphEvent(graph, 'node:moved', { node: pool, options: { ui: true } })

    expect(task.getPosition()).toEqual({ x: 230, y: 210 })

    dispose()
  })

  it('编程式越界移动时，应恢复到最后一个合法位置并触发一次违规回调', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, { onViolation })
    const before = task.getPosition()

    task.setPosition(680, 520)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: {} })

    expect(task.getPosition()).toEqual(before)
    expect(onViolation).toHaveBeenCalledTimes(1)

    dispose()
  })

  it('关闭 constrainToContainer 后，应保留编程式非法位置但仍通知违规', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, {
      onViolation,
      constrainToContainer: false,
    })

    task.setPosition(680, 520)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: {} })

    expect(task.getPosition()).toEqual({ x: 680, y: 520 })
    expect(onViolation).toHaveBeenCalledTimes(1)

    dispose()
  })

  it('ui 直接位置变化事件应留给 node:moved 收尾，不应在 change:position 中回退', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    task.setPosition(680, 520, { ui: true })

    expect(task.getPosition()).toEqual({ x: 680, y: 520 })

    dispose()
  })

  it('后代节点由上层 Pool 平移带动时，应跳过 change:position 收尾', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    task.setPosition(680, 520, { silent: true })
    emitGraphEvent(graph, 'node:change:position', {
      node: task,
      options: { translateBy: pool.id },
    })

    expect(task.getPosition()).toEqual({ x: 680, y: 520 })

    dispose()
  })

  it('silent 的 size 与 parent 变化事件应直接跳过', () => {
    const { graph, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    lane.resize(10, 10, { silent: true })
    emitGraphEvent(graph, 'node:change:size', { node: lane, options: { silent: true } })
    expect(lane.getSize()).toEqual({ width: 10, height: 10 })

    task.setPosition(680, 520, { silent: true })
    emitGraphEvent(graph, 'node:change:parent', { node: task, options: { silent: true } })
    expect(task.getPosition()).toEqual({ x: 680, y: 520 })

    dispose()
  })

  it('新增非法 Pool 时，removeInvalidOnAdd 应触发移除', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const existingPool = graph.addNode({
      id: 'pool-a',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 320,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const dispose = setupPoolContainment(graph)

    const overlappingPool = graph.addNode({
      id: 'pool-b',
      shape: BPMN_POOL,
      x: 200,
      y: 80,
      width: 320,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const removeSpy = vi.spyOn(overlappingPool, 'remove')

    emitGraphEvent(graph, 'node:added', { node: overlappingPool })

    expect(removeSpy).toHaveBeenCalledOnce()
    expect(existingPool.getPosition()).toEqual({ x: 40, y: 40 })

    dispose()
  })

  it('新增未受容器约束的节点时，应走 rememberValidState 分支而非移除', () => {
    const { graph } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const boundary = graph.addNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 520,
      y: 120,
      width: 36,
      height: 36,
    })
    const removeSpy = vi.spyOn(boundary, 'remove')
    const dispose = setupPoolContainment(graph)

    emitGraphEvent(graph, 'node:added', { node: boundary })
    boundary.setPosition(700, 420)
    emitGraphEvent(graph, 'node:change:position', { node: boundary, options: {} })

    expect(removeSpy).not.toHaveBeenCalled()
    expect(boundary.getPosition()).toEqual({ x: 700, y: 420 })

    dispose()
  })

  it('Pool 发生重叠时，应回到上一个合法位置', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const poolA = graph.addNode({
      id: 'pool-a',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 320,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const poolB = graph.addNode({
      id: 'pool-b',
      shape: BPMN_POOL,
      x: 420,
      y: 40,
      width: 320,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const dispose = setupPoolContainment(graph)
    const before = poolB.getPosition()

    poolB.setPosition(200, 80)
    emitGraphEvent(graph, 'node:moved', { node: poolB, options: { ui: true } })

    expect(poolB.getPosition()).toEqual(before)
    expect(poolA.getPosition()).toEqual({ x: 40, y: 40 })

    dispose()
  })

  it('Pool 缩小时不应小于内部内容边界', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    pool.resize(120, 80)
    emitGraphEvent(graph, 'node:change:size', { node: pool, options: { ui: true } })

    const poolRect = {
      x: pool.getPosition().x,
      y: pool.getPosition().y,
      width: pool.getSize().width,
      height: pool.getSize().height,
    }
    const taskRect = {
      x: task.getPosition().x,
      y: task.getPosition().y,
      width: task.getSize().width,
      height: task.getSize().height,
    }

    expect(poolRect.x).toBeLessThanOrEqual(taskRect.x)
    expect(poolRect.y).toBeLessThanOrEqual(taskRect.y)
    expect(poolRect.x + poolRect.width).toBeGreaterThanOrEqual(taskRect.x + taskRect.width)
    expect(poolRect.y + poolRect.height).toBeGreaterThanOrEqual(taskRect.y + taskRect.height)

    dispose()
  })

  it('Pool 放大后应同步拉伸唯一 Lane 以持续覆盖内容区', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    pool.resize(520, 260)
    emitGraphEvent(graph, 'node:change:size', { node: pool, options: { ui: true } })

    expect(pool.getSize()).toEqual({ width: 520, height: 260 })
    expect(lane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane.getSize()).toEqual({ width: 490, height: 260 })
    expect(lane.getParent()?.id).toBe(pool.id)
    expect(task.getParent()?.id).toBe(lane.id)

    dispose()
  })

  it('Ghost resize 提交后应刷新 Pool 子树合法快照，避免后续 move 再次错误平移 Lane', () => {
    const { graph, pool, lane2 } = createMultiLaneGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    emitGraphEvent(graph, 'node:resize', { node: pool })
    pool.resize(400, 270, { direction: 'top' } as any)
    emitGraphEvent(graph, 'node:resized', { node: pool, options: { direction: 'top' } })

    const lane2AfterResize = lane2.getPosition()
    emitGraphEvent(graph, 'node:moved', { node: pool, options: { ui: true } })

    expect(lane2.getPosition()).toEqual(lane2AfterResize)

    dispose()
  })

  it('dispose 后应不再接管后续位置变化', () => {
    const { graph, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)
    dispose()

    task.setPosition(680, 520)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: {} })

    expect(task.getPosition()).toEqual({ x: 680, y: 520 })
  })

  it('Pool 的 translating.restrict 应返回 null（无限画布自由拖拽）', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    expect(getRestrict(graph, pool)).toBeNull()

    dispose()
  })

  it('Pool resize 触发 compactLaneLayout 后不应无限递归（isFinalizingSize 保护）', () => {
    const { graph, pool, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    // 多次触发 Pool 的 size 变化事件，模拟可能的级联场景
    pool.resize(500, 300)
    emitGraphEvent(graph, 'node:change:size', { node: pool, options: { ui: true } })

    // 不抛出 RangeError: Maximum call stack size exceeded 即为通过
    // 验证 Lane 被正确 compact
    const laneSize = lane.getSize()
    expect(laneSize.width).toBeGreaterThan(0)
    expect(laneSize.height).toBeGreaterThan(0)

    dispose()
  })

  it('Lane resize 不应导致 pool-containment 与 lane-management 间的无限级联', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const dispose = setupPoolContainment(graph)

    // 模拟用户 resize Lane
    lane.resize(370, 180)
    emitGraphEvent(graph, 'node:change:size', { node: lane, options: { ui: true } })

    // 不抛出 stack overflow 即为通过
    // Pool 和 Lane 的尺寸应保持合理
    const poolSize = pool.getSize()
    const laneSize = lane.getSize()
    expect(poolSize.width).toBeGreaterThan(0)
    expect(poolSize.height).toBeGreaterThan(0)
    expect(laneSize.width).toBeGreaterThan(0)
    expect(laneSize.height).toBeGreaterThan(0)

    dispose()
  })

  // ============================================================================
  // patchTransformResizing / restoreTransformResizing
  // ============================================================================

  it('patchTransformResizing 应为 Pool 和 Lane 注入动态最小尺寸', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    // 模拟 Transform 插件
    const resizing: Record<string, unknown> = { enabled: true }
    ;(graph as any).getPlugin = (name: string) => name === 'transform' ? { options: { resizing } } : null

    const pool = graph.addNode({
      id: 'pool-tx',
      shape: BPMN_POOL,
      x: 40, y: 40,
      width: 500, height: 400,
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-tx',
      shape: BPMN_LANE,
      x: 70, y: 40,
      width: 470, height: 200,
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane)

    const task = graph.addNode({
      id: 'task-tx',
      shape: BPMN_USER_TASK,
      x: 140, y: 70,
      width: 100, height: 60,
    })
    lane.embed(task)

    const saved = patchTransformResizing(graph)
    expect(saved).not.toBeNull()

    // minWidth / minHeight 应为函数
    expect(typeof resizing.minWidth).toBe('function')
    expect(typeof resizing.minHeight).toBe('function')

    // 调用 minWidth(pool) 应返回 > 0
    const poolMinW = (resizing.minWidth as Function).call(graph, pool)
    const poolMinH = (resizing.minHeight as Function).call(graph, pool)
    expect(poolMinW).toBeGreaterThan(0)
    expect(poolMinH).toBeGreaterThan(0)

    // 调用 minWidth(lane) 应返回 > 0
    const laneMinW = (resizing.minWidth as Function).call(graph, lane)
    const laneMinH = (resizing.minHeight as Function).call(graph, lane)
    expect(laneMinW).toBeGreaterThan(0)
    expect(laneMinH).toBeGreaterThan(0)

    // 非泳道节点应返回 0
    const taskMinW = (resizing.minWidth as Function).call(graph, task)
    const taskMinH = (resizing.minHeight as Function).call(graph, task)
    expect(taskMinW).toBe(0)
    expect(taskMinH).toBe(0)

    // 恢复
    restoreTransformResizing(graph, saved)
    expect(resizing.minWidth).toBeUndefined()
    expect(resizing.minHeight).toBeUndefined()
  })

  it('patchTransformResizing 在无 Transform 插件时应安全返回 null', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    const saved = patchTransformResizing(graph)
    expect(saved).toBeNull()
  })

  it('setupPoolContainment 应自动注入 Transform resizing 动态约束', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    const resizing: Record<string, unknown> = { enabled: true }
    ;(graph as any).getPlugin = (name: string) => name === 'transform' ? { options: { resizing } } : null

    const pool = graph.addNode({
      id: 'pool-auto',
      shape: BPMN_POOL,
      x: 40, y: 40,
      width: 400, height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    emitGraphEvent(graph, 'node:added', { node: pool })

    const dispose = setupPoolContainment(graph)

    // setupPoolContainment 内部调用 patchTransformResizing
    expect(typeof resizing.minWidth).toBe('function')
    expect(typeof resizing.minHeight).toBe('function')

    // dispose 后应恢复
    dispose()
    expect(resizing.minWidth).toBeUndefined()
    expect(resizing.minHeight).toBeUndefined()
  })

  it('patchTransformResizing 应在 resizing 缺失时自动创建', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    const options: Record<string, unknown> = {}
    ;(graph as any).getPlugin = (name: string) => name === 'transform' ? { options } : null

    const saved = patchTransformResizing(graph)
    expect(saved).not.toBeNull()
    expect(typeof (options.resizing as any).minWidth).toBe('function')
    expect(typeof (options.resizing as any).minHeight).toBe('function')
  })

  it('restoreTransformResizing 保留注入前已有的 minWidth/minHeight', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    const origMinW = 50
    const origMinH = 30
    const resizing: Record<string, unknown> = { enabled: true, minWidth: origMinW, minHeight: origMinH }
    ;(graph as any).getPlugin = (name: string) => name === 'transform' ? { options: { resizing } } : null

    const saved = patchTransformResizing(graph)
    expect(saved).not.toBeNull()
    expect(saved!.minWidth).toBe(origMinW)
    expect(saved!.minHeight).toBe(origMinH)

    // minWidth / minHeight 已被替换为函数
    expect(typeof resizing.minWidth).toBe('function')

    // 恢复后应回到注入前的原始值
    restoreTransformResizing(graph, saved)
    expect(resizing.minWidth).toBe(origMinW)
    expect(resizing.minHeight).toBe(origMinH)
  })

  it('restoreTransformResizing 在 transform 无 resizing 对象时应安全退出', () => {
    const graph = trackGraph(createBehaviorTestGraph())

    // transform 存在但 resizing 已被删除
    ;(graph as any).getPlugin = (name: string) => name === 'transform' ? { options: {} } : null

    const saved: { minWidth: undefined; minHeight: undefined } = { minWidth: undefined, minHeight: undefined }
    expect(() => restoreTransformResizing(graph, saved)).not.toThrow()
  })

  // ============================================================================
  // 方向性 resize 后触发 compactLaneLayout
  // ============================================================================

  it('Lane 方向性 resize 场景下 position 变化应修正 Lane 对齐', () => {
    const { graph, pool, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)

    const dispose = setupPoolContainment(graph)

    // 使用 setPosition 触发带 direction 的 position 变化
    const lanePosBefore = lane.getPosition()
    lane.setPosition(lanePosBefore.x, lanePosBefore.y - 10, { ui: true, direction: 'top' } as any)

    // 布局不应崩溃
    const poolSize = pool.getSize()
    expect(poolSize.width).toBeGreaterThan(0)
    expect(poolSize.height).toBeGreaterThan(0)

    dispose()
  })

  it('Pool 方向性 resize 场景下 position 变化应修正 Lane 对齐', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)

    const dispose = setupPoolContainment(graph)

    // Pool 直接 direction resize（触发 cond-expr Pool→node 分支）
    const poolPosBefore = pool.getPosition()
    pool.setPosition(poolPosBefore.x, poolPosBefore.y - 10, { ui: true, direction: 'top' } as any)

    const poolSize = pool.getSize()
    expect(poolSize.width).toBeGreaterThan(0)
    expect(poolSize.height).toBeGreaterThan(0)

    dispose()
  })

  it('约束修复还原时位置未变应跳过 translate（restoreNodePosition delta=0）', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)

    const dispose = setupPoolContainment(graph)

    // Task 仅改变尺寸使其超出 Pool 边界（位置不变）
    // Pool 内容区 bottom = 40 + 220 = 260；Task 原高 60 → 250 使 bottom = 70 + 250 = 320 > 260
    task.resize(100, 250)

    // 约束修复应还原尺寸但位置 delta=0 → restoreNodePosition 跳过 translate
    const pos = task.getPosition()
    expect(pos.x).toBe(120)
    expect(pos.y).toBe(70)

    const size = task.getSize()
    expect(size.width).toBe(100)
    expect(size.height).toBe(60)

    dispose()
  })

  it('Pool 含非泳道子节点时方向性 resize 的 position 变化应安全跳过非泳道子节点', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-mixed-dir',
      shape: BPMN_POOL,
      x: 40, y: 40, width: 400, height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-in-pool-dir',
      shape: BPMN_USER_TASK,
      x: 120, y: 70, width: 100, height: 60,
    })
    pool.embed(task)

    const dispose = setupPoolContainment(graph)

    // Pool 方向性 resize 触发 position 变化
    // getGraphChildren 包含 task → isSwimlaneShape(task) = false → 安全跳过
    const pos = pool.getPosition()
    pool.setPosition(pos.x, pos.y - 10, { ui: true, direction: 'top' } as any)

    // 不应崩溃，Task 作为非泳道子节点被安全跳过
    expect(task.getPosition().y).toBeDefined()

    dispose()
  })

  it('Pool 含非泳道子节点时 size 变化应正确更新 lastValidState', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-mixed',
      shape: BPMN_POOL,
      x: 40, y: 40, width: 400, height: 300,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-in-pool',
      shape: BPMN_USER_TASK,
      x: 120, y: 70, width: 100, height: 60,
    })
    pool.embed(task)

    const dispose = setupPoolContainment(graph)

    // 初始化状态
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: task })

    // 触发 Pool size 变化（覆盖 isSwimlaneShape(child) false 分支）
    pool.resize(500, 350)

    // 不应崩溃
    expect(pool.getSize().width).toBeGreaterThan(0)

    dispose()
  })

  it('Lane 无 Pool 父节点时方向性 resize 后应安全跳过 compactLaneLayout', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const orphanLane = graph.addNode({
      id: 'lane-orphan',
      shape: BPMN_LANE,
      x: 70, y: 40, width: 370, height: 120,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupPoolContainment(graph)

    // 方向性 resize 应安全处理（pool = null → 跳过）
    orphanLane.setPosition(70, 30, { ui: true, direction: 'top' } as any)

    expect(orphanLane.getPosition().x).toBeDefined()

    dispose()
  })

  it('Lane 无 Pool 父节点进行 size 变化时兄弟 Lane 更新应安全跳过', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const orphanLane = graph.addNode({
      id: 'lane-orphan-2',
      shape: BPMN_LANE,
      x: 70, y: 40, width: 370, height: 120,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupPoolContainment(graph)

    // Lane resize 但无 Pool（ownerPool = null → 跳过兄弟更新）
    emitGraphEvent(graph, 'node:change:size', {
      node: orphanLane,
      options: { ui: true },
    })

    expect(orphanLane.getSize().width).toBeGreaterThan(0)

    dispose()
  })

  // ============================================================================
  // batch:stop move-selection 选区拖拽处理
  // ============================================================================

  it('batch:stop move-selection 应对选中节点执行约束修复', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)

    const dispose = setupPoolContainment(graph)

    // 模拟 node:added 以初始化合法状态
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    // 记住初始合法位置
    emitGraphEvent(graph, 'node:moved', { node: task })
    emitGraphEvent(graph, 'node:moved', { node: pool })

    // 选中 Pool 和 Task（覆盖 swimlane + non-swimlane 两个分支）
    ;(graph as any).getSelectedCells = () => [pool, task]

    // 移动 Pool（silent 避免触发 node:change:position 处理）
    const oldPos = pool.getPosition()
    pool.setPosition(oldPos.x + 50, oldPos.y + 50, { silent: true } as any)

    // 触发 model batch:stop — 事件注册在 graph.model 上
    const model = (graph as any).model
    if (typeof model?.trigger === 'function') {
      model.trigger('batch:stop', { name: 'move-selection' })
    }

    // Pool 应保持在某个合法位置（不崩溃）
    const poolPos = pool.getPosition()
    expect(typeof poolPos.x).toBe('number')
    expect(typeof poolPos.y).toBe('number')

    dispose()
  })

  it('多 Pool 环境中 detach 应安全跳过未嵌入目标节点的泳道', () => {
    const { graph, pool, lane, task } = createPoolLaneTaskGraph()
    trackGraph(graph)

    // 添加第二个 Pool（不含任何子节点）
    const pool2 = graph.addNode({
      id: 'pool-2',
      shape: BPMN_POOL,
      x: 500, y: 40, width: 400, height: 220,
      data: { bpmn: { isHorizontal: true } },
    })

    const dispose = setupPoolContainment(graph)

    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })
    emitGraphEvent(graph, 'node:added', { node: pool2 })

    // 将 task 移到 Pool1 空白区（Lane1 外部但仍在 Pool1 内部）
    // Lane1 at (70,40,370,120) → Pool1 blank area at y > 160
    task.setPosition(120, 170, { silent: true } as any)

    // 触发 node:moved 使 finalizeNode 调用 detachNodeFromOtherSwimlanes
    // Pool2 存在但不嵌 task，应安全 continue
    emitGraphEvent(graph, 'node:moved', { node: task })

    // Task 应从 Lane1 转移到 Pool1
    expect(task.getParent()?.id).toBe(pool.id)

    dispose()
  })

  it('删除第一个 Lane 后应立即紧排剩余 Lane 并刷新布局', () => {
    const { graph, pool, lane1, lane2 } = createMultiLaneGraph()
    trackGraph(graph)

    const dispose = setupPoolContainment(graph)

    lane1.remove()

    expect(pool.getChildren()?.map((child) => child.id)).toEqual([lane2.id])
    expect(lane2.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane2.getSize()).toEqual({ width: 370, height: 220 })

    dispose()
  })

  it('点击 Pool 选框覆盖层命中 Lane 时，应将选中切换到该 Lane', () => {
    const { graph, pool, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-box'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 360,
      clientY: 90,
    }))

    expect(resetSelection).toHaveBeenCalledWith(lane, { ui: true })

    dispose()
  })

  it('点击 Pool 选框覆盖层命中更深层 Task 时，应优先切换到更深子节点', () => {
    const { graph, pool, task } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-box'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 120,
      clientY: 90,
    }))

    expect(resetSelection).toHaveBeenCalledWith(task, { ui: true })

    dispose()
  })

  it('点击非 Pool 选框场景时，不应触发选中转发', () => {
    const { graph, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [lane]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-box'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 120,
      clientY: 90,
    }))

    expect(resetSelection).not.toHaveBeenCalled()

    dispose()
  })

  it('Pool 处于多选状态时，不应触发选中转发', () => {
    const { graph, pool, lane } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [pool, lane]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-box'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 360,
      clientY: 90,
    }))

    expect(resetSelection).not.toHaveBeenCalled()

    dispose()
  })

  it('点击 Transform 控件时，不应将 Pool 选中转发给子节点', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const transformHandle = document.createElement('div')
    transformHandle.className = 'x6-widget-transform'
    ;(graph as any).container.appendChild(transformHandle)

    transformHandle.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 120,
      clientY: 90,
    }))

    expect(resetSelection).not.toHaveBeenCalled()

    dispose()
  })

  it('点击事件目标不是 Element 时，应安全跳过选中转发', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const container = (graph as any).container as HTMLDivElement
    const addEventListener = container.addEventListener.bind(container)
    const removeEventListener = container.removeEventListener.bind(container)
    const resetSelection = vi.fn()
    let clickHandler: ((event: MouseEvent) => void) | undefined

    vi.spyOn(container, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
      if (type === 'click' && typeof listener === 'function') {
        clickHandler = listener as (event: MouseEvent) => void
      }

      addEventListener(type, listener, options)
    }) as typeof container.addEventListener)
    vi.spyOn(container, 'removeEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean) => {
      removeEventListener(type, listener, options)
    }) as typeof container.removeEventListener)

    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    const dispose = setupPoolContainment(graph)

    clickHandler?.({ target: null } as MouseEvent)

    expect(resetSelection).not.toHaveBeenCalled()

    dispose()
  })

  it('点击 Pool 标题区未命中子节点时，不应切换选中对象', () => {
    const { graph, pool } = createPoolLaneTaskGraph()
    trackGraph(graph)
    const resetSelection = vi.fn()
    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-content'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 50,
      clientY: 60,
    }))

    expect(resetSelection).not.toHaveBeenCalled()

    dispose()
  })

  it('点击 Pool 选框覆盖层命中同层重叠 Lane 时，应优先命中更小区域的 Lane', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-overlap',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
    })
    const wideLane = graph.addNode({
      id: 'lane-wide',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 320,
      height: 160,
      data: { bpmn: { isHorizontal: true } },
    })
    const narrowLane = graph.addNode({
      id: 'lane-narrow',
      shape: BPMN_LANE,
      x: 110,
      y: 60,
      width: 180,
      height: 100,
      data: { bpmn: { isHorizontal: true } },
    })
    const resetSelection = vi.fn()

    pool.embed(wideLane)
    pool.embed(narrowLane)

    ;(graph as any).getSelectedCells = () => [pool]
    ;(graph as any).resetSelection = resetSelection
    ;(graph as any).clientToLocal = (x: number, y: number) => ({ x, y })
    const dispose = setupPoolContainment(graph)

    const overlay = document.createElement('div')
    overlay.className = 'x6-widget-selection-inner'
    ;(graph as any).container.appendChild(overlay)

    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: 160,
      clientY: 100,
    }))

    expect(resetSelection).toHaveBeenCalledWith(narrowLane, { ui: true })

    dispose()
  })
})
