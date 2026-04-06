/**
 * X6 图形加载器
 *
 * 将 BpmnImportData（中间 JSON 描述符）加载到 X6 Graph 实例。
 * 与 xml-parser.ts 配合构成两步导入流程：
 *
 *   parseBpmnXml(xml)  →  BpmnImportData  →  loadBpmnGraph(graph, data)
 *
 * 本模块只负责将已解析好的数据写入图形，不做任何 XML 解析。
 */

import type { Edge, Graph } from '@antv/x6'
import type { BpmnImportData } from './types'
import {
  BPMN_COLORS,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_LANE,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
} from '../utils/constants'
import { buildSwimlaneAttrs, resolveSwimlaneIsHorizontal } from '../shapes/swimlane-presentation'

const EXPANDABLE_ACTIVITY_SHAPES = new Set([
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
])

function resolveActivityIsExpanded(data: unknown): boolean | undefined {
  const bpmn =
    data && typeof data === 'object'
      ? (data as { bpmn?: { isExpanded?: unknown } }).bpmn
      : undefined

  return typeof bpmn?.isExpanded === 'boolean' ? bpmn.isExpanded : undefined
}

function resolveGatewayMarkerVisible(data: unknown): boolean | undefined {
  const bpmn =
    data && typeof data === 'object'
      ? (data as { bpmn?: { isMarkerVisible?: unknown } }).bpmn
      : undefined

  return typeof bpmn?.isMarkerVisible === 'boolean' ? bpmn.isMarkerVisible : undefined
}

function resolveMessageVisibleKind(data: unknown): 'initiating' | 'non_initiating' | undefined {
  const bpmn =
    data && typeof data === 'object'
      ? (data as { bpmn?: { messageVisibleKind?: unknown } }).bpmn
      : undefined

  return bpmn?.messageVisibleKind === 'initiating' || bpmn?.messageVisibleKind === 'non_initiating'
    ? bpmn.messageVisibleKind
    : undefined
}

function isMessageDecoratorLabel(label: unknown): boolean {
  const markup =
    label && typeof label === 'object'
      ? (label as { markup?: Array<{ selector?: string }> }).markup
      : undefined

  return Array.isArray(markup)
    && markup.some((item) => item?.selector === 'messageEnvelopeGlyph')
}

function createMessageDecoratorLabel(messageVisibleKind: 'initiating' | 'non_initiating') {
  return {
    position: 0.5,
    markup: [
      { tagName: 'text', selector: 'messageEnvelopeGlyph' },
    ],
    attrs: {
      messageEnvelopeGlyph: {
        text: '✉',
        fill: messageVisibleKind === 'non_initiating' ? BPMN_COLORS.messageFlow : '#fff',
        stroke: BPMN_COLORS.messageFlow,
        strokeWidth: 1,
        fontSize: 16,
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      },
    },
  }
}

function applyMessageFlowDecorator(edge: Edge): void {
  const messageVisibleKind = resolveMessageVisibleKind(edge.getData())
  const labels = edge.getLabels().filter((label) => !isMessageDecoratorLabel(label))

  if (!messageVisibleKind) {
    if (labels.length !== edge.getLabels().length) edge.setLabels(labels)
    return
  }

  edge.setLabels([...labels, createMessageDecoratorLabel(messageVisibleKind)])
}

// ============================================================================
// 配置类型
// ============================================================================

/** loadBpmnGraph 的可选配置项 */
export interface LoadBpmnOptions {
  /** 加载前是否清空已有图形，默认 true */
  clearGraph?: boolean
  /** 加载后是否自动缩放适应，默认 true */
  zoomToFit?: boolean
}

// ============================================================================
// 主加载函数
// ============================================================================

/**
 * 将 BpmnImportData 加载到 X6 Graph。
 *
 * @param graph   — X6 图形实例
 * @param data    — parseBpmnXml() 解析出的中间数据
 * @param options — 可选配置
 */
