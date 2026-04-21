/**
 * useSmartEngine — SmartEngine 方言管理 Composable
 *
 * 演示 SmartEngine 三种模式：
 *   - smartengine-base   — 完整 BPMN 2.0 + SmartEngine 扩展
 *   - smartengine-custom  — 服务编排模式
 *   - smartengine-database — 审批工单模式
 *
 * 演示的 API：
 *   - DialectManager — bind/unbind/exportXML/importXML
 *   - SmartEngine Adapters — 命名空间注入与提取
 *   - DialectDetector — 自动检测 XML 方言
 *   - Constraint validation
 *   - Data model field capabilities
 */

import { ref, shallowRef, computed } from 'vue'
import type { Graph, Node } from '@antv/x6'
import {
  createProfileRegistry,
  createDialectManager,
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineCustomProfile,
  smartengineDatabaseProfile,
  createBpmn2ExporterAdapter,
  createBpmn2ImporterAdapter,
  createDialectDetector,
  validateConstraints,
  getFieldsForCategory,
  getFieldsForShape,
  buildDefaultData,
  validateFields,
  normalizeFieldValue,
  buildBpmnNodeDefaults,
  getCellLabel,
  getNodeCategory,
  type BpmnImportData,
  type ProfileContext,
  type ResolvedProfile,
  type ConstraintValidateContext,
  type FieldValidateContext,
  BPMN_START_EVENT,
  BPMN_END_EVENT,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SEQUENCE_FLOW,
} from '@x6-bpmn2/plugin'

// ============================================================================
// SmartEngine 模式定义
// ============================================================================

const MODES = {
  'smartengine-base': {
    id: 'smartengine-base',
    name: 'SmartEngine 基础',
    desc: '完整 BPMN 2.0 + SmartEngine 扩展字段',
    color: '#165dff',
  },
  'smartengine-custom': {
    id: 'smartengine-custom',
    name: '服务编排模式',
    desc: '强化 ServiceTask/ReceiveTask，禁用人工任务',
    color: '#ff7d00',
  },
  'smartengine-database': {
    id: 'smartengine-database',
    name: '审批工单模式',
    desc: '多实例、审批策略、UserTask 增强',
    color: '#00b42a',
  },
} as const

type ModeId = keyof typeof MODES

function createLabeledNode(graph: Graph, config: {
  shape: string
  x: number
  y: number
  width?: number
  height?: number
  parent?: string
  label: string
  data?: Record<string, unknown>
}) {
  const { label, data, ...rest } = config
  const defaults = buildBpmnNodeDefaults(config.shape, {
    label,
    width: config.width,
    height: config.height,
    data,
  })
  const { label: _legacyLabel, ...nodeData } = (defaults.data || {}) as Record<string, unknown>

  return graph.addNode({
    ...rest,
    width: defaults.width,
    height: defaults.height,
    ...(defaults.attrs ? { attrs: defaults.attrs } : {}),
    ...(Object.keys(nodeData).length > 0 ? { data: nodeData } : {}),
  })
}

function createLabeledEdge(graph: Graph, config: {
  shape: string
  source: Node | string
  target: Node | string
  label?: string
  data?: Record<string, unknown>
}) {
  const { label, data, ...rest } = config
  return graph.addEdge({
    ...rest,
    ...(label ? { labels: [{ attrs: { label: { text: label } } }] } : {}),
    ...(data ? { data } : {}),
  })
}

function createTransactionActivity(graph: Graph, config: {
  x: number
  y: number
  label: string
  taskShape: string
  taskLabel: string
  taskData?: Record<string, unknown>
}) {
  const transaction = createLabeledNode(graph, {
    shape: BPMN_TRANSACTION,
    x: config.x,
    y: config.y,
    width: 220,
    height: 110,
    label: config.label,
  })
  const start = createLabeledNode(graph, {
    shape: BPMN_START_EVENT,
    x: config.x + 24,
    y: config.y + 37,
    parent: transaction.id,
    label: '开始',
  })
  const task = createLabeledNode(graph, {
    shape: config.taskShape,
    x: config.x + 78,
    y: config.y + 25,
    width: 100,
    height: 60,
    parent: transaction.id,
    label: config.taskLabel,
    data: config.taskData,
  })
  const end = createLabeledNode(graph, {
    shape: BPMN_END_EVENT,
    x: config.x + 166,
    y: config.y + 37,
    parent: transaction.id,
    label: '完成',
  })

  transaction.embed(start)
  transaction.embed(task)
  transaction.embed(end)
  createLabeledEdge(graph, { shape: BPMN_SEQUENCE_FLOW, source: start, target: task })
  createLabeledEdge(graph, { shape: BPMN_SEQUENCE_FLOW, source: task, target: end })

  return { transaction, start, task, end }
}

