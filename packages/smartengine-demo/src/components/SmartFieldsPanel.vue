<template>
  <div class="smart-fields-panel">
    <template v-if="selectedNode">
      <div class="panel-header">
        <a-tag :color="categoryColor">{{ selectedNode.shape }}</a-tag>
        <span class="node-label">{{ nodeLabel }}</span>
      </div>

      <!-- SmartEngine 基础字段 -->
      <div class="field-group">
        <div class="group-title">SmartEngine 扩展字段</div>
        <template v-if="smartFieldInfos.length > 0">
          <div v-for="field in smartFieldInfos" :key="field.key" class="field-row">
            <div class="field-label">
              <span>{{ field.key }}</span>
              <a-tag v-if="field.scope" size="small" color="arcoblue">{{ field.scope }}</a-tag>
            </div>
            <div class="field-desc">{{ field.description || '—' }}</div>
            <a-input
              v-model="fieldValues[field.key]"
              :placeholder="field.defaultValue != null ? String(field.defaultValue) : '未设置'"
              size="small"
              @change="onFieldChange(field.key, $event)"
            />
          </div>
        </template>
        <div v-else class="empty-hint">此分类无 SmartEngine 字段</div>
      </div>

      <!-- 默认数据 -->
      <div class="field-group">
        <div class="group-title">
          默认数据 (buildDefaultData)
          <a-button size="mini" type="text" @click="refreshDefault">刷新</a-button>
        </div>
        <pre class="json-preview">{{ defaultDataJson }}</pre>
      </div>

      <!-- 字段验证 -->
      <div class="field-group">
        <div class="group-title">
          字段验证
          <a-button size="mini" type="text" @click="validateCurrentNode">验证</a-button>
        </div>
        <template v-if="nodeErrors.length > 0">
          <div v-for="err in nodeErrors" :key="err.field" class="error-item">
            <span class="err-field">{{ err.field }}</span>
            <span class="err-reason">{{ err.reason }}</span>
          </div>
        </template>
        <div v-else class="empty-hint ok">✓ 所有字段验证通过</div>
      </div>
    </template>

    <template v-else>
      <div class="no-selection">
        <div class="hint-icon">📝</div>
        <div>点击画布上的节点查看其 SmartEngine 字段</div>
      </div>
    </template>

    <!-- 模式字段概览 -->
    <div class="field-group" style="margin-top: 16px">
      <div class="group-title">{{ modeName }} 字段概览</div>
      <a-collapse :bordered="false" :default-active-key="['task']">
        <a-collapse-item v-for="cat in fieldCategories" :key="cat.category" :header="`${cat.label} (${cat.count} 字段)`">
          <div v-for="f in cat.fields" :key="f.key" class="overview-field">
            <span class="overview-key">{{ f.key }}</span>
            <span class="overview-scope" v-if="f.scope">{{ f.scope }}</span>
            <span class="overview-default" v-if="f.defaultValue != null">= {{ f.defaultValue }}</span>
          </div>
        </a-collapse-item>
      </a-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted, onUnmounted } from 'vue'
import type { Graph, Node } from '@antv/x6'
import {
  getFieldsForCategory,
  getFieldsForShape,
  buildDefaultData,
  validateFields,
  getNodeCategory,
  type FieldValidateContext,
} from '@x6-bpmn2/plugin'
import { useSmartEngineSingleton } from '../composables/useSmartEngine'

const props = defineProps<{ graph: Graph | null }>()

const { resolvedProfile, selectedMode, currentMode } = useSmartEngineSingleton()

const selectedNode = ref<Node | null>(null)
const fieldValues = reactive<Record<string, string>>({})
const nodeErrors = ref<Array<{ field: string; reason: string }>>([])

const modeName = computed(() => currentMode.value.name)

// 监听画布选中
let offSelect: (() => void) | null = null

watch(() => props.graph, (g) => {
  offSelect?.()
  if (!g) return
  const handler = ({ node }: { node: Node }) => {
    selectedNode.value = node
    syncFieldValues()
  }
  g.on('node:click', handler)
  g.on('blank:click', () => { selectedNode.value = null })
  offSelect = () => {
    g.off('node:click', handler)
    g.off('blank:click')
  }
}, { immediate: true })

onUnmounted(() => offSelect?.())

const nodeLabel = computed(() => {
  if (!selectedNode.value) return ''
  const data = selectedNode.value.getData<Record<string, unknown>>() || {}
  return (data.label as string) || selectedNode.value.shape
})

const categoryColor = computed(() => {
  if (!selectedNode.value) return 'gray'
  const shape = selectedNode.value.shape
  if (shape.includes('Event')) return 'green'
  if (shape.includes('Task') || shape.includes('SubProcess')) return 'blue'
  if (shape.includes('Gateway')) return 'orange'
  return 'gray'
})

const smartFields = computed(() => {
  if (!selectedNode.value || !resolvedProfile.value) return []
  const shape = selectedNode.value.shape
  let category = ''
  try { category = getNodeCategory(shape) } catch { return [] }
  return getFieldsForShape(shape, category, resolvedProfile.value.dataModel)
})

