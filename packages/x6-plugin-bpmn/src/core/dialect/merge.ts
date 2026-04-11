/**
 * 流程方言内核 — 配置合并工具
 *
 * 支持深度合并、$remove 删除语义、数组合并等能力，
 * 用于 compileProfile() 中继承链的逐层合并。
 */

import { isRemoveMarker } from './types'
import type {
  Profile,
  DefinitionsSet,
  AvailabilitySet,
  RenderingSet,
  RuleSet,
  DataModelSet,
  SerializationSet,
  ConstraintRule,
} from './types'
import {
  cloneBpmnXmlNameSettings,
  mergeBpmnXmlNameSettings,
} from '../../utils/bpmn-xml-names'
import { mergeExtensionPropertySerialization } from '../../utils/extension-properties'

// ============================================================================
// 通用深度合并
// ============================================================================

/**
 * 深度合并两个 Record，支持 $remove 删除语义。
 * child 中的值覆盖 parent 中的值；若值为 { $remove: true } 则删除该 key。
 */
export function mergeRecords<T>(
  parent: Record<string, T>,
  child: Record<string, T | { $remove: true }>,
): Record<string, T> {
  const result = { ...parent }
  for (const [key, value] of Object.entries(child)) {
    if (isRemoveMarker(value)) {
      delete result[key]
    } else {
      result[key] = value as T
    }
  }
  return result
}

// ============================================================================
// 各层合并函数
// ============================================================================

/** 合并 definitions 层 */
export function mergeDefinitions(
  parent: DefinitionsSet,
  child: Partial<DefinitionsSet>,
): DefinitionsSet {
  return {
    nodes: child.nodes ? mergeRecords(parent.nodes, child.nodes as any) : { ...parent.nodes },
    edges: child.edges ? mergeRecords(parent.edges, child.edges as any) : { ...parent.edges },
  }
}

/** 合并 availability 层 */
export function mergeAvailability(
  parent: AvailabilitySet,
  child: Partial<AvailabilitySet>,
): AvailabilitySet {
  return {
    nodes: child.nodes ? { ...parent.nodes, ...child.nodes } : { ...parent.nodes },
    edges: child.edges ? { ...parent.edges, ...child.edges } : { ...parent.edges },
  }
}

/** 合并 rendering 层 */
export function mergeRendering(
  parent: RenderingSet,
  child: Partial<RenderingSet>,
): RenderingSet {
  return {
    theme: child.theme
      ? {
          colors: { ...parent.theme.colors, ...(child.theme.colors || {}) },
          icons: { ...parent.theme.icons, ...(child.theme.icons || {}) },
        }
      : { ...parent.theme, colors: { ...parent.theme.colors }, icons: { ...parent.theme.icons } },
    nodeRenderers: child.nodeRenderers
      ? { ...parent.nodeRenderers, ...child.nodeRenderers }
      : { ...parent.nodeRenderers },
    edgeRenderers: child.edgeRenderers
      ? { ...parent.edgeRenderers, ...child.edgeRenderers }
      : { ...parent.edgeRenderers },
  }
}

/** 合并 rules 层 */
export function mergeRules(
  parent: RuleSet,
  child: Partial<RuleSet>,
): RuleSet {
  return {
    nodeCategories: child.nodeCategories
      ? mergeRecords(parent.nodeCategories, child.nodeCategories as any)
      : { ...parent.nodeCategories },
    connectionRules: child.connectionRules
      ? mergeRecords(parent.connectionRules, child.connectionRules as any)
      : { ...parent.connectionRules },
    constraints: child.constraints
      ? mergeConstraints(parent.constraints, child.constraints)
      : [...parent.constraints],
  }
}

/** 合并约束规则（按 ID 去重，子级覆盖父级同 ID 规则） */
function mergeConstraints(
  parent: ConstraintRule[],
  child: ConstraintRule[],
): ConstraintRule[] {
  const result = new Map<string, ConstraintRule>()
  for (const rule of parent) {
    result.set(rule.id, rule)
  }
  for (const rule of child) {
    result.set(rule.id, rule)
  }
  return Array.from(result.values())
}

/** 合并 dataModel 层 */
export function mergeDataModel(
  parent: DataModelSet,
  child: Partial<DataModelSet>,
): DataModelSet {
  return {
    fields: child.fields
      ? mergeRecords(parent.fields, child.fields as any)
      : { ...parent.fields },
    categoryFields: child.categoryFields
      ? mergeCategoryFields(parent.categoryFields, child.categoryFields)
      : { ...parent.categoryFields },
    shapeFields: child.shapeFields
      ? mergeCategoryFields(parent.shapeFields || {}, child.shapeFields)
      : parent.shapeFields ? { ...parent.shapeFields } : undefined,
  }
}

