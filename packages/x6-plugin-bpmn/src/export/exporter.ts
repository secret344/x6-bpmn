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
import {
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
import {
  BPMN_SEQUENCE_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_TEXT_ANNOTATION,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../utils/constants'
import type { SerializationAdapter, ExportNodeContext, ExportEdgeContext } from '../rules/presets/types'
import { resolvePreset, getPreset } from '../rules/presets/registry'

// ============================================================================
// 扩展命名空间（用于存储自定义属性）
// ============================================================================

const NS_X6BPMN = 'http://x6-bpmn2.io/schema'

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

/** 从连接线获取标签文本 */
function getEdgeLabel(edge: Edge): string {
  const labels = edge.getLabels()
  if (labels?.length > 0) {
    const text = labels[0]?.attrs?.label?.text
    if (typeof text === 'string') return text
  }
  return ''
}

/** 将 ID 规范化为合法的 XML ID（数字开头加下划线，特殊字符替换为下划线） */
function toXmlId(id: string): string {
  /* c8 ignore next */
  if (!id) return '_unknown'
  if (/^[0-9]/.test(id)) return `_${id}`
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

// ============================================================================
// 路点计算辅助函数
// ============================================================================

/** 根据端口组名计算端口在节点边界上的位置 */
function portPositionFromGroup(
  x: number, y: number, w: number, h: number,
  group: string,
): { x: number; y: number } {
  switch (group) {
    case 'top': return { x: x + w / 2, y }
    case 'right': return { x: x + w, y: y + h / 2 }
    case 'bottom': return { x: x + w / 2, y: y + h }
    case 'left': return { x, y: y + h / 2 }
    /* c8 ignore next */
    default: return { x: x + w / 2, y: y + h / 2 }
  }
}

/** 计算从矩形中心到目标点的射线与矩形边界的交点 */
function boundaryPoint(
  x: number, y: number, w: number, h: number,
  tx: number, ty: number,
): { x: number; y: number } {
  const cx = x + w / 2
  const cy = y + h / 2
  const dx = tx - cx
  const dy = ty - cy
  /* c8 ignore next */
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

/** 计算连接线在节点边界上的实际连接点（优先使用端口位置，否则计算边界交点） */
function computeConnectionPoint(
  node: Node,
  portId: string | undefined,
  directionPt: { x: number; y: number },
): { x: number; y: number } {
  const pos = node.getPosition()
  const size = node.getSize()
  if (portId && typeof node.getPort === 'function') {
    const port = node.getPort(portId)
    if (port?.group) {
      return portPositionFromGroup(pos.x, pos.y, size.width, size.height, port.group as string)
    }
  }
  return boundaryPoint(pos.x, pos.y, size.width, size.height, directionPt.x, directionPt.y)
}

/** 将 bpmn-mapping 的驼峰标签转换为 bpmn-moddle 类型（PascalCase + bpmn: 前缀） */
function toBpmnType(tag: string): string {
  return `bpmn:${tag.charAt(0).toUpperCase()}${tag.slice(1)}`
}

// ============================================================================
// 主导出函数
// ============================================================================

export interface ExportBpmnOptions {
  /** 流程 ID，默认 "Process_1" */
  processId?: string
  /** 流程名称，默认为空 */
  processName?: string
  /** 规则预设名称，用于应用预设的序列化适配器（如 'bpmn2'、'smartengine'） */
  preset?: string
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
  const { processId = 'Process_1', processName = '', preset: presetName } = options
  const moddle = new BpmnModdle()

  // 解析序列化适配器
  let adapter: SerializationAdapter = {}
  if (presetName && getPreset(presetName)) {
    const resolved = resolvePreset(presetName)
    adapter = resolved.serialization
  }

  const nodes = graph.getNodes()
  const edges = graph.getEdges()

  // Separate pools, lanes, flow elements, artifacts
  const pools = nodes.filter((n) => isPoolShape(n.shape))
  const lanes = nodes.filter((n) => isLaneShape(n.shape))
  const flowNodes = nodes.filter((n) => !isSwimlaneShape(n.shape) && !isArtifactShape(n.shape))
  const artifactNodes = nodes.filter((n) => isArtifactShape(n.shape))

  // Build set of node ids that have a BPMN mapping
  const mappedNodeIds = new Set<string>()
  for (const node of flowNodes) {
    if (NODE_MAPPING[node.shape]) mappedNodeIds.add(node.id)
  }
  for (const node of artifactNodes) {
    if (NODE_MAPPING[node.shape]) mappedNodeIds.add(node.id)
  }
  for (const pool of pools) mappedNodeIds.add(pool.id)
  for (const lane of lanes) mappedNodeIds.add(lane.id)

  /** Check if both source and target of an edge are mapped BPMN elements */
  function isEdgeMapped(e: Edge): boolean {
    return mappedNodeIds.has(e.getSourceCellId()) && mappedNodeIds.has(e.getTargetCellId())
  }

  // Separate edges by category
  const sequenceFlows = edges.filter(
    (e) => (e.shape === BPMN_SEQUENCE_FLOW || e.shape === BPMN_DEFAULT_FLOW || e.shape === BPMN_CONDITIONAL_FLOW) && isEdgeMapped(e),
  )
  const messageFlows = edges.filter((e) => {
    const mapping = EDGE_MAPPING[e.shape]
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
    if (src && tgt) {
      if (!adjOut.has(src)) adjOut.set(src, [])
      adjOut.get(src)!.push(tgt)
    }
  }

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
      } else {
        const reachable = findNextMapped(tgt)
        for (const endId of reachable) {
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

  // ---- Build moddle elements ----

  // Map: X6 node id → moddle element (for references)
  const nodeElements = new Map<string, ModdleElement>()
  // Map: edge id → moddle element
  const flowElements: ModdleElement[] = []
  const artifactElements: ModdleElement[] = []

  // Incoming/outgoing tracking (to add after creating all flows)
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()

  // Register incoming/outgoing
  for (const edge of sequenceFlows) {
    const src = edge.getSourceCellId()
    const tgt = edge.getTargetCellId()
    if (src) {
      if (!outgoing.has(src)) outgoing.set(src, [])
      outgoing.get(src)!.push(toXmlId(edge.id))
    }
    if (tgt) {
      if (!incoming.has(tgt)) incoming.set(tgt, [])
      incoming.get(tgt)!.push(toXmlId(edge.id))
    }
  }
  for (const be of bridgeEdges) {
    const xmlId = toXmlId(be.id)
    if (!outgoing.has(be.source)) outgoing.set(be.source, [])
    outgoing.get(be.source)!.push(xmlId)
    if (!incoming.has(be.target)) incoming.set(be.target, [])
    incoming.get(be.target)!.push(xmlId)
  }

  // ---- Create flow node elements ----
  for (const node of flowNodes) {
    const mapping = NODE_MAPPING[node.shape]
    if (!mapping) continue

    const props: Record<string, any> = {
      id: toXmlId(node.id),
      name: getNodeLabel(node),
      ...(mapping.attrs ?? {}),
    }

    // Boundary event → attachedToRef (set later after all nodes created)
    const bpmnType = toBpmnType(mapping.tag)
    const element = moddle.create(bpmnType, props)

    // Event definition
    if (mapping.eventDefinition) {
      const edType = toBpmnType(mapping.eventDefinition)
      const eventDef = moddle.create(edType, { id: `${toXmlId(node.id)}_ed` })
      element.eventDefinitions = [eventDef]
    }

    // Extension properties
    const bpmnData = node.getData<{ bpmn?: Record<string, any> }>()?.bpmn
    if (bpmnData && Object.keys(bpmnData).length > 0) {
      const propChildren = Object.entries(bpmnData)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => moddle.createAny('x6bpmn:property', NS_X6BPMN, { name: k, value: String(v) }))
      if (propChildren.length > 0) {
        const propsContainer = moddle.createAny('x6bpmn:properties', NS_X6BPMN, { $children: propChildren })
        element.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [propsContainer] })
      }
    }

    // 应用序列化适配器的节点导出转换
    if (adapter.transformExportNode) {
      const context: ExportNodeContext = {
        shape: node.shape,
        tag: mapping.tag,
        nodeId: node.id,
        label: getNodeLabel(node),
        bpmnData,
        createAny: (type, ns, props) => moddle.createAny(type, ns, props),
        createBpmnElement: (type, props) => moddle.create(type, props),
      }
      adapter.transformExportNode(element, context)
    }

    nodeElements.set(node.id, element)
    flowElements.push(element)
  }

  // Set boundary event attachedToRef (now all node elements exist)
  for (const node of flowNodes) {
    if (isBoundaryShape(node.shape)) {
      const parent = node.getParent()
      if (parent) {
        const el = nodeElements.get(node.id)
        const parentEl = nodeElements.get(parent.id)
        if (el && parentEl) {
          el.attachedToRef = parentEl
        }
      }
    }
  }

  // Set gateway default flow (needs flow elements, handled after creating flows)
  // Track which gateways need default
  const gatewayDefaults = new Map<string, Edge>()
  for (const node of flowNodes) {
    const mapping = NODE_MAPPING[node.shape]
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
    /* c8 ignore next */
    if (!srcEl || !tgtEl) continue

    const props: Record<string, any> = {
      id: toXmlId(edge.id),
      name: getEdgeLabel(edge),
      sourceRef: srcEl,
      targetRef: tgtEl,
    }

    const seqFlow = moddle.create('bpmn:SequenceFlow', props)

    // Conditional flow → add conditionExpression
    if (isConditionalFlow(edge.shape)) {
      const condProps: Record<string, any> = {
        body: getEdgeLabel(edge) || 'condition',
      }
      if (adapter.conditionExpressionType) {
        condProps.$attrs = { 'xsi:type': adapter.conditionExpressionType }
      }
      seqFlow.conditionExpression = moddle.create('bpmn:FormalExpression', condProps)
    }

    // 应用序列化适配器的连线导出转换
    if (adapter.transformExportEdge) {
      const context: ExportEdgeContext = {
        shape: edge.shape,
        tag: 'sequenceFlow',
        edgeId: edge.id,
        label: getEdgeLabel(edge),
        isConditional: isConditionalFlow(edge.shape),
        isDefault: isDefaultFlow(edge.shape),
        createBpmnElement: (type, props) => moddle.create(type, props),
      }
      adapter.transformExportEdge(seqFlow, context)
    }

    flowEdgeElements.set(edge.id, seqFlow)
    flowElements.push(seqFlow)
  }

  // Bridge sequence flows
  for (const be of bridgeEdges) {
    const srcEl = nodeElements.get(be.source)
    const tgtEl = nodeElements.get(be.target)
    /* c8 ignore next */
    if (!srcEl || !tgtEl) continue

    const seqFlow = moddle.create('bpmn:SequenceFlow', {
      id: toXmlId(be.id),
      sourceRef: srcEl,
      targetRef: tgtEl,
    })
    flowEdgeElements.set(be.id, seqFlow)
    flowElements.push(seqFlow)
  }

  // Now set gateway defaults (sequence flow elements exist)
  for (const [nodeId, defaultEdge] of gatewayDefaults) {
    const gwEl = nodeElements.get(nodeId)
    const flowEl = flowEdgeElements.get(defaultEdge.id)
    if (gwEl && flowEl) {
      gwEl.default = flowEl
    }
  }

  // Set incoming/outgoing refs on node elements
  for (const [nodeId, refs] of incoming) {
    const el = nodeElements.get(nodeId)
    if (el) {
      el.incoming = refs.map((id) => flowEdgeElements.get(id) || ({ id } as any)).filter(Boolean)
    }
  }
  for (const [nodeId, refs] of outgoing) {
    const el = nodeElements.get(nodeId)
    if (el) {
      el.outgoing = refs.map((id) => flowEdgeElements.get(id) || ({ id } as any)).filter(Boolean)
    }
  }

  // ---- Artifacts ----
  for (const node of artifactNodes) {
    const mapping = NODE_MAPPING[node.shape]
    /* c8 ignore next */
    if (!mapping) continue

    let element: ModdleElement
    if (node.shape === BPMN_TEXT_ANNOTATION) {
      element = moddle.create('bpmn:TextAnnotation', {
        id: toXmlId(node.id),
        text: getNodeLabel(node),
      })
    } else {
      element = moddle.create(toBpmnType(mapping.tag), {
        id: toXmlId(node.id),
      })
    }
    nodeElements.set(node.id, element)
    artifactElements.push(element)
  }

  // Artifact edges (associations)
  for (const edge of artifactEdges) {
    const mapping = EDGE_MAPPING[edge.shape]
    /* c8 ignore next */
    if (!mapping) continue

    if (edge.shape === BPMN_DATA_ASSOCIATION) {
      // Data associations: attach to the task element as dataInputAssociation / dataOutputAssociation
      const srcEl = nodeElements.get(edge.getSourceCellId())
      const tgtEl = nodeElements.get(edge.getTargetCellId())
      if (srcEl && tgtEl) {
        // Determine direction: if source is data-like, it's input; if target is data-like, it's output
        const srcMapping = NODE_MAPPING[graph.getCellById(edge.getSourceCellId())?.shape || '']
        const isSourceData = srcMapping && (srcMapping.tag === 'dataObjectReference' || srcMapping.tag === 'dataStoreReference')

        if (isSourceData) {
          // DataInputAssociation on the target task
          const dia = moddle.create('bpmn:DataInputAssociation', {
            id: toXmlId(edge.id),
            sourceRef: [srcEl],
            targetRef: tgtEl,
          })
          if (!tgtEl.dataInputAssociations) tgtEl.dataInputAssociations = []
          tgtEl.dataInputAssociations.push(dia)
        } else {
          // DataOutputAssociation on the source task
          const doa = moddle.create('bpmn:DataOutputAssociation', {
            id: toXmlId(edge.id),
            sourceRef: [srcEl],
            targetRef: tgtEl,
          })
          if (!srcEl.dataOutputAssociations) srcEl.dataOutputAssociations = []
          srcEl.dataOutputAssociations.push(doa)
        }
      }
    } else {
      // Association / Directed Association
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
      artifactElements.push(moddle.create('bpmn:Association', props))
    }
  }

  // ---- Build process ----
  const processProps: Record<string, any> = {
    id: processId,
    name: processName,
    isExecutable: false,
  }
  // 应用序列化适配器的流程属性
  if (adapter.processAttributes) {
    processProps.$attrs = { ...adapter.processAttributes }
  }
  const process = moddle.create('bpmn:Process', processProps)

  // Lanes
  if (lanes.length > 0) {
    const laneElements: ModdleElement[] = lanes.map((lane) => {
      const laneBBox = lane.getBBox()
      const refs = flowNodes
        .filter((n) => {
          const pos = n.getPosition()
          const size = n.getSize()
          const cx = pos.x + size.width / 2
          const cy = pos.y + size.height / 2
          return (
            cx >= laneBBox.x &&
            cx <= laneBBox.x + laneBBox.width &&
            cy >= laneBBox.y &&
            cy <= laneBBox.y + laneBBox.height
          )
        })
        .map((n) => nodeElements.get(n.id))
        .filter(Boolean) as ModdleElement[]

      return moddle.create('bpmn:Lane', {
        id: toXmlId(lane.id),
        name: getNodeLabel(lane),
        flowNodeRef: refs,
      })
    })

    process.laneSets = [moddle.create('bpmn:LaneSet', { id: 'LaneSet_1', lanes: laneElements })]
  }

  process.flowElements = flowElements
  if (artifactElements.length > 0) {
    process.artifacts = artifactElements
  }

  // ---- Build collaboration (if pools or message flows exist) ----
  const hasCollaboration = pools.length > 0 || messageFlows.length > 0
  const collaborationId = 'Collaboration_1'
  let collaboration: ModdleElement | null = null

  if (hasCollaboration) {
    const participants: ModdleElement[] = pools.map((pool) =>
      moddle.create('bpmn:Participant', {
        id: toXmlId(pool.id),
        name: getNodeLabel(pool),
        processRef: process,
      }),
    )

    const msgFlowElements: ModdleElement[] = messageFlows.map((mf) => {
      const srcEl = nodeElements.get(mf.getSourceCellId())
      const tgtEl = nodeElements.get(mf.getTargetCellId())
      return moddle.create('bpmn:MessageFlow', {
        id: toXmlId(mf.id),
        name: getEdgeLabel(mf),
        sourceRef: srcEl,
        targetRef: tgtEl,
      })
    })

    collaboration = moddle.create('bpmn:Collaboration', {
      id: collaborationId,
      participants,
      messageFlows: msgFlowElements.length > 0 ? msgFlowElements : undefined,
    })
  }

  // ---- Build BPMNDiagram (仅在 includeDI !== false 时生成) ----
  const shouldIncludeDI = adapter.includeDI !== false
  let diagram: ModdleElement | null = null

  if (shouldIncludeDI) {
    const planeElements: ModdleElement[] = []

    // Pool shapes
    for (const pool of pools) {
      const pos = pool.getPosition()
      const size = pool.getSize()
      const shape = moddle.create('bpmndi:BPMNShape', {
        id: `${toXmlId(pool.id)}_di`,
        bpmnElement: nodeElements.get(pool.id) || { id: toXmlId(pool.id) },
        isHorizontal: true,
      })
      shape.bounds = moddle.create('dc:Bounds', {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
      })
      planeElements.push(shape)
    }

    // Lane shapes
    for (const lane of lanes) {
      const pos = lane.getPosition()
      const size = lane.getSize()
      const shape = moddle.create('bpmndi:BPMNShape', {
        id: `${toXmlId(lane.id)}_di`,
        bpmnElement: { id: toXmlId(lane.id) },
        isHorizontal: true,
      })
      shape.bounds = moddle.create('dc:Bounds', {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
      })
      planeElements.push(shape)
    }

    // Flow node + artifact shapes
    for (const node of [...flowNodes, ...artifactNodes]) {
      if (!NODE_MAPPING[node.shape]) continue
      const pos = node.getPosition()
      const size = node.getSize()
      const el = nodeElements.get(node.id)
      const shape = moddle.create('bpmndi:BPMNShape', {
        id: `${toXmlId(node.id)}_di`,
        bpmnElement: el || { id: toXmlId(node.id) },
      })
      shape.bounds = moddle.create('dc:Bounds', {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
      })
      planeElements.push(shape)
    }

    // Edge shapes
    for (const edge of [...sequenceFlows, ...messageFlows, ...artifactEdges]) {
      const waypoints: ModdleElement[] = []
      const vertices = edge.getVertices()
      const srcTerminal = edge.getSource() as Record<string, any>
      const tgtTerminal = edge.getTarget() as Record<string, any>
      const srcCell = graph.getCellById(edge.getSourceCellId())
      const tgtCell = graph.getCellById(edge.getTargetCellId())

      if (srcCell && srcCell.isNode()) {
        const srcNode = srcCell as Node
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

      if (tgtCell && tgtCell.isNode()) {
        const tgtNode = tgtCell as Node
        const dirPt = vertices.length > 0
          ? vertices[vertices.length - 1]
          : srcCell && srcCell.isNode()
            ? nodeCenter(srcCell as Node)
            : nodeCenter(tgtNode)
        const pt = computeConnectionPoint(tgtNode, tgtTerminal?.port, dirPt)
        waypoints.push(moddle.create('dc:Point', { x: pt.x, y: pt.y }))
      }

      const edgeEl = moddle.create('bpmndi:BPMNEdge', {
        id: `${toXmlId(edge.id)}_di`,
        bpmnElement: flowEdgeElements.get(edge.id) || { id: toXmlId(edge.id) },
      })
      edgeEl.waypoint = waypoints
      planeElements.push(edgeEl)
    }

    // Bridge edge shapes
    for (const be of bridgeEdges) {
      const waypoints: ModdleElement[] = []
      const srcCell = graph.getCellById(be.source)
      const tgtCell = graph.getCellById(be.target)

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
        bpmnElement: flowEdgeElements.get(be.id) || { id: toXmlId(be.id) },
      })
      edgeEl.waypoint = waypoints
      planeElements.push(edgeEl)
    }

    const plane = moddle.create('bpmndi:BPMNPlane', {
      id: 'BPMNPlane_1',
      bpmnElement: hasCollaboration ? collaboration : process,
    })
    plane.planeElement = planeElements

    diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_1' })
    diagram.plane = plane
  }

  // ---- Assemble definitions ----
  const targetNamespace = adapter.targetNamespace || 'http://bpmn.io/schema/bpmn'
  const definitions = moddle.create('bpmn:Definitions', {
    id: 'Definitions_1',
    targetNamespace,
  })

  // 应用序列化适配器的 XML 命名空间
  if (adapter.xmlNamespaces) {
    definitions.$attrs = definitions.$attrs || {}
    for (const [prefix, uri] of Object.entries(adapter.xmlNamespaces)) {
      definitions.$attrs[`xmlns:${prefix}`] = uri
    }
  }

  const rootElements: ModdleElement[] = []
  if (collaboration) {
    rootElements.push(collaboration)
  }
  rootElements.push(process)
  definitions.rootElements = rootElements
  if (diagram) {
    definitions.diagrams = [diagram]
  }

  const { xml } = await moddle.toXML(definitions, { format: true, preamble: true })
  return xml
}
