/**
 * 内置方言 — SmartEngine Custom Mode Profile
 *
 * 继承 smartengine-base，聚焦服务编排场景要求。
 *
 * 关键定位：
 * - 这是一个"要求叠加层"，而不是新的基础方言
 * - 不代表 SmartEngine 只能使用这些元素
 * - 只在"明确要求使用 custom mode 约束"时，才叠加限制与偏好
 * - 强化 serviceTask、receiveTask
 * - 收紧规则
 */

import type { Profile } from '../../core/dialect/types'
import { createForbiddenShapes } from '../../core/rules/constraints'

export const smartengineCustomProfile: Profile = {
  meta: {
    id: 'smartengine-custom',
    name: 'SmartEngine Custom',
    parent: 'smartengine-base',
    version: '1.0.0',
    description: 'SmartEngine 服务编排模式，在 BPMN 2.0 基础上叠加 Custom 模式限制',
  },

  // 仅禁用文档明确声明为 Database 模式专属的元素
  availability: {
    nodes: {
      'bpmn-user-task': 'disabled',
      'bpmn-inclusive-gateway': 'disabled',
    },
  },

  serialization: {
    xmlNames: {
      useDefaultNamespace: true,
    },
  },

  // 收紧规则，避免在 Custom 模式下误用 Database 专属能力
  rules: {
    constraints: [
      createForbiddenShapes(
        ['bpmn-user-task', 'bpmn-inclusive-gateway'],
        'SmartEngine Custom 模式下不支持仅限 DataBase 模式的节点',
      ),
    ],
  },
}
