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

import type { Cell, CellView, Edge, Graph, Node } from '@antv/x6'
import {
  getNodeCategory,
  DEFAULT_CONNECTION_RULES,
  type BpmnNodeCategory,
  type BpmnConnectionRule,
  type BpmnConnectionContext,
  type BpmnConnectionConstraint,
  type BpmnConnectionConstraintMatcher,
  type BpmnConnectionConstraintRequirement,
  type BpmnConnectionDataCondition,
  type BpmnRuleValidationContext,
  type BpmnValidationResult,
} from './connection-rules'
import {
  BPMN_MESSAGE_FLOW,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
} from '../utils/constants'

export type { BpmnConnectionContext } from './connection-rules'

// ============================================================================
// 验证参数
// ============================================================================

/**
 * 验证选项
 */
export interface BpmnValidateOptions {
  /** 自定义规则表（与默认规则合并，自定义规则优先） */
  customRules?: Partial<Record<BpmnNodeCategory, BpmnConnectionRule>>
  /** 连线类型不匹配时是否放行（默认 false） */
  allowUnknownEdgeTypes?: boolean
  /** 最终连线失败时的错误回调（适合接入 X6 validateEdge） */
  onValidationError?: (result: BpmnValidationResult, args: X6ValidateConnectionArgs | X6ValidateEdgeArgs) => void
  /** 连线校验执行异常时的回调 */
  onValidationException?: (
    error: unknown,
    args: X6ValidateConnectionArgs | X6ValidateEdgeArgs,
    result: BpmnValidationResult,
  ) => void
}

export interface X6ValidateEdgeArgs {
  edge?: Edge | null
  type?: string | null
  previous?: unknown
}

type JsonRecord = Record<string, unknown>
type EdgeShapeReadable = Edge & { getShape?: () => string }
type GraphLike = Pick<Graph, 'getCellById' | 'getConnectedEdges'>
type CellWithGraphRef = {
  model?: { graph?: GraphLike | null } | null
  graph?: GraphLike | null
}

// ============================================================================
// 核心验证函数
// ============================================================================

/**
 * 合并默认规则与自定义规则
 */
function mergeRules(
  customRules?: Partial<Record<BpmnNodeCategory, BpmnConnectionRule>>
): Record<BpmnNodeCategory, BpmnConnectionRule> {
  if (!customRules) return DEFAULT_CONNECTION_RULES
  const merged = { ...DEFAULT_CONNECTION_RULES }
  for (const [key, rule] of Object.entries(customRules)) {
    const category = key as BpmnNodeCategory
    merged[category] = { ...merged[category], ...rule }
  }
  return merged
}

function runConfiguredConstraints(
  sourceRule: BpmnConnectionRule,
  targetRule: BpmnConnectionRule,
  context: BpmnRuleValidationContext,
): BpmnValidationResult {
  const constraints = [
    ...(sourceRule.constraints ?? []),
    ...(targetRule.constraints ?? []),
  ]

  for (const constraint of constraints) {
    if (!matchesConstraintMatcher(constraint.when, context)) continue
    if (constraint.forbid && matchesConstraintMatcher(constraint.forbid, context)) {
      return { valid: false, reason: constraint.reason }
    }
    if (constraint.require && !matchesConstraintRequirement(constraint.require, context)) {
      return { valid: false, reason: constraint.reason }
    }
  }

  return { valid: true }
}

function matchesConstraintMatcher(
  matcher: BpmnConnectionConstraintMatcher | undefined,
  context: BpmnRuleValidationContext,
): boolean {
  if (!matcher) return true
  if (matcher.edgeShapes && !matcher.edgeShapes.includes(context.edgeShape)) return false
  if (matcher.sourceCategories && !matcher.sourceCategories.includes(context.sourceCategory)) return false
  if (matcher.targetCategories && !matcher.targetCategories.includes(context.targetCategory)) return false
  if (matcher.sourceShapes && !matcher.sourceShapes.includes(context.sourceShape)) return false
  if (matcher.targetShapes && !matcher.targetShapes.includes(context.targetShape)) return false
  if (matcher.sourceDataMatches && !matchesDataConditions(context.sourceData, matcher.sourceDataMatches)) return false
  if (matcher.targetDataMatches && !matchesDataConditions(context.targetData, matcher.targetDataMatches)) return false
  return true
}

