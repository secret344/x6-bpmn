/**
 * BPMN 2.0 工件（Artifacts）图形注册
 *
 * 包含：文本注释（Text Annotation）和分组（Group）。
 * 工件不参与流程控制，仅用于辅助说明和视觉分组。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
} from '../utils/constants'

// ============================================================================
// 注册工件图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 工件图形到 X6 全局注册表。
 */
export function registerArtifactShapes() {
  // ==================== 文本注释 ====================
  // 左侧方括号 + 内部文本，无连接端口
  Graph.registerNode(BPMN_TEXT_ANNOTATION, {
    inherit: 'rect',
    width: 120,
    height: 50,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'line', selector: 'bracket' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        fill: BPMN_COLORS.annotation.fill,
        stroke: 'none',
      },
      bracket: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        stroke: BPMN_COLORS.annotation.stroke,
        strokeWidth: 2,
        refY2: '100%',
      },
      label: {
        textVerticalAnchor: 'middle',
        textAnchor: 'start',
        refX: 10,
        refY: '50%',
        fontSize: 12,
        fill: '#333',
        text: 'Text Annotation',
      },
    },
  }, true)

  // ==================== 分组 ====================
  // 虚线圆角矩形，用于将多个元素视觉分组
  Graph.registerNode(BPMN_GROUP, {
    inherit: 'rect',
    width: 300,
    height: 200,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        rx: 12,
        ry: 12,
        fill: BPMN_COLORS.group.fill,
        stroke: BPMN_COLORS.group.stroke,
        strokeWidth: 2,
        strokeDasharray: '10,4',
      },
      label: {
        textVerticalAnchor: 'top',
        textAnchor: 'start',
        refX: 15,
        refY: -20,
        fontSize: 13,
        fontWeight: 'bold',
        fill: '#666',
        text: 'Group',
      },
    },
    zIndex: -1,
  }, true)
}
