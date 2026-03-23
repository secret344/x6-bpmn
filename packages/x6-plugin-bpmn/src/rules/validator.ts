/**
 * BPMN 2.0 连线验证器
 *
 * 提供纯函数 validateBpmnConnection() 和便捷封装 createBpmnValidateConnection()，
 * 用于在连线创建时校验 BPMN 规范的合法性。
 *
 * 验证流程：
 * 1. 查找源/目标节点分类
 * 2. 检查源节点是否允许出线
 * 3. 检查目标节点是否允许入线
 * 4. 检查连线类型是否被源/目标节点允许
 * 5. 检查源→目标的分类组合是否合法
 * 6. 检查出线/入线数量是否超限
 */

import type { Cell, Edge, Node } from '@antv/x6'
import {
  getNodeCategory,
  DEFAULT_CONNECTION_RULES,
  type BpmnNodeCategory,
  type BpmnConnectionRule,
  type BpmnValidationResult,
} from './connection-rules'
import { resolvePreset } from './presets/registry'
import { getPreset } from './presets/registry'
import type { ResolvedBpmnRulePreset } from './presets/types'

// ============================================================================
// 验证参数
// ============================================================================

/**
 * 连线验证所需的上下文信息
 */
export interface BpmnConnectionContext {
  /** 源节点的 shape 名称 */
  sourceShape: string
  /** 目标节点的 shape 名称 */
  targetShape: string
  /** 连线（边）的 shape 名称（连线类型） */
  edgeShape: string
  /** 源节点当前已有的出线数量（可选，用于数量限制校验） */
  sourceOutgoingCount?: number
  /** 目标节点当前已有的入线数量（可选，用于数量限制校验） */
  targetIncomingCount?: number
}

/**
 * 验证选项
 */
export interface BpmnValidateOptions {
  /** 自定义规则表（与默认规则合并，自定义规则优先） */
  customRules?: Partial<Record<BpmnNodeCategory, BpmnConnectionRule>>
  /** 连线类型不匹配时是否放行（默认 false） */
  allowUnknownEdgeTypes?: boolean
  /**
   * 使用指定的规则预设名称
   *
   * 预设中的 connectionRules 将作为基础规则，customRules 会在此基础上进一步覆盖。
   * 预设中的 validators 会在基础连线验证通过后依次执行。
   *
   * @example
   * ```ts
   * validateBpmnConnection(context, { preset: 'smartengine' })
   * ```
   */
  preset?: string
}

// ============================================================================
// 核心验证函数
// ============================================================================

/**
 * 合并默认规则与自定义规则，支持预设
 */
function mergeRules(
  customRules?: Partial<Record<BpmnNodeCategory, BpmnConnectionRule>>,
  presetName?: string,
): Record<BpmnNodeCategory, BpmnConnectionRule> {
  // 确定基础规则：有预设则用预设的，否则用默认规则
  let base: Record<BpmnNodeCategory, BpmnConnectionRule>
  if (presetName && getPreset(presetName)) {
    const resolved = resolvePreset(presetName)
    base = { ...resolved.connectionRules }
  } else {
    base = { ...DEFAULT_CONNECTION_RULES }
  }

  // 在基础规则之上叠加 customRules
  if (!customRules) return base
  const merged = { ...base }
  for (const [key, rule] of Object.entries(customRules)) {
    const category = key as BpmnNodeCategory
    merged[category] = { ...merged[category], ...rule }
  }
  return merged
}

/**
 * 获取预设中的自定义验证器
 */
function getPresetValidators(presetName?: string): ResolvedBpmnRulePreset['validators'] {
  if (!presetName || !getPreset(presetName)) return []
  const resolved = resolvePreset(presetName)
  return resolved.validators
}

/**
 * 验证 BPMN 连线是否合法（纯函数）
 *
 * @param context 连线上下文（源、目标、边的 shape 名称及可选的连线数量信息）
 * @param options 可选验证选项（自定义规则、放行未知边类型等）
 * @returns 验证结果，包含 valid 和 reason
 *
 * @example
 * ```ts
 * const result = validateBpmnConnection({
 *   sourceShape: 'bpmn-start-event',
 *   targetShape: 'bpmn-user-task',
 *   edgeShape: 'bpmn-sequence-flow',
 * })
 * if (!result.valid) {
 *   console.warn('连线不合法:', result.reason)
 * }
 * ```
 */
