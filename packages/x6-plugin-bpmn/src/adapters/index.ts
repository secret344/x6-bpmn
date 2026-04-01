/**
 * 适配器模块入口
 *
 * 重新导出所有导入/导出适配器和 X6 绑定管理器。
 */

/* c8 ignore start — barrel re-exports */
export { createBpmn2ExporterAdapter, createBpmn2ImporterAdapter } from './bpmn2'
export {
  createSmartEngineExporterAdapter,
  createSmartEngineImporterAdapter,
} from './smartengine'
export type { SmartEngineExportOptions, SmartEngineImportOptions } from './smartengine'
export { DialectManager, createDialectManager } from './x6'
export type { DialectManagerOptions } from './x6'
/* c8 ignore stop */
