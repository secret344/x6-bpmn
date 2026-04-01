<template>
  <div class="data-model-panel">
    <div class="section-title">数据模型字段能力</div>

    <!-- 分类选择 -->
    <a-select
      v-model="selectedCategory"
      placeholder="选择分类查看字段"
      size="small"
      style="margin-bottom: 12px"
      allow-clear
    >
      <a-option v-for="cat in availableCategories" :key="cat" :value="cat">
        {{ cat }}
      </a-option>
    </a-select>

    <!-- 分类字段列表 -->
    <template v-if="selectedCategory">
      <div class="field-section">
        <div class="field-section-title">
          {{ selectedCategory }} 的字段 ({{ categoryFields.length }})
        </div>

        <div v-for="fieldName in categoryFields" :key="fieldName" class="field-item">
          <div class="field-header">
            <span class="field-name">{{ fieldName }}</span>
            <a-tag v-if="fieldDef(fieldName)?.scope" size="small">
              {{ fieldDef(fieldName)?.scope }}
            </a-tag>
          </div>
          <div class="field-meta">
            <span v-if="fieldDef(fieldName)?.description" class="field-desc">
              {{ fieldDef(fieldName)?.description }}
            </span>
            <span v-if="fieldDef(fieldName)?.defaultValue !== undefined" class="field-default">
              默认: <code>{{ JSON.stringify(fieldDef(fieldName)?.defaultValue) }}</code>
            </span>
            <span v-if="fieldDef(fieldName)?.validate" class="field-badge">有验证</span>
            <span v-if="fieldDef(fieldName)?.normalize" class="field-badge">有归一化</span>
            <span v-if="fieldDef(fieldName)?.serialize" class="field-badge">有序列化</span>
          </div>
        </div>

        <a-empty v-if="categoryFields.length === 0" description="该分类没有字段" />

        <!-- 默认数据预览 -->
        <div class="field-section-title" style="margin-top: 12px">
          buildDefaultData() 结果
        </div>
        <pre class="default-data">{{ JSON.stringify(defaultData, null, 2) }}</pre>
      </div>
    </template>

    <!-- 字段验证测试 -->
    <div class="section-title" style="margin-top: 16px">字段验证测试</div>

    <div v-if="selectedNode">
      <a-descriptions :column="1" size="mini" bordered>
        <a-descriptions-item label="节点">{{ selectedNode.shape }}</a-descriptions-item>
        <a-descriptions-item label="分类">{{ selectedNode.category || '-' }}</a-descriptions-item>
      </a-descriptions>

      <a-button
        type="primary"
        size="small"
        long
        style="margin-top: 8px"
        @click="runFieldValidation"
      >
        验证字段
      </a-button>

      <div v-if="fieldValidationResults.length > 0" class="validation-results">
        <div v-for="r in fieldValidationResults" :key="r.field" class="validation-item fail">
          <strong>{{ r.field }}:</strong> {{ r.reason }}
        </div>
      </div>
      <div v-else-if="hasRunFieldValidation" class="validation-pass">
        ✓ 所有字段验证通过
      </div>
    </div>
    <div v-else class="empty-hint">
      选中画布上的节点以测试字段验证
    </div>

    <!-- 字段总览 -->
    <div class="section-title" style="margin-top: 16px">字段能力总览 ({{ fieldCount }})</div>
    <a-collapse :bordered="false">
      <a-collapse-item header="查看全部字段">
        <div v-for="(def, name) in fieldCapabilities" :key="name" class="field-item compact">
          <span class="field-name">{{ name }}</span>
          <span v-if="def.description" class="field-desc"> — {{ def.description }}</span>
        </div>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Graph, Node } from '@antv/x6'
import {
  getFieldsForCategory,
  buildDefaultData,
  getNodeCategory,
} from '@x6-bpmn2/plugin'
import { useDialectSingleton } from '../composables/useDialect'

const props = defineProps<{
  graph: Graph | null
}>()

const {
  resolvedProfile,
  fieldCapabilities,
  getFieldsFor,
  getDefaultData,
  validateNodeFields,
} = useDialectSingleton()

const selectedCategory = ref<string | undefined>(undefined)

/** 可用分类 */
const availableCategories = computed(() => {
  if (!resolvedProfile.value) return []
  return Object.keys(resolvedProfile.value.dataModel.categoryFields).sort()
})

/** 当前分类的字段列表 */
const categoryFields = computed(() => {
  if (!selectedCategory.value) return []
  return getFieldsFor(selectedCategory.value)
})

/** 字段定义 */
function fieldDef(name: string) {
  return fieldCapabilities.value[name]
}

/** 默认数据 */
const defaultData = computed(() => {
  if (!selectedCategory.value) return {}
  return getDefaultData(selectedCategory.value)
})

/** 字段总数 */
const fieldCount = computed(() => Object.keys(fieldCapabilities.value).length)

// ---------- 选中节点 ----------

const selectedNode = ref<{ shape: string; category: string; data: Record<string, unknown> } | null>(null)
const fieldValidationResults = ref<Array<{ field: string; reason: string }>>([])
const hasRunFieldValidation = ref(false)

function onSelectionChanged() {
  if (!props.graph) return
  const cells = props.graph.getSelectedCells()
  const node = cells.find((c) => c.isNode()) as Node | undefined
  if (node) {
    const shape = node.shape
    let category = ''
    try {
      category = getNodeCategory(shape)
    } catch { /* ignore */ }
    selectedNode.value = {
      shape,
      category,
      data: node.getData<Record<string, unknown>>() || {},
    }
    hasRunFieldValidation.value = false
    fieldValidationResults.value = []
  } else {
    selectedNode.value = null
  }
}

function runFieldValidation() {
  if (!selectedNode.value) return
  const { shape, category, data } = selectedNode.value
  fieldValidationResults.value = validateNodeFields(data, shape, category)
  hasRunFieldValidation.value = true
}

watch(() => props.graph, (g) => {
  if (g) {
    g.on('selection:changed', onSelectionChanged)
  }
}, { immediate: true })
</script>

<style scoped>
.data-model-panel {
  padding: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
}

.field-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
}

.field-item {
  padding: 6px 8px;
  margin-bottom: 4px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.field-item.compact {
  padding: 3px 6px;
  font-size: 11px;
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.field-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-1);
  font-family: monospace;
}

.field-meta {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.field-desc {
  font-size: 11px;
  color: var(--color-text-3);
}

.field-default {
  font-size: 11px;
  color: var(--color-text-3);
}

.field-default code {
  font-size: 10px;
  background: var(--color-fill-2);
  padding: 1px 3px;
  border-radius: 2px;
}

.field-badge {
  font-size: 10px;
  background: var(--color-primary-light-1);
  color: var(--color-primary-6);
  padding: 1px 4px;
  border-radius: 2px;
}

.default-data {
  font-size: 11px;
  background: var(--color-fill-2);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
}

.validation-results {
  margin-top: 8px;
}

.validation-item.fail {
  font-size: 12px;
  color: #f53f3f;
  padding: 4px 6px;
  background: #ffece8;
  border-radius: 4px;
  margin-bottom: 4px;
}

.validation-pass {
  margin-top: 8px;
  color: #00b42a;
  font-size: 12px;
  text-align: center;
  padding: 8px;
  background: #e8ffea;
  border-radius: 4px;
}

.empty-hint {
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
  padding: 16px 0;
}
</style>
