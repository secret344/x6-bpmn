import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graph, type Graph as X6Graph } from '@antv/x6'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import { createProfileContext, bindProfileToGraph } from '../../../src/core/dialect/context'
import { validateDiagram } from '../../../src/core/validation'
import {
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineCustomProfile,
  smartengineDatabaseProfile,
} from '../../../src/builtin'
import {
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_COMPLEX_GATEWAY,
  BPMN_END_EVENT,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_MANUAL_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_START_EVENT,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'

const scenarioShapes = [
  BPMN_START_EVENT,
  BPMN_END_EVENT,
  BPMN_USER_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_SERVICE_TASK,
  BPMN_INCLUSIVE_GATEWAY,
]

const createdGraphs: X6Graph[] = []

function createSmartRegistry(): ProfileRegistry {
  const registry = new ProfileRegistry()
  registry.registerAll([
    bpmn2Profile,
    smartengineBaseProfile,
    smartengineCustomProfile,
    smartengineDatabaseProfile,
  ])
  return registry
}

function bindResolvedProfile(graph: X6Graph, profileId: 'smartengine-base' | 'smartengine-custom' | 'smartengine-database'): void {
  const registry = createSmartRegistry()
  bindProfileToGraph(graph, createProfileContext(registry.compile(profileId)))
}

function createRuntimeGraph(): X6Graph {
  const graph = createBehaviorTestGraph()
  createdGraphs.push(graph)
  return graph
}

function createScenarioGraph(): X6Graph {
  registerBehaviorTestShapes(scenarioShapes)
  return createRuntimeGraph()
}

afterEach(() => {
  vi.restoreAllMocks()
  while (createdGraphs.length > 0) {
    const graph = createdGraphs.pop()
    if (graph) {
      destroyBehaviorTestGraph(graph)
    }
  }
})

describe('SmartEngine 业务场景 —— 模式能力边界', () => {
  it('smartengine-base 应保留 BPMN 2.0 默认节点集', () => {
    // 文档来源：SmartEngine UserGuide Chinese Version / 背景知识 / 流程定义解释说明。
    // 结论：SmartEngine 整体仍建立在 BPMN 2.0 之上，仅对特定节点施加模式限制。
    const registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation((() => ({})) as any)
    const graph = createRuntimeGraph()

    bindResolvedProfile(graph, 'smartengine-base')

    const registeredShapes = registerNodeSpy.mock.calls.map((call) => call[0])
    expect(registeredShapes).toEqual(expect.arrayContaining([
      BPMN_USER_TASK,
      BPMN_MANUAL_TASK,
      BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY,
      BPMN_AD_HOC_SUB_PROCESS,
    ]))
  })

  it('smartengine-custom 运行时只屏蔽 DataBase 专属节点', () => {
    // 文档来源：SmartEngine UserGuide Chinese Version / 流程定义解释说明、包容网关。
    // 结论：Custom 模式下 userTask 建议由 receiveTask 替代，inclusiveGateway 仅支持 DataBase 模式。
    const registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation((() => ({})) as any)
    const graph = createRuntimeGraph()

    bindResolvedProfile(graph, 'smartengine-custom')

    const registeredShapes = registerNodeSpy.mock.calls.map((call) => call[0])
    expect(registeredShapes).toEqual(expect.arrayContaining([
      BPMN_RECEIVE_TASK,
      BPMN_MANUAL_TASK,
      BPMN_SERVICE_TASK,
    ]))
    expect(registeredShapes).not.toContain(BPMN_USER_TASK)
    expect(registeredShapes).not.toContain(BPMN_INCLUSIVE_GATEWAY)
  })

  it('smartengine-database 运行时应保留 userTask 与 inclusiveGateway', () => {
    // 文档来源：SmartEngine UserGuide Chinese Version / UserTask、包容网关。
    // 结论：DataBase 模式支持人工任务与包容网关，不应再额外裁剪这些 BPMN 2.0 节点。
    const registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation((() => ({})) as any)
    const graph = createRuntimeGraph()

    bindResolvedProfile(graph, 'smartengine-database')

    const registeredShapes = registerNodeSpy.mock.calls.map((call) => call[0])
    expect(registeredShapes).toEqual(expect.arrayContaining([
      BPMN_USER_TASK,
      BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY,
      BPMN_AD_HOC_SUB_PROCESS,
    ]))
  })
})

describe('SmartEngine 业务场景 —— 文档示例流', () => {
  it('smartengine-custom 应支持 receiveTask 等待回调的服务编排流程', async () => {
    // 文档来源：SmartEngine UserGuide Chinese Version / 流程定义解释说明。
    // receiveTask 在引擎处会暂停，等待外部 signal 驱动继续执行，是 Custom 模式的典型等待节点。
    const graph = createScenarioGraph()
    bindResolvedProfile(graph, 'smartengine-custom')

    graph.addNode({
      id: 'start-1',
      shape: BPMN_START_EVENT,
      x: 60,
      y: 120,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'receive-1',
      shape: BPMN_RECEIVE_TASK,
      x: 150,
      y: 110,
      width: 120,
      height: 60,
      data: { bpmn: { name: '等待回调' } },
    })
    graph.addNode({
      id: 'service-1',
      shape: BPMN_SERVICE_TASK,
      x: 330,
      y: 110,
      width: 120,
      height: 60,
      data: { bpmn: { name: '执行服务', smartClass: 'com.example.ExecuteTaskDelegation' } },
    })
    graph.addNode({
      id: 'end-1',
      shape: BPMN_END_EVENT,
      x: 520,
      y: 120,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })

    graph.addEdge({ id: 'flow-1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start-1' }, target: { cell: 'receive-1' } })
    graph.addEdge({ id: 'flow-2', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'receive-1' }, target: { cell: 'service-1' } })
    graph.addEdge({ id: 'flow-3', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service-1' }, target: { cell: 'end-1' } })

    const report = await validateDiagram(graph)
    expect(report.profileId).toBe('smartengine-custom')
    expect(report.issues).toEqual([])
  })

  it('smartengine-database 应支持 userTask 与 inclusiveGateway 审批分支', async () => {
    // 文档来源：SmartEngine UserGuide Chinese Version / UserTask、包容网关。
    // DataBase 模式支持人工任务以及包容网关分支聚合，属于审批流典型路径。
    const graph = createScenarioGraph()
    bindResolvedProfile(graph, 'smartengine-database')

    graph.addNode({
      id: 'start-1',
      shape: BPMN_START_EVENT,
      x: 50,
      y: 190,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'user-1',
      shape: BPMN_USER_TASK,
      x: 140,
      y: 180,
      width: 120,
      height: 60,
      data: { bpmn: { name: '人工审批', multiInstance: true, multiInstanceType: 'parallel' } },
    })
    graph.addNode({
      id: 'gateway-1',
      shape: BPMN_INCLUSIVE_GATEWAY,
      x: 320,
      y: 185,
      width: 50,
      height: 50,
      data: { bpmn: { name: '按条件分支' } },
    })
    graph.addNode({
      id: 'service-1',
      shape: BPMN_SERVICE_TASK,
      x: 430,
      y: 110,
      width: 120,
      height: 60,
      data: { bpmn: { name: '自动执行', smartClass: 'com.example.AutoExecuteDelegation' } },
    })
    graph.addNode({
      id: 'manual-1',
      shape: BPMN_MANUAL_TASK,
      x: 430,
      y: 270,
      width: 120,
      height: 60,
      data: { bpmn: { name: '人工补充' } },
    })
    graph.addNode({
      id: 'end-1',
      shape: BPMN_END_EVENT,
      x: 640,
      y: 190,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })

    graph.addEdge({ id: 'flow-1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start-1' }, target: { cell: 'user-1' } })
    graph.addEdge({ id: 'flow-2', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'user-1' }, target: { cell: 'gateway-1' } })
    graph.addEdge({ id: 'flow-3', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'gateway-1' }, target: { cell: 'service-1' } })
    graph.addEdge({ id: 'flow-4', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'gateway-1' }, target: { cell: 'manual-1' } })
    graph.addEdge({ id: 'flow-5', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service-1' }, target: { cell: 'end-1' } })
    graph.addEdge({ id: 'flow-6', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'manual-1' }, target: { cell: 'end-1' } })

    const report = await validateDiagram(graph)
    expect(report.profileId).toBe('smartengine-database')
    expect(report.issues).toEqual([])
  })
})