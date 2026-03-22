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

/**
 * 数据元素图形注册测试（registerDataShapes）
 * 验证数据对象、数据输入、数据输出、数据存储 4 种图形的形状、配色和端口。
 */
describe('数据元素图形注册（registerDataShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerDataShapes()).not.toThrow()
  })

  it('应注册恰好 4 个数据图形', () => {
    registerDataShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(4)
  })

  // ==================== Data Object ====================

  describe('数据对象（Data Object）', () => {
    it('应注册数据对象图形', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_OBJECT, expect.any(Object), true)
    })

    it('数据对象应继承自 polygon', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.inherit).toBe('polygon')
    })

    it('数据对象应有折角（页面形状）', () => {
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

    it('数据对象默认尺寸应为 40×50', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.width).toBe(40)
      expect(config.height).toBe(50)
    })

    it('数据对象应使用数据配色', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OBJECT)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.data.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.data.stroke)
    })

    it('数据对象应有 4 个连接端口', () => {
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

  describe('数据输入（Data Input）', () => {
    it('应注册数据输入图形', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_INPUT, expect.any(Object), true)
    })

    it('数据输入应继承自数据对象', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.inherit).toBe(BPMN_DATA_OBJECT)
    })

    it('数据输入应有输入箭头图标', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.dataInput)
    })

    it('数据输入应有正确的默认标签', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_INPUT)!
      const config = call[1] as any
      expect(config.attrs.label.text).toBe('Data Input')
    })
  })

  // ==================== Data Output ====================

  describe('数据输出（Data Output）', () => {
    it('应注册数据输出图形', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_OUTPUT, expect.any(Object), true)
    })

    it('数据输出应继承自数据对象', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.inherit).toBe(BPMN_DATA_OBJECT)
    })

    it('数据输出应有输出箭头图标', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.dataOutput)
    })

    it('数据输出应有正确的默认标签', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_OUTPUT)!
      const config = call[1] as any
      expect(config.attrs.label.text).toBe('Data Output')
    })
  })

  // ==================== Data Store ====================

  describe('数据存储（Data Store）', () => {
    it('应注册数据存储图形', () => {
      registerDataShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_DATA_STORE, expect.any(Object), true)
    })

    it('数据存储应继承自 rect', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('数据存储应有圆柱形边框路径', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.attrs.body.d).toBeTruthy()
      // should contain C (curve) commands for cylinder top/bottom
      expect(config.attrs.body.d).toContain('C')
    })

    it('数据存储默认尺寸应为 50×50', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.width).toBe(50)
      expect(config.height).toBe(50)
    })

    it('数据存储应使用数据配色', () => {
      registerDataShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_STORE)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.data.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.data.stroke)
    })

    it('数据存储应有 4 个连接端口', () => {
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

  describe('数据图形通用属性', () => {
    it('所有数据图形注册时 overwrite 参数应为 true', () => {
      registerDataShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('所有数据图形的 markup 应包含 label 选择器', () => {
      registerDataShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasLabel).toBe(true)
      }
    })
  })
})
