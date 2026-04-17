import { describe, expect, it } from 'vitest'

import {
  __test__ as swimlanePolicyTest,
  isContainedFlowNode,
  patchLaneInteracting,
  restoreLaneInteracting,
  setupSwimlanePolicy,
} from '../../../src/behaviors/swimlane-policy'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

describe('isContainedFlowNode', () => {
  it('应只把普通流程节点视为受泳道容器约束的节点', () => {
    expect(isContainedFlowNode(BPMN_USER_TASK)).toBe(true)
    expect(isContainedFlowNode(BPMN_BOUNDARY_EVENT_TIMER)).toBe(false)
    expect(isContainedFlowNode(BPMN_POOL)).toBe(false)
    expect(isContainedFlowNode(BPMN_LANE)).toBe(false)
  })
})

describe('patchLaneInteracting / restoreLaneInteracting', () => {
  it('原始配置为空时应默认允许非 Lane 交互，并禁止 Lane 移动', () => {
    const graph = { options: {} } as any

    patchLaneInteracting(graph, null)

    const interacting = graph.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    expect(interacting({})).toBe(true)
    expect(interacting({ cell: { shape: BPMN_LANE } })).toEqual({ nodeMovable: false })
  })

  it('原始配置为布尔 false 时应保持完全禁用', () => {
    const graph = { options: {} } as any

    patchLaneInteracting(graph, false)

    const interacting = graph.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    expect(interacting({ cell: { shape: BPMN_LANE } })).toBe(false)
    expect(interacting({ cell: { shape: BPMN_USER_TASK } })).toBe(false)
  })

  it('原始配置为对象或函数时应保留其他交互属性', () => {
    const graphWithObject = { options: {} } as any
    const originalObject = { nodeMovable: true, edgeMovable: true }

    patchLaneInteracting(graphWithObject, originalObject)

    const objectInteracting = graphWithObject.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    expect(objectInteracting({ cell: { shape: BPMN_LANE } })).toEqual({
      nodeMovable: false,
      edgeMovable: true,
    })
    expect(objectInteracting({ cell: { shape: BPMN_USER_TASK } })).toEqual(originalObject)

    const graphWithFunction = { options: {} } as any
    patchLaneInteracting(graphWithFunction, (cellView: { cell?: { shape?: string } }) => {
      if (cellView.cell?.shape === BPMN_USER_TASK) {
        return { magnetConnectable: false }
      }
      return true
    })

    const fnInteracting = graphWithFunction.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    expect(fnInteracting({ cell: { shape: BPMN_LANE } })).toEqual({ nodeMovable: false })
    expect(fnInteracting({ cell: { shape: BPMN_USER_TASK } })).toEqual({ magnetConnectable: false })

    restoreLaneInteracting(graphWithFunction, undefined)
    expect(graphWithFunction.options.interacting).toBeUndefined()
  })

  it('运行时遇到非常规 interacting 值时应安全回退为默认行为', () => {
    const graph = { options: {} } as any

    patchLaneInteracting(graph, 123 as any)

    const interacting = graph.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    expect(interacting({ cell: { shape: BPMN_USER_TASK } })).toBe(true)
    expect(interacting({ cell: { shape: BPMN_LANE } })).toEqual({ nodeMovable: false })
  })

  it('缺少 graph.options 时应安全跳过', () => {
    const graph = {} as any

    expect(() => patchLaneInteracting(graph, true)).not.toThrow()
    expect(() => restoreLaneInteracting(graph, true)).not.toThrow()
  })
})

