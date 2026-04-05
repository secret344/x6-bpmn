/**
 * BPMN 2.0 常量定义
 *
 * 包含所有 BPMN 图形名称常量、颜色配置、SVG 图标路径和类型定义。
 */

// ============================================================================
// BPMN 2.0 图形名称常量
// ============================================================================

// ---------- 事件 ----------
export const BPMN_START_EVENT = 'bpmn-start-event'
export const BPMN_START_EVENT_MESSAGE = 'bpmn-start-event-message'
export const BPMN_START_EVENT_TIMER = 'bpmn-start-event-timer'
export const BPMN_START_EVENT_CONDITIONAL = 'bpmn-start-event-conditional'
export const BPMN_START_EVENT_SIGNAL = 'bpmn-start-event-signal'
export const BPMN_START_EVENT_MULTIPLE = 'bpmn-start-event-multiple'
export const BPMN_START_EVENT_PARALLEL_MULTIPLE = 'bpmn-start-event-parallel-multiple'

export const BPMN_INTERMEDIATE_THROW_EVENT = 'bpmn-intermediate-throw-event'
export const BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE = 'bpmn-intermediate-throw-event-message'
export const BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION = 'bpmn-intermediate-throw-event-escalation'
export const BPMN_INTERMEDIATE_THROW_EVENT_LINK = 'bpmn-intermediate-throw-event-link'
export const BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION = 'bpmn-intermediate-throw-event-compensation'
export const BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL = 'bpmn-intermediate-throw-event-signal'
export const BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE = 'bpmn-intermediate-throw-event-multiple'

export const BPMN_INTERMEDIATE_CATCH_EVENT = 'bpmn-intermediate-catch-event'
export const BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE = 'bpmn-intermediate-catch-event-message'
export const BPMN_INTERMEDIATE_CATCH_EVENT_TIMER = 'bpmn-intermediate-catch-event-timer'
export const BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION = 'bpmn-intermediate-catch-event-escalation'
export const BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL = 'bpmn-intermediate-catch-event-conditional'
export const BPMN_INTERMEDIATE_CATCH_EVENT_LINK = 'bpmn-intermediate-catch-event-link'
export const BPMN_INTERMEDIATE_CATCH_EVENT_ERROR = 'bpmn-intermediate-catch-event-error'
export const BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL = 'bpmn-intermediate-catch-event-cancel'
export const BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION = 'bpmn-intermediate-catch-event-compensation'
export const BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL = 'bpmn-intermediate-catch-event-signal'
export const BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE = 'bpmn-intermediate-catch-event-multiple'
export const BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE = 'bpmn-intermediate-catch-event-parallel-multiple'

export const BPMN_BOUNDARY_EVENT = 'bpmn-boundary-event'
export const BPMN_BOUNDARY_EVENT_MESSAGE = 'bpmn-boundary-event-message'
export const BPMN_BOUNDARY_EVENT_TIMER = 'bpmn-boundary-event-timer'
export const BPMN_BOUNDARY_EVENT_ESCALATION = 'bpmn-boundary-event-escalation'
export const BPMN_BOUNDARY_EVENT_CONDITIONAL = 'bpmn-boundary-event-conditional'
export const BPMN_BOUNDARY_EVENT_ERROR = 'bpmn-boundary-event-error'
export const BPMN_BOUNDARY_EVENT_CANCEL = 'bpmn-boundary-event-cancel'
export const BPMN_BOUNDARY_EVENT_COMPENSATION = 'bpmn-boundary-event-compensation'
export const BPMN_BOUNDARY_EVENT_SIGNAL = 'bpmn-boundary-event-signal'
export const BPMN_BOUNDARY_EVENT_MULTIPLE = 'bpmn-boundary-event-multiple'
export const BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE = 'bpmn-boundary-event-parallel-multiple'
export const BPMN_BOUNDARY_EVENT_NON_INTERRUPTING = 'bpmn-boundary-event-non-interrupting'
// 非中断按类型变体（cancelActivity=false，虚线圆）
export const BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING = 'bpmn-boundary-event-message-non-interrupting'
export const BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING = 'bpmn-boundary-event-timer-non-interrupting'
export const BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING = 'bpmn-boundary-event-escalation-non-interrupting'
export const BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING = 'bpmn-boundary-event-conditional-non-interrupting'
export const BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING = 'bpmn-boundary-event-signal-non-interrupting'
export const BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING = 'bpmn-boundary-event-multiple-non-interrupting'
export const BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING = 'bpmn-boundary-event-parallel-multiple-non-interrupting'

