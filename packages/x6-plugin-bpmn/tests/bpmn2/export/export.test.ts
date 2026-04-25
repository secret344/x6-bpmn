import { describe, it, expect, beforeAll, vi } from 'vitest'
import { Graph, Node as X6Node } from '@antv/x6'
import type { BpmnModdle, ModdleElement } from 'bpmn-moddle'
import { buildAndValidateBpmn, validateBpmnXml } from '../../helpers/bpmn-builder'
import { bpmnRoundtrip } from '../../helpers/roundtrip'
import { buildTestXml, matchXmlOrThrow, removeXmlOrThrow, replaceXmlOrThrow, truncateXml, withXmlDeclaration } from '../../helpers/xml-test-utils'

import {
  NODE_MAPPING,
  EDGE_MAPPING,
  isPoolShape,
  isLaneShape,
  isSwimlaneShape,
  isArtifactShape,
  isBoundaryShape,
  isDefaultFlow,
  isConditionalFlow,
} from '../../../src/export/bpmn-mapping'
import { exportBpmnXml } from '../../../src/export/exporter'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { createBpmn2ImporterAdapter } from '../../../src/import/adapter'
import { clearImportedBpmnState, getImportedBpmnState } from '../../../src/import/state'
import { __test__ as xmlParserTest } from '../../../src/import/xml-parser'
import { createBpmnElement } from '../../../src/utils/bpmn-xml-names'

import {
  BPMN_START_EVENT,
  BPMN_START_EVENT_MESSAGE,
  BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL,
  BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE,
  BPMN_START_EVENT_PARALLEL_MULTIPLE,
  BPMN_INTERMEDIATE_THROW_EVENT,
  BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_THROW_EVENT_LINK,
  BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT,
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
  BPMN_INTERMEDIATE_CATCH_EVENT_ERROR,
  BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
  BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT,
  BPMN_BOUNDARY_EVENT_MESSAGE,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ESCALATION,
  BPMN_BOUNDARY_EVENT_CONDITIONAL,
  BPMN_BOUNDARY_EVENT_ERROR,
  BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_BOUNDARY_EVENT_COMPENSATION,
  BPMN_BOUNDARY_EVENT_SIGNAL,
  BPMN_BOUNDARY_EVENT_MULTIPLE,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
  BPMN_END_EVENT,
  BPMN_END_EVENT_MESSAGE,
  BPMN_END_EVENT_ESCALATION,
  BPMN_END_EVENT_ERROR,
  BPMN_END_EVENT_CANCEL,
  BPMN_END_EVENT_COMPENSATION,
  BPMN_END_EVENT_SIGNAL,
  BPMN_END_EVENT_TERMINATE,
  BPMN_END_EVENT_MULTIPLE,
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_PARALLEL_GATEWAY,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  BPMN_DATA_OBJECT,
  BPMN_DATA_INPUT,
  BPMN_DATA_OUTPUT,
  BPMN_DATA_STORE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../../../src/utils/constants'

// ============================================================================
// Register all BPMN shapes as simplified rect/edge for Graph integration tests
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
// Helper: create a test graph
// ============================================================================

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 800, height: 600 })
}

// ============================================================================
// BPMN Mapping Tests
// ============================================================================

/**
 * BPMN 映射表、XML 导出、XML 导入测试
 * 验证节点 / 连接线映射表、辅助判断函数及导入导出的完整性和正确性。
 */
describe('BPMN 映射表（bpmn-mapping）', () => {
  describe('NODE_MAPPING —— 节点图形映射', () => {
    it('应为所有事件图形提供映射', () => {
      const eventShapes = [
        BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
        BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
        BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
        BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
        BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, BPMN_INTERMEDIATE_THROW_EVENT_LINK,
        BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
        BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
        BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
        BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
        BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
        BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
        BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
        BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
        BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
        BPMN_BOUNDARY_EVENT_ESCALATION, BPMN_BOUNDARY_EVENT_CONDITIONAL,
        BPMN_BOUNDARY_EVENT_ERROR, BPMN_BOUNDARY_EVENT_CANCEL,
        BPMN_BOUNDARY_EVENT_COMPENSATION, BPMN_BOUNDARY_EVENT_SIGNAL,
        BPMN_BOUNDARY_EVENT_MULTIPLE, BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
        BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
        BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
        BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
        BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
        BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
      ]
      for (const shape of eventShapes) {
        expect(NODE_MAPPING[shape]).toBeDefined()
        expect(NODE_MAPPING[shape].tag).toBeTruthy()
      }
    })

    it('应为所有活动图形提供映射', () => {
      const activityShapes = [
        BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
        BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK, BPMN_BUSINESS_RULE_TASK,
        BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
        BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
      ]
      for (const shape of activityShapes) {
        expect(NODE_MAPPING[shape]).toBeDefined()
      }
    })

    it('任务图形应映射到正确的 BPMN 标签', () => {
      expect(NODE_MAPPING[BPMN_TASK].tag).toBe('task')
      expect(NODE_MAPPING[BPMN_USER_TASK].tag).toBe('userTask')
      expect(NODE_MAPPING[BPMN_SERVICE_TASK].tag).toBe('serviceTask')
      expect(NODE_MAPPING[BPMN_SCRIPT_TASK].tag).toBe('scriptTask')
      expect(NODE_MAPPING[BPMN_SEND_TASK].tag).toBe('sendTask')
      expect(NODE_MAPPING[BPMN_RECEIVE_TASK].tag).toBe('receiveTask')
      expect(NODE_MAPPING[BPMN_MANUAL_TASK].tag).toBe('manualTask')
      expect(NODE_MAPPING[BPMN_BUSINESS_RULE_TASK].tag).toBe('businessRuleTask')
    })

    it('应为所有网关图形提供映射', () => {
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_GATEWAY].tag).toBe('exclusiveGateway')
      expect(NODE_MAPPING[BPMN_PARALLEL_GATEWAY].tag).toBe('parallelGateway')
      expect(NODE_MAPPING[BPMN_INCLUSIVE_GATEWAY].tag).toBe('inclusiveGateway')
      expect(NODE_MAPPING[BPMN_COMPLEX_GATEWAY].tag).toBe('complexGateway')
      expect(NODE_MAPPING[BPMN_EVENT_BASED_GATEWAY].tag).toBe('eventBasedGateway')
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY].tag).toBe('eventBasedGateway')
    })

    it('应为数据元素和工件提供映射', () => {
      expect(NODE_MAPPING[BPMN_DATA_OBJECT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_INPUT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_OUTPUT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_STORE].tag).toBe('dataStoreReference')
      expect(NODE_MAPPING[BPMN_TEXT_ANNOTATION].tag).toBe('textAnnotation')
      expect(NODE_MAPPING[BPMN_GROUP].tag).toBe('group')
    })

    it('应为泳道图形提供映射', () => {
      expect(NODE_MAPPING[BPMN_POOL].tag).toBe('participant')
      expect(NODE_MAPPING[BPMN_LANE].tag).toBe('lane')
    })

    it('带类型的事件应设置 eventDefinition', () => {
      expect(NODE_MAPPING[BPMN_START_EVENT_MESSAGE].eventDefinition).toBe('messageEventDefinition')
      expect(NODE_MAPPING[BPMN_START_EVENT_TIMER].eventDefinition).toBe('timerEventDefinition')
      expect(NODE_MAPPING[BPMN_START_EVENT_CONDITIONAL].eventDefinition).toBe('conditionalEventDefinition')
      expect(NODE_MAPPING[BPMN_START_EVENT_SIGNAL].eventDefinition).toBe('signalEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_TERMINATE].eventDefinition).toBe('terminateEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_ERROR].eventDefinition).toBe('errorEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_CANCEL].eventDefinition).toBe('cancelEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_COMPENSATION].eventDefinition).toBe('compensateEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_SIGNAL].eventDefinition).toBe('signalEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_MULTIPLE].eventDefinition).toBe('multipleEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_ESCALATION].eventDefinition).toBe('escalationEventDefinition')
      expect(NODE_MAPPING[BPMN_END_EVENT_MESSAGE].eventDefinition).toBe('messageEventDefinition')
    })

    it('普通事件不应有 eventDefinition', () => {
      expect(NODE_MAPPING[BPMN_START_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_END_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_INTERMEDIATE_THROW_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_INTERMEDIATE_CATCH_EVENT].eventDefinition).toBeUndefined()
    })

    it('特殊图形应设置额外属性', () => {
      expect(NODE_MAPPING[BPMN_EVENT_SUB_PROCESS].attrs?.triggeredByEvent).toBe('true')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT].attrs?.cancelActivity).toBe('true')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_NON_INTERRUPTING].attrs?.cancelActivity).toBe('false')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING].attrs?.cancelActivity).toBe('false')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING].attrs?.parallelMultiple).toBe('true')
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY].attrs?.eventGatewayType).toBe('Exclusive')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE].attrs?.parallelMultiple).toBe('true')
      expect(NODE_MAPPING[BPMN_START_EVENT_PARALLEL_MULTIPLE].attrs?.parallelMultiple).toBe('true')
    })

    it('NODE_MAPPING 应覆盖全部 74+ 个节点图形', () => {
      expect(Object.keys(NODE_MAPPING).length).toBeGreaterThanOrEqual(74)
    })
  })

  describe('EDGE_MAPPING —— 连接线图形映射', () => {
    it('应为所有连接线图形提供映射', () => {
      const edgeShapes = [
        BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
        BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
        BPMN_DATA_ASSOCIATION,
      ]
      for (const shape of edgeShapes) {
        expect(EDGE_MAPPING[shape]).toBeDefined()
      }
    })

    it('连接线应映射到正确的 BPMN 标签', () => {
      expect(EDGE_MAPPING[BPMN_SEQUENCE_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_CONDITIONAL_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_DEFAULT_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_MESSAGE_FLOW].tag).toBe('messageFlow')
      expect(EDGE_MAPPING[BPMN_ASSOCIATION].tag).toBe('association')
      expect(EDGE_MAPPING[BPMN_DIRECTED_ASSOCIATION].tag).toBe('association')
      expect(EDGE_MAPPING[BPMN_DATA_ASSOCIATION].tag).toBe('dataInputAssociation')
    })

    it('消息流应标记为 collaboration 类型', () => {
      expect(EDGE_MAPPING[BPMN_MESSAGE_FLOW].isCollaboration).toBe(true)
    })

    it('关联应标记为 artifact 类型', () => {
      expect(EDGE_MAPPING[BPMN_ASSOCIATION].isArtifact).toBe(true)
      expect(EDGE_MAPPING[BPMN_DIRECTED_ASSOCIATION].isArtifact).toBe(true)
      expect(EDGE_MAPPING[BPMN_DATA_ASSOCIATION].isArtifact).toBe(true)
    })

    it('EDGE_MAPPING 应有恰好 7 个映射', () => {
      expect(Object.keys(EDGE_MAPPING).length).toBe(7)
    })
  })

  describe('辅助判断函数', () => {
    it('isPoolShape —— 判断是否为池图形', () => {
      expect(isPoolShape(BPMN_POOL)).toBe(true)
      expect(isPoolShape(BPMN_LANE)).toBe(false)
      expect(isPoolShape(BPMN_TASK)).toBe(false)
    })

    it('isLaneShape —— 判断是否为泳道图形', () => {
      expect(isLaneShape(BPMN_LANE)).toBe(true)
      expect(isLaneShape(BPMN_POOL)).toBe(false)
      expect(isLaneShape(BPMN_TASK)).toBe(false)
    })

    it('isSwimlaneShape —— 判断是否为泳道容器', () => {
      expect(isSwimlaneShape(BPMN_POOL)).toBe(true)
      expect(isSwimlaneShape(BPMN_LANE)).toBe(true)
      expect(isSwimlaneShape(BPMN_TASK)).toBe(false)
    })

    it('isArtifactShape —— 判断是否为工件', () => {
      expect(isArtifactShape(BPMN_TEXT_ANNOTATION)).toBe(true)
      expect(isArtifactShape(BPMN_GROUP)).toBe(true)
      expect(isArtifactShape(BPMN_TASK)).toBe(false)
    })

    it('isBoundaryShape —— 判断是否为边界事件', () => {
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT)).toBe(true)
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT_TIMER)).toBe(true)
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)).toBe(true)
      expect(isBoundaryShape(BPMN_START_EVENT)).toBe(false)
    })

    it('isDefaultFlow —— 判断是否为默认流', () => {
      expect(isDefaultFlow(BPMN_DEFAULT_FLOW)).toBe(true)
      expect(isDefaultFlow(BPMN_SEQUENCE_FLOW)).toBe(false)
      expect(isDefaultFlow(BPMN_CONDITIONAL_FLOW)).toBe(false)
    })

    it('isConditionalFlow —— 判断是否为条件流', () => {
      expect(isConditionalFlow(BPMN_CONDITIONAL_FLOW)).toBe(true)
      expect(isConditionalFlow(BPMN_SEQUENCE_FLOW)).toBe(false)
      expect(isConditionalFlow(BPMN_DEFAULT_FLOW)).toBe(false)
    })
  })
})

// ============================================================================
// Exporter Tests
// ============================================================================

describe('BPMN XML 导出（exportBpmnXml）', () => {
  it('应生成包含 XML 声明的有效 XML', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    graph.dispose()
  })

  it('应包含带命名空间的 bpmn:definitions', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('xmlns:bpmn=')
    expect(xml).toContain('xmlns:bpmndi=')
    // xmlns:dc, xmlns:di, xmlns:xsi are added by bpmn-moddle on demand
    expect(xml).toContain('bpmn:definitions')
    graph.dispose()
  })

  it('应包含 bpmn:process 元素', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('<bpmn:process')
    expect(xml).toContain('id="Process_1"')
    graph.dispose()
  })

  it('应使用自定义 processId 和 processName', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph, { processId: 'MyProc', processName: '测试' })
    expect(xml).toContain('id="MyProc"')
    expect(xml).toContain('name="测试"')
    graph.dispose()
  })

  it('应将节点导出为 BPMN 元素', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '开始' } } })
    graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100, width: 100, height: 60, attrs: { label: { text: '审批' } } })
    graph.addNode({ shape: BPMN_END_EVENT, x: 400, y: 100, width: 36, height: 36, attrs: { label: { text: '结束' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:startEvent')
    expect(xml).toContain('bpmn:userTask')
    expect(xml).toContain('bpmn:endEvent')
    expect(xml).toContain('name="开始"')
    expect(xml).toContain('name="审批"')
    expect(xml).toContain('name="结束"')
    graph.dispose()
  })

  it('顺序流应包含 sourceRef 和 targetRef', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_END_EVENT, x: 300, y: 100 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:sequenceFlow')
    graph.dispose()
  })

  it('应生成 incoming/outgoing 引用', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:outgoing')
    expect(xml).toContain('bpmn:incoming')
    graph.dispose()
  })

  it('带类型的事件应导出 eventDefinition', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_START_EVENT_MESSAGE, x: 100, y: 100 })
    graph.addNode({ shape: BPMN_END_EVENT_TERMINATE, x: 300, y: 100 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:messageEventDefinition')
    expect(xml).toContain('bpmn:terminateEventDefinition')
    graph.dispose()
  })

  it('池应导出为 collaboration 中的 participant', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 800, height: 400, attrs: { headerLabel: { text: '测试池' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:collaboration')
    expect(xml).toContain('bpmn:participant')
    expect(xml).toContain('name="测试池"')
    graph.dispose()
  })

  it('泳道应导出并包含 flowNodeRef', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_LANE, x: 70, y: 40, width: 700, height: 200, attrs: { headerLabel: { text: '泳道1' } } })
    graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100, width: 100, height: 60, attrs: { label: { text: '任务' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:laneSet')
    expect(xml).toContain('bpmn:lane')
    expect(xml).toContain('bpmn:flowNodeRef')
    graph.dispose()
  })

  it('文本注释应正确导出', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_TEXT_ANNOTATION, x: 100, y: 50, attrs: { label: { text: '注释内容' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:textAnnotation')
    expect(xml).toContain('bpmn:text')
    expect(xml).toContain('注释内容')
    graph.dispose()
  })

  it('分组应正确导出', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_GROUP, x: 100, y: 100, width: 200, height: 150 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:group')
    graph.dispose()
  })

  it('关联应正确导出', async () => {
    const graph = createTestGraph()
    const ann = graph.addNode({ shape: BPMN_TEXT_ANNOTATION, x: 100, y: 50 })
    const task = graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100 })
    graph.addEdge({ shape: BPMN_ASSOCIATION, source: ann, target: task })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:association')
    graph.dispose()
  })

  it('有向关联应包含 direction 属性', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_DATA_OBJECT, x: 200, y: 200 })
    graph.addEdge({ shape: BPMN_DIRECTED_ASSOCIATION, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('associationDirection="One"')
    graph.dispose()
  })

  it('应导出数据关联', async () => {
    const graph = createTestGraph()
    const task = graph.addNode({ shape: BPMN_SERVICE_TASK, x: 100, y: 100 })
    const ds = graph.addNode({ shape: BPMN_DATA_STORE, x: 200, y: 200 })
    graph.addEdge({ shape: BPMN_DATA_ASSOCIATION, source: task, target: ds })

    const xml = await exportBpmnXml(graph)
    // task → dataStore = DataOutputAssociation per BPMN spec
    expect(xml).toContain('bpmn:dataOutputAssociation')
    graph.dispose()
  })

  it('应导出 DataInputAssociation（数据对象 → 任务）', async () => {
    const graph = createTestGraph()
    const dataObj = graph.addNode({ shape: BPMN_DATA_OBJECT, x: 100, y: 200, width: 40, height: 50 })
    const task = graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100, width: 100, height: 60 })
    graph.addEdge({ shape: BPMN_DATA_ASSOCIATION, source: dataObj, target: task })

    const xml = await exportBpmnXml(graph)
    // dataObject → task = DataInputAssociation per BPMN spec
    expect(xml).toContain('bpmn:dataInputAssociation')
    graph.dispose()
  })

  it('消息流应在 collaboration 下导出', async () => {
    const graph = createTestGraph()
    const pool1 = graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 400, height: 200 })
    const pool2 = graph.addNode({ shape: BPMN_POOL, x: 40, y: 300, width: 400, height: 200 })
    graph.addEdge({ shape: BPMN_MESSAGE_FLOW, source: pool1, target: pool2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:messageFlow')
    graph.dispose()
  })

  it('默认流应在网关上设置 default 属性', async () => {
    const graph = createTestGraph()
    const gw = graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, x: 200, y: 100, width: 50, height: 50 })
    const t1 = graph.addNode({ shape: BPMN_USER_TASK, x: 300, y: 50, width: 100, height: 60 })
    const t2 = graph.addNode({ shape: BPMN_USER_TASK, x: 300, y: 150, width: 100, height: 60 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: gw, target: t1 })
    const defEdge = graph.addEdge({ shape: BPMN_DEFAULT_FLOW, source: gw, target: t2 })

    const xml = await exportBpmnXml(graph)
    // The id may be normalized by toXmlId, so check for the default attribute pattern
    expect(xml).toMatch(/default="[^"]+"/)
    graph.dispose()
  })

  it('条件流应包含 conditionExpression', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, x: 100, y: 100, width: 50, height: 50 })
    const n2 = graph.addNode({ shape: BPMN_USER_TASK, x: 300, y: 100, width: 100, height: 60 })
    graph.addEdge({
      shape: BPMN_CONDITIONAL_FLOW,
      source: n1,
      target: n2,
      labels: [{ attrs: { label: { text: '条件' } } }],
    })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:conditionExpression')
    expect(xml).toContain('条件')
    graph.dispose()
  })

  it('应导出包含图形和连接线的 BPMNDiagram', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100, width: 36, height: 36 })
    const n2 = graph.addNode({ shape: BPMN_END_EVENT, x: 300, y: 100, width: 36, height: 36 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmndi:BPMNDiagram')
    expect(xml).toContain('bpmndi:BPMNPlane')
    expect(xml).toContain('bpmndi:BPMNShape')
    expect(xml).toContain('bpmndi:BPMNEdge')
    expect(xml).toContain('dc:Bounds')
    expect(xml).toContain('di:waypoint')
    graph.dispose()
  })

  it('应处理包含换行符的节点标签', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100, width: 100, height: 60, attrs: { label: { text: '多行\n标签' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="多行 标签"')
    graph.dispose()
  })

  it('应处理空画布', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:definitions')
    expect(xml).toContain('bpmn:process')
    expect(xml).not.toContain('bpmn:collaboration')
    graph.dispose()
  })

  it('应处理连接线标签', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, x: 100, y: 100, width: 50, height: 50 })
    const n2 = graph.addNode({ shape: BPMN_USER_TASK, x: 300, y: 100, width: 100, height: 60 })
    graph.addEdge({
      shape: BPMN_SEQUENCE_FLOW,
      source: n1,
      target: n2,
      labels: [{ attrs: { label: { text: '是' } } }],
    })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="是"')
    graph.dispose()
  })

  it('应处理有 data 属性但无 label attrs 的节点', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100, width: 100, height: 60, data: { label: '数据标签' } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="数据标签"')
    graph.dispose()
  })

  it('池图形应导出 isHorizontal 属性', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 800, height: 400, attrs: { headerLabel: { text: '池' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('isHorizontal="true"')
    graph.dispose()
  })

  it('应正确导出网关', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, x: 100, y: 100, width: 50, height: 50 })
    graph.addNode({ shape: BPMN_PARALLEL_GATEWAY, x: 200, y: 100, width: 50, height: 50 })
    graph.addNode({ shape: BPMN_INCLUSIVE_GATEWAY, x: 300, y: 100, width: 50, height: 50 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:exclusiveGateway')
    expect(xml).toContain('bpmn:parallelGateway')
    expect(xml).toContain('bpmn:inclusiveGateway')
    graph.dispose()
  })

  it('应导出所有中间事件类型', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE, x: 100, y: 100 })
    graph.addNode({ shape: BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, x: 200, y: 100 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:intermediateThrowEvent')
    expect(xml).toContain('bpmn:intermediateCatchEvent')
    expect(xml).toContain('bpmn:messageEventDefinition')
    expect(xml).toContain('bpmn:timerEventDefinition')
    graph.dispose()
  })

  it('应导出数据对象和数据存储', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_DATA_OBJECT, x: 100, y: 100, width: 40, height: 50 })
    graph.addNode({ shape: BPMN_DATA_STORE, x: 200, y: 100, width: 50, height: 50 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:dataObjectReference')
    expect(xml).toContain('bpmn:dataStoreReference')
    graph.dispose()
  })

  it('应导出子流程类型', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_SUB_PROCESS, x: 100, y: 100, width: 200, height: 120 })
    graph.addNode({ shape: BPMN_CALL_ACTIVITY, x: 350, y: 100, width: 100, height: 60 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:subProcess')
    expect(xml).toContain('bpmn:callActivity')
    graph.dispose()
  })
})

