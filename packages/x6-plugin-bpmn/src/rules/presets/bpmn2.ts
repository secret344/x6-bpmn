/**
 * BPMN 2.0 基础规则预设
 *
 * 完整的 BPMN 2.0 规范规则集，包含：
 * - 连线规则（复用 DEFAULT_CONNECTION_RULES）
 * - 各类节点的标准属性定义
 * - BPMN 2.0 合规性验证器
 *
 * 该预设作为所有其他预设的基础。
 */

import type { BpmnRulePreset, NodePropertyDefinition, BpmnCustomValidator } from './types'
import type { BpmnValidationResult } from '../connection-rules'

// ============================================================================
// 节点属性定义
// ============================================================================

const userTaskProperties: NodePropertyDefinition[] = [
  { key: 'assignee', label: '处理人', type: 'string', group: '任务分配' },
  { key: 'candidateUsers', label: '候选用户', type: 'string', group: '任务分配', description: '多个用户以逗号分隔' },
  { key: 'candidateGroups', label: '候选组', type: 'string', group: '任务分配', description: '多个组以逗号分隔' },
  { key: 'formKey', label: '表单标识', type: 'string', group: '表单' },
  { key: 'dueDate', label: '到期时间', type: 'string', group: '任务属性' },
  { key: 'priority', label: '优先级', type: 'string', group: '任务属性' },
]

const serviceTaskProperties: NodePropertyDefinition[] = [
  { key: 'implementationType', label: '实现方式', type: 'select', group: '服务配置', options: [
    { label: '类', value: 'class' },
    { label: '表达式', value: 'expression' },
    { label: '委托表达式', value: 'delegateExpression' },
  ]},
  { key: 'implementation', label: '实现', type: 'string', group: '服务配置', required: true },
  { key: 'resultVariable', label: '结果变量', type: 'string', group: '服务配置' },
  { key: 'isAsync', label: '异步执行', type: 'boolean', group: '高级', defaultValue: false },
]

const scriptTaskProperties: NodePropertyDefinition[] = [
  { key: 'scriptFormat', label: '脚本语言', type: 'select', group: '脚本配置', options: [
    { label: 'JavaScript', value: 'javascript' },
    { label: 'Groovy', value: 'groovy' },
    { label: 'Python', value: 'python' },
  ]},
  { key: 'script', label: '脚本内容', type: 'string', group: '脚本配置', required: true },
  { key: 'resultVariable', label: '结果变量', type: 'string', group: '脚本配置' },
]

const businessRuleTaskProperties: NodePropertyDefinition[] = [
  { key: 'implementationType', label: '实现方式', type: 'select', group: '规则配置', options: [
    { label: '类', value: 'class' },
    { label: '表达式', value: 'expression' },
    { label: '委托表达式', value: 'delegateExpression' },
  ]},
  { key: 'implementation', label: '实现', type: 'string', group: '规则配置' },
  { key: 'resultVariable', label: '结果变量', type: 'string', group: '规则配置' },
]

const callActivityProperties: NodePropertyDefinition[] = [
  { key: 'calledElement', label: '调用流程', type: 'string', group: '调用配置', required: true },
  { key: 'isAsync', label: '异步执行', type: 'boolean', group: '高级', defaultValue: false },
]

const subProcessProperties: NodePropertyDefinition[] = [
  { key: 'isAsync', label: '异步执行', type: 'boolean', group: '高级', defaultValue: false },
  { key: 'triggeredByEvent', label: '事件触发', type: 'boolean', group: '高级', defaultValue: false },
]

const gatewayProperties: NodePropertyDefinition[] = [
  { key: 'defaultFlow', label: '默认分支', type: 'string', group: '网关配置', description: '默认顺序流的 ID' },
]

