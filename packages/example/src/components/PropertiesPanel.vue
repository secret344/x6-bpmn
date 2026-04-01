<template>
  <div class="properties-panel">
    <div class="panel-header">属性</div>
    <div v-if="!selectedCell" class="panel-empty">
      <icon-select-all style="font-size: 32px; color: var(--color-text-4)" />
      <span class="hint">选择节点或连线查看属性</span>
    </div>
    <div v-else class="panel-body">
      <!-- 基础信息 -->
      <div class="field-section">
        <div class="section-title">基础信息</div>
        <div class="field-row">
          <label>ID</label>
          <a-typography-text copyable :ellipsis="{ rows: 1 }" class="field-id">
            {{ selectedCell.id }}
          </a-typography-text>
        </div>
        <div class="field-row">
          <label>类型</label>
          <a-tag size="small" color="arcoblue">{{ getShapeLabel(selectedCell.shape) }}</a-tag>
        </div>
        <div class="field-row">
          <label>标签</label>
          <a-input v-model="formData.label" size="small" placeholder="元素名称" @change="onLabelChange" />
        </div>
      </div>

      <!-- 位置/尺寸（仅节点） -->
      <div v-if="cellPos" class="field-section">
        <div class="section-title">位置与尺寸</div>
        <div class="field-row">
          <label>位置</label>
          <span class="field-value">({{ Math.round(cellPos.x) }}, {{ Math.round(cellPos.y) }})</span>
        </div>
        <div class="field-row" v-if="cellSize">
          <label>尺寸</label>
          <span class="field-value">{{ cellSize.width }} × {{ cellSize.height }}</span>
        </div>
      </div>

      <!-- BPMN 属性（根据元素类别动态显示） -->
      <div v-if="categoryFields.length > 0" class="field-section">
        <div class="section-title">BPMN 属性</div>
        <template v-for="field in categoryFields" :key="field.key">
          <!-- 布尔字段 -->
          <div v-if="field.type === 'boolean'" class="field-row">
            <label>{{ field.label }}</label>
            <a-switch v-model="bpmnForm[field.key]" size="small" @change="onBpmnFieldChange" />
          </div>
          <!-- 选择字段 -->
          <div v-else-if="field.type === 'select'" class="field-row">
            <label>{{ field.label }}</label>
            <a-select v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" allow-clear @change="onBpmnFieldChange">
              <a-option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-select>
          </div>
          <!-- 多行文本 -->
          <div v-else-if="field.type === 'textarea'" class="field-row vertical">
            <label>{{ field.label }}</label>
            <a-textarea v-model="bpmnForm[field.key]" :auto-size="{ minRows: 2, maxRows: 6 }" :placeholder="field.placeholder" @change="onBpmnFieldChange" />
          </div>
          <!-- 普通文本输入 -->
          <div v-else class="field-row">
            <label>{{ field.label }}</label>
            <a-input v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" @change="onBpmnFieldChange" />
          </div>
        </template>
      </div>

      <!-- 连线属性 -->
      <div v-if="isEdge" class="field-section">
        <div class="section-title">连线属性</div>
        <div class="field-row">
          <label>条件表达式</label>
          <a-input v-model="bpmnForm.conditionExpression" size="small" placeholder="如: ${amount > 1000}" @change="onBpmnFieldChange" />
        </div>
      </div>

      <!-- 自定义属性 -->
      <div class="field-section">
        <div class="section-title custom-attrs-title">
          自定义属性
          <a-button size="mini" type="text" @click="addCustomAttr">
            <template #icon><icon-plus /></template>
            添加
          </a-button>
        </div>
        <div v-for="(attr, index) in customAttrs" :key="index" class="custom-attr-row">
          <a-input v-model="attr.key" size="small" placeholder="属性名" class="attr-key" @change="onCustomAttrChange" />
          <a-input v-model="attr.value" size="small" placeholder="属性值" class="attr-value" @change="onCustomAttrChange" />
          <a-button size="mini" type="text" status="danger" @click="removeCustomAttr(index)">
            <template #icon><icon-delete /></template>
          </a-button>
        </div>
        <div v-if="customAttrs.length === 0" class="empty-hint">暂无自定义属性</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onBeforeUnmount } from 'vue'
import type { Graph, Cell } from '@antv/x6'
import { IconSelectAll, IconPlus, IconDelete } from '@arco-design/web-vue/es/icon'
import {
  classifyShape,
  getShapeLabel,
  loadBpmnFormData,
  saveBpmnFormData,
  getCellLabel,
  type BpmnFormData,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'

const props = defineProps<{
  graph: Graph | null
}>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const isEdge = ref(false)

const formData = reactive({ label: '' })
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)
const customAttrs = reactive<Array<{ key: string; value: string }>>([])

// 当前元素的分类
const category = computed<ShapeCategory>(() => {
  if (!selectedCell.value) return 'unknown'
  return classifyShape(selectedCell.value.shape)
})

