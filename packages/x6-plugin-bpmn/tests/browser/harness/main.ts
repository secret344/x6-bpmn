import { Graph, type Cell, type Node } from '@antv/x6'
import {
  registerBpmnShapes,
  setupPoolContainment,
  setupBoundaryAttach,
  attachBoundaryToHost,
  exportBpmnXml,
  importBpmnXml,
  createBpmnValidateConnection,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_USER_TASK,
} from '../../../dist/index.mjs'

type NodeSnapshot = {
  id: string
  x: number
  y: number
  width: number
  height: number
  parentId: string | null
}

type ScenarioIds = {
  poolId: string
  laneId: string
  taskId: string
  boundaryId?: string
}

type MessageScenarioIds = {
  leftPoolId: string
  rightPoolId: string
  leftLaneId: string
  rightLaneId: string
  sourceTaskId: string
  targetTaskId: string
}

type EdgeSnapshot = {
  id: string
  shape: string
  sourceId: string | null
  targetId: string | null
}

declare global {
  interface Window {
    __x6PluginBrowserHarness?: {
      clear: () => void
      createPoolLaneTaskScenario: () => ScenarioIds
      createPoolLaneTaskBoundaryScenario: () => ScenarioIds
      createTwoPoolMessageScenario: () => MessageScenarioIds
      getNodeSnapshot: (id: string) => NodeSnapshot
      getEdgeSnapshotByShape: (shape: string) => EdgeSnapshot
      validateConnection: (args: { shape: string; sourceId: string; targetId: string }) => boolean
      addEdge: (args: { shape: string; sourceId: string; targetId: string }) => EdgeSnapshot
      translateNode: (id: string, delta: { x: number; y: number }) => void
      resizeNode: (id: string, size: { width: number; height: number }) => void
      roundtripXml: () => Promise<string>
      simulateInvalidMoveWithParentLoss: (args: {
        nodeId: string
        parentId: string
        x: number
        y: number
        eventName?: 'node:moving' | 'node:moved'
      }) => void
    }
  }
}

registerBpmnShapes()

let currentEdgeShape = BPMN_SEQUENCE_FLOW

const container = document.querySelector<HTMLDivElement>('#graph')
if (!container) {
  throw new Error('未找到浏览器测试画布容器')
}

const graph = new Graph({
  container,
  width: 1200,
  height: 800,
  embedding: { enabled: true },
  connecting: {
    createEdge() {
      return graph.createEdge({ shape: currentEdgeShape })
    },
    validateConnection: createBpmnValidateConnection(() => currentEdgeShape),
  },
})

setupBoundaryAttach(graph)
setupPoolContainment(graph)

function emitGraphEvent(eventName: 'node:added' | 'node:moving' | 'node:moved', payload: { node: Node }): void {
  const eventGraph = graph as Graph & {
    trigger?: (name: string, args: unknown) => void
    emit?: (name: string, args: unknown) => void
  }

  if (typeof eventGraph.trigger === 'function') {
    eventGraph.trigger(eventName, payload)
    return
  }

  if (typeof eventGraph.emit === 'function') {
    eventGraph.emit(eventName, payload)
  }
}

function clear(): void {
  const resettableGraph = graph as Graph & { resetCells?: (cells: Cell[]) => void }
  if (typeof resettableGraph.resetCells === 'function') {
    resettableGraph.resetCells([])
    return
  }

  graph.clearCells()
}

function getNodeSnapshot(id: string): NodeSnapshot {
  const cell = graph.getCellById(id)
  if (!cell?.isNode?.()) {
    throw new Error(`未找到节点: ${id}`)
  }

  const node = cell as Node
  const position = node.getPosition()
  const size = node.getSize()

  return {
    id: node.id,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    parentId: node.getParent()?.id ?? null,
  }
}

function getEdgeSnapshotByShape(shape: string): EdgeSnapshot {
  const edge = graph.getEdges().find((candidate) => candidate.shape === shape)
  if (!edge) {
    throw new Error(`未找到连线类型: ${shape}`)
  }

  return {
    id: edge.id,
    shape: edge.shape,
    sourceId: edge.getSourceCellId?.() ?? null,
    targetId: edge.getTargetCellId?.() ?? null,
  }
}

