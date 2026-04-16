/**
 * BPMN 配置工具模块 — 单元测试
 *
 * 覆盖：SHAPE_LABELS、getShapeLabel、registerShapeLabel、
 * classifyShape、registerShapeCategory、emptyBpmnFormData、getCellLabel。
 */

import { describe, it, expect } from 'vitest'
import {
  SHAPE_LABELS,
  getShapeLabel,
  registerShapeLabel,
  classifyShape,
  registerShapeCategory,
  emptyBpmnFormData,
  getCellLabel,
  resolveBpmnNodeSize,
  buildBpmnNodeAttrs,
  buildBpmnNodeDefaults,
  loadBpmnFormData,
  saveBpmnFormData,
  type ShapeCategory,
} from '../../../src/config/index'

// ============================================================================
// SHAPE_LABELS 映射表
// ============================================================================

describe('SHAPE_LABELS 映射表', () => {
  it('应包含所有开始事件', () => {
    expect(SHAPE_LABELS['bpmn-start-event']).toBe('开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-message']).toBe('消息开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-timer']).toBe('定时开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-conditional']).toBe('条件开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-signal']).toBe('信号开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-multiple']).toBe('多重开始事件')
    expect(SHAPE_LABELS['bpmn-start-event-parallel-multiple']).toBe('并行多重开始事件')
  })

  it('应包含所有中间抛出事件', () => {
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event']).toBe('中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-message']).toBe('消息中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-escalation']).toBe('升级中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-link']).toBe('链接中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-compensation']).toBe('补偿中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-signal']).toBe('信号中间抛出事件')
    expect(SHAPE_LABELS['bpmn-intermediate-throw-event-multiple']).toBe('多重中间抛出事件')
  })

  it('应包含所有中间捕获事件', () => {
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event']).toBe('中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-message']).toBe('消息中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-timer']).toBe('定时中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-escalation']).toBe('升级中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-conditional']).toBe('条件中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-link']).toBe('链接中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-error']).toBe('错误中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-cancel']).toBe('取消中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-compensation']).toBe('补偿中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-signal']).toBe('信号中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-multiple']).toBe('多重中间捕获事件')
    expect(SHAPE_LABELS['bpmn-intermediate-catch-event-parallel-multiple']).toBe('并行多重中间捕获事件')
  })

  it('应包含所有边界事件', () => {
    expect(SHAPE_LABELS['bpmn-boundary-event']).toBe('边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-message']).toBe('消息边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-timer']).toBe('定时边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-escalation']).toBe('升级边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-conditional']).toBe('条件边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-error']).toBe('错误边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-cancel']).toBe('取消边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-compensation']).toBe('补偿边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-signal']).toBe('信号边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-multiple']).toBe('多重边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-parallel-multiple']).toBe('并行多重边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-non-interrupting']).toBe('非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-message-non-interrupting']).toBe('消息非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-timer-non-interrupting']).toBe('定时非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-escalation-non-interrupting']).toBe('升级非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-conditional-non-interrupting']).toBe('条件非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-signal-non-interrupting']).toBe('信号非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-multiple-non-interrupting']).toBe('多重非中断边界事件')
    expect(SHAPE_LABELS['bpmn-boundary-event-parallel-multiple-non-interrupting']).toBe('并行多重非中断边界事件')
  })

  it('应包含所有结束事件', () => {
    expect(SHAPE_LABELS['bpmn-end-event']).toBe('结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-message']).toBe('消息结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-escalation']).toBe('升级结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-error']).toBe('错误结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-cancel']).toBe('取消结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-compensation']).toBe('补偿结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-signal']).toBe('信号结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-terminate']).toBe('终止结束事件')
    expect(SHAPE_LABELS['bpmn-end-event-multiple']).toBe('多重结束事件')
  })

  it('应包含所有任务', () => {
    expect(SHAPE_LABELS['bpmn-task']).toBe('任务')
    expect(SHAPE_LABELS['bpmn-user-task']).toBe('用户任务')
    expect(SHAPE_LABELS['bpmn-service-task']).toBe('服务任务')
    expect(SHAPE_LABELS['bpmn-script-task']).toBe('脚本任务')
    expect(SHAPE_LABELS['bpmn-business-rule-task']).toBe('业务规则任务')
    expect(SHAPE_LABELS['bpmn-send-task']).toBe('发送任务')
    expect(SHAPE_LABELS['bpmn-receive-task']).toBe('接收任务')
    expect(SHAPE_LABELS['bpmn-manual-task']).toBe('手工任务')
  })

  it('应包含所有子流程和活动', () => {
    expect(SHAPE_LABELS['bpmn-sub-process']).toBe('子流程')
    expect(SHAPE_LABELS['bpmn-event-sub-process']).toBe('事件子流程')
    expect(SHAPE_LABELS['bpmn-transaction']).toBe('事务')
    expect(SHAPE_LABELS['bpmn-ad-hoc-sub-process']).toBe('自由子流程')
    expect(SHAPE_LABELS['bpmn-call-activity']).toBe('调用活动')
  })

  it('应包含所有网关', () => {
    expect(SHAPE_LABELS['bpmn-exclusive-gateway']).toBe('排他网关')
    expect(SHAPE_LABELS['bpmn-parallel-gateway']).toBe('并行网关')
    expect(SHAPE_LABELS['bpmn-inclusive-gateway']).toBe('包容网关')
    expect(SHAPE_LABELS['bpmn-complex-gateway']).toBe('复杂网关')
    expect(SHAPE_LABELS['bpmn-event-based-gateway']).toBe('事件网关')
    expect(SHAPE_LABELS['bpmn-exclusive-event-based-gateway']).toBe('排他事件网关')
  })

  it('应包含数据元素', () => {
    expect(SHAPE_LABELS['bpmn-data-object']).toBe('数据对象')
    expect(SHAPE_LABELS['bpmn-data-input']).toBe('数据输入')
    expect(SHAPE_LABELS['bpmn-data-output']).toBe('数据输出')
    expect(SHAPE_LABELS['bpmn-data-store']).toBe('数据存储')
  })

  it('应包含工件', () => {
    expect(SHAPE_LABELS['bpmn-text-annotation']).toBe('文本注释')
    expect(SHAPE_LABELS['bpmn-group']).toBe('分组')
  })

  it('应包含泳道', () => {
    expect(SHAPE_LABELS['bpmn-pool']).toBe('池')
    expect(SHAPE_LABELS['bpmn-lane']).toBe('泳道')
  })

  it('应包含连接线', () => {
    expect(SHAPE_LABELS['bpmn-sequence-flow']).toBe('顺序流')
    expect(SHAPE_LABELS['bpmn-conditional-flow']).toBe('条件流')
    expect(SHAPE_LABELS['bpmn-default-flow']).toBe('默认流')
    expect(SHAPE_LABELS['bpmn-message-flow']).toBe('消息流')
    expect(SHAPE_LABELS['bpmn-association']).toBe('关联')
    expect(SHAPE_LABELS['bpmn-directed-association']).toBe('定向关联')
    expect(SHAPE_LABELS['bpmn-data-association']).toBe('数据关联')
  })

  it('应至少包含 81 个映射', () => {
    expect(Object.keys(SHAPE_LABELS).length).toBeGreaterThanOrEqual(81)
  })

  it('所有值应为非空字符串', () => {
    for (const [key, value] of Object.entries(SHAPE_LABELS)) {
      expect(value, `${key} 的标签不应为空`).toBeTruthy()
      expect(typeof value).toBe('string')
    }
  })
})

