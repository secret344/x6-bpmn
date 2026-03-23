/**
 * BPMN 2.0 XML → X6 Graph 导入器
 *
 * 使用 bpmn-moddle 解析 XML，通过反向映射表将 BPMN 元素
 * 转换为对应的 X6 图形节点和连接线。
 * 支持：泳道、流程节点、事件、网关、数据元素、工件、
 *       顺序流、消息流、关联边、扩展属性、DI 位置信息。
 */

import type { Graph } from '@antv/x6'
import { BpmnModdle } from 'bpmn-moddle'
import type { ModdleElement } from 'bpmn-moddle'
import { NODE_MAPPING, EDGE_MAPPING } from './bpmn-mapping'
import {
  BPMN_DEFAULT_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
} from '../utils/constants'
import type { SerializationAdapter } from '../rules/presets/serialization-adapter'
import { getSerializationAdapter } from '../rules/presets/serialization-adapter'

// ============================================================================
// 反向映射：BPMN 标签（+ 可选事件定义）→ X6 图形名称
// ============================================================================

/** 反向映射项 */
interface ReverseEntry {
  /** X6 图形名称 */
  shape: string
  /** 事件定义标签 */
  eventDefinition?: string
  /** BPMN 元素属性 */
  attrs?: Record<string, string>
}

/** 从 NODE_MAPPING 构建反向查找表（BPMN 标签 → X6 图形候选列表） */
function buildReverseNodeMap(): Map<string, ReverseEntry[]> {
  const map = new Map<string, ReverseEntry[]>()
  for (const [shape, info] of Object.entries(NODE_MAPPING)) {
    const key = info.tag
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({ shape, eventDefinition: info.eventDefinition, attrs: info.attrs })
  }
  return map
}

const reverseNodeMap = buildReverseNodeMap()

/** 构建反向连接线映射表 */
function buildReverseEdgeMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [shape, info] of Object.entries(EDGE_MAPPING)) {
    if (!map.has(info.tag)) {
      map.set(info.tag, shape)
    }
  }
  return map
}

const reverseEdgeMap = buildReverseEdgeMap()

// ============================================================================
// 辅助函数
// ============================================================================

