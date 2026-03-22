/**
 * BPMN 2.0 泳道（Swimlanes）图形注册
 *
 * 包含：池（Pool）和泳道（Lane）。
 * Pool 代表参与者，Lane 在 Pool 内部划分职责区域。
 * 两者均为水平布局（左侧头部 + 右侧内容区）。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_POOL,
  BPMN_LANE,
} from '../utils/constants'

// ============================================================================
// 注册泳道图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 泳道图形到 X6 全局注册表。
 */
export function registerSwimlaneShapes() {
  // ==================== 池 ====================
  // zIndex: -2 确保在最底层，其他节点可放置于池内部
  Graph.registerNode(BPMN_POOL, {
    inherit: 'rect',
    width: 600,
    height: 250,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'header' },
      { tagName: 'text', selector: 'headerLabel' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        fill: BPMN_COLORS.pool.fill,
        stroke: BPMN_COLORS.pool.stroke,
        strokeWidth: 2,
      },
      header: {
        width: 30,
        refHeight: '100%',
        fill: BPMN_COLORS.pool.headerFill,
        stroke: BPMN_COLORS.pool.stroke,
        strokeWidth: 1,
      },
      headerLabel: {
        textVerticalAnchor: 'middle',
        textAnchor: 'middle',
        refX: 15,
        refY: '50%',
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#333',
        text: 'Pool',
        transform: 'rotate(-90)',
      },
    },
    zIndex: -2,
  }, true)

  // ==================== 泳道 ====================
  // zIndex: -1 介于 Pool 和普通节点之间
  Graph.registerNode(BPMN_LANE, {
    inherit: 'rect',
    width: 570,
    height: 125,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'header' },
      { tagName: 'text', selector: 'headerLabel' },
    ],
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        fill: BPMN_COLORS.lane.fill,
        stroke: BPMN_COLORS.lane.stroke,
        strokeWidth: 1,
      },
      header: {
        width: 30,
        refHeight: '100%',
        fill: '#f5f5f5',
        stroke: BPMN_COLORS.lane.stroke,
        strokeWidth: 1,
      },
      headerLabel: {
        textVerticalAnchor: 'middle',
        textAnchor: 'middle',
        refX: 15,
        refY: '50%',
        fontSize: 12,
        fill: '#333',
        text: 'Lane',
        transform: 'rotate(-90)',
      },
    },
    zIndex: -1,
  }, true)
}