// ============================================================================
// getShapeLabel
// ============================================================================

describe('getShapeLabel', () => {
  it('已注册的图形应返回中文标签', () => {
    expect(getShapeLabel('bpmn-start-event')).toBe('开始事件')
    expect(getShapeLabel('bpmn-user-task')).toBe('用户任务')
    expect(getShapeLabel('bpmn-exclusive-gateway')).toBe('排他网关')
  })

  it('未注册的图形应返回图形名称本身', () => {
    expect(getShapeLabel('unknown-shape')).toBe('unknown-shape')
  })

  it('空字符串应返回空字符串', () => {
    expect(getShapeLabel('')).toBe('')
  })
})

// ============================================================================
// registerShapeLabel
// ============================================================================

describe('registerShapeLabel', () => {
  it('应注册新图形标签', () => {
    registerShapeLabel('test-custom-shape-a', '自定义图形A')
    expect(getShapeLabel('test-custom-shape-a')).toBe('自定义图形A')
  })

  it('应覆盖已有标签', () => {
    registerShapeLabel('test-custom-shape-b', '原始名')
    registerShapeLabel('test-custom-shape-b', '新名称')
    expect(getShapeLabel('test-custom-shape-b')).toBe('新名称')
  })
})

// ============================================================================
// classifyShape — 正向测试
// ============================================================================

