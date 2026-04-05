import { describe, it, expect, beforeAll } from 'vitest'
import { Graph, type Edge } from '@antv/x6'
import { buildTestXml, replaceXmlOrThrow } from '../../helpers/xml-test-utils'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { exportBpmnXml } from '../../../src/export/exporter'
import type { BpmnImportData } from '../../../src/import'
import { NODE_MAPPING, EDGE_MAPPING } from '../../../src/export/bpmn-mapping'
import { BPMN_MESSAGE_FLOW, BPMN_TASK } from '../../../src/utils/constants'

let registered = false

function ensureShapesRegistered() {
  if (registered) return
  for (const shapeName of Object.keys(NODE_MAPPING)) {
    try {
      Graph.registerNode(shapeName, {
        inherit: 'rect',
        attrs: { body: { fill: '#fff', stroke: '#000' }, label: { text: '' } },
      }, true)
    } catch {
      // 图形已注册时忽略
    }
  }

  for (const shapeName of Object.keys(EDGE_MAPPING)) {
    try {
      Graph.registerEdge(shapeName, {
        inherit: 'edge',
        attrs: { line: { stroke: '#000' } },
      }, true)
    } catch {
      // 图形已注册时忽略
    }
  }
  registered = true
}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 900, height: 700 })
}

