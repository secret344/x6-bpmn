/**
 * 核心规则层 — 模块入口
 */

export {
  validateConnectionWithContext,
  createContextValidateConnection,
  createContextValidateConnectionWithResult,
  createContextValidateEdge,
  createContextValidateEdgeWithResult,
} from './validator'

export {
  createStartEventLimit,
  createEndEventLimit,
  requireStartEvent,
  requireEndEvent,
  createForbiddenShapes,
  validateConstraints,
} from './constraints'
