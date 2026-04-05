/**
 * 规则与约束 — 单元测试
 *
 * 覆盖：
 * - constraints: createStartEventLimit, createEndEventLimit, requireStartEvent,
 *   requireEndEvent, createForbiddenShapes, validateConstraints
 * - validator: validateConnectionWithContext, createContextValidateConnection
 */

import { describe, it, expect } from 'vitest'
import {
  createStartEventLimit,
  createEndEventLimit,
  requireStartEvent,
  requireEndEvent,
  createForbiddenShapes,
  validateConstraints,
} from '../../../src/core/rules/constraints'
import { validateConnectionWithContext, createContextValidateConnection } from '../../../src/core/rules/validator'
import type { ConstraintValidateContext, ProfileContext, ResolvedProfile } from '../../../src/core/dialect/types'
import { DEFAULT_CONNECTION_RULES, type BpmnNodeCategory } from '../../../src/rules/connection-rules'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_RECEIVE_TASK,
  BPMN_SEQUENCE_FLOW,
} from '../../../src/utils/constants'

// ============================================================================
// 辅助
// ============================================================================

function makeConstraintCtx(nodeShapes: string[] = [], edgeShapes: string[] = []): ConstraintValidateContext {
  const nodeCounts: Record<string, number> = {}
  for (const s of nodeShapes) {
    nodeCounts[s] = (nodeCounts[s] || 0) + 1
  }
  return { profileId: 'test', nodeShapes, edgeShapes, nodeCounts }
}

function makeProfileContext(
  nodeCategories: Record<string, BpmnNodeCategory>,
  connectionRules: Record<string, any> = {},
): ProfileContext {
  return {
    profile: {
      meta: { id: 'test', name: 'test' },
      definitions: { nodes: {}, edges: {} },
      availability: { nodes: {}, edges: {} },
      rendering: { theme: { colors: {}, icons: {} }, nodeRenderers: {}, edgeRenderers: {} },
      rules: { nodeCategories, connectionRules, constraints: [] },
      dataModel: { fields: {}, categoryFields: {} },
      serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
    } as ResolvedProfile,
  }
}

// ============================================================================
// createStartEventLimit
// ============================================================================

describe('createStartEventLimit', () => {
  it('0 个开始事件时应通过（限制 1 个）', () => {
    const rule = createStartEventLimit(1)
    const result = rule.validate(makeConstraintCtx(['bpmn-task']))
    expect(result).toBe(true)
  })

  it('1 个开始事件时应通过（限制 1 个）', () => {
    const rule = createStartEventLimit(1)
    const result = rule.validate(makeConstraintCtx(['bpmn-start-event']))
    expect(result).toBe(true)
  })

  it('2 个开始事件时应失败（限制 1 个）', () => {
    const rule = createStartEventLimit(1)
    const result = rule.validate(
      makeConstraintCtx(['bpmn-start-event', 'bpmn-start-event-timer']),
    )
    expect(result).not.toBe(true)
    expect(typeof result).toBe('string')
  })

  it('允许更大的限制', () => {
    const rule = createStartEventLimit(3)
    const result = rule.validate(
      makeConstraintCtx(['bpmn-start-event', 'bpmn-start-event-timer', 'bpmn-start-event-message']),
    )
    expect(result).toBe(true)
  })

  it('ID 应为 start-event-limit', () => {
    const rule = createStartEventLimit(1)
    expect(rule.id).toBe('start-event-limit')
  })
})

// ============================================================================
// createEndEventLimit
// ============================================================================

