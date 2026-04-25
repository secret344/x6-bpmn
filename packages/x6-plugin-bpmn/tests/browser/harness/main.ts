import { Graph, type Cell, type Edge, type Node } from '@antv/x6'
import { Keyboard } from '@antv/x6/lib/plugin/keyboard'
import { Selection } from '@antv/x6/lib/plugin/selection'
import { Transform } from '@antv/x6/lib/plugin/transform'
import {
  setupBpmnGraph,
  attachBoundaryToHost,
  exportBpmnXml,
  importBpmnXml,
  addLaneToPool,
  resolveBpmnEmbeddingTargets,
  createBpmnValidateConnectionWithResult,
  createBpmnValidateEdgeWithResult,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_END_EVENT,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_LANE,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_SEND_TASK,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_START_EVENT,
  BPMN_TRANSACTION,
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

type StandaloneTaskScenarioIds = {
  taskId: string
}

type TransactionWrapScenarioIds = {
  transactionId: string
  startId: string
}

type PoolLaneTransactionScenarioIds = {
  poolId: string
  transactionId: string
}

type PoolTwoLaneTransactionInternalScenarioIds = {
  poolId: string
  lane1Id: string
  lane2Id: string
  transactionId: string
  taskId: string
}

type PoolTwoLaneTransactionExtractionScenarioIds = {
  poolId: string
  lane1Id: string
  lane2Id: string
  transactionId: string
  taskId: string
  peerTaskId: string
}

type FirstPoolWrapScenarioIds = {
  poolId: string
  taskId: string
}

type MessageScenarioIds = {
  leftPoolId: string
  rightPoolId: string
  leftLaneId: string
  rightLaneId: string
  sourceTaskId: string
  targetTaskId: string
}

type MultiLaneScenarioIds = {
  poolId: string
  lane1Id: string
  lane2Id: string
  taskId: string
  startId: string
  endId: string
  gatewayId: string
  task2Id: string
  sendTaskId: string
  serviceTaskId: string
}

type AddedLaneScenarioIds = {
  laneId: string
  addedTaskId: string
}

type AddedLaneOnlyScenarioIds = {
  laneId: string
}

type EdgeSnapshot = {
  id: string
  shape: string
  sourceId: string | null
  targetId: string | null
}

type ConnectResult = {
  ok: boolean
  edgeId: string | null
  shape: string
  reason?: string
}

declare global {
  interface Window {
    __x6PluginBrowserHarness?: {
      clear: () => void
      setViewportTransform: (tx: number, ty: number, scale?: number) => void
      createStandaloneTaskScenario: () => StandaloneTaskScenarioIds
      createTransactionWrapScenario: () => TransactionWrapScenarioIds
      createPoolLaneTransactionScenario: () => PoolLaneTransactionScenarioIds
      createPoolTwoLaneTransactionInternalScenario: () => PoolTwoLaneTransactionInternalScenarioIds
      createPoolTwoLaneTransactionExtractionScenario: () => PoolTwoLaneTransactionExtractionScenarioIds
      addFirstPoolScenario: () => FirstPoolWrapScenarioIds
      createPoolLaneTaskScenario: () => ScenarioIds
      createPoolLaneTaskBoundaryScenario: () => ScenarioIds
      createTwoPoolMessageScenario: () => MessageScenarioIds
      createMultiLaneScenario: () => MultiLaneScenarioIds
      createExampleLikeMultiLaneScenario: () => MultiLaneScenarioIds
      createExampleLikeLowTopLaneScenario: () => MultiLaneScenarioIds
      createExampleLikeAddedLowTopLaneScenario: () => MultiLaneScenarioIds & AddedLaneOnlyScenarioIds
      addLaneToPoolScenario: (poolId: string) => AddedLaneScenarioIds | null
      removeNode: (id: string) => boolean
      selectCell: (id: string) => string[]
      removeSelectedCells: () => string[]
      getNodeSnapshot: (id: string) => NodeSnapshot
      getPoolLaneSnapshots: (poolId: string) => NodeSnapshot[]
      getSelectedCellIds: () => string[]
      connectNodes: (args: {
        sourceId: string
        sourceGroup: 'left' | 'right' | 'top' | 'bottom'
        targetId: string
        targetGroup: 'left' | 'right' | 'top' | 'bottom'
      }) => ConnectResult
      getEdgeSnapshotByShape: (shape: string) => EdgeSnapshot
      getEdgeCountByShape: (shape: string) => number
      roundtripXml: () => Promise<string>
    }
  }
}

let currentEdgeShape = BPMN_SEQUENCE_FLOW

const container = document.querySelector<HTMLDivElement>('#graph')
if (!container) {
  throw new Error('未找到浏览器测试画布容器')
}

let graph!: Graph
const validateConnectionWithResult = createBpmnValidateConnectionWithResult(() => currentEdgeShape)
const validateEdgeWithResult = createBpmnValidateEdgeWithResult(() => currentEdgeShape)

graph = new Graph({
  container,
  width: 1200,
  height: 800,
  embedding: {
    enabled: true,
    findParent({ node }) {
      return resolveBpmnEmbeddingTargets(this, node)
    },
  },
  connecting: {},
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
graph.use(
  new Keyboard({
    enabled: true,
    global: true,
  }),
)

graph.bindKey(['backspace', 'delete'], () => {
  const selectableGraph = graph as Graph & { getSelectedCells?: () => Cell[] }
  const selectedCells = selectableGraph.getSelectedCells?.() ?? []
  if (selectedCells.length) {
    graph.removeCells(selectedCells)
  }
  return false
})

setupBpmnGraph(graph, {
  edgeShape: () => currentEdgeShape,
})

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
  setViewportTransform(0, 0, 1)

  const resettableGraph = graph as Graph & { resetCells?: (cells: Cell[]) => void }
  if (typeof resettableGraph.resetCells === 'function') {
    resettableGraph.resetCells([])
    return
  }

  graph.clearCells()
}

function setViewportTransform(tx: number, ty: number, scale = 1): void {
  graph.zoomTo(scale)
  graph.translate(tx, ty)
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

function getPoolLaneSnapshots(poolId: string): NodeSnapshot[] {
  return graph
    .getNodes()
    .filter((node) => node.shape === BPMN_LANE && node.getParent()?.id === poolId)
    .map((node) => {
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
    })
}

function connectNodes(args: {
  sourceId: string
  sourceGroup: 'left' | 'right' | 'top' | 'bottom'
  targetId: string
  targetGroup: 'left' | 'right' | 'top' | 'bottom'
}): ConnectResult {
  const sourceNode = graph.getCellById(args.sourceId)
  const targetNode = graph.getCellById(args.targetId)

  if (!sourceNode?.isNode?.() || !targetNode?.isNode?.()) {
    return {
      ok: false,
      edgeId: null,
      shape: currentEdgeShape,
      reason: '源节点或目标节点不存在',
    }
  }

  const sourcePortId = resolvePortIdByGroup(sourceNode as Node, args.sourceGroup)
  const targetPortId = resolvePortIdByGroup(targetNode as Node, args.targetGroup)

  const edge = graph.createEdge({
    shape: currentEdgeShape,
    source: { cell: args.sourceId, port: sourcePortId },
    target: { cell: args.targetId, port: targetPortId },
  })

  const targetMagnet = document.querySelector(
    `.x6-node[data-cell-id="${args.targetId}"] .x6-port-${args.targetGroup} .x6-port-body`,
  ) ?? document.createElement('div')

  const connectionResult = validateConnectionWithResult({
    edge,
    sourceCell: sourceNode,
    targetCell: targetNode,
    sourcePort: sourcePortId,
    targetPort: targetPortId,
    targetMagnet,
  })

  if (!connectionResult.valid) {
    edge.remove()
    return {
      ok: false,
      edgeId: null,
      shape: currentEdgeShape,
      reason: connectionResult.reason,
    }
  }

  graph.addEdge(edge)

  const edgeResult = validateEdgeWithResult({ edge })

  if (!edgeResult.valid) {
    edge.remove()
    return {
      ok: false,
      edgeId: null,
      shape: currentEdgeShape,
      reason: edgeResult.reason,
    }
  }

  return {
    ok: true,
    edgeId: edge.id,
    shape: currentEdgeShape,
  }
}

function resolvePortIdByGroup(node: Node, group: 'left' | 'right' | 'top' | 'bottom'): string {
  const port = node.getPorts?.().find((candidate) => candidate.group === group)
  return port?.id ?? group
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
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane })

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

function createStandaloneTaskScenario(): StandaloneTaskScenarioIds {
  clear()

  const task = graph.addNode({
    id: 'standalone-task',
    shape: BPMN_USER_TASK,
    x: 180,
    y: 120,
    width: 110,
    height: 60,
    attrs: { label: { text: 'StandaloneTask' } },
  })

  return {
    taskId: task.id,
  }
}

function createTransactionWrapScenario(): TransactionWrapScenarioIds {
  clear()

  const start = graph.addNode({
    id: 'transaction-start',
    shape: BPMN_START_EVENT,
    x: 160,
    y: 210,
    attrs: { label: { text: '开始' } },
  })
  emitGraphEvent('node:added', { node: start })

  const transaction = graph.addNode({
    id: 'transaction-wrap',
    shape: BPMN_TRANSACTION,
    x: 420,
    y: 150,
    width: 260,
    height: 160,
    attrs: { label: { text: '事务' } },
  })
  emitGraphEvent('node:added', { node: transaction })

  return {
    transactionId: transaction.id,
    startId: start.id,
  }
}

function createPoolLaneTransactionScenario(): PoolLaneTransactionScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-transaction',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 420,
    height: 300,
    attrs: { headerLabel: { text: 'Pool' } },
    data: { bpmn: { isHorizontal: true } },
  })

  const transaction = graph.addNode({
    id: 'transaction-in-pool',
    shape: BPMN_TRANSACTION,
    x: 180,
    y: 185,
    width: 180,
    height: 90,
    parent: pool.id,
    attrs: { label: { text: '事务' } },
  })
  pool.embed(transaction)

  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: transaction })

  return {
    poolId: pool.id,
    transactionId: transaction.id,
  }
}

