/**
 * 内置方言 — SmartEngine Base Profile
 *
 * 继承 bpmn2，添加 SmartEngine 公共扩展。
 * smartengine-base 默认完整继承 BPMN 2.0 全量能力，
 * 只在 BPMN2 基础上增加 SmartEngine 特有的命名空间和字段能力。
 */

import type { Profile } from '../../core/dialect/types'
import { createStartEventLimit } from '../../core/rules/constraints'
import {
  createSmartNodeSerializer,
  smartClassField,
  smartConditionalFlowSerializer,
  smartExecutionListenersField,
  smartPropertiesField,
  SMARTENGINE_NAMESPACE_URI,
} from './serialization'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_RECEIVE_TASK,
  BPMN_SERVICE_TASK,
  BPMN_USER_TASK,
} from '../../utils/constants'

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
    description: 'SmartEngine 公共扩展，保持 BPMN 2.0 默认能力并叠加 SmartEngine 配置',
  },

  // SmartEngine 命名空间扩展
  serialization: {
    targetNamespace: 'Examples',
    namespaces: {
      smart: SMARTENGINE_NAMESPACE_URI,
    },
    processAttributes: {
      version: '1.0.0',
    },
    nodeSerializers: {
      [BPMN_SERVICE_TASK]: createSmartNodeSerializer({
        allowSmartClass: true,
        readProperties: true,
        readExecutionListeners: true,
      }),
      [BPMN_RECEIVE_TASK]: createSmartNodeSerializer({
        allowSmartClass: true,
        readProperties: true,
        readExecutionListeners: true,
      }),
      [BPMN_EXCLUSIVE_GATEWAY]: createSmartNodeSerializer({
        allowSmartClass: true,
        readProperties: true,
        readExecutionListeners: true,
      }),
      [BPMN_USER_TASK]: createSmartNodeSerializer({
        readProperties: true,
        readExecutionListeners: true,
      }),
    },
    edgeSerializers: {
      [BPMN_CONDITIONAL_FLOW]: smartConditionalFlowSerializer,
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
      smartClass: smartClassField,
      smartProperties: smartPropertiesField,
      smartExecutionListeners: smartExecutionListenersField,
    },
    categoryFields: {
      serviceTask: ['smartClass', 'smartProperties', 'smartExecutionListeners'],
      receiveTask: ['smartClass', 'smartProperties', 'smartExecutionListeners'],
      exclusiveGateway: ['smartClass', 'smartProperties', 'smartExecutionListeners'],
      userTask: ['smartProperties', 'smartExecutionListeners'],
    },
  },
}