describe('setupSwimlanePolicy', () => {
  it('应安装 Lane 禁拖拽策略和 translating.restrict，并在 dispose 时恢复', () => {
    const originalTranslating = { restrict: 'keep-me' }
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 300 }),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 300 }),
    }
    const graph = {
      options: {
        interacting: { edgeMovable: true },
        translating: originalTranslating,
      },
      getSelectedCells: () => [lane],
    } as any
    const node = {
      shape: BPMN_USER_TASK,
      getPosition: () => ({ x: 120, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
      getParent: () => lane,
      isNode: () => true,
    }

    const dispose = setupSwimlanePolicy(graph)

    const interacting = graph.options.interacting as (cellView: { cell?: { shape?: string } }) => unknown
    const restrict = graph.options.translating.restrict as (cellView: { cell?: unknown } | null) => unknown

    expect(interacting({ cell: { shape: BPMN_LANE } })).toEqual({ edgeMovable: true, nodeMovable: false })
    expect(restrict.call(graph, { cell: node })).toEqual({ x: 70, y: 40, width: 370, height: 300 })
    expect(restrict.call(graph, { cell: lane })).toEqual({ x: 70, y: 40, width: 370, height: 300 })
    expect(restrict.call(graph, null)).toEqual({ x: 70, y: 40, width: 370, height: 300 })

    dispose()

    expect(graph.options.translating).toBe(originalTranslating)
  })

  it('应在 translating 不是对象时回退到空配置，并忽略缺少几何方法的 cell', () => {
    const graph = {
      options: {
        interacting: true,
        translating: false,
      },
    } as any

    const dispose = setupSwimlanePolicy(graph)

    const restrict = graph.options.translating.restrict as (cellView: { cell?: unknown }) => unknown
    expect(restrict.call(graph, { cell: { shape: BPMN_USER_TASK } })).toBeNull()

    dispose()

    expect(graph.options.translating).toBe(false)
  })

  it('缺少 graph.options 时安装策略应安全返回 dispose', () => {
    const graph = {} as any

    expect(() => {
      const dispose = setupSwimlanePolicy(graph)
      dispose()
    }).not.toThrow()
  })

  it('应为选中的普通流程节点返回共同父泳道的约束矩形，并与原始 restrict 取交集', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 300 }),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 300 }),
    }
    const task1 = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 120, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const task2 = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 260, y: 160 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const graph = {
      options: {
        interacting: true,
        translating: {
          restrict: () => ({ x: 80, y: 60, width: 300, height: 240 }),
        },
      },
      getSelectedCells: () => [task1, task2],
    } as any

    const dispose = setupSwimlanePolicy(graph)

    const restrict = graph.options.translating.restrict as (cellView: { cell?: unknown } | null) => unknown
    expect(restrict.call(graph, null)).toEqual({ x: 80, y: 60, width: 300, height: 240 })

    dispose()
  })

  it('内部辅助函数应覆盖选择集与矩形并集的回退分支', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 300 }),
    }
    const lane1 = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 120 }),
    }
    const lane2 = {
      id: 'lane-2',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 160 }),
      getSize: () => ({ width: 370, height: 180 }),
    }
    const foreignTask = {
      id: 'task-foreign',
      shape: BPMN_USER_TASK,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 500, y: 500 }),
      getSize: () => ({ width: 100, height: 60 }),
    }

    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [lane1, lane2],
    } as any)).toEqual({ x: 70, y: 40, width: 370, height: 300 })
    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [foreignTask],
    } as any)).toBeNull()
    expect(swimlanePolicyTest.getNodesUnionRect([lane1, lane2] as any)).toEqual({
      x: 70,
      y: 40,
      width: 370,
      height: 300,
    })
    expect(swimlanePolicyTest.intersectRestrictArea(
      { x: 70, y: 40, width: 370, height: 300 },
      { x: 80, y: 60, width: 300, height: 240 },
    )).toEqual({ x: 80, y: 60, width: 300, height: 240 })
    expect(swimlanePolicyTest.resolveOriginalRestrictArea(
      { getSelectedCells: () => [] } as any,
      true,
      null,
    )).toBeNull()
    expect(swimlanePolicyTest.resolveOriginalRestrictArea(
      { getSelectedCells: () => [] } as any,
      { x: 1, y: 2, width: 3, height: 4 },
      null,
    )).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(swimlanePolicyTest.resolveOriginalRestrictArea(
      { getSelectedCells: () => [] } as any,
      { left: 1, top: 2 },
      null,
    )).toBeNull()
    expect(swimlanePolicyTest.getNodesUnionRect([] as any)).toBeNull()
    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [pool, foreignTask],
    } as any)).toBeNull()
  })

  it('普通流程节点多选时应按共同 Pool 或共同泳道解析约束区域', () => {
    const poolA = {
      id: 'pool-a',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 260 }),
    }
    const poolB = {
      id: 'pool-b',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 500, y: 40 }),
      getSize: () => ({ width: 400, height: 260 }),
    }
    const lane = {
      id: 'lane-a',
      shape: BPMN_LANE,
      getParent: () => poolA,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 260 }),
    }
    const taskA = {
      id: 'task-a',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 120, y: 80 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const taskB = {
      id: 'task-b',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 260, y: 160 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const laneWithoutPool = {
      id: 'lane-free',
      shape: BPMN_LANE,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 20, y: 320 }),
      getSize: () => ({ width: 420, height: 120 }),
    }
    const taskWithoutPoolA = {
      id: 'task-free-a',
      shape: BPMN_USER_TASK,
      getParent: () => laneWithoutPool,
      isNode: () => true,
      getPosition: () => ({ x: 80, y: 350 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const taskWithoutPoolB = {
      id: 'task-free-b',
      shape: BPMN_USER_TASK,
      getParent: () => laneWithoutPool,
      isNode: () => true,
      getPosition: () => ({ x: 220, y: 350 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const taskInOtherPool = {
      id: 'task-other-pool',
      shape: BPMN_USER_TASK,
      getParent: () => ({
        id: 'lane-b',
        shape: BPMN_LANE,
        getParent: () => poolB,
        isNode: () => true,
        getPosition: () => ({ x: 530, y: 40 }),
        getSize: () => ({ width: 370, height: 260 }),
      }),
      isNode: () => true,
      getPosition: () => ({ x: 580, y: 100 }),
      getSize: () => ({ width: 100, height: 60 }),
    }

    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [taskA, taskB],
    } as any)).toEqual({ x: 70, y: 40, width: 370, height: 260 })
    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [taskWithoutPoolA, taskWithoutPoolB],
    } as any)).toEqual({ x: 20, y: 320, width: 420, height: 120 })
    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [taskA, taskInOtherPool],
    } as any)).toBeNull()
  })

  it('节点级约束区域应按泳道类型和父链返回对应矩形', () => {
    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 40, y: 40 }),
      getSize: () => ({ width: 400, height: 260 }),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: () => pool,
      isNode: () => true,
      getPosition: () => ({ x: 70, y: 40 }),
      getSize: () => ({ width: 370, height: 260 }),
    }
    const task = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 120, y: 100 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const detachedTask = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 520, y: 100 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const boundary = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 150, y: 90 }),
      getSize: () => ({ width: 36, height: 36 }),
    }

    expect(swimlanePolicyTest.resolveNodeRestrictArea(lane as any)).toEqual({
      x: 70,
      y: 40,
      width: 370,
      height: 260,
    })
    expect(swimlanePolicyTest.resolveNodeRestrictArea(task as any)).toEqual({
      x: 70,
      y: 40,
      width: 370,
      height: 260,
    })
    expect(swimlanePolicyTest.resolveNodeRestrictArea(boundary as any)).toBeNull()
    expect(swimlanePolicyTest.resolveNodeRestrictArea(detachedTask as any)).toBeNull()
  })

  it('普通流程节点只有泳道父而没有祖先 Pool 时应回退到泳道约束区', () => {
    const lane = {
      id: 'lane-free',
      shape: BPMN_LANE,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 20, y: 320 }),
      getSize: () => ({ width: 420, height: 120 }),
    }
    const task = {
      id: 'task-free',
      shape: BPMN_USER_TASK,
      getParent: () => lane,
      isNode: () => true,
      getPosition: () => ({ x: 80, y: 350 }),
      getSize: () => ({ width: 100, height: 60 }),
    }

    expect(swimlanePolicyTest.resolveNodeRestrictArea(task as any)).toEqual({
      x: 20,
      y: 320,
      width: 420,
      height: 120,
    })
  })

  it('多选包含非受约束节点或父泳道不一致时应返回 null，并能跨普通父链回溯泳道', () => {
    const laneA = {
      id: 'lane-a',
      shape: BPMN_LANE,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 20, y: 40 }),
      getSize: () => ({ width: 300, height: 120 }),
    }
    const laneB = {
      id: 'lane-b',
      shape: BPMN_LANE,
      getParent: () => null,
      isNode: () => true,
      getPosition: () => ({ x: 340, y: 40 }),
      getSize: () => ({ width: 300, height: 120 }),
    }
    const container = {
      id: 'task-parent',
      shape: BPMN_USER_TASK,
      getParent: () => laneA,
      isNode: () => true,
    }
    const taskInLaneA = {
      id: 'task-a',
      shape: BPMN_USER_TASK,
      getParent: () => container,
      isNode: () => true,
      getPosition: () => ({ x: 80, y: 60 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const taskInLaneB = {
      id: 'task-b',
      shape: BPMN_USER_TASK,
      getParent: () => laneB,
      isNode: () => true,
      getPosition: () => ({ x: 380, y: 60 }),
      getSize: () => ({ width: 100, height: 60 }),
    }
    const boundary = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      getParent: () => laneA,
      isNode: () => true,
      getPosition: () => ({ x: 120, y: 50 }),
      getSize: () => ({ width: 36, height: 36 }),
    }

    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [taskInLaneA, boundary],
    } as any)).toBeNull()
    expect(swimlanePolicyTest.resolveSelectionRestrictArea({
      getSelectedCells: () => [taskInLaneA, taskInLaneB],
    } as any)).toBeNull()
    expect(swimlanePolicyTest.findSwimlaneParent(taskInLaneA as any)).toBe(laneA)
  })
})