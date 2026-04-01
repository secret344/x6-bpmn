/**
 * 共享图形配置 — 单元测试
 *
 * 覆盖：BPMN_PORTS 端口配置结构、LABEL_CENTER / LABEL_TOP / LABEL_BELOW 样式。
 */

import { describe, it, expect } from 'vitest'
import { BPMN_PORTS, LABEL_CENTER, LABEL_TOP, LABEL_BELOW } from '../../../src/shapes/shared'

// ============================================================================
// BPMN_PORTS
// ============================================================================

describe('BPMN_PORTS — 端口配置', () => {
  it('应包含 4 个方向的端口组', () => {
    const groupKeys = Object.keys(BPMN_PORTS.groups)
    expect(groupKeys).toContain('top')
    expect(groupKeys).toContain('right')
    expect(groupKeys).toContain('bottom')
    expect(groupKeys).toContain('left')
    expect(groupKeys.length).toBe(4)
  })

  it('应包含 4 个端口项', () => {
    expect(BPMN_PORTS.items.length).toBe(4)
    const groups = BPMN_PORTS.items.map(item => item.group)
    expect(groups).toContain('top')
    expect(groups).toContain('right')
    expect(groups).toContain('bottom')
    expect(groups).toContain('left')
  })

  it('每个端口组的 position 应与组名一致', () => {
    for (const [name, group] of Object.entries(BPMN_PORTS.groups)) {
      expect(group.position).toBe(name)
    }
  })

  it('所有端口圆点应启用 magnet', () => {
    for (const [name, group] of Object.entries(BPMN_PORTS.groups)) {
      expect(group.attrs.circle.magnet, `${name} 端口应设置 magnet=true`).toBe(true)
    }
  })

  it('所有端口圆点的半径应为 4', () => {
    for (const group of Object.values(BPMN_PORTS.groups)) {
      expect(group.attrs.circle.r).toBe(4)
    }
  })

  it('所有端口圆点应使用蓝色边框', () => {
    for (const group of Object.values(BPMN_PORTS.groups)) {
      expect(group.attrs.circle.stroke).toBe('#5F95FF')
    }
  })

  it('所有端口圆点应使用白色填充', () => {
    for (const group of Object.values(BPMN_PORTS.groups)) {
      expect(group.attrs.circle.fill).toBe('#fff')
    }
  })

  it('端口圆点边框宽度应为 1', () => {
    for (const group of Object.values(BPMN_PORTS.groups)) {
      expect(group.attrs.circle.strokeWidth).toBe(1)
    }
  })
})

// ============================================================================
// LABEL_CENTER
// ============================================================================

describe('LABEL_CENTER — 居中标签样式', () => {
  it('应水平居中', () => {
    expect(LABEL_CENTER.textAnchor).toBe('middle')
    expect(LABEL_CENTER.refX).toBe('50%')
  })

  it('应垂直居中', () => {
    expect(LABEL_CENTER.textVerticalAnchor).toBe('middle')
    expect(LABEL_CENTER.refY).toBe('50%')
  })

  it('字号应为 13', () => {
    expect(LABEL_CENTER.fontSize).toBe(13)
  })

  it('文字颜色应为深灰色', () => {
    expect(LABEL_CENTER.fill).toBe('#333')
  })
})

// ============================================================================
// LABEL_TOP
// ============================================================================

describe('LABEL_TOP — 顶部标签样式', () => {
  it('应水平居中', () => {
    expect(LABEL_TOP.textAnchor).toBe('middle')
    expect(LABEL_TOP.refX).toBe('50%')
  })

  it('应从顶部开始', () => {
    expect(LABEL_TOP.textVerticalAnchor).toBe('top')
    expect(LABEL_TOP.refY).toBe(10)
  })

  it('字号应为 13', () => {
    expect(LABEL_TOP.fontSize).toBe(13)
  })

  it('文字颜色应为深灰色', () => {
    expect(LABEL_TOP.fill).toBe('#333')
  })
})

// ============================================================================
// LABEL_BELOW
// ============================================================================

describe('LABEL_BELOW — 底部外置标签样式', () => {
  it('应水平居中', () => {
    expect(LABEL_BELOW.textAnchor).toBe('middle')
    expect(LABEL_BELOW.refX).toBe('50%')
  })

  it('应定位在节点底部外侧', () => {
    expect(LABEL_BELOW.textVerticalAnchor).toBe('top')
    expect(LABEL_BELOW.refY).toBe('100%')
    expect(LABEL_BELOW.refY2).toBe(6)
  })

  it('字号应为 12', () => {
    expect(LABEL_BELOW.fontSize).toBe(12)
  })

  it('文字颜色应为深灰色', () => {
    expect(LABEL_BELOW.fill).toBe('#333')
  })
})

// ============================================================================
// 三种标签样式对比
// ============================================================================

describe('标签样式对比', () => {
  it('三种标签都应水平居中', () => {
    expect(LABEL_CENTER.textAnchor).toBe('middle')
    expect(LABEL_TOP.textAnchor).toBe('middle')
    expect(LABEL_BELOW.textAnchor).toBe('middle')
  })

  it('三种标签都应使用相同颜色', () => {
    expect(LABEL_CENTER.fill).toBe(LABEL_TOP.fill)
    expect(LABEL_TOP.fill).toBe(LABEL_BELOW.fill)
  })

  it('LABEL_BELOW 的字号应比其他更小', () => {
    expect(LABEL_BELOW.fontSize).toBeLessThan(LABEL_CENTER.fontSize)
    expect(LABEL_BELOW.fontSize).toBeLessThan(LABEL_TOP.fontSize)
  })
})
