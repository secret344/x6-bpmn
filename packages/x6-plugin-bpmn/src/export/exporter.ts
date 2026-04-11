/**
 * X6 Graph → BPMN 2.0 XML 导出器
 *
 * 使用 bpmn-moddle 库構建符合规范的 BPMN 2.0 XML。
 * 支持：流程节点、顺序流、消息流、关联边、泳道、工件、
 *       边界事件、网关默认流、扩展属性、BPMN DI 位置信息。
 */

import type { Graph, Node, Edge } from '@antv/x6'
import { BpmnModdle } from 'bpmn-moddle'
import type { ModdleElement } from 'bpmn-moddle'
import { classifyShape } from '../config'
import {
  type BpmnNodeMapping,
  type BpmnEdgeMapping,
  NODE_MAPPING,
  EDGE_MAPPING,
  isPoolShape,
  isLaneShape,
  isSwimlaneShape,
  isArtifactShape,
  isBoundaryShape,
  isDefaultFlow,
  isConditionalFlow,
} from './bpmn-mapping'
import type {
  EdgeSerializationHandler,
  NodeSerializationHandler,
  SerializationOverrides,
} from '../core/dialect/types'
import {
  BPMN_SEQUENCE_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_TEXT_ANNOTATION,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
} from '../utils/constants'
import {
  createBpmnElement,
  resolveBpmnXmlNameSettings,
} from '../utils/bpmn-xml-names'
import {
  getQualifiedExtensionPropertyContainerName,
  getQualifiedExtensionPropertyItemName,
  resolveExtensionPropertySerialization,
} from '../utils/extension-properties'
import { resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'
import { resolveLaneMemberNodes } from '../core/swimlane-membership'

const EXPANDABLE_ACTIVITY_SHAPES = new Set([
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
])

const FLOW_CONTAINER_SHAPES = new Set([
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
])

interface ProcessBuildContext {
  id: string
  process: ModdleElement
  poolId: string | null
  rootFlowElements: ModdleElement[]
  nestedFlowElements: Map<string, ModdleElement[]>
  artifactElements: ModdleElement[]
}

const PRESERVED_XML_ATTRS_KEY = '$attrs'
const PRESERVED_XML_NAMESPACES_KEY = '$namespaces'
const BOUNDARY_INTERNAL_BPMN_KEYS = new Set(['attachedToRef', 'boundaryPosition'])

function appendXmlAttributes(element: ModdleElement, attrs: Record<string, unknown> | undefined): void {
  if (!attrs || Object.keys(attrs).length === 0) return
  /* istanbul ignore next -- 防御性回退，合法 moddle 元素都会持有 $attrs 对象 */
  Object.assign((element.$attrs || {}) as Record<string, unknown>, attrs)
}

function appendExtensionValue(
  element: ModdleElement,
  moddle: BpmnModdle,
  value: ModdleElement,
  xmlNames?: SerializationOverrides['xmlNames'],
): void {
  const extensionElements = element.extensionElements as ModdleElement | undefined
  if (!extensionElements) {
    element.extensionElements = createBpmnElement(moddle, 'extensionElements', { values: [value] }, xmlNames)
    return
  }

  /* istanbul ignore next -- 防御性回退，合法 ExtensionElements 总会提供 values */
  const extensionValues = (extensionElements.values || []) as ModdleElement[]
  extensionElements.values = [
    ...extensionValues,
    value,
  ]
}

function readPreservedXmlAttributes(bpmnData: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!bpmnData) return undefined

  const rawAttrs = bpmnData[PRESERVED_XML_ATTRS_KEY]
  if (!rawAttrs || typeof rawAttrs !== 'object' || Array.isArray(rawAttrs)) {
    return undefined
  }

  const entries = Object.entries(rawAttrs as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null)
  if (entries.length === 0) return undefined

  return Object.fromEntries(entries)
}

function readPreservedXmlNamespaces(bpmnData: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!bpmnData) return undefined

  const rawNamespaces = bpmnData[PRESERVED_XML_NAMESPACES_KEY]
  if (!rawNamespaces || typeof rawNamespaces !== 'object' || Array.isArray(rawNamespaces)) {
    return undefined
  }

  const entries = Object.entries(rawNamespaces as Record<string, unknown>)
    .filter(([prefix, value]) => Boolean(prefix) && value !== undefined && value !== null && value !== '')
    .map(([prefix, value]) => [`xmlns:${prefix}`, value])
  if (entries.length === 0) return undefined

  return Object.fromEntries(entries)
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 从节点的 attrs 中提取标签文本 */
function getNodeLabel(node: Node): string {
  const attrs = node.getAttrs()
  const labelText = (attrs?.label?.text as string) || (attrs?.headerLabel?.text as string)
  if (labelText) return labelText.replace(/\n/g, ' ')
  const data = node.getData<{ label?: string }>()
  if (data?.label) return data.label
  return ''
}

function getTextAnnotationText(node: Node): string {
  const bpmn = node.getData<{ bpmn?: { annotationText?: unknown } }>()?.bpmn
  if (typeof bpmn?.annotationText === 'string' && bpmn.annotationText.trim() !== '') {
    return bpmn.annotationText.replace(/\n/g, ' ')
  }
  return getNodeLabel(node)
}

/** 从连接线获取标签文本 */
function getEdgeLabel(edge: Edge): string {
  const labels = edge.getLabels()
  if (labels?.length > 0) {
    for (const label of labels) {
      const text = label?.attrs?.label?.text
      /* istanbul ignore else */
      if (typeof text === 'string') return text
    }
  }
  return ''
}

