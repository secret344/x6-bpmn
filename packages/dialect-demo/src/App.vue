<template>
  <a-layout class="dialect-app">
    <!-- 顶部标题栏 -->
    <a-layout-header class="app-header">
      <div class="header-left">
        <h1>🔧 方言系统演示 Dialect System Demo</h1>
      </div>
      <div class="header-right">
        <a-space>
          <a-button size="small" @click="handleExport">导出 XML</a-button>
          <a-button size="small" @click="handleImport">导入 XML</a-button>
          <a-button size="small" @click="handleValidate">验证约束</a-button>
          <a-button size="small" type="outline" @click="handleCreateSample">创建示例流程</a-button>
          <a-button size="small" type="outline" @click="handleDetect">检测方言</a-button>
        </a-space>
      </div>
    </a-layout-header>

    <a-layout class="app-main">
      <!-- 左侧面板：方言选择 + 形状面板 -->
      <a-layout-sider :width="280" :hide-trigger="true" class="sider-left">
        <ProfileSwitcher />
        <div class="divider" />
        <StencilPanel :graph="graph" />
      </a-layout-sider>

      <!-- 中间画布 -->
      <a-layout-content class="canvas-wrapper">
        <GraphCanvas @graph-ready="onGraphReady" />
      </a-layout-content>

      <!-- 右侧面板：节点属性 + Profile 信息 + 数据模型 -->
      <a-layout-sider :width="320" :hide-trigger="true" class="sider-right">
        <a-tabs default-active-key="props" size="small">
          <a-tab-pane key="props" title="节点属性">
            <PropertiesPanel :graph="graph" />
          </a-tab-pane>
          <a-tab-pane key="profile" title="Profile 信息">
            <ProfileInfoPanel />
          </a-tab-pane>
          <a-tab-pane key="constraints" title="约束规则">
            <ConstraintsPanel :graph="graph" />
          </a-tab-pane>
          <a-tab-pane key="datamodel" title="数据模型">
            <DataModelPanel :graph="graph" />
          </a-tab-pane>
        </a-tabs>
      </a-layout-sider>
    </a-layout>

    <!-- XML 预览弹窗 -->
    <a-modal v-model:visible="xmlModalVisible" :title="xmlModalTitle" :width="700" :footer="false">
      <a-textarea
        v-model="xmlContent"
        :auto-size="{ minRows: 15, maxRows: 30 }"
        style="font-family: monospace; font-size: 12px"
      />
      <template v-if="xmlModalMode === 'import'">
        <a-space style="margin-top: 12px">
          <a-button type="primary" @click="confirmImport">确认导入</a-button>
          <a-tag v-if="detectedDialectId" color="blue">
            检测到方言: {{ detectedDialectId }}
          </a-tag>
        </a-space>
      </template>
    </a-modal>

    <!-- 约束验证结果弹窗 -->
    <a-modal v-model:visible="validationModalVisible" title="约束验证结果" :width="600" :footer="false">
      <a-list :data="validationResults" :bordered="false">
        <template #item="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.description">
              <template #avatar>
                <a-tag :color="item.result === true ? 'green' : 'red'">
                  {{ item.result === true ? '✓ 通过' : '✗ 失败' }}
                </a-tag>
              </template>
              <template #description>
                <span v-if="item.result !== true" style="color: #f53f3f">{{ item.result }}</span>
                <span v-else style="color: #00b42a">验证通过</span>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
      <div v-if="validationResults.length === 0" style="text-align: center; color: #86909c; padding: 20px">
        当前 Profile 没有定义约束规则
      </div>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Graph } from '@antv/x6'
import { Message } from '@arco-design/web-vue'
import GraphCanvas from './components/GraphCanvas.vue'
import ProfileSwitcher from './components/ProfileSwitcher.vue'
import StencilPanel from './components/StencilPanel.vue'
import ProfileInfoPanel from './components/ProfileInfoPanel.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import ConstraintsPanel from './components/ConstraintsPanel.vue'
import DataModelPanel from './components/DataModelPanel.vue'
import { useDialectSingleton } from './composables/useDialect'

const { exportXML, importXML, detectDialect, runConstraintValidation, createSampleProcess } = useDialectSingleton()

const graph = shallowRef<Graph | null>(null)

function onGraphReady(g: Graph) {
  graph.value = g
  createSampleProcess()
}

// ---- XML 弹窗 ----
const xmlModalVisible = ref(false)
const xmlModalTitle = ref('')
const xmlModalMode = ref<'export' | 'import'>('export')
const xmlContent = ref('')
const detectedDialectId = ref('')

async function handleExport() {
  try {
    const xml = await exportXML()
    xmlContent.value = xml
    xmlModalTitle.value = '导出 BPMN XML'
    xmlModalMode.value = 'export'
    xmlModalVisible.value = true
    Message.success('导出成功')
  } catch (e: any) {
    Message.error(e.message || '导出失败')
  }
}

function handleImport() {
  xmlContent.value = ''
  detectedDialectId.value = ''
  xmlModalTitle.value = '导入 BPMN XML'
  xmlModalMode.value = 'import'
  xmlModalVisible.value = true
}

async function confirmImport() {
  try {
    await importXML(xmlContent.value)
    xmlModalVisible.value = false
    Message.success('导入成功')
  } catch (e: any) {
    Message.error(e.message || '导入失败')
  }
}

function handleDetect() {
  if (!xmlContent.value.trim()) {
    handleImport()
    return
  }
  const id = detectDialect(xmlContent.value)
  detectedDialectId.value = id
  Message.info(`检测到方言: ${id || '未知（使用默认 bpmn2）'}`)
}

// ---- 约束验证弹窗 ----
const validationModalVisible = ref(false)
const validationResults = ref<Array<{ id: string; description: string; result: true | string }>>([])

function handleValidate() {
  validationResults.value = runConstraintValidation()
  validationModalVisible.value = true
}

function handleCreateSample() {
  createSampleProcess()
  Message.success('已创建当前方言示例流程')
}
</script>

<style scoped>
.dialect-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

:deep(.arco-layout) {
  height: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 48px;
  min-height: 48px;
  background: linear-gradient(135deg, #165dff, #722ed1);
  color: #fff;
}

.app-header h1 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.header-right :deep(.arco-btn) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.header-right :deep(.arco-btn:hover) {
  border-color: #fff;
}

.app-main {
  flex: 1;
  height: calc(100vh - 48px);
  overflow: hidden;
}

.sider-left {
  background: #fff;
  border-right: 1px solid var(--color-border-2);
  overflow-y: auto;
}

.sider-right {
  background: #fff;
  border-left: 1px solid var(--color-border-2);
  overflow-y: auto;
  padding: 8px;
}

.canvas-wrapper {
  position: relative;
  overflow: hidden;
  background: #f7f8fa;
  height: 100%;
}

.divider {
  height: 1px;
  background: var(--color-border-2);
  margin: 4px 0;
}

:deep(.arco-layout-sider-children) {
  height: 100%;
  overflow-y: auto;
}

:deep(.arco-tabs-content) {
  padding: 0;
}
</style>
