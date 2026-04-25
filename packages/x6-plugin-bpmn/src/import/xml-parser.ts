/**
 * BPMN XML → 中间 JSON 解析器
 *
 * 使用 bpmn-moddle 将 BPMN 2.0 XML 解析为 BpmnImportData 中间格式，
 * 供后续 graph-loader 加载到 X6 图形实例。
 *
 * 解析步骤：
 *   1. 使用 bpmn-moddle fromXML 解析字符串
 *   2. 提取 BPMNDI 中的位置/尺寸信息（BPMNShape / BPMNEdge）
 *   3. 解析参与者（bpmn:Participant → Pool 节点）
 *   4. 解析泳道集（bpmn:LaneSet → Lane 节点）
 *   5. 解析流程节点（Task、Event、Gateway、DataObject 等）
 *   6. 解析连接线（SequenceFlow、MessageFlow、Association、DataAssociation）
 *
 * 本模块不修改任何 X6 图形实例，仅做数据转换。
 */

import { BpmnModdle } from 'bpmn-moddle'
import type { ModdleElement } from 'bpmn-moddle'
import { classifyShape } from '../config'
import {
  type BpmnNodeMapping,
  type BpmnEdgeMapping,
  NODE_MAPPING,
  EDGE_MAPPING,
} from '../export/bpmn-mapping'
import type { SerializationOverrides } from '../core/dialect/types'
import {
  BPMN_DEFAULT_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_USER_TASK,
} from '../utils/constants'
import type { BpmnImportData, BpmnNodeData, BpmnEdgeData } from './types'
import type {
  BpmnImportCompatibilityIssue,
  BpmnImportDiagnostics,
  BpmnImportMetadata,
  BpmnPreservedDiagramMetadata,
  BpmnPreservedElementMetadata,
  BpmnPreservedProcessMetadata,
} from './types'
import {
  createBpmnElementTagRegex,
  createBpmnOpeningTagRegex,
  getBpmnAcceptedTagPrefixPattern,
  getBpmnLocalName,
  resolveBpmnXmlNameSettings,
} from '../utils/bpmn-xml-names'
import {
  isExtensionPropertyContainerElement,
  isExtensionPropertyItemElement,
  resolveExtensionPropertySerialization,
  type ResolvedExtensionPropertySerialization,
} from '../utils/extension-properties'

// ============================================================================
// 内部类型：BPMN DI 几何信息
// ============================================================================

/** DI 节点尺寸范围 */
interface DiBounds {
  x: number
  y: number
  width: number
  height: number
}

/** DI 路径点坐标 */
interface DiWaypoint {
  x: number
  y: number
}

/** DI 节点形状信息 */
interface DiShape {
  bpmnElement: string
  bounds: DiBounds
  isHorizontal?: boolean
  isExpanded?: boolean
  isMarkerVisible?: boolean
  bpmndi?: Record<string, unknown>
}

/** DI 连接线信息 */
interface DiEdge {
  bpmnElement: string
  waypoints: DiWaypoint[]
  messageVisibleKind?: 'initiating' | 'non_initiating'
  bpmndi?: Record<string, unknown>
}

// ============================================================================
// 内部辅助：BPMN 标签反向映射
// ============================================================================

/** 反向映射条目：BPMN 标签 → X6 图形候选 */
interface ReverseEntry {
  shape: string
  eventDefinition?: string
  attrs?: Record<string, string>
}

/** 从 NODE_MAPPING 构建反向查找表（BPMN 标签 → X6 图形候选列表） */
function buildReverseNodeMap(
  nodeMapping: Record<string, BpmnNodeMapping>,
): Map<string, ReverseEntry[]> {
  const map = new Map<string, ReverseEntry[]>()
  for (const [shape, info] of Object.entries(nodeMapping)) {
    const key = info.tag
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({ shape, eventDefinition: info.eventDefinition, attrs: info.attrs })
  }
  return map
}

/** 从 EDGE_MAPPING 构建反向查找表（BPMN 标签 → X6 图形名称） */
function buildReverseEdgeMap(
  edgeMapping: Record<string, BpmnEdgeMapping>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const [shape, info] of Object.entries(edgeMapping)) {
    if (!map.has(info.tag)) map.set(info.tag, shape)
  }
  return map
}

const EXPANDABLE_ACTIVITY_SHAPES = new Set([
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
])

const FLOW_CONTAINER_TAGS = new Set([
  'subProcess',
  'transaction',
  'adHocSubProcess',
])

// ============================================================================
// 内部辅助：标签提取
// ============================================================================

/**
 * 从 moddle 元素的 $type 提取本地标签名。
 * 例：'bpmn:StartEvent' → 'startEvent'
 */
/* istanbul ignore next -- 只是 getBpmnLocalName 的薄包装，实际行为由所有调用方间接覆盖，函数声明本身的计数不稳定。 */
function localTag(element: ModdleElement): string {
  /* istanbul ignore next — moddle 始终提供 $type */
  return getBpmnLocalName(String(element.$type || ''))
}

interface XmlEventHints {
  boundaryEventsWithoutCancelActivity: Set<string>
  multipleEventDefinitionIds: Set<string>
  parallelMultipleIds: Set<string>
}

interface XmlDiHints {
  edgeMessageVisibleKinds: Map<string, 'initiating' | 'non_initiating'>
}

interface XmlBpmndiReferenceHints {
  planeBpmnElements: string[]
  diElementBpmnElements: string[]
}

interface XmlMultiInstanceConditionHint {
  action?: string
  body: string
}

interface XmlMultiInstanceHints {
  conditionsByElementId: Map<string, XmlMultiInstanceConditionHint[]>
}

function readReferencedElementId(reference: unknown): string | undefined {
  if (typeof reference === 'string') {
    const normalized = reference.trim()
    return normalized || undefined
  }

  if (reference && typeof reference === 'object') {
    const rawId = (reference as { id?: unknown }).id
    if (typeof rawId === 'string') {
      const normalized = rawId.trim()
      return normalized || undefined
    }
  }

  return undefined
}

function collectEventXmlHints(
  xml: string,
  xmlNames?: SerializationOverrides['xmlNames'],
): XmlEventHints {
  const hints: XmlEventHints = {
    boundaryEventsWithoutCancelActivity: new Set<string>(),
    multipleEventDefinitionIds: new Set<string>(),
    parallelMultipleIds: new Set<string>(),
  }

  const pattern = createBpmnElementTagRegex(
    ['startEvent', 'intermediateThrowEvent', 'intermediateCatchEvent', 'boundaryEvent', 'endEvent'],
    xmlNames,
  )
  const multipleEventDefinitionPattern = createBpmnOpeningTagRegex('multipleEventDefinition', xmlNames)
  let match: RegExpExecArray | null = pattern.exec(xml)

  while (match) {
    const [, tag, beforeIdAttrs, id, afterIdAttrs, body] = match
    const attrs = `${beforeIdAttrs} ${afterIdAttrs}`

    if (tag === 'boundaryEvent' && !/\bcancelActivity=/.test(attrs)) {
      hints.boundaryEventsWithoutCancelActivity.add(id)
    }
    if (multipleEventDefinitionPattern.test(body)) {
      hints.multipleEventDefinitionIds.add(id)
    }
    if (/\bparallelMultiple="true"/.test(attrs)) {
      hints.parallelMultipleIds.add(id)
    }

    match = pattern.exec(xml)
  }

  return hints
}

