import { beforeEach, describe, expect, it, vi } from 'vitest'

const behaviorMocks = vi.hoisted(() => ({
  setupBoundaryAttach: vi.fn(),
  setupPoolContainment: vi.fn(),
  setupLaneManagement: vi.fn(),
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

vi.mock('../../../src/behaviors/lane-management', () => ({
  setupLaneManagement: behaviorMocks.setupLaneManagement,
  addLaneToPool: vi.fn(),
  addLaneAbove: vi.fn(),
  addLaneBelow: vi.fn(),
  compactLaneLayout: vi.fn(),
}))

import { setupBpmnInteractionBehaviors } from '../../../src/behaviors'

describe('setupBpmnInteractionBehaviors', () => {
  beforeEach(() => {
    behaviorMocks.setupBoundaryAttach.mockReset()
    behaviorMocks.setupPoolContainment.mockReset()
    behaviorMocks.setupLaneManagement.mockReset()
  })

  it('应统一安装并按逆序释放 BPMN 交互行为', () => {
    const graph = { id: 'graph' } as any
    const disposeBoundaryAttach = vi.fn()
    const disposePoolContainment = vi.fn()
    const disposeLaneManagement = vi.fn()

    behaviorMocks.setupBoundaryAttach.mockReturnValue(disposeBoundaryAttach)
    behaviorMocks.setupPoolContainment.mockReturnValue(disposePoolContainment)
    behaviorMocks.setupLaneManagement.mockReturnValue(disposeLaneManagement)

    const dispose = setupBpmnInteractionBehaviors(graph, {
      boundaryAttach: { enabled: true } as any,
      poolContainment: { constrainToContainer: true },
    })

    expect(behaviorMocks.setupBoundaryAttach).toHaveBeenCalledWith(graph, { enabled: true })
    expect(behaviorMocks.setupPoolContainment).toHaveBeenCalledWith(graph, { constrainToContainer: true })
    expect(behaviorMocks.setupLaneManagement).toHaveBeenCalledWith(graph, undefined)

    dispose()

    expect(disposeLaneManagement).toHaveBeenCalledOnce()
    expect(disposePoolContainment).toHaveBeenCalledOnce()
    expect(disposeBoundaryAttach).toHaveBeenCalledOnce()
    expect(disposeLaneManagement.mock.invocationCallOrder[0]).toBeLessThan(
      disposePoolContainment.mock.invocationCallOrder[0],
    )
    expect(disposePoolContainment.mock.invocationCallOrder[0]).toBeLessThan(
      disposeBoundaryAttach.mock.invocationCallOrder[0],
    )
  })

  it('未传 options 时也应使用空配置安装 BPMN 交互行为', () => {
    const graph = { id: 'graph' } as any
    const disposeBoundaryAttach = vi.fn()
    const disposePoolContainment = vi.fn()
    const disposeLaneManagement = vi.fn()

    behaviorMocks.setupBoundaryAttach.mockReturnValue(disposeBoundaryAttach)
    behaviorMocks.setupPoolContainment.mockReturnValue(disposePoolContainment)
    behaviorMocks.setupLaneManagement.mockReturnValue(disposeLaneManagement)

    const dispose = setupBpmnInteractionBehaviors(graph)

    expect(behaviorMocks.setupBoundaryAttach).toHaveBeenCalledWith(graph, undefined)
    expect(behaviorMocks.setupPoolContainment).toHaveBeenCalledWith(graph, undefined)
    expect(behaviorMocks.setupLaneManagement).toHaveBeenCalledWith(graph, undefined)

    dispose()
    expect(disposeLaneManagement).toHaveBeenCalledOnce()
    expect(disposePoolContainment).toHaveBeenCalledOnce()
    expect(disposeBoundaryAttach).toHaveBeenCalledOnce()
  })
})