/**
 * 流程方言内核 — 核心类型定义
 *
 * 定义六层配置模型（definitions / availability / rendering / rules / dataModel / serialization）
 * 以及 Profile、ResolvedProfile、DialectMeta 等顶层类型。
 */

import type { BpmnConnectionRule, BpmnNodeCategory } from '../../rules/connection-rules'
import type { BpmnNodeMapping, BpmnEdgeMapping } from '../../export/bpmn-mapping'
import type { BpmnXmlNameSettings } from '../../utils/bpmn-xml-names'

/** 通用扩展属性的 XML 序列化配置。 */
export interface ExtensionPropertySerialization {
  /** 扩展命名空间使用的前缀。 */
  prefix?: string
  /** 扩展命名空间 URI。 */
  namespaceUri?: string
  /** 扩展属性容器的本地标签名。 */
  containerLocalName?: string
  /** 单个扩展属性项的本地标签名。 */
  propertyLocalName?: string
}

// ============================================================================
// 1. definitions — 元素定义
// ============================================================================

/** 节点元素定义 */
export interface NodeDefinition {
  /** X6 shape 名称 */
  shape: string
  /** 节点分类（如 startEvent, task, gateway 等） */
  category: string
  /** 渲染器名称，对应 RenderingSet.nodeRenderers 的 key */
  renderer: string
  /** 显示标题（可供 UI 使用，主库不做 UI 渲染） */
  title?: string
  /** 标签用于分组与检索 */
  tags?: string[]
}

/** 边（连接线）元素定义 */
export interface EdgeDefinition {
  /** X6 edge shape 名称 */
  shape: string
  /** 边分类（如 sequenceFlow, messageFlow, association 等） */
  category: string
  /** 渲染器名称，对应 RenderingSet.edgeRenderers 的 key */
  renderer: string
  /** 显示标题 */
  title?: string
  /** 标签 */
  tags?: string[]
}

/** 元素定义集合 */
export interface DefinitionsSet {
  nodes: Record<string, NodeDefinition>
  edges: Record<string, EdgeDefinition>
}

// ============================================================================
// 2. availability — 元素可用性
// ============================================================================

/** 元素可用状态 */
export type Availability = 'enabled' | 'disabled' | 'experimental'

/** 可用性集合 */
export interface AvailabilitySet {
  nodes: Record<string, Availability>
  edges: Record<string, Availability>
}

// ============================================================================
// 3. rendering — 渲染层
// ============================================================================

/** 主题 Token */
export interface ThemeTokens {
  colors: Record<string, any>
  icons: Record<string, string>
}

/** X6 节点 shape 定义 */
export interface ShapeDefinition {
  inherit?: string
  width?: number
  height?: number
  markup?: Array<{ tagName: string; selector: string; [key: string]: any }>
  attrs?: Record<string, Record<string, unknown>>
  ports?: any
  [key: string]: any
}

/** X6 边 shape 定义 */
export interface EdgeDefinitionConfig {
  inherit?: string
  attrs?: Record<string, Record<string, unknown>>
  labels?: any[]
  zIndex?: number
  [key: string]: any
}

/** 节点渲染器工厂 */
export type NodeRendererFactory = (tokens: ThemeTokens, node: NodeDefinition) => ShapeDefinition

/** 边渲染器工厂 */
export type EdgeRendererFactory = (tokens: ThemeTokens, edge: EdgeDefinition) => EdgeDefinitionConfig

/** 渲染集合 */
export interface RenderingSet {
  theme: ThemeTokens
  nodeRenderers: Record<string, NodeRendererFactory>
  edgeRenderers: Record<string, EdgeRendererFactory>
}

// ============================================================================
// 4. rules — 规则层
// ============================================================================

/** 高阶约束规则 */
export interface ConstraintRule {
  /** 规则 ID */
  id: string
  /** 规则描述 */
  description: string
  /** 验证函数，返回 true 表示通过，字符串表示失败原因 */
  validate: (context: ConstraintValidateContext) => true | string
}

/** 约束规则验证上下文 */
export interface ConstraintValidateContext {
  /** 当前 profile ID */
  profileId: string
  /** 所有节点的 shape 列表 */
  nodeShapes: string[]
  /** 所有边的 shape 列表 */
  edgeShapes: string[]
  /** 节点数量统计 */
  nodeCounts: Record<string, number>
}

