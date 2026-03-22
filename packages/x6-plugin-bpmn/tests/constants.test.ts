import { describe, it, expect } from 'vitest'
import {
  // Events
  BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL, BPMN_START_EVENT_MULTIPLE,
  BPMN_START_EVENT_PARALLEL_MULTIPLE,
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
  // Activities
  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
  // Gateways
  BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  // Data
  BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE,
  // Artifacts
  BPMN_TEXT_ANNOTATION, BPMN_GROUP,
  // Swimlanes
  BPMN_POOL, BPMN_LANE,
  // Connections
  BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION, BPMN_DATA_ASSOCIATION,
  // Colors
  BPMN_COLORS,
  // Icons
  BPMN_ICONS,
} from '../src/utils/constants'

import type {
  BpmnEventType, BpmnTaskType, BpmnGatewayType,
  BpmnMarkerType, BpmnFlowType, BpmnNodeData,
} from '../src/utils/constants'

// ============================================================================
// Constants — Shape names
// ============================================================================

describe('BPMN Shape Name Constants', () => {
  it('should define all Start Event shape names', () => {
    const startEvents = [
      BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
      BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
      BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
    ]
    expect(startEvents).toHaveLength(7)
    for (const name of startEvents) {
      expect(name).toMatch(/^bpmn-start-event/)
    }
  })

  it('should define all Intermediate Throw Event shape names', () => {
    const throwEvents = [
      BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, BPMN_INTERMEDIATE_THROW_EVENT_LINK,
      BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
    ]
    expect(throwEvents).toHaveLength(7)
    for (const name of throwEvents) {
      expect(name).toMatch(/^bpmn-intermediate-throw-event/)
    }
  })

  it('should define all Intermediate Catch Event shape names', () => {
    const catchEvents = [
      BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
      BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
      BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
      BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
    ]
    expect(catchEvents).toHaveLength(12)
    for (const name of catchEvents) {
      expect(name).toMatch(/^bpmn-intermediate-catch-event/)
    }
  })

  it('should define all Boundary Event shape names', () => {
    const boundaryEvents = [
      BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
      BPMN_BOUNDARY_EVENT_ESCALATION, BPMN_BOUNDARY_EVENT_CONDITIONAL,
      BPMN_BOUNDARY_EVENT_ERROR, BPMN_BOUNDARY_EVENT_CANCEL,
      BPMN_BOUNDARY_EVENT_COMPENSATION, BPMN_BOUNDARY_EVENT_SIGNAL,
      BPMN_BOUNDARY_EVENT_MULTIPLE, BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
      BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
    ]
    expect(boundaryEvents).toHaveLength(12)
    for (const name of boundaryEvents) {
      expect(name).toMatch(/^bpmn-boundary-event/)
    }
  })

  it('should define all End Event shape names', () => {
    const endEvents = [
      BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
      BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
      BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
    ]
    expect(endEvents).toHaveLength(9)
    for (const name of endEvents) {
      expect(name).toMatch(/^bpmn-end-event/)
    }
  })

  it('should define all Activity shape names (8 tasks + 5 sub-process types)', () => {
    const activities = [
      BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
      BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
      BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
      BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
    ]
    expect(activities).toHaveLength(13)
    for (const name of activities) {
      expect(name).toMatch(/^bpmn-/)
    }
  })

  it('should define all Gateway shape names', () => {
    const gateways = [
      BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
    ]
    expect(gateways).toHaveLength(6)
    for (const name of gateways) {
      expect(name).toMatch(/^bpmn-.*-gateway$/)
    }
  })

  it('should define all Data shape names', () => {
    const data = [BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE]
    expect(data).toHaveLength(4)
    for (const name of data) {
      expect(name).toMatch(/^bpmn-data-/)
    }
  })

  it('should define all Artifact shape names', () => {
    expect(BPMN_TEXT_ANNOTATION).toBe('bpmn-text-annotation')
    expect(BPMN_GROUP).toBe('bpmn-group')
  })

  it('should define all Swimlane shape names', () => {
    expect(BPMN_POOL).toBe('bpmn-pool')
    expect(BPMN_LANE).toBe('bpmn-lane')
  })

  it('should define all Connection shape names', () => {
    const connections = [
      BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
      BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
      BPMN_DATA_ASSOCIATION,
    ]
    expect(connections).toHaveLength(7)
    for (const name of connections) {
      expect(name).toMatch(/^bpmn-/)
    }
  })

  it('should have unique shape names (no duplicates)', () => {
    const allNames = [
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
      BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
      BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
      BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
      BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
      BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
      BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE,
      BPMN_TEXT_ANNOTATION, BPMN_GROUP,
      BPMN_POOL, BPMN_LANE,
      BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
      BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION, BPMN_DATA_ASSOCIATION,
    ]
    const uniqueNames = new Set(allNames)
    expect(uniqueNames.size).toBe(allNames.length)
  })
})

