<template>
  <a-modal
    v-model:visible="visible"
    :title="modalTitle"
    :width="600"
    unmount-on-close
    @before-ok="onSave"
    @cancel="onClose"
    ok-text="保存"
    cancel-text="取消"
  >
    <a-tabs default-active-key="basic" size="small">
      <!-- ==================== 基本属性 ==================== -->
      <a-tab-pane key="basic" title="基本属性">
        <a-form :model="form" layout="vertical" size="small">
          <a-form-item label="ID (bpmn2:id)">
            <a-input :model-value="form.id" readonly disabled />
          </a-form-item>
          <a-form-item label="元素类型">
            <a-tag color="arcoblue" style="margin: 0">{{ shapeName }}</a-tag>
          </a-form-item>
          <a-form-item label="名称 (bpmn2:name)">
            <a-input v-model="form.label" placeholder="输入名称" allow-clear />
          </a-form-item>
          <a-form-item label="文档 (bpmn2:documentation)">
            <a-textarea v-model="form.documentation" placeholder="输入文档描述" :auto-size="{ minRows: 2, maxRows: 4 }" />
          </a-form-item>
        </a-form>
      </a-tab-pane>

      <!-- ==================== BPMN 专属属性 ==================== -->
      <a-tab-pane key="bpmn" title="BPMN 属性">
        <a-form :model="form" layout="vertical" size="small">

          <!-- ===== 用户任务 ===== -->
          <template v-if="shapeCategory === 'userTask'">
            <a-form-item label="分配人 (camunda:assignee)">
              <a-input v-model="form.assignee" placeholder="如: #{userId}" allow-clear />
            </a-form-item>
            <a-form-item label="候选用户 (camunda:candidateUsers)">
              <a-input v-model="form.candidateUsers" placeholder="逗号分隔，如: user1,user2" allow-clear />
            </a-form-item>
            <a-form-item label="候选组 (camunda:candidateGroups)">
              <a-input v-model="form.candidateGroups" placeholder="逗号分隔，如: managers,hr" allow-clear />
            </a-form-item>
            <a-form-item label="表单标识 (camunda:formKey)">
              <a-input v-model="form.formKey" placeholder="如: embedded:app:forms/task.html" allow-clear />
            </a-form-item>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="到期日期 (camunda:dueDate)">
                  <a-input v-model="form.dueDate" placeholder="如: ${dueDate}" allow-clear />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="优先级 (camunda:priority)">
                  <a-input v-model="form.priority" placeholder="如: ${priority}" allow-clear />
                </a-form-item>
              </a-col>
            </a-row>
          </template>

          <!-- ===== 服务任务 ===== -->
          <template v-if="shapeCategory === 'serviceTask'">
            <a-form-item label="实现方式">
              <a-select v-model="form.implementationType" placeholder="选择实现方式">
                <a-option value="class">Java 类 (Class)</a-option>
                <a-option value="expression">表达式 (Expression)</a-option>
                <a-option value="delegateExpression">委托表达式 (Delegate Expression)</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="实现值">
              <a-input v-model="form.implementation" :placeholder="implPlaceholder" allow-clear />
            </a-form-item>
            <a-form-item label="结果变量 (camunda:resultVariable)">
              <a-input v-model="form.resultVariable" placeholder="输出结果存储的变量名" allow-clear />
            </a-form-item>
            <a-form-item>
              <a-checkbox v-model="form.isAsync">异步执行 (camunda:async)</a-checkbox>
            </a-form-item>
          </template>

          <!-- ===== 脚本任务 ===== -->
          <template v-if="shapeCategory === 'scriptTask'">
            <a-form-item label="脚本格式 (bpmn2:scriptFormat)">
              <a-select v-model="form.scriptFormat" placeholder="选择脚本语言" allow-clear>
                <a-option value="groovy">Groovy</a-option>
                <a-option value="javascript">JavaScript</a-option>
                <a-option value="python">Python</a-option>
                <a-option value="juel">JUEL</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="脚本内容 (bpmn2:script)">
              <a-textarea v-model="form.script" placeholder="输入脚本代码" :auto-size="{ minRows: 3, maxRows: 8 }" style="font-family: 'Courier New', Consolas, monospace; font-size: 12px" />
            </a-form-item>
            <a-form-item label="结果变量 (camunda:resultVariable)">
              <a-input v-model="form.resultVariable" placeholder="输出结果存储的变量名" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 业务规则任务 ===== -->
          <template v-if="shapeCategory === 'businessRuleTask'">
            <a-form-item label="实现方式">
              <a-select v-model="form.implementationType" placeholder="选择实现方式">
                <a-option value="class">Java 类 (Class)</a-option>
                <a-option value="expression">表达式 (Expression)</a-option>
                <a-option value="delegateExpression">委托表达式</a-option>
                <a-option value="dmn">DMN Decision</a-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="form.implementationType === 'dmn'" label="决策引用 (camunda:decisionRef)">
              <a-input v-model="form.implementation" placeholder="DMN 决策的 ID" allow-clear />
            </a-form-item>
            <a-form-item v-else label="实现值">
              <a-input v-model="form.implementation" placeholder="输入实现类/表达式" allow-clear />
            </a-form-item>
            <a-form-item label="结果变量 (camunda:resultVariable)">
              <a-input v-model="form.resultVariable" placeholder="输出结果存储的变量名" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 发送任务 / 接收任务 ===== -->
          <template v-if="shapeCategory === 'sendTask' || shapeCategory === 'receiveTask'">
            <a-form-item label="消息引用 (bpmn2:messageRef)">
              <a-input v-model="form.messageRef" placeholder="关联消息的 ID" allow-clear />
            </a-form-item>
            <a-form-item label="实现方式">
              <a-select v-model="form.implementationType" placeholder="选择实现方式">
                <a-option value="class">Java 类</a-option>
                <a-option value="expression">表达式</a-option>
                <a-option value="delegateExpression">委托表达式</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="实现值">
              <a-input v-model="form.implementation" placeholder="输入实现类/表达式" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 普通任务 / 手工任务 ===== -->
          <template v-if="shapeCategory === 'task' || shapeCategory === 'manualTask'">
            <a-empty description="此元素类型无额外 BPMN 属性" />
          </template>

          <!-- ===== 调用活动 ===== -->
          <template v-if="shapeCategory === 'callActivity'">
            <a-form-item label="被调用元素 (bpmn2:calledElement)">
              <a-input v-model="form.calledElement" placeholder="被调用流程的 ID" allow-clear />
            </a-form-item>
            <a-form-item>
              <a-checkbox v-model="form.isAsync">异步执行 (camunda:async)</a-checkbox>
            </a-form-item>
          </template>

          <!-- ===== 子流程类 ===== -->
          <template v-if="shapeCategory === 'subProcess'">
            <a-form-item v-if="isEventSubProcess">
              <a-checkbox v-model="form.triggeredByEvent" disabled>由事件触发 (triggeredByEvent)</a-checkbox>
            </a-form-item>
            <a-form-item>
              <a-checkbox v-model="form.isAsync">异步执行 (camunda:async)</a-checkbox>
            </a-form-item>
          </template>

          <!-- ===== 网关 ===== -->
          <template v-if="shapeCategory === 'gateway'">
            <a-form-item v-if="isExclusiveOrInclusive" label="默认出口流 (bpmn2:default)">
              <a-select v-model="form.defaultFlow" placeholder="选择默认顺序流" allow-clear>
                <a-option v-for="edge in outgoingEdges" :key="edge.id" :value="edge.id">
                  {{ edge.label || edge.id }}
                </a-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="shape === 'bpmn-complex-gateway'" label="激活条件 (bpmn2:activationCondition)">
              <a-textarea v-model="form.activationCondition" placeholder="输入激活条件表达式" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </a-form-item>
            <a-empty v-if="!isExclusiveOrInclusive && shape !== 'bpmn-complex-gateway'" description="此网关类型无额外属性" />
          </template>

          <!-- ===== 定时事件 ===== -->
          <template v-if="shapeCategory === 'timerEvent'">
            <a-form-item label="定时器类型">
              <a-radio-group v-model="form.timerType" direction="vertical">
                <a-radio value="timeDuration">持续时间 (timeDuration)</a-radio>
                <a-radio value="timeDate">指定日期 (timeDate)</a-radio>
                <a-radio value="timeCycle">循环 (timeCycle)</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item :label="timerValueLabel">
              <a-input v-model="form.timerValue" :placeholder="timerPlaceholder" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 消息事件 ===== -->
          <template v-if="shapeCategory === 'messageEvent'">
            <a-form-item label="消息引用 (bpmn2:messageRef)">
              <a-input v-model="form.messageRef" placeholder="关联消息的 ID" allow-clear />
            </a-form-item>
            <a-form-item label="消息名称">
              <a-input v-model="form.messageName" placeholder="消息名称" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 信号事件 ===== -->
          <template v-if="shapeCategory === 'signalEvent'">
            <a-form-item label="信号引用 (bpmn2:signalRef)">
              <a-input v-model="form.signalRef" placeholder="关联信号的 ID" allow-clear />
            </a-form-item>
            <a-form-item label="信号名称">
              <a-input v-model="form.signalName" placeholder="信号名称" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 错误事件 ===== -->
          <template v-if="shapeCategory === 'errorEvent'">
            <a-form-item label="错误引用 (bpmn2:errorRef)">
              <a-input v-model="form.errorRef" placeholder="关联错误的 ID" allow-clear />
            </a-form-item>
            <a-form-item label="错误代码 (bpmn2:errorCode)">
              <a-input v-model="form.errorCode" placeholder="错误代码" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 升级事件 ===== -->
          <template v-if="shapeCategory === 'escalationEvent'">
            <a-form-item label="升级引用 (bpmn2:escalationRef)">
              <a-input v-model="form.escalationRef" placeholder="关联升级的 ID" allow-clear />
            </a-form-item>
            <a-form-item label="升级代码 (bpmn2:escalationCode)">
              <a-input v-model="form.escalationCode" placeholder="升级代码" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 条件事件 ===== -->
          <template v-if="shapeCategory === 'conditionalEvent'">
            <a-form-item label="条件表达式 (bpmn2:condition)">
              <a-textarea v-model="form.conditionExpression" placeholder="输入条件表达式" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </a-form-item>
          </template>

          <!-- ===== 链接事件 ===== -->
          <template v-if="shapeCategory === 'linkEvent'">
            <a-form-item label="链接名称 (bpmn2:name)">
              <a-input v-model="form.linkName" placeholder="链接事件名称，用于匹配对应的链接" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 补偿事件 ===== -->
          <template v-if="shapeCategory === 'compensationEvent'">
            <a-form-item label="关联活动 (bpmn2:activityRef)">
              <a-input v-model="form.activityRef" placeholder="需要补偿的活动 ID" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 无定义事件 / 取消 / 终止 / 多重 ===== -->
          <template v-if="shapeCategory === 'noneEvent' || shapeCategory === 'cancelEvent' || shapeCategory === 'terminateEvent' || shapeCategory === 'multipleEvent'">
            <a-empty description="此事件类型无额外 BPMN 属性" />
          </template>

          <!-- ===== 边界事件非中断属性 ===== -->
          <template v-if="isBoundaryEvent">
            <a-divider orientation="left" style="margin: 8px 0">边界事件属性</a-divider>
            <a-form-item>
              <a-checkbox v-model="form.cancelActivity">中断 (cancelActivity) — 取消则为非中断边界事件</a-checkbox>
            </a-form-item>
          </template>

          <!-- ===== 顺序流 ===== -->
          <template v-if="shapeCategory === 'sequenceFlow'">
            <a-form-item label="条件表达式 (bpmn2:conditionExpression)">
              <a-textarea v-model="form.conditionExpression" placeholder="${amount > 1000}" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </a-form-item>
          </template>

          <!-- ===== 消息流 ===== -->
          <template v-if="shapeCategory === 'messageFlow'">
            <a-form-item label="消息引用 (bpmn2:messageRef)">
              <a-input v-model="form.messageRef" placeholder="关联消息的 ID" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 数据对象 ===== -->
          <template v-if="shapeCategory === 'dataObject'">
            <a-form-item>
              <a-checkbox v-model="form.isCollection">是集合 (bpmn2:isCollection)</a-checkbox>
            </a-form-item>
          </template>

          <!-- ===== 数据存储 ===== -->
          <template v-if="shapeCategory === 'dataStore'">
            <a-empty description="数据存储无额外 BPMN 属性" />
          </template>

          <!-- ===== 泳池 ===== -->
          <template v-if="shapeCategory === 'pool'">
            <a-form-item label="流程引用 (bpmn2:processRef)">
              <a-input v-model="form.processRef" placeholder="关联流程的 ID" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 泳道 ===== -->
          <template v-if="shapeCategory === 'lane'">
            <a-empty description="泳道通过位置关系来包含流对象" />
          </template>

          <!-- ===== 文本注释 ===== -->
          <template v-if="shapeCategory === 'textAnnotation'">
            <a-form-item label="注释文本 (bpmn2:text)">
              <a-textarea v-model="form.annotationText" placeholder="输入注释内容" :auto-size="{ minRows: 2, maxRows: 6 }" />
            </a-form-item>
          </template>

          <!-- ===== 分组 ===== -->
          <template v-if="shapeCategory === 'group'">
            <a-form-item label="分类值引用 (bpmn2:categoryValueRef)">
              <a-input v-model="form.categoryValueRef" placeholder="分类值的 ID" allow-clear />
            </a-form-item>
          </template>

          <!-- ===== 关联 ===== -->
          <template v-if="shapeCategory === 'association'">
            <a-empty description="关联线无额外 BPMN 属性" />
          </template>
        </a-form>
      </a-tab-pane>

      <!-- ==================== 外观属性 ==================== -->
      <a-tab-pane key="appearance" title="外观">
        <a-form :model="form" layout="vertical" size="small">
          <template v-if="isNode">
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="X 坐标">
                  <a-input-number v-model="form.x" :precision="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="Y 坐标">
                  <a-input-number v-model="form.y" :precision="0" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="宽度">
                  <a-input-number v-model="form.width" :min="20" :precision="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="高度">
                  <a-input-number v-model="form.height" :min="20" :precision="0" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="填充色">
                  <div class="color-picker-wrapper">
                    <input type="color" v-model="form.fillColor" class="color-input" />
                    <a-input v-model="form.fillColor" placeholder="#ffffff" style="flex: 1" />
                  </div>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="边框色">
                  <div class="color-picker-wrapper">
                    <input type="color" v-model="form.strokeColor" class="color-input" />
                    <a-input v-model="form.strokeColor" placeholder="#000000" style="flex: 1" />
                  </div>
                </a-form-item>
              </a-col>
            </a-row>
          </template>
          <template v-else>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="线条颜色">
                  <div class="color-picker-wrapper">
                    <input type="color" v-model="form.strokeColor" class="color-input" />
                    <a-input v-model="form.strokeColor" placeholder="#000000" style="flex: 1" />
                  </div>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="线条宽度">
                  <a-input-number v-model="form.strokeWidth" :min="1" :max="10" :precision="0" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
          </template>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { Graph, Cell, Node, Edge } from '@antv/x6'

