/**
 * SmartEngine 规则预设
 *
 * 基于 BPMN 2.0 规则，根据 SmartEngine 的特性进行扩展和约束。
 * SmartEngine 是阿里巴巴开源的业务治理和服务编排引擎，其特点包括：
 *
 * - 使用 smart:class 属性指定服务委托实现类
 * - 使用 MVEL 表达式作为条件表达式语法
 * - 支持 smart:properties 扩展属性
 * - 支持 smart:executionListener 执行监听器
 * - startEvent 仅允许一个（maxOutgoing: 1 的开始事件）
 * - parallelGateway 必须成对出现（fork/join）
 * - Custom 模式下推荐 receiveTask 代替 userTask
 * - exclusiveGateway 支持 smart:class 网关委托
 *
 * @see https://github.com/alibaba/SmartEngine/wiki
 */

import type { BpmnRulePreset, NodePropertyDefinition, BpmnCustomValidator, SerializationAdapter, ExportNodeContext } from './types'
import type { BpmnValidationResult } from '../connection-rules'

// ============================================================================
// SmartEngine 特有的节点属性定义
// ============================================================================

/**
 * SmartEngine 服务任务属性
 * 覆盖标准 BPMN 的 serviceTask 属性，增加 smart:class 配置
 */
const smartServiceTaskProperties: NodePropertyDefinition[] = [
  { key: 'implementationType', label: '实现方式', type: 'select', group: '服务配置', options: [
    { label: '类名 (smart:class)', value: 'class' },
    { label: 'Spring Bean 名称', value: 'beanName' },
    { label: '委托表达式', value: 'delegateExpression' },
  ], defaultValue: 'class' },
  { key: 'implementation', label: '实现类 / Bean', type: 'string', group: '服务配置', required: true,
    description: '完整类名或 Spring Bean 名称，如 com.example.MyDelegation' },
  { key: 'resultVariable', label: '结果变量', type: 'string', group: '服务配置' },
  { key: 'isAsync', label: '异步执行', type: 'boolean', group: '高级', defaultValue: false },
]

/**
 * SmartEngine 接收任务属性
 * receiveTask 在 SmartEngine 中用于等待外部 signal 回调
 */
const smartReceiveTaskProperties: NodePropertyDefinition[] = [
  { key: 'implementationType', label: '实现方式', type: 'select', group: '服务配置', options: [
    { label: '类名 (smart:class)', value: 'class' },
    { label: 'Spring Bean 名称', value: 'beanName' },
  ], defaultValue: 'class' },
  { key: 'implementation', label: '离开时执行的委托类', type: 'string', group: '服务配置',
    description: '节点离开时自动执行的 smart:class 委托' },
]

/**
 * SmartEngine 用户任务属性（仅 DataBase 模式）
 */
const smartUserTaskProperties: NodePropertyDefinition[] = [
  { key: 'assignee', label: '处理人', type: 'string', group: '任务分配' },
  { key: 'candidateUsers', label: '候选用户', type: 'string', group: '任务分配', description: '多个用户以逗号分隔' },
  { key: 'candidateGroups', label: '候选组', type: 'string', group: '任务分配', description: '多个组以逗号分隔' },
  { key: 'formKey', label: '表单标识', type: 'string', group: '表单' },
  { key: 'dueDate', label: '到期时间', type: 'string', group: '任务属性' },
  { key: 'priority', label: '优先级', type: 'string', group: '任务属性' },
]

/**
 * SmartEngine 网关属性
 * 互斥网关支持 smart:class 网关委托
 */
const smartGatewayProperties: NodePropertyDefinition[] = [
  { key: 'defaultFlow', label: '默认分支', type: 'string', group: '网关配置', description: '默认顺序流的 ID' },
  { key: 'implementation', label: '网关委托类', type: 'string', group: '网关配置',
    description: 'smart:class 属性，支持在网关执行自定义逻辑' },
]

/**
 * SmartEngine 顺序流属性
 * 条件表达式使用 MVEL 语法
 */
