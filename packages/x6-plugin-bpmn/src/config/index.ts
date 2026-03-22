/**
 * BPMN 配置工具模块
 *
 * 提供图形中文标签、分类、表单数据管理等通用功能，
 * 可在任何消费项目中复用。
 */

import type { Cell, Node, Edge } from '@antv/x6'

// ============================================================================
// 图形名称 → 中文标签映射
// ============================================================================

/** 所有 BPMN 图形的中文显示名称 */
export const SHAPE_LABELS: Record<string, string> = {
  'bpmn-start-event': '开始事件', 'bpmn-start-event-message': '消息开始事件',
  'bpmn-start-event-timer': '定时开始事件', 'bpmn-start-event-conditional': '条件开始事件',
  'bpmn-start-event-signal': '信号开始事件', 'bpmn-start-event-multiple': '多重开始事件',
  'bpmn-start-event-parallel-multiple': '并行多重开始事件',
  'bpmn-intermediate-throw-event': '中间抛出事件', 'bpmn-intermediate-throw-event-message': '消息中间抛出事件',
  'bpmn-intermediate-throw-event-escalation': '升级中间抛出事件', 'bpmn-intermediate-throw-event-link': '链接中间抛出事件',
  'bpmn-intermediate-throw-event-compensation': '补偿中间抛出事件', 'bpmn-intermediate-throw-event-signal': '信号中间抛出事件',
  'bpmn-intermediate-throw-event-multiple': '多重中间抛出事件',
  'bpmn-intermediate-catch-event': '中间捕获事件', 'bpmn-intermediate-catch-event-message': '消息中间捕获事件',
  'bpmn-intermediate-catch-event-timer': '定时中间捕获事件', 'bpmn-intermediate-catch-event-escalation': '升级中间捕获事件',
  'bpmn-intermediate-catch-event-conditional': '条件中间捕获事件', 'bpmn-intermediate-catch-event-link': '链接中间捕获事件',
  'bpmn-intermediate-catch-event-error': '错误中间捕获事件', 'bpmn-intermediate-catch-event-cancel': '取消中间捕获事件',
  'bpmn-intermediate-catch-event-compensation': '补偿中间捕获事件', 'bpmn-intermediate-catch-event-signal': '信号中间捕获事件',
  'bpmn-intermediate-catch-event-multiple': '多重中间捕获事件', 'bpmn-intermediate-catch-event-parallel-multiple': '并行多重中间捕获事件',
  'bpmn-boundary-event': '边界事件', 'bpmn-boundary-event-message': '消息边界事件',
  'bpmn-boundary-event-timer': '定时边界事件', 'bpmn-boundary-event-escalation': '升级边界事件',
  'bpmn-boundary-event-conditional': '条件边界事件', 'bpmn-boundary-event-error': '错误边界事件',
  'bpmn-boundary-event-cancel': '取消边界事件', 'bpmn-boundary-event-compensation': '补偿边界事件',
  'bpmn-boundary-event-signal': '信号边界事件', 'bpmn-boundary-event-multiple': '多重边界事件',
  'bpmn-boundary-event-parallel-multiple': '并行多重边界事件', 'bpmn-boundary-event-non-interrupting': '非中断边界事件',
  'bpmn-end-event': '结束事件', 'bpmn-end-event-message': '消息结束事件',
  'bpmn-end-event-escalation': '升级结束事件', 'bpmn-end-event-error': '错误结束事件',
  'bpmn-end-event-cancel': '取消结束事件', 'bpmn-end-event-compensation': '补偿结束事件',
  'bpmn-end-event-signal': '信号结束事件', 'bpmn-end-event-terminate': '终止结束事件',
  'bpmn-end-event-multiple': '多重结束事件',
  'bpmn-task': '任务', 'bpmn-user-task': '用户任务', 'bpmn-service-task': '服务任务',
  'bpmn-script-task': '脚本任务', 'bpmn-business-rule-task': '业务规则任务',
  'bpmn-send-task': '发送任务', 'bpmn-receive-task': '接收任务', 'bpmn-manual-task': '手工任务',
  'bpmn-sub-process': '子流程', 'bpmn-event-sub-process': '事件子流程',
  'bpmn-transaction': '事务', 'bpmn-ad-hoc-sub-process': '自由子流程', 'bpmn-call-activity': '调用活动',
  'bpmn-exclusive-gateway': '排他网关', 'bpmn-parallel-gateway': '并行网关',
  'bpmn-inclusive-gateway': '包容网关', 'bpmn-complex-gateway': '复杂网关',
  'bpmn-event-based-gateway': '事件网关', 'bpmn-exclusive-event-based-gateway': '排他事件网关',
  'bpmn-data-object': '数据对象', 'bpmn-data-input': '数据输入',
  'bpmn-data-output': '数据输出', 'bpmn-data-store': '数据存储',
  'bpmn-text-annotation': '文本注释', 'bpmn-group': '分组',
  'bpmn-pool': '池', 'bpmn-lane': '泳道',
  'bpmn-sequence-flow': '顺序流', 'bpmn-conditional-flow': '条件流', 'bpmn-default-flow': '默认流',
  'bpmn-message-flow': '消息流', 'bpmn-association': '关联',
  'bpmn-directed-association': '定向关联', 'bpmn-data-association': '数据关联',
}

