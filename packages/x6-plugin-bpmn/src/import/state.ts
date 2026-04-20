/**
 * BPMN 导入图级状态存储
 *
 * 为已导入的 Graph 保存文档级元数据与诊断结果，
 * 供后续导出和宿主读取使用。
 */

import type { Graph } from '@antv/x6'
import type { BpmnImportData } from './types'

/** Graph 对应的导入状态。 */
export interface ImportedBpmnState {
  /** 文档级保真元数据。 */
  metadata?: BpmnImportData['metadata']
  /** 导入诊断结果。 */
  diagnostics?: BpmnImportData['diagnostics']
}

const importedBpmnStateMap = new WeakMap<Graph, ImportedBpmnState>()

/** 记录 Graph 的导入状态。 */
export function setImportedBpmnState(graph: Graph, data: Pick<BpmnImportData, 'metadata' | 'diagnostics'>): void {
  importedBpmnStateMap.set(graph, {
    metadata: data.metadata,
    diagnostics: data.diagnostics,
  })
}

/** 读取 Graph 的导入状态。 */
export function getImportedBpmnState(graph: Graph): ImportedBpmnState | undefined {
  return importedBpmnStateMap.get(graph)
}

/** 清除 Graph 的导入状态。 */
export function clearImportedBpmnState(graph: Graph): void {
  importedBpmnStateMap.delete(graph)
}