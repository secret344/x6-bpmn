/**
 * SmartEngine 导入适配器
 *
 * 继承 BPMN 2.0 标准导入，在此基础上处理 SmartEngine 扩展命名空间
 * 中的自定义属性。
 *
 * 当前实现直接委托给 bpmn2 adapter，因为底层 importer 已经支持
 * 扩展属性的反序列化（将 extensionElements 作为 nodeData 存储）。
 * 后续如果 SmartEngine 有特殊需求（如解析 requirements 节点等），
 * 在此处扩展。
 */

import type { Graph } from '@antv/x6'
import type { ImporterAdapter, ProfileContext } from '../../core/dialect/types'
import { importBpmnXml } from '../../export/importer'
import type { ImportBpmnOptions } from '../../export/importer'

/**
 * SmartEngine 导入适配器选项
 */
export interface SmartEngineImportOptions extends ImportBpmnOptions {
  /** 是否解析 SmartEngine 特有的扩展属性，默认 true */
  parseSmartExtensions?: boolean
}

/**
 * 创建 SmartEngine 导入适配器。
 *
 * 在 BPMN 2.0 标准导入的基础上，处理 SmartEngine 扩展属性：
 * 1. 底层 importer 会自动将 extensionElements 存入节点数据
 * 2. 这里可以做额外的后处理（如解析 smart: 前缀属性）
 *
 * @param options — SmartEngine 导入选项
 */
export function createSmartEngineImporterAdapter(
  options?: SmartEngineImportOptions,
): ImporterAdapter {
  return {
    dialect: 'smartengine-base',

    async importXML(graph: Graph, xml: string, context: ProfileContext): Promise<void> {
      const { parseSmartExtensions = true, ...baseOptions } = options ?? {}

      // 使用底层 BPMN 2.0 importer
      await importBpmnXml(graph, xml, baseOptions)

      // 后处理：解析 SmartEngine 扩展属性
      if (parseSmartExtensions) {
        postProcessSmartExtensions(graph, context)
      }
    },
  }
}

/**
 * 后处理：遍历导入后的节点，提取 SmartEngine 扩展属性。
 *
 * 底层 importer 会将 extensionElements 以原始形式存储在节点数据中。
 * 这里将 smart: 前缀的属性提取到顶层 nodeData 中，方便业务代码直接使用。
 */
function postProcessSmartExtensions(graph: Graph, _context: ProfileContext): void {
  const nodes = graph.getNodes()

  for (const node of nodes) {
    const data = node.getData<Record<string, unknown>>()
    if (!data) continue

    // 如果有 extensionProperties（底层 importer 已解析的扩展属性对象），
    // 将 smart: 前缀的属性提升为顶层数据
    const extProps = data.extensionProperties as Record<string, unknown> | undefined
    /* istanbul ignore next — extProps 为非对象情况在实际运行中不会发生 */
    if (extProps && typeof extProps === 'object') {
      const smartProps: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(extProps)) {
        if (key.startsWith('smart:') || key.startsWith('smart_')) {
          // 去掉前缀，存入节点数据
          const cleanKey = key.replace(/^smart[:_]/, '')
          smartProps[cleanKey] = value
        }
      }
      if (Object.keys(smartProps).length > 0) {
        node.setData({ ...data, ...smartProps }, { silent: true })
      }
    }
  }
}
