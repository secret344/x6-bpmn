/**
 * 规则预设类型定义
 *
 * 定义可扩展的规则预设体系，支持 BPMN 2.0 基础规则、SmartEngine 扩展规则
 * 以及用户自定义规则。预设之间通过 extends 字段形成继承链，
 * 子预设可覆盖或追加父预设的规则。
 *
 * 预设涵盖全方位的 BPMN 定制：
 * - 连线规则（connectionRules）
 * - 节点属性定义（nodeProperties）
 * - 自定义验证器（validators）
 * - 节点/连线外观定义（nodeDefinitions / edgeDefinitions）
 * - 可用节点/连线白名单（availableNodes / availableEdges）
 * - XML 序列化适配器（serializationAdapter）
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
// 节点/连线外观定义
// ============================================================================

/**
 * 节点外观定义覆盖
 *
 * 允许预设自定义节点的默认大小、端口配置、是否在面板中隐藏等。
 */
export interface NodeDefinitionOverride {
  /** 默认尺寸 */
  defaultSize?: { width: number; height: number }
  /** 是否在节点面板中隐藏 */
  hidden?: boolean
  /** 自定义显示标签 */
  label?: string
  /** 提示信息 */
  tooltip?: string
}

/**
 * 连线外观定义覆盖
 *
 * 允许预设自定义连线的默认颜色、是否在面板中隐藏等。
 */
export interface EdgeDefinitionOverride {
  /** 是否在连线选择面板中隐藏 */
  hidden?: boolean
  /** 自定义显示标签 */
  label?: string
}

// ============================================================================
// 序列化适配器
// ============================================================================

/**
 * 序列化适配器上下文（导出时传入）
 *
 * 提供导出过程中所需的节点数据信息。
 */
export interface SerializationExportContext {
  /** X6 节点的 shape 名称 */
  shape: string
  /** 节点/边的业务数据（来自 node.getData()） */
  data: Record<string, unknown>
  /** 节点/边的 BPMN moddle 元素 */
  element: Record<string, unknown>
}

/**
 * 序列化适配器上下文（导入时传入）
 *
 * 提供导入过程中所需的 BPMN 元素信息。
 */
export interface SerializationImportContext {
  /** BPMN moddle 元素 */
  element: Record<string, unknown>
  /** 解析出的 X6 shape 名称 */
  shape: string
}

/**
 * 序列化适配器
 *
 * 允许预设在 XML 导入/导出时注入自定义逻辑，
 * 例如处理自定义命名空间、扩展属性、监听器等。
 * 这是实现类 SmartEngine 引擎深度集成的核心接口。
 *
 * @example
 * ```ts
 * const adapter: SerializationAdapter = {
 *   namespaces: { smart: 'http://smartengine.io/schema' },
 *   onExportElement: (ctx) => {
 *     // 将业务数据映射到 smart: 命名空间属性
 *     if (ctx.data.implementation) {
 *       (ctx.element as any)['smart:class'] = ctx.data.implementation
 *     }
 *   },
 *   onImportElement: (ctx) => {
 *     // 从 smart: 命名空间属性提取业务数据
 *     const attrs = (ctx.element as any).$attrs || {}
 *     return attrs['smart:class'] ? { implementation: attrs['smart:class'] } : {}
 *   },
 * }
 * ```
 */
export interface SerializationAdapter {
  /** 自定义 XML 命名空间声明（前缀 → URI） */
  namespaces?: Record<string, string>

  /**
   * 导出时对每个 BPMN 元素执行的钩子。
   * 可修改 ctx.element 以添加自定义属性或扩展元素。
   */
  onExportElement?: (ctx: SerializationExportContext) => void

  /**
   * 导入时对每个 BPMN 元素执行的钩子。
   * 返回的键值对将合并到节点的 data 中。
   */
  onImportElement?: (ctx: SerializationImportContext) => Record<string, unknown>
}

// ============================================================================
// 规则预设定义
// ============================================================================

/**
 * 规则预设
 *
 * 一个命名的、可继承的全方位 BPMN 配置集合。
 * 包含连线规则、节点属性定义、节点/连线外观定义、
 * 序列化适配器、自定义验证器等。
 * 通过 extends 字段可继承另一个预设的所有配置，
 * 并在此基础上进行覆盖或追加。
 *
 * 设计原则：
 * - 标准 BPMN 2.0 模型是稳定层，所有预设都基于 BPMN 2.0
 * - 每个预设是独立的配置模块，可独立演化
 * - 所有预设遵守同一接口契约
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
 *   nodeDefinitions: {
 *     'bpmn-user-task': { defaultSize: { width: 120, height: 80 } },
 *   },
 *   availableNodes: ['bpmn-start-event', 'bpmn-end-event', 'bpmn-user-task'],
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
  /** 节点外观定义覆盖（shape 名称 → 外观配置） */
  nodeDefinitions?: Record<string, NodeDefinitionOverride>
  /** 连线外观定义覆盖（shape 名称 → 外观配置） */
  edgeDefinitions?: Record<string, EdgeDefinitionOverride>
  /** 可用节点白名单（shape 名称列表），为空或不设置表示不限制 */
  availableNodes?: string[]
  /** 可用连线白名单（shape 名称列表），为空或不设置表示不限制 */
  availableEdges?: string[]
  /** XML 序列化适配器 */
  serializationAdapter?: SerializationAdapter
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
  /** 完整的节点外观定义映射 */
  nodeDefinitions: Record<string, NodeDefinitionOverride>
  /** 完整的连线外观定义映射 */
  edgeDefinitions: Record<string, EdgeDefinitionOverride>
  /** 可用节点白名单（空数组表示不限制） */
  availableNodes: string[]
  /** 可用连线白名单（空数组表示不限制） */
  availableEdges: string[]
  /** 合并后的序列化适配器 */
  serializationAdapter: SerializationAdapter
}
