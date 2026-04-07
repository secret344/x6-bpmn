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

import { describe, it, expect, vi } from 'vitest'
import {
  getNodeCategory,
  DEFAULT_CONNECTION_RULES,
  type BpmnNodeCategory,
} from '../../../src/rules/connection-rules'
import {
  validateBpmnConnection,
  validatePoolBoundary,
  createBpmnValidateConnection,
  createBpmnValidateConnectionWithResult,
  createBpmnValidateEdge,
  createBpmnValidateEdgeWithResult,
  type BpmnConnectionContext,
  type X6ValidateConnectionArgs,
  type X6ValidateEdgeArgs,
} from '../../../src/rules/validator'
import {
  BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,

  BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,

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
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY, BPMN_PARALLEL_EVENT_BASED_GATEWAY,

  BPMN_DATA_OBJECT, BPMN_DATA_INPUT, BPMN_DATA_OUTPUT, BPMN_DATA_STORE,

  BPMN_TEXT_ANNOTATION, BPMN_GROUP,
  BPMN_POOL, BPMN_LANE,

  BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,

  BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
} from '../../../src/utils/constants'

type TestParentCell = {
  id: string
  shape: string
  getParent: () => TestParentCell | null
}

type TestEdge = {
  id: string
  shape?: string
  model?: { graph: TestGraph } | null
  getSourceCellId?: () => string
  getTargetCellId?: () => string
  getShape?: () => string
}

type TestNode = TestParentCell & {
  model: { graph: TestGraph } | null
  getData: () => unknown
}

type TestGraph = {
  getCellById?: (id: string) => TestNode | null
  getConnectedEdges?: (
    node: TestNode,
    opts: { outgoing?: boolean; incoming?: boolean },
  ) => TestEdge[]
}

type TestNodeOptions = {
  graph?: TestGraph
  data?: unknown
  getData?: () => unknown
  parent?: TestParentCell | null
}

type TestConnectionArgs = Omit<X6ValidateConnectionArgs, 'sourceCell' | 'targetCell' | 'edge'> & {
  sourceCell?: TestNode | null
  targetCell?: TestNode | null
  edge?: TestEdge | null
}

type TestEdgeArgs = Omit<X6ValidateEdgeArgs, 'edge'> & {
  edge?: TestEdge | null
}

function mockNode(id: string, shape: string, options: TestNodeOptions = {}): TestNode {
  const { graph, data, getData, parent = null } = options
  return {
    id,
    shape,
    model: graph ? { graph } : null,
    getParent: () => parent,
    getData: getData ?? (() => data ?? {}),
  }
}

function createGraph(
  sourceNode: TestNode,
  targetNode: TestNode,
  connectedEdges?: { outgoing?: TestEdge[]; incoming?: TestEdge[] },
): TestGraph {
  const nodeMap = new Map([
    [sourceNode.id, sourceNode],
    [targetNode.id, targetNode],
  ])

  return {
    getCellById: (id: string) => nodeMap.get(id) ?? null,
    getConnectedEdges: (node, opts) => {
      if (node.id === sourceNode.id && opts.outgoing) return connectedEdges?.outgoing ?? []
      if (node.id === targetNode.id && opts.incoming) return connectedEdges?.incoming ?? []
      return []
    },
  }
}

function mockEdge(overrides: Partial<TestEdge> = {}): TestEdge {
  return {
    id: 'edge-1',
    getSourceCellId: () => 'source',
    getTargetCellId: () => 'target',
    ...overrides,
  }
}

function graphWithMissingNode(): TestGraph {
  return {
    getCellById: () => null,
  }
}

function connectionArgs(args: TestConnectionArgs): X6ValidateConnectionArgs {
  const { sourceCell, targetCell, edge, ...rest } = args
  return {
    ...rest,
    sourceCell: sourceCell as unknown as X6ValidateConnectionArgs['sourceCell'],
    targetCell: targetCell as unknown as X6ValidateConnectionArgs['targetCell'],
    edge: edge as unknown as X6ValidateConnectionArgs['edge'],
  }
}