export function validateBpmnConnection(
  context: BpmnConnectionContext,
  options: BpmnValidateOptions = {},
): BpmnValidationResult {
  const rules = mergeRules(options.customRules, options.preset)
  const { sourceShape, targetShape, edgeShape, sourceOutgoingCount, targetIncomingCount } = context

  // 1. 获取源和目标的分类
  const sourceCategory = getNodeCategory(sourceShape)
  const targetCategory = getNodeCategory(targetShape)

  // 对于 unknown 分类，若未提供自定义规则，则放行
  const sourceRule = rules[sourceCategory]
  const targetRule = rules[targetCategory]

  // 2. 检查源节点是否禁止出线
  if (sourceRule.noOutgoing) {
    return {
      valid: false,
      reason: `${sourceCategory} 类型的节点不允许有出线`,
    }
  }

  // 3. 检查目标节点是否禁止入线
  if (targetRule.noIncoming) {
    return {
      valid: false,
      reason: `${targetCategory} 类型的节点不允许有入线`,
    }
  }

  // 4. 检查源节点出线类型限制
  if (sourceRule.allowedOutgoing && sourceRule.allowedOutgoing.length > 0) {
    if (!sourceRule.allowedOutgoing.includes(edgeShape)) {
      if (!options.allowUnknownEdgeTypes) {
        return {
          valid: false,
          reason: `${sourceCategory} 类型的节点不允许使用 ${edgeShape} 类型的出线`,
        }
      }
    }
  }

  // 5. 检查目标节点入线类型限制
  if (targetRule.allowedIncoming && targetRule.allowedIncoming.length > 0) {
    if (!targetRule.allowedIncoming.includes(edgeShape)) {
      if (!options.allowUnknownEdgeTypes) {
        return {
          valid: false,
          reason: `${targetCategory} 类型的节点不允许使用 ${edgeShape} 类型的入线`,
        }
      }
    }
  }

  // 6. 检查源→目标的分类许可
  if (sourceRule.allowedTargets && sourceRule.allowedTargets.length > 0) {
    if (!sourceRule.allowedTargets.includes(targetCategory)) {
      return {
        valid: false,
        reason: `${sourceCategory} 不允许连接到 ${targetCategory}`,
      }
    }
  }

  // 7. 检查源→目标的分类禁止
  if (sourceRule.forbiddenTargets && sourceRule.forbiddenTargets.length > 0) {
    if (sourceRule.forbiddenTargets.includes(targetCategory)) {
      return {
        valid: false,
        reason: `${sourceCategory} 禁止连接到 ${targetCategory}`,
      }
    }
  }

  // 8. 检查目标←源的分类许可
  if (targetRule.allowedSources && targetRule.allowedSources.length > 0) {
    if (!targetRule.allowedSources.includes(sourceCategory)) {
      return {
        valid: false,
        reason: `${targetCategory} 不允许接收来自 ${sourceCategory} 的连线`,
      }
    }
  }

  // 9. 检查目标←源的分类禁止
  if (targetRule.forbiddenSources && targetRule.forbiddenSources.length > 0) {
    if (targetRule.forbiddenSources.includes(sourceCategory)) {
      return {
        valid: false,
        reason: `${targetCategory} 禁止接收来自 ${sourceCategory} 的连线`,
      }
    }
  }

  // 10. 检查出线数量限制
  if (sourceRule.maxOutgoing !== undefined && sourceOutgoingCount !== undefined) {
    if (sourceOutgoingCount >= sourceRule.maxOutgoing) {
      return {
        valid: false,
        reason: `${sourceCategory} 类型的节点出线数量已达上限 (${sourceRule.maxOutgoing})`,
      }
    }
  }

  // 11. 检查入线数量限制
  if (targetRule.maxIncoming !== undefined && targetIncomingCount !== undefined) {
    if (targetIncomingCount >= targetRule.maxIncoming) {
      return {
        valid: false,
        reason: `${targetCategory} 类型的节点入线数量已达上限 (${targetRule.maxIncoming})`,
      }
    }
  }

  // 12. 执行预设中的自定义验证器
  const presetValidators = getPresetValidators(options.preset)
  for (const validator of presetValidators) {
    const result = validator.validate({
      sourceShape,
      targetShape,
      edgeShape,
      sourceOutgoingCount,
      targetIncomingCount,
    })
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}

// ============================================================================
// X6 连接验证回调封装
// ============================================================================

/**
 * X6 validateConnection 回调参数类型
 * 对应 @antv/x6 Graph connecting.validateConnection 的参数
 */
export interface X6ValidateConnectionArgs {
  edge?: Edge | null
  sourceView?: any | null
  targetView?: any | null
  sourcePort?: string | null
  targetPort?: string | null
  sourceMagnet?: Element | null
  targetMagnet?: Element | null
  sourceCell?: Cell | null
  targetCell?: Cell | null
  type?: string | null
}

/**
 * 创建适配 X6 validateConnection 的回调函数
 *
 * 将 BPMN 规则验证集成到 X6 的 Graph connecting 配置中。
 * 返回的函数可直接传给 `graph.options.connecting.validateConnection`。
 *
 * @param edgeShapeGetter 获取当前要创建的连线类型的函数
 * @param options 可选验证选项
 * @returns X6 validateConnection 回调函数
 *
 * @example
 * ```ts
 * import { createBpmnValidateConnection } from '@x6-bpmn2/plugin'
 *
 * const graph = new Graph({
 *   connecting: {
 *     validateConnection: createBpmnValidateConnection(
 *       () => currentEdgeType.value
 *     ),
 *   },
 * })
 * ```
 */
export function createBpmnValidateConnection(
  edgeShapeGetter: () => string,
  options: BpmnValidateOptions = {},
): (args: X6ValidateConnectionArgs) => boolean {
  return (args: X6ValidateConnectionArgs): boolean => {
    const { sourceCell, targetCell, targetMagnet } = args

    // 基本校验：目标必须有磁吸点（连接桩）
    if (!targetMagnet) return false

    // 获取源/目标节点
    const sourceNode = sourceCell as Node | undefined
    const targetNode = targetCell as Node | undefined
    if (!sourceNode || !targetNode) return false

    // 不允许自连接
    if (sourceNode.id === targetNode.id) return false

    const sourceShape = sourceNode.shape
    const targetShape = targetNode.shape
    const edgeShape = edgeShapeGetter()

    // 计算当前出入线数量
    const sourceOutgoingCount = countOutgoingEdges(sourceNode)
    const targetIncomingCount = countIncomingEdges(targetNode)

    const result = validateBpmnConnection(
      { sourceShape, targetShape, edgeShape, sourceOutgoingCount, targetIncomingCount },
      options,
    )

    return result.valid
  }
}

/**
 * 创建带详细结果的验证函数
 *
 * 与 createBpmnValidateConnection 类似，但返回完整的验证结果（含失败原因），
 * 适用于需要显示错误提示的场景。
 *
 * @param edgeShapeGetter 获取当前要创建的连线类型的函数
 * @param options 可选验证选项
 * @returns 返回 BpmnValidationResult 的验证函数
 */
export function createBpmnValidateConnectionWithResult(
  edgeShapeGetter: () => string,
  options: BpmnValidateOptions = {},
): (args: X6ValidateConnectionArgs) => BpmnValidationResult {
  return (args: X6ValidateConnectionArgs): BpmnValidationResult => {
    const { sourceCell, targetCell, targetMagnet } = args

    if (!targetMagnet) {
      return { valid: false, reason: '目标节点没有可用的连接桩' }
    }

    const sourceNode = sourceCell as Node | undefined
    const targetNode = targetCell as Node | undefined
    if (!sourceNode || !targetNode) {
      return { valid: false, reason: '源节点或目标节点不存在' }
    }

    if (sourceNode.id === targetNode.id) {
      return { valid: false, reason: '不允许自连接' }
    }

    const sourceShape = sourceNode.shape
    const targetShape = targetNode.shape
    const edgeShape = edgeShapeGetter()

    const sourceOutgoingCount = countOutgoingEdges(sourceNode)
    const targetIncomingCount = countIncomingEdges(targetNode)

    return validateBpmnConnection(
      { sourceShape, targetShape, edgeShape, sourceOutgoingCount, targetIncomingCount },
      options,
    )
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 计算节点的出线数量
 */
function countOutgoingEdges(node: Node): number {
  try {
    const graph = node.model?.graph
    if (!graph) return 0
    return graph.getConnectedEdges(node, { outgoing: true }).length
  } catch {
    return 0
  }
}

/**
 * 计算节点的入线数量
 */
function countIncomingEdges(node: Node): number {
  try {
    const graph = node.model?.graph
    if (!graph) return 0
    return graph.getConnectedEdges(node, { incoming: true }).length
  } catch {
    return 0
  }
}
