import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Graph } from '@antv/x6'

// 需要处理 `registered` 状态。由于它是模块级变量，
// 每次用动态导入重新获取模块，或通过 forceRegisterBpmnShapes 重置状态。

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
      // 使用 forceRegisterBpmnShapes 确保全新注册
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
      forceRegisterBpmnShapes()

      // 54 events + 13 activities + 7 gateways + 4 data + 2 artifacts + 2 swimlanes = 82 nodes
      expect(registerNodeSpy).toHaveBeenCalledTimes(82)
      // 7 connections
      expect(registerEdgeSpy).toHaveBeenCalledTimes(7)
    })

    it('多次调用应幂等（只注册一次）', async () => {
      const { registerBpmnShapes, forceRegisterBpmnShapes } = await import('../../../src/index')
      // 先强制刷新状态
      forceRegisterBpmnShapes()
      const firstCallCount = registerNodeSpy.mock.calls.length

      // 再次调用应为空操作
      registerBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCallCount)
    })

    it('仅 events=true 时只注册事件图形', async () => {
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
      forceRegisterBpmnShapes({
        events: true,
        activities: false,
        gateways: false,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(54)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('仅 activities=true 时只注册活动图形', async () => {
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
      forceRegisterBpmnShapes({
        events: false,
        activities: false,
        gateways: true,
        data: false,
        artifacts: false,
        swimlanes: false,
        connections: false,
      })
      expect(registerNodeSpy).toHaveBeenCalledTimes(7)
      expect(registerEdgeSpy).not.toHaveBeenCalled()
    })

    it('仅 data=true 时只注册数据图形', async () => {
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
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
      const { registerBpmnShapes, forceRegisterBpmnShapes } = await import('../../../src/index')

      // 强制初始注册
      forceRegisterBpmnShapes()
      const firstCount = registerNodeSpy.mock.calls.length

      // 此次调用应为空操作
      registerBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCount)

      // 强制注册应再次生效
      forceRegisterBpmnShapes()
      expect(registerNodeSpy).toHaveBeenCalledTimes(firstCount * 2)
    })

    it('应接受 options 参数', async () => {
      const { forceRegisterBpmnShapes } = await import('../../../src/index')
      forceRegisterBpmnShapes({ events: true, activities: false, gateways: false, data: false, artifacts: false, swimlanes: false, connections: false })
      expect(registerNodeSpy).toHaveBeenCalledTimes(54)
    })
  })

  describe('插件导出项校验', () => {
    it('应导出 registerBpmnShapes 函数', async () => {
      const mod = await import('../../../src/index')
      expect(typeof mod.registerBpmnShapes).toBe('function')
    })

    it('应导出 forceRegisterBpmnShapes 函数', async () => {
      const mod = await import('../../../src/index')
      expect(typeof mod.forceRegisterBpmnShapes).toBe('function')
    })

    it('应导出 setupBpmnGraph 函数', async () => {
      const mod = await import('../../../src/index')
      expect(typeof mod.setupBpmnGraph).toBe('function')
    })

    it('应重新导出各类图形注册函数', async () => {
      const mod = await import('../../../src/index')
      expect(typeof mod.registerEventShapes).toBe('function')
      expect(typeof mod.registerActivityShapes).toBe('function')
      expect(typeof mod.registerGatewayShapes).toBe('function')
      expect(typeof mod.registerDataShapes).toBe('function')
      expect(typeof mod.registerArtifactShapes).toBe('function')
      expect(typeof mod.registerSwimlaneShapes).toBe('function')
      expect(typeof mod.registerConnectionShapes).toBe('function')
    })

    it('应重新导出所有常量', async () => {
      const mod = await import('../../../src/index')
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

    it('setupBpmnGraph 应补齐默认连线能力且保留宿主自定义实现', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)

      const graph = new Graph({ container, width: 800, height: 600, connecting: {} })
      const dispose = mod.setupBpmnGraph(graph, { behaviors: false })

      expect(typeof graph.options.connecting.createEdge).toBe('function')
      expect(typeof graph.options.connecting.validateConnection).toBe('function')
      expect(typeof graph.options.connecting.validateEdge).toBe('function')
      const defaultEdge = graph.options.connecting.createEdge?.call(graph, {} as any)
      expect(defaultEdge).toBeTruthy()

      dispose()
      graph.dispose()

      const customCreateEdge = vi.fn(() => ({ shape: 'custom-flow' }))
      const customValidateConnection = vi.fn(() => true)
      const customValidateEdge = vi.fn(() => true)
      const graphWithCustom = new Graph({
        container,
        width: 800,
        height: 600,
        connecting: {
          createEdge: customCreateEdge as any,
          validateConnection: customValidateConnection,
          validateEdge: customValidateEdge,
        },
      })

      mod.setupBpmnGraph(graphWithCustom, { behaviors: false, edgeShape: 'bpmn-message-flow' })

      expect(graphWithCustom.options.connecting.createEdge).toBe(customCreateEdge)
      expect(graphWithCustom.options.connecting.validateConnection).toBe(customValidateConnection)
      expect(graphWithCustom.options.connecting.validateEdge).toBe(customValidateEdge)

      graphWithCustom.dispose()
      container.remove()
    })

    it('setupBpmnGraph 应支持关闭注册、默认连线和交互安装', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)
      const graph = new Graph({ container, width: 800, height: 600, connecting: {} })
      const registerNodeCount = registerNodeSpy.mock.calls.length
      const registerEdgeCount = registerEdgeSpy.mock.calls.length
      const originalCreateEdge = graph.options.connecting.createEdge
      const originalValidateConnection = graph.options.connecting.validateConnection
      const originalValidateEdge = graph.options.connecting.validateEdge

      const dispose = mod.setupBpmnGraph(graph, {
        registration: false,
        validate: false,
        installDefaultCreateEdge: false,
        behaviors: false,
      })

      expect(registerNodeSpy).toHaveBeenCalledTimes(registerNodeCount)
      expect(registerEdgeSpy).toHaveBeenCalledTimes(registerEdgeCount)
        expect(graph.options.connecting.createEdge).toBe(originalCreateEdge)
        expect(graph.options.connecting.validateConnection).toBe(originalValidateConnection)
        expect(graph.options.connecting.validateEdge).toBe(originalValidateEdge)

      dispose()
      graph.dispose()
      container.remove()
    })

    it('setupBpmnGraph 在启用默认行为时应返回可释放函数', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)
      const graph = new Graph({ container, width: 800, height: 600, connecting: {} })

      const dispose = mod.setupBpmnGraph(graph)

      expect(typeof dispose).toBe('function')
      dispose()

      graph.dispose()
      container.remove()
    })

    it('setupBpmnGraph 应在宿主未提供时补齐 createEdge 与校验器', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)
      const graph = new Graph({ container, width: 800, height: 600 })

      ;(graph.options as any).connecting = undefined
      const createEdgeSpy = vi.spyOn(graph, 'createEdge').mockImplementation((metadata: any) => metadata as any)

      const nextEdgeShape = vi.fn(() => mod.BPMN_MESSAGE_FLOW)
      const dispose = mod.setupBpmnGraph(graph, {
        registration: false,
        edgeShape: nextEdgeShape,
        behaviors: false,
      })

      expect(typeof graph.options.connecting.createEdge).toBe('function')
      expect(typeof graph.options.connecting.validateConnection).toBe('function')
      expect(typeof graph.options.connecting.validateEdge).toBe('function')
      const source = { id: 'source', shape: mod.BPMN_USER_TASK } as any
      const target = { id: 'target', shape: mod.BPMN_USER_TASK } as any
      graph.options.connecting.validateConnection?.call(graph, {
        sourceCell: source,
        targetCell: target,
        targetMagnet: {} as any,
        edge: undefined,
      } as any)
      const createdEdge = graph.options.connecting.createEdge?.call(graph, {} as any)
      expect(nextEdgeShape).toHaveBeenCalled()
      expect(createdEdge).toEqual({ shape: mod.BPMN_MESSAGE_FLOW })
      expect(createEdgeSpy).toHaveBeenCalledWith({ shape: mod.BPMN_MESSAGE_FLOW })

      dispose()
      graph.dispose()
      container.remove()
    })

    it('setupBpmnGraph 应支持字符串形式的默认连线类型', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)
      const graph = new Graph({ container, width: 800, height: 600 })

      ;(graph.options as any).connecting = undefined
      const createEdgeSpy = vi.spyOn(graph, 'createEdge').mockImplementation((metadata: any) => metadata as any)
      const dispose = mod.setupBpmnGraph(graph, {
        registration: false,
        edgeShape: mod.BPMN_MESSAGE_FLOW,
        behaviors: false,
      })

      const source = { id: 'source', shape: mod.BPMN_USER_TASK } as any
      const target = { id: 'target', shape: mod.BPMN_USER_TASK } as any
      const result = graph.options.connecting.validateConnection?.call(graph, {
        sourceCell: source,
        targetCell: target,
        targetMagnet: {} as any,
        edge: undefined,
      } as any)
      const createdEdge = graph.options.connecting.createEdge?.call(graph, {} as any)

      expect(typeof result).toBe('boolean')
      expect(createdEdge).toEqual({ shape: mod.BPMN_MESSAGE_FLOW })
      expect(createEdgeSpy).toHaveBeenCalledWith({ shape: mod.BPMN_MESSAGE_FLOW })

      dispose()
      graph.dispose()
      container.remove()
    })

    it('setupBpmnGraph 在未提供 edgeShape 时应回退到顺序流', async () => {
      const mod = await import('../../../src/index')
      const container = document.createElement('div')
      document.body.appendChild(container)
      const graph = new Graph({ container, width: 800, height: 600 })

      ;(graph.options as any).connecting = undefined
      const createEdgeSpy = vi.spyOn(graph, 'createEdge').mockImplementation((metadata: any) => metadata as any)
      const dispose = mod.setupBpmnGraph(graph, {
        registration: false,
        behaviors: false,
      })

      expect(graph.options.connecting.createEdge?.call(graph, {} as any)).toEqual({
        shape: mod.BPMN_SEQUENCE_FLOW,
      })
      expect(createEdgeSpy).toHaveBeenCalledWith({ shape: mod.BPMN_SEQUENCE_FLOW })

      dispose()
      graph.dispose()
      container.remove()
    })
  })
})