function edgeArgs(args: TestEdgeArgs): X6ValidateEdgeArgs {
  const { edge, ...rest } = args
  return {
    ...rest,
    edge: edge as unknown as X6ValidateEdgeArgs['edge'],
  }
}

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

  it('应将排他/包容/复杂网关归为 gateway', () => {
    const gateways = [
      BPMN_EXCLUSIVE_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
      BPMN_COMPLEX_GATEWAY,
    ]
    for (const shape of gateways) {
      expect(getNodeCategory(shape)).toBe('gateway')
    }
  })

  it('应将并行网关归为 parallelGateway', () => {
    expect(getNodeCategory(BPMN_PARALLEL_GATEWAY)).toBe('parallelGateway')
  })

  it('应将局陣事件网关归为 eventBasedGateway', () => {
    expect(getNodeCategory(BPMN_EVENT_BASED_GATEWAY)).toBe('eventBasedGateway')
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
    'parallelGateway', 'eventBasedGateway',
    'dataElement', 'artifact', 'swimlane', 'unknown',
  ]

  it('应为所有节点分类提供规则', () => {
    for (const category of allCategories) {
      expect(DEFAULT_CONNECTION_RULES[category]).toBeDefined()
    }
  })

  it('开始事件规则：仅允许关联线作为入线', () => {
    expect(DEFAULT_CONNECTION_RULES.startEvent.allowedIncoming).toEqual([
      BPMN_ASSOCIATION,
      BPMN_DIRECTED_ASSOCIATION,
    ])
  })

  it('结束事件规则：仅允许关联线作为出线', () => {
    expect(DEFAULT_CONNECTION_RULES.endEvent.allowedOutgoing).toEqual([
      BPMN_ASSOCIATION,
      BPMN_DIRECTED_ASSOCIATION,
    ])
  })

  it('边界事件规则：仅允许关联线作为入线', () => {
    expect(DEFAULT_CONNECTION_RULES.boundaryEvent.allowedIncoming).toEqual([
      BPMN_ASSOCIATION,
      BPMN_DIRECTED_ASSOCIATION,
    ])
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

    it('活动的第一条条件顺序流应失败', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_CONDITIONAL_FLOW, {
          sourceOutgoingSequenceFlowCount: 0,
        }),
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('条件顺序流')
    })

    it('活动在已有其他出向顺序流时允许条件顺序流', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_CONDITIONAL_FLOW, {
          sourceOutgoingSequenceFlowCount: 1,
        }),
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
      expect(result.reason).toContain('不允许使用')
    })

    it('开始事件不能有入线', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_START_EVENT))
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许使用')
    })

    it('边界事件不能有入线', () => {
      const result = validateBpmnConnection(ctx(BPMN_USER_TASK, BPMN_BOUNDARY_EVENT))
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('不允许使用')
    })

    it('文本注释可以通过关联线连接到开始事件', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_TEXT_ANNOTATION, BPMN_START_EVENT, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('文本注释可以通过关联线连接到边界事件', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_TEXT_ANNOTATION, BPMN_BOUNDARY_EVENT, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('结束事件可以通过关联线连接到文本注释', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_END_EVENT, BPMN_TEXT_ANNOTATION, BPMN_ASSOCIATION),
      )
      expect(result.valid).toBe(true)
    })

    it('开始事件不能连接到开始事件', () => {
      const result = validateBpmnConnection(ctx(BPMN_START_EVENT, BPMN_START_EVENT))
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
      // 默认规则中结束事件仅允许关联线出线
      // 自定义规则改为允许顺序流出线
      const result = validateBpmnConnection(
        ctx(BPMN_END_EVENT, BPMN_USER_TASK, BPMN_SEQUENCE_FLOW),
        {
          customRules: {
            endEvent: { allowedOutgoing: [BPMN_SEQUENCE_FLOW] },
          },
        },
      )
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

    it('省略 when 的声明式约束应默认生效', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SEQUENCE_FLOW),
        {
          customRules: {
            task: {
              constraints: [
                {
                  forbid: { targetShapes: [BPMN_SERVICE_TASK] },
                  reason: '命中无条件声明式约束',
                },
              ],
            },
          },
        },
      )
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('声明式约束')
    })

    it('targetCategories 不匹配时应跳过声明式约束', () => {
      const result = validateBpmnConnection(
        ctx(BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SEQUENCE_FLOW),
        {
          customRules: {
            task: {
              constraints: [
                {
                  when: { targetCategories: ['subProcess'] },
                  forbid: { targetShapes: [BPMN_SERVICE_TASK] },
                  reason: '不应命中的目标分类约束',
                },
              ],
            },
          },
        },
      )
      expect(result.valid).toBe(true)
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
  it('目标无磁吸点时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({ targetMagnet: null, sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: mockNode('2', BPMN_SERVICE_TASK) }))).toBe(false)
  })

  it('源节点为空时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: null, targetCell: mockNode('2', BPMN_SERVICE_TASK) }))).toBe(false)
  })

  it('目标节点为空时应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: null }))).toBe(false)
  })

  it('自连接应返回 false', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    const node = mockNode('same', BPMN_USER_TASK)
    expect(validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: node, targetCell: node }))).toBe(false)
  })

  it('合法连线应返回 true', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    }))).toBe(true)
  })

  it('结束事件作为源应返回 false (noOutgoing)', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_END_EVENT),
      targetCell: mockNode('2', BPMN_USER_TASK),
    }))).toBe(false)
  })

  it('带 graph 的节点应能计算出入线数量', () => {
    const graph: TestGraph = {
      getConnectedEdges: (_node, opts) => {
        if (opts.outgoing) return [{ id: 'out-1' }, { id: 'out-2' }, { id: 'out-3' }]
        if (opts.incoming) return [{ id: 'in-1' }]
        return []
      },
    }
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 3 } },
    })
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { graph }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { graph }),
    }))).toBe(false)
  })

  it('graph.getConnectedEdges 抛异常时应返回 0 并正常验证', () => {
    const graph: TestGraph = {
      getConnectedEdges: () => { throw new Error('mock error') },
    }
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { graph }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { graph }),
    }))).toBe(true)
  })

  it('node.model 为空时 count 应为 0', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 1 } },
    })
    // 无 graph，count = 0，maxOutgoing=1 时 0 < 1 应放行
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    }))).toBe(true)
  })

  it('节点 getData 返回对象时应正常读取持久化数据', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { data: { bpmn: { foo: 'bar' } } }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { data: { bpmn: { baz: 'qux' } } }),
    }))).toBe(true)
  })

  it('节点 getData 抛异常时应按无持久化数据处理', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { getData: () => { throw new Error('mock data error') } }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { data: { bpmn: {} } }),
    }))).toBe(true)
  })

  it('节点 getData 返回非对象时应按无持久化数据处理', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { getData: () => 'not-an-object' }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { getData: () => null }),
    }))).toBe(true)
  })
})

