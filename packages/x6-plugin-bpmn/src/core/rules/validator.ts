/**
 * 核心规则层 — Context 驱动的连线验证
 *
 * 在原有 validateBpmnConnection 的基础上，
 * 增加 ProfileContext 驱动模式，使用 ResolvedProfile 中的规则集。
 */

import type { ProfileContext, ConstraintValidateContext } from '../dialect/types'
import type { BpmnNodeCategory, BpmnConnectionRule, BpmnValidationResult } from '../../rules/connection-rules'
import {
  validateConnectionAgainstRules,
  type BpmnConnectionContext,
} from '../../rules/validator'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_SEQUENCE_FLOW,
} from '../../utils/constants'

// ============================================================================
// Context 驱动的连线验证
// ============================================================================

/**
 * 使用 ProfileContext 中的规则验证连线是否合法。
 *
 * 与原 validateBpmnConnection 的差异：
 * - 使用 profile 中的 nodeCategories 而非全局 SHAPE_CATEGORY_MAP
 * - 使用 profile 中的 connectionRules 而非 DEFAULT_CONNECTION_RULES
 */
export function validateConnectionWithContext(
  context: BpmnConnectionContext,
  profileContext: ProfileContext,
): BpmnValidationResult {
  const { rules } = profileContext.profile

  return validateConnectionAgainstRules(
    context,
    rules.connectionRules as Record<BpmnNodeCategory, BpmnConnectionRule>,
    (shape: string) => (rules.nodeCategories[shape] || 'unknown') as BpmnNodeCategory,
  )
}

/**
 * 创建基于 ProfileContext 的 X6 validateConnection 回调。
 */
export function createContextValidateConnection(
  edgeShapeGetter: () => string,
  profileContext: ProfileContext,
): (args: any) => boolean {
  const validateWithResult = createContextValidateConnectionWithResult(edgeShapeGetter, profileContext)

  return (args: any): boolean => {
    return validateWithResult(args).valid
  }
}

export function createContextValidateConnectionWithResult(
  edgeShapeGetter: () => string,
  profileContext: ProfileContext,
): (args: any) => BpmnValidationResult {
  return (args: any): BpmnValidationResult => {
    try {
      const { sourceCell, targetCell, targetMagnet } = args

      if (!targetMagnet) return { valid: false, reason: '目标节点没有可用的连接桩' }

      const sourceNode = sourceCell as any
      const targetNode = targetCell as any
      if (!sourceNode || !targetNode) return { valid: false, reason: '源节点或目标节点不存在' }
      if (sourceNode.id === targetNode.id) return { valid: false, reason: '不允许自连接' }

      return validateRuntimeEdgeWithContext(
        sourceNode,
        targetNode,
        resolveEdgeShape(args.edge, edgeShapeGetter),
        profileContext,
        args.edge,
      )
    } catch (error) {
      return createValidationExceptionResult(error, '方言连线预校验执行异常')
    }
  }
}

export function createContextValidateEdge(
  edgeShapeGetter: () => string,
  profileContext: ProfileContext,
): (args: any) => boolean {
  const validateWithResult = createContextValidateEdgeWithResult(edgeShapeGetter, profileContext)
  return (args: any): boolean => validateWithResult(args).valid
}

export function createContextValidateEdgeWithResult(
  edgeShapeGetter: () => string,
  profileContext: ProfileContext,
): (args: any) => BpmnValidationResult {
  return (args: any): BpmnValidationResult => {
    try {
      const edge = args.edge ?? null
      if (!edge) return { valid: false, reason: '连线实例不存在' }

      const graph = getGraphFromCell(edge)
      if (!graph?.getCellById) {
        return { valid: false, reason: '无法定位连线所属图实例' }
      }

      const sourceCellId = edge.getSourceCellId?.()
      const targetCellId = edge.getTargetCellId?.()
      if (!sourceCellId || !targetCellId) {
        return { valid: false, reason: '连线必须连接到有效的源节点和目标节点' }
      }

      const sourceNode = graph.getCellById(sourceCellId)
      const targetNode = graph.getCellById(targetCellId)
      if (!sourceNode || !targetNode) {
        return { valid: false, reason: '无法解析连线的源节点或目标节点' }
      }

      if (sourceNode.id === targetNode.id) {
        return { valid: false, reason: '不允许自连接' }
      }

      return validateRuntimeEdgeWithContext(
        sourceNode,
        targetNode,
        resolveEdgeShape(edge, edgeShapeGetter),
        profileContext,
        edge,
      )
    } catch (error) {
      return createValidationExceptionResult(error, '方言连线终校验执行异常')
    }
  }
}