function matchesConstraintRequirement(
  requirement: BpmnConnectionConstraintRequirement,
  context: BpmnRuleValidationContext,
): boolean {
  if (
    requirement.allowedTargetShapes &&
    !requirement.allowedTargetShapes.includes(context.targetShape)
  ) {
    return false
  }
  if (
    requirement.minSourceOutgoingSequenceFlowCount !== undefined &&
    (context.sourceOutgoingSequenceFlowCount ?? 0) < requirement.minSourceOutgoingSequenceFlowCount
  ) {
    return false
  }
  if (
    requirement.maxTargetIncomingSequenceFlowCount !== undefined &&
    (context.targetIncomingSequenceFlowCount ?? 0) > requirement.maxTargetIncomingSequenceFlowCount
  ) {
    return false
  }
  return true
}

function matchesDataConditions(
  data: JsonRecord | undefined,
  conditions: BpmnConnectionDataCondition[],
): boolean {
  return conditions.every((condition) => readValueByPath(data, condition.path) === condition.equals)
}

function readValueByPath(data: JsonRecord | undefined, path: string): unknown {
  if (!data || typeof data !== 'object') return undefined
  return path.split('.').reduce<unknown>((currentValue, segment) => {
    if (!currentValue || typeof currentValue !== 'object') return undefined
    return (currentValue as JsonRecord)[segment]
  }, data)
}

/**
 * 使用指定规则集与分类解析器执行连线验证。
 */
export function validateConnectionAgainstRules(
  context: BpmnConnectionContext,
  rules: Record<BpmnNodeCategory, BpmnConnectionRule>,
  resolveCategory: (shape: string) => BpmnNodeCategory,
  options: Pick<BpmnValidateOptions, 'allowUnknownEdgeTypes'> = {},
): BpmnValidationResult {
  const {
    sourceShape,
    targetShape,
    edgeShape,
    sourceOutgoingCount,
    targetIncomingCount,
    sourcePoolId,
    targetPoolId,
  } = context

  // 1. 获取源和目标的分类
  const sourceCategory = resolveCategory(sourceShape)
  const targetCategory = resolveCategory(targetShape)

  const sourceRule = rules[sourceCategory] || {}
  const targetRule = rules[targetCategory] || {}

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

  // 12. 检查 Pool 边界约束
  if (sourcePoolId !== undefined && targetPoolId !== undefined) {
    const poolCheck = validatePoolBoundary(edgeShape, sourcePoolId, targetPoolId)
    if (!poolCheck.valid) return poolCheck
  }

  // 13. 检查动态语义约束
  return runConfiguredConstraints(sourceRule, targetRule, {
    ...context,
    sourceCategory,
    targetCategory,
  })
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
  return validateConnectionAgainstRules(
    context,
    mergeRules(options.customRules),
    getNodeCategory,
    options,
  )
}

// ============================================================================
// Pool 边界验证
// ============================================================================

const SEQUENCE_FLOW_SET = new Set([BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW])

/**
 * 在调用 validateBpmnConnection 之后检查 Pool 边界约束。
 *
 * 规范要求：
 * - 顺序流 / 条件流 / 默认流：源和目标必须在同一个 Pool 内
 * - 消息流：源和目标必须属于不同的 Pool
 *
 * 只有当 sourcePoolId 和 targetPoolId 均提供时才执行此验证。
 */