// ============================================================================
// Shape → Chinese label mapping
// ============================================================================
const SHAPE_LABELS: Record<string, string> = {
  'bpmn-start-event': '开始事件', 'bpmn-start-event-message': '消息开始事件',
  'bpmn-start-event-timer': '定时开始事件', 'bpmn-start-event-conditional': '条件开始事件',
  'bpmn-start-event-signal': '信号开始事件', 'bpmn-start-event-multiple': '多重开始事件',
  'bpmn-start-event-parallel-multiple': '并行多重开始事件',
  'bpmn-intermediate-throw-event': '中间抛出事件', 'bpmn-intermediate-throw-event-message': '消息中间抛出事件',
  'bpmn-intermediate-throw-event-escalation': '升级中间抛出事件', 'bpmn-intermediate-throw-event-link': '链接中间抛出事件',
  'bpmn-intermediate-throw-event-compensation': '补偿中间抛出事件', 'bpmn-intermediate-throw-event-signal': '信号中间抛出事件',
  'bpmn-intermediate-throw-event-multiple': '多重中间抛出事件',
  'bpmn-intermediate-catch-event': '中间捕获事件', 'bpmn-intermediate-catch-event-message': '消息中间捕获事件',
  'bpmn-intermediate-catch-event-timer': '定时中间捕获事件', 'bpmn-intermediate-catch-event-escalation': '升级中间捕获事件',
  'bpmn-intermediate-catch-event-conditional': '条件中间捕获事件', 'bpmn-intermediate-catch-event-link': '链接中间捕获事件',
  'bpmn-intermediate-catch-event-error': '错误中间捕获事件', 'bpmn-intermediate-catch-event-cancel': '取消中间捕获事件',
  'bpmn-intermediate-catch-event-compensation': '补偿中间捕获事件', 'bpmn-intermediate-catch-event-signal': '信号中间捕获事件',
  'bpmn-intermediate-catch-event-multiple': '多重中间捕获事件', 'bpmn-intermediate-catch-event-parallel-multiple': '并行多重中间捕获事件',
  'bpmn-boundary-event': '边界事件', 'bpmn-boundary-event-message': '消息边界事件',
  'bpmn-boundary-event-timer': '定时边界事件', 'bpmn-boundary-event-escalation': '升级边界事件',
  'bpmn-boundary-event-conditional': '条件边界事件', 'bpmn-boundary-event-error': '错误边界事件',
  'bpmn-boundary-event-cancel': '取消边界事件', 'bpmn-boundary-event-compensation': '补偿边界事件',
  'bpmn-boundary-event-signal': '信号边界事件', 'bpmn-boundary-event-multiple': '多重边界事件',
  'bpmn-boundary-event-parallel-multiple': '并行多重边界事件', 'bpmn-boundary-event-non-interrupting': '非中断边界事件',
  'bpmn-end-event': '结束事件', 'bpmn-end-event-message': '消息结束事件',
  'bpmn-end-event-escalation': '升级结束事件', 'bpmn-end-event-error': '错误结束事件',
  'bpmn-end-event-cancel': '取消结束事件', 'bpmn-end-event-compensation': '补偿结束事件',
  'bpmn-end-event-signal': '信号结束事件', 'bpmn-end-event-terminate': '终止结束事件',
  'bpmn-end-event-multiple': '多重结束事件',
  'bpmn-task': '任务', 'bpmn-user-task': '用户任务', 'bpmn-service-task': '服务任务',
  'bpmn-script-task': '脚本任务', 'bpmn-business-rule-task': '业务规则任务',
  'bpmn-send-task': '发送任务', 'bpmn-receive-task': '接收任务', 'bpmn-manual-task': '手工任务',
  'bpmn-sub-process': '子流程', 'bpmn-event-sub-process': '事件子流程',
  'bpmn-transaction': '事务', 'bpmn-ad-hoc-sub-process': '自由子流程', 'bpmn-call-activity': '调用活动',
  'bpmn-exclusive-gateway': '排他网关', 'bpmn-parallel-gateway': '并行网关',
  'bpmn-inclusive-gateway': '包容网关', 'bpmn-complex-gateway': '复杂网关',
  'bpmn-event-based-gateway': '事件网关', 'bpmn-exclusive-event-based-gateway': '排他事件网关',
  'bpmn-data-object': '数据对象', 'bpmn-data-input': '数据输入',
  'bpmn-data-output': '数据输出', 'bpmn-data-store': '数据存储',
  'bpmn-text-annotation': '文本注释', 'bpmn-group': '分组',
  'bpmn-pool': '池', 'bpmn-lane': '泳道',
  'bpmn-sequence-flow': '顺序流', 'bpmn-conditional-flow': '条件流', 'bpmn-default-flow': '默认流',
  'bpmn-message-flow': '消息流', 'bpmn-association': '关联',
  'bpmn-directed-association': '定向关联', 'bpmn-data-association': '数据关联',
}

