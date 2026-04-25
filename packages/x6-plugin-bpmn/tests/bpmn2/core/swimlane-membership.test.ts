import { describe, expect, it } from 'vitest'
import type { Node } from '@antv/x6'
import {
  findContainingSwimlane,
  getAncestorFlowContainer,
  getAncestorPool,
  getAncestorSwimlane,
  hasAncestorNode,
  isFlowContainerShape,
  resolveLaneMemberNodes,
} from '../../../src/core/swimlane-membership'
import { BPMN_LANE, BPMN_POOL, BPMN_TRANSACTION, BPMN_USER_TASK } from '../../../src/utils/constants'

function createMockNode(
  id: string,
  shape: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parent: any = null,
) {
  return {
    id,
    shape,
    getPosition: () => ({ x, y }),
    getSize: () => ({ width, height }),
    getParent: () => parent,
    isNode: () => true,
  } as unknown as Node
}

describe('swimlane-membership', () => {
  it('应找到最近的 Pool 与 Swimlane 祖先', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 400, 240)
    const lane = createMockNode('lane', BPMN_LANE, 30, 0, 370, 120, pool)
    const task = createMockNode('task', BPMN_USER_TASK, 80, 40, 100, 60, lane)

    expect(getAncestorPool(task)?.id).toBe('pool')
    expect(getAncestorPool(pool)?.id).toBe('pool')
    expect(getAncestorSwimlane(task)?.id).toBe('lane')
    expect(getAncestorSwimlane(pool)).toBeNull()
    expect(getAncestorPool(null)).toBeNull()
    expect(getAncestorSwimlane(undefined)).toBeNull()
  })

  it('查找包含泳道时应优先返回更小的 Lane', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 500, 300)
    const lane = createMockNode('lane', BPMN_LANE, 30, 0, 470, 150, pool)
    const graph = {
      getNodes: () => [pool, lane],
    } as any

    const container = findContainingSwimlane(graph, { x: 60, y: 20, width: 80, height: 40 })
    expect(container?.id).toBe('lane')

    const fallback = findContainingSwimlane(graph, { x: 60, y: 220, width: 80, height: 40 })
    expect(fallback?.id).toBe('pool')

    const laneTarget = {
      getPosition: () => ({ x: 60, y: 20 }),
      getSize: () => ({ width: 80, height: 40 }),
    }
    expect(findContainingSwimlane(graph, laneTarget, lane.id)?.id).toBe('pool')
  })

  it('图节点遍历失败时应安全返回空结果', () => {
    const graph = {
      getNodes: () => {
        throw new Error('getNodes failed')
      },
    } as any

    expect(findContainingSwimlane(graph, { x: 60, y: 20, width: 80, height: 40 })).toBeNull()
  })

  it('Lane 成员解析应优先使用最近祖先 Lane，并对无祖先节点回落到中心点命中', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 500, 300)
    const parentLane = createMockNode('lane-parent', BPMN_LANE, 30, 0, 470, 300, pool)
    const childLane = createMockNode('lane-child', BPMN_LANE, 30, 0, 470, 120, parentLane)
    const nestedTask = createMockNode('task-nested', BPMN_USER_TASK, 80, 20, 100, 60, childLane)
    const centeredTask = createMockNode('task-centered', BPMN_USER_TASK, 80, 180, 100, 60, pool)
    const outsideTask = createMockNode('task-outside', BPMN_USER_TASK, 520, 180, 100, 60, pool)

    expect(resolveLaneMemberNodes(childLane, [nestedTask, centeredTask, outsideTask]).map((node) => node.id)).toEqual([
      'task-nested',
    ])
    expect(resolveLaneMemberNodes(parentLane, [nestedTask, centeredTask, outsideTask]).map((node) => node.id)).toEqual([
      'task-centered',
    ])
  })

  it('Lane 成员解析应只引用事务本体，不应平铺事务内部流程节点', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 500, 320)
    const lane = createMockNode('lane', BPMN_LANE, 30, 0, 470, 160, pool)
    const transaction = createMockNode('transaction', BPMN_TRANSACTION, 90, 40, 220, 100, lane)
    const nestedTask = createMockNode('task-nested', BPMN_USER_TASK, 120, 70, 100, 50, transaction)
    const laneTask = createMockNode('task-lane', BPMN_USER_TASK, 340, 70, 100, 50, lane)

    expect(isFlowContainerShape(BPMN_TRANSACTION)).toBe(true)
    expect(getAncestorFlowContainer(nestedTask)?.id).toBe('transaction')
    expect(resolveLaneMemberNodes(lane, [transaction, nestedTask, laneTask]).map((node) => node.id)).toEqual([
      'transaction',
      'task-lane',
    ])
  })

  it('通用祖先判断应识别深层事务子树并忽略空祖先标识', () => {
    const pool = createMockNode('pool', BPMN_POOL, 0, 0, 500, 320)
    const lane = createMockNode('lane', BPMN_LANE, 30, 0, 470, 160, pool)
    const transaction = createMockNode('transaction', BPMN_TRANSACTION, 90, 40, 220, 100, lane)
    const nestedTask = createMockNode('task-nested', BPMN_USER_TASK, 120, 70, 100, 50, transaction)

    expect(hasAncestorNode(nestedTask, transaction.id)).toBe(true)
    expect(hasAncestorNode(nestedTask, 'other-transaction')).toBe(false)
    expect(hasAncestorNode(nestedTask, null)).toBe(false)
  })
})