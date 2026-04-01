/**
 * X6 Graph 绑定适配器
 *
 * 提供高层便捷 API，将 ProfileRegistry 中的 Profile 编译并绑定到 X6 Graph 实例。
 * 同时管理导入/导出适配器的注册与分发。
 */

import type { Graph } from '@antv/x6'
import type {
  ProfileContext,
  ExporterAdapter,
  ImporterAdapter,
} from '../../core/dialect/types'
import type { ProfileRegistry } from '../../core/dialect/registry'
import {
  createProfileContext,
  bindProfileToGraph,
  getProfileContext,
  unbindProfile,
} from '../../core/dialect/context'
import { createDialectDetector } from '../../core/dialect/detector'
import type { DialectDetector } from '../../core/dialect/detector'

// ============================================================================
// DialectManager — 高层方言管理器
// ============================================================================

/**
 * DialectManager 配置选项
 */
export interface DialectManagerOptions {
  /** Profile 注册表 */
  registry: ProfileRegistry
  /** 默认使用的方言 ID（当未指定时使用） */
  defaultDialect?: string
}

/**
 * DialectManager — 方言管理器
 *
 * 统一管理 Profile 注册、Graph 绑定、导入导出适配器。
 * 提供 one-liner 式的便捷 API。
 */
export class DialectManager {
  private registry: ProfileRegistry
  private defaultDialect: string
  private exporters = new Map<string, ExporterAdapter>()
  private importers = new Map<string, ImporterAdapter>()
  private detector: DialectDetector

  constructor(options: DialectManagerOptions) {
    this.registry = options.registry
    this.defaultDialect = options.defaultDialect ?? 'bpmn2'
    this.detector = createDialectDetector()
  }

  /**
   * 获取底层的 ProfileRegistry。
   */
  getRegistry(): ProfileRegistry {
    return this.registry
  }

  /**
   * 注册导出适配器。
   */
  registerExporter(adapter: ExporterAdapter): void {
    this.exporters.set(adapter.dialect, adapter)
  }

  /**
   * 注册导入适配器。
   */
  registerImporter(adapter: ImporterAdapter): void {
    this.importers.set(adapter.dialect, adapter)
  }

  /**
   * 将指定方言绑定到 Graph 实例。
   *
   * @param graph — X6 Graph 实例
   * @param dialectId — 方言 ID，不传则使用 defaultDialect
   * @returns ProfileContext — 运行时上下文
   */
  bind(graph: Graph, dialectId?: string): ProfileContext {
    const id = dialectId ?? this.defaultDialect
    const resolved = this.registry.compile(id)
    const context = createProfileContext(resolved)

    // 先解绑之前的 context（如果有）
    unbindProfile(graph)

    // 绑定新 context
    bindProfileToGraph(graph, context)

    return context
  }

  /**
   * 获取绑定到 Graph 的 ProfileContext。
   */
  getContext(graph: Graph): ProfileContext | undefined {
    return getProfileContext(graph)
  }

  /**
   * 解绑 Graph 的 ProfileContext。
   */
  unbind(graph: Graph): void {
    unbindProfile(graph)
  }

  /**
   * 导出 Graph 为 XML。
   *
   * 根据当前绑定的方言自动选择合适的导出适配器。
   *
   * @param graph — X6 Graph 实例
   * @param dialectId — 显式指定方言 ID（可选，默认使用当前绑定的方言）
   */
  async exportXML(graph: Graph, dialectId?: string): Promise<string> {
    const context = getProfileContext(graph)
    if (!context) {
      throw new Error('No profile bound to this graph. Call bind() first.')
    }

    const id = dialectId ?? context.profile.meta.id
    const exporter = this.findExporter(id)
    if (!exporter) {
      throw new Error(`No exporter adapter registered for dialect "${id}"`)
    }

    return exporter.exportXML(graph, context)
  }

  /**
   * 导入 XML 到 Graph。
   *
   * 可自动检测方言，或显式指定。
   *
   * @param graph — X6 Graph 实例
   * @param xml — XML 字符串
   * @param dialectId — 显式指定方言 ID（可选，默认自动检测）
   */
  async importXML(graph: Graph, xml: string, dialectId?: string): Promise<void> {
    let context = getProfileContext(graph)

    // 确定方言 ID（detect() 总返回 string，第二个 ?? 为防御性保底）
    /* c8 ignore next */
    const id = dialectId ?? this.detector.detect(xml) ?? this.defaultDialect

    // 如果还没绑定，或者方言不匹配，重新绑定
    if (!context || context.profile.meta.id !== id) {
      context = this.bind(graph, id)
    }

    const importer = this.findImporter(id)
    if (!importer) {
      throw new Error(`No importer adapter registered for dialect "${id}"`)
    }

    return importer.importXML(graph, xml, context)
  }

  /**
   * 查找适用的导出适配器。
   * 如果没有精确匹配，尝试沿继承链向上查找。
   */
  private findExporter(dialectId: string): ExporterAdapter | undefined {
    const direct = this.exporters.get(dialectId)
    if (direct) return direct

    // 尝试沿继承链向上查找
    try {
      const chain = this.registry.getInheritanceChain(dialectId)
      for (let i = chain.length - 1; i >= 0; i--) {
        const adapter = this.exporters.get(chain[i])
        if (adapter) return adapter
      }
    } /* c8 ignore next 3 */ catch {
      // 继承链不可用，降级为 undefined
    }
    return undefined
  }

  /**
   * 查找适用的导入适配器。
   * 如果没有精确匹配，尝试沿继承链向上查找。
   */
  private findImporter(dialectId: string): ImporterAdapter | undefined {
    const direct = this.importers.get(dialectId)
    if (direct) return direct

    // 尝试沿继承链向上查找
    try {
      const chain = this.registry.getInheritanceChain(dialectId)
      for (let i = chain.length - 1; i >= 0; i--) {
        const adapter = this.importers.get(chain[i])
        if (adapter) return adapter
      }
    } /* c8 ignore next 3 */ catch {
      // 继承链不可用，降级为 undefined
    }
    return undefined
  }
}

/**
 * 创建 DialectManager 实例。
 */
export function createDialectManager(options: DialectManagerOptions): DialectManager {
  return new DialectManager(options)
}