function createPoolTwoLaneTransactionInternalScenario(): PoolTwoLaneTransactionInternalScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-transaction-lanes',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 620,
    height: 360,
    attrs: { headerLabel: { text: 'Pool' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const lane1 = graph.addNode({
    id: 'lane-transaction-source',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 590,
    height: 160,
    parent: pool.id,
    attrs: { headerLabel: { text: 'Lane 1' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const lane2 = graph.addNode({
    id: 'lane-transaction-target',
    shape: BPMN_LANE,
    x: 70,
    y: 200,
    width: 590,
    height: 200,
    parent: pool.id,
    attrs: { headerLabel: { text: 'Lane 2' } },
    data: { bpmn: { isHorizontal: true } },
  })
  pool.embed(lane1)
  pool.embed(lane2)
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane1 })
  emitGraphEvent('node:added', { node: lane2 })

  const transaction = graph.addNode({
    id: 'transaction-cross-lane',
    shape: BPMN_TRANSACTION,
    x: 140,
    y: 75,
    width: 260,
    height: 100,
    parent: lane1.id,
    attrs: { label: { text: '事务' } },
  })
  const task = graph.addNode({
    id: 'transaction-internal-task',
    shape: BPMN_USER_TASK,
    x: 185,
    y: 100,
    width: 120,
    height: 50,
    parent: transaction.id,
    attrs: { label: { text: '内部任务' } },
  })
  lane1.embed(transaction)
  transaction.embed(task)
  emitGraphEvent('node:added', { node: transaction })
  emitGraphEvent('node:added', { node: task })

  return {
    poolId: pool.id,
    lane1Id: lane1.id,
    lane2Id: lane2.id,
    transactionId: transaction.id,
    taskId: task.id,
  }
}

function createPoolTwoLaneTransactionExtractionScenario(): PoolTwoLaneTransactionExtractionScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-transaction-extraction',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 620,
    height: 360,
    attrs: { headerLabel: { text: 'Pool' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const lane1 = graph.addNode({
    id: 'lane-transaction-extraction-source',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 590,
    height: 160,
    parent: pool.id,
    attrs: { headerLabel: { text: 'Lane 1' } },
    data: { bpmn: { isHorizontal: true } },
  })
  const lane2 = graph.addNode({
    id: 'lane-transaction-extraction-target',
    shape: BPMN_LANE,
    x: 70,
    y: 200,
    width: 590,
    height: 200,
    parent: pool.id,
    attrs: { headerLabel: { text: 'Lane 2' } },
    data: { bpmn: { isHorizontal: true } },
  })
  pool.embed(lane1)
  pool.embed(lane2)
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane1 })
  emitGraphEvent('node:added', { node: lane2 })

  const transaction = graph.addNode({
    id: 'transaction-extraction',
    shape: BPMN_TRANSACTION,
    x: 140,
    y: 75,
    width: 280,
    height: 100,
    parent: lane1.id,
    attrs: { label: { text: '事务' } },
  })
  const task = graph.addNode({
    id: 'transaction-extraction-task',
    shape: BPMN_USER_TASK,
    x: 180,
    y: 100,
    width: 110,
    height: 50,
    parent: transaction.id,
    attrs: { label: { text: '待拖出任务' } },
  })
  const peerTask = graph.addNode({
    id: 'transaction-extraction-peer-task',
    shape: BPMN_USER_TASK,
    x: 305,
    y: 100,
    width: 90,
    height: 50,
    parent: transaction.id,
    attrs: { label: { text: '事务内任务' } },
  })
  lane1.embed(transaction)
  transaction.embed(task)
  transaction.embed(peerTask)
  emitGraphEvent('node:added', { node: transaction })
  emitGraphEvent('node:added', { node: task })
  emitGraphEvent('node:added', { node: peerTask })

  graph.addEdge({
    id: 'transaction-extraction-edge',
    shape: BPMN_SEQUENCE_FLOW,
    source: task,
    target: peerTask,
  })

  return {
    poolId: pool.id,
    lane1Id: lane1.id,
    lane2Id: lane2.id,
    transactionId: transaction.id,
    taskId: task.id,
    peerTaskId: peerTask.id,
  }
}

function addFirstPoolScenario(): FirstPoolWrapScenarioIds {
  const existingTask = graph.getCellById('standalone-task')
  if (!existingTask?.isNode?.()) {
    throw new Error('未找到首个 Pool 包裹场景所需的独立任务')
  }

  const pool = graph.addNode({
    id: 'first-pool',
    shape: BPMN_POOL,
    x: 420,
    y: 220,
    width: 180,
    height: 120,
    attrs: { headerLabel: { text: 'Pool' } },
    data: { bpmn: { isHorizontal: true } },
  })

  emitGraphEvent('node:added', { node: pool })

  return {
    poolId: pool.id,
    taskId: existingTask.id,
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
  emitGraphEvent('node:added', { node: leftPool })
  emitGraphEvent('node:added', { node: leftLane })

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
  emitGraphEvent('node:added', { node: rightPool })
  emitGraphEvent('node:added', { node: rightLane })

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

function createMultiLaneScenario(): MultiLaneScenarioIds {
  clear()

  // 与 example 示例保持一致的大尺寸 Pool + 双 Lane 布局
  const pool = graph.addNode({
    id: 'pool-multi',
    shape: BPMN_POOL,
    x: 40,
    y: 120,
    width: 900,
    height: 400,
    attrs: { headerLabel: { text: '审批流程' } },
    data: { bpmn: { isHorizontal: true } },
  })

  // Lane 1：申请人泳道
  const lane1 = graph.addNode({
    id: 'lane-multi-1',
    shape: BPMN_LANE,
    x: 70,
    y: 120,
    width: 870,
    height: 200,
    parent: pool.id,
    attrs: { headerLabel: { text: '申请人' } },
    data: { bpmn: { isHorizontal: true } },
  })
  pool.embed(lane1)
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane1 })

  // Lane 2：审批人泳道
  const lane2 = addLaneToPool(graph, pool, { label: '审批人' })
  if (!lane2) {
    throw new Error('addLaneToPool 返回 null，无法在 createMultiLaneScenario 中创建第二条 Lane')
  }

  // ---- Lane 1 内的节点 ----
  const start = graph.addNode({
    id: 'start-multi',
    shape: BPMN_START_EVENT,
    x: 110,
    y: 195,
    parent: lane1.id,
    attrs: { label: { text: '发起' } },
  })
  lane1.embed(start)
  emitGraphEvent('node:added', { node: start })

  const task = graph.addNode({
    id: 'task-multi',
    shape: BPMN_USER_TASK,
    x: 200,
    y: 180,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '填写\n请假单' } },
  })
  lane1.embed(task)
  emitGraphEvent('node:added', { node: task })

  const serviceTask = graph.addNode({
    id: 'service-multi',
    shape: BPMN_SERVICE_TASK,
    x: 620,
    y: 180,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '更新\n考勤' } },
  })
  lane1.embed(serviceTask)
  emitGraphEvent('node:added', { node: serviceTask })

  const end = graph.addNode({
    id: 'end-multi',
    shape: BPMN_END_EVENT,
    x: 830,
    y: 195,
    parent: lane1.id,
    attrs: { label: { text: '完成' } },
  })
  lane1.embed(end)
  emitGraphEvent('node:added', { node: end })

  // ---- Lane 2 内的节点 ----
  const gateway = graph.addNode({
    id: 'gw-multi',
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 360,
    y: 380,
    parent: lane2.id,
    attrs: { label: { text: '天数?' } },
  })
  lane2.embed(gateway)
  emitGraphEvent('node:added', { node: gateway })

  const task2 = graph.addNode({
    id: 'task2-multi',
    shape: BPMN_USER_TASK,
    x: 460,
    y: 340,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '主管\n审批' } },
  })
  lane2.embed(task2)
  emitGraphEvent('node:added', { node: task2 })

  const sendTask = graph.addNode({
    id: 'send-multi',
    shape: BPMN_SEND_TASK,
    x: 620,
    y: 360,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '发送\n通知' } },
  })
  lane2.embed(sendTask)
  emitGraphEvent('node:added', { node: sendTask })

  // ---- 连线 ----
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: task })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task, target: gateway })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: gateway, target: task2 })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task2, target: sendTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: sendTask, target: serviceTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: serviceTask, target: end })

  return {
    poolId: pool.id,
    lane1Id: lane1.id,
    lane2Id: lane2.id,
    taskId: task.id,
    startId: start.id,
    endId: end.id,
    gatewayId: gateway.id,
    task2Id: task2.id,
    sendTaskId: sendTask.id,
    serviceTaskId: serviceTask.id,
  }
}

