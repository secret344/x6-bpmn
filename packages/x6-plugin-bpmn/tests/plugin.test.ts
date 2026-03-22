import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Graph } from '@antv/x6'

// We need to handle the `registered` state. Since it's a module-level variable,
// we re-import fresh each time via dynamic imports or reset via forceRegisterBpmnShapes.

describe('Plugin Entry Point', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerEdgeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
    registerEdgeSpy = vi.spyOn(Graph, 'registerEdge').mockImplementation(() => undefined as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('registerBpmnShapes', () => {
    it('should register all shapes when called with defaults', async () => {
      // Use forceRegisterBpmnShapes to ensure fresh registration
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes()

      // 47 events + 13 activities + 6 gateways + 4 data + 2 artifacts + 2 swimlanes = 74 nodes
      expect(registerNodeSpy).toHaveBeenCalledTimes(74)
      // 7 connections
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('should not register twice (idempotent guard)', async () => {
      const { registerBpmnShapes, forceRegisterBpmnShapes } = await import('../src/index')
      // First force a fresh state
      forceRegisterBpmnShapes()
      const firstCallCount = registerNodeSpy.mock.calls.length

      // Now call again - should be a no-op
      registerBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCallCount)
    })

    it('should only register events when events=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: true,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(47)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register activities when activities=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: true,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(13)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register gateways when gateways=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: true,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(6)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register data shapes when data=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: true,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(4)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register artifacts when artifacts=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: true,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(2)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register swimlanes when swimlanes=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: true,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(2)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('should only register connections when connections=true, others=false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: true,
      })
      expect(registerNodeSpy).not.toHaveBeenCalled()
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('should register nothing when all options are false', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).not.toHaveBeenCalled()
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })
  })

  describe('forceRegisterBpmnShapes', () => {
    it('should re-register even after registerBpmnShapes was called', async () => {
      const { registerBpmnShapes, forceRegisterBpmnShapes } = await import('../src/index')

      // Force initial registration
      forceRegisterBpmnShapes()
      const firstCount = registerNodeSpy.mock.calls.length

      // This should be no-op
      registerBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCount)

      // Force should work again
      forceRegisterBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCount * 2)
    })

    it('should accept options parameter', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({ events: true, activities: false, gateways: false, data: false, artifacts: false, swimlanes: false, connections: false })
      expect(registerNodeSpy).toHaveBeenCalledTimes(47)
    })
  })

  describe('Exports', () => {
    it('should export registerBpmnShapes function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.registerBpmnShapes).toBe('function')
    })

    it('should export forceRegisterBpmnShapes function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.forceRegisterBpmnShapes).toBe('function')
    })

    it('should re-export shape registrar functions', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.registerEventShapes).toBe('function')
      expect(typeof mod.registerActivityShapes).toBe('function')
      expect(typeof mod.registerGatewayShapes).toBe('function')
      expect(typeof mod.registerDataShapes).toBe('function')
      expect(typeof mod.registerArtifactShapes).toBe('function')
      expect(typeof mod.registerSwimlaneShapes).toBe('function')
      expect(typeof mod.registerConnectionShapes).toBe('function')
    })

    it('should re-export all constants', async () => {
      const mod = await import('../src/index')
      expect(mod.BPMN_START_EVENT).toBeDefined()
      expect(mod.BPMN_TASK).toBeDefined()
      expect(mod.BPMN_EXCLUSIVE_GATEWAY).toBeDefined()
      expect(mod.BPMN_DATA_OBJECT).toBeDefined()
      expect(mod.BPMN_TEXT_ANNOTATION).toBeDefined()
      expect(mod.BPMN_POOL).toBeDefined()
      expect(mod.BPMN_SEQUENCE_FLOW).toBeDefined()
      expect(mod.BPMN_COLORS).toBeDefined()
      expect(mod.BPMN_ICONS).toBeDefined()
    })
  })
})