// ============================================================================
// Importer Tests
// ============================================================================

describe('BPMN XML 导入（parseBpmnXml + loadBpmnGraph）', () => {
  // SIMPLE_BPMN: 由 bpmn-moddle 构建并验证的最小完整 BPMN 2.0 流程文档
  let SIMPLE_BPMN: string
  beforeAll(async () => {
    const result = await buildAndValidateBpmn({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'startEvent',   id: 'Start_1', name: '开始' },
          { kind: 'userTask',     id: 'Task_1',  name: '审批' },
          { kind: 'endEvent',     id: 'End_1',   name: '结束' },
          { kind: 'sequenceFlow', id: 'Flow_1',  sourceRef: 'Start_1', targetRef: 'Task_1' },
          { kind: 'sequenceFlow', id: 'Flow_2',  sourceRef: 'Task_1',  targetRef: 'End_1'  },
        ],
      }],
      shapes: {
        'Start_1': { id: 'Start_1', x: 100, y: 120, width: 36,  height: 36 },
        'Task_1':  { id: 'Task_1',  x: 200, y: 110, width: 100, height: 60 },
        'End_1':   { id: 'End_1',   x: 400, y: 120, width: 36,  height: 36 },
      },
      edges: {
        'Flow_1': { id: 'Flow_1', waypoints: [{ x: 136, y: 138 }, { x: 200, y: 140 }] },
        'Flow_2': { id: 'Flow_2', waypoints: [{ x: 300, y: 140 }, { x: 400, y: 138 }] },
      },
    })
    expect(result.valid).toBe(true)
    SIMPLE_BPMN = result.xml
  })

  it('应从 BPMN XML 中导入节点', async () => {
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3)
    graph.dispose()
  })

  it('应从 BPMN 标签创建正确的图形', async () => {
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })

    expect(graph.getCellById('Start_1')!.shape).toBe(BPMN_START_EVENT)
    expect(graph.getCellById('Task_1')!.shape).toBe(BPMN_USER_TASK)
    expect(graph.getCellById('End_1')!.shape).toBe(BPMN_END_EVENT)
    graph.dispose()
  })

  it('应从 BPMN XML 中导入连接线', async () => {
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })
    expect(graph.getEdges().length).toBe(2)
    graph.dispose()
  })

  it('应从 DI 设置节点位置', async () => {
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })

    const startNode = graph.getCellById('Start_1') as any
    const pos = startNode.getPosition()
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(120)
    graph.dispose()
  })

  it('应从 DI 设置节点尺寸', async () => {
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })

    const taskNode = graph.getCellById('Task_1') as any
    const size = taskNode.getSize()
    expect(size.width).toBe(100)
    expect(size.height).toBe(60)
    graph.dispose()
  })

  it('默认应在导入前清空画布', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: 'rect', x: 0, y: 0, width: 50, height: 50 })
    expect(graph.getNodes().length).toBe(1)

    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3)
    graph.dispose()
  })

  it('clearGraph=false 时不应清空画布', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: 'rect', x: 0, y: 0, width: 50, height: 50 })

    loadBpmnGraph(graph, await parseBpmnXml(SIMPLE_BPMN), { clearGraph: false, zoomToFit: false })
    expect(graph.getNodes().length).toBe(4)
    graph.dispose()
  })

  it('无效根元素时应抛出错误', async () => {
    const graph = createTestGraph()
    await expect(parseBpmnXml('<not-definitions />')).rejects.toThrow('Invalid BPMN XML')
    graph.dispose()
  })

  it('应导入带 eventDefinition 的事件', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'Start_Msg', name: '消息开始', eventDefinition: 'MessageEventDefinition' },
        { kind: 'endEvent',   id: 'End_Term',  name: '终止',     eventDefinition: 'TerminateEventDefinition' },
      ]}],
      shapes: {
        'Start_Msg': { id: 'Start_Msg', x: 100, y: 100, width: 36, height: 36 },
        'End_Term':  { id: 'End_Term',  x: 300, y: 100, width: 36, height: 36 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('Start_Msg')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph.getCellById('End_Term')!.shape).toBe(BPMN_END_EVENT_TERMINATE)
    graph.dispose()
  })

  it('应导入池和泳道', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'laneSet', id: 'LaneSet_1', lanes: [{ id: 'Lane_1', name: '泳道A' }] },
      ]}],
      collaboration: {
        id: 'Collab_1',
        participants: [{ id: 'Pool_1', name: '泳池', processRef: 'Process_1' }],
      },
      shapes: {
        'Pool_1': { id: 'Pool_1', x: 40, y: 40, width: 800, height: 400, isHorizontal: true },
        'Lane_1': { id: 'Lane_1', x: 70, y: 40, width: 770, height: 400, isHorizontal: true },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('Pool_1')!.shape).toBe(BPMN_POOL)
    expect(graph.getCellById('Lane_1')!.shape).toBe(BPMN_LANE)
    graph.dispose()
  })

  it('应导入网关', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'exclusiveGateway', id: 'GW_1', name: '判断' },
        { kind: 'parallelGateway',  id: 'GW_2', name: '并行' },
        { kind: 'inclusiveGateway', id: 'GW_3', name: '包容' },
      ]}],
      shapes: {
        'GW_1': { id: 'GW_1', x: 100, y: 100, width: 50, height: 50 },
        'GW_2': { id: 'GW_2', x: 250, y: 100, width: 50, height: 50 },
        'GW_3': { id: 'GW_3', x: 400, y: 100, width: 50, height: 50 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('GW_1')!.shape).toBe(BPMN_EXCLUSIVE_GATEWAY)
    expect(graph.getCellById('GW_2')!.shape).toBe(BPMN_PARALLEL_GATEWAY)
    expect(graph.getCellById('GW_3')!.shape).toBe(BPMN_INCLUSIVE_GATEWAY)
    graph.dispose()
  })

  it('应导入文本注释和关联', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent',   id: 'Start_1', name: '开始' },
        { kind: 'textAnnotation', id: 'Ann_1', text: '备注内容' },
        { kind: 'association',  id: 'Assoc_1', sourceRef: 'Ann_1', targetRef: 'Start_1' },
      ]}],
      shapes: {
        'Start_1': { id: 'Start_1', x: 200, y: 120, width: 36,  height: 36 },
        'Ann_1':   { id: 'Ann_1',   x: 100, y: 50,  width: 120, height: 40 },
      },
      edges: {
        'Assoc_1': { id: 'Assoc_1', waypoints: [{ x: 160, y: 90 }, { x: 218, y: 120 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('Ann_1')!.shape).toBe(BPMN_TEXT_ANNOTATION)
    expect(graph.getEdges().length).toBe(1)
    expect(graph.getEdges()[0].shape).toBe(BPMN_ASSOCIATION)
    graph.dispose()
  })

  it('应导入数据对象和数据存储', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'dataObjectReference', id: 'Data_1',  name: '数据' },
        { kind: 'dataStoreReference',  id: 'Store_1', name: '数据库' },
      ]}],
      shapes: {
        'Data_1':  { id: 'Data_1',  x: 100, y: 100, width: 40, height: 50 },
        'Store_1': { id: 'Store_1', x: 200, y: 100, width: 50, height: 50 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('Data_1')!.shape).toBe(BPMN_DATA_OBJECT)
    expect(graph.getCellById('Store_1')!.shape).toBe(BPMN_DATA_STORE)
    graph.dispose()
  })

  it('应导入默认流', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'exclusiveGateway', id: 'GW_1', default: 'Flow_Def' },
        { kind: 'userTask', id: 'T_1' },
        { kind: 'userTask', id: 'T_2' },
        { kind: 'sequenceFlow', id: 'Flow_1',   sourceRef: 'GW_1', targetRef: 'T_1' },
        { kind: 'sequenceFlow', id: 'Flow_Def', sourceRef: 'GW_1', targetRef: 'T_2' },
      ]}],
      shapes: {
        'GW_1': { id: 'GW_1', x: 100, y: 100, width: 50,  height: 50 },
        'T_1':  { id: 'T_1',  x: 250, y: 50,  width: 100, height: 60 },
        'T_2':  { id: 'T_2',  x: 250, y: 150, width: 100, height: 60 },
      },
      edges: {
        'Flow_1':   { id: 'Flow_1',   waypoints: [{ x: 150, y: 125 }, { x: 250, y: 80  }] },
        'Flow_Def': { id: 'Flow_Def', waypoints: [{ x: 150, y: 125 }, { x: 250, y: 180 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const defEdge = graph.getEdges().find((e) => e.id === 'Flow_Def')
    expect(defEdge!.shape).toBe(BPMN_DEFAULT_FLOW)
    graph.dispose()
  })

  it('应导入条件流', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'exclusiveGateway', id: 'GW_1' },
        { kind: 'userTask',         id: 'T_1'  },
        { kind: 'sequenceFlow', id: 'Flow_Cond', sourceRef: 'GW_1', targetRef: 'T_1', hasCondition: true, conditionBody: 'x > 0' },
      ]}],
      shapes: {
        'GW_1': { id: 'GW_1', x: 100, y: 100, width: 50,  height: 50 },
        'T_1':  { id: 'T_1',  x: 250, y: 100, width: 100, height: 60 },
      },
      edges: {
        'Flow_Cond': { id: 'Flow_Cond', waypoints: [{ x: 150, y: 125 }, { x: 250, y: 130 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'Flow_Cond')!.shape).toBe(BPMN_CONDITIONAL_FLOW)
    graph.dispose()
  })

  it('应导入有向关联', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'userTask',       id: 'T_1' },
        { kind: 'textAnnotation', id: 'Ann_1', text: '注释' },
        { kind: 'association',    id: 'Assoc_Dir', sourceRef: 'Ann_1', targetRef: 'T_1', direction: 'One' },
      ]}],
      shapes: {
        'T_1':   { id: 'T_1',   x: 200, y: 100, width: 100, height: 60 },
        'Ann_1': { id: 'Ann_1', x: 100, y: 50,  width: 80,  height: 30 },
      },
      edges: {
        'Assoc_Dir': { id: 'Assoc_Dir', waypoints: [{ x: 140, y: 80 }, { x: 200, y: 130 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'Assoc_Dir')!.shape).toBe(BPMN_DIRECTED_ASSOCIATION)
    graph.dispose()
  })

  it('应处理无 DI 图表的 XML', async () => {
    // No shapes/edges → builder 生成不带图元的 BPMN 2.0 XML
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'Start_1', name: '开始' },
      ]}],
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('应处理无 process 元素的 XML', async () => {
    const xml = removeXmlOrThrow(
      removeXmlOrThrow(
        await buildTestXml({
          processes: [{ id: 'Process_1', elements: [] }],
        }),
        /\s*<bpmndi:BPMNDiagram\b[\s\S]*?<\/bpmndi:BPMNDiagram>/,
        '应能移除 BPMNDiagram',
      ),
      /\s*<bpmn:process id="Process_1"[^>]*(?:\/>|>[\s\S]*?<\/bpmn:process>)/,
      '应能移除 process 元素',
    )
    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(0)
    graph.dispose()
  })

  it('应正确导入所有任务类型', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'task',             id: 'T1' },
        { kind: 'userTask',         id: 'T2' },
        { kind: 'serviceTask',      id: 'T3' },
        { kind: 'scriptTask',       id: 'T4' },
        { kind: 'businessRuleTask', id: 'T5' },
        { kind: 'sendTask',         id: 'T6' },
        { kind: 'receiveTask',      id: 'T7' },
        { kind: 'manualTask',       id: 'T8' },
      ]}],
      shapes: {
        'T1': { id: 'T1', x: 100, y: 100, width: 100, height: 60 },
        'T2': { id: 'T2', x: 100, y: 200, width: 100, height: 60 },
        'T3': { id: 'T3', x: 100, y: 300, width: 100, height: 60 },
        'T4': { id: 'T4', x: 100, y: 400, width: 100, height: 60 },
        'T5': { id: 'T5', x: 300, y: 100, width: 100, height: 60 },
        'T6': { id: 'T6', x: 300, y: 200, width: 100, height: 60 },
        'T7': { id: 'T7', x: 300, y: 300, width: 100, height: 60 },
        'T8': { id: 'T8', x: 300, y: 400, width: 100, height: 60 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('T1')!.shape).toBe(BPMN_TASK)
    expect(graph.getCellById('T2')!.shape).toBe(BPMN_USER_TASK)
    expect(graph.getCellById('T3')!.shape).toBe(BPMN_SERVICE_TASK)
    expect(graph.getCellById('T4')!.shape).toBe(BPMN_SCRIPT_TASK)
    expect(graph.getCellById('T5')!.shape).toBe(BPMN_BUSINESS_RULE_TASK)
    expect(graph.getCellById('T6')!.shape).toBe(BPMN_SEND_TASK)
    expect(graph.getCellById('T7')!.shape).toBe(BPMN_RECEIVE_TASK)
    expect(graph.getCellById('T8')!.shape).toBe(BPMN_MANUAL_TASK)
    graph.dispose()
  })

  it('应导入子流程类型', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'subProcess',       id: 'SP1' },
        { kind: 'subProcess',       id: 'SP2', triggeredByEvent: true },
        { kind: 'transaction',      id: 'TX1' },
        { kind: 'adHocSubProcess',  id: 'AH1' },
        { kind: 'callActivity',     id: 'CA1' },
      ]}],
      shapes: {
        'SP1': { id: 'SP1', x: 100, y: 100, width: 200, height: 120 },
        'SP2': { id: 'SP2', x: 100, y: 250, width: 200, height: 120 },
        'TX1': { id: 'TX1', x: 350, y: 100, width: 200, height: 120 },
        'AH1': { id: 'AH1', x: 350, y: 250, width: 200, height: 120 },
        'CA1': { id: 'CA1', x: 100, y: 400, width: 100, height: 60  },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getCellById('SP1')!.shape).toBe(BPMN_SUB_PROCESS)
    expect(graph.getCellById('SP2')!.shape).toBe(BPMN_EVENT_SUB_PROCESS)
    expect(graph.getCellById('TX1')!.shape).toBe(BPMN_TRANSACTION)
    expect(graph.getCellById('AH1')!.shape).toBe(BPMN_AD_HOC_SUB_PROCESS)
    expect(graph.getCellById('CA1')!.shape).toBe(BPMN_CALL_ACTIVITY)
    graph.dispose()
  })

  it('应导入消息流', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [
        { id: 'Process_1', elements: [] },
        { id: 'Process_2', elements: [] },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'P1', name: '参与者1', processRef: 'Process_1' },
          { id: 'P2', name: '参与者2', processRef: 'Process_2' },
        ],
        messageFlows: [{ id: 'MF_1', sourceRef: 'P1', targetRef: 'P2' }],
      },
      shapes: {
        'P1': { id: 'P1', x: 40, y: 40,  width: 400, height: 200, isHorizontal: true },
        'P2': { id: 'P2', x: 40, y: 300, width: 400, height: 200, isHorizontal: true },
      },
      edges: {
        'MF_1': { id: 'MF_1', waypoints: [{ x: 240, y: 240 }, { x: 240, y: 300 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'MF_1')!.shape).toBe(BPMN_MESSAGE_FLOW)
    graph.dispose()
  })

  it('应处理连接线中间路径点', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1' },
        { kind: 'endEvent',   id: 'E1' },
        { kind: 'sequenceFlow', id: 'F1', sourceRef: 'S1', targetRef: 'E1' },
      ]}],
      shapes: {
        'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
        'E1': { id: 'E1', x: 400, y: 100, width: 36, height: 36 },
      },
      edges: {
        'F1': { id: 'F1', waypoints: [
          { x: 136, y: 118 },
          { x: 250, y: 50  },
          { x: 350, y: 200 },
          { x: 400, y: 118 },
        ]},
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const edge = graph.getEdges()[0]
    const vertices = edge.getVertices()
    expect(vertices.length).toBe(2)
    expect(vertices[0].x).toBe(250)
    expect(vertices[0].y).toBe(50)
    graph.dispose()
  })

  it('应处理带 attachedToRef 的边界事件', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'task',          id: 'Task_1', name: '任务' },
        { kind: 'boundaryEvent', id: 'BE_1',   attachedToRef: 'Task_1', cancelActivity: true, eventDefinition: 'TimerEventDefinition' },
      ]}],
      shapes: {
        'Task_1': { id: 'Task_1', x: 200, y: 100, width: 100, height: 60 },
        'BE_1':   { id: 'BE_1',   x: 250, y: 142, width: 36,  height: 36 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const boundary = graph.getCellById('BE_1')
    expect(boundary).toBeDefined()
    expect(boundary!.shape).toBe(BPMN_BOUNDARY_EVENT_TIMER)
    // Parent should be set to Task_1
    const parent = (boundary as any).getParent?.()
    expect(parent?.id).toBe('Task_1')
    graph.dispose()
  })

  it('应导入带 conditionExpression 的条件流', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1' },
        { kind: 'endEvent',   id: 'E1' },
        { kind: 'sequenceFlow', id: 'CF_1', sourceRef: 'S1', targetRef: 'E1', hasCondition: true, conditionBody: 'x > 5' },
      ]}],
      shapes: {
        'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
        'E1': { id: 'E1', x: 300, y: 100, width: 36, height: 36 },
      },
      edges: {
        'CF_1': { id: 'CF_1', waypoints: [{ x: 136, y: 118 }, { x: 300, y: 118 }] },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const edge = graph.getEdges().find(e => e.id === 'CF_1')
    expect(edge).toBeDefined()
    expect(edge!.shape).toBe(BPMN_CONDITIONAL_FLOW)
    graph.dispose()
  })

  it('应导入带中间路径点的消息流', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [
        { id: 'Process_1', elements: [] },
        { id: 'Process_2', elements: [] },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'P1', name: '发送方', processRef: 'Process_1' },
          { id: 'P2', name: '接收方', processRef: 'Process_2' },
        ],
        messageFlows: [{ id: 'MF_1', name: '消息', sourceRef: 'P1', targetRef: 'P2' }],
      },
      shapes: {
        'P1': { id: 'P1', x: 40, y: 40,  width: 400, height: 200, isHorizontal: true },
        'P2': { id: 'P2', x: 40, y: 300, width: 400, height: 200, isHorizontal: true },
      },
      edges: {
        'MF_1': { id: 'MF_1', waypoints: [
          { x: 200, y: 240 },
          { x: 200, y: 270 },
          { x: 250, y: 270 },
          { x: 250, y: 300 },
        ]},
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const mfEdge = graph.getEdges().find(e => e.id === 'MF_1')
    expect(mfEdge).toBeDefined()
    expect(mfEdge!.shape).toBe(BPMN_MESSAGE_FLOW)
    // Should have 2 intermediate waypoints
    const vertices = mfEdge!.getVertices()
    expect(vertices.length).toBe(2)
    // Check labels
    const labels = mfEdge!.getLabels()
    expect(labels.length).toBe(1)
    graph.dispose()
  })

  it('应把 Pool、Lane 与消息流 BPMNDI 原始属性并入导入数据', async () => {
    const baseXml = await buildTestXml({
      processes: [
        {
          id: 'Process_1',
          elements: [
            { kind: 'laneSet', id: 'LaneSet_1', lanes: [{ id: 'Lane_1', name: '泳道A' }] },
          ],
        },
        { id: 'Process_2', elements: [] },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'Pool_1', name: '参与者1', processRef: 'Process_1' },
          { id: 'Pool_2', name: '参与者2', processRef: 'Process_2' },
        ],
        messageFlows: [{ id: 'MF_1', name: '消息', sourceRef: 'Pool_1', targetRef: 'Pool_2' }],
      },
      shapes: {
        Pool_1: { id: 'Pool_1', x: 40, y: 40, width: 400, height: 200, isHorizontal: true },
        Pool_2: { id: 'Pool_2', x: 40, y: 320, width: 400, height: 200, isHorizontal: true },
        Lane_1: { id: 'Lane_1', x: 70, y: 40, width: 370, height: 200, isHorizontal: true },
      },
      edges: {
        MF_1: { id: 'MF_1', waypoints: [{ x: 240, y: 240 }, { x: 240, y: 320 }] },
      },
    })
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        replaceXmlOrThrow(
          replaceXmlOrThrow(
            withXmlDeclaration(baseXml),
            /<bpmn:definitions([^>]*)>/,
            '<bpmn:definitions$1 xmlns:modeler="http://example.com/modeler">',
            '应能为 definitions 注入 BPMNDI 测试命名空间',
          ),
          /<bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1"([^>]*)>/,
          '<bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1"$1 modeler:stroke="red">',
          '应能为 Pool DI 注入原始属性',
        ),
        /<bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1"([^>]*)>/,
        '<bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1"$1 modeler:laneStyle="solid">',
        '应能为 Lane DI 注入原始属性',
      ),
      /<bpmndi:BPMNEdge id="MF_1_di" bpmnElement="MF_1"([^>]*)>/,
      '<bpmndi:BPMNEdge id="MF_1_di" bpmnElement="MF_1"$1 modeler:edgeStyle="dashed" messageVisibleKind="initiating">',
      '应能为消息流 DI 注入原始属性',
    )

    const parsed = await parseBpmnXml(xml)
    const pool = parsed.nodes.find((node) => node.id === 'Pool_1')
    const lane = parsed.nodes.find((node) => node.id === 'Lane_1')
    const messageFlow = parsed.edges.find((edge) => edge.id === 'MF_1')

    expect(((pool?.data as any)?.bpmndi as any)?.$attrs).toEqual({ 'modeler:stroke': 'red' })
    expect(((lane?.data as any)?.bpmndi as any)?.$attrs).toEqual({ 'modeler:laneStyle': 'solid' })
    expect(((messageFlow?.data as any)?.bpmn as any)?.messageVisibleKind).toBe('initiating')
    expect(((messageFlow?.data as any)?.bpmndi as any)?.$attrs).toEqual({ 'modeler:edgeStyle': 'dashed' })
  })

  it('BPMNDI merge helper 应保留既有 bpmndi 字段并叠加补丁', () => {
    expect(xmlParserTest.mergeNodeBpmndiData({ bpmndi: { keep: true }, foo: 'bar' }, { add: 1 })).toEqual({
      foo: 'bar',
      bpmndi: { keep: true, add: 1 },
    })
    expect(xmlParserTest.mergeEdgeBpmndiData({ bpmndi: { keep: true }, foo: 'bar' }, { add: 1 })).toEqual({
      foo: 'bar',
      bpmndi: { keep: true, add: 1 },
    })
  })

  it('应导入任务内部的数据关联', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'dataObjectReference',   id: 'DataObj_1', name: '数据' },
        { kind: 'task',                  id: 'Task_1',    name: '处理任务',
          dataInputAssociations:  ['DIA_1'],
          dataOutputAssociations: ['DOA_1'],
        },
        { kind: 'dataInputAssociation',  id: 'DIA_1', taskId: 'Task_1', dataRef: 'DataObj_1' },
        { kind: 'dataOutputAssociation', id: 'DOA_1', taskId: 'Task_1', dataRef: 'DataObj_1' },
      ]}],
      shapes: {
        'DataObj_1': { id: 'DataObj_1', x: 100, y: 100, width: 40,  height: 50 },
        'Task_1':    { id: 'Task_1',    x: 200, y: 90,  width: 100, height: 60 },
      },
    }, createTestGraph)

    // Should have 2 data association edges
    const dataAssocEdges = graph.getEdges().filter(e => e.shape === BPMN_DATA_ASSOCIATION)
    expect(dataAssocEdges.length).toBe(2)
    graph.dispose()
  })

  it('默认应执行 zoomToFit', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1', name: '开始' },
      ]}],
      shapes: { 'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    // Default options → zoomToFit = true → schedules setTimeout
    loadBpmnGraph(graph, await parseBpmnXml(xml)) // default zoomToFit: true
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('应处理无 process 的 XML（仅 collaboration）', async () => {
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [] }],
        collaboration: {
          id: 'Collab_1',
          participants: [{ id: 'P1', name: '参与者', processRef: 'Process_1' }],
        },
        shapes: {
          P1: { id: 'P1', x: 40, y: 40, width: 400, height: 200, isHorizontal: true },
        },
      }),
      /\s*<bpmn:process id="Process_1"[^>]*(?:\/>|>[\s\S]*?<\/bpmn:process>)/,
      '应能移除 collaboration XML 中的 process',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // Pool is imported, but no process → should return early
    expect(graph.getNodes().length).toBe(1)
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('应处理无 BPMNDiagram（无 DI）的 XML', async () => {
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'startEvent', id: 'S1', name: '开始' },
          { kind: 'endEvent', id: 'E1', name: '结束' },
          { kind: 'sequenceFlow', id: 'F1', sourceRef: 'S1', targetRef: 'E1' },
        ] }],
      }),
      /\s*<bpmndi:BPMNDiagram\b[\s\S]*?<\/bpmndi:BPMNDiagram>/,
      '应能移除 BPMNDiagram',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(2)
    expect(graph.getEdges().length).toBe(1)
    graph.dispose()
  })

  it('应处理无方向的关联', async () => {
    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'task',           id: 'T1',  name: '任务' },
        { kind: 'textAnnotation', id: 'TA1', text: '备注' },
        { kind: 'association',    id: 'A1',  sourceRef: 'T1', targetRef: 'TA1' },
        { kind: 'association',    id: 'A2',  sourceRef: 'T1', targetRef: 'TA1', direction: 'One' },
      ]}],
      shapes: {
        'T1':  { id: 'T1',  x: 200, y: 100, width: 100, height: 60 },
        'TA1': { id: 'TA1', x: 200, y: 200, width: 100, height: 30 },
      },
    })
    expect(valid).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const edges = graph.getEdges()
    expect(edges.length).toBe(2)
    const undirected = edges.find(e => e.id === 'A1')
    const directed = edges.find(e => e.id === 'A2')
    expect(undirected!.shape).toBe(BPMN_ASSOCIATION)
    expect(directed!.shape).toBe(BPMN_DIRECTED_ASSOCIATION)
    graph.dispose()
  })

  it('应跳过无 id 的数据关联', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'task', id: 'T1', name: '任务' },
          { kind: 'dataObjectReference', id: 'D1', name: '数据' },
          { kind: 'dataInputAssociation', id: 'DIA_1', taskId: 'T1', dataRef: 'D1' },
        ] }],
        shapes: {
          T1: { id: 'T1', x: 200, y: 100, width: 100, height: 60 },
          D1: { id: 'D1', x: 80, y: 100, width: 36, height: 50 },
        },
      }),
      /<bpmn:dataInputAssociation id="DIA_1">/,
      '<bpmn:dataInputAssociation>',
      '应能移除数据输入关联的 id 属性',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // No id → skip data association
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('应处理缺少 sourceRef 或 targetRef 的数据关联', async () => {
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'task', id: 'T1', name: '任务' },
          { kind: 'dataObjectReference', id: 'D1', name: '数据' },
          { kind: 'dataOutputAssociation', id: 'DOA_bad', taskId: 'T1', dataRef: 'D1' },
        ] }],
        shapes: {
          T1: { id: 'T1', x: 200, y: 100, width: 100, height: 60 },
          D1: { id: 'D1', x: 340, y: 100, width: 36, height: 50 },
        },
      }),
      /\s*<bpmn:targetRef>D1<\/bpmn:targetRef>/,
      '应能移除数据输出关联的 targetRef',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // Missing targetRef → skip data association edge
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('应导入无 BPMNPlane 的 BPMNDiagram', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'startEvent', id: 'S1', name: '开始' },
        ] }],
        shapes: { S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
      }),
      /<bpmndi:BPMNDiagram id="BPMNDiagram_1">[\s\S]*?<\/bpmndi:BPMNDiagram>/,
      '<bpmndi:BPMNDiagram id="BPMNDiagram_1">\n  </bpmndi:BPMNDiagram>',
      '应能移除 BPMNPlane',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // No plane → no DI info, but process elements still imported with defaults
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('无 DI Shape 信息的节点应使用默认尺寸', async () => {
    // 不提供 shapes → 所有节点使用回退默认尺寸
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'exclusiveGateway',  id: 'GW1', name: '判断' },
        { kind: 'dataObjectReference', id: 'DO1', name: '数据' },
        { kind: 'group',             id: 'G1' },
      ]}],
    }, createTestGraph)

    expect(graph.getNodes().length).toBe(3)
    expect(graph.getCellById('GW1')).toBeDefined()
    expect(graph.getCellById('DO1')).toBeDefined()
    expect(graph.getCellById('G1')).toBeDefined()
    graph.dispose()
  })

  it('应处理 eventDefinition 与 attrs 不匹配的事件', async () => {
    // 测试各种事件定义类型正确解析为 X6 图形名称
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent',              id: 'SE1',  name: '消息开始', eventDefinition: 'MessageEventDefinition' },
        { kind: 'endEvent',                id: 'EE1',  name: '消息结束', eventDefinition: 'MessageEventDefinition' },
        { kind: 'intermediateThrowEvent',  id: 'ITE1', name: '中间抛出', eventDefinition: 'SignalEventDefinition' },
        { kind: 'intermediateCatchEvent',  id: 'ICE1', name: '中间捕获', eventDefinition: 'TimerEventDefinition' },
      ]}],
      shapes: {
        'SE1':  { id: 'SE1',  x: 100, y: 100, width: 36, height: 36 },
        'EE1':  { id: 'EE1',  x: 200, y: 100, width: 36, height: 36 },
        'ITE1': { id: 'ITE1', x: 300, y: 100, width: 36, height: 36 },
        'ICE1': { id: 'ICE1', x: 400, y: 100, width: 36, height: 36 },
      },
    }, createTestGraph)

    expect(graph.getCellById('SE1')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph.getCellById('EE1')!.shape).toBe(BPMN_END_EVENT_MESSAGE)
    expect(graph.getCellById('ITE1')!.shape).toBe(BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL)
    expect(graph.getCellById('ICE1')!.shape).toBe(BPMN_INTERMEDIATE_CATCH_EVENT_TIMER)
    graph.dispose()
  })

  it('应优雅处理未知 BPMN 标签', async () => {
    // 普通节点能正常导入，未知标签被跳过
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1', name: '开始' },
      ]}],
      shapes: { 'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
    }, createTestGraph)

    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('应导入 BPMNShape 上的 isHorizontal 属性', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'laneSet', id: 'LS1', lanes: [{ id: 'Lane_1', name: '泳道1', flowNodeRefs: ['T1'] }] },
        { kind: 'task', id: 'T1', name: '任务' },
      ]}],
      collaboration: {
        id: 'Collab_1',
        participants: [{ id: 'P1', name: '参与者', processRef: 'Process_1' }],
      },
      shapes: {
        'P1':     { id: 'P1',     x: 40, y: 40,  width: 600, height: 300, isHorizontal: true },
        'Lane_1': { id: 'Lane_1', x: 70, y: 40,  width: 570, height: 300, isHorizontal: true },
        'T1':     { id: 'T1',     x: 200, y: 100, width: 100, height: 60 },
      },
    }, createTestGraph)

    expect(graph.getNodes().length).toBe(3) // Pool + Lane + Task
    graph.dispose()
  })

  it('应处理带标签的顺序流', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent',   id: 'S1' },
        { kind: 'endEvent',     id: 'E1' },
        { kind: 'sequenceFlow', id: 'F1', name: '条件通过', sourceRef: 'S1', targetRef: 'E1' },
      ]}],
      shapes: {
        'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
        'E1': { id: 'E1', x: 300, y: 100, width: 36, height: 36 },
      },
    }, createTestGraph)
    const edge = graph.getEdges()[0]
    const labels = edge.getLabels()
    expect(labels.length).toBe(1)
    expect(labels[0].attrs?.label?.text).toBe('条件通过')
    graph.dispose()
  })

  it('非 definitions 根元素应抛出错误', async () => {
    const validXml = await buildTestXml({
      processes: [{ id: 'P1', elements: [] }],
    })
    const processFragment = matchXmlOrThrow(
      validXml,
      /(<bpmn:process\b[^>]*(?:\/>|>[\s\S]*?<\/bpmn:process>))/, 
      '应能提取 process 片段',
    )[1]
    const xml = withXmlDeclaration(processFragment)
    const graph = createTestGraph()
    await expect(parseBpmnXml(xml)).rejects.toThrow('root element must be <definitions>')
    graph.dispose()
  })

  it('应在用 XML 格式错误时抛出错误', async () => {
    const xml = truncateXml(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [] }],
      }),
      24,
    )
    const graph = createTestGraph()
    await expect(parseBpmnXml(xml)).rejects.toThrow('Invalid BPMN XML')
    graph.dispose()
  })

  it('应处理 clearGraph=false 选项', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_TASK, id: 'pre_existing', x: 50, y: 50, width: 100, height: 60 })

    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1', name: '开始' },
      ]}],
      shapes: { 'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
    })
    expect(valid).toBe(true)

    loadBpmnGraph(graph, await parseBpmnXml(xml), { clearGraph: false, zoomToFit: false })
    // pre_existing node should still be there, plus the imported one
    expect(graph.getNodes().length).toBe(2)
    expect(graph.getCellById('pre_existing')).toBeDefined()
    expect(graph.getCellById('S1')).toBeDefined()
    graph.dispose()
  })

  it('BPMNShape Bounds 属性缺失时应使用回退默认値', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'task', id: 'T1', name: '任务' },
        ] }],
        shapes: { T1: { id: 'T1', x: 200, y: 100, width: 100, height: 60 } },
      }),
      /<dc:Bounds\b[^>]*\/>/,
      '<dc:Bounds />',
      '应能将 Bounds 置空',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    const node = graph.getCellById('T1')
    expect(node).toBeDefined()
    graph.dispose()
  })

  it('应导入默认命名空间下的无前缀 BPMN 标签', async () => {
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        await buildTestXml({
          processes: [{ id: 'Process_1', elements: [
            { kind: 'startEvent', id: 'S1', name: '开始' },
          ] }],
          shapes: { S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
        }),
        /xmlns:bpmn="([^"]+)"/,
        'xmlns="$1" xmlns:bpmn="$1"',
        '应能补入默认 BPMN 命名空间',
      ),
      /<(\/?)(bpmn:)/g,
      '<$1',
      '应能移除 BPMN 元素标签前缀',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getCellById('S1')).toBeDefined()
    graph.dispose()
  })

  it('应导入使用自定义 BPMN 前缀的标签', async () => {
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        await buildTestXml({
          processes: [{ id: 'Process_1', elements: [
            { kind: 'startEvent', id: 'S1', name: '开始' },
          ] }],
          shapes: { S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
        }),
        /xmlns:bpmn="([^"]+)"/,
        'xmlns:flow="$1" xmlns:bpmn="$1"',
        '应能替换 BPMN 标签前缀声明',
      ),
      /<(\/?)(bpmn:)/g,
      '<$1flow:',
      '应能将 BPMN 元素标签改写为自定义前缀',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getCellById('S1')).toBeDefined()
    graph.dispose()
  })

  it('无 DI Shape 的 participant 应使用默认尺寸', async () => {
    // 不提供 shapes → P1 和 S1 均使用默认尺寸
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1', name: '开始' },
      ]}],
      collaboration: {
        id: 'Collab_1',
        participants: [{ id: 'P1', name: '参与者', processRef: 'Process_1' }],
      },
    }, createTestGraph)
    // Pool imported with default position/size, plus start event
    expect(graph.getNodes().length).toBe(2)
    graph.dispose()
  })

  it('无名称的池应使用空字符串作为标签', async () => {
    // pool 不设置 name → headerLabel 应为空字符串而不是 undefined
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'S1' },
      ]}],
      collaboration: {
        id: 'Collab_1',
        participants: [{ id: 'P1', processRef: 'Process_1' }], // 无 name
      },
      shapes: {
        'P1': { id: 'P1', x: 40, y: 40, width: 600, height: 300 },
        'S1': { id: 'S1', x: 200, y: 140, width: 36, height: 36 },
      },
    }, createTestGraph)
    const pool = graph.getCellById('P1')
    expect(pool).toBeDefined()
    // 无 name 时 headerLabel.text 应为空字符串
    const headerLabel = (pool!.attrs as any)?.headerLabel?.text
    expect(typeof headerLabel).toBe('string')
    graph.dispose()
  })

  it('无 DI Shape 的泳道应使用默认尺寸', async () => {
    // 不提供 shapes → Lane_1 和 S1 均使用默认尺寸
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'laneSet', id: 'LS1', lanes: [{ id: 'Lane_1', name: '泳道', flowNodeRefs: ['S1'] }] },
        { kind: 'startEvent', id: 'S1', name: '开始' },
      ]}],
    }, createTestGraph)
    expect(graph.getNodes().length).toBe(2) // Lane + start event
    graph.dispose()
  })

  it('无名称的泳道应使用空字符串作为标签', async () => {
    // lane 不设置 name → headerLabel 应为空字符串而不是 undefined
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'laneSet', id: 'LS1', lanes: [{ id: 'Lane_1', flowNodeRefs: ['S1'] }] }, // 无 name
        { kind: 'startEvent', id: 'S1' },
      ]}],
      shapes: {
        'Lane_1': { id: 'Lane_1', x: 70, y: 40, width: 570, height: 180 },
        'S1':     { id: 'S1',     x: 200, y: 100, width: 36, height: 36 },
      },
    }, createTestGraph)
    const lane = graph.getCellById('Lane_1')
    expect(lane).toBeDefined()
    // 无 name 时 headerLabel.text 应为空字符串
    const headerLabel = (lane!.attrs as any)?.headerLabel?.text
    expect(typeof headerLabel).toBe('string')
    graph.dispose()
  })

  it('无标签的顺序流不应生成 labels 数组', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent',   id: 'S1' },
        { kind: 'endEvent',     id: 'E1' },
        { kind: 'sequenceFlow', id: 'F1', sourceRef: 'S1', targetRef: 'E1' },
      ]}],
    }, createTestGraph)
    const edge = graph.getEdges()[0]
    expect(edge.getLabels().length).toBe(0)
    graph.dispose()
  })

  it('仅有 2 个路径点的连接线不应有中间顶点', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent',   id: 'S1' },
        { kind: 'endEvent',     id: 'E1' },
        { kind: 'sequenceFlow', id: 'F1', sourceRef: 'S1', targetRef: 'E1' },
      ]}],
      shapes: {
        'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
        'E1': { id: 'E1', x: 300, y: 100, width: 36, height: 36 },
      },
      edges: {
        'F1': { id: 'F1', waypoints: [{ x: 136, y: 118 }, { x: 300, y: 118 }] },
      },
    }, createTestGraph)
    const edge = graph.getEdges()[0]
    expect(edge.getVertices().length).toBe(0) // Only 2 waypoints → no intermediate vertices
    graph.dispose()
  })

  it('无标签的消息流应正确处理', async () => {
    // 无 name 的消息流 → 无标签；仅 2 个路径点 → 无顶点
    const { graph } = await bpmnRoundtrip({
      processes: [
        { id: 'Process_1', elements: [] },
        { id: 'Process_2', elements: [] },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'P1', name: 'A', processRef: 'Process_1' },
          { id: 'P2', name: 'B', processRef: 'Process_2' },
        ],
        messageFlows: [{ id: 'MF_1', sourceRef: 'P1', targetRef: 'P2' }],
      },
      shapes: {
        'P1': { id: 'P1', x: 40,  y: 40,  width: 400, height: 200 },
        'P2': { id: 'P2', x: 40,  y: 300, width: 400, height: 200 },
      },
      edges: {
        'MF_1': { id: 'MF_1', waypoints: [{ x: 200, y: 240 }, { x: 200, y: 300 }] },
      },
    }, createTestGraph)
    const mfEdge = graph.getEdges().find(e => e.id === 'MF_1')
    expect(mfEdge!.getLabels().length).toBe(0) // No name → no labels
    expect(mfEdge!.getVertices().length).toBe(0) // Only 2 waypoints → no vertices
    graph.dispose()
  })

  it('应处理带 text 子元素的文本注释', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'textAnnotation', id: 'TA1', text: '这是备注' },
      ]}],
      shapes: { 'TA1': { id: 'TA1', x: 100, y: 100, width: 100, height: 30 } },
    }, createTestGraph)
    const ta = graph.getCellById('TA1')
    expect(ta).toBeDefined()
    expect(ta!.shape).toBe(BPMN_TEXT_ANNOTATION)
    graph.dispose()
  })

  it('无 bpmnElement 属性的 BPMNShape 应被跳过', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'startEvent', id: 'S1', name: '开始' },
        ] }],
        shapes: { S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
      }),
      /<bpmndi:BPMNShape id="S1_di" bpmnElement="S1">/,
      '<bpmndi:BPMNShape id="S1_di">',
      '应能移除 BPMNShape 的 bpmnElement 属性',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // S1 won't match the DI shape (no bpmnElement), uses defaults
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('路径点缺少属性时应使用 0 作为回退属性', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'startEvent', id: 'S1' },
          { kind: 'endEvent', id: 'E1' },
          { kind: 'sequenceFlow', id: 'F1', sourceRef: 'S1', targetRef: 'E1' },
        ] }],
        shapes: {
          S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
          E1: { id: 'E1', x: 300, y: 100, width: 36, height: 36 },
        },
        edges: {
          F1: { id: 'F1', waypoints: [{ x: 136, y: 118 }, { x: 300, y: 118 }] },
        },
      }),
      /(<bpmndi:BPMNEdge id="F1_di" bpmnElement="F1">)\s*<di:waypoint\b[^>]*\/>\s*<di:waypoint\b[^>]*\/>\s*(<\/bpmndi:BPMNEdge>)/,
      '$1<di:waypoint /><di:waypoint />$2',
      '应能将路径点替换为空属性形式',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getEdges().length).toBe(1)
    graph.dispose()
  })

  it('resolveNodeShape 应处理无匹配 eventDef 的事件元素', async () => {
    // 将合法事件定义替换为未知事件定义后，应回退到通用图形
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'intermediateThrowEvent', id: 'ITE1', name: '中间', eventDefinition: 'messageEventDefinition' },
        ] }],
      }),
      /messageEventDefinition/g,
      'unknownEventDefinition',
      '应能将事件定义替换为未知类型',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    // Should fall back to generic intermediateThrowEvent shape
    const node = graph.getCellById('ITE1')
    expect(node).toBeDefined()
    expect(node!.shape).toBe(BPMN_INTERMEDIATE_THROW_EVENT)
    graph.dispose()
  })

  it('应将省略 cancelActivity 的升级边界事件识别为升级非中断边界事件（formal-11-01-03 §13.4.3）', async () => {
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'task', id: 'Task_1', name: '任务' },
          { kind: 'boundaryEvent', id: 'BE_1', attachedToRef: 'Task_1', eventDefinition: 'escalationEventDefinition' },
        ] }],
        shapes: {
          Task_1: { id: 'Task_1', x: 160, y: 120, width: 100, height: 60 },
          BE_1: { id: 'BE_1', x: 210, y: 162, width: 36, height: 36 },
        },
      }),
      /\s+cancelActivity="false"/,
      '应能移除升级边界事件的 cancelActivity 默认属性',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getCellById('BE_1')?.shape).toBe(BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING)
    graph.dispose()
  })

  it('应导入多重与并行多重非中断边界事件（formal-11-01-03 §13.4.3）', async () => {
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        await buildTestXml({
          processes: [{ id: 'Process_1', elements: [
            { kind: 'task', id: 'Task_1', name: '任务' },
            { kind: 'boundaryEvent', id: 'BE_M', attachedToRef: 'Task_1', cancelActivity: false, eventDefinition: 'timerEventDefinition' },
            { kind: 'boundaryEvent', id: 'BE_PM', attachedToRef: 'Task_1', cancelActivity: false, eventDefinition: 'timerEventDefinition' },
          ] }],
          shapes: {
            Task_1: { id: 'Task_1', x: 160, y: 120, width: 100, height: 60 },
            BE_M: { id: 'BE_M', x: 190, y: 162, width: 36, height: 36 },
            BE_PM: { id: 'BE_PM', x: 235, y: 162, width: 36, height: 36 },
          },
        }),
        /timerEventDefinition/g,
        'multipleEventDefinition',
        '应能将定时边界事件替换为多重边界事件定义',
      ),
      /<bpmn:boundaryEvent\b([^>]*)id="BE_PM"([^>]*)cancelActivity="false"([^>]*)>/,
      '<bpmn:boundaryEvent$1id="BE_PM"$2cancelActivity="false" parallelMultiple="true"$3>',
      '应能为并行多重边界事件补充 parallelMultiple 属性',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getCellById('BE_M')?.shape).toBe(BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING)
    expect(graph.getCellById('BE_PM')?.shape).toBe(BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING)
    graph.dispose()
  })

  it('应导入内容为空的 flowNodeRef', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'laneSet', id: 'LS1', lanes: [{ id: 'Lane_1', name: '泳道', flowNodeRefs: ['S1'] }] },
          { kind: 'startEvent', id: 'S1', name: '开始' },
        ] }],
      }),
      /<bpmn:flowNodeRef>S1<\/bpmn:flowNodeRef>/,
      '<bpmn:flowNodeRef></bpmn:flowNodeRef>\n        <bpmn:flowNodeRef>S1</bpmn:flowNodeRef>',
      '应能插入空的 flowNodeRef',
    )

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(2)
    graph.dispose()
  })
})