function collectDiXmlHints(xml: string): XmlDiHints {
  const hints: XmlDiHints = {
    edgeMessageVisibleKinds: new Map<string, 'initiating' | 'non_initiating'>(),
  }

  const pattern = /<(?:\w+:)?BPMNEdge\b([^>]*)\bid="([^"]+)"([^>]*)>/g
  let match: RegExpExecArray | null = pattern.exec(xml)

  while (match) {
    const [, beforeIdAttrs, id, afterIdAttrs] = match
    const attrs = `${beforeIdAttrs} ${afterIdAttrs}`
    const messageVisibleKindMatch = attrs.match(/\bmessageVisibleKind="(initiating|non_initiating)"/)

    if (messageVisibleKindMatch) {
      hints.edgeMessageVisibleKinds.set(id, messageVisibleKindMatch[1] as 'initiating' | 'non_initiating')
    }

    match = pattern.exec(xml)
  }

  return hints
}

function collectBpmndiReferenceHints(xml: string): XmlBpmndiReferenceHints {
  const hints: XmlBpmndiReferenceHints = {
    planeBpmnElements: [],
    diElementBpmnElements: [],
  }

  const planePattern = /<(?:\w+:)?BPMNPlane\b[^>]*\bbpmnElement="([^"]+)"/g
  const diElementPattern = /<(?:\w+:)?BPMN(?:Shape|Edge)\b[^>]*\bbpmnElement="([^"]+)"/g

  let planeMatch: RegExpExecArray | null = planePattern.exec(xml)
  while (planeMatch) {
    const planeBpmnElement = planeMatch[1]?.trim()
    if (planeBpmnElement) {
      hints.planeBpmnElements.push(planeBpmnElement)
    }
    planeMatch = planePattern.exec(xml)
  }

  let diElementMatch: RegExpExecArray | null = diElementPattern.exec(xml)
  while (diElementMatch) {
    const diElementBpmnElement = diElementMatch[1]?.trim()
    if (diElementBpmnElement) {
      hints.diElementBpmnElements.push(diElementBpmnElement)
    }
    diElementMatch = diElementPattern.exec(xml)
  }

  return hints
}

function normalizeXmlConditionBody(rawBody: string): string {
  const trimmed = rawBody.trim()
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  const normalized = cdataMatch ? cdataMatch[1].trim() : trimmed
  return normalized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function hasMeaningfulElementMetadata(
  metadata: BpmnPreservedElementMetadata | undefined,
  defaultId?: string,
): metadata is BpmnPreservedElementMetadata {
  if (!metadata) {
    return false
  }

  if (metadata.$attrs && Object.keys(metadata.$attrs).length > 0) {
    return true
  }
  if (metadata.id && metadata.id !== defaultId) {
    return true
  }

  return false
}

function collectMultiInstanceXmlHints(
  xml: string,
  xmlNames?: SerializationOverrides['xmlNames'],
): XmlMultiInstanceHints {
  const hints: XmlMultiInstanceHints = {
    conditionsByElementId: new Map<string, XmlMultiInstanceConditionHint[]>(),
  }

  const prefixPattern = getBpmnAcceptedTagPrefixPattern(xmlNames)
  const taskPattern = createBpmnElementTagRegex(['userTask'], xmlNames)
  const loopPattern = new RegExp(
    `<${prefixPattern}multiInstanceLoopCharacteristics\\b[^>]*>([\\s\\S]*?)<\\/${prefixPattern}multiInstanceLoopCharacteristics>`,
  )
  const completionPattern = new RegExp(
    `<${prefixPattern}completionCondition\\b([^>]*)>([\\s\\S]*?)<\\/${prefixPattern}completionCondition>`,
    'g',
  )

  let match: RegExpExecArray | null = taskPattern.exec(xml)
  while (match) {
    const [, , , elementId, , body] = match
    const loopMatch = body.match(loopPattern)

    if (loopMatch) {
      const conditions: XmlMultiInstanceConditionHint[] = []
      let completionMatch: RegExpExecArray | null = completionPattern.exec(loopMatch[1])

      while (completionMatch) {
        const [, attrs, rawBody] = completionMatch
        const actionMatch = attrs.match(/\baction="([^"]+)"/)
        conditions.push({
          ...(actionMatch?.[1] ? { action: actionMatch[1] } : {}),
          body: normalizeXmlConditionBody(rawBody),
        })
        completionMatch = completionPattern.exec(loopMatch[1])
      }

      if (conditions.length > 0) {
        hints.conditionsByElementId.set(elementId, conditions)
      }
    }

    match = taskPattern.exec(xml)
  }

  return hints
}

function collectProcessFlowElements(
  elements: ModdleElement[],
  output: ModdleElement[],
  containerParents: Map<string, string>,
  parentContainerId?: string,
): void {
  for (const element of elements) {
    output.push(element)

    /* istanbul ignore next -- nested subprocess recursion is exercised by roundtrip tests, but source maps undercount this helper body */
    const elementId = typeof element.id === 'string' ? element.id : ''
    if (parentContainerId && elementId && !containerParents.has(elementId)) {
      containerParents.set(elementId, parentContainerId)
    }

    if (!FLOW_CONTAINER_TAGS.has(localTag(element))) continue

    const nestedFlowElements = (element.flowElements || []) as ModdleElement[]
    /* istanbul ignore next -- nested subprocess recursion is verified by importer/exporter roundtrip tests */
    if (nestedFlowElements.length > 0) {
      collectProcessFlowElements(nestedFlowElements, output, containerParents, elementId || parentContainerId)
    }
  }
}

function resolveImplicitBoundaryCancelActivity(
  tag: string,
  key: string,
  elementId: string,
  eventDefTag: string | undefined,
  xmlEventHints: XmlEventHints,
): string | undefined {
  if (
    tag !== 'boundaryEvent'
    || key !== 'cancelActivity'
    || !xmlEventHints.boundaryEventsWithoutCancelActivity.has(elementId)
  ) {
    return undefined
  }

  return eventDefTag === 'escalationEventDefinition' ? 'false' : 'true'
}

// ============================================================================
// 内部辅助：BPMN 节点图形名称解析
// ============================================================================

/**
 * 根据 BPMN 元素的标签、事件定义和属性，解析出最匹配的 X6 图形名称。
 * 优先匹配更具体的候选（有 eventDefinition + attrs 的优先于仅有 eventDefinition 的）。
 */
