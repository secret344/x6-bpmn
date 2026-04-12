import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_START_EVENT,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

const behaviorMocks = vi.hoisted(() => ({
  setupBoundaryAttach: vi.fn(),
  setupPoolContainment: vi.fn(),
  setupSwimlaneResize: vi.fn(),
  setupSwimlaneDelete: vi.fn(),
}))

vi.mock('../../../src/behaviors/boundary-attach', () => ({
  setupBoundaryAttach: behaviorMocks.setupBoundaryAttach,
  attachBoundaryToHost: vi.fn(),
}))

vi.mock('../../../src/behaviors/pool-containment', () => ({
  setupPoolContainment: behaviorMocks.setupPoolContainment,
  validatePoolContainment: vi.fn(),
  findContainingSwimlane: vi.fn(),
  getSwimlaneAncestor: vi.fn(),
  isContainedFlowNode: vi.fn(),
  patchLaneInteracting: vi.fn(),
  restoreLaneInteracting: vi.fn(),
}))

vi.mock('../../../src/behaviors/swimlane-resize', () => ({
  setupSwimlaneResize: behaviorMocks.setupSwimlaneResize,
  clampLanePreviewRect: vi.fn(),
}))

vi.mock('../../../src/behaviors/swimlane-delete', () => ({
  setupSwimlaneDelete: behaviorMocks.setupSwimlaneDelete,
  compensateLaneDelete: vi.fn(),
}))

import { setupBpmnInteractionBehaviors } from '../../../src/behaviors'