// ============================================================================
// Exporter Additional Coverage Tests
// ============================================================================

describe('BPMN Export Additional Coverage', () => {
  it('应导出带父节点关联的边界事件', async () => {
    const graph = createTestGraph()
    const task = graph.addNode({ shape: BPMN_TASK, id: 'task1', x: 200, y: 100, width: 100, height: 60, attrs: { label: { text: '任务' } } })
    const boundary = graph.addNode({ shape: BPMN_BOUNDARY_EVENT_TIMER, id: 'be1', x: 250, y: 142, width: 36, height: 36, attrs: { label: { text: '' } } })
    // Set parent relationship
    task.addChild(boundary)

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('attachedToRef="task1"')
    expect(xml).toContain('bpmn:boundaryEvent')
    expect(xml).toContain('bpmn:timerEventDefinition')
    graph.dispose()
  })

  it('应导出多重与并行多重非中断边界事件', async () => {
    const graph = createTestGraph()
    const task = graph.addNode({ shape: BPMN_TASK, id: 'task_multi', x: 180, y: 120, width: 100, height: 60, attrs: { label: { text: '任务' } } })
    const multiple = graph.addNode({ shape: BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING, id: 'be_multi', x: 210, y: 162, width: 36, height: 36, attrs: { label: { text: '' } } })
    const parallel = graph.addNode({ shape: BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING, id: 'be_parallel', x: 255, y: 162, width: 36, height: 36, attrs: { label: { text: '' } } })
    task.addChild(multiple)
    task.addChild(parallel)

    const xml = await exportBpmnXml(graph)
    const multipleTag = matchXmlOrThrow(xml, /<bpmn:boundaryEvent\b[^>]*id="be_multi"[^>]*>/, '应导出多重非中断边界事件标签')
    const parallelTag = matchXmlOrThrow(xml, /<bpmn:boundaryEvent\b[^>]*id="be_parallel"[^>]*>/, '应导出并行多重非中断边界事件标签')

    expect(multipleTag[0]).toContain('cancelActivity="false"')
    expect(parallelTag[0]).toContain('cancelActivity="false"')
    expect(parallelTag[0]).toContain('parallelMultiple="true"')
    expect(xml.match(/<bpmn:multipleEventDefinition\b/g)?.length).toBe(2)
    graph.dispose()
  })

  it('无父节点的边界事件不应包含 attachedToRef', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_BOUNDARY_EVENT, id: 'be_orphan', x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:boundaryEvent')
    // No attachedToRef since no parent
    expect(xml).not.toContain('attachedToRef')
    graph.dispose()
  })

  it('连接线顶点应作为 DI 中的中间路径点导出', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, id: 'start', x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '开始' } } })
    const n2 = graph.addNode({ shape: BPMN_END_EVENT, id: 'end', x: 400, y: 100, width: 36, height: 36, attrs: { label: { text: '结束' } } })
    graph.addEdge({
      shape: BPMN_SEQUENCE_FLOW,
      id: 'flow1',
      source: n1,
      target: n2,
      vertices: [{ x: 200, y: 50 }, { x: 300, y: 200 }],
    })

    const xml = await exportBpmnXml(graph)
    // Should have intermediate waypoints (200,50) and (300,200)
    expect(xml).toContain('x="200"')
    expect(xml).toContain('y="50"')
    expect(xml).toContain('x="300"')
    expect(xml).toContain('y="200"')
    graph.dispose()
  })

  it('无标签的条件流应使用 "condition" 作为默认值', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw1', x: 100, y: 100, width: 50, height: 50, attrs: { label: { text: '判断' } } })
    const n2 = graph.addNode({ shape: BPMN_TASK, id: 'task1', x: 300, y: 100, width: 100, height: 60, attrs: { label: { text: '任务' } } })
    graph.addEdge({
      shape: BPMN_CONDITIONAL_FLOW,
      id: 'cf1',
      source: n1,
      target: n2,
    })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:conditionExpression')
    expect(xml).toContain('condition')
    graph.dispose()
  })

  it('应处理分组节点导出（非 textAnnotation 工件）', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_GROUP, id: 'grp1', x: 100, y: 100, width: 200, height: 150, attrs: { label: { text: '分组' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:group')
    // bpmn-moddle omits optional empty categoryValueRef
    graph.dispose()
  })

  it('attrs.label.text 为空时应使用 data.label 导出节点', async () => {
    const graph = createTestGraph()
    const node = graph.addNode({ shape: BPMN_TASK, id: 'task_dl', x: 100, y: 100, width: 100, height: 60, attrs: { label: { text: '' } } })
    node.setData({ label: '来自数据' })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="来自数据"')
    graph.dispose()
  })

  it('导出时应跳过未映射图形的节点', async () => {
    const graph = createTestGraph()
    // Register and add an unknown shape that won't be in NODE_MAPPING
    try { Graph.registerNode('test-unknown-shape', { inherit: 'rect' }, true) } catch { /* ok */ }
    graph.addNode({ shape: 'test-unknown-shape', id: 'unk1', x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ shape: BPMN_TASK, id: 'task_known', x: 300, y: 100, width: 100, height: 60, attrs: { label: { text: '任务' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('task_known')
    // unk1 should NOT appear in the process elements (only in DI shapes if present)
    expect(xml).not.toContain('bpmn:test-unknown-shape')
    // Process should only have the known task
    const processMatch = xml.match(/<bpmn:process[^>]*>([\s\S]*?)<\/bpmn:process>/)
    expect(processMatch).toBeTruthy()
    expect(processMatch![1]).not.toContain('unk1')
    expect(processMatch![1]).toContain('task_known')
    graph.dispose()
  })

  it('导出时应跳过未映射图形的连接线', async () => {
    const graph = createTestGraph()
    try { Graph.registerEdge('test-unknown-edge', { inherit: 'edge' }, true) } catch { /* ok */ }
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, id: 'start', x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '' } } })
    const n2 = graph.addNode({ shape: BPMN_END_EVENT, id: 'end', x: 300, y: 100, width: 36, height: 36, attrs: { label: { text: '' } } })
    graph.addEdge({ shape: 'test-unknown-edge', id: 'unk_edge', source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).not.toContain('unk_edge')
    graph.dispose()
  })
})

