/**
 * 审批流 — 图形注册 & 流程操控逻辑
 *
 * 规则：
 * - 流程为单向链式：开始 → 审批1 → 审批2 → ... → 结束
 * - 每个审批节点右侧跟一个 "+" 按钮节点
 * - 点击 "+" 在当前位置后面插入新审批节点
 * - 禁止用户拖拽添加节点，只能通过 "+" 按钮添加
 * - 每条连线只有一个输入一个输出
 */

import { Graph } from '@antv/x6'
import { register } from '@antv/x6-vue-shape'
import {
  NODE_MAPPING,
  EDGE_MAPPING,
  registerShapeLabel,
  registerShapeCategory,
} from '@x6-bpmn2/plugin'
import ApprovalNode from './components/ApprovalNode.vue'
import AddButton from './components/AddButton.vue'
import StartNode from './components/StartNode.vue'
import EndNode from './components/EndNode.vue'

// ---- Shape 常量 ----
export const SHAPE_APPROVAL = 'approval-node'
export const SHAPE_ADD_BTN = 'add-button'
export const SHAPE_START = 'start-node'
export const SHAPE_END = 'end-node'

// ---- 尺寸常量 ----
const APPROVAL_W = 160
const APPROVAL_H = 60
const ADD_BTN_SIZE = 30
const START_END_SIZE = 40
const GAP_NODE = 80        // 审批节点之间的间距
const GAP_ADD_BTN = 30     // 审批节点到加号按钮的间距
const START_X = 80
const START_Y = 200

// ---- 注册 Vue Shape ----
export function registerShapes() {
  register({
    shape: SHAPE_APPROVAL,
    width: APPROVAL_W,
    height: APPROVAL_H,
    component: ApprovalNode,
  })

  register({
    shape: SHAPE_ADD_BTN,
    width: ADD_BTN_SIZE,
    height: ADD_BTN_SIZE,
    component: AddButton,
  })

  register({
    shape: SHAPE_START,
    width: START_END_SIZE,
    height: START_END_SIZE,
    component: StartNode,
  })

  register({
    shape: SHAPE_END,
    width: START_END_SIZE,
    height: START_END_SIZE,
    component: EndNode,
  })

  // ---- 注册自定义形状到 BPMN 映射 ----
  NODE_MAPPING[SHAPE_APPROVAL] = { tag: 'userTask' }
  NODE_MAPPING[SHAPE_START] = { tag: 'startEvent' }
  NODE_MAPPING[SHAPE_END] = { tag: 'endEvent' }
  // add-button 不映射到 BPMN

  // 注册形状标签（用于属性配置面板显示）
  registerShapeLabel(SHAPE_APPROVAL, '审核节点')
  registerShapeLabel(SHAPE_START, '开始')
  registerShapeLabel(SHAPE_END, '结束')

  // 注册形状分类（用于属性配置面板字段过滤）
  registerShapeCategory(SHAPE_APPROVAL, 'userTask')
  registerShapeCategory(SHAPE_START, 'noneEvent')
  registerShapeCategory(SHAPE_END, 'noneEvent')
}

// ---- 创建 Graph ----
export function createGraph(container: HTMLElement): Graph {
  const graph = new Graph({
    container,
    autoResize: true,
    // 禁止拖拽节点到画布
    connecting: {
      allowBlank: false,
      allowMulti: false,
      allowLoop: false,
      allowNode: false,
      allowEdge: false,
    },
    // 禁用交互功能：不允许用户手动连线
    interacting: {
      nodeMovable: false,
      edgeMovable: false,
      edgeLabelMovable: false,
      magnetConnectable: false,
    },
    // 画布可平移和缩放
    panning: {
      enabled: true,
      modifiers: [],
    },
    mousewheel: {
      enabled: true,
      modifiers: ['ctrl', 'meta'],
    },
    background: { color: '#f7f8fa' },
    grid: {
      visible: true,
      size: 10,
      type: 'dot',
    },
  })

  return graph
}

// ---- 链式数据 ----
interface FlowItem {
  id: string
  name: string
  bpmn?: Record<string, any>
}

let idCounter = 0
function nextId(): string {
  return `approval_${++idCounter}`
}

/**
 * 计算 X 坐标
 * 布局：开始 → +按钮 → 审批1 → +按钮 → 审批2 → +按钮 → ... → 结束
 */
function startAddBtnX(): number {
  return START_X + START_END_SIZE + GAP_ADD_BTN
}

function approvalX(index: number): number {
  const firstX = startAddBtnX() + ADD_BTN_SIZE + GAP_ADD_BTN
  if (index === 0) return firstX
  const step = APPROVAL_W + GAP_ADD_BTN + ADD_BTN_SIZE + GAP_ADD_BTN
  return firstX + index * step
}

function addBtnX(approvalIndex: number): number {
  return approvalX(approvalIndex) + APPROVAL_W + GAP_ADD_BTN
}

function endX(approvalCount: number): number {
  return addBtnX(approvalCount - 1) + ADD_BTN_SIZE + GAP_ADD_BTN
}

