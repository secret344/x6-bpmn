import { afterEach, describe, expect, it } from 'vitest'
import { Graph, type Edge, type Graph as X6Graph } from '@antv/x6'
import { parseBpmnXml, loadBpmnGraph } from '../../../src/import'
import { exportBpmnXml } from '../../../src/export/exporter'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_START_EVENT,
  BPMN_SUB_PROCESS,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'
import { buildAndValidateBpmn, validateBpmnXml } from '../../helpers/bpmn-builder'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'

const createdGraphs: X6Graph[] = []

function ensureTestShapesRegistered(): void {
  registerBehaviorTestShapes([
    BPMN_POOL,
    BPMN_LANE,
    BPMN_BOUNDARY_EVENT_TIMER,
    BPMN_SERVICE_TASK,
    BPMN_START_EVENT,
    BPMN_SUB_PROCESS,
    BPMN_USER_TASK,
  ])

  try {
    Graph.registerEdge(BPMN_SEQUENCE_FLOW, {
      inherit: 'edge',
      attrs: { line: { stroke: '#000' } },
    }, true)
  } catch {
    // 图形重复注册时保持静默。
  }
}

function createTestGraph(): X6Graph {
  ensureTestShapesRegistered()
  const graph = createBehaviorTestGraph()
  createdGraphs.push(graph)
  return graph
}

afterEach(() => {
  while (createdGraphs.length > 0) {
    const graph = createdGraphs.pop()
    if (graph) {
      destroyBehaviorTestGraph(graph)
    }
  }
})

