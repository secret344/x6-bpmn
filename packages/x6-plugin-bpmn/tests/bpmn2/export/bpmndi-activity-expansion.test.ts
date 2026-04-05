import { describe, it, expect, beforeAll } from 'vitest'
import { Graph, type Node } from '@antv/x6'
import { buildTestXml, matchXmlOrThrow, replaceXmlOrThrow } from '../../helpers/xml-test-utils'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { exportBpmnXml } from '../../../src/export/exporter'
import { registerActivityShapes } from '../../../src/shapes/activities'
import {
  BPMN_SUB_PROCESS,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_START_EVENT,
} from '../../../src/utils/constants'

let registered = false

function ensureShapesRegistered() {
  if (registered) return
  registerActivityShapes()
  try {
    Graph.registerNode(BPMN_START_EVENT, {
      inherit: 'ellipse',
      width: 36,
      height: 36,
      attrs: { body: { fill: '#fff', stroke: '#000' }, label: { text: '' } },
    }, true)
  } catch {
    // 图形已注册时忽略
  }
  registered = true
}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 900, height: 700 })
}

describe('BPMNDI 活动展开状态（isExpanded）', () => {
  beforeAll(() => {
    ensureShapesRegistered()
  })

  it('导入展开子流程时应恢复 data.bpmn.isExpanded 并隐藏折叠标记（formal-11-01-03 §12.2.3.3）', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'subProcess', id: 'Sub_1', name: '展开子流程' },
          { kind: 'startEvent', id: 'Start_1', name: '开始' },
        ],
      }],
      shapes: {
        Sub_1: { id: 'Sub_1', x: 120, y: 100, width: 220, height: 140, isExpanded: true },
        Start_1: { id: 'Start_1', x: 420, y: 140, width: 36, height: 36 },
      },
    })

    const importData = await parseBpmnXml(xml)
    expect((importData.nodes.find((node) => node.id === 'Sub_1')?.data as { bpmn?: { isExpanded?: boolean } } | undefined)?.bpmn?.isExpanded).toBe(true)

    const graph = createTestGraph()
    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const subProcess = graph.getCellById('Sub_1') as Node
    expect((subProcess.getData() as { bpmn?: { isExpanded?: boolean } }).bpmn?.isExpanded).toBe(true)
    expect(subProcess.getAttrByPath('marker/display')).toBe('none')

    graph.dispose()
  })

  it('导入折叠子流程时应显式保留折叠标记', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'subProcess', id: 'Sub_2', name: '折叠子流程' },
        ],
      }],
      shapes: {
        Sub_2: { id: 'Sub_2', x: 120, y: 100, width: 220, height: 140, isExpanded: false },
      },
    })

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const subProcess = graph.getCellById('Sub_2') as Node
    expect((subProcess.getData() as { bpmn?: { isExpanded?: boolean } }).bpmn?.isExpanded).toBe(false)
    expect(subProcess.getAttrByPath('marker/display')).toBe('block')

    graph.dispose()
  })

  it('导入时应将 isExpanded 合并到已有 BPMN 扩展属性', async () => {
    const baseXml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'subProcess', id: 'Sub_3', name: '带扩展子流程' },
        ],
      }],
      shapes: {
        Sub_3: { id: 'Sub_3', x: 120, y: 100, width: 220, height: 140, isExpanded: true },
      },
    })

    const xmlWithNamespace = replaceXmlOrThrow(
      baseXml,
      /targetNamespace="http:\/\/bpmn.io\/schema\/bpmn"/,
      'targetNamespace="http://bpmn.io/schema/bpmn" xmlns:x6bpmn="http://x6-bpmn2.io/schema"',
      '应能为 definitions 注入 x6bpmn 命名空间',
    )
    const xml = replaceXmlOrThrow(
      xmlWithNamespace,
      /<bpmn:subProcess id="Sub_3" name="带扩展子流程"\s*\/>/,
      '<bpmn:subProcess id="Sub_3" name="带扩展子流程">\n      <bpmn:extensionElements>\n        <x6bpmn:properties>\n          <x6bpmn:property name="foo" value="bar" />\n        </x6bpmn:properties>\n      </bpmn:extensionElements>\n    </bpmn:subProcess>',
      '应能为子流程注入扩展属性',
    )

    const importData = await parseBpmnXml(xml)
    expect(importData.nodes.find((node) => node.id === 'Sub_3')?.data).toEqual({
      bpmn: {
        foo: 'bar',
        isExpanded: true,
      },
    })
  })

  it('导出子流程时应写出 BPMNShape 的 isExpanded 属性', async () => {
    const graph = createTestGraph()

    graph.addNode({
      shape: BPMN_SUB_PROCESS,
      id: 'sub_expanded',
      x: 120,
      y: 100,
      width: 220,
      height: 140,
      attrs: { label: { text: '展开子流程' } },
      data: { bpmn: { isExpanded: true } },
    })

    const xml = await exportBpmnXml(graph)
    expect(matchXmlOrThrow(xml, /<bpmndi:BPMNShape\b[^>]*id="sub_expanded_di"[^>]*isExpanded="true"/, '应导出子流程的 isExpanded=true')[0]).toContain('isExpanded="true"')

    graph.dispose()
  })

  it('导入自由子流程时也应恢复 isExpanded 对应的折叠标记状态', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'adHocSubProcess', id: 'AdHoc_1', name: '自由子流程' },
        ],
      }],
      shapes: {
        AdHoc_1: { id: 'AdHoc_1', x: 120, y: 100, width: 220, height: 140, isExpanded: true },
      },
    })

    const graph = createTestGraph()
    loadBpmnGraph(graph, await parseBpmnXml(xml), { zoomToFit: false })

    const adHocSubProcess = graph.getCellById('AdHoc_1') as Node
    expect(adHocSubProcess.shape).toBe(BPMN_AD_HOC_SUB_PROCESS)
    expect((adHocSubProcess.getData() as { bpmn?: { isExpanded?: boolean } }).bpmn?.isExpanded).toBe(true)
    expect(adHocSubProcess.getAttrByPath('marker/display')).toBe('none')

    graph.dispose()
  })
})