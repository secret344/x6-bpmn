/**
 * BPMN 2.0 网关（Gateway）图形注册
 *
 * 包含 6 种网关类型：排他、并行、包容、复杂、事件网关、排他事件网关。
 * 所有网关通过 createGatewayShape() 工厂函数统一创建。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_PARALLEL_GATEWAY,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  BPMN_PARALLEL_EVENT_BASED_GATEWAY,
} from '../utils/constants'
import { BPMN_PORTS, LABEL_BELOW } from './shared'

// ============================================================================
// 网关图形配置
// ============================================================================

/** 网关图形的配置参数 */
interface GatewayConfig {
  /** X6 图形注册名称 */
  shapeName: string
  /** 中心标记符号的 SVG 路径 */
  markerPath: string
  /** 默认标签 */
  label?: string
  /** 是否有外圈（事件网关特有） */
  outerCircle?: boolean
}

// ============================================================================
// 网关图形工厂函数
// ============================================================================

/**
 * 根据配置创建网关节点的完整注册参数。
 * 所有网关共享菱形外观，差异在于中心标记符号和是否有外圈。
 */

function createGatewayShape(config: GatewayConfig) {
  /* istanbul ignore next — label 默认值只服务内部工厂兜底，真实网关注册配置都会显式给出标签 */
  const { shapeName, markerPath, label = '', outerCircle = false } = config
  const { stroke, fill } = BPMN_COLORS.gateway

  // 构建 SVG markup：菱形主体 + 可选外圈 + 标记 + 标签
  const markup: Array<{ tagName: string; selector: string }> = [
    { tagName: 'polygon', selector: 'body' },
  ]

  if (outerCircle) {
    markup.push({ tagName: 'circle', selector: 'outerCircle' })
    markup.push({ tagName: 'circle', selector: 'innerCircle' })
  }

  markup.push({ tagName: 'path', selector: 'marker' })
  markup.push({ tagName: 'text', selector: 'label' })

  const attrs: Record<string, Record<string, unknown>> = {
    body: {
      refPoints: '0,0.5 0.5,0 1,0.5 0.5,1',  // 菱形的四个顶点
      fill, stroke,
      strokeWidth: 2,
    },
    marker: {
      d: markerPath,
      fill: 'none', stroke,
      strokeWidth: 2.5,
      refX: '20%', refY: '20%',
      transform: 'scale(0.6)',
    },
    label: { ...LABEL_BELOW, text: label },
  }

  // 事件网关的双圈标识
  if (outerCircle) {
    attrs.outerCircle = {
      refCx: '50%', refCy: '50%', r: 14,
      fill: 'none', stroke, strokeWidth: 1.5,
    }
    attrs.innerCircle = {
      refCx: '50%', refCy: '50%', r: 11,
      fill: 'none', stroke, strokeWidth: 1,
    }
  }

  return { shapeName, width: 50, height: 50, markup, attrs, ports: BPMN_PORTS }
}

// ============================================================================
// 注册所有网关图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 网关图形到 X6 全局注册表。
 * 共 6 种网关类型，通过数据驱动方式批量注册。
 */

export function registerGatewayShapes() {
  const gateways: GatewayConfig[] = [
    // 排他网关（×标记）
    { shapeName: BPMN_EXCLUSIVE_GATEWAY, markerPath: BPMN_ICONS.exclusiveX, label: 'Exclusive' },
    // 并行网关（+标记）
    { shapeName: BPMN_PARALLEL_GATEWAY, markerPath: BPMN_ICONS.parallelPlus, label: 'Parallel' },
    // 包容网关（○标记）
    { shapeName: BPMN_INCLUSIVE_GATEWAY, markerPath: BPMN_ICONS.inclusiveO, label: 'Inclusive' },
    // 复杂网关
    { shapeName: BPMN_COMPLEX_GATEWAY, markerPath: BPMN_ICONS.complex, label: 'Complex' },
    // 事件网关（带双圈）
    { shapeName: BPMN_EVENT_BASED_GATEWAY, markerPath: BPMN_ICONS.eventBased, label: 'Event-Based', outerCircle: true },
    // 排他事件网关（带双圈）
    { shapeName: BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY, markerPath: BPMN_ICONS.eventBased, label: 'Exclusive Event-Based', outerCircle: true },
    // 并行事件网关（带双圈，+ 标记，instantiate=true）
    { shapeName: BPMN_PARALLEL_EVENT_BASED_GATEWAY, markerPath: BPMN_ICONS.parallelPlus, label: 'Parallel Event-Based', outerCircle: true },
  ]

  for (const gw of gateways) {
    const nodeConfig = createGatewayShape(gw)
    const { shapeName, ...rest } = nodeConfig
    Graph.registerNode(shapeName, {
      inherit: 'polygon',
      ...rest,
    } as any, true)
  }
}