// ============================================================================
// Constants — BPMN Colors
// ============================================================================

describe('BPMN Colors', () => {
  it('should define event colors with stroke and fill', () => {
    expect(BPMN_COLORS.startEvent).toHaveProperty('stroke')
    expect(BPMN_COLORS.startEvent).toHaveProperty('fill')
    expect(BPMN_COLORS.intermediateEvent).toHaveProperty('stroke')
    expect(BPMN_COLORS.intermediateEvent).toHaveProperty('fill')
    expect(BPMN_COLORS.endEvent).toHaveProperty('stroke')
    expect(BPMN_COLORS.endEvent).toHaveProperty('fill')
    expect(BPMN_COLORS.boundaryEvent).toHaveProperty('stroke')
    expect(BPMN_COLORS.boundaryEvent).toHaveProperty('fill')
  })

  it('should use green for Start Events per BPMN convention', () => {
    expect(BPMN_COLORS.startEvent.stroke).toBe('#43a047')
  })

  it('should use blue for Intermediate Events per BPMN convention', () => {
    expect(BPMN_COLORS.intermediateEvent.stroke).toBe('#1e88e5')
  })

  it('should use red for End Events per BPMN convention', () => {
    expect(BPMN_COLORS.endEvent.stroke).toBe('#e53935')
  })

  it('should use orange for Boundary Events per BPMN convention', () => {
    expect(BPMN_COLORS.boundaryEvent.stroke).toBe('#fb8c00')
  })

  it('should define task colors with stroke, fill, and headerFill', () => {
    expect(BPMN_COLORS.task).toHaveProperty('stroke')
    expect(BPMN_COLORS.task).toHaveProperty('fill')
    expect(BPMN_COLORS.task).toHaveProperty('headerFill')
  })

  it('should define subProcess colors', () => {
    expect(BPMN_COLORS.subProcess).toHaveProperty('stroke')
    expect(BPMN_COLORS.subProcess).toHaveProperty('fill')
  })

  it('should define callActivity colors', () => {
    expect(BPMN_COLORS.callActivity).toHaveProperty('stroke')
    expect(BPMN_COLORS.callActivity).toHaveProperty('fill')
  })

  it('should define gateway colors (yellow)', () => {
    expect(BPMN_COLORS.gateway).toHaveProperty('stroke')
    expect(BPMN_COLORS.gateway).toHaveProperty('fill')
    expect(BPMN_COLORS.gateway.stroke).toBe('#f9a825')
  })

  it('should define data, annotation, and group colors', () => {
    expect(BPMN_COLORS.data).toHaveProperty('stroke')
    expect(BPMN_COLORS.data).toHaveProperty('fill')
    expect(BPMN_COLORS.annotation).toHaveProperty('stroke')
    expect(BPMN_COLORS.annotation).toHaveProperty('fill')
    expect(BPMN_COLORS.group).toHaveProperty('stroke')
    expect(BPMN_COLORS.group.fill).toBe('transparent')
  })

  it('should define pool and lane colors', () => {
    expect(BPMN_COLORS.pool).toHaveProperty('stroke')
    expect(BPMN_COLORS.pool).toHaveProperty('fill')
    expect(BPMN_COLORS.pool).toHaveProperty('headerFill')
    expect(BPMN_COLORS.lane).toHaveProperty('stroke')
    expect(BPMN_COLORS.lane).toHaveProperty('fill')
  })

  it('should define connection colors as strings', () => {
    expect(typeof BPMN_COLORS.sequenceFlow).toBe('string')
    expect(typeof BPMN_COLORS.messageFlow).toBe('string')
    expect(typeof BPMN_COLORS.association).toBe('string')
  })
})