const FLOW_Y = START_Y
const EDGE_COLOR = '#c9cdd4'

/**
 * 完全重绘整个审批流
 */
export function renderFlow(graph: Graph, items: FlowItem[]) {
  graph.clearCells()

  // 1. 开始节点
  const startNode = graph.addNode({
    id: 'start',
    shape: SHAPE_START,
    x: START_X,
    y: FLOW_Y + (APPROVAL_H - START_END_SIZE) / 2,
  })

  // 1.5 开始节点后的加号按钮（点击在最前面插入审批节点）
  const startAddBtn = graph.addNode({
    id: 'add_start',
    shape: SHAPE_ADD_BTN,
    x: startAddBtnX(),
    y: FLOW_Y + (APPROVAL_H - ADD_BTN_SIZE) / 2,
    data: { afterIndex: -1 },
  })

  graph.addEdge({
    source: startNode.id,
    target: startAddBtn.id,
    attrs: { line: { stroke: EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '4,3', targetMarker: null } },
  })

  let prevId = startAddBtn.id

  // 2. 审批节点 + 加号按钮
  items.forEach((item, i) => {
    const approvalNode = graph.addNode({
      id: item.id,
      shape: SHAPE_APPROVAL,
      x: approvalX(i),
      y: FLOW_Y,
      attrs: { label: { text: item.name } },
      data: { bpmn: item.bpmn || {} },
    })

    // 连线：前一个 → 审批
    graph.addEdge({
      source: prevId,
      target: approvalNode.id,
      attrs: { line: { stroke: EDGE_COLOR, strokeWidth: 1.5, targetMarker: { name: 'block', width: 8, height: 5 } } },
    })

    // 加号按钮
    const addBtn = graph.addNode({
      id: `add_${item.id}`,
      shape: SHAPE_ADD_BTN,
      x: addBtnX(i),
      y: FLOW_Y + (APPROVAL_H - ADD_BTN_SIZE) / 2,
      data: { afterIndex: i },
    })

    // 连线：审批 → 加号
    graph.addEdge({
      source: approvalNode.id,
      target: addBtn.id,
      attrs: { line: { stroke: EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '4,3', targetMarker: null } },
    })

    prevId = addBtn.id
  })

  // 3. 结束节点
  const endNode = graph.addNode({
    id: 'end',
    shape: SHAPE_END,
    x: endX(items.length),
    y: FLOW_Y + (APPROVAL_H - START_END_SIZE) / 2,
  })

  graph.addEdge({
    source: prevId,
    target: endNode.id,
    attrs: { line: { stroke: EDGE_COLOR, strokeWidth: 1.5, targetMarker: { name: 'block', width: 8, height: 5 } } },
  })

  // 居中画布
  setTimeout(() => {
    graph.centerContent()
    graph.zoomToFit({ padding: 60, maxScale: 1 })
  }, 50)
}

// ---- 流程数据管理 ----
let flowItems: FlowItem[] = []

export function getFlowItems(): FlowItem[] {
  return [...flowItems]
}

export function initFlow(graph: Graph) {
  flowItems = [
    { id: nextId(), name: '发起审批' },
    { id: nextId(), name: '主管审批' },
    { id: nextId(), name: '总监审批' },
  ]
  renderFlow(graph, flowItems)
}

export function insertAfter(graph: Graph, afterIndex: number) {
  const newItem: FlowItem = {
    id: nextId(),
    name: `审批节点 ${idCounter}`,
  }
  // afterIndex = -1 表示在开始节点后插入（即列表最前面）
  flowItems.splice(afterIndex + 1, 0, newItem)
  renderFlow(graph, flowItems)
}

export function removeApproval(graph: Graph, nodeId: string) {
  const idx = flowItems.findIndex(f => f.id === nodeId)
  if (idx < 0) return
  // 至少保留一个审批节点
  if (flowItems.length <= 1) return
  flowItems.splice(idx, 1)
  renderFlow(graph, flowItems)
}

export function renameApproval(graph: Graph, nodeId: string, newName: string) {
  const item = flowItems.find(f => f.id === nodeId)
  if (!item) return
  item.name = newName
  renderFlow(graph, flowItems)
}

/**
 * 更新审批节点的 BPMN 属性
 */
export function updateApprovalBpmn(graph: Graph, nodeId: string, bpmn: Record<string, any>) {
  const item = flowItems.find(f => f.id === nodeId)
  if (!item) return
  item.bpmn = bpmn
  // 同步到画布节点数据（不需要重绘）
  const node = graph.getCellById(nodeId)
  if (node) {
    node.setData({ ...node.getData(), bpmn }, { overwrite: true })
  }
}

/**
 * 获取不含 add-button 的审批流节点（用于导出 BPMN XML）
 * 导出时排除 add-button，只保留有效的 BPMN 元素
 */
export function getExportableNodeIds(): string[] {
  const ids = ['start', ...flowItems.map(f => f.id), 'end']
  return ids
}
