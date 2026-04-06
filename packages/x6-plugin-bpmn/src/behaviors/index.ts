/**
 * BPMN 行为模块
 *
 * 提供可插拔的 BPMN 交互行为，补充 X6 内置能力无法覆盖的 BPMN 专有逻辑。
 * 每个行为通过 setup 函数安装，返回 dispose 函数用于清理。
 */

export { setupBoundaryAttach, attachBoundaryToHost } from './boundary-attach'
export type { BoundaryAttachOptions } from './boundary-attach'

export {
  setupPoolContainment,
  validatePoolContainment,
  findContainingSwimlane,
  getSwimlaneAncestor,
  isContainedFlowNode,
} from './pool-containment'
export type {
  PoolContainmentOptions,
  PoolContainmentResult,
} from './pool-containment'

export {
  snapToRectEdge,
  boundaryPositionToPoint,
  distanceToRectEdge,
} from './geometry'
export type {
  Point,
  Rect,
  RectSide,
  BoundaryPosition,
  SnapResult,
} from './geometry'
