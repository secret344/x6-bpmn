<template>
  <a-modal
    v-model:visible="visible"
    title="流程规则校验"
    :width="980"
    :footer="false"
    draggable
    unmount-on-close
  >
    <div class="validation-toolbar">
      <a-space>
        <a-tag color="arcoblue">节点 {{ summary.nodeCount }}</a-tag>
        <a-tag color="arcoblue">连线 {{ summary.edgeCount }}</a-tag>
        <a-tag :color="summary.errorCount === 0 ? 'green' : 'red'">
          {{ summary.errorCount === 0 ? '校验通过' : `发现 ${summary.errorCount} 个问题` }}
        </a-tag>
        <a-tag :color="report?.xmlExported ? 'green' : 'orangered'">
          {{ report?.xmlExported ? 'XML 导出通过' : 'XML 导出失败' }}
        </a-tag>
      </a-space>
      <a-button size="small" type="primary" :loading="loading" @click="runValidation">
        重新校验
      </a-button>
    </div>

    <a-alert
      v-if="summary.errorCount === 0 && !loading"
      type="success"
      show-icon
      class="validation-alert"
    >
      当前流程图未发现规则错误。
    </a-alert>

    <a-alert
      v-else-if="summary.errorCount > 0 && !loading"
      type="error"
      show-icon
      class="validation-alert"
    >
      已按图级约束、连线规则、字段校验、容器约束、边界事件附着和 XML 导出检查当前流程。
    </a-alert>

    <div v-if="loading" class="validation-loading">
      <a-spin tip="正在分析当前流程图..." />
    </div>

    <div v-else class="validation-body">
      <a-collapse :default-active-key="defaultActiveKeys" :bordered="false">
        <a-collapse-item
          v-for="section in sections"
          :key="section.key"
          :header="`${section.title} (${section.items.length})`"
        >
          <a-list v-if="section.items.length > 0" size="small" bordered>
            <a-list-item v-for="(item, index) in section.items" :key="`${section.key}-${index}-${item.cellId || 'global'}`">
              <div class="validation-item">
                <div class="validation-item-main">
                  <span class="validation-item-index">{{ index + 1 }}.</span>
                  <span class="validation-item-message">{{ item.message }}</span>
                </div>
                <div v-if="item.cellLabel || item.cellId || item.detail" class="validation-item-meta">
                  <a-tag v-if="item.cellLabel" size="small">{{ item.cellLabel }}</a-tag>
                  <a-tag v-if="item.cellShape" size="small" color="arcoblue">{{ item.cellShape }}</a-tag>
                  <a-tag v-if="item.cellId" size="small" color="gray">{{ item.cellId }}</a-tag>
                  <span v-if="item.detail" class="validation-item-detail">{{ item.detail }}</span>
                </div>
              </div>
            </a-list-item>
          </a-list>
          <a-empty v-else description="该类检查未发现问题" />
        </a-collapse-item>
      </a-collapse>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Graph } from '@antv/x6'
import type { DiagramValidationReport, ValidationIssue, ValidationIssueCategory } from '../graph-validation'
import { validateDiagram } from '../graph-validation'

const props = defineProps<{
  graph: Graph | null
}>()

const visible = ref(false)
const loading = ref(false)
const report = ref<DiagramValidationReport | null>(null)

const sectionMeta: Array<{ key: ValidationIssueCategory; title: string }> = [
  { key: 'graph-constraint', title: '图级约束' },
  { key: 'edge-rule', title: '连线规则' },
  { key: 'field', title: '字段校验' },
  { key: 'containment', title: '容器约束' },
  { key: 'boundary', title: '边界事件附着' },
  { key: 'export', title: 'XML 导出' },
]

const summary = computed(() => ({
  nodeCount: report.value?.nodeCount ?? 0,
  edgeCount: report.value?.edgeCount ?? 0,
  errorCount: report.value?.issues.length ?? 0,
}))

const sections = computed(() => sectionMeta.map((section) => ({
  ...section,
  items: report.value?.issues.filter((item) => item.category === section.key) ?? [],
})))

const defaultActiveKeys = computed(() => sectionMeta.map((section) => section.key))

function open() {
  visible.value = true
  void runValidation()
}

async function runValidation() {
  if (!props.graph) {
    report.value = {
      issues: [{ category: 'graph-constraint', message: '当前没有可校验的流程图实例' }],
      nodeCount: 0,
      edgeCount: 0,
      xmlExported: false,
      profileId: 'unbound',
    }
    return
  }

  loading.value = true
  try {
    report.value = await validateDiagram(props.graph)
  } finally {
    loading.value = false
  }
}

defineExpose({ open, runValidation })
</script>

<style scoped>
.validation-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.validation-alert {
  margin-bottom: 12px;
}

.validation-loading {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.validation-body {
  max-height: 620px;
  overflow: auto;
}

.validation-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.validation-item-main {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.validation-item-index {
  color: #f53f3f;
  font-weight: 600;
}

.validation-item-message {
  color: #1d2129;
  line-height: 1.6;
}

.validation-item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-left: 18px;
}

.validation-item-detail {
  color: #4e5969;
  font-size: 12px;
  line-height: 1.5;
}
</style>