/**
 * 流程方言内核 — ProfileContext 与 Graph 绑定
 *
 * ProfileContext 是运行时方言上下文，绑定到具体的 graph 实例。
 * 每个 graph 拥有独立的 context，不使用全局状态，支持多实例并行。
 */

import { Graph } from '@antv/x6'
import type { ResolvedProfile, ProfileContext } from './types'

// ============================================================================
// ProfileContext 创建
// ============================================================================

/**
 * 根据编译后的 ResolvedProfile 创建运行时 ProfileContext。
 */
export function createProfileContext(resolved: ResolvedProfile): ProfileContext {
  return {
    profile: resolved,
  }
}

// ============================================================================
// Graph 绑定
// ============================================================================

/** WeakMap 存储 graph 实例与 ProfileContext 的绑定关系 */
const graphContextMap = new WeakMap<Graph, ProfileContext>()

/**
 * 将 ProfileContext 绑定到 Graph 实例。
 *
 * 绑定时执行：
 * 1. 注册当前 profile 中所有启用的节点和边到 X6 注册表
 * 2. 将 context 关联到 graph 实例
 *
 * @param graph — X6 Graph 实例
 * @param context — ProfileContext 运行时上下文
 */
export function bindProfileToGraph(graph: Graph, context: ProfileContext): void {
  const { profile } = context
  const { definitions, availability, rendering } = profile

  // 注册所有启用的节点 shape
  for (const [key, nodeDef] of Object.entries(definitions.nodes)) {
    const avail = availability.nodes[key]
    if (avail === 'disabled') continue

    const renderer = rendering.nodeRenderers[nodeDef.renderer]
    if (renderer) {
      const shapeDef = renderer(rendering.theme, nodeDef)
      Graph.registerNode(nodeDef.shape, shapeDef as any, true)
    }
  }

  // 注册所有启用的边 shape
  for (const [key, edgeDef] of Object.entries(definitions.edges)) {
    const avail = availability.edges[key]
    if (avail === 'disabled') continue

    const renderer = rendering.edgeRenderers[edgeDef.renderer]
    if (renderer) {
      const edgeConfig = renderer(rendering.theme, edgeDef)
      Graph.registerEdge(edgeDef.shape, edgeConfig as any, true)
    }
  }

  // 绑定 context 到 graph
  graphContextMap.set(graph, context)
}

/**
 * 获取绑定到 Graph 实例的 ProfileContext。
 * 若未绑定则返回 undefined。
 */
export function getProfileContext(graph: Graph): ProfileContext | undefined {
  return graphContextMap.get(graph)
}

/**
 * 解除 Graph 实例的 ProfileContext 绑定。
 */
export function unbindProfile(graph: Graph): void {
  graphContextMap.delete(graph)
}