describe('createEndEventLimit', () => {
  it('Infinity 限制时总是通过', () => {
    const rule = createEndEventLimit(Infinity)
    const result = rule.validate(
      makeConstraintCtx(['bpmn-end-event', 'bpmn-end-event', 'bpmn-end-event']),
    )
    expect(result).toBe(true)
  })

  it('超过限制时应失败', () => {
    const rule = createEndEventLimit(1)
    const result = rule.validate(
      makeConstraintCtx(['bpmn-end-event', 'bpmn-end-event-error']),
    )
    expect(typeof result).toBe('string')
  })

  it('未超过有限限制时应通过', () => {
    const rule = createEndEventLimit(2)
    const result = rule.validate(
      makeConstraintCtx(['bpmn-end-event', 'bpmn-end-event-error']),
    )
    expect(result).toBe(true)
  })

  it('默认参数 (Infinity) 应通过', () => {
    const rule = createEndEventLimit()
    expect(rule.description).toContain('不限制')
    expect(rule.validate(makeConstraintCtx(['bpmn-end-event']))).toBe(true)
  })
})

// ============================================================================
// requireStartEvent / requireEndEvent
// ============================================================================

describe('requireStartEvent', () => {
  it('有开始事件时应通过', () => {
    expect(requireStartEvent.validate(makeConstraintCtx(['bpmn-start-event']))).toBe(true)
  })

  it('无开始事件时应失败', () => {
    const result = requireStartEvent.validate(makeConstraintCtx(['bpmn-task']))
    expect(typeof result).toBe('string')
  })
})

describe('requireEndEvent', () => {
  it('有结束事件时应通过', () => {
    expect(requireEndEvent.validate(makeConstraintCtx(['bpmn-end-event']))).toBe(true)
  })

  it('无结束事件时应失败', () => {
    const result = requireEndEvent.validate(makeConstraintCtx(['bpmn-task']))
    expect(typeof result).toBe('string')
  })
})

// ============================================================================
// createForbiddenShapes
// ============================================================================

describe('createForbiddenShapes', () => {
  it('不包含禁止 shape 时应通过', () => {
    const rule = createForbiddenShapes(['bpmn-user-task'])
    const result = rule.validate(makeConstraintCtx(['bpmn-task', 'bpmn-service-task']))
    expect(result).toBe(true)
  })

  it('包含禁止 shape 时应失败', () => {
    const rule = createForbiddenShapes(['bpmn-user-task'])
    const result = rule.validate(makeConstraintCtx(['bpmn-task', 'bpmn-user-task']))
    expect(typeof result).toBe('string')
  })

  it('自定义 reason 应出现在错误信息中', () => {
    const rule = createForbiddenShapes(['bpmn-user-task'], '该模式不支持用户任务')
    const result = rule.validate(makeConstraintCtx(['bpmn-user-task']))
    expect(result).toBe('该模式不支持用户任务')
  })

  it('ID 应包含 shape 名称', () => {
    const rule = createForbiddenShapes(['bpmn-user-task', 'bpmn-manual-task'])
    expect(rule.id).toContain('bpmn-user-task')
    expect(rule.id).toContain('bpmn-manual-task')
  })
})

// ============================================================================
// validateConstraints
// ============================================================================

describe('validateConstraints', () => {
  it('所有约束通过时应返回空数组', () => {
    const constraints = [requireStartEvent, requireEndEvent]
    const ctx = makeConstraintCtx(['bpmn-start-event', 'bpmn-end-event'])
    const failures = validateConstraints(constraints, ctx)
    expect(failures).toEqual([])
  })

  it('部分失败时应返回失败列表', () => {
    const constraints = [requireStartEvent, requireEndEvent]
    const ctx = makeConstraintCtx(['bpmn-start-event', 'bpmn-task'])
    const failures = validateConstraints(constraints, ctx)
    expect(failures.length).toBe(1)
    expect(failures[0].ruleId).toBe('require-end-event')
  })

  it('全部失败时应返回所有失败', () => {
    const constraints = [requireStartEvent, requireEndEvent]
    const ctx = makeConstraintCtx(['bpmn-task'])
    const failures = validateConstraints(constraints, ctx)
    expect(failures.length).toBe(2)
  })

  it('空约束列表应返回空数组', () => {
    const failures = validateConstraints([], makeConstraintCtx([]))
    expect(failures).toEqual([])
  })
})

