/**
 * BPMN2 内置 Profile — 结构与编译测试
 *
 * 验证 bpmn2Profile 定义完整性和通过 ProfileRegistry 编译的结果。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { bpmn2Profile } from '../../../src/builtin/bpmn2/profile'
import { ProfileRegistry } from '../../../src/core/dialect/registry'

// ============================================================================
// bpmn2Profile
// ============================================================================

describe('bpmn2Profile', () => {
  it('meta 应有完整信息且无 parent', () => {
    expect(bpmn2Profile.meta.id).toBe('bpmn2')
    expect(bpmn2Profile.meta.parent).toBeUndefined()
  })

  it('definitions 应包含节点和边', () => {
    const nodes = Object.keys(bpmn2Profile.definitions!.nodes!)
    const edges = Object.keys(bpmn2Profile.definitions!.edges!)
    expect(nodes.length).toBeGreaterThan(20)
    expect(edges.length).toBeGreaterThan(3)
  })

  it('每个节点定义应有 shape, category, renderer', () => {
    for (const [key, def] of Object.entries(bpmn2Profile.definitions!.nodes!)) {
      expect(def.shape).toBe(key)
      expect(def.category).toBeTruthy()
      expect(def.renderer).toBeTruthy()
    }
  })

  it('每个边定义应有 shape, category, renderer', () => {
    for (const [key, def] of Object.entries(bpmn2Profile.definitions!.edges!)) {
      expect(def.shape).toBe(key)
      expect(def.category).toBeTruthy()
      expect(def.renderer).toBeTruthy()
    }
  })

  it('availability 应对所有节点和边都设为 enabled', () => {
    for (const v of Object.values(bpmn2Profile.availability!.nodes!)) {
      expect(v).toBe('enabled')
    }
    for (const v of Object.values(bpmn2Profile.availability!.edges!)) {
      expect(v).toBe('enabled')
    }
  })

  it('rendering 应包含 theme, nodeRenderers, edgeRenderers', () => {
    expect(bpmn2Profile.rendering!.theme).toBeDefined()
    expect(Object.keys(bpmn2Profile.rendering!.nodeRenderers!).length).toBeGreaterThan(5)
    expect(Object.keys(bpmn2Profile.rendering!.edgeRenderers!).length).toBeGreaterThan(3)
  })

  it('rules 应包含 constraints', () => {
    expect(bpmn2Profile.rules!.constraints!.length).toBeGreaterThanOrEqual(2)
  })

  it('dataModel 应包含字段和分类映射', () => {
    expect(Object.keys(bpmn2Profile.dataModel!.fields!).length).toBeGreaterThan(10)
    expect(Object.keys(bpmn2Profile.dataModel!.categoryFields!).length).toBeGreaterThan(5)
  })

  it('serialization 应包含标准命名空间', () => {
    expect(bpmn2Profile.serialization!.namespaces!.bpmn).toContain('omg.org')
    expect(bpmn2Profile.serialization!.namespaces!.bpmndi).toContain('omg.org')
  })
})

// ============================================================================
// 通过 ProfileRegistry 编译 bpmn2Profile
// ============================================================================

describe('ProfileRegistry 编译 bpmn2Profile', () => {
  let registry: ProfileRegistry

  beforeEach(() => {
    registry = new ProfileRegistry()
    registry.register(bpmn2Profile)
  })

  it('应能编译 bpmn2（无继承）', () => {
    const resolved = registry.compile('bpmn2')
    expect(resolved.meta.id).toBe('bpmn2')
    expect(Object.keys(resolved.definitions.nodes).length).toBeGreaterThan(20)
    expect(Object.keys(resolved.definitions.edges).length).toBeGreaterThan(3)
  })
})

// ============================================================================
// bpmn2Profile 字段能力函数调用覆盖
// ============================================================================

describe('bpmn2Profile — 字段 normalize/serialize/deserialize', () => {
  const fields = bpmn2Profile.dataModel!.fields!

  it('所有字段应有 normalize 函数', () => {
    for (const [key, f] of Object.entries(fields)) {
      expect(typeof f.normalize, `${key} 缺少 normalize`).toBe('function')
    }
  })

  it('string normalize 应将 null/undefined 转字符串', () => {
    expect(fields.assignee.normalize(null)).toBe('')
    expect(fields.assignee.normalize(undefined)).toBe('')
    expect(fields.assignee.normalize('user1')).toBe('user1')
  })

  it('candidateUsers normalize', () => {
    expect(fields.candidateUsers.normalize('a,b')).toBe('a,b')
    expect(fields.candidateUsers.normalize(null)).toBe('')
  })

  it('candidateGroups normalize', () => {
    expect(fields.candidateGroups.normalize(null)).toBe('')
  })

  it('formKey normalize', () => {
    expect(fields.formKey.normalize('form1')).toBe('form1')
    expect(fields.formKey.normalize(undefined)).toBe('')
  })

  it('dueDate normalize', () => {
    expect(fields.dueDate.normalize(null)).toBe('')
  })

  it('priority normalize', () => {
    expect(fields.priority.normalize('5')).toBe('5')
    expect(fields.priority.normalize(undefined)).toBe('')
  })

  it('implementationType normalize', () => {
    expect(fields.implementationType.normalize(null)).toBe('')
  })

  it('implementation normalize', () => {
    expect(fields.implementation.normalize('class')).toBe('class')
    expect(fields.implementation.normalize(undefined)).toBe('')
  })

  it('resultVariable normalize', () => {
    expect(fields.resultVariable.normalize(null)).toBe('')
  })

  it('isAsync normalize + serialize + deserialize', () => {
    expect(fields.isAsync.normalize(true)).toBe(true)
    expect(fields.isAsync.normalize(false)).toBe(false)
    expect(fields.isAsync.normalize(null)).toBe(false)
    expect(fields.isAsync.serialize!(true)).toBe('true')
    expect(fields.isAsync.serialize!(false)).toBe('false')
    expect(fields.isAsync.deserialize!('true')).toBe(true)
    expect(fields.isAsync.deserialize!('false')).toBe(false)
    expect(fields.isAsync.deserialize!(true)).toBe(true)
  })

  it('scriptFormat normalize', () => {
    expect(fields.scriptFormat.normalize('groovy')).toBe('groovy')
    expect(fields.scriptFormat.normalize(undefined)).toBe('')
  })

  it('script normalize', () => {
    expect(fields.script.normalize(null)).toBe('')
  })

  it('calledElement normalize', () => {
    expect(fields.calledElement.normalize('proc1')).toBe('proc1')
    expect(fields.calledElement.normalize(undefined)).toBe('')
  })

  it('triggeredByEvent normalize (boolean)', () => {
    expect(fields.triggeredByEvent.normalize(true)).toBe(true)
    expect(fields.triggeredByEvent.normalize(false)).toBe(false)
  })

  it('defaultFlow normalize', () => {
    expect(fields.defaultFlow.normalize(null)).toBe('')
  })

  it('activationCondition normalize', () => {
    expect(fields.activationCondition.normalize(null)).toBe('')
  })

  it('timerType normalize (default fallback)', () => {
    expect(fields.timerType.normalize(null)).toBe('timeDuration')
    expect(fields.timerType.normalize('timeDate')).toBe('timeDate')
  })

  it('timerValue normalize', () => {
    expect(fields.timerValue.normalize(null)).toBe('')
  })

  it('messageRef normalize', () => {
    expect(fields.messageRef.normalize(null)).toBe('')
  })

  it('messageName normalize', () => {
    expect(fields.messageName.normalize('msg')).toBe('msg')
    expect(fields.messageName.normalize(undefined)).toBe('')
  })

  it('signalRef normalize', () => {
    expect(fields.signalRef.normalize(null)).toBe('')
  })

  it('signalName normalize', () => {
    expect(fields.signalName.normalize('sig')).toBe('sig')
    expect(fields.signalName.normalize(undefined)).toBe('')
  })

  it('errorRef normalize', () => {
    expect(fields.errorRef.normalize(null)).toBe('')
  })

  it('errorCode normalize', () => {
    expect(fields.errorCode.normalize('ERR01')).toBe('ERR01')
    expect(fields.errorCode.normalize(undefined)).toBe('')
  })

  it('escalationRef normalize', () => {
    expect(fields.escalationRef.normalize(null)).toBe('')
  })

  it('escalationCode normalize', () => {
    expect(fields.escalationCode.normalize(null)).toBe('')
  })

  it('conditionExpression normalize', () => {
    expect(fields.conditionExpression.normalize('${x > 1}')).toBe('${x > 1}')
    expect(fields.conditionExpression.normalize(undefined)).toBe('')
  })

  it('linkName normalize', () => {
    expect(fields.linkName.normalize(null)).toBe('')
  })

  it('activityRef normalize', () => {
    expect(fields.activityRef.normalize(null)).toBe('')
  })

  it('cancelActivity normalize', () => {
    expect(fields.cancelActivity.normalize(true)).toBe(true)
    expect(fields.cancelActivity.normalize(false)).toBe(false)
    expect(fields.cancelActivity.normalize(undefined)).toBe(true)
  })

  it('isCollection normalize', () => {
    expect(fields.isCollection.normalize(true)).toBe(true)
    expect(fields.isCollection.normalize(false)).toBe(false)
  })

  it('processRef normalize', () => {
    expect(fields.processRef.normalize(null)).toBe('')
  })

  it('annotationText normalize', () => {
    expect(fields.annotationText.normalize(null)).toBe('')
  })

  it('categoryValueRef normalize', () => {
    expect(fields.categoryValueRef.normalize(null)).toBe('')
  })
})
