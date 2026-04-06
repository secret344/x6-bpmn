/**
 * BPMN 导入模块入口
 *
 * 提供两步导入 API：
 *   - parseBpmnXml  — BPMN XML → BpmnImportData（中间 JSON，不依赖图形实例）
 *   - loadBpmnGraph — BpmnImportData → X6 Graph（纯图形操作，不依赖 XML）
 *
 * 同时保留向后兼容的合并方法：
 *   - importBpmnXml — 等价于 loadBpmnGraph(graph, await parseBpmnXml(xml), options)
 */

import type { Graph } from '@antv/x6'
import { parseBpmnXml } from './xml-parser'
import { loadBpmnGraph } from './graph-loader'
import type { LoadBpmnOptions } from './graph-loader'
import type { BpmnNodeMapping, BpmnEdgeMapping } from '../export/bpmn-mapping'

// 重新导出各子模块公开 API
export { parseBpmnXml } from './xml-parser'
export { loadBpmnGraph } from './graph-loader'
export type { LoadBpmnOptions } from './graph-loader'
export type { BpmnImportData, BpmnNodeData, BpmnEdgeData, BpmnEdgeLabelData } from './types'

export interface ImportBpmnOptions extends LoadBpmnOptions {
  /** 使用方言序列化层覆盖默认 BPMN 映射 */
  serialization?: {
    nodeMapping?: Record<string, BpmnNodeMapping>
    edgeMapping?: Record<string, BpmnEdgeMapping>
  }
}

// ============================================================================
// 向后兼容入口
// ============================================================================

/**
 * 将 BPMN 2.0 XML 导入到 X6 Graph（两步合并的便捷方法）。
 *
 * 内部等价于：
 * ```ts
 * const data = await parseBpmnXml(xml)
 * loadBpmnGraph(graph, data, options)
 * ```
 *
 * @param graph   — X6 图形实例
 * @param xml     — BPMN 2.0 XML 字符串
 * @param options — 可选配置
 */
export async function importBpmnXml(
  graph: Graph,
  xml: string,
  options?: ImportBpmnOptions,
): Promise<void> {
  const data = await parseBpmnXml(xml, options)
  const { serialization: _serialization, ...loadOptions } = options ?? {}
  loadBpmnGraph(graph, data, loadOptions)
}
