/**
 * 内置方言 — BPMN 2.0 标准 Profile
 *
 * 作为母版方言，提供完整的 BPMN 2.0 默认元素定义、规则、渲染、字段能力和序列化映射。
 * 从现有主库代码中提取整合。
 */

import type {
  Profile,
  NodeDefinition,
  EdgeDefinition,
  FieldCapability,
} from '../../core/dialect/types'

import { BPMN_COLORS, BPMN_ICONS } from '../../utils/constants'
import { NODE_MAPPING, EDGE_MAPPING } from '../../export/bpmn-mapping'
import { DEFAULT_CONNECTION_RULES, getNodeCategory as getNodeCategoryFromRules } from '../../rules/connection-rules'
import type { BpmnNodeCategory } from '../../rules/connection-rules'
import { SHAPE_LABELS } from '../../config'
import { createBpmn2NodeRenderers } from '../../core/rendering/node-renderers'
import { createBpmn2EdgeRenderers } from '../../core/rendering/edge-renderers'
import { requireStartEvent, requireEndEvent, createStartEventLimit } from '../../core/rules/constraints'

// ============================================================================
// shape → 渲染器名称 映射
// ============================================================================

function getNodeRendererName(shape: string): string {
  if (shape.includes('start-event')) return 'startEvent'
  if (shape.includes('intermediate') && (shape.includes('throw') || shape.includes('catch'))) return 'intermediateEvent'
  if (shape.includes('boundary-event')) return 'boundaryEvent'
  if (shape.includes('end-event')) return 'endEvent'
  if (shape.includes('gateway')) return 'gateway'
  if (shape.includes('sub-process') || shape === 'bpmn-transaction' || shape === 'bpmn-ad-hoc-sub-process' || shape === 'bpmn-event-sub-process') return 'subProcess'
  if (shape.includes('task') || shape === 'bpmn-call-activity') return 'task'
  if (shape.includes('data-object') || shape.includes('data-input') || shape.includes('data-output') || shape.includes('data-store')) return 'data'
  if (shape === 'bpmn-text-annotation') return 'annotation'
  if (shape === 'bpmn-group') return 'group'
  /* v8 ignore next — 所有已知 NODE_MAPPING 图形均已匹配，此行为新增图形的保底返回值 */ /* istanbul ignore next */
  return 'task' // 无法识别的图形回退值
}

function getNodeCategory(shape: string): BpmnNodeCategory {
  return getNodeCategoryFromRules(shape)
}

function getEdgeRendererName(shape: string): string {
  if (shape === 'bpmn-conditional-flow') return 'conditionalFlow'
  if (shape === 'bpmn-default-flow') return 'defaultFlow'
  if (shape === 'bpmn-message-flow') return 'messageFlow'
  if (shape === 'bpmn-association') return 'association'
  if (shape === 'bpmn-directed-association') return 'directedAssociation'
  if (shape === 'bpmn-data-association') return 'dataAssociation'
  return 'sequenceFlow'
}

function getEdgeCategory(shape: string): string {
  if (shape.includes('message')) return 'messageFlow'
  if (shape.includes('association') || shape.includes('data-association')) return 'association'
  return 'sequenceFlow'
}

// ============================================================================
// 从现有数据构建 definitions
// ============================================================================

function buildNodeDefinitions(): Record<string, NodeDefinition> {
  const nodes: Record<string, NodeDefinition> = {}
  for (const shape of Object.keys(NODE_MAPPING)) {
    nodes[shape] = {
      shape,
      category: getNodeCategory(shape),
      renderer: getNodeRendererName(shape),
      /* istanbul ignore next — SHAPE_LABELS 始终包含所有已注册图形; || fallback 不可达 */
      title: SHAPE_LABELS[shape] || shape,
    }
  }
  return nodes
}

function buildEdgeDefinitions(): Record<string, EdgeDefinition> {
  const edges: Record<string, EdgeDefinition> = {}
  for (const shape of Object.keys(EDGE_MAPPING)) {
    /* istanbul ignore next — SHAPE_LABELS 始终包含所有已注册图形; || fallback 不可达 */
    const title = SHAPE_LABELS[shape] || shape
    edges[shape] = {
      shape,
      category: getEdgeCategory(shape),
      renderer: getEdgeRendererName(shape),
      title,
    }
  }
  return edges
}

// ============================================================================
// 从现有数据构建 nodeCategories（shape → BpmnNodeCategory）
// ============================================================================

function buildNodeCategories(): Record<string, BpmnNodeCategory> {
  const categories: Record<string, BpmnNodeCategory> = {}
  for (const shape of Object.keys(NODE_MAPPING)) {
    categories[shape] = getNodeCategory(shape)
  }
  return categories
}

// ============================================================================
// 字段能力定义
// ============================================================================

