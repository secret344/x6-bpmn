/**
 * 泳道图形展示辅助函数
 *
 * 负责根据 BPMNDI 的 isHorizontal 语义生成 Pool / Lane 的 attrs，
 * 并提供导出侧使用的方向解析逻辑。
 */

import type { CellAttrs } from '@antv/x6'
import {
  BPMN_COLORS,
  BPMN_POOL,
  BPMN_LANE,
} from '../utils/constants'

type SwimlaneShape = typeof BPMN_POOL | typeof BPMN_LANE

interface SwimlaneMeta {
  defaultLabel: string
  bodyFill: string
  bodyStroke: string
  bodyStrokeWidth: number
  headerFill: string
  headerStroke: string
  labelFontSize: number
  labelFontWeight?: string
}

function getSwimlaneMeta(shape: SwimlaneShape): SwimlaneMeta {
  if (shape === BPMN_POOL) {
    return {
      defaultLabel: 'Pool',
      bodyFill: BPMN_COLORS.pool.fill,
      bodyStroke: BPMN_COLORS.pool.stroke,
      bodyStrokeWidth: 2,
      headerFill: BPMN_COLORS.pool.headerFill,
      headerStroke: BPMN_COLORS.pool.stroke,
      labelFontSize: 14,
      labelFontWeight: 'bold',
    }
  }

  return {
    defaultLabel: 'Lane',
    bodyFill: BPMN_COLORS.lane.fill,
    bodyStroke: BPMN_COLORS.lane.stroke,
    bodyStrokeWidth: 1,
    headerFill: '#f5f5f5',
    headerStroke: BPMN_COLORS.lane.stroke,
    labelFontSize: 12,
  }
}

/**
 * 根据 BPMNDI §12.2.3.3 的 isHorizontal 字段生成泳道 attrs。
 * - true: 左侧标题栏，标题逆时针旋转 90°
 * - false: 顶部标题栏，标题水平显示
 */
export function buildSwimlaneAttrs(
  shape: SwimlaneShape,
  label?: string,
  isHorizontal = true,
): CellAttrs {
  const meta = getSwimlaneMeta(shape)
  const headerLabel = {
    textVerticalAnchor: 'middle',
    textAnchor: 'middle',
    fontSize: meta.labelFontSize,
    fill: '#333',
    text: label ?? meta.defaultLabel,
    ...(meta.labelFontWeight ? { fontWeight: meta.labelFontWeight } : {}),
  }

  return {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: meta.bodyFill,
      stroke: meta.bodyStroke,
      strokeWidth: meta.bodyStrokeWidth,
    },
    header: isHorizontal
      ? {
          width: 30,
          refHeight: '100%',
          fill: meta.headerFill,
          stroke: meta.headerStroke,
          strokeWidth: 1,
        }
      : {
          height: 30,
          refWidth: '100%',
          fill: meta.headerFill,
          stroke: meta.headerStroke,
          strokeWidth: 1,
        },
    headerLabel: isHorizontal
      ? {
          ...headerLabel,
          refX: 15,
          refY: '50%',
          transform: 'rotate(-90)',
        }
      : {
          ...headerLabel,
          refX: '50%',
          refY: 15,
        },
  }
}

/**
 * 解析泳道方向。
 * 优先读取持久化的 bpmn.isHorizontal；若缺失，则按宽高比做保底推断。
 */
export function resolveSwimlaneIsHorizontal(
  data: unknown,
  size?: { width: number; height: number },
): boolean {
  const bpmn =
    data && typeof data === 'object'
      ? (data as { bpmn?: { isHorizontal?: unknown } }).bpmn
      : undefined

  if (typeof bpmn?.isHorizontal === 'boolean') {
    return bpmn.isHorizontal
  }

  if (size) {
    return size.width >= size.height
  }

  return true
}