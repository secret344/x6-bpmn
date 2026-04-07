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

  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,

  BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,

  BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  BPMN_PARALLEL_EVENT_BASED_GATEWAY,

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
  | 'gateway'          // 网关（排他、包容、复杂）
  | 'parallelGateway'  // 并行网关（只允许普通顺序流）
  | 'eventBasedGateway' // 基于事件的网关（不允许条件流/默认流）
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
  // 按类型区分的非中断边界事件变体
  [BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING]: 'boundaryEvent',
  [BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING]: 'boundaryEvent',

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

  // 网关（排他、包容、复杂）
  [BPMN_EXCLUSIVE_GATEWAY]: 'gateway',
  [BPMN_INCLUSIVE_GATEWAY]: 'gateway',
  [BPMN_COMPLEX_GATEWAY]: 'gateway',
  // 并行网关（独立分类：不允许条件流/默认流）
  [BPMN_PARALLEL_GATEWAY]: 'parallelGateway',
  // 基于事件的网关（独立分类：不允许条件流/默认流，出线只能到捕获事件或接收任务）
  [BPMN_EVENT_BASED_GATEWAY]: 'eventBasedGateway',
  [BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY]: 'eventBasedGateway',
  [BPMN_PARALLEL_EVENT_BASED_GATEWAY]: 'eventBasedGateway',

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
  /** 失败类型，未提供时默认视为规则校验失败 */
  kind?: 'exception'
}

/**
 * 连线验证所需的上下文信息。
 *
 * 该上下文既可用于纯规则校验，也可用于带运行时语义的动态校验。
 */
export interface BpmnConnectionContext {
  /** 源节点的 shape 名称 */
  sourceShape: string
  /** 目标节点的 shape 名称 */
  targetShape: string
  /** 连线（边）的 shape 名称 */
  edgeShape: string
  /** 源节点当前已有的出线数量（可选，用于数量限制校验） */
  sourceOutgoingCount?: number
  /** 目标节点当前已有的入线数量（可选，用于数量限制校验） */
  targetIncomingCount?: number
  /** 源节点当前已有的顺序流系列出线数量（可选，用于语义约束） */
  sourceOutgoingSequenceFlowCount?: number
  /** 目标节点当前已有的顺序流系列入线数量（可选，用于语义约束） */
  targetIncomingSequenceFlowCount?: number
  /** 源节点持久化数据（通常来自 node.getData()） */
  sourceData?: Record<string, unknown>
  /** 目标节点持久化数据（通常来自 node.getData()） */
  targetData?: Record<string, unknown>
  /**
   * 源节点所在 Pool 的唯一标识（可选）。
   * 提供后将在顺序流 / 消息流验证时检查池边界约束。
   */
  sourcePoolId?: string
  /**
   * 目标节点所在 Pool 的唯一标识（可选）。
   * 提供后将在顺序流 / 消息流验证时检查池边界约束。
   */
  targetPoolId?: string
}

/** 带节点分类信息的动态规则上下文 */
export interface BpmnRuleValidationContext extends BpmnConnectionContext {
  /** 源节点分类 */
  sourceCategory: BpmnNodeCategory
  /** 目标节点分类 */
  targetCategory: BpmnNodeCategory
}

/** 节点数据匹配条件 */
export interface BpmnConnectionDataCondition {
  /** 节点数据路径，如 bpmn.triggeredByEvent */
  path: string
  /** 期望值 */
  equals: unknown
}

/** 声明式连线约束匹配器 */
export interface BpmnConnectionConstraintMatcher {
  /** 约束适用的连线类型 */
  edgeShapes?: string[]
  /** 约束适用的源节点分类 */
  sourceCategories?: BpmnNodeCategory[]
  /** 约束适用的目标节点分类 */
  targetCategories?: BpmnNodeCategory[]
  /** 约束适用的源节点图形 */
  sourceShapes?: string[]
  /** 约束适用的目标节点图形 */
  targetShapes?: string[]
  /** 源节点数据匹配条件 */
  sourceDataMatches?: BpmnConnectionDataCondition[]
  /** 目标节点数据匹配条件 */
  targetDataMatches?: BpmnConnectionDataCondition[]
}

/** 声明式连线约束要求 */
export interface BpmnConnectionConstraintRequirement {
  /** 目标节点图形白名单 */
  allowedTargetShapes?: string[]
  /** 源节点至少已有的顺序流出线数量 */
  minSourceOutgoingSequenceFlowCount?: number
  /** 目标节点最多允许已有的顺序流入线数量 */
  maxTargetIncomingSequenceFlowCount?: number
}

/** 声明式连线约束 */
export interface BpmnConnectionConstraint {
  /** 何时启用该约束；未命中则跳过 */
  when?: BpmnConnectionConstraintMatcher
  /** 命中即拒绝的条件 */
  forbid?: BpmnConnectionConstraintMatcher
  /** 命中后必须满足的要求 */
  require?: BpmnConnectionConstraintRequirement
  /** 约束失败提示 */
  reason: string
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
  /** 需要结合运行时上下文进一步验证的声明式约束 */
  constraints?: BpmnConnectionConstraint[]
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

/** 顺序流系列类型集合 */
const EVENT_BASED_GATEWAY_TARGET_SHAPES = [
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE,
  BPMN_RECEIVE_TASK,
]

const EVENT_SUB_PROCESS_SEQUENCE_FLOW_CONSTRAINTS: BpmnConnectionConstraint[] = [
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: { sourceShapes: [BPMN_EVENT_SUB_PROCESS] },
    reason: '事件子流程不能作为顺序流源节点（formal-11-01-03 §10.2.5 / §13.4.4）',
  },
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: {
      sourceDataMatches: [{ path: 'bpmn.triggeredByEvent', equals: true }],
    },
    reason: '事件子流程不能作为顺序流源节点（formal-11-01-03 §10.2.5 / §13.4.4）',
  },
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: { targetShapes: [BPMN_EVENT_SUB_PROCESS] },
    reason: '事件子流程不能作为顺序流目标节点（formal-11-01-03 §10.2.5 / §13.4.4）',
  },
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: {
      targetDataMatches: [{ path: 'bpmn.triggeredByEvent', equals: true }],
    },
    reason: '事件子流程不能作为顺序流目标节点（formal-11-01-03 §10.2.5 / §13.4.4）',
  },
]

