import { describe, expect, it, vi } from 'vitest'
import { loadBpmnGraph } from '../../../src/import'
import { BPMN_START_EVENT } from '../../../src/utils/constants'

describe('loadBpmnGraph 清空策略', () => {
  const importData = {
    nodes: [
      {
        id: 'Start_1',
        shape: BPMN_START_EVENT,
        x: 100,
        y: 100,
        width: 36,
        height: 36,
        attrs: { label: { text: '开始' } },
      },
    ],
    edges: [],
  }

  function createNode(config: Record<string, unknown>) {
    return {
      ...config,
      id: config.id as string,
      shape: config.shape as string,
      getData: () => undefined,
      setData: () => undefined,
      getAttrByPath: () => undefined,
      replaceAttrs: () => undefined,
      setAttrByPath: () => undefined,
      isNode: () => true,
      getParent: () => null,
    }
  }

  it('支持 resetCells 的图实例导入时应优先重置模型，避免残留视图', () => {
    const resetCells = vi.fn()
    const clearCells = vi.fn()
    const graph = {
      resetCells,
      clearCells,
      addNode: vi.fn((config: Record<string, unknown>) => createNode(config)),
      addEdge: vi.fn(),
      getCellById: vi.fn(() => null),
    } as any

    loadBpmnGraph(graph, importData as any, { zoomToFit: false })

    expect(resetCells).toHaveBeenCalledWith([])
    expect(clearCells).not.toHaveBeenCalled()
    expect(graph.addNode).toHaveBeenCalledOnce()
  })

  it('缺少 resetCells 的旧图实例导入时应回退 clearCells，保持兼容', () => {
    const clearCells = vi.fn()
    const graph = {
      clearCells,
      addNode: vi.fn((config: Record<string, unknown>) => createNode(config)),
      addEdge: vi.fn(),
      getCellById: vi.fn(() => null),
    } as any

    loadBpmnGraph(graph, importData as any, { zoomToFit: false })

    expect(clearCells).toHaveBeenCalledOnce()
    expect(graph.addNode).toHaveBeenCalledOnce()
  })

  it('父子嵌套链缺失时应跳过 embed 重建，并继续完成节点加载', () => {
    const graph = {
      resetCells: vi.fn(),
      addNode: vi.fn((config: Record<string, unknown>) => createNode(config)),
      addEdge: vi.fn(),
      getCellById: vi.fn(() => null),
    } as any

    loadBpmnGraph(graph, {
      nodes: [
        {
          id: 'Task_1',
          shape: BPMN_START_EVENT,
          x: 120,
          y: 100,
          width: 36,
          height: 36,
          attrs: { label: { text: '开始' } },
          parent: 'Missing_Parent',
        },
      ],
      edges: [],
    } as any, { zoomToFit: false })

    expect(graph.resetCells).toHaveBeenCalledWith([])
    expect(graph.addNode).toHaveBeenCalledOnce()
    expect(graph.getCellById).toHaveBeenCalledWith('Missing_Parent')
  })
})