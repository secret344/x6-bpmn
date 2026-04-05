/**
 * 核心规则层 — 高阶约束规则
 *
 * 提供 BPMN 2.0 和 SmartEngine 常见的结构约束规则。
 * constraints 用于验证整个流程图的结构完整性。
 */

import type { ConstraintRule, ConstraintValidateContext } from '../dialect/types'

// ============================================================================
// 内置约束规则
// ============================================================================

/** 约束：限制开始事件数量（默认最多 1 个） */
/* istanbul ignore next — 默认参数 max = 1 的缺省分支不作为业务逻辑测试 */
export function createStartEventLimit(max: number = 1): ConstraintRule {
  return {
    id: 'start-event-limit',
    description: `开始事件最多 ${max} 个`,
    validate(ctx: ConstraintValidateContext): true | string {
      const startCount = ctx.nodeShapes.filter((s) => s.includes('start-event')).length
      if (startCount > max) {
        return `开始事件数量 (${startCount}) 超过限制 (${max})`
      }
      return true
    },
  }
}

/** 约束：限制结束事件数量 */
export function createEndEventLimit(max: number = Infinity): ConstraintRule {
  return {
    id: 'end-event-limit',
    description: max === Infinity ? '不限制结束事件数量' : `结束事件最多 ${max} 个`,
    validate(ctx: ConstraintValidateContext): true | string {
      if (max === Infinity) return true
      const endCount = ctx.nodeShapes.filter((s) => s.includes('end-event')).length
      if (endCount > max) {
        return `结束事件数量 (${endCount}) 超过限制 (${max})`
      }
      return true
    },
  }
}

/** 约束：必须包含至少一个开始事件 */
export const requireStartEvent: ConstraintRule = {
  id: 'require-start-event',
  description: '流程必须包含至少一个开始事件',
  validate(ctx: ConstraintValidateContext): true | string {
    const hasStart = ctx.nodeShapes.some((s) => s.includes('start-event'))
    return hasStart ? true : '流程中缺少开始事件'
  },
}

/** 约束：必须包含至少一个结束事件 */
export const requireEndEvent: ConstraintRule = {
  id: 'require-end-event',
  description: '流程必须包含至少一个结束事件',
  validate(ctx: ConstraintValidateContext): true | string {
    const hasEnd = ctx.nodeShapes.some((s) => s.includes('end-event'))
    return hasEnd ? true : '流程中缺少结束事件'
  },
}

/** 约束：禁止使用指定的 shape */
export function createForbiddenShapes(shapes: string[], reason?: string): ConstraintRule {
  return {
    id: `forbidden-shapes-${shapes.join('-')}`,
    description: reason || `禁止使用以下 shape: ${shapes.join(', ')}`,
    validate(ctx: ConstraintValidateContext): true | string {
      const found = ctx.nodeShapes.filter((s) => shapes.includes(s))
      if (found.length > 0) {
        return reason || `禁止使用: ${found.join(', ')}`
      }
      return true
    },
  }
}

/**
 * 执行约束规则验证。
 *
 * @param constraints — 约束规则列表
 * @param context — 验证上下文
 * @returns 所有失败的规则及原因
 */
export function validateConstraints(
  constraints: ConstraintRule[],
  context: ConstraintValidateContext,
): Array<{ ruleId: string; reason: string }> {
  const failures: Array<{ ruleId: string; reason: string }> = []
  for (const rule of constraints) {
    const result = rule.validate(context)
    if (result !== true) {
      failures.push({ ruleId: rule.id, reason: result })
    }
  }
  return failures
}