/** 将 ID 规范化为合法的 XML ID（数字开头加下划线，特殊字符替换为下划线） */
function toXmlId(id: string): string {
  /* v8 ignore next */ /* istanbul ignore next */
  if (!id) return '_unknown'
  if (/^[0-9]/.test(id)) return `_${id}`
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

// ============================================================================
// 路点计算辅助函数
// ============================================================================

/** 根据端口组名计算端口在节点边界上的位置 */
/* v8 ignore start — 仅 port 连接使用 */ /* istanbul ignore start */
function portPositionFromGroup(
  x: number, y: number, w: number, h: number,
  group: string,
): { x: number; y: number } {
  switch (group) {
    case 'top': return { x: x + w / 2, y }
    case 'right': return { x: x + w, y: y + h / 2 }
    case 'bottom': return { x: x + w / 2, y: y + h }
    case 'left': return { x, y: y + h / 2 }
    default: return { x: x + w / 2, y: y + h / 2 }
  }
}
/* v8 ignore stop */ /* istanbul ignore stop */

/** 计算从矩形中心到目标点的射线与矩形边界的交点 */
function boundaryPoint(
  x: number, y: number, w: number, h: number,
  tx: number, ty: number,
): { x: number; y: number } {
  const cx = x + w / 2
  const cy = y + h / 2
  const dx = tx - cx
  const dy = ty - cy
  /* v8 ignore next */ /* istanbul ignore next */
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const scaleX = dx !== 0 ? (w / 2) / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)
  return {
    x: Math.round(cx + dx * scale),
    y: Math.round(cy + dy * scale),
  }
}

/** 获取节点中心点坐标 */
function nodeCenter(node: Node): { x: number; y: number } {
  const pos = node.getPosition()
  const size = node.getSize()
  return { x: pos.x + size.width / 2, y: pos.y + size.height / 2 }
}

function getAncestorPool(node: Node): Node | null {
  if (isPoolShape(node.shape)) {
    return node
  }

  let current = node.getParent()

  while (current) {
    if (current.isNode() && isPoolShape(current.shape)) {
      return current as Node
    }
    current = current.getParent()
  }

  return null
}

function getAncestorFlowContainer(node: Node): Node | null {
  let current = node.getParent()

  while (current) {
    if (current.isNode() && FLOW_CONTAINER_SHAPES.has(current.shape)) {
      return current as Node
    }
    current = current.getParent()
  }

  return null
}

/** 计算连接线在节点边界上的实际连接点（优先使用端口位置，否则计算边界交点） */
function computeConnectionPoint(
  node: Node,
  portId: string | undefined,
  directionPt: { x: number; y: number },
): { x: number; y: number } {
  const pos = node.getPosition()
  const size = node.getSize()
  /* v8 ignore next 6 */ /* istanbul ignore next — port 连接在测试中不使用 */
  if (portId && typeof node.getPort === 'function') {
    const port = node.getPort(portId)
    if (port?.group) {
      return portPositionFromGroup(pos.x, pos.y, size.width, size.height, port.group as string)
    }
  }
  return boundaryPoint(pos.x, pos.y, size.width, size.height, directionPt.x, directionPt.y)
}

function resolveActivityIsExpanded(node: Node): boolean | undefined {
  if (!EXPANDABLE_ACTIVITY_SHAPES.has(node.shape)) return undefined
  const bpmn = node.getData<{ bpmn?: { isExpanded?: unknown } }>()?.bpmn
  return typeof bpmn?.isExpanded === 'boolean' ? bpmn.isExpanded : undefined
}

function resolveGatewayMarkerVisible(node: Node): boolean | undefined {
  if (node.shape !== BPMN_EXCLUSIVE_GATEWAY) return undefined
  const bpmn = node.getData<{ bpmn?: { isMarkerVisible?: unknown } }>()?.bpmn
  return typeof bpmn?.isMarkerVisible === 'boolean' ? bpmn.isMarkerVisible : undefined
}

function resolveMessageVisibleKind(edge: Edge): 'initiating' | 'non_initiating' | undefined {
  const bpmn = edge.getData<{ bpmn?: { messageVisibleKind?: unknown } }>()?.bpmn

  return bpmn?.messageVisibleKind === 'initiating' || bpmn?.messageVisibleKind === 'non_initiating'
    ? bpmn.messageVisibleKind
    : undefined
}

function resolvePoolProcessRef(pool: Node): string | null {
  const processRef = pool.getData<{ bpmn?: { processRef?: unknown } }>()?.bpmn?.processRef

  if (typeof processRef !== 'string') {
    return null
  }

  const normalized = processRef.trim()
  return normalized ? toXmlId(normalized) : null
}

function buildProcessId(baseId: string, index: number, total: number): string {
  const normalized = toXmlId(baseId || 'Process_1')

  if (total <= 1) {
    return normalized
  }

  const numberedSuffix = normalized.match(/^(.*?_)(\d+)$/)
  if (numberedSuffix) {
    return `${numberedSuffix[1]}${index + 1}`
  }

  return `${normalized}_${index + 1}`
}

function ensureUniqueProcessId(candidate: string, usedIds: Set<string>): string {
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate)
    return candidate
  }

  let counter = 2
  let nextCandidate = `${candidate}_${counter}`
  while (usedIds.has(nextCandidate)) {
    counter += 1
    nextCandidate = `${candidate}_${counter}`
  }

  usedIds.add(nextCandidate)
  return nextCandidate
}

// ============================================================================
// 主导出函数
// ============================================================================

export interface ExportBpmnOptions {
  /** 流程 ID，默认 "Process_1" */
  processId?: string
  /** 流程名称，默认为空 */
  processName?: string
  /** 使用方言序列化层覆盖默认 BPMN 映射 */
  serialization?: SerializationOverrides
}

/**
 * 将 X6 Graph 导出为 BPMN 2.0 XML 字符串。
 *
 * 处理流程：
 * 1. 分类节点（泳道 / 流程节点 / 工件）和连接线（顺序流 / 消息流 / 关联）
 * 2. 创建 moddle 元素并设置属性、事件定义、扩展属性
 * 3. 生成 BPMN DI 位置信息（BPMNShape / BPMNEdge）
 * 4. 组装 definitions 并序列化为 XML
 *
 * @param graph — X6 图形实例
 * @param options — 可选配置
 * @returns BPMN 2.0 XML 字符串
 */
