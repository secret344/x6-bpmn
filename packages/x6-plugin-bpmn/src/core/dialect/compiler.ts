/**
 * 流程方言内核 — Profile 编译器
 *
 * compileProfile() 解析 Profile 继承链，逐层合并六层配置，
 * 处理 $remove 删除语义，补齐默认值，校验引用合法性，
 * 输出只读的 ResolvedProfile。
 */

import type {
  Profile,
  ResolvedProfile,
  DefinitionsSet,
  AvailabilitySet,
  RenderingSet,
  RuleSet,
  DataModelSet,
  SerializationSet,
} from './types'
import { mergeProfileLayers } from './merge'
import type { ProfileRegistry } from './registry'

// ============================================================================
// 空默认值
// ============================================================================

/** 空的 DefinitionsSet */
function emptyDefinitions(): DefinitionsSet {
  return { nodes: {}, edges: {} }
}

/** 空的 AvailabilitySet */
function emptyAvailability(): AvailabilitySet {
  return { nodes: {}, edges: {} }
}

/** 空的 RenderingSet */
function emptyRendering(): RenderingSet {
  return {
    theme: { colors: {}, icons: {} },
    nodeRenderers: {},
    edgeRenderers: {},
  }
}

/** 空的 RuleSet */
function emptyRules(): RuleSet {
  return {
    nodeCategories: {},
    connectionRules: {},
    constraints: [],
  }
}

/** 空的 DataModelSet */
function emptyDataModel(): DataModelSet {
  return {
    fields: {},
    categoryFields: {},
  }
}

/** 空的 SerializationSet */
function emptySerialization(): SerializationSet {
  return {
    namespaces: {},
    nodeMapping: {},
    edgeMapping: {},
    processAttributes: {},
    nodeSerializers: {},
    edgeSerializers: {},
  }
}

// ============================================================================
// 编译器
// ============================================================================

/**
 * 编译指定 Profile，解析继承链并合并六层配置。
 *
 * 编译阶段职责：
 * 1. 解析继承链（从根到叶）
 * 2. 逐层合并各层配置
 * 3. 处理 $remove 删除语义
 * 4. 补齐默认值
 * 5. 校验引用合法性
 * 6. 输出只读 ResolvedProfile
 *
 * @param profileId — 要编译的 Profile ID
 * @param registry — Profile 注册表
 * @returns 编译后的 ResolvedProfile
 * @throws 若 profile 不存在、父 profile 缺失或循环继承
 */
export function compileProfile(profileId: string, registry: ProfileRegistry): ResolvedProfile {
  // 1. 获取继承链
  const chain = registry.getInheritanceChain(profileId)

  // 2. 验证所有 profile 都已注册
  for (const id of chain) {
    if (!registry.has(id)) {
      throw new Error(`Profile "${id}" not found in registry (required by inheritance chain of "${profileId}")`)
    }
  }

  // 3. 从空基础开始，逐层合并
  let merged: {
    definitions: DefinitionsSet
    availability: AvailabilitySet
    rendering: RenderingSet
    rules: RuleSet
    dataModel: DataModelSet
    serialization: SerializationSet
  } = {
    definitions: emptyDefinitions(),
    availability: emptyAvailability(),
    rendering: emptyRendering(),
    rules: emptyRules(),
    dataModel: emptyDataModel(),
    serialization: emptySerialization(),
  }

  for (const id of chain) {
    const profile = registry.get(id)!
    merged = mergeProfileLayers(merged, profile)
  }

  // 4. 补齐 availability 默认值（定义中存在但 availability 未设置的元素默认为 'enabled'）
  for (const nodeKey of Object.keys(merged.definitions.nodes)) {
    if (!(nodeKey in merged.availability.nodes)) {
      merged.availability.nodes[nodeKey] = 'enabled'
    }
  }
  for (const edgeKey of Object.keys(merged.definitions.edges)) {
    if (!(edgeKey in merged.availability.edges)) {
      merged.availability.edges[edgeKey] = 'enabled'
    }
  }

  // 5. 校验引用合法性
  validateReferences(merged, profileId)

  // 6. 构建最终 ResolvedProfile
  const leafProfile = registry.get(profileId)!
  const resolved: ResolvedProfile = {
    meta: { ...leafProfile.meta },
    ...merged,
  }

  return resolved
}

/**
 * 校验编译后的 profile 引用合法性。
 */
function validateReferences(
  merged: {
    definitions: DefinitionsSet
    availability: AvailabilitySet
    rendering: RenderingSet
    rules: RuleSet
    dataModel: DataModelSet
    serialization: SerializationSet
  },
  profileId: string,
): void {
  // 校验：所有启用的节点的 renderer 在 nodeRenderers 中存在
  for (const [nodeKey, nodeDef] of Object.entries(merged.definitions.nodes)) {
    const avail = merged.availability.nodes[nodeKey]
    if (avail === 'disabled') continue

    if (nodeDef.renderer && Object.keys(merged.rendering.nodeRenderers).length > 0) {
      if (!(nodeDef.renderer in merged.rendering.nodeRenderers)) {
        console.warn(
          `[dialect:${profileId}] Node "${nodeKey}" references renderer "${nodeDef.renderer}" which is not registered.`,
        )
      }
    }
  }

  // 校验：所有启用的边的 renderer 在 edgeRenderers 中存在
  for (const [edgeKey, edgeDef] of Object.entries(merged.definitions.edges)) {
    const avail = merged.availability.edges[edgeKey]
    if (avail === 'disabled') continue

    if (edgeDef.renderer && Object.keys(merged.rendering.edgeRenderers).length > 0) {
      if (!(edgeDef.renderer in merged.rendering.edgeRenderers)) {
        console.warn(
          `[dialect:${profileId}] Edge "${edgeKey}" references renderer "${edgeDef.renderer}" which is not registered.`,
        )
      }
    }
  }
}
