/**
 * BPMN 2.0 连线规则模块测试
 *
 * 覆盖：
 * - getNodeCategory() 节点分类映射
 * - validateBpmnConnection() 核心验证逻辑
 * - DEFAULT_CONNECTION_RULES 规则表完整性
 * - 自定义规则合并
 * - createBpmnValidateConnection() X6 适配封装
 */

import { describe, it, expect } from 'vitest'
import {
  getNodeCategory,
  DEFAULT_CONNECTION_RULES,
  type BpmnNodeCategory,
} from '../../../src/rules/connection-rules'
import {
  validateBpmnConnection,
  createBpmnValidateConnection,
  createBpmnValidateConnectionWithResult,
  type BpmnConnectionContext,
} from '../../../src/rules/validator'
import {
  BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,

  BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,

  BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ERROR,

  BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ERROR,
  BPMN_END_EVENT_TERMINATE,

  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,

  BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,

  BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY,

  BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE,

  BPMN_TEXT_ANNOTATION, BPMN_GROUP,
  BPMN_POOL, BPMN_LANE,

  BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../../../src/utils/constants'

// ============================================================================
// getNodeCategory 测试
// ============================================================================

describe('getNodeCategory', () => {
  it('应将所有开始事件归为 startEvent', () => {
    const startEvents = [
      BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
      BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
      BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
    ]
    for (const shape of startEvents) {
      expect(getNodeCategory(shape)).toBe('startEvent')
    }
  })

  it('应将中间抛出事件归为 intermediateThrowEvent', () => {
    expect(getNodeCategory(BPMN_INTERMEDIATE_THROW_EVENT)).toBe('intermediateThrowEvent')
    expect(getNodeCategory(BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE)).toBe('intermediateThrowEvent')
  })

  it('应将中间捕获事件归为 intermediateCatchEvent', () => {
    expect(getNodeCategory(BPMN_INTERMEDIATE_CATCH_EVENT)).toBe('intermediateCatchEvent')
    expect(getNodeCategory(BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE)).toBe('intermediateCatchEvent')
    expect(getNodeCategory(BPMN_INTERMEDIATE_CATCH_EVENT_TIMER)).toBe('intermediateCatchEvent')
  })

  it('应将边界事件归为 boundaryEvent', () => {
    expect(getNodeCategory(BPMN_BOUNDARY_EVENT)).toBe('boundaryEvent')
    expect(getNodeCategory(BPMN_BOUNDARY_EVENT_MESSAGE)).toBe('boundaryEvent')
    expect(getNodeCategory(BPMN_BOUNDARY_EVENT_TIMER)).toBe('boundaryEvent')
  })

  it('应将结束事件归为 endEvent', () => {
    expect(getNodeCategory(BPMN_END_EVENT)).toBe('endEvent')
    expect(getNodeCategory(BPMN_END_EVENT_MESSAGE)).toBe('endEvent')
    expect(getNodeCategory(BPMN_END_EVENT_ERROR)).toBe('endEvent')
    expect(getNodeCategory(BPMN_END_EVENT_TERMINATE)).toBe('endEvent')
  })

  it('应将所有任务归为 task', () => {
    const tasks = [
      BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
      BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
    ]
    for (const shape of tasks) {
      expect(getNodeCategory(shape)).toBe('task')
    }
  })

  it('应将子流程和调用活动归为 subProcess', () => {
    const subProcesses = [
      BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
      BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
    ]
    for (const shape of subProcesses) {
      expect(getNodeCategory(shape)).toBe('subProcess')
    }
  })

  it('应将网关归为 gateway', () => {
    const gateways = [
      BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY,
    ]
    for (const shape of gateways) {
      expect(getNodeCategory(shape)).toBe('gateway')
    }
  })

  it('应将数据元素归为 dataElement', () => {
    const dataElements = [BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE]
    for (const shape of dataElements) {
      expect(getNodeCategory(shape)).toBe('dataElement')
    }
  })

  it('应将工件归为 artifact', () => {
    expect(getNodeCategory(BPMN_TEXT_ANNOTATION)).toBe('artifact')
    expect(getNodeCategory(BPMN_GROUP)).toBe('artifact')
  })

  it('应将泳道归为 swimlane', () => {
    expect(getNodeCategory(BPMN_POOL)).toBe('swimlane')
    expect(getNodeCategory(BPMN_LANE)).toBe('swimlane')
  })

  it('未知图形应返回 unknown', () => {
    expect(getNodeCategory('some-unknown-shape')).toBe('unknown')
    expect(getNodeCategory('')).toBe('unknown')
  })
})

// ============================================================================
// DEFAULT_CONNECTION_RULES 完整性测试
// ============================================================================

describe('DEFAULT_CONNECTION_RULES', () => {
  const allCategories: BpmnNodeCategory[] = [
    'startEvent', 'intermediateThrowEvent', 'intermediateCatchEvent',
    'boundaryEvent', 'endEvent', 'task', 'subProcess', 'gateway',
    'dataElement', 'artifact', 'swimlane', 'unknown',
  ]

  it('应为所有节点分类提供规则', () => {
    for (const category of allCategories) {
      expect(DEFAULT_CONNECTION_RULES[category]).toBeDefined()
    }
  })

  it('开始事件规则：noIncoming 为 true', () => {
    expect(DEFAULT_CONNECTION_RULES.startEvent.noIncoming).toBe(true)
  })

  it('结束事件规则：noOutgoing 为 true', () => {
    expect(DEFAULT_CONNECTION_RULES.endEvent.noOutgoing).toBe(true)
  })

  it('边界事件规则：noIncoming 为 true', () => {
    expect(DEFAULT_CONNECTION_RULES.boundaryEvent.noIncoming).toBe(true)
  })

  it('任务出线应包含顺序流和数据关联', () => {
    const rule = DEFAULT_CONNECTION_RULES.task
    expect(rule.allowedOutgoing).toContain(BPMN_SEQUENCE_FLOW)
    expect(rule.allowedOutgoing).toContain(BPMN_DATA_ASSOCIATION)
    expect(rule.allowedOutgoing).toContain(BPMN_MESSAGE_FLOW)
  })

  it('数据元素只能通过数据关联和关联连接', () => {
    const rule = DEFAULT_CONNECTION_RULES.dataElement
    expect(rule.allowedOutgoing).toContain(BPMN_DATA_ASSOCIATION)
    expect(rule.allowedOutgoing).toContain(BPMN_ASSOCIATION)
    expect(rule.allowedOutgoing).not.toContain(BPMN_SEQUENCE_FLOW)
  })

  it('工件只能通过关联连接', () => {
    const rule = DEFAULT_CONNECTION_RULES.artifact
    expect(rule.allowedOutgoing).toContain(BPMN_ASSOCIATION)
    expect(rule.allowedOutgoing).not.toContain(BPMN_SEQUENCE_FLOW)
  })

  it('未知分类规则应为空（不限制）', () => {
    const rule = DEFAULT_CONNECTION_RULES.unknown
    expect(rule.allowedOutgoing).toBeUndefined()
    expect(rule.allowedIncoming).toBeUndefined()
    expect(rule.noOutgoing).toBeUndefined()
    expect(rule.noIncoming).toBeUndefined()
  })
})

// ============================================================================
// validateBpmnConnection 测试
// ============================================================================

describe('validateBpmnConnection', () => {
  /**
   * 创建连线上下文辅助函数
   */
  function ctx(
    sourceShape: string,
    targetShape: string,
    edgeShape: string = BPMN_SEQUENCE_FLOW,
    extra: Partial<BpmnConnectionContext> = {},
  ): BpmnConnectionContext {
    return { sourceShape, targetShape, edgeShape, ...extra }
  }

  // ---------- 合法连线 ----------

  describe('合法连线场景', () => {
    it('开始事件 → 任务（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_USER_TASK))
      expect(result.valid).toBe(true)
    })

    it('开始事件 → 网关（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_EXCLUSIVE_GATEWAY))
      expect(result.valid).toBe(true)
    })

    it('任务 → 任务（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK))
      expect(result.valid).toBe(true)
    })

    it('任务 → 结束事件（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_END_EVENT))
      expect(result.valid).toBe(true)
    })

    it('网关 → 任务（条件流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_USER_TASK, BPMN_CONDITIONAL_FLOW),
      )
      expect(result.valid).toBe(true)
    })

    it('网关 → 任务（默认流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_USER_TASK, BPMN_DEFAULT_FLOW),
      )
      expect(result.valid).toBe(true)
    })

    it('任务 → 中间抛出事件（顺序流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_INTERMEDIATE_THROW_EVENT),
      )
      expect(result.valid).toBe(true)
    })

    it('边界事件 → 任务（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_BOUNDARY_EVENT_TIMER, BPMN_USER_TASK))
      expect(result.valid).toBe(true)
    })

    it('子流程 → 结束事件（顺序流）应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_SUB_PROCESS, BPMN_END_EVENT))
      expect(result.valid).toBe(true)
    })

    it('数据对象 → 任务（数据关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_DATA_OBJECT, BPMN_USER_TASK, BPMN_DATA_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('文本注释 → 任务（关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_TEXT_ANNOTATION, BPMN_USER_TASK, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('任务 → 任务（消息流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(true)
    })

    it('未知分类不限制连线', () => {
      const result = validateBpmnConnection(
        ctx('custom-node', 'another-custom-node', BPMN_SEQUENCE_FLOW),
      )
      expect(result.valid).toBe(true)
    })
  })

  // ---------- 非法连线 ----------

  describe('非法连线场景', () => {
    it('结束事件不能有出线', () => {
      const result = validateBpmnConnection(ctx(BPMN_END_EVENT, BPMN_USER_TASK))
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许有出线')
    })

    it('开始事件不能有入线', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_START_EVENT))
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许有入线')
    })

    it('边界事件不能有入线', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_BOUNDARY_EVENT))
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许有入线')
    })

    it('开始事件不能连接到开始事件', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_START_EVENT))
      // 会触发 noIncoming（开始事件作为目标不允许入线）
      expect(result.valid).toBe(false)
    })

    it('开始事件不能连接到边界事件', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_BOUNDARY_EVENT))
      expect(result.valid).toBe(false)
    })

    it('开始事件不能连接到数据对象', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_DATA_OBJECT))
      expect(result.valid).toBe(false)
    })

    it('数据对象不能使用顺序流', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_DATA_OBJECT, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许使用')
    })

    it('网关不能通过顺序流连接到数据对象', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_DATA_OBJECT, BPMN_SEQUENCE_FLOW),
      )
      expect(result.valid).toBe(false)
    })

    it('开始事件不能使用消息流', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_USER_TASK, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许使用')
    })

    it('网关不能使用消息流', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_USER_TASK, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(false)
    })

    it('开始事件不能连接到泳道', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_POOL, BPMN_SEQUENCE_FLOW),
      )
      expect(result.valid).toBe(false)
    })
  })

  // ---------- 数量限制 ----------

  describe('数量限制', () => {
    it('当设置了 maxOutgoing 且超限时应拒绝', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW, {
          sourceOutgoingCount: 1,
        }),
        {
          customRules: {
            startEvent: { maxOutgoing: 1 },
          },
        },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('出线数量已达上限')
    })

    it('当设置了 maxIncoming 且超限时应拒绝', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_END_EVENT, BPMN_SEQUENCE_FLOW, {
          targetIncomingCount: 1,
        }),
        {
          customRules: {
            endEvent: { maxIncoming: 1 },
          },
        },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('入线数量已达上限')
    })

    it('未超限时应允许', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SEQUENCE_FLOW, {
          sourceOutgoingCount: 2,
          targetIncomingCount: 3,
        }),
        {
          customRules: {
            task: { maxOutgoing: 10, maxIncoming: 10 },
          },
        },
      )
      expect(result.valid).toBe(true)
    })
  })

  // ---------- 自定义规则 ----------

  describe('自定义规则', () => {
    it('自定义规则应与默认规则合并', () => {
      // 默认规则中开始事件 noIncoming=true，自定义增加 maxOutgoing
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW, {
          sourceOutgoingCount: 3,
        }),
        {
          customRules: {
            startEvent: { maxOutgoing: 3 },
          },
        },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('出线数量已达上限')
    })

    it('自定义规则可覆盖默认禁止', () => {
      // 默认规则中结束事件 noOutgoing=true
      // 自定义规则覆盖为 noOutgoing=false
      const result = validateBpmnConnection(
        ctx(BPMN_END_EVENT, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW),
        {
          customRules: {
            endEvent: { noOutgoing: false },
          },
        },
      )
      // 仍可能因其他规则（如 allowedOutgoing 未包含）而失败，
      // 但 noOutgoing 这一检查应该放行
      // 此处 endEvent 的 allowedIncoming 限制不影响出线方向
      expect(result.valid).toBe(true)
    })

    it('allowUnknownEdgeTypes 选项应放行未知连线类型', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_USER_TASK, 'custom-edge-type'),
        { allowUnknownEdgeTypes: true },
      )
      // 开始事件 allowedOutgoing 不包含 custom-edge-type，
      // 但 allowUnknownEdgeTypes=true 应放行连线类型检查
      // 其他检查（如 forbiddenTargets）仍生效
      expect(result.valid).toBe(true)
    })

    it('allowUnknownEdgeTypes=false 时不放行未知连线类型', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_USER_TASK, 'custom-edge-type'),
        { allowUnknownEdgeTypes: false },
      )
      expect(result.valid).toBe(false)
    })
  })

  // ---------- 关联连线 ----------

  describe('关联连线', () => {
    it('文本注释 → 网关（关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_TEXT_ANNOTATION, BPMN_EXCLUSIVE_GATEWAY, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('文本注释 → 任务（定向关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_TEXT_ANNOTATION, BPMN_USER_TASK, BPMN_DIRECTED_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('网关 → 任务（关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_USER_TASK, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('开始事件 → 文本注释（关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_START_EVENT, BPMN_TEXT_ANNOTATION, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })
  })

  // ---------- 消息流 ----------

  describe('消息流', () => {
    it('任务 → 子流程（消息流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SUB_PROCESS, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(true)
    })

    it('池 → 池（消息流）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_POOL, BPMN_POOL, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(true)
    })
  })

  // ---------- 数据关联 ----------

  describe('数据关联', () => {
    it('数据对象 → 任务（数据关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_DATA_OBJECT, BPMN_USER_TASK, BPMN_DATA_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('任务 → 数据存储（数据关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_DATA_STORE, BPMN_DATA_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('数据对象 → 数据存储（数据关联）应通过', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_DATA_OBJECT, BPMN_DATA_STORE, BPMN_DATA_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('数据对象不能通过消息流连接', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_DATA_OBJECT, BPMN_USER_TASK, BPMN_MESSAGE_FLOW),
      )
      expect(result.valid).toBe(false)
    })
  })

  // ---------- 综合场景 ----------

  describe('综合场景', () => {
    it('完整流程链路：开始 → 任务 → 网关 → 子流程 → 结束', () => {
      expect(validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_USER_TASK)).valid).toBe(true)
      expect(validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_EXCLUSIVE_GATEWAY)).valid).toBe(true)
      expect(validateBpmnConnection(ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_SUB_PROCESS, BPMN_CONDITIONAL_FLOW)).valid).toBe(true)
      expect(validateBpmnConnection(ctx(BPMN_SUB_PROCESS, BPMN_END_EVENT)).valid).toBe(true)
    })

    it('边界事件异常处理链路：边界事件 → 任务 → 结束', () => {
      expect(validateBpmnConnection(ctx(BPMN_BOUNDARY_EVENT_ERROR, BPMN_SERVICE_TASK)).valid).toBe(true)
      expect(validateBpmnConnection(ctx(BPMN_SERVICE_TASK, BPMN_END_EVENT_ERROR)).valid).toBe(true)
    })

    it('数据流链路：数据输入 → 任务 → 数据输出', () => {
      expect(validateBpmnConnection(ctx(BPMN_DATA_INPUT, BPMN_USER_TASK, BPMN_DATA_ASSOCIATION)).valid).toBe(true)
      expect(validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_DATA_OUTPUT, BPMN_DATA_ASSOCIATION)).valid).toBe(true)
    })
  })

  // ---------- 自连接测试 ----------

  describe('自连接场景', () => {
    it('任务自连接应通过（BPMN 允许循环）', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_USER_TASK))
      expect(result.valid).toBe(true)
    })

    it('网关自连接应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_EXCLUSIVE_GATEWAY, BPMN_EXCLUSIVE_GATEWAY))
      expect(result.valid).toBe(true)
    })

    it('开始事件自连接应失败（noIncoming）', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_START_EVENT))
      expect(result.valid).toBe(false)
    })

    it('结束事件自连接应失败（noOutgoing）', () => {
      const result = validateBpmnConnection(ctx(BPMN_END_EVENT, BPMN_END_EVENT))
      expect(result.valid).toBe(false)
    })
  })

  // ---------- 泳道连接规则 ----------

  describe('泳道连线限制', () => {
    it('泳道不能通过顺序流连接到任务', () => {
      const result = validateBpmnConnection(ctx(BPMN_POOL, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW))
      expect(result.valid).toBe(false)
    })

    it('泳道不能通过顺序流连接到网关', () => {
      const result = validateBpmnConnection(ctx(BPMN_LANE, BPMN_EXCLUSIVE_GATEWAY, BPMN_SEQUENCE_FLOW))
      expect(result.valid).toBe(false)
    })

    it('任务不能通过顺序流连接到泳道', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_POOL, BPMN_SEQUENCE_FLOW))
      expect(result.valid).toBe(false)
    })
  })

  // ---------- 边界事件更多场景 ----------

  describe('边界事件扩展场景', () => {
    it('边界事件 → 网关 应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_BOUNDARY_EVENT, BPMN_EXCLUSIVE_GATEWAY))
      expect(result.valid).toBe(true)
    })

    it('边界事件 → 子流程 应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_BOUNDARY_EVENT, BPMN_SUB_PROCESS))
      expect(result.valid).toBe(true)
    })

    it('边界事件 → 结束事件 应通过', () => {
      const result = validateBpmnConnection(ctx(BPMN_BOUNDARY_EVENT_ERROR, BPMN_END_EVENT))
      expect(result.valid).toBe(true)
    })

    it('任务 → 边界事件 应失败（边界事件 noIncoming）', () => {
      const result = validateBpmnConnection(ctx(BPMN_SERVICE_TASK, BPMN_BOUNDARY_EVENT_TIMER))
      expect(result.valid).toBe(false)
    })
  })

  // ---------- maxOutgoing=0 和 maxIncoming=0 ----------

  describe('自定义规则极端数量限制', () => {
    it('maxOutgoing=0 应禁止所有出线', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SEQUENCE_FLOW, {
          sourceOutgoingCount: 0,
        }),
        {
          customRules: {
            task: { maxOutgoing: 0 },
          },
        },
      )
      expect(result.valid).toBe(false)
    })

    it('maxIncoming=0 应禁止所有入线', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SEQUENCE_FLOW, {
          targetIncomingCount: 0,
        }),
        {
          customRules: {
            task: { maxIncoming: 0 },
          },
        },
      )
      expect(result.valid).toBe(false)
    })
  })
})