/** 规则集合 */
export interface RuleSet {
  /** shape → 节点分类映射 */
  nodeCategories: Record<string, BpmnNodeCategory>
  /** 分类 → 连接规则 */
  connectionRules: Record<string, BpmnConnectionRule>
  /** 高阶约束规则列表 */
  constraints: ConstraintRule[]
}

// ============================================================================
// 5. dataModel — 字段能力层
// ============================================================================

/** 字段验证上下文 */
export interface FieldValidateContext {
  /** 当前节点/边的 shape 名称 */
  shape: string
  /** 当前节点/边的分类 */
  category: string
  /** 当前 profile ID */
  profileId: string
  /** 节点上附带的完整数据 */
  nodeData?: Record<string, unknown>
}

/** 字段编辑器类型（声明式提示，不绑定具体 UI 组件） */
export type FieldEditorInput = 'text' | 'textarea' | 'boolean' | 'select'

/** 字段编辑器可选项 */
export interface FieldEditorOption {
  value: string
  label: string
}

/** 字段编辑器提示 */
export interface FieldEditorHint {
  /** 显示名称 */
  label?: string
  /** 输入控件类型 */
  input?: FieldEditorInput
  /** 占位提示 */
  placeholder?: string
  /** 选择项 */
  options?: FieldEditorOption[]
}

/** 字段能力定义（主库负责字段能力，并可提供声明式编辑提示） */
export interface FieldCapability {
  /** 该字段适用的范围 */
  scope?: 'node' | 'edge' | 'graph'
  /** 默认值 */
  defaultValue?: unknown
  /** 字段描述（供开发者参照，不用于 UI） */
  description?: string
  /** 归一化处理 */
  normalize?: (value: unknown) => unknown
  /** 验证函数，返回 true 表示通过，字符串表示失败原因 */
  validate?: (value: unknown, context: FieldValidateContext) => true | string
  /** 序列化转换（节点数据 → XML / JSON） */
  serialize?: (value: unknown) => unknown
  /** 反序列化转换（XML / JSON → 节点数据） */
  deserialize?: (value: unknown) => unknown
  /** 声明式编辑提示，由消费方决定如何渲染 */
  editor?: FieldEditorHint
}

/** 数据模型集合 */
export interface DataModelSet {
  /** 字段能力注册表 */
  fields: Record<string, FieldCapability>
  /** 分类 → 该分类适用的字段列表 */
  categoryFields: Record<string, string[]>
  /** shape → 该 shape 特有的字段列表（比 categoryFields 更细粒度） */
  shapeFields?: Record<string, string[]>
}

// ============================================================================
// 6. serialization — 序列化层
// ============================================================================

/** 节点导出序列化上下文。 */
export interface NodeSerializationExportContext {
  shape: string
  category: string
  bpmnData: Record<string, unknown>
  element: unknown
  moddle: unknown
  namespaces: Record<string, string>
}

/** 节点导出序列化结果。 */
export interface NodeSerializationExportResult {
  /** 已由自定义序列化消费的 bpmn key，后续跳过通用扩展属性导出。 */
  omitBpmnKeys?: string[]
}

/** 节点导入序列化上下文。 */
export interface NodeSerializationImportContext {
  shape: string
  category: string
  element: unknown
  namespaces: Record<string, string>
}

/** 节点序列化处理器。 */
export interface NodeSerializationHandler {
  export?: (context: NodeSerializationExportContext) => void | NodeSerializationExportResult
  import?: (context: NodeSerializationImportContext) => void | Record<string, unknown>
}

/** 边导出序列化上下文。 */
export interface EdgeSerializationExportContext {
  shape: string
  edgeData: Record<string, unknown>
  element: unknown
  moddle: unknown
  namespaces: Record<string, string>
}

/** 边导出序列化结果。 */
export interface EdgeSerializationExportResult {
  /** 已由自定义序列化消费的 bpmn key。 */
  omitBpmnKeys?: string[]
}

/** 边导入序列化上下文。 */
export interface EdgeSerializationImportContext {
  shape: string
  element: unknown
  namespaces: Record<string, string>
}

