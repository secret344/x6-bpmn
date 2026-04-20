/**
 * SmartEngine 内置 Profile — 结构与编译测试
 *
 * 验证 smartengine-base、smartengine-custom、smartengine-database
 * 三套 SmartEngine Profile 的定义完整性、继承正确性以及通过 ProfileRegistry 编译的结果。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { bpmn2Profile } from '../../../src/builtin/bpmn2/profile'
import { smartengineBaseProfile } from '../../../src/builtin/smartengine-base/profile'
import { smartengineCustomProfile } from '../../../src/builtin/smartengine-custom/profile'
import { smartengineDatabaseProfile } from '../../../src/builtin/smartengine-database/profile'
import { ProfileRegistry } from '../../../src/core/dialect/registry'

function getField(profile: typeof smartengineBaseProfile, fieldName: string) {
  const field = profile.dataModel?.fields?.[fieldName]
  expect(field).toBeDefined()
  return field!
}

// ============================================================================
// smartengineBaseProfile
// ============================================================================

describe('smartengineBaseProfile', () => {
  it('meta 应继承 bpmn2', () => {
    expect(smartengineBaseProfile.meta.id).toBe('smartengine-base')
    expect(smartengineBaseProfile.meta.parent).toBe('bpmn2')
  })

  it('应在 SmartEngine 层定义单开始事件限制', () => {
    expect(smartengineBaseProfile.rules!.constraints!.map((rule) => rule.id)).toContain('start-event-limit')
  })

  it('应定义 SmartEngine 命名空间', () => {
    expect(smartengineBaseProfile.serialization!.namespaces!.smart).toBe('http://smartengine.org/schema/process')
    expect(smartengineBaseProfile.serialization!.targetNamespace).toBe('Examples')
    expect(smartengineBaseProfile.serialization!.processAttributes).toEqual({ version: '1.0.0' })
  })

  it('应添加 SmartEngine 公共字段', () => {
    const fields = smartengineBaseProfile.dataModel!.fields!
    expect(fields.smartClass).toBeDefined()
    expect(fields.smartProperties).toBeDefined()
    expect(fields.smartExecutionListeners).toBeDefined()
  })

  it('smartClass normalize 应去除首尾空白', () => {
    const f = getField(smartengineBaseProfile, 'smartClass')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!('  com.example.Delegation  ')).toBe('com.example.Delegation')
  })

  it('smartProperties normalize/validate 应符合 wiki 的 property 数组格式', () => {
    const f = getField(smartengineBaseProfile, 'smartProperties')
    expect(f.normalize).toBeDefined()
    expect(f.validate).toBeDefined()

    expect(f.normalize!([{ name: 'value', value: 'right' }])).toBe('[{"name":"value","value":"right"}]')
    expect(f.validate!('[{"name":"value","value":"right"}]', {} as any)).toBe(true)
    expect(f.validate!('[{"value":"right"}]', {} as any)).toBe('smartProperties 每项都必须包含 name')
  })

  it('smartExecutionListeners normalize/validate 应符合 wiki 的 listener 数组格式', () => {
    const f = getField(smartengineBaseProfile, 'smartExecutionListeners')
    expect(f.normalize).toBeDefined()
    expect(f.validate).toBeDefined()

    expect(f.normalize!([{ event: 'ACTIVITY_START', class: 'com.example.StartListener' }]))
      .toBe('[{"event":"ACTIVITY_START","class":"com.example.StartListener"}]')
    expect(f.validate!('[{"event":"ACTIVITY_START","class":"com.example.StartListener"}]', {} as any)).toBe(true)
    expect(f.validate!('[{"event":"ACTIVITY_START"}]', {} as any)).toBe('smartExecutionListeners 每项都必须包含 event 和 class')
  })
})

// ============================================================================
// smartengineCustomProfile
// ============================================================================

describe('smartengineCustomProfile', () => {
  it('meta 应继承 smartengine-base', () => {
    expect(smartengineCustomProfile.meta.id).toBe('smartengine-custom')
    expect(smartengineCustomProfile.meta.parent).toBe('smartengine-base')
  })

  it('应禁用仅限 DataBase 模式的 user-task 和 inclusive-gateway', () => {
    expect(smartengineCustomProfile.availability!.nodes!['bpmn-user-task']).toBe('disabled')
    expect(smartengineCustomProfile.availability!.nodes!['bpmn-inclusive-gateway']).toBe('disabled')
  })

  it('应有 forbiddenShapes 约束', () => {
    expect(smartengineCustomProfile.rules!.constraints!.length).toBeGreaterThanOrEqual(1)
  })

  it('不应再定义旧的服务编排遗留字段', () => {
    expect(smartengineCustomProfile.dataModel).toBeUndefined()
  })
})

// ============================================================================
// smartengineDatabaseProfile
// ============================================================================

describe('smartengineDatabaseProfile', () => {
  it('meta 应继承 smartengine-base', () => {
    expect(smartengineDatabaseProfile.meta.id).toBe('smartengine-database')
    expect(smartengineDatabaseProfile.meta.parent).toBe('smartengine-base')
  })

  it('不应额外裁剪 BPMN 2.0 节点可用性', () => {
    expect(smartengineDatabaseProfile.availability).toBeUndefined()
  })

  it('应添加多实例和审批字段', () => {
    const fields = smartengineDatabaseProfile.dataModel!.fields!
    expect(fields.multiInstance).toBeDefined()
    expect(fields.multiInstanceType).toBeDefined()
    expect(fields.approvalType).toBeDefined()
    expect(fields.approvalStrategy).toBeDefined()
  })

  it('multiInstanceType.validate 应校验合法值', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstanceType
    expect(f.validate!('parallel', {} as any)).toBe(true)
    expect(f.validate!('sequential', {} as any)).toBe(true)
    expect(typeof f.validate!('invalid', {} as any)).toBe('string')
  })

  it('multiInstance normalize (boolean)', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstance')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(true)).toBe(true)
    expect(f.normalize!(false)).toBe(false)
  })

  it('multiInstanceType normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstanceType')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!('sequential')).toBe('sequential')
    expect(f.normalize!('parallel')).toBe('parallel')
    expect(f.normalize!('invalid')).toBe('parallel')
  })

  it('approvalType normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'approvalType')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('')
  })

  it('approvalStrategy normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'approvalStrategy')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('any')
  })

  it('multiInstanceCollection normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstanceCollection')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('')
  })

  it('multiInstanceElementVariable normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstanceElementVariable')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('')
  })

  it('multiInstanceCompletionCondition normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstanceCompletionCondition')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('')
  })

  it('multiInstanceAbortCondition normalize', () => {
    const f = getField(smartengineDatabaseProfile as typeof smartengineBaseProfile, 'multiInstanceAbortCondition')
    expect(f.normalize).toBeDefined()
    expect(f.normalize!(null)).toBe('')
  })
})

// ============================================================================
// 通过 ProfileRegistry 编译 SmartEngine 集成测试
// ============================================================================

describe('ProfileRegistry 编译 SmartEngine profiles', () => {
  let registry: ProfileRegistry

  beforeEach(() => {
    registry = new ProfileRegistry()
    registry.registerAll([
      bpmn2Profile,
      smartengineBaseProfile,
      smartengineCustomProfile,
      smartengineDatabaseProfile,
    ])
  })

  it('smartengine-base 编译后应包含 bpmn2 全量元素 + SE 字段', () => {
    const resolved = registry.compile('smartengine-base')
    expect(Object.keys(resolved.definitions.nodes).length).toBeGreaterThan(20)
    expect(resolved.dataModel.fields.smartClass).toBeDefined()
    expect(resolved.dataModel.fields.smartProperties).toBeDefined()
    expect(resolved.dataModel.fields.assignee).toBeDefined()
    expect(resolved.serialization.namespaces.smart).toBe('http://smartengine.org/schema/process')
    expect(resolved.serialization.targetNamespace).toBe('Examples')
    expect(resolved.serialization.processAttributes).toEqual({ version: '1.0.0' })
    expect(resolved.serialization.namespaces.bpmn).toContain('omg.org')
    expect(resolved.rules.constraints.map((rule) => rule.id)).toEqual([
      'require-start-event',
      'require-end-event',
      'start-event-limit',
    ])
  })

  it('smartengine-custom 编译后应有 disabled 节点', () => {
    const resolved = registry.compile('smartengine-custom')
    expect(resolved.availability.nodes['bpmn-user-task']).toBe('disabled')
    expect(resolved.availability.nodes['bpmn-inclusive-gateway']).toBe('disabled')
    expect(resolved.availability.nodes['bpmn-manual-task']).toBe('enabled')
    expect(resolved.availability.nodes['bpmn-service-task']).toBe('enabled')
  })

  it('smartengine-database 编译后应合并多实例字段', () => {
    const resolved = registry.compile('smartengine-database')
    expect(resolved.dataModel.fields.multiInstance).toBeDefined()
    expect(resolved.dataModel.fields.multiInstanceType).toBeDefined()
    expect(resolved.dataModel.fields.multiInstanceAbortCondition).toBeDefined()
    expect(resolved.dataModel.fields.assignee).toBeDefined()
    expect(resolved.dataModel.fields.smartClass).toBeDefined()
    expect(resolved.availability.nodes['bpmn-inclusive-gateway']).toBe('enabled')
    expect(resolved.availability.nodes['bpmn-complex-gateway']).toBe('enabled')
  })

  it('继承链应正确', () => {
    expect(registry.getInheritanceChain('smartengine-custom')).toEqual([
      'bpmn2',
      'smartengine-base',
      'smartengine-custom',
    ])
    expect(registry.getInheritanceChain('smartengine-database')).toEqual([
      'bpmn2',
      'smartengine-base',
      'smartengine-database',
    ])
  })
})
