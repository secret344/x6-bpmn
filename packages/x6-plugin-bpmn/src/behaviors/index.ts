/**
 * BPMN 行为模块
 *
 * 提供可插拔的 BPMN 交互行为，补充 X6 内置能力无法覆盖的 BPMN 专有逻辑。
 * 每个行为通过 setup 函数安装，返回 dispose 函数用于清理。
 */

export { setupBoundaryAttach, attachBoundaryToHost } from './boundary-attach'
export type { BoundaryAttachOptions } from './boundary-attach'

import type { Graph } from '@antv/x6'
import { isBoundaryShape, isLaneShape, isPoolShape } from '../export/bpmn-mapping'
import { BPMN_TRANSACTION } from '../utils/constants'
import type { BoundaryAttachOptions } from './boundary-attach'
import type { PoolContainmentOptions } from './pool-containment'
import { setupBoundaryAttach } from './boundary-attach'
import {
  clearMovingBpmnNode,
  markMovingBpmnNode,
} from './embedding'
import {
  commitSelectedFlowContainerExtractions,
  reconcileFlowContainerEmbedding,
} from './flow-container-extraction'
import { setupPoolContainment } from './pool-containment'
import { setupSwimlaneDelete } from './swimlane-delete'
import { setupSwimlaneResize, type SwimlaneResizeOptions } from './swimlane-resize'

export {
  setupPoolContainment,
  validatePoolContainment,
} from './pool-containment'
export type {
  ContainmentValidationResult,
} from './pool-containment'
export type { PoolContainmentOptions } from './pool-containment'

export {
  addLaneToPool,
  addLaneAbove,
  addLaneBelow,
  compactLaneLayout,
} from './lane-management'
export type { AddLaneOptions } from './lane-management'

export {
  setupSwimlaneResize,
  clampLanePreviewRect,
} from './swimlane-resize'
export type { SwimlaneResizeOptions } from './swimlane-resize'

export {
  findBoundaryAttachHost,
  findContainingBpmnParent,
  resolveBpmnDropAction,
  resolveBpmnEmbeddingTargets,
} from './embedding'
export type {
  BpmnDropAction,
  BpmnDropRejectReason,
  ResolveBpmnEmbeddingOptions,
} from './embedding'

export {
  setupSwimlaneDelete,
  compensateLaneDelete,
} from './swimlane-delete'

export interface BpmnInteractionBehaviorOptions {
  boundaryAttach?: BoundaryAttachOptions
  poolContainment?: PoolContainmentOptions
  swimlaneResize?: SwimlaneResizeOptions
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
  const disposeSwimlaneResize = setupSwimlaneResize(graph, options.swimlaneResize)
  const disposeSwimlaneDelete = setupSwimlaneDelete(graph)

  const graphWithSelection = graph as Graph & {
    on?: (event: string, handler: (...args: any[]) => void) => void
    off?: (event: string, handler: (...args: any[]) => void) => void
    getSelectedCells?: () => Array<{ id?: string }>
    getConnectedEdges?: (node: unknown) => Array<{
      getSourceCellId?: () => string | null | undefined
      getTargetCellId?: () => string | null | undefined
      remove?: () => void
    }>
    getCellById?: (id: string) => {
      id?: string
      isNode?: () => boolean
      getParent?: () => unknown
      shape?: string
    } | null | undefined
    cleanSelection?: () => void
    select?: (cell: unknown) => void
  }

  const canWireGraphEvents = typeof graphWithSelection.on === 'function'
    && typeof graphWithSelection.off === 'function'

  const handleNodeClick = ({ node }: { node: any }) => {
    if (!isLaneShape(node?.shape)) {
      return
    }

    const parent = node.getParent?.()
    if (!parent?.isNode?.() || !isPoolShape(parent.shape)) {
      return
    }

    const selectedCells = graphWithSelection.getSelectedCells?.() ?? []
    if (!selectedCells.some((cell) => cell?.id === parent.id)) {
      return
    }

    window.requestAnimationFrame(() => {
      graphWithSelection.cleanSelection?.()
      graphWithSelection.select?.(node)
    })
  }

  const handleNodeEmbedded = ({
    node,
    currentParent,
    previousParent,
  }: {
    node: any
    currentParent?: any
    previousParent?: any
  }) => {
    const flowContainerResult = reconcileFlowContainerEmbedding(graphWithSelection, {
      node,
      currentParent,
      previousParent,
    })
    if (flowContainerResult !== 'unchanged') {
      return
    }

    if (!currentParent?.isNode?.() || currentParent.shape !== BPMN_TRANSACTION) {
      return
    }

    if (isBoundaryShape(node?.shape)) {
      return
    }

    node?.toFront?.()
  }

  const markMovingNode = ({ node }: { node: any }) => {
    markMovingBpmnNode(node)
  }

  const clearMovingNode = ({ node }: { node: any }) => {
    window.requestAnimationFrame(() => {
      clearMovingBpmnNode(node)
    })
  }

  const handleSelectionBatchStop = ({ name }: { name?: string }) => {
    if (name !== 'move-selection') {
      return
    }

    commitSelectedFlowContainerExtractions(graphWithSelection)
  }

  if (canWireGraphEvents) {
    graphWithSelection.on?.('node:click', handleNodeClick)
    graphWithSelection.on?.('node:embedded', handleNodeEmbedded)
    graphWithSelection.on?.('node:moving', markMovingNode)
    graphWithSelection.on?.('node:moved', clearMovingNode)
    graphWithSelection.on?.('batch:stop', handleSelectionBatchStop)
  }

  return () => {
    if (canWireGraphEvents) {
      graphWithSelection.off?.('batch:stop', handleSelectionBatchStop)
      graphWithSelection.off?.('node:moved', clearMovingNode)
      graphWithSelection.off?.('node:moving', markMovingNode)
      graphWithSelection.off?.('node:embedded', handleNodeEmbedded)
      graphWithSelection.off?.('node:click', handleNodeClick)
    }
    disposeSwimlaneDelete()
    disposeSwimlaneResize()
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