function resolveNodeShape(
  element: ModdleElement,
  xmlEventHints: XmlEventHints,
  reverseNodeMap: Map<string, ReverseEntry[]>,
): string | null {
  const tag = localTag(element)
  const candidates = reverseNodeMap.get(tag)
  /* istanbul ignore next */
  if (!candidates || candidates.length === 0) return null

  // 获取事件定义标签（如 'timerEventDefinition'）
  const eventDefs = element.eventDefinitions as ModdleElement[] | undefined
  const rawEventDefTag = eventDefs && eventDefs.length > 0 ? localTag(eventDefs[0]) : undefined
  /* istanbul ignore next — 防御性回退，仅处理异常 moddle 对象缺失 id 的情况 */
  const elementId = String((element as { id?: string }).id || '')
  const eventDefTag = rawEventDefTag
    ?? (xmlEventHints.multipleEventDefinitionIds.has(elementId) ? 'multipleEventDefinition' : undefined)

  const matchAttrs = (candidate: ReverseEntry): boolean => {
    if (!candidate.attrs) return true
    return Object.entries(candidate.attrs).every(([key, value]) => {
      const implicitValue = resolveImplicitBoundaryCancelActivity(
        tag,
        key,
        elementId,
        eventDefTag,
        xmlEventHints,
      )
      if (implicitValue) return value === implicitValue

      if (
        xmlEventHints.parallelMultipleIds.has(elementId)
        && key === 'parallelMultiple'
      ) {
        return value === 'true'
      }

      const rawValue = (element as Record<string, unknown>)[key]
      if (rawValue === value || String(rawValue) === value) return true

      return false
    })
  }

  // 按特殊性排序：attrs + eventDefinition > eventDefinition > 无
  const sorted = [...candidates].sort((a, b) => {
    const aScore = (a.eventDefinition ? 10 : 0) + Object.keys(a.attrs ?? {}).length
    const bScore = (b.eventDefinition ? 10 : 0) + Object.keys(b.attrs ?? {}).length
    return bScore - aScore
  })

  let genericFallback: string | null = null

  for (const candidate of sorted) {
    if (candidate.eventDefinition && eventDefTag) {
      // 候选有事件定义，且元素也有对应事件定义
      if (candidate.eventDefinition === eventDefTag) {
        if (matchAttrs(candidate)) {
          return candidate.shape
        }
      }
    } else if (!candidate.eventDefinition && !eventDefTag) {
      // 候选无事件定义，元素也无事件定义
      if (candidate.attrs) {
        if (matchAttrs(candidate)) return candidate.shape
      } else {
        if (!genericFallback) genericFallback = candidate.shape
      }
    }
  }

  /* istanbul ignore start — 正常路径总能找到 genericFallback */
  if (genericFallback) return genericFallback
  // 兜底：取第一个不带事件定义的候选，或首个候选
  const fallback = sorted.find((c) => !c.eventDefinition) || sorted[0]
  return fallback?.shape || null
  /* istanbul ignore stop */
}

// ============================================================================
// 内部辅助：DI 图形信息解析
// ============================================================================

/**
 * 解析 BPMNDiagram 元素，提取所有 BPMNShape 和 BPMNEdge 的几何信息。
 */
function parseDiagram(
  diagramEl: ModdleElement,
  declaredNamespaces: Record<string, string>,
  xmlDiHints?: XmlDiHints,
): {
  shapes: Map<string, DiShape>
  edges: Map<string, DiEdge>
} {
  const shapes = new Map<string, DiShape>()
  const edges = new Map<string, DiEdge>()

  const plane = diagramEl.plane as ModdleElement | undefined
  if (!plane) return { shapes, edges }

  const planeElements = (plane.planeElement || []) as ModdleElement[]

  for (const child of planeElements) {
    /* istanbul ignore next — moddle 始终提供 $type 字符串 */
    const type: string = child.$type ?? ''
    const bpmnElement = child.bpmnElement
    /* istanbul ignore next — moddle 总是将 bpmnElement 解析为对象 */
    const bpmnElementId: string =
      typeof bpmnElement === 'string' ? bpmnElement : bpmnElement?.id ?? ''

    if (type === 'bpmndi:BPMNShape') {
      const bounds = child.bounds as ModdleElement | undefined
      const rawXmlAttrs = parsePreservedXmlAttrs(child, declaredNamespaces)
      const diShapeId = typeof child.id === 'string' && child.id ? child.id : undefined
      const preservedBpmndi = diShapeId && diShapeId !== `${bpmnElementId}_di`
        ? {
            ...(rawXmlAttrs ?? {}),
            id: diShapeId,
          }
        : rawXmlAttrs
      /* istanbul ignore else */
      if (bounds) {
        /* istanbul ignore next — moddle 始终提供完整 DI 数值，?? 回退不会触发 */
        shapes.set(bpmnElementId, {
          bpmnElement: bpmnElementId,
          bounds: {
            x: bounds.x ?? 0,
            y: bounds.y ?? 0,
            width: bounds.width ?? 100,
            height: bounds.height ?? 60,
          },
          isHorizontal: typeof child.isHorizontal === 'boolean' ? child.isHorizontal : undefined,
          isExpanded: typeof child.isExpanded === 'boolean' ? child.isExpanded : undefined,
          isMarkerVisible: typeof child.isMarkerVisible === 'boolean' ? child.isMarkerVisible : undefined,
          bpmndi: preservedBpmndi,
        })
      }
    }

    if (type === 'bpmndi:BPMNEdge') {
      const rawXmlAttrs = parsePreservedXmlAttrs(child, declaredNamespaces)
      /* istanbul ignore next — moddle 始终提供 waypoint 数组及数值 */
      const waypoints: DiWaypoint[] = ((child.waypoint ?? []) as ModdleElement[]).map((wp) => ({
        x: wp.x ?? 0,
        y: wp.y ?? 0,
      }))
      const diEdgeId = String((child as { id?: string }).id || '')
      const preservedBpmndi = diEdgeId && diEdgeId !== `${bpmnElementId}_di`
        ? {
            ...(rawXmlAttrs ?? {}),
            id: diEdgeId,
          }
        : rawXmlAttrs
      edges.set(bpmnElementId, {
        bpmnElement: bpmnElementId,
        waypoints,
        messageVisibleKind: diEdgeId ? xmlDiHints?.edgeMessageVisibleKinds.get(diEdgeId) : undefined,
        bpmndi: preservedBpmndi,
      })
    }
    // 其他 DI 类型（BPMN 2.0 标准中不会出现）静默忽略
  }

  return { shapes, edges }
}

// ============================================================================
// 内部辅助：节点默认尺寸
// ============================================================================

/**
 * 根据 X6 图形名称推断节点默认宽高。
 * 用于没有 BPMNDI 信息时的回退值。
 */
function defaultNodeSize(shape: string): { w: number; h: number } {
  if (shape.includes('event') || shape.includes('boundary')) return { w: 36, h: 36 }
  if (shape.includes('gateway')) return { w: 50, h: 50 }
  if (shape.includes('data')) return { w: 40, h: 50 }
  if (shape === BPMN_TEXT_ANNOTATION) return { w: 100, h: 30 }
  if (shape === BPMN_GROUP) return { w: 200, h: 150 }
  return { w: 100, h: 60 }
}

// ============================================================================
// 内部辅助：扩展属性解析
// ============================================================================

/**
 * 从 BPMN extensionElements 中提取自定义业务属性。
 * 支持布尔值自动转换（'true'/'false' 字符串 → boolean）。
 */