/** 将 string[] 字段名映射为带能力信息的对象列表 */
const smartFieldInfos = computed(() => {
  if (!resolvedProfile.value) return []
  const dm = resolvedProfile.value.dataModel
  return smartFields.value.map((fieldName) => {
    const cap = dm.fields[fieldName]
    return {
      key: fieldName,
      scope: cap?.scope,
      description: cap?.description,
      defaultValue: cap?.defaultValue,
    }
  })
})

function syncFieldValues() {
  Object.keys(fieldValues).forEach((k) => delete fieldValues[k])
  if (!selectedNode.value) return
  const data = selectedNode.value.getData<Record<string, unknown>>() || {}
  const bpmnData = (data.bpmn as Record<string, unknown> | undefined) || {}
  for (const fieldName of smartFields.value) {
    fieldValues[fieldName] = bpmnData[fieldName] != null ? String(bpmnData[fieldName]) : ''
  }
}

function onFieldChange(key: string, value: string | number | undefined) {
  if (!selectedNode.value) return
  const data = selectedNode.value.getData<Record<string, unknown>>() || {}
  const bpmnData = { ...((data.bpmn as Record<string, unknown> | undefined) || {}) }
  if (value === undefined || value === null || value === '') {
    delete bpmnData[key]
  } else {
    bpmnData[key] = value
  }
  selectedNode.value.setData({ ...data, bpmn: bpmnData })
}

const defaultDataJson = ref('{}')
function refreshDefault() {
  if (!selectedNode.value || !resolvedProfile.value) return
  const shape = selectedNode.value.shape
  let cat = ''
  try { cat = getNodeCategory(shape) } catch { return }
  const fields = getFieldsForShape(shape, cat, resolvedProfile.value.dataModel)
  const data = buildDefaultData(fields, resolvedProfile.value.dataModel)
  defaultDataJson.value = JSON.stringify(data, null, 2)
}

function validateCurrentNode() {
  if (!selectedNode.value || !resolvedProfile.value) {
    nodeErrors.value = []
    return
  }
  const shape = selectedNode.value.shape
  let cat = ''
  try { cat = getNodeCategory(shape) } catch { nodeErrors.value = []; return }
  const fields = getFieldsForShape(shape, cat, resolvedProfile.value.dataModel)
  const data = selectedNode.value.getData<Record<string, unknown>>() || {}
  const bpmnData = (data.bpmn as Record<string, unknown> | undefined) || {}
  const ctx: FieldValidateContext = {
    shape,
    category: cat,
    profileId: resolvedProfile.value.meta.id,
    nodeData: bpmnData,
  }
  nodeErrors.value = validateFields(bpmnData, fields, ctx, resolvedProfile.value.dataModel)
}

// ---- 字段分类概览 ----
const CATEGORY_LABELS: Record<string, string> = {
  task: '任务', startEvent: '开始事件', endEvent: '结束事件',
  intermediateThrowEvent: '中间抛出事件', intermediateCatchEvent: '中间捕获事件',
  gateway: '网关', dataObject: '数据对象', subProcess: '子流程',
  boundaryEvent: '边界事件',
}

const fieldCategories = computed(() => {
  if (!resolvedProfile.value) return []
  const dm = resolvedProfile.value.dataModel
  const cats: Array<{ category: string; label: string; count: number; fields: Array<{ key: string; scope?: string; defaultValue?: unknown }> }> = []

  for (const catKey of Object.keys(CATEGORY_LABELS)) {
    const fields = getFieldsForCategory(catKey, dm)
    if (fields.length === 0) continue
    cats.push({
      category: catKey,
      label: CATEGORY_LABELS[catKey],
      count: fields.length,
      fields: fields.map((fieldName) => {
        const cap = dm.fields[fieldName]
        return { key: fieldName, scope: cap?.scope, defaultValue: cap?.defaultValue }
      }),
    })
  }
  return cats
})

// 切换模式时刷新
watch(selectedMode, () => {
  selectedNode.value = null
  nodeErrors.value = []
})
</script>

<style scoped>
.smart-fields-panel {
  padding: 4px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 6px;
  margin-bottom: 12px;
}

.node-label {
  font-weight: 500;
  font-size: 13px;
}

.field-group {
  margin-bottom: 12px;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-row {
  padding: 6px 0;
  border-bottom: 1px dashed var(--color-border-1);
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 2px;
}

.field-desc {
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 4px;
}

.json-preview {
  background: var(--color-fill-2);
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-3);
  padding: 8px;
  text-align: center;
}

.empty-hint.ok {
  color: #00b42a;
}

.error-item {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  background: #ffece8;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 4px;
}

.err-field {
  font-weight: 600;
  color: #f53f3f;
}

.err-reason {
  color: var(--color-text-2);
}

.no-selection {
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

.hint-icon {
  font-size: 28px;
}

.overview-field {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  font-size: 11px;
}

.overview-key {
  font-weight: 500;
  font-family: monospace;
}

.overview-scope {
  color: #165dff;
  font-size: 10px;
}

.overview-default {
  color: var(--color-text-3);
  font-family: monospace;
  font-size: 10px;
}
</style>
