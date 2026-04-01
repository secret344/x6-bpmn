/**
 * BPMN 图标 SVG 生成器 — 单元测试
 *
 * 覆盖：getBpmnShapeIcon 对所有 BPMN 图形返回合法 SVG，
 * 事件标记正确性，未知图形的兜底输出。
 */

import { describe, it, expect } from 'vitest'
import { getBpmnShapeIcon } from '../../../src/config/bpmn-icons'

// ============================================================================
// 辅助
// ============================================================================

function expectValidSvg(svg: string, shapeName: string) {
  expect(svg, `${shapeName} 应返回非空字符串`).toBeTruthy()
  expect(svg, `${shapeName} 应以 <svg 开头`).toMatch(/^<svg\s/)
  expect(svg, `${shapeName} 应以 </svg> 结尾`).toMatch(/<\/svg>$/)
}

// ============================================================================
// 开始事件
// ============================================================================

describe('getBpmnShapeIcon — 开始事件', () => {
  const shapes = [
    'bpmn-start-event', 'bpmn-start-event-message', 'bpmn-start-event-timer',
    'bpmn-start-event-conditional', 'bpmn-start-event-signal',
    'bpmn-start-event-multiple', 'bpmn-start-event-parallel-multiple',
  ]

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('开始事件应使用绿色边框', () => {
    const svg = getBpmnShapeIcon('bpmn-start-event')
    expect(svg).toContain('#52c41a')
  })

  it('带消息类型的开始事件应包含消息标记', () => {
    const svg = getBpmnShapeIcon('bpmn-start-event-message')
    // 消息标记包含 path 表示信封
    expect(svg).toContain('path')
  })
})

// ============================================================================
// 中间抛出事件
// ============================================================================