// ============================================================================
// Shape category classification
// ============================================================================
type ShapeCategory =
  | 'userTask' | 'serviceTask' | 'scriptTask' | 'businessRuleTask'
  | 'sendTask' | 'receiveTask' | 'task' | 'manualTask' | 'callActivity'
  | 'subProcess' | 'gateway'
  | 'timerEvent' | 'messageEvent' | 'signalEvent' | 'errorEvent'
  | 'escalationEvent' | 'conditionalEvent' | 'linkEvent' | 'compensationEvent'
  | 'cancelEvent' | 'terminateEvent' | 'multipleEvent' | 'noneEvent'
  | 'sequenceFlow' | 'messageFlow' | 'association'
  | 'dataObject' | 'dataStore' | 'pool' | 'lane' | 'textAnnotation' | 'group'
  | 'unknown'

function classifyShape(s: string): ShapeCategory {
  // Activities
  if (s === 'bpmn-user-task') return 'userTask'
  if (s === 'bpmn-service-task') return 'serviceTask'
  if (s === 'bpmn-script-task') return 'scriptTask'
  if (s === 'bpmn-business-rule-task') return 'businessRuleTask'
  if (s === 'bpmn-send-task') return 'sendTask'
  if (s === 'bpmn-receive-task') return 'receiveTask'
  if (s === 'bpmn-manual-task') return 'manualTask'
  if (s === 'bpmn-task') return 'task'
  if (s === 'bpmn-call-activity') return 'callActivity'
  if (s === 'bpmn-sub-process' || s === 'bpmn-event-sub-process' || s === 'bpmn-transaction' || s === 'bpmn-ad-hoc-sub-process') return 'subProcess'
  // Gateways
  if (s.includes('gateway')) return 'gateway'
  // Events — by event definition type
  if (s.includes('-timer')) return 'timerEvent'
  if (s.includes('-message')) return 'messageEvent'
  if (s.includes('-signal')) return 'signalEvent'
  if (s.includes('-error')) return 'errorEvent'
  if (s.includes('-escalation')) return 'escalationEvent'
  if (s.includes('-conditional')) return 'conditionalEvent'
  if (s.includes('-link')) return 'linkEvent'
  if (s.includes('-compensation')) return 'compensationEvent'
  if (s.includes('-cancel')) return 'cancelEvent'
  if (s.includes('-terminate')) return 'terminateEvent'
  if (s.includes('-multiple') || s.includes('-parallel-multiple')) return 'multipleEvent'
  if (s.includes('event')) return 'noneEvent'
  // Connections
  if (s === 'bpmn-sequence-flow' || s === 'bpmn-conditional-flow' || s === 'bpmn-default-flow') return 'sequenceFlow'
  if (s === 'bpmn-message-flow') return 'messageFlow'
  if (s === 'bpmn-association' || s === 'bpmn-directed-association' || s === 'bpmn-data-association') return 'association'
  // Data
  if (s === 'bpmn-data-object' || s === 'bpmn-data-input' || s === 'bpmn-data-output') return 'dataObject'
  if (s === 'bpmn-data-store') return 'dataStore'
  // Artifacts
  if (s === 'bpmn-text-annotation') return 'textAnnotation'
  if (s === 'bpmn-group') return 'group'
  // Swimlanes
  if (s === 'bpmn-pool') return 'pool'
  if (s === 'bpmn-lane') return 'lane'
  return 'unknown'
}

