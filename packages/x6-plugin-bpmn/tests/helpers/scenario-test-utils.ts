import { Graph, type Graph as X6Graph } from '@antv/x6'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from './behavior-test-graph'

interface ScenarioGraphHelperOptions {
  nodeShapes: string[]
  edgeShapes?: string[]
  width?: number
  height?: number
}

interface ScenarioGraphHelper {
  createGraph: () => X6Graph
  cleanupGraphs: () => void
}

/**
 * 为业务场景测试创建共享图工具，统一节点/边注册与 Graph 生命周期清理。
 */
export function createScenarioGraphHelper(options: ScenarioGraphHelperOptions): ScenarioGraphHelper {
  const createdGraphs: X6Graph[] = []

  function ensureShapesRegistered(): void {
    registerBehaviorTestShapes(options.nodeShapes)

    for (const edgeShape of options.edgeShapes ?? []) {
      try {
        Graph.registerEdge(edgeShape, {
          inherit: 'edge',
          attrs: { line: { stroke: '#000' } },
        }, true)
      } catch {
        // 测试重复注册时保持静默。
      }
    }
  }

  function createGraph(): X6Graph {
    ensureShapesRegistered()
    const graph = createBehaviorTestGraph(options.width, options.height)
    createdGraphs.push(graph)
    return graph
  }

  function cleanupGraphs(): void {
    while (createdGraphs.length > 0) {
      const graph = createdGraphs.pop()
      if (graph) {
        destroyBehaviorTestGraph(graph)
      }
    }
  }

  return {
    createGraph,
    cleanupGraphs,
  }
}