import type { Graph, Node } from '@antv/x6'
import { isBoundaryShape, isPoolShape } from '../export/bpmn-mapping'
import {
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_GROUP,
  BPMN_LANE,
  BPMN_MANUAL_TASK,
  BPMN_POOL,
  BPMN_RECEIVE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_SEND_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SUB_PROCESS,
  BPMN_TASK,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
  BPMN_BUSINESS_RULE_TASK,
} from '../utils/constants'
import { distanceToRectEdge } from './geometry'
import { defaultIsValidHostForBoundary } from './boundary-attach'
import { isContainedFlowNode } from './swimlane-policy'
import { getAncestorFlowContainer, isFlowContainerShape } from '../core/swimlane-membership'

const MOVING_NODE_FLAG = Symbol('bpmn-moving-node')
const MOVING_FLOW_CONTAINER_FLAG = Symbol('bpmn-moving-flow-container')

export const DEFAULT_EMBEDDABLE_CONTAINER_SHAPES = new Set([
  BPMN_POOL,
  BPMN_LANE,
  BPMN_GROUP,
  BPMN_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_AD_HOC_SUB_PROCESS,
])

export const DEFAULT_BOUNDARY_HOST_SHAPES = new Set([
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
])

export interface ResolveBpmnEmbeddingOptions {
  /** 边界事件吸附距离阈值。 */
  boundarySnapDistance?: number
}

export type BpmnDropRejectReason =
  | 'boundary-host-required'
  | 'lane-parent-required'
  | 'contained-flow-node-parent-required'

export type BpmnDropAction =
  | { kind: 'attach-boundary'; host: Node }
  | { kind: 'embed'; parent: Node | null }
  | { kind: 'reject'; reason: BpmnDropRejectReason }

export function isEmbeddableContainerShape(shape: string): boolean {
  return DEFAULT_EMBEDDABLE_CONTAINER_SHAPES.has(shape)
}

export function findBoundaryAttachHost(
  graph: Pick<Graph, 'getNodes'>,
  boundary: Node,
  options: ResolveBpmnEmbeddingOptions = {},
): Node | null {
  const { boundarySnapDistance = 30 } = options
  const boundaryBounds = boundary.getBBox()
  const boundaryCenter = {
    x: boundaryBounds.x + boundaryBounds.width / 2,
    y: boundaryBounds.y + boundaryBounds.height / 2,
  }

  const candidates = graph.getNodes()
    .filter((candidate) => candidate.id !== boundary.id)
    .filter((candidate) => defaultIsValidHostForBoundary(candidate.shape, boundary.shape))
    .map((candidate) => ({
      node: candidate,
      bounds: candidate.getBBox(),
    }))
    .map(({ node, bounds }) => ({
      node,
      bounds,
      distance: distanceToRectEdge(boundaryCenter, bounds),
    }))
    .filter((candidate) => candidate.distance <= boundarySnapDistance)
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance
      }

      const leftArea = left.bounds.width * left.bounds.height
      const rightArea = right.bounds.width * right.bounds.height
      return leftArea - rightArea
    })

  return candidates[0]?.node ?? null
}

export function findContainingBpmnParent(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
): Node | null {
  const candidates = resolveContainingBpmnParents(graph, node)
  return candidates[0] ?? null
}

export function resolveContainingBpmnParents(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
): Node[] {
  const bbox = node.getBBox()

  return graph.getNodes()
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => {
      if (node.shape === BPMN_LANE) {
        return candidate.shape === BPMN_POOL
      }

      return isEmbeddableContainerShape(candidate.shape)
    })
    .filter((candidate) => candidate.getBBox().containsRect(bbox))
    .sort((left, right) => {
      const leftBox = left.getBBox()
      const rightBox = right.getBBox()
      return leftBox.width * leftBox.height - rightBox.width * rightBox.height
    })
}

export function resolveBpmnEmbeddingTargets(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
  options: ResolveBpmnEmbeddingOptions = {},
): Node[] {
  if (isBoundaryShape(node.shape)) {
    const host = findBoundaryAttachHost(graph, node, options)
    return host ? [host] : []
  }

  const flowContainer = getAncestorFlowContainer(node)
  if (flowContainer && !isExplicitFlowContainerExtraction(graph, node, flowContainer)) {
    return [flowContainer]
  }

  return resolveContainingBpmnParents(graph, node)
}

export function resolveBpmnDropAction(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
  options: ResolveBpmnEmbeddingOptions = {},
): BpmnDropAction {
  if (isBoundaryShape(node.shape)) {
    const host = findBoundaryAttachHost(graph, node, options)
    return host
      ? { kind: 'attach-boundary', host }
      : { kind: 'reject', reason: 'boundary-host-required' }
  }

  const parent = findContainingBpmnParent(graph, node)
  if (node.shape === BPMN_LANE && !parent) {
    return { kind: 'reject', reason: 'lane-parent-required' }
  }

  const hasPoolNodes = graph.getNodes().some((candidate) => isPoolShape(candidate.shape))
  if (isContainedFlowNode(node.shape) && hasPoolNodes && !parent) {
    return { kind: 'reject', reason: 'contained-flow-node-parent-required' }
  }

  return { kind: 'embed', parent }
}

function containsNodeBBox(container: Node, node: Node): boolean {
  try {
    return container.getBBox().containsRect(node.getBBox())
  } catch {
    return false
  }
}

export function markMovingBpmnNode(node: Pick<Node, 'shape'> | null | undefined): void {
  if (!node) {
    return
  }

  const movingNode = node as Record<PropertyKey, unknown>
  movingNode[MOVING_NODE_FLAG] = true
  if (isFlowContainerShape(node.shape)) {
    movingNode[MOVING_FLOW_CONTAINER_FLAG] = true
  }
}

export function clearMovingBpmnNode(node: Pick<Node, 'shape'> | null | undefined): void {
  if (!node) {
    return
  }

  const movingNode = node as Record<PropertyKey, unknown>
  delete movingNode[MOVING_NODE_FLAG]
  delete movingNode[MOVING_FLOW_CONTAINER_FLAG]
}

function isBpmnNodeMoving(node: Pick<Node, 'shape'> | null | undefined): boolean {
  return Boolean((node as Record<PropertyKey, unknown> | null | undefined)?.[MOVING_NODE_FLAG])
}

function isMovingFlowContainer(node: Pick<Node, 'shape'> | null | undefined): boolean {
  return Boolean((node as Record<PropertyKey, unknown> | null | undefined)?.[MOVING_FLOW_CONTAINER_FLAG])
}

export function isExplicitFlowContainerExtraction(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
  flowContainer: Node,
): boolean {
  if (containsNodeBBox(flowContainer, node) || isMovingFlowContainer(flowContainer)) {
    return false
  }

  if (isBpmnNodeMoving(node)) {
    return true
  }

  const selectableGraph = graph as Pick<Graph, 'getNodes'> & {
    getSelectedCells?: () => Array<{ id?: string }>
  }
  const selectedCells = selectableGraph.getSelectedCells?.() ?? []
  const isNodeSelected = selectedCells.some((cell) => cell?.id === node.id)
  const isContainerSelected = selectedCells.some((cell) => cell?.id === flowContainer.id)

  return isNodeSelected && !isContainerSelected
}
