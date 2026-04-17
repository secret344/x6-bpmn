/**
 * 泳道删除行为
 *
 * 参照 bpmn-js DeleteLaneBehavior 实现，适配 X6 事件模型。
 *
 * 核心规则（参照 pool.md）：
 * - 删除 Lane 后释放的空间按同层规则重新分配
 * - 两侧都存在时，固定按 1:1 分配给两侧相邻 Lane
 * - 只有一侧存在时，全部交给该侧
 * - 如果接收空间的 Lane 是嵌套 Lane，按删除侧从父到子逐层调整相邻 Lane
 * - 删除最后一条 Lane 且不存在相邻接收方时，内嵌的非 Lane 子节点回挂父容器
 * - 删除 childLaneSet 或 Lane 子树时，Lane 子节点仍直接一起删除
 * - 不引入"整体顶上去"的额外平移语义
 */

import type { Cell, Graph, Node } from '@antv/x6'
import { isLaneShape, isPoolShape } from '../export/bpmn-mapping'
import {
  LANE_INDENTATION,
  nodeRect,
  getChildLanes,
  isSwimlaneHorizontal,
} from './swimlane-layout'

// ============================================================================
// 类型定义
// ============================================================================

export interface SwimlaneDeleteOptions {
  /** 删除 Lane 后是否自动重新分配空间（默认 true） */
  autoRedistribute?: boolean
}

type RemoveOptions = Record<string, unknown>

interface DeleteMigrationPlan {
  deletedLaneId: string
  deletedBounds: { x: number; y: number; width: number; height: number }
  isHorizontal: boolean
  beforeRecipientId: string | null
  afterRecipientId: string | null
  fallbackRecipientId: string | null
}

interface DeleteRecipients {
  before: Node | null
  after: Node | null
}

// ============================================================================
// 删除补偿核心算法
// ============================================================================

/**
 * 删除 Lane 后补偿空间分配。
 *
 * 参照 bpmn-js compensateLaneDelete 算法：
 * 1. 取被删除 Lane 的同层兄弟 Lane
 * 2. 按位置分成两组（上/下 或 左/右）
 * 3. 双侧都有：各补偿一半；单侧存在：全部补偿
 * 4. 如果接收方是嵌套 Lane，按方向逐层钻到贴边子 Lane
 */
export function compensateLaneDelete(
  graph: Graph,
  deletedShape: { x: number; y: number; width: number; height: number },
  siblings: Node[],
  isHorizontal: boolean,
): void {
  const recipients = resolveDeleteRecipients(siblings, deletedShape, isHorizontal)
  if (!recipients.before && !recipients.after) return

  // 计算补偿量
  const totalSpace = isHorizontal ? deletedShape.height : deletedShape.width
  const hasBoth = Boolean(recipients.before && recipients.after)
  const offsetPerSide = hasBoth ? totalSpace / 2 : totalSpace

  graph.startBatch('delete-lane-compensate')
  try {
    // 只允许紧邻删除区域的 Lane 接收空间，严格遵循 pool.md 的相邻分配语义。
    if (recipients.before) {
      compensateSide(recipients.before, isHorizontal, 'after', offsetPerSide)
    }

    if (recipients.after) {
      compensateSide(recipients.after, isHorizontal, 'before', offsetPerSide)
    }
  } finally {
    graph.stopBatch('delete-lane-compensate')
  }
}

/**
 * 对一侧的 Lane 进行空间补偿。
 *
 * @param lane - 该侧接收补偿的相邻 Lane（可能包含嵌套 Lane）
 * @param isHorizontal - 是否水平布局
 * @param expandDirection - 扩展方向：'after' 表示向下/右扩展，'before' 表示向上/左扩展
 * @param offset - 补偿量
 */