export function loadBpmnGraph(
  graph: Graph,
  data: BpmnImportData,
  options: LoadBpmnOptions = {},
): void {
  const { clearGraph = true, zoomToFit = true } = options
  const embedRelations: Array<{ childId: string; parentId: string }> = []

  // 清空已有图形（可选）
  if (clearGraph) {
    if (typeof graph.resetCells === 'function') {
      graph.resetCells([])
    } else {
      graph.clearCells()
    }
  }

  // ---------- 加载节点 ----------
  for (const nodeData of data.nodes) {
    const nodeConfig: Record<string, unknown> = {
      shape: nodeData.shape,
      id: nodeData.id,
      x: nodeData.x,
      y: nodeData.y,
      width: nodeData.width,
      height: nodeData.height,
    }

    /* istanbul ignore else — xml-parser 始终提供 attrs 对象 */
    if (nodeData.attrs) nodeConfig.attrs = nodeData.attrs

    const node = graph.addNode(nodeConfig)

    if (nodeData.parent) {
      embedRelations.push({ childId: node.id, parentId: nodeData.parent })
    }

    // 恢复扩展业务数据（来自 BPMN extensionElements）
    if (nodeData.data) {
      node.setData({ ...(node.getData() || {}), ...nodeData.data }, { overwrite: true })
    }

    if (node.shape === BPMN_POOL || node.shape === BPMN_LANE) {
      const label = node.getAttrByPath('headerLabel/text')
      const isHorizontal = resolveSwimlaneIsHorizontal(node.getData())
      node.replaceAttrs(
        buildSwimlaneAttrs(
          node.shape,
          typeof label === 'string' ? label : undefined,
          isHorizontal,
        ),
      )
    } else if (EXPANDABLE_ACTIVITY_SHAPES.has(node.shape)) {
      const isExpanded = resolveActivityIsExpanded(node.getData())
      if (typeof isExpanded === 'boolean' && node.getAttrByPath('marker') !== undefined) {
        node.setAttrByPath('marker/display', isExpanded ? 'none' : 'block')
      }
    } else if (node.shape === BPMN_EXCLUSIVE_GATEWAY) {
      const isMarkerVisible = resolveGatewayMarkerVisible(node.getData())
      if (typeof isMarkerVisible === 'boolean') {
        node.setAttrByPath('marker/display', isMarkerVisible ? 'block' : 'none')
      }
    }
  }

  // ---------- 重建真实嵌套关系 ----------
  for (const relation of embedRelations) {
    const parent = graph.getCellById(relation.parentId)
    const child = graph.getCellById(relation.childId)

    if (!parent?.isNode?.() || !child?.isNode?.()) continue
    parent.embed(child)
  }

  // ---------- 加载边 ----------
  for (const edgeData of data.edges) {
    const edgeConfig: Record<string, unknown> = {
      shape: edgeData.shape,
      id: edgeData.id,
      source: edgeData.source,
      target: edgeData.target,
    }

    if (edgeData.labels && edgeData.labels.length > 0) edgeConfig.labels = edgeData.labels
    if (edgeData.vertices && edgeData.vertices.length > 0) edgeConfig.vertices = edgeData.vertices

    const edge = graph.addEdge(edgeConfig)

    if (edgeData.data) {
      edge.setData({ ...(edge.getData() || {}), ...edgeData.data }, { overwrite: true })
    }

    if (edge.shape === BPMN_MESSAGE_FLOW) {
      applyMessageFlowDecorator(edge)
    }
  }

  // ---------- 自动缩放适应（可选）----------
  if (zoomToFit) {
    setTimeout(() => {
      try {
        graph.zoomToFit({ padding: 40, maxScale: 1 })
      } catch {
        // zoomToFit 依赖 SVG getCTM，在 jsdom 等测试环境中不可用，静默跳过
      }
    }, 100)
  }
}
