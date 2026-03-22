<!-- 加号按钮 — 点击后在后面插入审批节点 -->
<template>
  <div class="add-btn-node" @mousedown.stop @click.stop="handleClick">
    <div class="add-icon">+</div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { Node } from '@antv/x6'

const getNode = inject<() => Node>('getNode')!
const node = getNode()

function handleClick() {
  const graph = node.model?.graph
  if (!graph) return
  // 触发自定义事件，由外层 App 处理插入逻辑
  graph.trigger('add-button:click', { addButtonNode: node })
}
</script>

<style scoped>
.add-btn-node {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3370ff;
  color: #fff;
  font-size: 18px;
  line-height: 24px;
  text-align: center;
  font-weight: 400;
  transition: background 0.2s, transform 0.2s;
}

.add-btn-node:hover .add-icon {
  background: #1d5ced;
  transform: scale(1.15);
}
</style>
