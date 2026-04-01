/**
 * 核心渲染层 — 边渲染器工厂
 *
 * 为不同类型的 BPMN 连接线提供渲染器工厂函数。
 */

import type { ThemeTokens, EdgeDefinition, EdgeDefinitionConfig, EdgeRendererFactory } from '../dialect/types'

/**
 * 获取 BPMN 2.0 标准边渲染器集合。
 * Key 为渲染器名称，需与 EdgeDefinition.renderer 对应。
 */
export function createBpmn2EdgeRenderers(): Record<string, EdgeRendererFactory> {
  return {
    sequenceFlow: createSequenceFlowRenderer(),
    conditionalFlow: createConditionalFlowRenderer(),
    defaultFlow: createDefaultFlowRenderer(),
    messageFlow: createMessageFlowRenderer(),
    association: createAssociationRenderer(),
    directedAssociation: createDirectedAssociationRenderer(),
    dataAssociation: createDataAssociationRenderer(),
  }
}

// ============================================================================
// 各类边渲染器工厂
// ============================================================================

/** 顺序流渲染器：实线 + 实心箭头 */
function createSequenceFlowRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.sequenceFlow || '#424242'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 2,
          targetMarker: { name: 'block', width: 10, height: 6 },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 条件流渲染器：菱形起始 + 实心箭头 */
function createConditionalFlowRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.sequenceFlow || '#424242'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 2,
          sourceMarker: {
            name: 'diamond',
            width: 14,
            height: 8,
            fill: '#fff',
            stroke: color,
          },
          targetMarker: { name: 'block', width: 10, height: 6 },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 默认流渲染器：斜线起始 + 实心箭头 */
function createDefaultFlowRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.sequenceFlow || '#424242'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 2,
          sourceMarker: {
            d: 'M -2 -6 L 2 6',
            fill: 'none',
            stroke: color,
            strokeWidth: 2,
          },
          targetMarker: { name: 'block', width: 10, height: 6 },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 消息流渲染器：虚线 + 空心圆 + 空心箭头 */
function createMessageFlowRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.messageFlow || '#1565c0'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '8,5',
          sourceMarker: {
            name: 'ellipse',
            rx: 5,
            ry: 5,
            fill: '#fff',
            stroke: color,
          },
          targetMarker: {
            name: 'block',
            width: 10,
            height: 6,
            open: true,
            stroke: color,
          },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 关联渲染器：点线，无箭头 */
function createAssociationRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.association || '#9e9e9e'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '4,4',
          targetMarker: null,
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 定向关联渲染器：点线 + 空心箭头 */
function createDirectedAssociationRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.association || '#9e9e9e'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '4,4',
          targetMarker: {
            name: 'block',
            width: 8,
            height: 5,
            open: true,
            stroke: color,
          },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}

/** 数据关联渲染器：虚线 + 空心箭头 */
function createDataAssociationRenderer(): EdgeRendererFactory {
  return (tokens: ThemeTokens, _edge: EdgeDefinition): EdgeDefinitionConfig => {
    const color = tokens.colors.association || '#9e9e9e'
    return {
      inherit: 'edge',
      attrs: {
        line: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '6,3',
          targetMarker: {
            name: 'block',
            width: 8,
            height: 5,
            open: true,
            stroke: color,
          },
        },
      },
      labels: [],
      zIndex: 0,
    }
  }
}