function compensateSide(
  lane: Node,
  isHorizontal: boolean,
  expandDirection: 'before' | 'after',
  offset: number,
): void {
  if (expandDirection === 'after') {
    // 扩展尾边（bottom / right）
    expandLaneEdge(lane, isHorizontal, 'after', offset)
  } else {
    // 扩展首边（top / left）：移动位置 + 增加尺寸
    expandLaneEdge(lane, isHorizontal, 'before', offset)
  }
}

function resolveDeleteRecipients(
  siblings: Node[],
  deletedShape: { x: number; y: number; width: number; height: number },
  isHorizontal: boolean,
): DeleteRecipients {
  const before: Node[] = []
  const after: Node[] = []

  for (const sibling of siblings) {
    const sibPos = sibling.getPosition()

    if (isHorizontal) {
      if (sibPos.y < deletedShape.y) {
        before.push(sibling)
      } else {
        after.push(sibling)
      }
      continue
    }

    if (sibPos.x < deletedShape.x) {
      before.push(sibling)
    } else {
      after.push(sibling)
    }
  }

  return {
    before: findEdgeLane(before, isHorizontal, 'after'),
    after: findEdgeLane(after, isHorizontal, 'before'),
  }
}

/**
 * 扩展 Lane 的某一条边。
 *
 * 如果该 Lane 有子 Lane，则递归找到贴边的子 Lane 进行扩展。
 */
function expandLaneEdge(
  lane: Node,
  isHorizontal: boolean,
  edge: 'before' | 'after',
  offset: number,
): void {
  const childLanes = getChildLanes(lane)
  const pos = lane.getPosition()
  const size = lane.getSize()

  if (isHorizontal) {
    if (edge === 'after') {
      // 向下扩展：增加高度
      lane.setSize(size.width, size.height + offset)

      // 如果有嵌套子 Lane，找到最底部的子 Lane 进行扩展
      if (childLanes.length > 0) {
        const bottomChild = findEdgeLane(childLanes, isHorizontal, 'after')
          expandLaneEdge(bottomChild as Node, isHorizontal, 'after', offset)
      }
    } else {
      // 向上扩展：上移位置 + 增加高度
      lane.setPosition(pos.x, pos.y - offset)
      lane.setSize(size.width, size.height + offset)

      // 如果有嵌套子 Lane，找到最顶部的子 Lane 进行扩展
      if (childLanes.length > 0) {
        const topChild = findEdgeLane(childLanes, isHorizontal, 'before')
          expandLaneEdge(topChild as Node, isHorizontal, 'before', offset)
      }
    }
  } else {
    if (edge === 'after') {
      // 向右扩展：增加宽度
      lane.setSize(size.width + offset, size.height)

      if (childLanes.length > 0) {
        const rightChild = findEdgeLane(childLanes, isHorizontal, 'after')
          expandLaneEdge(rightChild as Node, isHorizontal, 'after', offset)
      }
    } else {
      // 向左扩展：左移位置 + 增加宽度
      lane.setPosition(pos.x - offset, pos.y)
      lane.setSize(size.width + offset, size.height)

      if (childLanes.length > 0) {
        const leftChild = findEdgeLane(childLanes, isHorizontal, 'before')
          expandLaneEdge(leftChild as Node, isHorizontal, 'before', offset)
      }
    }
  }
}

/**
 * 在一组同层 Lane 中找到最贴边的那个。
 *
 * - before + horizontal → 最顶部的 Lane
 * - after + horizontal → 最底部的 Lane
 * - before + vertical → 最左侧的 Lane
 * - after + vertical → 最右侧的 Lane
 */
function findEdgeLane(
  lanes: Node[],
  isHorizontal: boolean,
  edge: 'before' | 'after',
): Node | null {
  if (lanes.length === 0) return null

  return lanes.reduce((best, current) => {
    const bestPos = best.getPosition()
    const bestSize = best.getSize()
    const curPos = current.getPosition()
    const curSize = current.getSize()

    if (isHorizontal) {
      if (edge === 'before') {
        return curPos.y < bestPos.y ? current : best
      } else {
        return (curPos.y + curSize.height) > (bestPos.y + bestSize.height) ? current : best
      }
    } else {
      if (edge === 'before') {
        return curPos.x < bestPos.x ? current : best
      } else {
        return (curPos.x + curSize.width) > (bestPos.x + bestSize.width) ? current : best
      }
    }
  })
}

