/**
 * BPMN 2.0 标准导出适配器
 *
 * 将已有的 exportBpmnXml() 封装为 ExporterAdapter 接口，
 * 使其可被方言系统统一调度。
 */

import type { Graph } from '@antv/x6'
import type { ExporterAdapter, ProfileContext } from '../../core/dialect/types'
import { exportBpmnXml } from '../../export/exporter'
import type { ExportBpmnOptions } from '../../export/exporter'

function injectNamespaces(xml: string, namespaces: Record<string, string>): string {
  const defPattern = /(<(?:bpmn:)?definitions\b)/
  const match = xml.match(defPattern)
  if (!match) return xml

  let injection = ''
  for (const [prefix, uri] of Object.entries(namespaces)) {
    const nsAttr = `xmlns:${prefix}=`
    if (!xml.includes(nsAttr)) {
      injection += ` xmlns:${prefix}="${uri}"`
    }
  }

  return injection ? xml.replace(defPattern, `$1${injection}`) : xml
}

/**
 * 创建 BPMN 2.0 标准导出适配器。
 *
 * @param options — 传递给底层 exportBpmnXml 的选项
 */
export function createBpmn2ExporterAdapter(
  options?: ExportBpmnOptions,
): ExporterAdapter {
  return {
    dialect: 'bpmn2',

    async exportXML(graph: Graph, context: ProfileContext): Promise<string> {
      const profileSerialization = context.profile?.serialization
      const serialization = profileSerialization || options?.serialization
        ? {
            namespaces: profileSerialization?.namespaces || options?.serialization?.namespaces
              ? {
                  ...(profileSerialization?.namespaces ?? {}),
                  ...options?.serialization?.namespaces,
                }
              : undefined,
            nodeMapping: profileSerialization?.nodeMapping || options?.serialization?.nodeMapping
              ? {
                  ...(profileSerialization?.nodeMapping ?? {}),
                  ...options?.serialization?.nodeMapping,
                }
              : undefined,
            edgeMapping: profileSerialization?.edgeMapping || options?.serialization?.edgeMapping
              ? {
                  ...(profileSerialization?.edgeMapping ?? {}),
                  ...options?.serialization?.edgeMapping,
                }
              : undefined,
          }
        : undefined

      const xml = await exportBpmnXml(graph, { ...options, serialization })
      return serialization?.namespaces ? injectNamespaces(xml, serialization.namespaces) : xml
    },
  }
}
