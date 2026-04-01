import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerConnectionShapes } from '../../../src/connections'
import {
  BPMN_COLORS,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../../../src/utils/constants'

/**
 * 连接线图形注册测试（registerConnectionShapes）
 * 验证 7 种 BPMN 2.0 连接线图形的线条样式、箭头和颜色配置。
 */
describe('连接线图形注册（registerConnectionShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerConnectionShapes()).not.toThrow()
  })

  it('应注册恰好 7 种连接线类型', () => {
    registerConnectionShapes()
    expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
  })

  const allConnectionNames = [
    BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
    BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
    BPMN_DATA_ASSOCIATION,
  ]

  it('应注册全部 7 种连接线', () => {
    registerConnectionShapes()
    for (const name of allConnectionNames) {
      expect(registerEdgeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
    }
  })

  // ==================== Sequence Flow ====================

  describe('顺序流（Sequence Flow）', () => {
    it('应为实线并带有实心箭头', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SEQUENCE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.sequenceFlow)
      expect(config.attrs.line.strokeWidth).toBe(2)
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
      // No dash for sequence flow
      expect(config.attrs.line.strokeDasharray).toBeUndefined()
    })

    it('应继承自 edge', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SEQUENCE_FLOW)!
      const config = call[1] as any
      expect(config.inherit).toBe('edge')
    })
  })

  // ==================== Conditional Flow ====================

  describe('条件流（Conditional Flow）', () => {
    it('源端应有菱形标记（条件指示符）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.name).toBe('diamond')
      expect(config.attrs.line.sourceMarker.fill).toBe('#fff')
    })

    it('目标端应有实心箭头', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('应使用顺序流颜色（条件流）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.sequenceFlow)
    })
  })

  // ==================== Default Flow ====================

  describe('默认流（Default Flow）', () => {
    it('目标端应有实心箭头（默认流）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('源端应有默认流斜线标记', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.d).toBeDefined()
      expect(config.attrs.line.sourceMarker.fill).toBe('none')
    })

    it('应使用顺序流颜色（默认流）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.sequenceFlow)
    })
  })

  // ==================== Message Flow ====================

  describe('消息流（Message Flow）', () => {
    it('消息流应为虚线', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('8,5')
    })

    it('源端应有圆形标记', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.name).toBe('ellipse')
      expect(config.attrs.line.sourceMarker.fill).toBe('#fff')
    })

    it('目标端应有空心箭头（消息流）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('应使用消息流颜色（蓝色）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.messageFlow)
    })
  })

  // ==================== Association ====================

  describe('关联（Association）', () => {
    it('关联应为点线', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('4,4')
    })

    it('关联不应有箭头（无方向）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeNull()
    })

    it('关联应使用关联颜色', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== Directed Association ====================

  describe('定向关联（Directed Association）', () => {
    it('定向关联应为点线', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('4,4')
    })

    it('定向关联应有空心箭头', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('定向关联应使用关联颜色', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== Data Association ====================

  describe('数据关联（Data Association）', () => {
    it('数据关联应为虚线（与关联点线区分）', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('6,3')
    })

    it('数据关联应有空心箭头', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('数据关联应使用关联颜色', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== General Connection Properties ====================

  describe('连接线通用属性', () => {
    it('所有连接线应继承自 edge', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.inherit).toBe('edge')
      }
    })

    it('所有连接线注册时 overwrite 参数应为 true', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('所有连接线的 zIndex 应为 0', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.zIndex).toBe(0)
      }
    })

    it('所有连接线的 labels 应为空数组', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.labels).toEqual([])
      }
    })
  })
})