// ============================================================================
// Form data
// ============================================================================
interface FormData {
  // Basic
  id: string
  label: string
  documentation: string
  // Appearance
  x: number; y: number; width: number; height: number
  fillColor: string; strokeColor: string; strokeWidth: number
  // User Task
  assignee: string; candidateUsers: string; candidateGroups: string
  formKey: string; dueDate: string; priority: string
  // Service / Business Rule / Send / Receive Task
  implementationType: string; implementation: string; resultVariable: string
  isAsync: boolean
  // Script Task
  scriptFormat: string; script: string
  // Call Activity
  calledElement: string
  // Sub-process
  triggeredByEvent: boolean
  // Gateway
  defaultFlow: string; activationCondition: string
  // Timer event
  timerType: string; timerValue: string
  // Message event, send/receive task, message flow
  messageRef: string; messageName: string
  // Signal event
  signalRef: string; signalName: string
  // Error event
  errorRef: string; errorCode: string
  // Escalation event
  escalationRef: string; escalationCode: string
  // Conditional event & sequence flow
  conditionExpression: string
  // Link event
  linkName: string
  // Compensation event
  activityRef: string
  // Boundary event
  cancelActivity: boolean
  // Data object
  isCollection: boolean
  // Pool
  processRef: string
  // Text annotation
  annotationText: string
  // Group
  categoryValueRef: string
}