function createPoolLaneTaskScenario(): ScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-1',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 400,
    height: 220,
    attrs: { headerLabel: { text: 'Pool' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const lane = graph.addNode({
    id: 'lane-1',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 370,
    height: 120,
    parent: pool.id,
    attrs: { headerLabel: { text: 'Lane' } },
    data: { bpmn: { isHorizontal: true } },
  })
  pool.embed(lane)

  const task = graph.addNode({
    id: 'task-1',
    shape: BPMN_USER_TASK,
    x: 120,
    y: 70,
    width: 100,
    height: 60,
    parent: lane.id,
    attrs: { label: { text: 'Task' } },
  })
  lane.embed(task)
  emitGraphEvent('node:added', { node: task })

  return {
    poolId: pool.id,
    laneId: lane.id,
    taskId: task.id,
  }
}

function createPoolLaneTaskBoundaryScenario(): ScenarioIds {
  const scenario = createPoolLaneTaskScenario()

  const boundary = graph.addNode({
    id: 'boundary-1',
    shape: BPMN_BOUNDARY_EVENT_TIMER,
    x: 202,
    y: 82,
    width: 36,
    height: 36,
    attrs: { label: { text: 'Timer' } },
  })

  const task = graph.getCellById(scenario.taskId)
  if (!task?.isNode?.()) {
    throw new Error('无法定位边界事件宿主任务')
  }

  attachBoundaryToHost(graph, boundary, task as Node)

  return {
    ...scenario,
    boundaryId: boundary.id,
  }
}

function createTwoPoolMessageScenario(): MessageScenarioIds {
  clear()

  const leftPool = graph.addNode({
    id: 'pool-left',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 340,
    height: 220,
    attrs: { headerLabel: { text: 'LeftPool' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const leftLane = graph.addNode({
    id: 'lane-left',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 310,
    height: 220,
    parent: leftPool.id,
    attrs: { headerLabel: { text: 'LeftLane' } },
    data: { bpmn: { isHorizontal: true } },
  })
  leftPool.embed(leftLane)

  const rightPool = graph.addNode({
    id: 'pool-right',
    shape: BPMN_POOL,
    x: 480,
    y: 40,
    width: 340,
    height: 220,
    attrs: { headerLabel: { text: 'RightPool' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const rightLane = graph.addNode({
    id: 'lane-right',
    shape: BPMN_LANE,
    x: 510,
    y: 40,
    width: 310,
    height: 220,
    parent: rightPool.id,
    attrs: { headerLabel: { text: 'RightLane' } },
    data: { bpmn: { isHorizontal: true } },
  })
  rightPool.embed(rightLane)

  const sourceTask = graph.addNode({
    id: 'task-left',
    shape: BPMN_USER_TASK,
    x: 150,
    y: 110,
    width: 110,
    height: 60,
    parent: leftLane.id,
    attrs: { label: { text: 'SourceTask' } },
  })
  leftLane.embed(sourceTask)
  emitGraphEvent('node:added', { node: sourceTask })

  const targetTask = graph.addNode({
    id: 'task-right',
    shape: BPMN_SERVICE_TASK,
    x: 590,
    y: 110,
    width: 110,
    height: 60,
    parent: rightLane.id,
    attrs: { label: { text: 'TargetTask' } },
  })
  rightLane.embed(targetTask)
  emitGraphEvent('node:added', { node: targetTask })

  return {
    leftPoolId: leftPool.id,
    rightPoolId: rightPool.id,
    leftLaneId: leftLane.id,
    rightLaneId: rightLane.id,
    sourceTaskId: sourceTask.id,
    targetTaskId: targetTask.id,
  }
}

function validateConnection(args: { shape: string; sourceId: string; targetId: string }): boolean {
  const source = graph.getCellById(args.sourceId)
  const target = graph.getCellById(args.targetId)
  const validate = graph.options.connecting?.validateConnection

  if (!source?.isNode?.() || !target?.isNode?.() || typeof validate !== 'function') {
    throw new Error('无法执行浏览器连线校验')
  }

  currentEdgeShape = args.shape
  return validate({
    edge: graph.createEdge({ shape: args.shape }),
    sourceCell: source,
    targetCell: target,
    targetMagnet: {} as object,
  })
}

function addEdge(args: { shape: string; sourceId: string; targetId: string }): EdgeSnapshot {
  const source = graph.getCellById(args.sourceId)
  const target = graph.getCellById(args.targetId)
  if (!source?.isNode?.() || !target?.isNode?.()) {
    throw new Error('无法定位待连线的源节点或目标节点')
  }

  const edge = graph.addEdge({
    shape: args.shape,
    source,
    target,
  })

  return {
    id: edge.id,
    shape: edge.shape,
    sourceId: edge.getSourceCellId?.() ?? null,
    targetId: edge.getTargetCellId?.() ?? null,
  }
}

function translateNode(id: string, delta: { x: number; y: number }): void {
  const cell = graph.getCellById(id)
  if (!cell?.isNode?.()) {
    throw new Error(`无法定位待移动节点: ${id}`)
  }

  ;(cell as Node).translate(delta.x, delta.y)
}

function resizeNode(id: string, size: { width: number; height: number }): void {
  const cell = graph.getCellById(id)
  if (!cell?.isNode?.()) {
    throw new Error(`无法定位待缩放节点: ${id}`)
  }

  ;(cell as Node).resize(size.width, size.height)
}

async function roundtripXml(): Promise<string> {
  const xml = await exportBpmnXml(graph, { processName: '浏览器测试流程' })
  await importBpmnXml(graph, xml, { zoomToFit: false })
  return xml
}

function simulateInvalidMoveWithParentLoss(args: {
  nodeId: string
  parentId: string
  x: number
  y: number
  eventName?: 'node:moving' | 'node:moved'
}): void {
  const { nodeId, parentId, x, y, eventName = 'node:moved' } = args
  const parent = graph.getCellById(parentId)
  const cell = graph.getCellById(nodeId)

  if (!parent?.isNode?.() || !cell?.isNode?.()) {
    throw new Error(`无法定位待恢复父链的节点: ${nodeId}`)
  }

  const node = cell as Node
  ;(parent as Node).unembed(node)
  node.setPosition(x, y)
  emitGraphEvent(eventName, { node })
}

window.__x6PluginBrowserHarness = {
  clear,
  createPoolLaneTaskScenario,
  createPoolLaneTaskBoundaryScenario,
  createTwoPoolMessageScenario,
  getNodeSnapshot,
  getEdgeSnapshotByShape,
  validateConnection,
  addEdge,
  translateNode,
  resizeNode,
  roundtripXml,
  simulateInvalidMoveWithParentLoss,
}