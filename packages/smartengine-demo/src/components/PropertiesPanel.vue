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

      <!-- 标签 -->
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
import type { Graph, Cell, Edge } from '@antv/x6'
import {
  classifyShape,
  getFieldEditorsForShape,
  getShapeLabel,
  getBpmnShapeIcon,
  loadBpmnFormData,
  saveBpmnFormData,
  type BpmnFormData,
  type ShapeCategory,
} from '@x6-bpmn2/plugin'
import { useSmartEngineSingleton } from '../composables/useSmartEngine'

const props = defineProps<{ graph: Graph | null }>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const labelValue = ref('')
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)
const { resolvedProfile } = useSmartEngineSingleton()

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

const category = computed<ShapeCategory>(() => {
  if (!selectedCell.value) return 'unknown'
  return classifyShape(selectedCell.value.shape)
})

const shapeLabel = computed(() => selectedCell.value ? getShapeLabel(selectedCell.value.shape) : '')
const shapeIcon = computed(() => selectedCell.value ? getBpmnShapeIcon(selectedCell.value.shape) : '')
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

let cleanup: (() => void) | null = null
watch(() => props.graph, (g) => {
  cleanup?.()
  if (!g) return
  const onCell = ({ cell }: { cell: Cell }) => {
    selectedCell.value = cell
    if (cell.isNode()) { cellPos.value = cell.getPosition(); cellSize.value = cell.getSize() }
    else { cellPos.value = null; cellSize.value = null }
    labelValue.value = readRenderedCellLabel(cell)
    Object.assign(bpmnForm, loadBpmnFormData(cell))
  }
  const onBlank = () => { selectedCell.value = null; cellPos.value = null; cellSize.value = null; labelValue.value = '' }
  g.on('cell:click', onCell); g.on('blank:click', onBlank)
  cleanup = () => { g.off('cell:click', onCell); g.off('blank:click', onBlank) }
}, { immediate: true })
onUnmounted(() => cleanup?.())

function onLabelChange() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  if (cell.isNode()) {
    if (cell.getAttrByPath('headerLabel/text') !== undefined) {
      cell.setAttrByPath('headerLabel/text', labelValue.value)
    } else {
      cell.setAttrByPath('label/text', labelValue.value)
    }
    return
  }

  const edge = cell as Edge
  const labels = edge.getLabels()
  if (labels.length > 0) {
    edge.setLabelAt(0, {
      ...labels[0],
      attrs: {
        ...labels[0].attrs,
        label: {
          ...(labels[0].attrs?.label || {}),
          text: labelValue.value,
        },
      },
    })
    return
  }

  edge.appendLabel({
    attrs: { label: { text: labelValue.value } },
    position: { distance: 0.5 },
  })
}

function saveBpmn() {
  if (!selectedCell.value) return
  const cell = selectedCell.value
  const data = (cell.getData() || {}) as Record<string, unknown>
  cell.setData({
    ...data,
    bpmn: saveBpmnFormData(category.value, bpmnForm, cell.shape),
  })
}
</script>

<style scoped>
.properties-panel { padding: 8px; }

.cell-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; background: var(--color-fill-1); border-radius: 6px; margin-bottom: 12px;
}

.cell-icon { width: 28px; height: 28px; flex-shrink: 0; }
.cell-icon :deep(svg) { width: 100%; height: 100%; }
.cell-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.field-section { margin-bottom: 14px; }
.section-title {
  font-size: 12px; font-weight: 600; color: var(--color-text-2);
  margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--color-border-1);
}

.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.field-row.vertical { flex-direction: column; align-items: stretch; }
.field-row label { font-size: 11px; color: var(--color-text-2); min-width: 56px; flex-shrink: 0; }
.field-row.vertical label { margin-bottom: 2px; }
.field-row :deep(.arco-input-wrapper),
.field-row :deep(.arco-select-view-single),
.field-row :deep(.arco-textarea-wrapper) { flex: 1; }
.field-value { font-size: 11px; color: var(--color-text-3); }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 16px; color: var(--color-text-3); text-align: center; font-size: 13px; gap: 8px;
}
.empty-icon { font-size: 28px; }

</style>
