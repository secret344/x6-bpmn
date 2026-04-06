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
  registerProfileCleanup,
  unbindProfile,
} from '../../core/dialect/context'
import { createDialectDetector } from '../../core/dialect/detector'
import type { DialectDetector } from '../../core/dialect/detector'
import {
  createContextValidateConnectionWithResult,
  createContextValidateEdgeWithResult,
} from '../../core/rules/validator'
import type { BpmnValidationResult } from '../../rules/connection-rules'
import { BPMN_SEQUENCE_FLOW } from '../../utils/constants'

type ValidateConnectionCallback = (args: any) => boolean
type ValidateEdgeCallback = (args: any) => boolean

type GraphWithOptions = Graph & {
  options?: {
    connecting?: {
      createEdge?: (...args: any[]) => any
      validateConnection?: ValidateConnectionCallback
      validateEdge?: ValidateEdgeCallback
    }
  }
}

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
  /** 自定义方言检测器，未提供时使用默认 detector */
  detector?: DialectDetector
  /** 是否在 bind() 时自动接入 graph.connecting.validateConnection，默认 true */
  autoBindValidateConnection?: boolean
  /** 自定义边类型解析函数，未提供时会尝试从 graph.connecting.createEdge 推断 */
  edgeShapeGetter?: (graph: Graph, args?: any, context?: ProfileContext) => string | undefined
  /** 最终连线失败时的错误回调，由宿主自行决定提示方式 */
  onValidationError?: (result: BpmnValidationResult, args: any, context: ProfileContext) => void
  /** 连线校验执行异常时的错误回调 */
  onValidationException?: (error: unknown, result: BpmnValidationResult, args: any, context: ProfileContext) => void
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
  private autoBindValidateConnection: boolean
  private edgeShapeGetter?: (graph: Graph, args?: any, context?: ProfileContext) => string | undefined
  private onValidationError?: (result: BpmnValidationResult, args: any, context: ProfileContext) => void
  private onValidationException?: (error: unknown, result: BpmnValidationResult, args: any, context: ProfileContext) => void

  constructor(options: DialectManagerOptions) {
    this.registry = options.registry
    this.defaultDialect = options.defaultDialect ?? 'bpmn2'
    this.detector = options.detector ?? createDialectDetector()
    this.autoBindValidateConnection = options.autoBindValidateConnection ?? true
    this.edgeShapeGetter = options.edgeShapeGetter
    this.onValidationError = options.onValidationError
    this.onValidationException = options.onValidationException
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
    this.bindValidateConnection(graph, context)

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
    /* v8 ignore next */ /* istanbul ignore next */
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
    } /* v8 ignore next 3 */ /* istanbul ignore next */ catch {
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
    } /* v8 ignore next 3 */ /* istanbul ignore next */ catch {
      // 继承链不可用，降级为 undefined
    }
    return undefined
  }

  private bindValidateConnection(graph: Graph, context: ProfileContext): void {
    if (!this.autoBindValidateConnection) return

    const graphWithOptions = graph as GraphWithOptions
    graphWithOptions.options = graphWithOptions.options ?? {}
    graphWithOptions.options.connecting = graphWithOptions.options.connecting ?? {}

    const connecting = graphWithOptions.options.connecting
    const previousValidateConnection = connecting.validateConnection
    const previousValidateEdge = connecting.validateEdge
    let currentEdgeShape = this.resolveEdgeShapeSafely(graph, context)
    const validateWithContext = createContextValidateConnectionWithResult(() => currentEdgeShape, context)
    const validateEdgeWithContext = createContextValidateEdgeWithResult(() => currentEdgeShape, context)
    const manager = this

    const managedValidateConnection: ValidateConnectionCallback = function(this: unknown, args: any): boolean {
      const previousResult = manager.runPreviousValidator(previousValidateConnection, this, args, context, '连接预校验')
      if (previousResult !== undefined) {
        return previousResult
      }

      currentEdgeShape = manager.resolveEdgeShapeSafely(graph, context, args)
      const result = validateWithContext(args)
      if (result.kind === 'exception') {
        manager.notifyValidationException(null, result, args, context)
      }
      return result.valid
    }

    connecting.validateConnection = managedValidateConnection

    const managedValidateEdge: ValidateEdgeCallback = function(this: unknown, args: any): boolean {
      const previousResult = manager.runPreviousValidator(previousValidateEdge, this, args, context, '连接终校验')
      if (previousResult !== undefined) {
        return previousResult
      }

      currentEdgeShape = manager.resolveEdgeShapeSafely(graph, context, args)
      const result = validateEdgeWithContext(args)
      if (!result.valid && result.kind === 'exception') {
        manager.notifyValidationException(null, result, args, context)
      } else if (!result.valid) {
        manager.notifyValidationError(result, args, context)
      }
      return result.valid
    }

    connecting.validateEdge = managedValidateEdge

    registerProfileCleanup(graph, () => {
      const activeConnecting = (graph as GraphWithOptions).options?.connecting
      if (!activeConnecting) return

      if (activeConnecting.validateConnection === managedValidateConnection && previousValidateConnection) {
        activeConnecting.validateConnection = previousValidateConnection
      } else if (activeConnecting.validateConnection === managedValidateConnection) {
        delete (activeConnecting as { validateConnection?: ValidateConnectionCallback }).validateConnection
      }

      if (activeConnecting.validateEdge === managedValidateEdge && previousValidateEdge) {
        activeConnecting.validateEdge = previousValidateEdge
      } else if (activeConnecting.validateEdge === managedValidateEdge) {
        delete (activeConnecting as { validateEdge?: ValidateEdgeCallback }).validateEdge
      }
    })
  }

  private resolveEdgeShape(graph: Graph, context: ProfileContext, args?: any): string {
    const edgeShape = typeof args?.edge?.getShape === 'function'
      ? args.edge.getShape()
      : args?.edge?.shape
    if (typeof edgeShape === 'string' && edgeShape.length > 0) return edgeShape

    const explicitEdgeShape = this.edgeShapeGetter?.(graph, args, context)
    if (explicitEdgeShape) return explicitEdgeShape

    const graphEdgeShape = this.resolveEdgeShapeFromConnecting(graph, args)
    if (graphEdgeShape) return graphEdgeShape

    return this.resolveDefaultEdgeShape(context)
  }

  private resolveEdgeShapeSafely(graph: Graph, context: ProfileContext, args?: any): string {
    try {
      return this.resolveEdgeShape(graph, context, args)
    } catch (error) {
      const result = this.createValidationExceptionResult(error, '边类型推断执行异常')
      if (args) {
        this.notifyValidationException(error, result, args, context)
      }
      return this.resolveDefaultEdgeShape(context)
    }
  }

  private resolveEdgeShapeFromConnecting(graph: Graph, args?: any): string | undefined {
    const createEdge = (graph as GraphWithOptions).options?.connecting?.createEdge
    if (typeof createEdge !== 'function') return undefined

    try {
      const edge = createEdge.call(graph, args?.sourceView, args?.sourceMagnet)
      const shape = typeof edge?.getShape === 'function'
        ? edge.getShape()
        : edge?.shape ?? edge?.prop?.shape

      edge?.dispose?.()

      return typeof shape === 'string' && shape.length > 0 ? shape : undefined
    } catch {
      return undefined
    }
  }

  private resolveDefaultEdgeShape(context: ProfileContext): string {
    const enabledEdges = Object.entries(context.profile.definitions.edges)
      .filter(([key]) => context.profile.availability.edges[key] !== 'disabled')
      .map(([, definition]) => definition)

    const sequenceFlowEdge = enabledEdges.find((definition) => definition.category === 'sequenceFlow')
    return sequenceFlowEdge?.shape ?? enabledEdges[0]?.shape ?? BPMN_SEQUENCE_FLOW
  }

  private runPreviousValidator(
    validator: ValidateConnectionCallback | ValidateEdgeCallback | undefined,
    thisArg: unknown,
    args: any,
    context: ProfileContext,
    phase: string,
  ): boolean | undefined {
    if (typeof validator !== 'function') return undefined

    try {
      if (validator.call(thisArg, args) === false) {
        return false
      }
      return undefined
    } catch (error) {
      const result = this.createValidationExceptionResult(error, `${phase}链路执行异常`)
      this.notifyValidationException(error, result, args, context)
      return false
    }
  }

  private createValidationExceptionResult(error: unknown, message: string): BpmnValidationResult {
    const detail = error instanceof Error && error.message ? `：${error.message}` : ''
    return {
      valid: false,
      reason: `${message}${detail}`,
      kind: 'exception',
    }
  }

  private notifyValidationError(result: BpmnValidationResult, args: any, context: ProfileContext): void {
    try {
      this.onValidationError?.(result, args, context)
    } catch {
      // 宿主错误提示回调不应打断校验主链路。
    }
  }

  private notifyValidationException(error: unknown, result: BpmnValidationResult, args: any, context: ProfileContext): void {
    try {
      this.onValidationException?.(error, result, args, context)
    } catch {
      // 宿主异常回调不应打断校验主链路。
    }
  }
}

/**
 * 创建 DialectManager 实例。
 */
export function createDialectManager(options: DialectManagerOptions): DialectManager {
  return new DialectManager(options)
}
