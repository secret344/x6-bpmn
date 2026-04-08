/**
 * BPMN 行为模块
 *
 * 提供可插拔的 BPMN 交互行为，补充 X6 内置能力无法覆盖的 BPMN 专有逻辑。
 * 每个行为通过 setup 函数安装，返回 dispose 函数用于清理。
 */

export { setupBoundaryAttach, attachBoundaryToHost } from './boundary-attach'
export type { BoundaryAttachOptions } from './boundary-attach'

import type { Graph } from '@antv/x6'
import type { BoundaryAttachOptions } from './boundary-attach'
import type { PoolContainmentOptions } from './pool-containment'
import type { LaneManagementOptions } from './lane-management'
import { setupBoundaryAttach } from './boundary-attach'
import { setupPoolContainment } from './pool-containment'
import { setupLaneManagement } from './lane-management'

export {
  setupPoolContainment,
  validatePoolContainment,
  findContainingSwimlane,
  getSwimlaneAncestor,
  isContainedFlowNode,
} from './pool-containment'
export type {
  PoolContainmentResult,
} from './pool-containment'
export type { PoolContainmentOptions } from './pool-containment'

export {
  setupLaneManagement,
  addLaneToPool,
  addLaneAbove,
  addLaneBelow,
  compactLaneLayout,
} from './lane-management'
export type { LaneManagementOptions, AddLaneOptions } from './lane-management'

export interface BpmnInteractionBehaviorOptions {
  boundaryAttach?: BoundaryAttachOptions
  poolContainment?: PoolContainmentOptions
  laneManagement?: LaneManagementOptions
}

/**
 * 安装常用 BPMN 交互行为。
 *
 * 统一收敛边界事件吸附、Pool/Lane 容器约束与 Lane 管理行为，减少宿主侧重复 wiring。
 */
export function setupBpmnInteractionBehaviors(
  graph: Graph,
  options: BpmnInteractionBehaviorOptions = {},
): () => void {
  const disposeBoundaryAttach = setupBoundaryAttach(graph, options.boundaryAttach)
  const disposePoolContainment = setupPoolContainment(graph, options.poolContainment)
  const disposeLaneManagement = setupLaneManagement(graph, options.laneManagement)

  return () => {
    disposeLaneManagement()
    disposePoolContainment()
    disposeBoundaryAttach()
  }
}

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