// ============================================================================
// 行为安装
// ============================================================================

/**
 * 安装泳道删除行为。
 *
 * 监听 X6 的 node:removed 事件，当删除的节点是 Lane 时，
 * 自动补偿空间给相邻 Lane。
 */
export function setupSwimlaneDelete(
  graph: Graph,
  options?: SwimlaneDeleteOptions,
): () => void {
  const { autoRedistribute = true } = options ?? {}
  const disposers: (() => void)[] = []
  let deleteDepth = 0
  const preparedLaneIds = new Set<string>()

  if (autoRedistribute) {
    const originalRemoveCell = graph.removeCell.bind(graph)
    const originalRemoveCells = graph.removeCells.bind(graph)

    const beginDelete = () => {
      deleteDepth += 1
    }

    const endDelete = () => {
      deleteDepth = Math.max(0, deleteDepth - 1)
      if (deleteDepth === 0) {
        preparedLaneIds.clear()
      }
    }

    const prepareCandidateLane = (candidate: Cell | string) => {
      const node = resolveCandidateNode(graph, candidate)
      if (!node || !isLaneShape(node.shape)) {
        return
      }

      if (preparedLaneIds.has(node.id)) {
        return
      }

      preparedLaneIds.add(node.id)
      prepareLaneDelete(graph, node)
    }

    graph.removeCell = ((obj: Cell | string, removeOptions = {}) => {
      beginDelete()
      try {
        prepareCandidateLane(obj)
        const expandedCandidates = expandPoolDeleteCandidates(graph, [obj], removeOptions as RemoveOptions)
        const normalizedRemoveOptions = expandedCandidates.length > 1
          ? { ...(removeOptions as RemoveOptions), deep: false }
          : (removeOptions as RemoveOptions)

        if (expandedCandidates.length === 1) {
          return originalRemoveCell(obj as string & Cell, normalizedRemoveOptions)
        }

        const removed = originalRemoveCells(expandedCandidates, normalizedRemoveOptions)
        return removed[removed.length - 1] ?? null
      } finally {
        endDelete()
      }
    }) as typeof graph.removeCell

    graph.removeCells = ((cells: (Cell | string)[], removeOptions = {}) => {
      beginDelete()
      try {
        for (const candidate of cells) {
          prepareCandidateLane(candidate)
        }

        const expandedCandidates = expandPoolDeleteCandidates(graph, cells, removeOptions as RemoveOptions)
        const normalizedRemoveOptions = expandedCandidates.length > cells.length
          ? { ...(removeOptions as RemoveOptions), deep: false }
          : (removeOptions as RemoveOptions)

        return originalRemoveCells(expandedCandidates, normalizedRemoveOptions)
      } finally {
        endDelete()
      }
    }) as typeof graph.removeCells

    disposers.push(() => {
      graph.removeCell = originalRemoveCell
      graph.removeCells = originalRemoveCells
    })
  }

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}

function resolveCandidateNode(graph: Graph, candidate: Cell | string): Node | null {
  const cell = typeof candidate === 'string' ? graph.getCellById(candidate) : candidate
  return cell?.isNode?.() ? cell as Node : null
}

