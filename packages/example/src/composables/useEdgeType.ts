/**
 * 当前连接线类型 — 全局共享状态
 *
 * GraphCanvas 中的浮动面板修改此值，createEdge 读取此值。
 */
import { ref } from 'vue'
import {
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '@x6-bpmn2/plugin'

/** 当前选中的连接线 shape 名称 */
export const currentEdgeType = ref(BPMN_SEQUENCE_FLOW)

// SVG 线条预览片段（在 32×12 的 viewBox 内绘制）
const svgSolid = (marker: string) =>
  `<line x1="2" y1="6" x2="24" y2="6" stroke="#333" stroke-width="1.5"/>${marker}`
const svgDashed = (dash: string, marker: string, markerStart = '') =>
  `<line x1="2" y1="6" x2="24" y2="6" stroke="#333" stroke-width="1.2" stroke-dasharray="${dash}"/>${markerStart}${marker}`

// 箭头标记
const arrowFill = '<polygon points="24,6 30,3 30,9" fill="#333"/>'
const arrowOpen = '<polyline points="26,3 30,6 26,9" fill="none" stroke="#333" stroke-width="1.2"/>'
const noArrow = ''
// 起始标记
const diamond = '<polygon points="2,6 6,3 10,6 6,9" fill="#fff" stroke="#333" stroke-width="1"/>'
const slash = '<line x1="4" y1="9" x2="7" y2="3" stroke="#333" stroke-width="1.5"/>'
const circle = '<circle cx="4" cy="6" r="2.5" fill="#fff" stroke="#333" stroke-width="1"/>'

/** 所有可选的连接线类型 */
export const EDGE_TYPE_OPTIONS = [
  { value: BPMN_SEQUENCE_FLOW,      label: '顺序流',   desc: '实线 + 实心箭头', svg: svgSolid(arrowFill) },
  { value: BPMN_CONDITIONAL_FLOW,   label: '条件流',   desc: '菱形起始 + 实心箭头', svg: svgSolid(arrowFill + diamond) },
  { value: BPMN_DEFAULT_FLOW,       label: '默认流',   desc: '斜线起始 + 实心箭头', svg: svgSolid(arrowFill + slash) },
  { value: BPMN_MESSAGE_FLOW,       label: '消息流',   desc: '虚线 + 空心箭头', svg: svgDashed('6,3', arrowOpen, circle) },
  { value: BPMN_ASSOCIATION,        label: '关联',     desc: '点线，无箭头', svg: svgDashed('3,3', noArrow) },
  { value: BPMN_DIRECTED_ASSOCIATION, label: '定向关联', desc: '点线 + 空心箭头', svg: svgDashed('3,3', arrowOpen) },
  { value: BPMN_DATA_ASSOCIATION,   label: '数据关联', desc: '虚线 + 空心箭头', svg: svgDashed('5,3', arrowOpen) },
] as const
