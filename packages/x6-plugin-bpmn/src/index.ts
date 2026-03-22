/**
 * @x6-bpmn2/plugin 入口文件
 *
 * 提供 BPMN 2.0 图形注册和所有公开 API 的统一导出。
 * 调用 registerBpmnShapes() 即可将所有 BPMN 图形注册到 X6 全局注册表。
 */

import {
  registerEventShapes,
  registerActivityShapes,
  registerGatewayShapes,
  registerDataShapes,
  registerArtifactShapes,
  registerSwimlaneShapes,
} from './shapes'
import { registerConnectionShapes } from './connections'

// 重新导出所有子模块的公开 API
export * from './utils/constants'
export * from './shapes'
export * from './connections'
export * from './export'
export * from './config'
export * from './rules'
export * from './behaviors'

// ============================================================================
// BpmnPlugin — 统一注册所有 BPMN 2.0 图形的插件函数
// ============================================================================

/** 插件配置选项，可按类别开关图形注册 */
export interface BpmnPluginOptions {
  /** 是否注册事件图形（开始、中间、结束、边界），默认 true */
  events?: boolean
  /** 是否注册活动图形（任务、子流程等），默认 true */
  activities?: boolean
  /** 是否注册网关图形，默认 true */
  gateways?: boolean
  /** 是否注册数据元素图形，默认 true */
  data?: boolean
  /** 是否注册工件图形（文本注释、分组），默认 true */
  artifacts?: boolean
  /** 是否注册泳道图形（池、泳道），默认 true */
  swimlanes?: boolean
  /** 是否注册连接线图形（顺序流、消息流、关联），默认 true */
  connections?: boolean
}

/** 防止重复注册的标志 */
let registered = false

/**
 * 注册所有 BPMN 2.0 图形和连接线到 X6 全局注册表。
 * 多次调用安全，图形仅注册一次。
 */
export function registerBpmnShapes(options: BpmnPluginOptions = {}) {
  if (registered) return
  registered = true

  const {
    events = true,
    activities = true,
    gateways = true,
    data = true,
    artifacts = true,
    swimlanes = true,
    connections = true,
  } = options

  if (events) registerEventShapes()
  if (activities) registerActivityShapes()
  if (gateways) registerGatewayShapes()
  if (data) registerDataShapes()
  if (artifacts) registerArtifactShapes()
  if (swimlanes) registerSwimlaneShapes()
  if (connections) registerConnectionShapes()
}

/**
 * 强制重新注册所有图形（适用于热更新 / 开发场景）。
 */
export function forceRegisterBpmnShapes(options: BpmnPluginOptions = {}) {
  registered = false
  registerBpmnShapes(options)
}