/**
 * 注册自定义图形的显示标签。
 * 配合 NODE_MAPPING 注册时使用。
 */
export function registerShapeLabel(shape: string, label: string) {
  SHAPE_LABELS[shape] = label
}

/** 获取图形的显示标签，未注册时返回图形名称本身 */
export function getShapeLabel(shape: string): string {
  return SHAPE_LABELS[shape] || shape
}

// ============================================================================
// 图形分类
// ============================================================================

/** 图形类别柚举，用于表单字段展示和数据保存逻辑 */
export type ShapeCategory =
  | 'userTask' | 'serviceTask' | 'scriptTask' | 'businessRuleTask'
  | 'sendTask' | 'receiveTask' | 'task' | 'manualTask' | 'callActivity'
  | 'subProcess' | 'gateway'
  | 'timerEvent' | 'messageEvent' | 'signalEvent' | 'errorEvent'
  | 'escalationEvent' | 'conditionalEvent' | 'linkEvent' | 'compensationEvent'
  | 'cancelEvent' | 'terminateEvent' | 'multipleEvent' | 'noneEvent'
  | 'sequenceFlow' | 'messageFlow' | 'association'
  | 'dataObject' | 'dataStore' | 'pool' | 'lane' | 'textAnnotation' | 'group'
  | 'unknown'

/** 自定义图形 → 类别映射（覆盖默认规则） */
const customCategoryMap: Record<string, ShapeCategory> = {}

/**
 * 注册自定义图形的分类。
 * 注册后 classifyShape() 将返回正确的类别。
 *
 * @example
 * registerShapeCategory('approval-node', 'userTask')
 */
export function registerShapeCategory(shape: string, category: ShapeCategory) {
  customCategoryMap[shape] = category
}

/**
 * 根据图形名称判断其 BPMN 元素类别。
 * 自定义注册的类别优先于内置规则。
 */