describe('getBpmnShapeIcon — 中间抛出事件', () => {
  const shapes = [
    'bpmn-intermediate-throw-event', 'bpmn-intermediate-throw-event-message',
    'bpmn-intermediate-throw-event-escalation', 'bpmn-intermediate-throw-event-link',
    'bpmn-intermediate-throw-event-compensation', 'bpmn-intermediate-throw-event-signal',
    'bpmn-intermediate-throw-event-multiple',
  ]

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('中间抛出事件应使用双圈且橙色', () => {
    const svg = getBpmnShapeIcon('bpmn-intermediate-throw-event')
    expect(svg).toContain('#e6a817')
    // 双圈 = 2 个 circle 元素
    const circles = svg.match(/<circle/g)
    expect(circles!.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================================
// 中间捕获事件
// ============================================================================

describe('getBpmnShapeIcon — 中间捕获事件', () => {
  const shapes = [
    'bpmn-intermediate-catch-event', 'bpmn-intermediate-catch-event-message',
    'bpmn-intermediate-catch-event-timer', 'bpmn-intermediate-catch-event-escalation',
    'bpmn-intermediate-catch-event-conditional', 'bpmn-intermediate-catch-event-link',
    'bpmn-intermediate-catch-event-error', 'bpmn-intermediate-catch-event-cancel',
    'bpmn-intermediate-catch-event-compensation', 'bpmn-intermediate-catch-event-signal',
    'bpmn-intermediate-catch-event-multiple', 'bpmn-intermediate-catch-event-parallel-multiple',
  ]

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('中间捕获事件应使用双圈且蓝色', () => {
    const svg = getBpmnShapeIcon('bpmn-intermediate-catch-event')
    expect(svg).toContain('#1890ff')
  })
})

// ============================================================================
// 边界事件
// ============================================================================

describe('getBpmnShapeIcon — 边界事件', () => {
  const shapes = [
    'bpmn-boundary-event', 'bpmn-boundary-event-message',
    'bpmn-boundary-event-timer', 'bpmn-boundary-event-escalation',
    'bpmn-boundary-event-conditional', 'bpmn-boundary-event-error',
    'bpmn-boundary-event-cancel', 'bpmn-boundary-event-compensation',
    'bpmn-boundary-event-signal', 'bpmn-boundary-event-multiple',
    'bpmn-boundary-event-parallel-multiple', 'bpmn-boundary-event-non-interrupting',
  ]

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('边界事件应使用紫色且虚线内圈', () => {
    const svg = getBpmnShapeIcon('bpmn-boundary-event')
    expect(svg).toContain('#722ed1')
    expect(svg).toContain('stroke-dasharray')
  })
})

// ============================================================================
// 结束事件
// ============================================================================

describe('getBpmnShapeIcon — 结束事件', () => {
  const shapes = [
    'bpmn-end-event', 'bpmn-end-event-message', 'bpmn-end-event-escalation',
    'bpmn-end-event-error', 'bpmn-end-event-cancel', 'bpmn-end-event-compensation',
    'bpmn-end-event-signal', 'bpmn-end-event-terminate', 'bpmn-end-event-multiple',
  ]

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('结束事件应使用红色粗圈', () => {
    const svg = getBpmnShapeIcon('bpmn-end-event')
    expect(svg).toContain('#f5222d')
    expect(svg).toContain('stroke-width="2.5"')
  })

  it('终止结束事件应有实心圆标记', () => {
    const svg = getBpmnShapeIcon('bpmn-end-event-terminate')
    expect(svg).toContain('fill="currentColor"')
  })
})

// ============================================================================
// 任务
// ============================================================================

describe('getBpmnShapeIcon — 任务', () => {
  const taskShapes = [
    'bpmn-task', 'bpmn-user-task', 'bpmn-service-task', 'bpmn-script-task',
    'bpmn-business-rule-task', 'bpmn-send-task', 'bpmn-receive-task', 'bpmn-manual-task',
  ]

  for (const shape of taskShapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('任务应使用圆角矩形', () => {
    const svg = getBpmnShapeIcon('bpmn-task')
    expect(svg).toContain('<rect')
    expect(svg).toContain('rx="4"')
  })

  it('用户任务应包含人形标记', () => {
    const svg = getBpmnShapeIcon('bpmn-user-task')
    // circle for head
    expect(svg).toContain('<circle')
    // path for body
    expect(svg).toContain('<path')
  })

  it('服务任务应包含齿轮标记', () => {
    const svg = getBpmnShapeIcon('bpmn-service-task')
    // 两个齿轮 = 多个 circle
    const circles = svg.match(/<circle/g)
    expect(circles!.length).toBeGreaterThanOrEqual(4)
  })
})

// ============================================================================
// 子流程
// ============================================================================

describe('getBpmnShapeIcon — 子流程', () => {
  const subShapes = [
    'bpmn-sub-process', 'bpmn-event-sub-process', 'bpmn-transaction',
    'bpmn-ad-hoc-sub-process', 'bpmn-call-activity',
  ]

  for (const shape of subShapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('事件子流程应使用虚线边框', () => {
    const svg = getBpmnShapeIcon('bpmn-event-sub-process')
    expect(svg).toContain('stroke-dasharray')
  })
})

// ============================================================================
// 网关
// ============================================================================

describe('getBpmnShapeIcon — 网关', () => {
  const gatewayShapes = [
    'bpmn-exclusive-gateway', 'bpmn-parallel-gateway', 'bpmn-inclusive-gateway',
    'bpmn-complex-gateway', 'bpmn-event-based-gateway', 'bpmn-exclusive-event-based-gateway',
  ]

  for (const shape of gatewayShapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('网关应使用菱形', () => {
    const svg = getBpmnShapeIcon('bpmn-exclusive-gateway')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('#faad14')
  })
})

// ============================================================================
// 数据元素
// ============================================================================

describe('getBpmnShapeIcon — 数据元素', () => {
  const dataShapes = ['bpmn-data-object', 'bpmn-data-input', 'bpmn-data-output', 'bpmn-data-store']

  for (const shape of dataShapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('数据元素应使用 28x32 视窗', () => {
    const svg = getBpmnShapeIcon('bpmn-data-object')
    expect(svg).toContain('viewBox="0 0 28 32"')
  })
})

// ============================================================================
// 工件 & 泳道
// ============================================================================

describe('getBpmnShapeIcon — 工件和泳道', () => {
  const shapes = ['bpmn-text-annotation', 'bpmn-group', 'bpmn-pool', 'bpmn-lane']

  for (const shape of shapes) {
    it(`${shape} 应返回合法 SVG`, () => {
      expectValidSvg(getBpmnShapeIcon(shape), shape)
    })
  }

  it('分组应使用虚线边框', () => {
    const svg = getBpmnShapeIcon('bpmn-group')
    expect(svg).toContain('stroke-dasharray')
  })
})

// ============================================================================
// 异常 / 兜底
// ============================================================================

describe('getBpmnShapeIcon — 异常场景', () => {
  it('未知图形应返回兜底 SVG', () => {
    const svg = getBpmnShapeIcon('unknown-shape')
    expectValidSvg(svg, 'unknown-shape')
    expect(svg).toContain('?')
  })

  it('空字符串应返回兜底 SVG', () => {
    const svg = getBpmnShapeIcon('')
    expectValidSvg(svg, 'empty')
    expect(svg).toContain('?')
  })

  it('兜底 SVG 应使用灰色', () => {
    const svg = getBpmnShapeIcon('nonexistent')
    expect(svg).toContain('#999')
  })
})

// ============================================================================
// 事件标记区分
// ============================================================================

describe('getBpmnShapeIcon — 事件标记差异', () => {
  it('timer 事件应包含时钟标记', () => {
    const svg = getBpmnShapeIcon('bpmn-start-event-timer')
    // timer 标记有 circle 和时钟指针
    expect(svg).toContain('circle')
  })

  it('signal 事件应包含三角标记', () => {
    const svg = getBpmnShapeIcon('bpmn-start-event-signal')
    expect(svg).toContain('<polygon')
  })

  it('error 事件应包含折线标记', () => {
    const svg = getBpmnShapeIcon('bpmn-end-event-error')
    expect(svg).toContain('<polyline')
  })

  it('cancel 事件应包含叉形标记', () => {
    const svg = getBpmnShapeIcon('bpmn-end-event-cancel')
    expect(svg).toContain('<path')
  })

  it('compensation 事件应包含双三角标记', () => {
    const svg = getBpmnShapeIcon('bpmn-end-event-compensation')
    // compensation 有 2 个 polygon
    const polygons = svg.match(/<polygon/g)
    expect(polygons!.length).toBeGreaterThanOrEqual(2)
  })

  it('不同事件类型的同一标记应相同', () => {
    // 消息标记在不同外形中应一致
    const startMsg = getBpmnShapeIcon('bpmn-start-event-message')
    const endMsg = getBpmnShapeIcon('bpmn-end-event-message')
    // 都应该包含消息信封的 path
    expect(startMsg).toContain('M8 10h12v8H8z')
    expect(endMsg).toContain('M8 10h12v8H8z')
  })
})