/** 合并 category → fields 映射（数组合并去重） */
function mergeCategoryFields(
  parent: Record<string, string[]>,
  child: Record<string, string[]>,
): Record<string, string[]> {
  const result = { ...parent }
  for (const [key, fields] of Object.entries(child)) {
    if (result[key]) {
      result[key] = Array.from(new Set([...result[key], ...fields]))
    } else {
      result[key] = [...fields]
    }
  }
  return result
}

/** 合并 serialization 层 */
export function mergeSerialization(
  parent: SerializationSet,
  child: Partial<SerializationSet>,
): SerializationSet {
  return {
    namespaces: child.namespaces
      ? { ...parent.namespaces, ...child.namespaces }
      : { ...parent.namespaces },
    xmlNames: child.xmlNames
      ? mergeBpmnXmlNameSettings(parent.xmlNames, child.xmlNames)
      : cloneBpmnXmlNameSettings(parent.xmlNames),
    extensionProperties: mergeExtensionPropertySerialization(
      parent.extensionProperties,
      child.extensionProperties,
    ),
    nodeMapping: child.nodeMapping
      ? mergeRecords(parent.nodeMapping, child.nodeMapping as any)
      : { ...parent.nodeMapping },
    edgeMapping: child.edgeMapping
      ? mergeRecords(parent.edgeMapping, child.edgeMapping as any)
      : { ...parent.edgeMapping },
    targetNamespace: child.targetNamespace ?? parent.targetNamespace,
    processAttributes: child.processAttributes
      ? { ...(parent.processAttributes ?? {}), ...child.processAttributes }
      : { ...(parent.processAttributes ?? {}) },
    nodeSerializers: child.nodeSerializers
      ? { ...(parent.nodeSerializers ?? {}), ...child.nodeSerializers }
      : { ...(parent.nodeSerializers ?? {}) },
    edgeSerializers: child.edgeSerializers
      ? { ...(parent.edgeSerializers ?? {}), ...child.edgeSerializers }
      : { ...(parent.edgeSerializers ?? {}) },
  }
}

// ============================================================================
// 完整 Profile 合并
// ============================================================================

/**
 * 将子 Profile 合并到已编译的父 Profile 上。
 * 返回新的完整 profile 数据（不含 meta，由调用方处理）。
 */
export function mergeProfileLayers(
  parent: {
    definitions: DefinitionsSet
    availability: AvailabilitySet
    rendering: RenderingSet
    rules: RuleSet
    dataModel: DataModelSet
    serialization: SerializationSet
  },
  child: Profile,
): {
  definitions: DefinitionsSet
  availability: AvailabilitySet
  rendering: RenderingSet
  rules: RuleSet
  dataModel: DataModelSet
  serialization: SerializationSet
} {
  return {
    definitions: child.definitions
      ? mergeDefinitions(parent.definitions, child.definitions)
      : { ...parent.definitions, nodes: { ...parent.definitions.nodes }, edges: { ...parent.definitions.edges } },
    availability: child.availability
      ? mergeAvailability(parent.availability, child.availability)
      : { ...parent.availability, nodes: { ...parent.availability.nodes }, edges: { ...parent.availability.edges } },
    rendering: child.rendering
      ? mergeRendering(parent.rendering, child.rendering)
      : {
          ...parent.rendering,
          theme: { ...parent.rendering.theme, colors: { ...parent.rendering.theme.colors }, icons: { ...parent.rendering.theme.icons } },
          nodeRenderers: { ...parent.rendering.nodeRenderers },
          edgeRenderers: { ...parent.rendering.edgeRenderers },
        },
    rules: child.rules
      ? mergeRules(parent.rules, child.rules)
      : { ...parent.rules, nodeCategories: { ...parent.rules.nodeCategories }, connectionRules: { ...parent.rules.connectionRules }, constraints: [...parent.rules.constraints] },
    dataModel: child.dataModel
      ? mergeDataModel(parent.dataModel, child.dataModel)
      : { ...parent.dataModel, fields: { ...parent.dataModel.fields }, categoryFields: { ...parent.dataModel.categoryFields } },
    serialization: child.serialization
      ? mergeSerialization(parent.serialization, child.serialization)
      : {
          ...parent.serialization,
          namespaces: { ...parent.serialization.namespaces },
          xmlNames: cloneBpmnXmlNameSettings(parent.serialization.xmlNames),
          nodeMapping: { ...parent.serialization.nodeMapping },
          edgeMapping: { ...parent.serialization.edgeMapping },
          processAttributes: { ...(parent.serialization.processAttributes ?? {}) },
          nodeSerializers: { ...(parent.serialization.nodeSerializers ?? {}) },
          edgeSerializers: { ...(parent.serialization.edgeSerializers ?? {}) },
        },
  }
}