// ============================================================================
// createBpmnValidateConnectionWithResult — 带详细结果
// ============================================================================

describe('createBpmnValidateConnectionWithResult', () => {
  it('目标无磁吸点时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({ targetMagnet: null, sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: mockNode('2', BPMN_SERVICE_TASK) }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('连接桩')
  })

  it('源节点为空时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: null, targetCell: mockNode('2', BPMN_SERVICE_TASK) }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不存在')
  })

  it('目标节点为空时应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: mockNode('1', BPMN_USER_TASK), targetCell: null }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('不存在')
  })

  it('自连接应返回失败原因', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const node = mockNode('same', BPMN_USER_TASK)
    const result = validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: node, targetCell: node }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('自连接')
  })

  it('合法连线应返回 valid=true', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    }))
    expect(result.valid).toBe(true)
  })

  it('带 graph 的节点应统计出入线数量用于验证', () => {
    const graph: TestGraph = {
      getConnectedEdges: (_node, opts) => {
        if (opts.outgoing) return Array.from({ length: 5 }, (_, index) => ({ id: `out-${index}`, shape: BPMN_SEQUENCE_FLOW }))
        if (opts.incoming) return Array.from({ length: 5 }, (_, index) => ({ id: `in-${index}`, shape: BPMN_SEQUENCE_FLOW }))
        return []
      },
    }
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW, {
      customRules: { task: { maxOutgoing: 5 } },
    })
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { graph }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { graph }),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('上限')
  })

  it('重连当前边时不应将当前边计入出入线数量', () => {
    const currentEdge: TestEdge = { id: 'edge-1', shape: BPMN_SEQUENCE_FLOW }
    const graph: TestGraph = {
      getConnectedEdges: (_node, opts) => {
        if (opts.outgoing) return [currentEdge]
        if (opts.incoming) return [currentEdge]
        return []
      },
    }
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW, {
      customRules: {
        task: { maxOutgoing: 1, maxIncoming: 1 },
      },
    })
    const result = validate(connectionArgs({
      edge: currentEdge,
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK, { graph }),
      targetCell: mockNode('2', BPMN_SERVICE_TASK, { graph }),
    }))
    expect(result.valid).toBe(true)
  })

  it('edgeShapeGetter 抛异常时应返回 exception 结果并触发异常回调', () => {
    const onValidationException = vi.fn()
    const validate = createBpmnValidateConnectionWithResult(
      () => { throw new Error('mock getter error') },
      { onValidationException },
    )
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    }))

    expect(result.valid).toBe(false)
    expect(result.kind).toBe('exception')
    expect(result.reason).toContain('预校验执行异常')
    expect(onValidationException).toHaveBeenCalledOnce()
  })

  it('抛出非 Error 值时也应归一化为 exception 结果', () => {
    const validate = createBpmnValidateConnectionWithResult(
      () => { throw 'mock string error' },
    )
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNode('1', BPMN_USER_TASK),
      targetCell: mockNode('2', BPMN_SERVICE_TASK),
    }))

    expect(result.valid).toBe(false)
    expect(result.kind).toBe('exception')
    expect(result.reason).toBe('连线预校验执行异常')
  })
})