describe('BPMNDI 消息流信封可见性（messageVisibleKind）', () => {
  beforeAll(() => {
    ensureShapesRegistered()
  })

  it('解析带 non_initiating 的 BPMNEdge 时应恢复 data.bpmn.messageVisibleKind（formal-11-01-03 §12.2.3.4）', async () => {
    const xml = await buildTestXml({
      processes: [
        { id: 'Process_1', elements: [] },
        { id: 'Process_2', elements: [] },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'P1', name: '发送方', processRef: 'Process_1' },
          { id: 'P2', name: '接收方', processRef: 'Process_2' },
        ],
        messageFlows: [{ id: 'MF_1', name: '通知', sourceRef: 'P1', targetRef: 'P2' }],
      },
      shapes: {
        P1: { id: 'P1', x: 40, y: 40, width: 400, height: 200, isHorizontal: true },
        P2: { id: 'P2', x: 40, y: 320, width: 400, height: 200, isHorizontal: true },
      },
      edges: {
        MF_1: {
          id: 'MF_1',
          messageVisibleKind: 'non_initiating',
          waypoints: [
            { x: 200, y: 240 },
            { x: 200, y: 280 },
            { x: 260, y: 280 },
            { x: 260, y: 320 },
          ],
        },
      },
    })

    const importData = await parseBpmnXml(xml)

    expect((importData.edges.find((edge) => edge.id === 'MF_1')?.data as { bpmn?: { messageVisibleKind?: string } } | undefined)?.bpmn?.messageVisibleKind).toBe('non_initiating')
  })

  it('解析显式注入 initiating 的 BPMNEdge 时应恢复 data.bpmn.messageVisibleKind（formal-11-01-03 §12.2.3.4）', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [
          { id: 'Process_1', elements: [] },
          { id: 'Process_2', elements: [] },
        ],
        collaboration: {
          id: 'Collab_1',
          participants: [
            { id: 'P1', name: '发送方', processRef: 'Process_1' },
            { id: 'P2', name: '接收方', processRef: 'Process_2' },
          ],
          messageFlows: [{ id: 'MF_2', sourceRef: 'P1', targetRef: 'P2' }],
        },
        shapes: {
          P1: { id: 'P1', x: 40, y: 40, width: 400, height: 200, isHorizontal: true },
          P2: { id: 'P2', x: 40, y: 320, width: 400, height: 200, isHorizontal: true },
        },
        edges: {
          MF_2: {
            id: 'MF_2',
            waypoints: [
              { x: 220, y: 240 },
              { x: 220, y: 280 },
              { x: 280, y: 280 },
              { x: 280, y: 320 },
            ],
          },
        },
      }),
      /(<bpmndi:BPMNEdge\b[^>]*id="MF_2_di"[^>]*)>/,
      '$1 messageVisibleKind="initiating">',
      '应能为消息流 BPMNEdge 注入 initiating 属性',
    )

    const importData = await parseBpmnXml(xml)
    expect((importData.edges.find((edge) => edge.id === 'MF_2')?.data as { bpmn?: { messageVisibleKind?: string } } | undefined)?.bpmn?.messageVisibleKind).toBe('initiating')
  })

  it('BPMNEdge 缺少 DI id 时不应误恢复 messageVisibleKind', async () => {
    const xml = replaceXmlOrThrow(
      await buildTestXml({
        processes: [
          { id: 'Process_1', elements: [] },
          { id: 'Process_2', elements: [] },
        ],
        collaboration: {
          id: 'Collab_1',
          participants: [
            { id: 'P1', name: '发送方', processRef: 'Process_1' },
            { id: 'P2', name: '接收方', processRef: 'Process_2' },
          ],
          messageFlows: [{ id: 'MF_5', sourceRef: 'P1', targetRef: 'P2' }],
        },
        shapes: {
          P1: { id: 'P1', x: 40, y: 40, width: 400, height: 200, isHorizontal: true },
          P2: { id: 'P2', x: 40, y: 320, width: 400, height: 200, isHorizontal: true },
        },
        edges: {
          MF_5: {
            id: 'MF_5',
            messageVisibleKind: 'non_initiating',
            waypoints: [
              { x: 220, y: 240 },
              { x: 280, y: 320 },
            ],
          },
        },
      }),
      /\s+id="MF_5_di"/,
      '',
      '应能移除 BPMNEdge 的 DI id 属性',
    )

    const importData = await parseBpmnXml(xml)
    expect((importData.edges.find((edge) => edge.id === 'MF_5')?.data as { bpmn?: { messageVisibleKind?: string } } | undefined)?.bpmn?.messageVisibleKind).toBeUndefined()
  })

  it('加载 non_initiating 消息流时应追加填充信封 decorator，并在导出时写出 BPMNEdge 属性', async () => {
    const graph = createTestGraph()
    const importData: BpmnImportData = {
      nodes: [
        { shape: BPMN_TASK, id: 'Task_1', x: 80, y: 120, width: 100, height: 60, attrs: { label: { text: '发送任务' } } },
        { shape: BPMN_TASK, id: 'Task_2', x: 320, y: 120, width: 100, height: 60, attrs: { label: { text: '接收任务' } } },
      ],
      edges: [
        {
          shape: BPMN_MESSAGE_FLOW,
          id: 'MF_3',
          source: 'Task_1',
          target: 'Task_2',
          labels: [{ attrs: { label: { text: '通知' } } }],
          data: { bpmn: { messageVisibleKind: 'non_initiating' } },
        },
      ],
    }

    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const edge = graph.getCellById('MF_3') as Edge
    expect((edge.getData() as { bpmn?: { messageVisibleKind?: string } }).bpmn?.messageVisibleKind).toBe('non_initiating')

    const labels = edge.getLabels()
    expect(labels).toHaveLength(2)

    const decorator = labels.find((label) =>
      Array.isArray((label as { markup?: Array<{ selector?: string }> }).markup)
      && (label as { markup?: Array<{ selector?: string }> }).markup!.some((item) => item.selector === 'messageEnvelopeGlyph'),
    ) as { attrs?: { messageEnvelopeGlyph?: { fill?: string } } } | undefined

    expect(decorator?.attrs?.messageEnvelopeGlyph?.fill).toBe('#1565c0')

    const exportedXml = await exportBpmnXml(graph)
    expect(exportedXml).toContain('messageVisibleKind="non_initiating"')
    expect(exportedXml).toContain('name="通知"')

    graph.dispose()
  })

  it('加载 initiating 消息流时应追加空心信封 decorator，并在导出时回落为 BPMNDI 默认语义', async () => {
    const graph = createTestGraph()
    const importData: BpmnImportData = {
      nodes: [
        { shape: BPMN_TASK, id: 'Task_1', x: 80, y: 120, width: 100, height: 60, attrs: { label: { text: '发送任务' } } },
        { shape: BPMN_TASK, id: 'Task_2', x: 320, y: 120, width: 100, height: 60, attrs: { label: { text: '接收任务' } } },
      ],
      edges: [
        {
          shape: BPMN_MESSAGE_FLOW,
          id: 'MF_4',
          source: 'Task_1',
          target: 'Task_2',
          data: { bpmn: { messageVisibleKind: 'initiating' } },
        },
      ],
    }

    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const edge = graph.getCellById('MF_4') as Edge
    const labels = edge.getLabels()
    expect(labels).toHaveLength(1)

    const decorator = labels[0] as { attrs?: { messageEnvelopeGlyph?: { fill?: string } } }
    expect(decorator.attrs?.messageEnvelopeGlyph?.fill).toBe('#fff')

    const exportedXml = await exportBpmnXml(graph)
    expect(exportedXml).not.toContain('messageVisibleKind=')
    expect(exportedXml).toContain('<bpmndi:BPMNEdge id="MF_4_di" bpmnElement="MF_4">')

    graph.dispose()
  })

  it('加载未声明 messageVisibleKind 的消息流时应移除已有 decorator 标签', () => {
    const graph = createTestGraph()
    const importData: BpmnImportData = {
      nodes: [
        { shape: BPMN_TASK, id: 'Task_1', x: 80, y: 120, width: 100, height: 60, attrs: { label: { text: '发送任务' } } },
        { shape: BPMN_TASK, id: 'Task_2', x: 320, y: 120, width: 100, height: 60, attrs: { label: { text: '接收任务' } } },
      ],
      edges: [
        {
          shape: BPMN_MESSAGE_FLOW,
          id: 'MF_6',
          source: 'Task_1',
          target: 'Task_2',
          labels: [
            { attrs: { label: { text: '通知' } } },
            {
              position: 0.5,
              markup: [{ tagName: 'text', selector: 'messageEnvelopeGlyph' }],
              attrs: { messageEnvelopeGlyph: { text: '✉', fill: '#1565c0' } },
            } as unknown as { attrs: { label: { text: string } } },
          ],
        },
      ],
    }

    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const edge = graph.getCellById('MF_6') as Edge
    expect(edge.getLabels()).toHaveLength(1)
    expect(edge.getLabels()[0].attrs?.label?.text).toBe('通知')

    graph.dispose()
  })

  it('加载声明 messageVisibleKind 的消息流时应容忍空标签槽并追加 decorator', () => {
    const graph = createTestGraph()
    const importData: BpmnImportData = {
      nodes: [
        { shape: BPMN_TASK, id: 'Task_1', x: 80, y: 120, width: 100, height: 60, attrs: { label: { text: '发送任务' } } },
        { shape: BPMN_TASK, id: 'Task_2', x: 320, y: 120, width: 100, height: 60, attrs: { label: { text: '接收任务' } } },
      ],
      edges: [
        {
          shape: BPMN_MESSAGE_FLOW,
          id: 'MF_7',
          source: 'Task_1',
          target: 'Task_2',
          labels: [
            null as unknown as { attrs: { label: { text: string } } },
            { attrs: { label: { text: '通知' } } },
          ],
          data: { bpmn: { messageVisibleKind: 'non_initiating' } },
        },
      ],
    }

    loadBpmnGraph(graph, importData, { zoomToFit: false })

    const edge = graph.getCellById('MF_7') as Edge
    const labels = edge.getLabels()

    expect(labels.some((label) => label == null)).toBe(true)
    expect(labels.filter((label) => label?.attrs?.label?.text === '通知')).toHaveLength(1)
    expect(
      labels.filter((label) =>
        Array.isArray(label?.markup)
        && label.markup.some((item) => item?.selector === 'messageEnvelopeGlyph'),
      ),
    ).toHaveLength(1)

    graph.dispose()
  })
})
