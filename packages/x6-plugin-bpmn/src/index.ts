/**
 * @x6-bpmn2/plugin 入口文件
 *
 * 提供两套接口：
 * 1. 传统接口 — registerBpmnShapes() 等全局注册能力
 * 2. 方言接口 — ProfileRegistry / DialectManager 等方言系统能力
 *
 * 调用 registerBpmnShapes() 使用传统方式将所有 BPMN 图形注册到 X6 全局注册表。
 * 使用方言系统时，通过 DialectManager.bind(graph, dialectId) 按需注册。
 */

import {
  registerEventShapes,
  registerActivityShapes,
  registerGatewayShapes,
  registerDataShapes,
  registerArtifactShapes,
  registerSwimlaneShapes,
} from './shapes'
import { registerConnectionShapes } from './connections'

// ============================================================================
// 传统接口 —— 重新导出所有子模块的公开能力
// ============================================================================

export * from './utils/constants'
export * from './shapes'
export * from './connections'
export * from './config'
export * from './rules'
export * from './behaviors'

export { exportBpmnXml } from './export/exporter'
export type { ExportBpmnOptions } from './export/exporter'
export { importBpmnXml } from './export/importer'
export type { ImportBpmnOptions } from './export/importer'
export { parseBpmnXml, loadBpmnGraph } from './import'
export type {
  BpmnImportData,
  BpmnNodeData as BpmnImportNodeData,
  BpmnEdgeData,
  BpmnEdgeLabelData,
  LoadBpmnOptions,
} from './import'
export {
  NODE_MAPPING,
  EDGE_MAPPING,
  isPoolShape,
  isLaneShape,
  isSwimlaneShape,
  isArtifactShape,
  isBoundaryShape,
  isDefaultFlow,
  isConditionalFlow,
} from './export/bpmn-mapping'
export type { BpmnNodeMapping, BpmnEdgeMapping } from './export/bpmn-mapping'

// ============================================================================
// 方言接口 —— 方言系统核心导出
// ============================================================================

// 核心类型
export type {
  NodeDefinition,
  EdgeDefinition,
  DefinitionsSet,
  Availability,
  AvailabilitySet,
  ThemeTokens,
  ShapeDefinition,
  EdgeDefinitionConfig,
  NodeRendererFactory,
  EdgeRendererFactory,
  RenderingSet,
  ConstraintRule,
  ConstraintValidateContext,
  RuleSet,
  FieldCapability,
  FieldValidateContext,
  DataModelSet,
  SerializationSet,
  DialectMeta,
  RemoveMarker,
  Profile,
  ResolvedProfile,
  ProfileContext,
  ExporterAdapter,
  ImporterAdapter,
  DialectDetectorInterface,
} from './core/dialect/types'
export { isRemoveMarker } from './core/dialect/types'

// Profile 注册表
export { ProfileRegistry, createProfileRegistry } from './core/dialect/registry'

// Profile 编译器
export { compileProfile } from './core/dialect/compiler'

// Profile 上下文与绑定
export {
  createProfileContext,
  bindProfileToGraph,
  getProfileContext,
  unbindProfile,
} from './core/dialect/context'

// 方言合并工具
export { mergeProfileLayers } from './core/dialect/merge'

// 方言检测器
export {
  DialectDetector,
  createDialectDetector,
  smartEngineNamespaceRule,
} from './core/dialect/detector'
export type { DialectDetectRule } from './core/dialect/detector'

// 渲染器工厂
export { createBpmn2NodeRenderers } from './core/rendering/node-renderers'
export { createBpmn2EdgeRenderers } from './core/rendering/edge-renderers'

// 规则与约束
export {
  validateConnectionWithContext,
  createContextValidateConnection,
  createContextValidateConnectionWithResult,
  createContextValidateEdge,
  createContextValidateEdgeWithResult,
} from './core/rules/validator'
export {
  createStartEventLimit,
  createEndEventLimit,
  requireStartEvent,
  requireEndEvent,
  createForbiddenShapes,
  validateConstraints,
} from './core/rules/constraints'

// 数据模型字段能力
export {
  getFieldDefaultValue,
  normalizeFieldValue,
  validateFieldValue,
  serializeFieldValue,
  deserializeFieldValue,
  getFieldsForCategory,
  getFieldsForShape,
  buildDefaultData,
  validateFields,
} from './core/data-model/fields'

// 图级校验
export type {
  ValidationIssueCategory,
  ValidationIssue,
  DiagramValidationReport,
  DiagramValidationOptions,
} from './core/validation'
export { validateDiagram } from './core/validation'

// 内置 Profile
export { bpmn2Profile } from './builtin/bpmn2'
export { smartengineBaseProfile } from './builtin/smartengine-base'
export { smartengineCustomProfile } from './builtin/smartengine-custom'
export { smartengineDatabaseProfile } from './builtin/smartengine-database'

// 适配器
export { createBpmn2ExporterAdapter } from './export'
export { createBpmn2ImporterAdapter } from './import'
export type {
  Bpmn2ExporterAdapterOptions,
  Bpmn2ExportPreProcessor,
  Bpmn2ExportPostProcessor,
} from './export'
export type {
  Bpmn2ImporterAdapterOptions,
  Bpmn2ImportPostProcessor,
} from './import'
export { DialectManager, createDialectManager } from './core/dialect'
export type { DialectManagerOptions } from './core/dialect'

// ============================================================================
// BpmnPlugin — 统一注册所有 BPMN 2.0 图形的插件函数
// ============================================================================

/** 插件配置选项，可按类别开关图形注册 */
export interface BpmnPluginOptions {
  /** 是否注册事件图形（开始、中间、结束、边界），默认 true */
  events?: boolean
  /** 是否注册活动图形（任务、子流程等），默认 true */
  activities?: boolean
  /** 是否注册网关图形，默认 true */
  gateways?: boolean
  /** 是否注册数据元素图形，默认 true */
  data?: boolean
  /** 是否注册工件图形（文本注释、分组），默认 true */
  artifacts?: boolean
  /** 是否注册泳道图形（池、泳道），默认 true */
  swimlanes?: boolean
  /** 是否注册连接线图形（顺序流、消息流、关联），默认 true */
  connections?: boolean
}

/** 防止重复注册的标志 */
let registered = false

/**
 * 注册所有 BPMN 2.0 图形和连接线到 X6 全局注册表。
 * 多次调用安全，图形仅注册一次。
 */
export function registerBpmnShapes(options: BpmnPluginOptions = {}) {
  if (registered) return
  registered = true

  const {
    events = true,
    activities = true,
    gateways = true,
    data = true,
    artifacts = true,
    swimlanes = true,
    connections = true,
  } = options

  if (events) registerEventShapes()
  if (activities) registerActivityShapes()
  if (gateways) registerGatewayShapes()
  if (data) registerDataShapes()
  if (artifacts) registerArtifactShapes()
  if (swimlanes) registerSwimlaneShapes()
  if (connections) registerConnectionShapes()
}

/**
 * 强制重新注册所有图形（适用于热更新 / 开发场景）。
 */
export function forceRegisterBpmnShapes(options: BpmnPluginOptions = {}) {
  registered = false
  registerBpmnShapes(options)
}