export function classifyShape(s: string): ShapeCategory {
  // Custom overrides first
  if (customCategoryMap[s]) return customCategoryMap[s]

  // Activities
  if (s === 'bpmn-user-task') return 'userTask'
  if (s === 'bpmn-service-task') return 'serviceTask'
  if (s === 'bpmn-script-task') return 'scriptTask'
  if (s === 'bpmn-business-rule-task') return 'businessRuleTask'
  if (s === 'bpmn-send-task') return 'sendTask'
  if (s === 'bpmn-receive-task') return 'receiveTask'
  if (s === 'bpmn-manual-task') return 'manualTask'
  if (s === 'bpmn-task') return 'task'
  if (s === 'bpmn-call-activity') return 'callActivity'
  if (s === 'bpmn-sub-process' || s === 'bpmn-event-sub-process' || s === 'bpmn-transaction' || s === 'bpmn-ad-hoc-sub-process') return 'subProcess'
  // Gateways
  if (s.includes('gateway')) return 'gateway'
  // Events — by event definition type
  if (s.includes('-timer')) return 'timerEvent'
  if (s.includes('-message')) return 'messageEvent'
  if (s.includes('-signal')) return 'signalEvent'
  if (s.includes('-error')) return 'errorEvent'
  if (s.includes('-escalation')) return 'escalationEvent'
  if (s.includes('-conditional')) return 'conditionalEvent'
  if (s.includes('-link')) return 'linkEvent'
  if (s.includes('-compensation')) return 'compensationEvent'
  if (s.includes('-cancel')) return 'cancelEvent'
  if (s.includes('-terminate')) return 'terminateEvent'
  if (s.includes('-multiple') || s.includes('-parallel-multiple')) return 'multipleEvent'
  if (s.includes('event')) return 'noneEvent'
  // Connections
  if (s === 'bpmn-sequence-flow' || s === 'bpmn-conditional-flow' || s === 'bpmn-default-flow') return 'sequenceFlow'
  if (s === 'bpmn-message-flow') return 'messageFlow'
  if (s === 'bpmn-association' || s === 'bpmn-directed-association' || s === 'bpmn-data-association') return 'association'
  // Data
  if (s === 'bpmn-data-object' || s === 'bpmn-data-input' || s === 'bpmn-data-output') return 'dataObject'
  if (s === 'bpmn-data-store') return 'dataStore'
  // Artifacts
  if (s === 'bpmn-text-annotation') return 'textAnnotation'
  if (s === 'bpmn-group') return 'group'
  // Swimlanes
  if (s === 'bpmn-pool') return 'pool'
  if (s === 'bpmn-lane') return 'lane'
  return 'unknown'
}

// ============================================================================
// BPMN 表单数据接口（所有 BPMN 元素类型的标准字段）
// ============================================================================

/** BPMN 元素的表单数据接口，包含所有可配置属性 */
export interface BpmnFormData {
  // User Task
  assignee: string; candidateUsers: string; candidateGroups: string
  formKey: string; dueDate: string; priority: string
  // Service / Business Rule / Send / Receive Task
  implementationType: string; implementation: string; resultVariable: string
  isAsync: boolean
  // Script Task
  scriptFormat: string; script: string
  // Call Activity
  calledElement: string
  // Sub-process
  triggeredByEvent: boolean
  // Gateway
  defaultFlow: string; activationCondition: string
  // Timer event
  timerType: string; timerValue: string
  // Message event, send/receive task, message flow
  messageRef: string; messageName: string
  // Signal event
  signalRef: string; signalName: string
  // Error event
  errorRef: string; errorCode: string
  // Escalation event
  escalationRef: string; escalationCode: string
  // Conditional event & sequence flow
  conditionExpression: string
  // Link event
  linkName: string
  // Compensation event
  activityRef: string
  // Boundary event
  cancelActivity: boolean
  // Data object
  isCollection: boolean
  // Pool
  processRef: string
  // Text annotation
  annotationText: string
  // Group
  categoryValueRef: string
  // Custom extension fields — consumers can add arbitrary keys
  [key: string]: any
}

/** 创建一个空的 BpmnFormData（所有字段使用默认值） */
export function emptyBpmnFormData(): BpmnFormData {
  return {
    assignee: '', candidateUsers: '', candidateGroups: '',
    formKey: '', dueDate: '', priority: '',
    implementationType: '', implementation: '', resultVariable: '',
    isAsync: false,
    scriptFormat: '', script: '',
    calledElement: '',
    triggeredByEvent: false,
    defaultFlow: '', activationCondition: '',
    timerType: 'timeDuration', timerValue: '',
    messageRef: '', messageName: '',
    signalRef: '', signalName: '',
    errorRef: '', errorCode: '',
    escalationRef: '', escalationCode: '',
    conditionExpression: '',
    linkName: '',
    activityRef: '',
    cancelActivity: true,
    isCollection: false,
    processRef: '',
    annotationText: '',
    categoryValueRef: '',
  }
}