export const BPMN_END_EVENT = 'bpmn-end-event'
export const BPMN_END_EVENT_MESSAGE = 'bpmn-end-event-message'
export const BPMN_END_EVENT_ESCALATION = 'bpmn-end-event-escalation'
export const BPMN_END_EVENT_ERROR = 'bpmn-end-event-error'
export const BPMN_END_EVENT_CANCEL = 'bpmn-end-event-cancel'
export const BPMN_END_EVENT_COMPENSATION = 'bpmn-end-event-compensation'
export const BPMN_END_EVENT_SIGNAL = 'bpmn-end-event-signal'
export const BPMN_END_EVENT_TERMINATE = 'bpmn-end-event-terminate'
export const BPMN_END_EVENT_MULTIPLE = 'bpmn-end-event-multiple'

// ---------- 活动（任务、子流程、调用活动） ----------
export const BPMN_TASK = 'bpmn-task'
export const BPMN_USER_TASK = 'bpmn-user-task'
export const BPMN_SERVICE_TASK = 'bpmn-service-task'
export const BPMN_SCRIPT_TASK = 'bpmn-script-task'
export const BPMN_BUSINESS_RULE_TASK = 'bpmn-business-rule-task'
export const BPMN_SEND_TASK = 'bpmn-send-task'
export const BPMN_RECEIVE_TASK = 'bpmn-receive-task'
export const BPMN_MANUAL_TASK = 'bpmn-manual-task'
export const BPMN_SUB_PROCESS = 'bpmn-sub-process'
export const BPMN_EVENT_SUB_PROCESS = 'bpmn-event-sub-process'
export const BPMN_TRANSACTION = 'bpmn-transaction'
export const BPMN_AD_HOC_SUB_PROCESS = 'bpmn-ad-hoc-sub-process'
export const BPMN_CALL_ACTIVITY = 'bpmn-call-activity'

// ---------- 网关 ----------
export const BPMN_EXCLUSIVE_GATEWAY = 'bpmn-exclusive-gateway'
export const BPMN_PARALLEL_GATEWAY = 'bpmn-parallel-gateway'
export const BPMN_INCLUSIVE_GATEWAY = 'bpmn-inclusive-gateway'
export const BPMN_COMPLEX_GATEWAY = 'bpmn-complex-gateway'
export const BPMN_EVENT_BASED_GATEWAY = 'bpmn-event-based-gateway'
export const BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY = 'bpmn-exclusive-event-based-gateway'
// 并行事件网关（eventGatewayType=Parallel, instantiate=true）
export const BPMN_PARALLEL_EVENT_BASED_GATEWAY = 'bpmn-parallel-event-based-gateway'

// ---------- 数据元素 ----------
export const BPMN_DATA_OBJECT = 'bpmn-data-object'
export const BPMN_DATA_INPUT = 'bpmn-data-input'
export const BPMN_DATA_OUTPUT = 'bpmn-data-output'
export const BPMN_DATA_STORE = 'bpmn-data-store'

// ---------- 工件 ----------
export const BPMN_TEXT_ANNOTATION = 'bpmn-text-annotation'
export const BPMN_GROUP = 'bpmn-group'

// ---------- 泳道 ----------
export const BPMN_POOL = 'bpmn-pool'
export const BPMN_LANE = 'bpmn-lane'

// ---------- 连接线 ----------
export const BPMN_SEQUENCE_FLOW = 'bpmn-sequence-flow'
export const BPMN_CONDITIONAL_FLOW = 'bpmn-conditional-flow'
export const BPMN_DEFAULT_FLOW = 'bpmn-default-flow'
export const BPMN_MESSAGE_FLOW = 'bpmn-message-flow'
export const BPMN_ASSOCIATION = 'bpmn-association'
export const BPMN_DIRECTED_ASSOCIATION = 'bpmn-directed-association'
export const BPMN_DATA_ASSOCIATION = 'bpmn-data-association'

// ============================================================================
// BPMN 颜色配置
// ============================================================================

