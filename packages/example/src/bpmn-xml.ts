import type { Graph } from '@antv/x6'
import {
  exportBpmnXml,
  importBpmnXml,
  type BpmnImportData,
  type ExportBpmnOptions,
  type ImportBpmnOptions,
} from '@x6-bpmn2/plugin'

export type ExampleImportStatus = 'standard' | 'compatible' | 'lossy'

export function getExampleImportStatus(data: BpmnImportData): ExampleImportStatus {
  const diagnostics = data.diagnostics
  if (!diagnostics) return 'standard'
  if (diagnostics.lossyFlags.length > 0) return 'lossy'
  if (diagnostics.warnings.length > 0 || diagnostics.compatibilityIssues.length > 0) {
    return 'compatible'
  }
  return 'standard'
}

export function formatExampleImportSummary(data: BpmnImportData): string {
  const diagnostics = data.diagnostics
  const status = getExampleImportStatus(data)
  const statusLabel = status === 'lossy'
    ? '有损导入'
    : status === 'compatible'
      ? '兼容导入'
      : '标准导入'
  const lines = [
    `导入分类: ${statusLabel}`,
    `节点: ${data.nodes.length}`,
    `连线: ${data.edges.length}`,
  ]

  if (!diagnostics) {
    return lines.join('\n')
  }

  if (diagnostics.warnings.length > 0) {
    lines.push(`warnings: ${diagnostics.warnings.length}`)
  }
  if (diagnostics.compatibilityIssues.length > 0) {
    lines.push(`compatibilityIssues: ${diagnostics.compatibilityIssues.length}`)
  }
  if (diagnostics.lossyFlags.length > 0) {
    lines.push(`lossyFlags: ${diagnostics.lossyFlags.join(', ')}`)
  }

  return lines.join('\n')
}

export function exportStandardBpmnXml(
  graph: Graph,
  options: ExportBpmnOptions = {},
): Promise<string> {
  return exportBpmnXml(graph, {
    ...options,
    serialization: {
      ...(options.serialization ?? {}),
      extensionProperties: false,
    },
  })
}

export async function importExampleBpmnXml(
  graph: Graph,
  xml: string,
  options: ImportBpmnOptions = {},
): Promise<BpmnImportData> {
  let importedData: BpmnImportData | null = null

  await importBpmnXml(graph, xml, {
    ...options,
    serialization: {
      ...(options.serialization ?? {}),
      extensionProperties: false,
    },
    onImportedData: async (data) => {
      importedData = data
      await options.onImportedData?.(data)
    },
  })

  if (!importedData) {
    throw new Error('BPMN 导入完成但未返回导入诊断数据')
  }

  return importedData
}

