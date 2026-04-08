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
          <div v-if="field.input === 'boolean'" class="field-row">
            <label>{{ field.label }}</label>
            <a-switch v-model="bpmnForm[field.key]" size="small" @change="saveBpmn" />
          </div>
          <div v-else-if="field.input === 'select'" class="field-row">
            <label>{{ field.label }}</label>
            <a-select v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" allow-clear @change="saveBpmn">
              <a-option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-select>
          </div>
          <div v-else-if="field.input === 'textarea'" class="field-row vertical">
            <label>{{ field.label }}</label>
            <a-textarea v-model="bpmnForm[field.key]" :auto-size="{ minRows: 2, maxRows: 6 }" :placeholder="field.placeholder" @change="saveBpmn" />
          </div>
          <div v-else class="field-row">
            <label>{{ field.label }}</label>
            <a-input v-model="bpmnForm[field.key]" size="small" :placeholder="field.placeholder" @change="saveBpmn" />
          </div>
        </template>
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
  getFieldEditorsForShape,
  getShapeLabel,
  getBpmnShapeIcon,
  loadBpmnFormData,
  saveBpmnFormData,
  getCellLabel,
  type BpmnFormData,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'
import { useDialectSingleton } from '../composables/useDialect'

const props = defineProps<{ graph: Graph | null }>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const labelValue = ref('')
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)
const customAttrs = reactive<Array<{ key: string; value: string }>>([])
const { resolvedProfile } = useDialectSingleton()

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

const bpmnFields = computed(() => {
  if (!selectedCell.value || !resolvedProfile.value) return []
  return getFieldEditorsForShape(
    selectedCell.value.shape,
    category.value,
    resolvedProfile.value.dataModel,
  )
})

// ---- 事件绑定 ----
let cleanup: (() => void) | null = null

watch(() => props.graph, (g) => {
  cleanup?.()
  if (!g) return
  const onCell = ({ cell }: { cell: Cell }) => {
    selectedCell.value = cell
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

function getReservedBpmnKeys() {
  return new Set(bpmnFields.value.map((field) => field.key))
}

function getCellDataRecord(cell: Pick<Cell, 'getData'>): Record<string, unknown> {
  return (cell.getData() || {}) as Record<string, unknown>
}

function getBpmnDataRecord(data: Record<string, unknown>): Record<string, unknown> {
  return data.bpmn && typeof data.bpmn === 'object'
    ? data.bpmn as Record<string, unknown>
    : {}
}

function getMergedCustomAttrEntries(data: Record<string, unknown>) {
  const reservedKeys = getReservedBpmnKeys()
  const entries = new Map<string, string>()
  const legacyAttrs = data.customAttrs && typeof data.customAttrs === 'object'
    ? data.customAttrs as Record<string, unknown>
    : {}

  for (const [key, value] of Object.entries(getBpmnDataRecord(data))) {
    if (!reservedKeys.has(key)) {
      entries.set(key, String(value))
    }
  }

  for (const [key, value] of Object.entries(legacyAttrs)) {
    if (!reservedKeys.has(key) && !entries.has(key)) {
      entries.set(key, String(value))
    }
  }

  return Array.from(entries.entries())
}

function buildNextBpmnData(
  cell: Pick<Cell, 'shape'>,
  data: Record<string, unknown>,
  customAttrsPatch: Record<string, unknown> = {},
) {
  const reservedKeys = getReservedBpmnKeys()
  const preservedCustomAttrs = Object.fromEntries(
    Object.entries(getBpmnDataRecord(data)).filter(([key]) => !reservedKeys.has(key)),
  )
  const formBpmnData = saveBpmnFormData(category.value, bpmnForm, cell.shape)

  return {
    ...preservedCustomAttrs,
    ...formBpmnData,
    ...customAttrsPatch,
  }
}

function setCellDataWithBpmn(
  cell: Pick<Cell, 'setData'>,
  data: Record<string, unknown>,
  bpmnData: Record<string, unknown>,
) {
  const { customAttrs: _legacyCustomAttrs, ...restData } = data
  cell.setData({
    ...restData,
    bpmn: bpmnData,
  })
}

function saveBpmn() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const data = getCellDataRecord(cell)
  setCellDataWithBpmn(cell, data, buildNextBpmnData(cell, data))
}

// ---- 自定义属性 ----
function loadCustomAttrs(cell: Cell) {
  customAttrs.splice(0, customAttrs.length)
  const data = getCellDataRecord(cell)
  for (const [key, value] of getMergedCustomAttrEntries(data)) {
    customAttrs.push({ key, value })
  }
}

function saveCustomAttrs() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const data = getCellDataRecord(cell)
  const reservedKeys = getReservedBpmnKeys()
  const attrs: Record<string, unknown> = {}
  for (const item of customAttrs) {
    const key = item.key.trim()
    if (key && !reservedKeys.has(key)) attrs[key] = item.value
  }
  setCellDataWithBpmn(cell, data, buildNextBpmnData(cell, data, attrs))
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
