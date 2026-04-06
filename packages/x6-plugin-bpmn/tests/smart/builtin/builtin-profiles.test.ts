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
    expect(smartengineBaseProfile.serialization!.namespaces!.smart).toContain('smartengine')
  })

  it('应添加 SmartEngine 公共字段', () => {
    const fields = smartengineBaseProfile.dataModel!.fields!
    expect(fields.smartAction).toBeDefined()
    expect(fields.smartType).toBeDefined()
    expect(fields.smartRetry).toBeDefined()
    expect(fields.smartTimeout).toBeDefined()
  })

  it('smartRetry 应有 validate', () => {
    const smartRetry = smartengineBaseProfile.dataModel!.fields!.smartRetry
    expect(smartRetry.validate!(-1, {} as any)).toContain('非负')
    expect(smartRetry.validate!(3, {} as any)).toBe(true)
  })

  it('smartRetry normalize 应返回数字', () => {
    const f = smartengineBaseProfile.dataModel!.fields!.smartRetry
    expect(f.normalize(3)).toBe(3)
    expect(f.normalize('abc')).toBe(0)
    expect(f.normalize(null)).toBe(0)
  })

  it('smartAction normalize', () => {
    const f = smartengineBaseProfile.dataModel!.fields!.smartAction
    expect(f.normalize(null)).toBe('')
    expect(f.normalize('action1')).toBe('action1')
  })

  it('smartType normalize', () => {
    const f = smartengineBaseProfile.dataModel!.fields!.smartType
    expect(f.normalize(null)).toBe('')
  })

  it('smartTimeout normalize', () => {
    const f = smartengineBaseProfile.dataModel!.fields!.smartTimeout
    expect(f.normalize(null)).toBe('')
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

  it('应禁用 user-task 和 manual-task', () => {
    expect(smartengineCustomProfile.availability!.nodes!['bpmn-user-task']).toBe('disabled')
    expect(smartengineCustomProfile.availability!.nodes!['bpmn-manual-task']).toBe('disabled')
  })

  it('应有 forbiddenShapes 约束', () => {
    expect(smartengineCustomProfile.rules!.constraints!.length).toBeGreaterThanOrEqual(1)
  })

  it('应添加服务编排相关字段', () => {
    const fields = smartengineCustomProfile.dataModel!.fields!
    expect(fields.smartServiceName).toBeDefined()
    expect(fields.smartServiceVersion).toBeDefined()
  })

  it('smartServiceName normalize', () => {
    const f = smartengineCustomProfile.dataModel!.fields!.smartServiceName
    expect(f.normalize(null)).toBe('')
    expect(f.normalize('svc')).toBe('svc')
  })

  it('smartServiceVersion normalize', () => {
    const f = smartengineCustomProfile.dataModel!.fields!.smartServiceVersion
    expect(f.normalize(null)).toBe('')
  })

  it('smartServiceGroup normalize', () => {
    const f = smartengineCustomProfile.dataModel!.fields!.smartServiceGroup
    expect(f.normalize(null)).toBe('')
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

  it('应禁用 complex-gateway 和 ad-hoc-sub-process', () => {
    expect(smartengineDatabaseProfile.availability!.nodes!['bpmn-complex-gateway']).toBe('disabled')
    expect(smartengineDatabaseProfile.availability!.nodes!['bpmn-ad-hoc-sub-process']).toBe('disabled')
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
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstance
    expect(f.normalize(true)).toBe(true)
    expect(f.normalize(false)).toBe(false)
  })

  it('multiInstanceType normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstanceType
    expect(f.normalize('sequential')).toBe('sequential')
    expect(f.normalize('parallel')).toBe('parallel')
    expect(f.normalize('invalid')).toBe('parallel')
  })

  it('approvalType normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.approvalType
    expect(f.normalize(null)).toBe('')
  })

  it('approvalStrategy normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.approvalStrategy
    expect(f.normalize(null)).toBe('any')
  })

  it('multiInstanceCollection normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstanceCollection
    expect(f.normalize(null)).toBe('')
  })

  it('multiInstanceElementVariable normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstanceElementVariable
    expect(f.normalize(null)).toBe('')
  })

  it('multiInstanceCompletionCondition normalize', () => {
    const f = smartengineDatabaseProfile.dataModel!.fields!.multiInstanceCompletionCondition
    expect(f.normalize(null)).toBe('')
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
    expect(resolved.dataModel.fields.smartAction).toBeDefined()
    expect(resolved.dataModel.fields.assignee).toBeDefined()
    expect(resolved.serialization.namespaces.smart).toContain('smartengine')
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
    expect(resolved.availability.nodes['bpmn-manual-task']).toBe('disabled')
    expect(resolved.availability.nodes['bpmn-service-task']).toBe('enabled')
  })

  it('smartengine-database 编译后应合并多实例字段', () => {
    const resolved = registry.compile('smartengine-database')
    expect(resolved.dataModel.fields.multiInstance).toBeDefined()
    expect(resolved.dataModel.fields.multiInstanceType).toBeDefined()
    expect(resolved.dataModel.fields.assignee).toBeDefined()
    expect(resolved.dataModel.fields.smartAction).toBeDefined()
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
