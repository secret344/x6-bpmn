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
  FieldEditorHint,
  FieldEditorOption,
} from '../../core/dialect/types'

import { BPMN_COLORS, BPMN_ICONS } from '../../utils/constants'
import { DEFAULT_BPMN_XML_NAME_SETTINGS } from '../../utils/bpmn-xml-names'
import { NODE_MAPPING, EDGE_MAPPING } from '../../export/bpmn-mapping'
import { DEFAULT_CONNECTION_RULES, getNodeCategory as getNodeCategoryFromRules } from '../../rules/connection-rules'
import type { BpmnNodeCategory } from '../../rules/connection-rules'
import { getShapeLabel } from '../../config'
import { createBpmn2NodeRenderers } from '../../core/rendering/node-renderers'
import { createBpmn2EdgeRenderers } from '../../core/rendering/edge-renderers'
import { requireStartEvent, requireEndEvent } from '../../core/rules/constraints'

const MODELER_EXTENSION_NAMESPACE_URI = 'http://x6-bpmn2.io/schema'

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
      title: getShapeLabel(shape),
    }
  }
  return nodes
}

function buildEdgeDefinitions(): Record<string, EdgeDefinition> {
  const edges: Record<string, EdgeDefinition> = {}
  for (const shape of Object.keys(EDGE_MAPPING)) {
    const title = getShapeLabel(shape)
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

const IMPLEMENTATION_TYPE_OPTIONS: FieldEditorOption[] = [
  { value: 'class', label: 'Java 类' },
  { value: 'expression', label: '表达式' },
  { value: 'delegateExpression', label: '委托表达式' },
]

const SCRIPT_FORMAT_OPTIONS: FieldEditorOption[] = [
  { value: 'groovy', label: 'Groovy' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
]

const TIMER_TYPE_OPTIONS: FieldEditorOption[] = [
  { value: 'timeDuration', label: '持续时间' },
  { value: 'timeDate', label: '固定时间' },
  { value: 'timeCycle', label: '循环' },
]

function createEditor(
  label: string,
  input: FieldEditorHint['input'] = 'text',
  placeholder?: string,
  options?: FieldEditorOption[],
): FieldEditorHint {
  return {
    label,
    input,
    ...(placeholder ? { placeholder } : {}),
    ...(options ? { options } : {}),
  }
}

function buildFieldCapabilities(): Record<string, FieldCapability> {
  return {
    // 用户任务
    assignee: {
      scope: 'node',
      defaultValue: '',
      description: '任务处理人',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('处理人', undefined, '如: admin'),
    },
    candidateUsers: {
      scope: 'node',
      defaultValue: '',
      description: '候选用户（逗号分隔）',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('候选用户', undefined, '逗号分隔'),
    },
    candidateGroups: {
      scope: 'node',
      defaultValue: '',
      description: '候选用户组（逗号分隔）',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('候选组', undefined, '逗号分隔'),
    },
    formKey: {
      scope: 'node',
      defaultValue: '',
      description: '表单 key',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('表单 Key', undefined, '表单标识'),
    },
    dueDate: {
      scope: 'node',
      defaultValue: '',
      description: '截止日期表达式',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('到期日', 'text', '如: 2025-12-31'),
    },
    priority: {
      scope: 'node',
      defaultValue: '',
      description: '优先级',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('优先级', 'text', '如: 50'),
    },

    // 服务 / 业务规则 / 发送 / 接收任务
    implementationType: {
      scope: 'node',
      defaultValue: '',
      description: '实现类型',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('实现类型', 'select', undefined, IMPLEMENTATION_TYPE_OPTIONS),
    },
    implementation: {
      scope: 'node',
      defaultValue: '',
      description: '实现（类名 / 表达式 / 委托表达式）',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('实现', 'text', '类名/表达式'),
    },
    resultVariable: {
      scope: 'node',
      defaultValue: '',
      description: '结果变量名',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('结果变量', 'text', '变量名'),
    },
    isAsync: {
      scope: 'node',
      defaultValue: false,
      description: '是否异步执行',
      normalize: (v) => Boolean(v),
      serialize: (v) => v ? 'true' : 'false',
      deserialize: (v) => v === 'true' || v === true,
      editor: createEditor('异步', 'boolean'),
    },

    // 脚本任务
    scriptFormat: {
      scope: 'node',
      defaultValue: '',
      description: '脚本语言',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('脚本格式', 'select', undefined, SCRIPT_FORMAT_OPTIONS),
    },
    script: {
      scope: 'node',
      defaultValue: '',
      description: '脚本内容',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('脚本内容', 'textarea', '输入脚本...'),
    },

    // 调用活动
    calledElement: {
      scope: 'node',
      defaultValue: '',
      description: '被调用的流程定义 key',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('被调流程', 'text', '流程 ID'),
    },

    // 子流程
    triggeredByEvent: {
      scope: 'node',
      defaultValue: false,
      description: '是否由事件触发',
      normalize: (v) => Boolean(v),
      editor: createEditor('事件触发', 'boolean'),
    },

    // 网关
    defaultFlow: {
      scope: 'node',
      defaultValue: '',
      description: '默认出线 ID',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('默认流', 'text', '目标边 ID'),
    },
    activationCondition: {
      scope: 'node',
      defaultValue: '',
      description: '激活条件',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('激活条件', 'text', '条件表达式'),
    },

    // 定时事件
    timerType: {
      scope: 'node',
      defaultValue: 'timeDuration',
      description: '定时器类型',
      normalize: (v) => String(v ?? 'timeDuration'),
      editor: createEditor('定时类型', 'select', undefined, TIMER_TYPE_OPTIONS),
    },
    timerValue: {
      scope: 'node',
      defaultValue: '',
      description: '定时器值',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('定时值', 'text', '如: PT5M'),
    },

    // 消息事件
    messageRef: {
      scope: 'node',
      defaultValue: '',
      description: '消息引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('消息引用', 'text', '消息定义 ID'),
    },
    messageName: {
      scope: 'node',
      defaultValue: '',
      description: '消息名称',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('消息名称', 'text', '消息名'),
    },

    // 信号事件
    signalRef: {
      scope: 'node',
      defaultValue: '',
      description: '信号引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('信号引用', 'text', '信号定义 ID'),
    },
    signalName: {
      scope: 'node',
      defaultValue: '',
      description: '信号名称',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('信号名称', 'text', '信号名'),
    },

    // 错误事件
    errorRef: {
      scope: 'node',
      defaultValue: '',
      description: '错误引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('错误引用', 'text', '错误定义 ID'),
    },
    errorCode: {
      scope: 'node',
      defaultValue: '',
      description: '错误代码',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('错误代码', 'text', '错误码'),
    },

    // 升级事件
    escalationRef: {
      scope: 'node',
      defaultValue: '',
      description: '升级引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('升级引用', 'text', '升级定义 ID'),
    },
    escalationCode: {
      scope: 'node',
      defaultValue: '',
      description: '升级代码',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('升级代码', 'text', '升级码'),
    },

    // 条件事件
    conditionExpression: {
      scope: 'edge',
      defaultValue: '',
      description: '条件表达式',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('条件表达式', 'text', '如: ${amount > 1000}'),
    },

    // 链接事件
    linkName: {
      scope: 'node',
      defaultValue: '',
      description: '链接名称',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('链接名称', 'text', '链接名'),
    },

    // 补偿事件
    activityRef: {
      scope: 'node',
      defaultValue: '',
      description: '活动引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('活动引用', 'text', '被补偿活动 ID'),
    },

    // 边界事件
    cancelActivity: {
      scope: 'node',
      defaultValue: true,
      description: '是否取消活动',
      normalize: (v) => v !== false,
      editor: createEditor('中断活动', 'boolean'),
    },

    // 数据对象
    isCollection: {
      scope: 'node',
      defaultValue: false,
      description: '是否集合',
      normalize: (v) => Boolean(v),
      editor: createEditor('集合', 'boolean'),
    },

    // 池
    processRef: {
      scope: 'node',
      defaultValue: '',
      description: '流程引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('流程引用', 'text', '流程 ID'),
    },

    // 文本注释
    annotationText: {
      scope: 'node',
      defaultValue: '',
      description: '注释文本',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('注释文本', 'textarea', '输入注释...'),
    },

    // 组
    categoryValueRef: {
      scope: 'node',
      defaultValue: '',
      description: '类别值引用',
      normalize: (v) => String(v ?? ''),
      editor: createEditor('分类值', 'text', '分类标识'),
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
      modeler: MODELER_EXTENSION_NAMESPACE_URI,
    },
    extensionProperties: {
      prefix: 'modeler',
      namespaceUri: MODELER_EXTENSION_NAMESPACE_URI,
      containerLocalName: 'properties',
      propertyLocalName: 'property',
    },
    xmlNames: DEFAULT_BPMN_XML_NAME_SETTINGS,
    nodeMapping: { ...NODE_MAPPING },
    edgeMapping: { ...EDGE_MAPPING },
  },
}
