<template>
  <a-modal
    v-model:visible="visible"
    :title="modalTitle"
    :width="600"
    unmount-on-close
    @before-ok="onSave"
    @cancel="onClose"
  >
    <a-tabs default-active-key="basic" size="small">
      <a-tab-pane key="basic" title="基本属性">
        <a-form :model="form" layout="vertical" size="small">
          <a-form-item label="ID">
            <a-input :model-value="form.id" readonly disabled />
          </a-form-item>
          <a-form-item label="元素类型">
            <a-tag color="arcoblue" style="margin: 0">{{ shapeName }}</a-tag>
          </a-form-item>
          <a-form-item label="名称">
            <a-input v-model="form.label" placeholder="输入名称" allow-clear />
          </a-form-item>
          <a-form-item label="说明">
            <a-textarea
              v-model="form.documentation"
              placeholder="输入说明"
              :auto-size="{ minRows: 2, maxRows: 4 }"
            />
          </a-form-item>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="bpmn" title="BPMN 属性">
        <a-alert style="margin-bottom: 12px" type="info">
          该弹窗仅保留可以直接映射到标准 BPMN XML 的字段。
        </a-alert>

        <a-form v-if="nativeEditors.length > 0" layout="vertical" size="small">
          <template v-for="field in nativeEditors" :key="field.key">
            <a-form-item v-if="field.input === 'boolean'" :label="field.label">
              <a-switch v-model="bpmnForm[field.key]" />
            </a-form-item>
            <a-form-item v-else-if="field.input === 'select'" :label="field.label">
              <a-select
                v-model="bpmnForm[field.key]"
                :placeholder="field.placeholder"
                allow-clear
              >
                <a-option
                  v-for="option in field.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </a-option>
              </a-select>
            </a-form-item>
            <a-form-item v-else-if="field.input === 'textarea'" :label="field.label">
              <a-textarea
                v-model="bpmnForm[field.key]"
                :placeholder="field.placeholder"
                :auto-size="{ minRows: 2, maxRows: 6 }"
              />
            </a-form-item>
            <a-form-item v-else :label="field.label">
              <a-input
                v-model="bpmnForm[field.key]"
                :placeholder="field.placeholder"
                allow-clear
              />
            </a-form-item>
          </template>
        </a-form>

        <a-empty v-else description="当前元素没有可直接映射到标准 XML 的额外字段" />
      </a-tab-pane>

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
                  <a-input-number
                    v-model="form.strokeWidth"
                    :min="1"
                    :max="10"
                    :precision="0"
                    style="width: 100%"
                  />
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
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { Cell, Edge, Graph, Node } from '@antv/x6'
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
import { buildNativeBpmnData, filterNativeFieldEditors } from '../native-bpmn'