// ============================================================================
// createBpmnValidateConnection — X6 适配封装
// ============================================================================

describe('createBpmnValidateConnection', () => {
  function mockNode(id: string, shape: string, graph?: any) {
    return { id, shape, model: graph ? { graph } : undefined }
  }

  it('目标无磁吸点时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({ targetMagnet: null, sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: mockNode('2', BPMN_SERVICE_TASK) })).toBe(false)
  })

  it('源节点为空时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({ targetMagnet: document.createElement('div'), sourceCell: null, targetCell: mockNode('2', BPMN_SERVICE_TASK) })).toBe(false)
  })

  it('目标节点为空时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({ targetMagnet: document.createElement('div'), sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: null })).toBe(false)
  })

  it('自连接应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    const node = mockNode('same', BPMN_USER_TASK)
    expect(validate({ targetMagnet: document.createElement('div'), sourceCell: node, targetCell: node })).toBe(false)
  })

  it('合法连线应返回 true', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    })).toBe(true)
  })

  it('结束事件作为源应返回 false (noOutgoing)', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_END_EVENT),
      targetCell: mockNode('2', BPMN_USER_TASK),
    })).toBe(false)
  })

  it('带 graph 的节点应能计算出入线数量', () => {
    const graph = {
      getConnectedEdges: (_node: any, opts: any) => {
        if (opts.outgoing) return [1, 2, 3]
        if (opts.incoming) return [1]
        return []
      },
    }
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 3 } },
    })
    expect(validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, graph),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, graph),
    })).toBe(false)
  })

  it('graph.getConnectedEdges 抛异常时应返回 0 并正常验证', () => {
    const graph = {
      getConnectedEdges: () => { throw new Error('mock error') },
    }
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, graph),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, graph),
    })).toBe(true)
  })

  it('node.model 为空时 count 应为 0', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 1 } },
    })
    // 无 graph，count = 0，maxOutgoing=1 时 0 < 1 应放行
    expect(validate({
      targetMagnet: document.createElement('div'),
      sourceCell: { id: '1', shape: BPMN_USER_TASK, model: undefined },
      targetCell: { id: '2', shape: BPMN_SERVICE_TASK, model: undefined },
    })).toBe(true)
  })
})