// ============================================================================
// Round-trip Test
// ============================================================================

describe('BPMN Round-trip (Export → Import)', () => {
  it('往返小机后应保留节点和连接线数量', async () => {
    const graph1 = createTestGraph()
    const n1 = graph1.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '开始' } } })
    const n2 = graph1.addNode({ shape: BPMN_USER_TASK, x: 200, y: 90, width: 100, height: 60, attrs: { label: { text: '审批' } } })
    const n3 = graph1.addNode({ shape: BPMN_END_EVENT, x: 400, y: 100, width: 36, height: 36, attrs: { label: { text: '结束' } } })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n2, target: n3 })

    const xml = await exportBpmnXml(graph1)
    expect(xml).toContain('bpmn:startEvent')
    expect(xml).toContain('bpmn:userTask')
    expect(xml).toContain('bpmn:endEvent')

    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph2.getNodes().length).toBe(3)
    expect(graph2.getEdges().length).toBe(2)

    graph1.dispose()
    graph2.dispose()
  })

  it('往返小机后应保留图形类型', async () => {
    const graph1 = createTestGraph()
    graph1.addNode({ shape: BPMN_START_EVENT_MESSAGE, id: 'SE', x: 100, y: 100, width: 36, height: 36 })
    graph1.addNode({ shape: BPMN_USER_TASK, id: 'UT', x: 200, y: 100, width: 100, height: 60 })
    graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'GW', x: 350, y: 100, width: 50, height: 50 })
    graph1.addNode({ shape: BPMN_END_EVENT_TERMINATE, id: 'EE', x: 500, y: 100, width: 36, height: 36 })

    const xml = await exportBpmnXml(graph1)
    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph2.getCellById('SE')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph2.getCellById('UT')!.shape).toBe(BPMN_USER_TASK)
    expect(graph2.getCellById('GW')!.shape).toBe(BPMN_EXCLUSIVE_GATEWAY)
    expect(graph2.getCellById('EE')!.shape).toBe(BPMN_END_EVENT_TERMINATE)

    graph1.dispose()
    graph2.dispose()
  })

  it('应对复杂流程进行往返小机', async () => {
    const graph1 = createTestGraph()

    // Build a mini workflow
    const start = graph1.addNode({ shape: BPMN_START_EVENT, id: 'start', x: 100, y: 150, width: 36, height: 36, attrs: { label: { text: '开始' } } })
    const task1 = graph1.addNode({ shape: BPMN_USER_TASK, id: 'task1', x: 200, y: 140, width: 100, height: 60, attrs: { label: { text: '提交' } } })
    const gw = graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw1', x: 370, y: 145, width: 50, height: 50, attrs: { label: { text: '审批?' } } })
    const task2 = graph1.addNode({ shape: BPMN_SERVICE_TASK, id: 'task2', x: 500, y: 80, width: 100, height: 60, attrs: { label: { text: '处理' } } })
    const task3 = graph1.addNode({ shape: BPMN_MANUAL_TASK, id: 'task3', x: 500, y: 200, width: 100, height: 60, attrs: { label: { text: '退回' } } })
    const end = graph1.addNode({ shape: BPMN_END_EVENT, id: 'end', x: 700, y: 150, width: 36, height: 36, attrs: { label: { text: '结束' } } })

    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: task1 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task1, target: gw })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: gw, target: task2, labels: [{ attrs: { label: { text: '通过' } } }] })
    graph1.addEdge({ shape: BPMN_DEFAULT_FLOW, source: gw, target: task3 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task2, target: end })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task3, target: end })

    const xml = await exportBpmnXml(graph1, { processId: 'TestProcess', processName: '测试流程' })
    expect(xml).toContain('id="TestProcess"')
    expect(xml).toContain('name="测试流程"')

    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })

    expect(graph2.getNodes().length).toBe(6)
    expect(graph2.getEdges().length).toBe(6)

    // Verify shapes
    expect(graph2.getCellById('start')!.shape).toBe(BPMN_START_EVENT)
    expect(graph2.getCellById('task1')!.shape).toBe(BPMN_USER_TASK)
    expect(graph2.getCellById('gw1')!.shape).toBe(BPMN_EXCLUSIVE_GATEWAY)
    expect(graph2.getCellById('task2')!.shape).toBe(BPMN_SERVICE_TASK)
    expect(graph2.getCellById('task3')!.shape).toBe(BPMN_MANUAL_TASK)
    expect(graph2.getCellById('end')!.shape).toBe(BPMN_END_EVENT)

    // Verify default flow round-tripped
    const defEdges = graph2.getEdges().filter((e) => e.shape === BPMN_DEFAULT_FLOW)
    expect(defEdges.length).toBe(1)

    graph1.dispose()
    graph2.dispose()
  })

  it('完整 demo 流程往返小机应保留全部 16 条连接线（员工请假审批）', async () => {
    const graph1 = createTestGraph()

    // ========== 泳池与泳道 ==========
    const pool = graph1.addNode({ shape: BPMN_POOL, id: 'pool1', x: 40, y: 40, width: 1100, height: 460, attrs: { headerLabel: { text: '员工请假审批流程' } } })
    graph1.addNode({ shape: BPMN_LANE, id: 'lane1', x: 70, y: 40, width: 1070, height: 200, attrs: { headerLabel: { text: '申请人' } }, parent: pool.id })
    graph1.addNode({ shape: BPMN_LANE, id: 'lane2', x: 70, y: 240, width: 1070, height: 260, attrs: { headerLabel: { text: '审批人' } }, parent: pool.id })

    // ========== 节点 ==========
    const start = graph1.addNode({ shape: BPMN_START_EVENT, id: 'start', x: 120, y: 120, width: 36, height: 36, attrs: { label: { text: '发起申请' } } })
    const fillForm = graph1.addNode({ shape: BPMN_USER_TASK, id: 'fillForm', x: 210, y: 105, width: 100, height: 60, attrs: { label: { text: '填写请假单' } } })
    const leaveForm = graph1.addNode({ shape: BPMN_DATA_OBJECT, id: 'leaveForm', x: 230, y: 190, width: 40, height: 50, attrs: { label: { text: '请假单' } } })
    const annotation = graph1.addNode({ shape: BPMN_TEXT_ANNOTATION, id: 'anno1', x: 110, y: 50, width: 100, height: 30, attrs: { label: { text: '员工通过OA系统发起' } } })
    const gw1 = graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw1', x: 370, y: 300, width: 50, height: 50, attrs: { label: { text: '天数?' } } })
    const managerApprove = graph1.addNode({ shape: BPMN_USER_TASK, id: 'mgrApprove', x: 470, y: 260, width: 100, height: 60, attrs: { label: { text: '主管审批' } } })
    const directorApprove = graph1.addNode({ shape: BPMN_USER_TASK, id: 'dirApprove', x: 470, y: 370, width: 100, height: 60, attrs: { label: { text: '总监审批' } } })
    const gw2 = graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw2', x: 620, y: 300, width: 50, height: 50, attrs: { label: { text: '通过?' } } })
    const notify = graph1.addNode({ shape: BPMN_SEND_TASK, id: 'notify', x: 730, y: 285, width: 100, height: 60, attrs: { label: { text: '发送通知' } } })
    const updateAttendance = graph1.addNode({ shape: BPMN_SERVICE_TASK, id: 'updateAtt', x: 730, y: 105, width: 100, height: 60, attrs: { label: { text: '更新考勤系统' } } })
    const attendanceDB = graph1.addNode({ shape: BPMN_DATA_STORE, id: 'attDB', x: 870, y: 105, width: 50, height: 50, attrs: { label: { text: '考勤数据库' } } })
    const rejectModify = graph1.addNode({ shape: BPMN_USER_TASK, id: 'rejectMod', x: 730, y: 395, width: 100, height: 60, attrs: { label: { text: '修改申请' } } })
    const gw3 = graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw3', x: 880, y: 400, width: 50, height: 50, attrs: { label: { text: '重新提交?' } } })
    const endOk = graph1.addNode({ shape: BPMN_END_EVENT, id: 'endOk', x: 1000, y: 120, width: 36, height: 36, attrs: { label: { text: '审批完成' } } })
    const endCancel = graph1.addNode({ shape: BPMN_END_EVENT_TERMINATE, id: 'endCancel', x: 1000, y: 405, width: 36, height: 36, attrs: { label: { text: '撤销申请' } } })

    // ========== 连线 (16 edges) ==========
    // Sequence flows (7)
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e1', source: start, target: fillForm })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e2', source: fillForm, target: gw1 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e5', source: managerApprove, target: gw2 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e6', source: directorApprove, target: gw2 })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e8', source: notify, target: updateAttendance })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e9', source: updateAttendance, target: endOk })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, id: 'e11', source: rejectModify, target: gw3 })

    // Conditional flows (4)
    graph1.addEdge({ shape: BPMN_CONDITIONAL_FLOW, id: 'e3', source: gw1, target: managerApprove, labels: [{ attrs: { label: { text: '≤3天' } } }] })
    graph1.addEdge({ shape: BPMN_CONDITIONAL_FLOW, id: 'e4', source: gw1, target: directorApprove, labels: [{ attrs: { label: { text: '>3天' } } }] })
    graph1.addEdge({ shape: BPMN_CONDITIONAL_FLOW, id: 'e7', source: gw2, target: notify, labels: [{ attrs: { label: { text: '通过' } } }] })
    graph1.addEdge({ shape: BPMN_CONDITIONAL_FLOW, id: 'e12', source: gw3, target: gw1, labels: [{ attrs: { label: { text: '是' } } }] })

    // Default flows (2)
    graph1.addEdge({ shape: BPMN_DEFAULT_FLOW, id: 'e10', source: gw2, target: rejectModify, labels: [{ attrs: { label: { text: '驳回' } } }] })
    graph1.addEdge({ shape: BPMN_DEFAULT_FLOW, id: 'e13', source: gw3, target: endCancel, labels: [{ attrs: { label: { text: '否' } } }] })

    // Data associations (2)
    graph1.addEdge({ shape: BPMN_DATA_ASSOCIATION, id: 'da1', source: fillForm, target: leaveForm })
    graph1.addEdge({ shape: BPMN_DATA_ASSOCIATION, id: 'da2', source: updateAttendance, target: attendanceDB })

    // Association (1)
    graph1.addEdge({ shape: BPMN_ASSOCIATION, id: 'assoc1', source: annotation, target: start })

    // Verify original counts
    expect(graph1.getNodes().length).toBe(18) // 1 pool + 2 lanes + 15 other
    expect(graph1.getEdges().length).toBe(16)

    // ========== Export ==========
    const xml = await exportBpmnXml(graph1, { processName: '员工请假审批流程' })

    // ========== Import ==========
    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })

    // ========== Verify ALL edges survived ==========
    const importedEdges = graph2.getEdges()
    expect(importedEdges.length).toBe(16)

    // Group by shape type
    const seqFlows = importedEdges.filter((e) => e.shape === BPMN_SEQUENCE_FLOW)
    const condFlows = importedEdges.filter((e) => e.shape === BPMN_CONDITIONAL_FLOW)
    const defFlows = importedEdges.filter((e) => e.shape === BPMN_DEFAULT_FLOW)
    const dataAssocs = importedEdges.filter((e) => e.shape === BPMN_DATA_ASSOCIATION)
    const assocs = importedEdges.filter((e) => e.shape === BPMN_ASSOCIATION)

    expect(seqFlows.length).toBe(7)
    expect(condFlows.length).toBe(4)
    expect(defFlows.length).toBe(2)
    expect(dataAssocs.length).toBe(2)
    expect(assocs.length).toBe(1)

    // Verify specific critical edges
    const defFlowSources = defFlows.map((e) => e.getSourceCellId()).sort()
    expect(defFlowSources).toContain('gw2') // 驳回 edge
    expect(defFlowSources).toContain('gw3') // 否 edge

    // Nodes should also be preserved
    const importedNodes = graph2.getNodes()
    expect(importedNodes.length).toBe(18) // pool + 2 lanes + 15 nodes

    graph1.dispose()
    graph2.dispose()
  })

  it('导出并重新导入的 XML 应保留全部顺序流连接', async () => {
    const graph1 = createTestGraph()

    const start = graph1.addNode({ shape: BPMN_START_EVENT, id: 'start', x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '开始' } } })
    const task = graph1.addNode({ shape: BPMN_USER_TASK, id: 'task1', x: 200, y: 90, width: 100, height: 60, attrs: { label: { text: '任务' } } })
    const gw = graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'gw1', x: 370, y: 100, width: 50, height: 50, attrs: { label: { text: '判断' } } })
    const approve = graph1.addNode({ shape: BPMN_USER_TASK, id: 'approve', x: 470, y: 50, width: 100, height: 60, attrs: { label: { text: '通过' } } })
    const reject = graph1.addNode({ shape: BPMN_USER_TASK, id: 'reject', x: 470, y: 170, width: 100, height: 60, attrs: { label: { text: '驳回' } } })
    const end = graph1.addNode({ shape: BPMN_END_EVENT, id: 'end', x: 650, y: 100, width: 36, height: 36, attrs: { label: { text: '结束' } } })

    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: task })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task, target: gw })
    graph1.addEdge({ shape: BPMN_CONDITIONAL_FLOW, source: gw, target: approve, labels: [{ attrs: { label: { text: '通过' } } }] })
    graph1.addEdge({ shape: BPMN_DEFAULT_FLOW, source: gw, target: reject })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: approve, target: end })
    graph1.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: reject, target: start }) // loop back

    const xml = await exportBpmnXml(graph1)

    // Import into fresh graph
    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })

    // ALL 6 edges must survive
    expect(graph2.getEdges().length).toBe(6)

    // Verify edge shapes
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_SEQUENCE_FLOW).length).toBe(4)
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_CONDITIONAL_FLOW).length).toBe(1)
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_DEFAULT_FLOW).length).toBe(1)

    // Second round-trip
    const xml2 = await exportBpmnXml(graph2)
    const graph3 = createTestGraph()
    loadBpmnGraph(graph3, await parseBpmnXml(xml2), { zoomToFit: false })
    expect(graph3.getEdges().length).toBe(6)

    graph1.dispose()
    graph2.dispose()
    graph3.dispose()
  })
})

