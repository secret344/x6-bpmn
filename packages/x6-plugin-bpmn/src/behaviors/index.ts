/**
 * BPMN 行为模块
 *
 * 提供可插拔的 BPMN 交互行为，补充 X6 内置能力无法覆盖的 BPMN 专有逻辑。
 * 每个行为通过 setup 函数安装，返回 dispose 函数用于清理。
 */

export { setupBoundaryAttach, attachBoundaryToHost } from './boundary-attach'
export type { BoundaryAttachOptions } from './boundary-attach'

import type { Cell, Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape } from '../export/bpmn-mapping'
import type { BoundaryAttachOptions } from './boundary-attach'
import { setupBoundaryAttach } from './boundary-attach'
import {
  setupPoolContainment,
  type PoolContainmentOptions,
} from './pool-containment'
import { setupSwimlaneResize, type SwimlaneResizeOptions } from './swimlane-resize'
import { setupSwimlaneDelete, type SwimlaneDeleteOptions } from './swimlane-delete'

export {
  findContainingSwimlane,
  getAncestorSwimlane as getSwimlaneAncestor,
  getAncestorPool,
  resolveLaneMemberNodes,
} from '../core/swimlane-membership'

// 泳道布局核心工具导出
export {
  nodeRect,
  asTRBL,
  trblToRect,
  subtractTRBL,
  resizeTRBL,
  getChildLanes,
  collectLanes,
  getLanesRoot,
  isSwimlaneHorizontal,
  computeLaneContentMinSize,
  computeLaneMinSize,
  computePoolMinSize,
  computeResizeConstraints,
  computeLanesResize,
  collectFirstPoolWrapTargets,
  computeAutoWrapPoolRect,
  autoWrapFirstPool,
  computeRequiredSwimlaneRect,
  clampSwimlaneToContent,
  normalizeSwimlaneLayers,
  LANE_INDENTATION,
  LANE_MIN_DIMENSIONS,
  VERTICAL_LANE_MIN_DIMENSIONS,
  PARTICIPANT_MIN_DIMENSIONS,
  VERTICAL_PARTICIPANT_MIN_DIMENSIONS,
  LANE_PADDING,
  VERTICAL_LANE_PADDING,
  DEFAULT_LANE_SIZE,
} from './swimlane-layout'
export type {
  TRBL,
  ResizeConstraints,
  ResizeDirection,
  LaneResizeAdjustment,
} from './swimlane-layout'

// Pool 容器约束导出
export { setupPoolContainment, validatePoolContainment } from './pool-containment'
export type { PoolContainmentOptions, ContainmentValidationResult } from './pool-containment'

// 泳道 Resize 行为导出
export {
  setupSwimlaneResize,
  clampLanePreviewRect,
  patchTransformResizing,
  restoreTransformResizing,
} from './swimlane-resize'
export type { SwimlaneResizeOptions, TransformResizingSaved } from './swimlane-resize'

// 泳道删除行为导出
export { setupSwimlaneDelete, compensateLaneDelete } from './swimlane-delete'
export type { SwimlaneDeleteOptions } from './swimlane-delete'

// Lane 管理行为导出（高级 API）
export {
  addLaneToPool,
  addLaneAbove,
  addLaneBelow,
  compactLaneLayout,
} from './lane-management'
export type { AddLaneOptions } from './lane-management'

export interface BpmnInteractionBehaviorOptions {
  boundaryAttach?: BoundaryAttachOptions
  poolContainment?: PoolContainmentOptions
  swimlaneResize?: SwimlaneResizeOptions
  swimlaneDelete?: SwimlaneDeleteOptions
}

/**
 * 安装常用 BPMN 交互行为。
 *
 * 统一收敛边界事件吸附、Pool/Lane 容器约束、Resize 联动与 Lane 删除补偿，
 * 减少宿主侧重复 wiring。
 */
export function setupBpmnInteractionBehaviors(
  graph: Graph,
  options: BpmnInteractionBehaviorOptions = {},
): () => void {
  const disposeBoundaryAttach = setupBoundaryAttach(graph, options.boundaryAttach)
  const disposeSwimlaneResize = setupSwimlaneResize(graph, options.swimlaneResize)
  const disposeSwimlaneDelete = setupSwimlaneDelete(graph, options.swimlaneDelete)
  const disposePoolContainment = setupPoolContainment(graph, options.poolContainment)
  const disposeSwimlaneDirectSelection = setupSwimlaneDirectSelection(graph)

  return () => {
    disposeSwimlaneDirectSelection()
    disposePoolContainment()
    disposeSwimlaneDelete()
    disposeSwimlaneResize()
    disposeBoundaryAttach()
  }
}

function setupSwimlaneDirectSelection(graph: Graph): () => void {
  if (typeof graph.on !== 'function' || typeof graph.off !== 'function') {
    return () => undefined
  }

  const handler = ({ node }: { node: Node }) => {
    if (!isLaneShape(node.shape)) {
      return
    }

    const parent = node.getParent()
    if (!parent?.isNode() || !isPoolShape((parent as Node).shape)) {
      return
    }

    const selectionGraph = graph as Graph & {
      getSelectedCells?: () => Cell[]
      cleanSelection?: () => void
      select?: (cell: Cell) => void
    }
    const selectedCells = selectionGraph.getSelectedCells?.() ?? []
    if (!selectedCells.some((cell) => cell.id === parent.id)) {
      return
    }

    window.requestAnimationFrame(() => {
      selectionGraph.cleanSelection?.()
      selectionGraph.select?.(node)
    })
  }

  graph.on('node:click', handler)
  return () => {
    graph.off('node:click', handler)
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
