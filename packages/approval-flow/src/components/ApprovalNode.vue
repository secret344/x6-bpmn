<!-- 审批节点 Vue 组件 — 渲染节点内容 -->
<template>
  <div class="approval-node" :class="{ selected: isSelected }">
    <div class="node-content">
      <span class="node-name">{{ nodeName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import type { Node } from '@antv/x6'

const getNode = inject<() => Node>('getNode')!
const node = getNode()

const nodeName = ref(node.getAttrs()?.label?.text || '审批节点')
const isSelected = ref(false)

onMounted(() => {
  node.on('change:attrs', ({ current }: any) => {
    nodeName.value = current?.label?.text || '审批节点'
  })
  node.on('selected', () => (isSelected.value = true))
  node.on('unselected', () => (isSelected.value = false))
})
</script>

<style scoped>
.approval-node {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: 2px solid #3370ff;
  border-radius: 8px;
  cursor: default;
  user-select: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.approval-node:hover {
  border-color: #1d5ced;
}

.approval-node.selected {
  border-color: #1d5ced;
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.15);
}

.node-content {
  text-align: center;
  padding: 4px 8px;
}

.node-name {
  font-size: 14px;
  font-weight: 500;
  color: #1d2129;
  line-height: 1.4;
  word-break: break-all;
}
</style>