/** 各类 BPMN 元素的默认颜色（描边、填充） */
export const BPMN_COLORS = {
  // 事件颜色
  startEvent: { stroke: '#43a047', fill: '#e8f5e9' },       // 绿色
  intermediateEvent: { stroke: '#1e88e5', fill: '#e3f2fd' }, // 蓝色
  endEvent: { stroke: '#e53935', fill: '#ffebee' },          // 红色
  boundaryEvent: { stroke: '#fb8c00', fill: '#fff3e0' },     // 橙色

  // 活动颜色
  task: { stroke: '#1565c0', fill: '#bbdefb', headerFill: '#42a5f5' },
  subProcess: { stroke: '#1565c0', fill: '#e3f2fd' },
  callActivity: { stroke: '#1565c0', fill: '#bbdefb' },

  // 网关颜色
  gateway: { stroke: '#f9a825', fill: '#fffde7' },  // 黄色

  // 数据元素颜色
  data: { stroke: '#616161', fill: '#fafafa' },

  // 工件颜色
  annotation: { stroke: '#9e9e9e', fill: '#ffffff' },
  group: { stroke: '#9e9e9e', fill: 'transparent' },

  // 泳道颜色
  pool: { stroke: '#424242', fill: '#fafafa', headerFill: '#e0e0e0' },
  lane: { stroke: '#bdbdbd', fill: '#ffffff' },

  // 连接线颜色
  sequenceFlow: '#424242',
  messageFlow: '#1565c0',
  association: '#9e9e9e',
}

// ============================================================================
// BPMN 图标 SVG 路径（viewBox: 0 0 20 20）
// ============================================================================

/** 各类 BPMN 元素内部使用的 SVG 图标路径 */
export const BPMN_ICONS = {
  // 消息（信封）
  message: 'M 2 4 L 10 10 L 18 4 M 2 4 L 2 16 L 18 16 L 18 4 L 2 4 Z',
  messageFilled: 'M 2 4 L 10 10 L 18 4 L 18 16 L 2 16 Z',

  // 定时器（时钟）
  timer: 'M 10 2 A 8 8 0 1 0 10 18 A 8 8 0 1 0 10 2 Z M 10 4 L 10 10 L 14 13',

  // 信号（三角形）
  signal: 'M 10 2 L 18 17 L 2 17 Z',
  // 信号（实心三角形）
  signalFilled: 'M 10 2 L 18 17 L 2 17 Z',

  // 错误（闪电）
  error: 'M 3 16 L 8 2 L 12 10 L 17 4 L 12 18 L 8 10 Z',

  // 升级（向上箭头）
  escalation: 'M 10 2 L 15 18 L 10 11 L 5 18 Z',
  escalationFilled: 'M 10 2 L 15 18 L 10 11 L 5 18 Z',

  // 取消（X 十字）
  cancel: 'M 4 4 L 10 10 M 16 4 L 10 10 M 10 10 L 16 16 M 10 10 L 4 16',
  cancelFilled: 'M 3 5 L 5 3 L 10 8 L 15 3 L 17 5 L 12 10 L 17 15 L 15 17 L 10 12 L 5 17 L 3 15 L 8 10 Z',

  // 补偿（双三角指向左）
  compensation: 'M 10 4 L 2 10 L 10 16 Z M 18 4 L 10 10 L 18 16 Z',
  compensationFilled: 'M 10 4 L 2 10 L 10 16 Z M 18 4 L 10 10 L 18 16 Z',

  // 终止（实心圆）
  terminate: 'M 10 3 A 7 7 0 1 0 10 17 A 7 7 0 1 0 10 3 Z',

  // 链接（右箭头）
  link: 'M 3 7 L 12 7 L 12 3 L 19 10 L 12 17 L 12 13 L 3 13 Z',

  // 条件（菱形）
  conditional: 'M 10 2 L 18 10 L 10 18 L 2 10 Z',

  // 多重（五边形）
  multiple: 'M 10 2 L 18 8 L 15 17 L 5 17 L 2 8 Z',
  // 多重（实心五边形）
  multipleFilled: 'M 10 2 L 18 8 L 15 17 L 5 17 L 2 8 Z',

  // 并行多重（⇕号）
  parallelMultiple: 'M 8 2 L 12 2 L 12 8 L 18 8 L 18 12 L 12 12 L 12 18 L 8 18 L 8 12 L 2 12 L 2 8 L 8 8 Z',

  // 用户（人形剪影）
  user: 'M 10 2 A 4 4 0 1 0 10 10 A 4 4 0 1 0 10 2 Z M 3 18 C 3 13 7 11 10 11 C 13 11 17 13 17 18 Z',

  // 服务（齿轮）
  service: 'M 9 1 L 11 1 L 12 3 L 14 4 L 16 3 L 17.5 4.5 L 16 7 L 17 9 L 19 9 L 19 11 L 17 12 L 16 14 L 17.5 15.5 L 16 17 L 14 16 L 12 17 L 11 19 L 9 19 L 8 17 L 6 16 L 4 17 L 2.5 15.5 L 4 14 L 3 12 L 1 11 L 1 9 L 3 8 L 4 6 L 2.5 4.5 L 4 3 L 6 4 L 8 3 Z M 10 7 A 3 3 0 1 0 10 13 A 3 3 0 1 0 10 7 Z',

  // 脚本（卷轴）
  script: 'M 5 2 C 3 2 3 5 5 5 L 15 5 C 17 5 17 2 15 2 Z M 5 5 L 5 15 C 3 15 3 18 5 18 L 15 18 C 17 18 17 15 15 15 L 15 5 M 7 8 L 13 8 M 7 11 L 13 11 M 7 14 L 11 14',

  // 业务规则（表格）
  businessRule: 'M 2 3 L 18 3 L 18 17 L 2 17 Z M 2 7 L 18 7 M 2 11 L 18 11 M 7 7 L 7 17',

  // 发送（实心信封）
  send: 'M 2 5 L 10 11 L 18 5 L 18 15 L 2 15 Z',

  // 接收（空心信封）
  receive: 'M 2 4 L 18 4 L 18 16 L 2 16 Z M 2 4 L 10 10 L 18 4',

  // 手工（手形）
  manual: 'M 2 10 C 2 6 6 3 8 6 L 8 3 C 8 2 10 2 10 3 L 10 6 L 11 3 C 11 2 13 2 13 3 L 13 6 L 14 4 C 14 3 16 3 16 4 L 16 10 C 16 14 13 17 10 17 L 5 17 C 3 17 2 14 2 12 Z',

  // 网关内部标记符号
  exclusiveX: 'M 5 5 L 15 15 M 15 5 L 5 15',
  parallelPlus: 'M 10 3 L 10 17 M 3 10 L 17 10',
  inclusiveO: 'M 10 4 A 6 6 0 1 0 10 16 A 6 6 0 1 0 10 4 Z',
  complex: 'M 10 3 L 10 17 M 3 10 L 17 10 M 5 5 L 15 15 M 15 5 L 5 15',
  eventBased: 'M 10 4 A 6 6 0 1 0 10 16 A 6 6 0 1 0 10 4 Z M 10 6 L 14.5 13 L 5.5 13 Z',

  // 活动标记符号（循环、多实例、自由等）
  loopMarker: 'M 14 10 A 4 4 0 1 0 10 14 M 10 14 L 10 11 M 10 14 L 13 14',
  miParallel: 'M 6 4 L 6 16 M 10 4 L 10 16 M 14 4 L 14 16',
  miSequential: 'M 4 6 L 16 6 M 4 10 L 16 10 M 4 14 L 16 14',
  adHoc: 'M 3 10 C 5 6 8 6 10 10 C 12 14 15 14 17 10',

  // 数据元素标记
  dataInput: 'M 7 4 L 7 16 M 4 10 L 10 10 M 7 7 L 4 10 L 7 13',
  dataOutput: 'M 7 4 L 7 16 M 4 10 L 10 10 M 7 7 L 10 10 L 7 13',

  // 子流程折叠标记
  collapse: 'M 4 4 L 16 4 L 16 16 L 4 16 Z M 10 7 L 10 13 M 7 10 L 13 10',
}

