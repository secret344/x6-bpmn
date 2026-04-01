/**
 * 核心规则层 — 模块入口
 */

export {
  validateConnectionWithContext,
  createContextValidateConnection,
} from './validator'

export {
  createStartEventLimit,
  createEndEventLimit,
  requireStartEvent,
  requireEndEvent,
  createForbiddenShapes,
  validateConstraints,
} from './constraints'