export async function exportBpmnXml(graph: Graph, options: ExportBpmnOptions = {}): Promise<string> {
  const { processId = 'Process_1', processName = '' } = options
  const moddle = new BpmnModdle()
  const xmlNames = resolveBpmnXmlNameSettings(options.serialization?.xmlNames)
  const nodeMapping = options.serialization?.nodeMapping ?? NODE_MAPPING
  const edgeMapping = options.serialization?.edgeMapping ?? EDGE_MAPPING
  const namespaces = options.serialization?.namespaces ?? {}
  const extensionProperties = resolveExtensionPropertySerialization(
    options.serialization?.extensionProperties,
    namespaces,
  )
  const targetNamespace = options.serialization?.targetNamespace ?? 'http://bpmn.io/schema/bpmn'
  const processAttributes = options.serialization?.processAttributes ?? {}
  const nodeSerializers = options.serialization?.nodeSerializers ?? {}
  const edgeSerializers = options.serialization?.edgeSerializers ?? {}

  const nodes = graph.getNodes()
  const edges = graph.getEdges()

  // 分离池、泳道、流程元素、工件
  const pools = nodes.filter((n) => isPoolShape(n.shape))
  const lanes = nodes.filter((n) => isLaneShape(n.shape))
  const flowNodes = nodes.filter((n) => !isSwimlaneShape(n.shape) && !isArtifactShape(n.shape))
  const artifactNodes = nodes.filter((n) => isArtifactShape(n.shape))

  // 构建已有 BPMN 映射的节点 ID 集合
  const mappedNodeIds = new Set<string>()
  for (const node of flowNodes) {
    if (nodeMapping[node.shape]) mappedNodeIds.add(node.id)
  }
  for (const node of artifactNodes) {
    /* istanbul ignore else */
    if (nodeMapping[node.shape]) mappedNodeIds.add(node.id)
  }
  for (const pool of pools) mappedNodeIds.add(pool.id)
  for (const lane of lanes) mappedNodeIds.add(lane.id)

  /** 检查边的源和目标是否都已映射为 BPMN 元素 */
  function isEdgeMapped(e: Edge): boolean {
    return mappedNodeIds.has(e.getSourceCellId()) && mappedNodeIds.has(e.getTargetCellId())
  }

  // 按类别分离边
  const sequenceFlows = edges.filter(
    (e) => (e.shape === BPMN_SEQUENCE_FLOW || e.shape === BPMN_DEFAULT_FLOW || e.shape === BPMN_CONDITIONAL_FLOW) && isEdgeMapped(e),
  )
  const messageFlows = edges.filter((e) => {
    const mapping = edgeMapping[e.shape]
    return mapping?.isCollaboration === true && isEdgeMapped(e)
  })
  const artifactEdges = edges.filter(
    (e) => (e.shape === BPMN_ASSOCIATION || e.shape === BPMN_DIRECTED_ASSOCIATION || e.shape === BPMN_DATA_ASSOCIATION) && isEdgeMapped(e),
  )

  // ---- Bridge edges ----
  const categorizedEdgeIds = new Set<string>()
  for (const e of sequenceFlows) categorizedEdgeIds.add(e.id)
  for (const e of messageFlows) categorizedEdgeIds.add(e.id)
  for (const e of artifactEdges) categorizedEdgeIds.add(e.id)

  const adjOut = new Map<string, string[]>()
  for (const edge of edges) {
    if (categorizedEdgeIds.has(edge.id)) continue
    const src = edge.getSourceCellId()
    const tgt = edge.getTargetCellId()
    /* istanbul ignore else */
    if (src && tgt) {
      /* istanbul ignore else */
      if (!adjOut.has(src)) adjOut.set(src, [])
      adjOut.get(src)!.push(tgt)
    }
  }

  /* v8 ignore next 20 */ /* istanbul ignore next — BFS：仅用于桥接边 */
  function findNextMapped(startId: string): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const queue = [startId]
    visited.add(startId)
    while (queue.length > 0) {
      const cur = queue.shift()!
      const nexts = adjOut.get(cur) || []
      for (const nxt of nexts) {
        if (visited.has(nxt)) continue
        visited.add(nxt)
        if (mappedNodeIds.has(nxt)) {
          result.push(nxt)
        } else {
          queue.push(nxt)
        }
      }
    }
    return result
  }

  interface BridgeEdge { id: string; source: string; target: string }
  const bridgeEdges: BridgeEdge[] = []
  let bridgeCounter = 0

  for (const nodeId of mappedNodeIds) {
    const directTargets = adjOut.get(nodeId) || []
    for (const tgt of directTargets) {
      if (mappedNodeIds.has(tgt)) {
        const alreadyExists = sequenceFlows.some(
          (e) => e.getSourceCellId() === nodeId && e.getTargetCellId() === tgt,
        )
        if (!alreadyExists) {
          bridgeEdges.push({
            id: `bridge_${++bridgeCounter}`,
            source: nodeId,
            target: tgt,
          })
        }
        /* v8 ignore next 19 */ /* istanbul ignore next — 间接桥接路径，仅在有非映射中间节点时触发 */
      } else {
        const reachable = findNextMapped(tgt)
        for (const endId of reachable) {
          /* istanbul ignore next — 间接桥接查重检查，bridgeEdges.some 和 sequenceFlows.some 的正值分支不可达 */
          const alreadyExists = bridgeEdges.some(
            (be) => be.source === nodeId && be.target === endId,
          ) || sequenceFlows.some(
            (e) => e.getSourceCellId() === nodeId && e.getTargetCellId() === endId,
          )
          if (!alreadyExists) {
            bridgeEdges.push({
              id: `bridge_${++bridgeCounter}`,
              source: nodeId,
              target: endId,
            })
          }
        }
      }
    }
  }

  const usedProcessIds = new Set<string>()
  const processContexts: ProcessBuildContext[] = []
  const processContextByPoolId = new Map<string, ProcessBuildContext>()
  let fallbackProcessContext: ProcessBuildContext | null = null

  const createProcessContext = (candidateId: string, name: string, poolId: string | null): ProcessBuildContext => {
    const uniqueId = ensureUniqueProcessId(candidateId, usedProcessIds)
    const context: ProcessBuildContext = {
      id: uniqueId,
      process: createBpmnElement(moddle, 'process', {
        id: uniqueId,
        name,
        isExecutable: false,
      }, xmlNames),
      poolId,
      rootFlowElements: [],
      nestedFlowElements: new Map<string, ModdleElement[]>(),
      artifactElements: [],
    }

    appendXmlAttributes(context.process, processAttributes)

    processContexts.push(context)
    if (poolId) {
      processContextByPoolId.set(poolId, context)
    }
    return context
  }

  if (pools.length === 0) {
    fallbackProcessContext = createProcessContext(toXmlId(processId), processName, null)
  } else {
    pools.forEach((pool, index) => {
      const candidateId = resolvePoolProcessRef(pool) ?? buildProcessId(processId, index, pools.length)
      const candidateName = pools.length === 1
        ? processName || getNodeLabel(pool)
        : getNodeLabel(pool) || processName
      createProcessContext(candidateId, candidateName, pool.id)
    })
  }

  const getFallbackProcessContext = (): ProcessBuildContext => {
    if (fallbackProcessContext) {
      return fallbackProcessContext
    }

    fallbackProcessContext = createProcessContext(`${toXmlId(processId)}_unassigned`, processName, null)
    return fallbackProcessContext
  }

  const processContextByNodeId = new Map<string, ProcessBuildContext>()

  const resolveProcessContextForNode = (node: Node): ProcessBuildContext => {
    const poolId = getAncestorPool(node)?.id ?? null
    if (poolId) {
      const context = processContextByPoolId.get(poolId)
      /* istanbul ignore next -- 多 Pool 场景会先为每个 pool 建立 process 上下文，缺失映射仅作防御性兜底 */
      if (context) {
        return context
      }
    }

    return getFallbackProcessContext()
  }

  const resolveProcessContextForCellId = (cellId: string | null): ProcessBuildContext | null => {
    /* istanbul ignore next -- 边归属解析只会传入已映射的终端 id，空值分支仅作防御性兜底 */
    if (!cellId) {
      return null
    }

    const cached = processContextByNodeId.get(cellId)
    if (cached) {
      return cached
    }

    const cell = graph.getCellById(cellId)
    /* istanbul ignore next -- 归属解析只针对已映射节点，缺失 cell 仅作防御性兜底 */
    if (!cell?.isNode?.()) {
      return null
    }

    const context = resolveProcessContextForNode(cell as Node)
    processContextByNodeId.set(cellId, context)
    return context
  }

  const resolveProcessContextForEdge = (sourceId: string | null, targetId: string | null): ProcessBuildContext => {
    /* istanbul ignore next -- 当前导出路径中的边终端都会解析到源端所属 process，后续分支仅保留给异常图数据兜底 */
    return resolveProcessContextForCellId(sourceId)
      ?? resolveProcessContextForCellId(targetId)
      ?? getFallbackProcessContext()
  }

  // ---- Build moddle elements ----

  // 映射：X6 节点 ID → moddle 元素（用于引用）
  const nodeElements = new Map<string, ModdleElement>()
  // 映射：边 ID → moddle 元素
  const swimlaneElements = new Map<string, ModdleElement>()

  const appendFlowElement = (context: ProcessBuildContext, ownerId: string | null, element: ModdleElement): void => {
    if (!ownerId) {
      context.rootFlowElements.push(element)
      return
    }

    const bucket = context.nestedFlowElements.get(ownerId)
    if (bucket) {
      bucket.push(element)
      return
    }

    context.nestedFlowElements.set(ownerId, [element])
  }

  const resolveFlowOwnerId = (node: Node): string | null => getAncestorFlowContainer(node)?.id ?? null

  const resolveFlowOwnerIdForEdge = (sourceId: string | null, targetId: string | null): string | null => {
    /* istanbul ignore next -- sequenceFlows/bridgeEdges reaching ownership resolution always have concrete terminal ids */
    if (!sourceId || !targetId) return null

    const sourceCell = graph.getCellById(sourceId)
    const targetCell = graph.getCellById(targetId)
    /* istanbul ignore next -- terminal elements are resolved from nodeElements before this helper is invoked */
    if (!sourceCell?.isNode?.() || !targetCell?.isNode?.()) return null

    const sourceOwnerId = resolveFlowOwnerId(sourceCell as Node)
    const targetOwnerId = resolveFlowOwnerId(targetCell as Node)
    return sourceOwnerId && sourceOwnerId === targetOwnerId ? sourceOwnerId : null
  }

  // 入线/出线追踪（在创建所有流后添加）
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()

  // 注册入线/出线
  for (const edge of sequenceFlows) {
    const src = edge.getSourceCellId()
    const tgt = edge.getTargetCellId()
    /* istanbul ignore else */
    if (src) {
      if (!outgoing.has(src)) outgoing.set(src, [])
      outgoing.get(src)!.push(toXmlId(edge.id))
    }
    /* istanbul ignore else */
    if (tgt) {
      if (!incoming.has(tgt)) incoming.set(tgt, [])
      incoming.get(tgt)!.push(toXmlId(edge.id))
    }
  }
  for (const be of bridgeEdges) {
    const xmlId = toXmlId(be.id)
    /* istanbul ignore else */
    if (!outgoing.has(be.source)) outgoing.set(be.source, [])
    outgoing.get(be.source)!.push(xmlId)
    /* istanbul ignore else */
    if (!incoming.has(be.target)) incoming.set(be.target, [])
    incoming.get(be.target)!.push(xmlId)
  }

  // ---- Create flow node elements ----
  for (const node of flowNodes) {
    const mapping = nodeMapping[node.shape]
    if (!mapping) continue
    const processContext = resolveProcessContextForNode(node)
    processContextByNodeId.set(node.id, processContext)

    const props: Record<string, any> = {
      id: toXmlId(node.id),
      name: getNodeLabel(node),
      ...(mapping.attrs ?? {}),
    }

    // 边界事件 → attachedToRef（在所有节点创建后再设置）
    const element = createBpmnElement(moddle, mapping.tag, props, xmlNames)

    // 事件定义
    if (mapping.eventDefinition) {
      const eventDef = createBpmnElement(
        moddle,
        mapping.eventDefinition,
        { id: `${toXmlId(node.id)}_ed` },
        xmlNames,
      )
      element.eventDefinitions = [eventDef]
    }

    // 扩展属性
    const bpmnData = node.getData<{ bpmn?: Record<string, any> }>()?.bpmn
    const nodeSerializer = nodeSerializers[node.shape]
    const omitBpmnKeys = new Set<string>()
    const preservedXmlAttrs = readPreservedXmlAttributes(bpmnData)
    const preservedXmlNamespaces = readPreservedXmlNamespaces(bpmnData)

    if (preservedXmlNamespaces) {
      appendXmlAttributes(element, preservedXmlNamespaces)
      omitBpmnKeys.add(PRESERVED_XML_NAMESPACES_KEY)
    }

    if (preservedXmlAttrs) {
      appendXmlAttributes(element, preservedXmlAttrs)
      omitBpmnKeys.add(PRESERVED_XML_ATTRS_KEY)
    }

    if (nodeSerializer?.export) {
      const result = nodeSerializer.export({
        shape: node.shape,
        category: classifyShape(node.shape),
        bpmnData: bpmnData ?? {},
        element,
        moddle,
        namespaces,
      })

      for (const key of result?.omitBpmnKeys ?? []) {
        omitBpmnKeys.add(key)
      }
    }

    if (isBoundaryShape(node.shape)) {
      // 边界事件内部附着元数据只用于画布恢复，不能回落成通用扩展属性。
      for (const key of BOUNDARY_INTERNAL_BPMN_KEYS) {
        omitBpmnKeys.add(key)
      }
    }

    if (extensionProperties && bpmnData && Object.keys(bpmnData).length > 0) {
      const propChildren = Object.entries(bpmnData)
        .filter(([key, v]) => !omitBpmnKeys.has(key) && v !== undefined && v !== null && v !== '')
        .map(([key, value]) => moddle.createAny(
          getQualifiedExtensionPropertyItemName(extensionProperties),
          extensionProperties.namespaceUri,
          { name: key, value: String(value) },
        ))
      /* istanbul ignore else */
      if (propChildren.length > 0) {
        const propsContainer = moddle.createAny(
          getQualifiedExtensionPropertyContainerName(extensionProperties),
          extensionProperties.namespaceUri,
          { $children: propChildren },
        )
        appendExtensionValue(element, moddle, propsContainer, xmlNames)
      }
    }

    nodeElements.set(node.id, element)
    appendFlowElement(processContext, resolveFlowOwnerId(node), element)
  }

  // 设置边界事件 attachedToRef（此时所有节点元素均已创建）
  for (const node of flowNodes) {
    if (isBoundaryShape(node.shape)) {
      const parent = node.getParent()
      if (parent) {
        const el = nodeElements.get(node.id)
        const parentEl = nodeElements.get(parent.id)
        /* istanbul ignore else */
        if (el && parentEl) {
          el.attachedToRef = parentEl
        }
      }
    }
  }

  // 设置网关默认流（需要流元素，在创建流之后处理）
  // 追踪哪些网关需要设置默认流
  const gatewayDefaults = new Map<string, Edge>()
  for (const node of flowNodes) {
    const mapping = nodeMapping[node.shape]
    if (!mapping) continue
    if (mapping.tag.includes('Gateway') || mapping.tag === 'exclusiveGateway' || mapping.tag === 'inclusiveGateway') {
      const defaultEdge = edges.find(
        (e) => isDefaultFlow(e.shape) && e.getSourceCellId() === node.id,
      )
      if (defaultEdge) {
        gatewayDefaults.set(node.id, defaultEdge)
      }
    }
  }

  // ---- Create sequence flow elements ----
  const flowEdgeElements = new Map<string, ModdleElement>()

  for (const edge of sequenceFlows) {
    const srcEl = nodeElements.get(edge.getSourceCellId())
    const tgtEl = nodeElements.get(edge.getTargetCellId())
    /* v8 ignore next */ /* istanbul ignore next */
    if (!srcEl || !tgtEl) continue

    const props: Record<string, any> = {
      id: toXmlId(edge.id),
      name: getEdgeLabel(edge),
      sourceRef: srcEl,
      targetRef: tgtEl,
    }

    const seqFlow = createBpmnElement(moddle, 'sequenceFlow', props, xmlNames)
    const edgeData = edge.getData<{ bpmn?: Record<string, any> }>()?.bpmn ?? {}

    // 条件流 → 添加 conditionExpression
    if (isConditionalFlow(edge.shape)) {
      seqFlow.conditionExpression = createBpmnElement(moddle, 'formalExpression', {
        body: String(edgeData.conditionExpression || getEdgeLabel(edge) || 'condition'),
      }, xmlNames)
    }

    const preservedXmlAttrs = readPreservedXmlAttributes(edgeData)
    const preservedXmlNamespaces = readPreservedXmlNamespaces(edgeData)
    if (preservedXmlNamespaces) {
      appendXmlAttributes(seqFlow, preservedXmlNamespaces)
    }
    if (preservedXmlAttrs) {
      appendXmlAttributes(seqFlow, preservedXmlAttrs)
    }

    edgeSerializers[edge.shape]?.export?.({
      shape: edge.shape,
      edgeData,
      element: seqFlow,
      moddle,
      namespaces,
    })

    flowEdgeElements.set(edge.id, seqFlow)
    appendFlowElement(
      resolveProcessContextForEdge(edge.getSourceCellId(), edge.getTargetCellId()),
      resolveFlowOwnerIdForEdge(edge.getSourceCellId(), edge.getTargetCellId()),
      seqFlow,
    )
  }

  // 桥接顺序流
  for (const be of bridgeEdges) {
    const srcEl = nodeElements.get(be.source)
    const tgtEl = nodeElements.get(be.target)
    /* v8 ignore next */ /* istanbul ignore next */
    if (!srcEl || !tgtEl) continue

    const seqFlow = createBpmnElement(moddle, 'sequenceFlow', {
      id: toXmlId(be.id),
      sourceRef: srcEl,
      targetRef: tgtEl,
    }, xmlNames)
    flowEdgeElements.set(be.id, seqFlow)
    appendFlowElement(
      resolveProcessContextForEdge(be.source, be.target),
      resolveFlowOwnerIdForEdge(be.source, be.target),
      seqFlow,
    )
  }

  // 设置网关默认流（顺序流元素已创建）
  for (const [nodeId, defaultEdge] of gatewayDefaults) {
    const gwEl = nodeElements.get(nodeId)
    const flowEl = flowEdgeElements.get(defaultEdge.id)
    /* istanbul ignore else */
    if (gwEl && flowEl) {
      gwEl.default = flowEl
    }
  }

  // 在节点元素上设置入线/出线引用
  for (const [nodeId, refs] of incoming) {
    const el = nodeElements.get(nodeId)
    /* istanbul ignore else */
    if (el) {
      el.incoming = refs.map((id) => flowEdgeElements.get(id) || ({ id } as any)).filter(Boolean)
    }
  }
  for (const [nodeId, refs] of outgoing) {
    const el = nodeElements.get(nodeId)
    /* istanbul ignore else */
    if (el) {
      el.outgoing = refs.map((id) => flowEdgeElements.get(id) || ({ id } as any)).filter(Boolean)
    }
  }

  // ---- Artifacts ----
  for (const node of artifactNodes) {
    const mapping = nodeMapping[node.shape]
    /* v8 ignore next */ /* istanbul ignore next */
    if (!mapping) continue

    let element: ModdleElement
    if (node.shape === BPMN_TEXT_ANNOTATION) {
      element = createBpmnElement(moddle, 'textAnnotation', {
        id: toXmlId(node.id),
        text: getTextAnnotationText(node),
      }, xmlNames)
    } else {
      element = createBpmnElement(moddle, mapping.tag, {
        id: toXmlId(node.id),
      }, xmlNames)
    }
    const bpmnData = node.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
    const preservedXmlAttrs = readPreservedXmlAttributes(bpmnData)
    const preservedXmlNamespaces = readPreservedXmlNamespaces(bpmnData)
    if (preservedXmlNamespaces) {
      appendXmlAttributes(element, preservedXmlNamespaces)
    }
    if (preservedXmlAttrs) {
      appendXmlAttributes(element, preservedXmlAttrs)
    }
    nodeElements.set(node.id, element)
    const processContext = resolveProcessContextForNode(node)
    processContextByNodeId.set(node.id, processContext)
    processContext.artifactElements.push(element)
  }

  // 工件边（关联连线）
  for (const edge of artifactEdges) {
    const mapping = edgeMapping[edge.shape]
    /* v8 ignore next */ /* istanbul ignore next */
    if (!mapping) continue

    if (edge.shape === BPMN_DATA_ASSOCIATION) {
      // 数据关联：附加到任务元素上作为 dataInputAssociation / dataOutputAssociation
      const srcEl = nodeElements.get(edge.getSourceCellId())
      const tgtEl = nodeElements.get(edge.getTargetCellId())
      /* istanbul ignore else */
      if (srcEl && tgtEl) {
        // 判断方向：源为数据类则为输入；目标为数据类则为输出
        /* v8 ignore next — getCellById 不会返回 null */ /* istanbul ignore next */
        const srcMapping = nodeMapping[graph.getCellById(edge.getSourceCellId())?.shape || '']
        const isSourceData = srcMapping && (srcMapping.tag === 'dataObjectReference' || srcMapping.tag === 'dataStoreReference')

        if (isSourceData) {
          // 在目标任务上创建 DataInputAssociation
          const dia = createBpmnElement(moddle, 'dataInputAssociation', {
            id: toXmlId(edge.id),
            sourceRef: [srcEl],
            targetRef: tgtEl,
          }, xmlNames)
          const edgeData = edge.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
          const preservedXmlAttrs = readPreservedXmlAttributes(edgeData)
          const preservedXmlNamespaces = readPreservedXmlNamespaces(edgeData)
          if (preservedXmlNamespaces) {
            appendXmlAttributes(dia, preservedXmlNamespaces)
          }
          if (preservedXmlAttrs) {
            appendXmlAttributes(dia, preservedXmlAttrs)
          }
          /* istanbul ignore else */
          if (!tgtEl.dataInputAssociations) tgtEl.dataInputAssociations = []
          tgtEl.dataInputAssociations.push(dia)
        } else {
          // 在源任务上创建 DataOutputAssociation
          const doa = createBpmnElement(moddle, 'dataOutputAssociation', {
            id: toXmlId(edge.id),
            sourceRef: [srcEl],
            targetRef: tgtEl,
          }, xmlNames)
          const edgeData = edge.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
          const preservedXmlAttrs = readPreservedXmlAttributes(edgeData)
          const preservedXmlNamespaces = readPreservedXmlNamespaces(edgeData)
          if (preservedXmlNamespaces) {
            appendXmlAttributes(doa, preservedXmlNamespaces)
          }
          if (preservedXmlAttrs) {
            appendXmlAttributes(doa, preservedXmlAttrs)
          }
          /* istanbul ignore else */
          if (!srcEl.dataOutputAssociations) srcEl.dataOutputAssociations = []
          srcEl.dataOutputAssociations.push(doa)
        }
      }
    } else {
      // 关联连线 / 有向关联连线
      const srcEl = nodeElements.get(edge.getSourceCellId())
      const tgtEl = nodeElements.get(edge.getTargetCellId())

      const props: Record<string, any> = {
        id: toXmlId(edge.id),
        sourceRef: srcEl,
        targetRef: tgtEl,
      }
      if (edge.shape === BPMN_DIRECTED_ASSOCIATION) {
        props.associationDirection = 'One'
      }
      const association = createBpmnElement(moddle, 'association', props, xmlNames)
      const edgeData = edge.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
      const preservedXmlAttrs = readPreservedXmlAttributes(edgeData)
      const preservedXmlNamespaces = readPreservedXmlNamespaces(edgeData)
      if (preservedXmlNamespaces) {
        appendXmlAttributes(association, preservedXmlNamespaces)
      }
      if (preservedXmlAttrs) {
        appendXmlAttributes(association, preservedXmlAttrs)
      }
      resolveProcessContextForEdge(edge.getSourceCellId(), edge.getTargetCellId())
        .artifactElements
        .push(association)
    }
  }

  // ---- Build processes ----
  for (const lane of lanes) {
    processContextByNodeId.set(lane.id, resolveProcessContextForNode(lane))
  }

  for (const context of processContexts) {
    const laneNodes = lanes.filter((lane) => processContextByNodeId.get(lane.id) === context)

    if (laneNodes.length > 0) {
      const laneElements: ModdleElement[] = laneNodes.map((lane) => {
        const refs = resolveLaneMemberNodes(
          lane,
          flowNodes.filter((node) => processContextByNodeId.get(node.id) === context),
        )
          .map((node) => nodeElements.get(node.id))
          .filter(Boolean) as ModdleElement[]

        const laneElement = createBpmnElement(moddle, 'lane', {
          id: toXmlId(lane.id),
          name: getNodeLabel(lane),
          flowNodeRef: refs,
        }, xmlNames)
        const bpmnData = lane.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
        const preservedXmlAttrs = readPreservedXmlAttributes(bpmnData)
        const preservedXmlNamespaces = readPreservedXmlNamespaces(bpmnData)
        if (preservedXmlNamespaces) {
          appendXmlAttributes(laneElement, preservedXmlNamespaces)
        }
        if (preservedXmlAttrs) {
          appendXmlAttributes(laneElement, preservedXmlAttrs)
        }
        swimlaneElements.set(lane.id, laneElement)
        nodeElements.set(lane.id, laneElement)
        return laneElement
      })

      context.process.laneSets = [
        createBpmnElement(moddle, 'laneSet', {
          id: `LaneSet_${context.id}`,
          lanes: laneElements,
        }, xmlNames),
      ]
    }

    context.process.flowElements = context.rootFlowElements
    for (const [containerId, elements] of context.nestedFlowElements) {
      const containerElement = nodeElements.get(containerId)
      /* istanbul ignore next -- owner ids come from existing flow-container ancestor nodes, so the moddle container always exists */
      if (!containerElement) continue
      containerElement.flowElements = elements
    }
    if (context.artifactElements.length > 0) {
      context.process.artifacts = context.artifactElements
    }
  }

  // ---- Build collaboration (if pools or message flows exist) ----
  const hasCollaboration = pools.length > 0 || messageFlows.length > 0
  const collaborationId = 'Collaboration_1'
  let collaboration: ModdleElement | null = null

  if (hasCollaboration) {
    const participants: ModdleElement[] = pools.map((pool) => {
      /* istanbul ignore next -- participant 与 pool processContext 在上文已一一建立映射，兜底仅防御非法中间状态 */
      const processContext = processContextByPoolId.get(pool.id) ?? getFallbackProcessContext()
      const participant = createBpmnElement(moddle, 'participant', {
        id: toXmlId(pool.id),
        name: getNodeLabel(pool),
        processRef: processContext.process,
      }, xmlNames)
      const bpmnData = pool.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
      const preservedXmlAttrs = readPreservedXmlAttributes(bpmnData)
      const preservedXmlNamespaces = readPreservedXmlNamespaces(bpmnData)
      if (preservedXmlNamespaces) {
        appendXmlAttributes(participant, preservedXmlNamespaces)
      }
      if (preservedXmlAttrs) {
        appendXmlAttributes(participant, preservedXmlAttrs)
      }
      return participant
    })
    pools.forEach((pool, index) => {
      const participant = participants[index] as ModdleElement
      swimlaneElements.set(pool.id, participant)
      nodeElements.set(pool.id, participant)
    })

    const msgFlowElements: ModdleElement[] = messageFlows.map((mf) => {
      const srcEl = nodeElements.get(mf.getSourceCellId())
      const tgtEl = nodeElements.get(mf.getTargetCellId())
      const messageFlow = createBpmnElement(moddle, 'messageFlow', {
        id: toXmlId(mf.id),
        name: getEdgeLabel(mf),
        sourceRef: srcEl,
        targetRef: tgtEl,
      }, xmlNames)
      const edgeData = mf.getData<{ bpmn?: Record<string, unknown> }>()?.bpmn
      const preservedXmlAttrs = readPreservedXmlAttributes(edgeData)
      const preservedXmlNamespaces = readPreservedXmlNamespaces(edgeData)
      if (preservedXmlNamespaces) {
        appendXmlAttributes(messageFlow, preservedXmlNamespaces)
      }
      if (preservedXmlAttrs) {
        appendXmlAttributes(messageFlow, preservedXmlAttrs)
      }
      return messageFlow
    })

    collaboration = createBpmnElement(moddle, 'collaboration', {
      id: collaborationId,
      participants,
      messageFlows: msgFlowElements.length > 0 ? msgFlowElements : undefined,
    }, xmlNames)
  }

  // ---- Build BPMNDiagram ----
  const planeElements: ModdleElement[] = []

  // Pool 图形
  for (const pool of pools) {
    const pos = pool.getPosition()
    const size = pool.getSize()
    const poolElement = swimlaneElements.get(pool.id) as ModdleElement
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${toXmlId(pool.id)}_di`,
      bpmnElement: poolElement,
      isHorizontal: resolveSwimlaneIsHorizontal(pool.getData(), size),
    })
    shape.bounds = moddle.create('dc:Bounds', {
      x: pos.x, y: pos.y, width: size.width, height: size.height,
    })
    planeElements.push(shape)
  }

  // 泳道图形
  for (const lane of lanes) {
    const pos = lane.getPosition()
    const size = lane.getSize()
    const laneElement = swimlaneElements.get(lane.id) as ModdleElement
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${toXmlId(lane.id)}_di`,
      bpmnElement: laneElement,
      isHorizontal: resolveSwimlaneIsHorizontal(lane.getData(), size),
    })
    shape.bounds = moddle.create('dc:Bounds', {
      x: pos.x, y: pos.y, width: size.width, height: size.height,
    })
    planeElements.push(shape)
  }

  // 流程节点 + 工件图形
  for (const node of [...flowNodes, ...artifactNodes]) {
    if (!nodeMapping[node.shape]) continue
    const pos = node.getPosition()
    const size = node.getSize()
    const el = nodeElements.get(node.id)
    const isExpanded = resolveActivityIsExpanded(node)
    const isMarkerVisible = resolveGatewayMarkerVisible(node)
    const shape = moddle.create('bpmndi:BPMNShape', {
      id: `${toXmlId(node.id)}_di`,
      bpmnElement: el || /* v8 ignore next */ /* istanbul ignore next */ { id: toXmlId(node.id) },
      ...(typeof isExpanded === 'boolean' ? { isExpanded } : {}),
      ...(typeof isMarkerVisible === 'boolean' ? { isMarkerVisible } : {}),
    })
    shape.bounds = moddle.create('dc:Bounds', {
      x: pos.x, y: pos.y, width: size.width, height: size.height,
    })
    planeElements.push(shape)
  }

  // 边图形
  for (const edge of [...sequenceFlows, ...messageFlows, ...artifactEdges]) {
    const waypoints: ModdleElement[] = []
    const vertices = edge.getVertices()
    const srcTerminal = edge.getSource() as Record<string, any>
    const tgtTerminal = edge.getTarget() as Record<string, any>
    const srcCell = graph.getCellById(edge.getSourceCellId())
    const tgtCell = graph.getCellById(edge.getTargetCellId())

    /* istanbul ignore else */
    if (srcCell && srcCell.isNode()) {
      const srcNode = srcCell as Node
      /* istanbul ignore next — 边的两端都是节点，不会走到 fallback */
      const dirPt = vertices.length > 0
        ? vertices[0]
        : tgtCell && tgtCell.isNode()
          ? nodeCenter(tgtCell as Node)
          : nodeCenter(srcNode)
      const pt = computeConnectionPoint(srcNode, srcTerminal?.port, dirPt)
      waypoints.push(moddle.create('dc:Point', { x: pt.x, y: pt.y }))
    }

    for (const v of vertices) {
      waypoints.push(moddle.create('dc:Point', { x: v.x, y: v.y }))
    }

    /* istanbul ignore else */
    if (tgtCell && tgtCell.isNode()) {
      const tgtNode = tgtCell as Node
      /* istanbul ignore next — 边的两端都是节点，不会走到 fallback */
      const dirPt = vertices.length > 0
        ? vertices[vertices.length - 1]
        : srcCell && srcCell.isNode()
          ? nodeCenter(srcCell as Node)
          : nodeCenter(tgtNode)
      const pt = computeConnectionPoint(tgtNode, tgtTerminal?.port, dirPt)
      waypoints.push(moddle.create('dc:Point', { x: pt.x, y: pt.y }))
    }

    const messageVisibleKind = edge.shape === BPMN_MESSAGE_FLOW
      ? resolveMessageVisibleKind(edge)
      : undefined

    const edgeEl = moddle.create('bpmndi:BPMNEdge', {
      id: `${toXmlId(edge.id)}_di`,
      bpmnElement: flowEdgeElements.get(edge.id) || { id: toXmlId(edge.id) },
      ...(messageVisibleKind === 'non_initiating' ? { messageVisibleKind } : {}),
    })
    edgeEl.waypoint = waypoints
    planeElements.push(edgeEl)
  }

  // 桥接边图形
  for (const be of bridgeEdges) {
    const waypoints: ModdleElement[] = []
    const srcCell = graph.getCellById(be.source)
    const tgtCell = graph.getCellById(be.target)

    /* istanbul ignore else */
    if (srcCell && srcCell.isNode() && tgtCell && tgtCell.isNode()) {
      const srcNode = srcCell as Node
      const tgtNode = tgtCell as Node
      const srcPos = srcNode.getPosition()
      const srcSize = srcNode.getSize()
      const tgtPos = tgtNode.getPosition()
      const tgtSize = tgtNode.getSize()
      const tgtCtr = nodeCenter(tgtNode)
      const srcCtr = nodeCenter(srcNode)
      const srcPt = boundaryPoint(srcPos.x, srcPos.y, srcSize.width, srcSize.height, tgtCtr.x, tgtCtr.y)
      const tgtPt = boundaryPoint(tgtPos.x, tgtPos.y, tgtSize.width, tgtSize.height, srcCtr.x, srcCtr.y)
      waypoints.push(moddle.create('dc:Point', { x: srcPt.x, y: srcPt.y }))
      waypoints.push(moddle.create('dc:Point', { x: tgtPt.x, y: tgtPt.y }))
    }

    const edgeEl = moddle.create('bpmndi:BPMNEdge', {
      id: `${toXmlId(be.id)}_di`,
      bpmnElement: flowEdgeElements.get(be.id) || /* v8 ignore next */ /* istanbul ignore next */ { id: toXmlId(be.id) },
    })
    edgeEl.waypoint = waypoints
    planeElements.push(edgeEl)
  }

  const plane = moddle.create('bpmndi:BPMNPlane', {
    id: 'BPMNPlane_1',
    bpmnElement: hasCollaboration ? collaboration : processContexts[0]?.process,
  })
  plane.planeElement = planeElements

  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_1' })
  diagram.plane = plane

  // ---- Assemble definitions ----
  const definitions = createBpmnElement(moddle, 'definitions', {
    id: 'Definitions_1',
    targetNamespace,
  }, xmlNames)
  appendXmlAttributes(
    definitions,
    Object.fromEntries(
      Object.entries(namespaces).map(([prefix, uri]) => [`xmlns:${prefix}`, uri]),
    ),
  )

  const rootElements: ModdleElement[] = []
  if (collaboration) {
    rootElements.push(collaboration)
  }
  rootElements.push(...processContexts.map((context) => context.process))
  definitions.rootElements = rootElements
  definitions.diagrams = [diagram]

  const { xml } = await moddle.toXML(definitions, { format: true, preamble: true })
  return xml
}
