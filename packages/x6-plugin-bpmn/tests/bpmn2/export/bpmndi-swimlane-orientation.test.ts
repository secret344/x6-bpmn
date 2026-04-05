import { describe, it, expect } from 'vitest'
import { Graph, type Node } from '@antv/x6'
import type { BpmnImportData } from '../../../src/import'
import { buildTestXml, matchXmlOrThrow } from '../../helpers/xml-test-utils'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { exportBpmnXml } from '../../../src/export/exporter'
import { buildSwimlaneAttrs } from '../../../src/shapes/swimlane-presentation'
import {
  BPMN_POOL,
  BPMN_LANE,
  BPMN_START_EVENT,
} from '../../../src/utils/constants'

for (const shapeName of [BPMN_POOL, BPMN_LANE, BPMN_START_EVENT]) {
  try {
    Graph.registerNode(shapeName, {
      inherit: 'rect',
      attrs: { body: { fill: '#fff', stroke: '#000' }, headerLabel: { text: '' }, label: { text: '' } },
    }, true)
  } catch {
    // 图形已注册时忽略
  }
}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 900, height: 700 })
}

describe('BPMNDI 泳道方向（isHorizontal）', () => {
  it('导入垂直 Pool / Lane 时应恢复方向数据并切换标题栏布局（formal-11-01-03 §12.2.3.3）', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'laneSet', id: 'LaneSet_1', lanes: [{ id: 'Lane_1', name: '垂直泳道', flowNodeRefs: ['Start_1'] }] },
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      collaboration: {
        id: 'Collab_1',
        participants: [{ id: 'Pool_1', name: '垂直池', processRef: 'Process_1' }],
      },
      shapes: {
        Pool_1: { id: 'Pool_1', x: 40, y: 40, width: 240, height: 620, isHorizontal: false },
        Lane_1: { id: 'Lane_1', x: 70, y: 70, width: 210, height: 590, isHorizontal: false },
        Start_1: { id: 'Start_1', x: 130, y: 130, width: 36, height: 36 },
      },
    })

    const importData = await parseBpmnXml(xml)
    expect((importData.nodes.find((node) => node.id === 'Pool_1')?.data as { bpmn?: { isHorizontal?: boolean } } | undefined)?.bpmn?.isHorizontal).toBe(false)
    expect((importData.nodes.find((node) => node.id === 'Lane_1')?.data as { bpmn?: { isHorizontal?: boolean } } | undefined)?.bpmn?.isHorizontal).toBe(false)

    const graph = createTestGraph()
    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const pool = graph.getCellById('Pool_1') as Node
    const lane = graph.getCellById('Lane_1') as Node

    expect((pool.getData() as { bpmn?: { isHorizontal?: boolean } }).bpmn?.isHorizontal).toBe(false)
    expect(pool.getAttrByPath('header/refWidth')).toBe('100%')
    expect(pool.getAttrByPath('header/height')).toBe(30)
    expect(pool.getAttrByPath('headerLabel/transform')).toBeUndefined()

    expect((lane.getData() as { bpmn?: { isHorizontal?: boolean } }).bpmn?.isHorizontal).toBe(false)
    expect(lane.getAttrByPath('header/refWidth')).toBe('100%')
    expect(lane.getAttrByPath('header/height')).toBe(30)
    expect(lane.getAttrByPath('headerLabel/transform')).toBeUndefined()

    graph.dispose()
  })

  it('导出显式标记为垂直的 Pool / Lane 时应写出 isHorizontal="false"', async () => {
    const graph = createTestGraph()

    graph.addNode({
      shape: BPMN_POOL,
      id: 'pool_vertical',
      x: 40,
      y: 40,
      width: 240,
      height: 620,
      attrs: buildSwimlaneAttrs(BPMN_POOL, '垂直池', false),
      data: { bpmn: { isHorizontal: false } },
    })
    graph.addNode({
      shape: BPMN_LANE,
      id: 'lane_vertical',
      x: 70,
      y: 70,
      width: 210,
      height: 590,
      attrs: buildSwimlaneAttrs(BPMN_LANE, '垂直泳道', false),
      data: { bpmn: { isHorizontal: false } },
    })

    const xml = await exportBpmnXml(graph)
    expect(matchXmlOrThrow(xml, /<bpmndi:BPMNShape\b[^>]*id="pool_vertical_di"[^>]*isHorizontal="false"/, '应导出垂直 Pool 的 isHorizontal=false')[0]).toContain('isHorizontal="false"')
    expect(matchXmlOrThrow(xml, /<bpmndi:BPMNShape\b[^>]*id="lane_vertical_di"[^>]*isHorizontal="false"/, '应导出垂直 Lane 的 isHorizontal=false')[0]).toContain('isHorizontal="false"')

    graph.dispose()
  })

  it('导出未显式存储方向的泳道时应按宽高比推断方向', async () => {
    const graph = createTestGraph()

    graph.addNode({
      shape: BPMN_POOL,
      id: 'pool_auto_vertical',
      x: 40,
      y: 40,
      width: 220,
      height: 560,
      attrs: buildSwimlaneAttrs(BPMN_POOL, '自动推断池', false),
    })

    const xml = await exportBpmnXml(graph)
    expect(matchXmlOrThrow(xml, /<bpmndi:BPMNShape\b[^>]*id="pool_auto_vertical_di"[^>]*isHorizontal="false"/, '应按宽高比推断垂直 Pool')[0]).toContain('isHorizontal="false"')

    graph.dispose()
  })

  it('loadBpmnGraph 在泳道标题缺失时应回退到默认标题', () => {
    Graph.registerNode(BPMN_POOL, {
      inherit: 'rect',
      attrs: { body: { fill: '#fff', stroke: '#000' } },
    }, true)

    const graph = createTestGraph()
    const importData: BpmnImportData = {
      nodes: [{
        shape: BPMN_POOL,
        id: 'pool_default_label',
        x: 40,
        y: 40,
        width: 220,
        height: 560,
        data: { bpmn: { isHorizontal: false } },
      }],
      edges: [],
    }

    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const pool = graph.getCellById('pool_default_label') as Node
    expect(pool.getAttrByPath('headerLabel/text')).toBe('Pool')
    expect(pool.getAttrByPath('headerLabel/transform')).toBeUndefined()

    graph.dispose()
  })
})