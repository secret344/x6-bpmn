/**
 * 边界事件吸附行为（Boundary Event Attach Behavior）
 *
 * 利用 X6 内置的 embedding 机制（parent/child 自动跟随移动、级联删除），
 * 仅补充 X6 未提供的 BPMN 特有逻辑：
 *
 * ① 拖放吸附 — 边界事件落在 Activity 边框附近时，snap 到边框并建立 embed
 * ② 边框约束 — 已吸附的边界事件拖拽时只能沿宿主边框移动
 * ③ 宿主 resize — 宿主尺寸变化后重新计算边界事件位置
 * ④ 脱离检测 — 拖离宿主足够远时解除绑定
 *
 * X6 已内置的能力（无需重新实现）：
 * - 子节点跟随父节点移动（Cell.translate 自动递归 children）
 * - 父节点删除时级联删除子节点（Cell.remove deep=true）
 * - embed() / unembed() / getParent() / getChildren() API
 */

import type { Graph, Node, Cell } from '@antv/x6'
import {
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
  BPMN_BOUNDARY_EVENT_CANCEL,
} from '../utils/constants'
import { isBoundaryShape } from '../export/bpmn-mapping'
import { snapToRectEdge, boundaryPositionToPoint } from './geometry'
import type { BoundaryPosition, Rect } from './geometry'

// ============================================================================
// 配置项
// ============================================================================

export interface BoundaryAttachOptions {
  /**
   * 吸附距离阈值 (px)。
   * 边界事件中心到宿主边框距离 < 此值时触发吸附。
   * @default 30
   */
  snapDistance?: number

  /**
   * 脱离距离阈值 (px)。
   * 已吸附的边界事件中心到宿主边框距离 > 此值时解除绑定。
   * 设为 Infinity 禁止脱离（只能通过边框滑动）。
   * @default 60
   */
  detachDistance?: number

  /**
   * 是否约束边界事件只能沿宿主边框移动。
   * @default true
   */
  constrainToEdge?: boolean

  /**
   * 自定义判断：某个 shape 是否可作为宿主（Activity）。
   * 传入后覆盖内置默认判断。
   * @deprecated 建议改用 isValidHostForBoundary，支持根据边界事件类型指定合法宿主
   */
  isValidHost?: (shape: string) => boolean

  /**
   * 自定义判断：宿主-边界事件组合是否合法。
   * 指定后优先于 isValidHost。
   * 默认使用 defaultIsValidHostForBoundary（Cancel 事件只允许附着 Transaction）。
   */
  isValidHostForBoundary?: (hostShape: string, boundaryShape: string) => boolean

  /**
   * 自定义判断：某个 shape 是否为边界事件。
   * 传入后覆盖内置默认判断（基于 shape 名称前缀）。
   */
  isBoundaryEvent?: (shape: string) => boolean
}

// ============================================================================
// 默认的宿主/边界事件判断
// ============================================================================

