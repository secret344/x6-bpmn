import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerSwimlaneShapes } from '../src/shapes/swimlanes'
import {
  BPMN_COLORS,
  BPMN_POOL,
  BPMN_LANE,
} from '../src/utils/constants'

describe('registerSwimlaneShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerSwimlaneShapes without errors', () => {
    expect(() => registerSwimlaneShapes()).not.toThrow()
  })

  it('should register exactly 2 swimlane shapes', () => {
    registerSwimlaneShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(2)
  })

  // ==================== Pool ====================

  describe('Pool', () => {
    it('should register Pool', () => {
      registerSwimlaneShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_POOL, expect.any(Object), true)
    })

    it('Pool should inherit from rect', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('Pool should have large default size (600x250)', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.width).toBe(600)
      expect(config.height).toBe(250)
    })

    it('Pool should have header band', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      const hasHeader = config.markup.some((m: any) => m.selector === 'header')
      const hasHeaderLabel = config.markup.some((m: any) => m.selector === 'headerLabel')
      expect(hasHeader).toBe(true)
      expect(hasHeaderLabel).toBe(true)
    })

    it('Pool header should use pool header fill color', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.header.fill).toBe(BPMN_COLORS.pool.headerFill)
    })

    it('Pool should use pool colors', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.pool.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.pool.stroke)
    })

    it('Pool header label should be rotated -90° (vertical text)', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.transform).toBe('rotate(-90)')
    })

    it('Pool header label should be bold', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.fontWeight).toBe('bold')
    })

    it('Pool should have very low zIndex (background)', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-2)
    })

    it('Pool header should be 30px wide', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.header.width).toBe(30)
    })
  })

  // ==================== Lane ====================

  describe('Lane', () => {
    it('should register Lane', () => {
      registerSwimlaneShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_LANE, expect.any(Object), true)
    })

    it('Lane should inherit from rect', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('Lane should be 570x125 (fits inside Pool)', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.width).toBe(570)
      expect(config.height).toBe(125)
    })

    it('Lane should have header band', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      const hasHeader = config.markup.some((m: any) => m.selector === 'header')
      const hasHeaderLabel = config.markup.some((m: any) => m.selector === 'headerLabel')
      expect(hasHeader).toBe(true)
      expect(hasHeaderLabel).toBe(true)
    })

    it('Lane should use lane colors', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.lane.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.lane.stroke)
    })

    it('Lane header label should be rotated -90°', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.transform).toBe('rotate(-90)')
    })

    it('Lane should have zIndex -1', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-1)
    })

    it('Lane header should be 30px wide', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.header.width).toBe(30)
    })
  })

  // ==================== General Swimlane Properties ====================

  describe('General Swimlane Properties', () => {
    it('all swimlanes should be passed with overwrite=true', () => {
      registerSwimlaneShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('all swimlanes should have body, header, headerLabel markup', () => {
      registerSwimlaneShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.markup).toHaveLength(3)
        const selectors = config.markup.map((m: any) => m.selector)
        expect(selectors).toContain('body')
        expect(selectors).toContain('header')
        expect(selectors).toContain('headerLabel')
      }
    })
  })
})