function createExampleLikeMultiLaneScenario(): MultiLaneScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-example-like',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 1100,
    height: 460,
    attrs: { headerLabel: { text: '员工请假审批流程' } },
    data: { bpmn: { isHorizontal: true } },
  })

  const lane1 = graph.addNode({
    id: 'lane-example-like-1',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 1070,
    height: 200,
    parent: pool.id,
    attrs: { headerLabel: { text: '申请人' } },
    data: { bpmn: { isHorizontal: true } },
  })

  const lane2 = graph.addNode({
    id: 'lane-example-like-2',
    shape: BPMN_LANE,
    x: 70,
    y: 240,
    width: 1070,
    height: 260,
    parent: pool.id,
    attrs: { headerLabel: { text: '审批人' } },
    data: { bpmn: { isHorizontal: true } },
  })

  pool.embed(lane1)
  pool.embed(lane2)
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane1 })
  emitGraphEvent('node:added', { node: lane2 })

  const start = graph.addNode({
    id: 'start-example-like',
    shape: BPMN_START_EVENT,
    x: 120,
    y: 120,
    parent: lane1.id,
    attrs: { label: { text: '发起' } },
  })
  lane1.embed(start)
  emitGraphEvent('node:added', { node: start })

  const task = graph.addNode({
    id: 'task-example-like',
    shape: BPMN_USER_TASK,
    x: 210,
    y: 105,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '填写\n请假单' } },
  })
  lane1.embed(task)
  emitGraphEvent('node:added', { node: task })

  const serviceTask = graph.addNode({
    id: 'service-example-like',
    shape: BPMN_SERVICE_TASK,
    x: 820,
    y: 105,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '更新\n考勤' } },
  })
  lane1.embed(serviceTask)
  emitGraphEvent('node:added', { node: serviceTask })

  const end = graph.addNode({
    id: 'end-example-like',
    shape: BPMN_END_EVENT,
    x: 980,
    y: 120,
    parent: lane1.id,
    attrs: { label: { text: '完成' } },
  })
  lane1.embed(end)
  emitGraphEvent('node:added', { node: end })

  const gateway = graph.addNode({
    id: 'gw-example-like',
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 370,
    y: 330,
    parent: lane2.id,
    attrs: { label: { text: '天数?' } },
  })
  lane2.embed(gateway)
  emitGraphEvent('node:added', { node: gateway })

  const task2 = graph.addNode({
    id: 'task2-example-like',
    shape: BPMN_USER_TASK,
    x: 470,
    y: 290,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '主管\n审批' } },
  })
  lane2.embed(task2)
  emitGraphEvent('node:added', { node: task2 })

  const sendTask = graph.addNode({
    id: 'send-example-like',
    shape: BPMN_SEND_TASK,
    x: 730,
    y: 315,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '发送\n通知' } },
  })
  lane2.embed(sendTask)
  emitGraphEvent('node:added', { node: sendTask })

  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: task })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task, target: gateway })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: gateway, target: task2 })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task2, target: sendTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: sendTask, target: serviceTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: serviceTask, target: end })

  return {
    poolId: pool.id,
    lane1Id: lane1.id,
    lane2Id: lane2.id,
    taskId: task.id,
    startId: start.id,
    endId: end.id,
    gatewayId: gateway.id,
    task2Id: task2.id,
    sendTaskId: sendTask.id,
    serviceTaskId: serviceTask.id,
  }
}