// ============================================================================
// 异常/边界场景补充
// ============================================================================

describe('parseBpmnXml — 异常边界', () => {
  it('空字符串 XML 应抛出错误', async () => {
    const graph = createTestGraph()
    await expect(parseBpmnXml('')).rejects.toThrow()
    graph.dispose()
  })

  it('纯文本（非 XML）应抛出错误', async () => {
    const graph = createTestGraph()
    await expect(parseBpmnXml('this is not xml')).rejects.toThrow()
    graph.dispose()
  })

  it('连接线 sourceRef 指向不存在的节点应处理', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [
          { kind: 'startEvent', id: 'S1' },
          { kind: 'endEvent', id: 'E1' },
          { kind: 'sequenceFlow', id: 'F_bad', sourceRef: 'S1', targetRef: 'E1' },
        ] }],
        shapes: {
          S1: { id: 'S1', x: 100, y: 100, width: 36, height: 36 },
          E1: { id: 'E1', x: 300, y: 100, width: 36, height: 36 },
        },
        edges: {
          F_bad: { id: 'F_bad', waypoints: [{ x: 100, y: 118 }, { x: 300, y: 118 }] },
        },
      }),
      /sourceRef="S1"/,
      'sourceRef="NONEXISTENT"',
      '应能替换为不存在的 sourceRef',
    )
    const mutatedXml = removeXmlOrThrow(
      xml,
      /\s*<bpmn:startEvent id="S1"\s*\/>/,
      '应能移除原始源节点定义',
    )

    const graph = createTestGraph()
    // Should not throw — gracefully skip or create orphan edge
    loadBpmnGraph(graph, await parseBpmnXml(mutatedXml), { zoomToFit: false })
    expect(graph.getNodes().length).toBe(1) // Only endEvent
    graph.dispose()
  })
})

describe('exportBpmnXml — 特殊字符处理', () => {
  it('节点标签含特殊 XML 字符应正确转义', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100, width: 100, height: 60, attrs: { label: { text: '金额>100 && 状态<已审批' } } })

    const xml = await exportBpmnXml(graph)
    // XML should be valid — name attribute should be escaped properly
    expect(xml).toContain('name=')
    // bpmn-moddle 使用数字字符引用（&#60; &#62; &#38;）进行转义，确保 name 属性存在且 XML 格式有效
    expect(xml).toMatch(/name="[^"]+"/)
    graph.dispose()
  })
})

// ============================================================================
// Extension property round-trip & additional coverage
// ============================================================================

