/**
 * ProfileContext 与 Graph 绑定 — 单元测试
 *
 * 覆盖 createProfileContext、bindProfileToGraph（X6 shape 注册）、
 * getProfileContext、unbindProfile、WeakMap 隔离。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Graph } from '@antv/x6'
import {
  createProfileContext,
  bindProfileToGraph,
  getProfileContext,
  registerProfileCleanup,
  unbindProfile,
} from '../../../src/core/dialect/context'
import type { ResolvedProfile, NodeRendererFactory, EdgeRendererFactory } from '../../../src/core/dialect/types'

// ============================================================================
// 辅助
// ============================================================================

const taskRenderer: NodeRendererFactory = (tokens, node) => ({
  inherit: 'rect',
  width: 100,
  height: 60,
})

const seqRenderer: EdgeRendererFactory = (tokens, edge) => ({
  inherit: 'edge',
})

function makeResolvedProfile(id: string = 'test'): ResolvedProfile {
  return {
    meta: { id, name: id },
    definitions: {
      nodes: {
        task: { shape: `${id}-task-shape`, category: 'task', renderer: 'task' },
        disabledNode: { shape: `${id}-disabled-shape`, category: 'task', renderer: 'task' },
      },
      edges: {
        seq: { shape: `${id}-seq-shape`, category: 'sequenceFlow', renderer: 'seq' },
      },
    },
    availability: {
      nodes: { task: 'enabled', disabledNode: 'disabled' },
      edges: { seq: 'enabled' },
    },
    rendering: {
      theme: { colors: {}, icons: {} },
      nodeRenderers: { task: taskRenderer },
      edgeRenderers: { seq: seqRenderer },
    },
    rules: { nodeCategories: {}, connectionRules: {}, constraints: [] },
    dataModel: { fields: {}, categoryFields: {} },
    serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
  }
}

// ============================================================================
// createProfileContext
// ============================================================================

describe('createProfileContext', () => {
  it('应返回包含 profile 的 ProfileContext', () => {
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)
    expect(ctx.profile).toBe(resolved)
  })
})

// ============================================================================
// bindProfileToGraph / getProfileContext / unbindProfile
// ============================================================================

describe('bindProfileToGraph', () => {
  let registerNodeSpy: any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation((() => ({})) as any)
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation((() => ({})) as any)
  })

  afterEach(() => {
    registerNodeSpy.mockRestore()
    registerEdgeSpy.mockRestore()
  })

  function createTestGraph(): Graph {
    const container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    return new Graph({ container })
  }

  it('应注册启用的节点 shape', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const nodeRegistrations = registerNodeSpy.mock.calls.map((c: any[]) => c[0])
    expect(nodeRegistrations).toContain('test-task-shape')
  })

  it('不应注册禁用的节点 shape', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const nodeRegistrations = registerNodeSpy.mock.calls.map((c: any[]) => c[0])
    expect(nodeRegistrations).not.toContain('test-disabled-shape')
  })

  it('应注册启用的边 shape', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const edgeRegistrations = registerEdgeSpy.mock.calls.map((c: any[]) => c[0])
    expect(edgeRegistrations).toContain('test-seq-shape')
  })

  it('绑定后 getProfileContext 应返回 context', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    expect(getProfileContext(graph)).toBe(ctx)
  })

  it('unbindProfile 后 getProfileContext 应返回 undefined', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)
    unbindProfile(graph)

    expect(getProfileContext(graph)).toBeUndefined()
  })

  it('unbindProfile 应执行已注册的清理逻辑', () => {
    const graph = createTestGraph()
    const cleanup = vi.fn()
    const ctx = createProfileContext(makeResolvedProfile())

    bindProfileToGraph(graph, ctx)
    registerProfileCleanup(graph, cleanup)
    unbindProfile(graph)

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('不同 Graph 实例应有独立的 context', () => {
    const graph1 = createTestGraph()
    const graph2 = createTestGraph()

    const ctx1 = createProfileContext(makeResolvedProfile('profile1'))
    const ctx2 = createProfileContext(makeResolvedProfile('profile2'))

    bindProfileToGraph(graph1, ctx1)
    bindProfileToGraph(graph2, ctx2)

    expect(getProfileContext(graph1)?.profile.meta.id).toBe('profile1')
    expect(getProfileContext(graph2)?.profile.meta.id).toBe('profile2')
  })

  it('未绑定的 Graph getProfileContext 应返回 undefined', () => {
    const graph = createTestGraph()
    expect(getProfileContext(graph)).toBeUndefined()
  })

  it('节点 renderer 不存在时应跳过注册', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    // 修改 renderer 名为不存在的
    resolved.definitions.nodes.task.renderer = 'nonexistent'
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const nodeRegistrations = registerNodeSpy.mock.calls.map((c: any[]) => c[0])
    expect(nodeRegistrations).not.toContain(resolved.definitions.nodes.task.shape)
  })

  it('边 renderer 不存在时应跳过注册', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    // 修改 renderer 名为不存在的
    resolved.definitions.edges.seq.renderer = 'nonexistent'
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const edgeRegistrations = registerEdgeSpy.mock.calls.map((c: any[]) => c[0])
    expect(edgeRegistrations).not.toContain(resolved.definitions.edges.seq.shape)
  })

  it('禁用的边 shape 不应注册', () => {
    const graph = createTestGraph()
    const resolved = makeResolvedProfile()
    resolved.availability.edges.seq = 'disabled'
    const ctx = createProfileContext(resolved)

    bindProfileToGraph(graph, ctx)

    const edgeRegistrations = registerEdgeSpy.mock.calls.map((c: any[]) => c[0])
    expect(edgeRegistrations).not.toContain(resolved.definitions.edges.seq.shape)
  })
})