const smartSequenceFlowProperties: NodePropertyDefinition[] = [
  { key: 'conditionExpression', label: '条件表达式 (MVEL)', type: 'expression', group: '流转条件',
    description: '使用 MVEL 表达式语法，如 approve == \'agree\'' },
]

/**
 * SmartEngine 扩展属性（可用于任何节点）
 */
const smartExtensionProperties: NodePropertyDefinition[] = [
  { key: 'smartProperties', label: '扩展属性', type: 'string', group: 'SmartEngine 扩展',
    description: 'smart:properties 扩展属性配置（JSON 格式）' },
  { key: 'executionListener', label: '执行监听器', type: 'string', group: 'SmartEngine 扩展',
    description: 'smart:executionListener 类名，支持 ACTIVITY_START 和 ACTIVITY_END 事件' },
]

// ============================================================================
// SmartEngine 验证器
// ============================================================================

/**
 * SmartEngine 开始事件唯一性验证
 * SmartEngine 规范只允许一个开始事件
 */
const singleStartEventValidator: BpmnCustomValidator = {
  name: 'smartengine:single-start-event',
  description: 'SmartEngine 规范要求流程中只能有一个开始事件',
  validate: (): BpmnValidationResult => {
    // 此验证在连线层面无法完全检查（需要图级验证），
    // 通过 maxOutgoing: 1 在连线规则中近似约束
    return { valid: true }
  },
}

/**
 * SmartEngine 条件表达式格式验证
 * 确保排他网关的出口顺序流包含条件表达式
 */
const conditionExpressionValidator: BpmnCustomValidator = {
  name: 'smartengine:condition-expression',
  description: '排他网关的出口顺序流应配置条件表达式（MVEL 语法）',
  validate: (): BpmnValidationResult => {
    // 条件表达式的完整验证需要节点数据，这里仅做连线层面的占位
    return { valid: true }
  },
}

// ============================================================================
// SmartEngine 序列化适配器
// ============================================================================

/** SmartEngine 命名空间 URI */
const NS_SMART = 'http://smartengine.org/schema/process'

/** 支持 smart:class 属性的 BPMN 标签集合 */
const SMART_CLASS_TAGS = new Set([
  'serviceTask', 'receiveTask', 'exclusiveGateway',
])

/**
 * SmartEngine 序列化适配器
 *
 * 在标准 BPMN 2.0 XML 基础上增加 SmartEngine 特有的扩展：
 * - smart: 命名空间及 smart:class 属性
 * - MVEL 条件表达式类型
 * - smart:properties 和 smart:executionListener 扩展元素
 * - 不包含 BPMN DI 图形交换信息（SmartEngine 不使用）
 */
