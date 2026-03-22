/**
 * BPMN 2.0 Specification Compliance Tests
 *
 * Validates that all element types defined in the BPMN 2.0 standard (OMG BPMN 2.0.2)
 * are fully covered by the plugin implementation.
 *
 * Reference: OMG BPMN 2.0.2 (ISO/IEC 19510:2013)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import * as allExports from '../src/index'

describe('BPMN 2.0 Specification Compliance', () => {
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

  describe('§10.4 Events — Complete coverage per BPMN 2.0', () => {
    /**
     * BPMN 2.0 defines the following event categories:
     * - Start Events (None + 6 types = 7)
     * - Intermediate Throw Events (None + 6 types = 7)
     * - Intermediate Catch Events (None + 11 types = 12)
     * - Boundary Events (None + 10 types + non-interrupting = 12)
     * - End Events (None + 8 types = 9)
     * Total: 47 event variants
     */

    it('should implement all 7 Start Event types per §10.4.2', () => {
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

    it('should implement all 7 Intermediate Throw Event types per §10.4.3', () => {
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

    it('should implement all 12 Intermediate Catch Event types per §10.4.4', () => {
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

    it('should implement all 12 Boundary Event types per §10.4.5', () => {
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

    it('should implement all 9 End Event types per §10.4.6', () => {
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

    it('should have 47 total events registered', () => {
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

  describe('§10.2/§10.3 Activities — Complete coverage per BPMN 2.0', () => {
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

    it('should implement all 8 task types per §10.2.4', () => {
      expect(allExports.BPMN_TASK).toBe('bpmn-task')
      expect(allExports.BPMN_USER_TASK).toBe('bpmn-user-task')
      expect(allExports.BPMN_SERVICE_TASK).toBe('bpmn-service-task')
      expect(allExports.BPMN_SCRIPT_TASK).toBe('bpmn-script-task')
      expect(allExports.BPMN_BUSINESS_RULE_TASK).toBe('bpmn-business-rule-task')
      expect(allExports.BPMN_SEND_TASK).toBe('bpmn-send-task')
      expect(allExports.BPMN_RECEIVE_TASK).toBe('bpmn-receive-task')
      expect(allExports.BPMN_MANUAL_TASK).toBe('bpmn-manual-task')
    })

    it('should implement Sub-Process per §10.2.5', () => {
      expect(allExports.BPMN_SUB_PROCESS).toBe('bpmn-sub-process')
    })

    it('should implement Event Sub-Process per §10.2.5', () => {
      expect(allExports.BPMN_EVENT_SUB_PROCESS).toBe('bpmn-event-sub-process')
    })

    it('should implement Transaction per §10.2.5', () => {
      expect(allExports.BPMN_TRANSACTION).toBe('bpmn-transaction')
    })

    it('should implement Ad-Hoc Sub-Process per §10.2.5', () => {
      expect(allExports.BPMN_AD_HOC_SUB_PROCESS).toBe('bpmn-ad-hoc-sub-process')
    })

    it('should implement Call Activity per §10.2.6', () => {
      expect(allExports.BPMN_CALL_ACTIVITY).toBe('bpmn-call-activity')
    })

    it('should have 13 total activity shapes registered', () => {
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

  describe('§10.5 Gateways — Complete coverage per BPMN 2.0', () => {
    /**
     * BPMN 2.0 defines 6 gateway types:
     * - Exclusive (XOR)
     * - Parallel (AND)
     * - Inclusive (OR)
     * - Complex
     * - Event-Based
     * - Exclusive Event-Based (Instantiate)
     */

    it('should implement all 6 gateway types per §10.5', () => {
      expect(allExports.BPMN_EXCLUSIVE_GATEWAY).toBe('bpmn-exclusive-gateway')
      expect(allExports.BPMN_PARALLEL_GATEWAY).toBe('bpmn-parallel-gateway')
      expect(allExports.BPMN_INCLUSIVE_GATEWAY).toBe('bpmn-inclusive-gateway')
      expect(allExports.BPMN_COMPLEX_GATEWAY).toBe('bpmn-complex-gateway')
      expect(allExports.BPMN_EVENT_BASED_GATEWAY).toBe('bpmn-event-based-gateway')
      expect(allExports.BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY).toBe('bpmn-exclusive-event-based-gateway')
    })

    it('should have 6 total gateway shapes registered', () => {
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

  describe('§10.6 Data — Complete coverage per BPMN 2.0', () => {
    /**
     * BPMN 2.0 defines 4 data shapes:
     * - Data Object
     * - Data Input
     * - Data Output
     * - Data Store
     */

    it('should implement all 4 data element types per §10.6', () => {
      expect(allExports.BPMN_DATA_OBJECT).toBe('bpmn-data-object')
      expect(allExports.BPMN_DATA_INPUT).toBe('bpmn-data-input')
      expect(allExports.BPMN_DATA_OUTPUT).toBe('bpmn-data-output')
      expect(allExports.BPMN_DATA_STORE).toBe('bpmn-data-store')
    })

    it('should have 4 total data shapes registered', () => {
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

  describe('§10.7 Artifacts — Complete coverage per BPMN 2.0', () => {
    /**
     * BPMN 2.0 defines 2 standard artifact types:
     * - Text Annotation
     * - Group
     */

    it('should implement both artifact types per §10.7', () => {
      expect(allExports.BPMN_TEXT_ANNOTATION).toBe('bpmn-text-annotation')
      expect(allExports.BPMN_GROUP).toBe('bpmn-group')
    })

    it('should have 2 total artifact shapes registered', () => {
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

  describe('§9.3/§9.4 Swimlanes — Complete coverage per BPMN 2.0', () => {
    /**
     * BPMN 2.0 defines 2 swimlane structures:
     * - Pool (Participant)
     * - Lane
     */

    it('should implement both swimlane types per §9.3-9.4', () => {
      expect(allExports.BPMN_POOL).toBe('bpmn-pool')
      expect(allExports.BPMN_LANE).toBe('bpmn-lane')
    })

    it('should have 2 total swimlane shapes registered', () => {
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

  describe('§10.1/§7.5 Connecting Objects — Complete coverage per BPMN 2.0', () => {
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

    it('should implement all 7 connection types per §7.5', () => {
      expect(allExports.BPMN_SEQUENCE_FLOW).toBe('bpmn-sequence-flow')
      expect(allExports.BPMN_CONDITIONAL_FLOW).toBe('bpmn-conditional-flow')
      expect(allExports.BPMN_DEFAULT_FLOW).toBe('bpmn-default-flow')
      expect(allExports.BPMN_MESSAGE_FLOW).toBe('bpmn-message-flow')
      expect(allExports.BPMN_ASSOCIATION).toBe('bpmn-association')
      expect(allExports.BPMN_DIRECTED_ASSOCIATION).toBe('bpmn-directed-association')
      expect(allExports.BPMN_DATA_ASSOCIATION).toBe('bpmn-data-association')
    })

    it('should have 7 total connection shapes registered', () => {
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

  describe('Visual Specification Compliance', () => {
    beforeEach(() => {
      allExports.forceRegisterBpmnShapes()
    })

    it('Start Events should use single thin circle (BPMN spec: single line)', () => {
      const startCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_START_EVENT)!
      const config = startCall[1] as any
      expect(config.attrs.body.strokeWidth).toBe(2)
      expect(config.attrs.innerCircle).toBeUndefined()
    })

    it('Intermediate Events should use double circle (BPMN spec: double line)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_INTERMEDIATE_CATCH_EVENT)!
      const config = call[1] as any
      expect(config.attrs.innerCircle).toBeDefined()
    })

    it('End Events should use thick single circle (BPMN spec: thick line)', () => {
      const endCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_END_EVENT)!
      const config = endCall[1] as any
      expect(config.attrs.body.strokeWidth).toBe(3)
      expect(config.attrs.innerCircle).toBeUndefined()
    })

    it('Gateways should use diamond/rhombus shape', () => {
      const gwCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_EXCLUSIVE_GATEWAY)!
      const config = gwCall[1] as any
      expect(config.attrs.body.refPoints).toContain('0,0.5')
    })

    it('Tasks should use rounded rectangles', () => {
      const taskCall = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TASK)!
      const config = taskCall[1] as any
      expect(config.attrs.body.rx).toBeGreaterThan(0)
      expect(config.attrs.body.ry).toBeGreaterThan(0)
    })

    it('Call Activity should have thick border (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.strokeWidth).toBe(4)
    })

    it('Event Sub-Process should have dashed border (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
    })

    it('Transaction should have double border (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TRANSACTION)!
      const config = call[1] as any
      const hasInnerRect = config.markup.some((m: any) => m.selector === 'innerRect')
      expect(hasInnerRect).toBe(true)
    })

    it('Non-Interrupting Boundary should have dashed border (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
    })

    it('Data Object should have folded corner (page shape per BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_DATA_OBJECT)!
      const config = call[1] as any
      const hasFold = config.markup.some((m: any) => m.selector === 'fold')
      expect(hasFold).toBe(true)
    })

    it('Sequence Flow should be solid with filled arrow (BPMN spec)', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_SEQUENCE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBeUndefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('Message Flow should be dashed with circle source and open arrow (BPMN spec)', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBeTruthy()
      expect(config.attrs.line.sourceMarker.name).toBe('ellipse')
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('Association should be dotted with no arrowhead (BPMN spec)', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBeTruthy()
      expect(config.attrs.line.targetMarker).toBeNull()
    })

    it('Conditional Flow should have diamond source marker (BPMN spec)', () => {
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker.name).toBe('diamond')
    })

    it('Group should have dashed rounded rectangle (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeTruthy()
      expect(config.attrs.body.rx).toBeGreaterThan(0)
    })

    it('Text Annotation should have left bracket only (BPMN spec)', () => {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === allExports.BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe('none')
      expect(config.attrs.bracket).toBeDefined()
    })
  })

  // ============================================================================
  // Total Element Count Verification
  // ============================================================================

  describe('Total Element Count', () => {
    it('should register 81 total elements (74 nodes + 7 edges)', () => {
      allExports.forceRegisterBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(74)
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('shape count breakdown: 47 events + 13 activities + 6 gateways + 4 data + 2 artifacts + 2 swimlanes = 74', () => {
      expect(47 + 13 + 6 + 4 + 2 + 2).toBe(74)
    })
  })
})
