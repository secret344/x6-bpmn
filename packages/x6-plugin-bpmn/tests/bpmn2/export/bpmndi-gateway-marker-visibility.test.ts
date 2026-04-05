import { describe, it, expect, beforeAll } from 'vitest'
import { Graph, type Node } from '@antv/x6'
import { buildTestXml, matchXmlOrThrow } from '../../helpers/xml-test-utils'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { exportBpmnXml } from '../../../src/export/exporter'
import { registerGatewayShapes } from '../../../src/shapes/gateways'
import { BPMN_EXCLUSIVE_GATEWAY } from '../../../src/utils/constants'

let registered = false

function ensureShapesRegistered() {
  if (registered) return
  registerGatewayShapes()
  registered = true
}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 900, height: 700 })
}

describe('BPMNDI 网关标记可见性（isMarkerVisible）', () => {
  beforeAll(() => {
    ensureShapesRegistered()
  })

  it('导入隐藏标记的排他网关时应恢复 data.bpmn.isMarkerVisible 并隐藏 X 标记（formal-11-01-03 §12.2.3.3）', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'exclusiveGateway', id: 'Gw_1', name: '判断' },
        ],
      }],
      shapes: {
        Gw_1: { id: 'Gw_1', x: 160, y: 120, width: 50, height: 50, isMarkerVisible: false },
      },
    })

    const importData = await parseBpmnXml(xml)
    expect((importData.nodes.find((node) => node.id === 'Gw_1')?.data as { bpmn?: { isMarkerVisible?: boolean } } | undefined)?.bpmn?.isMarkerVisible).toBe(false)

    const graph = createTestGraph()
    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const gateway = graph.getCellById('Gw_1') as Node
    expect((gateway.getData() as { bpmn?: { isMarkerVisible?: boolean } }).bpmn?.isMarkerVisible).toBe(false)
    expect(gateway.getAttrByPath('marker/display')).toBe('none')

    graph.dispose()
  })

  it('导入显式显示标记的排他网关时应保留 X 标记', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'exclusiveGateway', id: 'Gw_2', name: '判断' },
        ],
      }],
      shapes: {
        Gw_2: { id: 'Gw_2', x: 160, y: 120, width: 50, height: 50, isMarkerVisible: true },
      },
    })

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const gateway = graph.getCellById('Gw_2') as Node
    expect((gateway.getData() as { bpmn?: { isMarkerVisible?: boolean } }).bpmn?.isMarkerVisible).toBe(true)
    expect(gateway.getAttrByPath('marker/display')).toBe('block')

    graph.dispose()
  })

  it('导出排他网关时应写出 BPMNShape 的 isMarkerVisible 属性', async () => {
    const graph = createTestGraph()

    graph.addNode({
      shape: BPMN_EXCLUSIVE_GATEWAY,
      id: 'gw_hidden_marker',
      x: 160,
      y: 120,
      width: 50,
      height: 50,
      attrs: { label: { text: '判断' } },
      data: { bpmn: { isMarkerVisible: false } },
    })

    const xml = await exportBpmnXml(graph)
    expect(matchXmlOrThrow(xml, /<bpmndi:BPMNShape\b[^>]*id="gw_hidden_marker_di"[^>]*isMarkerVisible="false"/, '应导出排他网关的 isMarkerVisible=false')[0]).toContain('isMarkerVisible="false"')

    graph.dispose()
  })
})