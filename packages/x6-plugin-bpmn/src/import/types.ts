/**
 * BPMN 导入中间数据类型定义
 *
 * 定义 XML 解析（parseBpmnXml）到图形加载（loadBpmnGraph）
 * 之间的中间 JSON 格式，实现关注点分离。
 */

// ============================================================================
// 节点描述符
// ============================================================================

/**
 * X6 节点描述符 —— 对应单个 BPMN 流程元素（任务、事件、网关等）。
 * 由 xml-parser 生成，由 graph-loader 消费。
 */
export interface BpmnNodeData {
  /** X6 注册图形名称（如 'bpmn-task'、'bpmn-start-event' 等） */
  shape: string
  /** BPMN 元素 ID，同步用作 X6 节点 ID */
  id: string
  /** 节点横坐标（来自 BPMNDI 或回退默认值） */
  x: number
  /** 节点纵坐标（来自 BPMNDI 或回退默认值） */
  y: number
  /** 节点宽度 */
  width: number
  /** 节点高度 */
  height: number
  /** X6 attrs：标签文本、泳道头等渲染属性 */
  attrs?: Record<string, unknown>
  /** 父节点 ID（边界事件 attachedToRef → 宿主任务 ID） */
  parent?: string
  /** 扩展业务数据（来自 BPMN extensionElements/properties） */
  data?: Record<string, unknown>
}

// ============================================================================
// 边描述符
// ============================================================================

/** 边标签条目 */
export interface BpmnEdgeLabelData {
  attrs: { label: { text: string } }
}

/**
 * X6 边描述符 —— 对应单条 BPMN 流（顺序流、消息流、关联等）。
 * 由 xml-parser 生成，由 graph-loader 消费。
 */
export interface BpmnEdgeData {
  /** X6 注册图形名称 */
  shape: string
  /** BPMN 流 ID，同步用作 X6 边 ID */
  id: string
  /** 源节点 ID */
  source: string
  /** 目标节点 ID */
  target: string
  /** 标签列表（来自 BPMN 元素 name 属性） */
  labels?: BpmnEdgeLabelData[]
  /** DI 中间路径点（waypoints 去掉首尾后的顶点列表） */
  vertices?: Array<{ x: number; y: number }>
  /** 扩展业务数据（来自 BPMNDI / 扩展属性） */
  data?: Record<string, unknown>
}

// ============================================================================
// 文档级中间数据
// ============================================================================

/**
 * BPMN XML 解析后的中间数据。
 *
 * 由 parseBpmnXml() 产生，传入 loadBpmnGraph() 使用。
 * 节点按导入顺序排列：Pool → Lane → 流程节点。
 * 边按导入顺序排列：顺序流 → 消息流 → 关联 → 数据关联。
 */
export interface BpmnImportData {
  /** 节点列表（有序） */
  nodes: BpmnNodeData[]
  /** 边列表（有序） */
  edges: BpmnEdgeData[]
  /** 文档级元数据。 */
  metadata?: {
    targetNamespace?: string
    processVersion?: string
  }
}