/** 边序列化处理器。 */
export interface EdgeSerializationHandler {
  export?: (context: EdgeSerializationExportContext) => void | EdgeSerializationExportResult
  import?: (context: EdgeSerializationImportContext) => void | Record<string, unknown>
}

/** 序列化集合 */
export interface SerializationSet {
  /** 命名空间映射，如 { bpmn: 'http://...', smart: 'http://...' } */
  namespaces: Record<string, string>
  /** 通用扩展属性的命名空间与标签配置；传入 false 可显式关闭。 */
  extensionProperties?: ExtensionPropertySerialization | false
  /** BPMN XML 名称规则，如前缀、本地名接受策略与特殊构造模式。 */
  xmlNames?: BpmnXmlNameSettings
  /** 节点 shape → BPMN 节点映射 */
  nodeMapping: Record<string, BpmnNodeMapping>
  /** 边 shape → BPMN 边映射 */
  edgeMapping: Record<string, BpmnEdgeMapping>
  /** definitions.targetNamespace。 */
  targetNamespace?: string
  /** process 节点附加属性，如 version。 */
  processAttributes?: Record<string, unknown>
  /** 节点级 XML 导入导出处理器。 */
  nodeSerializers?: Record<string, NodeSerializationHandler>
  /** 边级 XML 导入导出处理器。 */
  edgeSerializers?: Record<string, EdgeSerializationHandler>
}

/** 运行时可覆写的序列化选项。 */
export type SerializationOverrides = Partial<SerializationSet>

// ============================================================================
// 顶层类型
// ============================================================================

/** 方言元信息 */
export interface DialectMeta {
  /** 方言唯一 ID，如 'bpmn2', 'smartengine-base' */
  id: string
  /** 方言显示名称 */
  name: string
  /** 父方言 ID（用于继承链） */
  parent?: string
  /** 版本号 */
  version?: string
  /** 描述 */
  description?: string
}

/** 删除标记 — 用于在子 profile 中删除父级配置项 */
export interface RemoveMarker {
  $remove: true
}

/** 检测是否为删除标记 */
export function isRemoveMarker(value: unknown): value is RemoveMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$remove' in value &&
    (value as any).$remove === true
  )
}

/**
 * Profile — 方言配置载体
 *
 * Profile 是某个方言的配置定义，包含六层配置模型（均为 partial，可部分覆盖）。
 * 通过继承链 + 编译后得到 ResolvedProfile。
 */
export interface Profile {
  meta: DialectMeta
  definitions?: Partial<DefinitionsSet>
  availability?: Partial<AvailabilitySet>
  rendering?: Partial<RenderingSet>
  rules?: Partial<RuleSet>
  dataModel?: Partial<DataModelSet>
  serialization?: Partial<SerializationSet>
}

/**
 * ResolvedProfile — 编译后的最终 profile
 *
 * 经过继承链解析、合并、删除语义处理、默认值补齐后的只读结果。
 * 所有层都是完整的（非 partial），可直接用于运行时。
 */
export interface ResolvedProfile {
  meta: DialectMeta
  definitions: DefinitionsSet
  availability: AvailabilitySet
  rendering: RenderingSet
  rules: RuleSet
  dataModel: DataModelSet
  serialization: SerializationSet
}

// ============================================================================
// 导入 / 导出适配器接口
// ============================================================================

/** ProfileContext — 运行时方言上下文（绑定到 graph 实例） */
export interface ProfileContext {
  /** 编译后的 profile */
  profile: ResolvedProfile
}

/** 方言检测器接口 */
export interface DialectDetectorInterface {
  /** 根据 XML 内容检测方言 ID */
  detect(xml: string): string
}

/** 导出适配器接口 */
export interface ExporterAdapter {
  /** 适用的方言 ID */
  dialect: string
  /** 导出 XML */
  exportXML(graph: any, context: ProfileContext): Promise<string>
}

/** 导入适配器接口 */
export interface ImporterAdapter {
  /** 适用的方言 ID */
  dialect: string
  /** 导入 XML */
  importXML(graph: any, xml: string, context: ProfileContext): Promise<void>
}