function buildFieldCapabilities(): Record<string, FieldCapability> {
  return {
    // 用户任务
    assignee: {
      scope: 'node',
      defaultValue: '',
      description: '任务处理人',
      normalize: (v) => String(v ?? ''),
    },
    candidateUsers: {
      scope: 'node',
      defaultValue: '',
      description: '候选用户（逗号分隔）',
      normalize: (v) => String(v ?? ''),
    },
    candidateGroups: {
      scope: 'node',
      defaultValue: '',
      description: '候选用户组（逗号分隔）',
      normalize: (v) => String(v ?? ''),
    },
    formKey: {
      scope: 'node',
      defaultValue: '',
      description: '表单 key',
      normalize: (v) => String(v ?? ''),
    },
    dueDate: {
      scope: 'node',
      defaultValue: '',
      description: '截止日期表达式',
      normalize: (v) => String(v ?? ''),
    },
    priority: {
      scope: 'node',
      defaultValue: '',
      description: '优先级',
      normalize: (v) => String(v ?? ''),
    },

    // 服务 / 业务规则 / 发送 / 接收任务
    implementationType: {
      scope: 'node',
      defaultValue: '',
      description: '实现类型',
      normalize: (v) => String(v ?? ''),
    },
    implementation: {
      scope: 'node',
      defaultValue: '',
      description: '实现（类名 / 表达式 / 委托表达式）',
      normalize: (v) => String(v ?? ''),
    },
    resultVariable: {
      scope: 'node',
      defaultValue: '',
      description: '结果变量名',
      normalize: (v) => String(v ?? ''),
    },
    isAsync: {
      scope: 'node',
      defaultValue: false,
      description: '是否异步执行',
      normalize: (v) => Boolean(v),
      serialize: (v) => v ? 'true' : 'false',
      deserialize: (v) => v === 'true' || v === true,
    },

    // 脚本任务
    scriptFormat: {
      scope: 'node',
      defaultValue: '',
      description: '脚本语言',
      normalize: (v) => String(v ?? ''),
    },
    script: {
      scope: 'node',
      defaultValue: '',
      description: '脚本内容',
      normalize: (v) => String(v ?? ''),
    },

    // 调用活动
    calledElement: {
      scope: 'node',
      defaultValue: '',
      description: '被调用的流程定义 key',
      normalize: (v) => String(v ?? ''),
    },

    // 子流程
    triggeredByEvent: {
      scope: 'node',
      defaultValue: false,
      description: '是否由事件触发',
      normalize: (v) => Boolean(v),
    },

    // 网关
    defaultFlow: {
      scope: 'node',
      defaultValue: '',
      description: '默认出线 ID',
      normalize: (v) => String(v ?? ''),
    },
    activationCondition: {
      scope: 'node',
      defaultValue: '',
      description: '激活条件',
      normalize: (v) => String(v ?? ''),
    },

    // 定时事件
    timerType: {
      scope: 'node',
      defaultValue: 'timeDuration',
      description: '定时器类型',
      normalize: (v) => String(v ?? 'timeDuration'),
    },
    timerValue: {
      scope: 'node',
      defaultValue: '',
      description: '定时器值',
      normalize: (v) => String(v ?? ''),
    },

    // 消息事件
    messageRef: {
      scope: 'node',
      defaultValue: '',
      description: '消息引用',
      normalize: (v) => String(v ?? ''),
    },
    messageName: {
      scope: 'node',
      defaultValue: '',
      description: '消息名称',
      normalize: (v) => String(v ?? ''),
    },

    // 信号事件
    signalRef: {
      scope: 'node',
      defaultValue: '',
      description: '信号引用',
      normalize: (v) => String(v ?? ''),
    },
    signalName: {
      scope: 'node',
      defaultValue: '',
      description: '信号名称',
      normalize: (v) => String(v ?? ''),
    },

    // 错误事件
    errorRef: {
      scope: 'node',
      defaultValue: '',
      description: '错误引用',
      normalize: (v) => String(v ?? ''),
    },
    errorCode: {
      scope: 'node',
      defaultValue: '',
      description: '错误代码',
      normalize: (v) => String(v ?? ''),
    },

    // 升级事件
    escalationRef: {
      scope: 'node',
      defaultValue: '',
      description: '升级引用',
      normalize: (v) => String(v ?? ''),
    },
    escalationCode: {
      scope: 'node',
      defaultValue: '',
      description: '升级代码',
      normalize: (v) => String(v ?? ''),
    },

    // 条件事件
    conditionExpression: {
      scope: 'edge',
      defaultValue: '',
      description: '条件表达式',
      normalize: (v) => String(v ?? ''),
    },

    // 链接事件
    linkName: {
      scope: 'node',
      defaultValue: '',
      description: '链接名称',
      normalize: (v) => String(v ?? ''),
    },

    // 补偿事件
    activityRef: {
      scope: 'node',
      defaultValue: '',
      description: '活动引用',
      normalize: (v) => String(v ?? ''),
    },

    // 边界事件
    cancelActivity: {
      scope: 'node',
      defaultValue: true,
      description: '是否取消活动',
      normalize: (v) => v !== false,
    },

    // 数据对象
    isCollection: {
      scope: 'node',
      defaultValue: false,
      description: '是否集合',
      normalize: (v) => Boolean(v),
    },

    // 池
    processRef: {
      scope: 'node',
      defaultValue: '',
      description: '流程引用',
      normalize: (v) => String(v ?? ''),
    },

    // 文本注释
    annotationText: {
      scope: 'node',
      defaultValue: '',
      description: '注释文本',
      normalize: (v) => String(v ?? ''),
    },

    // 组
    categoryValueRef: {
      scope: 'node',
      defaultValue: '',
      description: '类别值引用',
      normalize: (v) => String(v ?? ''),
    },
  }
}

