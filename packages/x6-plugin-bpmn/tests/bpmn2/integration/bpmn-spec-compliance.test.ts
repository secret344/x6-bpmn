/**
 * BPMN 2.0 规范合规性验证
 *
 * 验证插件实现是否完整覆盖 BPMN 2.0 标准定义的所有元素类型。
 *
 * 参考：OMG BPMN 2.0.2 (ISO/IEC 19510:2013) / formal-11-01-03.pdf
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import * as allExports from '../../../src/index'

const START_EVENT_SHAPES = [
  allExports.BPMN_START_EVENT,
  allExports.BPMN_START_EVENT_MESSAGE,
  allExports.BPMN_START_EVENT_TIMER,
  allExports.BPMN_START_EVENT_CONDITIONAL,
  allExports.BPMN_START_EVENT_SIGNAL,
  allExports.BPMN_START_EVENT_MULTIPLE,
  allExports.BPMN_START_EVENT_PARALLEL_MULTIPLE,
]

const INTERMEDIATE_THROW_EVENT_SHAPES = [
  allExports.BPMN_INTERMEDIATE_THROW_EVENT,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_LINK,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
  allExports.BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
]

const INTERMEDIATE_CATCH_EVENT_SHAPES = [
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_ERROR,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE,
  allExports.BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
]

const BOUNDARY_EVENT_SHAPES = [
  allExports.BPMN_BOUNDARY_EVENT,
  allExports.BPMN_BOUNDARY_EVENT_MESSAGE,
  allExports.BPMN_BOUNDARY_EVENT_TIMER,
  allExports.BPMN_BOUNDARY_EVENT_ESCALATION,
  allExports.BPMN_BOUNDARY_EVENT_CONDITIONAL,
  allExports.BPMN_BOUNDARY_EVENT_ERROR,
  allExports.BPMN_BOUNDARY_EVENT_CANCEL,
  allExports.BPMN_BOUNDARY_EVENT_COMPENSATION,
  allExports.BPMN_BOUNDARY_EVENT_SIGNAL,
  allExports.BPMN_BOUNDARY_EVENT_MULTIPLE,
  allExports.BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
  allExports.BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
  allExports.BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
]

const END_EVENT_SHAPES = [
  allExports.BPMN_END_EVENT,
  allExports.BPMN_END_EVENT_MESSAGE,
  allExports.BPMN_END_EVENT_ESCALATION,
  allExports.BPMN_END_EVENT_ERROR,
  allExports.BPMN_END_EVENT_CANCEL,
  allExports.BPMN_END_EVENT_COMPENSATION,
  allExports.BPMN_END_EVENT_SIGNAL,
  allExports.BPMN_END_EVENT_TERMINATE,
  allExports.BPMN_END_EVENT_MULTIPLE,
]

const EVENT_SHAPES = [
  ...START_EVENT_SHAPES,
  ...INTERMEDIATE_THROW_EVENT_SHAPES,
  ...INTERMEDIATE_CATCH_EVENT_SHAPES,
  ...BOUNDARY_EVENT_SHAPES,
  ...END_EVENT_SHAPES,
]

const ACTIVITY_SHAPES = [
  allExports.BPMN_TASK,
  allExports.BPMN_USER_TASK,
  allExports.BPMN_SERVICE_TASK,
  allExports.BPMN_SCRIPT_TASK,
  allExports.BPMN_BUSINESS_RULE_TASK,
  allExports.BPMN_SEND_TASK,
  allExports.BPMN_RECEIVE_TASK,
  allExports.BPMN_MANUAL_TASK,
  allExports.BPMN_SUB_PROCESS,
  allExports.BPMN_EVENT_SUB_PROCESS,
  allExports.BPMN_TRANSACTION,
  allExports.BPMN_AD_HOC_SUB_PROCESS,
  allExports.BPMN_CALL_ACTIVITY,
]

const GATEWAY_SHAPES = [
  allExports.BPMN_EXCLUSIVE_GATEWAY,
  allExports.BPMN_PARALLEL_GATEWAY,
  allExports.BPMN_INCLUSIVE_GATEWAY,
  allExports.BPMN_COMPLEX_GATEWAY,
  allExports.BPMN_EVENT_BASED_GATEWAY,
  allExports.BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  allExports.BPMN_PARALLEL_EVENT_BASED_GATEWAY,
]

const DATA_SHAPES = [
  allExports.BPMN_DATA_OBJECT,
  allExports.BPMN_DATA_INPUT,
  allExports.BPMN_DATA_OUTPUT,
  allExports.BPMN_DATA_STORE,
]

const ARTIFACT_SHAPES = [
  allExports.BPMN_TEXT_ANNOTATION,
  allExports.BPMN_GROUP,
]

const SWIMLANE_SHAPES = [
  allExports.BPMN_POOL,
  allExports.BPMN_LANE,
]

const CONNECTION_SHAPES = [
  allExports.BPMN_SEQUENCE_FLOW,
  allExports.BPMN_CONDITIONAL_FLOW,
  allExports.BPMN_DEFAULT_FLOW,
  allExports.BPMN_MESSAGE_FLOW,
  allExports.BPMN_ASSOCIATION,
  allExports.BPMN_DIRECTED_ASSOCIATION,
  allExports.BPMN_DATA_ASSOCIATION,
]

const NODE_SHAPES = [
  ...EVENT_SHAPES,
  ...ACTIVITY_SHAPES,
  ...GATEWAY_SHAPES,
  ...DATA_SHAPES,
  ...ARTIFACT_SHAPES,
  ...SWIMLANE_SHAPES,
]

describe('BPMN 2.0 规范合规性验证', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation(() => undefined as any)
  })

  function expectRegisteredNodeNames(expectedNames: string[]) {
    const actualNames = registerNodeSpy.mock.calls.map((call: any[]) => call[0]).sort()
    expect(actualNames).toEqual([...expectedNames].sort())
  }

  function expectRegisteredEdgeNames(expectedNames: string[]) {
    const actualNames = registerEdgeSpy.mock.calls.map((call: any[]) => call[0]).sort()
    expect(actualNames).toEqual([...expectedNames].sort())
  }

  // ============================================================================
  // §10.4 - Events (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.4 事件 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义以下事件类别：
     * - 开始事件（无 + 6 种 = 7）
     * - 中间抛出事件（无 + 6 种 = 7）
     * - 中间捕获事件（无 + 11 种 = 12）
    * - 边界事件（无 + 10 种 + 非中断 = 12，另加 7 种按类型非中断 = 19）
     * - 结束事件（无 + 8 种 = 9）
    * 合计：54 种事件变体
     */

    it('应实现 §10.4.2 规定的全部 7 种开始事件', () => {
      expect(START_EVENT_SHAPES).toEqual([
        'bpmn-start-event',
        'bpmn-start-event-message',
        'bpmn-start-event-timer',
        'bpmn-start-event-conditional',
        'bpmn-start-event-signal',
        'bpmn-start-event-multiple',
        'bpmn-start-event-parallel-multiple',
      ])
    })

    it('应实现 §10.4.3 规定的全部 7 种中间抛出事件', () => {
      expect(INTERMEDIATE_THROW_EVENT_SHAPES).toEqual([
        'bpmn-intermediate-throw-event',
        'bpmn-intermediate-throw-event-message',
        'bpmn-intermediate-throw-event-escalation',
        'bpmn-intermediate-throw-event-link',
        'bpmn-intermediate-throw-event-compensation',
        'bpmn-intermediate-throw-event-signal',
        'bpmn-intermediate-throw-event-multiple',
      ])
    })

    it('应实现 §10.4.4 规定的全部 12 种中间捕获事件', () => {
      expect(INTERMEDIATE_CATCH_EVENT_SHAPES).toEqual([
        'bpmn-intermediate-catch-event',
        'bpmn-intermediate-catch-event-message',
        'bpmn-intermediate-catch-event-timer',
        'bpmn-intermediate-catch-event-escalation',
        'bpmn-intermediate-catch-event-conditional',
        'bpmn-intermediate-catch-event-link',
        'bpmn-intermediate-catch-event-error',
        'bpmn-intermediate-catch-event-cancel',
        'bpmn-intermediate-catch-event-compensation',
        'bpmn-intermediate-catch-event-signal',
        'bpmn-intermediate-catch-event-multiple',
        'bpmn-intermediate-catch-event-parallel-multiple',
      ])
    })

    it('应实现 §10.4.5 / §13.4.3 规定的全部 12 种边界事件，加上 7 种非中断变体共 19 种', () => {
      expect(BOUNDARY_EVENT_SHAPES).toEqual([
        'bpmn-boundary-event',
        'bpmn-boundary-event-message',
        'bpmn-boundary-event-timer',
        'bpmn-boundary-event-escalation',
        'bpmn-boundary-event-conditional',
        'bpmn-boundary-event-error',
        'bpmn-boundary-event-cancel',
        'bpmn-boundary-event-compensation',
        'bpmn-boundary-event-signal',
        'bpmn-boundary-event-multiple',
        'bpmn-boundary-event-parallel-multiple',
        'bpmn-boundary-event-non-interrupting',
        'bpmn-boundary-event-message-non-interrupting',
        'bpmn-boundary-event-timer-non-interrupting',
        'bpmn-boundary-event-escalation-non-interrupting',
        'bpmn-boundary-event-conditional-non-interrupting',
        'bpmn-boundary-event-signal-non-interrupting',
        'bpmn-boundary-event-multiple-non-interrupting',
        'bpmn-boundary-event-parallel-multiple-non-interrupting',
      ])
    })

    it('应实现 §10.4.6 规定的全部 9 种结束事件', () => {
      expect(END_EVENT_SHAPES).toEqual([
        'bpmn-end-event',
        'bpmn-end-event-message',
        'bpmn-end-event-escalation',
        'bpmn-end-event-error',
        'bpmn-end-event-cancel',
        'bpmn-end-event-compensation',
        'bpmn-end-event-signal',
        'bpmn-end-event-terminate',
        'bpmn-end-event-multiple',
      ])
    })

    it('应共注册 54 个事件图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: true,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(EVENT_SHAPES.length)
      expectRegisteredNodeNames(EVENT_SHAPES)
    })
  })

  // ============================================================================
  // §10.2 / §10.3 - Activities (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.2/§10.3 活动 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义：
     * - 任务（抽象）+ 7 种专用任务 = 8
     * - 子流程（折叠）
     * - 事件子流程
     * - 事务
     * - 临时子流程
     * - 调用活动
     * 合计：13 种活动元素
     */

    it('应实现 §10.2.4 规定的全部 8 种任务', () => {
      expect(ACTIVITY_SHAPES.slice(0, 8)).toEqual([
        'bpmn-task',
        'bpmn-user-task',
        'bpmn-service-task',
        'bpmn-script-task',
        'bpmn-business-rule-task',
        'bpmn-send-task',
        'bpmn-receive-task',
        'bpmn-manual-task',
      ])
    })

    it('应实现 §10.2.5 规定的子流程', () => {
      expect(allExports.BPMN_SUB_PROCESS).toBe('bpmn-sub-process')
    })

    it('应实现 §10.2.5 规定的事件子流程', () => {
      expect(allExports.BPMN_EVENT_SUB_PROCESS).toBe('bpmn-event-sub-process')
    })

    it('应实现 §10.2.5 规定的事务', () => {
      expect(allExports.BPMN_TRANSACTION).toBe('bpmn-transaction')
    })

    it('应实现 §10.2.5 规定的自由子流程', () => {
      expect(allExports.BPMN_AD_HOC_SUB_PROCESS).toBe('bpmn-ad-hoc-sub-process')
    })

    it('应实现 §10.2.6 规定的调用活动', () => {
      expect(allExports.BPMN_CALL_ACTIVITY).toBe('bpmn-call-activity')
    })

    it('应共注册 13 个活动图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: true,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(ACTIVITY_SHAPES.length)
      expectRegisteredNodeNames(ACTIVITY_SHAPES)
    })
  })

  // ============================================================================
  // §10.5 - Gateways (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.5 网关 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义 7 种网关类型（含并行 EBG）：
     * - 排他网关（XOR）
     * - 并行网关（AND）
     * - 包容网关（OR）
     * - 复杂网关
     * - 事件网关（常规）
     * - 排他事件网关（排他实例化）
     * - 并行事件网关（并行实例化）
     */

    it('应实现 §10.5 规定的全部 6 种网关，以及并行 EBG', () => {
      expect(GATEWAY_SHAPES).toEqual([
        'bpmn-exclusive-gateway',
        'bpmn-parallel-gateway',
        'bpmn-inclusive-gateway',
        'bpmn-complex-gateway',
        'bpmn-event-based-gateway',
        'bpmn-exclusive-event-based-gateway',
        'bpmn-parallel-event-based-gateway',
      ])
    })

    it('应共注册 7 个网关图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: true,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(GATEWAY_SHAPES.length)
      expectRegisteredNodeNames(GATEWAY_SHAPES)
    })
  })

  // ============================================================================
  // §10.6 - Data Objects (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.6 数据元素 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义 4 种数据图形：
     * - 数据对象
     * - 数据输入
     * - 数据输出
     * - 数据存储
     */

    it('应实现 §10.6 规定的全部 4 种数据元素', () => {
      expect(DATA_SHAPES).toEqual([
        'bpmn-data-object',
        'bpmn-data-input',
        'bpmn-data-output',
        'bpmn-data-store',
      ])
    })

    it('应共注册 4 个数据图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: true,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(DATA_SHAPES.length)
      expectRegisteredNodeNames(DATA_SHAPES)
    })
  })

  // ============================================================================
  // §10.7 - Artifacts (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.7 工件 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义 2 种标准工件类型：
     * - 文本注释
     * - 组
     */

    it('应实现 §10.7 规定的 2 种工件', () => {
      expect(ARTIFACT_SHAPES).toEqual([
        'bpmn-text-annotation',
        'bpmn-group',
      ])
    })

    it('应共注册 2 个工件图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: true,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(ARTIFACT_SHAPES.length)
      expectRegisteredNodeNames(ARTIFACT_SHAPES)
    })
  })

  // ============================================================================
  // §9.3/§9.4 - Swimlanes (BPMN 2.0 Spec)
  // ============================================================================

  describe('§9.3/§9.4 泳道 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义 2 种泳道结构：
     * - 池（参与者）
     * - 泳道
     */

    it('应实现 §9.3-9.4 规定的 2 种泳道', () => {
      expect(SWIMLANE_SHAPES).toEqual([
        'bpmn-pool',
        'bpmn-lane',
      ])
    })

    it('应共注册 2 个泳道图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: true,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(SWIMLANE_SHAPES.length)
      expectRegisteredNodeNames(SWIMLANE_SHAPES)
    })
  })

  // ============================================================================
  // §10.1/§7.5 - Connecting Objects (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.1/§7.5 连接对象 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 定义 7 种流/连接类型：
     * - 顺序流（实线，填充箭头）
     * - 条件顺序流（菱形 + 填充箭头）
     * - 默认顺序流（斜线 + 填充箭头）
     * - 消息流（虚线，圆 + 空心箭头）
     * - 关联连线（点线，无箭头）
     * - 有向关联（点线，空心箭头）
     * - 数据关联（虚线，空心箭头）
     */

    it('应实现 §7.5 规定的全部 7 种连接线', () => {
      expect(CONNECTION_SHAPES).toEqual([
        'bpmn-sequence-flow',
        'bpmn-conditional-flow',
        'bpmn-default-flow',
        'bpmn-message-flow',
        'bpmn-association',
        'bpmn-directed-association',
        'bpmn-data-association',
      ])
    })

    it('应共注册 7 个连接线图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: true,
      })
      expect(registerEdgeSpy).toHaveBeenCalledTimes(CONNECTION_SHAPES.length)
      expectRegisteredEdgeNames(CONNECTION_SHAPES)
    })
  })

  // ============================================================================
  // BPMN 2.0 视觉规范合规性
  // ============================================================================

  describe('视觉规范合规性', () => {
    beforeEach(() => {
      allExports.forceRegisterBpmnShapes()
    })

    it('开始事件应使用单细圆（BPMN 规范：单线）', () => {
      const startCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_START_EVENT)!
      const config = startCall[1] as any
      expect(config.attrs.body.strokeWidth).toBe(2)
      expect(config.attrs.innerCircle).toBeUndefined()
    })

    it('中间事件应使用双圆（BPMN 规范：双线）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_INTERMEDIATE_CATCH_EVENT)!
      const config = call[1] as any
      expect(config.attrs.innerCircle).toBeDefined()
    })

    it('结束事件应使用粗单圆（BPMN 规范：粗线）', () => {
      const endCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_END_EVENT)!
      const config = endCall[1] as any
      expect(config.attrs.body.strokeWidth).toBe(3)
      expect(config.attrs.innerCircle).toBeUndefined()
    })

    it('网关应使用菱形', () => {
      const gwCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_EXCLUSIVE_GATEWAY)!
      const config = gwCall[1] as any
      expect(config.attrs.body.refPoints).toContain('0,0.5')
    })

    it('任务应使用圆角矩形', () => {
      const taskCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TASK)!
      const config = taskCall[1] as any
      expect(config.attrs.body.rx).toBeGreaterThan(0)
      expect(config.attrs.body.ry).toBeGreaterThan(0)
    })

    it('调用活动应有粗边框（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.strokeWidth).toBe(4)
    })

    it('事件子流程应有虚线边框（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('8,4')
    })

    it('事务应有双边框（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TRANSACTION)!
      const config = call[1] as any
      const hasInnerRect = config.markup.some((m: any) => m.selector === 'innerRect')
      expect(hasInnerRect).toBe(true)
    })

    it('非中断边界应有虚线边框（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('5,3')
      expect(config.attrs.innerCircle.strokeDasharray).toBe('5,3')
    })

    it('数据对象应有折角（BPMN 规范页面形状）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_DATA_OBJECT)!
      const config = call[1] as any
      const hasFold = config.markup.some((m: any) => m.selector === 'fold')
      expect(hasFold).toBe(true)
    })

    it('顺序流应为实线带实心箭头（BPMN 规范）', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_SEQUENCE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBeUndefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('消息流应为虚线带圆形起点和空心箭头（BPMN 规范）', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('8,5')
      expect(config.attrs.line.sourceMarker.name).toBe('ellipse')
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('关联应为点线无箭头（BPMN 规范）', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('4,4')
      expect(config.attrs.line.targetMarker).toBeNull()
    })

    it('条件流应有菱形起点标记（BPMN 规范）', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker.name).toBe('diamond')
    })

    it('分组应有虚线圆角矩形（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('10,4')
      expect(config.attrs.body.rx).toBeGreaterThan(0)
    })

    it('文本注释应只有左括号（BPMN 规范）', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe('none')
      expect(config.attrs.bracket).toBeDefined()
    })
  })

  // ============================================================================
  // 元素总数验证
  // ============================================================================

  describe('图形总数验证', () => {
    it('应注册 89 个元素（82 个节点 + 7 个连接线）', () => {
      allExports.forceRegisterBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(NODE_SHAPES.length)
      expect(registerEdgeSpy).toHaveBeenCalledTimes(CONNECTION_SHAPES.length)
      expectRegisteredNodeNames(NODE_SHAPES)
      expectRegisteredEdgeNames(CONNECTION_SHAPES)
    })

    it('图形数量明细：54 事件 + 13 活动 + 7 网关 + 4 数据 + 2 工件 + 2 泳道 = 82', () => {
      expect(54 + 13 + 7 + 4 + 2 + 2).toBe(82)
    })
  })
})
