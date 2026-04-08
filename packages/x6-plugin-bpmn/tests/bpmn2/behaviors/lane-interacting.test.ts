/**
 * Lane 拖拽禁止 — 单元测试
 *
 * 验证 patchLaneInteracting / restoreLaneInteracting 正确修改
 * graph.options.interacting，使 Lane 节点的 nodeMovable 为 false，
 * 同时保留非 Lane 节点的原有交互行为。
 */

import { describe, it, expect } from 'vitest'
import {
  patchLaneInteracting,
  restoreLaneInteracting,
} from '../../../src/behaviors/pool-containment'
import { BPMN_LANE, BPMN_POOL, BPMN_USER_TASK } from '../../../src/utils/constants'

// ============================================================================
// 辅助：模拟 graph 和 cellView
// ============================================================================

function createMockGraph(interacting?: unknown) {
  return {
    options: { interacting },
  } as any
}

function createMockCellView(shape: string) {
  return { cell: { shape } }
}

// ============================================================================
// 测试用例
// ============================================================================

describe('patchLaneInteracting / restoreLaneInteracting', () => {
  it('Lane 节点的 nodeMovable 应被设为 false（原始为 undefined）', () => {
    const graph = createMockGraph(undefined)
    patchLaneInteracting(graph, undefined)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(result).toEqual({ nodeMovable: false })
  })

  it('Lane 节点的 nodeMovable 应被设为 false（原始为 true）', () => {
    const graph = createMockGraph(true)
    patchLaneInteracting(graph, true)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(result).toEqual({ nodeMovable: false })
  })

  it('Lane 节点在原始 interacting 为 false 时应保持 false', () => {
    const graph = createMockGraph(false)
    patchLaneInteracting(graph, false)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(result).toBe(false)
  })

  it('Lane 节点的 nodeMovable 应被设为 false（原始为 InteractionMap）', () => {
    const original = { nodeMovable: true, edgeMovable: true }
    const graph = createMockGraph(original)
    patchLaneInteracting(graph, original)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(result).toEqual({ nodeMovable: false, edgeMovable: true })
  })

  it('Lane 节点的 nodeMovable 应被设为 false（原始为函数）', () => {
    const originalFn = (cellView: any) => ({
      nodeMovable: true,
      edgeMovable: cellView.cell.shape !== BPMN_LANE,
    })
    const graph = createMockGraph(originalFn)
    patchLaneInteracting(graph, originalFn)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(result).toEqual({ nodeMovable: false, edgeMovable: false })
  })

  it('非 Lane 节点应保留原始 interacting 行为（原始为 true）', () => {
    const graph = createMockGraph(true)
    patchLaneInteracting(graph, true)

    const userTaskResult = (graph.options.interacting as Function)(createMockCellView(BPMN_USER_TASK))
    expect(userTaskResult).toBe(true)

    const poolResult = (graph.options.interacting as Function)(createMockCellView(BPMN_POOL))
    expect(poolResult).toBe(true)
  })

  it('非 Lane 节点应保留原始 interacting 行为（原始为 InteractionMap）', () => {
    const original = { nodeMovable: true, edgeMovable: false }
    const graph = createMockGraph(original)
    patchLaneInteracting(graph, original)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_USER_TASK))
    expect(result).toEqual({ nodeMovable: true, edgeMovable: false })
  })

  it('非 Lane 节点应保留原始 interacting 行为（原始为函数）', () => {
    const originalFn = () => ({ nodeMovable: true, edgeMovable: true })
    const graph = createMockGraph(originalFn)
    patchLaneInteracting(graph, originalFn)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_USER_TASK))
    expect(result).toEqual({ nodeMovable: true, edgeMovable: true })
  })

  it('非 Lane 节点——原始函数返回布尔值时应正确委托', () => {
    const originalFn = () => false
    const graph = createMockGraph(originalFn)
    patchLaneInteracting(graph, originalFn)

    const result = (graph.options.interacting as Function)(createMockCellView(BPMN_USER_TASK))
    expect(result).toBe(false)
  })

  it('restoreLaneInteracting 应恢复原始 interacting', () => {
    const original = { nodeMovable: true }
    const graph = createMockGraph(original)
    patchLaneInteracting(graph, original)

    // 验证已被替换
    expect(graph.options.interacting).not.toBe(original)
    expect(typeof graph.options.interacting).toBe('function')

    // 恢复
    restoreLaneInteracting(graph, original)
    expect(graph.options.interacting).toBe(original)
  })

  it('restoreLaneInteracting 应能恢复为 undefined', () => {
    const graph = createMockGraph(undefined)
    patchLaneInteracting(graph, undefined)

    expect(typeof graph.options.interacting).toBe('function')

    restoreLaneInteracting(graph, undefined)
    expect(graph.options.interacting).toBeUndefined()
  })

  it('graph.options 不存在时不应抛出异常', () => {
    const graph = {} as any
    expect(() => patchLaneInteracting(graph, undefined)).not.toThrow()
    expect(() => restoreLaneInteracting(graph, undefined)).not.toThrow()
  })

  it('cellView 中缺少 cell 时应回退到原始行为', () => {
    const graph = createMockGraph(true)
    patchLaneInteracting(graph, true)

    // cellView 为空对象
    const result = (graph.options.interacting as Function)({})
    expect(result).toBe(true)

    // cellView 为 null
    const resultNull = (graph.options.interacting as Function)(null)
    expect(resultNull).toBe(true)
  })

  it('原始 interacting 为 null 时 Lane 应被禁止、非 Lane 应返回 true', () => {
    const graph = createMockGraph(null)
    patchLaneInteracting(graph, null)

    const laneResult = (graph.options.interacting as Function)(createMockCellView(BPMN_LANE))
    expect(laneResult).toEqual({ nodeMovable: false })

    const taskResult = (graph.options.interacting as Function)(createMockCellView(BPMN_USER_TASK))
    expect(taskResult).toBe(true)
  })
})
