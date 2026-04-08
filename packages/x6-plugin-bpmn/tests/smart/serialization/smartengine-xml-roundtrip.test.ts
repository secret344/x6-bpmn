import { describe, expect, it } from 'vitest'
import { exportBpmnXml } from '../../../src/export/exporter'
import { parseBpmnXml } from '../../../src/import'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import {
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineDatabaseProfile,
} from '../../../src/builtin'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_END_EVENT,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_RECEIVE_TASK,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_START_EVENT,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

function createSmartRegistry(): ProfileRegistry {
  const registry = new ProfileRegistry()
  registry.registerAll([
    bpmn2Profile,
    smartengineBaseProfile,
    smartengineDatabaseProfile,
  ])
  return registry
}

type GraphNodeSpec = {
  id: string
  shape: string
  x: number
  y: number
  width: number
  height: number
  data?: { bpmn?: Record<string, unknown> }
}

type GraphEdgeSpec = {
  id: string
  shape: string
  source: { cell: string; port?: string }
  target: { cell: string; port?: string }
  data?: { bpmn?: Record<string, unknown> }
  labels?: Array<{ attrs?: { label?: { text?: string } } }>
  vertices?: Array<{ x: number; y: number }>
}

function createGraph(): any {
  const nodes: Array<Record<string, unknown>> = []
  const edges: Array<Record<string, unknown>> = []
  const cells = new Map<string, Record<string, unknown>>()

  return {
    addNode(spec: GraphNodeSpec) {
      const node = {
        ...spec,
        getPosition: () => ({ x: spec.x, y: spec.y }),
        getSize: () => ({ width: spec.width, height: spec.height }),
        getData: () => spec.data ?? {},
        getAttrs: () => ({}),
        getParent: () => null,
        isNode: () => true,
      }
      nodes.push(node)
      cells.set(spec.id, node)
      return node
    },
    addEdge(spec: GraphEdgeSpec) {
      const edge = {
        ...spec,
        getSourceCellId: () => spec.source.cell,
        getTargetCellId: () => spec.target.cell,
        getSource: () => spec.source,
        getTarget: () => spec.target,
        getLabels: () => spec.labels ?? [],
        getData: () => spec.data ?? {},
        getVertices: () => spec.vertices ?? [],
      }
      edges.push(edge)
      cells.set(spec.id, edge)
      return edge
    },
    getNodes: () => nodes,
    getEdges: () => edges,
    getCellById: (id: string) => cells.get(id),
  }
}

