/**
 * BPMN 2.0 连线规则模块
 *
 * 统一导出连线规则定义和验证器的所有公开 API。
 *
 * @example
 * ```ts
 * import {
 *   validateBpmnConnection,
 *   createBpmnValidateConnection,
 *   getNodeCategory,
 *   DEFAULT_CONNECTION_RULES,
 * } from '@x6-bpmn2/plugin'
 * ```
 */

export {
  // 类型定义
  type BpmnNodeCategory,
  type BpmnConnectionRule,
  type BpmnValidationResult,
  // 核心数据
  DEFAULT_CONNECTION_RULES,
  // 工具函数
  getNodeCategory,
} from './connection-rules'

export {
  // 类型定义
  type BpmnConnectionContext,
  type BpmnValidateOptions,
  type X6ValidateConnectionArgs,
  // 核心验证函数
  validateBpmnConnection,
  // X6 适配封装
  createBpmnValidateConnection,
  createBpmnValidateConnectionWithResult,
} from './validator'
