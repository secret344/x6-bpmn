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
  return (args: any): boolean => {
    const { sourceCell, targetCell, targetMagnet } = args

    if (!targetMagnet) return false

    const sourceNode = sourceCell as any
    const targetNode = targetCell as any
    if (!sourceNode || !targetNode) return false
    if (sourceNode.id === targetNode.id) return false

    const result = validateConnectionWithContext(
      {
        sourceShape: sourceNode.shape,
        targetShape: targetNode.shape,
        edgeShape: edgeShapeGetter(),
        sourceOutgoingCount: countEdges(sourceNode, 'outgoing'),
        targetIncomingCount: countEdges(targetNode, 'incoming'),
        sourceOutgoingSequenceFlowCount: countSequenceFlowEdges(sourceNode, 'outgoing'),
        targetIncomingSequenceFlowCount: countSequenceFlowEdges(targetNode, 'incoming'),
        sourceData: readNodeData(sourceNode),
        targetData: readNodeData(targetNode),
        sourcePoolId: findPoolId(sourceNode),
        targetPoolId: findPoolId(targetNode),
      },
      profileContext,
    )

    return result.valid
  }
}

function countEdges(node: any, direction: 'outgoing' | 'incoming'): number {
  try {
    const graph = node.model?.graph
    if (!graph) return 0
    return graph.getConnectedEdges(node, { [direction]: true }).length
  } catch {
    return 0
  }
}

function countSequenceFlowEdges(node: any, direction: 'outgoing' | 'incoming'): number {
  try {
    const graph = node.model?.graph
    if (!graph) return 0
    return graph.getConnectedEdges(node, { [direction]: true }).filter((edge: any) => isSequenceFlowShape(edge?.shape)).length
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
