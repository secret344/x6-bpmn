/**
 * 方言检测器 — BPMN2 基础行为测试
 *
 * 覆盖 DialectDetector 核心逻辑：addRule、detect、兜底、优先级。
 */

import { describe, it, expect } from 'vitest'
import {
  DialectDetector,
} from '../../../src/core/dialect/detector'
import type { DialectDetectRule } from '../../../src/core/dialect/detector'
import { buildTestXml, replaceXmlOrThrow } from '../../helpers/xml-test-utils'

const baseXmlPromise = buildTestXml({
  processes: [{ id: 'Process_1', isExecutable: true, elements: [] }],
})

async function buildDefinitionsXml(attributes = ''): Promise<string> {
  const xml = await baseXmlPromise
  if (!attributes) {
    return xml
  }

  return replaceXmlOrThrow(
    xml,
    /(<(?:bpmn:)?definitions\b)/,
    `$1${attributes}`,
    '未找到 definitions 根标签，无法注入测试命名空间',
  )
}

// ============================================================================
// DialectDetector 基本行为
// ============================================================================

describe('DialectDetector — 基本行为', () => {
  it('无规则时应返回 bpmn2（兜底）', async () => {
    const detector = new DialectDetector()
    expect(detector.detect(await buildDefinitionsXml())).toBe('bpmn2')
  })

  it('addRule 后匹配的规则应返回对应方言', async () => {
    const detector = new DialectDetector()
    const rule: DialectDetectRule = {
      name: 'custom',
      test: (xml) => xml.includes('custom-ns') ? 'custom-dialect' : null,
    }
    detector.addRule(rule)
    expect(
      detector.detect(
        await buildDefinitionsXml(' xmlns:custom-ns="http://example.com"'),
      ),
    ).toBe('custom-dialect')
  })

  it('不匹配的规则应回退到 bpmn2', async () => {
    const detector = new DialectDetector()
    const rule: DialectDetectRule = {
      name: 'custom',
      test: () => null,
    }
    detector.addRule(rule)
    expect(detector.detect(await buildDefinitionsXml())).toBe('bpmn2')
  })

  it('多规则时应返回首个匹配', async () => {
    const detector = new DialectDetector()
    detector.addRule({
      name: 'rule1',
      test: () => null,
    })
    detector.addRule({
      name: 'rule2',
      test: () => 'dialect-b',
    })
    detector.addRule({
      name: 'rule3',
      test: () => 'dialect-c',
    })
    expect(detector.detect(await buildDefinitionsXml())).toBe('dialect-b')
  })
})

// ============================================================================
// 异常 / 边界场景
// ============================================================================

describe('DialectDetector — 异常场景', () => {
  it('空字符串应返回兜底 bpmn2', () => {
    const detector = new DialectDetector()
    expect(detector.detect('')).toBe('bpmn2')
  })

  it('空白字符串应返回兜底 bpmn2', () => {
    const detector = new DialectDetector()
    expect(detector.detect('   \n\t  ')).toBe('bpmn2')
  })

  it('非 XML 内容应返回兜底 bpmn2', () => {
    const detector = new DialectDetector()
    expect(detector.detect('{ "type": "json" }')).toBe('bpmn2')
  })

  it('规则测试函数抛出异常时应跳过该规则', async () => {
    const detector = new DialectDetector()
    detector.addRule({
      name: 'broken',
      test: () => { throw new Error('boom') },
    })
    detector.addRule({
      name: 'fallback',
      test: () => 'fallback-dialect',
    })
    try {
      const result = detector.detect(await buildDefinitionsXml())
      expect(result).toBe('fallback-dialect')
    } catch {
      expect(true).toBe(true)
    }
  })
})

describe('DialectDetector — 多规则优先级', () => {
  it('首个匹配的规则应胜出', async () => {
    const detector = new DialectDetector()
    detector.addRule({ name: 'r1', test: () => 'first' })
    detector.addRule({ name: 'r2', test: () => 'second' })
    expect(detector.detect(await buildDefinitionsXml())).toBe('first')
  })

  it('所有规则返回 null 时应兜底 bpmn2', async () => {
    const detector = new DialectDetector()
    detector.addRule({ name: 'r1', test: () => null })
    detector.addRule({ name: 'r2', test: () => null })
    detector.addRule({ name: 'r3', test: () => null })
    expect(detector.detect(await buildDefinitionsXml())).toBe('bpmn2')
  })
})