function emptyForm(): FormData {
  return {
    id: '', label: '', documentation: '',
    x: 0, y: 0, width: 100, height: 60,
    fillColor: '#ffffff', strokeColor: '#000000', strokeWidth: 1,
    assignee: '', candidateUsers: '', candidateGroups: '',
    formKey: '', dueDate: '', priority: '',
    implementationType: '', implementation: '', resultVariable: '',
    isAsync: false,
    scriptFormat: '', script: '',
    calledElement: '',
    triggeredByEvent: false,
    defaultFlow: '', activationCondition: '',
    timerType: 'timeDuration', timerValue: '',
    messageRef: '', messageName: '',
    signalRef: '', signalName: '',
    errorRef: '', errorCode: '',
    escalationRef: '', escalationCode: '',
    conditionExpression: '',
    linkName: '',
    activityRef: '',
    cancelActivity: true,
    isCollection: false,
    processRef: '',
    annotationText: '',
    categoryValueRef: '',
  }
}

// ============================================================================
// Component logic
// ============================================================================
const props = defineProps<{ graph: Graph | null }>()

const visible = ref(false)
const currentCell = ref<Cell | null>(null)
const isNode = ref(true)
const shape = ref('')

const form = ref<FormData>(emptyForm())

const shapeName = computed(() => SHAPE_LABELS[shape.value] || shape.value)
const shapeCategory = computed(() => classifyShape(shape.value))
const modalTitle = computed(() => isNode.value ? `节点配置 - ${shapeName.value}` : `连线配置 - ${shapeName.value}`)

