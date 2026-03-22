/**
 * BPMN 2.0 映射表（Shape ↔ BPMN XML 标签）
 *
 * 定义 X6 图形名称与 BPMN 2.0 XML 元素的双向映射关系：
 * - NODE_MAPPING：节点图形 → BPMN 元素标签（含事件定义、属性）
 * - EDGE_MAPPING：连接线图形 → BPMN 边元素标签
 * - 辅助判断函数：isPoolShape、isLaneShape 等
 */

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
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
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
} from '../utils/constants'

// ============================================================================
// 节点图形 → BPMN 元素映射
// ============================================================================

/** 节点映射项接口 */
export interface BpmnNodeMapping {
  /** BPMN 元素标签名（不含命名空间），如 "startEvent"、"userTask" */
  tag: string
  /** 事件定义标签，如 "messageEventDefinition" */
  eventDefinition?: string
  /** BPMN 元素上的额外属性，如 parallelMultiple、cancelActivity */
  attrs?: Record<string, string>
}

/** X6 图形名称 → BPMN 2.0 节点元素信息映射表 */
export const NODE_MAPPING: Record<string, BpmnNodeMapping> = {
  // ---- 开始事件 ----
  [BPMN_START_EVENT]: { tag: 'startEvent' },
  [BPMN_START_EVENT_MESSAGE]: { tag: 'startEvent', eventDefinition: 'messageEventDefinition' },
  [BPMN_START_EVENT_TIMER]: { tag: 'startEvent', eventDefinition: 'timerEventDefinition' },
  [BPMN_START_EVENT_CONDITIONAL]: { tag: 'startEvent', eventDefinition: 'conditionalEventDefinition' },
  [BPMN_START_EVENT_SIGNAL]: { tag: 'startEvent', eventDefinition: 'signalEventDefinition' },
  [BPMN_START_EVENT_MULTIPLE]: { tag: 'startEvent', eventDefinition: 'multipleEventDefinition' },
  [BPMN_START_EVENT_PARALLEL_MULTIPLE]: { tag: 'startEvent', attrs: { parallelMultiple: 'true' }, eventDefinition: 'multipleEventDefinition' },

  // ---- 中间抛出事件 ----
  [BPMN_INTERMEDIATE_THROW_EVENT]: { tag: 'intermediateThrowEvent' },
  [BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE]: { tag: 'intermediateThrowEvent', eventDefinition: 'messageEventDefinition' },
  [BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION]: { tag: 'intermediateThrowEvent', eventDefinition: 'escalationEventDefinition' },
  [BPMN_INTERMEDIATE_THROW_EVENT_LINK]: { tag: 'intermediateThrowEvent', eventDefinition: 'linkEventDefinition' },
  [BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION]: { tag: 'intermediateThrowEvent', eventDefinition: 'compensateEventDefinition' },
  [BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL]: { tag: 'intermediateThrowEvent', eventDefinition: 'signalEventDefinition' },
  [BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE]: { tag: 'intermediateThrowEvent', eventDefinition: 'multipleEventDefinition' },

  // ---- 中间捕获事件 ----
  [BPMN_INTERMEDIATE_CATCH_EVENT]: { tag: 'intermediateCatchEvent' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE]: { tag: 'intermediateCatchEvent', eventDefinition: 'messageEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_TIMER]: { tag: 'intermediateCatchEvent', eventDefinition: 'timerEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION]: { tag: 'intermediateCatchEvent', eventDefinition: 'escalationEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL]: { tag: 'intermediateCatchEvent', eventDefinition: 'conditionalEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_LINK]: { tag: 'intermediateCatchEvent', eventDefinition: 'linkEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_ERROR]: { tag: 'intermediateCatchEvent', eventDefinition: 'errorEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL]: { tag: 'intermediateCatchEvent', eventDefinition: 'cancelEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION]: { tag: 'intermediateCatchEvent', eventDefinition: 'compensateEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL]: { tag: 'intermediateCatchEvent', eventDefinition: 'signalEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE]: { tag: 'intermediateCatchEvent', eventDefinition: 'multipleEventDefinition' },
  [BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE]: { tag: 'intermediateCatchEvent', attrs: { parallelMultiple: 'true' }, eventDefinition: 'multipleEventDefinition' },

  // ---- 边界事件 ----
  [BPMN_BOUNDARY_EVENT]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' } },
  [BPMN_BOUNDARY_EVENT_MESSAGE]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'messageEventDefinition' },
  [BPMN_BOUNDARY_EVENT_TIMER]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'timerEventDefinition' },
  [BPMN_BOUNDARY_EVENT_ESCALATION]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'escalationEventDefinition' },
  [BPMN_BOUNDARY_EVENT_CONDITIONAL]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'conditionalEventDefinition' },
  [BPMN_BOUNDARY_EVENT_ERROR]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'errorEventDefinition' },
  [BPMN_BOUNDARY_EVENT_CANCEL]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'cancelEventDefinition' },
  [BPMN_BOUNDARY_EVENT_COMPENSATION]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'compensateEventDefinition' },
  [BPMN_BOUNDARY_EVENT_SIGNAL]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'signalEventDefinition' },
  [BPMN_BOUNDARY_EVENT_MULTIPLE]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true' }, eventDefinition: 'multipleEventDefinition' },
  [BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'true', parallelMultiple: 'true' }, eventDefinition: 'multipleEventDefinition' },
  [BPMN_BOUNDARY_EVENT_NON_INTERRUPTING]: { tag: 'boundaryEvent', attrs: { cancelActivity: 'false' } },

  // ---- 结束事件 ----
  [BPMN_END_EVENT]: { tag: 'endEvent' },
  [BPMN_END_EVENT_MESSAGE]: { tag: 'endEvent', eventDefinition: 'messageEventDefinition' },
  [BPMN_END_EVENT_ESCALATION]: { tag: 'endEvent', eventDefinition: 'escalationEventDefinition' },
  [BPMN_END_EVENT_ERROR]: { tag: 'endEvent', eventDefinition: 'errorEventDefinition' },
  [BPMN_END_EVENT_CANCEL]: { tag: 'endEvent', eventDefinition: 'cancelEventDefinition' },
  [BPMN_END_EVENT_COMPENSATION]: { tag: 'endEvent', eventDefinition: 'compensateEventDefinition' },
  [BPMN_END_EVENT_SIGNAL]: { tag: 'endEvent', eventDefinition: 'signalEventDefinition' },
  [BPMN_END_EVENT_TERMINATE]: { tag: 'endEvent', eventDefinition: 'terminateEventDefinition' },
  [BPMN_END_EVENT_MULTIPLE]: { tag: 'endEvent', eventDefinition: 'multipleEventDefinition' },

  // ---- 任务 ----
  [BPMN_TASK]: { tag: 'task' },
  [BPMN_USER_TASK]: { tag: 'userTask' },
  [BPMN_SERVICE_TASK]: { tag: 'serviceTask' },
  [BPMN_SCRIPT_TASK]: { tag: 'scriptTask' },
  [BPMN_BUSINESS_RULE_TASK]: { tag: 'businessRuleTask' },
  [BPMN_SEND_TASK]: { tag: 'sendTask' },
  [BPMN_RECEIVE_TASK]: { tag: 'receiveTask' },
  [BPMN_MANUAL_TASK]: { tag: 'manualTask' },

  // ---- 子流程 ----
  [BPMN_SUB_PROCESS]: { tag: 'subProcess' },
  [BPMN_EVENT_SUB_PROCESS]: { tag: 'subProcess', attrs: { triggeredByEvent: 'true' } },
  [BPMN_TRANSACTION]: { tag: 'transaction' },
  [BPMN_AD_HOC_SUB_PROCESS]: { tag: 'adHocSubProcess' },
  [BPMN_CALL_ACTIVITY]: { tag: 'callActivity' },

  // ---- 网关 ----
  [BPMN_EXCLUSIVE_GATEWAY]: { tag: 'exclusiveGateway' },
  [BPMN_PARALLEL_GATEWAY]: { tag: 'parallelGateway' },
  [BPMN_INCLUSIVE_GATEWAY]: { tag: 'inclusiveGateway' },
  [BPMN_COMPLEX_GATEWAY]: { tag: 'complexGateway' },
  [BPMN_EVENT_BASED_GATEWAY]: { tag: 'eventBasedGateway' },
  [BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY]: { tag: 'eventBasedGateway', attrs: { eventGatewayType: 'Exclusive' } },

  // ---- 数据元素 ----
  [BPMN_DATA_OBJECT]: { tag: 'dataObjectReference' },
  [BPMN_DATA_INPUT]: { tag: 'dataObjectReference' },
  [BPMN_DATA_OUTPUT]: { tag: 'dataObjectReference' },
  [BPMN_DATA_STORE]: { tag: 'dataStoreReference' },

  // ---- 工件 ----
  [BPMN_TEXT_ANNOTATION]: { tag: 'textAnnotation' },
  [BPMN_GROUP]: { tag: 'group' },

  // ---- 泳道 ----
  [BPMN_POOL]: { tag: 'participant' },
  [BPMN_LANE]: { tag: 'lane' },
}

