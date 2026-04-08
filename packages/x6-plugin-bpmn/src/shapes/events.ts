/**
 * BPMN 2.0 事件（Event）图形注册
 *
 * 包含 5 大类事件：开始、中间抛出、中间捕获、边界、结束。
 * 每类事件按事件定义类型（消息、定时、信号等）细分为多种变体，
 * 共计 54 种事件图形，通过数据驱动方式统一注册。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_START_EVENT,
  BPMN_START_EVENT_MESSAGE,
  BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL,
  BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE,
  BPMN_START_EVENT_PARALLEL_MULTIPLE,
  BPMN_INTERMEDIATE_THROW_EVENT,
  BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_THROW_EVENT_LINK,
  BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT,
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
  BPMN_INTERMEDIATE_CATCH_EVENT_ERROR,
  BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
  BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT,
  BPMN_BOUNDARY_EVENT_MESSAGE,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ESCALATION,
  BPMN_BOUNDARY_EVENT_CONDITIONAL,
  BPMN_BOUNDARY_EVENT_ERROR,
  BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_BOUNDARY_EVENT_COMPENSATION,
  BPMN_BOUNDARY_EVENT_SIGNAL,
  BPMN_BOUNDARY_EVENT_MULTIPLE,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING,
  BPMN_END_EVENT,
  BPMN_END_EVENT_MESSAGE,
  BPMN_END_EVENT_ESCALATION,
  BPMN_END_EVENT_ERROR,
  BPMN_END_EVENT_CANCEL,
  BPMN_END_EVENT_COMPENSATION,
  BPMN_END_EVENT_SIGNAL,
  BPMN_END_EVENT_TERMINATE,
  BPMN_END_EVENT_MULTIPLE,
} from '../utils/constants'
import { BPMN_PORTS, LABEL_BELOW } from './shared'

// ============================================================================
// 事件 SVG 标记构建器
// ============================================================================

/**
 * 构建事件节点的 SVG markup 和 attrs。
 *
 * BPMN 事件图形的通用结构：
 * - 外圈椭圆（body）— 所有事件都有
 * - 内圈椭圆（innerCircle）— 中间事件和边界事件有双圈
 * - 图标路径（icon）— 表示事件定义类型（消息、定时等）
 * - 文字标签（label）— 显示在图形底部
 */

function buildEventMarkup(
  options: {
    /** 是否显示双圈（中间事件/边界事件为 true） */
    doubleCircle?: boolean
    /** 外圈线宽（结束事件为 3，其他为 2） */
    strokeWidth?: number
    /** 是否虚线边框（非中断边界事件为 true） */
    dashed?: boolean
    /** 事件定义图标的 SVG 路径 */
    iconPath?: string
    /** 图标是否为填充样式（抛出/结束事件为 true） */
    iconFilled?: boolean
  } = {},
) {
  const { doubleCircle = false, strokeWidth = 2, dashed = false, iconPath, iconFilled = false } = options
  // 按层次构建 SVG 元素列表
  const markup: Array<{ tagName: string; selector: string }> = [
    {
      tagName: 'ellipse',
      selector: 'body',
    },
  ]

  if (doubleCircle) {
    markup.push({
      tagName: 'ellipse',
      selector: 'innerCircle',
    })
  }

  if (iconPath) {
    markup.push({
      tagName: 'path',
      selector: 'icon',
    })
  }

  markup.push({
    tagName: 'text',
    selector: 'label',
  })

  // 外圈属性
  const bodyAttrs: Record<string, unknown> = {
    refCx: '50%',
    refCy: '50%',
    refRx: '50%',
    refRy: '50%',
    strokeWidth,
    ...(dashed ? { strokeDasharray: '5,3' } : {}),
  }

  const attrs: Record<string, Record<string, unknown>> = {
    body: bodyAttrs,
    label: { ...LABEL_BELOW },
  }

  // 内圈属性（中间/边界事件的双圈效果）
  if (doubleCircle) {
    attrs.innerCircle = {
      refCx: '50%',
      refCy: '50%',
      refRx: '40%',
      refRy: '40%',
      strokeWidth: 1,
      fill: 'none',
      ...(dashed ? { strokeDasharray: '5,3' } : {}),
    }
  }

  // 事件定义图标属性
  if (iconPath) {
    attrs.icon = {
      d: iconPath,
      refX: '25%',
      refY: '25%',
      strokeWidth: iconFilled ? 0 : 1.5,
      fill: iconFilled ? '' : 'none',
      transform: 'scale(0.5)',
    }
  }

  return { markup, attrs }
}

