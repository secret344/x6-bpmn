/**
 * BPMN 2.0 标准导入适配器
 *
 * 将已有的 importBpmnXml() 封装为 ImporterAdapter 接口，
 * 使其可被方言系统统一调度。
 */

import type { Graph } from '@antv/x6'
import type { ImporterAdapter, ProfileContext } from '../../core/dialect/types'
import { importBpmnXml } from '../../export/importer'
import type { ImportBpmnOptions } from '../../export/importer'

/**
 * 创建 BPMN 2.0 标准导入适配器。
 *
 * @param options — 传递给底层 importBpmnXml 的选项
 */
export function createBpmn2ImporterAdapter(
  options?: ImportBpmnOptions,
): ImporterAdapter {
  return {
    dialect: 'bpmn2',

    async importXML(graph: Graph, xml: string, context: ProfileContext): Promise<void> {
      const profileSerialization = context.profile?.serialization
      const serialization = profileSerialization || options?.serialization
        ? {
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

      return importBpmnXml(graph, xml, {
        ...options,
        serialization,
      })
    },
  }
}
