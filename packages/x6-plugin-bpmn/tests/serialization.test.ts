/**
 * 序列化适配器测试
 *
 * 覆盖：
 * - 预设序列化适配器的解析与继承
 * - BPMN 2.0 标准导出（DI、命名空间）
 * - SmartEngine 导出（smart: 命名空间、smart:class、MVEL 条件、无 DI）
 * - SmartEngine 导入（smart:class 提取、smart:properties 提取）
 * - SmartEngine 导出/导入 round-trip
 * - 自定义序列化适配器扩展
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import {
  registerPreset,
  clearPresets,
  resolvePreset,
  createExtendedPreset,
  BPMN2_PRESET,
  SMARTENGINE_PRESET,
} from '../src/rules/presets'
import type { SerializationAdapter } from '../src/rules/presets/types'
import { exportBpmnXml } from '../src/export/exporter'
import { importBpmnXml } from '../src/export/importer'
import { NODE_MAPPING, EDGE_MAPPING } from '../src/export/bpmn-mapping'
import {
  BPMN_START_EVENT,
  BPMN_END_EVENT,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
} from '../src/utils/constants'

// ============================================================================
// Register simplified shapes for testing
// ============================================================================

const allNodeShapes = Object.keys(NODE_MAPPING)
const allEdgeShapes = Object.keys(EDGE_MAPPING)

for (const shapeName of allNodeShapes) {
  try {
    Graph.registerNode(shapeName, {
      inherit: 'rect',
      attrs: { body: { fill: '#fff', stroke: '#000' }, label: { text: '' } },
    }, true)
  } catch { /* already registered */ }
}

for (const shapeName of allEdgeShapes) {
  try {
    Graph.registerEdge(shapeName, {
      inherit: 'edge',
      attrs: { line: { stroke: '#000' } },
    }, true)
  } catch { /* already registered */ }
}

// ============================================================================
// Helpers
// ============================================================================

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 800, height: 600 })
}

function resetRegistry(): void {
  clearPresets()
  registerPreset(BPMN2_PRESET)
  registerPreset(SMARTENGINE_PRESET)
}

// ============================================================================
// Tests
// ============================================================================

