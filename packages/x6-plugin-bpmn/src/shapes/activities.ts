/**
 * BPMN 2.0 活动（Activity）图形注册
 *
 * 包含以下图形：
 * - 任务（Task）：基本任务、用户任务、服务任务、脚本任务、业务规则任务、发送任务、接收任务、手工任务
 * - 子流程（Sub-Process）：标准子流程、事件子流程、事务、自由子流程
 * - 调用活动（Call Activity）
 *
 * 所有任务类图形通过 createTaskShape() 工厂函数统一创建，减少重复代码。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
} from '../utils/constants'
import { BPMN_PORTS, LABEL_CENTER, LABEL_TOP } from './shared'

// ============================================================================
// 任务图形配置接口
// ============================================================================

/** 任务图形的配置参数 */
interface TaskConfig {
  /** X6 图形注册名称 */
  shapeName: string
  /** 左上角图标的 SVG 路径（可选，无图标则不显示） */
  iconPath?: string
  /** 默认显示标签 */
  label?: string
}

// ============================================================================
// 任务图形工厂函数
// ============================================================================

/**
 * 根据配置创建一个任务类节点的完整注册参数。
 * 所有任务共享相同的圆角矩形外观、端口配置和标签样式，
 * 唯一的差异是左上角的类型标识图标。
 */
function createTaskShape(config: TaskConfig) {
  /* istanbul ignore next — label 默认值仅是内部工厂兜底，公开注册路径始终传入明确任务标签 */
  const { shapeName, iconPath, label = '' } = config
  const { stroke, fill } = BPMN_COLORS.task

  // 构建 SVG markup：主体矩形 + 可选图标 + 标签文本
  const markup: Array<{ tagName: string; selector: string }> = [
    { tagName: 'rect', selector: 'body' },
  ]
  if (iconPath) {
    markup.push({ tagName: 'path', selector: 'icon' })
  }
  markup.push({ tagName: 'text', selector: 'label' })

  // 构建属性集合（使用共享标签样式）
  const attrs: Record<string, Record<string, unknown>> = {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      rx: 8, ry: 8,
      fill, stroke,
      strokeWidth: 2,
    },
    label: { ...LABEL_CENTER, text: label },
  }

  // 类型标识图标（左上角小图标）
  if (iconPath) {
    attrs.icon = {
      d: iconPath,
      fill: 'none',
      stroke: '#666',
      strokeWidth: 1.2,
      refX: 6, refY: 6,
      transform: 'scale(0.7)',
    }
  }

  return { shapeName, width: 100, height: 60, markup, attrs, ports: BPMN_PORTS }
}

// ============================================================================
// 注册所有活动类图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 活动类图形到 X6 全局注册表。
 * 包括 8 种任务、4 种子流程和 1 种调用活动。
 */
