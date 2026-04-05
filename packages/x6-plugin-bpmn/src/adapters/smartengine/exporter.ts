/**
 * SmartEngine 导出适配器
 *
 * 继承 BPMN 2.0 标准导出，在此基础上添加 SmartEngine 扩展命名空间
 * 和特有的扩展属性输出。
 *
 * 当前实现直接委托给 bpmn2 adapter，因为底层 exporter 已经支持
 * 扩展属性序列化。后续如果 SmartEngine 有特殊需求（如自定义多实例
 * 结构、requirements 节点等），在此处扩展。
 */

import type { Graph } from '@antv/x6'
import type { ExporterAdapter, ProfileContext } from '../../core/dialect/types'
import { exportBpmnXml } from '../../export/exporter'
import type { ExportBpmnOptions } from '../../export/exporter'

/** SmartEngine 扩展命名空间 URI */
const NS_SMARTENGINE = 'http://smartengine.alibaba.com/schema'

/**
 * SmartEngine 导出适配器选项
 */
export interface SmartEngineExportOptions extends ExportBpmnOptions {
  /** 附加命名空间声明，最终会注入 XML 头部 */
  additionalNamespaces?: Record<string, string>
}

/**
 * 创建 SmartEngine 导出适配器。
 *
 * 在 BPMN 2.0 标准导出的基础上，将 SmartEngine 扩展属性写入 XML。
 * 底层 exporter 已经通过 extensionElements 输出节点上的自定义数据，
 * 所以这里主要负责：
 * 1. 确保命名空间声明正确
 * 2. 后续可扩展的 SmartEngine 特有结构
 *
 * @param options — SmartEngine 导出选项
 */
export function createSmartEngineExporterAdapter(
  options?: SmartEngineExportOptions,
): ExporterAdapter {
  return {
    dialect: 'smartengine-base',

    async exportXML(graph: Graph, context: ProfileContext): Promise<string> {
      // 使用底层 BPMN 2.0 exporter（已支持扩展属性）
      const xml = await exportBpmnXml(graph, options)

      // 注入 SmartEngine 命名空间到 definitions 标签
      // 底层 bpmn-moddle 会自动处理已知命名空间；
      // 对于自定义命名空间，需要在 XML 头部补充
      const namespaces = {
        smart: NS_SMARTENGINE,
        ...context.profile.serialization.namespaces,
        ...options?.additionalNamespaces,
      }

      return injectNamespaces(xml, namespaces)
    },
  }
}

/**
 * 向 BPMN XML 的 <definitions> 标签注入额外命名空间声明。
 *
 * 如果命名空间已经存在则跳过。
 */
function injectNamespaces(xml: string, namespaces: Record<string, string>): string {
  // 查找 <definitions 或 <bpmn:definitions 标签
  const defPattern = /(<(?:bpmn:)?definitions\b)/
  const match = xml.match(defPattern)
  /* v8 ignore next */ /* istanbul ignore next */
  if (!match) return xml

  let injection = ''
  for (const [prefix, uri] of Object.entries(namespaces)) {
    // 检查是否已声明
    const nsAttr = `xmlns:${prefix}=`
    if (!xml.includes(nsAttr)) {
      injection += ` xmlns:${prefix}="${uri}"`
    }
  }

  /* v8 ignore next */ /* istanbul ignore next */
  if (!injection) return xml

  return xml.replace(defPattern, `$1${injection}`)
}
