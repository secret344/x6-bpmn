import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Graph } from '@antv/x6'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import { bindProfileToGraph, createProfileContext } from '../../../src/core/dialect/context'
import { bpmn2Profile } from '../../../src/builtin/bpmn2/profile'
import { smartengineBaseProfile } from '../../../src/builtin/smartengine-base/profile'
import { validateDiagram } from '../../../src/core/validation'
import * as poolContainment from '../../../src/behaviors/pool-containment'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'

const TEST_SHAPES = [
  'bpmn-start-event',
  'bpmn-end-event',
  'bpmn-task',
  'bpmn-user-task',
  'bpmn-service-task',
  'bpmn-transaction',
  'bpmn-boundary-event-timer',
  'bpmn-boundary-event-cancel',
  'bpmn-pool',
  'bpmn-lane',
]

const createdGraphs: Graph[] = []

function createTestGraph(profileId?: 'bpmn2' | 'smartengine-base'): Graph {
  registerBehaviorTestShapes(TEST_SHAPES)

  const graph = createBehaviorTestGraph()
  createdGraphs.push(graph)

  if (profileId) {
    const registry = new ProfileRegistry()
    registry.register(bpmn2Profile)
    registry.register(smartengineBaseProfile)
    const context = createProfileContext(registry.compile(profileId))
    bindProfileToGraph(graph, context)
  }

  return graph
}

afterEach(() => {
  vi.restoreAllMocks()

  while (createdGraphs.length > 0) {
    const graph = createdGraphs.pop()
    if (graph) {
      destroyBehaviorTestGraph(graph)
    }
  }
})