function createExampleLikeLowTopLaneScenario(): MultiLaneScenarioIds {
  clear()

  const pool = graph.addNode({
    id: 'pool-example-like-low-top',
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 1100,
    height: 460,
    attrs: { headerLabel: { text: '员工请假审批流程' } },
    data: { bpmn: { isHorizontal: true } },
  })

  const lane1 = graph.addNode({
    id: 'lane-example-like-low-top-1',
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 1070,
    height: 140,
    parent: pool.id,
    attrs: { headerLabel: { text: '申请人' } },
    data: { bpmn: { isHorizontal: true } },
  })

  const lane2 = graph.addNode({
    id: 'lane-example-like-low-top-2',
    shape: BPMN_LANE,
    x: 70,
    y: 180,
    width: 1070,
    height: 320,
    parent: pool.id,
    attrs: { headerLabel: { text: '审批人' } },
    data: { bpmn: { isHorizontal: true } },
  })

  pool.embed(lane1)
  pool.embed(lane2)
  emitGraphEvent('node:added', { node: pool })
  emitGraphEvent('node:added', { node: lane1 })
  emitGraphEvent('node:added', { node: lane2 })

  const start = graph.addNode({
    id: 'start-example-like-low-top',
    shape: BPMN_START_EVENT,
    x: 120,
    y: 100,
    parent: lane1.id,
    attrs: { label: { text: '发起' } },
  })
  lane1.embed(start)
  emitGraphEvent('node:added', { node: start })

  const task = graph.addNode({
    id: 'task-example-like-low-top',
    shape: BPMN_USER_TASK,
    x: 210,
    y: 85,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '填写\n请假单' } },
  })
  lane1.embed(task)
  emitGraphEvent('node:added', { node: task })

  const serviceTask = graph.addNode({
    id: 'service-example-like-low-top',
    shape: BPMN_SERVICE_TASK,
    x: 820,
    y: 85,
    width: 100,
    height: 60,
    parent: lane1.id,
    attrs: { label: { text: '更新\n考勤' } },
  })
  lane1.embed(serviceTask)
  emitGraphEvent('node:added', { node: serviceTask })

  const end = graph.addNode({
    id: 'end-example-like-low-top',
    shape: BPMN_END_EVENT,
    x: 980,
    y: 100,
    parent: lane1.id,
    attrs: { label: { text: '完成' } },
  })
  lane1.embed(end)
  emitGraphEvent('node:added', { node: end })

  const gateway = graph.addNode({
    id: 'gw-example-like-low-top',
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 370,
    y: 270,
    parent: lane2.id,
    attrs: { label: { text: '天数?' } },
  })
  lane2.embed(gateway)
  emitGraphEvent('node:added', { node: gateway })

  const task2 = graph.addNode({
    id: 'task2-example-like-low-top',
    shape: BPMN_USER_TASK,
    x: 470,
    y: 230,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '主管\n审批' } },
  })
  lane2.embed(task2)
  emitGraphEvent('node:added', { node: task2 })

  const sendTask = graph.addNode({
    id: 'send-example-like-low-top',
    shape: BPMN_SEND_TASK,
    x: 730,
    y: 255,
    width: 100,
    height: 60,
    parent: lane2.id,
    attrs: { label: { text: '发送\n通知' } },
  })
  lane2.embed(sendTask)
  emitGraphEvent('node:added', { node: sendTask })

  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: task })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task, target: gateway })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: gateway, target: task2 })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: task2, target: sendTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: sendTask, target: serviceTask })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: serviceTask, target: end })

  return {
    poolId: pool.id,
    lane1Id: lane1.id,
    lane2Id: lane2.id,
    taskId: task.id,
    startId: start.id,
    endId: end.id,
    gatewayId: gateway.id,
    task2Id: task2.id,
    sendTaskId: sendTask.id,
    serviceTaskId: serviceTask.id,
  }
}

