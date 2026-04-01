/**
 * 流程方言内核 — dialect 模块入口
 */

// 类型定义
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
  FieldValidateContext,
  FieldCapability,
  DataModelSet,
  SerializationSet,
  DialectMeta,
  RemoveMarker,
  Profile,
  ResolvedProfile,
  ProfileContext,
  DialectDetectorInterface,
  ExporterAdapter,
  ImporterAdapter,
} from './types'

export { isRemoveMarker } from './types'

// 注册表
export { ProfileRegistry, createProfileRegistry } from './registry'

// 编译器
export { compileProfile } from './compiler'

// 合并工具
export {
  mergeRecords,
  mergeDefinitions,
  mergeAvailability,
  mergeRendering,
  mergeRules,
  mergeDataModel,
  mergeSerialization,
  mergeProfileLayers,
} from './merge'

// 上下文与绑定
export {
  createProfileContext,
  bindProfileToGraph,
  getProfileContext,
  unbindProfile,
} from './context'

// 检测器
export {
  DialectDetector,
  createDialectDetector,
  smartEngineNamespaceRule,
} from './detector'
export type { DialectDetectRule } from './detector'