// ============================================================================
// 连接线图形 → BPMN 元素映射
// ============================================================================

/** 连接线映射项接口 */
export interface BpmnEdgeMapping {
  /** BPMN 元素标签名，如 "sequenceFlow" */
  tag: string
  /** 是否为消息流（属于 collaboration 而非 process） */
  isCollaboration?: boolean
  /** 是否为关联边（属于 process/artifacts） */
  isArtifact?: boolean
}

/** X6 边图形名称 → BPMN 2.0 连接线元素信息映射表 */
export const EDGE_MAPPING: Record<string, BpmnEdgeMapping> = {
  [BPMN_SEQUENCE_FLOW]: { tag: 'sequenceFlow' },
  [BPMN_CONDITIONAL_FLOW]: { tag: 'sequenceFlow' },
  [BPMN_DEFAULT_FLOW]: { tag: 'sequenceFlow' },
  [BPMN_MESSAGE_FLOW]: { tag: 'messageFlow', isCollaboration: true },
  [BPMN_ASSOCIATION]: { tag: 'association', isArtifact: true },
  [BPMN_DIRECTED_ASSOCIATION]: { tag: 'association', isArtifact: true },
  [BPMN_DATA_ASSOCIATION]: { tag: 'dataInputAssociation', isArtifact: true },
}

// ============================================================================
// 辅助判断函数
// ============================================================================

/** 判断图形是否为池 */
export function isPoolShape(shape: string): boolean {
  return shape === BPMN_POOL
}

/** 判断图形是否为泳道 */
export function isLaneShape(shape: string): boolean {
  return shape === BPMN_LANE
}

/** 判断图形是否为泳道元素（池或泳道） */
export function isSwimlaneShape(shape: string): boolean {
  return shape === BPMN_POOL || shape === BPMN_LANE
}

/** 判断图形是否为工件（文本注释或分组） */
export function isArtifactShape(shape: string): boolean {
  return shape === BPMN_TEXT_ANNOTATION || shape === BPMN_GROUP
}

/** 判断图形是否为边界事件 */
export function isBoundaryShape(shape: string): boolean {
  return shape.startsWith('bpmn-boundary-event')
}

/** 判断连接线是否为默认流 */
export function isDefaultFlow(shape: string): boolean {
  return shape === BPMN_DEFAULT_FLOW
}

/** 判断连接线是否为条件流 */
export function isConditionalFlow(shape: string): boolean {
  return shape === BPMN_CONDITIONAL_FLOW
}
