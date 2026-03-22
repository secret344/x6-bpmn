import { describe, it, expect } from 'vitest'
import { Graph } from '@antv/x6'

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
} from '../src/export/bpmn-mapping'
import { exportBpmnXml } from '../src/export/exporter'
import { importBpmnXml } from '../src/export/importer'

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
} from '../src/utils/constants'

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

describe('BPMN Mapping', () => {
  describe('NODE_MAPPING', () => {
    it('should have mappings for all event shapes', () => {
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
        BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
        BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
        BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
      ]
      for (const shape of eventShapes) {
        expect(NODE_MAPPING[shape]).toBeDefined()
        expect(NODE_MAPPING[shape].tag).toBeTruthy()
      }
    })

    it('should have mappings for all activity shapes', () => {
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

    it('should have correct BPMN tags for tasks', () => {
      expect(NODE_MAPPING[BPMN_TASK].tag).toBe('task')
      expect(NODE_MAPPING[BPMN_USER_TASK].tag).toBe('userTask')
      expect(NODE_MAPPING[BPMN_SERVICE_TASK].tag).toBe('serviceTask')
      expect(NODE_MAPPING[BPMN_SCRIPT_TASK].tag).toBe('scriptTask')
      expect(NODE_MAPPING[BPMN_SEND_TASK].tag).toBe('sendTask')
      expect(NODE_MAPPING[BPMN_RECEIVE_TASK].tag).toBe('receiveTask')
      expect(NODE_MAPPING[BPMN_MANUAL_TASK].tag).toBe('manualTask')
      expect(NODE_MAPPING[BPMN_BUSINESS_RULE_TASK].tag).toBe('businessRuleTask')
    })

    it('should have mappings for all gateway shapes', () => {
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_GATEWAY].tag).toBe('exclusiveGateway')
      expect(NODE_MAPPING[BPMN_PARALLEL_GATEWAY].tag).toBe('parallelGateway')
      expect(NODE_MAPPING[BPMN_INCLUSIVE_GATEWAY].tag).toBe('inclusiveGateway')
      expect(NODE_MAPPING[BPMN_COMPLEX_GATEWAY].tag).toBe('complexGateway')
      expect(NODE_MAPPING[BPMN_EVENT_BASED_GATEWAY].tag).toBe('eventBasedGateway')
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY].tag).toBe('eventBasedGateway')
    })

    it('should have mappings for data and artifact shapes', () => {
      expect(NODE_MAPPING[BPMN_DATA_OBJECT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_INPUT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_OUTPUT].tag).toBe('dataObjectReference')
      expect(NODE_MAPPING[BPMN_DATA_STORE].tag).toBe('dataStoreReference')
      expect(NODE_MAPPING[BPMN_TEXT_ANNOTATION].tag).toBe('textAnnotation')
      expect(NODE_MAPPING[BPMN_GROUP].tag).toBe('group')
    })

    it('should have mappings for swimlane shapes', () => {
      expect(NODE_MAPPING[BPMN_POOL].tag).toBe('participant')
      expect(NODE_MAPPING[BPMN_LANE].tag).toBe('lane')
    })

    it('should set event definitions for typed events', () => {
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

    it('should have no event definition for plain events', () => {
      expect(NODE_MAPPING[BPMN_START_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_END_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_INTERMEDIATE_THROW_EVENT].eventDefinition).toBeUndefined()
      expect(NODE_MAPPING[BPMN_INTERMEDIATE_CATCH_EVENT].eventDefinition).toBeUndefined()
    })

    it('should set extra attrs for special shapes', () => {
      expect(NODE_MAPPING[BPMN_EVENT_SUB_PROCESS].attrs?.triggeredByEvent).toBe('true')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT].attrs?.cancelActivity).toBe('true')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_NON_INTERRUPTING].attrs?.cancelActivity).toBe('false')
      expect(NODE_MAPPING[BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY].attrs?.eventGatewayType).toBe('Exclusive')
      expect(NODE_MAPPING[BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE].attrs?.parallelMultiple).toBe('true')
      expect(NODE_MAPPING[BPMN_START_EVENT_PARALLEL_MULTIPLE].attrs?.parallelMultiple).toBe('true')
    })

    it('should cover all 74+ node shapes in NODE_MAPPING', () => {
      expect(Object.keys(NODE_MAPPING).length).toBeGreaterThanOrEqual(74)
    })
  })

  describe('EDGE_MAPPING', () => {
    it('should have mappings for all edge shapes', () => {
      const edgeShapes = [
        BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
        BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
        BPMN_DATA_ASSOCIATION,
      ]
      for (const shape of edgeShapes) {
        expect(EDGE_MAPPING[shape]).toBeDefined()
      }
    })

    it('should have correct tags', () => {
      expect(EDGE_MAPPING[BPMN_SEQUENCE_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_CONDITIONAL_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_DEFAULT_FLOW].tag).toBe('sequenceFlow')
      expect(EDGE_MAPPING[BPMN_MESSAGE_FLOW].tag).toBe('messageFlow')
      expect(EDGE_MAPPING[BPMN_ASSOCIATION].tag).toBe('association')
      expect(EDGE_MAPPING[BPMN_DIRECTED_ASSOCIATION].tag).toBe('association')
      expect(EDGE_MAPPING[BPMN_DATA_ASSOCIATION].tag).toBe('dataInputAssociation')
    })

    it('should mark message flow as collaboration', () => {
      expect(EDGE_MAPPING[BPMN_MESSAGE_FLOW].isCollaboration).toBe(true)
    })

    it('should mark associations as artifact', () => {
      expect(EDGE_MAPPING[BPMN_ASSOCIATION].isArtifact).toBe(true)
      expect(EDGE_MAPPING[BPMN_DIRECTED_ASSOCIATION].isArtifact).toBe(true)
      expect(EDGE_MAPPING[BPMN_DATA_ASSOCIATION].isArtifact).toBe(true)
    })

    it('should have exactly 7 edge mappings', () => {
      expect(Object.keys(EDGE_MAPPING).length).toBe(7)
    })
  })

  describe('Helper functions', () => {
    it('isPoolShape', () => {
      expect(isPoolShape(BPMN_POOL)).toBe(true)
      expect(isPoolShape(BPMN_LANE)).toBe(false)
      expect(isPoolShape(BPMN_TASK)).toBe(false)
    })

    it('isLaneShape', () => {
      expect(isLaneShape(BPMN_LANE)).toBe(true)
      expect(isLaneShape(BPMN_POOL)).toBe(false)
      expect(isLaneShape(BPMN_TASK)).toBe(false)
    })

    it('isSwimlaneShape', () => {
      expect(isSwimlaneShape(BPMN_POOL)).toBe(true)
      expect(isSwimlaneShape(BPMN_LANE)).toBe(true)
      expect(isSwimlaneShape(BPMN_TASK)).toBe(false)
    })

    it('isArtifactShape', () => {
      expect(isArtifactShape(BPMN_TEXT_ANNOTATION)).toBe(true)
      expect(isArtifactShape(BPMN_GROUP)).toBe(true)
      expect(isArtifactShape(BPMN_TASK)).toBe(false)
    })

    it('isBoundaryShape', () => {
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT)).toBe(true)
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT_TIMER)).toBe(true)
      expect(isBoundaryShape(BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)).toBe(true)
      expect(isBoundaryShape(BPMN_START_EVENT)).toBe(false)
    })

    it('isDefaultFlow', () => {
      expect(isDefaultFlow(BPMN_DEFAULT_FLOW)).toBe(true)
      expect(isDefaultFlow(BPMN_SEQUENCE_FLOW)).toBe(false)
      expect(isDefaultFlow(BPMN_CONDITIONAL_FLOW)).toBe(false)
    })

    it('isConditionalFlow', () => {
      expect(isConditionalFlow(BPMN_CONDITIONAL_FLOW)).toBe(true)
      expect(isConditionalFlow(BPMN_SEQUENCE_FLOW)).toBe(false)
      expect(isConditionalFlow(BPMN_DEFAULT_FLOW)).toBe(false)
    })
  })
})

