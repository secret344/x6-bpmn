/**
 * 规则预设模块
 *
 * 提供可扩展的规则预设体系，内置 BPMN 2.0 和 SmartEngine 两套预设。
 * 用户可以基于任意预设创建自定义规则集。
 *
 * @example
 * ```ts
 * import {
 *   resolvePreset,
 *   createExtendedPreset,
 * } from '@x6-bpmn2/plugin'
 *
 * // 使用内置 SmartEngine 预设
 * const rules = resolvePreset('smartengine')
 *
 * // 基于 SmartEngine 创建自定义预设
 * createExtendedPreset('my-rules', 'smartengine', {
 *   connectionRules: {
 *     startEvent: { maxOutgoing: 2 },
 *   },
 * })
 * const myRules = resolvePreset('my-rules')
 * ```
 */

// 类型导出
export type {
  NodePropertyDefinition,
  CustomValidationContext,
  BpmnCustomValidator,
  BpmnRulePreset,
  ResolvedBpmnRulePreset,
} from './types'

export type {
  SerializationAdapter,
  ExportContext,
  ImportContext,
} from './serialization-adapter'

// 注册中心
export {
  registerPreset,
  unregisterPreset,
  getPreset,
  listPresets,
  clearPresets,
  resolvePreset,
  createExtendedPreset,
} from './registry'

export {
  registerSerializationAdapter,
  unregisterSerializationAdapter,
  getSerializationAdapter,
  listSerializationAdapters,
  clearSerializationAdapters,
} from './serialization-adapter'

// 内置预设
export { BPMN2_PRESET } from './bpmn2'
export { SMARTENGINE_PRESET } from './smartengine'

// 内置序列化适配器
export { bpmn2SerializationAdapter } from './bpmn2-adapter'
export { smartEngineSerializationAdapter } from './smartengine-adapter'

// ============================================================================
// 自动注册内置预设和序列化适配器
// ============================================================================

import { registerPreset, getPreset } from './registry'
import { BPMN2_PRESET } from './bpmn2'
import { SMARTENGINE_PRESET } from './smartengine'
import {
  registerSerializationAdapter,
  getSerializationAdapter,
} from './serialization-adapter'
import { bpmn2SerializationAdapter } from './bpmn2-adapter'
import { smartEngineSerializationAdapter } from './smartengine-adapter'

/** 注册内置预设（仅在未注册时执行） */
function registerBuiltinPresets(): void {
  if (!getPreset('bpmn2')) {
    registerPreset(BPMN2_PRESET)
  }
  if (!getPreset('smartengine')) {
    registerPreset(SMARTENGINE_PRESET)
  }
}

/** 注册内置序列化适配器（仅在未注册时执行） */
function registerBuiltinAdapters(): void {
  if (!getSerializationAdapter('bpmn2')) {
    registerSerializationAdapter(bpmn2SerializationAdapter)
  }
  if (!getSerializationAdapter('smartengine')) {
    registerSerializationAdapter(smartEngineSerializationAdapter)
  }
}

// 模块加载时自动注册内置预设和适配器
registerBuiltinPresets()
registerBuiltinAdapters()
