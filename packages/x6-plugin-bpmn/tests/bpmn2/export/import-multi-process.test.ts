import { describe, it, expect, beforeAll } from 'vitest'
import { Graph } from '@antv/x6'
import { buildTestXml } from '../../helpers/xml-test-utils'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import {
  BPMN_POOL,
  BPMN_START_EVENT,
  BPMN_USER_TASK,
  BPMN_END_EVENT,
  BPMN_SEQUENCE_FLOW,
} from '../../../src/utils/constants'

let registered = false

function ensureShapesRegistered() {
  if (registered) return

  for (const shapeName of [BPMN_POOL, BPMN_START_EVENT, BPMN_USER_TASK, BPMN_END_EVENT]) {
    try {
      Graph.registerNode(shapeName, {
        inherit: 'rect',
        attrs: {
          body: { fill: '#fff', stroke: '#000' },
          headerLabel: { text: '' },
          label: { text: '' },
        },
      }, true)
    } catch {
      // 图形已注册时忽略
    }
  }

  try {
    Graph.registerEdge(BPMN_SEQUENCE_FLOW, {
      inherit: 'edge',
      attrs: { line: { stroke: '#000' } },
    }, true)
  } catch {
    // 图形已注册时忽略
  }

  registered = true
}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 1200, height: 800 })
}

describe('parseBpmnXml + loadBpmnGraph — 多 process 协作图导入', () => {
  beforeAll(() => {
    ensureShapesRegistered()
  })

  it('应导入 collaboration 下所有 process 的节点与顺序流，而不是只取第一个 process', async () => {
    const xml = await buildTestXml({
      processes: [
        {
          id: 'Process_A',
          elements: [
            { kind: 'startEvent', id: 'Start_A', name: '开始A' },
            { kind: 'userTask', id: 'Task_A', name: '任务A' },
            { kind: 'endEvent', id: 'End_A', name: '结束A' },
            { kind: 'sequenceFlow', id: 'Flow_A1', sourceRef: 'Start_A', targetRef: 'Task_A' },
            { kind: 'sequenceFlow', id: 'Flow_A2', sourceRef: 'Task_A', targetRef: 'End_A' },
          ],
        },
        {
          id: 'Process_B',
          elements: [
            { kind: 'startEvent', id: 'Start_B', name: '开始B' },
            { kind: 'userTask', id: 'Task_B', name: '任务B' },
            { kind: 'endEvent', id: 'End_B', name: '结束B' },
            { kind: 'sequenceFlow', id: 'Flow_B1', sourceRef: 'Start_B', targetRef: 'Task_B' },
            { kind: 'sequenceFlow', id: 'Flow_B2', sourceRef: 'Task_B', targetRef: 'End_B' },
          ],
        },
      ],
      collaboration: {
        id: 'Collab_1',
        participants: [
          { id: 'Pool_A', name: '参与者A', processRef: 'Process_A' },
          { id: 'Pool_B', name: '参与者B', processRef: 'Process_B' },
        ],
      },
      shapes: {
        Pool_A: { id: 'Pool_A', x: 40, y: 40, width: 500, height: 240, isHorizontal: true },
        Pool_B: { id: 'Pool_B', x: 40, y: 340, width: 500, height: 240, isHorizontal: true },
        Start_A: { id: 'Start_A', x: 120, y: 120, width: 36, height: 36 },
        Task_A: { id: 'Task_A', x: 220, y: 108, width: 100, height: 60 },
        End_A: { id: 'End_A', x: 380, y: 120, width: 36, height: 36 },
        Start_B: { id: 'Start_B', x: 120, y: 420, width: 36, height: 36 },
        Task_B: { id: 'Task_B', x: 220, y: 408, width: 100, height: 60 },
        End_B: { id: 'End_B', x: 380, y: 420, width: 36, height: 36 },
      },
      edges: {
        Flow_A1: { id: 'Flow_A1', waypoints: [{ x: 156, y: 138 }, { x: 220, y: 138 }] },
        Flow_A2: { id: 'Flow_A2', waypoints: [{ x: 320, y: 138 }, { x: 380, y: 138 }] },
        Flow_B1: { id: 'Flow_B1', waypoints: [{ x: 156, y: 438 }, { x: 220, y: 438 }] },
        Flow_B2: { id: 'Flow_B2', waypoints: [{ x: 320, y: 438 }, { x: 380, y: 438 }] },
      },
    })

    const importData = await parseBpmnXml(xml)

    expect(importData.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'Pool_A',
      'Pool_B',
      'Start_A',
      'Task_A',
      'End_A',
      'Start_B',
      'Task_B',
      'End_B',
    ]))
    expect(importData.edges.map((edge) => edge.id)).toEqual(expect.arrayContaining([
      'Flow_A1',
      'Flow_A2',
      'Flow_B1',
      'Flow_B2',
    ]))

    const graph = createTestGraph()
    loadBpmnGraph(graph, importData, { zoomToFit: false })

    expect(graph.getNodes().map((node) => node.id)).toEqual(expect.arrayContaining([
      'Start_A',
      'Task_A',
      'End_A',
      'Start_B',
      'Task_B',
      'End_B',
    ]))
    expect(graph.getEdges().map((edge) => edge.id)).toEqual(expect.arrayContaining([
      'Flow_A1',
      'Flow_A2',
      'Flow_B1',
      'Flow_B2',
    ]))

    graph.dispose()
  })
})