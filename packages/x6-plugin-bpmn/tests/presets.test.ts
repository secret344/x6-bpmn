/**
 * 规则预设系统测试
 *
 * 覆盖：
 * - 预设注册/注销/查询
 * - 预设解析（继承链展平）
 * - 内置预设（bpmn2、smartengine）
 * - 自定义预设扩展
 * - 验证器集成
 * - 循环继承检测
 * - createExtendedPreset 便捷函数
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerPreset,
  unregisterPreset,
  getPreset,
  listPresets,
  clearPresets,
  resolvePreset,
  createExtendedPreset,
  BPMN2_PRESET,
  SMARTENGINE_PRESET,
  type BpmnRulePreset,
  type ResolvedBpmnRulePreset,
  type NodePropertyDefinition,
} from '../src/rules/presets'
import { DEFAULT_CONNECTION_RULES } from '../src/rules/connection-rules'
import { validateBpmnConnection } from '../src/rules/validator'
import {
  BPMN_START_EVENT,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_END_EVENT,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SEQUENCE_FLOW,
} from '../src/utils/constants'

// ============================================================================
// 辅助函数
// ============================================================================

/** 重新注册内置预设 */
function resetRegistry(): void {
  clearPresets()
  registerPreset(BPMN2_PRESET)
  registerPreset(SMARTENGINE_PRESET)
}

// ============================================================================
// 测试
// ============================================================================

