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

    async exportXML(graph: Graph, _context: ProfileContext): Promise<string> {
      return exportBpmnXml(graph, options)
    },
  }
}
