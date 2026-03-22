/**
 * BPMN 2.0 连线规则定义
 *
 * 基于 BPMN 2.0 规范定义节点分类、连线规则数据结构及默认规则表。
 * 规则覆盖以下约束：
 * - 节点可用的出线 / 入线类型
 * - 节点最大出线 / 入线数量
 * - 基于连线类型的合法目标 / 源分类
 * - 特殊规则（如结束事件不可有出线、开始事件不可有入线）
 */

import {
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
  BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../utils/constants'

// ============================================================================
// 节点分类
// ============================================================================

/**
 * BPMN 节点分类枚举
 *
 * 将 74 种节点归纳为 10 个大类，用于连线规则匹配。
 */
export type BpmnNodeCategory =
  | 'startEvent'       // 开始事件
  | 'intermediateThrowEvent' // 中间抛出事件
  | 'intermediateCatchEvent' // 中间捕获事件
  | 'boundaryEvent'    // 边界事件
  | 'endEvent'         // 结束事件
  | 'task'             // 任务（所有类型）
  | 'subProcess'       // 子流程（含事务、临时子流程等）
  | 'gateway'          // 网关
  | 'dataElement'      // 数据元素（数据对象、数据存储等）
  | 'artifact'         // 工件（文本注释、分组）
  | 'swimlane'         // 泳道（池、泳道）
  | 'unknown'          // 未知类型

// ============================================================================
// 图形名称 → 分类映射表
// ============================================================================

/** 图形 shape 名称到节点分类的映射 */
const SHAPE_CATEGORY_MAP: Record<string, BpmnNodeCategory> = {
  // 开始事件
  [BPMN_START_EVENT]: 'startEvent',
  [BPMN_START_EVENT_MESSAGE]: 'startEvent',
  [BPMN_START_EVENT_TIMER]: 'startEvent',
  [BPMN_START_EVENT_CONDITIONAL]: 'startEvent',
  [BPMN_START_EVENT_SIGNAL]: 'startEvent',
  [BPMN_START_EVENT_MULTIPLE]: 'startEvent',
  [BPMN_START_EVENT_PARALLEL_MULTIPLE]: 'startEvent',

  // 中间抛出事件
  [BPMN_INTERMEDIATE_THROW_EVENT]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_LINK]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL]: 'intermediateThrowEvent',
  [BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE]: 'intermediateThrowEvent',

  // 中间捕获事件
  [BPMN_INTERMEDIATE_CATCH_EVENT]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_TIMER]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_LINK]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_ERROR]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE]: 'intermediateCatchEvent',
  [BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE]: 'intermediateCatchEvent',

  // 边界事件
  [BPMN_BOUNDARY_EVENT]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_MESSAGE]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_TIMER]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_ESCALATION]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_CONDITIONAL]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_ERROR]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_CANCEL]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_COMPENSATION]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_SIGNAL]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_MULTIPLE]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_NON_INTERRUPTING]: 'boundaryEvent',

  // 结束事件
  [BPMN_END_EVENT]: 'endEvent',
  [BPMN_END_EVENT_MESSAGE]: 'endEvent',
  [BPMN_END_EVENT_ESCALATION]: 'endEvent',
  [BPMN_END_EVENT_ERROR]: 'endEvent',
  [BPMN_END_EVENT_CANCEL]: 'endEvent',
  [BPMN_END_EVENT_COMPENSATION]: 'endEvent',
  [BPMN_END_EVENT_SIGNAL]: 'endEvent',
  [BPMN_END_EVENT_TERMINATE]: 'endEvent',
  [BPMN_END_EVENT_MULTIPLE]: 'endEvent',

  // 任务
  [BPMN_TASK]: 'task',
  [BPMN_USER_TASK]: 'task',
  [BPMN_SERVICE_TASK]: 'task',
  [BPMN_SCRIPT_TASK]: 'task',
  [BPMN_BUSINESS_RULE_TASK]: 'task',
  [BPMN_SEND_TASK]: 'task',
  [BPMN_RECEIVE_TASK]: 'task',
  [BPMN_MANUAL_TASK]: 'task',

  // 子流程
  [BPMN_SUB_PROCESS]: 'subProcess',
  [BPMN_EVENT_SUB_PROCESS]: 'subProcess',
  [BPMN_TRANSACTION]: 'subProcess',
  [BPMN_AD_HOC_SUB_PROCESS]: 'subProcess',
  [BPMN_CALL_ACTIVITY]: 'subProcess',

  // 网关
  [BPMN_EXCLUSIVE_GATEWAY]: 'gateway',
  [BPMN_PARALLEL_GATEWAY]: 'gateway',
  [BPMN_INCLUSIVE_GATEWAY]: 'gateway',
  [BPMN_COMPLEX_GATEWAY]: 'gateway',
  [BPMN_EVENT_BASED_GATEWAY]: 'gateway',
  [BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY]: 'gateway',

  // 数据元素
  [BPMN_DATA_OBJECT]: 'dataElement',
  [BPMN_DATA_INPUT]: 'dataElement',
  [BPMN_DATA_OUTPUT]: 'dataElement',
  [BPMN_DATA_STORE]: 'dataElement',

  // 工件
  [BPMN_TEXT_ANNOTATION]: 'artifact',
  [BPMN_GROUP]: 'artifact',

  // 泳道
  [BPMN_POOL]: 'swimlane',
  [BPMN_LANE]: 'swimlane',
}

/**
 * 根据图形 shape 名称获取节点分类。
 * @param shape X6 节点的 shape 名称
 * @returns 对应的 BpmnNodeCategory
 */
export function getNodeCategory(shape: string): BpmnNodeCategory {
  return SHAPE_CATEGORY_MAP[shape] ?? 'unknown'
}

