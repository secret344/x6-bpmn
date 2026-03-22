/**
 * 共享的图形配置工具
 *
 * 本模块提供所有 BPMN 图形注册时通用的配置项，
 * 包括端口（连接桩）定义和标签样式，消除各图形文件中的重复代码。
 */

// ============================================================================
// 通用端口（连接桩）配置
// ============================================================================

/** 端口圆点的默认样式 */
const PORT_CIRCLE_ATTRS = {
  r: 4,
  magnet: true,
  stroke: '#5F95FF',
  strokeWidth: 1,
  fill: '#fff',
} as const

/**
 * 标准四方向端口配置（上、右、下、左）。
 * 所有 BPMN 节点图形共享此配置，保证连线接入点一致。
 */
export const BPMN_PORTS: {
  groups: Record<string, { position: string; attrs: { circle: typeof PORT_CIRCLE_ATTRS } }>
  items: { group: string }[]
} = {
  groups: {
    top:    { position: 'top',    attrs: { circle: PORT_CIRCLE_ATTRS } },
    right:  { position: 'right',  attrs: { circle: PORT_CIRCLE_ATTRS } },
    bottom: { position: 'bottom', attrs: { circle: PORT_CIRCLE_ATTRS } },
    left:   { position: 'left',   attrs: { circle: PORT_CIRCLE_ATTRS } },
  },
  items: [
    { group: 'top' },
    { group: 'right' },
    { group: 'bottom' },
    { group: 'left' },
  ],
}

// ============================================================================
// 通用标签样式
// ============================================================================

/**
 * 居中标签样式 — 用于任务（Task）、调用活动等。
 * 文字水平垂直居中显示在节点内部。
 */
export const LABEL_CENTER = {
  textVerticalAnchor: 'middle',
  textAnchor: 'middle',
  refX: '50%',
  refY: '50%',
  fontSize: 13,
  fill: '#333',
} as const

/**
 * 顶部标签样式 — 用于子流程、事务等容器节点。
 * 文字水平居中显示在节点顶部。
 */
export const LABEL_TOP = {
  textVerticalAnchor: 'top',
  textAnchor: 'middle',
  refX: '50%',
  refY: 10,
  fontSize: 13,
  fill: '#333',
} as const

/**
 * 底部外置标签样式 — 用于事件、网关等小型图形。
 * 文字显示在节点底部外侧，避免遮挡图形图标。
 */
export const LABEL_BELOW = {
  textVerticalAnchor: 'top',
  textAnchor: 'middle',
  refX: '50%',
  refY: '100%',
  refY2: 6,
  fontSize: 12,
  fill: '#333',
} as const