// ============================================================================
// 类型定义
// ============================================================================

/** BPMN 事件类型 */
export type BpmnEventType = 'none' | 'message' | 'timer' | 'conditional' | 'signal' |
  'escalation' | 'error' | 'cancel' | 'compensation' | 'link' |
  'terminate' | 'multiple' | 'parallelMultiple'

/** BPMN 任务类型 */
export type BpmnTaskType = 'task' | 'user' | 'service' | 'script' | 'businessRule' |
  'send' | 'receive' | 'manual'

/** BPMN 网关类型 */
export type BpmnGatewayType = 'exclusive' | 'parallel' | 'inclusive' | 'complex' |
  'eventBased' | 'exclusiveEventBased'

/** BPMN 活动标记类型（循环、多实例、补偿、自由） */
export type BpmnMarkerType = 'loop' | 'miParallel' | 'miSequential' | 'compensation' | 'adHoc'

/** BPMN 连接线类型 */
export type BpmnFlowType = 'sequence' | 'conditional' | 'default' | 'message' |
  'association' | 'directedAssociation' | 'dataAssociation'

/** BPMN 节点数据接口 */
export interface BpmnNodeData {
  bpmnType: string
  eventType?: BpmnEventType
  taskType?: BpmnTaskType
  gatewayType?: BpmnGatewayType
  markers?: BpmnMarkerType[]
  isInterrupting?: boolean
  label?: string
}