export function validatePoolBoundary(
  edgeShape: string,
  sourcePoolId: string,
  targetPoolId: string,
): BpmnValidationResult {
  if (SEQUENCE_FLOW_SET.has(edgeShape)) {
    if (sourcePoolId !== targetPoolId) {
      return {
        valid: false,
        reason: '顺序流不能穿越 Pool 边界（formal-11-01-03 §7.5.1 / §8.3.13）',
      }
    }
  } else if (edgeShape === BPMN_MESSAGE_FLOW) {
    if (sourcePoolId === targetPoolId) {
      return {
        valid: false,
        reason: '消息流必须连接不同的 Pool（formal-11-01-03 §7.5.2 / §9.3）',
      }
    }
  }
  return { valid: true }
}

/**
 * X6 validateConnection 回调参数类型
 * 对应 @antv/x6 Graph connecting.validateConnection 的参数
 */
export interface X6ValidateConnectionArgs {
  edge?: Edge | null
  sourceView?: CellView | null
  targetView?: CellView | null
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
  const validateWithResult = createBpmnValidateConnectionWithResult(edgeShapeGetter, options)

  return (args: X6ValidateConnectionArgs): boolean => {
    return validateWithResult(args).valid
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
    try {
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

      return validateRuntimeEdge(
        sourceNode,
        targetNode,
        resolveEdgeShape(args.edge, edgeShapeGetter),
        options,
        args.edge,
      )
    } catch (error) {
      return reportValidationException(options, error, args, '连线预校验执行异常')
    }
  }
}

/**
 * 创建适配 X6 validateEdge 的最终连线校验回调。
 *
 * 适用于拖拽结束后的最终校验与错误回调分发，
 * 让宿主只负责接收失败原因，而不需要自行实现 BPMN 规则。
 */
export function createBpmnValidateEdge(
  edgeShapeGetter: () => string,
  options: BpmnValidateOptions = {},
): (args: X6ValidateEdgeArgs) => boolean {
  const validateWithResult = createBpmnValidateEdgeWithResult(edgeShapeGetter, options)

  return (args: X6ValidateEdgeArgs): boolean => {
    const result = validateWithResult(args)
    if (!result.valid && result.kind !== 'exception') {
      options.onValidationError?.(result, args)
    }
    return result.valid
  }
}

/**
 * 创建返回详细结果的 X6 validateEdge 回调。
 */
