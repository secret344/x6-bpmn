/**
 * 图级校验器
 *
 * 将主库现有的约束规则、连线规则、字段能力、容器约束、
 * 边界事件附着规则和 XML 导出检查聚合为一个可复用的整图校验入口。
 * 宿主只负责触发和展示结果，不需要在示例项目中重复实现规则逻辑。
 */

import type { Cell, Edge, Graph, Node } from '@antv/x6'
import { exportBpmnXml } from '../../export/exporter'
import { getCellLabel, loadBpmnFormData, classifyShape } from '../../config'
import { isBoundaryShape } from '../../export/bpmn-mapping'
import { validatePoolContainment } from '../../behaviors/pool-containment'
import { defaultIsValidHostForBoundary } from '../../behaviors/boundary-attach'
import {
  validateConnectionWithContext,
  validateConstraints,
} from '../rules'
import { getFieldsForShape, validateFields } from '../data-model'
import { getProfileContext, createProfileContext } from '../dialect/context'
import { ProfileRegistry } from '../dialect/registry'
import type { ProfileContext } from '../dialect/types'
import { bpmn2Profile } from '../../builtin/bpmn2/profile'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_SEQUENCE_FLOW,
} from '../../utils/constants'

export type ValidationIssueCategory =
  | 'graph-constraint'
  | 'edge-rule'
  | 'field'
  | 'containment'
  | 'boundary'
  | 'export'

export interface ValidationIssue {
  category: ValidationIssueCategory
  message: string
  detail?: string
  cellId?: string
  cellShape?: string
  cellLabel?: string
}

export interface DiagramValidationReport {
  issues: ValidationIssue[]
  nodeCount: number
  edgeCount: number
  xmlExported: boolean
  profileId: string
}

export interface DiagramValidationOptions {
  processName?: string
  exportXml?: (graph: Graph) => Promise<string>
}

const SEQUENCE_FLOW_SHAPES = new Set([
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
])

let fallbackBpmn2Context: ProfileContext | null = null

function getFallbackBpmn2Context(): ProfileContext {
  if (fallbackBpmn2Context) {
    return fallbackBpmn2Context
  }

  const registry = new ProfileRegistry()
  registry.register(bpmn2Profile)
  fallbackBpmn2Context = createProfileContext(registry.compile('bpmn2'))
  return fallbackBpmn2Context
}

function resolveValidationContext(graph: Graph): ProfileContext {
  return getProfileContext(graph) ?? getFallbackBpmn2Context()
}

export async function validateDiagram(
  graph: Graph,
  options: DiagramValidationOptions = {},
): Promise<DiagramValidationReport> {
  const context = resolveValidationContext(graph)
  const nodes = graph.getNodes()
  const edges = graph.getEdges()
  const issues: ValidationIssue[] = []

  issues.push(...validateGraphConstraints(nodes, edges, context))
  issues.push(...validateEdgeRules(graph, edges, context))
  issues.push(...validateCellFields(nodes, context))
  issues.push(...validateCellFields(edges, context))
  issues.push(...validateContainment(graph, nodes))
  issues.push(...validateBoundaryAttachments(nodes))

  const xmlExportIssue = await validateXmlExport(graph, options)
  if (xmlExportIssue) {
    issues.push(xmlExportIssue)
  }

  return {
    issues,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    xmlExported: !xmlExportIssue,
    profileId: context.profile.meta.id,
  }
}

function validateGraphConstraints(
  nodes: Node[],
  edges: Edge[],
  context: ProfileContext,
): ValidationIssue[] {
  const nodeShapes = nodes.map((node) => node.shape)
  const edgeShapes = edges.map((edge) => edge.shape)
  const nodeCounts = buildNodeCounts(nodeShapes)

  return validateConstraints(context.profile.rules.constraints, {
    profileId: context.profile.meta.id,
    nodeShapes,
    edgeShapes,
    nodeCounts,
  }).map((failure) => ({
    category: 'graph-constraint',
    message: failure.reason,
    detail: `规则 ID: ${failure.ruleId}`,
  }))
}

function buildNodeCounts(nodeShapes: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const shape of nodeShapes) {
    counts[shape] = (counts[shape] ?? 0) + 1
  }
  return counts
}

