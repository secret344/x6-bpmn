/**
 * Pool / Participant 容器约束行为 — 兜底分支测试
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  setupPoolContainment,
  validatePoolContainment,
} from '../../../src/behaviors/pool-containment'
import { getAncestorSwimlane } from '../../../src/core/swimlane-membership'
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

type MockNodeOptions = {
  id: string
  shape: string
  x: number
  y: number
  width: number
  height: number
  data?: unknown
  throwOnGetChildren?: boolean
  throwOnGetData?: boolean
  withTranslate?: boolean
  withResize?: boolean
  withSetSize?: boolean
}

type MockNode = ReturnType<typeof createMockNode>

function createMockNode({
  id,
  shape,
  x,
  y,
  width,
  height,
  data,
  throwOnGetChildren = false,
  throwOnGetData = false,
  withTranslate = true,
  withResize = true,
  withSetSize = true,
}: MockNodeOptions) {
  let position = { x, y }
  let size = { width, height }
  let parent: unknown = null
  let children: unknown[] = []
  let removed = false

  const self = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    getData: () => {
      if (throwOnGetData) {
        throw new Error('getData failed')
      }
      return data
    },
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    resize: withResize
      ? vi.fn((nextWidth: number, nextHeight: number) => {
          size = { width: nextWidth, height: nextHeight }
        })
      : undefined,
    setSize: withSetSize
      ? vi.fn((nextWidth: number, nextHeight: number) => {
          size = { width: nextWidth, height: nextHeight }
        })
      : undefined,
    translate: withTranslate
      ? vi.fn((deltaX: number, deltaY: number) => {
          position = { x: position.x + deltaX, y: position.y + deltaY }
        })
      : undefined,
    getParent: () => parent,
    getChildren: () => {
      if (throwOnGetChildren) {
        throw new Error('getChildren failed')
      }
      return [...children] as unknown[]
    },
    embed: vi.fn((child: { __setParent: (nextParent: unknown) => void; id: string }) => {
      if (!(children as Array<{ id: string }>).some((candidate) => candidate.id === child.id)) {
        children = [...children, child]
      }
      child.__setParent(self)
    }),
    unembed: vi.fn((child: { __setParent: (nextParent: unknown) => void; id: string }) => {
      children = (children as Array<{ id: string }>).filter((candidate) => candidate.id !== child.id)
      const childParent = (child as { getParent?: () => { id?: string } | null }).getParent?.()
      if (childParent?.id === self.id) {
        child.__setParent(null)
      }
    }),
    remove: vi.fn(() => {
      removed = true
    }),
    isNode: () => true,
    __setParent: (nextParent: unknown) => {
      parent = nextParent
    },
    __setSize: (nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    },
    __isRemoved: () => removed,
  }

  return self
}

function attachChild(parent: MockNode, child: MockNode): void {
  parent.embed(child)
}

type MockGraphOptions = {
  nodes?: MockNode[]
  options?: Record<string, unknown>
  container?: HTMLElement | null
  throwGetNodesTimes?: number
  getSelectedCells?: () => Cell[]
  getNodesUnderNode?: (node: Node, options?: { by?: string }) => Cell[]
  getCellById?: (id: string) => Cell | null
}

function createMockGraph({
  nodes = [],
  options = {},
  container = null,
  throwGetNodesTimes = 0,
  getSelectedCells,
  getNodesUnderNode,
  getCellById,
}: MockGraphOptions = {}) {
  const handlers: Record<string, Array<(payload: unknown) => void>> = {}
  const modelHandlers: Record<string, Array<(payload: unknown) => void>> = {}
  let remainingThrowCount = throwGetNodesTimes

  const graph = {
    options,
    container,
    model: {
      on: (event: string, handler: (payload: unknown) => void) => {
        modelHandlers[event] = modelHandlers[event] || []
        modelHandlers[event].push(handler)
      },
      off: (event: string, handler: (payload: unknown) => void) => {
        modelHandlers[event] = (modelHandlers[event] || []).filter((candidate) => candidate !== handler)
      },
      trigger: (event: string, payload: unknown) => {
        for (const handler of modelHandlers[event] || []) {
          handler(payload)
        }
      },
    },
    getNodes: () => {
      if (remainingThrowCount > 0) {
        remainingThrowCount -= 1
        throw new Error('getNodes failed')
      }
      return nodes
    },
    getCellById: (id: string) => getCellById?.(id) ?? nodes.find((node) => node.id === id) ?? null,
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(handler)
    },
    off: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = (handlers[event] || []).filter((candidate) => candidate !== handler)
    },
    emit: (event: string, payload: unknown) => {
      for (const handler of handlers[event] || []) {
        handler(payload)
      }
    },
  } as Graph & {
    options: Record<string, unknown>
    emit: (event: string, payload: unknown) => void
    getNodes: () => MockNode[]
  }

  if (getSelectedCells) {
    ;(graph as Graph & { getSelectedCells: () => Cell[] }).getSelectedCells = getSelectedCells
  }

  if (getNodesUnderNode) {
    const graphWithNodesUnder = graph as Graph & {
      getNodesUnderNode: (node: Node, options?: { by?: string }) => Cell[]
    }
    graphWithNodesUnder.getNodesUnderNode = getNodesUnderNode
  }

  return { graph, nodes }
}

function callRestrict(graph: Graph, input: unknown) {
  const graphWithOptions = graph as Graph & {
    options: { translating?: { restrict?: (cellView: unknown) => unknown } }
  }
  const restrict = graphWithOptions.options.translating?.restrict

  if (typeof restrict !== 'function') {
    throw new Error('未安装 translating.restrict')
  }

  return restrict.call(graph, input)
}

function getEmbedding(graph: Graph) {
  const graphWithOptions = graph as Graph & {
    options: {
      embedding?: {
        findParent?: (args: { node: Node }) => Cell[]
        validate?: (args: { child: Node; parent: Node }) => boolean
      }
    }
  }
  const embedding = graphWithOptions.options.embedding

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
  vi.restoreAllMocks()
  while (graphsToDispose.length > 0) {
    destroyBehaviorTestGraph(graphsToDispose.pop() as Graph)
  }
})

describe('pool containment fallback branches', () => {
  it('应覆盖垂直 Pool、自定义原因与非泳道父节点回溯', () => {
    const pool = createMockNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 180,
      data: { bpmn: { isHorizontal: false } },
    })
    const lane = createMockNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 40,
      y: 70,
      width: 260,
      height: 100,
    })
    const group = createMockNode({
      id: 'group-1',
      shape: 'group',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
    const task = createMockNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 80,
      y: 205,
      width: 80,
      height: 40,
    })
    const graph = createMockGraph({ nodes: [pool, lane, group, task] }).graph

    attachChild(pool, group)
    attachChild(group, task)

    expect(getAncestorSwimlane(task)?.id).toBe(pool.id)

    const invalidResult = validatePoolContainment(graph, task, { reason: '自定义原因' })
    expect(invalidResult).toMatchObject({ valid: false, reason: '自定义原因' })

    const freeLane = createMockNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 40,
      y: 175,
      width: 260,
      height: 40,
    })
    const validFreeLaneResult = validatePoolContainment(graph, freeLane)
    expect(validFreeLaneResult).toMatchObject({ valid: true, container: pool })

    const owningPool = createMockNode({ id: 'pool-3', shape: BPMN_POOL, x: 40, y: 40, width: 320, height: 180 })
    const smallerPool = createMockNode({ id: 'pool-4', shape: BPMN_POOL, x: 80, y: 40, width: 240, height: 140 })
    const overlappingLane = createMockNode({
      id: 'lane-5',
      shape: BPMN_LANE,
      x: 110,
      y: 40,
      width: 190,
      height: 80,
    })
    const overlapGraph = createMockGraph({ nodes: [owningPool, smallerPool, overlappingLane] }).graph
    attachChild(owningPool, overlappingLane)

    expect(validatePoolContainment(overlapGraph, overlappingLane)).toMatchObject({
      valid: true,
      container: owningPool,
    })

    const invalidFreeLane = createMockNode({
      id: 'lane-3',
      shape: BPMN_LANE,
      x: 10,
      y: 10,
      width: 120,
      height: 80,
      throwOnGetData: true,
    })
    expect(validatePoolContainment(graph, invalidFreeLane).valid).toBe(false)

    const throwingPool = createMockNode({
      id: 'pool-2',
      shape: BPMN_POOL,
      x: 360,
      y: 40,
      width: 260,
      height: 180,
      throwOnGetData: true,
    })
    const ownedLane = createMockNode({
      id: 'lane-4',
      shape: BPMN_LANE,
      x: 390,
      y: 40,
      width: 230,
      height: 80,
    })
    const throwingGraph = createMockGraph({ nodes: [throwingPool, ownedLane] }).graph
    attachChild(throwingPool, ownedLane)

    expect(validatePoolContainment(throwingGraph, ownedLane).valid).toBe(true)
  })

  it('应覆盖无图边界、无选区函数、Boundary 与孤立节点的 restrict 兜底', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 220, height: 160 })
    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 190, height: 100 })
    const boundary = createMockNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 140,
      y: 70,
      width: 36,
      height: 36,
    })
    const orphanTask = createMockNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 420,
      y: 240,
      width: 90,
      height: 50,
    })
    const { graph } = createMockGraph({ nodes: [pool, lane, boundary, orphanTask] })
    attachChild(pool, lane)

    const dispose = setupPoolContainment(graph)

    expect(callRestrict(graph, null)).toBeNull()
    expect(callRestrict(graph, {})).toBeNull()
    expect(callRestrict(graph, { cell: pool })).toBeNull()
    expect(callRestrict(graph, { cell: lane })).toEqual({ x: 70, y: 40, width: 190, height: 100 })
    expect(callRestrict(graph, { cell: boundary })).toBeNull()
    expect(callRestrict(graph, { cell: orphanTask })).toEqual({ x: 420, y: 240, width: 90, height: 50 })

    dispose()

    expect((graph as Graph & { options: Record<string, unknown> }).options.translating).toBeUndefined()
    expect((graph as Graph & { options: Record<string, unknown> }).options.embedding).toBeUndefined()
  })

  it('应覆盖选区获取异常、Pool 选区回退、Boundary-only 与跨 Pool 选区', () => {
    const poolA = createMockNode({ id: 'pool-a', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const poolB = createMockNode({ id: 'pool-b', shape: BPMN_POOL, x: 360, y: 40, width: 260, height: 160 })
    const taskA = createMockNode({ id: 'task-a', shape: BPMN_USER_TASK, x: 100, y: 80, width: 80, height: 40 })
    const taskB = createMockNode({ id: 'task-b', shape: BPMN_USER_TASK, x: 430, y: 90, width: 80, height: 40 })
    const boundary = createMockNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 150,
      y: 70,
      width: 36,
      height: 36,
    })
    const orphanTask = createMockNode({
      id: 'task-orphan',
      shape: BPMN_USER_TASK,
      x: 720,
      y: 320,
      width: 80,
      height: 40,
    })
    const selectedCells: { current: Cell[] | null } = { current: null }
    const { graph } = createMockGraph({
      nodes: [poolA, poolB, taskA, taskB, boundary, orphanTask],
      getSelectedCells: () => {
        if (selectedCells.current === null) {
          throw new Error('selection failed')
        }
        return selectedCells.current
      },
    })
    attachChild(poolA, taskA)
    attachChild(poolB, taskB)

    const dispose = setupPoolContainment(graph)

    expect(callRestrict(graph, null)).toBeNull()

    selectedCells.current = [poolA as unknown as Cell]
    expect(callRestrict(graph, null)).toBeNull()

    selectedCells.current = [boundary as unknown as Cell]
    expect(callRestrict(graph, null)).toBeNull()

    selectedCells.current = [taskA as unknown as Cell, taskB as unknown as Cell]
    expect(callRestrict(graph, null)).toEqual({ x: 100, y: 80, width: 410, height: 50 })

    selectedCells.current = [orphanTask as unknown as Cell]
    expect(callRestrict(graph, null)).toEqual({ x: 720, y: 320, width: 80, height: 40 })

    dispose()
  })

  it('应覆盖垂直 Pool 内容区、getData 异常回退、图边界 restrict 与 Lane 回溯 owning Pool', () => {
    const verticalPool = createMockNode({
      id: 'pool-vertical',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 160,
      data: { bpmn: { isHorizontal: false } },
    })
    const verticalTask = createMockNode({
      id: 'task-vertical',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 100,
      width: 80,
      height: 40,
    })
    const { graph: verticalGraph } = createMockGraph({ nodes: [verticalPool, verticalTask] })
    attachChild(verticalPool, verticalTask)
    const disposeVertical = setupPoolContainment(verticalGraph)

    expect(callRestrict(verticalGraph, { cell: verticalTask })).toEqual({ x: 40, y: 70, width: 260, height: 130 })
    disposeVertical()

    const throwingPool = createMockNode({
      id: 'pool-throwing',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 160,
      throwOnGetData: true,
    })
    const fallbackTask = createMockNode({
      id: 'task-fallback',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 100,
      width: 80,
      height: 40,
    })
    const { graph: fallbackGraph } = createMockGraph({ nodes: [throwingPool, fallbackTask] })
    attachChild(throwingPool, fallbackTask)
    const disposeFallback = setupPoolContainment(fallbackGraph)

    expect(callRestrict(fallbackGraph, { cell: fallbackTask })).toEqual({ x: 70, y: 40, width: 230, height: 160 })
    disposeFallback()

    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 230, height: 100 })
    const looseTask = createMockNode({ id: 'task-loose', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const freeTask = createMockNode({ id: 'task-free', shape: BPMN_USER_TASK, x: 120, y: 150, width: 80, height: 40 })
    attachChild(pool, lane)
    const { graph: laneFallbackGraph } = createMockGraph({ nodes: [pool, lane, looseTask, freeTask] })
    const disposeLaneFallback = setupPoolContainment(laneFallbackGraph)

    expect(callRestrict(laneFallbackGraph, { cell: looseTask })).toEqual({ x: 70, y: 40, width: 230, height: 160 })
    expect(callRestrict(laneFallbackGraph, { cell: freeTask })).toEqual({ x: 70, y: 40, width: 230, height: 160 })
    disposeLaneFallback()

    const { graph: graphBoundsGraph } = createMockGraph({
      nodes: [pool],
      options: {
        width: 900,
        height: 600,
        translating: { restrict: true },
      },
    })
    const disposeGraphBounds = setupPoolContainment(graphBoundsGraph)

    expect(callRestrict(graphBoundsGraph, { cell: pool })).toEqual({ x: 0, y: 0, width: 900, height: 600 })
    disposeGraphBounds()
  })

  it('应覆盖 getNodes 失败时的 embedding 候选回退', () => {
    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 230, height: 100 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const { graph } = createMockGraph({
      nodes: [lane, task],
      options: { embedding: { findParent: 'center' } },
      throwGetNodesTimes: 50,
    })

    const dispose = setupPoolContainment(graph)
    const embedding = getEmbedding(graph)

    expect(embedding.findParent?.({ node: task as unknown as Node })).toEqual([])

    dispose()
  })

  it('应覆盖原始 restrict 函数、数字与无交集矩形合并', () => {
    const looseTask = createMockNode({
      id: 'task-loose',
      shape: BPMN_USER_TASK,
      x: 420,
      y: 240,
      width: 90,
      height: 50,
    })
    const { graph: looseGraph } = createMockGraph({
      nodes: [looseTask],
      options: {
        translating: {
          restrict(cellView: unknown) {
            return cellView ? 7 : null
          },
        },
      },
    })
    const disposeLoose = setupPoolContainment(looseGraph)

    expect(callRestrict(looseGraph, {})).toBe(7)
    disposeLoose()

    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 90, height: 50 })
    const { graph } = createMockGraph({
      nodes: [pool, task],
      options: {
        width: 1200,
        height: 800,
        translating: {
          restrict: { x: 600, y: 500, width: 100, height: 80 },
        },
      },
    })
    attachChild(pool, task)

    const dispose = setupPoolContainment(graph)

    expect(callRestrict(graph, { cell: task })).toEqual({ x: 70, y: 40, width: 230, height: 160 })

    dispose()
  })

  it('应覆盖 embedding.findParent 的原始函数、字符串回退与 BPMN 候选集', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 300, height: 180 })
    const outerPool = createMockNode({ id: 'pool-2', shape: BPMN_POOL, x: 20, y: 20, width: 360, height: 220 })
    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 270, height: 100 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const boundary = createMockNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 130,
      y: 70,
      width: 36,
      height: 36,
    })
    const customNode = createMockNode({ id: 'custom-1', shape: 'custom-node', x: 120, y: 80, width: 60, height: 30 })
    attachChild(pool, lane)
    attachChild(lane, task)

    const { graph: functionGraph } = createMockGraph({
      nodes: [pool, outerPool, lane, task, customNode],
      options: {
        embedding: {
          findParent: ({ node }: { node: Node }) => [node.id === customNode.id ? (task as unknown as Cell) : (pool as unknown as Cell)],
        },
      },
    })
    const disposeFunction = setupPoolContainment(functionGraph, { isContainedNode: () => false })
    const functionEmbedding = getEmbedding(functionGraph)

    expect(functionEmbedding.findParent?.({ node: customNode as unknown as Node })).toEqual([task])
    disposeFunction()

    const { graph: stringGraph } = createMockGraph({
      nodes: [pool, outerPool, lane, task, boundary],
      options: { embedding: { findParent: 'center' } },
      getNodesUnderNode: () => {
        throw new Error('under-node failed')
      },
    })
    const disposeString = setupPoolContainment(stringGraph)
    const stringEmbedding = getEmbedding(stringGraph)

    const boundaryCandidates = stringEmbedding.findParent?.({ node: boundary as unknown as Node }) as Cell[]
    expect(boundaryCandidates.map((candidate) => candidate.id)).toContain(task.id)

    disposeString()

    const { graph: plainGraph } = createMockGraph({ nodes: [pool, outerPool, lane, task] })
    const disposePlain = setupPoolContainment(plainGraph)
    const plainEmbedding = getEmbedding(plainGraph)

    expect((plainEmbedding.findParent?.({ node: pool as unknown as Node }) as Cell[]).length).toBeGreaterThan(0)
    expect((plainEmbedding.findParent?.({ node: lane as unknown as Node }) as Cell[])[0]?.id).toBe(pool.id)

    disposePlain()

    const { graph: stringWithoutHelperGraph } = createMockGraph({
      nodes: [pool, task, boundary],
      options: { embedding: { findParent: 'center' } },
    })
    const disposeStringWithoutHelper = setupPoolContainment(stringWithoutHelperGraph)
    const stringWithoutHelperEmbedding = getEmbedding(stringWithoutHelperGraph)

    expect(
      (stringWithoutHelperEmbedding.findParent?.({ node: boundary as unknown as Node }) as Cell[]).map(
        (candidate) => candidate.id,
      ),
    ).toContain(task.id)

    disposeStringWithoutHelper()
  })

  it('应覆盖 embedding.validate 的 Pool、普通任务、自定义放行与原始否决分支', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 300, height: 180 })
    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 270, height: 100 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const customNode = createMockNode({ id: 'custom-1', shape: 'custom-node', x: 120, y: 80, width: 60, height: 30 })
    const { graph } = createMockGraph({ nodes: [pool, lane, task] })
    const dispose = setupPoolContainment(graph)
    const embedding = getEmbedding(graph)

    expect(embedding.validate?.({ child: pool as unknown as Node, parent: lane as unknown as Node })).toBe(false)
    expect(embedding.validate?.({ child: task as unknown as Node, parent: task as unknown as Node })).toBe(false)
    dispose()

    const { graph: customGraph } = createMockGraph({ nodes: [pool, customNode] })
    const disposeCustom = setupPoolContainment(customGraph, { isContainedNode: () => false })
    const customEmbedding = getEmbedding(customGraph)

    expect(
      customEmbedding.validate?.({ child: customNode as unknown as Node, parent: task as unknown as Node }),
    ).toBe(true)
    disposeCustom()

    const { graph: originalValidateGraph } = createMockGraph({
      nodes: [pool, lane],
      options: {
        embedding: {
          validate: () => false,
        },
      },
    })
    const disposeOriginalValidate = setupPoolContainment(originalValidateGraph)
    const originalValidateEmbedding = getEmbedding(originalValidateGraph)

    expect(
      originalValidateEmbedding.validate?.({ child: lane as unknown as Node, parent: pool as unknown as Node }),
    ).toBe(false)

    disposeOriginalValidate()
  })

  it('应在预热快照缺失时跳过恢复，并对重复违规去重通知', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const { graph } = createMockGraph({
      nodes: [pool, task],
      options: { width: 1200, height: 800 },
      throwGetNodesTimes: 1,
    })
    attachChild(pool, task)
    const onViolation = vi.fn()
    setupPoolContainment(graph, { onViolation })

    task.setPosition(720, 520)
    graph.emit('node:change:position', { node: task, options: {} })
    expect(task.getPosition()).toEqual({ x: 720, y: 520 })

    graph.emit('node:change:position', { node: task, options: {} })
    expect(onViolation).toHaveBeenCalledTimes(1)
  })

  it('应覆盖 setPosition / setSize 恢复、异常 children 查询与重新挂载', () => {
    const pool = createMockNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 260,
      height: 160,
      throwOnGetChildren: true,
    })
    const task = createMockNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 80,
      width: 80,
      height: 40,
      withTranslate: false,
      withResize: false,
      withSetSize: true,
    })
    const { graph } = createMockGraph({ nodes: [pool, task], options: { width: 1200, height: 800 } })
    attachChild(pool, task)
    setupPoolContainment(graph)

    graph.emit('node:change:position', { node: task, options: {} })

    task.__setParent(null)
    task.setPosition(620, 420)
    task.setSize?.(20, 20)
    graph.emit('node:change:size', { node: task, options: {} })

    expect(task.getPosition()).toEqual({ x: 120, y: 80 })
    expect(task.getSize()).toEqual({ width: 80, height: 40 })
    expect(task.getParent()?.id).toBe(pool.id)
  })

  it('非法 size 变更应恢复任务，并走非泳道 geometry 收尾分支', () => {
    const graph = trackGraph(createBehaviorTestGraph())
    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 320,
      height: 180,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 80,
      width: 100,
      height: 60,
    })
    pool.embed(task)
    setupPoolContainment(graph)

    task.setPosition(720, 520, { silent: true })
    task.resize(180, 100)
    emitGraphEvent(graph, 'node:change:size', { node: task, options: {} })

    expect(task.getPosition()).toEqual({ x: 120, y: 80 })
    expect(task.getSize()).toEqual({ width: 100, height: 60 })
  })

  it('translateBy 查找失败或回退查找时应分别执行恢复与跳过', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    const { graph } = createMockGraph({
      nodes: [pool, task],
      options: { width: 1200, height: 800 },
      getCellById: () => {
        throw new Error('getCellById failed')
      },
    })
    attachChild(pool, task)
    setupPoolContainment(graph)

    task.setPosition(720, 520)
    graph.emit('node:change:position', { node: task, options: { translateBy: 'missing' } })
    expect(task.getPosition()).toEqual({ x: 120, y: 80 })

    task.__setParent(null)
    task.setPosition(720, 520, { silent: true })
    graph.emit('node:change:position', { node: task, options: { translateBy: pool.id } })
    expect(task.getPosition()).toEqual({ x: 120, y: 80 })

    attachChild(pool, task)
    task.setPosition(720, 520, { silent: true })
    graph.emit('node:change:position', { node: task, options: { translateBy: pool.id } })
    expect(task.getPosition()).toEqual({ x: 720, y: 520 })
  })

  it('batch:stop move-selection 在无选区服务或选区查询异常时应安全跳过', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const task = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 120, y: 80, width: 80, height: 40 })
    attachChild(pool, task)

    const missingSelectionGraph = createMockGraph({
      nodes: [pool, task],
      options: { width: 1200, height: 800 },
    }).graph
    const disposeMissingSelection = setupPoolContainment(missingSelectionGraph)

    expect(() => {
      ;(missingSelectionGraph as Graph & { model: { trigger: (event: string, payload: unknown) => void } }).model.trigger(
        'batch:stop',
        { name: 'move-selection' },
      )
    }).not.toThrow()
    expect(task.getPosition()).toEqual({ x: 120, y: 80 })
    disposeMissingSelection()

    const throwingSelectionGraph = createMockGraph({
      nodes: [pool, task],
      options: { width: 1200, height: 800 },
      getSelectedCells: () => {
        throw new Error('selection failed')
      },
    }).graph
    const disposeThrowingSelection = setupPoolContainment(throwingSelectionGraph)

    expect(() => {
      ;(throwingSelectionGraph as Graph & { model: { trigger: (event: string, payload: unknown) => void } }).model.trigger(
        'batch:stop',
        { name: 'move-selection' },
      )
    }).not.toThrow()
    expect(task.getPosition()).toEqual({ x: 120, y: 80 })

    disposeThrowingSelection()
  })

  it('无 options 图与非节点 getCellById 结果应走守卫回退分支', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 260, height: 160 })
    const task = createMockNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 80,
      width: 80,
      height: 40,
      withTranslate: false,
      withResize: false,
      withSetSize: false,
    })
    const { graph } = createMockGraph({
      nodes: [pool, task],
      getCellById: () => ({ isNode: () => false } as unknown as Cell),
    })
    ;(graph as Graph & { options?: Record<string, unknown> }).options = undefined

    const dispose = setupPoolContainment(graph)
    expect(dispose).toBeTypeOf('function')
    dispose()

    const activeGraph = createMockGraph({
      nodes: [pool, task],
      options: { width: 1200, height: 800 },
      getCellById: () => ({ isNode: () => false } as unknown as Cell),
    }).graph
    attachChild(pool, task)
    setupPoolContainment(activeGraph)

    task.setPosition(620, 420)
    task.__setSize(20, 20)
    activeGraph.emit('node:change:size', { node: task, options: {} })
    expect(task.getPosition()).toEqual({ x: 120, y: 80 })

    activeGraph.emit('node:change:position', { node: task, options: { translateBy: pool.id } })
    activeGraph.emit('node:change:position', { node: task, options: { silent: true } })
  })

  it('Pool 移动时应跳过无快照后代，并仅记录非受控后代的新状态', () => {
    const pool = createMockNode({ id: 'pool-1', shape: BPMN_POOL, x: 40, y: 40, width: 300, height: 180 })
    const boundary = createMockNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 120,
      y: 70,
      width: 36,
      height: 36,
    })
    const lateTask = createMockNode({ id: 'task-2', shape: BPMN_USER_TASK, x: 180, y: 90, width: 80, height: 40 })
    const nodes = [pool, boundary]
    const { graph } = createMockGraph({ nodes, options: { width: 1200, height: 800 } })
    attachChild(pool, boundary)
    setupPoolContainment(graph)

    nodes.push(lateTask)
    attachChild(pool, lateTask)
    pool.setPosition(100, 80)
    graph.emit('node:moved', { node: pool, options: { ui: true } })

    expect(boundary.getPosition()).toEqual({ x: 120, y: 70 })
    expect(lateTask.getPosition()).toEqual({ x: 180, y: 90 })
  })

  it('新增节点分支应覆盖 Lane 合法新增与非法新增保留', () => {
    const poolA = createMockNode({ id: 'pool-a', shape: BPMN_POOL, x: 40, y: 40, width: 300, height: 180 })
    const poolB = createMockNode({ id: 'pool-b', shape: BPMN_POOL, x: 420, y: 40, width: 300, height: 180 })
    const nodes = [poolA, poolB]
    const { graph } = createMockGraph({ nodes, options: { width: 1200, height: 800 } })
    setupPoolContainment(graph, { removeInvalidOnAdd: false })

    const lane = createMockNode({ id: 'lane-1', shape: BPMN_LANE, x: 70, y: 40, width: 270, height: 100 })
    nodes.push(lane)
    graph.emit('node:added', { node: lane })
    expect(lane.getParent()?.id).toBe(poolA.id)

    const invalidTask = createMockNode({ id: 'task-1', shape: BPMN_USER_TASK, x: 900, y: 520, width: 80, height: 40 })
    nodes.push(invalidTask)
    graph.emit('node:added', { node: invalidTask })
    expect(invalidTask.remove).not.toHaveBeenCalled()

    const overlappingPool = createMockNode({ id: 'pool-c', shape: BPMN_POOL, x: 200, y: 80, width: 300, height: 180 })
    nodes.push(overlappingPool)
    graph.emit('node:added', { node: overlappingPool })
    expect(overlappingPool.remove).not.toHaveBeenCalled()
  })
})