// ============================================================================
// createBpmnValidateEdge / createBpmnValidateEdgeWithResult
// ============================================================================

describe('createBpmnValidateEdgeWithResult', () => {
  it('edge 缺失时应返回失败原因', () => {
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({ edge: null }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('连线实例不存在')
  })

  it('edge 所属 graph 缺失时应返回失败原因', () => {
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        id: 'edge-1',
        shape: BPMN_SEQUENCE_FLOW,
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('图实例')
  })

  it('edge 未连接完整源目标节点时应返回失败原因', () => {
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        shape: BPMN_SEQUENCE_FLOW,
        model: { graph: graphWithMissingNode() },
        getSourceCellId: () => 'source',
        getTargetCellId: () => '',
      }),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('有效的源节点和目标节点')
  })

  it('edge 无法解析节点时应返回失败原因', () => {
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        shape: BPMN_SEQUENCE_FLOW,
        model: { graph: graphWithMissingNode() },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('无法解析')
  })

  it('自连接时应返回失败原因', () => {
    const sourceNode = mockNode('same', BPMN_USER_TASK)
    const graph = createGraph(sourceNode, sourceNode)
    sourceNode.model = { graph }
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        shape: BPMN_SEQUENCE_FLOW,
        model: { graph },
        getSourceCellId: () => 'same',
        getTargetCellId: () => 'same',
      }),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('自连接')
  })

  it('合法最终连线应返回 valid=true', () => {
    const sourceNode = mockNode('source', BPMN_USER_TASK)
    const targetNode = mockNode('target', BPMN_SERVICE_TASK)
    const graph = createGraph(sourceNode, targetNode)
    sourceNode.model = { graph }
    targetNode.model = { graph }
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        shape: BPMN_SEQUENCE_FLOW,
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result.valid).toBe(true)
  })

  it('edge 缺少 shape 时应回退到 edgeShapeGetter', () => {
    const sourceNode = mockNode('source', BPMN_USER_TASK)
    const targetNode = mockNode('target', BPMN_SERVICE_TASK)
    const graph = createGraph(sourceNode, targetNode)
    sourceNode.model = { graph }
    targetNode.model = { graph }
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(edgeArgs({
      edge: mockEdge({
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result.valid).toBe(true)
  })

  it('重连当前边时不应把当前边计入上限', () => {
    const currentEdge = {
      id: 'edge-1',
      shape: BPMN_SEQUENCE_FLOW,
      getShape: () => BPMN_SEQUENCE_FLOW,
    }
    const sourceNode = mockNode('source', BPMN_USER_TASK)
    const targetNode = mockNode('target', BPMN_SERVICE_TASK)
    const graph = createGraph(sourceNode, targetNode, {
      outgoing: [currentEdge],
      incoming: [currentEdge],
    })
    sourceNode.model = { graph }
    targetNode.model = { graph }
    const validate = createBpmnValidateEdgeWithResult(() => BPMN_SEQUENCE_FLOW, {
      customRules: {
        task: { maxOutgoing: 1, maxIncoming: 1 },
      },
    })
    const result = validate(edgeArgs({
      edge: mockEdge({
        ...currentEdge,
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result.valid).toBe(true)
  })

  it('edge 取源节点时抛异常应返回 exception 结果并触发异常回调', () => {
    const onValidationException = vi.fn()
    const validate = createBpmnValidateEdgeWithResult(
      () => BPMN_SEQUENCE_FLOW,
      { onValidationException },
    )
    const result = validate(edgeArgs({
      edge: mockEdge({
        model: { graph: graphWithMissingNode() },
        getSourceCellId: () => { throw new Error('mock edge error') },
        getTargetCellId: () => 'target',
      }),
    }))

    expect(result.valid).toBe(false)
    expect(result.kind).toBe('exception')
    expect(result.reason).toContain('终校验执行异常')
    expect(onValidationException).toHaveBeenCalledOnce()
  })
})

describe('createBpmnValidateEdge', () => {
  it('未提供错误回调时仍应安全返回 false', () => {
    const validate = createBpmnValidateEdge(() => BPMN_SEQUENCE_FLOW)
    expect(validate(edgeArgs({ edge: null }))).toBe(false)
  })

  it('最终校验失败时应触发错误回调', () => {
    const onValidationError = vi.fn()
    const validate = createBpmnValidateEdge(() => BPMN_SEQUENCE_FLOW, { onValidationError })
    const result = validate(edgeArgs({ edge: null }))
    expect(result).toBe(false)
    expect(onValidationError).toHaveBeenCalledOnce()
    expect(onValidationError.mock.calls[0][0].reason).toContain('连线实例不存在')
  })

  it('最终校验通过时不应触发错误回调', () => {
    const onValidationError = vi.fn()
    const sourceNode = mockNode('source', BPMN_USER_TASK)
    const targetNode = mockNode('target', BPMN_SERVICE_TASK)
    const graph: TestGraph = {
      getCellById: (id: string) => (id === 'source' ? sourceNode : targetNode),
      getConnectedEdges: () => [],
    }
    sourceNode.model = { graph }
    targetNode.model = { graph }
    const validate = createBpmnValidateEdge(() => BPMN_SEQUENCE_FLOW, { onValidationError })
    const result = validate(edgeArgs({
      edge: mockEdge({
        shape: BPMN_SEQUENCE_FLOW,
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))
    expect(result).toBe(true)
    expect(onValidationError).not.toHaveBeenCalled()
  })

  it('最终校验发生异常时不应误触发普通错误回调', () => {
    const onValidationError = vi.fn()
    const onValidationException = vi.fn()
    const validate = createBpmnValidateEdge(
      () => { throw new Error('mock getter error') },
      { onValidationError, onValidationException },
    )
    const sourceNode = mockNode('source', BPMN_USER_TASK)
    const targetNode = mockNode('target', BPMN_SERVICE_TASK)
    const graph: TestGraph = {
      getCellById: (id: string) => (id === 'source' ? sourceNode : targetNode),
      getConnectedEdges: () => [],
    }
    sourceNode.model = { graph }
    targetNode.model = { graph }

    const result = validate(edgeArgs({
      edge: mockEdge({
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      }),
    }))

    expect(result).toBe(false)
    expect(onValidationError).not.toHaveBeenCalled()
    expect(onValidationException).toHaveBeenCalledOnce()
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

// ============================================================================
// validatePoolBoundary — Pool 边界约束（F3/F4）
// ============================================================================

describe('validatePoolBoundary — Pool 边界约束', () => {
  it('顺序流连接同一 Pool 内的节点应通过', () => {
    const result = validatePoolBoundary(BPMN_SEQUENCE_FLOW, 'pool-1', 'pool-1')
    expect(result.valid).toBe(true)
  })

  it('顺序流跨 Pool 应拒绝（BPMN 2.0 规范 §13.2）', () => {
    const result = validatePoolBoundary(BPMN_SEQUENCE_FLOW, 'pool-1', 'pool-2')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('顺序流')
  })

  it('条件流跨 Pool 应拒绝', () => {
    const result = validatePoolBoundary(BPMN_CONDITIONAL_FLOW, 'pool-A', 'pool-B')
    expect(result.valid).toBe(false)
  })

  it('默认流跨 Pool 应拒绝', () => {
    const result = validatePoolBoundary(BPMN_DEFAULT_FLOW, 'pool-A', 'pool-B')
    expect(result.valid).toBe(false)
  })

  it('消息流连接不同 Pool 的节点应通过（formal-11-01-03 §9.3）', () => {
    const result = validatePoolBoundary(BPMN_MESSAGE_FLOW, 'pool-1', 'pool-2')
    expect(result.valid).toBe(true)
  })

  it('消息流连接同一 Pool 内节点应拒绝', () => {
    const result = validatePoolBoundary(BPMN_MESSAGE_FLOW, 'pool-1', 'pool-1')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('消息流')
  })

  it('关联连线不受 Pool 边界约束', () => {
    const result = validatePoolBoundary(BPMN_ASSOCIATION, 'pool-1', 'pool-2')
    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// createBpmnValidateConnection — Pool 边界集成（findPoolId via getParent）
// ============================================================================

describe('createBpmnValidateConnection — Pool 边界集成', () => {
  function mockNodeInPool(id: string, shape: string, poolId: string | null) {
    const parent = poolId ? { id: poolId, shape: 'bpmn-pool', getParent: () => null } : null
    return mockNode(id, shape, { parent })
  }

  it('同 Pool 内顺序流应通过', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, 'pool-1'),
      targetCell: mockNodeInPool('2', BPMN_SERVICE_TASK, 'pool-1'),
    }))).toBe(true)
  })

  it('跨 Pool 顺序流应拒绝', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, 'pool-A'),
      targetCell: mockNodeInPool('2', BPMN_SERVICE_TASK, 'pool-B'),
    }))).toBe(false)
  })

  it('不同 Pool 消息流应通过', () => {
    const validate = createBpmnValidateConnection(() => BPMN_MESSAGE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, 'pool-A'),
      targetCell: mockNodeInPool('2', BPMN_USER_TASK, 'pool-B'),
    }))).toBe(true)
  })

  it('无 Pool 父节点时跳过 Pool 边界检查', () => {
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, null),
      targetCell: mockNodeInPool('2', BPMN_SERVICE_TASK, null),
    }))).toBe(true)
  })

  it('节点经由 Lane 找到 Pool（两层嵌套）', () => {
    const pool: TestParentCell = { id: 'pool-X', shape: 'bpmn-pool', getParent: () => null }
    const lane: TestParentCell = { id: 'lane-1', shape: 'bpmn-lane', getParent: () => pool }
    const src = mockNode('s1', BPMN_USER_TASK, { parent: lane })
    const tgt = mockNode('t1', BPMN_SERVICE_TASK, { parent: lane })
    const validate = createBpmnValidateConnection(() => BPMN_SEQUENCE_FLOW)
    expect(validate(connectionArgs({ targetMagnet: document.createElement('div'), sourceCell: src, targetCell: tgt }))).toBe(true)
  })
})