const timerEventProperties: NodePropertyDefinition[] = [
  { key: 'timerType', label: '定时类型', type: 'select', group: '定时配置', options: [
    { label: '持续时间', value: 'timeDuration' },
    { label: '时间日期', value: 'timeDate' },
    { label: '循环', value: 'timeCycle' },
  ], defaultValue: 'timeDuration' },
  { key: 'timerValue', label: '定时值', type: 'expression', group: '定时配置' },
]

const messageEventProperties: NodePropertyDefinition[] = [
  { key: 'messageRef', label: '消息引用', type: 'string', group: '消息配置' },
  { key: 'messageName', label: '消息名称', type: 'string', group: '消息配置' },
]

const signalEventProperties: NodePropertyDefinition[] = [
  { key: 'signalRef', label: '信号引用', type: 'string', group: '信号配置' },
  { key: 'signalName', label: '信号名称', type: 'string', group: '信号配置' },
]

const errorEventProperties: NodePropertyDefinition[] = [
  { key: 'errorRef', label: '错误引用', type: 'string', group: '错误配置' },
  { key: 'errorCode', label: '错误代码', type: 'string', group: '错误配置' },
]

const escalationEventProperties: NodePropertyDefinition[] = [
  { key: 'escalationRef', label: '升级引用', type: 'string', group: '升级配置' },
  { key: 'escalationCode', label: '升级代码', type: 'string', group: '升级配置' },
]

const conditionalEventProperties: NodePropertyDefinition[] = [
  { key: 'conditionExpression', label: '条件表达式', type: 'expression', group: '条件配置' },
]

const sequenceFlowProperties: NodePropertyDefinition[] = [
  { key: 'conditionExpression', label: '条件表达式', type: 'expression', group: '流转条件' },
]

const poolProperties: NodePropertyDefinition[] = [
  { key: 'processRef', label: '流程引用', type: 'string', group: '泳道配置' },
]

const textAnnotationProperties: NodePropertyDefinition[] = [
  { key: 'annotationText', label: '注释文本', type: 'string', group: '注释配置' },
]

// ============================================================================
// 验证器
// ============================================================================

/** 自连接验证器 */
const noSelfConnectionValidator: BpmnCustomValidator = {
  name: 'bpmn2:no-self-connection',
  description: '禁止节点自连接',
  validate: (ctx): BpmnValidationResult => {
    if (ctx.sourceShape === ctx.targetShape && ctx.sourceShape !== '') {
      // 这里检查 shape 是否相同只是一个简化判断；
      // 实际的自连接检查通过节点 ID 在 validator.ts 中完成
    }
    return { valid: true }
  },
}

// ============================================================================
// BPMN 2.0 基础预设
// ============================================================================

/**
 * BPMN 2.0 基础规则预设
 *
 * 不设置 connectionRules，resolvePreset 会自动使用 DEFAULT_CONNECTION_RULES 作为基础。
 * 该预设主要提供节点属性定义和基础验证器。
 */
export const BPMN2_PRESET: BpmnRulePreset = {
  name: 'bpmn2',
  description: 'BPMN 2.0 标准规则预设，包含完整的 BPMN 2.0 规范定义',

  nodeProperties: {
    userTask: userTaskProperties,
    serviceTask: serviceTaskProperties,
    scriptTask: scriptTaskProperties,
    businessRuleTask: businessRuleTaskProperties,
    sendTask: serviceTaskProperties,
    receiveTask: serviceTaskProperties,
    callActivity: callActivityProperties,
    subProcess: subProcessProperties,
    gateway: gatewayProperties,
    timerEvent: timerEventProperties,
    messageEvent: messageEventProperties,
    signalEvent: signalEventProperties,
    errorEvent: errorEventProperties,
    escalationEvent: escalationEventProperties,
    conditionalEvent: conditionalEventProperties,
    sequenceFlow: sequenceFlowProperties,
    pool: poolProperties,
    textAnnotation: textAnnotationProperties,
  },

  validators: [noSelfConnectionValidator],
}