describe('序列化适配器', () => {
  beforeEach(() => {
    resetRegistry()
  })

  // ==========================================================================
  // 预设序列化配置解析
  // ==========================================================================

  describe('预设序列化配置解析', () => {
    it('bpmn2 预设应有序列化配置', () => {
      const resolved = resolvePreset('bpmn2')
      expect(resolved.serialization).toBeDefined()
      expect(resolved.serialization.targetNamespace).toBe('http://bpmn.io/schema/bpmn')
      expect(resolved.serialization.includeDI).toBe(true)
    })

    it('smartengine 预设应有序列化配置', () => {
      const resolved = resolvePreset('smartengine')
      expect(resolved.serialization).toBeDefined()
      expect(resolved.serialization.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
      expect(resolved.serialization.targetNamespace).toBe('Examples')
      expect(resolved.serialization.includeDI).toBe(false)
      expect(resolved.serialization.conditionExpressionType).toBe('mvel')
    })

    it('smartengine 应有 transformExportNode 钩子', () => {
      const resolved = resolvePreset('smartengine')
      expect(typeof resolved.serialization.transformExportNode).toBe('function')
    })

    it('smartengine 应有 transformImportNode 钩子', () => {
      const resolved = resolvePreset('smartengine')
      expect(typeof resolved.serialization.transformImportNode).toBe('function')
    })

    it('继承链应合并序列化配置', () => {
      createExtendedPreset('custom-se', 'smartengine', {
        serialization: {
          xmlNamespaces: { custom: 'http://custom.io/ns' },
        },
      })
      const resolved = resolvePreset('custom-se')
      // 应保留 smartengine 的命名空间
      expect(resolved.serialization.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
      // 并添加自定义命名空间
      expect(resolved.serialization.xmlNamespaces?.custom).toBe('http://custom.io/ns')
      // 其他属性应继承
      expect(resolved.serialization.includeDI).toBe(false)
      expect(resolved.serialization.conditionExpressionType).toBe('mvel')
    })

    it('子预设应能覆盖 includeDI', () => {
      createExtendedPreset('with-di', 'smartengine', {
        serialization: {
          includeDI: true,
        },
      })
      const resolved = resolvePreset('with-di')
      expect(resolved.serialization.includeDI).toBe(true)
      // 命名空间应保留
      expect(resolved.serialization.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
    })

    it('无序列化配置的预设应有空对象', () => {
      registerPreset({ name: 'no-ser' })
      const resolved = resolvePreset('no-ser')
      expect(resolved.serialization).toBeDefined()
      expect(Object.keys(resolved.serialization).length).toBe(0)
    })
  })

  // ==========================================================================
  // BPMN 2.0 导出
  // ==========================================================================

  describe('BPMN 2.0 导出', () => {
    it('不使用 preset 时应生成标准 BPMN 2.0 XML', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'start1', target: 'end1' })

      const xml = await exportBpmnXml(graph)
      expect(xml).toContain('bpmn.io/schema/bpmn')
      expect(xml).toContain('BPMNDiagram')
      expect(xml).toContain('BPMNShape')
      expect(xml).toContain('startEvent')
      expect(xml).toContain('endEvent')
    })

    it('使用 bpmn2 preset 应生成标准 BPMN 2.0 XML', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'bpmn2' })
      expect(xml).toContain('bpmn.io/schema/bpmn')
      expect(xml).toContain('BPMNDiagram')
    })
  })

  // ==========================================================================
  // SmartEngine 导出
  // ==========================================================================

  describe('SmartEngine 导出', () => {
    it('使用 smartengine preset 应设置 smart 命名空间', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'start1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smartengine.org/schema/process')
    })

    it('使用 smartengine preset 应设置 targetNamespace', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('targetNamespace="Examples"')
    })

    it('使用 smartengine preset 不应包含 BPMN DI', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).not.toContain('BPMNDiagram')
      expect(xml).not.toContain('BPMNShape')
      expect(xml).not.toContain('BPMNEdge')
    })

    it('使用 smartengine preset 应导出 smart:class 属性', async () => {
      const graph = createTestGraph()
      graph.addNode({
        shape: BPMN_SERVICE_TASK,
        id: 'task1',
        x: 100, y: 100, width: 100, height: 60,
        data: { bpmn: { implementation: 'com.example.MyDelegation', implementationType: 'class' } },
      })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'task1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smart:class="com.example.MyDelegation"')
    })

    it('使用 smartengine preset 条件流应使用 MVEL 类型', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw1', x: 100, y: 100, width: 50, height: 50 })
      graph.addNode({ shape: BPMN_USER_TASK, id: 'task1', x: 300, y: 50, width: 100, height: 60 })
      graph.addNode({ shape: BPMN_USER_TASK, id: 'task2', x: 300, y: 200, width: 100, height: 60 })
      graph.addEdge({
        shape: BPMN_CONDITIONAL_FLOW,
        id: 'cond1',
        source: 'gw1',
        target: 'task1',
        labels: [{ attrs: { label: { text: "approve == 'agree'" } } }],
      })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('mvel')
    })

    it('使用 smartengine preset 应导出 smart:properties', async () => {
      const graph = createTestGraph()
      graph.addNode({
        shape: BPMN_SERVICE_TASK,
        id: 'task1',
        x: 100, y: 100, width: 100, height: 60,
        data: {
          bpmn: {
            implementation: 'com.example.MyDelegation',
            smartProperties: JSON.stringify({ value: 'right' }),
          },
        },
      })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'task1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smart:properties')
      expect(xml).toContain('smart:property')
    })

    it('使用 smartengine preset 应导出 smart:executionListener', async () => {
      const graph = createTestGraph()
      graph.addNode({
        shape: BPMN_SERVICE_TASK,
        id: 'task1',
        x: 100, y: 100, width: 100, height: 60,
        data: {
          bpmn: {
            implementation: 'com.example.MyDelegation',
            executionListener: 'com.example.StartListener',
          },
        },
      })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'task1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smart:executionListener')
      expect(xml).toContain('com.example.StartListener')
    })

    it('不存在的 preset 应回退到默认行为', async () => {
      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'nonexistent' })
      // 应不报错，使用默认导出
      expect(xml).toContain('startEvent')
      expect(xml).toContain('BPMNDiagram')
    })
  })

  // ==========================================================================
  // SmartEngine 导入
  // ==========================================================================

  describe('SmartEngine 导入', () => {
    it('使用 smartengine preset 导入应提取 smart:class', async () => {
      const smartXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="Examples">
  <process id="test" version="1.0.0">
    <startEvent id="start1"/>
    <sequenceFlow id="flow1" sourceRef="start1" targetRef="task1"/>
    <serviceTask id="task1" name="MyService" smart:class="com.example.MyDelegation"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end1"/>
    <endEvent id="end1"/>
  </process>
</definitions>`

      const graph = createTestGraph()
      await importBpmnXml(graph, smartXml, { zoomToFit: false, preset: 'smartengine' })

      const serviceNode = graph.getCellById('task1')
      expect(serviceNode).toBeDefined()
      const data = serviceNode!.getData()
      expect(data?.bpmn?.implementation).toBe('com.example.MyDelegation')
      expect(data?.bpmn?.implementationType).toBe('class')
    })

    it('使用 smartengine preset 导入应提取 smart:properties', async () => {
      const smartXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="Examples">
  <process id="test" version="1.0.0">
    <serviceTask id="task1" name="MyService" smart:class="com.example.MyDelegation">
      <extensionElements>
        <smart:properties>
          <smart:property name="value" value="right"/>
        </smart:properties>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`

      const graph = createTestGraph()
      await importBpmnXml(graph, smartXml, { zoomToFit: false, preset: 'smartengine' })

      const serviceNode = graph.getCellById('task1')
      expect(serviceNode).toBeDefined()
      const data = serviceNode!.getData()
      expect(data?.bpmn?.smartProperties).toBeDefined()
      const props = JSON.parse(data.bpmn.smartProperties)
      expect(props.value).toBe('right')
    })

    it('使用 smartengine preset 导入应提取 smart:executionListener', async () => {
      const smartXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="Examples">
  <process id="test" version="1.0.0">
    <serviceTask id="task1" name="MyService" smart:class="com.example.MyDelegation">
      <extensionElements>
        <smart:executionListener event="ACTIVITY_START,ACTIVITY_END"
                                 class="com.example.StartListener"/>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`

      const graph = createTestGraph()
      await importBpmnXml(graph, smartXml, { zoomToFit: false, preset: 'smartengine' })

      const serviceNode = graph.getCellById('task1')
      expect(serviceNode).toBeDefined()
      const data = serviceNode!.getData()
      expect(data?.bpmn?.executionListener).toBe('com.example.StartListener')
    })

    it('不使用 preset 导入 SmartEngine XML 应不提取 smart:class', async () => {
      const smartXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="Examples">
  <process id="test">
    <serviceTask id="task1" name="MyService" smart:class="com.example.MyDelegation"/>
  </process>
</definitions>`

      const graph = createTestGraph()
      await importBpmnXml(graph, smartXml, { zoomToFit: false })

      const serviceNode = graph.getCellById('task1')
      expect(serviceNode).toBeDefined()
      const data = serviceNode!.getData()
      // 不使用 preset 时不应提取 smart:class
      expect(data?.bpmn?.implementation).toBeUndefined()
    })
  })

  // ==========================================================================
  // SmartEngine 导出/导入 Round-trip
  // ==========================================================================

  describe('SmartEngine 导出/导入 Round-trip', () => {
    it('SmartEngine XML 应能 round-trip（导出→导入→导出）', async () => {
      // 创建一个包含 SmartEngine 特有配置的图
      const graph1 = createTestGraph()
      graph1.addNode({
        shape: BPMN_START_EVENT, id: 'start1',
        x: 100, y: 200, width: 36, height: 36,
        attrs: { label: { text: '开始' } },
      })
      graph1.addNode({
        shape: BPMN_SERVICE_TASK, id: 'svcTask1',
        x: 200, y: 180, width: 100, height: 60,
        attrs: { label: { text: 'ExecuteTask' } },
        data: { bpmn: { implementation: 'com.example.MyDelegation' } },
      })
      graph1.addNode({
        shape: BPMN_END_EVENT, id: 'end1',
        x: 400, y: 200, width: 36, height: 36,
        attrs: { label: { text: '结束' } },
      })
      graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'start1', target: 'svcTask1' })
      graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow2', source: 'svcTask1', target: 'end1' })

      // 导出为 SmartEngine XML
      const xml1 = await exportBpmnXml(graph1, { preset: 'smartengine' })
      expect(xml1).toContain('smart:class="com.example.MyDelegation"')
      expect(xml1).not.toContain('BPMNDiagram')

      // 导入到新图
      const graph2 = createTestGraph()
      await importBpmnXml(graph2, xml1, { zoomToFit: false, preset: 'smartengine' })

      // 验证 smart:class 被正确提取
      const svcNode = graph2.getCellById('svcTask1')
      expect(svcNode).toBeDefined()
      const data = svcNode!.getData()
      expect(data?.bpmn?.implementation).toBe('com.example.MyDelegation')

      // 再次导出并比较结构
      const xml2 = await exportBpmnXml(graph2, { preset: 'smartengine' })
      expect(xml2).toContain('smart:class="com.example.MyDelegation"')
      expect(xml2).toContain('smartengine.org/schema/process')
      expect(xml2).not.toContain('BPMNDiagram')
    })

    it('SmartEngine 完整流程 XML round-trip', async () => {
      // 模拟 SmartEngine wiki 中的典型流程
      const smartXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns:smart="http://smartengine.org/schema/process"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="Examples">
  <process id="exclusiveTest" version="1.0.0">
    <startEvent id="theStart"/>
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="submitTask"/>
    <userTask id="submitTask" name="SubmitTask"/>
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="exclusiveGw1"/>
    <exclusiveGateway id="exclusiveGw1" name="Exclusive Gateway 1"/>
    <sequenceFlow id="flow3" sourceRef="exclusiveGw1" targetRef="executeTask">
      <conditionExpression xsi:type="mvel">approve == 'agree'</conditionExpression>
    </sequenceFlow>
    <serviceTask id="executeTask" name="ExecuteTask"
                 smart:class="com.example.AuditDelegation"/>
    <sequenceFlow id="flow4" sourceRef="executeTask" targetRef="theEnd"/>
    <endEvent id="theEnd"/>
  </process>
</definitions>`

      // 导入
      const graph = createTestGraph()
      await importBpmnXml(graph, smartXml, { zoomToFit: false, preset: 'smartengine' })

      // 验证节点数量
      const nodes = graph.getNodes()
      expect(nodes.length).toBe(5) // start, userTask, gateway, serviceTask, end

      // 验证 smart:class 提取
      const serviceNode = graph.getCellById('executeTask')
      expect(serviceNode).toBeDefined()
      expect(serviceNode!.getData()?.bpmn?.implementation).toBe('com.example.AuditDelegation')

      // 验证连线数量
      const edges = graph.getEdges()
      expect(edges.length).toBe(4)
    })
  })

  // ==========================================================================
  // 自定义序列化适配器
  // ==========================================================================

  describe('自定义序列化适配器', () => {
    it('用户应能基于 smartengine 扩展自定义序列化', () => {
      createExtendedPreset('my-engine', 'smartengine', {
        serialization: {
          xmlNamespaces: { myns: 'http://my-engine.io/ns' },
          processAttributes: { 'myns:version': '2.0' },
        },
      })

      const resolved = resolvePreset('my-engine')
      // 应继承 smartengine 的命名空间
      expect(resolved.serialization.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
      // 并添加自定义命名空间
      expect(resolved.serialization.xmlNamespaces?.myns).toBe('http://my-engine.io/ns')
      // 应有自定义流程属性
      expect(resolved.serialization.processAttributes?.['myns:version']).toBe('2.0')
      // 应继承 SmartEngine 的 transformExportNode
      expect(typeof resolved.serialization.transformExportNode).toBe('function')
    })

    it('用户应能创建完全自定义的序列化适配器', () => {
      const customAdapter: SerializationAdapter = {
        xmlNamespaces: { camunda: 'http://camunda.org/schema/1.0/bpmn' },
        targetNamespace: 'http://my-process.io',
        includeDI: true,
        conditionExpressionType: 'juel',
        transformExportNode: (element, context) => {
          if (context.bpmnData?.retryCount) {
            element.$attrs = element.$attrs || {}
            element.$attrs['camunda:asyncRetries'] = String(context.bpmnData.retryCount)
          }
        },
      }

      createExtendedPreset('camunda-like', 'bpmn2', {
        serialization: customAdapter,
      })

      const resolved = resolvePreset('camunda-like')
      expect(resolved.serialization.xmlNamespaces?.camunda).toBe('http://camunda.org/schema/1.0/bpmn')
      expect(resolved.serialization.targetNamespace).toBe('http://my-process.io')
      expect(resolved.serialization.includeDI).toBe(true)
      expect(resolved.serialization.conditionExpressionType).toBe('juel')
    })

    it('自定义适配器应在导出中生效', async () => {
      const customAdapter: SerializationAdapter = {
        xmlNamespaces: { myns: 'http://my-engine.io/ns' },
        targetNamespace: 'http://my-engine.io',
        includeDI: false,
      }

      createExtendedPreset('custom-export', 'bpmn2', {
        serialization: customAdapter,
      })

      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'custom-export' })
      expect(xml).toContain('my-engine.io/ns')
      expect(xml).toContain('targetNamespace="http://my-engine.io"')
      expect(xml).not.toContain('BPMNDiagram')
    })
  })

  // ==========================================================================
  // processAttributes 支持
  // ==========================================================================

  describe('processAttributes', () => {
    it('自定义 processAttributes 应写入 process 元素', async () => {
      createExtendedPreset('with-version', 'bpmn2', {
        serialization: {
          processAttributes: { version: '2.0.0' },
        },
      })

      const graph = createTestGraph()
      graph.addNode({ shape: BPMN_START_EVENT, id: 'start1', x: 100, y: 100, width: 36, height: 36 })

      const xml = await exportBpmnXml(graph, { preset: 'with-version' })
      expect(xml).toContain('version="2.0.0"')
    })
  })

  // ==========================================================================
  // exclusiveGateway smart:class
  // ==========================================================================

  describe('SmartEngine exclusiveGateway smart:class', () => {
    it('应导出 exclusiveGateway 的 smart:class', async () => {
      const graph = createTestGraph()
      graph.addNode({
        shape: BPMN_EXCLUSIVE_GATEWAY,
        id: 'gw1',
        x: 100, y: 100, width: 50, height: 50,
        data: { bpmn: { implementation: 'com.example.GatewayDelegation' } },
      })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'gw1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smart:class="com.example.GatewayDelegation"')
    })
  })

  // ==========================================================================
  // receiveTask smart:class
  // ==========================================================================

  describe('SmartEngine receiveTask smart:class', () => {
    it('应导出 receiveTask 的 smart:class', async () => {
      const graph = createTestGraph()
      graph.addNode({
        shape: BPMN_RECEIVE_TASK,
        id: 'recv1',
        x: 100, y: 100, width: 100, height: 60,
        data: { bpmn: { implementation: 'com.example.ReceiveDelegation' } },
      })
      graph.addNode({ shape: BPMN_END_EVENT, id: 'end1', x: 300, y: 100, width: 36, height: 36 })
      graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'flow1', source: 'recv1', target: 'end1' })

      const xml = await exportBpmnXml(graph, { preset: 'smartengine' })
      expect(xml).toContain('smart:class="com.example.ReceiveDelegation"')
    })
  })
})