describe('SmartEngine XML roundtrip', () => {
  it('smartengine-base 应导出并导入 wiki 定义的 smart 扩展', async () => {
    const graph = createGraph()
    const resolved = createSmartRegistry().compile('smartengine-base')

    graph.addNode({
      id: 'start_1',
      shape: BPMN_START_EVENT,
      x: 80,
      y: 220,
      width: 36,
      height: 36,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'gateway_1',
      shape: BPMN_EXCLUSIVE_GATEWAY,
      x: 200,
      y: 210,
      width: 50,
      height: 50,
      data: {
        bpmn: {
          name: '路由网关',
          smartClass: 'com.example.RouteGatewayDelegation',
        },
      },
    })
    graph.addNode({
      id: 'service_1',
      shape: BPMN_SERVICE_TASK,
      x: 340,
      y: 130,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '执行服务',
          smartClass: 'com.example.ServiceDelegation',
          smartProperties: '[{"type":"constant","name":"serviceName","value":"orderService"}]',
          smartExecutionListeners: '[{"event":"ACTIVITY_START,ACTIVITY_END","class":"com.example.StartListener"}]',
          plainKey: 'keep-as-x6bpmn',
        },
      },
    })
    graph.addNode({
      id: 'receive_1',
      shape: BPMN_RECEIVE_TASK,
      x: 340,
      y: 290,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '等待回调',
          smartClass: 'com.example.CallbackDelegation',
        },
      },
    })
    graph.addNode({
      id: 'end_1',
      shape: BPMN_END_EVENT,
      x: 550,
      y: 220,
      width: 36,
      height: 36,
      data: { bpmn: { name: '结束' } },
    })

    graph.addEdge({ id: 'flow_1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start_1' }, target: { cell: 'gateway_1' } })
    graph.addEdge({
      id: 'flow_2',
      shape: BPMN_CONDITIONAL_FLOW,
      source: { cell: 'gateway_1' },
      target: { cell: 'service_1' },
      data: { bpmn: { conditionExpression: "approve == 'agree'", conditionExpressionType: 'mvel' } },
      labels: [{ attrs: { label: { text: '通过' } } }],
    })
    graph.addEdge({ id: 'flow_3', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'gateway_1' }, target: { cell: 'receive_1' } })
    graph.addEdge({ id: 'flow_4', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service_1' }, target: { cell: 'end_1' } })
    graph.addEdge({ id: 'flow_5', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'receive_1' }, target: { cell: 'end_1' } })

    const xml = await exportBpmnXml(graph, {
      processId: 'exclusiveTest',
      serialization: resolved.serialization,
    })

    expect(xml).toContain('xmlns:smart="http://smartengine.org/schema/process"')
    expect(xml).toContain('targetNamespace="Examples"')
    expect(xml).toContain('<bpmn:process')
    expect(xml).toContain('id="exclusiveTest"')
    expect(xml).toContain('version="1.0.0"')
    expect(xml).toContain('smart:class="com.example.RouteGatewayDelegation"')
    expect(xml).toContain('smart:class="com.example.ServiceDelegation"')
    expect(xml).toContain('<smart:properties>')
    expect(xml).toContain('type="constant"')
    expect(xml).toContain('name="serviceName"')
    expect(xml).toContain('value="orderService"')
    expect(xml).toContain('<smart:executionListener')
    expect(xml).toContain('event="ACTIVITY_START,ACTIVITY_END"')
    expect(xml).toContain('class="com.example.StartListener"')
    expect(xml).toContain('<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" type="mvel">approve == \'agree\'</bpmn:conditionExpression>')
    expect(xml).toContain('<x6bpmn:property name="plainKey" value="keep-as-x6bpmn"')

    const imported = await parseBpmnXml(xml, { serialization: resolved.serialization })
    const serviceNode = imported.nodes.find((node) => node.id === 'service_1')
    const gatewayNode = imported.nodes.find((node) => node.id === 'gateway_1')
    const receiveNode = imported.nodes.find((node) => node.id === 'receive_1')
    const conditionEdge = imported.edges.find((edge) => edge.id === 'flow_2')

    expect(imported.metadata).toEqual({
      targetNamespace: 'Examples',
      processVersion: '1.0.0',
    })
    expect(serviceNode?.data).toEqual({
      bpmn: {
        name: '执行服务',
        smartClass: 'com.example.ServiceDelegation',
        smartProperties: '[{"type":"constant","name":"serviceName","value":"orderService"}]',
        smartExecutionListeners: '[{"event":"ACTIVITY_START,ACTIVITY_END","class":"com.example.StartListener"}]',
        plainKey: 'keep-as-x6bpmn',
      },
    })
    expect(gatewayNode?.data).toEqual({
      bpmn: {
        name: '路由网关',
        smartClass: 'com.example.RouteGatewayDelegation',
      },
    })
    expect(receiveNode?.data).toEqual({
      bpmn: {
        name: '等待回调',
        smartClass: 'com.example.CallbackDelegation',
      },
    })
    expect(conditionEdge?.data).toEqual({
      bpmn: {
        conditionExpression: "approve == 'agree'",
        conditionExpressionType: 'mvel',
      },
    })

    const aliasXml = xml.replace(/smart:executionListener/g, 'smart:eventListener')
    const importedAlias = await parseBpmnXml(aliasXml, { serialization: resolved.serialization })
    const aliasServiceNode = importedAlias.nodes.find((node) => node.id === 'service_1')
    expect(aliasServiceNode?.data).toEqual(serviceNode?.data)

  })

  it('smartengine-database 应导出并导入 DataBase 模式的多实例 userTask', async () => {
    const graph = createGraph()
    const resolved = createSmartRegistry().compile('smartengine-database')

    graph.addNode({
      id: 'start_1',
      shape: BPMN_START_EVENT,
      x: 80,
      y: 180,
      width: 36,
      height: 36,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'user_1',
      shape: BPMN_USER_TASK,
      x: 220,
      y: 160,
      width: 140,
      height: 60,
      data: {
        bpmn: {
          name: '审批任务',
          multiInstance: true,
          multiInstanceType: 'sequential',
          multiInstanceCollection: '${approverList}',
          multiInstanceElementVariable: 'approver',
          multiInstanceCompletionCondition: '${nrOfCompletedInstances >= 2}',
          approvalType: 'review',
          approvalStrategy: 'any',
          smartProperties: '[{"name":"taskTitle","value":"审批"}]',
          smartExecutionListeners: '[{"event":"ACTIVITY_END","class":"com.example.EndListener"}]',
        },
      },
    })
    graph.addNode({
      id: 'end_1',
      shape: BPMN_END_EVENT,
      x: 440,
      y: 180,
      width: 36,
      height: 36,
      data: { bpmn: { name: '结束' } },
    })

    graph.addEdge({ id: 'flow_1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start_1' }, target: { cell: 'user_1' } })
    graph.addEdge({ id: 'flow_2', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'user_1' }, target: { cell: 'end_1' } })

    const xml = await exportBpmnXml(graph, {
      processId: 'approvalProcess',
      serialization: resolved.serialization,
    })

    expect(xml).toContain('<bpmn:multiInstanceLoopCharacteristics')
    expect(xml).toContain('isSequential="true"')
    expect(xml).toContain('collection="${approverList}"')
    expect(xml).toContain('elementVariable="approver"')
    expect(xml).toContain('${nrOfCompletedInstances &gt;= 2}')
    expect(xml).toContain('name="approvalType" value="review"')
    expect(xml).toContain('name="approvalStrategy" value="any"')
    expect(xml).toContain('name="taskTitle" value="审批"')
    expect(xml).toContain('event="ACTIVITY_END"')

    const imported = await parseBpmnXml(xml, { serialization: resolved.serialization })
    const userTask = imported.nodes.find((node) => node.id === 'user_1')

    expect(userTask?.data).toEqual({
      bpmn: {
        name: '审批任务',
        multiInstance: true,
        multiInstanceType: 'sequential',
        multiInstanceCollection: '${approverList}',
        multiInstanceElementVariable: 'approver',
        multiInstanceCompletionCondition: '${nrOfCompletedInstances >= 2}',
        approvalType: 'review',
        approvalStrategy: 'any',
        smartProperties: '[{"name":"taskTitle","value":"审批"}]',
        smartExecutionListeners: '[{"event":"ACTIVITY_END","class":"com.example.EndListener"}]',
      },
    })

  })
})