describe('classifyShape — 正向分类', () => {
  it('应正确分类所有任务类型', () => {
    expect(classifyShape('bpmn-user-task')).toBe('userTask')
    expect(classifyShape('bpmn-service-task')).toBe('serviceTask')
    expect(classifyShape('bpmn-script-task')).toBe('scriptTask')
    expect(classifyShape('bpmn-business-rule-task')).toBe('businessRuleTask')
    expect(classifyShape('bpmn-send-task')).toBe('sendTask')
    expect(classifyShape('bpmn-receive-task')).toBe('receiveTask')
    expect(classifyShape('bpmn-manual-task')).toBe('manualTask')
    expect(classifyShape('bpmn-task')).toBe('task')
    expect(classifyShape('bpmn-call-activity')).toBe('callActivity')
  })

  it('应正确分类子流程', () => {
    expect(classifyShape('bpmn-sub-process')).toBe('subProcess')
    expect(classifyShape('bpmn-event-sub-process')).toBe('subProcess')
    expect(classifyShape('bpmn-transaction')).toBe('subProcess')
    expect(classifyShape('bpmn-ad-hoc-sub-process')).toBe('subProcess')
  })

  it('应正确分类所有网关', () => {
    expect(classifyShape('bpmn-exclusive-gateway')).toBe('gateway')
    expect(classifyShape('bpmn-parallel-gateway')).toBe('gateway')
    expect(classifyShape('bpmn-inclusive-gateway')).toBe('gateway')
    expect(classifyShape('bpmn-complex-gateway')).toBe('gateway')
    expect(classifyShape('bpmn-event-based-gateway')).toBe('gateway')
    expect(classifyShape('bpmn-exclusive-event-based-gateway')).toBe('gateway')
  })

  it('应正确分类事件定义类型', () => {
    expect(classifyShape('bpmn-start-event-timer')).toBe('timerEvent')
    expect(classifyShape('bpmn-start-event-message')).toBe('messageEvent')
    expect(classifyShape('bpmn-start-event-signal')).toBe('signalEvent')
    expect(classifyShape('bpmn-boundary-event-error')).toBe('errorEvent')
    expect(classifyShape('bpmn-boundary-event-escalation')).toBe('escalationEvent')
    expect(classifyShape('bpmn-start-event-conditional')).toBe('conditionalEvent')
    expect(classifyShape('bpmn-intermediate-throw-event-link')).toBe('linkEvent')
    expect(classifyShape('bpmn-intermediate-throw-event-compensation')).toBe('compensationEvent')
    expect(classifyShape('bpmn-boundary-event-cancel')).toBe('cancelEvent')
    expect(classifyShape('bpmn-end-event-terminate')).toBe('terminateEvent')
    expect(classifyShape('bpmn-start-event-multiple')).toBe('multipleEvent')
    expect(classifyShape('bpmn-start-event-parallel-multiple')).toBe('multipleEvent')
  })

  it('应正确分类无定义类型的事件', () => {
    expect(classifyShape('bpmn-start-event')).toBe('noneEvent')
    expect(classifyShape('bpmn-end-event')).toBe('noneEvent')
    expect(classifyShape('bpmn-intermediate-throw-event')).toBe('noneEvent')
    expect(classifyShape('bpmn-intermediate-catch-event')).toBe('noneEvent')
    expect(classifyShape('bpmn-boundary-event')).toBe('noneEvent')
  })

  it('应正确分类连接线', () => {
    expect(classifyShape('bpmn-sequence-flow')).toBe('sequenceFlow')
    expect(classifyShape('bpmn-conditional-flow')).toBe('sequenceFlow')
    expect(classifyShape('bpmn-default-flow')).toBe('sequenceFlow')
    expect(classifyShape('bpmn-message-flow')).toBe('messageFlow')
    expect(classifyShape('bpmn-association')).toBe('association')
    expect(classifyShape('bpmn-directed-association')).toBe('association')
    expect(classifyShape('bpmn-data-association')).toBe('association')
  })

  it('应正确分类数据元素', () => {
    expect(classifyShape('bpmn-data-object')).toBe('dataObject')
    expect(classifyShape('bpmn-data-input')).toBe('dataObject')
    expect(classifyShape('bpmn-data-output')).toBe('dataObject')
    expect(classifyShape('bpmn-data-store')).toBe('dataStore')
  })

  it('应正确分类工件和泳道', () => {
    expect(classifyShape('bpmn-text-annotation')).toBe('textAnnotation')
    expect(classifyShape('bpmn-group')).toBe('group')
    expect(classifyShape('bpmn-pool')).toBe('pool')
    expect(classifyShape('bpmn-lane')).toBe('lane')
  })
})

// ============================================================================
// classifyShape — 异常 / 边界测试
// ============================================================================