const isEventSubProcess = computed(() => shape.value === 'bpmn-event-sub-process')
const isBoundaryEvent = computed(() => shape.value.includes('boundary'))
const isExclusiveOrInclusive = computed(() =>
  shape.value === 'bpmn-exclusive-gateway' || shape.value === 'bpmn-inclusive-gateway',
)

const outgoingEdges = computed(() => {
  if (!props.graph || !currentCell.value) return []
  const cell = currentCell.value
  if (!cell.isNode()) return []
  return props.graph.getEdges().filter(e => e.getSourceCellId() === cell.id).map(e => ({
    id: e.id,
    label: getCellLabel(e),
  }))
})

const implPlaceholder = computed(() => {
  switch (form.value.implementationType) {
    case 'class': return 'com.example.MyDelegate'
    case 'expression': return '${myService.execute()}'
    case 'delegateExpression': return '${myDelegateExpression}'
    default: return '输入实现'
  }
})

const timerValueLabel = computed(() => {
  switch (form.value.timerType) {
    case 'timeDuration': return '持续时间 (ISO 8601)'
    case 'timeDate': return '指定日期 (ISO 8601)'
    case 'timeCycle': return '循环表达式 (ISO 8601)'
    default: return '定时器值'
  }
})

const timerPlaceholder = computed(() => {
  switch (form.value.timerType) {
    case 'timeDuration': return 'PT30M (30分钟), PT1H (1小时)'
    case 'timeDate': return '2024-12-31T23:59:59Z'
    case 'timeCycle': return 'R3/PT10M (每10分钟，重复3次)'
    default: return ''
  }
})

// ============================================================================
// Helpers
// ============================================================================
function getCellLabel(cell: Cell): string {
  const data = cell.getData() || {}
  if (data.label) return data.label
  const attrLabel = cell.getAttrByPath('label/text') as string | undefined
  if (attrLabel) return attrLabel
  const headerLabel = cell.getAttrByPath('headerLabel/text') as string | undefined
  if (headerLabel) return headerLabel
  if (cell.isEdge()) {
    const labels = (cell as Edge).getLabels()
    if (labels.length > 0) {
      return (labels[0].attrs?.label?.text ?? labels[0].attrs?.text?.text ?? '') as string
    }
  }
  return ''
}

