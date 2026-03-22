import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerGatewayShapes } from '../src/shapes/gateways'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_PARALLEL_GATEWAY,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
} from '../src/utils/constants'

describe('registerGatewayShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerGatewayShapes without errors', () => {
    expect(() => registerGatewayShapes()).not.toThrow()
  })

  it('should register exactly 6 gateway shapes', () => {
    registerGatewayShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(6)
  })

  const gatewayNames = [
    BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY,
    BPMN_COMPLEX_GATEWAY, BPMN_EVENT_BASED_GATEWAY, BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  ]

  it('should register all 6 gateway types', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
    }
  })

  it('all gateways should inherit from polygon (diamond shape)', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.inherit).toBe('polygon')
    }
  })

  it('all gateways should use diamond refPoints', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.body.refPoints).toBe('0,0.5 0.5,0 1,0.5 0.5,1')
    }
  })

  it('all gateways should be 50x50', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.width).toBe(50)
      expect(config.height).toBe(50)
    }
  })

  it('all gateways should use gateway colors (yellow/gold)', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.gateway.stroke)
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.gateway.fill)
    }
  })

  it('all gateways should have 4 ports', () => {
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

  it('all gateways should have marker path', () => {
    registerGatewayShapes()
    for (const name of gatewayNames) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBeTruthy()
    }
  })

  // ==================== Specific Gateway Markers ====================

  it('Exclusive Gateway should use X marker', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EXCLUSIVE_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.exclusiveX)
  })

  it('Parallel Gateway should use + marker', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_PARALLEL_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.parallelPlus)
  })

  it('Inclusive Gateway should use O marker', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_INCLUSIVE_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.inclusiveO)
  })

  it('Complex Gateway should use * marker', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_COMPLEX_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.complex)
  })

  it('Event-Based Gateway should use event-based marker and outer circles', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_BASED_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.eventBased)
    expect(config.attrs.outerCircle).toBeDefined()
    expect(config.attrs.innerCircle).toBeDefined()
  })

  it('Exclusive Event-Based Gateway should have outer circles', () => {
    registerGatewayShapes()
    const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY)!
    const config = call[1] as any
    expect(config.attrs.outerCircle).toBeDefined()
    expect(config.attrs.innerCircle).toBeDefined()
    expect(config.attrs.marker.d).toBe(BPMN_ICONS.eventBased)
  })

  it('Non-event-based gateways should NOT have outer circles', () => {
    registerGatewayShapes()
    const nonEventGateways = [BPMN_EXCLUSIVE_GATEWAY, BPMN_PARALLEL_GATEWAY, BPMN_INCLUSIVE_GATEWAY, BPMN_COMPLEX_GATEWAY]
    for (const name of nonEventGateways) {
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
      const config = call[1] as any
      expect(config.attrs.outerCircle).toBeUndefined()
      expect(config.attrs.innerCircle).toBeUndefined()
    }
  })

  it('all gateways should be passed with overwrite=true', () => {
    registerGatewayShapes()
    for (const call of registerNodeSpy.mock.calls) {
      expect(call[2]).toBe(true)
    }
  })

  it('all gateways should have label selector', () => {
    registerGatewayShapes()
    for (const call of registerNodeSpy.mock.calls) {
      const config = call[1] as any
      const hasLabel = config.markup.some((m: any) => m.selector === 'label')
      expect(hasLabel).toBe(true)
    }
  })
})
