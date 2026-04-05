/**
 * BPMN 2.0 XML → X6 Graph 导入器（向后兼容入口）
 *
 * 本文件保留以维持 src/export/importer 的历史导入路径。
 * 实际实现已拆分至 src/import/ 目录：
 *
 *   - parseBpmnXml   — XML 解析 → 中间 JSON（src/import/xml-parser.ts）
 *   - loadBpmnGraph  — 中间 JSON → X6 Graph（src/import/graph-loader.ts）
 *   - importBpmnXml  — 两步合并（src/import/index.ts）
 *
 * 推荐直接使用 src/import 的拆分 API 以获得更好的可测试性。
 */

// 委托给新 import 模块，保持公开 API 不变
export { importBpmnXml } from '../import'
export type { ImportBpmnOptions } from '../import'