interface AppearanceForm {
  id: string
  label: string
  documentation: string
  x: number
  y: number
  width: number
  height: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

const bpmn2DataModel = bpmn2Profile.dataModel as DataModelSet

const props = defineProps<{ graph: Graph | null }>()

const visible = ref(false)
const currentCell = ref<Cell | null>(null)
const form = reactive<AppearanceForm>({
  id: '',
  label: '',
  documentation: '',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  fillColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 1,
})
const bpmnForm = reactive<BpmnFormData>({} as BpmnFormData)

const isNode = computed(() => currentCell.value?.isNode() ?? true)
const shape = computed(() => currentCell.value?.shape ?? '')
const shapeName = computed(() => getShapeLabel(shape.value))
const category = computed<ShapeCategory>(() => {
  if (!shape.value) return 'unknown'
  return classifyShape(shape.value)
})
const modalTitle = computed(() => {
  const prefix = isNode.value ? '节点配置' : '连线配置'
  return `${prefix} - ${shapeName.value}`
})
const nativeEditors = computed(() => {
  if (!currentCell.value) return []
  return filterNativeFieldEditors(
    getFieldEditorsForShape(shape.value, category.value, bpmn2DataModel),
  )
})

function resetForm() {
  form.id = ''
  form.label = ''
  form.documentation = ''
  form.x = 0
  form.y = 0
  form.width = 100
  form.height = 60
  form.fillColor = '#ffffff'
  form.strokeColor = '#000000'
  form.strokeWidth = 1

  for (const key of Object.keys(bpmnForm)) {
    delete bpmnForm[key as keyof BpmnFormData]
  }
}

function applyEdgeLabel(edge: Edge, label: string) {
  const labels = edge.getLabels()
  if (labels.length > 0) {
    edge.setLabelAt(0, {
      ...labels[0],
      attrs: {
        ...labels[0].attrs,
        label: {
          ...(labels[0].attrs?.label || {}),
          text: label,
        },
      },
    })
    return
  }

  if (label) {
    edge.appendLabel({
      attrs: { label: { text: label } },
      position: { distance: 0.5 },
    })
  }
}

function readRenderedCellLabel(cell: Cell): string {
  const attrLabel = cell.getAttrByPath('label/text') as string | undefined
  if (attrLabel) return attrLabel

  const headerLabel = cell.getAttrByPath('headerLabel/text') as string | undefined
  if (headerLabel) return headerLabel

  if (cell.isEdge()) {
    const edge = cell as Edge
    const labels = edge.getLabels()
    if (labels.length > 0) {
      return (labels[0].attrs?.label?.text ?? labels[0].attrs?.text?.text ?? '') as string
    }
  }

  return ''
}

function openModal(cell: Cell) {
  currentCell.value = cell
  resetForm()

  form.id = cell.id
  form.label = readRenderedCellLabel(cell)
  form.documentation = String(((cell.getData() || {}) as Record<string, unknown>).documentation || '')

  if (cell.isNode()) {
    const node = cell as Node
    const position = node.getPosition()
    const size = node.getSize()
    form.x = Math.round(position.x)
    form.y = Math.round(position.y)
    form.width = Math.round(size.width)
    form.height = Math.round(size.height)
    form.fillColor = (node.getAttrByPath('body/fill') as string) || '#ffffff'
    form.strokeColor = (node.getAttrByPath('body/stroke') as string) || '#000000'
  } else {
    const edge = cell as Edge
    form.strokeColor = (edge.getAttrByPath('line/stroke') as string) || '#000000'
    form.strokeWidth = (edge.getAttrByPath('line/strokeWidth') as number) || 1
  }

  Object.assign(bpmnForm, loadBpmnFormData(cell))
  visible.value = true
}

function onSave(done: (closed: boolean) => void) {
  const cell = currentCell.value
  if (!cell) {
    done(true)
    return
  }

  const savedBpmn = saveBpmnFormData(category.value, bpmnForm, shape.value) as Record<string, unknown>
  const previousData = (cell.getData() || {}) as Record<string, unknown>
  const previousBpmn = previousData.bpmn as Record<string, unknown> | undefined
  const nextBpmn = buildNativeBpmnData(previousBpmn, savedBpmn)
  const label = category.value === 'textAnnotation'
    ? String(nextBpmn.annotationText || form.label || '')
    : form.label

  if (cell.isNode()) {
    const node = cell as Node
    if (node.getAttrByPath('headerLabel/text') !== undefined) {
      node.setAttrByPath('headerLabel/text', label)
    } else {
      node.setAttrByPath('label/text', label)
    }
    node.setPosition(form.x, form.y)
    node.resize(form.width, form.height)
    node.setAttrByPath('body/fill', form.fillColor)
    node.setAttrByPath('body/stroke', form.strokeColor)
  } else {
    const edge = cell as Edge
    applyEdgeLabel(edge, label)
    edge.setAttrByPath('line/stroke', form.strokeColor)
    edge.setAttrByPath('line/strokeWidth', form.strokeWidth)
  }

  const nextData: Record<string, unknown> = {
    ...previousData,
    documentation: form.documentation,
  }

  if (Object.keys(nextBpmn).length > 0) {
    nextData.bpmn = nextBpmn
  } else {
    delete nextData.bpmn
  }

  cell.setData(nextData)
  done(true)
}

function onClose() {
  currentCell.value = null
}

function onCellDblClick({ cell }: { cell: Cell }) {
  openModal(cell)
}

let prevGraph: Graph | null = null

function bindEvents(graph: Graph | null) {
  if (prevGraph) {
    prevGraph.off('cell:dblclick', onCellDblClick)
  }
  if (graph) {
    graph.on('cell:dblclick', onCellDblClick)
  }
  prevGraph = graph
}

watch(
  () => props.graph,
  (graph) => bindEvents(graph),
  { immediate: true },
)

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

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
</style>