describe('泳道结构往返', () => {
  it('应在导入时恢复 lane -> pool 和 flowNode -> lane 的父子关系', async () => {
    const { valid, xml, warnings } = await buildAndValidateBpmn({
      processes: [
        {
          id: 'Process_1',
          elements: [
            {
              kind: 'laneSet',
              id: 'LaneSet_1',
              lanes: [
                { id: 'Lane_1', name: '申请人', flowNodeRefs: ['Start_1', 'Task_1'] },
              ],
            },
            { kind: 'startEvent', id: 'Start_1', name: '开始' },
            { kind: 'userTask', id: 'Task_1', name: '填写申请' },
            { kind: 'sequenceFlow', id: 'Flow_1', sourceRef: 'Start_1', targetRef: 'Task_1' },
          ],
        },
      ],
      collaboration: {
        id: 'Collaboration_1',
        participants: [
          { id: 'Pool_1', name: '请假流程', processRef: 'Process_1' },
        ],
      },
      shapes: {
        Pool_1: { id: 'Pool_1', x: 40, y: 40, width: 680, height: 220, isHorizontal: true },
        Lane_1: { id: 'Lane_1', x: 70, y: 40, width: 650, height: 220, isHorizontal: true },
        Start_1: { id: 'Start_1', x: 120, y: 120, width: 36, height: 36 },
        Task_1: { id: 'Task_1', x: 220, y: 108, width: 120, height: 60 },
      },
      edges: {
        Flow_1: { id: 'Flow_1', waypoints: [{ x: 156, y: 138 }, { x: 220, y: 138 }] },
      },
    })

    expect(valid).toBe(true)
    expect(warnings).toEqual([])

    const importData = await parseBpmnXml(xml)
    const lane = importData.nodes.find((node) => node.id === 'Lane_1')
    const start = importData.nodes.find((node) => node.id === 'Start_1')
    const task = importData.nodes.find((node) => node.id === 'Task_1')

    expect(lane?.parent).toBe('Pool_1')
    expect(start?.parent).toBe('Lane_1')
    expect(task?.parent).toBe('Lane_1')

    const graph = createTestGraph()
    loadBpmnGraph(graph, importData, { zoomToFit: false })

    expect(graph.getCellById('Lane_1')?.getParent()?.id).toBe('Pool_1')
    expect(graph.getCellById('Start_1')?.getParent()?.id).toBe('Lane_1')
    expect(graph.getCellById('Task_1')?.getParent()?.id).toBe('Lane_1')

    const pool = graph.getCellById('Pool_1')
    const laneNode = graph.getCellById('Lane_1')
    const startNode = graph.getCellById('Start_1')
    const taskNode = graph.getCellById('Task_1')

    expect(pool?.isNode?.()).toBe(true)
    expect(laneNode?.isNode?.()).toBe(true)
    expect(startNode?.isNode?.()).toBe(true)
    expect(taskNode?.isNode?.()).toBe(true)

    const lanePositionBefore = laneNode!.getPosition()
    const startPositionBefore = startNode!.getPosition()
    const taskPositionBefore = taskNode!.getPosition()

    ;(pool as Graph.Cell).translate(80, 30)

    expect(laneNode!.getPosition()).toEqual({
      x: lanePositionBefore.x + 80,
      y: lanePositionBefore.y + 30,
    })
    expect(startNode!.getPosition()).toEqual({
      x: startPositionBefore.x + 80,
      y: startPositionBefore.y + 30,
    })
    expect(taskNode!.getPosition()).toEqual({
      x: taskPositionBefore.x + 80,
      y: taskPositionBefore.y + 30,
    })
  })

  it('应导出有效的 participant/lane 结构，并在重新导入后保留嵌套关系', async () => {
    const sourceGraph = createTestGraph()

    const pool = sourceGraph.addNode({
      shape: BPMN_POOL,
      id: 'Pool_1',
      x: 40,
      y: 40,
      width: 680,
      height: 220,
      attrs: { headerLabel: { text: '请假流程' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = sourceGraph.addNode({
      shape: BPMN_LANE,
      id: 'Lane_1',
      x: 70,
      y: 40,
      width: 650,
      height: 220,
      attrs: { headerLabel: { text: '申请人' } },
      data: { bpmn: { isHorizontal: true } },
      parent: pool.id,
    })
    const start = sourceGraph.addNode({
      shape: BPMN_START_EVENT,
      id: 'Start_1',
      x: 120,
      y: 120,
      width: 36,
      height: 36,
      attrs: { label: { text: '开始' } },
      parent: lane.id,
    })
    const task = sourceGraph.addNode({
      shape: BPMN_USER_TASK,
      id: 'Task_1',
      x: 220,
      y: 108,
      width: 120,
      height: 60,
      attrs: { label: { text: '填写申请' } },
      parent: lane.id,
    })
    sourceGraph.addEdge({
      shape: BPMN_SEQUENCE_FLOW,
      id: 'Flow_1',
      source: start,
      target: task,
    })

    const xml = await exportBpmnXml(sourceGraph, { processName: '请假流程' })
    const validation = await validateBpmnXml(xml)

    expect(validation.valid).toBe(true)
    expect(validation.warnings).toEqual([])
    expect(xml).toContain('<bpmn:participant id="Pool_1"')
    expect(xml).toContain('<bpmn:lane id="Lane_1"')
    expect(xml).toContain('<bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>')
    expect(xml).toContain('<bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>')

    const importData = await parseBpmnXml(xml)
    expect(importData.nodes.find((node) => node.id === 'Lane_1')?.parent).toBe('Pool_1')
    expect(importData.nodes.find((node) => node.id === 'Start_1')?.parent).toBe('Lane_1')
    expect(importData.nodes.find((node) => node.id === 'Task_1')?.parent).toBe('Lane_1')

    const roundtripGraph = createTestGraph()
    loadBpmnGraph(roundtripGraph, importData, { zoomToFit: false })

    expect(roundtripGraph.getCellById('Lane_1')?.getParent()?.id).toBe('Pool_1')
    expect(roundtripGraph.getCellById('Start_1')?.getParent()?.id).toBe('Lane_1')
    expect(roundtripGraph.getCellById('Task_1')?.getParent()?.id).toBe('Lane_1')
    expect((roundtripGraph.getCellById('Flow_1') as Edge | null)?.shape).toBe(BPMN_SEQUENCE_FLOW)

    const poolNode = roundtripGraph.getCellById('Pool_1')
    const laneNode = roundtripGraph.getCellById('Lane_1')
    const startNode = roundtripGraph.getCellById('Start_1')
    const taskNode = roundtripGraph.getCellById('Task_1')

    const lanePositionBefore = laneNode!.getPosition()
    const startPositionBefore = startNode!.getPosition()
    const taskPositionBefore = taskNode!.getPosition()

    ;(poolNode as Graph.Cell).translate(60, 25)

    expect(laneNode!.getPosition()).toEqual({
      x: lanePositionBefore.x + 60,
      y: lanePositionBefore.y + 25,
    })
    expect(startNode!.getPosition()).toEqual({
      x: startPositionBefore.x + 60,
      y: startPositionBefore.y + 25,
    })
    expect(taskNode!.getPosition()).toEqual({
      x: taskPositionBefore.x + 60,
      y: taskPositionBefore.y + 25,
    })
  })

  it('应按祖先泳道关系为边界事件导出 lane flowNodeRef', async () => {
    const graph = createTestGraph()

    const pool = graph.addNode({
      shape: BPMN_POOL,
      id: 'Pool_1',
      x: 40,
      y: 40,
      width: 680,
      height: 220,
      attrs: { headerLabel: { text: '请假流程' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      shape: BPMN_LANE,
      id: 'Lane_1',
      x: 70,
      y: 40,
      width: 650,
      height: 220,
      attrs: { headerLabel: { text: '申请人' } },
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane)

    const task = graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'Task_1',
      x: 220,
      y: 108,
      width: 120,
      height: 60,
      attrs: { label: { text: '填写申请' } },
    })
    lane.embed(task)

    const boundary = graph.addNode({
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      id: 'Boundary_1',
      x: 302,
      y: 120,
      width: 36,
      height: 36,
      attrs: { label: { text: '超时提醒' } },
    })
    task.embed(boundary)

    const xml = await exportBpmnXml(graph, { processName: '请假流程' })

    expect(xml).toContain('<bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>')
    expect(xml).toContain('<bpmn:flowNodeRef>Boundary_1</bpmn:flowNodeRef>')

    const importData = await parseBpmnXml(xml)

    expect(importData.nodes.find((node) => node.id === 'Lane_1')?.parent).toBe('Pool_1')
    expect(importData.nodes.find((node) => node.id === 'Task_1')?.parent).toBe('Lane_1')
    expect(importData.nodes.find((node) => node.id === 'Boundary_1')?.parent).toBe('Task_1')
  })

  it('应在导出再导入后保留 lane -> 子流程 -> 内部节点/边界事件 的父子链', async () => {
    const graph = createTestGraph()

    const pool = graph.addNode({
      shape: BPMN_POOL,
      id: 'Pool_1',
      x: 40,
      y: 40,
      width: 680,
      height: 220,
      attrs: { headerLabel: { text: '请假流程' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      shape: BPMN_LANE,
      id: 'Lane_1',
      x: 70,
      y: 40,
      width: 650,
      height: 220,
      attrs: { headerLabel: { text: '申请人' } },
      data: { bpmn: { isHorizontal: true } },
    })
    pool.embed(lane)

    const subProcess = graph.addNode({
      shape: BPMN_SUB_PROCESS,
      id: 'Sub_1',
      x: 180,
      y: 90,
      width: 220,
      height: 120,
      attrs: { label: { text: '审批子流程' } },
    })
    lane.embed(subProcess)

    const start = graph.addNode({
      shape: BPMN_START_EVENT,
      id: 'Start_1',
      x: 196,
      y: 132,
      width: 36,
      height: 36,
      attrs: { label: { text: '开始' } },
    })
    subProcess.embed(start)

    const serviceTask = graph.addNode({
      shape: BPMN_SERVICE_TASK,
      id: 'Task_1',
      x: 230,
      y: 120,
      width: 120,
      height: 60,
      attrs: { label: { text: '服务任务' } },
    })
    subProcess.embed(serviceTask)

    const boundary = graph.addNode({
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      id: 'Boundary_1',
      x: 362,
      y: 132,
      width: 36,
      height: 36,
      attrs: { label: { text: '超时提醒' } },
    })
    subProcess.embed(boundary)

    graph.addEdge({
      shape: BPMN_SEQUENCE_FLOW,
      id: 'Flow_1',
      source: start,
      target: serviceTask,
    })

    const xml = await exportBpmnXml(graph, { processName: '请假流程' })

    expect(xml).toContain('<bpmn:subProcess id="Sub_1"')
    expect(xml).toContain('<bpmn:startEvent id="Start_1"')
    expect(xml).toContain('<bpmn:serviceTask id="Task_1"')
    expect(xml).toContain('<bpmn:boundaryEvent id="Boundary_1"')
    expect(xml).toContain('<bpmn:sequenceFlow id="Flow_1"')

    const importData = await parseBpmnXml(xml)

    expect(importData.nodes.find((node) => node.id === 'Lane_1')?.parent).toBe('Pool_1')
    expect(importData.nodes.find((node) => node.id === 'Sub_1')?.parent).toBe('Lane_1')
    expect(importData.nodes.find((node) => node.id === 'Start_1')?.parent).toBe('Sub_1')
    expect(importData.nodes.find((node) => node.id === 'Task_1')?.parent).toBe('Sub_1')
    expect(importData.nodes.find((node) => node.id === 'Boundary_1')?.parent).toBe('Sub_1')

    const roundtripGraph = createTestGraph()
    loadBpmnGraph(roundtripGraph, importData, { zoomToFit: false })

    expect(roundtripGraph.getCellById('Lane_1')?.getParent()?.id).toBe('Pool_1')
    expect(roundtripGraph.getCellById('Sub_1')?.getParent()?.id).toBe('Lane_1')
    expect(roundtripGraph.getCellById('Start_1')?.getParent()?.id).toBe('Sub_1')
    expect(roundtripGraph.getCellById('Task_1')?.getParent()?.id).toBe('Sub_1')
    expect(roundtripGraph.getCellById('Boundary_1')?.getParent()?.id).toBe('Sub_1')
    expect((roundtripGraph.getCellById('Flow_1') as Edge | null)?.shape).toBe(BPMN_SEQUENCE_FLOW)
  })
})