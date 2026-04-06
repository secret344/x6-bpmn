/**
 * 流程方言内核 — dialect 模块入口
 *
 * 推荐阅读顺序：
 * 1. types.ts：先看 Profile、ResolvedProfile、ProfileContext 等核心类型。
 * 2. registry.ts：看注册表如何管理 Profile。
 * 3. compiler.ts：看继承链如何编译为最终运行时结果。
 * 4. context.ts：看结果如何绑定到具体 graph 实例。
 * 5. detector.ts：看 XML 导入时如何自动识别方言。
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
