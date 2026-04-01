/**
 * 流程方言内核 — 方言检测器
 *
 * 根据 XML 内容检测所属方言，用于导入时自动选择正确的 ImporterAdapter。
 */

import type { DialectDetectorInterface } from './types'

/**
 * DialectDetector — 方言检测器
 *
 * 检测 XML 中的命名空间、扩展属性等特征以判断方言类别。
 * 支持注册自定义检测规则。
 */
export class DialectDetector implements DialectDetectorInterface {
  private rules: DialectDetectRule[] = []

  /**
   * 注册检测规则。规则按注册顺序匹配，先匹配先返回。
   */
  addRule(rule: DialectDetectRule): void {
    this.rules.push(rule)
  }

  /**
   * 根据 XML 内容检测方言 ID。
   * 遍历所有已注册规则，返回首个匹配的方言 ID。
   * 若无规则匹配，返回 'bpmn2'（兜底）。
   */
  detect(xml: string): string {
    for (const rule of this.rules) {
      const result = rule.test(xml)
      if (result) return result
    }
    return 'bpmn2'
  }
}

/** 检测规则接口 */
export interface DialectDetectRule {
  /** 规则名称（用于调试） */
  name: string
  /** 测试 XML 是否匹配该规则，匹配则返回方言 ID，否则返回 null */
  test(xml: string): string | null
}

// ============================================================================
// 内置检测规则
// ============================================================================

/**
 * SmartEngine 命名空间检测规则。
 * 检查 XML 中是否包含 SmartEngine 相关命名空间声明。
 */
export const smartEngineNamespaceRule: DialectDetectRule = {
  name: 'smartengine-namespace',
  test(xml: string): string | null {
    // 检测 SmartEngine 相关命名空间
    if (
      xml.includes('smartengine') ||
      xml.includes('smart:') ||
      xml.includes('xmlns:smart=')
    ) {
      return 'smartengine-base'
    }
    return null
  },
}

/**
 * 创建默认的 DialectDetector，注册内置检测规则。
 */
export function createDialectDetector(): DialectDetector {
  const detector = new DialectDetector()
  detector.addRule(smartEngineNamespaceRule)
  return detector
}
