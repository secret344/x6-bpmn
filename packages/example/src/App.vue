<template>
  <a-layout class="bpmn-app">
    <a-layout-header class="bpmn-header">
      <div class="header-left">
        <h1>BPMN 2.0 流程设计器</h1>
      </div>
      <Toolbar :graph="graph" />
    </a-layout-header>
    <a-layout class="bpmn-main">
      <a-layout-sider :width="220" :hide-trigger="true" class="bpmn-sider-left">
        <StencilPanel :graph="graph" />
      </a-layout-sider>
      <a-layout-content class="bpmn-canvas-wrapper">
        <GraphCanvas ref="graphCanvasRef" @graph-ready="onGraphReady" />
      </a-layout-content>
      <a-layout-sider :width="260" :hide-trigger="true" class="bpmn-sider-right">
        <PropertiesPanel :graph="graph" />
      </a-layout-sider>
    </a-layout>
    <NodeConfigModal :graph="graph" />
  </a-layout>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Graph } from '@antv/x6'
import GraphCanvas from './components/GraphCanvas.vue'
import StencilPanel from './components/StencilPanel.vue'
import Toolbar from './components/Toolbar.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import NodeConfigModal from './components/NodeConfigModal.vue'

const graph = shallowRef<Graph | null>(null)
const graphCanvasRef = ref<InstanceType<typeof GraphCanvas> | null>(null)

function onGraphReady(g: Graph) {
  graph.value = g
}
</script>

<style scoped>
.bpmn-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

:deep(.arco-layout) {
  height: 100%;
}

.bpmn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  min-height: 48px;
  background: #165dff;
  color: #fff;
  line-height: 48px;
}

.bpmn-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.bpmn-main {
  flex: 1;
  height: calc(100vh - 48px);
  overflow: hidden;
}

.bpmn-sider-left {
  background: #fff;
  border-right: 1px solid var(--color-border-2);
  overflow-y: auto;
}

.bpmn-sider-right {
  background: #fff;
  border-left: 1px solid var(--color-border-2);
  overflow-y: auto;
}

.bpmn-canvas-wrapper {
  position: relative;
  overflow: hidden;
  background: #f7f8fa;
  height: 100%;
}

:deep(.arco-layout-sider-children) {
  height: 100%;
  overflow-y: auto;
}
</style>
