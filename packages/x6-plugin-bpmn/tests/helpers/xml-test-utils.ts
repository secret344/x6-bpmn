import { buildAndValidateBpmn } from './bpmn-builder'
import type { BpmnDocumentSpec } from './bpmn-builder'

/**
 * 通过标准 builder 构建测试 XML。
 */
export async function buildTestXml(spec: BpmnDocumentSpec): Promise<string> {
  const { valid, xml, warnings } = await buildAndValidateBpmn(spec)
  if (!valid) {
    throw new Error(`构建测试 XML 失败：${warnings.join('; ') || '未知警告'}`)
  }
  return xml
}

/**
 * 替换 XML 中的指定片段；若未命中则抛错，避免静默失效。
 */
export function replaceXmlOrThrow(
  xml: string,
  pattern: RegExp,
  replacement: string,
  errorMessage: string,
): string {
  const nextXml = xml.replace(pattern, replacement)
  if (nextXml === xml) {
    throw new Error(errorMessage)
  }
  return nextXml
}

/**
 * 删除 XML 中的指定片段；若未命中则抛错。
 */
export function removeXmlOrThrow(
  xml: string,
  pattern: RegExp,
  errorMessage: string,
): string {
  return replaceXmlOrThrow(xml, pattern, '', errorMessage)
}

/**
 * 提取 XML 片段；若未命中则抛错。
 */
export function matchXmlOrThrow(
  xml: string,
  pattern: RegExp,
  errorMessage: string,
): RegExpMatchArray {
  const match = xml.match(pattern)
  if (!match) {
    throw new Error(errorMessage)
  }
  return match
}

/**
 * 裁剪 XML 尾部内容，制造格式损坏场景。
 */
export function truncateXml(xml: string, removeCount = 1): string {
  if (removeCount <= 0) {
    return xml
  }
  if (xml.length <= removeCount) {
    throw new Error('无法裁剪 XML：移除长度超过原始内容长度')
  }
  return xml.slice(0, -removeCount)
}

/**
 * 为 XML 片段补上声明头。
 */
export function withXmlDeclaration(fragment: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + fragment
}