// ============================================================================
// 单元格标签辅助函数
// ============================================================================

/** 从多个可能的属性路径中读取单元格的显示标签 */
export function getCellLabel(cell: Cell): string {
  const data = cell.getData() || {}
  if (data.label) return data.label
  const attrLabel = cell.getAttrByPath('label/text') as string | undefined
  if (attrLabel) return attrLabel
  const headerLabel = cell.getAttrByPath('headerLabel/text') as string | undefined
  if (headerLabel) return headerLabel
  if (cell.isEdge()) {
    const labels = (cell as Edge).getLabels()
    if (labels.length > 0) {
      return (labels[0].attrs?.label?.text ?? labels[0].attrs?.text?.text ?? '') as string
    }
  }
  return ''
}

// ============================================================================
// 加载 / 保存 BPMN 数据（cell.getData().bpmn）
// ============================================================================

/**
 * 从单元格的持久化数据中加载 BPMN 表单数据。
 * 返回填充完整的 BpmnFormData，可直接绑定到表单输入。
 */
export function loadBpmnFormData(cell: Cell): BpmnFormData {
  const data = cell.getData() || {}
  const bpmn = data.bpmn || {}
  const s = cell.shape
  const form = emptyBpmnFormData()

  // Copy all known keys from bpmn
  form.assignee = bpmn.assignee || ''
  form.candidateUsers = bpmn.candidateUsers || ''
  form.candidateGroups = bpmn.candidateGroups || ''
  form.formKey = bpmn.formKey || ''
  form.dueDate = bpmn.dueDate || ''
  form.priority = bpmn.priority || ''
  form.implementationType = bpmn.implementationType || ''
  form.implementation = bpmn.implementation || ''
  form.resultVariable = bpmn.resultVariable || ''
  form.isAsync = bpmn.isAsync || false
  form.scriptFormat = bpmn.scriptFormat || ''
  form.script = bpmn.script || ''
  form.calledElement = bpmn.calledElement || ''
  form.triggeredByEvent = s === 'bpmn-event-sub-process'
  form.defaultFlow = bpmn.defaultFlow || ''
  form.activationCondition = bpmn.activationCondition || ''
  form.timerType = bpmn.timerType || 'timeDuration'
  form.timerValue = bpmn.timerValue || ''
  form.messageRef = bpmn.messageRef || ''
  form.messageName = bpmn.messageName || ''
  form.signalRef = bpmn.signalRef || ''
  form.signalName = bpmn.signalName || ''
  form.errorRef = bpmn.errorRef || ''
  form.errorCode = bpmn.errorCode || ''
  form.escalationRef = bpmn.escalationRef || ''
  form.escalationCode = bpmn.escalationCode || ''
  form.conditionExpression = bpmn.conditionExpression || ''
  form.linkName = bpmn.linkName || ''
  form.activityRef = bpmn.activityRef || ''
  form.cancelActivity = bpmn.cancelActivity !== false
  form.isCollection = bpmn.isCollection || false
  form.processRef = bpmn.processRef || ''
  form.annotationText = bpmn.annotationText || getCellLabel(cell)
  form.categoryValueRef = bpmn.categoryValueRef || ''

  // Copy any custom extension keys
  for (const key of Object.keys(bpmn)) {
    if (!(key in form)) {
      form[key] = bpmn[key]
    }
  }

  return form
}

/**
 * 构建要持久化到 cell.getData().bpmn 的数据对象。
 * 仅包含与当前类别相关的字段，避免存储无用数据。
 */
