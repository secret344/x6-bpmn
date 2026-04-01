/**
 * 核心渲染层 — 节点渲染器工厂
 *
 * 为不同类型的 BPMN 节点提供渲染器工厂函数。
 * 渲染器根据 ThemeTokens 和 NodeDefinition 生成 X6 ShapeDefinition。
 */

import type { ThemeTokens, NodeDefinition, ShapeDefinition, NodeRendererFactory } from '../dialect/types'
import { BPMN_PORTS, LABEL_CENTER, LABEL_BELOW, LABEL_TOP } from '../../shapes/shared'

// ============================================================================
// 事件渲染器
// ============================================================================

/** 创建事件节点渲染器（圆形节点） */
function createEventRenderer(
  eventType: 'start' | 'intermediate' | 'end' | 'boundary',
): NodeRendererFactory {
  return (tokens: ThemeTokens, node: NodeDefinition): ShapeDefinition => {
    const colorKey = `${eventType}Event`
    const colorSet = tokens.colors[colorKey] || { stroke: '#333', fill: '#fff' }
    const strokeWidth = eventType === 'end' ? 3 : eventType === 'start' ? 2 : 1.5

    // 从 shape 名称提取事件定义类型以确定图标
    const shapeName = node.shape
    let iconPath = ''
    const iconKeys = [
      'message', 'timer', 'signal', 'error', 'escalation',
      'conditional', 'link', 'compensation', 'cancel', 'terminate',
      'multiple', 'parallelMultiple',
    ]
    for (const key of iconKeys) {
      if (shapeName.includes(key.toLowerCase().replace('multiple', 'multiple'))) {
        // 结束和抛出事件使用实心图标
        const isFilled = eventType === 'end' || shapeName.includes('throw')
        const filledKey = `${key}Filled`
        iconPath = isFilled && tokens.icons[filledKey]
          ? tokens.icons[filledKey]
          : tokens.icons[key] || ''
        break
      }
    }

    const isNonInterrupting = shapeName.includes('non-interrupting')

    const markup: any[] = [
      { tagName: 'circle', selector: 'body' },
    ]
    const attrs: Record<string, Record<string, unknown>> = {
      body: {
        r: 18,
        cx: 18,
        cy: 18,
        fill: colorSet.fill,
        stroke: colorSet.stroke,
        strokeWidth,
        strokeDasharray: isNonInterrupting ? '4,2' : undefined,
      },
      label: { ...LABEL_BELOW },
    }

    if (iconPath) {
      markup.push({ tagName: 'path', selector: 'icon' })
      attrs.icon = {
        d: iconPath,
        fill: 'none',
        stroke: colorSet.stroke,
        strokeWidth: 1.5,
        refX: '50%',
        refY: '50%',
        resetOffset: true,
      }
    }

    if (eventType === 'intermediate' || eventType === 'boundary') {
      markup.push({ tagName: 'circle', selector: 'innerCircle' })
      attrs.innerCircle = {
        r: 15,
        cx: 18,
        cy: 18,
        fill: 'none',
        stroke: colorSet.stroke,
        strokeWidth: 1,
      }
    }

    markup.push({ tagName: 'text', selector: 'label' })

    return {
      inherit: 'rect',
      width: 36,
      height: 36,
      markup,
      attrs,
      ports: { ...BPMN_PORTS },
    }
  }
}

// ============================================================================
// 活动渲染器
// ============================================================================

/** 创建任务节点渲染器 */
function createTaskRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.task || { stroke: '#1565c0', fill: '#bbdefb', headerFill: '#42a5f5' }
    const shapeName = node.shape

    // 根据任务类型确定图标
    const taskIconMap: Record<string, string> = {
      'user-task': 'user',
      'service-task': 'service',
      'script-task': 'script',
      'business-rule-task': 'businessRule',
      'send-task': 'send',
      'receive-task': 'receive',
      'manual-task': 'manual',
    }

    let iconPath = ''
    for (const [suffix, iconKey] of Object.entries(taskIconMap)) {
      if (shapeName.includes(suffix)) {
        iconPath = tokens.icons[iconKey] || ''
        break
      }
    }

    const markup: any[] = [
      { tagName: 'rect', selector: 'body' },
    ]
    const attrs: Record<string, Record<string, unknown>> = {
      body: {
        rx: 6,
        ry: 6,
        fill: colorSet.fill,
        stroke: colorSet.stroke,
        strokeWidth: 2,
      },
      label: { ...LABEL_CENTER },
    }

    if (iconPath) {
      markup.push({ tagName: 'path', selector: 'icon' })
      attrs.icon = {
        d: iconPath,
        fill: 'none',
        stroke: colorSet.stroke,
        strokeWidth: 1,
        refX: 6,
        refY: 6,
      }
    }

    markup.push({ tagName: 'text', selector: 'label' })

    return {
      inherit: 'rect',
      width: 100,
      height: 60,
      markup,
      attrs,
      ports: { ...BPMN_PORTS },
    }
  }
}

/** 创建子流程渲染器 */
function createSubProcessRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.subProcess || { stroke: '#1565c0', fill: '#e3f2fd' }

    return {
      inherit: 'rect',
      width: 200,
      height: 150,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: {
          rx: 6,
          ry: 6,
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 2,
        },
        label: { ...LABEL_TOP },
      },
      ports: { ...BPMN_PORTS },
    }
  }
}

// ============================================================================
// 网关渲染器
// ============================================================================

