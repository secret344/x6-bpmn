/**
 * Pool / Participant 容器约束行为
 *
 * 在存在 Pool 的协作图场景下，约束流程节点必须位于某个 Pool / Lane 内部。
 * 主库只负责限制与结果回调，不直接承担 UI 提示。
 */

import type { Graph, Node, Cell } from '@antv/x6'
import { isBoundaryShape, isSwimlaneShape } from '../export/bpmn-mapping'
import { BPMN_POOL } from '../utils/constants'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface PoolContainmentResult {
  /** 是否通过容器约束 */
  valid: boolean
  /** 失败原因 */
  reason?: string
  /** 当前或建议归属的泳道容器 */
  container?: Node | null
}

export interface PoolContainmentOptions {
  /** 拖拽越界时是否自动回退到最后一个合法位置，默认 true */
  constrainToContainer?: boolean
  /** 新增节点不合法时是否直接移除，默认 true */
  removeInvalidOnAdd?: boolean
  /** 失败回调，由宿主决定是否提示 */
  onViolation?: (result: PoolContainmentResult, node: Node) => void
  /** 自定义失败文案 */
  reason?: string
  /** 自定义判断某个 shape 是否受容器约束 */
  isContainedNode?: (shape: string) => boolean
}

const DEFAULT_REASON = '流程节点必须位于池/参与者内部'

type TranslatableNode = Node & {
  translate?: (tx: number, ty: number, options?: unknown) => void
}

function nodeRect(node: Pick<Node, 'getPosition' | 'getSize'>): Rect {
  const position = node.getPosition()
  const size = node.getSize()
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  }
}

function area(rect: Rect): number {
  return rect.width * rect.height
}

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

function hasPoolNodes(graph: Graph): boolean {
  try {
    return graph.getNodes().some((node) => node.shape === BPMN_POOL)
  } catch {
    return false
  }
}

function restoreNodePosition(node: Node, position: { x: number; y: number }): void {
  const current = node.getPosition()
  const deltaX = position.x - current.x
  const deltaY = position.y - current.y

  if (deltaX === 0 && deltaY === 0) return

  const translatableNode = node as TranslatableNode
  if (typeof translatableNode.translate === 'function') {
    try {
      // 优先使用 translate，确保 X6 递归同步已嵌入的附着节点。
      translatableNode.translate(deltaX, deltaY)
      return
    } catch {
      // translate 失败时退回绝对定位，避免主链路中断。
    }
  }

  node.setPosition(position.x, position.y)
}

export function isContainedFlowNode(shape: string): boolean {
  return !isSwimlaneShape(shape) && !isBoundaryShape(shape)
}

export function getSwimlaneAncestor(node: Node | null | undefined): Node | null {
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

  try {
    return graph.getNodes()
      .filter((node) => isSwimlaneShape(node.shape))
      .filter((node) => node.id !== excludeNodeId)
      .filter((node) => containsRect(nodeRect(node), rect))
      .sort((left, right) => area(nodeRect(left)) - area(nodeRect(right)))[0] ?? null
  } catch {
    return null
  }
}

export function validatePoolContainment(
  graph: Graph,
  node: Node,
  options: Pick<PoolContainmentOptions, 'reason' | 'isContainedNode'> = {},
): PoolContainmentResult {
  const reason = options.reason ?? DEFAULT_REASON
  const isContainedNode = options.isContainedNode ?? isContainedFlowNode

  if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) {
    return { valid: true }
  }

  const rect = nodeRect(node)
  const ancestor = getSwimlaneAncestor(node)
  if (ancestor && containsRect(nodeRect(ancestor), rect)) {
    return { valid: true, container: ancestor }
  }

  const container = findContainingSwimlane(graph, rect, node.id)
  if (container) {
    return { valid: true, container }
  }

  return { valid: false, reason }
}

export function setupPoolContainment(
  graph: Graph,
  options: PoolContainmentOptions = {},
): () => void {
  const {
    constrainToContainer = true,
    removeInvalidOnAdd = true,
    onViolation,
    reason = DEFAULT_REASON,
    isContainedNode = isContainedFlowNode,
  } = options

  const lastValidState = new WeakMap<Node, { x: number; y: number; container: Node | null }>()
  const lastViolationReason = new WeakMap<Node, string>()

  function rememberValidState(node: Node, container?: Node | null): void {
    const position = node.getPosition()
    lastValidState.set(node, {
      x: position.x,
      y: position.y,
      container: container ?? getSwimlaneAncestor(node),
    })
  }

  function clearViolation(node: Node): void {
    lastViolationReason.delete(node)
  }

  function notifyViolation(result: PoolContainmentResult, node: Node): void {
    const key = result.reason as string
    if (lastViolationReason.get(node) === key) return
    lastViolationReason.set(node, key)
    try {
      onViolation?.(result, node)
    } catch {
      // 宿主提示逻辑不应打断主链路。
    }
  }

  function syncContainment(node: Node): boolean {
    const result = validatePoolContainment(graph, node, { reason, isContainedNode })
    if (!result.valid) {
      notifyViolation(result, node)
      return false
    }

    const currentAncestor = getSwimlaneAncestor(node)
    const nextContainer = result.container as Node
    if (currentAncestor?.id !== nextContainer.id) {
      currentAncestor?.unembed?.(node)
      nextContainer.embed(node)
    }

    rememberValidState(node, nextContainer)
    clearViolation(node)
    return true
  }

  function restoreLastValidState(node: Node): void {
    const lastState = lastValidState.get(node)
    if (!lastState) return

    restoreNodePosition(node, { x: lastState.x, y: lastState.y })

    const currentAncestor = getSwimlaneAncestor(node)
    const expectedContainer = lastState.container ?? findContainingSwimlane(graph, node, node.id)
    if (!expectedContainer || currentAncestor?.id === expectedContainer.id) return

    currentAncestor?.unembed?.(node)
    expectedContainer.embed(node)
  }

  function onNodeAdded({ node }: { node: Node }) {
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (syncContainment(node)) return
    if (removeInvalidOnAdd) {
      node.remove()
    }
  }

  function onNodeMoving({ node }: { node: Node }) {
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (syncContainment(node)) return
    if (!constrainToContainer) return

    restoreLastValidState(node)
  }

  function onNodeMoved({ node }: { node: Node }) {
    if (!hasPoolNodes(graph) || !isContainedNode(node.shape)) return
    if (syncContainment(node)) return
    if (!constrainToContainer) return

    restoreLastValidState(node)
  }

  try {
    for (const node of graph.getNodes()) {
      rememberValidState(node)
    }
  } catch {
    // graph.getNodes() 防御性兜底。
  }

  graph.on('node:added', onNodeAdded)
  graph.on('node:moving', onNodeMoving)
  graph.on('node:moved', onNodeMoved)

  return () => {
    graph.off('node:added', onNodeAdded)
    graph.off('node:moving', onNodeMoving)
    graph.off('node:moved', onNodeMoved)
  }
}