function expandPoolDeleteCandidates(
  graph: Graph,
  candidates: Array<Cell | string>,
  _removeOptions: RemoveOptions,
): Array<Cell | string> {
  const expandedCandidates: Array<Cell | string> = []
  const appendedIds = new Set<string>()

  const appendCandidate = (candidate: Cell | string) => {
    const id = typeof candidate === 'string' ? candidate : candidate.id
    if (!appendedIds.has(id)) {
      appendedIds.add(id)
      expandedCandidates.push(candidate)
    }
  }

  let containsPool = false

  for (const candidate of candidates) {
    const node = resolveCandidateNode(graph, candidate)
    if (node && isPoolShape(node.shape)) {
      containsPool = true

      const descendants = node.getDescendants({ deep: true, breadthFirst: true })
      for (const descendant of descendants.reverse()) {
        appendCandidate(descendant)
      }
    }

    appendCandidate(candidate)
  }

  if (!containsPool) {
    return candidates
  }

  // X6 在不同删除入口上对 Pool 子树的递归移除并不稳定，
  // 这里统一显式展开 Pool 子树，由外层调用改用 deep:false 做扁平删除。
  return expandedCandidates
}

function prepareLaneDelete(graph: Graph, deletedLane: Node): void {
  const deletedBounds = nodeRect(deletedLane)
  const parent = resolveDeleteParent(graph, deletedLane, deletedBounds)
  if (!parent || !parent.isNode()) {
    return
  }

  const isHorizontal = isSwimlaneHorizontal(deletedLane)
  const remainingSiblings = getChildLanes(parent as Node).filter(
    (child) => child.id !== deletedLane.id,
  )
  const migrationPlan = buildDeleteMigrationPlan(
    deletedLane,
    deletedBounds,
    remainingSiblings,
    isHorizontal,
    parent as Node,
  )

  compensateLaneDelete(graph, deletedBounds, remainingSiblings, isHorizontal)

  migrateDeletedLaneContent(graph, deletedLane, migrationPlan)
}

function buildDeleteMigrationPlan(
  deletedLane: Node,
  deletedBounds: { x: number; y: number; width: number; height: number },
  remainingSiblings: Node[],
  isHorizontal: boolean,
  fallbackRecipient: Node,
): DeleteMigrationPlan {
  const before: Node[] = []
  const after: Node[] = []

  for (const sibling of remainingSiblings) {
    const sibPos = sibling.getPosition()

    if (isHorizontal) {
      if (sibPos.y < deletedBounds.y) {
        before.push(sibling)
      } else {
        after.push(sibling)
      }
    } else if (sibPos.x < deletedBounds.x) {
      before.push(sibling)
    } else {
      after.push(sibling)
    }
  }

  return {
    deletedLaneId: deletedLane.id,
    deletedBounds,
    isHorizontal,
    beforeRecipientId: findEdgeLane(before, isHorizontal, 'after')?.id ?? null,
    afterRecipientId: findEdgeLane(after, isHorizontal, 'before')?.id ?? null,
    fallbackRecipientId: fallbackRecipient.id,
  }
}

function migrateDeletedLaneContent(graph: Graph, deletedLane: Node, migrationPlan: DeleteMigrationPlan): void {
  const children = deletedLane.getChildren()?.filter((child) => child.isNode()) ?? []

  for (const child of children) {
    const childNode = child as Node
    if (isLaneShape(childNode.shape)) {
      continue
    }

    const recipient = resolveMigrationRecipient(graph, childNode, migrationPlan)
    if (!recipient) {
      continue
    }

    reparentNodeToContainer(childNode, recipient)
  }
}

