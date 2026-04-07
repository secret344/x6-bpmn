/**
 * useDialect — 方言系统管理 Composable
 *
 * 集中管理 ProfileRegistry、DialectManager、Profile 切换等状态。
 * 演示完整的 Dialect API：
 *   - ProfileRegistry — 注册、编译、继承链
 *   - DialectManager — bind/unbind、export/import
 *   - DialectDetector — XML 方言自动检测
 *   - Constraint validation — 结构约束验证
 *   - DataModel fields — 字段能力管理
 *   - Custom profile — 自定义 Profile 创建
 */

import { ref, shallowRef, computed, watch, type Ref } from 'vue'
import type { Graph } from '@antv/x6'
import {
  // Registry & Compiler
  ProfileRegistry,
  createProfileRegistry,

  // DialectManager
  DialectManager,
  createDialectManager,

  // Builtin profiles
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineCustomProfile,
  smartengineDatabaseProfile,

  // Adapters
  createBpmn2ExporterAdapter,
  createBpmn2ImporterAdapter,

  // Detector
  createDialectDetector,

  // Context
  type ProfileContext,
  type ResolvedProfile,
  type Profile,
  type Availability,
  type ConstraintValidateContext,

  // Constraints
  validateConstraints,
  createForbiddenShapes,

  // Data model
  getFieldsForCategory,
  getFieldsForShape,
  buildDefaultData,
  validateFields,
  normalizeFieldValue,
  getFieldDefaultValue,
  type FieldValidateContext,
} from '@x6-bpmn2/plugin'

// ============================================================================
// 自定义 Profile 示例 — 精简审批模式
// ============================================================================

/**
 * 演示如何创建一个自定义 Profile，继承 smartengine-base，
 * 适用于精简审批流场景：
 * - 只保留开始/结束事件、用户任务、排它网关
 * - 禁用复杂元素
 * - 添加自定义约束
 */
const simpleApprovalProfile: Profile = {
  meta: {
    id: 'simple-approval',
    name: '精简审批流',
    parent: 'smartengine-base',
    version: '1.0.0',
    description: '仅保留审批场景常用元素，适合快速搭建简单审批流',
  },
  availability: {
    nodes: {
      // 禁用不常用的元素
      'bpmn-complex-gateway': 'disabled',
      'bpmn-event-based-gateway': 'disabled',
      'bpmn-ad-hoc-sub-process': 'disabled',
      'bpmn-event-sub-process': 'disabled',
      'bpmn-transaction': 'disabled',
      'bpmn-manual-task': 'disabled',
      'bpmn-business-rule-task': 'disabled',
      'bpmn-send-task': 'disabled',
      'bpmn-receive-task': 'disabled',
      'bpmn-script-task': 'disabled',
      'bpmn-call-activity': 'disabled',
      'bpmn-data-object': 'disabled',
      'bpmn-data-input': 'disabled',
      'bpmn-data-output': 'disabled',
      'bpmn-data-store': 'disabled',
      'bpmn-text-annotation': 'disabled',
      'bpmn-group': 'disabled',
      'bpmn-pool': 'disabled',
      'bpmn-lane': 'disabled',
    },
    edges: {
      'bpmn-message-flow': 'disabled',
      'bpmn-association': 'disabled',
      'bpmn-directed-association': 'disabled',
      'bpmn-data-association': 'disabled',
    },
  },
  rules: {
    constraints: [
      createForbiddenShapes(
        ['bpmn-complex-gateway', 'bpmn-event-based-gateway'],
        '精简审批流不支持复杂网关',
      ),
    ],
  },
  dataModel: {
    fields: {
      approver: {
        scope: 'node',
        defaultValue: '',
        description: '审批人',
        normalize: (v) => String(v ?? '').trim(),
        validate: (v, ctx) => {
          if (ctx.category === 'userTask' && String(v).trim() === '') {
            return '审批任务必须指定审批人'
          }
          return true
        },
      },
      approvalComment: {
        scope: 'node',
        defaultValue: '',
        description: '审批意见',
        normalize: (v) => String(v ?? ''),
      },
    },
    categoryFields: {
      userTask: ['approver', 'approvalComment'],
    },
  },
}