// 字段配置定义
interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'boolean' | 'select'
  placeholder?: string
  options?: Array<{ value: string; label: string }>
}

// 根据分类动态计算字段列表
const categoryFields = computed<FieldConfig[]>(() => {
  const cat = category.value
  const fields: FieldConfig[] = []

  if (cat === 'userTask') {
    fields.push(
      { key: 'assignee', label: '处理人', type: 'text', placeholder: '如: admin' },
      { key: 'candidateUsers', label: '候选用户', type: 'text', placeholder: '逗号分隔' },
      { key: 'candidateGroups', label: '候选组', type: 'text', placeholder: '逗号分隔' },
      { key: 'formKey', label: '表单Key', type: 'text', placeholder: '表单标识' },
      { key: 'dueDate', label: '到期日', type: 'text', placeholder: '如: 2025-12-31' },
      { key: 'priority', label: '优先级', type: 'text', placeholder: '如: 50' },
    )
  }
  if (cat === 'serviceTask' || cat === 'businessRuleTask' || cat === 'sendTask' || cat === 'receiveTask') {
    fields.push(
      { key: 'implementationType', label: '实现类型', type: 'select', options: [
        { value: 'class', label: 'Java 类' },
        { value: 'expression', label: '表达式' },
        { value: 'delegateExpression', label: '委托表达式' },
      ]},
      { key: 'implementation', label: '实现', type: 'text', placeholder: '类名/表达式' },
      { key: 'resultVariable', label: '结果变量', type: 'text', placeholder: '变量名' },
      { key: 'isAsync', label: '异步', type: 'boolean' },
    )
  }
  if (cat === 'scriptTask') {
    fields.push(
      { key: 'scriptFormat', label: '脚本格式', type: 'select', options: [
        { value: 'groovy', label: 'Groovy' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'python', label: 'Python' },
      ]},
      { key: 'script', label: '脚本内容', type: 'textarea', placeholder: '输入脚本...' },
      { key: 'resultVariable', label: '结果变量', type: 'text', placeholder: '变量名' },
    )
  }
  if (cat === 'callActivity') {
    fields.push(
      { key: 'calledElement', label: '被调流程', type: 'text', placeholder: '流程 ID' },
      { key: 'isAsync', label: '异步', type: 'boolean' },
    )
  }
  if (cat === 'subProcess') {
    fields.push(
      { key: 'isAsync', label: '异步', type: 'boolean' },
      { key: 'triggeredByEvent', label: '事件触发', type: 'boolean' },
    )
  }
  if (cat === 'gateway') {
    fields.push(
      { key: 'defaultFlow', label: '默认流', type: 'text', placeholder: '目标边 ID' },
      { key: 'activationCondition', label: '激活条件', type: 'text', placeholder: '条件表达式' },
    )
  }
  if (cat === 'timerEvent') {
    fields.push(
      { key: 'timerType', label: '定时类型', type: 'select', options: [
        { value: 'timeDuration', label: '持续时间' },
        { value: 'timeDate', label: '固定时间' },
        { value: 'timeCycle', label: '循环' },
      ]},
      { key: 'timerValue', label: '定时值', type: 'text', placeholder: '如: PT5M' },
    )
  }
  if (cat === 'messageEvent') {
    fields.push(
      { key: 'messageRef', label: '消息引用', type: 'text', placeholder: '消息定义 ID' },
      { key: 'messageName', label: '消息名称', type: 'text', placeholder: '消息名' },
    )
  }
  if (cat === 'signalEvent') {
    fields.push(
      { key: 'signalRef', label: '信号引用', type: 'text', placeholder: '信号定义 ID' },
      { key: 'signalName', label: '信号名称', type: 'text', placeholder: '信号名' },
    )
  }
  if (cat === 'errorEvent') {
    fields.push(
      { key: 'errorRef', label: '错误引用', type: 'text', placeholder: '错误定义 ID' },
      { key: 'errorCode', label: '错误代码', type: 'text', placeholder: '错误码' },
    )
  }
  if (cat === 'escalationEvent') {
    fields.push(
      { key: 'escalationRef', label: '升级引用', type: 'text', placeholder: '升级定义 ID' },
      { key: 'escalationCode', label: '升级代码', type: 'text', placeholder: '升级码' },
    )
  }
  if (cat === 'conditionalEvent') {
    fields.push(
      { key: 'conditionExpression', label: '条件表达式', type: 'text', placeholder: '条件表达式' },
    )
  }
  if (cat === 'linkEvent') {
    fields.push(
      { key: 'linkName', label: '链接名称', type: 'text', placeholder: '链接名' },
    )
  }
  if (cat === 'compensationEvent') {
    fields.push(
      { key: 'activityRef', label: '活动引用', type: 'text', placeholder: '被补偿活动 ID' },
    )
  }
  if (cat === 'cancelEvent' || cat === 'terminateEvent' || cat === 'noneEvent' || cat === 'multipleEvent') {
    // 这些事件没有额外的可编辑字段
  }
  if (cat === 'dataObject') {
    fields.push({ key: 'isCollection', label: '集合', type: 'boolean' })
  }
  if (cat === 'pool') {
    fields.push({ key: 'processRef', label: '流程引用', type: 'text', placeholder: '流程 ID' })
  }
  if (cat === 'textAnnotation') {
    fields.push({ key: 'annotationText', label: '注释文本', type: 'textarea', placeholder: '输入注释...' })
  }
  if (cat === 'group') {
    fields.push({ key: 'categoryValueRef', label: '分类值', type: 'text', placeholder: '分类标识' })
  }
  // 边界事件公共字段
  if (selectedCell.value && selectedCell.value.shape.includes('boundary')) {
    fields.push({ key: 'cancelActivity', label: '中断活动', type: 'boolean' })
  }

  return fields
})