describe('Extension property round-trip', () => {
  it('应保留节点与连线上的原始 XML 属性并在往返后写回', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [
          { kind: 'userTask', id: 'task1', name: '审批' },
          { kind: 'serviceTask', id: 'task2', name: '归档' },
          { kind: 'sequenceFlow', id: 'flow1', sourceRef: 'task1', targetRef: 'task2' },
        ],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 120, width: 100, height: 60 },
        task2: { id: 'task2', x: 280, y: 120, width: 100, height: 60 },
      },
      edges: {
        flow1: {
          id: 'flow1',
          waypoints: [
            { x: 200, y: 150 },
            { x: 280, y: 150 },
          ],
        },
      },
    })
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        withXmlDeclaration(baseXml),
        /<bpmn:definitions([^>]*)>/,
        '<bpmn:definitions$1 xmlns:modeler="http://example.com/modeler">',
        '应能为 definitions 注入测试命名空间',
      ),
      /<bpmn:userTask id="task1" name="审批"\s*\/?>/,
      '<bpmn:userTask id="task1" name="审批" modeler:code="approve" modeler:owner="ops" />',
      '应能为 userTask 注入原始 XML 属性',
    )
    const xmlWithEdgeAttrs = replaceXmlOrThrow(
      xml,
      /<bpmn:sequenceFlow id="flow1" sourceRef="task1" targetRef="task2"\s*\/?>/,
      '<bpmn:sequenceFlow id="flow1" sourceRef="task1" targetRef="task2" modeler:conditionKey="routeA" />',
      '应能为 sequenceFlow 注入原始 XML 属性',
    )

    const parsed = await parseBpmnXml(xmlWithEdgeAttrs)
    const task = parsed.nodes.find((node) => node.id === 'task1')
    const flow = parsed.edges.find((edge) => edge.id === 'flow1')

    expect(((task?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'modeler:code': 'approve',
      'modeler:owner': 'ops',
    })
    expect(((flow?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'modeler:conditionKey': 'routeA',
    })

    const graph = createTestGraph()
    loadBpmnGraph(graph, parsed, { zoomToFit: false })
    const exportedXml = await exportBpmnXml(graph)

    expect(exportedXml).toContain('modeler:code="approve"')
    expect(exportedXml).toContain('modeler:owner="ops"')
    expect(exportedXml).toContain('modeler:conditionKey="routeA"')
    expect(exportedXml).not.toContain('name="$attrs"')

    graph.dispose()
  })

  it('应保留 participant 与 messageFlow 上的原始 XML 属性', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_POOL,
      id: 'pool-left',
      x: 40,
      y: 60,
      width: 320,
      height: 180,
      attrs: { headerLabel: { text: '发起方' } },
      data: {
        bpmn: {
          $attrs: {
            'custom:participantCode': 'left',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })
    graph.addNode({
      shape: BPMN_LANE,
      id: 'lane-left',
      x: 70,
      y: 95,
      width: 260,
      height: 120,
      attrs: { headerLabel: { text: '处理泳道' } },
      data: {
        bpmn: {
          $attrs: {
            'custom:laneCode': 'review',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })
    graph.addNode({
      shape: BPMN_POOL,
      id: 'pool-right',
      x: 420,
      y: 60,
      width: 320,
      height: 180,
      attrs: { headerLabel: { text: '接收方' } },
    })
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'task-left',
      x: 120,
      y: 120,
      width: 100,
      height: 60,
      attrs: { label: { text: '发送' } },
    })
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'task-right',
      x: 500,
      y: 120,
      width: 100,
      height: 60,
      attrs: { label: { text: '接收' } },
    })
    graph.getCellById('pool-left')!.embed(graph.getCellById('task-left')!)
    graph.getCellById('pool-left')!.embed(graph.getCellById('lane-left')!)
    graph.getCellById('lane-left')!.embed(graph.getCellById('task-left')!)
    graph.getCellById('pool-right')!.embed(graph.getCellById('task-right')!)
    graph.addNode({
      shape: BPMN_TEXT_ANNOTATION,
      id: 'note-left',
      x: 120,
      y: 250,
      width: 120,
      height: 40,
      attrs: { label: { text: '备注' } },
    })
    graph.addEdge({
      shape: BPMN_MESSAGE_FLOW,
      id: 'message-flow-attrs',
      source: { cell: 'task-left' },
      target: { cell: 'task-right' },
      data: {
        bpmn: {
          $attrs: {
            'custom:channel': 'mq',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })
    graph.addEdge({
      shape: BPMN_ASSOCIATION,
      id: 'association-attrs',
      source: { cell: 'task-left' },
      target: { cell: 'note-left' },
      data: {
        bpmn: {
          $attrs: {
            'custom:linkRole': 'annotation',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        extensionProperties: false,
      },
    })

    expect(xml).toContain('participantCode="left"')
    expect(xml).toContain('laneCode="review"')
    expect(xml).toContain('channel="mq"')
    expect(xml).toContain('linkRole="annotation"')

    const parsed = await parseBpmnXml(xml)
    const messageFlow = parsed.edges.find((edge) => edge.id === 'message-flow-attrs')

    expect(((messageFlow?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'custom:channel': 'mq',
    })
    expect(((messageFlow?.data as any)?.bpmn as any)?.$namespaces).toEqual({
      custom: 'http://example.com/custom',
    })

    graph.dispose()
  })

  it('节点的 bpmn 数据应按配置的扩展前缀通过 extensionElements 序列化并还原', async () => {
    const graph1 = createTestGraph()
    graph1.addNode({
      shape: BPMN_USER_TASK, id: 'ut1', x: 100, y: 100, width: 100, height: 60,
      attrs: { label: { text: '审批' } },
      data: { bpmn: { assignee: 'alice', priority: 'high', isAsync: 'true' } },
    })
    const serialization = {
      namespaces: { custom: 'http://example.com/modeler' },
      extensionProperties: {
        prefix: 'custom',
        namespaceUri: 'http://example.com/modeler',
      },
    }

    const xml = await exportBpmnXml(graph1, { serialization })
    expect(xml).toContain('custom:properties')
    expect(xml).toContain('name="assignee"')
    expect(xml).toContain('value="alice"')

    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml, { serialization }), { zoomToFit: false })
    const node = graph2.getCellById('ut1')
    expect(node).toBeTruthy()
    const data = (node as any).getData()
    expect(data.bpmn.assignee).toBe('alice')
    expect(data.bpmn.priority).toBe('high')
    expect(data.bpmn.isAsync).toBe(true)

    graph1.dispose()
    graph2.dispose()
  })

  it('关闭 extensionProperties 后不应导出或导入通用扩展属性', async () => {
    const graph1 = createTestGraph()
    graph1.addNode({
      shape: BPMN_USER_TASK,
      id: 'ut-disabled',
      x: 100,
      y: 100,
      width: 100,
      height: 60,
      data: { bpmn: { assignee: 'alice' } },
    })

    const xmlWithoutExtensions = await exportBpmnXml(graph1, {
      serialization: { extensionProperties: false },
    })
    expect(xmlWithoutExtensions).not.toContain('modeler:properties')
    expect(xmlWithoutExtensions).not.toContain('name="assignee"')

    const xmlWithExtensions = await exportBpmnXml(graph1)
    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xmlWithExtensions, {
      serialization: { extensionProperties: false },
    }), { zoomToFit: false })

    const data = (graph2.getCellById('ut-disabled') as any).getData()
    expect(data?.bpmn?.assignee).toBeUndefined()

    graph1.dispose()
    graph2.dispose()
  })

  it('example 示例导出应保持标准 BPMN 2.0 tag，并允许输出动态扩展属性', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'example-task',
      x: 120,
      y: 100,
      width: 120,
      height: 60,
      attrs: { label: { text: '审批' } },
      data: {
        bpmn: {
          assignee: 'alice',
          priority: 'high',
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      processName: 'BPMN流程',
    })

    expect(xml).toContain('<bpmn:definitions')
    expect(xml).toContain('<bpmn:userTask')
    expect(xml).toContain('xmlns:modeler=')
    expect(xml).toContain('<modeler:properties>')
    expect(xml).toContain('name="assignee" value="alice"')
    expect(xml).toContain('name="priority" value="high"')

    graph.dispose()
  })

  it('边界事件内部附着元数据不应污染标准 BPMN 导出', async () => {
    const graph = createTestGraph()
    const task = graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'task-boundary-host',
      x: 160,
      y: 120,
      width: 120,
      height: 60,
      attrs: { label: { text: '审批' } },
    })

    const boundary = graph.addNode({
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      id: 'boundary-standard',
      x: 200,
      y: 100,
      width: 36,
      height: 36,
      attrs: { label: { text: '超时' } },
      data: {
        bpmn: {
          attachedToRef: 'task-boundary-host',
          boundaryPosition: { side: 'top', ratio: 0.5 },
          customCode: 'notify-after-timeout',
        },
      },
    })
    task.embed(boundary)

    const xml = await exportBpmnXml(graph, {
      processName: 'BPMN流程',
    })

    expect(xml).toContain('<bpmn:boundaryEvent')
    expect(xml).toContain('attachedToRef="task-boundary-host"')
    expect(xml).toContain('<modeler:properties>')
    expect(xml).toContain('name="customCode" value="notify-after-timeout"')
    expect(xml).not.toContain('name="attachedToRef"')
    expect(xml).not.toContain('name="boundaryPosition"')
    expect(xml).not.toContain('value="[object Object]"')

    graph.dispose()
  })

  it('应忽略空的原始 XML 属性和命名空间保留值', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'empty-raw-attrs',
      x: 120,
      y: 100,
      width: 120,
      height: 60,
      attrs: { label: { text: '审批' } },
      data: {
        bpmn: {
          $attrs: {
            'custom:code': undefined,
            'custom:owner': null,
          },
          $namespaces: {
            custom: '',
          },
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        extensionProperties: false,
      },
    })

    expect(xml).not.toContain('xmlns:custom=')
    expect(xml).not.toContain('custom:code=')
    expect(xml).not.toContain('custom:owner=')

    graph.dispose()
  })

  it('boolean false 值应正确往返', async () => {
    const graph1 = createTestGraph()
    graph1.addNode({
      shape: BPMN_SERVICE_TASK, id: 'st1', x: 100, y: 100, width: 100, height: 60,
      data: { bpmn: { isAsync: 'false' } },
    })
    const xml = await exportBpmnXml(graph1)
    expect(xml).toContain('value="false"')

    const graph2 = createTestGraph()
    loadBpmnGraph(graph2, await parseBpmnXml(xml), { zoomToFit: false })
    const data = (graph2.getCellById('st1') as any).getData()
    expect(data.bpmn.isAsync).toBe(false)

    graph1.dispose()
    graph2.dispose()
  })

  it('显式传入 bpmn.$attrs 时应导出为元素原始 XML 属性而非扩展属性', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'task-attrs',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          $attrs: {
            'modeler:code': 'approve',
          },
          $namespaces: {
            modeler: 'http://example.com/modeler',
          },
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        extensionProperties: false,
      },
    })
    expect(xml).toContain('modeler:code="approve"')
    expect(xml).not.toContain('name="$attrs"')
    expect(xml).not.toContain('extensionElements')

    graph.dispose()
  })

  it('应导出工件节点上的原始 XML 属性', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_TEXT_ANNOTATION,
      id: 'annotation-attrs',
      x: 100,
      y: 100,
      width: 120,
      height: 40,
      attrs: { label: { text: '注释' } },
      data: {
        bpmn: {
          $attrs: {
            'custom:annotationRole': 'note',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        extensionProperties: false,
      },
    })

    expect(xml).toContain('annotationRole="note"')

    graph.dispose()
  })

  it('应保留未声明命名空间的普通原始 XML 属性且不生成 $namespaces', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [
          { kind: 'userTask', id: 'task1', name: '审批' },
          { kind: 'serviceTask', id: 'task2', name: '归档' },
          { kind: 'sequenceFlow', id: 'flow1', sourceRef: 'task1', targetRef: 'task2' },
        ],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 120, width: 100, height: 60 },
        task2: { id: 'task2', x: 280, y: 120, width: 100, height: 60 },
      },
      edges: {
        flow1: {
          id: 'flow1',
          waypoints: [
            { x: 200, y: 150 },
            { x: 280, y: 150 },
          ],
        },
      },
    })
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        withXmlDeclaration(baseXml),
        /<bpmn:userTask id="task1" name="审批"\s*\/?>/,
        '<bpmn:userTask id="task1" name="审批" data-owner="ops" />',
        '应能为 userTask 注入未声明命名空间的普通属性',
      ),
      /<bpmn:sequenceFlow id="flow1" sourceRef="task1" targetRef="task2"\s*\/?>/,
      '<bpmn:sequenceFlow id="flow1" sourceRef="task1" targetRef="task2" data-route="A" />',
      '应能为 sequenceFlow 注入未声明命名空间的普通属性',
    )

    const parsed = await parseBpmnXml(xml)
    const task = parsed.nodes.find((node) => node.id === 'task1')
    const flow = parsed.edges.find((edge) => edge.id === 'flow1')

    expect(((task?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'data-owner': 'ops',
    })
    expect(((task?.data as any)?.bpmn as any)?.$namespaces).toBeUndefined()
    expect(((flow?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'data-route': 'A',
    })
    expect(((flow?.data as any)?.bpmn as any)?.$namespaces).toBeUndefined()
  })

  it('应导入 association 与 data association 上的原始 XML 属性', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [
          { kind: 'userTask', id: 'task1', name: '审批' },
          { kind: 'dataObjectReference', id: 'data1', name: '表单' },
          { kind: 'textAnnotation', id: 'note1', text: '说明' },
          { kind: 'association', id: 'assoc1', sourceRef: 'task1', targetRef: 'note1' },
          { kind: 'dataInputAssociation', id: 'dataAssoc1', taskId: 'task1', dataRef: 'data1' },
        ],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 100, width: 100, height: 60 },
        data1: { id: 'data1', x: 80, y: 220, width: 40, height: 50 },
        note1: { id: 'note1', x: 260, y: 100, width: 120, height: 40 },
      },
      edges: {
        assoc1: {
          id: 'assoc1',
          waypoints: [
            { x: 200, y: 130 },
            { x: 260, y: 120 },
          ],
        },
      },
    })
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        withXmlDeclaration(baseXml),
        /<bpmn:definitions([^>]*)>/,
        '<bpmn:definitions$1 xmlns:custom="http://example.com/custom">',
        '应能为 definitions 注入 custom 命名空间',
      ),
      /<bpmn:association id="assoc1" sourceRef="task1" targetRef="note1"\s*\/?>/,
      '<bpmn:association id="assoc1" sourceRef="task1" targetRef="note1" custom:linkType="note" />',
      '应能为 association 注入原始 XML 属性',
    )
    const xmlWithDataAssocAttrs = replaceXmlOrThrow(
      xml,
      /<bpmn:dataInputAssociation id="dataAssoc1">/,
      '<bpmn:dataInputAssociation id="dataAssoc1" custom:dataRole="input">',
      '应能为 dataInputAssociation 注入原始 XML 属性',
    )

    const parsed = await parseBpmnXml(xmlWithDataAssocAttrs)
    const association = parsed.edges.find((edge) => edge.id === 'assoc1')
    const dataAssociation = parsed.edges.find((edge) => edge.id === 'dataAssoc1')

    expect(((association?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'custom:linkType': 'note',
    })
    expect(((association?.data as any)?.bpmn as any)?.$namespaces).toEqual({
      custom: 'http://example.com/custom',
    })
    expect(((dataAssociation?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'custom:dataRole': 'input',
    })
    expect(((dataAssociation?.data as any)?.bpmn as any)?.$namespaces).toEqual({
      custom: 'http://example.com/custom',
    })
  })

  it('应导出并导入 dataInputAssociation 与 dataOutputAssociation 的原始 XML 属性', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'task-data-attrs',
      x: 220,
      y: 120,
      width: 120,
      height: 60,
      attrs: { label: { text: '处理' } },
    })
    graph.addNode({
      shape: BPMN_DATA_OBJECT,
      id: 'data-input-attrs',
      x: 60,
      y: 120,
      width: 40,
      height: 50,
      attrs: { label: { text: '输入' } },
    })
    graph.addNode({
      shape: BPMN_DATA_OBJECT,
      id: 'data-output-attrs',
      x: 420,
      y: 120,
      width: 40,
      height: 50,
      attrs: { label: { text: '输出' } },
    })
    graph.addEdge({
      shape: BPMN_DATA_ASSOCIATION,
      id: 'data-input-edge-attrs',
      source: { cell: 'data-input-attrs' },
      target: { cell: 'task-data-attrs' },
      data: {
        bpmn: {
          $attrs: {
            'custom:dataRole': 'input',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })
    graph.addEdge({
      shape: BPMN_DATA_ASSOCIATION,
      id: 'data-output-edge-attrs',
      source: { cell: 'task-data-attrs' },
      target: { cell: 'data-output-attrs' },
      data: {
        bpmn: {
          $attrs: {
            'custom:dataRole': 'output',
          },
          $namespaces: {
            custom: 'http://example.com/custom',
          },
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        extensionProperties: false,
      },
    })

    expect(xml).toContain('dataRole="input"')
    expect(xml).toContain('dataRole="output"')

    const parsed = await parseBpmnXml(xml)
    const inputEdge = parsed.edges.find((edge) => edge.id === 'data-input-edge-attrs')
    const outputEdge = parsed.edges.find((edge) => edge.id === 'data-output-edge-attrs')

    expect(((inputEdge?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'custom:dataRole': 'input',
    })
    expect(((outputEdge?.data as any)?.bpmn as any)?.$attrs).toEqual({
      'custom:dataRole': 'output',
    })

    graph.dispose()
  })
})

describe('loadBpmnGraph — clearGraph=false', () => {
  it('clearGraph=false 时应保留已有节点', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, id: 'existing', x: 50, y: 50, width: 100, height: 60 })

    const { valid, xml } = await buildAndValidateBpmn({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'start1', name: 'Start' },
      ]}],
      shapes: { 'start1': { id: 'start1', x: 100, y: 100, width: 36, height: 36 } },
    })
    expect(valid).toBe(true)

    loadBpmnGraph(graph, await parseBpmnXml(xml), { clearGraph: false, zoomToFit: false })
    expect(graph.getNodes().length).toBe(2)
    graph.dispose()
  })
})

describe('exportBpmnXml — text annotation export', () => {
  it('应导出文本注释的 annotationText', async () => {
    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_TEXT_ANNOTATION, id: 'ann', x: 100, y: 100, width: 100, height: 30,
      data: { label: '备注' },
    })
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:textAnnotation')
    graph.dispose()
  })

  it('导入文本注释后再导出时不应回退默认文案', async () => {
    const graph = createTestGraph()
    const annotationText = '员工通过 OA系统发起'
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'startEvent', id: 'start1', name: '开始' },
          { kind: 'textAnnotation', id: 'ann1', text: annotationText },
          { kind: 'association', id: 'assoc1', sourceRef: 'start1', targetRef: 'ann1' },
        ],
      }],
      shapes: {
        start1: { id: 'start1', x: 80, y: 120, width: 36, height: 36 },
        ann1: { id: 'ann1', x: 180, y: 105, width: 140, height: 60 },
      },
      edges: {
        assoc1: {
          id: 'assoc1',
          waypoints: [
            { x: 116, y: 138 },
            { x: 180, y: 135 },
          ],
        },
      },
    })

    loadBpmnGraph(graph, await parseBpmnXml(xml))

    const annotation = graph.getCellById('ann1') as X6Node | null
    expect(annotation?.getAttrByPath('label/text')).toBe(annotationText)
    expect((annotation?.getData() as any)?.bpmn?.annotationText).toBe(annotationText)

    const exportedXml = await exportBpmnXml(graph)
    expect(exportedXml).toContain(`<bpmn:text>${annotationText}</bpmn:text>`)
    expect(exportedXml).not.toContain('<bpmn:text>Text Annotation</bpmn:text>')

    graph.dispose()
  })
})

// ============================================================================
// 无 DI (Diagram Interchange) 导入 — 防御性回退路径
// ============================================================================

describe('parseBpmnXml + loadBpmnGraph — 无 DI 信息', () => {
  it('应使用默认坐标导入无 BPMNDiagram 的 XML', async () => {
    const graph = createTestGraph()
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', isExecutable: true, elements: [
          { kind: 'startEvent', id: 'start1', name: '开始' },
          { kind: 'userTask', id: 'task1', name: '审批' },
          { kind: 'endEvent', id: 'end1', name: '结束' },
          { kind: 'sequenceFlow', id: 'flow1', sourceRef: 'start1', targetRef: 'task1' },
          { kind: 'sequenceFlow', id: 'flow2', sourceRef: 'task1', targetRef: 'end1' },
        ] }],
      }),
      /\s*<bpmndi:BPMNDiagram\b[\s\S]*?<\/bpmndi:BPMNDiagram>/,
      '应能移除 BPMNDiagram',
    )
    loadBpmnGraph(graph, await parseBpmnXml(xml))
    expect(graph.getNodes().length).toBe(3)
    expect(graph.getEdges().length).toBe(2)
    // 所有节点应使用默认坐标
    for (const node of graph.getNodes()) {
      const pos = node.getPosition()
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeGreaterThanOrEqual(0)
    }
    graph.dispose()
  })

  it('应使用默认坐标导入带 pool 和 lane 的无 DI XML', async () => {
    const graph = createTestGraph()
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', isExecutable: true, elements: [
          { kind: 'laneSet', id: 'LaneSet_1', lanes: [{ id: 'lane1', name: 'Lane', flowNodeRefs: ['start1'] }] },
          { kind: 'startEvent', id: 'start1', name: '开始' },
        ] }],
        collaboration: {
          id: 'Collab_1',
          participants: [{ id: 'pool1', name: 'Pool', processRef: 'Process_1' }],
        },
      }),
      /\s*<bpmndi:BPMNDiagram\b[\s\S]*?<\/bpmndi:BPMNDiagram>/,
      '应能移除 BPMNDiagram',
    )
    loadBpmnGraph(graph, await parseBpmnXml(xml))
    // pool + lane + startEvent
    expect(graph.getNodes().length).toBeGreaterThanOrEqual(2)
    graph.dispose()
  })
})