function resolveMigrationRecipient(
  graph: Graph,
  node: Node,
  migrationPlan: DeleteMigrationPlan,
): Node | null {
  const {
    beforeRecipientId,
    afterRecipientId,
    fallbackRecipientId,
    isHorizontal,
    deletedBounds,
  } = migrationPlan

  const fallbackRecipient = resolveRecipientNode(graph, fallbackRecipientId)

  if (beforeRecipientId && !afterRecipientId) {
    return resolveRecipientNode(graph, beforeRecipientId) ?? fallbackRecipient
  }

  if (afterRecipientId && !beforeRecipientId) {
    return resolveRecipientNode(graph, afterRecipientId) ?? fallbackRecipient
  }

  if (!beforeRecipientId && !afterRecipientId) {
    return fallbackRecipient
  }

  const position = node.getPosition()
  const size = node.getSize()

  if (isHorizontal) {
    const centerY = position.y + size.height / 2
    const splitY = deletedBounds.y + deletedBounds.height / 2
    return centerY <= splitY
      ? resolveRecipientNode(graph, beforeRecipientId) ?? fallbackRecipient
      : resolveRecipientNode(graph, afterRecipientId) ?? fallbackRecipient
  }

  const centerX = position.x + size.width / 2
  const splitX = deletedBounds.x + deletedBounds.width / 2
  return centerX <= splitX
    ? resolveRecipientNode(graph, beforeRecipientId) ?? fallbackRecipient
    : resolveRecipientNode(graph, afterRecipientId) ?? fallbackRecipient
}

function resolveRecipientNode(graph: Graph, recipientId: string | null): Node | null {
  if (!recipientId) {
    return null
  }

  const recipient = graph.getCellById(recipientId)
  return recipient?.isNode() ? recipient as Node : null
}

function reparentNodeToContainer(node: Node, parent: Node): void {
  try {
    const currentParent = node.getParent()
    if (currentParent?.isNode?.() && currentParent.id !== parent.id) {
      const currentParentNode = currentParent as Node & {
        unembed?: (child: Node) => void
      }
      currentParentNode.unembed?.(node)
    }

    if (typeof parent.embed === 'function') {
      parent.embed(node)
      return
    }

    if (typeof (parent as Node & { addChild?: (child: Node) => void }).addChild === 'function') {
      ;(parent as Node & { addChild?: (child: Node) => void }).addChild(node)
    }
  } catch {
    // 忽略重复 embed 或宿主已在中间态清理父链的瞬时异常
  }
}

function resolveDeleteParent(graph: Graph, node: Node, deletedBounds: { x: number; y: number; width: number; height: number }): Node | null {
  const directParent = node.getParent()
  if (directParent?.isNode()) {
    return directParent as Node
  }

  const parentId = (node as Node & {
    getPropByPath?: (path: string) => unknown
    getProp?: (path: string) => unknown
  }).getPropByPath?.('parent')
    ?? (node as Node & {
      getProp?: (path: string) => unknown
    }).getProp?.('parent')

  if (typeof parentId === 'string') {
    const parentCell = graph.getCellById(parentId)
    if (parentCell?.isNode()) {
      return parentCell as Node
    }
  }

  return graph
    .getNodes()
    .filter((candidate) => isPoolShape(candidate.shape))
    .find((candidate) => containsDeletedLane(candidate, deletedBounds)) ?? null
}

function containsDeletedLane(pool: Node, deletedBounds: { x: number; y: number; width: number; height: number }): boolean {
  const poolBounds = nodeRect(pool)
  const tolerance = 1
  const laneLeft = deletedBounds.x - LANE_INDENTATION
  const laneRight = deletedBounds.x + deletedBounds.width
  const laneTop = deletedBounds.y
  const laneBottom = deletedBounds.y + deletedBounds.height
  const poolRight = poolBounds.x + poolBounds.width
  const poolBottom = poolBounds.y + poolBounds.height

  return laneLeft >= poolBounds.x - tolerance
    && laneRight <= poolRight + tolerance
    && laneTop >= poolBounds.y - tolerance
    && laneBottom <= poolBottom + tolerance
}

export const __test__ = {
  resolveCandidateNode,
  expandPoolDeleteCandidates,
  compensateSide,
  expandLaneEdge,
  findEdgeLane,
  resolveDeleteRecipients,
  prepareLaneDelete,
  buildDeleteMigrationPlan,
  migrateDeletedLaneContent,
  resolveMigrationRecipient,
  resolveRecipientNode,
  reparentNodeToContainer,
  resolveDeleteParent,
  containsDeletedLane,
}
