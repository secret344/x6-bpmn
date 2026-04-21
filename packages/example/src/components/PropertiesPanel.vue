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
          <div v-if="field.input === 'boolean'" class="field-row">
            <label>{{ field.label }}</label>
            <a-switch v-model="bpmnForm[field.key]" size="small" @change="onBpmnFieldChange" />
          </div>
          <!-- 选择字段 -->
          <div v-else-if="field.input === 'select'" class="field-row">
            <label>{{ field.label }}</label>
            <a-select v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" allow-clear @change="onBpmnFieldChange">
              <a-option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-select>
          </div>
          <!-- 多行文本 -->
          <div v-else-if="field.input === 'textarea'" class="field-row vertical">
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

      <div v-if="customSemanticSections.length > 0" class="field-section">
        <div class="section-title">自定义 XML 语义</div>
        <div v-for="section in customSemanticSections" :key="section.title" class="semantic-section">
          <div class="semantic-section-title">{{ section.title }}</div>
          <div v-for="entry in section.entries" :key="`${section.title}-${entry.key}`" class="semantic-row">
            <div class="semantic-key">{{ entry.key }}</div>
            <div class="semantic-value">{{ entry.value }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onBeforeUnmount } from 'vue'
import type { Graph, Cell, Edge } from '@antv/x6'
import { IconSelectAll } from '@arco-design/web-vue/es/icon'
import {
  bpmn2Profile,
  classifyShape,
  getFieldEditorsForShape,
  getShapeLabel,
  loadBpmnFormData,
  saveBpmnFormData,
  type BpmnFormData,
  type DataModelSet,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'
import { NATIVE_BPMN_FIELD_KEYS, buildNativeBpmnData, filterNativeFieldEditors } from '../native-bpmn'

const bpmn2DataModel = bpmn2Profile.dataModel as DataModelSet

const props = defineProps<{
  graph: Graph | null
}>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const cellDataVersion = ref(0)

const formData = reactive({ label: '' })
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)

type SemanticEntry = {
  key: string
  value: string
}

type SemanticSection = {
  title: string
  entries: SemanticEntry[]
}

function readRenderedCellLabel(cell: Cell): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatSemanticValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2) ?? ''
}

function toSemanticEntries(record: Record<string, unknown> | undefined): SemanticEntry[] {
  if (!record) return []

  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      key,
      value: formatSemanticValue(value),
    }))
}

const customSemanticSections = computed<SemanticSection[]>(() => {
  void cellDataVersion.value
  if (!selectedCell.value) return []

  const data = selectedCell.value.getData()
  if (!isRecord(data)) return []

  const bpmn = isRecord(data.bpmn) ? data.bpmn : undefined
  const bpmndi = isRecord(data.bpmndi) ? data.bpmndi : undefined

  const customBpmnAttrs = isRecord(bpmn?.$attrs) ? bpmn.$attrs as Record<string, unknown> : undefined
  const customBpmnNamespaces = isRecord(bpmn?.$namespaces) ? bpmn.$namespaces as Record<string, unknown> : undefined
  const customBpmndiAttrs = isRecord(bpmndi?.$attrs) ? bpmndi.$attrs as Record<string, unknown> : undefined
  const customBpmndiNamespaces = isRecord(bpmndi?.$namespaces) ? bpmndi.$namespaces as Record<string, unknown> : undefined

  const customExtensionProps = bpmn
    ? Object.fromEntries(
        Object.entries(bpmn).filter(([key, value]) => {
          return !NATIVE_BPMN_FIELD_KEYS.has(key)
            && key !== '$attrs'
            && key !== '$namespaces'
            && value !== undefined
            && value !== null
            && value !== ''
        }),
      )
    : undefined

  return [
    { title: 'BPMN 行内属性', entries: toSemanticEntries(customBpmnAttrs) },
    { title: 'BPMN 扩展属性', entries: toSemanticEntries(customExtensionProps) },
    { title: 'BPMN 命名空间', entries: toSemanticEntries(customBpmnNamespaces) },
    { title: 'BPMNDI 行内属性', entries: toSemanticEntries(customBpmndiAttrs) },
    { title: 'BPMNDI 命名空间', entries: toSemanticEntries(customBpmndiNamespaces) },
  ].filter((section) => section.entries.length > 0)
})

// 当前元素的分类
const category = computed<ShapeCategory>(() => {
  if (!selectedCell.value) return 'unknown'
  return classifyShape(selectedCell.value.shape)
})

// 根据分类动态计算字段列表
const categoryFields = computed(() => {
  if (!selectedCell.value) return []
  return filterNativeFieldEditors(
    getFieldEditorsForShape(
      selectedCell.value.shape,
      category.value,
      bpmn2DataModel,
    ),
  )
})

// ---- 选中逻辑 ----
function onCellClick({ cell }: { cell: Cell }) {
  selectedCell.value = cell
  if (cell.isNode()) {
    cellPos.value = cell.getPosition()
    cellSize.value = cell.getSize()
  } else {
    cellPos.value = null
    cellSize.value = null
  }
  formData.label = readRenderedCellLabel(cell)

  // 加载 BPMN 表单数据
  const loaded = loadBpmnFormData(cell)
  Object.assign(bpmnForm, loaded)
  cellDataVersion.value += 1
}

function onBlankClick() {
  selectedCell.value = null
  cellPos.value = null
  cellSize.value = null
  formData.label = ''
  cellDataVersion.value += 1
}

function onLabelChange() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  cellDataVersion.value += 1
  if (cell.isNode()) {
    if (cell.getAttrByPath('headerLabel/text') !== undefined) {
      cell.setAttrByPath('headerLabel/text', formData.label)
    } else {
      cell.setAttrByPath('label/text', formData.label)
    }
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
  const data = (cell.getData() || {}) as Record<string, unknown>
  const saved = saveBpmnFormData(category.value, bpmnForm, cell.shape) as Record<string, unknown>
  cell.setData({
    ...data,
    bpmn: buildNativeBpmnData(
      data.bpmn as Record<string, unknown> | undefined,
      saved,
    ),
  })
  cellDataVersion.value += 1
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

.semantic-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.semantic-section:first-of-type {
  margin-top: 0;
}

.semantic-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
}

.semantic-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: 6px;
}

.semantic-key {
  font-size: 11px;
  color: var(--color-text-3);
  font-family: monospace;
}

.semantic-value {
  font-size: 12px;
  color: var(--color-text-1);
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
