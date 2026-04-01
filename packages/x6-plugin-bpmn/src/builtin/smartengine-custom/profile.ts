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
    description: 'SmartEngine 服务编排模式，强化 ServiceTask/ReceiveTask，收紧规则',
  },

  // 禁用 custom mode 下不推荐的元素
  availability: {
    nodes: {
      'bpmn-user-task': 'disabled',
      'bpmn-manual-task': 'disabled',
      'bpmn-ad-hoc-sub-process': 'disabled',
    },
  },

  // 收紧规则
  rules: {
    constraints: [
      createForbiddenShapes(
        ['bpmn-user-task', 'bpmn-manual-task'],
        'SmartEngine Custom 模式下不建议使用人工任务',
      ),
    ],
  },

  // 扩展服务编排相关字段能力
  dataModel: {
    fields: {
      smartServiceName: {
        scope: 'node',
        defaultValue: '',
        description: '服务名称',
        normalize: (v) => String(v ?? ''),
      },
      smartServiceVersion: {
        scope: 'node',
        defaultValue: '',
        description: '服务版本',
        normalize: (v) => String(v ?? ''),
      },
      smartServiceGroup: {
        scope: 'node',
        defaultValue: '',
        description: '服务分组',
        normalize: (v) => String(v ?? ''),
      },
    },
    categoryFields: {
      serviceTask: ['smartServiceName', 'smartServiceVersion', 'smartServiceGroup'],
      receiveTask: ['smartServiceName', 'smartServiceVersion'],
    },
  },
}
