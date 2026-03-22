import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Graph } from '@antv/x6'

// We need to handle the `registered` state. Since it's a module-level variable,
// we re-import fresh each time via dynamic imports or reset via forceRegisterBpmnShapes.

/**
 * 插件入口测试（Plugin Entry Point）
 * 验证 registerBpmnShapes 幂等性、选项择一注册、强制重新注册及导出项的正确性。
 */
describe('插件入口（Plugin Entry Point）', () => {
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

  describe('registerBpmnShapes —— 图形批量注册', () => {
    it('默认参数调用时应注册全部图形', async () => {
      // Use forceRegisterBpmnShapes to ensure fresh registration
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes()

      // 47 events + 13 activities + 6 gateways + 4 data + 2 artifacts + 2 swimlanes = 74 nodes
      expect(registerNodeSpy).toHaveBeenCalledTimes(74)
      // 7 connections
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('多次调用应幂等（只注册一次）', async () => {
      const { registerBpmnShapes, forceRegisterBpmnShapes } = await import('../src/index')
      // First force a fresh state
      forceRegisterBpmnShapes()
      const firstCallCount = registerNodeSpy.mock.calls.length

      // Now call again - should be a no-op
      registerBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCallCount)
    })

    it('仅 events=true 时只注册事件图形', async () => {
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

    it('仅 activities=true 时只注册活动图形', async () => {
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

    it('仅 gateways=true 时只注册网关图形', async () => {
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

    it('仅 data=true 时只注册数据图形', async () => {
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

    it('仅 artifacts=true 时只注册工件图形', async () => {
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

    it('仅 swimlanes=true 时只注册泳道图形', async () => {
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

    it('仅 connections=true 时只注册连接线图形', async () => {
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

    it('所有选项为 false 时不注册任何图形', async () => {
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

  describe('forceRegisterBpmnShapes —— 强制重新注册', () => {
    it('即便已注册过也应强制重新注册', async () => {
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

    it('应接受 options 参数', async () => {
      const { forceRegisterBpmnShapes } = await import('../src/index')
      forceRegisterBpmnShapes({ events: true, activities: false, gateways: false, data: false, artifacts: false, swimlanes: false, connections: false })
      expect(registerNodeSpy).toHaveBeenCalledTimes(47)
    })
  })

  describe('插件导出项校验', () => {
    it('应导出 registerBpmnShapes 函数', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.registerBpmnShapes).toBe('function')
    })

    it('应导出 forceRegisterBpmnShapes 函数', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.forceRegisterBpmnShapes).toBe('function')
    })

    it('应重新导出各类图形注册函数', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.registerEventShapes).toBe('function')
      expect(typeof mod.registerActivityShapes).toBe('function')
      expect(typeof mod.registerGatewayShapes).toBe('function')
      expect(typeof mod.registerDataShapes).toBe('function')
      expect(typeof mod.registerArtifactShapes).toBe('function')
      expect(typeof mod.registerSwimlaneShapes).toBe('function')
      expect(typeof mod.registerConnectionShapes).toBe('function')
    })

    it('应重新导出所有常量', async () => {
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