// ============================================================================
// validateConnectionWithContext
// ============================================================================

describe('validateConnectionWithContext', () => {
  it('无规则限制时应允许连接', () => {
    const ctx = makeProfileContext({
      'bpmn-task': 'task',
      'bpmn-gateway': 'gateway',
    })
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-gateway', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })

  it('noOutgoing 规则应阻止出线', () => {
    const ctx = makeProfileContext(
      { 'bpmn-end': 'endEvent' },
      { endEvent: { noOutgoing: true } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-end', targetShape: 'bpmn-task', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许有出线')
  })

  it('noIncoming 规则应阻止入线', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent' },
      { startEvent: { noIncoming: true } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-start', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许有入线')
  })

  it('forbiddenTargets 应阻止到指定分类的连接', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent', 'bpmn-another-start': 'startEvent' },
      { startEvent: { forbiddenTargets: ['startEvent'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-start', targetShape: 'bpmn-another-start', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
  })

  it('maxOutgoing 应限制出线数量', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { maxOutgoing: 1 } },
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-task',
        targetShape: 'bpmn-task',
        edgeShape: 'bpmn-sequence-flow',
        sourceOutgoingCount: 1, // 已有 1 根出线
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('上限')
  })

  it('未知 shape 分类应视为 unknown 类型', () => {
    const ctx = makeProfileContext({})
    const result = validateConnectionWithContext(
      { sourceShape: 'unknown-shape', targetShape: 'unknown-shape-2', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    // 没有规则限制 unknown，应通过
    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// validateConnectionWithContext — 扩展场景
// ============================================================================

describe('validateConnectionWithContext — forbiddenSources', () => {
  it('forbiddenSources 应阻止来自指定分类的连线', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task', 'bpmn-data': 'dataElement' },
      { dataElement: { forbiddenSources: ['task'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-data', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('禁止接收')
  })

  it('forbiddenSources 不匹配时应允许', () => {
    const ctx = makeProfileContext(
      { 'bpmn-gateway': 'gateway', 'bpmn-data': 'dataElement' },
      { dataElement: { forbiddenSources: ['task'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-gateway', targetShape: 'bpmn-data', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — allowedSources', () => {
  it('允许的源分类应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task', 'bpmn-end': 'endEvent' },
      { endEvent: { allowedSources: ['task'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-end', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })

  it('不允许的源分类应阻止', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent', 'bpmn-end': 'endEvent' },
      { endEvent: { allowedSources: ['task'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-start', targetShape: 'bpmn-end', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许接收')
  })
})

describe('validateConnectionWithContext — allowedOutgoing 边类型检查', () => {
  it('不在 allowedOutgoing 中的边类型应阻止', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { allowedOutgoing: ['bpmn-sequence-flow'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-task', edgeShape: 'bpmn-message-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许使用')
  })

  it('在 allowedOutgoing 中的边类型应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { allowedOutgoing: ['bpmn-sequence-flow', 'bpmn-message-flow'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-task', edgeShape: 'bpmn-message-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — allowedIncoming 边类型检查', () => {
  it('不在 allowedIncoming 中的边类型应阻止', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { allowedIncoming: ['bpmn-sequence-flow'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-task', edgeShape: 'bpmn-message-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许使用')
  })
})

describe('validateConnectionWithContext — allowedTargets', () => {
  it('不在 allowedTargets 中的分类应阻止', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent', 'bpmn-data': 'dataElement' },
      { startEvent: { allowedTargets: ['task', 'gateway'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-start', targetShape: 'bpmn-data', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许连接到')
  })
})

describe('validateConnectionWithContext — maxIncoming', () => {
  it('入线数量达上限应阻止', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { maxIncoming: 2 } },
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-task',
        targetShape: 'bpmn-task',
        edgeShape: 'bpmn-sequence-flow',
        targetIncomingCount: 2,
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('入线数量已达上限')
  })

  it('入线数量未达上限应允许', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { maxIncoming: 3 } },
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-task',
        targetShape: 'bpmn-task',
        edgeShape: 'bpmn-sequence-flow',
        targetIncomingCount: 1,
      },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// createContextValidateConnection
// ============================================================================

describe('createContextValidateConnection', () => {
  const ctx = makeProfileContext(
    { 'bpmn-user-task': 'task', 'bpmn-start-event': 'startEvent' },
    {
      task: { allowedOutgoing: ['bpmn-sequence-flow'] },
      startEvent: { noIncoming: true },
    },
  )

  it('targetMagnet 为 null 时应返回 false', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task' },
      targetCell: { id: '2', shape: 'bpmn-user-task' },
      targetMagnet: null,
    })
    expect(result).toBe(false)
  })

  it('sourceCell 为 null 时应返回 false', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: null,
      targetCell: { id: '2', shape: 'bpmn-user-task' },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(false)
  })

  it('targetCell 为 null 时应返回 false', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task' },
      targetCell: null,
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(false)
  })

  it('源和目标相同时应返回 false（自连接）', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task' },
      targetCell: { id: '1', shape: 'bpmn-user-task' },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(false)
  })

  it('合法连线返回 true', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task' },
      targetCell: { id: '2', shape: 'bpmn-user-task' },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('违规连线返回 false', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    // startEvent noIncoming
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task' },
      targetCell: { id: '2', shape: 'bpmn-start-event' },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(false)
  })

  it('含 model.graph 时应正确计数边', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const fakeGraph = {
      getConnectedEdges: () => [{ id: 'e1' }, { id: 'e2' }],
    }
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', model: { graph: fakeGraph } },
      targetCell: { id: '2', shape: 'bpmn-user-task', model: { graph: fakeGraph } },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('model.graph 不存在时边计数为 0', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', model: {} },
      targetCell: { id: '2', shape: 'bpmn-user-task', model: {} },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('getConnectedEdges 抛异常时边计数为 0', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const fakeGraph = {
      getConnectedEdges: () => { throw new Error('mock error') },
    }
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', model: { graph: fakeGraph } },
      targetCell: { id: '2', shape: 'bpmn-user-task', model: { graph: fakeGraph } },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('节点 getData 返回对象时应透传到动态规则上下文', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', getData: () => ({ bpmn: { foo: 'bar' } }) },
      targetCell: { id: '2', shape: 'bpmn-user-task', getData: () => ({ bpmn: { baz: 'qux' } }) },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('节点 getData 抛异常时应按空数据处理', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', getData: () => { throw new Error('mock data error') } },
      targetCell: { id: '2', shape: 'bpmn-user-task', getData: () => ({ bpmn: {} }) },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('节点 getData 返回非对象时应按空数据处理', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', getData: () => 'not-an-object' },
      targetCell: { id: '2', shape: 'bpmn-user-task', getData: () => null },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })

  it('节点经由 Lane 父节点链找到 Pool 时应保留同 Pool 连线', () => {
    const validate = createContextValidateConnection(() => 'bpmn-sequence-flow', ctx)
    const pool = { id: 'pool-1', shape: 'bpmn-pool', getParent: () => null }
    const lane = { id: 'lane-1', shape: 'bpmn-lane', getParent: () => pool }
    const result = validate({
      sourceCell: { id: '1', shape: 'bpmn-user-task', getParent: () => lane },
      targetCell: { id: '2', shape: 'bpmn-user-task', getParent: () => lane },
      targetMagnet: document.createElement('div'),
    })
    expect(result).toBe(true)
  })
})

// ============================================================================
// validateConnectionWithContext — 分支覆盖补充
// ============================================================================

describe('validateConnectionWithContext — allowedIncoming 成功路径', () => {
  it('allowedIncoming 包含该边类型时应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { allowedIncoming: ['bpmn-sequence-flow', 'bpmn-message-flow'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-task', targetShape: 'bpmn-task', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — allowedTargets 成功路径', () => {
  it('allowedTargets 含目标分类时应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent', 'bpmn-task': 'task' },
      { startEvent: { allowedTargets: ['task', 'gateway'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-start', targetShape: 'bpmn-task', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — forbiddenTargets 成功路径', () => {
  it('forbiddenTargets 不含目标分类时应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-start': 'startEvent', 'bpmn-task': 'task' },
      { startEvent: { forbiddenTargets: ['endEvent'] } },
    )
    const result = validateConnectionWithContext(
      { sourceShape: 'bpmn-start', targetShape: 'bpmn-task', edgeShape: 'bpmn-sequence-flow' },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — maxOutgoing 未超限路径', () => {
  it('maxOutgoing 已设置但未超限时应通过', () => {
    const ctx = makeProfileContext(
      { 'bpmn-task': 'task' },
      { task: { maxOutgoing: 3 } },
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-task',
        targetShape: 'bpmn-task',
        edgeShape: 'bpmn-sequence-flow',
        sourceOutgoingCount: 2,
      },
      ctx,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateConnectionWithContext — BPMN 动态规则', () => {
  it('事件网关只能连接到接收任务或合法捕获事件', () => {
    const ctx = makeProfileContext(
      {
        [BPMN_EVENT_BASED_GATEWAY]: 'eventBasedGateway',
        'bpmn-user-task': 'task',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: BPMN_EVENT_BASED_GATEWAY,
        targetShape: 'bpmn-user-task',
        edgeShape: BPMN_SEQUENCE_FLOW,
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('接收任务')
  })

  it('事件网关连接接收任务时应通过', () => {
    const ctx = makeProfileContext(
      {
        [BPMN_EVENT_BASED_GATEWAY]: 'eventBasedGateway',
        [BPMN_RECEIVE_TASK]: 'task',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: BPMN_EVENT_BASED_GATEWAY,
        targetShape: BPMN_RECEIVE_TASK,
        edgeShape: BPMN_SEQUENCE_FLOW,
      },
      ctx,
    )
    expect(result.valid).toBe(true)
  })

  it('事件网关配置目标已有其他入向顺序流时应失败', () => {
    const ctx = makeProfileContext(
      {
        [BPMN_EVENT_BASED_GATEWAY]: 'eventBasedGateway',
        [BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE]: 'intermediateCatchEvent',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: BPMN_EVENT_BASED_GATEWAY,
        targetShape: BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
        edgeShape: BPMN_SEQUENCE_FLOW,
        targetIncomingSequenceFlowCount: 1,
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('其他入向顺序流')
  })

  it('事件子流程不能接入顺序流', () => {
    const ctx = makeProfileContext(
      {
        [BPMN_EVENT_SUB_PROCESS]: 'subProcess',
        'bpmn-user-task': 'task',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-user-task',
        targetShape: BPMN_EVENT_SUB_PROCESS,
        edgeShape: BPMN_SEQUENCE_FLOW,
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('事件子流程')
  })

  it('跨 Pool 顺序流在 context validator 中也应失败', () => {
    const ctx = makeProfileContext(
      {
        'bpmn-user-task': 'task',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-user-task',
        targetShape: 'bpmn-user-task',
        edgeShape: BPMN_SEQUENCE_FLOW,
        sourcePoolId: 'pool-a',
        targetPoolId: 'pool-b',
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Pool 边界')
  })

  it('活动的第一条条件顺序流在 context validator 中应失败', () => {
    const ctx = makeProfileContext(
      {
        'bpmn-user-task': 'task',
      },
      DEFAULT_CONNECTION_RULES,
    )
    const result = validateConnectionWithContext(
      {
        sourceShape: 'bpmn-user-task',
        targetShape: 'bpmn-user-task',
        edgeShape: BPMN_CONDITIONAL_FLOW,
        sourceOutgoingSequenceFlowCount: 0,
      },
      ctx,
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('条件顺序流')
  })
})
