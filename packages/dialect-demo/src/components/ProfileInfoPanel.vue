<template>
  <div class="profile-info">
    <!-- Meta 信息 -->
    <a-descriptions :column="1" size="small" bordered>
      <a-descriptions-item label="方言 ID">
        <a-tag color="arcoblue">{{ meta?.id }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="名称">{{ meta?.name }}</a-descriptions-item>
      <a-descriptions-item label="版本">{{ meta?.version || '-' }}</a-descriptions-item>
      <a-descriptions-item label="父方言">
        <a-tag v-if="meta?.parent" color="purple">{{ meta.parent }}</a-tag>
        <span v-else style="color: #86909c">无（根方言）</span>
      </a-descriptions-item>
      <a-descriptions-item label="描述">
        <span style="font-size: 12px">{{ meta?.description || '-' }}</span>
      </a-descriptions-item>
    </a-descriptions>

    <!-- 六层统计 -->
    <div class="section-title" style="margin-top: 16px">六层配置模型统计</div>
    <a-descriptions :column="1" size="small" bordered>
      <a-descriptions-item label="节点定义">
        {{ nodeCount }} 个
      </a-descriptions-item>
      <a-descriptions-item label="边定义">
        {{ edgeCount }} 个
      </a-descriptions-item>
      <a-descriptions-item label="已启用节点">
        <a-tag color="green" size="small">{{ enabledNodeCount }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="已禁用节点">
        <a-tag :color="disabledNodeCount > 0 ? 'orangered' : 'gray'" size="small">
          {{ disabledNodeCount }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="节点渲染器">
        {{ nodeRendererCount }} 个
      </a-descriptions-item>
      <a-descriptions-item label="边渲染器">
        {{ edgeRendererCount }} 个
      </a-descriptions-item>
      <a-descriptions-item label="约束规则">
        {{ constraintCount }} 条
      </a-descriptions-item>
      <a-descriptions-item label="字段能力">
        {{ fieldCount }} 个
      </a-descriptions-item>
      <a-descriptions-item label="分类字段映射">
        {{ categoryFieldCount }} 个分类
      </a-descriptions-item>
    </a-descriptions>

    <!-- 命名空间 -->
    <div class="section-title" style="margin-top: 16px">命名空间</div>
    <div class="ns-list">
      <div v-for="(uri, prefix) in namespaces" :key="prefix" class="ns-item">
        <a-tag size="small" color="cyan">{{ prefix }}</a-tag>
        <span class="ns-uri">{{ uri }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDialectSingleton } from '../composables/useDialect'

const { resolvedProfile, enabledNodes, disabledNodes, namespaces, constraints, fieldCapabilities } = useDialectSingleton()

const meta = computed(() => resolvedProfile.value?.meta)

const nodeCount = computed(() =>
  resolvedProfile.value ? Object.keys(resolvedProfile.value.definitions.nodes).length : 0
)

const edgeCount = computed(() =>
  resolvedProfile.value ? Object.keys(resolvedProfile.value.definitions.edges).length : 0
)

const enabledNodeCount = computed(() => enabledNodes.value.length)
const disabledNodeCount = computed(() => disabledNodes.value.length)

const nodeRendererCount = computed(() =>
  resolvedProfile.value ? Object.keys(resolvedProfile.value.rendering.nodeRenderers).length : 0
)

const edgeRendererCount = computed(() =>
  resolvedProfile.value ? Object.keys(resolvedProfile.value.rendering.edgeRenderers).length : 0
)

const constraintCount = computed(() => constraints.value.length)

const fieldCount = computed(() => Object.keys(fieldCapabilities.value).length)

const categoryFieldCount = computed(() =>
  resolvedProfile.value ? Object.keys(resolvedProfile.value.dataModel.categoryFields).length : 0
)
</script>

<style scoped>
.profile-info {
  padding: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
}

.ns-list {
  font-size: 12px;
}

.ns-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}

.ns-uri {
  color: var(--color-text-3);
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}

:deep(.arco-descriptions-item-label) {
  font-size: 12px !important;
  white-space: nowrap;
}

:deep(.arco-descriptions-item-value) {
  font-size: 12px !important;
}
</style>
