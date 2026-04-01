<template>
  <div class="properties-panel">
    <template v-if="selectedCell">
      <div class="cell-header">
        <div class="cell-icon" v-html="shapeIcon"></div>
        <div class="cell-info">
          <a-tag size="small" :color="tagColor">{{ shapeLabel }}</a-tag>
          <a-typography-text copyable style="font-size: 11px; font-family: monospace">
            {{ selectedCell.id }}
          </a-typography-text>
        </div>
      </div>

      <!-- 标签编辑 -->
      <div class="field-section">
        <div class="section-title">基础属性</div>
        <div class="field-row">
          <label>标签</label>
          <a-input v-model="labelValue" size="small" placeholder="元素名称" @change="onLabelChange" />
        </div>
        <div v-if="cellPos" class="field-row">
          <label>位置</label>
          <span class="field-value">({{ Math.round(cellPos.x) }}, {{ Math.round(cellPos.y) }})</span>
        </div>
        <div v-if="cellSize" class="field-row">
          <label>尺寸</label>
          <span class="field-value">{{ cellSize.width }} × {{ cellSize.height }}</span>
        </div>
      </div>

      <!-- BPMN 字段 -->
      <div v-if="bpmnFields.length > 0" class="field-section">
        <div class="section-title">BPMN 配置</div>
        <template v-for="field in bpmnFields" :key="field.key">
          <div v-if="field.type === 'boolean'" class="field-row">
            <label>{{ field.label }}</label>
            <a-switch v-model="bpmnForm[field.key]" size="small" @change="saveBpmn" />
          </div>
          <div v-else-if="field.type === 'select'" class="field-row">
            <label>{{ field.label }}</label>
            <a-select v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" allow-clear @change="saveBpmn">
              <a-option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-select>
          </div>
          <div v-else-if="field.type === 'textarea'" class="field-row vertical">
            <label>{{ field.label }}</label>
            <a-textarea v-model="bpmnForm[field.key]" :auto-size="{ minRows: 2, maxRows: 6 }" :placeholder="field.placeholder" @change="saveBpmn" />
          </div>
          <div v-else class="field-row">
            <label>{{ field.label }}</label>
            <a-input v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" @change="saveBpmn" />
          </div>
        </template>
      </div>

      <!-- 连线属性 -->
      <div v-if="isEdge" class="field-section">
        <div class="section-title">连线属性</div>
        <div class="field-row">
          <label>条件表达式</label>
          <a-input v-model="bpmnForm.conditionExpression" size="small" placeholder="${condition}" @change="saveBpmn" />
        </div>
      </div>

      <!-- 自定义属性 -->
      <div class="field-section">
        <div class="section-title custom-attrs-title">
          自定义属性
          <a-button size="mini" type="text" @click="addCustomAttr">+ 添加</a-button>
        </div>
        <div v-for="(attr, index) in customAttrs" :key="index" class="custom-attr-row">
          <a-input v-model="attr.key" size="small" placeholder="属性名" class="attr-key" @change="onCustomAttrChange" />
          <a-input v-model="attr.value" size="small" placeholder="属性值" class="attr-value" @change="onCustomAttrChange" />
          <a-button size="mini" type="text" status="danger" @click="removeCustomAttr(index)">✕</a-button>
        </div>
        <div v-if="customAttrs.length === 0" class="empty-hint">暂无自定义属性</div>
      </div>
    </template>

    <template v-else>
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div>点击画布上的元素编辑属性</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import type { Graph, Cell } from '@antv/x6'
import {
  classifyShape,
  getShapeLabel,
  getBpmnShapeIcon,
  loadBpmnFormData,
  saveBpmnFormData,
  getCellLabel,
  type BpmnFormData,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'

const props = defineProps<{ graph: Graph | null }>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const isEdge = ref(false)
const labelValue = ref('')
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)
const customAttrs = reactive<Array<{ key: string; value: string }>>([])

const category = computed<ShapeCategory>(() => {
  if (!selectedCell.value) return 'unknown'
  return classifyShape(selectedCell.value.shape)
})

const shapeLabel = computed(() => {
  if (!selectedCell.value) return ''
  return getShapeLabel(selectedCell.value.shape)
})

const shapeIcon = computed(() => {
  if (!selectedCell.value) return ''
  return getBpmnShapeIcon(selectedCell.value.shape)
})

const tagColor = computed(() => {
  const cat = category.value
  if (cat.includes('Event') || cat === 'noneEvent' || cat === 'timerEvent' || cat === 'messageEvent' ||
      cat === 'signalEvent' || cat === 'errorEvent' || cat === 'escalationEvent' || cat === 'conditionalEvent' ||
      cat === 'linkEvent' || cat === 'compensationEvent' || cat === 'cancelEvent' || cat === 'terminateEvent' || cat === 'multipleEvent')
    return 'green'
  if (cat.includes('Task') || cat === 'task' || cat === 'subProcess' || cat === 'callActivity')
    return 'blue'
  if (cat === 'gateway') return 'orange'
  return 'gray'
})

// 字段配置
interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'boolean' | 'select'
  placeholder?: string
  options?: Array<{ value: string; label: string }>
}