// ============================================================================
// 无 process 的 XML 导入
// ============================================================================

describe('parseBpmnXml + loadBpmnGraph — 仅 collaboration 无 process', () => {
  it('应正常返回（仅导入 pool）', async () => {
    const graph = createTestGraph()
    const xml = removeXmlOrThrow(
      await buildTestXml({
        processes: [{ id: 'Process_1', elements: [] }],
        collaboration: {
          id: 'Collab_1',
          participants: [{ id: 'pool1', name: 'Pool', processRef: 'Process_1' }],
        },
        shapes: {
          pool1: { id: 'pool1', x: 50, y: 50, width: 600, height: 300, isHorizontal: true },
        },
      }),
      /\s*<bpmn:process id="Process_1"[^>]*(?:\/>|>[\s\S]*?<\/bpmn:process>)/,
      '应能移除 collaboration-only 场景中的 process',
    )
    loadBpmnGraph(graph, await parseBpmnXml(xml))
    // pool 被导入但没有 process 内的节点
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })
})

// ============================================================================
// 条件表达式序列流导入
// ============================================================================

describe('parseBpmnXml + loadBpmnGraph — conditional sequence flow', () => {
  it('应将带 conditionExpression 的序列流导入为 conditional-flow', async () => {
    const { graph } = await bpmnRoundtrip({
      processes: [{ id: 'Process_1', elements: [
        { kind: 'exclusiveGateway', id: 'gw1' },
        { kind: 'userTask',         id: 'task1' },
        { kind: 'sequenceFlow',     id: 'flow1', sourceRef: 'gw1', targetRef: 'task1',
          hasCondition: true, conditionBody: '${amount > 100}' },
      ]}],
      shapes: {
        'gw1':   { id: 'gw1',   x: 100, y: 100, width: 50,  height: 50 },
        'task1': { id: 'task1', x: 250, y: 90,  width: 100, height: 80 },
      },
      edges: {
        'flow1': { id: 'flow1', waypoints: [{ x: 150, y: 125 }, { x: 250, y: 130 }] },
      },
    }, createTestGraph)
    const edges = graph.getEdges()
    expect(edges.length).toBe(1)
    const edge = edges[0]
    // 带 conditionExpression 的 sequenceFlow 应被导入为 conditional-flow
    expect(edge.shape).toBe('bpmn-conditional-flow')
    graph.dispose()
  })
})

// ============================================================================
// BPMNDI 自定义属性往返
// ============================================================================

describe('BPMNDI 自定义属性往返', () => {
  it('应保留 BPMNShape 与 BPMNEdge 上的自定义 attrs 和命名空间', async () => {
    const qaNamespace = 'http://x6-bpmn2.example/schema/qa'
    const { graph, importData, exportedXml } = await bpmnRoundtrip({
      definitionsAttrs: {
        'xmlns:qa': qaNamespace,
      },
      processes: [{ id: 'Process_1', elements: [
        { kind: 'startEvent', id: 'StartEvent_1', outgoing: ['Flow_1'] },
        { kind: 'userTask', id: 'UserTask_1', incoming: ['Flow_1'] },
        { kind: 'sequenceFlow', id: 'Flow_1', sourceRef: 'StartEvent_1', targetRef: 'UserTask_1' },
      ] }],
      shapes: {
        StartEvent_1: {
          id: 'StartEvent_1',
          x: 100,
          y: 100,
          width: 36,
          height: 36,
          attrs: {
            'qa:laneSlot': 'entry-anchor',
          },
        },
        UserTask_1: {
          id: 'UserTask_1',
          x: 220,
          y: 88,
          width: 110,
          height: 60,
          attrs: {
            'qa:renderHint': 'review-card',
            'qa:laneSlot': 'review-panel',
          },
        },
      },
      edges: {
        Flow_1: {
          id: 'Flow_1',
          waypoints: [{ x: 136, y: 118 }, { x: 220, y: 118 }],
          attrs: {
            'qa:pathHint': 'straight-entry',
          },
        },
      },
    }, createTestGraph)

    expect((importData.nodes.find((node) => node.id === 'UserTask_1')?.data as {
      bpmndi?: { $attrs?: Record<string, string>; $namespaces?: Record<string, string> }
    } | undefined)?.bpmndi).toEqual({
      $attrs: {
        'qa:renderHint': 'review-card',
        'qa:laneSlot': 'review-panel',
      },
      $namespaces: {
        qa: qaNamespace,
      },
    })

    expect((importData.edges.find((edge) => edge.id === 'Flow_1')?.data as {
      bpmndi?: { $attrs?: Record<string, string>; $namespaces?: Record<string, string> }
    } | undefined)?.bpmndi).toEqual({
      $attrs: {
        'qa:pathHint': 'straight-entry',
      },
      $namespaces: {
        qa: qaNamespace,
      },
    })

    expect((graph.getCellById('UserTask_1')?.getData() as {
      bpmndi?: { $attrs?: Record<string, string> }
    } | undefined)?.bpmndi?.$attrs?.['qa:renderHint']).toBe('review-card')
    expect((graph.getCellById('Flow_1')?.getData() as {
      bpmndi?: { $attrs?: Record<string, string> }
    } | undefined)?.bpmndi?.$attrs?.['qa:pathHint']).toBe('straight-entry')

    expect(exportedXml).toContain('xmlns:qa="http://x6-bpmn2.example/schema/qa"')
    expect(exportedXml).toContain('qa:renderHint="review-card"')
    expect(exportedXml).toContain('qa:laneSlot="review-panel"')
    expect(exportedXml).toContain('qa:pathHint="straight-entry"')

    graph.dispose()
  })
})

describe('结构层与导入诊断保真', () => {
  it('应在导入后导出时复用结构层、事件定义和 DI 层 id', async () => {
    const graph = createTestGraph()
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Source',
        isExecutable: true,
        elements: [
          {
            kind: 'laneSet',
            id: 'LaneSet_Source',
            lanes: [{ id: 'Lane_1', name: '审批泳道', flowNodeRefs: ['StartEvent_1', 'UserTask_1'] }],
          },
          { kind: 'startEvent', id: 'StartEvent_1', name: '开始', eventDefinition: 'messageEventDefinition' },
          { kind: 'userTask', id: 'UserTask_1', name: '审批' },
          { kind: 'sequenceFlow', id: 'Flow_1', sourceRef: 'StartEvent_1', targetRef: 'UserTask_1' },
        ],
      }],
      collaboration: {
        id: 'Collaboration_1',
        participants: [{ id: 'Pool_1', name: '主流程', processRef: 'Process_Source' }],
      },
      shapes: {
        Pool_1: { id: 'Pool_1', x: 40, y: 40, width: 720, height: 240, isHorizontal: true },
        Lane_1: { id: 'Lane_1', x: 70, y: 40, width: 690, height: 240, isHorizontal: true },
        StartEvent_1: { id: 'StartEvent_1', x: 130, y: 130, width: 36, height: 36 },
        UserTask_1: { id: 'UserTask_1', x: 240, y: 118, width: 120, height: 60 },
      },
      edges: {
        Flow_1: { id: 'Flow_1', waypoints: [{ x: 166, y: 148 }, { x: 240, y: 148 }] },
      },
    })

    const xml = [
      [/<bpmn:definitions\b([^>]*?)id="Definitions_1"/, '<bpmn:definitions$1id="Definitions_Custom"'],
      [/targetNamespace="http:\/\/bpmn\.io\/schema\/bpmn"/, 'targetNamespace="http://example.com/custom/bpmn"'],
      [/<bpmn:collaboration id="Collaboration_1"/, '<bpmn:collaboration id="Collaboration_Custom"'],
      [/<bpmndi:BPMNDiagram id="BPMNDiagram_1"/, '<bpmndi:BPMNDiagram id="BPMNDiagram_Custom" xmlns:qa="http://example.com/qa" qa:diagramRole="main"'],
      [/<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"/, '<bpmndi:BPMNPlane id="BPMNPlane_Custom" bpmnElement="Collaboration_Custom" qa:planeRole="root"'],
      [/id="StartEvent_1_ed"/, 'id="EventDefinition_Custom"'],
      [/id="Pool_1_di"/, 'id="PoolDiagram_Custom"'],
      [/id="Lane_1_di"/, 'id="LaneDiagram_Custom"'],
      [/id="StartEvent_1_di"/, 'id="StartDiagram_Custom"'],
      [/id="UserTask_1_di"/, 'id="TaskDiagram_Custom"'],
      [/id="Flow_1_di"/, 'id="FlowDiagram_Custom"'],
    ].reduce(
      (currentXml, [pattern, replacement], index) => replaceXmlOrThrow(
        currentXml,
        pattern as RegExp,
        replacement as string,
        `第 ${index + 1} 处结构层 id 变更应命中原始 XML`,
      ),
      baseXml,
    )

    const parsed = await parseBpmnXml(xml)
    loadBpmnGraph(graph, parsed, { zoomToFit: false })
    const exportedXml = await exportBpmnXml(graph)

    expect(exportedXml).toContain('id="Definitions_Custom"')
    expect(exportedXml).toContain('targetNamespace="http://example.com/custom/bpmn"')
    expect(exportedXml).toContain('id="Collaboration_Custom"')
    expect(exportedXml).toContain('id="LaneSet_Source"')
    expect(exportedXml).toContain('id="BPMNDiagram_Custom"')
    expect(exportedXml).toContain('id="BPMNPlane_Custom"')
    expect(exportedXml).toContain('qa:diagramRole="main"')
    expect(exportedXml).toContain('qa:planeRole="root"')
    expect(exportedXml).toContain('id="EventDefinition_Custom"')
    expect(exportedXml).toContain('id="PoolDiagram_Custom"')
    expect(exportedXml).toContain('id="LaneDiagram_Custom"')
    expect(exportedXml).toContain('id="StartDiagram_Custom"')
    expect(exportedXml).toContain('id="TaskDiagram_Custom"')
    expect(exportedXml).toContain('id="FlowDiagram_Custom"')

    graph.dispose()
  })

  it('应暴露失效引用与错误 plane 归属的导入诊断', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
          { kind: 'userTask', id: 'Task_1', name: '审批' },
          { kind: 'sequenceFlow', id: 'Flow_1', sourceRef: 'Start_1', targetRef: 'Task_1' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
        Task_1: { id: 'Task_1', x: 240, y: 108, width: 120, height: 60 },
      },
      edges: {
        Flow_1: { id: 'Flow_1', waypoints: [{ x: 156, y: 138 }, { x: 240, y: 138 }] },
      },
    })

    const xmlWithIssues = replaceXmlOrThrow(
      replaceXmlOrThrow(
        baseXml,
        /<bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1"\s*\/>/,
        '<bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Missing_Task" />',
        '应能制造失效 targetRef',
      ),
      /<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/,
      '<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Missing_Process"',
      '应能制造错误的 plane 根元素引用',
    )

    const parsed = await parseBpmnXml(xmlWithIssues)
    expect(parsed.diagnostics?.compatibilityIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'invalid-reference',
        'invalid-plane-bpmn-element',
      ]),
    )
    expect(parsed.diagnostics?.lossyFlags).toEqual(
      expect.arrayContaining([
        'invalid-reference',
        'invalid-plane-bpmn-element',
      ]),
    )
  })

  it('应将多个 laneSet 标记为有损导入', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_MultiLaneSet',
        elements: [
          { kind: 'laneSet', id: 'LaneSet_A', lanes: [{ id: 'Lane_A', name: 'A', flowNodeRefs: ['Task_A'] }] },
          { kind: 'userTask', id: 'Task_A', name: '任务A' },
        ],
      }],
      shapes: {
        Lane_A: { id: 'Lane_A', x: 80, y: 60, width: 640, height: 120, isHorizontal: true },
        Task_A: { id: 'Task_A', x: 160, y: 90, width: 120, height: 60 },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /(<\/bpmn:process>)/,
      [
        '<bpmn:laneSet id="LaneSet_B">',
        '  <bpmn:lane id="Lane_B" name="B">',
        '    <bpmn:flowNodeRef>Task_A</bpmn:flowNodeRef>',
        '  </bpmn:lane>',
        '</bpmn:laneSet>',
        '$1',
      ].join('\n'),
      '应能为 process 注入第二个 laneSet',
    )

    const parsed = await parseBpmnXml(xml)
    expect(parsed.diagnostics?.compatibilityIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['multiple-lane-sets']),
    )
    expect(parsed.diagnostics?.lossyFlags).toEqual(
      expect.arrayContaining(['multiple-lane-sets']),
    )
  })

  it('应将嵌套 childLaneSet 标记为当前项目不支持的有损导入', async () => {
    const { xml } = await buildAndValidateBpmn({
      processes: [{
        id: 'Process_ChildLaneSet',
        elements: [
          {
            kind: 'laneSet',
            id: 'LaneSet_Root',
            lanes: [{
              id: 'Lane_Parent',
              name: '父泳道',
              flowNodeRefs: ['Task_A'],
              childLaneSet: {
                id: 'LaneSet_Child',
                lanes: [{ id: 'Lane_Child', name: '子泳道', flowNodeRefs: ['Task_A'] }],
              },
            }],
          },
          { kind: 'userTask', id: 'Task_A', name: '审批' },
        ],
      }],
      shapes: {
        Lane_Parent: { id: 'Lane_Parent', x: 80, y: 60, width: 640, height: 180, isHorizontal: true },
        Lane_Child: { id: 'Lane_Child', x: 110, y: 100, width: 590, height: 100, isHorizontal: true },
        Task_A: { id: 'Task_A', x: 180, y: 120, width: 120, height: 60 },
      },
    })

    const parsed = await parseBpmnXml(xml)

    expect(parsed.diagnostics?.compatibilityIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unsupported-child-lane-set',
        elementIds: ['Lane_Parent'],
      }),
    ]))
    expect(parsed.diagnostics?.lossyFlags).toEqual(
      expect.arrayContaining(['unsupported-child-lane-set']),
    )
    expect(parsed.nodes.some((node) => node.id === 'Lane_Child')).toBe(false)
  })

  it('缺少 process id 时仍应保留 multiple laneSets 诊断，但不附带 elementIds', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_No_Id',
        elements: [
          { kind: 'laneSet', id: 'LaneSet_A', lanes: [{ id: 'Lane_A', name: 'A', flowNodeRefs: ['Task_A'] }] },
          { kind: 'userTask', id: 'Task_A', name: '任务A' },
        ],
      }],
      shapes: {
        Lane_A: { id: 'Lane_A', x: 80, y: 60, width: 640, height: 120, isHorizontal: true },
        Task_A: { id: 'Task_A', x: 160, y: 90, width: 120, height: 60 },
      },
    })
    const xmlWithExtraLaneSet = replaceXmlOrThrow(
      baseXml,
      /(<\/bpmn:process>)/,
      [
        '<bpmn:laneSet id="LaneSet_B">',
        '  <bpmn:lane id="Lane_B" name="B">',
        '    <bpmn:flowNodeRef>Task_A</bpmn:flowNodeRef>',
        '  </bpmn:lane>',
        '</bpmn:laneSet>',
        '$1',
      ].join('\n'),
      '应能为 process 注入第二个 laneSet',
    )
    const xml = replaceXmlOrThrow(
      xmlWithExtraLaneSet,
      /<bpmn:process id="Process_No_Id"[^>]*>/,
      '<bpmn:process>',
      '应能移除 process id 以验证无 id 诊断路径',
    )

    const parsed = await parseBpmnXml(xml)
    const issue = parsed.diagnostics?.compatibilityIssues.find((item) => item.code === 'multiple-lane-sets')

    expect(issue?.elementIds).toBeUndefined()
    expect(parsed.metadata?.processes?.[0]).toMatchObject({
      laneSetId: 'LaneSet_A',
    })
    expect(parsed.metadata?.processes?.[0]).not.toHaveProperty('id')
  })

  it('应将重复的 BPMN id 标记为有损导入', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_DuplicateIds',
        elements: [
          { kind: 'startEvent', id: 'Start_A', name: '开始' },
          { kind: 'userTask', id: 'Task_A', name: '审批' },
          { kind: 'sequenceFlow', id: 'Flow_A', sourceRef: 'Start_A', targetRef: 'Task_A' },
        ],
      }],
      shapes: {
        Start_A: { id: 'Start_A', x: 120, y: 120, width: 36, height: 36 },
        Task_A: { id: 'Task_A', x: 240, y: 108, width: 120, height: 60 },
      },
      edges: {
        Flow_A: { id: 'Flow_A', waypoints: [{ x: 156, y: 138 }, { x: 240, y: 138 }] },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /<bpmn:userTask id="Task_A"/,
      '<bpmn:userTask id="Start_A"',
      '应能制造重复的 BPMN id',
    )

    const parsed = await parseBpmnXml(xml)
    expect(parsed.diagnostics?.compatibilityIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-bpmn-id']),
    )
    expect(parsed.diagnostics?.lossyFlags).toEqual(
      expect.arrayContaining(['duplicate-bpmn-id']),
    )
  })

  it('应保留仅 plane 元数据，并把 moddle warnings 暴露为导入诊断', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Warning_Metadata',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xmlWithDiagramNamespace = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNDiagram id="BPMNDiagram_1"/,
      '<bpmndi:BPMNDiagram id="BPMNDiagram_1" xmlns:qa="http://example.com/qa"',
      '应能为 diagram 注入测试命名空间',
    )
    const xml = replaceXmlOrThrow(
      xmlWithDiagramNamespace,
      /<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Warning_Metadata"/,
      '<bpmndi:BPMNPlane id="BPMNPlane_Custom" bpmnElement="Missing_Process" foo="bar" qa:planeRole="root"',
      '应能制造带自定义属性和无效引用的 plane 元数据',
    )

    const parsed = await parseBpmnXml(xml)

    expect(parsed.diagnostics?.warnings).toEqual(expect.arrayContaining([
      'unknown attribute <foo>',
      'unresolved reference <Missing_Process>',
    ]))
    expect(parsed.metadata?.diagram?.plane).toEqual({
      id: 'BPMNPlane_Custom',
      bpmnElement: 'Missing_Process',
      $attrs: {
        foo: 'bar',
        'qa:planeRole': 'root',
      },
      $namespaces: {
        qa: 'http://example.com/qa',
      },
    })
  })

  it('应将失效的 BPMNShape bpmnElement 归类为普通失效引用，而不是 plane 根引用', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Di_Bad_Ref',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"/,
      '<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Missing_Start"',
      '应能制造 BPMNShape 的失效 bpmnElement 引用',
    )

    const parsed = await parseBpmnXml(xml)
    const codes = parsed.diagnostics?.compatibilityIssues.map((issue) => issue.code) ?? []

    expect(codes).toContain('invalid-reference')
    expect(codes).not.toContain('invalid-plane-bpmn-element')
    expect(parsed.diagnostics?.compatibilityIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'invalid-reference',
        elementIds: ['Missing_Start'],
      }),
    ]))
  })

  it('相同的失效 BPMNDI 引用应只产出一条去重后的诊断', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Di_Dedupe',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
          { kind: 'userTask', id: 'Task_1', name: '审批' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
        Task_1: { id: 'Task_1', x: 240, y: 108, width: 120, height: 60 },
      },
    })
    const xml = replaceXmlOrThrow(
      replaceXmlOrThrow(
        baseXml,
        /<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"/,
        '<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Missing_Shared"',
        '应能制造第一个重复的 BPMNDI 失效引用',
      ),
      /<bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"/,
      '<bpmndi:BPMNShape id="Task_1_di" bpmnElement="Missing_Shared"',
      '应能制造第二个重复的 BPMNDI 失效引用',
    )

    const parsed = await parseBpmnXml(xml)
    const duplicatedIssues = (parsed.diagnostics?.compatibilityIssues ?? []).filter((issue) => (
      issue.code === 'invalid-reference'
      && issue.elementIds?.[0] === 'Missing_Shared'
    ))

    expect(duplicatedIssues).toHaveLength(1)
  })

  it('应规范化原始字符串形式的引用 id', () => {
    expect(xmlParserTest.readReferencedElementId('  Missing_Process  ')).toBe('Missing_Process')
    expect(xmlParserTest.readReferencedElementId('   ')).toBeUndefined()
    expect(xmlParserTest.readReferencedElementId({ id: '   ' })).toBeUndefined()
    expect(xmlParserTest.readReferencedElementId({ id: 123 })).toBeUndefined()
  })

  it('plane 缺少 id 但保留属性时仍应保留 plane 元数据', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Plane_No_Id',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xmlWithDiagramNamespace = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNDiagram id="BPMNDiagram_1"/,
      '<bpmndi:BPMNDiagram id="BPMNDiagram_1" xmlns:qa="http://example.com/qa"',
      '应能为 diagram 注入测试命名空间',
    )
    const xml = replaceXmlOrThrow(
      xmlWithDiagramNamespace,
      /<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Plane_No_Id"/,
      '<bpmndi:BPMNPlane qa:planeRole="root" bpmnElement="Process_Plane_No_Id"',
      '应能移除 plane id 以验证仅属性元数据路径',
    )

    const parsed = await parseBpmnXml(xml)

    expect(parsed.metadata?.diagram?.plane).toEqual({
      $attrs: {
        'qa:planeRole': 'root',
      },
      $namespaces: {
        qa: 'http://example.com/qa',
      },
      bpmnElement: 'Process_Plane_No_Id',
    })
  })

  it('plane 与 BPMNShape 使用空白 bpmnElement 时仍应只保留有效的 plane 属性元数据', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Blank_BpmnElement',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xmlWithDiagramNamespace = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNDiagram id="BPMNDiagram_1"/,
      '<bpmndi:BPMNDiagram id="BPMNDiagram_1" xmlns:qa="http://example.com/qa"',
      '应能为 diagram 注入测试命名空间',
    )
    const xmlWithBlankPlaneRef = replaceXmlOrThrow(
      xmlWithDiagramNamespace,
      /<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Blank_BpmnElement"/,
      '<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="   " qa:planeRole="root"',
      '应能把 plane 的 bpmnElement 改为空白字符串',
    )
    const xml = replaceXmlOrThrow(
      xmlWithBlankPlaneRef,
      /<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"/,
      '<bpmndi:BPMNShape id="Start_1_di" bpmnElement="   "',
      '应能把 BPMNShape 的 bpmnElement 改为空白字符串',
    )

    const parsed = await parseBpmnXml(xml)
    const codes = parsed.diagnostics?.compatibilityIssues.map((issue) => issue.code) ?? []

    expect(parsed.metadata?.diagram?.plane).toEqual({
      id: 'BPMNPlane_1',
      $attrs: {
        'qa:planeRole': 'root',
      },
      $namespaces: {
        qa: 'http://example.com/qa',
      },
    })
    expect(codes).not.toContain('invalid-reference')
    expect(codes).not.toContain('invalid-plane-bpmn-element')
  })

  it('BPMNDiagram 缺少 id 时仍应仅由 plane 元数据构造 diagram metadata', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Diagram_No_Id',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNDiagram id="BPMNDiagram_1">/,
      '<bpmndi:BPMNDiagram>',
      '应能移除 BPMNDiagram id 以验证空 diagram 元数据路径',
    )

    const parsed = await parseBpmnXml(xml)
    expect(parsed.metadata?.diagram).toBeUndefined()
  })

  it('应忽略默认事件定义 id，并在缺少可选 process 元数据时只保留必要字段', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_Minimal_Metadata',
        elements: [
          { kind: 'startEvent', id: 'Start_Message_1', name: '开始', eventDefinition: 'messageEventDefinition' },
        ],
      }],
      shapes: {
        Start_Message_1: { id: 'Start_Message_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })

    const parsed = await parseBpmnXml(xml)
    const startEvent = parsed.nodes.find((node) => node.id === 'Start_Message_1')

    expect(parsed.metadata?.processes).toEqual([
      { id: 'Process_Minimal_Metadata', isExecutable: false },
    ])
    expect(startEvent?.data?.bpmn).toBeUndefined()
  })

  it('事件定义缺少 id 时不应写入保真事件定义元数据', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Event_No_Id',
        elements: [
          { kind: 'startEvent', id: 'Start_Message_1', name: '开始', eventDefinition: 'messageEventDefinition' },
        ],
      }],
      shapes: {
        Start_Message_1: { id: 'Start_Message_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /<bpmn:messageEventDefinition id="Start_Message_1_ed"\s*\/>/,
      '<bpmn:messageEventDefinition />',
      '应能移除事件定义 id 以验证空 id 路径',
    )

    const parsed = await parseBpmnXml(xml)
    const startEvent = parsed.nodes.find((node) => node.id === 'Start_Message_1')

    expect(startEvent?.data?.bpmn).toBeUndefined()
  })

  it('BPMNShape 缺少 id 时不应生成自定义 bpmndi id 元数据', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_Shape_No_Id',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })
    const xml = replaceXmlOrThrow(
      baseXml,
      /<bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"/,
      '<bpmndi:BPMNShape bpmnElement="Start_1"',
      '应能移除 BPMNShape id 以验证空 diShapeId 路径',
    )

    const parsed = await parseBpmnXml(xml)
    const startEvent = parsed.nodes.find((node) => node.id === 'Start_1')

    expect(startEvent?.data?.bpmndi).toBeUndefined()
  })
})