// ============================================================================
// createBpmnValidateConnectionWithResult — Pool 边界集成
// ============================================================================

describe('createBpmnValidateConnectionWithResult — Pool 边界集成', () => {
  function mockNodeInPool(id: string, shape: string, poolId: string | null) {
    const parent = poolId ? { id: poolId, shape: 'bpmn-pool', getParent: () => null } : null
    return mockNode(id, shape, { parent })
  }

  it('跨 Pool 顺序流应返回失败结果', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, 'pool-A'),
      targetCell: mockNodeInPool('2', BPMN_SERVICE_TASK, 'pool-B'),
    }))
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('顺序流')
  })

  it('同 Pool 内顺序流应返回成功结果', () => {
    const validate = createBpmnValidateConnectionWithResult(() => BPMN_SEQUENCE_FLOW)
    const result = validate(connectionArgs({
      targetMagnet: document.createElement('div'),
      sourceCell: mockNodeInPool('1', BPMN_USER_TASK, 'pool-1'),
      targetCell: mockNodeInPool('2', BPMN_SERVICE_TASK, 'pool-1'),
    }))
    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// 新网关规则验证（F5/F6 — parallelGateway / eventBasedGateway）
// ============================================================================

describe('并行网关（parallelGateway）连线规则 — F6', () => {
  it('BPMN_PARALLEL_GATEWAY 应归为 parallelGateway 分类', () => {
    expect(getNodeCategory(BPMN_PARALLEL_GATEWAY)).toBe('parallelGateway')
  })

  it('并行网关 → 任务（顺序流）应通过', () => {
    expect(validateBpmnConnection({ sourceShape: BPMN_PARALLEL_GATEWAY, targetShape: BPMN_USER_TASK, edgeShape: BPMN_SEQUENCE_FLOW }).valid).toBe(true)
  })

  it('并行网关不允许使用条件流（formal-11-01-03 §10.5.4：并行网关不能有条件分支）', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_PARALLEL_GATEWAY, targetShape: BPMN_USER_TASK, edgeShape: BPMN_CONDITIONAL_FLOW })
    expect(result.valid).toBe(false)
  })

  it('并行网关不允许使用默认流', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_PARALLEL_GATEWAY, targetShape: BPMN_USER_TASK, edgeShape: BPMN_DEFAULT_FLOW })
    expect(result.valid).toBe(false)
  })
})