// ============================================================================
// 分类 → 字段 映射
// ============================================================================

function buildCategoryFields(): Record<string, string[]> {
  return {
    userTask: ['assignee', 'candidateUsers', 'candidateGroups', 'formKey', 'dueDate', 'priority'],
    serviceTask: ['implementationType', 'implementation', 'resultVariable', 'isAsync'],
    businessRuleTask: ['implementationType', 'implementation', 'resultVariable', 'isAsync'],
    sendTask: ['implementationType', 'implementation', 'resultVariable', 'isAsync', 'messageRef', 'messageName'],
    receiveTask: ['implementationType', 'implementation', 'resultVariable', 'isAsync', 'messageRef', 'messageName'],
    scriptTask: ['scriptFormat', 'script', 'resultVariable'],
    manualTask: [],
    task: [],
    callActivity: ['calledElement', 'isAsync'],
    subProcess: ['triggeredByEvent', 'isAsync'],
    gateway: ['defaultFlow', 'activationCondition'],
    timerEvent: ['timerType', 'timerValue'],
    messageEvent: ['messageRef', 'messageName'],
    signalEvent: ['signalRef', 'signalName'],
    errorEvent: ['errorRef', 'errorCode'],
    escalationEvent: ['escalationRef', 'escalationCode'],
    conditionalEvent: ['conditionExpression'],
    linkEvent: ['linkName'],
    compensationEvent: ['activityRef'],
    cancelEvent: [],
    terminateEvent: [],
    multipleEvent: [],
    noneEvent: [],
    sequenceFlow: ['conditionExpression'],
    messageFlow: ['messageRef', 'messageName'],
    association: [],
    dataObject: ['isCollection'],
    dataStore: [],
    pool: ['processRef'],
    lane: [],
    textAnnotation: ['annotationText'],
    group: ['categoryValueRef'],
  }
}

// ============================================================================
// BPMN2 Profile 定义
// ============================================================================

/**
 * BPMN 2.0 标准方言 Profile。
 *
 * 作为所有方言的母版，提供完整的 BPMN 2.0 定义。
 * 其他方言（如 smartengine-base）通过 parent: 'bpmn2' 继承此 profile。
 */
export const bpmn2Profile: Profile = {
  meta: {
    id: 'bpmn2',
    name: 'BPMN 2.0',
    version: '1.0.0',
    description: 'BPMN 2.0 标准方言，作为所有方言的母版',
  },

  definitions: {
    nodes: buildNodeDefinitions(),
    edges: buildEdgeDefinitions(),
  },

  availability: {
    nodes: Object.fromEntries(
      Object.keys(NODE_MAPPING).map((shape) => [shape, 'enabled' as const]),
    ),
    edges: Object.fromEntries(
      Object.keys(EDGE_MAPPING).map((shape) => [shape, 'enabled' as const]),
    ),
  },

  rendering: {
    theme: {
      colors: { ...BPMN_COLORS },
      icons: { ...BPMN_ICONS },
    },
    nodeRenderers: createBpmn2NodeRenderers(),
    edgeRenderers: createBpmn2EdgeRenderers(),
  },

  rules: {
    nodeCategories: buildNodeCategories(),
    connectionRules: { ...DEFAULT_CONNECTION_RULES },
    constraints: [
      requireStartEvent,
      requireEndEvent,
      createStartEventLimit(1),
    ],
  },

  dataModel: {
    fields: buildFieldCapabilities(),
    categoryFields: buildCategoryFields(),
  },

  serialization: {
    namespaces: {
      bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
      bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
      dc: 'http://www.omg.org/spec/DD/20100524/DC',
      di: 'http://www.omg.org/spec/DD/20100524/DI',
      x6bpmn: 'http://x6-bpmn2.io/schema',
    },
    nodeMapping: { ...NODE_MAPPING },
    edgeMapping: { ...EDGE_MAPPING },
  },
}
