import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerConnectionShapes } from '../src/connections'
import {
  BPMN_COLORS,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../src/utils/constants'

describe('registerConnectionShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation(() => undefined as any)
  })

  it('should call registerConnectionShapes without errors', () => {
    expect(() => registerConnectionShapes()).not.toThrow()
  })

  it('should register exactly 7 connection types', () => {
    registerConnectionShapes()
    expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
  })

  const allConnectionNames = [
    BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW,
    BPMN_MESSAGE_FLOW, BPMN_ASSOCIATION, BPMN_DIRECTED_ASSOCIATION,
    BPMN_DATA_ASSOCIATION,
  ]

  it('should register all 7 connection types', () => {
    registerConnectionShapes()
    for (const name of allConnectionNames) {
      expect(registerEdgeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
    }
  })

  // ==================== Sequence Flow ====================

  describe('Sequence Flow', () => {
    it('should be a solid line with filled arrowhead', () => {
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

    it('should inherit from edge', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SEQUENCE_FLOW)!
      const config = call[1] as any
      expect(config.inherit).toBe('edge')
    })
  })

  // ==================== Conditional Flow ====================

  describe('Conditional Flow', () => {
    it('should have diamond source marker (condition indicator)', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.name).toBe('diamond')
      expect(config.attrs.line.sourceMarker.fill).toBe('#fff')
    })

    it('should have filled arrowhead target marker', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('should use sequence flow color', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CONDITIONAL_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.sequenceFlow)
    })
  })

  // ==================== Default Flow ====================

  describe('Default Flow', () => {
    it('should have filled arrowhead', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.name).toBe('block')
    })

    it('should have sourceMarker for default flow slash', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.d).toBeDefined()
      expect(config.attrs.line.sourceMarker.fill).toBe('none')
    })

    it('should use sequence flow color', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DEFAULT_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.sequenceFlow)
    })
  })

  // ==================== Message Flow ====================

  describe('Message Flow', () => {
    it('should be a dashed line', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('8,5')
    })

    it('should have circle source marker', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.sourceMarker).toBeDefined()
      expect(config.attrs.line.sourceMarker.name).toBe('ellipse')
      expect(config.attrs.line.sourceMarker.fill).toBe('#fff')
    })

    it('should have open arrowhead target marker', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('should use messageFlow color (blue)', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MESSAGE_FLOW)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.messageFlow)
    })
  })

  // ==================== Association ====================

  describe('Association', () => {
    it('should be a dotted line', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('4,4')
    })

    it('should have NO arrowhead (undirected)', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeNull()
    })

    it('should use association color', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== Directed Association ====================

  describe('Directed Association', () => {
    it('should be a dotted line', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('4,4')
    })

    it('should have open arrowhead', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('should use association color', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DIRECTED_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== Data Association ====================

  describe('Data Association', () => {
    it('should be a dashed line (different from association dot pattern)', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.strokeDasharray).toBe('6,3')
    })

    it('should have open arrowhead', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.targetMarker).toBeDefined()
      expect(config.attrs.line.targetMarker.open).toBe(true)
    })

    it('should use association color', () => {
      registerConnectionShapes()
      const call = registerEdgeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_DATA_ASSOCIATION)!
      const config = call[1] as any
      expect(config.attrs.line.stroke).toBe(BPMN_COLORS.association)
    })
  })

  // ==================== General Connection Properties ====================

  describe('General Connection Properties', () => {
    it('all connections should inherit from edge', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.inherit).toBe('edge')
      }
    })

    it('all connections should be passed with overwrite=true', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('all connections should have zIndex 0', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.zIndex).toBe(0)
      }
    })

    it('all connections should have empty labels array', () => {
      registerConnectionShapes()
      for (const call of registerEdgeSpy.mock.calls) {
        const config = call[1] as any
        expect(config.labels).toEqual([])
      }
    })
  })
})
