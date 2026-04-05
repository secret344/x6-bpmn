/**
 * DialectManager & BPMN2 适配器 — 单元测试
 *
 * 覆盖 DialectManager.bind / unbind / exportXML / importXML、
 * 适配器继承链 fallback、BPMN2 适配器工厂。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { buildTestXml } from '../../helpers/xml-test-utils'
import { DialectManager, createDialectManager } from '../../../src/adapters/x6/bind'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import type { ExporterAdapter, ImporterAdapter, ProfileContext, ResolvedProfile } from '../../../src/core/dialect/types'

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

function createFakeGraph() {
  return {
    getNodes: () => [],
    getEdges: () => [],
  } as any
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
    const mod = await import('../../../src/adapters/bpmn2/exporter')
    const adapter = mod.createBpmn2ExporterAdapter()
    expect(adapter.dialect).toBe('bpmn2')
    expect(typeof adapter.exportXML).toBe('function')
  })

  it('exportXML 应调用底层 exportBpmnXml 并返回 XML', async () => {
    // 注册图形
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    const mod = await import('../../../src/adapters/bpmn2/exporter')
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
})

describe('createBpmn2ImporterAdapter', () => {
  it('应返回 dialect = bpmn2 的适配器', async () => {
    const mod = await import('../../../src/adapters/bpmn2/importer')
    const adapter = mod.createBpmn2ImporterAdapter()
    expect(adapter.dialect).toBe('bpmn2')
    expect(typeof adapter.importXML).toBe('function')
  })

  it('importXML 应调用底层 importBpmnXml 并还原图形', async () => {
    try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
    try { Graph.registerEdge('bpmn-sequence-flow', { inherit: 'edge' }, true) } catch {}
    const mod = await import('../../../src/adapters/bpmn2/importer')
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
})
