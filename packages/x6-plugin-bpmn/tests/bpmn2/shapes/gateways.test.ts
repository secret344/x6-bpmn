import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerGatewayShapes } from '../../../src/shapes/gateways'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_PARALLEL_GATEWAY,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
} from '../../../src/utils/constants'

/**
 * 网关图形注册测试（registerGatewayShapes）
 * 验证 6 种 BPMN 2.0 网关图形的形状、标记、配色和端口。
 */
describe('网关图形注册（registerGatewayShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerGatewayShapes()).not.toThrow()
  })

  it('应注册恰好 6 种网关图形', () => {
    registerGatewayShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(6)
  })

  const gatewayNames = [
    BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
    BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  ]

  it('应注册全部 6 种网关类型', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
    }
  })

  it('所有网关应继承自 polygon（菱形）', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.inherit).toBe('polygon')
    }
  })

  it('所有网关应使用菱形顶点坐标', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.body.refPoints).toBe('0,0.5 0.5,0 1,0.5 0.5,1')
    }
  })

  it('所有网关默认尺寸应为 50×50', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.width).toBe(50)
      expect(config.height).toBe(50)
    }
  })

  it('所有网关应使用网关配色（黄金色）', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.gateway.stroke)
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.gateway.fill)
    }
  })

  it('所有网关应有 4 个连接端口', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.ports.groups).toHaveProperty('top')
      expect(config.ports.groups).toHaveProperty('right')
      expect(config.ports.groups).toHaveProperty('bottom')
      expect(config.ports.groups).toHaveProperty('left')
      expect(config.ports.items).toHaveLength(4)
    }
  })

  it('所有网关应有标记图标路径', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBeTruthy()
    }
  })

  // ==================== Specific Gateway Markers ====================

  it('排他网关应使用 X 标记', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EXCLUSIVE_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.exclusiveX)
  })

  it('并行网关应使用 + 标记', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_PARALLEL_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.parallelPlus)
  })

  it('包容网关应使用 O 标记', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_INCLUSIVE_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.inclusiveO)
  })

  it('复杂网关应使用 * 标记', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_COMPLEX_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.complex)
  })

  it('事件网关应有事件标记和外圈', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_BASED_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.eventBased)
    expect(config.attrs.outerCircle).toBeDefined()
    expect(config.attrs.innerCircle).toBeDefined()
  })

  it('排他事件网关应有外圈', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.outerCircle).toBeDefined()
    expect(config.attrs.innerCircle).toBeDefined()
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.eventBased)
  })

  it('非事件网关不应有外圈', () => {
    registerGatewayShapes()
    const nonEventGateways = [BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY, BPMN_COMPLEX_GATEWAY]
    for (const name of nonEventGateways) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.outerCircle).toBeUndefined()
      expect(config.attrs.innerCircle).toBeUndefined()
    }
  })

  it('所有网关注册时 overwrite 参数应为 true', () => {
    registerGatewayShapes()
    for (const call of registerNodeSpy.mock.calls) {
      expect(call[2]).toBe(true)
    }
  })

  it('所有网关的 markup 应包含 label 选择器', () => {
    registerGatewayShapes()
    for (const call of registerNodeSpy.mock.calls) {
      const config = call[1] as any
      const hasLabel = config.markup.some((m: any) => m.selector === 'label')
      expect(hasLabel).toBe(true)
    }
  })
})
