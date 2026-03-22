/**
 * BPMN 2.0 连接线（Connections）注册
 *
 * 共 7 种连接线类型：
 * - 顺序流（Sequence Flow）：实线 + 实心箭头
 * - 条件流（Conditional Flow）：菱形起始标记 + 实心箭头
 * - 默认流（Default Flow）：斜线起始标记 + 实心箭头
 * - 消息流（Message Flow）：虚线 + 圆圈起始 + 空心箭头
 * - 关联（Association）：点线，无箭头
 * - 定向关联（Directed Association）：点线 + 空心箭头
 * - 数据关联（Data Association）：虚线 + 空心箭头
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DIRECTED_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '../utils/constants'

// ============================================================================
// 注册所有连接线图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 连接线图形到 X6 全局注册表。
 * 所有边的 zIndex 统一设为 0，确保在节点下方渲染。
 */
export function registerConnectionShapes() {
  // ==================== 顺序流 ====================
  // 实线 + 实心三角箭头，BPMN 最常见的连接类型
  Graph.registerEdge(BPMN_SEQUENCE_FLOW, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.sequenceFlow,
        strokeWidth: 2,
        targetMarker: {
          name: 'block',
          width: 10,
          height: 6,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 条件流 ====================
  // 实线 + 菱形起始标记 + 实心箭头，表示带条件的转移
  Graph.registerEdge(BPMN_CONDITIONAL_FLOW, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.sequenceFlow,
        strokeWidth: 2,
        sourceMarker: {
          name: 'diamond',
          width: 14,
          height: 8,
          fill: '#fff',
          stroke: BPMN_COLORS.sequenceFlow,
        },
        targetMarker: {
          name: 'block',
          width: 10,
          height: 6,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 默认流 ====================
  // 实线 + 斜线起始标记 + 实心箭头
  // 使用标准 edge markup，通过 sourceMarker 渲染 BPMN 斜线标记
  Graph.registerEdge(BPMN_DEFAULT_FLOW, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.sequenceFlow,
        strokeWidth: 2,
        sourceMarker: {
          d: 'M -2 -6 L 2 6',
          fill: 'none',
          stroke: BPMN_COLORS.sequenceFlow,
          strokeWidth: 2,
        },
        targetMarker: {
          name: 'block',
          width: 10,
          height: 6,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 消息流 ====================
  // 虚线 + 空心圆圈起始标记 + 空心箭头，用于跨池通信
  Graph.registerEdge(BPMN_MESSAGE_FLOW, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.messageFlow,
        strokeWidth: 1.5,
        strokeDasharray: '8,5',
        sourceMarker: {
          name: 'ellipse',
          rx: 5,
          ry: 5,
          fill: '#fff',
          stroke: BPMN_COLORS.messageFlow,
        },
        targetMarker: {
          name: 'block',
          width: 10,
          height: 6,
          open: true,
          stroke: BPMN_COLORS.messageFlow,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 关联 ====================
  // 点线，无箭头，用于连接工件与流程元素
  Graph.registerEdge(BPMN_ASSOCIATION, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.association,
        strokeWidth: 1.5,
        strokeDasharray: '4,4',
        targetMarker: null,
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 定向关联 ====================
  // 点线 + 空心箭头，表示有方向的关联关系
  Graph.registerEdge(BPMN_DIRECTED_ASSOCIATION, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.association,
        strokeWidth: 1.5,
        strokeDasharray: '4,4',
        targetMarker: {
          name: 'block',
          width: 8,
          height: 5,
          open: true,
          stroke: BPMN_COLORS.association,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)

  // ==================== 数据关联 ====================
  // 虚线 + 空心箭头，表示数据对象与活动的数据流向
  Graph.registerEdge(BPMN_DATA_ASSOCIATION, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: BPMN_COLORS.association,
        strokeWidth: 1.5,
        strokeDasharray: '6,3',
        targetMarker: {
          name: 'block',
          width: 8,
          height: 5,
          open: true,
          stroke: BPMN_COLORS.association,
        },
      },
    },
    labels: [],
    zIndex: 0,
  }, true)
}
