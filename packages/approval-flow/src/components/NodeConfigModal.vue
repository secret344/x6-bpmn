<template>
  <a-modal
    v-model:visible="visible"
    :title="modalTitle"
    :width="560"
    @ok="handleSave"
    @cancel="handleCancel"
    ok-text="保存"
    cancel-text="取消"
  >
    <a-tabs default-active-key="basic">
      <!-- 基本属性 -->
      <a-tab-pane key="basic" title="基本属性">
        <a-form :model="form" layout="vertical">
          <a-form-item label="节点ID">
            <a-input :model-value="cellId" disabled />
          </a-form-item>
          <a-form-item label="节点类型">
            <a-input :model-value="shapeLabel" disabled />
          </a-form-item>
          <a-form-item label="节点名称">
            <a-input v-model="cellName" placeholder="请输入节点名称" />
          </a-form-item>
        </a-form>
      </a-tab-pane>

      <!-- BPMN 属性 -->
      <a-tab-pane key="bpmn" title="BPMN 属性">
        <a-form :model="form" layout="vertical">
          <!-- 用户任务 (userTask) 属性 -->
          <template v-if="category === 'userTask'">
            <a-form-item label="处理人 (assignee)">
              <a-input v-model="form.assignee" placeholder="指定处理人" />
            </a-form-item>
            <a-form-item label="候选用户 (candidateUsers)">
              <a-input v-model="form.candidateUsers" placeholder="逗号分隔多个用户" />
            </a-form-item>
            <a-form-item label="候选组 (candidateGroups)">
              <a-input v-model="form.candidateGroups" placeholder="逗号分隔多个组" />
            </a-form-item>
            <a-form-item label="表单标识 (formKey)">
              <a-input v-model="form.formKey" placeholder="关联的表单标识" />
            </a-form-item>
            <a-form-item label="到期日期 (dueDate)">
              <a-input v-model="form.dueDate" placeholder="如 ${dueDate} 或固定日期" />
            </a-form-item>
            <a-form-item label="优先级 (priority)">
              <a-input v-model="form.priority" placeholder="0-100" />
            </a-form-item>
          </template>

          <!-- 开始 / 结束事件，无额外 BPMN 属性 -->
          <template v-if="category === 'noneEvent'">
            <a-empty description="该节点无额外 BPMN 属性" />
          </template>

          <!-- 顺序流 -->
          <template v-if="category === 'sequenceFlow'">
            <a-form-item label="条件表达式 (conditionExpression)">
              <a-textarea v-model="form.conditionExpression" placeholder="${condition}" :auto-size="{ minRows: 2 }" />
            </a-form-item>
          </template>

          <!-- 未知类型 -->
          <template v-if="category === 'unknown'">
            <a-empty description="不可配置的节点类型" />
          </template>
        </a-form>
      </a-tab-pane>

      <!-- 自定义扩展属性 -->
      <a-tab-pane key="custom" title="自定义属性">
        <a-form layout="vertical">
          <div v-for="(item, idx) in customFields" :key="idx" class="custom-field-row">
            <a-input v-model="item.key" placeholder="属性名" style="width: 180px" />
            <a-input v-model="item.value" placeholder="属性值" style="flex: 1; margin: 0 8px" />
            <a-button type="text" status="danger" @click="removeCustomField(idx)">删除</a-button>
          </div>
          <a-button type="dashed" long @click="addCustomField" style="margin-top: 8px">
            + 添加自定义属性
          </a-button>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import type { Cell } from '@antv/x6'
import {
  classifyShape,
  getShapeLabel,
  loadBpmnFormData,
  saveBpmnFormData,
  emptyBpmnFormData,
} from '@x6-bpmn2/plugin'
import type { BpmnFormData, ShapeCategory } from '@x6-bpmn2/plugin'

const emit = defineEmits<{
  (e: 'save', cellId: string, bpmn: Record<string, any>, name: string): void
}>()

const visible = ref(false)
const cellId = ref('')
const cellName = ref('')
const shapeName = ref('')
const category = ref<ShapeCategory>('unknown')
const form = reactive<BpmnFormData>(emptyBpmnFormData())

const customFields = ref<{ key: string; value: string }[]>([])

const shapeLabel = computed(() => getShapeLabel(shapeName.value))
const modalTitle = computed(() => `节点属性 - ${shapeLabel.value}`)

let currentCell: Cell | null = null

/**
 * 打开配置面板（由外部调用）
 */
function open(cell: Cell) {
  currentCell = cell
  cellId.value = cell.id
  shapeName.value = cell.shape
  category.value = classifyShape(cell.shape)

  // 读取名称
  const data = cell.getData() || {}
  const attrLabel = cell.getAttrByPath('label/text') as string | undefined
  cellName.value = data.label || attrLabel || ''

  // 读取 BPMN 数据
  const loaded = loadBpmnFormData(cell)
  Object.assign(form, loaded)

  // 读取自定义扩展字段
  const bpmn = data.bpmn || {}
  const standardKeys = new Set(Object.keys(emptyBpmnFormData()))
  customFields.value = Object.keys(bpmn)
    .filter(k => !standardKeys.has(k))
    .map(k => ({ key: k, value: String(bpmn[k]) }))

  visible.value = true
}

function addCustomField() {
  customFields.value.push({ key: '', value: '' })
}

function removeCustomField(idx: number) {
  customFields.value.splice(idx, 1)
}

function handleSave() {
  // 将自定义字段合并到 form
  for (const f of customFields.value) {
    if (f.key) form[f.key] = f.value
  }

  const bpmn = saveBpmnFormData(category.value, form, shapeName.value)
  emit('save', cellId.value, bpmn, cellName.value)
  visible.value = false
}

function handleCancel() {
  visible.value = false
}

defineExpose({ open })
</script>

<style scoped>
.custom-field-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
</style>
