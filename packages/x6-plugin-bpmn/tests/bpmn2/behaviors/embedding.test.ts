import { describe, expect, it } from 'vitest'

import {
  clearMovingBpmnNode,
  DEFAULT_EMBEDDABLE_CONTAINER_SHAPES,
  findBoundaryAttachHost,
  findContainingBpmnParent,
  isEmbeddableContainerShape,
  markMovingBpmnNode,
  resolveBpmnDropAction,
  resolveBpmnEmbeddingTargets,
  resolveContainingBpmnParents,
} from '../../../src/behaviors/embedding'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_GROUP,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

function createMockNode(
  id: string,
  shape: string,
  rect: { x: number; y: number; width: number; height: number },
  parent: { id: string; shape: string; getParent?: () => unknown; isNode?: () => boolean } | null = null,
) {
  return {
    id,
    shape,
    getParent: () => parent,
    isNode: () => true,
    getBBox: () => ({
      ...rect,
      containsRect(other: { x: number; y: number; width: number; height: number }) {
        return other.x >= rect.x
          && other.y >= rect.y
          && other.x + other.width <= rect.x + rect.width
          && other.y + other.height <= rect.y + rect.height
      },
    }),
  }
}

describe('embedding helpers', () => {
  it('应识别主库内置可嵌入容器图形', () => {
    expect(DEFAULT_EMBEDDABLE_CONTAINER_SHAPES.has(BPMN_POOL)).toBe(true)
    expect(isEmbeddableContainerShape(BPMN_GROUP)).toBe(true)
    expect(isEmbeddableContainerShape(BPMN_TRANSACTION)).toBe(true)
    expect(isEmbeddableContainerShape(BPMN_USER_TASK)).toBe(false)
  })

  it('普通流程节点应按面积从小到大返回可包含容器', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 500, height: 300 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 40, width: 470, height: 180 })
    const subProcess = createMockNode('sub', BPMN_SUB_PROCESS, { x: 120, y: 80, width: 220, height: 140 })
    const task = createMockNode('task', BPMN_USER_TASK, { x: 160, y: 110, width: 100, height: 60 })
    const graph = { getNodes: () => [pool, lane, subProcess, task] } as const

    const candidates = resolveContainingBpmnParents(graph as never, task as never)

    expect(candidates.map((node) => node.id)).toEqual(['sub', 'lane', 'pool'])
    expect(findContainingBpmnParent(graph as never, task as never)?.id).toBe('sub')
    expect(resolveBpmnEmbeddingTargets(graph as never, task as never).map((node) => node.id)).toEqual(['sub', 'lane', 'pool'])
  })

  it('事务内部节点仍在事务框内时，自动 embedding 目标应保持为事务祖先', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 600, height: 360 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 200, width: 570, height: 180 }, pool)
    const transaction = createMockNode('transaction', BPMN_TRANSACTION, { x: 120, y: 220, width: 240, height: 100 }, lane)
    const task = createMockNode('task', BPMN_USER_TASK, { x: 150, y: 250, width: 100, height: 50 }, transaction)
    const graph = {
      getNodes: () => [pool, lane, transaction, task],
    } as const

    expect(resolveBpmnEmbeddingTargets(graph as never, task as never).map((node) => node.id)).toEqual(['transaction'])
  })

  it('事务内部节点被显式拖出事务框后，应允许按目标 Lane 重新判定 embedding', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 600, height: 360 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 200, width: 570, height: 180 }, pool)
    const transaction = createMockNode('transaction', BPMN_TRANSACTION, { x: 120, y: 220, width: 240, height: 100 }, lane)
    const task = createMockNode('task', BPMN_USER_TASK, { x: 430, y: 250, width: 100, height: 50 }, transaction)
    const graph = {
      getNodes: () => [pool, lane, transaction, task],
      getSelectedCells: () => [task],
    } as const

    expect(resolveBpmnEmbeddingTargets(graph as never, task as never).map((node) => node.id)).toEqual(['lane', 'pool'])
  })

  it('直接拖拽事务内部节点越出事务框时，即使 selection 尚未建立也应允许改挂到 Lane', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 600, height: 360 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 200, width: 570, height: 180 }, pool)
    const transaction = createMockNode('transaction', BPMN_TRANSACTION, { x: 120, y: 220, width: 240, height: 100 }, lane)
    const task = createMockNode('task', BPMN_USER_TASK, { x: 430, y: 250, width: 100, height: 50 }, transaction)
    const graph = {
      getNodes: () => [pool, lane, transaction, task],
    } as const

    markMovingBpmnNode(task as never)

    try {
      expect(resolveBpmnEmbeddingTargets(graph as never, task as never).map((node) => node.id)).toEqual(['lane', 'pool'])
    } finally {
      clearMovingBpmnNode(task as never)
    }
  })

  it('事务内部节点 bbox 暂不可读且没有显式选中自身时，应继续保持事务祖先', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 600, height: 360 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 200, width: 570, height: 180 }, pool)
    const transaction = {
      ...createMockNode('transaction', BPMN_TRANSACTION, { x: 120, y: 220, width: 240, height: 100 }, lane),
      getBBox: () => {
        throw new Error('bbox pending')
      },
    }
    const task = createMockNode('task', BPMN_USER_TASK, { x: 430, y: 250, width: 100, height: 50 }, transaction)
    const graph = {
      getNodes: () => [pool, lane, transaction, task],
    } as const

    expect(resolveBpmnEmbeddingTargets(graph as never, task as never).map((node) => node.id)).toEqual(['transaction'])
  })

  it('Lane 只应允许嵌入 Pool', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 500, height: 300 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 40, width: 470, height: 180 })
    const group = createMockNode('group', BPMN_GROUP, { x: 60, y: 50, width: 490, height: 260 })
    const graph = { getNodes: () => [pool, group, lane] } as const

    expect(resolveContainingBpmnParents(graph as never, lane as never).map((node) => node.id)).toEqual(['pool'])
  })

  it('没有合法包含容器时 findContainingBpmnParent 应返回 null', () => {
    const task = createMockNode('task', BPMN_USER_TASK, { x: 160, y: 110, width: 100, height: 60 })
    const graph = { getNodes: () => [task] } as const

    expect(findContainingBpmnParent(graph as never, task as never)).toBeNull()
    expect(resolveContainingBpmnParents(graph as never, task as never)).toEqual([])
  })

  it('拖放决策应区分 Lane、流程节点与普通嵌入场景', () => {
    const pool = createMockNode('pool', BPMN_POOL, { x: 40, y: 40, width: 500, height: 300 })
    const lane = createMockNode('lane', BPMN_LANE, { x: 70, y: 40, width: 470, height: 180 })
    const taskInLane = createMockNode('task-in-lane', BPMN_USER_TASK, { x: 160, y: 110, width: 100, height: 60 })
    const taskOutside = createMockNode('task-outside', BPMN_USER_TASK, { x: 620, y: 110, width: 100, height: 60 })
    const laneOutside = createMockNode('lane-outside', BPMN_LANE, { x: 620, y: 260, width: 260, height: 120 })
    const graph = { getNodes: () => [pool, lane, taskInLane, taskOutside, laneOutside] } as const

    expect(resolveBpmnDropAction(graph as never, taskInLane as never)).toEqual({ kind: 'embed', parent: lane })
    expect(resolveBpmnDropAction(graph as never, taskOutside as never)).toEqual({ kind: 'reject', reason: 'contained-flow-node-parent-required' })
    expect(resolveBpmnDropAction(graph as never, laneOutside as never)).toEqual({ kind: 'reject', reason: 'lane-parent-required' })
  })

  it('边界事件应选最近且合法的宿主，并在超出阈值时返回空', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, { x: 182, y: 82, width: 36, height: 36 })
    const task = createMockNode('task', BPMN_USER_TASK, { x: 100, y: 100, width: 200, height: 100 })
    const farTask = createMockNode('far-task', BPMN_USER_TASK, { x: 500, y: 300, width: 200, height: 100 })
    const graph = { getNodes: () => [boundary, farTask, task] } as const

    expect(findBoundaryAttachHost(graph as never, boundary as never)?.id).toBe('task')
    expect(resolveBpmnEmbeddingTargets(graph as never, boundary as never).map((node) => node.id)).toEqual(['task'])
    expect(resolveBpmnDropAction(graph as never, boundary as never)).toEqual({ kind: 'attach-boundary', host: task })

    const detachedBoundary = createMockNode('boundary-far', BPMN_BOUNDARY_EVENT_TIMER, { x: 182, y: 78, width: 36, height: 36 })
    expect(findBoundaryAttachHost(graph as never, detachedBoundary as never, { boundarySnapDistance: 2 })).toBeNull()
    expect(resolveBpmnEmbeddingTargets(graph as never, detachedBoundary as never, { boundarySnapDistance: 2 })).toEqual([])
    expect(resolveBpmnDropAction(graph as never, detachedBoundary as never, { boundarySnapDistance: 2 })).toEqual({ kind: 'reject', reason: 'boundary-host-required' })
  })

  it('边界事件与多个宿主等距时应优先选择面积更小的宿主', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, { x: 182, y: 82, width: 36, height: 36 })
    const compactTask = createMockNode('task-small', BPMN_USER_TASK, { x: 200, y: 60, width: 80, height: 80 })
    const largeTask = createMockNode('task-large', BPMN_USER_TASK, { x: 200, y: 40, width: 120, height: 120 })
    const graph = { getNodes: () => [boundary, largeTask, compactTask] } as const

    expect(findBoundaryAttachHost(graph as never, boundary as never)?.id).toBe('task-small')
  })

  it('边界事件存在多个合法宿主时应优先选择距离更近的宿主', () => {
    const boundary = createMockNode('boundary', BPMN_BOUNDARY_EVENT_TIMER, { x: 182, y: 82, width: 36, height: 36 })
    const nearTask = createMockNode('task-near', BPMN_USER_TASK, { x: 200, y: 50, width: 100, height: 100 })
    const farTask = createMockNode('task-far', BPMN_USER_TASK, { x: 170, y: 50, width: 100, height: 100 })
    const graph = { getNodes: () => [boundary, farTask, nearTask] } as const

    expect(findBoundaryAttachHost(graph as never, boundary as never)?.id).toBe('task-near')
  })
})