export function createBpmnValidateEdgeWithResult(
  edgeShapeGetter: () => string,
  options: BpmnValidateOptions = {},
): (args: X6ValidateEdgeArgs) => BpmnValidationResult {
  return (args: X6ValidateEdgeArgs): BpmnValidationResult => {
    try {
      const edge = args.edge ?? null
      if (!edge) {
        return { valid: false, reason: '连线实例不存在' }
      }

      const graph = getGraphFromCell(edge)
      if (!graph?.getCellById) {
        return { valid: false, reason: '无法定位连线所属图实例' }
      }

      const sourceCellId = edge.getSourceCellId?.()
      const targetCellId = edge.getTargetCellId?.()
      if (!sourceCellId || !targetCellId) {
        return { valid: false, reason: '连线必须连接到有效的源节点和目标节点' }
      }

      const sourceNode = graph.getCellById(sourceCellId) as Node | null
      const targetNode = graph.getCellById(targetCellId) as Node | null
      if (!sourceNode || !targetNode) {
        return { valid: false, reason: '无法解析连线的源节点或目标节点' }
      }

      if (sourceNode.id === targetNode.id) {
        return { valid: false, reason: '不允许自连接' }
      }

      return validateRuntimeEdge(
        sourceNode,
        targetNode,
        resolveEdgeShape(edge, edgeShapeGetter),
        options,
        edge,
      )
    } catch (error) {
      return reportValidationException(options, error, args, '连线终校验执行异常')
    }
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 计算节点的出线数量
 */
function validateRuntimeEdge(
  sourceNode: Node,
  targetNode: Node,
  edgeShape: string,
  options: BpmnValidateOptions,
  currentEdge?: Edge | null,
): BpmnValidationResult {
  return validateBpmnConnection(
    {
      sourceShape: sourceNode.shape,
      targetShape: targetNode.shape,
      edgeShape,
      sourceOutgoingCount: countOutgoingEdges(sourceNode, currentEdge),
      targetIncomingCount: countIncomingEdges(targetNode, currentEdge),
      sourceOutgoingSequenceFlowCount: countSequenceFlowEdges(sourceNode, 'outgoing', currentEdge),
      targetIncomingSequenceFlowCount: countSequenceFlowEdges(targetNode, 'incoming', currentEdge),
      sourceData: readNodeData(sourceNode),
      targetData: readNodeData(targetNode),
      sourcePoolId: findPoolId(sourceNode),
      targetPoolId: findPoolId(targetNode),
    },
    options,
  )
}

function resolveEdgeShape(edge: Edge | null | undefined, edgeShapeGetter: () => string): string {
  const shapeReader = edge as EdgeShapeReadable | null | undefined
  const shape = typeof shapeReader?.getShape === 'function'
    ? shapeReader.getShape()
    : edge?.shape

  return typeof shape === 'string' && shape.length > 0 ? shape : edgeShapeGetter()
}

function getGraphFromCell(cell: Node | Edge): GraphLike | null | undefined {
  const graphRef = cell as CellWithGraphRef
  return graphRef.model?.graph ?? graphRef.graph
}

function isSameEdge(edge: Edge, currentEdge?: Edge | null): boolean {
  if (!currentEdge) return false
  return edge === currentEdge || (!!edge.id && !!currentEdge.id && edge.id === currentEdge.id)
}

function getConnectedEdges(
  node: Node,
  direction: 'outgoing' | 'incoming',
  currentEdge?: Edge | null,
): Edge[] {
  try {
    const graph = getGraphFromCell(node)
    if (!graph) return []
    return graph.getConnectedEdges(node, { [direction]: true }).filter((edge: Edge) => !isSameEdge(edge, currentEdge))
  } catch {
    return []
  }
}

function countOutgoingEdges(node: Node, currentEdge?: Edge | null): number {
  return getConnectedEdges(node, 'outgoing', currentEdge).length
}

/**
 * 计算节点的入线数量
 */
function countIncomingEdges(node: Node, currentEdge?: Edge | null): number {
  return getConnectedEdges(node, 'incoming', currentEdge).length
}

/**
 * 统计节点的顺序流系列连线数量。
 */
function countSequenceFlowEdges(node: Node, direction: 'outgoing' | 'incoming', currentEdge?: Edge | null): number {
  return getConnectedEdges(node, direction, currentEdge).filter((edge: Edge) => SEQUENCE_FLOW_SET.has(edge.shape)).length
}

/**
 * 读取节点持久化数据。
 */
function readNodeData(node: Node): JsonRecord | undefined {
  try {
    const data = node.getData()
    if (data && typeof data === 'object') return data as JsonRecord
  } catch {
    return undefined
  }
  return undefined
}

function reportValidationException(
  options: BpmnValidateOptions,
  error: unknown,
  args: X6ValidateConnectionArgs | X6ValidateEdgeArgs,
  message: string,
): BpmnValidationResult {
  const detail = error instanceof Error && error.message ? `：${error.message}` : ''
  const result: BpmnValidationResult = {
    valid: false,
    reason: `${message}${detail}`,
    kind: 'exception',
  }

  options.onValidationException?.(error, args, result)
  return result
}

/**
 * 详细节点的父层居层结构，返回属于的 Pool 节点 ID。
 * 节点 → Lane → Pool 这种嵌套层尚加以支持。
 */
function findPoolId(node: Node): string | undefined {
  const BPMN_POOL_SHAPE = 'bpmn-pool'
  let current: Cell | null = node.getParent()
  while (current) {
    if (current.shape === BPMN_POOL_SHAPE) return current.id
    current = current.getParent()
  }
  return undefined
}