// ============================================================================
// 连线规则数据结构
// ============================================================================

/**
 * 单条连线规则的验证结果
 */
export interface BpmnValidationResult {
  /** 是否通过验证 */
  valid: boolean
  /** 验证失败时的原因描述 */
  reason?: string
}

/**
 * BPMN 连线规则定义
 *
 * 每个节点分类对应一组规则，声明该分类节点可作为源/目标时的约束。
 */
export interface BpmnConnectionRule {
  /** 允许的出线（作为源）的连线类型，为空表示不限制 */
  allowedOutgoing?: string[]
  /** 允许的入线（作为目标）的连线类型，为空表示不限制 */
  allowedIncoming?: string[]
  /** 最大出线数量，undefined 表示不限制 */
  maxOutgoing?: number
  /** 最大入线数量，undefined 表示不限制 */
  maxIncoming?: number
  /** 作为源时，允许连接的目标分类列表，为空表示不限制 */
  allowedTargets?: BpmnNodeCategory[]
  /** 作为源时，禁止连接的目标分类列表 */
  forbiddenTargets?: BpmnNodeCategory[]
  /** 作为目标时，允许的源分类列表，为空表示不限制 */
  allowedSources?: BpmnNodeCategory[]
  /** 作为目标时，禁止的源分类列表 */
  forbiddenSources?: BpmnNodeCategory[]
  /** 是否禁止所有出线 */
  noOutgoing?: boolean
  /** 是否禁止所有入线 */
  noIncoming?: boolean
}

// ============================================================================
// 顺序流连线类型集合（顺序流、条件流、默认流）
// ============================================================================

/** 顺序流系列的连线类型（可在同一池内使用的流） */
const SEQUENCE_FLOW_TYPES = [
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
]

/** 所有连线类型（不含关联） */
const ALL_FLOW_TYPES = [
  ...SEQUENCE_FLOW_TYPES,
  BPMN_MESSAGE_FLOW,
]

/** 关联类连线类型 */
const ASSOCIATION_TYPES = [
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
]

/** 数据关联类连线 */
const DATA_FLOW_TYPES = [
  BPMN_DATA_ASSOCIATION,
  ...ASSOCIATION_TYPES,
]

/** 流程节点分类集合（可通过顺序流连接的节点） */
const FLOW_NODE_CATEGORIES: BpmnNodeCategory[] = [
  'startEvent',
  'intermediateThrowEvent',
  'intermediateCatchEvent',
  'boundaryEvent',
  'endEvent',
  'task',
  'subProcess',
  'gateway',
]

// ============================================================================
// 默认 BPMN 2.0 连线规则
// ============================================================================

/**
 * BPMN 2.0 规范默认连线规则
 *
 * 基于 BPMN 2.0 规范中的连接规则定义，核心规则如下：
 *
 * 1. 顺序流只能连接同一流程（池）内的流程节点
 * 2. 消息流只能跨池连接
 * 3. 关联可以连接任意元素
 * 4. 开始事件不能有入线（顺序流/消息流）
 * 5. 结束事件不能有出线（顺序流）
 * 6. 边界事件只能有出线
 * 7. 数据元素通过数据关联和关联连接
 * 8. 网关至少有一条入线和一条出线
 * 9. 泳道和工件不参与顺序流/消息流
 */
export const DEFAULT_CONNECTION_RULES: Record<BpmnNodeCategory, BpmnConnectionRule> = {
  // ========== 开始事件 ==========
  // 不可有入线（它是流程的起点）
  // 出线：顺序流系列，目标为流程节点（不含开始事件自身和边界事件）
  startEvent: {
    noIncoming: true,
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 中间抛出事件 ==========
  // 入线出线均为顺序流系列
  intermediateThrowEvent: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 中间捕获事件 ==========
  intermediateCatchEvent: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 边界事件 ==========
  // 只能有出线，不可有入线（它依附于活动）
  boundaryEvent: {
    noIncoming: true,
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 结束事件 ==========
  // 不可有出线（它是流程的终点）
  endEvent: {
    noOutgoing: true,
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenSources: ['endEvent', 'dataElement', 'swimlane'],
  },

  // ========== 任务 ==========
  // 入线出线均为顺序流系列，也可通过数据关联连接数据元素
  task: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'swimlane'],
  },

  // ========== 子流程 ==========
  // 与任务类似，可嵌套包含内部流程
  subProcess: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'swimlane'],
  },

  // ========== 网关 ==========
  // 入线出线为顺序流系列（含条件流、默认流）
  gateway: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 数据元素 ==========
  // 通过数据关联/关联连接到活动或流程节点
  dataElement: {
    allowedOutgoing: DATA_FLOW_TYPES,
    allowedIncoming: DATA_FLOW_TYPES,
    allowedTargets: ['task', 'subProcess', 'artifact', 'dataElement'],
    allowedSources: ['task', 'subProcess', 'artifact', 'dataElement'],
  },

  // ========== 工件 ==========
  // 只能通过关联连接
  artifact: {
    allowedOutgoing: ASSOCIATION_TYPES,
    allowedIncoming: [...ASSOCIATION_TYPES, ...DATA_FLOW_TYPES],
  },

  // ========== 泳道 ==========
  // 泳道本身不参与连线（内部元素负责连接）
  // 仅允许消息流（跨池）和关联
  swimlane: {
    allowedOutgoing: [BPMN_MESSAGE_FLOW, ...ASSOCIATION_TYPES],
    allowedIncoming: [BPMN_MESSAGE_FLOW, ...ASSOCIATION_TYPES],
    allowedTargets: ['swimlane'],
    allowedSources: ['swimlane'],
  },

  // ========== 未知 ==========
  // 不限制，允许任意连接（兜底）
  unknown: {},
}
