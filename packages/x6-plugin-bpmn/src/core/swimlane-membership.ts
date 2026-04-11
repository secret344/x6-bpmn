import type { Cell, Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { nodeRect, type Rect } from '../behaviors/swimlane-layout'

function area(rect: Rect): number {
  return rect.width * rect.height
}

function rectRight(rect: Rect): number {
  return rect.x + rect.width
}

function rectBottom(rect: Rect): number {
  return rect.y + rect.height
}

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  )
}

function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rectRight(rect) && y >= rect.y && y <= rectBottom(rect)
}

function getGraphNodes(graph: Graph): Node[] {
  try {
    return graph.getNodes()
  } catch {
    return []
  }
}

export function getAncestorPool(node: Node | Cell | null | undefined): Node | null {
  let current = node as Cell | null | undefined

  while (current) {
    if (current.isNode?.() && isPoolShape(current.shape)) {
      return current as Node
    }

    current = current.getParent?.() as Cell | null | undefined
  }

  return null
}

export function getAncestorSwimlane(node: Node | Cell | null | undefined): Node | null {
  let current = node?.getParent?.() as Cell | null | undefined

  while (current) {
    if (current.isNode?.() && isSwimlaneShape(current.shape)) {
      return current as Node
    }

    current = current.getParent?.() as Cell | null | undefined
  }

  return null
}

export function findContainingSwimlane(
  graph: Graph,
  target: Rect | Pick<Node, 'getPosition' | 'getSize'>,
  excludeNodeId?: string,
): Node | null {
  const rect = 'x' in target ? target : nodeRect(target)

  const candidates = getGraphNodes(graph)
    .filter((node) => isSwimlaneShape(node.shape))
    .filter((node) => node.id !== excludeNodeId)
    .filter((node) => containsRect(nodeRect(node), rect))
    .sort((left, right) => area(nodeRect(left)) - area(nodeRect(right)))

  const laneCandidate = candidates.find((node) => isLaneShape(node.shape))
  if (laneCandidate) {
    return laneCandidate
  }

  return candidates[0] ?? null
}

export function resolveLaneMemberNodes(lane: Node, flowNodes: Node[]): Node[] {
  const laneBounds = nodeRect(lane)

  return flowNodes.filter((node) => {
    const ancestor = getAncestorSwimlane(node)
    if (ancestor && isLaneShape(ancestor.shape)) {
      return ancestor.id === lane.id
    }

    const position = node.getPosition()
    const size = node.getSize()
    const centerX = position.x + size.width / 2
    const centerY = position.y + size.height / 2
    return containsPoint(laneBounds, centerX, centerY)
  })
}