// ============================================================================
// Exporter Tests
// ============================================================================

describe('BPMN XML Export', () => {
  it('should produce valid XML with declaration', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    graph.dispose()
  })

  it('should contain bpmn:definitions with namespaces', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('xmlns:bpmn=')
    expect(xml).toContain('xmlns:bpmndi=')
    // xmlns:dc, xmlns:di, xmlns:xsi are added by bpmn-moddle on demand
    expect(xml).toContain('bpmn:definitions')
    graph.dispose()
  })

  it('should contain bpmn:process element', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('<bpmn:process')
    expect(xml).toContain('id="Process_1"')
    graph.dispose()
  })

  it('should use custom process id and name', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph, { processId: 'MyProc', processName: '测试' })
    expect(xml).toContain('id="MyProc"')
    expect(xml).toContain('name="测试"')
    graph.dispose()
  })

  it('should export nodes as BPMN elements', async () => {
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

  it('should export sequence flows with source/target refs', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_END_EVENT, x: 300, y: 100 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:sequenceFlow')
    graph.dispose()
  })

  it('should generate incoming/outgoing refs', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_START_EVENT, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100 })
    graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:outgoing')
    expect(xml).toContain('bpmn:incoming')
    graph.dispose()
  })

  it('should export event definitions for typed events', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_START_EVENT_MESSAGE, x: 100, y: 100 })
    graph.addNode({ shape: BPMN_END_EVENT_TERMINATE, x: 300, y: 100 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:messageEventDefinition')
    expect(xml).toContain('bpmn:terminateEventDefinition')
    graph.dispose()
  })

  it('should export pools as collaboration participants', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 800, height: 400, attrs: { headerLabel: { text: '测试池' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:collaboration')
    expect(xml).toContain('bpmn:participant')
    expect(xml).toContain('name="测试池"')
    graph.dispose()
  })

  it('should export lanes with flowNodeRefs', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_LANE, x: 70, y: 40, width: 700, height: 200, attrs: { headerLabel: { text: '泳道1' } } })
    graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100, width: 100, height: 60, attrs: { label: { text: '任务' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:laneSet')
    expect(xml).toContain('bpmn:lane')
    expect(xml).toContain('bpmn:flowNodeRef')
    graph.dispose()
  })

  it('should export text annotations', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_TEXT_ANNOTATION, x: 100, y: 50, attrs: { label: { text: '注释内容' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:textAnnotation')
    expect(xml).toContain('bpmn:text')
    expect(xml).toContain('注释内容')
    graph.dispose()
  })

  it('should export groups', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_GROUP, x: 100, y: 100, width: 200, height: 150 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:group')
    graph.dispose()
  })

  it('should export associations', async () => {
    const graph = createTestGraph()
    const ann = graph.addNode({ shape: BPMN_TEXT_ANNOTATION, x: 100, y: 50 })
    const task = graph.addNode({ shape: BPMN_USER_TASK, x: 200, y: 100 })
    graph.addEdge({ shape: BPMN_ASSOCIATION, source: ann, target: task })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:association')
    graph.dispose()
  })

  it('should export directed associations with direction', async () => {
    const graph = createTestGraph()
    const n1 = graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100 })
    const n2 = graph.addNode({ shape: BPMN_DATA_OBJECT, x: 200, y: 200 })
    graph.addEdge({ shape: BPMN_DIRECTED_ASSOCIATION, source: n1, target: n2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('associationDirection="One"')
    graph.dispose()
  })

  it('should export data associations', async () => {
    const graph = createTestGraph()
    const task = graph.addNode({ shape: BPMN_SERVICE_TASK, x: 100, y: 100 })
    const ds = graph.addNode({ shape: BPMN_DATA_STORE, x: 200, y: 200 })
    graph.addEdge({ shape: BPMN_DATA_ASSOCIATION, source: task, target: ds })

    const xml = await exportBpmnXml(graph)
    // task → dataStore = DataOutputAssociation per BPMN spec
    expect(xml).toContain('bpmn:dataOutputAssociation')
    graph.dispose()
  })

  it('should export message flows under collaboration', async () => {
    const graph = createTestGraph()
    const pool1 = graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 400, height: 200 })
    const pool2 = graph.addNode({ shape: BPMN_POOL, x: 40, y: 300, width: 400, height: 200 })
    graph.addEdge({ shape: BPMN_MESSAGE_FLOW, source: pool1, target: pool2 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:messageFlow')
    graph.dispose()
  })

  it('should export default flow with default attribute on gateway', async () => {
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

  it('should export conditional flow with conditionExpression', async () => {
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

  it('should export BPMNDiagram with shapes and edges', async () => {
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

  it('should handle nodes with newline labels', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100, width: 100, height: 60, attrs: { label: { text: '多行\n标签' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="多行 标签"')
    graph.dispose()
  })

  it('should handle empty graph', async () => {
    const graph = createTestGraph()
    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:definitions')
    expect(xml).toContain('bpmn:process')
    expect(xml).not.toContain('bpmn:collaboration')
    graph.dispose()
  })

  it('should handle edge labels', async () => {
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

  it('should handle node with data but no label attrs', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_USER_TASK, x: 100, y: 100, width: 100, height: 60, data: { label: '数据标签' } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="数据标签"')
    graph.dispose()
  })

  it('should export pool shapes with isHorizontal', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_POOL, x: 40, y: 40, width: 800, height: 400, attrs: { headerLabel: { text: '池' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('isHorizontal="true"')
    graph.dispose()
  })

  it('should export gateways correctly', async () => {
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

  it('should export all intermediate event types', async () => {
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

  it('should export data objects and stores', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_DATA_OBJECT, x: 100, y: 100, width: 40, height: 50 })
    graph.addNode({ shape: BPMN_DATA_STORE, x: 200, y: 100, width: 50, height: 50 })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:dataObjectReference')
    expect(xml).toContain('bpmn:dataStoreReference')
    graph.dispose()
  })

  it('should export subprocess types', async () => {
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

describe('BPMN XML Import', () => {
  const SIMPLE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="开始">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="审批">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_1" name="结束">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="100" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="200" y="110" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="400" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="136" y="138" />
        <di:waypoint x="200" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="300" y="140" />
        <di:waypoint x="400" y="138" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

  it('should import nodes from BPMN XML', async () => {
    const graph = createTestGraph()
    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3)
    graph.dispose()
  })

  it('should create correct shapes from BPMN tags', async () => {
    const graph = createTestGraph()
    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })

    expect(graph.getCellById('Start_1')!.shape).toBe(BPMN_START_EVENT)
    expect(graph.getCellById('Task_1')!.shape).toBe(BPMN_USER_TASK)
    expect(graph.getCellById('End_1')!.shape).toBe(BPMN_END_EVENT)
    graph.dispose()
  })

  it('should import edges from BPMN XML', async () => {
    const graph = createTestGraph()
    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })
    expect(graph.getEdges().length).toBe(2)
    graph.dispose()
  })

  it('should set node positions from DI', async () => {
    const graph = createTestGraph()
    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })

    const startNode = graph.getCellById('Start_1') as any
    const pos = startNode.getPosition()
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(120)
    graph.dispose()
  })

  it('should set node sizes from DI', async () => {
    const graph = createTestGraph()
    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })

    const taskNode = graph.getCellById('Task_1') as any
    const size = taskNode.getSize()
    expect(size.width).toBe(100)
    expect(size.height).toBe(60)
    graph.dispose()
  })

  it('should clear graph before import by default', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: 'rect', x: 0, y: 0, width: 50, height: 50 })
    expect(graph.getNodes().length).toBe(1)

    await importBpmnXml(graph, SIMPLE_BPMN, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3)
    graph.dispose()
  })

  it('should not clear graph when clearGraph=false', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: 'rect', x: 0, y: 0, width: 50, height: 50 })

    await importBpmnXml(graph, SIMPLE_BPMN, { clearGraph: false, zoomToFit: false })
    expect(graph.getNodes().length).toBe(4)
    graph.dispose()
  })

  it('should throw on invalid root element', async () => {
    const graph = createTestGraph()
    await expect(importBpmnXml(graph, '<not-definitions />', { zoomToFit: false })).rejects.toThrow('Invalid BPMN XML')
    graph.dispose()
  })

  it('should import event with event definitions', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_Msg" name="消息开始">
      <bpmn:messageEventDefinition id="Start_Msg_ed" />
    </bpmn:startEvent>
    <bpmn:endEvent id="End_Term" name="终止">
      <bpmn:terminateEventDefinition id="End_Term_ed" />
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_Msg_di" bpmnElement="Start_Msg">
        <dc:Bounds x="100" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Term_di" bpmnElement="End_Term">
        <dc:Bounds x="300" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('Start_Msg')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph.getCellById('End_Term')!.shape).toBe(BPMN_END_EVENT_TERMINATE)
    graph.dispose()
  })

  it('should import pools and lanes', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_1" name="泳池" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="泳道A" />
    </bpmn:laneSet>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true">
        <dc:Bounds x="40" y="40" width="800" height="400" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="70" y="40" width="770" height="400" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('Pool_1')!.shape).toBe(BPMN_POOL)
    expect(graph.getCellById('Lane_1')!.shape).toBe(BPMN_LANE)
    graph.dispose()
  })

  it('should import gateways', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:exclusiveGateway id="GW_1" name="判断" />
    <bpmn:parallelGateway id="GW_2" name="并行" />
    <bpmn:inclusiveGateway id="GW_3" name="包容" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="GW_1_di" bpmnElement="GW_1"><dc:Bounds x="100" y="100" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_2_di" bpmnElement="GW_2"><dc:Bounds x="250" y="100" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_3_di" bpmnElement="GW_3"><dc:Bounds x="400" y="100" width="50" height="50" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('GW_1')!.shape).toBe(BPMN_EXCLUSIVE_GATEWAY)
    expect(graph.getCellById('GW_2')!.shape).toBe(BPMN_PARALLEL_GATEWAY)
    expect(graph.getCellById('GW_3')!.shape).toBe(BPMN_INCLUSIVE_GATEWAY)
    graph.dispose()
  })

  it('should import text annotations and associations', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="开始" />
    <bpmn:textAnnotation id="Ann_1">
      <bpmn:text>备注内容</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:association id="Assoc_1" sourceRef="Ann_1" targetRef="Start_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="200" y="120" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Ann_1_di" bpmnElement="Ann_1"><dc:Bounds x="100" y="50" width="120" height="40" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Assoc_1_di" bpmnElement="Assoc_1">
        <di:waypoint x="160" y="90" />
        <di:waypoint x="218" y="120" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('Ann_1')!.shape).toBe(BPMN_TEXT_ANNOTATION)
    expect(graph.getEdges().length).toBe(1)
    expect(graph.getEdges()[0].shape).toBe(BPMN_ASSOCIATION)
    graph.dispose()
  })

  it('should import data objects and stores', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:dataObjectReference id="Data_1" name="数据" />
    <bpmn:dataStoreReference id="Store_1" name="数据库" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Data_1_di" bpmnElement="Data_1"><dc:Bounds x="100" y="100" width="40" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Store_1_di" bpmnElement="Store_1"><dc:Bounds x="200" y="100" width="50" height="50" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('Data_1')!.shape).toBe(BPMN_DATA_OBJECT)
    expect(graph.getCellById('Store_1')!.shape).toBe(BPMN_DATA_STORE)
    graph.dispose()
  })

  it('should import default flows', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:exclusiveGateway id="GW_1" default="Flow_Def" />
    <bpmn:userTask id="T_1" />
    <bpmn:userTask id="T_2" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="GW_1" targetRef="T_1" />
    <bpmn:sequenceFlow id="Flow_Def" sourceRef="GW_1" targetRef="T_2" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="GW_1_di" bpmnElement="GW_1"><dc:Bounds x="100" y="100" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T_1_di" bpmnElement="T_1"><dc:Bounds x="250" y="50" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T_2_di" bpmnElement="T_2"><dc:Bounds x="250" y="150" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="150" y="125" /><di:waypoint x="250" y="80" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Def_di" bpmnElement="Flow_Def"><di:waypoint x="150" y="125" /><di:waypoint x="250" y="180" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    const defEdge = graph.getEdges().find((e) => e.id === 'Flow_Def')
    expect(defEdge!.shape).toBe(BPMN_DEFAULT_FLOW)
    graph.dispose()
  })

  it('should import conditional flows', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:exclusiveGateway id="GW_1" />
    <bpmn:userTask id="T_1" />
    <bpmn:sequenceFlow id="Flow_Cond" sourceRef="GW_1" targetRef="T_1">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">x &gt; 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="GW_1_di" bpmnElement="GW_1"><dc:Bounds x="100" y="100" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T_1_di" bpmnElement="T_1"><dc:Bounds x="250" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_Cond_di" bpmnElement="Flow_Cond"><di:waypoint x="150" y="125" /><di:waypoint x="250" y="130" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'Flow_Cond')!.shape).toBe(BPMN_CONDITIONAL_FLOW)
    graph.dispose()
  })

  it('should import directed associations', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:userTask id="T_1" />
    <bpmn:textAnnotation id="Ann_1"><bpmn:text>注释</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="Assoc_Dir" sourceRef="Ann_1" targetRef="T_1" associationDirection="One" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T_1_di" bpmnElement="T_1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Ann_1_di" bpmnElement="Ann_1"><dc:Bounds x="100" y="50" width="80" height="30" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Assoc_Dir_di" bpmnElement="Assoc_Dir"><di:waypoint x="140" y="80" /><di:waypoint x="200" y="130" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'Assoc_Dir')!.shape).toBe(BPMN_DIRECTED_ASSOCIATION)
    graph.dispose()
  })

  it('should handle XML without DI diagram', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('should handle XML without process', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(0)
    graph.dispose()
  })

  it('should import all task types correctly', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="T1" /><bpmn:userTask id="T2" /><bpmn:serviceTask id="T3" />
    <bpmn:scriptTask id="T4" /><bpmn:businessRuleTask id="T5" /><bpmn:sendTask id="T6" />
    <bpmn:receiveTask id="T7" /><bpmn:manualTask id="T8" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="100" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T2_di" bpmnElement="T2"><dc:Bounds x="100" y="200" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T3_di" bpmnElement="T3"><dc:Bounds x="100" y="300" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T4_di" bpmnElement="T4"><dc:Bounds x="100" y="400" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T5_di" bpmnElement="T5"><dc:Bounds x="300" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T6_di" bpmnElement="T6"><dc:Bounds x="300" y="200" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T7_di" bpmnElement="T7"><dc:Bounds x="300" y="300" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T8_di" bpmnElement="T8"><dc:Bounds x="300" y="400" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

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

  it('should import subprocess types', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:subProcess id="SP1" /><bpmn:subProcess id="SP2" triggeredByEvent="true" />
    <bpmn:transaction id="TX1" /><bpmn:adHocSubProcess id="AH1" /><bpmn:callActivity id="CA1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="SP1_di" bpmnElement="SP1"><dc:Bounds x="100" y="100" width="200" height="120" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SP2_di" bpmnElement="SP2"><dc:Bounds x="100" y="250" width="200" height="120" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="TX1_di" bpmnElement="TX1"><dc:Bounds x="350" y="100" width="200" height="120" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="AH1_di" bpmnElement="AH1"><dc:Bounds x="350" y="250" width="200" height="120" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="CA1_di" bpmnElement="CA1"><dc:Bounds x="100" y="400" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('SP1')!.shape).toBe(BPMN_SUB_PROCESS)
    expect(graph.getCellById('SP2')!.shape).toBe(BPMN_EVENT_SUB_PROCESS)
    expect(graph.getCellById('TX1')!.shape).toBe(BPMN_TRANSACTION)
    expect(graph.getCellById('AH1')!.shape).toBe(BPMN_AD_HOC_SUB_PROCESS)
    expect(graph.getCellById('CA1')!.shape).toBe(BPMN_CALL_ACTIVITY)
    graph.dispose()
  })

  it('should import message flows', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="参与者1" processRef="Process_1" />
    <bpmn:participant id="P2" name="参与者2" processRef="Process_2" />
    <bpmn:messageFlow id="MF_1" sourceRef="P1" targetRef="P2" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="P1_di" bpmnElement="P1" isHorizontal="true"><dc:Bounds x="40" y="40" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="P2_di" bpmnElement="P2" isHorizontal="true"><dc:Bounds x="40" y="300" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="MF_1_di" bpmnElement="MF_1"><di:waypoint x="240" y="240" /><di:waypoint x="240" y="300" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getEdges().find((e) => e.id === 'MF_1')!.shape).toBe(BPMN_MESSAGE_FLOW)
    graph.dispose()
  })

  it('should handle intermediate waypoints in edges', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="F1" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E1_di" bpmnElement="E1"><dc:Bounds x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1">
        <di:waypoint x="136" y="118" /><di:waypoint x="250" y="50" /><di:waypoint x="350" y="200" /><di:waypoint x="400" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    const edge = graph.getEdges()[0]
    const vertices = edge.getVertices()
    expect(vertices.length).toBe(2)
    expect(vertices[0].x).toBe(250)
    expect(vertices[0].y).toBe(50)
    graph.dispose()
  })

  it('should handle boundary events with attachedToRef', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="Task_1" name="任务" />
    <bpmn:boundaryEvent id="BE_1" attachedToRef="Task_1" cancelActivity="true">
      <bpmn:timerEventDefinition id="TED_1" />
    </bpmn:boundaryEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="BE_1_di" bpmnElement="BE_1"><dc:Bounds x="250" y="142" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    const boundary = graph.getCellById('BE_1')
    expect(boundary).toBeDefined()
    expect(boundary!.shape).toBe(BPMN_BOUNDARY_EVENT_TIMER)
    // Parent should be set to Task_1
    const parent = (boundary as any).getParent?.()
    expect(parent?.id).toBe('Task_1')
    graph.dispose()
  })

  it('should import conditional flows with conditionExpression', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="CF_1" sourceRef="S1" targetRef="E1">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">x &gt; 5</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E1_di" bpmnElement="E1"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="CF_1_di" bpmnElement="CF_1"><di:waypoint x="136" y="118" /><di:waypoint x="300" y="118" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    const edge = graph.getEdges().find(e => e.id === 'CF_1')
    expect(edge).toBeDefined()
    expect(edge!.shape).toBe(BPMN_CONDITIONAL_FLOW)
    graph.dispose()
  })

  it('should import message flows with intermediate waypoints', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="发送方" processRef="Process_1" />
    <bpmn:participant id="P2" name="接收方" processRef="Process_2" />
    <bpmn:messageFlow id="MF_1" name="消息" sourceRef="P1" targetRef="P2" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="P1_di" bpmnElement="P1" isHorizontal="true"><dc:Bounds x="40" y="40" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="P2_di" bpmnElement="P2" isHorizontal="true"><dc:Bounds x="40" y="300" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="MF_1_di" bpmnElement="MF_1">
        <di:waypoint x="200" y="240" /><di:waypoint x="200" y="270" /><di:waypoint x="250" y="270" /><di:waypoint x="250" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

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

  it('should import data associations inside tasks', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:dataObjectReference id="DataObj_1" name="数据" />
    <bpmn:task id="Task_1" name="处理任务">
      <bpmn:dataInputAssociation id="DIA_1">
        <bpmn:sourceRef>DataObj_1</bpmn:sourceRef>
        <bpmn:targetRef>Task_1</bpmn:targetRef>
      </bpmn:dataInputAssociation>
      <bpmn:dataOutputAssociation id="DOA_1">
        <bpmn:sourceRef>Task_1</bpmn:sourceRef>
        <bpmn:targetRef>DataObj_1</bpmn:targetRef>
      </bpmn:dataOutputAssociation>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="DataObj_1_di" bpmnElement="DataObj_1"><dc:Bounds x="100" y="100" width="40" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="200" y="90" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    // Should have 2 data association edges
    const dataAssocEdges = graph.getEdges().filter(e => e.shape === BPMN_DATA_ASSOCIATION)
    expect(dataAssocEdges.length).toBe(2)
    graph.dispose()
  })

  it('should apply zoomToFit by default', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    // Default options → zoomToFit = true → schedules setTimeout
    await importBpmnXml(graph, xml) // default zoomToFit: true
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('should handle XML without process (collaboration-only)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="参与者" />
  </bpmn:collaboration>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="P1_di" bpmnElement="P1" isHorizontal="true"><dc:Bounds x="40" y="40" width="400" height="200" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // Pool is imported, but no process → should return early
    expect(graph.getNodes().length).toBe(1)
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('should handle XML without BPMNDiagram (no DI)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
    <bpmn:endEvent id="E1" name="结束" />
    <bpmn:sequenceFlow id="F1" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(2)
    expect(graph.getEdges().length).toBe(1)
    graph.dispose()
  })

  it('should handle associations without direction', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="T1" name="任务" />
    <bpmn:textAnnotation id="TA1"><bpmn:text>备注</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="A1" sourceRef="T1" targetRef="TA1" />
    <bpmn:association id="A2" sourceRef="T1" targetRef="TA1" associationDirection="One" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="TA1_di" bpmnElement="TA1"><dc:Bounds x="200" y="200" width="100" height="30" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    const edges = graph.getEdges()
    expect(edges.length).toBe(2)
    const undirected = edges.find(e => e.id === 'A1')
    const directed = edges.find(e => e.id === 'A2')
    expect(undirected!.shape).toBe(BPMN_ASSOCIATION)
    expect(directed!.shape).toBe(BPMN_DIRECTED_ASSOCIATION)
    graph.dispose()
  })

  it('should handle data associations without id (skip them)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="T1" name="任务">
      <bpmn:dataInputAssociation>
        <bpmn:sourceRef>SomeRef</bpmn:sourceRef>
        <bpmn:targetRef>T1</bpmn:targetRef>
      </bpmn:dataInputAssociation>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // No id → skip data association
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('should handle data associations with missing sourceRef or targetRef', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="T1" name="任务">
      <bpmn:dataOutputAssociation id="DOA_bad">
        <bpmn:sourceRef>T1</bpmn:sourceRef>
      </bpmn:dataOutputAssociation>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // Missing targetRef → skip data association edge
    expect(graph.getEdges().length).toBe(0)
    graph.dispose()
  })

  it('should import BPMNDiagram without BPMNPlane', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // No plane → no DI info, but process elements still imported with defaults
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('should handle nodes without DI shape info (use defaults)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:exclusiveGateway id="GW1" name="判断" />
    <bpmn:dataObjectReference id="DO1" name="数据" />
    <bpmn:group id="G1" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3)
    // Gateway default size
    const gw = graph.getCellById('GW1')
    expect(gw).toBeDefined()
    // Data object default size
    const dataObj = graph.getCellById('DO1')
    expect(dataObj).toBeDefined()
    // Group default size
    const group = graph.getCellById('G1')
    expect(group).toBeDefined()
    graph.dispose()
  })

  it('should handle event with eventDefinition but attrs not matching', async () => {
    // This tests the resolveNodeShape branch where candidate has eventDefinition AND attrs but attrs don't match
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="SE1" name="消息开始">
      <bpmn:messageEventDefinition id="MED_1" />
    </bpmn:startEvent>
    <bpmn:endEvent id="EE1" name="消息结束">
      <bpmn:messageEventDefinition id="MED_2" />
    </bpmn:endEvent>
    <bpmn:intermediateThrowEvent id="ITE1" name="中间抛出">
      <bpmn:signalEventDefinition id="SED_1" />
    </bpmn:intermediateThrowEvent>
    <bpmn:intermediateCatchEvent id="ICE1" name="中间捕获">
      <bpmn:timerEventDefinition id="TED_1" />
    </bpmn:intermediateCatchEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="SE1_di" bpmnElement="SE1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EE1_di" bpmnElement="EE1"><dc:Bounds x="200" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ITE1_di" bpmnElement="ITE1"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ICE1_di" bpmnElement="ICE1"><dc:Bounds x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })

    expect(graph.getCellById('SE1')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph.getCellById('EE1')!.shape).toBe(BPMN_END_EVENT_MESSAGE)
    expect(graph.getCellById('ITE1')!.shape).toBe(BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL)
    expect(graph.getCellById('ICE1')!.shape).toBe(BPMN_INTERMEDIATE_CATCH_EVENT_TIMER)
    graph.dispose()
  })

  it('should handle unknown BPMN tags gracefully', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // Only known tags are processed
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('should import isHorizontal attribute on BPMNShape', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="参与者" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LS1">
      <bpmn:lane id="Lane_1" name="泳道1">
        <bpmn:flowNodeRef>T1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="T1" name="任务" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="P1_di" bpmnElement="P1" isHorizontal="true"><dc:Bounds x="40" y="40" width="600" height="300" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true"><dc:Bounds x="70" y="40" width="570" height="300" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds x="200" y="100" width="100" height="60" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(3) // Pool + Lane + Task
    graph.dispose()
  })

  it('should handle sequence flow with named label', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="F1" name="条件通过" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E1_di" bpmnElement="E1"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const edge = graph.getEdges()[0]
    const labels = edge.getLabels()
    expect(labels.length).toBe(1)
    expect(labels[0].attrs?.label?.text).toBe('条件通过')
    graph.dispose()
  })

  it('should throw on non-definitions root element', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><process id="P1" />`
    const graph = createTestGraph()
    await expect(importBpmnXml(graph, xml, { zoomToFit: false })).rejects.toThrow('root element must be <definitions>')
    graph.dispose()
  })

  it('should throw on malformed XML', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><broken><unclosed>`
    const graph = createTestGraph()
    await expect(importBpmnXml(graph, xml, { zoomToFit: false })).rejects.toThrow('Invalid BPMN XML')
    graph.dispose()
  })

  it('should handle clearGraph=false option', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_TASK, id: 'pre_existing', x: 50, y: 50, width: 100, height: 60 })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    await importBpmnXml(graph, xml, { clearGraph: false, zoomToFit: false })
    // pre_existing node should still be there, plus the imported one
    expect(graph.getNodes().length).toBe(2)
    expect(graph.getCellById('pre_existing')).toBeDefined()
    expect(graph.getCellById('S1')).toBeDefined()
    graph.dispose()
  })

  it('should handle BPMNShape with missing Bounds attributes (use fallbacks)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="T1" name="任务" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="T1_di" bpmnElement="T1"><dc:Bounds /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const node = graph.getCellById('T1')
    expect(node).toBeDefined()
    graph.dispose()
  })

  it('should handle participants without DI shapes (use defaults)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="参与者" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // Pool imported with default position/size, plus start event
    expect(graph.getNodes().length).toBe(2)
    graph.dispose()
  })

  it('should handle lanes without DI shapes (use defaults)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LS1">
      <bpmn:lane id="Lane_1" name="泳道">
        <bpmn:flowNodeRef>S1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(2) // Lane + start event
    graph.dispose()
  })

  it('should handle sequence flow without named label (no labels array)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="F1" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const edge = graph.getEdges()[0]
    expect(edge.getLabels().length).toBe(0)
    graph.dispose()
  })

  it('should handle edge with only 2 waypoints (no intermediate vertices)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="F1" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E1_di" bpmnElement="E1"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="136" y="118" /><di:waypoint x="300" y="118" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const edge = graph.getEdges()[0]
    expect(edge.getVertices().length).toBe(0) // Only 2 waypoints → no intermediate vertices
    graph.dispose()
  })

  it('should handle message flow without label', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="P1" name="A" processRef="Process_1" />
    <bpmn:participant id="P2" name="B" processRef="Process_2" />
    <bpmn:messageFlow id="MF_1" sourceRef="P1" targetRef="P2" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="P1_di" bpmnElement="P1"><dc:Bounds x="40" y="40" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="P2_di" bpmnElement="P2"><dc:Bounds x="40" y="300" width="400" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="MF_1_di" bpmnElement="MF_1"><di:waypoint x="200" y="240" /><di:waypoint x="200" y="300" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const mfEdge = graph.getEdges().find(e => e.id === 'MF_1')
    expect(mfEdge!.getLabels().length).toBe(0) // No name → no labels
    expect(mfEdge!.getVertices().length).toBe(0) // Only 2 waypoints → no vertices
    graph.dispose()
  })

  it('should handle text annotation with text child element', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:textAnnotation id="TA1"><bpmn:text>这是备注</bpmn:text></bpmn:textAnnotation>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="TA1_di" bpmnElement="TA1"><dc:Bounds x="100" y="100" width="100" height="30" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    const ta = graph.getCellById('TA1')
    expect(ta).toBeDefined()
    expect(ta!.shape).toBe(BPMN_TEXT_ANNOTATION)
    graph.dispose()
  })

  it('should handle BPMNShape without bpmnElement attribute', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // S1 won't match the DI shape (no bpmnElement), uses defaults
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('should handle waypoint with missing attributes (uses 0 fallback)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" />
    <bpmn:sequenceFlow id="F1" sourceRef="S1" targetRef="E1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="S1_di" bpmnElement="S1"><dc:Bounds x="100" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="E1_di" bpmnElement="E1"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint /><di:waypoint /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getEdges().length).toBe(1)
    graph.dispose()
  })

  it('should handle resolveNodeShape with event element having no matching event def', async () => {
    // An intermediateThrowEvent with an unknown/unregistered event definition
    // should fall back to the generic shape
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:intermediateThrowEvent id="ITE1" name="中间">
      <bpmn:unknownEventDefinition id="UED_1" />
    </bpmn:intermediateThrowEvent>
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    // Should fall back to generic intermediateThrowEvent shape
    const node = graph.getCellById('ITE1')
    expect(node).toBeDefined()
    expect(node!.shape).toBe(BPMN_INTERMEDIATE_THROW_EVENT)
    graph.dispose()
  })

  it('should import flowNodeRef with empty text content', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LS1">
      <bpmn:lane id="Lane_1" name="泳道">
        <bpmn:flowNodeRef></bpmn:flowNodeRef>
        <bpmn:flowNodeRef>S1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S1" name="开始" />
  </bpmn:process>
</bpmn:definitions>`

    const graph = createTestGraph()
    await importBpmnXml(graph, xml, { zoomToFit: false })
    expect(graph.getNodes().length).toBe(2)
    graph.dispose()
  })
})

// ============================================================================
// Exporter Additional Coverage Tests
// ============================================================================

describe('BPMN Export Additional Coverage', () => {
  it('should export boundary event with parent attachment', async () => {
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

  it('should export boundary event without parent (no attachedToRef)', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_BOUNDARY_EVENT, id: 'be_orphan', x: 100, y: 100, width: 36, height: 36, attrs: { label: { text: '' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:boundaryEvent')
    // No attachedToRef since no parent
    expect(xml).not.toContain('attachedToRef')
    graph.dispose()
  })

  it('should export edge with vertices as intermediate waypoints in DI', async () => {
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

  it('should handle conditional flow with no label (uses "condition" as default)', async () => {
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

  it('should handle group node export (not textAnnotation artifact)', async () => {
    const graph = createTestGraph()
    graph.addNode({ shape: BPMN_GROUP, id: 'grp1', x: 100, y: 100, width: 200, height: 150, attrs: { label: { text: '分组' } } })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('bpmn:group')
    // bpmn-moddle omits optional empty categoryValueRef
    graph.dispose()
  })

  it('should export node with data.label when attrs.label.text is empty', async () => {
    const graph = createTestGraph()
    const node = graph.addNode({ shape: BPMN_TASK, id: 'task_dl', x: 100, y: 100, width: 100, height: 60, attrs: { label: { text: '' } } })
    node.setData({ label: '来自数据' })

    const xml = await exportBpmnXml(graph)
    expect(xml).toContain('name="来自数据"')
    graph.dispose()
  })

  it('should skip nodes with unknown/unmapped shapes in export', async () => {
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

  it('should skip edges with unknown/unmapped shapes in export', async () => {
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
  it('should preserve node and edge counts after round-trip', async () => {
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
    await importBpmnXml(graph2, xml, { zoomToFit: false })

    expect(graph2.getNodes().length).toBe(3)
    expect(graph2.getEdges().length).toBe(2)

    graph1.dispose()
    graph2.dispose()
  })

  it('should preserve shape types after round-trip', async () => {
    const graph1 = createTestGraph()
    graph1.addNode({ shape: BPMN_START_EVENT_MESSAGE, id: 'SE', x: 100, y: 100, width: 36, height: 36 })
    graph1.addNode({ shape: BPMN_USER_TASK, id: 'UT', x: 200, y: 100, width: 100, height: 60 })
    graph1.addNode({ shape: BPMN_EXCLUSIVE_GATEWAY, id: 'GW', x: 350, y: 100, width: 50, height: 50 })
    graph1.addNode({ shape: BPMN_END_EVENT_TERMINATE, id: 'EE', x: 500, y: 100, width: 36, height: 36 })

    const xml = await exportBpmnXml(graph1)
    const graph2 = createTestGraph()
    await importBpmnXml(graph2, xml, { zoomToFit: false })

    expect(graph2.getCellById('SE')!.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(graph2.getCellById('UT')!.shape).toBe(BPMN_USER_TASK)
    expect(graph2.getCellById('GW')!.shape).toBe(BPMN_EXCLUSIVE_GATEWAY)
    expect(graph2.getCellById('EE')!.shape).toBe(BPMN_END_EVENT_TERMINATE)

    graph1.dispose()
    graph2.dispose()
  })

  it('should round-trip a complex process', async () => {
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
    await importBpmnXml(graph2, xml, { zoomToFit: false })

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

  it('should preserve all 16 edges in full demo process round-trip (员工请假审批)', async () => {
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
    await importBpmnXml(graph2, xml, { zoomToFit: false })

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

  it('should export and re-import XML with all sequence flow connections intact', async () => {
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
    await importBpmnXml(graph2, xml, { zoomToFit: false })

    // ALL 6 edges must survive
    expect(graph2.getEdges().length).toBe(6)

    // Verify edge shapes
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_SEQUENCE_FLOW).length).toBe(4)
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_CONDITIONAL_FLOW).length).toBe(1)
    expect(graph2.getEdges().filter((e) => e.shape === BPMN_DEFAULT_FLOW).length).toBe(1)

    // Second round-trip
    const xml2 = await exportBpmnXml(graph2)
    const graph3 = createTestGraph()
    await importBpmnXml(graph3, xml2, { zoomToFit: false })
    expect(graph3.getEdges().length).toBe(6)

    graph1.dispose()
    graph2.dispose()
    graph3.dispose()
  })
})