// ---- 选中逻辑 ----
function onCellClick({ cell }: { cell: Cell }) {
  selectedCell.value = cell
  isEdge.value = cell.isEdge()
  if (cell.isNode()) {
    cellPos.value = cell.getPosition()
    cellSize.value = cell.getSize()
  } else {
    cellPos.value = null
    cellSize.value = null
  }
  formData.label = getCellLabel(cell)

  // 加载 BPMN 表单数据
  const loaded = loadBpmnFormData(cell)
  Object.assign(bpmnForm, loaded)

  // 加载自定义属性
  loadCustomAttrs(cell)
}

function onBlankClick() {
  selectedCell.value = null
  cellPos.value = null
  cellSize.value = null
  isEdge.value = false
  formData.label = ''
  customAttrs.splice(0, customAttrs.length)
}

function onLabelChange() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const data = cell.getData() || {}
  cell.setData({ ...data, label: formData.label })
  // 同步到图形标签
  if (cell.isNode()) {
    cell.setAttrByPath('label/text', formData.label)
  } else if (cell.isEdge()) {
    const labels = cell.getLabels()
    if (labels.length > 0) {
      cell.setLabels([{ ...labels[0], attrs: { ...labels[0].attrs, label: { text: formData.label } } }])
    } else {
      cell.appendLabel({ attrs: { label: { text: formData.label } } })
    }
  }
}

function onBpmnFieldChange() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const cat = category.value
  const bpmnData = saveBpmnFormData(cat, bpmnForm, cell.shape)
  const data = cell.getData() || {}
  cell.setData({ ...data, bpmn: bpmnData })
}

// ---- 自定义属性 ----
function loadCustomAttrs(cell: Cell) {
  customAttrs.splice(0, customAttrs.length)
  const data = cell.getData() || {}
  const attrs = data.customAttrs as Record<string, string> | undefined
  if (attrs && typeof attrs === 'object') {
    for (const [k, v] of Object.entries(attrs)) {
      customAttrs.push({ key: k, value: String(v) })
    }
  }
}

function saveCustomAttrs() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const data = cell.getData() || {}
  const attrs: Record<string, string> = {}
  for (const item of customAttrs) {
    if (item.key.trim()) attrs[item.key.trim()] = item.value
  }
  cell.setData({ ...data, customAttrs: attrs })
}

function addCustomAttr() {
  customAttrs.push({ key: '', value: '' })
}

function removeCustomAttr(index: number) {
  customAttrs.splice(index, 1)
  saveCustomAttrs()
}

function onCustomAttrChange() {
  saveCustomAttrs()
}

let prevGraph: Graph | null = null

function bindEvents(g: Graph | null) {
  if (prevGraph) {
    prevGraph.off('cell:click', onCellClick)
    prevGraph.off('blank:click', onBlankClick)
  }
  if (g) {
    g.on('cell:click', onCellClick)
    g.on('blank:click', onBlankClick)
  }
  prevGraph = g
}

watch(
  () => props.graph,
  (g) => bindEvents(g),
  { immediate: true },
)

onBeforeUnmount(() => bindEvents(null))
</script>

<style scoped>
.properties-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  border-bottom: 1px solid var(--color-border-2);
  flex-shrink: 0;
}

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-3);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.field-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-1);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.field-row.vertical {
  flex-direction: column;
  align-items: stretch;
}

.field-row label {
  font-size: 12px;
  color: var(--color-text-2);
  min-width: 64px;
  flex-shrink: 0;
}

.field-row.vertical label {
  margin-bottom: 4px;
}

.field-row :deep(.arco-input-wrapper),
.field-row :deep(.arco-select-view-single),
.field-row :deep(.arco-textarea-wrapper) {
  flex: 1;
}

.field-id {
  font-size: 11px;
  font-family: monospace;
}

.field-value {
  font-size: 12px;
  color: var(--color-text-3);
}

.custom-attrs-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-attr-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.attr-key {
  flex: 2;
}

.attr-value {
  flex: 3;
}

.empty-hint {
  font-size: 11px;
  color: var(--color-text-4);
  text-align: center;
  padding: 8px 0;
}
</style>