function createExampleLikeAddedLowTopLaneScenario(): MultiLaneScenarioIds & AddedLaneOnlyScenarioIds {
  const scenario = createExampleLikeLowTopLaneScenario()
  const added = addLaneToPoolScenario(scenario.poolId)

  if (!added) {
    throw new Error('创建低首 Lane 三泳道场景失败')
  }

  const pool = graph.getCellById(scenario.poolId)
  const lane1 = graph.getCellById(scenario.lane1Id)
  const lane2 = graph.getCellById(scenario.lane2Id)
  const lane3 = graph.getCellById(added.laneId)

  if (!pool?.isNode?.() || !lane1?.isNode?.() || !lane2?.isNode?.() || !lane3?.isNode?.()) {
    throw new Error('创建低首 Lane 三泳道场景时未找到必要节点')
  }

  if (!removeNode(added.addedTaskId)) {
    throw new Error('创建低首 Lane 三泳道场景时移除默认新增任务失败')
  }

  ;(pool as Node).setPosition({ x: 40, y: 40 })
  ;(pool as Node).setSize({ width: 1100, height: 585 })

  ;(lane1 as Node).setPosition({ x: 70, y: 40 })
  ;(lane1 as Node).setSize({ width: 1070, height: 140 })

  ;(lane2 as Node).setPosition({ x: 70, y: 180 })
  ;(lane2 as Node).setSize({ width: 1070, height: 260 })

  ;(lane3 as Node).setPosition({ x: 70, y: 440 })
  ;(lane3 as Node).setSize({ width: 1070, height: 185 })

  return {
    ...scenario,
    laneId: added.laneId,
  }
}