const bpmnFields = computed<FieldConfig[]>(() => {
  const cat = category.value
  const fields: FieldConfig[] = []

  if (cat === 'userTask') {
    fields.push(
      { key: 'assignee', label: '处理人', type: 'text', placeholder: 'admin' },
      { key: 'candidateUsers', label: '候选用户', type: 'text', placeholder: '逗号分隔' },
      { key: 'candidateGroups', label: '候选组', type: 'text', placeholder: '逗号分隔' },
      { key: 'formKey', label: '表单Key', type: 'text', placeholder: '表单标识' },
      { key: 'dueDate', label: '到期日', type: 'text', placeholder: '2025-12-31' },
      { key: 'priority', label: '优先级', type: 'text', placeholder: '50' },
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
      { key: 'resultVariable', label: '结果变量', type: 'text' },
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
      { key: 'script', label: '脚本', type: 'textarea', placeholder: '输入脚本...' },
      { key: 'resultVariable', label: '结果变量', type: 'text' },
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
      { key: 'activationCondition', label: '激活条件', type: 'text' },
    )
  }
  if (cat === 'timerEvent') {
    fields.push(
      { key: 'timerType', label: '定时类型', type: 'select', options: [
        { value: 'timeDuration', label: '持续时间' },
        { value: 'timeDate', label: '固定时间' },
        { value: 'timeCycle', label: '循环' },
      ]},
      { key: 'timerValue', label: '定时值', type: 'text', placeholder: 'PT5M' },
    )
  }
  if (cat === 'messageEvent') {
    fields.push(
      { key: 'messageRef', label: '消息引用', type: 'text' },
      { key: 'messageName', label: '消息名称', type: 'text' },
    )
  }
  if (cat === 'signalEvent') {
    fields.push(
      { key: 'signalRef', label: '信号引用', type: 'text' },
      { key: 'signalName', label: '信号名称', type: 'text' },
    )
  }
  if (cat === 'errorEvent') {
    fields.push(
      { key: 'errorRef', label: '错误引用', type: 'text' },
      { key: 'errorCode', label: '错误代码', type: 'text' },
    )
  }
  if (cat === 'escalationEvent') {
    fields.push(
      { key: 'escalationRef', label: '升级引用', type: 'text' },
      { key: 'escalationCode', label: '升级代码', type: 'text' },
    )
  }
  if (cat === 'conditionalEvent') {
    fields.push({ key: 'conditionExpression', label: '条件', type: 'text' })
  }
  if (cat === 'linkEvent') {
    fields.push({ key: 'linkName', label: '链接名', type: 'text' })
  }
  if (cat === 'compensationEvent') {
    fields.push({ key: 'activityRef', label: '活动引用', type: 'text' })
  }
  if (cat === 'dataObject') {
    fields.push({ key: 'isCollection', label: '集合', type: 'boolean' })
  }
  if (cat === 'pool') {
    fields.push({ key: 'processRef', label: '流程引用', type: 'text' })
  }
  if (cat === 'textAnnotation') {
    fields.push({ key: 'annotationText', label: '注释', type: 'textarea' })
  }
  if (cat === 'group') {
    fields.push({ key: 'categoryValueRef', label: '分类值', type: 'text' })
  }
  if (selectedCell.value?.shape.includes('boundary')) {
    fields.push({ key: 'cancelActivity', label: '中断', type: 'boolean' })
  }
  return fields
})

// ---- 事件绑定 ----
let cleanup: (() => void) | null = null

watch(() => props.graph, (g) => {
  cleanup?.()
  if (!g) return
  const onCell = ({ cell }: { cell: Cell }) => {
    selectedCell.value = cell
    isEdge.value = cell.isEdge()
    if (cell.isNode()) {
      cellPos.value = cell.getPosition()
      cellSize.value = cell.getSize()
    } else {
      cellPos.value = null
      cellSize.value = null
    }
    labelValue.value = getCellLabel(cell)
    Object.assign(bpmnForm, loadBpmnFormData(cell))
    loadCustomAttrs(cell)
  }
  const onBlank = () => {
    selectedCell.value = null
    cellPos.value = null
    cellSize.value = null
    isEdge.value = false
    labelValue.value = ''
    customAttrs.splice(0, customAttrs.length)
  }
  g.on('cell:click', onCell)
  g.on('blank:click', onBlank)
  cleanup = () => { g.off('cell:click', onCell); g.off('blank:click', onBlank) }
}, { immediate: true })

onUnmounted(() => cleanup?.())

function onLabelChange() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  cell.setData({ ...(cell.getData() || {}), label: labelValue.value })
  if (cell.isNode()) {
    cell.setAttrByPath('label/text', labelValue.value)
  }
}

function saveBpmn() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const bpmnData = saveBpmnFormData(category.value, bpmnForm, cell.shape)
  cell.setData({ ...(cell.getData() || {}), bpmn: bpmnData })
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
</script>

<style scoped>
.properties-panel {
  padding: 8px;
}

.cell-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 6px;
  margin-bottom: 12px;
}

.cell-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.cell-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.cell-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.field-section {
  margin-bottom: 14px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-1);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.field-row.vertical {
  flex-direction: column;
  align-items: stretch;
}

.field-row label {
  font-size: 11px;
  color: var(--color-text-2);
  min-width: 56px;
  flex-shrink: 0;
}

.field-row.vertical label {
  margin-bottom: 2px;
}

.field-row :deep(.arco-input-wrapper),
.field-row :deep(.arco-select-view-single),
.field-row :deep(.arco-textarea-wrapper) {
  flex: 1;
}

.field-value {
  font-size: 11px;
  color: var(--color-text-3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--color-text-3);
  text-align: center;
  font-size: 13px;
  gap: 8px;
}

.empty-icon {
  font-size: 28px;
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
