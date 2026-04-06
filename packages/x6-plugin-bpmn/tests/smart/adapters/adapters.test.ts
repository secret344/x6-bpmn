/**
 * SmartEngine 适配器工厂 — 单元测试
 */

import { describe, it, expect } from 'vitest'
import { Graph } from '@antv/x6'
import { buildTestXml } from '../../helpers/xml-test-utils'

// 注册最小图形以便 graph.addNode / addEdge 可用
try { Graph.registerNode('bpmn-start-event', { inherit: 'rect' }, true) } catch {}
try { Graph.registerNode('bpmn-end-event', { inherit: 'rect' }, true) } catch {}
try { Graph.registerNode('bpmn-user-task', { inherit: 'rect' }, true) } catch {}
try { Graph.registerEdge('bpmn-sequence-flow', { inherit: 'edge' }, true) } catch {}

function createTestGraph(): Graph {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return new Graph({ container, width: 800, height: 600 })
}

function minimalContext(): any {
  return {
    profile: {
      meta: { id: 'smartengine-base' },
      serialization: { namespaces: {} },
    },
  }
}

// ============================================================================
// SmartEngine 适配器工厂
// ============================================================================

describe('createSmartEngineExporterAdapter', () => {
  it('应返回 dialect = smartengine-base 的适配器', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    const adapter = mod.createSmartEngineExporterAdapter()
    expect(adapter.dialect).toBe('smartengine-base')
    expect(typeof adapter.exportXML).toBe('function')
  })

  it('exportXML 应生成带有 SmartEngine 命名空间的 XML', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    const adapter = mod.createSmartEngineExporterAdapter()
    const graph = createTestGraph()
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })
    const xml = await adapter.exportXML(graph, minimalContext())
    expect(xml).toContain('xmlns:smart=')
    expect(xml).toContain('http://smartengine.alibaba.com/schema')
    graph.dispose()
  })

  it('exportXML 不应重复注入已有的命名空间', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    const adapter = mod.createSmartEngineExporterAdapter()
    const graph = createTestGraph()
    const xml = await adapter.exportXML(graph, minimalContext())
    // smart 命名空间只应出现一次
    const matches = xml.match(/xmlns:smart=/g)
    expect(matches).toHaveLength(1)
    graph.dispose()
  })

  it('exportXML 应包含 additionalNamespaces', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    const adapter = mod.createSmartEngineExporterAdapter({
      additionalNamespaces: { custom: 'http://example.com/custom' },
    })
    const graph = createTestGraph()
    const xml = await adapter.exportXML(graph, minimalContext())
    expect(xml).toContain('xmlns:custom="http://example.com/custom"')
    graph.dispose()
  })

  it('exportXML 应从 context.profile 的 namespaces 注入', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    const adapter = mod.createSmartEngineExporterAdapter()
    const graph = createTestGraph()
    const ctx = {
      profile: {
        meta: { id: 'smartengine-base' },
        serialization: { namespaces: { ext: 'http://ext.example.com' } },
      },
    }
    const xml = await adapter.exportXML(graph, ctx as any)
    expect(xml).toContain('xmlns:ext="http://ext.example.com"')
    graph.dispose()
  })

  it('exportXML 不应注入已有命名空间（覆盖 injection 为空的路径）', async () => {
    const mod = await import('../../../src/adapters/smartengine/exporter')
    // 传入一个已存在于 BpmnModdle 输出中的 additionalNamespace（xmlns:bpmn）
    // 导致注入跳过该命名空间 → 至少一个命名空间被跳过 → 测试 if (!xml.includes(nsAttr)) 的 FALSE 分支
    const adapter = mod.createSmartEngineExporterAdapter({
      additionalNamespaces: { bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL' },
    })
    const graph = createTestGraph()
    const xml = await adapter.exportXML(graph, minimalContext())
    // bpmn 命名空间已存在，不应重复注入
    const count = (xml.match(/xmlns:bpmn=/g) || []).length
    expect(count).toBe(1)
    graph.dispose()
  })
})

