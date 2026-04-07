/**
 * DialectManager & BPMN2 适配器 — 单元测试
 *
 * 覆盖 DialectManager.bind / unbind / exportXML / importXML、
 * 适配器继承链 fallback、BPMN2 适配器工厂。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { buildTestXml } from '../../helpers/xml-test-utils'
import { DialectManager, createDialectManager } from '../../../src/core/dialect/manager'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import type { ExporterAdapter, ImporterAdapter, ProfileContext, ResolvedProfile } from '../../../src/core/dialect/types'
import { createBpmn2ExporterAdapter } from '../../../src/export/adapter'
import { createBpmn2ImporterAdapter } from '../../../src/import/adapter'
import type { Profile } from '../../../src/core/dialect/types'
import { bpmn2Profile, smartengineBaseProfile } from '../../../src/builtin'
import { importBpmnXml } from '../../../src/import'

// ============================================================================
// 辅助
// ============================================================================

function minimalProfile(id: string, parent?: string) {
  return {
    meta: { id, name: id, parent },
    definitions: { nodes: {}, edges: {} },
    availability: { nodes: {}, edges: {} },
    rendering: {
      theme: { colors: {}, icons: {} },
      nodeRenderers: {},
      edgeRenderers: {},
    },
    rules: { nodeCategories: {}, connectionRules: {}, constraints: [] },
    dataModel: { fields: {}, categoryFields: {} },
    serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
  }
}

function rulesProfile(id: string) {
  return {
    meta: { id, name: id },
    definitions: { nodes: {}, edges: {} },
    availability: { nodes: {}, edges: {} },
    rendering: {
      theme: { colors: {}, icons: {} },
      nodeRenderers: {},
      edgeRenderers: {},
    },
    rules: {
      nodeCategories: {
        'bpmn-task': 'task',
        'bpmn-start-event': 'startEvent',
      },
      connectionRules: {
        startEvent: { noIncoming: true },
        task: { allowedOutgoing: ['bpmn-sequence-flow'], allowedIncoming: ['bpmn-sequence-flow'] },
      },
      constraints: [],
    },
    dataModel: { fields: {}, categoryFields: {} },
    serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
  }
}

function createFakeGraph() {
  return {
    options: {},
    getNodes: () => [],
    getEdges: () => [],
    getConnectedEdges: () => [],
  } as any
}

function createGraphCell(id: string, shape: string, graph: any) {
  return {
    id,
    shape,
    model: { graph },
    getParent: () => null,
    getData: () => ({}),
  }
}

// ============================================================================
// DialectManager
// ============================================================================

describe('DialectManager', () => {
  let registry: ProfileRegistry
  let manager: DialectManager

  beforeEach(() => {
    registry = new ProfileRegistry()
    registry.register(minimalProfile('bpmn2') as any)
    registry.register(minimalProfile('smartengine-base', 'bpmn2') as any)
    registry.register(minimalProfile('smartengine-custom', 'smartengine-base') as any)
    manager = createDialectManager({ registry })
  })

  it('getRegistry 应返回传入的 registry', () => {
    expect(manager.getRegistry()).toBe(registry)
  })

  it('bind 应将 profile 绑定到 graph 并返回 context', () => {
    const graph = createFakeGraph()
    const context = manager.bind(graph, 'bpmn2')
    expect(context.profile.meta.id).toBe('bpmn2')
    expect(manager.getContext(graph)).toBe(context)
  })

  it('bind 默认使用 defaultDialect', () => {
    const graph = createFakeGraph()
    const context = manager.bind(graph)
    expect(context.profile.meta.id).toBe('bpmn2')
  })

  it('unbind 应移除绑定', () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    manager.unbind(graph)
    expect(manager.getContext(graph)).toBeUndefined()
  })

  it('重复 bind 应替换旧 context', () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    manager.bind(graph, 'smartengine-base')
    expect(manager.getContext(graph)!.profile.meta.id).toBe('smartengine-base')
  })

  it('bind 应自动接入 graph.connecting.validateConnection', () => {
    const createEdge = vi.fn(() => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }))
    const graph = createFakeGraph()
    graph.options = { connecting: { createEdge } }

    manager.bind(graph, 'bpmn2')

    const validateConnection = graph.options.connecting.validateConnection
    expect(typeof validateConnection).toBe('function')
    expect(validateConnection({
      sourceCell: createGraphCell('source', 'bpmn-task', graph),
      targetCell: createGraphCell('target', 'bpmn-task', graph),
      targetMagnet: {},
    })).toBe(true)
    expect(createEdge).toHaveBeenCalled()
  })

  it('bind 应自动接入 graph.connecting.validateEdge', () => {
    const createEdge = vi.fn(() => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }))
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = { connecting: { createEdge } }

    manager.bind(graph, 'bpmn2')

    const validateEdge = graph.options.connecting.validateEdge
    expect(typeof validateEdge).toBe('function')
    expect(validateEdge({
      edge: {
        id: 'edge-1',
        shape: 'bpmn-sequence-flow',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
  })

  it('validateEdge 应优先使用 edge.getShape', () => {
    registry.register(rulesProfile('strict-shape') as any)
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-message-flow', dispose: vi.fn() }),
      },
    }
    const strictManager = createDialectManager({
      registry,
      edgeShapeGetter: () => 'bpmn-message-flow',
    })

    strictManager.bind(graph, 'strict-shape')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        model: { graph },
        getShape: () => 'bpmn-sequence-flow',
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
  })

  it('validateEdge 在 edge 未提供 shape 时应回退到 manager 推断的边类型', () => {
    registry.register(rulesProfile('strict-fallback-shape') as any)
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    const strictManager = createDialectManager({ registry })
    strictManager.bind(graph, 'strict-fallback-shape')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
  })

  it('bind 应在 graph 无 options 时补齐 connecting 配置', () => {
    const graph = createFakeGraph()
    delete graph.options

    manager.bind(graph, 'bpmn2')

    expect(graph.options).toBeDefined()
    expect(graph.options.connecting).toBeDefined()
  })

  it('bind 应保留既有 validateConnection 并在 unbind 时恢复', () => {
    const previousValidateConnection = vi.fn(() => false)
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
        validateConnection: previousValidateConnection,
      },
    }

    manager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateConnection({
      sourceCell: createGraphCell('source', 'bpmn-task', graph),
      targetCell: createGraphCell('target', 'bpmn-task', graph),
      targetMagnet: {},
    })).toBe(false)

    manager.unbind(graph)
    expect(graph.options.connecting.validateConnection).toBe(previousValidateConnection)
  })

  it('bind 应保留既有 validateEdge 并在 unbind 时恢复', () => {
    const previousValidateEdge = vi.fn(() => false)
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
        validateEdge: previousValidateEdge,
      },
    }

    manager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({ edge: null })).toBe(false)

    manager.unbind(graph)
    expect(graph.options.connecting.validateEdge).toBe(previousValidateEdge)
  })

  it('旧 validateEdge 返回 true 时应继续执行主库校验', () => {
    const previousValidateEdge = vi.fn(() => true)
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
        validateEdge: previousValidateEdge,
      },
    }

    manager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        shape: 'bpmn-sequence-flow',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
    expect(previousValidateEdge).toHaveBeenCalledOnce()
  })

  it('unbind 在 validateConnection 已被外部替换时应跳过恢复', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    manager.bind(graph, 'bpmn2')
    const externalValidateConnection = vi.fn(() => true)
    graph.options.connecting.validateConnection = externalValidateConnection

    manager.unbind(graph)
    expect(graph.options.connecting.validateConnection).toBe(externalValidateConnection)
  })

  it('unbind 在无既有校验回调时应移除自动注入的校验函数', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() })
      },
    }

    manager.bind(graph, 'bpmn2')
    manager.unbind(graph)

    expect('validateConnection' in graph.options.connecting).toBe(false)
    expect('validateEdge' in graph.options.connecting).toBe(false)
  })

  it('cleanup 执行时若 connecting 已不存在应直接跳过', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() })
      },
    }

    manager.bind(graph, 'bpmn2')
    delete graph.options.connecting

    expect(() => manager.unbind(graph)).not.toThrow()
  })

  it('unbind 在 validateEdge 已被外部替换时应跳过恢复', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    manager.bind(graph, 'bpmn2')
    const externalValidateEdge = vi.fn(() => true)
    graph.options.connecting.validateEdge = externalValidateEdge

    manager.unbind(graph)
    expect(graph.options.connecting.validateEdge).toBe(externalValidateEdge)
  })

  it('validateEdge 失败时应通过 manager 级回调抛出错误结果', () => {
    registry.register(rulesProfile('strict-bpmn') as any)
    const onValidationError = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationError })
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-start-event', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'strict-bpmn')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        shape: 'bpmn-sequence-flow',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(false)
    expect(onValidationError).toHaveBeenCalledOnce()
    expect(onValidationError.mock.calls[0][0].reason).toContain('入线')
  })

  it('正常通过时不应触发 manager 级错误回调', () => {
    const onValidationError = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationError })
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        shape: 'bpmn-sequence-flow',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
    expect(onValidationError).not.toHaveBeenCalled()
  })

  it('旧 validateEdge 抛异常时应走 manager 异常回调而非普通错误回调', () => {
    const onValidationError = vi.fn()
    const onValidationException = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationError, onValidationException })
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
        validateEdge: () => { throw new Error('mock previous edge error') },
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({ edge: null })).toBe(false)
    expect(onValidationError).not.toHaveBeenCalled()
    expect(onValidationException).toHaveBeenCalledOnce()
    expect(onValidationException.mock.calls[0][1].kind).toBe('exception')
  })

  it('validateEdge 返回 exception 结果时应走 manager 异常回调', () => {
    const onValidationError = vi.fn()
    const onValidationException = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationError, onValidationException })
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        model: { graph: { getCellById: () => null } },
        getSourceCellId: () => { throw new Error('mock edge error') },
        getTargetCellId: () => 'target',
      },
    })).toBe(false)
    expect(onValidationError).not.toHaveBeenCalled()
    expect(onValidationException).toHaveBeenCalledOnce()
    expect(onValidationException.mock.calls[0][1].kind).toBe('exception')
  })

  it('旧校验链路抛出非 Error 值时也应归一化为 exception 结果', () => {
    const onValidationException = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationException })
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
        validateEdge: () => { throw 'mock string error' },
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({ edge: null })).toBe(false)
    expect(onValidationException).toHaveBeenCalledOnce()
    expect(onValidationException.mock.calls[0][1].reason).toBe('连接终校验链路执行异常')
  })

  it('边类型推断抛异常时应回退默认边类型并通知异常回调', () => {
    const onValidationException = vi.fn()
    const strictManager = createDialectManager({
      registry,
      edgeShapeGetter: () => { throw new Error('mock getter error') },
      onValidationException,
    })
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-message-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).toBe(true)
    expect(onValidationException).toHaveBeenCalledOnce()
    expect(onValidationException.mock.calls[0][1].reason).toContain('边类型推断执行异常')
  })

  it('validateConnection 返回 exception 结果时应通知 manager 异常回调', () => {
    const onValidationException = vi.fn()
    const strictManager = createDialectManager({ registry, onValidationException })
    const graph = createFakeGraph()
    const sourceNode = {
      shape: 'bpmn-task',
      model: { graph },
      getParent: () => null,
      getData: () => ({}),
      get id() {
        throw new Error('mock source id error')
      },
    }
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateConnection({
      sourceCell: sourceNode,
      targetCell: targetNode,
      targetMagnet: {},
    })).toBe(false)
    expect(onValidationException).toHaveBeenCalledOnce()
    expect(onValidationException.mock.calls[0][1].kind).toBe('exception')
  })

  it('宿主 onValidationError 抛异常时不应打断主链路', () => {
    registry.register(rulesProfile('strict-host-error') as any)
    const strictManager = createDialectManager({
      registry,
      onValidationError: () => { throw new Error('mock host error') },
    })
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-start-event', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-sequence-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'strict-host-error')

    expect(() => graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        shape: 'bpmn-sequence-flow',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).not.toThrow()
  })

  it('宿主 onValidationException 抛异常时不应打断主链路', () => {
    const strictManager = createDialectManager({
      registry,
      edgeShapeGetter: () => { throw new Error('mock getter error') },
      onValidationException: () => { throw new Error('mock host exception') },
    })
    const graph = createFakeGraph()
    const sourceNode = createGraphCell('source', 'bpmn-task', graph)
    const targetNode = createGraphCell('target', 'bpmn-task', graph)
    graph.getCellById = (id: string) => (id === 'source' ? sourceNode : targetNode)
    graph.options = {
      connecting: {
        createEdge: () => ({ shape: 'bpmn-message-flow', dispose: vi.fn() }),
      },
    }

    strictManager.bind(graph, 'bpmn2')

    expect(() => graph.options.connecting.validateEdge({
      edge: {
        id: 'edge-1',
        model: { graph },
        getSourceCellId: () => 'source',
        getTargetCellId: () => 'target',
      },
    })).not.toThrow()
  })

  it('可关闭自动 validateConnection 接线', () => {
    const graph = createFakeGraph()
    delete graph.options
    const managerWithoutAutoBinding = createDialectManager({
      registry,
      autoBindValidateConnection: false,
    })

    managerWithoutAutoBinding.bind(graph, 'bpmn2')

    expect(graph.options).toBeUndefined()
  })

  it('exportXML 应调用注册的 exporter', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    const exporter: ExporterAdapter = {
      dialect: 'bpmn2',
      exportXML: vi.fn().mockResolvedValue('<xml/>'),
    }
    manager.registerExporter(exporter)
    const xml = await manager.exportXML(graph)
    expect(xml).toBe('<xml/>')
    expect(exporter.exportXML).toHaveBeenCalledOnce()
  })

  it('exportXML 无绑定时应抛出错误', async () => {
    const graph = createFakeGraph()
    await expect(manager.exportXML(graph)).rejects.toThrow('No profile bound')
  })

  it('exportXML 无匹配 exporter 时应抛出错误', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    await expect(manager.exportXML(graph)).rejects.toThrow('No exporter adapter')
  })

  it('exportXML 应沿继承链向上查找 exporter', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'smartengine-custom')
    const exporter: ExporterAdapter = {
      dialect: 'bpmn2',
      exportXML: vi.fn().mockResolvedValue('<bpmn2/>'),
    }
    manager.registerExporter(exporter)
    const xml = await manager.exportXML(graph)
    expect(xml).toBe('<bpmn2/>')
  })

  it('importXML 应调用注册的 importer', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    const importer: ImporterAdapter = {
      dialect: 'bpmn2',
      importXML: vi.fn().mockResolvedValue(undefined),
    }
    manager.registerImporter(importer)
    await manager.importXML(graph, '<bpmn/>')
    expect(importer.importXML).toHaveBeenCalledOnce()
  })

  it('importXML 无匹配 importer 时应抛出错误', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'bpmn2')
    await expect(manager.importXML(graph, '<test/>')).rejects.toThrow('No importer adapter')
  })

  it('importXML 应沿继承链向上查找 importer', async () => {
    const graph = createFakeGraph()
    manager.bind(graph, 'smartengine-custom')
    const importer: ImporterAdapter = {
      dialect: 'bpmn2',
      importXML: vi.fn().mockResolvedValue(undefined),
    }
    manager.registerImporter(importer)
    await manager.importXML(graph, '<bpmn/>', 'smartengine-custom')
    expect(importer.importXML).toHaveBeenCalledOnce()
  })

  it('importXML 显式指定 dialectId 时应使用该方言', async () => {
    const graph = createFakeGraph()
    const importer: ImporterAdapter = {
      dialect: 'smartengine-base',
      importXML: vi.fn().mockResolvedValue(undefined),
    }
    manager.registerImporter(importer)
    await manager.importXML(graph, '<bpmn/>', 'smartengine-base')
    expect(manager.getContext(graph)!.profile.meta.id).toBe('smartengine-base')
    expect(importer.importXML).toHaveBeenCalledOnce()
  })

  it('importXML 自动检测方言', async () => {
    const graph = createFakeGraph()
    const importer: ImporterAdapter = {
      dialect: 'bpmn2',
      importXML: vi.fn().mockResolvedValue(undefined),
    }
    manager.registerImporter(importer)
    await manager.importXML(graph, '<bpmn/>')
    expect(manager.getContext(graph)!.profile.meta.id).toBe('bpmn2')
  })

  it('importXML 应允许使用自定义 detector', async () => {
    const detector = { detect: vi.fn(() => 'smartengine-custom') } as any
    manager = createDialectManager({ registry, detector })

    const importer: ImporterAdapter = {
      dialect: 'bpmn2',
      importXML: vi.fn().mockResolvedValue(undefined),
    }
    manager.registerImporter(importer)

    const graph = createFakeGraph()
    await manager.importXML(graph, '<definitions />')

    expect(detector.detect).toHaveBeenCalledWith('<definitions />')
    expect(manager.getContext(graph)!.profile.meta.id).toBe('smartengine-custom')
    expect(importer.importXML).toHaveBeenCalledOnce()
  })

  it('bind 应在 createEdge 抛错时回退到默认边类型', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: vi.fn(() => {
          throw new Error('boom')
        }),
      },
    }

    manager.bind(graph, 'bpmn2')

    expect(graph.options.connecting.validateConnection({
      sourceCell: createGraphCell('source', 'bpmn-task', graph),
      targetCell: createGraphCell('target', 'bpmn-task', graph),
      targetMagnet: {},
    })).toBe(true)
  })

  it('resolveDefaultEdgeShape 应在无顺序流时回退到第一个启用边', () => {
    const context = {
      profile: {
        definitions: {
          nodes: {},
          edges: {
            message: { shape: 'custom-message-flow', category: 'messageFlow', renderer: 'edge' },
          },
        },
        availability: {
          nodes: {},
          edges: { message: 'enabled' },
        },
      },
    } as any

    expect((manager as any).resolveDefaultEdgeShape(context)).toBe('custom-message-flow')
  })

  it('resolveDefaultEdgeShape 应在无启用边时回退到标准顺序流', () => {
    const context = {
      profile: {
        definitions: { nodes: {}, edges: {} },
        availability: { nodes: {}, edges: {} },
      },
    } as any

    expect((manager as any).resolveDefaultEdgeShape(context)).toBe('bpmn-sequence-flow')
  })

  it('resolveEdgeShape 应优先使用显式 edgeShapeGetter', () => {
    const managerWithGetter = createDialectManager({
      registry,
      edgeShapeGetter: () => 'explicit-flow',
    })

    const context = { profile: { definitions: { edges: {} }, availability: { edges: {} } } } as any
    expect((managerWithGetter as any).resolveEdgeShape(createFakeGraph(), context, {})).toBe('explicit-flow')
  })

  it('resolveEdgeShapeFromConnecting 应支持 getShape 返回值', () => {
    const graph = createFakeGraph()
    graph.options = {
      connecting: {
        createEdge: () => ({ getShape: () => 'edge-from-get-shape', dispose: vi.fn() }),
      },
    }

    expect((manager as any).resolveEdgeShapeFromConnecting(graph, {})).toBe('edge-from-get-shape')
  })

  it('resolveEdgeShapeFromConnecting 应回退到 prop.shape 并过滤空值', () => {
    const graphWithProp = createFakeGraph()
    graphWithProp.options = {
      connecting: {
        createEdge: () => ({ prop: { shape: 'edge-from-prop' }, dispose: vi.fn() }),
      },
    }
    expect((manager as any).resolveEdgeShapeFromConnecting(graphWithProp, {})).toBe('edge-from-prop')

    const graphWithEmptyShape = createFakeGraph()
    graphWithEmptyShape.options = {
      connecting: {
        createEdge: () => ({ shape: '', dispose: vi.fn() }),
      },
    }
    expect((manager as any).resolveEdgeShapeFromConnecting(graphWithEmptyShape, {})).toBeUndefined()
  })

  it('findExporter 继承链解析失败时忽略并返回 undefined', async () => {
    const graph = createFakeGraph()
    registry.register(minimalProfile('orphan') as any)
    manager.bind(graph, 'orphan')
    await expect(manager.exportXML(graph)).rejects.toThrow('No exporter adapter')
  })

  it('findImporter 继承链解析失败时忽略并返回 undefined', async () => {
    const graph = createFakeGraph()
    registry.register(minimalProfile('orphan') as any)
    manager.bind(graph, 'orphan')
    await expect(manager.importXML(graph, '<test/>')).rejects.toThrow('No importer adapter')
  })
})

// ============================================================================
// BPMN2 适配器工厂
// ============================================================================

describe('createBpmn2ExporterAdapter', () => {
  it('应返回 dialect = bpmn2 的适配器', async () => {
    const mod = await import('../../../src/export/adapter')
    const adapter = mod.createBpmn2ExporterAdapter()
    expect(adapter.dialect).toBe('bpmn2')
    expect(typeof adapter.exportXML).toBe('function')
  })

  it('exportXML 应调用底层 exportBpmnXml 并返回 XML', async () => {
    // 注册图形
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const mod = await import('../../../src/export/adapter')
    const adapter = mod.createBpmn2ExporterAdapter()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })
    const xml = await adapter.exportXML(graph, {} as any)
    expect(xml).toContain('bpmn:definitions')
    expect(xml).toContain('bpmn:startEvent')
    graph.dispose()
  })

  it('exportXML 应允许仅通过 options.serialization 提供命名空间和映射', async () => {
    const adapter = createBpmn2ExporterAdapter({
      serialization: {
        namespaces: { custom: 'http://example.com/custom' },
        nodeMapping: { 'approval-node': { tag: 'userTask' } },
      },
    })
    const node = {
      id: 'task1',
      shape: 'approval-node',
      getPosition: () => ({ x: 80, y: 80 }),
      getSize: () => ({ width: 120, height: 60 }),
      getData: () => ({}),
      getAttrs: () => ({}),
      getParent: () => null,
    }
    const graph = {
      getNodes: () => [node],
      getEdges: () => [],
      getCellById: () => node,
    } as any

    const xml = await adapter.exportXML(graph, {} as any)
    expect(xml).toContain('bpmn:userTask')
    expect(xml).toContain('xmlns:custom="http://example.com/custom"')
  })

  it('exportXML 在仅提供 nodeMapping 时应保留原始 XML 头部', async () => {
    const adapter = createBpmn2ExporterAdapter({
      serialization: {
        nodeMapping: { 'approval-node': { tag: 'userTask' } },
      },
    })
    const node = {
      id: 'task1',
      shape: 'approval-node',
      getPosition: () => ({ x: 80, y: 80 }),
      getSize: () => ({ width: 120, height: 60 }),
      getData: () => ({}),
      getAttrs: () => ({}),
      getParent: () => null,
    }
    const graph = {
      getNodes: () => [node],
      getEdges: () => [],
      getCellById: () => node,
    } as any

    const xml = await adapter.exportXML(graph, {} as any)
    expect(xml).toContain('bpmn:userTask')
    expect(xml).not.toContain('xmlns:custom=')
  })

  it('exportXML 应合并 edgeMapping 覆盖而不影响默认导出', async () => {
    const adapter = createBpmn2ExporterAdapter({
      serialization: {
        edgeMapping: { 'custom-message-flow': { tag: 'messageFlow' } },
      },
    })
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })

    const xml = await adapter.exportXML(graph, {} as any)
    expect(xml).toContain('bpmn:startEvent')
    graph.dispose()
  })

  it('exportXML 不应重复注入已存在的命名空间', async () => {
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const adapter = createBpmn2ExporterAdapter({
      serialization: {
        namespaces: { bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL' },
      },
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })

    const xml = await adapter.exportXML(graph, {} as any)
    expect(xml.match(/xmlns:bpmn=/g)).toHaveLength(1)
    graph.dispose()
  })

  it('exportXML 在底层返回非 definitions XML 时应原样返回', async () => {
    vi.resetModules()
    vi.doMock('../../../src/export/exporter', () => ({
      exportBpmnXml: vi.fn().mockResolvedValue('<root />'),
    }))

    const mod = await import('../../../src/export/adapter')
    const adapter = mod.createBpmn2ExporterAdapter({
      serialization: {
        namespaces: { custom: 'http://example.com/custom' },
      },
    })

    await expect(adapter.exportXML({} as any, {} as any)).resolves.toBe('<root />')

    vi.doUnmock('../../../src/export/exporter')
    vi.resetModules()
  })

  it('exportXML 应支持 preExport 和 postExportXml 钩子', async () => {
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const preExport = vi.fn()
    const postExportXml = vi.fn((xml: string) => `${xml}\n<!--hook-->`)
    const adapter = createBpmn2ExporterAdapter({ preExport, postExportXml })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })

    const xml = await adapter.exportXML(graph, {} as any)

    expect(preExport).toHaveBeenCalledOnce()
    expect(postExportXml).toHaveBeenCalledOnce()
    expect(xml).toContain('<!--hook-->')
    graph.dispose()
  })
})

describe('createBpmn2ImporterAdapter', () => {
  it('应返回 dialect = bpmn2 的适配器', async () => {
    const mod = await import('../../../src/import/adapter')
    const adapter = mod.createBpmn2ImporterAdapter()
    expect(adapter.dialect).toBe('bpmn2')
    expect(typeof adapter.importXML).toBe('function')
  })

  it('importXML 应调用底层 importBpmnXml 并还原图形', async () => {
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    try { Graph.registerEdge('bpmn-sequence-flow', { inherit: 'edge' }, true) } catch {}
    const mod = await import('../../../src/import/adapter')
    const adapter = mod.createBpmn2ImporterAdapter()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    const xml = await buildTestXml({
      processes: [{ id: 'Process_1', isExecutable: true, elements: [
        { kind: 'startEvent', id: 'start', name: 'Start' },
      ] }],
      shapes: { start: { id: 'start', x: 100, y: 100, width: 36, height: 36 } },
    })
    await adapter.importXML(graph, xml, {} as any)
    expect(graph.getNodes().length).toBe(1)
    graph.dispose()
  })

  it('importXML 应允许仅通过 options.serialization 提供映射', async () => {
    const adapter = createBpmn2ImporterAdapter({
      serialization: {
        nodeMapping: { 'approval-node': { tag: 'userTask' } },
      },
    })
    const graph = {
      clearCells: () => undefined,
      addNode: (config: any) => ({
        ...config,
        data: undefined,
        getData() { return this.data },
        setData(nextData: Record<string, unknown>) { this.data = nextData },
        getAttrByPath: () => undefined,
        replaceAttrs: () => undefined,
        setAttrByPath: () => undefined,
      }),
      addEdge: () => ({
        getData: () => undefined,
        setData: () => undefined,
        getLabels: () => [],
        setLabels: () => undefined,
      }),
      getNodes: vi.fn(() => []),
      zoomToFit: () => undefined,
    } as any
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [{ kind: 'userTask', id: 'task1', name: 'Approve' }],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 100, width: 120, height: 60 },
      },
    })

    const nodes: any[] = []
    graph.addNode = (config: any) => {
      const node = {
        ...config,
        data: undefined,
        getData() { return this.data },
        setData(nextData: Record<string, unknown>) { this.data = nextData },
        getAttrByPath: () => undefined,
        replaceAttrs: () => undefined,
        setAttrByPath: () => undefined,
      }
      nodes.push(node)
      return node
    }
    graph.getNodes = () => nodes

    await adapter.importXML(graph, xml, {} as any)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].shape).toBe('approval-node')
  })

  it('importXML 在仅提供 edgeMapping 时应保留默认节点映射', async () => {
    const adapter = createBpmn2ImporterAdapter({
      serialization: {
        edgeMapping: { 'custom-message-flow': { tag: 'messageFlow' } },
      },
    })
    const nodes: any[] = []
    const graph = {
      clearCells: () => undefined,
      addNode: (config: any) => {
        const node = {
          ...config,
          data: undefined,
          getData() { return this.data },
          setData(nextData: Record<string, unknown>) { this.data = nextData },
          getAttrByPath: () => undefined,
          replaceAttrs: () => undefined,
          setAttrByPath: () => undefined,
        }
        nodes.push(node)
        return node
      },
      addEdge: () => ({
        getData: () => undefined,
        setData: () => undefined,
        getLabels: () => [],
        setLabels: () => undefined,
      }),
      getNodes: () => nodes,
      zoomToFit: () => undefined,
    } as any
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [{ kind: 'startEvent', id: 'start', name: 'Start' }],
      }],
      shapes: {
        start: { id: 'start', x: 100, y: 100, width: 36, height: 36 },
      },
    })

    await adapter.importXML(graph, xml, {} as any)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].shape).toBe('bpmn-start-event')
  })

  it('importXML 应支持 postImport 钩子承载方言后处理', async () => {
    try { Graph.registerNode('bpmn-user-task', { inherit: 'rect' }, true) } catch {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    graph.addNode({
      shape: 'bpmn-user-task',
      id: 'task1',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      data: {
        extensionProperties: {
          'smart:action': 'approve',
          'smart_retry': '3',
          plain: 'keep',
        },
      },
    })

    const postImport = vi.fn((currentGraph: Graph) => {
      for (const node of currentGraph.getNodes()) {
        const data = node.getData<Record<string, unknown>>()
        const extProps = data?.extensionProperties as Record<string, unknown> | undefined
        if (!extProps) continue

        const promoted: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(extProps)) {
          if (key.startsWith('smart:') || key.startsWith('smart_')) {
            promoted[key.replace(/^smart[:_]/, '')] = value
          }
        }

        if (Object.keys(promoted).length > 0) {
          node.setData({ ...data, ...promoted }, { silent: true })
        }
      }
    })

    const adapter = createBpmn2ImporterAdapter({ clearGraph: false, postImport })
    const xml = await buildTestXml({
      processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
    })

    await adapter.importXML(graph, xml, {} as any)

    const node = graph.getCellById('task1') as Graph.Node
    const data = node.getData<Record<string, unknown>>()
    expect(postImport).toHaveBeenCalledOnce()
    expect(data.action).toBe('approve')
    expect(data.retry).toBe('3')
    expect(data.plain).toBeUndefined()
    graph.dispose()
  })
})

describe('BPMN2 adapters with profile serialization', () => {
  function createExportGraph() {
    const node = {
      id: 'task1',
      shape: 'approval-node',
      getPosition: () => ({ x: 80, y: 80 }),
      getSize: () => ({ width: 120, height: 60 }),
      getData: () => ({}),
      getAttrs: () => ({}),
      getParent: () => null,
    }

    return {
      options: {},
      getNodes: () => [node],
      getEdges: () => [],
      getCellById: (id: string) => (id === node.id ? node : undefined),
      getConnectedEdges: () => [],
    } as any
  }

  function createImportGraph() {
    const nodes: any[] = []
    const edges: any[] = []

    return {
      options: {},
      clearCells: () => {
        nodes.length = 0
        edges.length = 0
      },
      addNode: (config: any) => {
        const node = {
          id: config.id,
          shape: config.shape,
          data: undefined as Record<string, unknown> | undefined,
          getData() {
            return this.data
          },
          setData(nextData: Record<string, unknown>) {
            this.data = nextData
          },
          getAttrByPath: () => undefined,
          replaceAttrs: () => undefined,
          setAttrByPath: () => undefined,
        }
        nodes.push(node)
        return node
      },
      addEdge: (config: any) => {
        const edge = {
          id: config.id,
          shape: config.shape,
          data: undefined as Record<string, unknown> | undefined,
          getData() {
            return this.data
          },
          setData(nextData: Record<string, unknown>) {
            this.data = nextData
          },
          getLabels: () => [],
          setLabels: () => undefined,
        }
        edges.push(edge)
        return edge
      },
      getNodes: () => nodes,
      getEdges: () => edges,
      zoomToFit: () => undefined,
      getConnectedEdges: () => [],
    } as any
  }

  function customSerializationProfile(): Profile {
    return {
      meta: { id: 'custom-dialect', name: 'custom', parent: 'bpmn2' },
      definitions: {
        nodes: {
          approval: { shape: 'approval-node', category: 'task', renderer: 'approval' },
        },
        edges: {},
      },
      availability: {
        nodes: { approval: 'enabled' },
        edges: {},
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: {
          approval: () => ({ inherit: 'rect', width: 120, height: 60 }),
        },
        edgeRenderers: {},
      },
      rules: {
        nodeCategories: { 'approval-node': 'task' },
        connectionRules: {},
        constraints: [],
      },
      dataModel: { fields: {}, categoryFields: {} },
      serialization: {
        namespaces: { custom: 'http://example.com/custom' },
        nodeMapping: { 'approval-node': { tag: 'userTask' } },
        edgeMapping: {},
      },
    }
  }

  it('exportXML 应使用 profile.serialization.nodeMapping 和 namespaces', async () => {
    const runtimeRegistry = new ProfileRegistry()
    runtimeRegistry.register(minimalProfile('bpmn2') as any)
    runtimeRegistry.register(customSerializationProfile())

    const runtimeManager = createDialectManager({ registry: runtimeRegistry })
    runtimeManager.registerExporter(createBpmn2ExporterAdapter())

    const graph = createExportGraph()
    runtimeManager.bind(graph, 'custom-dialect')

    const xml = await runtimeManager.exportXML(graph)
    expect(xml).toContain('bpmn:userTask')
    expect(xml).toContain('xmlns:custom="http://example.com/custom"')
  })

  it('importXML 应使用 profile.serialization.nodeMapping 恢复自定义 shape', async () => {
    const runtimeRegistry = new ProfileRegistry()
    runtimeRegistry.register(minimalProfile('bpmn2') as any)
    runtimeRegistry.register(customSerializationProfile())

    const runtimeManager = createDialectManager({ registry: runtimeRegistry })
    runtimeManager.registerImporter(createBpmn2ImporterAdapter())

    const graph = createImportGraph()
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [{ kind: 'userTask', id: 'task1', name: 'Approve' }],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 100, width: 120, height: 60 },
      },
    })

    await runtimeManager.importXML(graph, xml, 'custom-dialect')

    expect(graph.getNodes()).toHaveLength(1)
    expect(graph.getNodes()[0].shape).toBe('approval-node')
  })

  it('exportXML 应沿继承链使用 smartengine-base profile 的命名空间', async () => {
    const runtimeRegistry = new ProfileRegistry()
    runtimeRegistry.register(bpmn2Profile)
    runtimeRegistry.register(smartengineBaseProfile)

    const runtimeManager = createDialectManager({ registry: runtimeRegistry })
    runtimeManager.registerExporter(createBpmn2ExporterAdapter())

    const graph = {
      options: {},
      getNodes: () => [{
        id: 'start',
        shape: 'bpmn-start-event',
        getPosition: () => ({ x: 80, y: 80 }),
        getSize: () => ({ width: 36, height: 36 }),
        getData: () => ({}),
        getAttrs: () => ({}),
        getParent: () => null,
      }],
      getEdges: () => [],
      getCellById: () => undefined,
      getConnectedEdges: () => [],
    } as any

    runtimeManager.bind(graph, 'smartengine-base')
    const xml = await runtimeManager.exportXML(graph)

    expect(xml).toContain('xmlns:smart="http://smartengine.alibaba.com/schema"')
  })
})

describe('importBpmnXml', () => {
  it('应在提供 serialization 选项时继续走标准 load 流程', async () => {
    try { Graph.registerNode('approval-node', { inherit: 'rect' }, true) } catch {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [{ kind: 'userTask', id: 'task1', name: 'Approve' }],
      }],
      shapes: {
        task1: { id: 'task1', x: 100, y: 100, width: 120, height: 60 },
      },
    })

    await importBpmnXml(graph, xml, {
      zoomToFit: false,
      serialization: {
        nodeMapping: { 'approval-node': { tag: 'userTask' } },
      },
    })

    expect(graph.getNodes()).toHaveLength(1)
    expect(graph.getNodes()[0].shape).toBe('approval-node')
    graph.dispose()
  })

  it('未传 options 时应继续按默认映射导入', async () => {
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const container = document.createElement('div')
    document.body.appendChild(container)
    const graph = new Graph({ container, width: 800, height: 600 })
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        isExecutable: true,
        elements: [{ kind: 'startEvent', id: 'start', name: 'Start' }],
      }],
      shapes: {
        start: { id: 'start', x: 100, y: 100, width: 36, height: 36 },
      },
    })

    await importBpmnXml(graph, xml)

    expect(graph.getNodes()).toHaveLength(1)
    expect(graph.getNodes()[0].shape).toBe('bpmn-start-event')
    graph.dispose()
  })
})