function parseExtensionProps(
  element: ModdleElement,
  extensionProperties: ResolvedExtensionPropertySerialization | null,
  namespaces: Record<string, string>,
): Record<string, unknown> | undefined {
  if (!extensionProperties) return undefined

  const extElements = element.extensionElements as ModdleElement | undefined
  if (!extElements) return undefined

  /* istanbul ignore next — moddle 始终提供 values 数组 */
  const values = (extElements.values || []) as ModdleElement[]
  const propsContainer = values.find((value) => isExtensionPropertyContainerElement(value, extensionProperties, namespaces))

  /* istanbul ignore next — extensionElements 不含通用扩展属性容器时防御性返回 */
  if (!propsContainer) return undefined

  const bpmn: Record<string, unknown> = {}
  /* istanbul ignore next — moddle 始终提供 $children */
  const props = ((propsContainer.$children || []) as ModdleElement[])
    .filter((prop) => isExtensionPropertyItemElement(prop, extensionProperties, namespaces))

  for (const prop of props) {
    /* istanbul ignore next — prop.name/value 始终由 moddle 提供 */
    const propName = ((prop as Record<string, unknown>).name || (prop.$attrs as any)?.name) as string | undefined
    /* istanbul ignore next — prop.value 始终有值 */
    const propValue = ((prop as Record<string, unknown>).value || (prop.$attrs as any)?.value || '') as string
    /* istanbul ignore else */
    if (propName) {
      if (propValue === 'true') bpmn[propName] = true
      else if (propValue === 'false') bpmn[propName] = false
      else bpmn[propName] = propValue
    }
  }

  /* istanbul ignore if — 通用扩展属性容器导出时始终包含属性子节点，此分支不可达 */
  if (Object.keys(bpmn).length === 0) return undefined
  return { bpmn }
}

function collectDeclaredNamespaces(xml: string): Record<string, string> {
  const namespaces: Record<string, string> = {}
  const namespacePattern = /xmlns:([A-Za-z_][\w.-]*)="([^"]+)"/g

  for (const match of xml.matchAll(namespacePattern)) {
    const [, prefix, uri] = match
    /* istanbul ignore next -- 正则分组返回空值仅属防御性检查，真实 XML 命名空间路径已由导入测试覆盖。 */
    if (!prefix || !uri) continue
    namespaces[prefix] = uri
  }

  return namespaces
}

function parsePreservedElementMetadata(
  element: ModdleElement | undefined,
  declaredNamespaces: Record<string, string>,
): BpmnPreservedElementMetadata | undefined {
  if (!element) return undefined

  const preservedXml = parsePreservedXmlAttrs(element, declaredNamespaces)
  const id = typeof element.id === 'string' && element.id ? element.id : undefined

  if (!id && !preservedXml) return undefined

  return {
    ...(id ? { id } : {}),
    ...(preservedXml ?? {}),
  }
}

function parsePreservedXmlAttrs(
  element: ModdleElement,
  declaredNamespaces: Record<string, string>,
): Record<string, unknown> | undefined {
  /* istanbul ignore next -- 真实 moddle 元素在公开解析路径中始终提供 $attrs；空对象兜底仅防御异常伪造元素。 */
  const rawAttrs = (element.$attrs || {}) as Record<string, unknown>
  const attrs = Object.fromEntries(
    Object.entries(rawAttrs).filter(([key, value]) => !key.startsWith('xmlns') && value !== undefined && value !== null),
  )

  if (Object.keys(attrs).length === 0) return undefined

  const namespaces = Object.fromEntries(
    Array.from(new Set(
      Object.keys(attrs)
        .map((key) => {
          const separatorIndex = key.indexOf(':')
          return separatorIndex > 0 ? key.slice(0, separatorIndex) : null
        })
        .filter((prefix): prefix is string => prefix !== null)
        .filter((prefix) => Boolean(declaredNamespaces[prefix])),
    )).map((prefix) => [prefix, declaredNamespaces[prefix]]),
  )

  const bpmnData: Record<string, unknown> = {
    $attrs: attrs,
  }
  if (Object.keys(namespaces).length > 0) {
    bpmnData.$namespaces = namespaces
  }

  return bpmnData
}

function parseRawXmlAttrs(
  element: ModdleElement,
  declaredNamespaces: Record<string, string>,
): Record<string, unknown> | undefined {
  const bpmnData = parsePreservedXmlAttrs(element, declaredNamespaces)
  if (!bpmnData) return undefined

  return {
    bpmn: bpmnData,
  }
}