// ============================================================================
// Constants — BPMN Icons
// ============================================================================

describe('BPMN Icons', () => {
  const allIconKeys = [
    'message', 'messageFilled', 'timer', 'signal', 'signalFilled',
    'error', 'escalation', 'escalationFilled', 'cancel', 'cancelFilled',
    'compensation', 'compensationFilled', 'terminate', 'link', 'conditional',
    'multiple', 'multipleFilled', 'parallelMultiple',
    'user', 'service', 'script', 'businessRule', 'send', 'receive', 'manual',
    'exclusiveX', 'parallelPlus', 'inclusiveO', 'complex', 'eventBased',
    'loopMarker', 'miParallel', 'miSequential', 'adHoc',
    'dataInput', 'dataOutput', 'collapse',
  ] as const

  it('should define all required icon SVG paths', () => {
    for (const key of allIconKeys) {
      expect(BPMN_ICONS).toHaveProperty(key)
      expect(typeof BPMN_ICONS[key]).toBe('string')
      expect(BPMN_ICONS[key].length).toBeGreaterThan(0)
    }
  })

  it('should use SVG path commands (M, L, A, C, Z)', () => {
    for (const key of allIconKeys) {
      // All SVG paths should start with M (moveto)
      expect(BPMN_ICONS[key]).toMatch(/^M\s/)
    }
  })

  it('should have 37 icon definitions for complete BPMN 2.0 coverage', () => {
    expect(allIconKeys).toHaveLength(37)
  })
})

// ============================================================================
// Constants — Types
// ============================================================================

describe('BPMN Types', () => {
  it('BpmnEventType should be a valid type union', () => {
    const eventTypes: BpmnEventType[] = [
      'none', 'message', 'timer', 'conditional', 'signal',
      'escalation', 'error', 'cancel', 'compensation', 'link',
      'terminate', 'multiple', 'parallelMultiple',
    ]
    expect(eventTypes).toHaveLength(13)
  })

  it('BpmnTaskType should be a valid type union', () => {
    const taskTypes: BpmnTaskType[] = [
      'task', 'user', 'service', 'script', 'businessRule',
      'send', 'receive', 'manual',
    ]
    expect(taskTypes).toHaveLength(8)
  })

  it('BpmnGatewayType should be a valid type union', () => {
    const gwTypes: BpmnGatewayType[] = [
      'exclusive', 'parallel', 'inclusive', 'complex',
      'eventBased', 'exclusiveEventBased',
    ]
    expect(gwTypes).toHaveLength(6)
  })

  it('BpmnMarkerType should be a valid type union', () => {
    const markerTypes: BpmnMarkerType[] = [
      'loop', 'miParallel', 'miSequential', 'compensation', 'adHoc',
    ]
    expect(markerTypes).toHaveLength(5)
  })

  it('BpmnFlowType should be a valid type union', () => {
    const flowTypes: BpmnFlowType[] = [
      'sequence', 'conditional', 'default', 'message',
      'association', 'directedAssociation', 'dataAssociation',
    ]
    expect(flowTypes).toHaveLength(7)
  })

  it('BpmnNodeData should accept all properties', () => {
    const data: BpmnNodeData = {
      bpmnType: 'start-event',
      eventType: 'message',
      taskType: 'user',
      gatewayType: 'exclusive',
      markers: ['loop', 'miParallel'],
      isInterrupting: true,
      label: 'Test Node',
    }
    expect(data.bpmnType).toBe('start-event')
    expect(data.eventType).toBe('message')
    expect(data.taskType).toBe('user')
    expect(data.gatewayType).toBe('exclusive')
    expect(data.markers).toHaveLength(2)
    expect(data.isInterrupting).toBe(true)
    expect(data.label).toBe('Test Node')
  })

  it('BpmnNodeData should allow optional properties', () => {
    const data: BpmnNodeData = { bpmnType: 'task' }
    expect(data.bpmnType).toBe('task')
    expect(data.eventType).toBeUndefined()
    expect(data.taskType).toBeUndefined()
    expect(data.gatewayType).toBeUndefined()
    expect(data.markers).toBeUndefined()
    expect(data.isInterrupting).toBeUndefined()
    expect(data.label).toBeUndefined()
  })
})
