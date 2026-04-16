import type { Graph } from '@antv/x6'
import {
  exportBpmnXml,
  importBpmnXml,
  type ExportBpmnOptions,
  type ImportBpmnOptions,
} from '@x6-bpmn2/plugin'

export function exportStandardBpmnXml(
  graph: Graph,
  options: ExportBpmnOptions = {},
): Promise<string> {
  return exportBpmnXml(graph, options)
}

export function importExampleBpmnXml(
  graph: Graph,
  xml: string,
  options: ImportBpmnOptions = {},
): Promise<void> {
  return importBpmnXml(graph, xml, options)
}

