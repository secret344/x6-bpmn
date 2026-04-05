/**
 * BPMN 2.0 XML 导入 / 导出 模块入口
 *
 * 重新导出所有公开 API：
 * - exportBpmnXml — 将 X6 图形导出为 BPMN 2.0 XML
 * - importBpmnXml — 将 BPMN 2.0 XML 导入到 X6 图形（两步合并）
 * - parseBpmnXml  — XML → 中间 JSON（可单独测试）
 * - loadBpmnGraph — 中间 JSON → X6 Graph（可单独测试）
 * - NODE_MAPPING / EDGE_MAPPING — 图形与 BPMN 标签的映射关系
 * - 各类辅助判断函数
 */

export { exportBpmnXml } from './exporter'
export type { ExportBpmnOptions } from './exporter'

export { importBpmnXml } from './importer'
export type { ImportBpmnOptions } from './importer'

// 拆分导入 API —— 推荐在测试和高级用例中使用
export { parseBpmnXml, loadBpmnGraph } from '../import'
export type { BpmnImportData, BpmnNodeData, BpmnEdgeData, LoadBpmnOptions } from '../import'

export {
  NODE_MAPPING,
  EDGE_MAPPING,
  isPoolShape,
  isLaneShape,
  isSwimlaneShape,
  isArtifactShape,
  isBoundaryShape,
  isDefaultFlow,
  isConditionalFlow,
} from './bpmn-mapping'
export type { BpmnNodeMapping, BpmnEdgeMapping } from './bpmn-mapping'