// ============================================================================
// 事件节点配置工厂
// ============================================================================

/** 单个事件图形的完整配置参数 */
interface EventConfig {
  /** X6 图形注册名称 */
  shapeName: string
  /** 边框颜色 */
  stroke: string
  /** 填充颜色 */
  fill: string
  /** 边框线宽（默认 2，结束事件为 3） */
  strokeWidth?: number
  /** 是否双圈（默认 false） */
  doubleCircle?: boolean
  /** 是否虚线（默认 false） */
  dashed?: boolean
  /** 事件定义图标路径 */
  iconPath?: string
  /** 图标是否填充 */
  iconFilled?: boolean
  /** 默认标签 */
  label?: string
}

/**
 * 根据配置创建事件节点的完整注册参数。
 * 统一处理颜色赋值、图标填充方式和端口配置。
 */

function createEventNodeConfig(config: EventConfig) {
  /* istanbul ignore next — label 等默认值仅对应内部工厂的可选配置，不值得为覆盖率构造非业务场景 */
  const { shapeName, stroke, fill, strokeWidth = 2, doubleCircle = false, dashed = false, iconPath, iconFilled = false, label = '' } = config
  const markupOptions = doubleCircle || strokeWidth !== 2 || dashed || Boolean(iconPath) || iconFilled
    ? { doubleCircle, strokeWidth, dashed, iconPath, iconFilled }
    : undefined
  const { markup, attrs } = buildEventMarkup(markupOptions)

  // 设置颜色
  attrs.body.stroke = stroke
  attrs.body.fill = fill
  if (attrs.innerCircle) {
    attrs.innerCircle.stroke = stroke
  }
  if (attrs.icon) {
    attrs.icon[iconFilled ? 'fill' : 'stroke'] = stroke
  }

  return {
    shapeName,
    width: 36, height: 36,
    markup, attrs,
    data: { label },
    ports: BPMN_PORTS,
  }
}

// ============================================================================
// 注册所有事件图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 事件图形到 X6 全局注册表。
 * 共计 54 种事件变体，通过数据驱动方式统一注册。
 */