export function useSmartEngine() {
  // ---------- 核心对象 ----------

  const registry = createProfileRegistry()
  registry.registerAll([
    bpmn2Profile,
    smartengineBaseProfile,
    smartengineCustomProfile,
    smartengineDatabaseProfile,
  ])

  const manager = createDialectManager({ registry, defaultDialect: 'smartengine-base' })

  // 注册适配器
  manager.registerExporter(createBpmn2ExporterAdapter())
  const lastImportData = shallowRef<BpmnImportData | null>(null)

  manager.registerImporter(createBpmn2ImporterAdapter({
    onImportedData(data) {
      lastImportData.value = data
    },
  }))

  const detector = createDialectDetector()

  // ---------- 状态 ----------

  const selectedMode = ref<ModeId>('smartengine-base')
  const context = shallowRef<ProfileContext | null>(null)
  const graphRef = shallowRef<Graph | null>(null)

  const currentMode = computed(() => MODES[selectedMode.value])

  const resolvedProfile = computed<ResolvedProfile | null>(() => context.value?.profile ?? null)

  const enabledNodes = computed(() => {
    if (!resolvedProfile.value) return []
    const avail = resolvedProfile.value.availability.nodes
    const defs = resolvedProfile.value.definitions.nodes
    return Object.entries(avail)
      .filter(([, s]) => s === 'enabled')
      .map(([shape]) => {
        const { shape: _s, ...rest } = defs[shape] || {} as any
        return { shape, ...rest }
      })
  })

  const disabledNodes = computed(() => {
    if (!resolvedProfile.value) return []
    const avail = resolvedProfile.value.availability.nodes
    const defs = resolvedProfile.value.definitions.nodes
    return Object.entries(avail)
      .filter(([, s]) => s === 'disabled')
      .map(([shape]) => {
        const { shape: _s, ...rest } = defs[shape] || {} as any
        return { shape, ...rest }
      })
  })

  // ---------- 方法 ----------

  function bind(graph: Graph) {
    graphRef.value = graph
    context.value = manager.bind(graph, selectedMode.value)
    return context.value
  }

  function switchMode(modeId: string) {
    if (!graphRef.value) return
    selectedMode.value = modeId as ModeId
    context.value = manager.bind(graphRef.value, modeId)
  }

  async function exportXML(): Promise<string> {
    if (!graphRef.value) throw new Error('Graph not initialized')
    return manager.exportXML(graphRef.value)
  }

  async function importXML(xml: string): Promise<BpmnImportData | null> {
    if (!graphRef.value) throw new Error('Graph not initialized')
    lastImportData.value = null
    await manager.importXML(graphRef.value, xml)
    context.value = manager.getContext(graphRef.value) ?? null
    if (context.value) {
      selectedMode.value = context.value.profile.meta.id as ModeId
    }
    return lastImportData.value
  }

  function detectDialect(xml: string): string {
    return detector.detect(xml)
  }

  function runValidation() {
    if (!graphRef.value || !resolvedProfile.value) return []
    const nodes = graphRef.value.getNodes()
    const edges = graphRef.value.getEdges()
    const nodeCounts: Record<string, number> = {}
    const nodeShapes = nodes.map((n) => {
      nodeCounts[n.shape] = (nodeCounts[n.shape] || 0) + 1
      return n.shape
    })
    const ctx: ConstraintValidateContext = {
      profileId: resolvedProfile.value.meta.id,
      nodeShapes,
      edgeShapes: edges.map((e) => e.shape),
      nodeCounts,
    }
    return resolvedProfile.value.rules.constraints.map((c) => ({
      id: c.id,
      description: c.description,
      result: c.validate(ctx),
    }))
  }

  function runFieldValidation() {
    if (!graphRef.value || !resolvedProfile.value) return []
    const errors: Array<{ node: string; field: string; reason: string }> = []
    const nodes = graphRef.value.getNodes()

    for (const node of nodes) {
      const shape = node.shape
      let category = ''
      try { category = getNodeCategory(shape) } catch { continue }

      const fields = getFieldsForShape(shape, category, resolvedProfile.value.dataModel)
      if (fields.length === 0) continue

      const data = node.getData<Record<string, unknown>>() || {}
      const bpmnData = (data.bpmn as Record<string, unknown> | undefined) || {}
      const fctx: FieldValidateContext = {
        shape,
        category,
        profileId: resolvedProfile.value.meta.id,
        nodeData: bpmnData,
      }
      const failures = validateFields(bpmnData, fields, fctx, resolvedProfile.value.dataModel)
      for (const f of failures) {
        errors.push({
          node: getCellLabel(node) || shape,
          field: f.field,
          reason: f.reason,
        })
      }
    }
    return errors
  }

  /** 获取指定分类的字段列表 */
  function getFieldsFor(category: string) {
    if (!resolvedProfile.value) return []
    return getFieldsForCategory(category, resolvedProfile.value.dataModel)
  }

  /** 获取默认数据 */
  function getDefaultData(category: string) {
    if (!resolvedProfile.value) return {}
    const fields = getFieldsFor(category)
    return buildDefaultData(fields, resolvedProfile.value.dataModel)
  }

  /** 创建示例流程 */
  function createSampleProcess() {
    if (!graphRef.value) return
    const g = graphRef.value
    g.clearCells()

    if (selectedMode.value === 'smartengine-custom') {
      // 服务编排流程：Start → Service1 → Gateway → Service2/Service3 → End
      const start = createLabeledNode(g, { shape: BPMN_START_EVENT, x: 100, y: 200, label: '开始' })
      const svc1 = createLabeledNode(g, {
        shape: BPMN_SERVICE_TASK,
        x: 250,
        y: 180,
        width: 120,
        height: 60,
        label: '调用服务A',
        data: { bpmn: { smartClass: 'com.example.ServiceADelegation' } },
      })
      const gw = createLabeledNode(g, { shape: BPMN_EXCLUSIVE_GATEWAY, x: 450, y: 195, label: '路由' })
      const svc2 = createLabeledNode(g, {
        shape: BPMN_SERVICE_TASK,
        x: 600,
        y: 120,
        width: 120,
        height: 60,
        label: '调用服务B',
        data: {
          bpmn: {
            smartClass: 'com.example.ServiceBDelegation',
            smartProperties: '[{"name":"serviceName","value":"serviceB"}]',
          },
        },
      })
      const svc3 = createLabeledNode(g, {
        shape: BPMN_SERVICE_TASK,
        x: 600,
        y: 260,
        width: 120,
        height: 60,
        label: '调用服务C',
        data: {
          bpmn: {
            smartClass: 'com.example.ServiceCDelegation',
            smartProperties: '[{"name":"serviceName","value":"serviceC"}]',
          },
        },
      })
      const settlementTx = createTransactionActivity(g, {
        x: 800,
        y: 145,
        label: '结果落库事务',
        taskShape: BPMN_SERVICE_TASK,
        taskLabel: '持久化',
        taskData: {
          bpmn: {
            smartClass: 'com.example.PersistenceDelegation',
            smartProperties: '[{"name":"target","value":"result-store"}]',
          },
        },
      })
      const end = createLabeledNode(g, { shape: BPMN_END_EVENT, x: 1080, y: 200, label: '结束' })

      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: start, target: svc1 })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: svc1, target: gw })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: gw, target: svc2, label: '主链路' })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: gw, target: svc3, label: '降级链路' })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: svc2, target: settlementTx.transaction })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: svc3, target: settlementTx.transaction })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: settlementTx.transaction, target: end })
    } else if (selectedMode.value === 'smartengine-database') {
      // 审批流程：Start → Submit → Approve → Gateway → End/Reject
      const start = createLabeledNode(g, { shape: BPMN_START_EVENT, x: 100, y: 200, label: '开始' })
      const submit = createLabeledNode(g, {
        shape: BPMN_USER_TASK,
        x: 250,
        y: 180,
        width: 120,
        height: 60,
        label: '提交申请',
        data: { bpmn: { assignee: '${initiator}' } },
      })
      const approve = createLabeledNode(g, {
        shape: BPMN_USER_TASK,
        x: 450,
        y: 180,
        width: 120,
        height: 60,
        label: '审批',
        data: {
          bpmn: {
            multiInstance: true,
            multiInstanceType: 'parallel',
            approvalStrategy: 'any',
            multiInstanceCompletionCondition: '${nrOfCompletedInstances > 0}',
            multiInstanceAbortCondition: '${nrOfRejectedInstances > 0}',
            assignee: '${approverList}',
          },
        },
      })
      const gw = createLabeledNode(g, { shape: BPMN_EXCLUSIVE_GATEWAY, x: 650, y: 195, label: '审批结果' })
      const archiveTx = createTransactionActivity(g, {
        x: 820,
        y: 95,
        label: '审批归档事务',
        taskShape: BPMN_SERVICE_TASK,
        taskLabel: '归档单据',
        taskData: {
          bpmn: {
            smartClass: 'com.example.ArchiveDelegation',
            smartProperties: '[{"name":"archiveType","value":"approval"}]',
          },
        },
      })
      const endApprove = createLabeledNode(g, { shape: BPMN_END_EVENT, x: 1080, y: 140, label: '通过' })
      const reject = createLabeledNode(g, {
        shape: BPMN_USER_TASK,
        x: 860,
        y: 280,
        width: 120,
        height: 60,
        label: '驳回修改',
        data: { bpmn: { assignee: '${initiator}' } },
      })

      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: start, target: submit })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: submit, target: approve })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: approve, target: gw })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: gw, target: archiveTx.transaction, label: '通过' })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: archiveTx.transaction, target: endApprove })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: gw, target: reject, label: '驳回' })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: reject, target: submit, label: '重新提交' })
    } else {
      // 基础模式：混合流程
      const start = createLabeledNode(g, { shape: BPMN_START_EVENT, x: 100, y: 200, label: '开始' })
      const task1 = createLabeledNode(g, {
        shape: BPMN_USER_TASK,
        x: 250,
        y: 180,
        width: 120,
        height: 60,
        label: '人工处理',
        data: {
          bpmn: {
            smartProperties: '[{"name":"taskType","value":"manual-review"}]',
          },
        },
      })
      const autoTx = createTransactionActivity(g, {
        x: 450,
        y: 145,
        label: '自动处理事务',
        taskShape: BPMN_SERVICE_TASK,
        taskLabel: '自动处理',
        taskData: {
          bpmn: {
            smartClass: 'com.example.AutoTaskDelegation',
            smartProperties: '[{"name":"retry","value":"3"},{"name":"channel","value":"rpc"}]',
            smartExecutionListeners: '[{"event":"ACTIVITY_START","class":"com.example.StartListener"}]',
          },
        },
      })
      const end = createLabeledNode(g, { shape: BPMN_END_EVENT, x: 760, y: 200, label: '结束' })

      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: start, target: task1 })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: task1, target: autoTx.transaction })
      createLabeledEdge(g, { shape: BPMN_SEQUENCE_FLOW, source: autoTx.transaction, target: end })
    }
  }

  return {
    // 状态
    selectedMode,
    currentMode,
    context,
    resolvedProfile,
    graphRef,
    enabledNodes,
    disabledNodes,

    // 方法
    bind,
    switchMode,
    exportXML,
    importXML,
    detectDialect,
    runValidation,
    runFieldValidation,
    getFieldsFor,
    getDefaultData,
    createSampleProcess,
  }
}

// 单例
let instance: ReturnType<typeof useSmartEngine> | null = null
export function useSmartEngineSingleton() {
  if (!instance) instance = useSmartEngine()
  return instance
}
