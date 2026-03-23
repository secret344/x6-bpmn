/**
 * 序列化适配器接口
 *
 * 为不同的规则预设提供定制化的 BPMN XML 序列化和反序列化能力。
 * 每个规则预设可以定义自己的适配器来处理特定的命名空间、属性转换和扩展元素。
 *
 * 核心设计原则：
 * - BPMN 2.0 是稳定的基础层，只随 OMG 规范更新
 * - 每个规则预设（如 SmartEngine）都有独立的序列化适配器
 * - 适配器负责处理预设特定的扩展属性和命名空间
 */

import type { Node, Edge } from '@antv/x6'
import type { ModdleElement } from 'bpmn-moddle'
import type { BpmnModdle } from 'bpmn-moddle'

// ============================================================================
// 序列化上下文
// ============================================================================

/**
 * 导出上下文
 *
 * 在导出过程中提供给适配器的上下文信息
 */
export interface ExportContext {
  /** bpmn-moddle 实例 */
  moddle: BpmnModdle
  /** 当前正在处理的 X6 节点或边 */
  cell: Node | Edge
  /** 已创建的 BPMN moddle 元素 */
  element: ModdleElement
  /** 所有节点的映射表（cellId → moddleElement） */
  nodeElements: Map<string, ModdleElement>
}

/**
 * 导入上下文
 *
 * 在导入过程中提供给适配器的上下文信息
 */
export interface ImportContext {
  /** bpmn-moddle 实例 */
  moddle: BpmnModdle
  /** 当前正在处理的 BPMN moddle 元素 */
  element: ModdleElement
  /** 将要创建的 X6 节点或边的数据 */
  cellData: {
    /** 节点/边的 shape 名称 */
    shape?: string
    /** 节点/边的 ID */
    id?: string
    /** 节点/边的标签 */
    label?: string
    /** 节点/边的自定义数据 */
    data?: Record<string, any>
    /** 节点的属性 */
    attrs?: Record<string, any>
    /** 其他属性 */
    [key: string]: any
  }
}

// ============================================================================
// 序列化适配器接口
// ============================================================================

/**
 * 序列化适配器
 *
 * 为特定规则预设提供 BPMN XML 序列化和反序列化的定制化能力。
 * 适配器可以：
 * - 添加自定义命名空间
 * - 转换节点和边的属性
 * - 处理扩展元素（extensionElements）
 * - 在导出/导入前后执行自定义逻辑
 */
export interface SerializationAdapter {
  /**
   * 适配器名称（通常与规则预设名称一致）
   */
  name: string

  /**
   * 适配器描述
   */
  description?: string

  /**
   * 自定义命名空间定义
   *
   * 在导出 XML 时会自动添加到根元素的命名空间声明中。
   * 格式：{ prefix: namespaceUri }
   *
   * @example
   * ```ts
   * namespaces: {
   *   'smart': 'http://smartengine.alibaba.com/schema',
   *   'camunda': 'http://camunda.org/schema/1.0/bpmn'
   * }
   * ```
   */
  namespaces?: Record<string, string>

  /**
   * 在导出节点时调用
   *
   * 允许适配器修改或增强 BPMN moddle 元素，例如：
   * - 添加自定义属性（通过 $attrs）
   * - 添加扩展元素（extensionElements）
   * - 转换属性格式
   *
   * @param context 导出上下文
   */
  onExportNode?(context: ExportContext): void

  /**
   * 在导出边时调用
   *
   * 允许适配器修改或增强 BPMN 连接元素
   *
   * @param context 导出上下文
   */
  onExportEdge?(context: ExportContext): void

  /**
   * 在导入节点时调用
   *
   * 允许适配器从 BPMN moddle 元素中提取自定义属性，
   * 并将其转换为 X6 节点数据
   *
   * @param context 导入上下文
   */
  onImportNode?(context: ImportContext): void

  /**
   * 在导入边时调用
   *
   * 允许适配器从 BPMN 连接元素中提取自定义属性
   *
   * @param context 导入上下文
   */
  onImportEdge?(context: ImportContext): void

  /**
   * 在整个导出流程开始前调用
   *
   * 可用于初始化或预处理
   *
   * @param moddle bpmn-moddle 实例
   */
  beforeExport?(moddle: BpmnModdle): void

  /**
   * 在整个导出流程完成后调用
   *
   * 可用于清理或后处理
   *
   * @param xml 生成的 XML 字符串
   * @returns 可以返回修改后的 XML，或返回 undefined 使用原 XML
   */
  afterExport?(xml: string): string | undefined

  /**
   * 在整个导入流程开始前调用
   *
   * 可用于预处理 XML 或初始化
   *
   * @param xml 输入的 XML 字符串
   * @param moddle bpmn-moddle 实例
   * @returns 可以返回修改后的 XML，或返回 undefined 使用原 XML
   */
  beforeImport?(xml: string, moddle: BpmnModdle): string | undefined

  /**
   * 在整个导入流程完成后调用
   *
   * 可用于清理或后处理
   */
  afterImport?(): void
}

// ============================================================================
// 适配器注册和管理
// ============================================================================

/** 已注册的序列化适配器表（name → adapter） */
const adapterRegistry = new Map<string, SerializationAdapter>()

/**
 * 注册序列化适配器
 *
 * @param adapter 要注册的适配器
 * @throws 如果适配器名称已存在，将抛出错误
 *
 * @example
 * ```ts
 * registerSerializationAdapter({
 *   name: 'smartengine',
 *   namespaces: { smart: 'http://smartengine.alibaba.com/schema' },
 *   onExportNode: (ctx) => {
 *     // 处理 SmartEngine 特定的属性
 *   }
 * })
 * ```
 */
export function registerSerializationAdapter(adapter: SerializationAdapter): void {
  if (adapterRegistry.has(adapter.name)) {
    throw new Error(`序列化适配器 "${adapter.name}" 已注册，请使用不同的名称或先调用 unregisterSerializationAdapter() 移除`)
  }
  adapterRegistry.set(adapter.name, adapter)
}

/**
 * 移除已注册的序列化适配器
 *
 * @param name 适配器名称
 * @returns 是否成功移除
 */
export function unregisterSerializationAdapter(name: string): boolean {
  return adapterRegistry.delete(name)
}

/**
 * 获取已注册的序列化适配器
 *
 * @param name 适配器名称
 * @returns 适配器实例，不存在时返回 undefined
 */
export function getSerializationAdapter(name: string): SerializationAdapter | undefined {
  return adapterRegistry.get(name)
}

/**
 * 列出所有已注册适配器的名称
 */
export function listSerializationAdapters(): string[] {
  return Array.from(adapterRegistry.keys())
}

/**
 * 清除所有已注册的序列化适配器
 *
 * 通常仅用于测试场景。
 */
export function clearSerializationAdapters(): void {
  adapterRegistry.clear()
}