/** 默认可作为边界事件宿主的 Activity 图形集合 */
const DEFAULT_HOST_SHAPES = new Set([
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

/**
 * 取消边界事件的合法宿主集合。
 * 规范要求：Cancel 边界事件只能附着到事务子流程（Transaction Sub-Process）边界。
 */
export const CANCEL_BOUNDARY_HOST_SHAPES = new Set([BPMN_TRANSACTION])

/** 取消边界事件图形集合 */
const CANCEL_BOUNDARY_SHAPES = new Set([BPMN_BOUNDARY_EVENT_CANCEL])

/**
 * 默认的边界事件宿主验证器（能识别边界事件类型）。
 * - 取消边界事件：只能附着到 Transaction Sub-Process
 * - 其它边界事件：可附着到任意 Activity
 */
export function defaultIsValidHostForBoundary(hostShape: string, boundaryShape: string): boolean {
  if (CANCEL_BOUNDARY_SHAPES.has(boundaryShape)) {
    return CANCEL_BOUNDARY_HOST_SHAPES.has(hostShape)
  }
  return DEFAULT_HOST_SHAPES.has(hostShape)
}

// ============================================================================
// 数据持久化辅助
// ============================================================================

/** 从 node.getData().bpmn 中读取边框位置信息 */
function getBoundaryPos(node: Node): BoundaryPosition | null {
  const data = node.getData<{ bpmn?: { boundaryPosition?: BoundaryPosition } }>()
  return data?.bpmn?.boundaryPosition ?? null
}

/** 将边框位置信息写入 node.getData().bpmn */
function setBoundaryPos(node: Node, pos: BoundaryPosition): void {
  const data = node.getData() || {}
  const bpmn = data.bpmn || {}
  /* istanbul ignore next — node.getParent().id 始终有效; ?? fallback 不可达 */
  const attachedToRef = node.getParent()?.id ?? bpmn.attachedToRef
  node.setData({
    ...data,
    bpmn: {
      ...bpmn,
      boundaryPosition: pos,
      attachedToRef,
    },
  }, { silent: true })
}

/** 获取节点的中心点 */
function nodeCenter(node: Node): { x: number; y: number } {
  const pos = node.getPosition()
  const size = node.getSize()
  return { x: pos.x + size.width / 2, y: pos.y + size.height / 2 }
}

/** 将节点中心点设置到指定坐标 */
function setNodeCenter(node: Node, cx: number, cy: number): void {
  const size = node.getSize()
  node.setPosition(cx - size.width / 2, cy - size.height / 2, { silent: false })
}

/** 获取节点的矩形 */
function nodeRect(node: Node): Rect {
  const pos = node.getPosition()
  const size = node.getSize()
  return { x: pos.x, y: pos.y, width: size.width, height: size.height }
}

// ============================================================================
// 公开辅助函数：程序化吸附
// ============================================================================

/**
 * 将一个边界事件节点吸附到宿主 Activity 上。
 *
 * 用于两种场景：
 * 1. 从面板拖放后手动调用，将节点 snap 到边框并建立 X6 父子关系
 * 2. 从 BPMN XML 导入时恢复边界事件的位置和父子关系
 *
 * @param graph     X6 Graph 实例
 * @param boundary  边界事件节点
 * @param host      宿主 Activity 节点
 */
export function attachBoundaryToHost(graph: Graph, boundary: Node, host: Node): void {
  const hostRect = nodeRect(host)
  const center = nodeCenter(boundary)
  const snap = snapToRectEdge(center, hostRect)

  // 移动到边框上
  setNodeCenter(boundary, snap.point.x, snap.point.y)
  // 建立 X6 父子关系（X6 内置：父移动时子跟随，父删除时子级联删除）
  host.embed(boundary)
  // 持久化位置比例
  setBoundaryPos(boundary, { side: snap.side, ratio: snap.ratio })
  // 确保边界事件始终显示在宿主节点上方
  boundary.toFront()
}

// ============================================================================
// 核心行为函数
// ============================================================================

/**
 * 安装边界事件吸附行为到 Graph 上。
 *
 * 利用 X6 内置的 parent/child 机制，仅补充吸附定位和边框约束逻辑。
 * 返回 dispose 函数用于清理。
 *
 * @example
 * ```ts
 * const dispose = setupBoundaryAttach(graph, { snapDistance: 25 })
 * // 组件卸载时
 * dispose()
 * ```
 */
export function setupBoundaryAttach(
  graph: Graph,
  options: BoundaryAttachOptions = {},
): () => void {
  const {
    snapDistance = 30,
    detachDistance = 60,
    constrainToEdge = true,
    isBoundaryEvent: isBE = isBoundaryShape,
  } = options

  // 解析合法宿主验证器：优先使用 isValidHostForBoundary，其次封装老版 isValidHost，最后用默认
  const resolvedHostValidator: (hostShape: string, boundaryShape: string) => boolean =
    options.isValidHostForBoundary ??
    (options.isValidHost
      ? (host, _boundary) => options.isValidHost!(host)
      : defaultIsValidHostForBoundary)

  // ------------------------------------------------------------------
  // ① node:embedded — 嵌入完成后 snap 到边框
  //
  // X6 embedding 会在拖放结束后触发此事件。
  // 我们在 findParent 里已经让边界事件能 embed 到 Activity，
  // 这里只需要把位置 snap 到边框上。
  // ------------------------------------------------------------------
  function onNodeEmbedded({ node }: { node: Node; currentParent: Node | null; previousParent: Node | null }) {
    if (!isBE(node.shape)) return
    const parent = node.getParent() as Node | null
    if (!parent || !resolvedHostValidator(parent.shape, node.shape)) return

    // snap 到宿主边框
    const center = nodeCenter(node)
    const hostRect = nodeRect(parent)
    const snap = snapToRectEdge(center, hostRect)

    setNodeCenter(node, snap.point.x, snap.point.y)
    setBoundaryPos(node, { side: snap.side, ratio: snap.ratio })
    // 确保边界事件始终显示在宿主节点上方
    node.toFront()
  }

  // ------------------------------------------------------------------
  // ② node:moving — 已吸附的边界事件沿边框约束移动 / 脱离检测
  //
  // X6 在用户拖拽节点时连续触发此事件。
  // ------------------------------------------------------------------
  function onNodeMoving({ node }: { node: Node }) {
    if (!isBE(node.shape)) return
    const parent = node.getParent() as Node | null
    if (!parent || !resolvedHostValidator(parent.shape, node.shape)) return

    const center = nodeCenter(node)
    const hostRect = nodeRect(parent)
    const snap = snapToRectEdge(center, hostRect)

    // 脱离检测：距离超过阈值则 unembed
    if (snap.distance > detachDistance) {
      parent.unembed(node)
      // 清除附着数据
      /* v8 ignore next — getData() 在实际场景中始终有值 */ /* istanbul ignore next */
      const data = node.getData() || {}
      const bpmn = { ...(data.bpmn || {}) }
      delete bpmn.boundaryPosition
      delete bpmn.attachedToRef
      node.setData({ ...data, bpmn }, { silent: true, overwrite: true })
      return
    }

    // 边框约束：强制 snap 到最近的边框点
    if (constrainToEdge) {
      setNodeCenter(node, snap.point.x, snap.point.y)
      setBoundaryPos(node, { side: snap.side, ratio: snap.ratio })
    }
  }

  // ------------------------------------------------------------------
  // ③ node:change:size — 宿主 resize 后重新定位边界事件
  //
  // 根据存储的 BoundaryPosition（边 + 比例）重新计算坐标。
  // ------------------------------------------------------------------
  function onNodeChangeSize({ node }: { node: Node; cell: Cell }) {
    if (!DEFAULT_HOST_SHAPES.has(node.shape)) return
    const children = node.getChildren() as Cell[] | null
    if (!children) return

    const hostRect = nodeRect(node)
    for (const child of children) {
      if (!child.isNode() || !isBE(child.shape)) continue
      const pos = getBoundaryPos(child as Node)
      if (!pos) continue
      const point = boundaryPositionToPoint(pos, hostRect)
      setNodeCenter(child as Node, point.x, point.y)
    }
  }

  // ------------------------------------------------------------------
  // 绑定事件
  // ------------------------------------------------------------------
  graph.on('node:embedded', onNodeEmbedded)
  graph.on('node:moving', onNodeMoving)
  graph.on('node:change:size', onNodeChangeSize)

  // ------------------------------------------------------------------
  // 返回清理函数
  // ------------------------------------------------------------------
  return () => {
    graph.off('node:embedded', onNodeEmbedded)
    graph.off('node:moving', onNodeMoving)
    graph.off('node:change:size', onNodeChangeSize)
  }
}
