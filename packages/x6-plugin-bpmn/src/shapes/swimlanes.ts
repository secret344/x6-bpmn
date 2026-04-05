/**
 * BPMN 2.0 泳道（Swimlanes）图形注册
 *
 * 包含：池（Pool）和泳道（Lane）。
 * Pool 代表参与者，Lane 在 Pool 内部划分职责区域。
 * 默认注册为水平布局（左侧头部 + 右侧内容区），
 * 实际节点可通过 BPMNDI isHorizontal 切换为垂直布局。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_POOL,
  BPMN_LANE,
} from '../utils/constants'
import { buildSwimlaneAttrs } from './swimlane-presentation'

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
    attrs: buildSwimlaneAttrs(BPMN_POOL, 'Pool', true),
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
    attrs: buildSwimlaneAttrs(BPMN_LANE, 'Lane', true),
    zIndex: -1,
  }, true)
}