function loadBpmnData(cell: Cell) {
  const data = cell.getData() || {}
  const bpmn = data.bpmn || {}
  // User Task
  form.value.assignee = bpmn.assignee || ''
  form.value.candidateUsers = bpmn.candidateUsers || ''
  form.value.candidateGroups = bpmn.candidateGroups || ''
  form.value.formKey = bpmn.formKey || ''
  form.value.dueDate = bpmn.dueDate || ''
  form.value.priority = bpmn.priority || ''
  // Service / Business Rule
  form.value.implementationType = bpmn.implementationType || ''
  form.value.implementation = bpmn.implementation || ''
  form.value.resultVariable = bpmn.resultVariable || ''
  form.value.isAsync = bpmn.isAsync || false
  // Script
  form.value.scriptFormat = bpmn.scriptFormat || ''
  form.value.script = bpmn.script || ''
  // Call Activity
  form.value.calledElement = bpmn.calledElement || ''
  // Sub-process
  form.value.triggeredByEvent = shape.value === 'bpmn-event-sub-process'
  // Gateway
  form.value.defaultFlow = bpmn.defaultFlow || ''
  form.value.activationCondition = bpmn.activationCondition || ''
  // Timer
  form.value.timerType = bpmn.timerType || 'timeDuration'
  form.value.timerValue = bpmn.timerValue || ''
  // Message
  form.value.messageRef = bpmn.messageRef || ''
  form.value.messageName = bpmn.messageName || ''
  // Signal
  form.value.signalRef = bpmn.signalRef || ''
  form.value.signalName = bpmn.signalName || ''
  // Error
  form.value.errorRef = bpmn.errorRef || ''
  form.value.errorCode = bpmn.errorCode || ''
  // Escalation
  form.value.escalationRef = bpmn.escalationRef || ''
  form.value.escalationCode = bpmn.escalationCode || ''
  // Condition
  form.value.conditionExpression = bpmn.conditionExpression || ''
  // Link
  form.value.linkName = bpmn.linkName || ''
  // Compensation
  form.value.activityRef = bpmn.activityRef || ''
  // Boundary
  form.value.cancelActivity = bpmn.cancelActivity !== false
  // Data
  form.value.isCollection = bpmn.isCollection || false
  // Pool
  form.value.processRef = bpmn.processRef || ''
  // Annotation
  form.value.annotationText = bpmn.annotationText || getCellLabel(cell)
  // Group
  form.value.categoryValueRef = bpmn.categoryValueRef || ''
}

function saveBpmnData(): Record<string, any> {
  const cat = shapeCategory.value
  const bpmn: Record<string, any> = {}

  if (cat === 'userTask') {
    if (form.value.assignee) bpmn.assignee = form.value.assignee
    if (form.value.candidateUsers) bpmn.candidateUsers = form.value.candidateUsers
    if (form.value.candidateGroups) bpmn.candidateGroups = form.value.candidateGroups
    if (form.value.formKey) bpmn.formKey = form.value.formKey
    if (form.value.dueDate) bpmn.dueDate = form.value.dueDate
    if (form.value.priority) bpmn.priority = form.value.priority
  }
  if (cat === 'serviceTask' || cat === 'businessRuleTask' || cat === 'sendTask' || cat === 'receiveTask') {
    if (form.value.implementationType) bpmn.implementationType = form.value.implementationType
    if (form.value.implementation) bpmn.implementation = form.value.implementation
    if (form.value.resultVariable) bpmn.resultVariable = form.value.resultVariable
    bpmn.isAsync = form.value.isAsync
  }
  if (cat === 'scriptTask') {
    if (form.value.scriptFormat) bpmn.scriptFormat = form.value.scriptFormat
    if (form.value.script) bpmn.script = form.value.script
    if (form.value.resultVariable) bpmn.resultVariable = form.value.resultVariable
  }
  if (cat === 'callActivity') {
    if (form.value.calledElement) bpmn.calledElement = form.value.calledElement
    bpmn.isAsync = form.value.isAsync
  }
  if (cat === 'subProcess') {
    bpmn.isAsync = form.value.isAsync
    if (isEventSubProcess.value) bpmn.triggeredByEvent = true
  }
  if (cat === 'gateway') {
    if (form.value.defaultFlow) bpmn.defaultFlow = form.value.defaultFlow
    if (form.value.activationCondition) bpmn.activationCondition = form.value.activationCondition
  }
  if (cat === 'timerEvent') {
    bpmn.timerType = form.value.timerType
    if (form.value.timerValue) bpmn.timerValue = form.value.timerValue
  }
  if (cat === 'messageEvent' || cat === 'sendTask' || cat === 'receiveTask' || cat === 'messageFlow') {
    if (form.value.messageRef) bpmn.messageRef = form.value.messageRef
    if (form.value.messageName) bpmn.messageName = form.value.messageName
  }
  if (cat === 'signalEvent') {
    if (form.value.signalRef) bpmn.signalRef = form.value.signalRef
    if (form.value.signalName) bpmn.signalName = form.value.signalName
  }
  if (cat === 'errorEvent') {
    if (form.value.errorRef) bpmn.errorRef = form.value.errorRef
    if (form.value.errorCode) bpmn.errorCode = form.value.errorCode
  }
  if (cat === 'escalationEvent') {
    if (form.value.escalationRef) bpmn.escalationRef = form.value.escalationRef
    if (form.value.escalationCode) bpmn.escalationCode = form.value.escalationCode
  }
  if (cat === 'conditionalEvent' || cat === 'sequenceFlow') {
    if (form.value.conditionExpression) bpmn.conditionExpression = form.value.conditionExpression
  }
  if (cat === 'linkEvent') {
    if (form.value.linkName) bpmn.linkName = form.value.linkName
  }
  if (cat === 'compensationEvent') {
    if (form.value.activityRef) bpmn.activityRef = form.value.activityRef
  }
  if (isBoundaryEvent.value) {
    bpmn.cancelActivity = form.value.cancelActivity
  }
  if (cat === 'dataObject') {
    bpmn.isCollection = form.value.isCollection
  }
  if (cat === 'pool') {
    if (form.value.processRef) bpmn.processRef = form.value.processRef
  }
  if (cat === 'textAnnotation') {
    if (form.value.annotationText) bpmn.annotationText = form.value.annotationText
  }
  if (cat === 'group') {
    if (form.value.categoryValueRef) bpmn.categoryValueRef = form.value.categoryValueRef
  }
  return bpmn
}