function addLaneToPoolScenario(poolId: string): AddedLaneScenarioIds | null {
  const cell = graph.getCellById(poolId)
  if (!cell?.isNode?.()) return null
  const pool = cell as Node

  const existingAllLaneIds = new Set(
    graph
      .getNodes()
      .filter((node) => node.shape === BPMN_LANE)
      .map((node) => node.id),
  )
  const existingLaneIds = new Set(
    graph
      .getNodes()
      .filter((node) => node.shape === BPMN_LANE && node.getParent()?.id === pool.id)
      .map((node) => node.id),
  )

  const lane = addLaneToPool(graph, pool, { label: '新泳道' })
  const createdLane = lane && graph.getCellById(lane.id)?.isNode?.()
    ? (graph.getCellById(lane.id) as Node)
    : graph
      .getNodes()
      .find((node) => node.shape === BPMN_LANE && node.getParent()?.id === pool.id && !existingLaneIds.has(node.id))
      ?? graph
        .getNodes()
        .find((node) => node.shape === BPMN_LANE && !existingAllLaneIds.has(node.id))

  if (!createdLane) {
    return null
  }

  const laneTask = graph.addNode({
    id: `task-added-${createdLane.id}`,
    shape: BPMN_USER_TASK,
    x: createdLane.getPosition().x + 110,
    y: createdLane.getPosition().y + 40,
    width: 100,
    height: 60,
    parent: createdLane.id,
    attrs: { label: { text: '新增\n任务' } },
  })
  createdLane.embed(laneTask)
  emitGraphEvent('node:added', { node: laneTask })

  return {
    laneId: createdLane.id,
    addedTaskId: laneTask.id,
  }
}