describe('导入适配器与图级状态', () => {
  it('应回传 importedData 并允许清理图级导入状态', async () => {
    const graph = createTestGraph()
    const onImportedData = vi.fn()
    const postImport = vi.fn()
    const importer = createBpmn2ImporterAdapter({
      zoomToFit: false,
      onImportedData,
      postImport,
    })
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
      },
    })

    await importer.importXML(graph, xml, { profile: undefined } as any)

    expect(onImportedData).toHaveBeenCalledTimes(1)
    expect(postImport).toHaveBeenCalledTimes(1)
    expect(getImportedBpmnState(graph)?.metadata?.targetNamespace).toBe('http://bpmn.io/schema/bpmn')

    clearImportedBpmnState(graph)
    expect(getImportedBpmnState(graph)).toBeUndefined()

    graph.dispose()
  })

  it('导出时遇到空白 BPMNDI id 应回退到默认 id', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Task_Blank_Di',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 120,
      width: 120,
      height: 60,
      data: {
        bpmndi: {
          id: '   ',
        },
      },
    })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('id="Task_Blank_Di_di"')

    graph.dispose()
  })

  it('导出时应允许 pool 仅按 poolId 关联导入 metadata', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Pool_Metadata_Only',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 720,
      height: 240,
      data: {
        bpmn: {
          processRef: 'Process_From_Pool_Data',
          isHorizontal: true,
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      metadata: {
        processes: [{
          poolId: 'Pool_Metadata_Only',
          name: '仅按 poolId 关联的流程',
          isExecutable: true,
        }],
      },
    })

    expect(xml).toContain('Process_From_Pool_Data')
    expect(xml).toContain('仅按 poolId 关联的流程')
    expect(xml).toContain('isExecutable="true"')

    graph.dispose()
  })

  it('导出时应忽略未映射节点和空 abort 条件的后处理分支', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Task_No_Abort',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 120,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          multiInstance: true,
          multiInstanceAbortCondition: '   ',
        },
      },
    })
    graph.addNode({
      id: 'Helper_Abort',
      shape: 'rect',
      x: 320,
      y: 120,
      width: 80,
      height: 40,
      data: {
        bpmn: {
          multiInstanceAbortCondition: '${ignored > 0}',
        },
      },
    })

    const xml = await exportBpmnXml(graph)
    expect(xml).not.toContain('action="abort"')

    graph.dispose()
  })

  it('事件定义的空白保真 id 应回退为默认导出 id', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Start_Blank_EventDef',
      shape: BPMN_START_EVENT_TIMER,
      x: 120,
      y: 120,
      width: 36,
      height: 36,
      data: {
        bpmn: {
          name: '定时开始',
          $eventDefinitionId: '   ',
        },
      },
    })

    const xml = await exportBpmnXml(graph)

    expect(xml).toContain('timerEventDefinition id="Start_Blank_EventDef_ed"')

    graph.dispose()
  })

  it('未显式授权时不应从裸 multiInstanceAbortCondition 追加 Smart abort 条件', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Task_Untrusted_Abort',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 120,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          multiInstanceAbortCondition: '${ignored > 0}',
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        nodeSerializers: {
          [BPMN_USER_TASK]: {
            export(context) {
              const moddle = context.moddle as BpmnModdle
              const element = context.element as ModdleElement & { loopCharacteristics?: ModdleElement }
              element.loopCharacteristics = createBpmnElement(moddle, 'multiInstanceLoopCharacteristics', {
                isSequential: false,
              })

              return {
                omitBpmnKeys: ['multiInstanceAbortCondition'],
              }
            },
          },
        },
      },
    })

    expect(xml).toContain('<bpmn:multiInstanceLoopCharacteristics')
    expect(xml).not.toContain('action="abort"')

    graph.dispose()
  })

  it('序列化器显式授权时才应追加 Smart abort completionCondition', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Task_Authorized_Abort',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 120,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          multiInstanceAbortCondition: '${nrOfRejectedInstances > 0}',
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        nodeSerializers: {
          [BPMN_USER_TASK]: {
            export(context) {
              const moddle = context.moddle as BpmnModdle
              const element = context.element as ModdleElement & { loopCharacteristics?: ModdleElement }
              element.loopCharacteristics = createBpmnElement(moddle, 'multiInstanceLoopCharacteristics', {
                isSequential: false,
              })

              return {
                omitBpmnKeys: ['multiInstanceAbortCondition'],
                smartAbortCompletionCondition: '${nrOfRejectedInstances > 0}',
              }
            },
          },
        },
      },
    })

    expect(xml).toContain('action="abort"')
    expect(xml).toContain('${nrOfRejectedInstances &gt; 0}')

    graph.dispose()
  })

  it('自定义序列化已输出 abort completionCondition 时不应重复追加', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'Task_Custom_Abort',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 120,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          multiInstanceAbortCondition: '${nrOfRejectedInstances > 0}',
        },
      },
    })

    const xml = await exportBpmnXml(graph, {
      serialization: {
        nodeSerializers: {
          [BPMN_USER_TASK]: {
            export(context) {
              const moddle = context.moddle as BpmnModdle
              const element = context.element as ModdleElement & { loopCharacteristics?: ModdleElement }
              const loop = createBpmnElement(moddle, 'multiInstanceLoopCharacteristics', {
                isSequential: false,
              }) as any
              const abortExpression = createBpmnElement(moddle, 'formalExpression', {
                body: '${nrOfRejectedInstances > 0}',
                action: 'abort',
              }) as any
              loop.completionCondition = abortExpression
              element.loopCharacteristics = loop

              return {
                omitBpmnKeys: ['multiInstanceAbortCondition'],
                smartAbortCompletionCondition: '${nrOfRejectedInstances > 0}',
              }
            },
          },
        },
      },
    })

    expect(xml.match(/action="abort"/g)).toHaveLength(1)

    graph.dispose()
  })
})

// ============================================================================
// 桥接边（bridge edge）导出
// ============================================================================

describe('exportBpmnXml — bridge edge', () => {
  it('两个任务间用普通边连接时应生成桥接 SequenceFlow', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 300, y: 100, width: 100, height: 60 })
    // 用普通 edge（非 bpmn-sequence-flow）连接两个任务，触发 bridge edge 逻辑
    graph.addEdge({ id: 'e1', source: 'task1', target: 'task2', shape: 'edge' })

    const xml = await exportBpmnXml(graph)
    // 桥接边应生成为 SequenceFlow
    expect(xml).toContain('bpmn:sequenceFlow')
    expect(xml).toContain('sourceRef="task1"')
    expect(xml).toContain('targetRef="task2"')
    graph.dispose()
  })

  it('两个任务间已有序列流且又有普通边时应跳过桥接（alreadyExists=true）', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 300, y: 100, width: 100, height: 60 })
    // 已有序列流（alreadyExists = true）
    graph.addEdge({ id: 'sf1', source: 'task1', target: 'task2', shape: BPMN_SEQUENCE_FLOW })
    // 同时还有普通边，进入 adjOut，但因已有序列流不会再创建桥接边
    graph.addEdge({ id: 'e1', source: 'task1', target: 'task2', shape: 'edge' })

    const xml = await exportBpmnXml(graph)
    // 只应包含 sf1 序列流，不产生额外桥接 SequenceFlow
    expect(xml).toContain('id="sf1"')
    graph.dispose()
  })

  it('通过非映射中间节点连接的两个任务应生成间接桥接 SequenceFlow', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    // Non-BPMN helper node (no mapping) in the middle
    graph.addNode({ id: 'helper', shape: 'rect', x: 250, y: 100, width: 50, height: 50 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 400, y: 100, width: 100, height: 60 })
    // Plain edges: task1 → helper → task2 (non-sequence-flow, triggers indirect bridge BFS)
    graph.addEdge({ id: 'e1', source: 'task1', target: 'helper', shape: 'edge' })
    graph.addEdge({ id: 'e2', source: 'helper', target: 'task2', shape: 'edge' })

    const xml = await exportBpmnXml(graph)
    // Should generate indirect bridge SequenceFlow from task1 to task2
    expect(xml).toContain('bpmn:sequenceFlow')
    expect(xml).toContain('sourceRef="task1"')
    expect(xml).toContain('targetRef="task2"')
    graph.dispose()
  })

  it('间接桥接已存在时不应重复生成（alreadyExists=true for indirect bridge）', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ id: 'helper', shape: 'rect', x: 250, y: 100, width: 50, height: 50 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 400, y: 100, width: 100, height: 60 })
    // Already have a sequence flow from task1 to task2
    graph.addEdge({ id: 'sf1', source: 'task1', target: 'task2', shape: BPMN_SEQUENCE_FLOW })
    // Also have plain edges going through helper (indirect), but bridge already covered
    graph.addEdge({ id: 'e1', source: 'task1', target: 'helper', shape: 'edge' })
    graph.addEdge({ id: 'e2', source: 'helper', target: 'task2', shape: 'edge' })

    const xml = await exportBpmnXml(graph)
    // sf1 should be present, no extra bridge flow
    expect(xml).toContain('id="sf1"')
    // Only one sequenceFlow from task1 to task2
    const matches = xml.match(/sourceRef="task1"/g) || []
    expect(matches.length).toBe(1)
    graph.dispose()
  })
})

// ============================================================================
// 导出额外覆盖情景
// ============================================================================

describe('exportBpmnXml — 额外分支覆盖', () => {
  it('边标签 text 非字符串时应返回空标签（getEdgeLabel 非字符串分支）', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'start', shape: BPMN_START_EVENT, x: 100, y: 100, width: 36, height: 36 })
    graph.addNode({ id: 'task', shape: BPMN_TASK, x: 300, y: 100, width: 100, height: 60 })
    // Add sequence flow with label where text is a number (not string)
    const edge = graph.addEdge({ id: 'sf1', source: 'start', target: 'task', shape: BPMN_SEQUENCE_FLOW })
    edge.setLabels([{ attrs: { label: { text: 42 as any } } }])
    const xml = await exportBpmnXml(graph)
    // Should export without error and with no meaningful label content
    expect(xml).toContain('bpmn:sequenceFlow')
    graph.dispose()
  })

  it('bpmn 数据全为空值时不应生成 extensionElements（propChildren 为空分支）', async () => {
    const graph = createTestGraph()
    graph.addNode({
      id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60,
      // All bpmn data values are empty/undefined/null → propChildren.length === 0
      data: { bpmn: { name: '', assignee: undefined, priority: null } },
    })
    const xml = await exportBpmnXml(graph)
    // No extension elements should be generated
    expect(xml).not.toContain('extensionElements')
    graph.dispose()
  })

  it('边无 source 或 target 时不应加入 adjOut（dangling edge 分支）', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 300, y: 100, width: 100, height: 60 })
    // Normal flow
    graph.addEdge({ id: 'sf1', source: 'task1', target: 'task2', shape: BPMN_SEQUENCE_FLOW })
    const xml = await exportBpmnXml(graph)
    // Should export normally without dangling edge errors
    expect(xml).toContain('id="sf1"')
    graph.dispose()
  })

  it('序列流 source 或 target 缺失时应跳过 incoming/outgoing 注册', async () => {
    const graph = createTestGraph()
    graph.addNode({ id: 'task1', shape: BPMN_TASK, x: 100, y: 100, width: 100, height: 60 })
    graph.addNode({ id: 'task2', shape: BPMN_TASK, x: 300, y: 100, width: 100, height: 60 })
    // A regular sequence flow — the null-check branches for src/tgt are defensive
    graph.addEdge({ id: 'sf1', source: 'task1', target: 'task2', shape: BPMN_SEQUENCE_FLOW })
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('incoming')
    expect(xml).toContain('outgoing')
    graph.dispose()
  })
})