// ============================================================================
// createBpmnValidateConnectionWithResult — 带详细结果
// ============================================================================

describe('createBpmnValidateConnectionWithResult', () => {
  function mockNode(id: string, shape: string, graph?: any) {
    return { id, shape, model: graph ? { graph } : undefined }
  }

  it('目标无磁吸点时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate({ targetMagnet: null, sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: mockNode('2', BPMN_SERVICE_TASK) })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('连接桩')
  })

  it('源节点为空时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate({ targetMagnet: document.createElement('div'), sourceCell: null, targetCell: mockNode('2', BPMN_SERVICE_TASK) })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不存在')
  })

  it('目标节点为空时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate({ targetMagnet: document.createElement('div'), sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: null })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不存在')
  })

  it('自连接应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const node = mockNode('same', BPMN_USER_TASK)
    const result = validate({ targetMagnet: document.createElement('div'), sourceCell: node, targetCell: node })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('自连接')
  })

  it('合法连线应返回 valid=true', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    })
    expect(result.valid).toBe(true)
  })

  it('带 graph 的节点应统计出入线数量用于验证', () => {
    const graph = {
      getConnectedEdges: (_node: any, opts: any) => {
        if (opts.outgoing) return Array(5)
        if (opts.incoming) return Array(5)
        return []
      },
    }
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 5 } },
    })
    const result = validate({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, graph),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, graph),
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('上限')
  })
})