/** 创建网关渲染器 */
function createGatewayRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.gateway || { stroke: '#f9a825', fill: '#fffde7' }
    const shapeName = node.shape

    // 确定网关内部图标
    const gatewayIconMap: Record<string, string> = {
      'exclusive-gateway': 'exclusiveX',
      'parallel-gateway': 'parallelPlus',
      'inclusive-gateway': 'inclusiveO',
      'complex-gateway': 'complex',
      'event-based-gateway': 'eventBased',
      'exclusive-event-based': 'eventBased',
    }

    let iconPath = ''
    for (const [suffix, iconKey] of Object.entries(gatewayIconMap)) {
      if (shapeName.includes(suffix)) {
        iconPath = tokens.icons[iconKey] || ''
        break
      }
    }

    const markup: any[] = [
      { tagName: 'polygon', selector: 'body' },
    ]
    const attrs: Record<string, Record<string, unknown>> = {
      body: {
        points: '25,0 50,25 25,50 0,25',
        fill: colorSet.fill,
        stroke: colorSet.stroke,
        strokeWidth: 2,
      },
      label: { ...LABEL_BELOW },
    }

    if (iconPath) {
      markup.push({ tagName: 'path', selector: 'icon' })
      attrs.icon = {
        d: iconPath,
        fill: 'none',
        stroke: colorSet.stroke,
        strokeWidth: 2,
        refX: '50%',
        refY: '50%',
        resetOffset: true,
      }
    }

    markup.push({ tagName: 'text', selector: 'label' })

    return {
      inherit: 'polygon',
      width: 50,
      height: 50,
      markup,
      attrs,
      ports: { ...BPMN_PORTS },
    }
  }
}

// ============================================================================
// 数据元素渲染器
// ============================================================================

/** 创建数据元素渲染器 */
function createDataRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.data || { stroke: '#616161', fill: '#fafafa' }

    return {
      inherit: 'rect',
      width: 40,
      height: 50,
      markup: [
        { tagName: 'path', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: {
          d: 'M 0 5 L 0 50 L 40 50 L 40 10 L 30 0 L 0 0 Z M 30 0 L 30 10 L 40 10',
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 1.5,
        },
        label: { ...LABEL_BELOW },
      },
      ports: { ...BPMN_PORTS },
    }
  }
}

// ============================================================================
// 工件渲染器
// ============================================================================

/** 创建文本注释渲染器 */
function createAnnotationRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.annotation || { stroke: '#9e9e9e', fill: '#ffffff' }

    return {
      inherit: 'rect',
      width: 100,
      height: 30,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: {
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 1,
        },
        label: { ...LABEL_CENTER, fontSize: 12 },
      },
    }
  }
}

/** 创建分组渲染器 */
function createGroupRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.group || { stroke: '#9e9e9e', fill: 'transparent' }

    return {
      inherit: 'rect',
      width: 200,
      height: 150,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: {
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 1.5,
          strokeDasharray: '8,4',
          rx: 6,
          ry: 6,
        },
        label: { ...LABEL_TOP },
      },
    }
  }
}

// ============================================================================
// 泳道渲染器
// ============================================================================

/** 创建池渲染器 */
function createPoolRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.pool || { stroke: '#424242', fill: '#fafafa', headerFill: '#e0e0e0' }

    return {
      inherit: 'rect',
      width: 800,
      height: 400,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'header' },
        { tagName: 'text', selector: 'headerLabel' },
      ],
      attrs: {
        body: {
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 2,
        },
        header: {
          fill: colorSet.headerFill || '#e0e0e0',
          stroke: colorSet.stroke,
          strokeWidth: 2,
          width: 30,
          refHeight: '100%',
        },
        headerLabel: {
          textVerticalAnchor: 'middle',
          textAnchor: 'middle',
          refX: 15,
          refY: '50%',
          fontSize: 13,
          fill: '#333',
          writingMode: 'vertical-rl',
          letterSpacing: 2,
        },
      },
    }
  }
}

/** 创建泳道渲染器 */
function createLaneRenderer(): NodeRendererFactory {
  return (tokens: ThemeTokens, _node: NodeDefinition): ShapeDefinition => {
    const colorSet = tokens.colors.lane || { stroke: '#bdbdbd', fill: '#ffffff' }

    return {
      inherit: 'rect',
      width: 700,
      height: 200,
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'headerLabel' },
      ],
      attrs: {
        body: {
          fill: colorSet.fill,
          stroke: colorSet.stroke,
          strokeWidth: 1,
        },
        headerLabel: {
          textVerticalAnchor: 'middle',
          textAnchor: 'middle',
          refX: 15,
          refY: '50%',
          fontSize: 12,
          fill: '#666',
          writingMode: 'vertical-rl',
        },
      },
    }
  }
}

// ============================================================================
// 导出所有默认渲染器
// ============================================================================

/**
 * 获取 BPMN 2.0 标准节点渲染器集合。
 * Key 为渲染器名称，需与 NodeDefinition.renderer 对应。
 */
export function createBpmn2NodeRenderers(): Record<string, NodeRendererFactory> {
  return {
    startEvent: createEventRenderer('start'),
    intermediateEvent: createEventRenderer('intermediate'),
    endEvent: createEventRenderer('end'),
    boundaryEvent: createEventRenderer('boundary'),
    task: createTaskRenderer(),
    subProcess: createSubProcessRenderer(),
    gateway: createGatewayRenderer(),
    data: createDataRenderer(),
    annotation: createAnnotationRenderer(),
    group: createGroupRenderer(),
    pool: createPoolRenderer(),
    lane: createLaneRenderer(),
  }
}
