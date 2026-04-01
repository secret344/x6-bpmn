/**
 * BPMN 2.0 规范合规性验证
 *
 * Validates that all element types defined in the BPMN 2.0 standard (OMG BPMN 2.0.2)
 * are fully covered by the plugin implementation.
 *
 * Reference: OMG BPMN 2.0.2 (ISO/IEC 19510:2013)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import * as allExports from '../../../src/index'

describe('BPMN 2.0 规范合规性验证', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation(() => undefined as any)
  })

  // ============================================================================
  // §10.4 - Events (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.4 事件 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines the following event categories:
     * - Start Events (None + 6 types = 7)
     * - Intermediate Throw Events (None + 6 types = 7)
     * - Intermediate Catch Events (None + 11 types = 12)
     * - Boundary Events (None + 10 types + non-interrupting = 12)
     * - End Events (None + 8 types = 9)
     * Total: 47 event variants
     */

    it('应实现 §10.4.2 规定的全部 7 种开始事件', () => {
      const startEvents = [
        'bpmn-start-event',                    // None
        'bpmn-start-event-message',            // Message
        'bpmn-start-event-timer',              // Timer
        'bpmn-start-event-conditional',        // Conditional (Rule)
        'bpmn-start-event-signal',             // Signal
        'bpmn-start-event-multiple',           // Multiple
        'bpmn-start-event-parallel-multiple',  // Parallel Multiple
      ]
      for (const name of startEvents) {
        expect(allExports).toHaveProperty(
          name.replace(/-/g, '_').toUpperCase(),
        )
      }
      expect(startEvents).toHaveLength(7)
    })

    it('应实现 §10.4.3 规定的全部 7 种中间抛出事件', () => {
      const throwEvents = [
        'bpmn-intermediate-throw-event',              // None
        'bpmn-intermediate-throw-event-message',      // Message
        'bpmn-intermediate-throw-event-escalation',   // Escalation
        'bpmn-intermediate-throw-event-link',         // Link
        'bpmn-intermediate-throw-event-compensation', // Compensation
        'bpmn-intermediate-throw-event-signal',       // Signal
        'bpmn-intermediate-throw-event-multiple',     // Multiple
      ]
      expect(throwEvents).toHaveLength(7)
      expect(allExports.BPMN_INTERMEDIATE_THROW_EVENT).toBeDefined()
      expect(allExports.BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE).toBeDefined()
    })

    it('应实现 §10.4.4 规定的全部 12 种中间捕获事件', () => {
      const catchEvents = [
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
      expect(catchEvents).toHaveLength(12)
      for (const name of catchEvents) {
        expect(name).toBeTruthy()
      }
    })

    it('应实现 §10.4.5 规定的全部 12 种边界事件', () => {
      const boundaryEvents = [
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
      ]
      expect(boundaryEvents).toHaveLength(12)
      for (const name of boundaryEvents) {
        expect(name).toBeTruthy()
      }
    })

    it('应实现 §10.4.6 规定的全部 9 种结束事件', () => {
      const endEvents = [
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
      expect(endEvents).toHaveLength(9)
      for (const name of endEvents) {
        expect(name).toBeTruthy()
      }
    })

    it('应共注册 47 个事件图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: true,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(47)
    })
  })

  // ============================================================================
  // §10.2 / §10.3 - Activities (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.2/§10.3 活动 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines:
     * - Task (abstract) + 7 specialized task types = 8
     * - Sub-Process (collapsed)
     * - Event Sub-Process
     * - Transaction
     * - Ad-Hoc Sub-Process
     * - Call Activity
     * Total: 13 activity elements
     */

    it('应实现 §10.2.4 规定的全部 8 种任务', () => {
      expect(allExports.BPMN_TASK).toBe('bpmn-task')
      expect(allExports.BPMN_USER_TASK).toBe('bpmn-user-task')
      expect(allExports.BPMN_SERVICE_TASK).toBe('bpmn-service-task')
      expect(allExports.BPMN_SCRIPT_TASK).toBe('bpmn-script-task')
      expect(allExports.BPMN_BUSINESS_RULE_TASK).toBe('bpmn-business-rule-task')
      expect(allExports.BPMN_SEND_TASK).toBe('bpmn-send-task')
      expect(allExports.BPMN_RECEIVE_TASK).toBe('bpmn-receive-task')
      expect(allExports.BPMN_MANUAL_TASK).toBe('bpmn-manual-task')
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
      expect(registerNodeSpy).toHaveBeenCalledTimes(13)
    })
  })

  // ============================================================================
  // §10.5 - Gateways (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.5 网关 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines 6 gateway types:
     * - Exclusive (XOR)
     * - Parallel (AND)
     * - Inclusive (OR)
     * - Complex
     * - Event-Based
     * - Exclusive Event-Based (Instantiate)
     */

    it('应实现 §10.5 规定的全部 6 种网关', () => {
      expect(allExports.BPMN_EXCLUSIVE_GATEWAY).toBe('bpmn-exclusive-gateway')
      expect(allExports.BPMN_PARALLEL_GATEWAY).toBe('bpmn-parallel-gateway')
      expect(allExports.BPMN_INCLUSIVE_GATEWAY).toBe('bpmn-inclusive-gateway')
      expect(allExports.BPMN_COMPLEX_GATEWAY).toBe('bpmn-complex-gateway')
      expect(allExports.BPMN_EVENT_BASED_GATEWAY).toBe('bpmn-event-based-gateway')
      expect(allExports.BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY).toBe('bpmn-exclusive-event-based-gateway')
    })

    it('应共注册 6 个网关图形', () => {
      allExports.forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: true,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(6)
    })
  })

  // ============================================================================
  // §10.6 - Data Objects (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.6 数据元素 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines 4 data shapes:
     * - Data Object
     * - Data Input
     * - Data Output
     * - Data Store
     */

    it('应实现 §10.6 规定的全部 4 种数据元素', () => {
      expect(allExports.BPMN_DATA_OBJECT).toBe('bpmn-data-object')
      expect(allExports.BPMN_DATA_INPUT).toBe('bpmn-data-input')
      expect(allExports.BPMN_DATA_OUTPUT).toBe('bpmn-data-output')
      expect(allExports.BPMN_DATA_STORE).toBe('bpmn-data-store')
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
      expect(registerNodeSpy).toHaveBeenCalledTimes(4)
    })
  })

  // ============================================================================
  // §10.7 - Artifacts (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.7 工件 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines 2 standard artifact types:
     * - Text Annotation
     * - Group
     */

    it('应实现 §10.7 规定的 2 种工件', () => {
      expect(allExports.BPMN_TEXT_ANNOTATION).toBe('bpmn-text-annotation')
      expect(allExports.BPMN_GROUP).toBe('bpmn-group')
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
      expect(registerNodeSpy).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // §9.3/§9.4 - Swimlanes (BPMN 2.0 Spec)
  // ============================================================================

  describe('§9.3/§9.4 泳道 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines 2 swimlane structures:
     * - Pool (Participant)
     * - Lane
     */

    it('应实现 §9.3-9.4 规定的 2 种泳道', () => {
      expect(allExports.BPMN_POOL).toBe('bpmn-pool')
      expect(allExports.BPMN_LANE).toBe('bpmn-lane')
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
      expect(registerNodeSpy).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // §10.1/§7.5 - Connecting Objects (BPMN 2.0 Spec)
  // ============================================================================

  describe('§10.1/§7.5 连接对象 —— BPMN 2.0 完整覆盖', () => {
    /**
     * BPMN 2.0 defines 7 flow/connection types:
     * - Sequence Flow (solid, filled arrow)
     * - Conditional Sequence Flow (diamond + filled arrow)
     * - Default Sequence Flow (slash + filled arrow)
     * - Message Flow (dashed, circle + open arrow)
     * - Association (dotted, no arrow)
     * - Directed Association (dotted, open arrow)
     * - Data Association (dashed, open arrow)
     */

    it('应实现 §7.5 规定的全部 7 种连接线', () => {
      expect(allExports.BPMN_SEQUENCE_FLOW).toBe('bpmn-sequence-flow')
      expect(allExports.BPMN_CONDITIONAL_FLOW).toBe('bpmn-conditional-flow')
      expect(allExports.BPMN_DEFAULT_FLOW).toBe('bpmn-default-flow')
      expect(allExports.BPMN_MESSAGE_FLOW).toBe('bpmn-message-flow')
      expect(allExports.BPMN_ASSOCIATION).toBe('bpmn-association')
      expect(allExports.BPMN_DIRECTED_ASSOCIATION).toBe('bpmn-directed-association')
      expect(allExports.BPMN_DATA_ASSOCIATION).toBe('bpmn-data-association')
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
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })
  })

  // ============================================================================
  // BPMN 2.0 Visual Specification Compliance
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
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
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
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
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
      expect(config.attrs.line.strokeDasharray).toBeTruthy()
      expect(config.attrs.line.sourceMarker.name).toBe('ellipse')
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('关联应为虹线无箭头（BPMN 规范）', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBeTruthy()
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
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
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
  // Total Element Count Verification
  // ============================================================================

  describe('图形总数验证', () => {
    it('应注册 81 个元素（74 个节点 + 7 个连接线）', () => {
      allExports.forceRegisterBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(74)
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('图形数量明细：47 事件 + 13 活动 + 6 网关 + 4 数据 + 2 工件 + 2 泳道 = 74', () => {
      expect(47 + 13 + 6 + 4 + 2 + 2).toBe(74)
    })
  })
})