function validateEdgeRules(
  graph: Graph,
  edges: Edge[],
  context: ProfileContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const edge of edges) {
    const source = resolveEdgeTerminalNode(graph, edge, 'source')
    const target = resolveEdgeTerminalNode(graph, edge, 'target')

    if (!source || !target) {
      issues.push({
        category: 'edge-rule',
        message: '连线缺少有效的源节点或目标节点',
        detail: `edge: ${edge.id}`,
        cellId: edge.id,
        cellShape: edge.shape,
        cellLabel: getCellLabel(edge),
      })
      continue
    }

    const result = validateConnectionWithContext({
      sourceShape: source.shape,
      targetShape: target.shape,
      edgeShape: edge.shape,
      sourceOutgoingCount: countConnectedEdges(graph, source, 'outgoing', edge),
      targetIncomingCount: countConnectedEdges(graph, target, 'incoming', edge),
      sourceOutgoingSequenceFlowCount: countSequenceFlowEdges(graph, source, 'outgoing', edge),
      targetIncomingSequenceFlowCount: countSequenceFlowEdges(graph, target, 'incoming', edge),
      sourceData: readCellData(source),
      targetData: readCellData(target),
      sourcePoolId: findPoolId(source),
      targetPoolId: findPoolId(target),
    }, context)

    if (!result.valid) {
      issues.push({
        category: 'edge-rule',
        message: result.reason || '连线不符合规则要求',
        detail: `${getCellLabel(source)} -> ${getCellLabel(target)}`,
        cellId: edge.id,
        cellShape: edge.shape,
        cellLabel: getCellLabel(edge),
      })
    }
  }

  return issues
}

function resolveEdgeTerminalNode(
  graph: Graph,
  edge: Edge,
  terminal: 'source' | 'target',
): Node | null {
  const cellId = terminal === 'source'
    ? edge.getSourceCellId?.()
    : edge.getTargetCellId?.()

  if (!cellId) {
    return null
  }

  const cell = graph.getCellById(cellId)
  return cell?.isNode() ? (cell as Node) : null
}

function countConnectedEdges(
  graph: Graph,
  node: Node,
  direction: 'outgoing' | 'incoming',
  currentEdge: Edge,
): number {
  return graph
    .getConnectedEdges(node, { [direction]: true })
    .filter((edge) => edge.id !== currentEdge.id)
    .length
}

function countSequenceFlowEdges(
  graph: Graph,
  node: Node,
  direction: 'outgoing' | 'incoming',
  currentEdge: Edge,
): number {
  return graph
    .getConnectedEdges(node, { [direction]: true })
    .filter((edge) => edge.id !== currentEdge.id)
    .filter((edge) => SEQUENCE_FLOW_SHAPES.has(edge.shape))
    .length
}

function validateCellFields(
  cells: Array<Node | Edge>,
  context: ProfileContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const dataModel = context.profile.dataModel

  for (const cell of cells) {
    const category = classifyShape(cell.shape)
    const fields = getFieldsForShape(cell.shape, category, dataModel)
    if (fields.length === 0) {
      continue
    }

    const failures = validateFields(
      loadBpmnFormData(cell),
      fields,
      {
        shape: cell.shape,
        category,
        profileId: context.profile.meta.id,
        nodeData: readCellData(cell),
      },
      dataModel,
    )

    for (const failure of failures) {
      issues.push({
        category: 'field',
        message: `${failure.field}: ${failure.reason}`,
        cellId: cell.id,
        cellShape: cell.shape,
        cellLabel: getCellLabel(cell),
      })
    }
  }

  return issues
}

function validateContainment(graph: Graph, nodes: Node[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const node of nodes) {
    const result = validatePoolContainment(graph, node)
    if (!result.valid) {
      issues.push({
        category: 'containment',
        message: result.reason || '流程节点未处于合法容器内',
        cellId: node.id,
        cellShape: node.shape,
        cellLabel: getCellLabel(node),
      })
    }
  }

  return issues
}

function validateBoundaryAttachments(nodes: Node[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const node of nodes) {
    if (!isBoundaryShape(node.shape)) {
      continue
    }

    const parent = node.getParent?.() as Cell | null | undefined
    if (!parent || !parent.isNode?.()) {
      issues.push({
        category: 'boundary',
        message: '边界事件没有附着到宿主活动',
        cellId: node.id,
        cellShape: node.shape,
        cellLabel: getCellLabel(node),
      })
      continue
    }

    if (!defaultIsValidHostForBoundary(parent.shape, node.shape)) {
      issues.push({
        category: 'boundary',
        message: '边界事件附着到了不合法的宿主节点',
        detail: `宿主: ${getCellLabel(parent as Cell)} (${parent.shape})`,
        cellId: node.id,
        cellShape: node.shape,
        cellLabel: getCellLabel(node),
      })
    }
  }

  return issues
}

function readCellData(cell: Cell): Record<string, unknown> | undefined {
  try {
    const data = cell.getData?.()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function findPoolId(node: Node): string | undefined {
  let current = node.getParent?.() as Cell | null | undefined
  while (current) {
    if (current.shape === 'bpmn-pool') {
      return current.id
    }
    current = current.getParent?.() as Cell | null | undefined
  }
  return undefined
}

async function validateXmlExport(
  graph: Graph,
  options: DiagramValidationOptions,
): Promise<ValidationIssue | null> {
  try {
    if (options.exportXml) {
      await options.exportXml(graph)
    } else {
      await exportBpmnXml(graph, { processName: options.processName ?? 'BPMN流程' })
    }
    return null
  } catch (error) {
    return {
      category: 'export',
      message: '导出 BPMN XML 失败',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}