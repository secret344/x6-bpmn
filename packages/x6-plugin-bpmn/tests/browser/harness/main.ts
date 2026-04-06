import { Graph, type Cell, type Edge, type Node } from '@antv/x6'
import { Selection } from '@antv/x6-plugin-selection'
import { Transform } from '@antv/x6-plugin-transform'
import {
  registerBpmnShapes,
  setupPoolContainment,
  setupBoundaryAttach,
  attachBoundaryToHost,
  exportBpmnXml,
  importBpmnXml,
  createBpmnValidateConnection,
  createBpmnValidateEdge,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_USER_TASK,
} from '../../../src/index'

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
      getSelectedCellIds: () => string[]
      getEdgeSnapshotByShape: (shape: string) => EdgeSnapshot
      getEdgeCountByShape: (shape: string) => number
      roundtripXml: () => Promise<string>
    }
  }
}

registerBpmnShapes()

let currentEdgeShape = BPMN_SEQUENCE_FLOW

const container = document.querySelector<HTMLDivElement>('#graph')
if (!container) {
  throw new Error('未找到浏览器测试画布容器')
}

let graph!: Graph

graph = new Graph({
  container,
  width: 1200,
  height: 800,
  embedding: { enabled: true },
  connecting: {
    createEdge(): Edge {
      return graph.createEdge({ shape: currentEdgeShape })
    },
    validateConnection: createBpmnValidateConnection(() => currentEdgeShape),
    validateEdge: createBpmnValidateEdge(() => currentEdgeShape),
  },
})

graph.use(
  new Selection({
    enabled: true,
    multiple: false,
    rubberband: false,
    movable: true,
    showNodeSelectionBox: true,
  }),
)
graph.use(
  new Transform({
    resizing: { enabled: true },
    rotating: { enabled: false },
  }),
)

setupBoundaryAttach(graph)
setupPoolContainment(graph)

const edgeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-edge-shape]'))

function setCurrentEdgeShape(shape: string): void {
  currentEdgeShape = shape
  edgeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.edgeShape === shape)
  })
}

edgeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const shape = button.dataset.edgeShape
    if (shape) {
      setCurrentEdgeShape(shape)
    }
  })
})

setCurrentEdgeShape(BPMN_SEQUENCE_FLOW)

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
  setCurrentEdgeShape(BPMN_SEQUENCE_FLOW)

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

function getSelectedCellIds(): string[] {
  const selectableGraph = graph as Graph & { getSelectedCells?: () => Cell[] }
  if (typeof selectableGraph.getSelectedCells !== 'function') {
    return []
  }

  return selectableGraph.getSelectedCells().map((cell) => cell.id)
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

function getEdgeCountByShape(shape: string): number {
  return graph.getEdges().filter((candidate) => candidate.shape === shape).length
}

function getNodeLayerPriority(node: Node): number {
  if (node.shape === BPMN_POOL) return 0
  if (node.shape === BPMN_LANE) return 1
  if (node.shape.startsWith('bpmn-boundary-event')) return 3
  return 2
}

function normalizeNodeLayers(): void {
  graph.getNodes()
    .slice()
    .sort((left, right) => getNodeLayerPriority(left) - getNodeLayerPriority(right))
    .forEach((node) => {
      node.toFront()
    })
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
  normalizeNodeLayers()

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
  normalizeNodeLayers()

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
  normalizeNodeLayers()

  return {
    leftPoolId: leftPool.id,
    rightPoolId: rightPool.id,
    leftLaneId: leftLane.id,
    rightLaneId: rightLane.id,
    sourceTaskId: sourceTask.id,
    targetTaskId: targetTask.id,
  }
}

async function roundtripXml(): Promise<string> {
  const xml = await exportBpmnXml(graph, { processName: '浏览器测试流程' })
  await importBpmnXml(graph, xml, { zoomToFit: false })
  normalizeNodeLayers()
  return xml
}

window.__x6PluginBrowserHarness = {
  clear,
  createPoolLaneTaskScenario,
  createPoolLaneTaskBoundaryScenario,
  createTwoPoolMessageScenario,
  getNodeSnapshot,
  getSelectedCellIds,
  getEdgeSnapshotByShape,
  getEdgeCountByShape,
  roundtripXml,
}