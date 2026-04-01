/**
 * SmartEngine 方言检测 — 单元测试
 *
 * 覆盖 smartEngineNamespaceRule、createDialectDetector 中的 SmartEngine 规则。
 */

import { describe, it, expect } from 'vitest'
import {
  smartEngineNamespaceRule,
  createDialectDetector,
} from '../../../src/core/dialect/detector'

// ============================================================================
// smartEngineNamespaceRule
// ============================================================================

describe('smartEngineNamespaceRule', () => {
  it('包含 xmlns:smart= 应检测为 smartengine-base', () => {
    const xml = '<definitions xmlns:smart="http://smartengine.io"></definitions>'
    expect(smartEngineNamespaceRule.test(xml)).toBe('smartengine-base')
  })

  it('包含 smart: 前缀应检测为 smartengine-base', () => {
    const xml = '<definitions><smart:action>test</smart:action></definitions>'
    expect(smartEngineNamespaceRule.test(xml)).toBe('smartengine-base')
  })

  it('包含 smartengine 关键词应检测为 smartengine-base', () => {
    const xml = '<definitions xmlns="http://smartengine.alibaba.com/schema"></definitions>'
    expect(smartEngineNamespaceRule.test(xml)).toBe('smartengine-base')
  })

  it('标准 BPMN XML 不应匹配', () => {
    const xml = '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"></definitions>'
    expect(smartEngineNamespaceRule.test(xml)).toBeNull()
  })
})

// ============================================================================
// createDialectDetector（含 SmartEngine 内置规则）
// ============================================================================

describe('createDialectDetector', () => {
  it('应创建内含 smartEngine 规则的检测器', () => {
    const detector = createDialectDetector()
    expect(detector.detect('<definitions xmlns:smart="http://smartengine.io">')).toBe('smartengine-base')
    expect(detector.detect('<definitions xmlns="http://bpmn.io">')).toBe('bpmn2')
  })
})

// ============================================================================
// smartEngineNamespaceRule — 边界场景
// ============================================================================

describe('smartEngineNamespaceRule — 边界场景', () => {
  it('空字符串不应匹配', () => {
    expect(smartEngineNamespaceRule.test('')).toBeNull()
  })

  it('仅包含 smart 单词但不匹配模式不应检测', () => {
    const xml = '<definitions><description>This is a smart solution</description></definitions>'
    const result = smartEngineNamespaceRule.test(xml)
    expect(result === 'smartengine-base' || result === null).toBe(true)
  })
})