export function saveBpmnFormData(category: ShapeCategory, form: BpmnFormData, shapeName?: string): Record<string, any> {
  const bpmn: Record<string, any> = {}
  const isBoundary = shapeName ? shapeName.includes('boundary') : false
  const isEventSub = shapeName === 'bpmn-event-sub-process'

  if (category === 'userTask') {
    if (form.assignee) bpmn.assignee = form.assignee
    if (form.candidateUsers) bpmn.candidateUsers = form.candidateUsers
    if (form.candidateGroups) bpmn.candidateGroups = form.candidateGroups
    if (form.formKey) bpmn.formKey = form.formKey
    if (form.dueDate) bpmn.dueDate = form.dueDate
    if (form.priority) bpmn.priority = form.priority
  }
  if (category === 'serviceTask' || category === 'businessRuleTask' || category === 'sendTask' || category === 'receiveTask') {
    if (form.implementationType) bpmn.implementationType = form.implementationType
    if (form.implementation) bpmn.implementation = form.implementation
    if (form.resultVariable) bpmn.resultVariable = form.resultVariable
    bpmn.isAsync = form.isAsync
  }
  if (category === 'scriptTask') {
    if (form.scriptFormat) bpmn.scriptFormat = form.scriptFormat
    if (form.script) bpmn.script = form.script
    if (form.resultVariable) bpmn.resultVariable = form.resultVariable
  }
  if (category === 'callActivity') {
    if (form.calledElement) bpmn.calledElement = form.calledElement
    bpmn.isAsync = form.isAsync
  }
  if (category === 'subProcess') {
    bpmn.isAsync = form.isAsync
    if (isEventSub) bpmn.triggeredByEvent = true
  }
  if (category === 'gateway') {
    if (form.defaultFlow) bpmn.defaultFlow = form.defaultFlow
    if (form.activationCondition) bpmn.activationCondition = form.activationCondition
  }
  if (category === 'timerEvent') {
    bpmn.timerType = form.timerType
    if (form.timerValue) bpmn.timerValue = form.timerValue
  }
  if (category === 'messageEvent' || category === 'sendTask' || category === 'receiveTask' || category === 'messageFlow') {
    if (form.messageRef) bpmn.messageRef = form.messageRef
    if (form.messageName) bpmn.messageName = form.messageName
  }
  if (category === 'signalEvent') {
    if (form.signalRef) bpmn.signalRef = form.signalRef
    if (form.signalName) bpmn.signalName = form.signalName
  }
  if (category === 'errorEvent') {
    if (form.errorRef) bpmn.errorRef = form.errorRef
    if (form.errorCode) bpmn.errorCode = form.errorCode
  }
  if (category === 'escalationEvent') {
    if (form.escalationRef) bpmn.escalationRef = form.escalationRef
    if (form.escalationCode) bpmn.escalationCode = form.escalationCode
  }
  if (category === 'conditionalEvent' || category === 'sequenceFlow') {
    if (form.conditionExpression) bpmn.conditionExpression = form.conditionExpression
  }
  if (category === 'linkEvent') {
    if (form.linkName) bpmn.linkName = form.linkName
  }
  if (category === 'compensationEvent') {
    if (form.activityRef) bpmn.activityRef = form.activityRef
  }
  if (isBoundary) {
    bpmn.cancelActivity = form.cancelActivity
  }
  if (category === 'dataObject') {
    bpmn.isCollection = form.isCollection
  }
  if (category === 'pool') {
    if (form.processRef) bpmn.processRef = form.processRef
  }
  if (category === 'textAnnotation') {
    if (form.annotationText) bpmn.annotationText = form.annotationText
  }
  if (category === 'group') {
    if (form.categoryValueRef) bpmn.categoryValueRef = form.categoryValueRef
  }

  // Copy custom extension fields
  const standardKeys = new Set(Object.keys(emptyBpmnFormData()))
  for (const key of Object.keys(form)) {
    if (!standardKeys.has(key) && form[key] !== undefined && form[key] !== '') {
      bpmn[key] = form[key]
    }
  }

  return bpmn
}