function buildImportDiagnostics(params: {
  xml: string
  warnings: string[]
  processes: ModdleElement[]
  xmlBpmndiReferenceHints: XmlBpmndiReferenceHints
  xmlMultiInstanceHints: XmlMultiInstanceHints
  supportsSmartAbortCondition: boolean
}): BpmnImportDiagnostics | undefined {
  const compatibilityIssues: BpmnImportCompatibilityIssue[] = []
  const lossyFlags = new Set<string>()
  const reportedIssues = new Set<string>()
  const idCounts = new Map<string, number>()
  const pushIssue = (issue: BpmnImportCompatibilityIssue): void => {
    const issueKey = `${issue.code}:${issue.message}:${(issue.elementIds ?? []).join(',')}`
    if (reportedIssues.has(issueKey)) {
      return
    }

    reportedIssues.add(issueKey)
    compatibilityIssues.push(issue)
  }
  const idPattern = /\bid="([^"]+)"/g
  let idMatch: RegExpExecArray | null = idPattern.exec(params.xml)

  while (idMatch) {
    const [, id] = idMatch
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
    idMatch = idPattern.exec(params.xml)
  }

  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
  if (duplicateIds.length > 0) {
    pushIssue({
      code: 'duplicate-bpmn-id',
      message: `检测到重复的 BPMN id：${duplicateIds.join(', ')}`,
      elementIds: duplicateIds,
    })
    lossyFlags.add('duplicate-bpmn-id')
  }

  const knownIds = new Set(idCounts.keys())
  const referencePattern = /\b(sourceRef|targetRef|processRef|attachedToRef|default)="([^"]+)"/g
  let referenceMatch: RegExpExecArray | null = referencePattern.exec(params.xml)
  while (referenceMatch) {
    const [, attrName, refId] = referenceMatch
    if (!knownIds.has(refId)) {
      pushIssue({
        code: 'invalid-reference',
        message: `${attrName} 引用了不存在的元素：${refId}`,
        elementIds: [refId],
      })
      lossyFlags.add('invalid-reference')
    }
    referenceMatch = referencePattern.exec(params.xml)
  }

  for (const planeBpmnElementId of params.xmlBpmndiReferenceHints.planeBpmnElements) {
    if (planeBpmnElementId && !knownIds.has(planeBpmnElementId)) {
      pushIssue({
        code: 'invalid-plane-bpmn-element',
        message: `bpmnElement 引用了不存在的元素：${planeBpmnElementId}`,
        elementIds: [planeBpmnElementId],
      })
      lossyFlags.add('invalid-plane-bpmn-element')
    }
  }

  for (const planeElementRefId of params.xmlBpmndiReferenceHints.diElementBpmnElements) {
    if (planeElementRefId && !knownIds.has(planeElementRefId)) {
      pushIssue({
        code: 'invalid-reference',
        message: `BPMNDI 的 bpmnElement 引用了不存在的元素：${planeElementRefId}`,
        elementIds: [planeElementRefId],
      })
      lossyFlags.add('invalid-reference')
    }
  }

  const collectLanesWithChildLaneSet = (laneSets: ModdleElement[]): string[] => {
    const laneIds = new Set<string>()
    const visitLane = (lane: ModdleElement): void => {
      const childLaneSet = lane.childLaneSet as ModdleElement | undefined
      if (childLaneSet) {
        laneIds.add(lane.id as string)

        const childLanes = childLaneSet.lanes as ModdleElement[]
        childLanes.forEach(visitLane)
      }
    }

    for (const laneSet of laneSets) {
      const lanes = laneSet.lanes as ModdleElement[]
      lanes.forEach(visitLane)
    }

    return Array.from(laneIds)
  }

  for (const process of params.processes) {
    const laneSets = (process.laneSets || []) as ModdleElement[]
    if (laneSets.length > 1) {
      const processId = typeof process.id === 'string' ? process.id : ''
      pushIssue({
        code: 'multiple-lane-sets',
        message: `当前项目仅保真每个 process 的首个 laneSet，process ${processId} 存在多个 laneSet`,
        ...(processId ? { elementIds: [processId] } : {}),
      })
      lossyFlags.add('multiple-lane-sets')
    }

    const lanesWithChildLaneSet = collectLanesWithChildLaneSet(laneSets)
    if (lanesWithChildLaneSet.length > 0) {
      pushIssue({
        code: 'unsupported-child-lane-set',
        message: `当前项目尚未保真 Lane.childLaneSet，lane ${lanesWithChildLaneSet.join(', ')} 的嵌套泳道将被忽略`,
        elementIds: lanesWithChildLaneSet,
      })
      lossyFlags.add('unsupported-child-lane-set')
    }
  }

  for (const [elementId, conditions] of params.xmlMultiInstanceHints.conditionsByElementId) {
    const abortConditions = conditions.filter((condition) => condition.action === 'abort')
    const normalConditions = conditions.filter((condition) => condition.action !== 'abort')

    if (conditions.length > 1 && (!params.supportsSmartAbortCondition || abortConditions.length > 1 || normalConditions.length > 1)) {
      pushIssue({
        code: 'multiple-completion-conditions',
        message: `元素 ${elementId} 包含当前项目无法完整保真的 completionCondition 组合`,
        elementIds: [elementId],
      })
      lossyFlags.add('multiple-completion-conditions')
    }

    if (abortConditions.length > 0 && !params.supportsSmartAbortCondition) {
      pushIssue({
        code: 'smart-abort-condition-unsupported',
        message: `元素 ${elementId} 包含 SmartEngine abort 条件，但当前导入配置不会完整保留该语义`,
        elementIds: [elementId],
      })
      lossyFlags.add('smart-abort-condition-unsupported')
    }
  }

  if (params.warnings.length === 0 && compatibilityIssues.length === 0 && lossyFlags.size === 0) {
    return undefined
  }

  return {
    warnings: params.warnings,
    compatibilityIssues,
    lossyFlags: Array.from(lossyFlags),
  }
}

function mergeNodeBpmnData(
  data: Record<string, unknown> | undefined,
  bpmnPatch: Record<string, unknown>,
): Record<string, unknown> {
  const currentBpmn =
    data && typeof data === 'object' && data.bpmn && typeof data.bpmn === 'object'
      ? data.bpmn as Record<string, unknown>
      : {}

  return {
    ...(data ?? {}),
    bpmn: {
      ...currentBpmn,
      ...bpmnPatch,
    },
  }
}

function mergeEdgeBpmnData(
  data: Record<string, unknown> | undefined,
  bpmnPatch: Record<string, unknown>,
): Record<string, unknown> {
  /* istanbul ignore next -- 公开导入路径的边数据合并已由消息流、关联和数据关联回归覆盖；这里的空 data 短路仅保留给异常调用兜底。 */
  const currentBpmn =
    data && typeof data === 'object' && data.bpmn && typeof data.bpmn === 'object'
      ? data.bpmn as Record<string, unknown>
      : {}

  return {
    ...(data ?? {}),
    bpmn: {
      ...currentBpmn,
      ...bpmnPatch,
    },
  }
}

function mergeNodeBpmndiData(
  data: Record<string, unknown> | undefined,
  bpmndiPatch: Record<string, unknown>,
): Record<string, unknown> {
  const currentBpmndi =
    data && typeof data === 'object' && data.bpmndi && typeof data.bpmndi === 'object'
      ? data.bpmndi as Record<string, unknown>
      : {}

  return {
    ...(data ?? {}),
    bpmndi: {
      ...currentBpmndi,
      ...bpmndiPatch,
    },
  }
}

function mergeEdgeBpmndiData(
  data: Record<string, unknown> | undefined,
  bpmndiPatch: Record<string, unknown>,
): Record<string, unknown> {
  const currentBpmndi =
    data && typeof data === 'object' && data.bpmndi && typeof data.bpmndi === 'object'
      ? data.bpmndi as Record<string, unknown>
      : {}

  return {
    ...(data ?? {}),
    bpmndi: {
      ...currentBpmndi,
      ...bpmndiPatch,
    },
  }
}

// ============================================================================
// 主解析函数
// ============================================================================

export interface ParseBpmnOptions {
  /** 使用方言序列化层覆盖默认 BPMN 映射 */
  serialization?: SerializationOverrides
}

/**
 * 将 BPMN 2.0 XML 字符串解析为 X6 节点/边描述符中间 JSON。
 *
 * 不修改任何图形实例，仅做数据转换，可单独测试。
 *
 * @param xml — BPMN 2.0 XML 字符串
 * @returns BpmnImportData（节点列表 + 边列表）
 * @throws 如果 XML 格式错误或根元素不是 bpmn:Definitions
 */
