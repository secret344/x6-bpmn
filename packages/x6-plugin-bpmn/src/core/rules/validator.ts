/**
 * 核心规则层 — Context 驱动的连线验证
 *
 * 在原有 validateBpmnConnection 的基础上，
 * 增加 ProfileContext 驱动模式，使用 ResolvedProfile 中的规则集。
 */

import type { ProfileContext, ConstraintValidateContext } from '../dialect/types'
import type { BpmnNodeCategory, BpmnConnectionRule, BpmnValidationResult } from '../../rules/connection-rules'
import { validateBpmnConnection, type BpmnConnectionContext } from '../../rules/validator'

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

  // 使用 profile 中的分类映射
  const sourceCategory = (rules.nodeCategories[context.sourceShape] || 'unknown') as BpmnNodeCategory
  const targetCategory = (rules.nodeCategories[context.targetShape] || 'unknown') as BpmnNodeCategory

  const sourceRule: BpmnConnectionRule = rules.connectionRules[sourceCategory] || {}
  const targetRule: BpmnConnectionRule = rules.connectionRules[targetCategory] || {}

  // 检查源节点是否禁止出线
  if (sourceRule.noOutgoing) {
    return { valid: false, reason: `${sourceCategory} 类型的节点不允许有出线` }
  }

  // 检查目标节点是否禁止入线
  if (targetRule.noIncoming) {
    return { valid: false, reason: `${targetCategory} 类型的节点不允许有入线` }
  }

  // 检查出线类型
  if (sourceRule.allowedOutgoing?.length) {
    if (!sourceRule.allowedOutgoing.includes(context.edgeShape)) {
      return { valid: false, reason: `${sourceCategory} 类型的节点不允许使用 ${context.edgeShape} 类型的出线` }
    }
  }

  // 检查入线类型
  if (targetRule.allowedIncoming?.length) {
    if (!targetRule.allowedIncoming.includes(context.edgeShape)) {
      return { valid: false, reason: `${targetCategory} 类型的节点不允许使用 ${context.edgeShape} 类型的入线` }
    }
  }

  // 检查允许的目标分类
  if (sourceRule.allowedTargets?.length) {
    if (!sourceRule.allowedTargets.includes(targetCategory)) {
      return { valid: false, reason: `${sourceCategory} 不允许连接到 ${targetCategory}` }
    }
  }

  // 检查禁止的目标分类
  if (sourceRule.forbiddenTargets?.length) {
    if (sourceRule.forbiddenTargets.includes(targetCategory)) {
      return { valid: false, reason: `${sourceCategory} 禁止连接到 ${targetCategory}` }
    }
  }

  // 检查允许的源分类
  if (targetRule.allowedSources?.length) {
    if (!targetRule.allowedSources.includes(sourceCategory)) {
      return { valid: false, reason: `${targetCategory} 不允许接收来自 ${sourceCategory} 的连线` }
    }
  }

  // 检查禁止的源分类
  if (targetRule.forbiddenSources?.length) {
    if (targetRule.forbiddenSources.includes(sourceCategory)) {
      return { valid: false, reason: `${targetCategory} 禁止接收来自 ${sourceCategory} 的连线` }
    }
  }

  // 出线数量检查
  if (sourceRule.maxOutgoing !== undefined && context.sourceOutgoingCount !== undefined) {
    if (context.sourceOutgoingCount >= sourceRule.maxOutgoing) {
      return { valid: false, reason: `${sourceCategory} 类型的节点出线数量已达上限 (${sourceRule.maxOutgoing})` }
    }
  }

  // 入线数量检查
  if (targetRule.maxIncoming !== undefined && context.targetIncomingCount !== undefined) {
    if (context.targetIncomingCount >= targetRule.maxIncoming) {
      return { valid: false, reason: `${targetCategory} 类型的节点入线数量已达上限 (${targetRule.maxIncoming})` }
    }
  }

  return { valid: true }
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