/** 从 moddle $type 提取本地标签名：'bpmn:StartEvent' → 'startEvent' */
function localTag(element: ModdleElement): string {
  const type = element.$type || ''
  const name = type.includes(':') ? type.split(':')[1] : type
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** 安全获取字符串属性，不存在时返回默认值 */
function strProp(element: ModdleElement, prop: string, fallback = ''): string {
  const val = element[prop]
  return typeof val === 'string' ? val : fallback
}

// ============================================================================
// 解析 BPMN 元素对应的 X6 图形
// ============================================================================

/** 根据 BPMN 元素的标签、事件定义和属性，解析出最匹配的 X6 图形名称 */

function resolveNodeShape(element: ModdleElement): string | null {
  const tag = localTag(element)
  const candidates = reverseNodeMap.get(tag)
  /* c8 ignore next */
  if (!candidates || candidates.length === 0) return null

  // Find event definition
  const eventDefs = element.eventDefinitions as ModdleElement[] | undefined
  const eventDefTag = eventDefs && eventDefs.length > 0
    ? localTag(eventDefs[0])
    : undefined

  // Sort candidates: prefer more specific
  const sorted = [...candidates].sort((a, b) => {
    const aSpecific = (a.attrs ? 1 : 0) + (a.eventDefinition ? 1 : 0)
    const bSpecific = (b.attrs ? 1 : 0) + (b.eventDefinition ? 1 : 0)
    return bSpecific - aSpecific
  })

  let genericFallback: string | null = null
  for (const candidate of sorted) {
    if (candidate.eventDefinition && eventDefTag) {
      if (candidate.eventDefinition === eventDefTag) {
        if (candidate.attrs) {
          const allMatch = Object.entries(candidate.attrs).every(
            ([k, v]) => element[k] === v || String(element[k]) === v,
          )
          if (allMatch) return candidate.shape
        } else {
          return candidate.shape
        }
      }
    } else if (!candidate.eventDefinition && !eventDefTag) {
      if (candidate.attrs) {
        const allMatch = Object.entries(candidate.attrs).every(
          ([k, v]) => element[k] === v || String(element[k]) === v,
        )
        if (allMatch) return candidate.shape
      } else {
        if (!genericFallback) genericFallback = candidate.shape
      }
    }
  }

  if (genericFallback) return genericFallback
  /* c8 ignore next 2 */
  const fallback = sorted.find((c) => !c.eventDefinition) || sorted[0]
  return fallback.shape
}

// ============================================================================
// BPMN DI（图形交换）解析
// ============================================================================

/** DI 节点范围信息 */
interface DiBounds {
  x: number
  y: number
  width: number
  height: number
}

/** DI 路点坐标 */
interface DiWaypoint {
  x: number
  y: number
}

/** DI 节点图形信息 */
interface DiShape {
  bpmnElement: string
  bounds: DiBounds
  isHorizontal?: boolean
}

/** DI 连接线图形信息 */
interface DiEdge {
  bpmnElement: string
  waypoints: DiWaypoint[]
}

/** 解析 BPMNDiagram 元素，提取所有节点和连接线的位置信息 */
function parseDiagram(diagramEl: ModdleElement): {
  shapes: Map<string, DiShape>
  edges: Map<string, DiEdge>
} {
  const shapes = new Map<string, DiShape>()
  const edges = new Map<string, DiEdge>()

  const plane = diagramEl.plane as ModdleElement | undefined
  if (!plane) return { shapes, edges }

  const planeElements = (plane.planeElement || []) as ModdleElement[]

  for (const child of planeElements) {
    const type = child.$type || ''
    const bpmnElement = child.bpmnElement
    const bpmnElementId = typeof bpmnElement === 'string' ? bpmnElement : bpmnElement?.id || ''

    if (type === 'bpmndi:BPMNShape') {
      const bounds = child.bounds as ModdleElement | undefined
      if (bounds) {
        shapes.set(bpmnElementId, {
          bpmnElement: bpmnElementId,
          bounds: {
            x: bounds.x ?? 0,
            y: bounds.y ?? 0,
            width: bounds.width ?? 100,
            height: bounds.height ?? 60,
          },
          isHorizontal: child.isHorizontal === true,
        })
      }
    } else if (type === 'bpmndi:BPMNEdge') {
      const waypoints: DiWaypoint[] = ((child.waypoint || []) as ModdleElement[]).map((wp) => ({
        x: wp.x ?? 0,
        y: wp.y ?? 0,
      }))
      edges.set(bpmnElementId, { bpmnElement: bpmnElementId, waypoints })
    }
  }

  return { shapes, edges }
}

// ============================================================================
// 主导入函数
// ============================================================================

export interface ImportBpmnOptions {
  /** 导入前是否清空已有图形，默认 true */
  clearGraph?: boolean
  /** 导入后是否自动缩放适应，默认 true */
  zoomToFit?: boolean
  /**
   * 序列化适配器名称或实例
   *
   * 用于处理特定规则预设的扩展属性和命名空间。
   * - 如果传入字符串，将从注册中心查找对应的适配器
   * - 如果传入适配器实例，直接使用
   * - 如果不传，则使用标准 BPMN 2.0 格式（无扩展）
   *
   * @example
   * ```ts
   * // 使用注册的 SmartEngine 适配器
   * importBpmnXml(graph, xml, { adapter: 'smartengine' })
   *
   * // 使用自定义适配器实例
   * importBpmnXml(graph, xml, { adapter: myCustomAdapter })
   * ```
   */
  adapter?: string | SerializationAdapter
}

/**
 * 将 BPMN 2.0 XML 字符串导入到 X6 Graph。
 *
 * 处理流程：
 * 1. 解析 XML 得到 moddle definitions
 * 2. 提取 DI 位置信息
 * 3. 导入泳道（Pool / Lane）
 * 4. 导入流程节点（任务、事件、网关、数据元素、工件）
 * 5. 导入连接线（顺序流、消息流、关联、数据关联）
 * 6. 可选缩放适应
 *
 * @param graph — X6 图形实例
 * @param xml — BPMN 2.0 XML 字符串
 * @param options — 可选配置
 */
export async function importBpmnXml(graph: Graph, xml: string, options: ImportBpmnOptions = {}): Promise<void> {
  const { clearGraph = true, zoomToFit = true, adapter: adapterOption } = options

  const moddle = new BpmnModdle()

  // Resolve serialization adapter
  let adapter: SerializationAdapter | undefined
  if (adapterOption) {
    if (typeof adapterOption === 'string') {
      adapter = getSerializationAdapter(adapterOption)
      if (!adapter) {
        console.warn(`序列化适配器 "${adapterOption}" 未找到，将使用标准 BPMN 2.0 格式`)
      }
    } else {
      adapter = adapterOption
    }
  }

  // Call adapter beforeImport hook
  const modifiedXml = adapter?.beforeImport?.(xml, moddle)
  if (modifiedXml !== undefined) {
    xml = modifiedXml
  }

  let definitions: ModdleElement
  try {
    const result = await moddle.fromXML(xml)
    definitions = result.rootElement
  } catch (e: any) {
    throw new Error('Invalid BPMN XML: root element must be <definitions>')
  }

  if (!definitions || localTag(definitions) !== 'definitions') {
    throw new Error('Invalid BPMN XML: root element must be <definitions>')
  }

  if (clearGraph) {
    graph.clearCells()
  }

  // Parse diagram interchange (DI) for positions
  const diagrams = (definitions.diagrams || []) as ModdleElement[]
  const di = diagrams.length > 0 ? parseDiagram(diagrams[0]) : { shapes: new Map<string, DiShape>(), edges: new Map<string, DiEdge>() }

  // Find rootElements
  const rootElements = (definitions.rootElements || []) as ModdleElement[]
  const collaboration = rootElements.find((el) => localTag(el) === 'collaboration')
  const process = rootElements.find((el) => localTag(el) === 'process')

  const idMap = new Map<string, string>()
  const defaultFlowRefs = new Map<string, string>()

  // ---------- Import participants (pools) ----------
  if (collaboration) {
    const participants = (collaboration.participants || []) as ModdleElement[]
    for (const p of participants) {
      const bpmnId = p.id || ''
      const diShape = di.shapes.get(bpmnId)
      const node = graph.addNode({
        shape: BPMN_POOL,
        id: bpmnId,
        x: diShape?.bounds.x ?? 40,
        y: diShape?.bounds.y ?? 40,
        width: diShape?.bounds.width ?? 800,
        height: diShape?.bounds.height ?? 400,
        attrs: { headerLabel: { text: p.name || '' } },
      })
      idMap.set(bpmnId, node.id)
    }
  }

  if (!process) return

  // ---------- Import lanes ----------
  const laneSets = (process.laneSets || []) as ModdleElement[]
  const laneFlowNodeMap = new Map<string, string>()

  for (const laneSet of laneSets) {
    const laneEls = (laneSet.lanes || []) as ModdleElement[]
    for (const laneEl of laneEls) {
      const bpmnId = laneEl.id || ''
      const diShape = di.shapes.get(bpmnId)
      const node = graph.addNode({
        shape: BPMN_LANE,
        id: bpmnId,
        x: diShape?.bounds.x ?? 70,
        y: diShape?.bounds.y ?? 40,
        width: diShape?.bounds.width ?? 700,
        height: diShape?.bounds.height ?? 200,
        attrs: { headerLabel: { text: laneEl.name || '' } },
      })
      idMap.set(bpmnId, node.id)

      // Record flow node refs
      const refs = (laneEl.flowNodeRef || []) as ModdleElement[]
      for (const ref of refs) {
        const refId = typeof ref === 'string' ? ref : ref.id || ''
        if (refId) laneFlowNodeMap.set(refId, bpmnId)
      }
    }
  }

  // ---------- Import flow elements ----------
  const acceptedTags = new Set([
    'startEvent', 'endEvent',
    'intermediateThrowEvent', 'intermediateCatchEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'scriptTask', 'businessRuleTask',
    'sendTask', 'receiveTask', 'manualTask',
    'subProcess', 'transaction', 'adHocSubProcess', 'callActivity',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway',
    'complexGateway', 'eventBasedGateway',
    'dataObjectReference', 'dataStoreReference',
    'textAnnotation', 'group',
  ])

  const flowElements = (process.flowElements || []) as ModdleElement[]
  // Also include artifacts (textAnnotation, group, association at process level)
  const artifacts = (process.artifacts || []) as ModdleElement[]
  const allElements = [...flowElements, ...artifacts]

  for (const element of allElements) {
    const tag = localTag(element)
    if (!acceptedTags.has(tag)) continue

    const bpmnId = element.id || ''
    const name = element.name || ''

    const shape = resolveNodeShape(element)
    /* c8 ignore next */
    if (!shape) continue

    const diShape = di.shapes.get(bpmnId)

    // Default size based on shape type
    let defaultW = 100
    let defaultH = 60
    if (shape.includes('event') || shape.includes('boundary')) {
      defaultW = 36
      defaultH = 36
    } else if (shape.includes('gateway')) {
      defaultW = 50
      defaultH = 50
    } else if (shape.includes('data')) {
      defaultW = 40
      defaultH = 50
    } else if (shape === BPMN_TEXT_ANNOTATION) {
      defaultW = 100
      defaultH = 30
    } else if (shape === BPMN_GROUP) {
      defaultW = 200
      defaultH = 150
    }

    // Get label
    let label = name
    if (tag === 'textAnnotation') {
      label = element.text || name
    }

    const attrs: Record<string, any> = {}
    if (tag === 'textAnnotation' || shape === BPMN_POOL || shape === BPMN_LANE) {
      // These use different label attrs
    } else {
      attrs.label = { text: label }
    }

    const nodeConfig: Record<string, any> = {
      shape,
      id: bpmnId,
      x: diShape?.bounds.x ?? 100,
      y: diShape?.bounds.y ?? 100,
      width: diShape?.bounds.width ?? defaultW,
      height: diShape?.bounds.height ?? defaultH,
      attrs,
    }

    // Boundary event → set parent to attachedToRef
    if (tag === 'boundaryEvent') {
      const attachedTo = element.attachedToRef
      const attachedToId = typeof attachedTo === 'string' ? attachedTo : attachedTo?.id
      if (attachedToId) {
        nodeConfig.parent = attachedToId
      }
    }

    // Call adapter onImportNode hook
    adapter?.onImportNode?.({
      moddle,
      element,
      cellData: nodeConfig,
    })

    const node = graph.addNode(nodeConfig)
    idMap.set(bpmnId, node.id)

    // Read BPMN extension properties
    const extElements = element.extensionElements as ModdleElement | undefined
    if (extElements) {
      const values = (extElements.values || []) as ModdleElement[]
      const propsContainer = values.find((v) => {
        const t = v.$type || v.name || ''
        return t.includes('properties')
      })
      if (propsContainer) {
        const bpmn: Record<string, any> = {}
        const props = (propsContainer.$children || []) as any[]
        for (const prop of props) {
          const propName = prop.name || prop.$attrs?.name
          const propValue = prop.value || prop.$attrs?.value || ''
          if (propName) {
            if (propValue === 'true') bpmn[propName] = true
            else if (propValue === 'false') bpmn[propName] = false
            else bpmn[propName] = propValue
          }
        }
        if (Object.keys(bpmn).length > 0) {
          node.setData({ ...(node.getData() || {}), bpmn }, { overwrite: true })
        }
      }
    }

    // Track default flow
    const defaultRef = element.default
    if (defaultRef) {
      const defaultId = typeof defaultRef === 'string' ? defaultRef : defaultRef.id
      if (defaultId) {
        defaultFlowRefs.set(bpmnId, defaultId)
      }
    }
  }

  // ---------- Import sequence flows ----------
  const defaultFlowIds = new Set(defaultFlowRefs.values())

  const seqFlows = flowElements.filter((el) => localTag(el) === 'sequenceFlow')
  for (const sf of seqFlows) {
    const bpmnId = sf.id || ''
    const sourceRef = typeof sf.sourceRef === 'string' ? sf.sourceRef : sf.sourceRef?.id || ''
    const targetRef = typeof sf.targetRef === 'string' ? sf.targetRef : sf.targetRef?.id || ''
    const name = sf.name || ''

    // Determine edge shape
    let edgeShape = 'bpmn-sequence-flow'
    if (defaultFlowIds.has(bpmnId)) {
      edgeShape = BPMN_DEFAULT_FLOW
    } else if (sf.conditionExpression) {
      edgeShape = BPMN_CONDITIONAL_FLOW
    }

    const labels = name ? [{ attrs: { label: { text: name } } }] : []
    const diEdge = di.edges.get(bpmnId)

    const vertices =
      diEdge && diEdge.waypoints.length > 2
        ? diEdge.waypoints.slice(1, -1).map((wp: DiWaypoint) => ({ x: wp.x, y: wp.y }))
        : []

    const edgeConfig: Record<string, any> = {
      shape: edgeShape,
      id: bpmnId,
      source: sourceRef,
      target: targetRef,
      labels,
      vertices,
    }

    // Call adapter onImportEdge hook
    adapter?.onImportEdge?.({
      moddle,
      element: sf,
      cellData: edgeConfig,
    })

    const edge = graph.addEdge(edgeConfig)
    idMap.set(bpmnId, edge.id)
  }

  // ---------- Import message flows ----------
  if (collaboration) {
    const msgFlows = (collaboration.messageFlows || []) as ModdleElement[]
    for (const mf of msgFlows) {
      const bpmnId = mf.id || ''
      const sourceRef = typeof mf.sourceRef === 'string' ? mf.sourceRef : mf.sourceRef?.id || ''
      const targetRef = typeof mf.targetRef === 'string' ? mf.targetRef : mf.targetRef?.id || ''
      const name = mf.name || ''

      const labels = name ? [{ attrs: { label: { text: name } } }] : []
      const diEdge = di.edges.get(bpmnId)
      const vertices =
        diEdge && diEdge.waypoints.length > 2
          ? diEdge.waypoints.slice(1, -1).map((wp: DiWaypoint) => ({ x: wp.x, y: wp.y }))
          : []

      graph.addEdge({
        shape: 'bpmn-message-flow',
        id: bpmnId,
        source: sourceRef,
        target: targetRef,
        labels,
        vertices,
      })
    }
  }

  // ---------- Import associations ----------
  const associations = artifacts.filter((el) => localTag(el) === 'association')
  for (const assoc of associations) {
    const bpmnId = assoc.id || ''
    const sourceRef = typeof assoc.sourceRef === 'string' ? assoc.sourceRef : assoc.sourceRef?.id || ''
    const targetRef = typeof assoc.targetRef === 'string' ? assoc.targetRef : assoc.targetRef?.id || ''
    const direction = assoc.associationDirection

    const edgeShape = direction === 'One' ? BPMN_DIRECTED_ASSOCIATION : 'bpmn-association'

    graph.addEdge({
      shape: edgeShape,
      id: bpmnId,
      source: sourceRef,
      target: targetRef,
    })
  }

  // ---------- Import data associations ----------
  // Data associations can appear inside tasks (dataInputAssociations / dataOutputAssociations)
  for (const element of flowElements) {
    const dataInputAssocs = (element.dataInputAssociations || []) as ModdleElement[]
    const dataOutputAssocs = (element.dataOutputAssociations || []) as ModdleElement[]

    for (const da of [...dataInputAssocs, ...dataOutputAssocs]) {
      const bpmnId = da.id || ''
      if (!bpmnId) continue

      const sourceRefs = da.sourceRef as ModdleElement[] | undefined
      const targetRef = da.targetRef as ModdleElement | undefined
      const sourceRef = sourceRefs && sourceRefs.length > 0
        ? (typeof sourceRefs[0] === 'string' ? sourceRefs[0] : sourceRefs[0]?.id || '')
        : ''
      const targetId = targetRef
        ? (typeof targetRef === 'string' ? targetRef : targetRef.id || '')
        : ''

      if (sourceRef && targetId) {
        graph.addEdge({
          shape: BPMN_DATA_ASSOCIATION,
          id: bpmnId,
          source: sourceRef,
          target: targetId,
        })
      }
    }
  }

  // Call adapter afterImport hook
  adapter?.afterImport?.()

  // ---------- Zoom to fit ----------
  if (zoomToFit) {
    setTimeout(() => graph.zoomToFit({ padding: 40, maxScale: 1 }), 100)
  }
}
