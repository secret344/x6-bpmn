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

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onBeforeUnmount } from 'vue'
import type { Graph, Cell } from '@antv/x6'
import { IconSelectAll } from '@arco-design/web-vue/es/icon'
import {
  bpmn2Profile,
  classifyShape,
  getFieldEditorsForShape,
  getShapeLabel,
  loadBpmnFormData,
  saveBpmnFormData,
  getCellLabel,
  type BpmnFormData,
  type DataModelSet,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'

const bpmn2DataModel = bpmn2Profile.dataModel as DataModelSet

const props = defineProps<{
  graph: Graph | null
}>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)

const formData = reactive({ label: '' })
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)

// 当前元素的分类
const category = computed<ShapeCategory>(() => {
  if (!selectedCell.value) return 'unknown'
  return classifyShape(selectedCell.value.shape)
})

// 根据分类动态计算字段列表
const categoryFields = computed(() => {
  if (!selectedCell.value) return []
  return getFieldEditorsForShape(
    selectedCell.value.shape,
    category.value,
    bpmn2DataModel,
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
  formData.label = getCellLabel(cell)

  // 加载 BPMN 表单数据
  const loaded = loadBpmnFormData(cell)
  Object.assign(bpmnForm, loaded)
}

function onBlankClick() {
  selectedCell.value = null
  cellPos.value = null
  cellSize.value = null
  formData.label = ''
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
  const data = (cell.getData() || {}) as Record<string, unknown>
  cell.setData({
    ...data,
    bpmn: saveBpmnFormData(category.value, bpmnForm, cell.shape),
  })
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
</style>