describe('validateDiagram', () => {
  it('未绑定 profile 时应回退到 bpmn2 约束', async () => {
    const graph = createTestGraph()

    graph.addNode({
      id: 'task-1',
      shape: 'bpmn-task',
      x: 120,
      y: 100,
      width: 120,
      height: 60,
      data: { bpmn: { name: '普通任务' } },
    })

    const report = await validateDiagram(graph)

    expect(report.profileId).toBe('bpmn2')
    expect(report.nodeCount).toBe(1)
    expect(report.edgeCount).toBe(0)
    expect(report.issues.filter((issue) => issue.category === 'graph-constraint')).toEqual([
      expect.objectContaining({ detail: '规则 ID: require-start-event' }),
      expect.objectContaining({ detail: '规则 ID: require-end-event' }),
    ])
  })

  it('绑定 smartengine-base 时应同时校验 Smart 约束和字段', async () => {
    const graph = createTestGraph('smartengine-base')

    graph.addNode({
      id: 'start-1',
      shape: 'bpmn-start-event',
      x: 40,
      y: 40,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始一' } },
    })
    graph.addNode({
      id: 'start-2',
      shape: 'bpmn-start-event',
      x: 40,
      y: 140,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始二' } },
    })
    graph.addNode({
      id: 'end-1',
      shape: 'bpmn-end-event',
      x: 320,
      y: 80,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })
    graph.addNode({
      id: 'service-1',
      shape: 'bpmn-service-task',
      x: 150,
      y: 70,
      width: 120,
      height: 60,
      data: {
        bpmn: {
          name: '服务任务',
          smartProperties: '[{"value":"broken"}]',
        },
      },
    })

    const report = await validateDiagram(graph)

    expect(report.profileId).toBe('smartengine-base')
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'graph-constraint',
        detail: '规则 ID: start-event-limit',
      }),
      expect.objectContaining({
        category: 'field',
        cellId: 'service-1',
      }),
    ]))
    expect(report.issues.some((issue) => issue.message.includes('smartProperties'))).toBe(true)
  })

  it('应报告缺失端点和非法 BPMN 连线', async () => {
    const graph = createTestGraph()
    const start = graph.addNode({
      id: 'start-1',
      shape: 'bpmn-start-event',
      x: 40,
      y: 40,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    const end = graph.addNode({
      id: 'end-1',
      shape: 'bpmn-end-event',
      x: 40,
      y: 180,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: 'bpmn-task',
      x: 220,
      y: 180,
      width: 120,
      height: 60,
      data: { bpmn: { name: '处理任务' } },
    })
    const task2 = graph.addNode({
      id: 'task-2',
      shape: 'bpmn-task',
      x: 220,
      y: 40,
      width: 120,
      height: 60,
      data: { bpmn: { name: '并行任务' } },
    })

    graph.addEdge({
      id: 'edge-missing-target',
      shape: 'bpmn-sequence-flow',
      source: { cell: start.id },
      target: { x: 460, y: 60 },
    })
    graph.addEdge({
      id: 'edge-valid-secondary',
      shape: 'bpmn-sequence-flow',
      source: { cell: start.id },
      target: { cell: task2.id },
      data: { bpmn: { name: '第二条连线' } },
    })
    graph.addEdge({
      id: 'edge-invalid-rule',
      shape: 'bpmn-sequence-flow',
      source: { cell: end.id },
      target: { cell: task.id },
      data: { bpmn: { name: '非法流转' } },
    })

    const report = await validateDiagram(graph)
    const edgeIssues = report.issues.filter((issue) => issue.category === 'edge-rule')
    const missingTerminalIssue = edgeIssues.find((issue) => issue.cellId === 'edge-missing-target')
    const invalidRuleIssue = edgeIssues.find((issue) => issue.cellId === 'edge-invalid-rule')

    expect(edgeIssues).toHaveLength(2)
    expect(missingTerminalIssue).toEqual(expect.objectContaining({
      cellId: 'edge-missing-target',
      message: '连线缺少有效的源节点或目标节点',
    }))
    expect(invalidRuleIssue).toEqual(expect.objectContaining({
      cellId: 'edge-invalid-rule',
      message: 'endEvent 类型的节点不允许使用 bpmn-sequence-flow 类型的出线',
    }))
  })

  it('应报告泳池外节点和非法边界宿主', async () => {
    const graph = createTestGraph()

    graph.addNode({
      id: 'pool-1',
      shape: 'bpmn-pool',
      x: 40,
      y: 40,
      width: 320,
      height: 180,
      data: { bpmn: { name: '参与者' } },
    })
    const userTask = graph.addNode({
      id: 'user-task-1',
      shape: 'bpmn-user-task',
      x: 420,
      y: 70,
      width: 140,
      height: 70,
      data: { bpmn: { name: '人工任务' } },
    })
    const cancelBoundary = graph.addNode({
      id: 'boundary-cancel-1',
      shape: 'bpmn-boundary-event-cancel',
      x: 520,
      y: 50,
      width: 36,
      height: 36,
      data: { bpmn: { name: '取消边界' } },
    })

    userTask.embed(cancelBoundary)

    const report = await validateDiagram(graph)

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'containment',
        cellId: 'user-task-1',
      }),
      expect.objectContaining({
        category: 'boundary',
        cellId: 'boundary-cancel-1',
        message: '边界事件附着到了不合法的宿主节点',
      }),
    ]))
  })

  it('应处理未附着边界、父链泳池查找和数据读取兜底', async () => {
    const graph = createTestGraph()

    const pool = graph.addNode({
      id: 'pool-1',
      shape: 'bpmn-pool',
      x: 20,
      y: 20,
      width: 520,
      height: 240,
      data: { bpmn: { name: '参与者' } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: 'bpmn-lane',
      x: 40,
      y: 40,
      width: 480,
      height: 200,
      data: { bpmn: { name: '泳道' } },
    })
    const start = graph.addNode({
      id: 'start-1',
      shape: 'bpmn-start-event',
      x: 80,
      y: 100,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: 'bpmn-task',
      x: 180,
      y: 90,
      width: 120,
      height: 60,
      data: { bpmn: { name: '任务一' } },
    })
    const task2 = graph.addNode({
      id: 'task-2',
      shape: 'bpmn-task',
      x: 340,
      y: 90,
      width: 120,
      height: 60,
      data: { bpmn: { name: '任务二' } },
    })
    const end = graph.addNode({
      id: 'end-1',
      shape: 'bpmn-end-event',
      x: 420,
      y: 160,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })
    const boundary = graph.addNode({
      id: 'boundary-timer-1',
      shape: 'bpmn-boundary-event-timer',
      x: 560,
      y: 60,
      width: 36,
      height: 36,
      data: { bpmn: { name: '未附着边界' } },
    })

    pool.embed(lane)
    lane.embed(start)
    lane.embed(task)
    lane.embed(task2)
    lane.embed(end)

    start.getData = () => {
      throw new Error('模拟读取异常')
    }

    graph.addEdge({
      id: 'edge-1',
      shape: 'bpmn-sequence-flow',
      source: { cell: start.id },
      target: { cell: task.id },
      data: { bpmn: { name: '开始到任务一' } },
    })
    graph.addEdge({
      id: 'edge-2',
      shape: 'bpmn-sequence-flow',
      source: { cell: task.id },
      target: { cell: end.id },
      data: { bpmn: { name: '任务一到结束' } },
    })
    graph.addEdge({
      id: 'edge-3',
      shape: 'bpmn-sequence-flow',
      source: { cell: task.id },
      target: { cell: task2.id },
      data: { bpmn: { name: '任务一到任务二' } },
    })

    const report = await validateDiagram(graph, {
      exportXml: async () => '<definitions />',
    })

    expect(report.xmlExported).toBe(true)
    expect(report.issues).toContainEqual(expect.objectContaining({
      category: 'boundary',
      cellId: boundary.id,
      message: '边界事件没有附着到宿主活动',
    }))
    expect(report.issues.some((issue) => issue.category === 'edge-rule')).toBe(false)
  })

  it('应接受合法边界附着并报告导出异常', async () => {
    const graph = createTestGraph()

    graph.addNode({
      id: 'start-1',
      shape: 'bpmn-start-event',
      x: 40,
      y: 100,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    graph.addNode({
      id: 'end-1',
      shape: 'bpmn-end-event',
      x: 360,
      y: 100,
      width: 40,
      height: 40,
      data: { bpmn: { name: '结束' } },
    })
    const transaction = graph.addNode({
      id: 'transaction-1',
      shape: 'bpmn-transaction',
      x: 150,
      y: 80,
      width: 140,
      height: 80,
      data: { bpmn: { name: '事务子流程' } },
    })
    const cancelBoundary = graph.addNode({
      id: 'boundary-cancel-1',
      shape: 'bpmn-boundary-event-cancel',
      x: 260,
      y: 70,
      width: 36,
      height: 36,
      data: { bpmn: { name: '取消边界' } },
    })
    const timerBoundary = graph.addNode({
      id: 'boundary-timer-1',
      shape: 'bpmn-boundary-event-timer',
      x: 210,
      y: 70,
      width: 36,
      height: 36,
      data: { bpmn: { name: '定时边界' } },
    })

    transaction.embed(cancelBoundary)
    transaction.embed(timerBoundary)

    const report = await validateDiagram(graph, {
      exportXml: async () => {
        throw new Error('模拟导出异常')
      },
    })

    expect(report.xmlExported).toBe(false)
    expect(report.issues).toContainEqual(expect.objectContaining({
      category: 'export',
      detail: '模拟导出异常',
    }))
    expect(report.issues.some((issue) => issue.category === 'boundary')).toBe(false)
  })

  it('应在缺少原因时回退到默认提示，并处理指向不存在 cell 的端点', async () => {
    const graph = createTestGraph()

    bindProfileToGraph(graph, {
      profile: {
        meta: { id: 'custom-validation', name: 'custom-validation' },
        definitions: { nodes: {}, edges: {} },
        availability: { nodes: {}, edges: {} },
        rendering: {
          theme: { colors: {}, icons: {} },
          nodeRenderers: {},
          edgeRenderers: {},
        },
        rules: {
          nodeCategories: {
            'bpmn-start-event': 'startEvent',
            'bpmn-task': 'task',
          },
          connectionRules: {
            startEvent: {
              allowedOutgoing: ['bpmn-sequence-flow'],
              constraints: [{ require: { allowedTargetShapes: ['bpmn-end-event'] } }],
            },
            task: {
              allowedIncoming: ['bpmn-sequence-flow'],
            },
          },
          constraints: [],
        },
        dataModel: { fields: {}, categoryFields: {} },
        serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
      },
    } as any)

    const start = graph.addNode({
      id: 'start-1',
      shape: 'bpmn-start-event',
      x: 40,
      y: 40,
      width: 40,
      height: 40,
      data: { bpmn: { name: '开始' } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: 'bpmn-task',
      x: 180,
      y: 40,
      width: 120,
      height: 60,
      data: { bpmn: { name: '任务' } },
    })

    graph.addEdge({
      id: 'edge-fallback-reason',
      shape: 'bpmn-sequence-flow',
      source: { cell: start.id },
      target: { cell: task.id },
    })
    graph.addEdge({
      id: 'edge-missing-cell',
      shape: 'bpmn-sequence-flow',
      source: { cell: start.id },
      target: { cell: 'missing-node' },
    })

    const report = await validateDiagram(graph, {
      exportXml: async () => '<definitions />',
    })

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'edge-rule',
        cellId: 'edge-fallback-reason',
        message: '连线不符合规则要求',
      }),
      expect.objectContaining({
        category: 'edge-rule',
        cellId: 'edge-missing-cell',
        message: '连线缺少有效的源节点或目标节点',
      }),
    ]))
  })

  it('应在容器原因缺失时使用默认文案，并将非 Error 导出异常转成字符串', async () => {
    const graph = createTestGraph()

    graph.addNode({
      id: 'task-1',
      shape: 'bpmn-task',
      x: 80,
      y: 80,
      width: 120,
      height: 60,
      data: { bpmn: { name: '普通任务' } },
    })

    vi.spyOn(poolContainment, 'validatePoolContainment').mockReturnValue({ valid: false })

    const report = await validateDiagram(graph, {
      exportXml: async () => {
        throw '字符串异常'
      },
    })

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'containment',
        message: '流程节点未处于合法容器内',
      }),
      expect.objectContaining({
        category: 'export',
        detail: '字符串异常',
      }),
    ]))
  })
})