describe('事件网关（eventBasedGateway）连线规则 — F5', () => {
  it('三种 EBG 图形均应归为 eventBasedGateway', () => {
    expect(getNodeCategory(BPMN_EVENT_BASED_GATEWAY)).toBe('eventBasedGateway')
    expect(getNodeCategory(BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY)).toBe('eventBasedGateway')
    expect(getNodeCategory(BPMN_PARALLEL_EVENT_BASED_GATEWAY)).toBe('eventBasedGateway')
  })

  it('事件网关 → 中间捕获事件（顺序流）应通过', () => {
    expect(validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE, edgeShape: BPMN_SEQUENCE_FLOW }).valid).toBe(true)
  })

  it('事件网关 → 接收任务（顺序流）应通过', () => {
    expect(validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_RECEIVE_TASK, edgeShape: BPMN_SEQUENCE_FLOW }).valid).toBe(true)
  })

  it('事件网关 → 普通任务（顺序流）应失败', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_USER_TASK, edgeShape: BPMN_SEQUENCE_FLOW })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('接收任务')
  })

  it('事件网关 → 非法捕获事件类型应失败', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_INTERMEDIATE_CATCH_EVENT_LINK, edgeShape: BPMN_SEQUENCE_FLOW })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('中间捕获事件')
  })

  it('事件网关目标已有其他入向顺序流时应失败', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_EVENT_BASED_GATEWAY,
      targetShape: BPMN_RECEIVE_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      targetIncomingSequenceFlowCount: 1,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('其他入向顺序流')
  })

  it('事件网关不允许使用条件流（formal-11-01-03 §10.5.6）', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_INTERMEDIATE_CATCH_EVENT, edgeShape: BPMN_CONDITIONAL_FLOW })
    expect(result.valid).toBe(false)
  })

  it('事件网关不允许直接连接到结束事件', () => {
    const result = validateBpmnConnection({ sourceShape: BPMN_EVENT_BASED_GATEWAY, targetShape: BPMN_END_EVENT, edgeShape: BPMN_SEQUENCE_FLOW })
    expect(result.valid).toBe(false)
  })
})

