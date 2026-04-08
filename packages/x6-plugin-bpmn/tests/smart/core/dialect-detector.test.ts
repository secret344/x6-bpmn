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
import { buildTestXml, replaceXmlOrThrow } from '../../helpers/xml-test-utils'

const baseXmlPromise = buildTestXml({
  processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
})

async function buildDefinitionsXml(
  attributes = '',
  body = '',
): Promise<string> {
  const xml = await baseXmlPromise
  const xmlWithAttributes = attributes
    ? replaceXmlOrThrow(
        xml,
        /(<(?:bpmn:)?definitions\b)/,
        `$1${attributes}`,
        '未找到 definitions 根标签，无法注入命名空间属性',
      )
    : xml

  if (!body) {
    return xmlWithAttributes
  }

  return replaceXmlOrThrow(
    xmlWithAttributes,
    /(<\/(?:bpmn:)?definitions>)/,
    `${body}$1`,
    '未找到 definitions 结束标签，无法注入测试片段',
  )
}

// ============================================================================
// smartEngineNamespaceRule
// ============================================================================

describe('smartEngineNamespaceRule', () => {
  it('包含官方 SmartEngine 命名空间应检测为 smartengine-base', async () => {
    const xml = await buildDefinitionsXml(' xmlns:smart="http://smartengine.org/schema/process"')
    expect(smartEngineNamespaceRule.test(xml)).toBe('smartengine-base')
  })

  it('包含历史 SmartEngine 命名空间应兼容检测', async () => {
    const xml = await buildDefinitionsXml(
      ' xmlns:smart="http://smartengine.alibaba.com/schema"',
    )
    expect(smartEngineNamespaceRule.test(xml)).toBe('smartengine-base')
  })

  it('仅有 smart 前缀但 URI 不匹配时不应检测', async () => {
    const xml = await buildDefinitionsXml(
      ' xmlns:smart="http://example.com/custom-smart"',
      '<smart:action>test</smart:action>',
    )
    expect(smartEngineNamespaceRule.test(xml)).toBeNull()
  })

  it('标准 BPMN XML 不应匹配', async () => {
    const xml = await buildDefinitionsXml()
    expect(smartEngineNamespaceRule.test(xml)).toBeNull()
  })
})

// ============================================================================
// createDialectDetector（含 SmartEngine 内置规则）
// ============================================================================

describe('createDialectDetector', () => {
  it('应创建内含 smartEngine 规则的检测器', async () => {
    const detector = createDialectDetector()
    const smartXml = await buildDefinitionsXml(' xmlns:smart="http://smartengine.org/schema/process"')
    const bpmnXml = await buildDefinitionsXml()
    expect(detector.detect(smartXml)).toBe('smartengine-base')
    expect(detector.detect(bpmnXml)).toBe('bpmn2')
  })
})

// ============================================================================
// smartEngineNamespaceRule — 边界场景
// ============================================================================

describe('smartEngineNamespaceRule — 边界场景', () => {
  it('空字符串不应匹配', () => {
    expect(smartEngineNamespaceRule.test('')).toBeNull()
  })

  it('仅包含 smart 单词但不匹配模式不应检测', async () => {
    const xml = await buildDefinitionsXml(
      '',
      '<bpmn:documentation>This is a smart solution</bpmn:documentation>',
    )
    expect(smartEngineNamespaceRule.test(xml)).toBeNull()
  })
})
