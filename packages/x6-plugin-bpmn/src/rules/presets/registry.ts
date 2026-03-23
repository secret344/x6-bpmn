/**
 * 规则预设注册中心
 *
 * 提供预设的注册、查询、解析（继承链展平）和合并功能。
 * 支持多级继承，子预设自动继承并可覆盖父预设的规则。
 */

import { DEFAULT_CONNECTION_RULES, type BpmnNodeCategory, type BpmnConnectionRule } from '../connection-rules'
import type {
  BpmnRulePreset,
  ResolvedBpmnRulePreset,
  NodePropertyDefinition,
  BpmnCustomValidator,
  SerializationAdapter,
} from './types'

// ============================================================================
// 预设存储
// ============================================================================

/** 已注册的预设表（name → preset） */
const presetRegistry = new Map<string, BpmnRulePreset>()

/** 解析缓存，避免重复展平继承链 */
const resolvedCache = new Map<string, ResolvedBpmnRulePreset>()

// ============================================================================
// 注册 / 查询 API
// ============================================================================

/**
 * 注册一个规则预设
 *
 * @param preset 要注册的预设配置
 * @throws 如果预设名称已存在，将抛出错误
 *
 * @example
 * ```ts
 * registerPreset({
 *   name: 'my-rules',
 *   extends: 'bpmn2',
 *   connectionRules: { startEvent: { maxOutgoing: 1 } },
 * })
 * ```
 */
export function registerPreset(preset: BpmnRulePreset): void {
  if (presetRegistry.has(preset.name)) {
    throw new Error(`规则预设 "${preset.name}" 已注册，请使用不同的名称或先调用 unregisterPreset() 移除`)
  }
  presetRegistry.set(preset.name, preset)
  // 注册新预设时清除缓存，因为可能影响已有预设的继承链
  resolvedCache.clear()
}

/**
 * 移除已注册的预设
 *
 * @param name 预设名称
 * @returns 是否成功移除
 */
export function unregisterPreset(name: string): boolean {
  const result = presetRegistry.delete(name)
  if (result) {
    resolvedCache.clear()
  }
  return result
}

/**
 * 获取已注册的预设原始配置（未展平继承链）
 *
 * @param name 预设名称
 * @returns 预设配置，不存在时返回 undefined
 */
export function getPreset(name: string): BpmnRulePreset | undefined {
  return presetRegistry.get(name)
}

/**
 * 列出所有已注册预设的名称
 */
export function listPresets(): string[] {
  return Array.from(presetRegistry.keys())
}

/**
 * 清除所有已注册的预设（含内置预设）
 *
 * 通常仅用于测试场景。
 */
export function clearPresets(): void {
  presetRegistry.clear()
  resolvedCache.clear()
}

// ============================================================================
// 预设解析（继承链展平）
// ============================================================================

/**
 * 解析预设，展平继承链后返回完整的规则集
 *
 * 解析流程：
 * 1. 从目标预设开始，沿 extends 链向上查找所有父预设
 * 2. 从最顶层的父预设（或 DEFAULT_CONNECTION_RULES）开始逐层合并
 * 3. 子预设的规则覆盖父预设的同名规则
 *
 * @param name 预设名称
 * @returns 解析后的完整规则集
 * @throws 如果预设不存在或存在循环继承
 */
export function resolvePreset(name: string): ResolvedBpmnRulePreset {
  // 缓存命中
  const cached = resolvedCache.get(name)
  if (cached) return cached

  // 收集继承链（从子到父）
  const chain: BpmnRulePreset[] = []
  const visited = new Set<string>()
  let current: string | undefined = name

  while (current) {
    if (visited.has(current)) {
      throw new Error(`规则预设继承链中存在循环引用: ${Array.from(visited).join(' → ')} → ${current}`)
    }
    visited.add(current)

    const preset = presetRegistry.get(current)
    if (!preset) {
      throw new Error(`规则预设 "${current}" 未注册`)
    }
    chain.push(preset)
    current = preset.extends
  }

  // 反转为从父到子的顺序
  chain.reverse()

  // 从 DEFAULT_CONNECTION_RULES 开始逐层合并
  const resolved: ResolvedBpmnRulePreset = {
    name,
    description: chain[chain.length - 1].description,
    connectionRules: { ...DEFAULT_CONNECTION_RULES },
    nodeProperties: {},
    validators: [],
    shapeCategoryOverrides: {},
    shapeLabelOverrides: {},
    serialization: {},
  }

  for (const preset of chain) {
    mergePresetInto(resolved, preset)
  }

  resolvedCache.set(name, resolved)
  return resolved
}