describe('classifyShape — 异常场景', () => {
  it('未知图形应返回 unknown', () => {
    expect(classifyShape('some-random-shape')).toBe('unknown')
  })

  it('空字符串应返回 unknown', () => {
    expect(classifyShape('')).toBe('unknown')
  })

  it('只有前缀 bpmn 但不匹配任何规则应返回 unknown', () => {
    expect(classifyShape('bpmn-xyz')).toBe('unknown')
  })
})

// ============================================================================
// registerShapeCategory
// ============================================================================

describe('registerShapeCategory', () => {
  it('应注册自定义图形分类', () => {
    registerShapeCategory('test-approval-node', 'userTask')
    expect(classifyShape('test-approval-node')).toBe('userTask')
  })

  it('自定义注册应优先于内置规则', () => {
    // 'bpmn-exclusive-gateway' 内置分类为 'gateway'
    // 注册覆盖后应返回新分类
    registerShapeCategory('test-custom-gateway', 'subProcess')
    expect(classifyShape('test-custom-gateway')).toBe('subProcess')
  })

  it('应支持覆盖已注册的自定义分类', () => {
    registerShapeCategory('test-override-shape', 'task')
    expect(classifyShape('test-override-shape')).toBe('task')

    registerShapeCategory('test-override-shape', 'gateway')
    expect(classifyShape('test-override-shape')).toBe('gateway')
  })
})

// ============================================================================
// emptyBpmnFormData
// ============================================================================

