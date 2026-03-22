import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerDataShapes } from '../src/shapes/data'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_DATA_OBJECT,
  BPMN_DATA_INPUT,
  BPMN_DATA_OUTPUT,
  BPMN_DATA_STORE,
} from '../src/utils/constants'

describe('registerDataShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerDataShapes without errors', () => {
    expect(() => registerDataShapes()).not.toThrow()
  })

  it('should register exactly 4 data shapes', () => {
    registerDataShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(4)
  })

  // ==================== Data Object ====================

  describe('Data Object', () => {
    it('should register Data Object', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_OBJECT, expect.any(Object), true)
    })

    it('Data Object should inherit from polygon', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.inherit).toBe('polygon')
    })

    it('Data Object should have folded corner (page shape)', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      // polygon shape with folded corner
      expect(config.attrs.body.refPoints).toBe('0,0 0.75,0 1,0.2 1,1 0,1')
      // fold mark
      const hasFold = config.markup.some((m: any) => m.selector === 'fold')
      expect(hasFold).toBe(true)
      expect(config.attrs.fold).toBeDefined()
    })

    it('Data Object should be 40x50', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.width).toBe(40)
      expect(config.height).toBe(50)
    })

    it('Data Object should use data colors', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.data.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.data.stroke)
    })

    it('Data Object should have 4 ports', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.ports.groups).toHaveProperty('top')
      expect(config.ports.groups).toHaveProperty('right')
      expect(config.ports.groups).toHaveProperty('bottom')
      expect(config.ports.groups).toHaveProperty('left')
      expect(config.ports.items).toHaveLength(4)
    })
  })

  // ==================== Data Input ====================

  describe('Data Input', () => {
    it('should register Data Input', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_INPUT, expect.any(Object), true)
    })

    it('Data Input should inherit from Data Object', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.inherit).toBe(BPMN_DATA_OBJECT)
    })

    it('Data Input should have input arrow icon', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.dataInput)
    })

    it('Data Input should have correct label', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.attrs.label.text).toBe('Data Input')
    })
  })

  // ==================== Data Output ====================

  describe('Data Output', () => {
    it('should register Data Output', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_OUTPUT, expect.any(Object), true)
    })

    it('Data Output should inherit from Data Object', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.inherit).toBe(BPMN_DATA_OBJECT)
    })

    it('Data Output should have output arrow icon', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.dataOutput)
    })

    it('Data Output should have correct label', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.attrs.label.text).toBe('Data Output')
    })
  })

  // ==================== Data Store ====================

  describe('Data Store', () => {
    it('should register Data Store', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_STORE, expect.any(Object), true)
    })

    it('Data Store should inherit from rect', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('Data Store should have cylinder shape path', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.attrs.body.d).toBeTruthy()
      // should contain C (curve) commands for cylinder top/bottom
      expect(config.attrs.body.d).toContain('C')
    })

    it('Data Store should be 50x50', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.width).toBe(50)
      expect(config.height).toBe(50)
    })

    it('Data Store should use data colors', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.data.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.data.stroke)
    })

    it('Data Store should have 4 ports', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.ports.groups).toHaveProperty('top')
      expect(config.ports.groups).toHaveProperty('bottom')
      expect(config.ports.groups).toHaveProperty('left')
      expect(config.ports.groups).toHaveProperty('right')
      expect(config.ports.items).toHaveLength(4)
    })
  })

  // ==================== General Data Properties ====================

  describe('General Data Properties', () => {
    it('all data shapes should be passed with overwrite=true', () => {
      registerDataShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('all data shapes should have label selector in markup', () => {
      registerDataShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasLabel).toBe(true)
      }
    })
  })
})
