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
// 导入诊断与保真元数据
// ============================================================================

/** 导入兼容问题。 */
export interface BpmnImportCompatibilityIssue {
  /** 问题代码。 */
  code: string
  /** 面向宿主的诊断文案。 */
  message: string
  /** 关联元素 ID。 */
  elementIds?: string[]
}

/** 导入诊断结果。 */
export interface BpmnImportDiagnostics {
  /** bpmn-moddle 原始 warnings 文案。 */
  warnings: string[]
  /** 当前项目识别出的兼容与一致性问题。 */
  compatibilityIssues: BpmnImportCompatibilityIssue[]
  /** 已确认发生有损处理的标记。 */
  lossyFlags: string[]
}

/** 保真 XML 元素元数据。 */
export interface BpmnPreservedElementMetadata {
  /** 原始 XML 元素 ID。 */
  id?: string
  /** 原始 XML 属性。 */
  $attrs?: Record<string, unknown>
  /** 原始 XML 命名空间。 */
  $namespaces?: Record<string, string>
}

/** 保真 Process 元数据。 */
export interface BpmnPreservedProcessMetadata extends BpmnPreservedElementMetadata {
  /** 关联的 Pool 节点 ID；无 Pool 时为空。 */
  poolId?: string | null
  /** 原始 process 名称。 */
  name?: string
  /** 原始 isExecutable。 */
  isExecutable?: boolean
  /** 当前项目仅复用单个 laneSet，因此保留首个 laneSet id。 */
  laneSetId?: string
}

/** 保真 BPMNDiagram 元数据。 */
export interface BpmnPreservedDiagramMetadata extends BpmnPreservedElementMetadata {
  /** 原始 BPMNPlane 元数据。 */
  plane?: BpmnPreservedElementMetadata & {
    /** 原始 plane.bpmnElement 引用值。 */
    bpmnElement?: string
  }
}

/** 文档级保真元数据。 */
export interface BpmnImportMetadata {
  /** definitions.targetNamespace。 */
  targetNamespace?: string
  /** 首个 process 的 version 属性。 */
  processVersion?: string
  /** 原始 Definitions 元数据。 */
  definitions?: BpmnPreservedElementMetadata
  /** 原始 Collaboration 元数据。 */
  collaboration?: BpmnPreservedElementMetadata
  /** 原始 BPMNDiagram / BPMNPlane 元数据。 */
  diagram?: BpmnPreservedDiagramMetadata
  /** 原始 process 元数据列表。 */
  processes?: BpmnPreservedProcessMetadata[]
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
  /** 导入诊断结果。 */
  diagnostics?: BpmnImportDiagnostics
  /** 文档级元数据。 */
  metadata?: BpmnImportMetadata
}
