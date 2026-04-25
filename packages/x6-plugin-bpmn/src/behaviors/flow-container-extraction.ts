import type { Cell, Graph, Node } from '@antv/x6'
import { isSwimlaneShape } from '../export/bpmn-mapping'
import { getAncestorFlowContainer, hasAncestorNode, isFlowContainerShape } from '../core/swimlane-membership'
import { isExplicitFlowContainerExtraction, resolveContainingBpmnParents } from './embedding'

type EdgeLike = {
  getSourceCellId?: () => string | null | undefined
  getTargetCellId?: () => string | null | undefined
  remove?: () => void
}

type NodeLike = Cell & {
  id?: string
  shape?: string
  embed?: (cell: unknown) => void
  unembed?: (cell: unknown) => void
}

export type FlowContainerExtractionGraph = Pick<Graph, 'getNodes'> & {
  getSelectedCells?: () => Cell[]
  getConnectedEdges?: (node: unknown) => EdgeLike[]
  getCellById?: (id: string) => Cell | null | undefined
}

export type FlowContainerEmbeddingResult = 'unchanged' | 'restored' | 'extracted'

type PendingFlowContainerExtraction = {
  node: Node
  flowContainer: Node
  nextParent: Node
}

export function reconcileFlowContainerEmbedding(
  graph: FlowContainerExtractionGraph,
  {
    node,
    currentParent,
    previousParent,
  }: {
    node: Node
    currentParent?: NodeLike | null
    previousParent?: NodeLike | null
  },
): FlowContainerEmbeddingResult {
  if (!isFlowContainerToSwimlaneReparent(previousParent, currentParent)) {
    return 'unchanged'
  }

  if (isExplicitFlowContainerExtraction(graph, node, previousParent as Node)) {
    disconnectExtractedNodeFromFlowContainer(graph, node, previousParent as Node)
    return 'extracted'
  }

  currentParent?.unembed?.(node)
  previousParent?.embed?.(node)
  return 'restored'
}

export function commitSelectedFlowContainerExtractions(graph: FlowContainerExtractionGraph): number {
  const selectedNodes = (graph.getSelectedCells?.() ?? []).filter(isNodeCell)
  const pendingExtractions = selectedNodes.flatMap((node): PendingFlowContainerExtraction[] => {
    const flowContainer = getAncestorFlowContainer(node)
    if (!flowContainer || !isExplicitFlowContainerExtraction(graph, node, flowContainer)) {
      return []
    }

    const nextParent = findExtractionParent(graph, node, flowContainer)
    if (!nextParent) {
      return []
    }

    return [{ node, flowContainer, nextParent }]
  })

  pendingExtractions.forEach(({ node, nextParent }) => {
    const currentParent = node.getParent?.() as NodeLike | null | undefined
    currentParent?.unembed?.(node)
    nextParent.embed(node)
  })

  pendingExtractions.forEach(({ node, flowContainer }) => {
    disconnectExtractedNodeFromFlowContainer(graph, node, flowContainer)
  })

  return pendingExtractions.length
}

export function disconnectExtractedNodeFromFlowContainer(
  graph: FlowContainerExtractionGraph,
  node: Node,
  flowContainer: Node,
): void {
  if (!node?.id || !flowContainer?.id || typeof graph.getConnectedEdges !== 'function') {
    return
  }

  const edgesToRemove = graph
    .getConnectedEdges(node)
    .filter((edge) => isEdgeConnectedToFlowContainerSubtree(graph, edge, node.id, flowContainer.id))

  edgesToRemove.forEach((edge) => edge.remove?.())
}

function isFlowContainerToSwimlaneReparent(
  previousParent: NodeLike | null | undefined,
  currentParent: NodeLike | null | undefined,
): previousParent is NodeLike {
  return Boolean(
    previousParent?.isNode?.()
    && currentParent?.isNode?.()
    && previousParent.shape
    && isFlowContainerShape(previousParent.shape)
    && currentParent.shape
    && isSwimlaneShape(currentParent.shape),
  )
}

function findExtractionParent(
  graph: Pick<Graph, 'getNodes'>,
  node: Node,
  flowContainer: Node,
): Node | null {
  return resolveContainingBpmnParents(graph, node)
    .find((candidate) => candidate.id !== flowContainer.id && !hasAncestorNode(candidate, node.id)) ?? null
}

function isEdgeConnectedToFlowContainerSubtree(
  graph: FlowContainerExtractionGraph,
  edge: EdgeLike,
  nodeId: string,
  flowContainerId: string,
): boolean {
  const sourceId = edge.getSourceCellId?.()
  const targetId = edge.getTargetCellId?.()
  const peerId = sourceId === nodeId
    ? targetId
    : targetId === nodeId
      ? sourceId
      : null

  if (!peerId || typeof graph.getCellById !== 'function') {
    return false
  }

  const peerNode = graph.getCellById(peerId)
  if (!isNodeCell(peerNode)) {
    return false
  }

  return peerNode.id === flowContainerId || hasAncestorNode(peerNode, flowContainerId)
}

function isNodeCell(cell: Cell | null | undefined): cell is Node {
  return Boolean(cell?.isNode?.())
}