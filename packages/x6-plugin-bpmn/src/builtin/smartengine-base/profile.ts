/**
 * 内置方言 — SmartEngine Base Profile
 *
 * 继承 bpmn2，添加 SmartEngine 公共扩展。
 * smartengine-base 默认完整继承 BPMN 2.0 全量能力，
 * 只在 BPMN2 基础上增加 SmartEngine 特有的命名空间和字段能力。
 */

import type { Profile } from '../../core/dialect/types'
import { createStartEventLimit } from '../../core/rules/constraints'

/**
 * SmartEngine Base Profile
 *
 * 关键原则：
 * - 默认完整继承 BPMN 2.0 全量能力
 * - SmartEngine 本身应被视为 "BPMN 2.0 + SmartEngine 扩展"
 * - 不因为进入 SmartEngine 就默认禁用、裁剪或弱化标准 BPMN 元素
 */
export const smartengineBaseProfile: Profile = {
  meta: {
    id: 'smartengine-base',
    name: 'SmartEngine',
    parent: 'bpmn2',
    version: '1.0.0',
    description: 'SmartEngine 公共扩展，完整继承 BPMN 2.0',
  },

  // SmartEngine 命名空间扩展
  serialization: {
    namespaces: {
      smart: 'http://smartengine.alibaba.com/schema',
    },
  },

  // SmartEngine 默认收紧结构规则
  rules: {
    constraints: [
      createStartEventLimit(1),
    ],
  },

  // SmartEngine 公共字段能力扩展
  dataModel: {
    fields: {
      // SmartEngine 扩展字段
      smartAction: {
        scope: 'node',
        defaultValue: '',
        description: 'SmartEngine 动作类型',
        normalize: (v) => String(v ?? ''),
      },
      smartType: {
        scope: 'node',
        defaultValue: '',
        description: 'SmartEngine 节点类型',
        normalize: (v) => String(v ?? ''),
      },
      smartRetry: {
        scope: 'node',
        defaultValue: 0,
        description: 'SmartEngine 重试次数',
        normalize: (v) => Number(v) || 0,
        validate: (v) => {
          const num = Number(v)
          if (isNaN(num) || num < 0) return '重试次数必须为非负整数'
          return true
        },
      },
      smartTimeout: {
        scope: 'node',
        defaultValue: '',
        description: 'SmartEngine 超时配置',
        normalize: (v) => String(v ?? ''),
      },
    },
    categoryFields: {
      serviceTask: ['smartAction', 'smartType', 'smartRetry', 'smartTimeout'],
      userTask: ['smartAction', 'smartType'],
    },
  },
}
