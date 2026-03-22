import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerEventShapes } from '../src/shapes/events'
import {
  BPMN_COLORS,
  BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
  BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, BPMN_INTERMEDIATE_THROW_EVENT_LINK,
  BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
  BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
  BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ESCALATION, BPMN_BOUNDARY_EVENT_CONDITIONAL,
  BPMN_BOUNDARY_EVENT_ERROR, BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_BOUNDARY_EVENT_COMPENSATION, BPMN_BOUNDARY_EVENT_SIGNAL,
  BPMN_BOUNDARY_EVENT_MULTIPLE, BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
  BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
  BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
  BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
} from '../src/utils/constants'

describe('registerEventShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerEventShapes without errors', () => {
    expect(() => registerEventShapes()).not.toThrow()
  })

  it('should register exactly 47 event shapes', () => {
    registerEventShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(47)
  })

  // ==================== Start Events (7) ====================

  describe('Start Events', () => {
    const startEventNames = [
      BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
      BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
      BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
    ]

    it('should register all 7 Start Event types', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('should use single thin circle (no double circle) for Start Events', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.inherit).toBe('ellipse')
        // Start events should NOT have innerCircle
        expect(config.attrs.body.strokeWidth).toBe(2)
        expect(config.attrs.innerCircle).toBeUndefined()
      }
    })

    it('should use green color for Start Events (BPMN convention)', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.startEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.startEvent.fill)
      }
    })

    it('should have 4 ports (top, right, bottom, left) for Start Events', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.ports.groups).toHaveProperty('top')
      expect(config.ports.groups).toHaveProperty('right')
      expect(config.ports.groups).toHaveProperty('bottom')
      expect(config.ports.groups).toHaveProperty('left')
      expect(config.ports.items).toHaveLength(4)
    })

    it('should set 36x36 size for event shapes', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.width).toBe(36)
      expect(config.height).toBe(36)
    })

    it('plain Start Event should not have icon', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeUndefined()
    })

    it('typed Start Events should have icon paths', () => {
      registerEventShapes()
      const typedEvents = startEventNames.filter(n => n !== BPMN_START_EVENT)
      for (const name of typedEvents) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        expect(config.attrs.icon.d).toBeTruthy()
      }
    })
  })

  // ==================== Intermediate Throw Events (7) ====================

  describe('Intermediate Throw Events', () => {
    const throwEventNames = [
      BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, BPMN_INTERMEDIATE_THROW_EVENT_LINK,
      BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
    ]

    it('should register all 7 Intermediate Throw Event types', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('should use double circle for Intermediate Events (BPMN spec)', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
        expect(config.attrs.innerCircle.fill).toBe('none')
      }
    })

    it('should use blue/intermediate color', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.intermediateEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.intermediateEvent.fill)
      }
    })

    it('typed Intermediate Throw Events should have filled icons (throw = filled)', () => {
      registerEventShapes()
      const typedThrow = throwEventNames.filter(n => n !== BPMN_INTERMEDIATE_THROW_EVENT)
      for (const name of typedThrow) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        // Throw events use filled icons
        expect(config.attrs.icon.fill).toBe(BPMN_COLORS.intermediateEvent.stroke)
      }
    })
  })

  // ==================== Intermediate Catch Events (12) ====================

  describe('Intermediate Catch Events', () => {
    const catchEventNames = [
      BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
      BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
      BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
      BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
    ]

    it('should register all 12 Intermediate Catch Event types', () => {
      registerEventShapes()
      for (const name of catchEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('should use double circle for Intermediate Catch Events', () => {
      registerEventShapes()
      for (const name of catchEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
      }
    })

    it('typed Catch Events should have non-filled icons (catch = outline)', () => {
      registerEventShapes()
      const typedCatch = catchEventNames.filter(n => n !== BPMN_INTERMEDIATE_CATCH_EVENT)
      for (const name of typedCatch) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        // Catch events use outline icons (stroke, not filled)
        expect(config.attrs.icon.stroke).toBe(BPMN_COLORS.intermediateEvent.stroke)
      }
    })
  })

  // ==================== Boundary Events (12) ====================

  describe('Boundary Events', () => {
    const boundaryEventNames = [
      BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
      BPMN_BOUNDARY_EVENT_ESCALATION, BPMN_BOUNDARY_EVENT_CONDITIONAL,
      BPMN_BOUNDARY_EVENT_ERROR, BPMN_BOUNDARY_EVENT_CANCEL,
      BPMN_BOUNDARY_EVENT_COMPENSATION, BPMN_BOUNDARY_EVENT_SIGNAL,
      BPMN_BOUNDARY_EVENT_MULTIPLE, BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
      BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
    ]

    it('should register all 12 Boundary Event types', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('should use double circle for Boundary Events', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
      }
    })

    it('should use orange/boundary color', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.boundaryEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.boundaryEvent.fill)
      }
    })

    it('Non-Interrupting Boundary Event should use dashed circle', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeDefined()
      expect(config.attrs.innerCircle.strokeDasharray).toBeDefined()
    })

    it('Interrupting Boundary Events should NOT be dashed', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BOUNDARY_EVENT)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeUndefined()
    })
  })

  // ==================== End Events (9) ====================

  describe('End Events', () => {
    const endEventNames = [
      BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
      BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
      BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
    ]

    it('should register all 9 End Event types', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('should use thick circle (strokeWidth 3) for End Events per BPMN spec', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.strokeWidth).toBe(3)
      }
    })

    it('should use red color for End Events', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.endEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.endEvent.fill)
      }
    })

    it('End Event should NOT have double circle (single thick)', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeUndefined()
      }
    })

    it('typed End Events should have filled icons', () => {
      registerEventShapes()
      const typedEnd = endEventNames.filter(n => n !== BPMN_END_EVENT)
      for (const name of typedEnd) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        expect(config.attrs.icon.fill).toBe(BPMN_COLORS.endEvent.stroke)
      }
    })
  })

  // ==================== General Event Properties ====================

  describe('General Event Properties', () => {
    it('all events should inherit from ellipse', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.inherit).toBe('ellipse')
      }
    })

    it('all events should have a label selector in markup', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasLabel).toBe(true)
      }
    })

    it('all events should have body ellipse selector', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasBody = config.markup.some((m: any) => m.selector === 'body')
        expect(hasBody).toBe(true)
      }
    })

    it('all events should be passed with overwrite=true', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })
  })
})