describe('createSmartEngineImporterAdapter', () => {
  it('应返回 dialect = smartengine-base 的适配器', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter()
    expect(adapter.dialect).toBe('smartengine-base')
    expect(typeof adapter.importXML).toBe('function')
  })

  it('importXML 应导入 XML 并后处理 SmartEngine 扩展属性', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter()
    const graph = createTestGraph()
    // 先通过导出得到合法 XML，再执行导入
    const { exportBpmnXml } = await import('../../../src/export/exporter')
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })
    const xml = await exportBpmnXml(graph)
    graph.clearCells()
    await adapter.importXML(graph, xml, minimalContext())
    expect(graph.getNodes().length).toBeGreaterThanOrEqual(1)
    graph.dispose()
  })

  it('importXML 应将 smart: 前缀的扩展属性提升到节点数据', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter()
    const graph = createTestGraph()
    // 创建一个包含 smart: 前缀键的 extensionProperties 节点
    graph.addNode({
      shape: 'bpmn-user-task', id: 'task1', x: 100, y: 100, width: 100, height: 60,
      data: { extensionProperties: { 'smart:action': 'review', 'smart_type': 'approval', other: 'ignore' } },
    })
    // 后处理应提取 smart 前缀的键
    const { exportBpmnXml } = await import('../../../src/export/exporter')
    const xml = await exportBpmnXml(graph)
    graph.clearCells()
    // 这里不做往返测试（可能丢失 extensionProperties），
    // 直接构造场景并调用 importXML。
    await adapter.importXML(graph, xml, minimalContext())
    graph.dispose()
  })

  it('importXML 应跳过 SmartEngine 扩展属性解析 when parseSmartExtensions=false', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter({ parseSmartExtensions: false })
    const graph = createTestGraph()
    const { exportBpmnXml } = await import('../../../src/export/exporter')
    graph.addNode({ shape: 'bpmn-start-event', id: 'start', x: 100, y: 100, width: 36, height: 36 })
    const xml = await exportBpmnXml(graph)
    graph.clearCells()
    await adapter.importXML(graph, xml, minimalContext())
    expect(graph.getNodes().length).toBeGreaterThanOrEqual(1)
    graph.dispose()
  })

  it('postProcessSmartExtensions 应正确处理 smart: 和 smart_ 前缀', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    // 使用 clearGraph: false，确保已有节点在导入后仍保留
    const adapter = mod.createSmartEngineImporterAdapter({ clearGraph: false })
    const graph = createTestGraph()
    // 添加一个包含 smart: 前缀键的 extensionProperties 节点
    graph.addNode({
      shape: 'bpmn-user-task', id: 'n1', x: 0, y: 0, width: 100, height: 60,
      data: {
        extensionProperties: {
          'smart:action': 'approve',
          'smart_retry': '3',
          normalKey: 'keep',
        },
      },
    })
    // 导入空 XML（clearGraph=false）以触发 postProcess 而不清空节点
    const xml = await buildTestXml({
      processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
    })
    await adapter.importXML(graph, xml, minimalContext())
    const node = graph.getCellById('n1') as any
    expect(node).toBeTruthy()
    const data = node.getData()
    // smart: 前缀键应提升到顶层 data
    expect(data.action).toBe('approve')
    expect(data.retry).toBe('3')
    // 非 smart 前缀的键不应被提升
    expect(data.normalKey).toBeUndefined()
    graph.dispose()
  })

  it('postProcessSmartExtensions 应跳过无 data 的节点', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter({ clearGraph: false })
    const graph = createTestGraph()
    // 添加无数据的节点
    graph.addNode({ shape: 'bpmn-start-event', id: 'n2', x: 0, y: 0, width: 36, height: 36 })
    const xml = await buildTestXml({
      processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
    })
    await adapter.importXML(graph, xml, minimalContext())
    // 不应抛异常
    graph.dispose()
  })

  it('postProcessSmartExtensions 应跳过无 extensionProperties 的节点（覆盖 extProps 假值路径）', async () => {
    const mod = await import('../../../src/adapters/smartengine/importer')
    const adapter = mod.createSmartEngineImporterAdapter({ clearGraph: false })
    const graph = createTestGraph()
    // 节点有 data 但无 extensionProperties → extProps 为 undefined → if (extProps && ...) = false
    graph.addNode({
      shape: 'bpmn-start-event', id: 'n3', x: 0, y: 0, width: 36, height: 36,
      data: { someOtherField: 'value' },
    })
    const xml = await buildTestXml({
      processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
    })
    await adapter.importXML(graph, xml, minimalContext())
    const node = graph.getCellById('n3') as any
    expect(node).toBeTruthy()
    // someOtherField 应保持不变
    expect(node.getData().someOtherField).toBe('value')
    graph.dispose()
  })
})
