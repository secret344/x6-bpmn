/**
 * 规则预设类型定义
 *
 * 定义可扩展的规则预设体系，支持 BPMN 2.0 基础规则、SmartEngine 扩展规则
 * 以及用户自定义规则。预设之间通过 extends 字段形成继承链，
 * 子预设可覆盖或追加父预设的规则。
 */

import type { BpmnNodeCategory, BpmnConnectionRule, BpmnValidationResult } from '../connection-rules'

// ============================================================================
// 节点属性定义
// ============================================================================

/**
 * 节点属性定义
 *
 * 描述某类节点可配置的单个属性，用于动态生成配置表单。
 */
export interface NodePropertyDefinition {
  /** 属性键名，对应 BpmnFormData 中的 key */
  key: string
  /** 属性显示标签 */
  label: string
  /** 属性类型 */
  type: 'string' | 'boolean' | 'number' | 'select' | 'expression'
  /** 是否必填 */
  required?: boolean
  /** 默认值 */
  defaultValue?: string | boolean | number
  /** 下拉选项（type 为 select 时使用） */
  options?: { label: string; value: string }[]
  /** 属性分组（用于表单 UI 分组显示） */
  group?: string
  /** 属性描述 */
  description?: string
}

// ============================================================================
// 自定义验证器
// ============================================================================

/**
 * 自定义验证上下文
 *
 * 在连线规则基础上提供额外的验证信息。
 */
export interface CustomValidationContext {
  /** 源节点的 shape 名称 */
  sourceShape: string
  /** 目标节点的 shape 名称 */
  targetShape: string
  /** 连线（边）的 shape 名称 */
  edgeShape: string
  /** 源节点当前已有的出线数量 */
  sourceOutgoingCount?: number
  /** 目标节点当前已有的入线数量 */
  targetIncomingCount?: number
}

/**
 * 自定义验证器
 *
 * 允许预设定义额外的验证逻辑，在基础连线规则之上执行。
 */
export interface BpmnCustomValidator {
  /** 验证器名称 */
  name: string
  /** 验证器描述 */
  description?: string
  /** 验证函数，返回验证结果 */
  validate: (context: CustomValidationContext) => BpmnValidationResult
}

// ============================================================================
// 规则预设定义
// ============================================================================

/**
 * 规则预设
 *
 * 一个命名的、可继承的规则集合，包含连线规则、节点属性定义、
 * 自定义验证器等。通过 extends 字段可继承另一个预设的所有规则，
 * 并在此基础上进行覆盖或追加。
 *
 * @example
 * ```ts
 * const myPreset: BpmnRulePreset = {
 *   name: 'my-preset',
 *   extends: 'smartengine',
 *   connectionRules: {
 *     startEvent: { maxOutgoing: 1 },
 *   },
 *   nodeProperties: {
 *     serviceTask: [
 *       { key: 'retryCount', label: '重试次数', type: 'number' },
 *     ],
 *   },
 * }
 * ```
 */
export interface BpmnRulePreset {
  /** 预设唯一名称 */
  name: string
  /** 预设描述 */
  description?: string
  /** 父预设名称，当前预设将继承父预设的所有规则 */
  extends?: string
  /** 连线规则覆盖 */
  connectionRules?: Partial<Record<BpmnNodeCategory, BpmnConnectionRule>>
  /** 节点属性定义（按 ShapeCategory 分组） */
  nodeProperties?: Record<string, NodePropertyDefinition[]>
  /** 自定义验证器列表 */
  validators?: BpmnCustomValidator[]
  /** 节点分类覆盖（shape 名称 → BpmnNodeCategory） */
  shapeCategoryOverrides?: Record<string, BpmnNodeCategory>
  /** 节点标签覆盖（shape 名称 → 显示标签） */
  shapeLabelOverrides?: Record<string, string>
}

// ============================================================================
// 解析后的规则预设（继承链展平后的结果）
// ============================================================================

/**
 * 解析后的规则预设
 *
 * 继承链展平后的完整规则集，所有字段均已填充，可直接使用。
 */
export interface ResolvedBpmnRulePreset {
  /** 预设唯一名称 */
  name: string
  /** 预设描述 */
  description?: string
  /** 完整的连线规则表 */
  connectionRules: Record<BpmnNodeCategory, BpmnConnectionRule>
  /** 完整的节点属性定义 */
  nodeProperties: Record<string, NodePropertyDefinition[]>
  /** 所有验证器（含继承链中的验证器） */
  validators: BpmnCustomValidator[]
  /** 完整的节点分类覆盖映射 */
  shapeCategoryOverrides: Record<string, BpmnNodeCategory>
  /** 完整的节点标签覆盖映射 */
  shapeLabelOverrides: Record<string, string>
}
