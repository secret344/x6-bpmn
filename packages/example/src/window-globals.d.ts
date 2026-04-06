import type { Graph } from '@antv/x6'

declare global {
  interface Window {
    __x6BpmnExampleGraph?: Graph
    __x6BpmnExampleApi?: {
      exportXml: () => Promise<string>
      importXml: (xml: string) => Promise<void>
    }
  }
}

export {}