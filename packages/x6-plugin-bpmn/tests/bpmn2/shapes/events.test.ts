import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerEventShapes } from '../../../src/shapes/events'
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
  BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
  BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
  BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
  BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
} from '../../../src/utils/constants'

/**
 * 事件图形注册测试（registerEventShapes）
 * 验证开始 / 中间 / 边界 / 结束 4 类事件，共 54 个图形的圆形、颜色、图标和属性。
 */
describe('事件图形注册（registerEventShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerEventShapes()).not.toThrow()
  })

  it('应注册恰好 54 个事件图形', () => {
    registerEventShapes()
    // 47 原始 + 7 个按类型区分的非中断边界事件变体 = 54
    expect(registerNodeSpy).toHaveBeenCalledTimes(54)
  })

  // ==================== Start Events (7) ====================

  describe('开始事件', () => {
    const startEventNames = [
      BPMN_START_EVENT, BPMN_START_EVENT_MESSAGE, BPMN_START_EVENT_TIMER,
      BPMN_START_EVENT_CONDITIONAL, BPMN_START_EVENT_SIGNAL,
      BPMN_START_EVENT_MULTIPLE, BPMN_START_EVENT_PARALLEL_MULTIPLE,
    ]

    it('应注册全部 7 种开始事件类型', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('开始事件应使用单细圆（非双圆）', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.inherit).toBe('ellipse')
        // 开始事件不应有 innerCircle
        expect(config.attrs.body.strokeWidth).toBe(2)
        expect(config.attrs.innerCircle).toBeUndefined()
      }
    })

    it('开始事件应使用绿色（BPMN 惯例）', () => {
      registerEventShapes()
      for (const name of startEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.startEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.startEvent.fill)
      }
    })

    it('开始事件应有 4 个连接端口', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.ports.groups).toHaveProperty('top')
      expect(config.ports.groups).toHaveProperty('right')
      expect(config.ports.groups).toHaveProperty('bottom')
      expect(config.ports.groups).toHaveProperty('left')
      expect(config.ports.items).toHaveLength(4)
    })

    it('事件图形默认尺寸应为 36×36', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.width).toBe(36)
      expect(config.height).toBe(36)
    })

    it('普通开始事件不应有图标', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_START_EVENT)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeUndefined()
    })

    it('带类型的开始事件应有图标路径', () => {
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

  describe('中间抛出事件', () => {
    const throwEventNames = [
      BPMN_INTERMEDIATE_THROW_EVENT, BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, BPMN_INTERMEDIATE_THROW_EVENT_LINK,
      BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
    ]

    it('应注册全部 7 种中间抛出事件', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('中间事件应使用双圆（BPMN 规范）', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
        expect(config.attrs.innerCircle.fill).toBe('none')
      }
    })

    it('中间事件应使用蓝色配色', () => {
      registerEventShapes()
      for (const name of throwEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.intermediateEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.intermediateEvent.fill)
      }
    })

    it('抛出事件图标应为实心（抛出 = 实心）', () => {
      registerEventShapes()
      const typedThrow = throwEventNames.filter(n => n !== BPMN_INTERMEDIATE_THROW_EVENT)
      for (const name of typedThrow) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        // 抛出事件使用填充图标
        expect(config.attrs.icon.fill).toBe(BPMN_COLORS.intermediateEvent.stroke)
      }
    })
  })

  // ==================== Intermediate Catch Events (12) ====================

  describe('中间捕获事件', () => {
    const catchEventNames = [
      BPMN_INTERMEDIATE_CATCH_EVENT, BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
      BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
      BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
      BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
      BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
      BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
    ]

    it('应注册全部 12 种中间捕获事件', () => {
      registerEventShapes()
      for (const name of catchEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('中间捕获事件应使用双圆', () => {
      registerEventShapes()
      for (const name of catchEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
      }
    })

    it('捕获事件图标应为空心（捕获 = 空心）', () => {
      registerEventShapes()
      const typedCatch = catchEventNames.filter(n => n !== BPMN_INTERMEDIATE_CATCH_EVENT)
      for (const name of typedCatch) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.icon).toBeDefined()
        // 捕获事件使用描边图标（描边而非填充）
        expect(config.attrs.icon.stroke).toBe(BPMN_COLORS.intermediateEvent.stroke)
      }
    })
  })

  // ==================== Boundary Events (19) ====================

  describe('边界事件', () => {
    const boundaryEventNames = [
      BPMN_BOUNDARY_EVENT, BPMN_BOUNDARY_EVENT_MESSAGE, BPMN_BOUNDARY_EVENT_TIMER,
      BPMN_BOUNDARY_EVENT_ESCALATION, BPMN_BOUNDARY_EVENT_CONDITIONAL,
      BPMN_BOUNDARY_EVENT_ERROR, BPMN_BOUNDARY_EVENT_CANCEL,
      BPMN_BOUNDARY_EVENT_COMPENSATION, BPMN_BOUNDARY_EVENT_SIGNAL,
      BPMN_BOUNDARY_EVENT_MULTIPLE, BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
      BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
      BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
    ]

    it('应注册全部 19 种边界事件', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('边界事件应使用双圆', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeDefined()
      }
    })

    it('边界事件应使用橙色配色', () => {
      registerEventShapes()
      for (const name of boundaryEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.boundaryEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.boundaryEvent.fill)
      }
    })

    it('非中断边界事件应使用虚线圆', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BOUNDARY_EVENT_NON_INTERRUPTING)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeDefined()
      expect(config.attrs.innerCircle.strokeDasharray).toBeDefined()
    })

    it('中断边界事件边框不应为虚线', () => {
      registerEventShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BOUNDARY_EVENT)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeUndefined()
    })
  })

  // ==================== End Events (9) ====================

  describe('结束事件', () => {
    const endEventNames = [
      BPMN_END_EVENT, BPMN_END_EVENT_MESSAGE, BPMN_END_EVENT_ESCALATION,
      BPMN_END_EVENT_ERROR, BPMN_END_EVENT_CANCEL, BPMN_END_EVENT_COMPENSATION,
      BPMN_END_EVENT_SIGNAL, BPMN_END_EVENT_TERMINATE, BPMN_END_EVENT_MULTIPLE,
    ]

    it('应注册全部 9 种结束事件', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('结束事件应使用粗圆（strokeWidth 3，BPMN 规范）', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.strokeWidth).toBe(3)
      }
    })

    it('结束事件应使用红色', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.endEvent.stroke)
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.endEvent.fill)
      }
    })

    it('结束事件不应有双圆（单粗圆）', () => {
      registerEventShapes()
      for (const name of endEventNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.innerCircle).toBeUndefined()
      }
    })

    it('带类型的结束事件图标应为实心', () => {
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

  describe('事件图形通用属性', () => {
    it('所有事件图形应继承自 ellipse', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.inherit).toBe('ellipse')
      }
    })

    it('所有事件的 markup 应包含 label 选择器', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasLabel).toBe(true)
      }
    })

    it('所有事件的 markup 应包含 body 椭圆选择器', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasBody = config.markup.some((m: any) => m.selector === 'body')
        expect(hasBody).toBe(true)
      }
    })

    it('所有事件注册时 overwrite 参数应为 true', () => {
      registerEventShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })
  })
})