export function registerActivityShapes() {
  // ==================== 任务类图形 ====================
  // 通过统一配置数组 + 工厂函数批量注册，减少重复代码
  const tasks: TaskConfig[] = [
    { shapeName: BPMN_TASK, label: 'Task' },
    { shapeName: BPMN_USER_TASK, iconPath: BPMN_ICONS.user, label: 'User Task' },
    { shapeName: BPMN_SERVICE_TASK, iconPath: BPMN_ICONS.service, label: 'Service Task' },
    { shapeName: BPMN_SCRIPT_TASK, iconPath: BPMN_ICONS.script, label: 'Script Task' },
    { shapeName: BPMN_BUSINESS_RULE_TASK, iconPath: BPMN_ICONS.businessRule, label: 'Business Rule' },
    { shapeName: BPMN_SEND_TASK, iconPath: BPMN_ICONS.send, label: 'Send Task' },
    { shapeName: BPMN_RECEIVE_TASK, iconPath: BPMN_ICONS.receive, label: 'Receive Task' },
    { shapeName: BPMN_MANUAL_TASK, iconPath: BPMN_ICONS.manual, label: 'Manual Task' },
  ]

  for (const task of tasks) {
    const nodeConfig = createTaskShape(task)
    const { shapeName, ...rest } = nodeConfig
    Graph.registerNode(shapeName, { inherit: 'rect', ...rest } as any, true)
  }

  // ==================== 子流程（Sub-Process） ====================
  // 带折叠标记的标准子流程容器
  Graph.registerNode(BPMN_SUB_PROCESS, {
    inherit: 'rect',
    width: 200,
    height: 120,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'path', selector: 'marker' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 8,
        ry: 8,
        fill: BPMN_COLORS.subProcess.fill,
        stroke: BPMN_COLORS.subProcess.stroke,
        strokeWidth: 2,
      },
      label: { ...LABEL_TOP, text: 'Sub-Process' },
      marker: {
        d: BPMN_ICONS.collapse,
        fill: 'none',
        stroke: '#666',
        strokeWidth: 1,
        refX: '50%',
        refY: '100%',
        transform: 'translate(-7, -22) scale(0.7)',
      },
    },
    ports: BPMN_PORTS,
  }, true)

  // ==================== 事件子流程（Event Sub-Process） ====================
  // 虚线边框，表示由事件触发的子流程
  Graph.registerNode(BPMN_EVENT_SUB_PROCESS, {
    inherit: 'rect',
    width: 200,
    height: 120,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 8,
        ry: 8,
        fill: BPMN_COLORS.subProcess.fill,
        stroke: BPMN_COLORS.subProcess.stroke,
        strokeWidth: 2,
        strokeDasharray: '8,4',
      },
      label: { ...LABEL_TOP, text: 'Event Sub-Process' },
    },
    ports: BPMN_PORTS,
  }, true)

  // ==================== 事务（Transaction） ====================
  // 双层边框标识，支持 ACID 事务语义
  Graph.registerNode(BPMN_TRANSACTION, {
    inherit: 'rect',
    width: 200,
    height: 120,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'innerRect' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 8,
        ry: 8,
        fill: BPMN_COLORS.subProcess.fill,
        stroke: BPMN_COLORS.subProcess.stroke,
        strokeWidth: 2,
      },
      innerRect: {
        refWidth: '94%',
        refHeight: '90%',
        refX: '3%',
        refY: '5%',
        rx: 6,
        ry: 6,
        fill: 'none',
        stroke: BPMN_COLORS.subProcess.stroke,
        strokeWidth: 1,
      },
      label: { ...LABEL_TOP, refY: 14, text: 'Transaction' },
    },
    ports: BPMN_PORTS,
  }, true)

  // ==================== 自由子流程（Ad-Hoc Sub-Process） ====================
  // 底部带波浪线标记，表示内部活动无固定执行顺序
  Graph.registerNode(BPMN_AD_HOC_SUB_PROCESS, {
    inherit: 'rect',
    width: 200,
    height: 120,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
      { tagName: 'path', selector: 'marker' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 8,
        ry: 8,
        fill: BPMN_COLORS.subProcess.fill,
        stroke: BPMN_COLORS.subProcess.stroke,
        strokeWidth: 2,
      },
      label: { ...LABEL_TOP, text: 'Ad-Hoc Sub-Process' },
      marker: {
        d: BPMN_ICONS.adHoc,
        fill: 'none',
        stroke: '#666',
        strokeWidth: 1.5,
        refX: '50%',
        refY: '100%',
        transform: 'translate(-7, -22) scale(0.7)',
      },
    },
    ports: BPMN_PORTS,
  }, true)

  // ==================== 调用活动（Call Activity） ====================
  // 粗边框标识，表示调用外部定义的流程或全局任务
  Graph.registerNode(BPMN_CALL_ACTIVITY, {
    inherit: 'rect',
    width: 100,
    height: 60,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 8,
        ry: 8,
        fill: BPMN_COLORS.callActivity.fill,
        stroke: BPMN_COLORS.callActivity.stroke,
        strokeWidth: 4,  // 粗边框是调用活动的标志
      },
      label: { ...LABEL_CENTER, text: 'Call Activity' },
    },
    ports: BPMN_PORTS,
  }, true)
}
