import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_START_EVENT,
  BPMN_SUB_PROCESS,
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
    expect(graph.off).toHaveBeenCalledWith('node:moving', handlers['node:moving'])
    expect(graph.off).toHaveBeenCalledWith('node:moved', handlers['node:moved'])
    expect(graph.off).toHaveBeenCalledWith('batch:stop', handlers['batch:stop'])
  })

  it('移动事件缺少节点时不应影响后续事务内部节点拖拽判定', () => {
    const handlers: Record<string, (args: { node?: any; currentParent?: any; previousParent?: any }) => void> = {}
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 120, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => true,
      }),
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node?: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => []),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:moving']({})
    handlers['node:moved']({})
    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).toHaveBeenCalledWith(internalTask)
    expect(transaction.embed).toHaveBeenCalledWith(internalTask)

    requestAnimationFrameSpy.mockRestore()
  })

  it('普通节点嵌入事务后应提升到事务上层，边界事件不走该通用置前逻辑', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
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

  it('事务本体拖拽时若内部节点被 X6 误挂到 Lane，应恢复到事务父级', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 120, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: (rect: { x: number; y: number; width: number; height: number }) => rect.x >= 100
          && rect.y >= 80
          && rect.x + rect.width <= 340
          && rect.y + rect.height <= 200,
      }),
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => [transaction]),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).toHaveBeenCalledWith(internalTask)
    expect(transaction.embed).toHaveBeenCalledWith(internalTask)
    expect(internalTask.toFront).not.toHaveBeenCalled()
  })

  it('事务内部节点被显式拖出事务框后，不应强制恢复到事务父级', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 430, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => {
        throw new Error('bbox pending')
      },
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => [internalTask]),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).not.toHaveBeenCalled()
    expect(transaction.embed).not.toHaveBeenCalled()
  })

  it('直接拖拽事务本体时，即使嵌入事件发生在 bbox 更新前，也应恢复内部节点父级', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 120, y: 300, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => false,
      }),
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:moving']({ node: { id: 'task-outside', shape: BPMN_USER_TASK } })
    handlers['node:moved']({ node: { id: 'task-outside', shape: BPMN_USER_TASK } })
    handlers['node:moving']({ node: transaction })
    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).toHaveBeenCalledWith(internalTask)
    expect(transaction.embed).toHaveBeenCalledWith(internalTask)
  })

  it('事务本体移动窗口结束后，显式拖出内部节点应允许改挂到 Lane', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 430, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => false,
      }),
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getSelectedCells: vi.fn(() => [internalTask]),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:moving']({ node: transaction })
    handlers['node:moved']({ node: transaction })
    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).not.toHaveBeenCalled()
    expect(transaction.embed).not.toHaveBeenCalled()

    requestAnimationFrameSpy.mockRestore()
  })

  it('直接拖拽事务内部节点脱离事务后，应断开与事务子树内部节点的连线', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 430, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const peerTask = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const subProcess = {
      id: 'sub-1',
      shape: BPMN_SUB_PROCESS,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const nestedTask = {
      id: 'task-3',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => subProcess),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => false,
      }),
      getParent: vi.fn(() => null),
      embed: vi.fn(),
    }
    peerTask.getParent.mockReturnValue(transaction)
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const edge = {
      getSourceCellId: vi.fn(() => internalTask.id),
      getTargetCellId: vi.fn(() => peerTask.id),
      remove: vi.fn(),
    }
    const nestedEdge = {
      getSourceCellId: vi.fn(() => internalTask.id),
      getTargetCellId: vi.fn(() => nestedTask.id),
      remove: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getConnectedEdges: vi.fn(() => [edge, nestedEdge]),
      getCellById: vi.fn((id: string) => {
        if (id === peerTask.id) {
          return peerTask
        }
        if (id === nestedTask.id) {
          return nestedTask
        }
        return null
      }),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:moving']({ node: internalTask })
    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).not.toHaveBeenCalled()
    expect(transaction.embed).not.toHaveBeenCalled()
    expect(edge.remove).toHaveBeenCalledOnce()
    expect(nestedEdge.remove).toHaveBeenCalledOnce()
  })

  it('选中拖拽事务内部节点脱离事务后，应在选区移动结束时改挂目标 Lane 并断开内部连线', () => {
    const handlers: Record<string, (args: { name?: string }) => void> = {}
    const lane1 = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 70,
        y: 40,
        width: 590,
        height: 160,
        containsRect: () => false,
      }),
    }
    const lane2 = {
      id: 'lane-2',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 70,
        y: 200,
        width: 590,
        height: 200,
        containsRect: (rect: { x: number; y: number; width: number; height: number }) => rect.x >= 70
          && rect.y >= 200
          && rect.x + rect.width <= 660
          && rect.y + rect.height <= 400,
      }),
      embed: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 140,
        y: 75,
        width: 280,
        height: 100,
        containsRect: () => false,
      }),
      getParent: vi.fn(() => lane1),
      unembed: vi.fn(),
    }
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
      getBBox: () => ({ x: 180, y: 290, width: 110, height: 50 }),
    }
    const peerTask = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const edge = {
      getSourceCellId: vi.fn(() => internalTask.id),
      getTargetCellId: vi.fn(() => peerTask.id),
      remove: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { name?: string }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [lane1, lane2, transaction, internalTask, peerTask]),
      getSelectedCells: vi.fn(() => [internalTask]),
      getConnectedEdges: vi.fn(() => [edge]),
      getCellById: vi.fn((id: string) => (id === peerTask.id ? peerTask : null)),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['batch:stop']({ name: 'resize' })
    expect(lane2.embed).not.toHaveBeenCalled()

    handlers['batch:stop']({ name: 'move-selection' })

    expect(transaction.unembed).toHaveBeenCalledWith(internalTask)
    expect(lane2.embed).toHaveBeenCalledWith(internalTask)
    expect(edge.remove).toHaveBeenCalledOnce()
  })

  it('选中拖拽多个事务内部节点脱离事务后，应保留同时移出节点之间的连线', () => {
    const handlers: Record<string, (args: { name?: string }) => void> = {}
    const lane1 = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 70,
        y: 40,
        width: 590,
        height: 160,
        containsRect: () => false,
      }),
    }
    const lane2 = {
      id: 'lane-2',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 70,
        y: 200,
        width: 590,
        height: 200,
        containsRect: (rect: { x: number; y: number; width: number; height: number }) => rect.x >= 70
          && rect.y >= 200
          && rect.x + rect.width <= 660
          && rect.y + rect.height <= 400,
      }),
      embed: vi.fn((node: { id: string }) => {
        if (node.id === task1.id) {
          task1Parent = lane2
        }
        if (node.id === task2.id) {
          task2Parent = lane2
        }
      }),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 140,
        y: 75,
        width: 280,
        height: 100,
        containsRect: () => false,
      }),
      getParent: vi.fn(() => lane1),
      unembed: vi.fn(),
    }
    let task1Parent: any = transaction
    let task2Parent: any = transaction
    const task1 = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => task1Parent),
      getBBox: () => ({ x: 180, y: 290, width: 110, height: 50 }),
    }
    const task2 = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => task2Parent),
      getBBox: () => ({ x: 310, y: 290, width: 110, height: 50 }),
    }
    const remainingTask = {
      id: 'task-3',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const selectedEdge = {
      getSourceCellId: vi.fn(() => task1.id),
      getTargetCellId: vi.fn(() => task2.id),
      remove: vi.fn(),
    }
    const staleInternalEdge = {
      getSourceCellId: vi.fn(() => task1.id),
      getTargetCellId: vi.fn(() => remainingTask.id),
      remove: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { name?: string }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [lane1, lane2, transaction, task1, task2, remainingTask]),
      getSelectedCells: vi.fn(() => [task1, task2]),
      getConnectedEdges: vi.fn((node: { id: string }) => (node.id === task1.id
        ? [selectedEdge, staleInternalEdge]
        : [selectedEdge])),
      getCellById: vi.fn((id: string) => {
        if (id === task1.id) {
          return task1
        }
        if (id === task2.id) {
          return task2
        }
        if (id === remainingTask.id) {
          return remainingTask
        }
        return null
      }),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['batch:stop']({ name: 'move-selection' })

    expect(transaction.unembed).toHaveBeenCalledWith(task1)
    expect(transaction.unembed).toHaveBeenCalledWith(task2)
    expect(lane2.embed).toHaveBeenCalledWith(task1)
    expect(lane2.embed).toHaveBeenCalledWith(task2)
    expect(selectedEdge.remove).not.toHaveBeenCalled()
    expect(staleInternalEdge.remove).toHaveBeenCalledOnce()
  })

  it('选区移动未启用 selection 插件时，不应执行事务内部节点移出处理', () => {
    const handlers: Record<string, (args: { name?: string }) => void> = {}
    const graph = {
      on: vi.fn((event: string, handler: (args: { name?: string }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => []),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    expect(() => handlers['batch:stop']({ name: 'move-selection' })).not.toThrow()
  })

  it('选区移动普通 Lane 成员时，不应按事务内部节点移出处理', () => {
    const handlers: Record<string, (args: { name?: string }) => void> = {}
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      embed: vi.fn(),
    }
    const laneTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => lane),
      getBBox: () => ({ x: 120, y: 100, width: 100, height: 50 }),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { name?: string }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [lane, laneTask]),
      getSelectedCells: vi.fn(() => [laneTask]),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['batch:stop']({ name: 'move-selection' })

    expect(lane.embed).not.toHaveBeenCalled()
  })

  it('选中拖拽事务内部节点移到空白区时，应保留事务父级与内部连线', () => {
    const handlers: Record<string, (args: { name?: string }) => void> = {}
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 140,
        y: 75,
        width: 280,
        height: 100,
        containsRect: () => false,
      }),
      unembed: vi.fn(),
    }
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
      getBBox: () => ({ x: 800, y: 600, width: 110, height: 50 }),
    }
    const peerTask = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const edge = {
      getSourceCellId: vi.fn(() => internalTask.id),
      getTargetCellId: vi.fn(() => peerTask.id),
      remove: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { name?: string }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getNodes: vi.fn(() => [transaction, internalTask, peerTask]),
      getSelectedCells: vi.fn(() => [internalTask]),
      getConnectedEdges: vi.fn(() => [edge]),
      getCellById: vi.fn((id: string) => (id === peerTask.id ? peerTask : null)),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['batch:stop']({ name: 'move-selection' })

    expect(transaction.unembed).not.toHaveBeenCalled()
    expect(edge.remove).not.toHaveBeenCalled()
  })

  it('事务内部节点脱离事务后，断线逻辑应忽略无关边与非节点终点，并兼容被拖拽节点作为 target', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 430, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => false,
      }),
      getParent: vi.fn(() => null),
      embed: vi.fn(),
    }
    const peerTask = {
      id: 'task-2',
      shape: BPMN_USER_TASK,
      isNode: vi.fn(() => true),
      getParent: vi.fn(() => transaction),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const incomingEdge = {
      getSourceCellId: vi.fn(() => peerTask.id),
      getTargetCellId: vi.fn(() => internalTask.id),
      remove: vi.fn(),
    }
    const unrelatedEdge = {
      getSourceCellId: vi.fn(() => 'other-source'),
      getTargetCellId: vi.fn(() => 'other-target'),
      remove: vi.fn(),
    }
    const nonNodeEdge = {
      getSourceCellId: vi.fn(() => internalTask.id),
      getTargetCellId: vi.fn(() => 'label-1'),
      remove: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
      getConnectedEdges: vi.fn(() => [incomingEdge, unrelatedEdge, nonNodeEdge]),
      getCellById: vi.fn((id: string) => {
        if (id === peerTask.id) {
          return peerTask
        }
        if (id === 'label-1') {
          return { id, isNode: (): boolean => false }
        }
        return null
      }),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:moving']({ node: internalTask })
    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(incomingEdge.remove).toHaveBeenCalledOnce()
    expect(unrelatedEdge.remove).not.toHaveBeenCalled()
    expect(nonNodeEdge.remove).not.toHaveBeenCalled()
  })

  it('宿主未启用 selection 插件时，事务内部节点误挂到 Lane 仍应恢复到事务', () => {
    const handlers: Record<string, (args: { node: any; currentParent?: any; previousParent?: any }) => void> = {}
    const internalTask = {
      id: 'task-1',
      shape: BPMN_USER_TASK,
      getBBox: () => ({ x: 430, y: 100, width: 100, height: 50 }),
      toFront: vi.fn(),
    }
    const transaction = {
      id: 'tx-1',
      shape: BPMN_TRANSACTION,
      isNode: vi.fn(() => true),
      getBBox: () => ({
        x: 100,
        y: 80,
        width: 240,
        height: 120,
        containsRect: () => false,
      }),
      embed: vi.fn(),
    }
    const lane = {
      id: 'lane-1',
      shape: BPMN_LANE,
      isNode: vi.fn(() => true),
      unembed: vi.fn(),
    }
    const graph = {
      on: vi.fn((event: string, handler: (args: { node: any; currentParent?: any; previousParent?: any }) => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    setupBpmnInteractionBehaviors(graph)

    handlers['node:embedded']({ node: internalTask, currentParent: lane, previousParent: transaction })

    expect(lane.unembed).toHaveBeenCalledWith(internalTask)
    expect(transaction.embed).toHaveBeenCalledWith(internalTask)
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

  it('缺少 getSelectedCells 时点击 Lane 不应切换直接选中', () => {
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
      cleanSelection,
      select,
    } as any

    behaviorMocks.setupBoundaryAttach.mockReturnValue(vi.fn())
    behaviorMocks.setupPoolContainment.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneResize.mockReturnValue(vi.fn())
    behaviorMocks.setupSwimlaneDelete.mockReturnValue(vi.fn())

    const dispose = setupBpmnInteractionBehaviors(graph)

    handlers['node:click']({ node: lane })

    expect(cleanSelection).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()

    dispose()
    requestAnimationFrameSpy.mockRestore()
  })
})