import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerSwimlaneShapes } from '../../../src/shapes/swimlanes'
import {
  BPMN_COLORS,
  BPMN_POOL,
  BPMN_LANE,
} from '../../../src/utils/constants'

/**
 * 泳道图形注册测试（registerSwimlaneShapes）
 * 验证池（Pool）和泳道（Lane）图形的尺寸、标题条、颜色和层级配置。
 */
describe('泳道图形注册（registerSwimlaneShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerSwimlaneShapes()).not.toThrow()
  })

  it('应注册恰好 2 种泳道图形', () => {
    registerSwimlaneShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(2)
  })

  // ==================== Pool ====================

  describe('池（Pool）', () => {
    it('应注册池图形', () => {
      registerSwimlaneShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_POOL, expect.any(Object), true)
    })

    it('池应继承自 rect', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('池默认尺寸应为 600×250', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.width).toBe(600)
      expect(config.height).toBe(250)
    })

    it('池应有标题条', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      const hasHeader = config.markup.some((m: any) => m.selector === 'header')
      const hasHeaderLabel = config.markup.some((m: any) => m.selector === 'headerLabel')
      expect(hasHeader).toBe(true)
      expect(hasHeaderLabel).toBe(true)
    })

    it('池标题条应使用 pool.headerFill 颜色', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.header.fill).toBe(BPMN_COLORS.pool.headerFill)
    })

    it('池应使用 pool 配色', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.pool.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.pool.stroke)
    })

    it('池标题文字应逆时针旋转 90°（竖排显示）', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.transform).toBe('rotate(-90)')
    })

    it('池标题文字应加粗', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.fontWeight).toBe('bold')
    })

    it('池的 zIndex 应很低（渲染在最底层）', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-2)
    })

    it('池标题条宽度应为 30px', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_POOL)!
      const config = call[1] as any
      expect(config.attrs.header.width).toBe(30)
    })
  })

  // ==================== Lane ====================

  describe('泳道（Lane）', () => {
    it('应注册泳道图形', () => {
      registerSwimlaneShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_LANE, expect.any(Object), true)
    })

    it('泳道应继承自 rect', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('泳道默认尺寸应为 570×125（内嵌于池内）', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.width).toBe(570)
      expect(config.height).toBe(125)
    })

    it('泳道应有标题条', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      const hasHeader = config.markup.some((m: any) => m.selector === 'header')
      const hasHeaderLabel = config.markup.some((m: any) => m.selector === 'headerLabel')
      expect(hasHeader).toBe(true)
      expect(hasHeaderLabel).toBe(true)
    })

    it('泳道应使用 lane 配色', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.lane.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.lane.stroke)
    })

    it('泳道标题文字应逆时针旋转 90°', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.headerLabel.transform).toBe('rotate(-90)')
    })

    it('泳道 zIndex 应为 -1', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-1)
    })

    it('泳道标题条宽度应为 30px', () => {
      registerSwimlaneShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_LANE)!
      const config = call[1] as any
      expect(config.attrs.header.width).toBe(30)
    })
  })

  // ==================== General Swimlane Properties ====================

  describe('泳道图形通用属性', () => {
    it('所有泳道注册时 overwrite 参数应为 true', () => {
      registerSwimlaneShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('所有泳道的 markup 应包含 body、header、headerLabel', () => {
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