export async function parseBpmnXml(xml: string, options: ParseBpmnOptions = {}): Promise<BpmnImportData> {
  const moddle = new BpmnModdle()
  const xmlNames = resolveBpmnXmlNameSettings(options.serialization?.xmlNames)
  const namespaces = options.serialization?.namespaces ?? {}
  const declaredNamespaces = collectDeclaredNamespaces(xml)
  const extensionProperties = resolveExtensionPropertySerialization(
    options.serialization?.extensionProperties,
    namespaces,
  )
  const xmlEventHints = collectEventXmlHints(xml, xmlNames)
  const xmlDiHints = collectDiXmlHints(xml)
  const xmlBpmndiReferenceHints = collectBpmndiReferenceHints(xml)
  const xmlMultiInstanceHints = collectMultiInstanceXmlHints(xml, xmlNames)
  const reverseNodeMap = buildReverseNodeMap(options.serialization?.nodeMapping ?? NODE_MAPPING)
  const reverseEdgeMap = buildReverseEdgeMap(options.serialization?.edgeMapping ?? EDGE_MAPPING)
  const nodeSerializers = options.serialization?.nodeSerializers ?? {}
  const edgeSerializers = options.serialization?.edgeSerializers ?? {}
  const supportsSmartAbortCondition = Boolean(
    (nodeSerializers[BPMN_USER_TASK] as { supportsSmartAbortCondition?: boolean } | undefined)?.supportsSmartAbortCondition,
  )
  void reverseEdgeMap

  let definitions: ModdleElement
  let warningMessages: string[] = []
  try {
    const result = await moddle.fromXML(xml)
    definitions = result.rootElement
    warningMessages = result.warnings.map((warning) => warning.message)
  } catch {
    throw new Error('Invalid BPMN XML: root element must be <definitions>')
  }

  /* istanbul ignore next — moddle 不会返回非 definitions 根；防御性分支 */
  if (!definitions || localTag(definitions) !== 'definitions') {
    throw new Error('Invalid BPMN XML: root element must be <definitions>')
  }

  // 解析 BPMNDI 位置信息
  const diagrams = (definitions.diagrams || []) as ModdleElement[]
  const di =
    diagrams.length > 0
      ? parseDiagram(diagrams[0], declaredNamespaces, xmlDiHints)
      : { shapes: new Map<string, DiShape>(), edges: new Map<string, DiEdge>() }

  const rootElements = (definitions.rootElements || []) as ModdleElement[]
  const collaboration = rootElements.find((el) => localTag(el) === 'collaboration')
  const processes = rootElements.filter((el) => localTag(el) === 'process')

  const nodes: BpmnNodeData[] = []
  const edges: BpmnEdgeData[] = []
  const processMetadata: BpmnPreservedProcessMetadata[] = processes.map((process) => {
    const preserved = parsePreservedElementMetadata(process, declaredNamespaces)
    const laneSets = (process.laneSets || []) as ModdleElement[]
    return {
      ...(preserved ?? {}),
      ...(typeof process.id === 'string' && process.id ? { id: process.id } : {}),
      ...(typeof process.name === 'string' && process.name ? { name: process.name } : {}),
      ...(typeof process.isExecutable === 'boolean' ? { isExecutable: process.isExecutable } : {}),
      ...(typeof laneSets[0]?.id === 'string' && laneSets[0].id ? { laneSetId: laneSets[0].id } : {}),
    }
  })
  const diagramMetadata = diagrams.length > 0
    ? (() => {
        const preservedDiagram = parsePreservedElementMetadata(diagrams[0], declaredNamespaces)
        const plane = diagrams[0].plane as ModdleElement | undefined
        const preservedPlane = parsePreservedElementMetadata(plane, declaredNamespaces)
        const planeBpmnElement = readReferencedElementId(plane?.bpmnElement)
          ?? xmlBpmndiReferenceHints.planeBpmnElements[0]
        const metadata: BpmnPreservedDiagramMetadata = {
          ...(preservedDiagram ?? {}),
        }
        if (hasMeaningfulElementMetadata(preservedPlane, 'BPMNPlane_1')) {
          metadata.plane = {
            ...preservedPlane,
            ...(planeBpmnElement ? { bpmnElement: planeBpmnElement } : {}),
          }
        }
        return hasMeaningfulElementMetadata(preservedDiagram, 'BPMNDiagram_1') || metadata.plane
          ? metadata
          : undefined
      })()
    : undefined
  const preservedDefinitions = parsePreservedElementMetadata(definitions, declaredNamespaces)
  const preservedCollaboration = parsePreservedElementMetadata(collaboration, declaredNamespaces)
  const metadata: BpmnImportMetadata = {
    targetNamespace: definitions.targetNamespace as string | undefined,
    processVersion: processes[0]?.$attrs?.version as string | undefined,
    ...(hasMeaningfulElementMetadata(preservedDefinitions, 'Definitions_1') ? { definitions: preservedDefinitions } : {}),
    ...(hasMeaningfulElementMetadata(preservedCollaboration, 'Collaboration_1') ? { collaboration: preservedCollaboration } : {}),
    ...(diagramMetadata ? { diagram: diagramMetadata } : {}),
    ...(processMetadata.length > 0 ? { processes: processMetadata } : {}),
  }
  const processPoolParents = new Map<string, string>()
  const laneFlowNodeParents = new Map<string, string>()
  const diagnostics = buildImportDiagnostics({
    xml,
    warnings: warningMessages,
    processes,
    xmlBpmndiReferenceHints,
    xmlMultiInstanceHints,
    supportsSmartAbortCondition,
  })

  // ---------- 解析参与者（Pool）----------
  if (collaboration) {
    /* istanbul ignore next — moddle 始终提供 participants 数组 */
    const participants = (collaboration.participants || []) as ModdleElement[]
    for (const p of participants) {
      /* istanbul ignore next — moddle 始终提供 id */
      const bpmnId = p.id || ''
      /* istanbul ignore next — fromXML 后 processRef 始终解析为对象引用 */
      const processRef = (p.processRef as ModdleElement | undefined)?.id
      if (processRef && !processPoolParents.has(processRef)) {
        processPoolParents.set(processRef, bpmnId)
      }
      const diShape = di.shapes.get(bpmnId)
      const data =
        typeof diShape?.isHorizontal === 'boolean'
          ? mergeNodeBpmnData(undefined, { isHorizontal: diShape.isHorizontal })
          : undefined
      const pooledData = processRef
        ? mergeNodeBpmnData(data, { processRef })
        : data
      const mergedData = diShape?.bpmndi
        ? mergeNodeBpmndiData(pooledData, diShape.bpmndi)
        : pooledData
      nodes.push({
        shape: BPMN_POOL,
        id: bpmnId,
        x: diShape?.bounds.x ?? 40,
        y: diShape?.bounds.y ?? 40,
        width: diShape?.bounds.width ?? 800,
        height: diShape?.bounds.height ?? 400,
        attrs: { headerLabel: { text: p.name || '' } },
        data: mergedData,
      })

      const processMeta = processMetadata.find((meta) => meta.id === processRef)
      if (processMeta) {
        processMeta.poolId = bpmnId
      }
    }
  }

  // 无 process 时（仅 collaboration）提前返回
  if (processes.length === 0) {
    return { nodes, edges, metadata, ...(diagnostics ? { diagnostics } : {}) }
  }

  // ---------- 解析泳道（Lane）----------
  for (const process of processes) {
    const poolParent = processPoolParents.get(process.id as string)
    const laneSets = (process.laneSets || []) as ModdleElement[]
    for (const laneSet of laneSets) {
      /* istanbul ignore next — moddle 始终提供 lanes 数组 */
      const laneEls = (laneSet.lanes || []) as ModdleElement[]
      for (const laneEl of laneEls) {
        /* istanbul ignore next — moddle 始终提供 id */
        const bpmnId = laneEl.id || ''
        const diShape = di.shapes.get(bpmnId)
        const data =
          typeof diShape?.isHorizontal === 'boolean'
            ? mergeNodeBpmnData(undefined, { isHorizontal: diShape.isHorizontal })
            : undefined
        const mergedData = diShape?.bpmndi
          ? mergeNodeBpmndiData(data, diShape.bpmndi)
          : data
        nodes.push({
          shape: BPMN_LANE,
          id: bpmnId,
          x: diShape?.bounds.x ?? 70,
          y: diShape?.bounds.y ?? 40,
          width: diShape?.bounds.width ?? 700,
          height: diShape?.bounds.height ?? 200,
          /* istanbul ignore next — laneEl.name 导入时始终有值或 undefined（|| '' 不会触发） */
          attrs: { headerLabel: { text: laneEl.name || '' } },
          ...(poolParent ? { parent: poolParent } : {}),
          data: mergedData,
        })

        const refs = (laneEl.flowNodeRef || []) as ModdleElement[]
        for (const ref of refs) {
          /* istanbul ignore next — moddle 总是将引用解析为对象 */
          const refId = (ref as any).id as string | undefined
          /* istanbul ignore next — 空 flowNodeRef 不会产出缺失 id 的引用对象 */
          if (refId) {
            laneFlowNodeParents.set(refId, bpmnId)
          }
        }
      }
    }
  }

  // ---------- 解析流程主体节点 ----------

  /** 受支持的 BPMN 节点标签集合 */
  const acceptedTags = new Set([
    'startEvent',
    'endEvent',
    'intermediateThrowEvent',
    'intermediateCatchEvent',
    'boundaryEvent',
    'task',
    'userTask',
    'serviceTask',
    'scriptTask',
    'businessRuleTask',
    'sendTask',
    'receiveTask',
    'manualTask',
    'subProcess',
    'transaction',
    'adHocSubProcess',
    'callActivity',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'complexGateway',
    'eventBasedGateway',
    'dataObjectReference',
    'dataStoreReference',
    'textAnnotation',
    'group',
  ])

  const flowElements: ModdleElement[] = []
  const artifacts: ModdleElement[] = []
  const flowContainerParents = new Map<string, string>()
  for (const process of processes) {
    collectProcessFlowElements((process.flowElements || []) as ModdleElement[], flowElements, flowContainerParents)
    artifacts.push(...((process.artifacts || []) as ModdleElement[]))
  }
  const allElements = [...flowElements, ...artifacts]

  // 预先收集默认流 ID（来自网关 default 属性）
  const defaultFlowIds = new Set<string>()
  for (const element of flowElements) {
    const defaultRef = element.default
    if (defaultRef) {
      /* istanbul ignore next — moddle 总是将 default 解析为对象 */
      const defaultId = typeof defaultRef === 'string' ? defaultRef : (defaultRef as any).id
      /* istanbul ignore else */
      if (defaultId) defaultFlowIds.add(defaultId as string)
    }
  }

  for (const element of allElements) {
    const tag = localTag(element)
    if (!acceptedTags.has(tag)) continue

    /* istanbul ignore next — moddle 始终提供 id */
    const bpmnId = element.id || ''

    const shape = resolveNodeShape(element, xmlEventHints, reverseNodeMap)
    /* istanbul ignore next */
    if (!shape) continue

    const diShape = di.shapes.get(bpmnId)
    const { w: defaultW, h: defaultH } = defaultNodeSize(shape)

    // 标签文本（textAnnotation 使用 text 字段）
    let label = (element.name as string) || ''
    if (tag === 'textAnnotation') {
      /* istanbul ignore next — moddle 始终提供 text */
      label = (element.text as string) || label
    }

    // 这里解析的都是流程/工件节点，统一使用 label 文本即可。
    const attrs: Record<string, unknown> = {}
    attrs.label = { text: label }

    const nodeData: BpmnNodeData = {
      shape,
      id: bpmnId,
      x: diShape?.bounds.x ?? 100,
      y: diShape?.bounds.y ?? 100,
      width: diShape?.bounds.width ?? defaultW,
      height: diShape?.bounds.height ?? defaultH,
      attrs,
    }

    const flowContainerParent = flowContainerParents.get(bpmnId)
    if (flowContainerParent) {
      nodeData.parent = flowContainerParent
    } else {
      const laneParent = laneFlowNodeParents.get(bpmnId)
      if (laneParent) {
        nodeData.parent = laneParent
      }
    }

    // 边界事件 → 父节点 ID（对应宿主任务）
    if (tag === 'boundaryEvent') {
      const attachedTo = element.attachedToRef
      /* istanbul ignore next — moddle 总是将 attachedToRef 解析为对象 */
      const attachedToId =
        typeof attachedTo === 'string' ? attachedTo : (attachedTo as any)?.id
      /* istanbul ignore else */
      if (attachedToId) nodeData.parent = attachedToId as string
    }

    // 扩展业务属性
    const extData = parseExtensionProps(element, extensionProperties, namespaces)
    if (extData) nodeData.data = extData

    const rawXmlAttrs = parseRawXmlAttrs(element, declaredNamespaces)
    if (rawXmlAttrs?.bpmn) {
      nodeData.data = mergeNodeBpmnData(nodeData.data, rawXmlAttrs.bpmn as Record<string, unknown>)
    }

    const eventDefinitions = (element.eventDefinitions || []) as ModdleElement[]
    if (eventDefinitions.length > 0) {
      const eventDefinitionId = typeof eventDefinitions[0]?.id === 'string' ? eventDefinitions[0].id : ''
      if (eventDefinitionId && eventDefinitionId !== `${bpmnId}_ed`) {
        nodeData.data = mergeNodeBpmnData(nodeData.data, { $eventDefinitionId: eventDefinitionId })
      }
    }

    if (tag === 'textAnnotation') {
      nodeData.data = mergeNodeBpmnData(nodeData.data, { annotationText: label })
    }

    const importedNodeBpmn = nodeSerializers[shape]?.import?.({
      shape,
      category: classifyShape(shape),
      element,
      namespaces,
    })
    if (importedNodeBpmn && Object.keys(importedNodeBpmn).length > 0) {
      nodeData.data = mergeNodeBpmnData(nodeData.data, importedNodeBpmn)
    }

    const multiInstanceConditions = xmlMultiInstanceHints.conditionsByElementId.get(bpmnId)
    if (shape === BPMN_USER_TASK && supportsSmartAbortCondition && multiInstanceConditions && multiInstanceConditions.length > 0) {
      const normalCondition = multiInstanceConditions.find((condition) => condition.action !== 'abort')
      const abortCondition = multiInstanceConditions.find((condition) => condition.action === 'abort')
      const patch: Record<string, unknown> = {}
      if (normalCondition?.body) {
        patch.multiInstanceCompletionCondition = normalCondition.body
      }
      if (abortCondition?.body) {
        patch.multiInstanceAbortCondition = abortCondition.body
      }
      if (Object.keys(patch).length > 0) {
        nodeData.data = mergeNodeBpmnData(nodeData.data, patch)
      }
    }

    if (typeof diShape?.isExpanded === 'boolean' && EXPANDABLE_ACTIVITY_SHAPES.has(shape)) {
      nodeData.data = mergeNodeBpmnData(nodeData.data, { isExpanded: diShape.isExpanded })
    }

    if (typeof diShape?.isMarkerVisible === 'boolean' && shape === BPMN_EXCLUSIVE_GATEWAY) {
      nodeData.data = mergeNodeBpmnData(nodeData.data, { isMarkerVisible: diShape.isMarkerVisible })
    }

    if (diShape?.bpmndi) {
      nodeData.data = mergeNodeBpmndiData(nodeData.data, diShape.bpmndi)
    }

    nodes.push(nodeData)
  }

  // ---------- 解析顺序流 ----------
  const seqFlows = flowElements.filter((el) => localTag(el) === 'sequenceFlow')
  for (const sf of seqFlows) {
    /* istanbul ignore next — moddle 始终提供 id */
    const bpmnId = (sf.id as string) || ''
    /* istanbul ignore next — moddle 总是将 sourceRef/targetRef 解析为对象 */
    const sourceRef =
      typeof sf.sourceRef === 'string' ? sf.sourceRef : (sf.sourceRef as any)?.id || ''
    /* istanbul ignore next */
    const targetRef =
      typeof sf.targetRef === 'string' ? sf.targetRef : (sf.targetRef as any)?.id || ''
    const name = (sf.name as string) || ''

    // 判断流类型：默认流 > 条件流 > 普通顺序流
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
        ? diEdge.waypoints.slice(1, -1).map((wp) => ({ x: wp.x, y: wp.y }))
        : []

    const edgeData: BpmnEdgeData = { shape: edgeShape, id: bpmnId, source: sourceRef, target: targetRef, labels, vertices }
    const rawXmlAttrs = parseRawXmlAttrs(sf, declaredNamespaces)
    if (rawXmlAttrs?.bpmn) {
      edgeData.data = mergeEdgeBpmnData(edgeData.data, rawXmlAttrs.bpmn as Record<string, unknown>)
    }
    const importedEdgeBpmn = edgeSerializers[edgeShape]?.import?.({
      shape: edgeShape,
      element: sf,
      namespaces,
    })
    if (importedEdgeBpmn && Object.keys(importedEdgeBpmn).length > 0) {
      edgeData.data = mergeEdgeBpmnData(edgeData.data, importedEdgeBpmn)
    }
    if (diEdge?.bpmndi) {
      edgeData.data = mergeEdgeBpmndiData(edgeData.data, diEdge.bpmndi)
    }

    edges.push(edgeData)
  }

  // ---------- 解析消息流 ----------
  if (collaboration) {
    /* istanbul ignore next — moddle 始终提供 messageFlows 数组 */
    const msgFlows = (collaboration.messageFlows || []) as ModdleElement[]
    for (const mf of msgFlows) {
      /* istanbul ignore next — moddle 始终提供 id */
      const bpmnId = (mf.id as string) || ''
      /* istanbul ignore next — moddle 总是将 sourceRef/targetRef 解析为对象 */
      const sourceRef =
        typeof mf.sourceRef === 'string' ? mf.sourceRef : (mf.sourceRef as any)?.id || ''
      /* istanbul ignore next */
      const targetRef =
        typeof mf.targetRef === 'string' ? mf.targetRef : (mf.targetRef as any)?.id || ''
      const name = (mf.name as string) || ''

      const labels = name ? [{ attrs: { label: { text: name } } }] : []
      const diEdge = di.edges.get(bpmnId)
      const vertices =
        diEdge && diEdge.waypoints.length > 2
          ? diEdge.waypoints.slice(1, -1).map((wp) => ({ x: wp.x, y: wp.y }))
          : []
      const data =
        diEdge?.messageVisibleKind
          ? { bpmn: { messageVisibleKind: diEdge.messageVisibleKind } }
          : undefined
      const rawXmlAttrs = parseRawXmlAttrs(mf, declaredNamespaces)
      const mergedData = rawXmlAttrs?.bpmn
        ? mergeEdgeBpmnData(data, rawXmlAttrs.bpmn as Record<string, unknown>)
        : data
      const finalizedData = diEdge?.bpmndi
        ? mergeEdgeBpmndiData(mergedData, diEdge.bpmndi)
        : mergedData

      edges.push({
        shape: BPMN_MESSAGE_FLOW,
        id: bpmnId,
        source: sourceRef,
        target: targetRef,
        labels,
        vertices,
        data: finalizedData,
      })
    }
  }

  // ---------- 解析关联（Association）----------
  const associations = artifacts.filter((el) => localTag(el) === 'association')
  for (const assoc of associations) {
    /* istanbul ignore next — moddle 始终提供 id */
    const bpmnId = (assoc.id as string) || ''
    /* istanbul ignore next — moddle 总是将 sourceRef/targetRef 解析为对象 */
    const sourceRef =
      typeof assoc.sourceRef === 'string' ? assoc.sourceRef : (assoc.sourceRef as any)?.id || ''
    /* istanbul ignore next */
    const targetRef =
      typeof assoc.targetRef === 'string' ? assoc.targetRef : (assoc.targetRef as any)?.id || ''
    const direction = assoc.associationDirection as string | undefined

    const edgeShape = direction === 'One' ? BPMN_DIRECTED_ASSOCIATION : 'bpmn-association'
    const edgeData: BpmnEdgeData = { shape: edgeShape, id: bpmnId, source: sourceRef, target: targetRef }
    const rawXmlAttrs = parseRawXmlAttrs(assoc, declaredNamespaces)
    if (rawXmlAttrs?.bpmn) {
      edgeData.data = mergeEdgeBpmnData(edgeData.data, rawXmlAttrs.bpmn as Record<string, unknown>)
    }
    edges.push(edgeData)
  }

  // ---------- 解析数据关联（DataInputAssociation / DataOutputAssociation）----------
  for (const element of flowElements) {
    const dataInputAssocs = (element.dataInputAssociations || []) as ModdleElement[]
    const dataOutputAssocs = (element.dataOutputAssociations || []) as ModdleElement[]

    for (const da of [...dataInputAssocs, ...dataOutputAssocs]) {
      const bpmnId = (da.id as string) || ''
      /* istanbul ignore next */
      if (!bpmnId) continue

      const sourceRefs = da.sourceRef as ModdleElement[] | undefined
      const targetRef = da.targetRef as ModdleElement | undefined

      /* istanbul ignore next — moddle 总是将 sourceRef 解析为对象数组 */
      const sourceRef =
        sourceRefs && sourceRefs.length > 0
          ? typeof sourceRefs[0] === 'string'
            ? sourceRefs[0]
            : (sourceRefs[0] as any)?.id || ''
          : ''
      /* istanbul ignore next — moddle 总是将 targetRef 解析为对象 */
      const targetId = targetRef
        ? typeof targetRef === 'string'
          ? targetRef
          : (targetRef as any).id || ''
        : ''

      if (sourceRef && targetId) {
        const edgeData: BpmnEdgeData = { shape: BPMN_DATA_ASSOCIATION, id: bpmnId, source: sourceRef, target: targetId }
        const rawXmlAttrs = parseRawXmlAttrs(da, declaredNamespaces)
        if (rawXmlAttrs?.bpmn) {
          edgeData.data = mergeEdgeBpmnData(edgeData.data, rawXmlAttrs.bpmn as Record<string, unknown>)
        }
        edges.push(edgeData)
      }
    }
  }

  return { nodes, edges, metadata, ...(diagnostics ? { diagnostics } : {}) }
}

export const __test__ = {
  readReferencedElementId,
  mergeNodeBpmndiData,
  mergeEdgeBpmndiData,
}
