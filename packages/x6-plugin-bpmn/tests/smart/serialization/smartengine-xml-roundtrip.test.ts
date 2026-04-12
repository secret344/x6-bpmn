import { describe, expect, it } from 'vitest'
import { exportBpmnXml } from '../../../src/export/exporter'
import { parseBpmnXml } from '../../../src/import'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import {
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineCustomProfile,
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
import { SMARTENGINE_NAMESPACE_URI } from '../../../src/builtin/smartengine-base/serialization'

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
  it('smartengine-custom 仅在服务编排模式下省略 BPMN 标签前缀', async () => {
    const graph = createGraph()
    const registry = createSmartRegistry()
    const customResolved = registry.compile('smartengine-custom')
    const baseResolved = registry.compile('smartengine-base')

    graph.addNode({
      id: 'start_1',
      shape: BPMN_START_EVENT,
      x: 80,
      y: 200,
      width: 36,
      height: 36,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'service_1',
      shape: BPMN_SERVICE_TASK,
      x: 220,
      y: 180,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '调用服务',
          smartClass: 'com.example.ServiceDelegation',
          smartProperties: '[{"name":"serviceName","value":"serviceA"}]',
        },
      },
    })
    graph.addNode({
      id: 'end_1',
      shape: BPMN_END_EVENT,
      x: 420,
      y: 200,
      width: 36,
      height: 36,
      data: { bpmn: { name: '结束' } },
    })
    graph.addEdge({ id: 'flow_1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start_1' }, target: { cell: 'service_1' } })
    graph.addEdge({ id: 'flow_2', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service_1' }, target: { cell: 'end_1' } })

    const customXml = await exportBpmnXml(graph, {
      processId: 'serviceOrchestration',
      serialization: customResolved.serialization,
    })
    const baseXml = await exportBpmnXml(graph, {
      processId: 'serviceOrchestration',
      serialization: baseResolved.serialization,
    })

    expect(customXml).toContain('<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"')
    expect(customXml).toContain('<startEvent id="start_1"')
    expect(customXml).toContain('<serviceTask id="service_1"')
    expect(customXml).not.toContain('<bpmn:startEvent')
    expect(customXml).not.toContain('<bpmn:serviceTask')

    const importedCustom = await parseBpmnXml(customXml, { serialization: customResolved.serialization })
    expect(importedCustom.nodes.find((node) => node.id === 'start_1')?.shape).toBe(BPMN_START_EVENT)
    expect(importedCustom.nodes.find((node) => node.id === 'service_1')?.shape).toBe(BPMN_SERVICE_TASK)
    expect(importedCustom.nodes.find((node) => node.id === 'service_1')?.data).toEqual({
      bpmn: {
        $attrs: {
          'smart:class': 'com.example.ServiceDelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
        name: '调用服务',
        smartClass: 'com.example.ServiceDelegation',
        smartProperties: '[{"name":"serviceName","value":"serviceA"}]',
      },
    })

    expect(baseXml).toContain('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"')
    expect(baseXml).toContain('<bpmn:startEvent id="start_1"')
    expect(baseXml).toContain('<bpmn:serviceTask id="service_1"')
  })

  it('smartengine-custom 应按 smart 文档导出 serviceTask 的 smart 扩展结构', async () => {
    const graph = createGraph()
    const resolved = createSmartRegistry().compile('smartengine-custom')

    graph.addNode({
      id: 'start_1',
      shape: BPMN_START_EVENT,
      x: 80,
      y: 200,
      width: 36,
      height: 36,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'service_1',
      shape: BPMN_SERVICE_TASK,
      x: 220,
      y: 180,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '调用服务A',
          smartClass: 'com.example.ServiceADelegation',
          smartProperties: '[{"name":"serviceName","value":"serviceA"}]',
        },
      },
    })
    graph.addNode({
      id: 'service_2',
      shape: BPMN_SERVICE_TASK,
      x: 420,
      y: 180,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '调用服务B',
          smartClass: 'com.example.ServiceBDelegation',
          smartProperties: '[{"name":"serviceName","value":"serviceB"}]',
        },
      },
    })
    graph.addNode({
      id: 'end_1',
      shape: BPMN_END_EVENT,
      x: 620,
      y: 200,
      width: 36,
      height: 36,
      data: { bpmn: { name: '结束' } },
    })

    graph.addEdge({ id: 'flow_1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start_1' }, target: { cell: 'service_1' } })
    graph.addEdge({ id: 'flow_2', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service_1' }, target: { cell: 'service_2' } })
    graph.addEdge({ id: 'flow_3', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'service_2' }, target: { cell: 'end_1' } })

    const xml = await exportBpmnXml(graph, {
      processId: 'serviceOrchestration',
      serialization: resolved.serialization,
    })

    expect(xml).toContain('<startEvent id="start_1"')
    expect(xml).toContain('<serviceTask id="service_1"')
    expect(xml).toContain('<serviceTask id="service_2"')
    expect(xml).not.toContain('<bpmn:startEvent')
    expect(xml).toContain('xmlns:smart="http://smartengine.org/schema/process"')
    expect(xml).toContain('smart:class="com.example.ServiceADelegation"')
    expect(xml).toContain('smart:class="com.example.ServiceBDelegation"')
    expect(xml).toContain('<smart:properties>')
    expect(xml).toContain('name="serviceName" value="serviceA"')
    expect(xml).toContain('name="serviceName" value="serviceB"')
    expect(xml).not.toContain('<modeler:property name="smartClass"')

    const imported = await parseBpmnXml(xml, { serialization: resolved.serialization })
    expect(imported.nodes.find((node) => node.id === 'service_1')?.data).toEqual({
      bpmn: {
        $attrs: {
          'smart:class': 'com.example.ServiceADelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
        name: '调用服务A',
        smartClass: 'com.example.ServiceADelegation',
        smartProperties: '[{"name":"serviceName","value":"serviceA"}]',
      },
    })
    expect(imported.nodes.find((node) => node.id === 'service_2')?.data).toEqual({
      bpmn: {
        $attrs: {
          'smart:class': 'com.example.ServiceBDelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
        name: '调用服务B',
        smartClass: 'com.example.ServiceBDelegation',
        smartProperties: '[{"name":"serviceName","value":"serviceB"}]',
      },
    })
  })

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
        $attrs: {
          'smart:class': 'com.example.ServiceDelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
        name: '执行服务',
        smartClass: 'com.example.ServiceDelegation',
        smartProperties: '[{"type":"constant","name":"serviceName","value":"orderService"}]',
        smartExecutionListeners: '[{"event":"ACTIVITY_START,ACTIVITY_END","class":"com.example.StartListener"}]',
      },
    })
    expect(gatewayNode?.data).toEqual({
      bpmn: {
        $attrs: {
          'smart:class': 'com.example.RouteGatewayDelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
        name: '路由网关',
        smartClass: 'com.example.RouteGatewayDelegation',
      },
    })
    expect(receiveNode?.data).toEqual({
      bpmn: {
        $attrs: {
          'smart:class': 'com.example.CallbackDelegation',
        },
        $namespaces: {
          smart: 'http://smartengine.org/schema/process',
        },
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

  it('smartengine-base 在 smart 扩展属性场景下应按 smart 前缀导出通用属性', async () => {
    const graph = createGraph()
    const resolved = createSmartRegistry().compile('smartengine-base')
    const serialization = {
      ...resolved.serialization,
      extensionProperties: {
        prefix: 'smart',
        namespaceUri: SMARTENGINE_NAMESPACE_URI,
        containerLocalName: 'properties',
        propertyLocalName: 'property',
      },
    }

    graph.addNode({
      id: 'start_1',
      shape: BPMN_START_EVENT,
      x: 80,
      y: 180,
      width: 36,
      height: 36,
      data: {
        bpmn: {
          name: '开始',
          plainKey: 'keep-as-smart-extension',
        },
      },
    })
    graph.addNode({
      id: 'end_1',
      shape: BPMN_END_EVENT,
      x: 240,
      y: 180,
      width: 36,
      height: 36,
      data: { bpmn: { name: '结束' } },
    })
    graph.addEdge({ id: 'flow_1', shape: BPMN_SEQUENCE_FLOW, source: { cell: 'start_1' }, target: { cell: 'end_1' } })

    const xml = await exportBpmnXml(graph, {
      processId: 'smartExtensionFallback',
      serialization,
    })

    expect(xml).toContain('<smart:properties>')
    expect(xml).toContain('<smart:property name="plainKey" value="keep-as-smart-extension"')
    expect(xml).not.toContain('<modeler:property')

    const imported = await parseBpmnXml(xml, { serialization })
    expect(imported.nodes.find((node) => node.id === 'start_1')?.data).toEqual({
      bpmn: {
        name: '开始',
        plainKey: 'keep-as-smart-extension',
      },
    })
  })

  it('smartengine-base 的 userTask smartProperties 应导出为 smart:properties 而不是 modeler:properties', async () => {
    const graph = createGraph()
    const resolved = createSmartRegistry().compile('smartengine-base')

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
          name: '人工复核',
          smartProperties: '[{"name":"taskType","value":"manual-review"}]',
          smartExecutionListeners: '[{"event":"ACTIVITY_START","class":"com.example.StartListener"}]',
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
      processId: 'userTaskSmartExtensions',
      serialization: resolved.serialization,
    })

    expect(xml).toContain('<smart:properties>')
    expect(xml).toContain('name="taskType" value="manual-review"')
    expect(xml).toContain('<smart:executionListener')
    expect(xml).toContain('event="ACTIVITY_START"')
    expect(xml).not.toContain('<modeler:property name="smartProperties"')
    expect(xml).not.toContain('<modeler:property name="smartExecutionListeners"')

    const imported = await parseBpmnXml(xml, { serialization: resolved.serialization })
    expect(imported.nodes.find((node) => node.id === 'user_1')?.data).toEqual({
      bpmn: {
        name: '人工复核',
        smartProperties: '[{"name":"taskType","value":"manual-review"}]',
        smartExecutionListeners: '[{"event":"ACTIVITY_START","class":"com.example.StartListener"}]',
      },
    })
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
    expect(xml).toContain('<smart:properties>')
    expect(xml).toContain('name="approvalType" value="review"')
    expect(xml).toContain('name="approvalStrategy" value="any"')
    expect(xml).toContain('name="taskTitle" value="审批"')
    expect(xml).toContain('event="ACTIVITY_END"')
    expect(xml).not.toContain('smart:approvalType=')
    expect(xml).not.toContain('smart:approvalStrategy=')
    expect(xml).not.toContain('<modeler:property name="approvalType"')
    expect(xml).not.toContain('<modeler:property name="approvalStrategy"')

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