const smartEngineSerialization: SerializationAdapter = {
  xmlNamespaces: { smart: NS_SMART },
  targetNamespace: 'Examples',
  includeDI: false,
  conditionExpressionType: 'mvel',

  transformExportNode(element: any, context: ExportNodeContext): void {
    const { bpmnData, tag } = context
    if (!bpmnData) return

    // 设置 smart:class 属性
    if (SMART_CLASS_TAGS.has(tag) && bpmnData.implementation) {
      element.$attrs['smart:class'] = bpmnData.implementation
    }

    // 构建 SmartEngine 扩展元素
    const extensionChildren: any[] = []

    // smart:properties
    if (bpmnData.smartProperties) {
      try {
        const propsObj = typeof bpmnData.smartProperties === 'string'
          ? JSON.parse(bpmnData.smartProperties)
          : bpmnData.smartProperties

        if (typeof propsObj === 'object' && propsObj !== null) {
          const propChildren = Object.entries(propsObj).map(([name, value]) =>
            context.createAny('smart:property', NS_SMART, { name, value: String(value) }),
          )
          if (propChildren.length > 0) {
            extensionChildren.push(
              context.createAny('smart:properties', NS_SMART, { $children: propChildren }),
            )
          }
        }
      } catch {
        // 无效的 JSON 格式，跳过
      }
    }

    // smart:executionListener
    if (bpmnData.executionListener) {
      extensionChildren.push(
        context.createAny('smart:executionListener', NS_SMART, {
          event: 'ACTIVITY_START,ACTIVITY_END',
          class: bpmnData.executionListener,
        }),
      )
    }

    // 将扩展元素合并到已有的 extensionElements 中
    if (extensionChildren.length > 0) {
      if (element.extensionElements) {
        element.extensionElements.values = [
          ...(element.extensionElements.values || []),
          ...extensionChildren,
        ]
      } else {
        element.extensionElements = context.createBpmnElement('bpmn:ExtensionElements', {
          values: extensionChildren,
        })
      }
    }
  },

  transformImportNode(nodeConfig: Record<string, any>, element: any): void {
    const attrs = element.$attrs || {}

    // 提取 smart:class 属性
    const smartClass = attrs['smart:class']
    if (smartClass) {
      nodeConfig.data = nodeConfig.data || {}
      nodeConfig.data.bpmn = nodeConfig.data.bpmn || {}
      nodeConfig.data.bpmn.implementation = smartClass
      nodeConfig.data.bpmn.implementationType = 'class'
    }

    // 提取 smart:properties 和 smart:executionListener 扩展元素
    const extElements = element.extensionElements
    if (extElements) {
      const values = (extElements.values || []) as any[]
      for (const val of values) {
        const type = val.$type || val.name || ''

        // smart:properties
        if (type.includes('smart:properties') || type === 'smart:properties') {
          const children = (val.$children || []) as any[]
          const propsObj: Record<string, string> = {}
          for (const child of children) {
            const propName = child.name || child.$attrs?.name
            const propValue = child.value || child.$attrs?.value || ''
            if (propName) propsObj[propName] = propValue
          }
          if (Object.keys(propsObj).length > 0) {
            nodeConfig.data = nodeConfig.data || {}
            nodeConfig.data.bpmn = nodeConfig.data.bpmn || {}
            nodeConfig.data.bpmn.smartProperties = JSON.stringify(propsObj)
          }
        }

        // smart:executionListener
        if (type.includes('smart:executionListener') || type === 'smart:executionListener') {
          const listenerClass = val.class || val.$attrs?.class
          if (listenerClass) {
            nodeConfig.data = nodeConfig.data || {}
            nodeConfig.data.bpmn = nodeConfig.data.bpmn || {}
            nodeConfig.data.bpmn.executionListener = listenerClass
          }
        }
      }
    }
  },
}

// ============================================================================
// SmartEngine 预设
// ============================================================================

/**
 * SmartEngine 规则预设
 *
 * 继承 BPMN 2.0 基础预设，并增加 SmartEngine 特有的规则和属性。
 * 主要变更：
 * - startEvent 仅允许单个开始事件（maxOutgoing 约束）
 * - serviceTask 使用 smart:class 实现类
 * - receiveTask 作为暂停节点，支持 signal 驱动
 * - exclusiveGateway 支持 smart:class 网关委托
 * - 条件表达式使用 MVEL 语法
 * - 支持 smart:properties 和 smart:executionListener 扩展
 */
export const SMARTENGINE_PRESET: BpmnRulePreset = {
  name: 'smartengine',
  description: 'SmartEngine 规则预设，基于 BPMN 2.0 增加 SmartEngine 引擎特有的配置和约束',
  extends: 'bpmn2',

  // SmartEngine 的连线规则约束
  connectionRules: {
    // SmartEngine 只允许一个开始事件，对出线数做约束
    startEvent: {
      maxOutgoing: 1,
    },
  },

  // SmartEngine 特有的节点属性定义
  nodeProperties: {
    serviceTask: smartServiceTaskProperties,
    receiveTask: smartReceiveTaskProperties,
    userTask: smartUserTaskProperties,
    gateway: smartGatewayProperties,
    sequenceFlow: smartSequenceFlowProperties,
    // 通用扩展属性（可添加到任何活动节点）
    task: smartExtensionProperties,
    subProcess: smartExtensionProperties,
  },

  validators: [singleStartEventValidator, conditionExpressionValidator],

  serialization: smartEngineSerialization,
}
