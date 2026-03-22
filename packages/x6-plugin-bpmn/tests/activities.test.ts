import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerActivityShapes } from '../src/shapes/activities'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
} from '../src/utils/constants'

describe('registerActivityShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerActivityShapes without errors', () => {
    expect(() => registerActivityShapes()).not.toThrow()
  })

  it('should register exactly 13 activity shapes', () => {
    registerActivityShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(13)
  })

  // ==================== Tasks (8) ====================

  describe('Tasks', () => {
    const taskNames = [
      BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
      BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
    ]

    it('should register all 8 task types', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('all tasks should inherit from rect', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.inherit).toBe('rect')
      }
    })

    it('all tasks should have rounded corners (rx=8, ry=8)', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.rx).toBe(8)
        expect(config.attrs.body.ry).toBe(8)
      }
    })

    it('all tasks should use task colors', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.task.fill)
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.task.stroke)
      }
    })

    it('tasks should be 100x60', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.width).toBe(100)
        expect(config.height).toBe(60)
      }
    })

    it('all tasks should have 4 ports', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.ports.groups).toHaveProperty('top')
        expect(config.ports.groups).toHaveProperty('right')
        expect(config.ports.groups).toHaveProperty('bottom')
        expect(config.ports.groups).toHaveProperty('left')
        expect(config.ports.items).toHaveLength(4)
      }
    })

    it('plain Task should not have icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeUndefined()
    })

    it('User Task should have user icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_USER_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.user)
    })

    it('Service Task should have service icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SERVICE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.service)
    })

    it('Script Task should have script icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SCRIPT_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.script)
    })

    it('Business Rule Task should have businessRule icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BUSINESS_RULE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.businessRule)
    })

    it('Send Task should have send icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SEND_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.send)
    })

    it('Receive Task should have receive icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_RECEIVE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.receive)
    })

    it('Manual Task should have manual icon', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MANUAL_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.manual)
    })

    it('all tasks should have label text in attrs', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.label.text).toBeTruthy()
      }
    })
  })

  // ==================== Sub-Process ====================

  describe('Sub-Process', () => {
    it('should register Sub-Process with correct size', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
      expect(config.width).toBe(200)
      expect(config.height).toBe(120)
    })

    it('Sub-Process should use subProcess colors', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.subProcess.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.subProcess.stroke)
    })

    it('Sub-Process should have collapse marker', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBe(BPMN_ICONS.collapse)
    })

    it('Sub-Process should NOT be dashed', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeUndefined()
    })
  })

  // ==================== Event Sub-Process ====================

  describe('Event Sub-Process', () => {
    it('should register Event Sub-Process', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_EVENT_SUB_PROCESS, expect.any(Object), true)
    })

    it('Event Sub-Process should be dashed (BPMN spec)', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('8,4')
    })

    it('Event Sub-Process size should match Sub-Process', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.width).toBe(200)
      expect(config.height).toBe(120)
    })
  })

  // ==================== Transaction ====================

  describe('Transaction', () => {
    it('should register Transaction', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_TRANSACTION, expect.any(Object), true)
    })

    it('Transaction should have double border (innerRect)', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TRANSACTION)!
      const config = call[1] as any
      const hasInnerRect = config.markup.some((m: any) => m.selector === 'innerRect')
      expect(hasInnerRect).toBe(true)
      expect(config.attrs.innerRect).toBeDefined()
    })

    it('Transaction should use subProcess colors', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TRANSACTION)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.subProcess.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.subProcess.stroke)
    })
  })

  // ==================== Ad-Hoc Sub-Process ====================

  describe('Ad-Hoc Sub-Process', () => {
    it('should register Ad-Hoc Sub-Process', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_AD_HOC_SUB_PROCESS, expect.any(Object), true)
    })

    it('Ad-Hoc Sub-Process should have ad-hoc marker (~)', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_AD_HOC_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBe(BPMN_ICONS.adHoc)
    })
  })

  // ==================== Call Activity ====================

  describe('Call Activity', () => {
    it('should register Call Activity', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_CALL_ACTIVITY, expect.any(Object), true)
    })

    it('Call Activity should have thick border (strokeWidth 4)', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.strokeWidth).toBe(4)
    })

    it('Call Activity should use callActivity colors', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.callActivity.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.callActivity.stroke)
    })

    it('Call Activity should be 100x60 (same as task)', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.width).toBe(100)
      expect(config.height).toBe(60)
    })
  })

  // ==================== General Activity Properties ====================

  describe('General Activity Properties', () => {
    it('all activities should be passed with overwrite=true', () => {
      registerActivityShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('all activities should have body and label selectors in markup', () => {
      registerActivityShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasBody = config.markup.some((m: any) => m.selector === 'body')
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasBody).toBe(true)
        expect(hasLabel).toBe(true)
      }
    })
  })
})