function validateRuntimeEdgeWithContext(
  sourceNode: any,
  targetNode: any,
  edgeShape: string,
  profileContext: ProfileContext,
  currentEdge?: any,
): BpmnValidationResult {
  return validateConnectionWithContext(
    {
      sourceShape: sourceNode.shape,
      targetShape: targetNode.shape,
      edgeShape,
      sourceOutgoingCount: countEdges(sourceNode, 'outgoing', currentEdge),
      targetIncomingCount: countEdges(targetNode, 'incoming', currentEdge),
      sourceOutgoingSequenceFlowCount: countSequenceFlowEdges(sourceNode, 'outgoing', currentEdge),
      targetIncomingSequenceFlowCount: countSequenceFlowEdges(targetNode, 'incoming', currentEdge),
      sourceData: readNodeData(sourceNode),
      targetData: readNodeData(targetNode),
      sourcePoolId: findPoolId(sourceNode),
      targetPoolId: findPoolId(targetNode),
    },
    profileContext,
  )
}

function resolveEdgeShape(edge: any, edgeShapeGetter: () => string): string {
  const shape = typeof edge?.getShape === 'function' ? edge.getShape() : edge?.shape
  return isRuntimeEdgeShape(shape) ? shape : edgeShapeGetter()
}

function isRuntimeEdgeShape(shape: unknown): shape is string {
  return typeof shape === 'string' && shape.length > 0 && shape !== 'edge'
}

function getGraphFromCell(cell: any): any {
  return cell?.model?.graph ?? cell?.graph
}

function isSameEdge(edge: any, currentEdge?: any): boolean {
  if (!currentEdge) return false
  return edge === currentEdge || (!!edge?.id && !!currentEdge?.id && edge.id === currentEdge.id)
}

function countEdges(node: any, direction: 'outgoing' | 'incoming', currentEdge?: any): number {
  try {
    const graph = getGraphFromCell(node)
    if (!graph) return 0
    return graph.getConnectedEdges(node, { [direction]: true }).filter((edge: any) => !isSameEdge(edge, currentEdge)).length
  } catch {
    return 0
  }
}

function countSequenceFlowEdges(node: any, direction: 'outgoing' | 'incoming', currentEdge?: any): number {
  try {
    const graph = getGraphFromCell(node)
    if (!graph) return 0
    return graph.getConnectedEdges(node, { [direction]: true })
      .filter((edge: any) => !isSameEdge(edge, currentEdge))
      .filter((edge: any) => isSequenceFlowShape(edge?.shape)).length
  } catch {
    return 0
  }
}

function isSequenceFlowShape(shape: unknown): boolean {
  return shape === BPMN_SEQUENCE_FLOW || shape === BPMN_CONDITIONAL_FLOW || shape === BPMN_DEFAULT_FLOW
}

function readNodeData(node: any): Record<string, any> | undefined {
  try {
    const data = node.getData?.()
    if (data && typeof data === 'object') return data as Record<string, any>
  } catch {
    return undefined
  }
  return undefined
}

function findPoolId(node: any): string | undefined {
  let current = node.getParent?.()
  while (current) {
    if (current.shape === 'bpmn-pool') return current.id as string
    current = current.getParent?.()
  }
  return undefined
}

function createValidationExceptionResult(error: unknown, message: string): BpmnValidationResult {
  const detail = error instanceof Error && error.message ? `：${error.message}` : ''
  return {
    valid: false,
    reason: `${message}${detail}`,
    kind: 'exception',
  }
}