export function registerEventShapes() {
  const { startEvent, intermediateEvent, endEvent, boundaryEvent } = BPMN_COLORS

  // ==================== 开始事件 ====================
  // 单圈、绿色边框，表示流程的起始点
  const startEvents: EventConfig[] = [
    { shapeName: BPMN_START_EVENT, stroke: startEvent.stroke, fill: startEvent.fill, label: 'Start' },
    { shapeName: BPMN_START_EVENT_MESSAGE, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.message, label: 'Message Start' },
    { shapeName: BPMN_START_EVENT_TIMER, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.timer, label: 'Timer Start' },
    { shapeName: BPMN_START_EVENT_CONDITIONAL, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.conditional, label: 'Conditional Start' },
    { shapeName: BPMN_START_EVENT_SIGNAL, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.signal, label: 'Signal Start' },
    { shapeName: BPMN_START_EVENT_MULTIPLE, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.multiple, label: 'Multiple Start' },
    { shapeName: BPMN_START_EVENT_PARALLEL_MULTIPLE, stroke: startEvent.stroke, fill: startEvent.fill, iconPath: BPMN_ICONS.parallelMultiple, label: 'Parallel Multiple Start' },
  ]

  // ==================== 中间抛出事件 ====================
  // 双圈、蓝色边框、填充图标，表示主动触发的中间信号
  const intermediateThrowEvents: EventConfig[] = [
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, label: 'Intermediate Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.messageFilled, iconFilled: true, label: 'Message Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.escalationFilled, iconFilled: true, label: 'Escalation Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_LINK, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.link, iconFilled: true, label: 'Link Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.compensationFilled, iconFilled: true, label: 'Compensation Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.signalFilled, iconFilled: true, label: 'Signal Throw' },
    { shapeName: BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.multipleFilled, iconFilled: true, label: 'Multiple Throw' },
  ]

  // ==================== 中间捕获事件 ====================
  // 双圈、蓝色边框、空心图标，表示等待外部信号触发
  const intermediateCatchEvents: EventConfig[] = [
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, label: 'Intermediate Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.message, label: 'Message Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.timer, label: 'Timer Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.escalation, label: 'Escalation Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.conditional, label: 'Conditional Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_LINK, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.link, label: 'Link Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.error, label: 'Error Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.cancel, label: 'Cancel Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.compensation, label: 'Compensation Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.signal, label: 'Signal Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.multiple, label: 'Multiple Catch' },
    { shapeName: BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE, stroke: intermediateEvent.stroke, fill: intermediateEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.parallelMultiple, label: 'Parallel Multiple Catch' },
  ]

  // ==================== 边界事件 ====================
  // 双圈、橙色边框，附着在活动图形边缘
  const boundaryEvents: EventConfig[] = [
    { shapeName: BPMN_BOUNDARY_EVENT, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, label: 'Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_MESSAGE, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.message, label: 'Message Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_TIMER, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.timer, label: 'Timer Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_ESCALATION, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.escalation, label: 'Escalation Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_CONDITIONAL, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.conditional, label: 'Conditional Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_ERROR, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.error, label: 'Error Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_CANCEL, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.cancel, label: 'Cancel Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_COMPENSATION, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.compensation, label: 'Compensation Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_SIGNAL, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.signal, label: 'Signal Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_MULTIPLE, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.multiple, label: 'Multiple Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, iconPath: BPMN_ICONS.parallelMultiple, label: 'Parallel Multiple Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, label: 'Non-Interrupting Boundary' },
    // 按类型区分的非中断边界事件（虚线双圈）
    { shapeName: BPMN_BOUNDARY_EVENT_MESSAGE_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.message, label: 'Message Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_TIMER_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.timer, label: 'Timer Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_ESCALATION_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.escalation, label: 'Escalation Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_CONDITIONAL_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.conditional, label: 'Conditional Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_SIGNAL_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.signal, label: 'Signal Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_MULTIPLE_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.multiple, label: 'Multiple Non-Interrupting Boundary' },
    { shapeName: BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE_NON_INTERRUPTING, stroke: boundaryEvent.stroke, fill: boundaryEvent.fill, doubleCircle: true, dashed: true, iconPath: BPMN_ICONS.parallelMultiple, label: 'Parallel Multiple Non-Interrupting Boundary' },
  ]

  // ==================== 结束事件 ====================
  // 单圈粗边框（strokeWidth: 3）、红色、填充图标
  const endEvents: EventConfig[] = [
    { shapeName: BPMN_END_EVENT, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, label: 'End' },
    { shapeName: BPMN_END_EVENT_MESSAGE, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.messageFilled, iconFilled: true, label: 'Message End' },
    { shapeName: BPMN_END_EVENT_ESCALATION, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.escalationFilled, iconFilled: true, label: 'Escalation End' },
    { shapeName: BPMN_END_EVENT_ERROR, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.error, iconFilled: true, label: 'Error End' },
    { shapeName: BPMN_END_EVENT_CANCEL, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.cancelFilled, iconFilled: true, label: 'Cancel End' },
    { shapeName: BPMN_END_EVENT_COMPENSATION, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.compensationFilled, iconFilled: true, label: 'Compensation End' },
    { shapeName: BPMN_END_EVENT_SIGNAL, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.signalFilled, iconFilled: true, label: 'Signal End' },
    { shapeName: BPMN_END_EVENT_TERMINATE, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.terminate, iconFilled: true, label: 'Terminate End' },
    { shapeName: BPMN_END_EVENT_MULTIPLE, stroke: endEvent.stroke, fill: endEvent.fill, strokeWidth: 3, iconPath: BPMN_ICONS.multipleFilled, iconFilled: true, label: 'Multiple End' },
  ]

  // 合并所有事件配置，统一注册
  const allEvents = [
    ...startEvents,
    ...intermediateThrowEvents,
    ...intermediateCatchEvents,
    ...boundaryEvents,
    ...endEvents,
  ]

  for (const eventConfig of allEvents) {
    const nodeConfig = createEventNodeConfig(eventConfig)
    const { shapeName, ...restConfig } = nodeConfig
    Graph.registerNode(shapeName, {
      inherit: 'ellipse',
      ...restConfig,
    } as any, true)
  }
}
