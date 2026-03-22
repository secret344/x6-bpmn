/**
 * BPMN 2.0 数据元素（Data Elements）图形注册
 *
 * 包含：数据对象、数据输入、数据输出、数据存储。
 * 数据输入 / 数据输出继承自数据对象，增加了方向箭头图标。
 */

import { Graph } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_DATA_OBJECT,
  BPMN_DATA_INPUT,
  BPMN_DATA_OUTPUT,
  BPMN_DATA_STORE,
} from '../utils/constants'
import { BPMN_PORTS, LABEL_BELOW } from './shared'

// ============================================================================
// 注册数据元素图形
// ============================================================================

/**
 * 注册所有 BPMN 2.0 数据元素图形到 X6 全局注册表。
 */
export function registerDataShapes() {
  const { stroke, fill } = BPMN_COLORS.data

  // ==================== 数据对象 ====================
  Graph.registerNode(BPMN_DATA_OBJECT, {
    inherit: 'polygon',
    width: 40, height: 50,
    markup: [
      { tagName: 'polygon', selector: 'body' },
      { tagName: 'polyline', selector: 'fold' },   // 右上角折叠线
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        refPoints: '0,0 0.75,0 1,0.2 1,1 0,1',  // 文件形状（右上角折叠）
        fill, stroke, strokeWidth: 1.5,
      },
      fold: {
        refPoints: '0.75,0 0.75,0.2 1,0.2',
        fill: 'none', stroke, strokeWidth: 1,
      },
      label: { ...LABEL_BELOW, text: 'Data Object' },
    },
    ports: BPMN_PORTS,
  }, true)

  // ==================== 数据输入 ====================
  // 继承数据对象，增加向右箭头图标表示“输入”
  Graph.registerNode(BPMN_DATA_INPUT, {
    inherit: BPMN_DATA_OBJECT,
    markup: [
      { tagName: 'polygon', selector: 'body' },
      { tagName: 'polyline', selector: 'fold' },
      { tagName: 'path', selector: 'icon' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      icon: {
        d: BPMN_ICONS.dataInput,
        fill: 'none',
        stroke: '#666',
        strokeWidth: 1.2,
        refX: 4,
        refY: 4,
        transform: 'scale(0.6)',
      },
      label: {
        text: 'Data Input',
      },
    },
  }, true)

  // ==================== 数据输出 ====================
  // 继承数据对象，增加向右实心箭头图标表示“输出”
  Graph.registerNode(BPMN_DATA_OUTPUT, {
    inherit: BPMN_DATA_OBJECT,
    markup: [
      { tagName: 'polygon', selector: 'body' },
      { tagName: 'polyline', selector: 'fold' },
      { tagName: 'path', selector: 'icon' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      icon: {
        d: BPMN_ICONS.dataOutput,
        fill: 'none',
        stroke: '#666',
        strokeWidth: 1.2,
        refX: 4,
        refY: 4,
        transform: 'scale(0.6)',
      },
      label: {
        text: 'Data Output',
      },
    },
  }, true)

  // ==================== 数据存储 ====================
  // 圆柱形数据库图标
  Graph.registerNode(BPMN_DATA_STORE, {
    inherit: 'rect',
    width: 50, height: 50,
    markup: [
      { tagName: 'path', selector: 'body' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        // 圆柱形 SVG 路径（三段贝塞尔曲线构成桶形）
        d: 'M 0 8 C 0 3 25 0 25 0 C 25 0 50 3 50 8 L 50 42 C 50 47 25 50 25 50 C 25 50 0 47 0 42 Z M 0 8 C 0 13 25 16 25 16 C 25 16 50 13 50 8',
        fill, stroke, strokeWidth: 1.5,
      },
      label: { ...LABEL_BELOW, text: 'Data Store' },
    },
    ports: BPMN_PORTS,
  }, true)
}
