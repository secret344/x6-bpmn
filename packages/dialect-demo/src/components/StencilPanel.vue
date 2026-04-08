<template>
  <div class="stencil-panel">
    <div class="section-title">可用元素 ({{ enabledNodes.length }} 节点 / {{ enabledEdges.length }} 边)</div>

    <!-- 节点按分类分组 -->
    <a-collapse :default-active-key="['event', 'task', 'gateway', 'data', 'swimlane', 'artifact']" :bordered="false">
      <a-collapse-item
        v-for="group in nodeGroups"
        :key="group.category"
        :header="`${group.label} (${group.items.length})`"
      >
        <div class="shape-grid">
          <div
            v-for="item in group.items"
            :key="item.shape"
            class="shape-item"
            draggable="true"
            :title="item.title || item.shape"
            @dragstart="onDragStart($event, item.shape)"
          >
            <div class="shape-icon" v-html="getIcon(item.shape)"></div>
            <div class="shape-label">{{ item.title || item.shape }}</div>
          </div>
        </div>
      </a-collapse-item>
    </a-collapse>

    <!-- disabled 元素统计 -->
    <div v-if="disabledNodes.length > 0" class="disabled-info">
      <a-popover trigger="click" position="right">
        <a-tag color="orangered" size="small" style="cursor: pointer">
          {{ disabledNodes.length }} 个元素被禁用
        </a-tag>
        <template #content>
          <div style="max-height: 300px; overflow-y: auto; font-size: 12px">
            <div v-for="n in disabledNodes" :key="n.shape" style="padding: 2px 0; color: #86909c">
              {{ n.title || n.shape }}
            </div>
          </div>
        </template>
      </a-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Graph } from '@antv/x6'
import { getBpmnShapeIcon, getShapeLabel } from '@x6-bpmn2/plugin'
import { useDialectSingleton } from '../composables/useDialect'

const props = defineProps<{
  graph: Graph | null
}>()

const { enabledNodes, disabledNodes, enabledEdges } = useDialectSingleton()

/** 获取图形的 SVG 图标 */
function getIcon(shape: string): string {
  return getBpmnShapeIcon(shape)
}

/** 按分类分组 */
const nodeGroups = computed(() => {
  const groups: Record<string, { category: string; label: string; items: typeof enabledNodes.value }> = {}

  // 合并事件类为大类
  const categoryGroupMap: Record<string, string> = {
    startEvent: 'event',
    endEvent: 'event',
    intermediateThrowEvent: 'event',
    intermediateCatchEvent: 'event',
    boundaryEvent: 'event',
    task: 'task',
    subProcess: 'task',
    gateway: 'gateway',
    dataObject: 'data',
    swimlane: 'swimlane',
    artifact: 'artifact',
  }

  const groupLabels: Record<string, string> = {
    event: '事件',
    task: '任务/活动',
    gateway: '网关',
    data: '数据元素',
    swimlane: '泳道',
    artifact: '工件',
  }

  for (const node of enabledNodes.value) {
    // Lane 不再作为独立可拖拽元素，改由 Pool 右侧浮动菜单添加。
    if (node.shape === 'bpmn-lane') continue
    const cat = categoryGroupMap[node.category] || 'other'
    if (!groups[cat]) {
      groups[cat] = {
        category: cat,
        label: groupLabels[cat] || cat,
        items: [],
      }
    }
    groups[cat].items.push(node)
  }

  // 排序
  const order = ['event', 'task', 'gateway', 'data', 'swimlane', 'artifact', 'other']
  return order.filter((k) => groups[k]).map((k) => groups[k])
})

function onDragStart(event: DragEvent, shape: string) {
  const label = getShapeLabel(shape)
  const size =
    shape === 'bpmn-pool'
      ? { width: 400, height: 200 }
      : shape === 'bpmn-lane'
        ? { width: 370, height: 100 }
        : shape === 'bpmn-group'
          ? { width: 160, height: 100 }
          : {}

  event.dataTransfer?.setData('application/bpmn-shape', JSON.stringify({
    shape,
    label,
    ...size,
  }))
  event.dataTransfer?.setData('bpmn/shape', shape)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<style scoped>
.stencil-panel {
  padding: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 8px;
  padding: 0 4px;
}

.shape-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.shape-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 4px;
  cursor: grab;
  transition: background 0.15s, box-shadow 0.15s;
  user-select: none;
  border: 1px solid transparent;
}

.shape-item:hover {
  background: var(--color-primary-light-1);
  border-color: var(--color-primary-light-3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.shape-item:active {
  cursor: grabbing;
}

.shape-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text-2);
}

.shape-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.shape-label {
  font-size: 10px;
  color: var(--color-text-3);
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.disabled-info {
  margin-top: 8px;
  padding: 0 4px;
}

:deep(.arco-collapse-item-content) {
  padding: 4px 8px !important;
}
:deep(.arco-collapse-item-header) {
  font-size: 12px !important;
  padding: 8px 12px !important;
}
</style>