describe('emptyBpmnFormData', () => {
  it('应返回包含所有标准字段的对象', () => {
    const data = emptyBpmnFormData()
    // 字符串字段默认为空字符串
    expect(data.assignee).toBe('')
    expect(data.candidateUsers).toBe('')
    expect(data.candidateGroups).toBe('')
    expect(data.formKey).toBe('')
    expect(data.dueDate).toBe('')
    expect(data.priority).toBe('')
    expect(data.implementationType).toBe('')
    expect(data.implementation).toBe('')
    expect(data.resultVariable).toBe('')
    expect(data.scriptFormat).toBe('')
    expect(data.script).toBe('')
    expect(data.calledElement).toBe('')
    expect(data.defaultFlow).toBe('')
    expect(data.activationCondition).toBe('')
    expect(data.timerValue).toBe('')
    expect(data.messageRef).toBe('')
    expect(data.messageName).toBe('')
    expect(data.signalRef).toBe('')
    expect(data.signalName).toBe('')
    expect(data.errorRef).toBe('')
    expect(data.errorCode).toBe('')
    expect(data.escalationRef).toBe('')
    expect(data.escalationCode).toBe('')
    expect(data.conditionExpression).toBe('')
    expect(data.linkName).toBe('')
    expect(data.activityRef).toBe('')
    expect(data.processRef).toBe('')
    expect(data.annotationText).toBe('')
    expect(data.categoryValueRef).toBe('')
  })

  it('布尔字段应有正确默认值', () => {
    const data = emptyBpmnFormData()
    expect(data.isAsync).toBe(false)
    expect(data.triggeredByEvent).toBe(false)
    expect(data.cancelActivity).toBe(true)
    expect(data.isCollection).toBe(false)
  })

  it('timerType 默认应为 timeDuration', () => {
    const data = emptyBpmnFormData()
    expect(data.timerType).toBe('timeDuration')
  })

  it('每次调用应返回新对象', () => {
    const a = emptyBpmnFormData()
    const b = emptyBpmnFormData()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

// ============================================================================
// 默认节点外观辅助函数
// ============================================================================

describe('默认节点外观辅助函数', () => {
  it('应返回 BPMN 节点默认尺寸', () => {
    expect(resolveBpmnNodeSize('bpmn-pool')).toEqual({ width: 400, height: 200 })
    expect(resolveBpmnNodeSize('bpmn-lane')).toEqual({ width: 370, height: 100 })
    expect(resolveBpmnNodeSize('bpmn-exclusive-gateway')).toEqual({ width: 50, height: 50 })
    expect(resolveBpmnNodeSize('bpmn-start-event')).toEqual({ width: 36, height: 36 })
    expect(resolveBpmnNodeSize('bpmn-user-task')).toEqual({ width: 100, height: 60 })
  })

  it('显式传入宽高时应优先使用宿主值', () => {
    expect(resolveBpmnNodeSize('bpmn-user-task', 180, 72)).toEqual({ width: 180, height: 72 })
  })

  it('应为 Pool 和 Lane 生成 headerLabel attrs', () => {
    expect(buildBpmnNodeAttrs('bpmn-pool', '审批流程')).toEqual({
      headerLabel: { text: '审批流程' },
    })
    expect(buildBpmnNodeAttrs('bpmn-lane', '申请人')).toEqual({
      headerLabel: { text: '申请人' },
    })
  })

  it('应为普通节点生成 label attrs', () => {
    expect(buildBpmnNodeAttrs('bpmn-user-task', '审批')).toEqual({
      label: { text: '审批' },
    })
  })

  it('应统一构建默认节点配置，并为泳道补齐默认数据', () => {
    expect(buildBpmnNodeDefaults('bpmn-lane', { label: '泳道 A' })).toEqual({
      width: 370,
      height: 100,
      attrs: { headerLabel: { text: '泳道 A' } },
      data: {
        label: '泳道 A',
        bpmn: { isHorizontal: true },
      },
    })
  })

  it('应保留宿主自定义 data，并与主库默认值合并', () => {
    expect(buildBpmnNodeDefaults('bpmn-pool', {
      label: '主泳池',
      data: { owner: 'demo', bpmn: { processRef: 'Process_1' } },
    })).toEqual({
      width: 400,
      height: 200,
      attrs: { headerLabel: { text: '主泳池' } },
      data: {
        owner: 'demo',
        label: '主泳池',
        bpmn: {
          isHorizontal: true,
          processRef: 'Process_1',
        },
      },
    })
  })
})

// ============================================================================
// getCellLabel
// ============================================================================

describe('getCellLabel', () => {
  function mockCell(overrides: Record<string, any> = {}) {
    return {
      getData: () => overrides.data ?? {},
      getAttrByPath: (path: string) => overrides.attrs?.[path],
      isEdge: () => overrides.isEdge ?? false,
      getLabels: () => overrides.labels ?? [],
    } as any
  }

  it('应从 data.label 获取标签', () => {
    const cell = mockCell({ data: { label: '用户任务' } })
    expect(getCellLabel(cell)).toBe('用户任务')
  })

  it('data 中无 label 时应从 attr label/text 获取', () => {
    const cell = mockCell({ attrs: { 'label/text': '属性标签' } })
    expect(getCellLabel(cell)).toBe('属性标签')
  })

  it('应从 attr headerLabel/text 获取', () => {
    const cell = mockCell({ attrs: { 'headerLabel/text': '头部标签' } })
    expect(getCellLabel(cell)).toBe('头部标签')
  })

  it('Edge 应从 labels 数组获取', () => {
    const cell = mockCell({
      isEdge: true,
      labels: [{ attrs: { label: { text: '边标签' } } }],
    })
    expect(getCellLabel(cell)).toBe('边标签')
  })

  it('Edge labels 使用 text.text 备选路径', () => {
    const cell = mockCell({
      isEdge: true,
      labels: [{ attrs: { text: { text: '文本标签' } } }],
    })
    expect(getCellLabel(cell)).toBe('文本标签')
  })

  it('所有路径都无标签时应返回空字符串', () => {
    const cell = mockCell({})
    expect(getCellLabel(cell)).toBe('')
  })

  it('Edge 无 labels 时应返回空字符串', () => {
    const cell = mockCell({ isEdge: true, labels: [] })
    expect(getCellLabel(cell)).toBe('')
  })

  it('Edge labels 存在 attrs 但无 label.text 和 text.text 时应返回空字符串', () => {
    const cell = mockCell({
      isEdge: true,
      labels: [{ attrs: { other: { foo: 'bar' } } }],
    })
    expect(getCellLabel(cell)).toBe('')
  })

  it('getData 返回 null 时应安全处理', () => {
    const cell = {
      getData: () => null,
      getAttrByPath: () => undefined,
      isEdge: () => false,
      getLabels: () => [],
    } as any
    expect(getCellLabel(cell)).toBe('')
  })
})

// ============================================================================
// loadBpmnFormData
// ============================================================================

describe('loadBpmnFormData', () => {
  function mockCell(shape: string, bpmn: Record<string, any> = {}, extra: Record<string, any> = {}) {
    return {
      shape,
      getData: () => ({ bpmn, ...extra }),
      getAttrByPath: () => undefined,
      isEdge: () => false,
      getLabels: () => [],
    } as any
  }

  it('应加载 userTask 的所有字段', () => {
    const cell = mockCell('bpmn-user-task', {
      assignee: 'alice', candidateUsers: 'bob', candidateGroups: 'admin',
      formKey: 'form1', dueDate: '2024-01-01', priority: 'high',
    })
    const form = loadBpmnFormData(cell)
    expect(form.assignee).toBe('alice')
    expect(form.candidateUsers).toBe('bob')
    expect(form.candidateGroups).toBe('admin')
    expect(form.formKey).toBe('form1')
    expect(form.dueDate).toBe('2024-01-01')
    expect(form.priority).toBe('high')
  })

  it('应正确加载布尔字段', () => {
    const cell = mockCell('bpmn-service-task', { isAsync: true })
    expect(loadBpmnFormData(cell).isAsync).toBe(true)
  })

  it('event-sub-process 的 triggeredByEvent 应为 true', () => {
    const cell = mockCell('bpmn-event-sub-process', {})
    expect(loadBpmnFormData(cell).triggeredByEvent).toBe(true)
  })

  it('cancelActivity 默认应为 true', () => {
    const cell = mockCell('bpmn-boundary-event', {})
    expect(loadBpmnFormData(cell).cancelActivity).toBe(true)
  })

  it('非中断边界事件在缺省数据下应回退为 false', () => {
    const cell = mockCell('bpmn-boundary-event-escalation-non-interrupting', {})
    expect(loadBpmnFormData(cell).cancelActivity).toBe(false)
  })

  it('shape 缺失时 cancelActivity 缺省应回退为 true', () => {
    const cell = { getData: () => ({ bpmn: {} }), getAttrByPath: () => undefined, isEdge: () => false, getLabels: () => [] } as any
    expect(loadBpmnFormData(cell).cancelActivity).toBe(true)
  })

  it('cancelActivity=false 应保持为 false', () => {
    const cell = mockCell('bpmn-boundary-event', { cancelActivity: false })
    expect(loadBpmnFormData(cell).cancelActivity).toBe(false)
  })

  it('应加载自定义扩展字段', () => {
    const cell = mockCell('bpmn-user-task', { customField: 'val' })
    expect(loadBpmnFormData(cell).customField).toBe('val')
  })

  it('无 bpmn 数据时应返回空表单', () => {
    const cell = { shape: 'bpmn-task', getData: () => ({}), getAttrByPath: () => undefined, isEdge: () => false, getLabels: () => [] } as any
    expect(loadBpmnFormData(cell).assignee).toBe('')
  })

  it('getData 返回 null 时应安全处理', () => {
    const cell = { shape: 'bpmn-task', getData: () => null, getAttrByPath: () => undefined, isEdge: () => false, getLabels: () => [] } as any
    expect(loadBpmnFormData(cell).assignee).toBe('')
  })

  it('annotationText 应回退到 cellLabel', () => {
    const cell = { shape: 'bpmn-text-annotation', getData: () => ({ bpmn: {}, label: '注释' }), getAttrByPath: () => undefined, isEdge: () => false, getLabels: () => [] } as any
    expect(loadBpmnFormData(cell).annotationText).toBe('注释')
  })

  it('所有字符串字段应加载完整', () => {
    const cell = mockCell('bpmn-task', {
      timerType: 'timeCycle', timerValue: 'R3/PT10H',
      messageRef: 'msg1', messageName: 'mm', signalRef: 'sig1', signalName: 'ss',
      errorRef: 'err1', errorCode: 'E1', escalationRef: 'esc1', escalationCode: 'EC1',
      conditionExpression: '${x}', linkName: 'L1', activityRef: 'act1',
      processRef: 'proc1', annotationText: 'note', categoryValueRef: 'cat1',
    })
    const form = loadBpmnFormData(cell)
    expect(form.timerType).toBe('timeCycle')
    expect(form.timerValue).toBe('R3/PT10H')
    expect(form.messageRef).toBe('msg1')
    expect(form.signalRef).toBe('sig1')
    expect(form.errorRef).toBe('err1')
    expect(form.escalationRef).toBe('esc1')
    expect(form.conditionExpression).toBe('${x}')
    expect(form.linkName).toBe('L1')
    expect(form.activityRef).toBe('act1')
    expect(form.processRef).toBe('proc1')
    expect(form.categoryValueRef).toBe('cat1')
  })
})

// ============================================================================
// saveBpmnFormData
// ============================================================================

describe('saveBpmnFormData', () => {
  it('userTask 应只保存相关字段', () => {
    const form = { ...emptyBpmnFormData(), assignee: 'alice', priority: 'high', script: 'x=1' }
    const bpmn = saveBpmnFormData('userTask', form)
    expect(bpmn.assignee).toBe('alice')
    expect(bpmn.priority).toBe('high')
    expect(bpmn.script).toBeUndefined()
  })

  it('userTask 应保存 candidateUsers/candidateGroups/formKey/dueDate', () => {
    const form = {
      ...emptyBpmnFormData(),
      candidateUsers: 'u1,u2',
      candidateGroups: 'g1',
      formKey: 'myForm',
      dueDate: '2025-01-01',
    }
    const bpmn = saveBpmnFormData('userTask', form)
    expect(bpmn.candidateUsers).toBe('u1,u2')
    expect(bpmn.candidateGroups).toBe('g1')
    expect(bpmn.formKey).toBe('myForm')
    expect(bpmn.dueDate).toBe('2025-01-01')
  })

  it('serviceTask 应保存实现类型和异步标志', () => {
    const form = { ...emptyBpmnFormData(), implementationType: 'class', implementation: 'com.Foo', isAsync: true }
    const bpmn = saveBpmnFormData('serviceTask', form)
    expect(bpmn.implementationType).toBe('class')
    expect(bpmn.isAsync).toBe(true)
  })

  it('scriptTask 应保存脚本相关字段', () => {
    const form = { ...emptyBpmnFormData(), scriptFormat: 'groovy', script: 'println 1', resultVariable: 'res' }
    const bpmn = saveBpmnFormData('scriptTask', form)
    expect(bpmn.scriptFormat).toBe('groovy')
    expect(bpmn.script).toBe('println 1')
    expect(bpmn.resultVariable).toBe('res')
  })

  it('callActivity 应保存 calledElement 和 isAsync', () => {
    const form = { ...emptyBpmnFormData(), calledElement: 'sub1', isAsync: true }
    const bpmn = saveBpmnFormData('callActivity', form)
    expect(bpmn.calledElement).toBe('sub1')
    expect(bpmn.isAsync).toBe(true)
  })

  it('subProcess + event-sub-process 应保存 triggeredByEvent', () => {
    const bpmn = saveBpmnFormData('subProcess', emptyBpmnFormData(), 'bpmn-event-sub-process')
    expect(bpmn.triggeredByEvent).toBe(true)
  })

  it('gateway 应保存 defaultFlow 和 activationCondition', () => {
    const form = { ...emptyBpmnFormData(), defaultFlow: 'f1', activationCondition: 'x>1' }
    const bpmn = saveBpmnFormData('gateway', form)
    expect(bpmn.defaultFlow).toBe('f1')
    expect(bpmn.activationCondition).toBe('x>1')
  })

  it('timerEvent 应保存 timerType 和 timerValue', () => {
    const form = { ...emptyBpmnFormData(), timerType: 'timeCycle', timerValue: 'R3/PT10H' }
    const bpmn = saveBpmnFormData('timerEvent', form)
    expect(bpmn.timerType).toBe('timeCycle')
    expect(bpmn.timerValue).toBe('R3/PT10H')
  })

  it('messageEvent 应保存消息字段', () => {
    const form = { ...emptyBpmnFormData(), messageRef: 'msg1', messageName: '消息' }
    const bpmn = saveBpmnFormData('messageEvent', form)
    expect(bpmn.messageRef).toBe('msg1')
  })

  it('signalEvent / errorEvent / escalationEvent 各存各字段', () => {
    expect(saveBpmnFormData('signalEvent', { ...emptyBpmnFormData(), signalRef: 's1', signalName: 'S' }).signalRef).toBe('s1')
    expect(saveBpmnFormData('errorEvent', { ...emptyBpmnFormData(), errorRef: 'e1', errorCode: 'E' }).errorRef).toBe('e1')
    expect(saveBpmnFormData('escalationEvent', { ...emptyBpmnFormData(), escalationRef: 'es1', escalationCode: 'EC' }).escalationRef).toBe('es1')
  })

  it('conditionalEvent / sequenceFlow 应保存 conditionExpression', () => {
    expect(saveBpmnFormData('conditionalEvent', { ...emptyBpmnFormData(), conditionExpression: '${x}' }).conditionExpression).toBe('${x}')
    expect(saveBpmnFormData('sequenceFlow', { ...emptyBpmnFormData(), conditionExpression: '${y}' }).conditionExpression).toBe('${y}')
  })

  it('linkEvent / compensationEvent 应保存各自字段', () => {
    expect(saveBpmnFormData('linkEvent', { ...emptyBpmnFormData(), linkName: 'L' }).linkName).toBe('L')
    expect(saveBpmnFormData('compensationEvent', { ...emptyBpmnFormData(), activityRef: 'a1' }).activityRef).toBe('a1')
  })

  it('边界事件shapeName应保存cancelActivity', () => {
    const form = { ...emptyBpmnFormData(), cancelActivity: false }
    expect(saveBpmnFormData('timerEvent', form, 'bpmn-boundary-event-timer').cancelActivity).toBe(false)
  })

  it('dataObject / pool / textAnnotation / group 各字段', () => {
    expect(saveBpmnFormData('dataObject', { ...emptyBpmnFormData(), isCollection: true }).isCollection).toBe(true)
    expect(saveBpmnFormData('pool', { ...emptyBpmnFormData(), processRef: 'p1' }).processRef).toBe('p1')
    expect(saveBpmnFormData('textAnnotation', { ...emptyBpmnFormData(), annotationText: 'n' }).annotationText).toBe('n')
    expect(saveBpmnFormData('group', { ...emptyBpmnFormData(), categoryValueRef: 'c1' }).categoryValueRef).toBe('c1')
  })

  it('空值字段不应保存', () => {
    const bpmn = saveBpmnFormData('userTask', emptyBpmnFormData())
    expect(bpmn.assignee).toBeUndefined()
  })

  it('自定义扩展字段应被保存', () => {
    const form = { ...emptyBpmnFormData(), myCustom: 'val' } as any
    expect(saveBpmnFormData('userTask', form).myCustom).toBe('val')
  })

  it('sendTask/receiveTask/businessRuleTask 应保存实现和消息字段', () => {
    expect(saveBpmnFormData('sendTask', { ...emptyBpmnFormData(), implementationType: 'exp', messageRef: 'm1' }).implementationType).toBe('exp')
    expect(saveBpmnFormData('receiveTask', { ...emptyBpmnFormData(), implementationType: 'cls', messageRef: 'm2' }).messageRef).toBe('m2')
    expect(saveBpmnFormData('businessRuleTask', { ...emptyBpmnFormData(), resultVariable: 'r' }).resultVariable).toBe('r')
  })

  it('messageFlow 应保存消息字段', () => {
    expect(saveBpmnFormData('messageFlow', { ...emptyBpmnFormData(), messageName: 'MF' }).messageName).toBe('MF')
  })

  it('各分类空值字段不应保存（覆盖 FALSE 分支）', () => {
    const e = emptyBpmnFormData()
    // scriptTask: empty fields → no output
    const st = saveBpmnFormData('scriptTask', e)
    expect(st.scriptFormat).toBeUndefined()
    expect(st.script).toBeUndefined()
    expect(st.resultVariable).toBeUndefined()
    // callActivity: empty calledElement → no output
    const ca = saveBpmnFormData('callActivity', e)
    expect(ca.calledElement).toBeUndefined()
    // gateway: empty defaultFlow / activationCondition → no output
    const gw = saveBpmnFormData('gateway', e)
    expect(gw.defaultFlow).toBeUndefined()
    expect(gw.activationCondition).toBeUndefined()
    // timerEvent: empty timerValue → no output for optional field
    const te = saveBpmnFormData('timerEvent', e)
    expect(te.timerValue).toBeUndefined()
    // messageEvent: empty messageRef, messageName → no output
    const me = saveBpmnFormData('messageEvent', e)
    expect(me.messageRef).toBeUndefined()
    expect(me.messageName).toBeUndefined()
    // signalEvent: empty signalRef, signalName → no output
    const se = saveBpmnFormData('signalEvent', e)
    expect(se.signalRef).toBeUndefined()
    expect(se.signalName).toBeUndefined()
    // errorEvent: empty errorRef, errorCode → no output
    const ee = saveBpmnFormData('errorEvent', e)
    expect(ee.errorRef).toBeUndefined()
    expect(ee.errorCode).toBeUndefined()
    // escalationEvent: empty escalationRef, escalationCode → no output
    const esc = saveBpmnFormData('escalationEvent', e)
    expect(esc.escalationRef).toBeUndefined()
    expect(esc.escalationCode).toBeUndefined()
    // conditionalEvent: empty conditionExpression → no output
    const ce = saveBpmnFormData('conditionalEvent', e)
    expect(ce.conditionExpression).toBeUndefined()
    // linkEvent: empty linkName → no output
    const le = saveBpmnFormData('linkEvent', e)
    expect(le.linkName).toBeUndefined()
    // compensationEvent: empty activityRef → no output
    const co = saveBpmnFormData('compensationEvent', e)
    expect(co.activityRef).toBeUndefined()
    // pool: empty processRef → no output
    const po = saveBpmnFormData('pool', e)
    expect(po.processRef).toBeUndefined()
    // textAnnotation: empty annotationText → no output
    const ta = saveBpmnFormData('textAnnotation', e)
    expect(ta.annotationText).toBeUndefined()
    // group: empty categoryValueRef → no output
    const gr = saveBpmnFormData('group', e)
    expect(gr.categoryValueRef).toBeUndefined()
  })
})