// ============================================================================
// Open / Save / Close
// ============================================================================
function openModal(cell: Cell) {
  currentCell.value = cell
  shape.value = cell.shape
  const nodeFlag = cell.isNode()
  isNode.value = nodeFlag

  Object.assign(form.value, emptyForm())
  form.value.id = cell.id
  form.value.label = getCellLabel(cell)
  form.value.documentation = (cell.getData()?.documentation ?? '') as string

  if (nodeFlag) {
    const n = cell as Node
    const pos = n.getPosition()
    const size = n.getSize()
    form.value.x = Math.round(pos.x)
    form.value.y = Math.round(pos.y)
    form.value.width = Math.round(size.width)
    form.value.height = Math.round(size.height)
    form.value.fillColor = (n.getAttrByPath('body/fill') as string) || '#ffffff'
    form.value.strokeColor = (n.getAttrByPath('body/stroke') as string) || '#000000'
  } else {
    const e = cell as Edge
    form.value.strokeColor = (e.getAttrByPath('line/stroke') as string) || '#000000'
    form.value.strokeWidth = (e.getAttrByPath('line/strokeWidth') as number) || 1
  }

  loadBpmnData(cell)
  visible.value = true
}

function onSave(done: (closed: boolean) => void) {
  const cell = currentCell.value
  if (!cell) { done(true); return }

  const label = form.value.label
  if (cell.isNode()) {
    const n = cell as Node
    if (n.getAttrByPath('headerLabel/text') !== undefined) {
      n.setAttrByPath('headerLabel/text', label)
    } else {
      n.setAttrByPath('label/text', label)
    }
    n.setPosition(form.value.x, form.value.y)
    n.resize(form.value.width, form.value.height)
    n.setAttrByPath('body/fill', form.value.fillColor)
    n.setAttrByPath('body/stroke', form.value.strokeColor)
  } else {
    const e = cell as Edge
    const labels = e.getLabels()
    if (labels.length > 0) {
      e.setLabelAt(0, {
        ...labels[0],
        attrs: { ...labels[0].attrs, label: { ...(labels[0].attrs?.label || {}), text: label } },
      })
    } else if (label) {
      e.appendLabel({ attrs: { label: { text: label } }, position: { distance: 0.5 } })
    }
    e.setAttrByPath('line/stroke', form.value.strokeColor)
    e.setAttrByPath('line/strokeWidth', form.value.strokeWidth)
  }

  // Persist to cell data
  const prevData = cell.getData() || {}
  const bpmn = saveBpmnData()
  cell.setData({ ...prevData, label, documentation: form.value.documentation, bpmn })

  done(true)
}

function onClose() {
  currentCell.value = null
}

// ============================================================================
// Event binding
// ============================================================================
function onCellDblClick({ cell }: { cell: Cell }) {
  openModal(cell)
}

let prevGraph: Graph | null = null
function bindEvents(g: Graph | null) {
  if (prevGraph) prevGraph.off('cell:dblclick', onCellDblClick)
  if (g) g.on('cell:dblclick', onCellDblClick)
  prevGraph = g
}

watch(() => props.graph, (g) => bindEvents(g), { immediate: true })
onBeforeUnmount(() => bindEvents(null))
</script>

<style scoped>
.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-input {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 2px;
  cursor: pointer;
  background: none;
  flex-shrink: 0;
}
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: none; border-radius: 2px; }
</style>