const CONDITIONAL_FLOW_SOURCE_CONSTRAINTS: BpmnConnectionConstraint[] = [
  {
    when: {
      edgeShapes: [BPMN_CONDITIONAL_FLOW],
      sourceCategories: ['task', 'subProcess'],
    },
    require: {
      minSourceOutgoingSequenceFlowCount: 1,
    },
    reason: '活动或子流程的条件顺序流至少还需要另一条出向顺序流（formal-11-01-03 §8.3.13）',
  },
]

const INSTANTIATE_TARGET_CONSTRAINTS: BpmnConnectionConstraint[] = [
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: {
      targetShapes: [BPMN_RECEIVE_TASK],
      targetDataMatches: [{ path: 'bpmn.instantiate', equals: true }],
    },
    reason: '用于实例化流程的接收任务不能有入向顺序流（formal-11-01-03 §10.2.3）',
  },
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: {
      targetShapes: [BPMN_PARALLEL_EVENT_BASED_GATEWAY],
    },
    reason: '用于实例化流程的事件网关不能有入向顺序流（formal-11-01-03 §10.5.6）',
  },
  {
    when: { edgeShapes: SEQUENCE_FLOW_TYPES },
    forbid: {
      targetShapes: [BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY],
      targetDataMatches: [{ path: 'bpmn.instantiate', equals: true }],
    },
    reason: '用于实例化流程的事件网关不能有入向顺序流（formal-11-01-03 §10.5.6）',
  },
]

const EVENT_BASED_GATEWAY_CONSTRAINTS: BpmnConnectionConstraint[] = [
  {
    when: {
      edgeShapes: SEQUENCE_FLOW_TYPES,
      sourceCategories: ['eventBasedGateway'],
    },
    require: {
      allowedTargetShapes: EVENT_BASED_GATEWAY_TARGET_SHAPES,
    },
    reason: '事件网关后继只能是接收任务或指定的中间捕获事件（formal-11-01-03 §10.5.6）',
  },
  {
    when: {
      edgeShapes: SEQUENCE_FLOW_TYPES,
      sourceCategories: ['eventBasedGateway'],
    },
    require: {
      maxTargetIncomingSequenceFlowCount: 0,
    },
    reason: '事件网关配置目标不能再有其他入向顺序流（formal-11-01-03 §10.5.6）',
  },
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
  'parallelGateway',
  'eventBasedGateway',
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
  // 入线：仅允许关联线，不允许流程流入线
  // 出线：顺序流系列与关联线，目标为流程节点（不含开始事件自身和边界事件）
  startEvent: {
    allowedIncoming: ASSOCIATION_TYPES,
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
  // 入线：仅允许关联线，不允许流程流入线（它依附于活动）
  boundaryEvent: {
    allowedIncoming: ASSOCIATION_TYPES,
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 结束事件 ==========
  // 出线：仅允许关联线，不允许流程流出线（它是流程的终点）
  endEvent: {
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    allowedOutgoing: ASSOCIATION_TYPES,
    forbiddenSources: ['endEvent', 'dataElement', 'swimlane'],
  },

  // ========== 任务 ==========
  // 入线出线均为顺序流系列，也可通过数据关联连接数据元素
  task: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'swimlane'],
    constraints: [...CONDITIONAL_FLOW_SOURCE_CONSTRAINTS, ...INSTANTIATE_TARGET_CONSTRAINTS],
  },

  // ========== 子流程 ==========
  // 与任务类似，可嵌套包含内部流程
  subProcess: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...DATA_FLOW_TYPES, BPMN_MESSAGE_FLOW],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'swimlane'],
    constraints: [...EVENT_SUB_PROCESS_SEQUENCE_FLOW_CONSTRAINTS, ...CONDITIONAL_FLOW_SOURCE_CONSTRAINTS],
  },

  // ========== 网关 ==========
  // 排他、包容、复杂网关：允许条件流和默认流
  gateway: {
    allowedOutgoing: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 并行网关 ==========
  // 并行网关：所有出线均无条件激活，不允许条件流和默认流（formal-11-01-03 §10.5.4）
  parallelGateway: {
    allowedOutgoing: [BPMN_SEQUENCE_FLOW, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    forbiddenTargets: ['startEvent', 'boundaryEvent', 'dataElement', 'swimlane'],
  },

  // ========== 基于事件的网关 ==========
  // 出线不得有 conditionExpression；出线目标必须是中间捕获事件或接收任务（formal-11-01-03 §10.5.6）
  eventBasedGateway: {
    allowedOutgoing: [BPMN_SEQUENCE_FLOW, ...ASSOCIATION_TYPES],
    allowedIncoming: [...SEQUENCE_FLOW_TYPES, ...ASSOCIATION_TYPES],
    // 出线只能到中间捕获事件或任务（接收任务）
    allowedTargets: ['intermediateCatchEvent', 'task'],
    constraints: [...EVENT_BASED_GATEWAY_CONSTRAINTS, ...INSTANTIATE_TARGET_CONSTRAINTS],
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
