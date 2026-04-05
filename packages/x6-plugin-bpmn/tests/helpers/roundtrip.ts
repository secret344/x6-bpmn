/**
 * BPMN 往返测试辅助工具
 *
 * 提供标准化的往返测试函数，确保完整的数据流正确性：
 *
 *   1. 通过 bpmn-moddle 构建并验证 BPMN XML（buildAndValidateBpmn）
 *   2. 解析 XML → 中间 JSON（parseBpmnXml）
 *   3. 加载 JSON → X6 图形（loadBpmnGraph）
 *   4. 导出图形 → XML（exportBpmnXml）
 *   5. 通过 bpmn-moddle 验证导出的 XML（validateBpmnXml）
 *
 * 使用此工具的测试既验证了导入正确性，也验证了导出的有效性，
 * 确保整条数据链路端对端工作正常。
 */

import type { Graph } from '@antv/x6'
import { buildAndValidateBpmn, validateBpmnXml } from './bpmn-builder'
import type { BpmnDocumentSpec } from './bpmn-builder'
import { parseBpmnXml, loadBpmnGraph } from '../../src/import'
import { exportBpmnXml } from '../../src/export/exporter'
import type { BpmnImportData } from '../../src/import'

// ============================================================================
// 返回类型
// ============================================================================

/** bpmnRoundtrip() 的返回结果 */
export interface RoundtripResult {
  /** 已加载了数据的 X6 图形实例 */
  graph: Graph
  /** parseBpmnXml 返回的中间 JSON 数据 */
  importData: BpmnImportData
  /** buildAndValidateBpmn 产生的原始 XML（输入端） */
  importedXml: string
  /** exportBpmnXml 产生的 XML（输出端，已通过 bpmn-moddle 验证） */
  exportedXml: string
}

// ============================================================================
// 往返测试辅助函数
// ============================================================================

/**
 * 标准 BPMN 往返测试：构建 → 解析 → 加载 → 导出 → 验证。
 *
 * 使用示例：
 * ```ts
 * const { graph } = await bpmnRoundtrip({
 *   processes: [{ id: 'P1', elements: [
 *     { kind: 'startEvent', id: 'S1', name: '开始' },
 *   ]}],
 *   shapes: { 'S1': { id: 'S1', x: 100, y: 100, width: 36, height: 36 } },
 * }, createTestGraph)
 *
 * expect(graph.getNodes().length).toBe(1)
 * graph.dispose()
 * ```
 *
 * @param spec        — BPMN 文档规格（传给 buildAndValidateBpmn）
 * @param createGraph — 图形工厂函数（由调用方提供，避免循环依赖）
 * @returns           往返测试结果（含 graph、importData、两端 XML）
 * @throws            如果任意步骤失败（XML 无效、解析异常、导出无效）
 */
export async function bpmnRoundtrip(
  spec: BpmnDocumentSpec,
  createGraph: () => Graph,
): Promise<RoundtripResult> {
  // 步骤 1：通过 bpmn-moddle 构建合法 BPMN XML
  const { valid: buildValid, xml: importedXml } = await buildAndValidateBpmn(spec)
  if (!buildValid) {
    throw new Error('bpmnRoundtrip：入口 XML 无效，请检查 BpmnDocumentSpec')
  }

  // 步骤 2：解析 XML → 中间 JSON
  const importData = await parseBpmnXml(importedXml)

  // 步骤 3：加载 JSON → X6 图形
  const graph = createGraph()
  loadBpmnGraph(graph, importData, { zoomToFit: false })

  // 步骤 4：导出图形 → XML
  const exportedXml = await exportBpmnXml(graph)

  // 步骤 5：通过 bpmn-moddle 验证导出的 XML
  const { valid: exportValid } = await validateBpmnXml(exportedXml)
  if (!exportValid) {
    throw new Error('bpmnRoundtrip：导出的 XML 无效，导出逻辑存在问题')
  }

  return { graph, importData, importedXml, exportedXml }
}