// ============================================================================
// validateBpmnConnection — allowedOutgoing / allowedIncoming + allowUnknownEdgeTypes
// ============================================================================

describe('validateBpmnConnection — 边类型限制与 allowUnknownEdgeTypes', () => {
  it('allowedOutgoing 不含边类型时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_SERVICE_TASK, edgeShape: 'custom-edge' },
      { customRules: { task: { allowedOutgoing: [BPMN_SEQUENCE_FLOW] } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('出线')
  })

  it('allowedOutgoing 不含边类型但 allowUnknownEdgeTypes=true 时应放行', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_SERVICE_TASK, edgeShape: 'custom-edge' },
      { customRules: { task: { allowedOutgoing: [BPMN_SEQUENCE_FLOW] } }, allowUnknownEdgeTypes: true },
    )
    expect(result.valid).toBe(true)
  })

  it('allowedIncoming 不含边类型时应拒绝', () => {
    // 使用 startEvent → task，startEvent 默认 allowedOutgoing 含 sequence-flow，
    // 需单独覆盖 startEvent.allowedOutgoing 以放行 custom-edge，确保只测 incoming
    const result = validateBpmnConnection(
      { sourceShape: BPMN_START_EVENT, targetShape: BPMN_SERVICE_TASK, edgeShape: 'custom-edge' },
      { customRules: {
        startEvent: { allowedOutgoing: ['custom-edge'] },
        task: { allowedIncoming: [BPMN_SEQUENCE_FLOW] },
      } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('入线')
  })

  it('allowedIncoming 不含边类型但 allowUnknownEdgeTypes=true 时应放行', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_START_EVENT, targetShape: BPMN_SERVICE_TASK, edgeShape: 'custom-edge' },
      { customRules: {
        startEvent: { allowedOutgoing: ['custom-edge'] },
        task: { allowedIncoming: [BPMN_SEQUENCE_FLOW] },
      }, allowUnknownEdgeTypes: true },
    )
    expect(result.valid).toBe(true)
  })

  it('allowedTargets 非空且不含目标分类时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_EXCLUSIVE_GATEWAY, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { task: { allowedTargets: ['endEvent'] } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许连接')
  })

  it('forbiddenTargets 含目标分类时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_EXCLUSIVE_GATEWAY, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { task: { forbiddenTargets: ['gateway'] } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('禁止连接')
  })

  it('allowedSources 不含源分类时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { endEvent: { allowedSources: ['gateway'] } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不允许接收来自')
  })

  it('allowedSources 含源分类时应放行', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { endEvent: { allowedSources: ['task'] } } },
    )
    expect(result.valid).toBe(true)
  })

  it('forbiddenSources 含源分类时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { endEvent: { forbiddenSources: ['task'] } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('禁止接收来自')
  })

  it('forbiddenSources 不含源分类时应放行', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW },
      { customRules: { endEvent: { forbiddenSources: ['gateway'] } } },
    )
    expect(result.valid).toBe(true)
  })

  it('maxOutgoing 达上限时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW, sourceOutgoingCount: 3 },
      { customRules: { task: { maxOutgoing: 3 } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('出线数量已达上限')
  })

  it('maxIncoming 达上限时应拒绝', () => {
    const result = validateBpmnConnection(
      { sourceShape: BPMN_USER_TASK, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW, targetIncomingCount: 5 },
      { customRules: { endEvent: { maxIncoming: 5 } } },
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('入线数量已达上限')
  })
})