describe('规则预设系统', () => {
  beforeEach(() => {
    resetRegistry()
  })

  // ==========================================================================
  // 内置预设
  // ==========================================================================

  describe('内置预设', () => {
    it('应包含 bpmn2 预设', () => {
      const preset = getPreset('bpmn2')
      expect(preset).toBeDefined()
      expect(preset!.name).toBe('bpmn2')
      expect(preset!.extends).toBeUndefined()
    })

    it('应包含 smartengine 预设', () => {
      const preset = getPreset('smartengine')
      expect(preset).toBeDefined()
      expect(preset!.name).toBe('smartengine')
      expect(preset!.extends).toBe('bpmn2')
    })

    it('listPresets 应列出所有内置预设', () => {
      const names = listPresets()
      expect(names).toContain('bpmn2')
      expect(names).toContain('smartengine')
    })

    it('BPMN2_PRESET 应有节点属性定义', () => {
      expect(BPMN2_PRESET.nodeProperties).toBeDefined()
      expect(BPMN2_PRESET.nodeProperties!['userTask']).toBeDefined()
      expect(BPMN2_PRESET.nodeProperties!['serviceTask']).toBeDefined()
      expect(BPMN2_PRESET.nodeProperties!['gateway']).toBeDefined()
    })

    it('BPMN2_PRESET 应有序列化配置', () => {
      expect(BPMN2_PRESET.serialization).toBeDefined()
      expect(BPMN2_PRESET.serialization!.targetNamespace).toBe('http://bpmn.io/schema/bpmn')
      expect(BPMN2_PRESET.serialization!.includeDI).toBe(true)
    })

    it('SMARTENGINE_PRESET 应继承 bpmn2', () => {
      expect(SMARTENGINE_PRESET.extends).toBe('bpmn2')
    })

    it('SMARTENGINE_PRESET 应有 startEvent maxOutgoing: 1', () => {
      expect(SMARTENGINE_PRESET.connectionRules).toBeDefined()
      expect(SMARTENGINE_PRESET.connectionRules!.startEvent).toBeDefined()
      expect(SMARTENGINE_PRESET.connectionRules!.startEvent!.maxOutgoing).toBe(1)
    })

    it('SMARTENGINE_PRESET 应有序列化配置', () => {
      expect(SMARTENGINE_PRESET.serialization).toBeDefined()
      expect(SMARTENGINE_PRESET.serialization!.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
      expect(SMARTENGINE_PRESET.serialization!.includeDI).toBe(false)
      expect(SMARTENGINE_PRESET.serialization!.conditionExpressionType).toBe('mvel')
    })
  })

  // ==========================================================================
  // 预设注册/注销
  // ==========================================================================

  describe('预设注册', () => {
    it('应能注册新预设', () => {
      const preset: BpmnRulePreset = {
        name: 'test-preset',
        description: '测试预设',
      }
      registerPreset(preset)
      expect(getPreset('test-preset')).toBeDefined()
    })

    it('重复注册应抛出错误', () => {
      const preset: BpmnRulePreset = { name: 'dup-test' }
      registerPreset(preset)
      expect(() => registerPreset(preset)).toThrow('已注册')
    })

    it('应能注销预设', () => {
      const preset: BpmnRulePreset = { name: 'removable' }
      registerPreset(preset)
      expect(unregisterPreset('removable')).toBe(true)
      expect(getPreset('removable')).toBeUndefined()
    })

    it('注销不存在的预设应返回 false', () => {
      expect(unregisterPreset('nonexistent')).toBe(false)
    })

    it('clearPresets 应清除所有预设', () => {
      clearPresets()
      expect(listPresets()).toHaveLength(0)
      expect(getPreset('bpmn2')).toBeUndefined()
    })
  })

  // ==========================================================================
  // 预设解析
  // ==========================================================================

  describe('预设解析', () => {
    it('解析 bpmn2 应使用 DEFAULT_CONNECTION_RULES', () => {
      const resolved = resolvePreset('bpmn2')
      expect(resolved.name).toBe('bpmn2')
      // bpmn2 预设不覆盖连线规则，应等同于默认规则
      expect(resolved.connectionRules.startEvent.noIncoming).toBe(true)
      expect(resolved.connectionRules.endEvent.noOutgoing).toBe(true)
    })

    it('解析 smartengine 应继承 bpmn2 规则并增加约束', () => {
      const resolved = resolvePreset('smartengine')
      expect(resolved.name).toBe('smartengine')
      // 应继承 bpmn2 的基础连线规则
      expect(resolved.connectionRules.startEvent.noIncoming).toBe(true)
      expect(resolved.connectionRules.endEvent.noOutgoing).toBe(true)
      // 应增加 SmartEngine 特有的约束
      expect(resolved.connectionRules.startEvent.maxOutgoing).toBe(1)
    })

    it('解析 smartengine 应合并节点属性', () => {
      const resolved = resolvePreset('smartengine')
      // SmartEngine 覆盖了 serviceTask 属性
      const serviceTaskProps = resolved.nodeProperties['serviceTask']
      expect(serviceTaskProps).toBeDefined()
      expect(serviceTaskProps.length).toBeGreaterThan(0)
      // 应有 SmartEngine 的 implementation 描述
      const implProp = serviceTaskProps.find(p => p.key === 'implementation')
      expect(implProp).toBeDefined()
      expect(implProp!.description).toContain('类名')
    })

    it('解析 smartengine 应包含 bpmn2 的节点属性（未被覆盖的）', () => {
      const resolved = resolvePreset('smartengine')
      // timerEvent 属性来自 bpmn2，SmartEngine 未覆盖
      const timerProps = resolved.nodeProperties['timerEvent']
      expect(timerProps).toBeDefined()
      expect(timerProps.length).toBeGreaterThan(0)
    })

    it('解析 smartengine 应合并验证器', () => {
      const resolved = resolvePreset('smartengine')
      // 应包含 bpmn2 的验证器和 SmartEngine 的验证器
      const validatorNames = resolved.validators.map(v => v.name)
      expect(validatorNames).toContain('bpmn2:no-self-connection')
      expect(validatorNames).toContain('smartengine:single-start-event')
      expect(validatorNames).toContain('smartengine:condition-expression')
    })

    it('解析 bpmn2 应包含序列化配置', () => {
      const resolved = resolvePreset('bpmn2')
      expect(resolved.serialization).toBeDefined()
      expect(resolved.serialization.targetNamespace).toBe('http://bpmn.io/schema/bpmn')
      expect(resolved.serialization.includeDI).toBe(true)
    })

    it('解析 smartengine 应合并序列化配置', () => {
      const resolved = resolvePreset('smartengine')
      expect(resolved.serialization).toBeDefined()
      expect(resolved.serialization.xmlNamespaces?.smart).toBe('http://smartengine.org/schema/process')
      expect(resolved.serialization.targetNamespace).toBe('Examples')
      expect(resolved.serialization.includeDI).toBe(false)
      expect(resolved.serialization.conditionExpressionType).toBe('mvel')
      expect(typeof resolved.serialization.transformExportNode).toBe('function')
      expect(typeof resolved.serialization.transformImportNode).toBe('function')
    })

    it('解析不存在的预设应抛出错误', () => {
      expect(() => resolvePreset('nonexistent')).toThrow('未注册')
    })

    it('循环继承应抛出错误', () => {
      registerPreset({ name: 'cycle-a', extends: 'cycle-b' })
      registerPreset({ name: 'cycle-b', extends: 'cycle-a' })
      expect(() => resolvePreset('cycle-a')).toThrow('循环引用')
    })
  })

  // ==========================================================================
  // 自定义预设扩展
  // ==========================================================================

  describe('自定义预设扩展', () => {
    it('createExtendedPreset 应创建并注册新预设', () => {
      const preset = createExtendedPreset('custom-rules', 'bpmn2', {
        description: '自定义规则',
      })
      expect(preset.name).toBe('custom-rules')
      expect(preset.extends).toBe('bpmn2')
      expect(getPreset('custom-rules')).toBeDefined()
    })

    it('自定义预设应能覆盖连线规则', () => {
      createExtendedPreset('strict-start', 'bpmn2', {
        connectionRules: {
          startEvent: { maxOutgoing: 1 },
        },
      })
      const resolved = resolvePreset('strict-start')
      expect(resolved.connectionRules.startEvent.maxOutgoing).toBe(1)
      // 其他规则应保持不变
      expect(resolved.connectionRules.startEvent.noIncoming).toBe(true)
    })

    it('自定义预设应能追加节点属性', () => {
      const customProp: NodePropertyDefinition = {
        key: 'retryCount',
        label: '重试次数',
        type: 'number',
        group: '高级',
      }
      createExtendedPreset('with-retry', 'bpmn2', {
        nodeProperties: {
          serviceTask: [customProp],
        },
      })
      const resolved = resolvePreset('with-retry')
      const serviceTaskProps = resolved.nodeProperties['serviceTask']
      expect(serviceTaskProps.find(p => p.key === 'retryCount')).toBeDefined()
      // 原有属性应保留
      expect(serviceTaskProps.find(p => p.key === 'implementation')).toBeDefined()
    })

    it('自定义预设应能覆盖同名节点属性', () => {
      const customImpl: NodePropertyDefinition = {
        key: 'implementation',
        label: '自定义实现',
        type: 'string',
        description: '覆盖后的描述',
      }
      createExtendedPreset('override-impl', 'bpmn2', {
        nodeProperties: {
          serviceTask: [customImpl],
        },
      })
      const resolved = resolvePreset('override-impl')
      const implProp = resolved.nodeProperties['serviceTask'].find(p => p.key === 'implementation')
      expect(implProp!.label).toBe('自定义实现')
      expect(implProp!.description).toBe('覆盖后的描述')
    })

    it('自定义预设应能添加自定义验证器', () => {
      createExtendedPreset('with-validator', 'bpmn2', {
        validators: [{
          name: 'custom:no-gateway-to-gateway',
          description: '禁止网关直连网关',
          validate: (ctx) => {
            if (ctx.sourceShape.includes('gateway') && ctx.targetShape.includes('gateway')) {
              return { valid: false, reason: '不允许网关直接连接网关' }
            }
            return { valid: true }
          },
        }],
      })
      const resolved = resolvePreset('with-validator')
      const validatorNames = resolved.validators.map(v => v.name)
      expect(validatorNames).toContain('custom:no-gateway-to-gateway')
      expect(validatorNames).toContain('bpmn2:no-self-connection')
    })

    it('三级继承链应正确解析', () => {
      createExtendedPreset('level2', 'smartengine', {
        connectionRules: {
          gateway: { maxOutgoing: 10 },
        },
      })
      createExtendedPreset('level3', 'level2', {
        connectionRules: {
          task: { maxOutgoing: 5 },
        },
      })
      const resolved = resolvePreset('level3')
      // 从 bpmn2 继承
      expect(resolved.connectionRules.endEvent.noOutgoing).toBe(true)
      // 从 smartengine 继承
      expect(resolved.connectionRules.startEvent.maxOutgoing).toBe(1)
      // 从 level2 继承
      expect(resolved.connectionRules.gateway.maxOutgoing).toBe(10)
      // 自身定义
      expect(resolved.connectionRules.task.maxOutgoing).toBe(5)
    })

    it('shapeCategoryOverrides 应正确合并', () => {
      createExtendedPreset('with-categories', 'bpmn2', {
        shapeCategoryOverrides: {
          'custom-approval-node': 'task',
        },
      })
      const resolved = resolvePreset('with-categories')
      expect(resolved.shapeCategoryOverrides['custom-approval-node']).toBe('task')
    })

    it('shapeLabelOverrides 应正确合并', () => {
      createExtendedPreset('with-labels', 'bpmn2', {
        shapeLabelOverrides: {
          'bpmn-user-task': '审批任务',
        },
      })
      const resolved = resolvePreset('with-labels')
      expect(resolved.shapeLabelOverrides['bpmn-user-task']).toBe('审批任务')
    })

    it('子预设的 shapeCategoryOverrides 应覆盖父预设', () => {
      createExtendedPreset('parent-cat', 'bpmn2', {
        shapeCategoryOverrides: { 'my-node': 'task' },
      })
      createExtendedPreset('child-cat', 'parent-cat', {
        shapeCategoryOverrides: { 'my-node': 'gateway' },
      })
      const resolved = resolvePreset('child-cat')
      expect(resolved.shapeCategoryOverrides['my-node']).toBe('gateway')
    })

    it('同名验证器应被子预设覆盖', () => {
      createExtendedPreset('override-validator', 'bpmn2', {
        validators: [{
          name: 'bpmn2:no-self-connection',
          description: '覆盖后的描述',
          validate: () => ({ valid: true }),
        }],
      })
      const resolved = resolvePreset('override-validator')
      const validator = resolved.validators.find(v => v.name === 'bpmn2:no-self-connection')
      expect(validator!.description).toBe('覆盖后的描述')
      // 不应有两个同名验证器
      const count = resolved.validators.filter(v => v.name === 'bpmn2:no-self-connection').length
      expect(count).toBe(1)
    })
  })

  // ==========================================================================
  // 预设与验证器集成
  // ==========================================================================

  describe('预设与验证器集成', () => {
    it('使用 preset 选项应应用预设连线规则', () => {
      // SmartEngine 限制 startEvent maxOutgoing: 1
      const result = validateBpmnConnection(
        {
          sourceShape: BPMN_START_EVENT,
          targetShape: BPMN_USER_TASK,
          edgeShape: BPMN_SEQUENCE_FLOW,
          sourceOutgoingCount: 1, // 已有 1 条出线
        },
        { preset: 'smartengine' },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('上限')
    })

    it('不使用 preset 选项时不应受 SmartEngine 规则约束', () => {
      // 不使用预设，startEvent 无 maxOutgoing 限制
      const result = validateBpmnConnection({
        sourceShape: BPMN_START_EVENT,
        targetShape: BPMN_USER_TASK,
        edgeShape: BPMN_SEQUENCE_FLOW,
        sourceOutgoingCount: 1,
      })
      expect(result.valid).toBe(true)
    })

    it('preset + customRules 应叠加', () => {
      const result = validateBpmnConnection(
        {
          sourceShape: BPMN_START_EVENT,
          targetShape: BPMN_USER_TASK,
          edgeShape: BPMN_SEQUENCE_FLOW,
          sourceOutgoingCount: 0,
        },
        {
          preset: 'bpmn2',
          customRules: {
            startEvent: { maxOutgoing: 1 },
          },
        },
      )
      // maxOutgoing: 1, sourceOutgoingCount: 0 → 应通过
      expect(result.valid).toBe(true)
    })

    it('不存在的 preset 应回退到默认规则', () => {
      const result = validateBpmnConnection(
        {
          sourceShape: BPMN_START_EVENT,
          targetShape: BPMN_USER_TASK,
          edgeShape: BPMN_SEQUENCE_FLOW,
        },
        { preset: 'nonexistent' },
      )
      // 应使用 DEFAULT_CONNECTION_RULES，不报错
      expect(result.valid).toBe(true)
    })

    it('自定义验证器应在连线规则通过后执行', () => {
      createExtendedPreset('reject-all', 'bpmn2', {
        validators: [{
          name: 'test:reject-all',
          validate: () => ({ valid: false, reason: '自定义验证器拒绝' }),
        }],
      })
      const result = validateBpmnConnection(
        {
          sourceShape: BPMN_START_EVENT,
          targetShape: BPMN_USER_TASK,
          edgeShape: BPMN_SEQUENCE_FLOW,
        },
        { preset: 'reject-all' },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('自定义验证器拒绝')
    })
  })

  // ==========================================================================
  // 节点属性定义
  // ==========================================================================

  describe('节点属性定义', () => {
    it('bpmn2 预设应有 userTask 属性', () => {
      const resolved = resolvePreset('bpmn2')
      const props = resolved.nodeProperties['userTask']
      expect(props).toBeDefined()
      expect(props.find(p => p.key === 'assignee')).toBeDefined()
      expect(props.find(p => p.key === 'candidateUsers')).toBeDefined()
      expect(props.find(p => p.key === 'formKey')).toBeDefined()
    })

    it('bpmn2 预设应有 serviceTask 属性', () => {
      const resolved = resolvePreset('bpmn2')
      const props = resolved.nodeProperties['serviceTask']
      expect(props).toBeDefined()
      expect(props.find(p => p.key === 'implementationType')).toBeDefined()
      expect(props.find(p => p.key === 'implementation')).toBeDefined()
    })

    it('bpmn2 预设应有 scriptTask 属性', () => {
      const resolved = resolvePreset('bpmn2')
      const props = resolved.nodeProperties['scriptTask']
      expect(props).toBeDefined()
      expect(props.find(p => p.key === 'scriptFormat')).toBeDefined()
      expect(props.find(p => p.key === 'script')).toBeDefined()
    })

    it('bpmn2 预设应有 timerEvent 属性', () => {
      const resolved = resolvePreset('bpmn2')
      const props = resolved.nodeProperties['timerEvent']
      expect(props).toBeDefined()
      expect(props.find(p => p.key === 'timerType')).toBeDefined()
      expect(props.find(p => p.key === 'timerValue')).toBeDefined()
    })

    it('smartengine 预设应有 SmartEngine 特有的 serviceTask 属性', () => {
      const resolved = resolvePreset('smartengine')
      const props = resolved.nodeProperties['serviceTask']
      const implType = props.find(p => p.key === 'implementationType')
      expect(implType).toBeDefined()
      // SmartEngine 使用 smart:class
      expect(implType!.options!.find(o => o.value === 'class')!.label).toContain('smart:class')
    })

    it('smartengine 预设应有 receiveTask 属性', () => {
      const resolved = resolvePreset('smartengine')
      const props = resolved.nodeProperties['receiveTask']
      expect(props).toBeDefined()
      expect(props.find(p => p.key === 'implementation')).toBeDefined()
    })

    it('smartengine 预设应有 gateway 的 implementation 属性', () => {
      const resolved = resolvePreset('smartengine')
      const props = resolved.nodeProperties['gateway']
      const implProp = props.find(p => p.key === 'implementation')
      expect(implProp).toBeDefined()
      expect(implProp!.description).toContain('smart:class')
    })

    it('smartengine 预设顺序流应使用 MVEL 语法', () => {
      const resolved = resolvePreset('smartengine')
      const props = resolved.nodeProperties['sequenceFlow']
      const condProp = props.find(p => p.key === 'conditionExpression')
      expect(condProp).toBeDefined()
      expect(condProp!.label).toContain('MVEL')
    })

    it('NodePropertyDefinition 应有完整的类型信息', () => {
      const resolved = resolvePreset('bpmn2')
      const props = resolved.nodeProperties['serviceTask']
      const implType = props.find(p => p.key === 'implementationType')
      expect(implType).toBeDefined()
      expect(implType!.type).toBe('select')
      expect(implType!.options).toBeDefined()
      expect(implType!.options!.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // 缓存行为
  // ==========================================================================

  describe('缓存行为', () => {
    it('多次 resolvePreset 应返回相同对象', () => {
      const first = resolvePreset('bpmn2')
      const second = resolvePreset('bpmn2')
      expect(first).toBe(second)
    })

    it('注册新预设后缓存应失效', () => {
      const first = resolvePreset('bpmn2')
      registerPreset({ name: 'cache-test' })
      const second = resolvePreset('bpmn2')
      // 注册新预设会清缓存，所以是新对象
      expect(first).not.toBe(second)
      // 但内容应相同
      expect(first.name).toBe(second.name)
    })

    it('注销预设后缓存应失效', () => {
      resolvePreset('bpmn2')
      registerPreset({ name: 'temp-preset' })
      resolvePreset('bpmn2')
      unregisterPreset('temp-preset')
      // 不应报错
      const resolved = resolvePreset('bpmn2')
      expect(resolved.name).toBe('bpmn2')
    })
  })
})