function removeNode(id: string): boolean {
  const cell = graph.getCellById(id)
  if (!cell?.isNode?.()) {
    return false
  }

  graph.removeCell(cell)
  return !graph.getCellById(id)
}

function selectCell(id: string): string[] {
  const cell = graph.getCellById(id)
  if (!cell) {
    return []
  }

  const selectionGraph = graph as Graph & {
    cleanSelection?: () => void
    select?: (cell: Cell) => void
    getSelectedCells?: () => Cell[]
  }

  selectionGraph.cleanSelection?.()
  selectionGraph.select?.(cell)
  return selectionGraph.getSelectedCells?.().map((selected) => selected.id) ?? []
}

function removeSelectedCells(): string[] {
  const selectableGraph = graph as Graph & { getSelectedCells?: () => Cell[] }
  if (typeof selectableGraph.getSelectedCells !== 'function') {
    return []
  }

  const selectedCells = selectableGraph.getSelectedCells()
  if (!selectedCells.length) {
    return []
  }

  const removedIds = selectedCells.map((cell) => cell.id)
  graph.removeCells(selectedCells)
  return removedIds.filter((id) => !graph.getCellById(id))
}

async function roundtripXml(): Promise<string> {
  const xml = await exportBpmnXml(graph, { processName: '浏览器测试流程' })
  await importBpmnXml(graph, xml, { zoomToFit: false })
  return xml
}

window.__x6PluginBrowserHarness = {
  clear,
  setViewportTransform,
  createStandaloneTaskScenario,
  createTransactionWrapScenario,
  createPoolLaneTransactionScenario,
  createPoolTwoLaneTransactionInternalScenario,
  createPoolTwoLaneTransactionExtractionScenario,
  addFirstPoolScenario,
  createPoolLaneTaskScenario,
  createPoolLaneTaskBoundaryScenario,
  createTwoPoolMessageScenario,
  createMultiLaneScenario,
  createExampleLikeMultiLaneScenario,
  createExampleLikeLowTopLaneScenario,
  createExampleLikeAddedLowTopLaneScenario,
  addLaneToPoolScenario,
  removeNode,
  selectCell,
  removeSelectedCells,
  getNodeSnapshot,
  getPoolLaneSnapshots,
  getSelectedCellIds,
  connectNodes,
  getEdgeSnapshotByShape,
  getEdgeCountByShape,
  roundtripXml,
}