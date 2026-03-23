/**
 * SmartEngine 序列化适配器
 *
 * 为阿里巴巴 SmartEngine 工作流引擎提供定制化的序列化支持。
 * SmartEngine 基于 BPMN 2.0 规范，但添加了自己的扩展属性和命名空间。
 *
 * 主要扩展：
 * - smart: 命名空间用于引擎特定属性
 * - smart:class 用于指定服务任务的实现类
 * - smart:properties 用于存储自定义属性
 * - smart:executionListener 用于执行监听器
 * - conditionExpression 使用 MVEL 表达式语言
 *
 * 参考：https://github.com/alibaba/SmartEngine
 */

import type { Node } from '@antv/x6'
import type { SerializationAdapter, ExportContext, ImportContext } from './serialization-adapter'

// SmartEngine 命名空间
const SMART_NS = 'http://smartengine.alibaba.com/schema'

/**
 * SmartEngine 序列化适配器
 *
 * 将标准 BPMN 2.0 元素转换为 SmartEngine 可识别的格式
 */
export const smartEngineSerializationAdapter: SerializationAdapter = {
  name: 'smartengine',
  description: 'SmartEngine 工作流引擎序列化适配器',

  // 注册 SmartEngine 命名空间
  namespaces: {
    smart: SMART_NS,
  },

  /**
   * 导出节点时的处理
   *
   * 将 X6 节点数据转换为 SmartEngine 格式的属性
   */
  onExportNode(context: ExportContext): void {
    const { cell, element, moddle } = context
    const node = cell as Node
    const bpmnData = node.getData<Record<string, any>>()?.bpmn || {}
    const shape = node.shape

    // 处理服务任务的 implementation
    if (
      shape === 'bpmn-service-task' ||
      shape === 'bpmn-script-task' ||
      shape.includes('-task')
    ) {
      const implementation = bpmnData.implementation || bpmnData.class
      if (implementation && typeof implementation === 'string') {
        // SmartEngine 使用 smart:class 属性
        (element.$attrs as Record<string, any>)['smart:class'] = implementation
      }

      // 处理结果变量
      if (bpmnData.resultVariable) {
        (element.$attrs as Record<string, any>)['smart:resultVariable'] = bpmnData.resultVariable
      }
    }

    // 处理用户任务的分配属性
    if (shape === 'bpmn-user-task') {
      if (bpmnData.assignee) {
        (element.$attrs as Record<string, any>)['smart:assignee'] = bpmnData.assignee
      }
      if (bpmnData.candidateUsers) {
        (element.$attrs as Record<string, any>)['smart:candidateUsers'] = bpmnData.candidateUsers
      }
      if (bpmnData.candidateGroups) {
        (element.$attrs as Record<string, any>)['smart:candidateGroups'] = bpmnData.candidateGroups
      }
    }

    // 处理自定义属性（通过 smart:properties）
    const customProps: Record<string, any> = {}
    for (const [key, value] of Object.entries(bpmnData)) {
      // 排除已处理的标准属性
      if (
        !['implementation', 'class', 'resultVariable', 'assignee', 'candidateUsers', 'candidateGroups', 'name'].includes(key) &&
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        customProps[key] = value
      }
    }

    // 如果有自定义属性，添加到 extensionElements
    if (Object.keys(customProps).length > 0) {
      if (!element.extensionElements) {
        element.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] })
      }

      // 创建 smart:properties 元素
      const propChildren = Object.entries(customProps).map(([k, v]) =>
        moddle.createAny('smart:property', SMART_NS, { name: k, value: String(v) })
      )

      const propsContainer = moddle.createAny('smart:properties', SMART_NS, { $children: propChildren })

      // 添加到 extensionElements
      if (!element.extensionElements.values) {
        element.extensionElements.values = []
      }
      element.extensionElements.values.push(propsContainer)
    }

    // 处理执行监听器
    if (bpmnData.executionListeners && Array.isArray(bpmnData.executionListeners)) {
      if (!element.extensionElements) {
        element.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] })
      }

      for (const listener of bpmnData.executionListeners) {
        const listenerEl = moddle.createAny('smart:executionListener', SMART_NS, {
          event: listener.event || 'start',
          class: listener.class,
        })

        if (!element.extensionElements.values) {
          element.extensionElements.values = []
        }
        element.extensionElements.values.push(listenerEl)
      }
    }
  },

  /**
   * 导出边时的处理
   *
   * 处理条件表达式的语言属性
   */
  onExportEdge(context: ExportContext): void {
    const { element } = context

    // SmartEngine 的条件表达式使用 MVEL 语言
    if (element.conditionExpression) {
      (element.conditionExpression.$attrs as Record<string, any>)['language'] = 'mvel'
    }
  },

  /**
   * 导入节点时的处理
   *
   * 将 SmartEngine 属性转换为 X6 节点数据
   */
  onImportNode(context: ImportContext): void {
    const { element, cellData } = context
    const attrs = element.$attrs || {}

    // 初始化 bpmn 数据对象
    if (!cellData.data) {
      cellData.data = {}
    }
    if (!cellData.data.bpmn) {
      cellData.data.bpmn = {}
    }
    const bpmnData = cellData.data.bpmn

    // 提取 smart: 命名空间的属性
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('smart:')) {
        const propName = key.substring(6) // 移除 "smart:" 前缀
        bpmnData[propName] = value
      }
    }

    // 映射 smart:class 到 implementation
    if (attrs['smart:class']) {
      bpmnData.implementation = attrs['smart:class']
      bpmnData.class = attrs['smart:class']
    }

    // 从 extensionElements 中提取 smart:properties
    if (element.extensionElements?.values) {
      for (const ext of element.extensionElements.values) {
        // 处理 smart:properties
        if (ext.$type === 'smart:properties' && ext.$children) {
          for (const prop of ext.$children) {
            if (prop.$type === 'smart:property' && prop.name) {
              bpmnData[prop.name] = prop.value
            }
          }
        }

        // 处理 smart:executionListener
        if (ext.$type === 'smart:executionListener') {
          if (!bpmnData.executionListeners) {
            bpmnData.executionListeners = []
          }
          bpmnData.executionListeners.push({
            event: ext.event || 'start',
            class: ext.class,
          })
        }
      }
    }
  },

  /**
   * 导入边时的处理
   *
   * 目前不需要特殊处理
   */
  onImportEdge(context: ImportContext): void {
    // SmartEngine 的边属性已由标准导入器处理
  },
}
