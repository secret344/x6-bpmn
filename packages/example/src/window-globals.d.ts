import type { Graph } from '@antv/x6'
import type { BpmnImportData } from '@x6-bpmn2/plugin'

declare global {
  interface Window {
    __x6BpmnExampleGraph?: Graph
    __x6BpmnExampleApi?: {
      exportXml: () => Promise<string>
      importXml: (xml: string) => Promise<BpmnImportData>
    }
  }
}

export {}