// ============================================================================
// 全局状态
// ============================================================================

/** 可选的方言 ID 列表 */
export const AVAILABLE_DIALECTS = [
  { id: 'bpmn2', name: 'BPMN 2.0 标准', desc: '完整 BPMN 2.0 元素支持' },
  { id: 'smartengine-base', name: 'SmartEngine 基础', desc: '完整 BPMN 2.0 + SmartEngine 扩展字段' },
  { id: 'smartengine-custom', name: 'SmartEngine 服务编排', desc: '强化 ServiceTask，禁用 UserTask/ManualTask' },
  { id: 'smartengine-database', name: 'SmartEngine 审批/工单', desc: '增强审批能力，多实例、审批策略' },
  { id: 'simple-approval', name: '精简审批流（自定义）', desc: '自定义 Profile，仅保留审批常用元素' },
]

export function useDialect() {
  // ---------- 核心对象 ----------

  const registry = createProfileRegistry()
  registry.registerAll([
    bpmn2Profile,
    smartengineBaseProfile,
    smartengineCustomProfile,
    smartengineDatabaseProfile,
    simpleApprovalProfile,
  ])

  const manager = createDialectManager({ registry, defaultDialect: 'bpmn2' })

  // 注册导入/导出适配器
  manager.registerExporter(createBpmn2ExporterAdapter())
  manager.registerImporter(createBpmn2ImporterAdapter())

  // 方言检测器
  const detector = createDialectDetector()

  // ---------- 响应式状态 ----------

  const currentDialectId = ref('bpmn2')
  const currentContext = shallowRef<ProfileContext | null>(null)
  const graphRef = shallowRef<Graph | null>(null)

  /** 编译后的 profile */
  const resolvedProfile = computed<ResolvedProfile | null>(() => {
    return currentContext.value?.profile ?? null
  })

  /** 当前 profile 中 enabled 的节点 */
  const enabledNodes = computed(() => {
    if (!resolvedProfile.value) return []
    const avail = resolvedProfile.value.availability.nodes
    const defs = resolvedProfile.value.definitions.nodes
    return Object.entries(avail)
      .filter(([, status]) => status === 'enabled')
      .map(([shape]) => {
        const { shape: _s, ...rest } = defs[shape] || {} as any
        return { shape, ...rest }
      })
  })

  /** 当前 profile 中 disabled 的节点 */
  const disabledNodes = computed(() => {
    if (!resolvedProfile.value) return []
    const avail = resolvedProfile.value.availability.nodes
    const defs = resolvedProfile.value.definitions.nodes
    return Object.entries(avail)
      .filter(([, status]) => status === 'disabled')
      .map(([shape]) => {
        const { shape: _s, ...rest } = defs[shape] || {} as any
        return { shape, ...rest }
      })
  })

  /** 当前 profile 中 enabled 的边 */
  const enabledEdges = computed(() => {
    if (!resolvedProfile.value) return []
    const avail = resolvedProfile.value.availability.edges
    const defs = resolvedProfile.value.definitions.edges
    return Object.entries(avail)
      .filter(([, status]) => status === 'enabled')
      .map(([shape]) => {
        const { shape: _s, ...rest } = defs[shape] || {} as any
        return { shape, ...rest }
      })
  })

  /** 继承链 */
  const inheritanceChain = computed(() => {
    try {
      return registry.getInheritanceChain(currentDialectId.value)
    } catch {
      return [currentDialectId.value]
    }
  })

  /** 命名空间列表 */
  const namespaces = computed(() => {
    if (!resolvedProfile.value) return {}
    return resolvedProfile.value.serialization.namespaces
  })

  /** 约束规则列表 */
  const constraints = computed(() => {
    if (!resolvedProfile.value) return []
    return resolvedProfile.value.rules.constraints
  })

  /** 字段能力列表 */
  const fieldCapabilities = computed(() => {
    if (!resolvedProfile.value) return {}
    return resolvedProfile.value.dataModel.fields
  })

  // ---------- 方法 ----------

  /** 绑定方言到 graph */
  function bindDialect(graph: Graph, dialectId: string) {
    graphRef.value = graph
    currentDialectId.value = dialectId
    const ctx = manager.bind(graph, dialectId)
    currentContext.value = ctx
    return ctx
  }

  /** 切换方言 */
  function switchDialect(dialectId: string) {
    if (!graphRef.value) return
    currentDialectId.value = dialectId
    const ctx = manager.bind(graphRef.value, dialectId)
    currentContext.value = ctx
  }

  /** 导出 XML */
  async function exportXML(): Promise<string> {
    if (!graphRef.value) throw new Error('Graph not initialized')
    return manager.exportXML(graphRef.value)
  }

  /** 导入 XML（自动检测方言） */
  async function importXML(xml: string) {
    if (!graphRef.value) throw new Error('Graph not initialized')
    // 先用检测器检测
    const detectedId = detector.detect(xml)
    if (detectedId && detectedId !== currentDialectId.value) {
      currentDialectId.value = detectedId
    }
    await manager.importXML(graphRef.value, xml)
    currentContext.value = manager.getContext(graphRef.value) ?? null
  }

  /** 检测 XML 方言 */
  function detectDialect(xml: string): string {
    return detector.detect(xml)
  }

  /** 验证约束 */
  function runConstraintValidation(): Array<{ id: string; description: string; result: true | string }> {
    if (!graphRef.value || !resolvedProfile.value) return []

    const nodes = graphRef.value.getNodes()
    const edges = graphRef.value.getEdges()

    const nodeCounts: Record<string, number> = {}
    const nodeShapes = nodes.map((n) => {
      const shape = n.shape
      nodeCounts[shape] = (nodeCounts[shape] || 0) + 1
      return shape
    })

    const ctx: ConstraintValidateContext = {
      profileId: resolvedProfile.value.meta.id,
      nodeShapes,
      edgeShapes: edges.map((e) => e.shape),
      nodeCounts,
    }

    return resolvedProfile.value.rules.constraints.map((constraint) => ({
      id: constraint.id,
      description: constraint.description,
      result: constraint.validate(ctx),
    }))
  }

  /** 获取分类的字段列表 */
  function getFieldsFor(category: string): string[] {
    if (!resolvedProfile.value) return []
    return getFieldsForCategory(category, resolvedProfile.value.dataModel)
  }

  /** 获取字段默认数据 */
  function getDefaultData(category: string): Record<string, unknown> {
    if (!resolvedProfile.value) return {}
    const fields = getFieldsFor(category)
    return buildDefaultData(fields, resolvedProfile.value.dataModel)
  }

  /** 验证字段值 */
  function validateNodeFields(
    data: Record<string, unknown>,
    shape: string,
    category: string,
  ) {
    if (!resolvedProfile.value) return []
    const fields = getFieldsForShape(shape, category, resolvedProfile.value.dataModel)
    const ctx: FieldValidateContext = {
      shape,
      category,
      profileId: resolvedProfile.value.meta.id,
    }
    return validateFields(data, fields, ctx, resolvedProfile.value.dataModel)
  }

  return {
    // 核心对象
    registry,
    manager,
    detector,

    // 状态
    currentDialectId,
    currentContext,
    resolvedProfile,
    graphRef,

    // 计算属性
    enabledNodes,
    disabledNodes,
    enabledEdges,
    inheritanceChain,
    namespaces,
    constraints,
    fieldCapabilities,

    // 方法
    bindDialect,
    switchDialect,
    exportXML,
    importXML,
    detectDialect,
    runConstraintValidation,
    getFieldsFor,
    getDefaultData,
    validateNodeFields,
  }
}

/** 单例 */
let dialectInstance: ReturnType<typeof useDialect> | null = null

export function useDialectSingleton() {
  if (!dialectInstance) {
    dialectInstance = useDialect()
  }
  return dialectInstance
}