// ============================================================================
// 合并逻辑
// ============================================================================

/**
 * 将一个预设的规则合并到已有的解析结果中
 */
function mergePresetInto(target: ResolvedBpmnRulePreset, source: BpmnRulePreset): void {
  // 合并连线规则（逐分类合并，子预设覆盖父预设的字段）
  if (source.connectionRules) {
    for (const [key, rule] of Object.entries(source.connectionRules)) {
      const category = key as BpmnNodeCategory
      target.connectionRules[category] = {
        ...target.connectionRules[category],
        ...rule,
      }
    }
  }

  // 合并节点属性定义（同名 key 的子预设属性覆盖父预设，新 key 追加）
  if (source.nodeProperties) {
    for (const [category, properties] of Object.entries(source.nodeProperties)) {
      const existing = target.nodeProperties[category] || []
      const existingKeys = new Set(existing.map(p => p.key))

      // 子预设中与父预设同 key 的属性替换，新 key 追加
      const merged: NodePropertyDefinition[] = existing.map(p => {
        const override = properties.find(sp => sp.key === p.key)
        return override ?? p
      })

      // 追加子预设中的新属性
      for (const prop of properties) {
        if (!existingKeys.has(prop.key)) {
          merged.push(prop)
        }
      }

      target.nodeProperties[category] = merged
    }
  }

  // 合并验证器（追加，同名验证器替换）
  if (source.validators) {
    for (const validator of source.validators) {
      const existingIndex = target.validators.findIndex(v => v.name === validator.name)
      if (existingIndex >= 0) {
        target.validators[existingIndex] = validator
      } else {
        target.validators.push(validator)
      }
    }
  }

  // 合并分类覆盖
  if (source.shapeCategoryOverrides) {
    Object.assign(target.shapeCategoryOverrides, source.shapeCategoryOverrides)
  }

  // 合并标签覆盖
  if (source.shapeLabelOverrides) {
    Object.assign(target.shapeLabelOverrides, source.shapeLabelOverrides)
  }

  // 合并序列化适配器（子预设的字段覆盖父预设，xmlNamespaces 合并）
  if (source.serialization) {
    mergeSerializationInto(target.serialization, source.serialization)
  }
}

/**
 * 将序列化适配器合并到目标适配器中
 * xmlNamespaces 和 processAttributes 为合并模式，其他字段为覆盖模式
 */
function mergeSerializationInto(target: SerializationAdapter, source: SerializationAdapter): void {
  if (source.xmlNamespaces) {
    target.xmlNamespaces = { ...(target.xmlNamespaces || {}), ...source.xmlNamespaces }
  }
  if (source.processAttributes) {
    target.processAttributes = { ...(target.processAttributes || {}), ...source.processAttributes }
  }
  if (source.targetNamespace !== undefined) target.targetNamespace = source.targetNamespace
  if (source.includeDI !== undefined) target.includeDI = source.includeDI
  if (source.conditionExpressionType !== undefined) target.conditionExpressionType = source.conditionExpressionType
  if (source.transformExportNode !== undefined) target.transformExportNode = source.transformExportNode
  if (source.transformExportEdge !== undefined) target.transformExportEdge = source.transformExportEdge
  if (source.transformImportNode !== undefined) target.transformImportNode = source.transformImportNode
  if (source.transformImportEdge !== undefined) target.transformImportEdge = source.transformImportEdge
}

// ============================================================================
// 便捷工厂函数
// ============================================================================

/**
 * 创建一个继承指定父预设的新预设
 *
 * 快捷方式，等同于手动创建 BpmnRulePreset 并设置 extends 字段。
 *
 * @param name 新预设名称
 * @param parentName 父预设名称
 * @param overrides 要覆盖或追加的规则
 * @returns 创建的预设对象（已自动注册）
 *
 * @example
 * ```ts
 * createExtendedPreset('my-rules', 'smartengine', {
 *   connectionRules: {
 *     startEvent: { maxOutgoing: 1 },
 *   },
 * })
 * ```
 */
export function createExtendedPreset(
  name: string,
  parentName: string,
  overrides: Omit<BpmnRulePreset, 'name' | 'extends'> = {},
): BpmnRulePreset {
  const preset: BpmnRulePreset = {
    ...overrides,
    name,
    extends: parentName,
  }
  registerPreset(preset)
  return preset
}
