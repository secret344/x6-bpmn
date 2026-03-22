<template>
  <div class="properties-panel">
    <div class="panel-header">属性</div>
    <div v-if="!selectedCell" class="panel-empty">
      <icon-select-all style="font-size: 32px; color: var(--color-text-4)" />
      <span class="hint">选择节点或连线查看属性</span>
    </div>
    <a-descriptions
      v-else
      :column="1"
      size="small"
      layout="inline-horizontal"
      bordered
      class="props-desc"
    >
      <a-descriptions-item label="ID">
        <a-typography-text copyable :ellipsis="{ rows: 1 }">
          {{ selectedCell.id }}
        </a-typography-text>
      </a-descriptions-item>
      <a-descriptions-item label="类型">
        <a-tag size="small" color="arcoblue">{{ selectedCell.shape }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item v-if="cellPos" label="位置">
        ({{ Math.round(cellPos.x) }}, {{ Math.round(cellPos.y) }})
      </a-descriptions-item>
      <a-descriptions-item v-if="cellSize" label="尺寸">
        {{ cellSize.width }} × {{ cellSize.height }}
      </a-descriptions-item>
      <a-descriptions-item v-if="cellLabel" label="标签">
        {{ cellLabel }}
      </a-descriptions-item>
    </a-descriptions>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { Graph, Cell } from '@antv/x6'
import { IconSelectAll } from '@arco-design/web-vue/es/icon'

const props = defineProps<{
  graph: Graph | null
}>()

const selectedCell = ref<Cell | null>(null)
const cellPos = ref<{ x: number; y: number } | null>(null)
const cellSize = ref<{ width: number; height: number } | null>(null)
const cellLabel = ref<string>('')

function onCellClick({ cell }: { cell: Cell }) {
  selectedCell.value = cell
  if (cell.isNode()) {
    const pos = cell.getPosition()
    const size = cell.getSize()
    cellPos.value = pos
    cellSize.value = size
  } else {
    cellPos.value = null
    cellSize.value = null
  }
  const data = cell.getData() || {}
  const labelText =
    data.label ||
    cell.getAttrByPath('label/text') ||
    cell.getAttrByPath('headerLabel/text') ||
    ''
  cellLabel.value = labelText as string
}

function onBlankClick() {
  selectedCell.value = null
  cellPos.value = null
  cellSize.value = null
  cellLabel.value = ''
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

.props-desc {
  padding: 12px;
}

:deep(.arco-descriptions-item-label) {
  font-size: 12px !important;
  width: 50px !important;
}

:deep(.arco-descriptions-item-value) {
  font-size: 12px !important;
}
</style>