describe('非中断边界事件归类 — F2', () => {
  it('所有非中断边界事件变体均应归为 boundaryEvent', () => {
    const niShapes = [
      BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
    ]
    for (const shape of niShapes) {
      expect(getNodeCategory(shape)).toBe('boundaryEvent')
    }
  })

  it('非中断边界事件不能有入线（规范：边界事件无入线）', () => {
    for (const shape of [
      BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
    ]) {
      const result = validateBpmnConnection({ sourceShape: BPMN_USER_TASK, targetShape: shape, edgeShape: BPMN_SEQUENCE_FLOW })
      expect(result.valid).toBe(false)
    }
  })
})

describe('事件子流程顺序流限制 — F6', () => {
  it('事件子流程不能作为顺序流源节点', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_EVENT_SUB_PROCESS,
      targetShape: BPMN_USER_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('事件子流程')
  })

  it('事件子流程不能作为顺序流目标节点', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_EVENT_SUB_PROCESS,
      edgeShape: BPMN_SEQUENCE_FLOW,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('事件子流程')
  })

  it('带 triggeredByEvent 标记的子流程也应禁止顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_SUB_PROCESS,
      targetShape: BPMN_USER_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      sourceData: { bpmn: { triggeredByEvent: true } },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('事件子流程')
  })
})

