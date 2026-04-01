/**
 * 内置方言 — SmartEngine Database Mode Profile
 *
 * 继承 smartengine-base，聚焦审批与工单场景要求。
 *
 * 关键定位：
 * - 这是一个"要求叠加层"，而不是新的基础方言
 * - 不表示只有该 mode 才"支持 BPMN2.0"
 * - 只表示在数据库审批流场景下，对标准能力做增强和约束组合
 * - 增加多实例与审批能力
 * - 增强任务分配相关字段能力
 */

import type { Profile } from '../../core/dialect/types'

export const smartengineDatabaseProfile: Profile = {
  meta: {
    id: 'smartengine-database',
    name: 'SmartEngine Database',
    parent: 'smartengine-base',
    version: '1.0.0',
    description: 'SmartEngine 审批/工单模式，增强 UserTask 审批和多实例能力',
  },

  // 审批场景下禁用不需要的元素
  availability: {
    nodes: {
      'bpmn-complex-gateway': 'disabled',
      'bpmn-ad-hoc-sub-process': 'disabled',
    },
  },

  // 增强审批相关字段能力
  dataModel: {
    fields: {
      // 多实例配置
      multiInstance: {
        scope: 'node',
        defaultValue: false,
        description: '是否启用多实例',
        normalize: (v) => Boolean(v),
      },
      multiInstanceType: {
        scope: 'node',
        defaultValue: 'parallel',
        description: '多实例类型',
        normalize: (v) => (v === 'sequential' ? 'sequential' : 'parallel'),
        validate: (v) => {
          const s = String(v)
          return s === 'parallel' || s === 'sequential' ? true : '多实例类型必须为 parallel 或 sequential'
        },
      },
      multiInstanceCollection: {
        scope: 'node',
        defaultValue: '',
        description: '多实例集合变量',
        normalize: (v) => String(v ?? ''),
      },
      multiInstanceElementVariable: {
        scope: 'node',
        defaultValue: '',
        description: '多实例元素变量',
        normalize: (v) => String(v ?? ''),
      },
      multiInstanceCompletionCondition: {
        scope: 'node',
        defaultValue: '',
        description: '多实例完成条件',
        normalize: (v) => String(v ?? ''),
      },

      // 审批增强
      approvalType: {
        scope: 'node',
        defaultValue: '',
        description: '审批类型',
        normalize: (v) => String(v ?? ''),
      },
      approvalStrategy: {
        scope: 'node',
        defaultValue: 'any',
        description: '审批策略',
        normalize: (v) => String(v ?? 'any'),
      },
    },
    categoryFields: {
      userTask: [
        'multiInstance', 'multiInstanceType', 'multiInstanceCollection',
        'multiInstanceElementVariable', 'multiInstanceCompletionCondition',
        'approvalType', 'approvalStrategy',
      ],
    },
  },
}