describe('setupBpmnInteractionBehaviors', () => {
  beforeEach(() => {
    behaviorMocks.setupBoundaryAttach.mockReset()
    behaviorMocks.setupPoolContainment.mockReset()
    behaviorMocks.setupSwimlaneResize.mockReset()
    behaviorMocks.setupSwimlaneDelete.mockReset()
  })

  it('应统一安装并按逆序释放 BPMN 交互行为', () => {
    const graph = { id: 'graph' } as any
    const disposeBoundaryAttach = vi.fn()
    const disposePoolContainment = vi.fn()
    const disposeSwimlaneResize = vi.fn()
    const disposeSwimlaneDelete = vi.fn()

    behaviorMocks.setupBoundaryAttach.mockReturnValue(disposeBoundaryAttach)
    behaviorMocks.setupPoolContainment.mockReturnValue(disposePoolContainment)
    behaviorMocks.setupSwimlaneResize.mockReturnValue(disposeSwimlaneResize)
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(disposeSwimlaneDelete)

    const dispose = setupBpmnInteractionBehaviors(graph, {
      boundaryAttach: { enabled: true } as any,
      poolContainment: { constrainToContainer: true },
    })

    expect(behaviorMocks.setupBoundaryAttach).toHaveBeenCalledWith(graph, { enabled: true })
    expect(behaviorMocks.setupPoolContainment).toHaveBeenCalledWith(graph, { constrainToContainer: true })

    dispose()

    expect(disposeSwimlaneDelete).toHaveBeenCalledOnce()
    expect(disposeSwimlaneResize).toHaveBeenCalledOnce()
    expect(disposePoolContainment).toHaveBeenCalledOnce()
    expect(disposeBoundaryAttach).toHaveBeenCalledOnce()
    // 释放顺序：Delete → Resize → Pool 约束 → 边界吸附（注册的逆序）
    expect(disposeSwimlaneDelete.mock.invocationCallOrder[0]).toBeLessThan(
      disposeSwimlaneResize.mock.invocationCallOrder[0],
    )
    expect(disposePoolContainment.mock.invocationCallOrder[0]).toBeLessThan(
      disposeBoundaryAttach.mock.invocationCallOrder[0],
    )
  })

  it('未传 options 时也应使用空配置安装 BPMN 交互行为', () => {
    const graph = { id: 'graph' } as any
    const disposeBoundaryAttach = vi.fn()
    const disposePoolContainment = vi.fn()
    const disposeSwimlaneResize = vi.fn()
    const disposeSwimlaneDelete = vi.fn()

    behaviorMocks.setupBoundaryAttach.mockReturnValue(disposeBoundaryAttach)
    behaviorMocks.setupPoolContainment.mockReturnValue(disposePoolContainment)
    behaviorMocks.setupSwimlaneResize.mockReturnValue(disposeSwimlaneResize)
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(disposeSwimlaneDelete)

    const dispose = setupBpmnInteractionBehaviors(graph)

    expect(behaviorMocks.setupBoundaryAttach).toHaveBeenCalledWith(graph, undefined)
    expect(behaviorMocks.setupPoolContainment).toHaveBeenCalledWith(graph, undefined)

    dispose()
    expect(disposeSwimlaneDelete).toHaveBeenCalledOnce()
    expect(disposeSwimlaneResize).toHaveBeenCalledOnce()
    expect(disposePoolContainment).toHaveBeenCalledOnce()
    expect(disposeBoundaryAttach).toHaveBeenCalledOnce()
  })

  it('Pool 已被选中时点击 Lane 应切换为直接选中该 Lane', () => {
    const handlers: Record<string, (args: { node: any }) => void> = {}
    const cleanSelection = vi.fn()
    const select = vi.fn()
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })

    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: vi.fn(() => true),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: vi.fn(() => pool),
    }

    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => [{ id: pool.id }]),
      cleanSelection,
      select,
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    const dispose = setupBpmnInteractionBehaviors(graph)

    handlers['node:click']({ node: { shape: BPMN_USER_TASK } })
    handlers['node:click']({ node: lane })

    expect(cleanSelection).toHaveBeenCalledOnce()
    expect(select).toHaveBeenCalledWith(lane)

    dispose()
    requestAnimationFrameSpy.mockRestore()

    expect(graph.off).toHaveBeenCalledWith('node:click', handlers['node:click'])
    expect(graph.off).toHaveBeenCalledWith('node:embedded', handlers['node:embedded'])
  })

  it('普通节点嵌入事务后应提升到事务上层，边界事件不走该通用置前逻辑', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any }) => void> = {}
    const embeddedStart = {
      id: 'start-1',
      shape: BPMN_START_EVENT,
      getParent: vi.fn(),
      toFront: vi.fn(),
    }
    const embeddedBoundary = {
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      getParent: vi.fn(),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
    }

    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => []),
      cleanSelection: vi.fn(),
      select: vi.fn(),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:embedded']({ node: embeddedStart, currentParent: transaction })
    handlers['node:embedded']({ node: embeddedStart, currentParent: lane })
    handlers['node:embedded']({ node: embeddedBoundary, currentParent: transaction })

    expect(embeddedStart.toFront).toHaveBeenCalledTimes(1)
    expect(embeddedBoundary.toFront).not.toHaveBeenCalled()
  })

  it('缺少 on/off 能力时应跳过直接选中策略但仍正常安装其他行为', () => {
    const graph = { id: 'graph' } as any
    const disposeBoundaryAttach = vi.fn()
    const disposePoolContainment = vi.fn()
    const disposeSwimlaneResize = vi.fn()
    const disposeSwimlaneDelete = vi.fn()

    behaviorMocks.setupBoundaryAttach.mockReturnValue(disposeBoundaryAttach)
    behaviorMocks.setupPoolContainment.mockReturnValue(disposePoolContainment)
    behaviorMocks.setupSwimlaneResize.mockReturnValue(disposeSwimlaneResize)
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(disposeSwimlaneDelete)

    const dispose = setupBpmnInteractionBehaviors(graph)

    dispose()

    expect(disposeSwimlaneDelete).toHaveBeenCalledOnce()
    expect(disposeSwimlaneResize).toHaveBeenCalledOnce()
    expect(disposePoolContainment).toHaveBeenCalledOnce()
    expect(disposeBoundaryAttach).toHaveBeenCalledOnce()
  })

  it('Lane 父节点不是已选中的 Pool 时不应切换直接选中', () => {
    const handlers: Record<string, (args: { node: any }) => void> = {}
    const cleanSelection = vi.fn()
    const select = vi.fn()
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })

    const pool = {
      id: 'pool-1',
      shape: BPMN_POOL,
      isNode: vi.fn(() => true),
    }
    const otherLane = {
      id: 'lane-parent',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
    }
    const laneUnderLane = {
      id: 'lane-child',
      shape: BPMN_LANE,
      getParent: vi.fn(() => otherLane),
    }
    const laneUnderPool = {
      id: 'lane-1',
      shape: BPMN_LANE,
      getParent: vi.fn(() => pool),
    }

    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => [{ id: 'other-pool' }]),
      cleanSelection,
      select,
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    const dispose = setupBpmnInteractionBehaviors(graph)

    handlers['node:click']({ node: laneUnderLane })
    handlers['node:click']({ node: laneUnderPool })

    expect(cleanSelection).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()

    dispose()
    requestAnimationFrameSpy.mockRestore()
  })
})