describe('实例化目标顺序流限制 — F7', () => {
  it('实例化接收任务不能有入向顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_RECEIVE_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      targetData: { bpmn: { instantiate: true } },
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('接收任务')
  })

  it('并行事件网关作为实例化网关时不能有入向顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_PARALLEL_EVENT_BASED_GATEWAY,
      edgeShape: BPMN_SEQUENCE_FLOW,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('事件网关')
  })

  it('显式 instantiate=false 的排他事件网关仍允许入向顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
      edgeShape: BPMN_SEQUENCE_FLOW,
      targetData: { bpmn: { instantiate: false } },
    })
    expect(result.valid).toBe(true)
  })

  it('未设置 instantiate 的接收任务允许入向顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_RECEIVE_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      targetData: { bpmn: {} },
    })
    expect(result.valid).toBe(true)
  })

  it('缺少 bpmn 容器的接收任务也应按非实例化处理', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_RECEIVE_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      targetData: {},
    })
    expect(result.valid).toBe(true)
  })
})

describe('事件网关的非顺序流路径', () => {
  it('事件网关通过关联连接到接收任务时应通过', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_EVENT_BASED_GATEWAY,
      targetShape: BPMN_RECEIVE_TASK,
      edgeShape: BPMN_ASSOCIATION,
    })
    expect(result.valid).toBe(true)
  })

  it('子流程在已有其他出向顺序流时允许条件顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_SUB_PROCESS,
      targetShape: BPMN_SERVICE_TASK,
      edgeShape: BPMN_CONDITIONAL_FLOW,
      sourceOutgoingSequenceFlowCount: 1,
    })
    expect(result.valid).toBe(true)
  })

  it('未提供已有出向数量时，子流程的条件顺序流应按 0 处理并失败', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_SUB_PROCESS,
      targetShape: BPMN_SERVICE_TASK,
      edgeShape: BPMN_CONDITIONAL_FLOW,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('条件顺序流')
  })
})

describe('validateBpmnConnection — Pool 边界集成检查', () => {
  it('上下文提供 Pool 信息时应直接阻止跨 Pool 顺序流', () => {
    const result = validateBpmnConnection({
      sourceShape: BPMN_USER_TASK,
      targetShape: BPMN_SERVICE_TASK,
      edgeShape: BPMN_SEQUENCE_FLOW,
      sourcePoolId: 'pool-a',
      targetPoolId: 'pool-b',
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Pool 边界')
  })
})
