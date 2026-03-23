/**
 * BPMN 2.0 标准序列化适配器
 *
 * 这是基础适配器，严格遵循 BPMN 2.0 OMG 规范，不添加任何扩展。
 * 所有自定义数据存储在 x6bpmn: 命名空间下的 extensionElements 中。
 *
 * 核心原则：
 * - 标准 BPMN 2.0 模型是稳定层，只随 OMG 规范版本更新
 * - 不添加任何引擎特定的属性或命名空间
 * - 自定义数据通过 extensionElements 存储，保证与标准引擎的兼容性
 */

import type { SerializationAdapter, ExportContext, ImportContext } from './serialization-adapter'

/**
 * BPMN 2.0 标准序列化适配器
 *
 * 此适配器不执行任何特殊转换，仅使用标准 BPMN 2.0 格式。
 * 它作为其他适配器的基准和参考实现。
 */
export const bpmn2SerializationAdapter: SerializationAdapter = {
  name: 'bpmn2',
  description: 'BPMN 2.0 标准序列化适配器（OMG 规范）',

  // BPMN 2.0 不需要额外的命名空间（x6bpmn 命名空间由导出器自动添加）
  namespaces: undefined,

  // BPMN 2.0 适配器不需要任何特殊处理
  // 所有标准属性已由导出器处理
  // 自定义数据已通过 x6bpmn:properties 存储在 extensionElements 中

  onExportNode: undefined,
  onExportEdge: undefined,
  onImportNode: undefined,
  onImportEdge: undefined,
  beforeExport: undefined,
  afterExport: undefined,
  beforeImport: undefined,
  afterImport: undefined,
}
