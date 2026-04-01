<template>
  <a-layout class="se-app">
    <!-- 顶部 -->
    <a-layout-header class="app-header">
      <div class="header-left">
        <h1>SmartEngine 方言演示</h1>
        <a-tag :color="modeColor" style="margin-left: 8px">{{ currentMode.name }}</a-tag>
      </div>
      <div class="header-right">
        <a-space>
          <a-button size="small" @click="handleExportXML">导出 XML</a-button>
          <a-button size="small" @click="handleImportXML">导入 XML</a-button>
          <a-button size="small" @click="handleValidation">验证流程</a-button>
          <a-button size="small" type="outline" @click="handleCreateSample">创建示例流程</a-button>
        </a-space>
      </div>
    </a-layout-header>

    <a-layout class="app-main">
      <!-- 左侧面板 -->
      <a-layout-sider :width="280" :hide-trigger="true" class="sider-left">
        <!-- 模式切换 -->
        <div class="mode-section">
          <div class="section-title">SmartEngine 模式</div>
          <a-radio-group v-model="selectedMode" direction="vertical" @change="onModeChange">
            <a-radio value="smartengine-base">
              <div class="mode-option">
                <div class="mode-name">🔧 基础模式</div>
                <div class="mode-desc">完整 BPMN 2.0 + SmartEngine 扩展</div>
              </div>
            </a-radio>
            <a-radio value="smartengine-custom">
              <div class="mode-option">
                <div class="mode-name">⚙️ 服务编排模式</div>
                <div class="mode-desc">强化 ServiceTask，禁用人工任务</div>
              </div>
            </a-radio>
            <a-radio value="smartengine-database">
              <div class="mode-option">
                <div class="mode-name">📋 审批工单模式</div>
                <div class="mode-desc">多实例、审批策略、UserTask 增强</div>
              </div>
            </a-radio>
          </a-radio-group>
        </div>

        <div class="divider" />

        <!-- 可用元素 -->
        <div class="element-section">
          <div class="section-title">
            可用元素
            <a-tag size="small" color="green">{{ enabledCount }}</a-tag>
            <a-tag v-if="disabledCount > 0" size="small" color="orangered">-{{ disabledCount }}</a-tag>
          </div>

          <a-collapse :default-active-key="['event', 'task', 'gateway', 'data', 'swimlane', 'artifact']" :bordered="false">
            <a-collapse-item
              v-for="group in shapeGroups"
              :key="group.key"
              :header="`${group.label} (${group.items.length})`"
            >
              <div class="shape-list">
                <div
                  v-for="item in group.items"
                  :key="item.shape"
                  class="shape-item"
                  :class="{ disabled: item.status === 'disabled' }"
                  draggable="true"
                  :title="item.title"
                  @dragstart="onDrag($event, item.shape)"
                >
                  <div class="shape-icon" v-html="getShapeIcon(item.shape)"></div>
                  <span class="shape-name">{{ item.title }}</span>
                  <a-tag v-if="item.status === 'disabled'" size="small" color="gray">禁用</a-tag>
                </div>
              </div>
            </a-collapse-item>
          </a-collapse>
        </div>
      </a-layout-sider>

      <!-- 画布 -->
      <a-layout-content class="canvas-wrapper">
        <GraphCanvas ref="canvasRef" @graph-ready="onGraphReady" />
      </a-layout-content>

      <!-- 右侧面板 -->
      <a-layout-sider :width="320" :hide-trigger="true" class="sider-right">
        <a-tabs default-active-key="props" size="small">
          <a-tab-pane key="props" title="节点属性">
            <PropertiesPanel :graph="graph" />
          </a-tab-pane>
          <a-tab-pane key="fields" title="SmartEngine 字段">
            <SmartFieldsPanel :graph="graph" />
          </a-tab-pane>
          <a-tab-pane key="compare" title="模式对比">
            <ModeComparePanel />
          </a-tab-pane>
          <a-tab-pane key="adapters" title="适配器">
            <AdaptersPanel :graph="graph" />
          </a-tab-pane>
        </a-tabs>
      </a-layout-sider>
    </a-layout>

    <!-- XML 弹窗 -->
    <a-modal v-model:visible="xmlModalVisible" :title="xmlModalTitle" :width="700" :footer="false">
      <a-textarea
        v-model="xmlContent"
        :auto-size="{ minRows: 15, maxRows: 30 }"
        style="font-family: monospace; font-size: 12px"
      />
      <a-space v-if="xmlModalMode === 'import'" style="margin-top: 12px">
        <a-button type="primary" @click="doImport">确认导入</a-button>
        <a-tag v-if="detectedDialect" color="blue">检测方言: {{ detectedDialect }}</a-tag>
      </a-space>
    </a-modal>

    <!-- 验证结果弹窗 -->
    <a-modal v-model:visible="validationVisible" title="流程验证结果" :width="600" :footer="false">
      <div v-for="r in validationResults" :key="r.id" class="validation-item" :class="{ pass: r.result === true, fail: r.result !== true }">
        <span class="v-icon">{{ r.result === true ? '✓' : '✗' }}</span>
        <div>
          <div class="v-desc">{{ r.description }}</div>
          <div v-if="r.result !== true" class="v-reason">{{ r.result }}</div>
        </div>
      </div>
      <div v-if="fieldErrors.length > 0" style="margin-top: 12px">
        <div class="section-title">字段验证错误</div>
        <div v-for="e in fieldErrors" :key="e.node + e.field" class="validation-item fail">
          <span class="v-icon">✗</span>
          <div>
            <div class="v-desc">{{ e.node }} → {{ e.field }}</div>
            <div class="v-reason">{{ e.reason }}</div>
          </div>
        </div>
      </div>
      <div v-if="validationResults.length === 0 && fieldErrors.length === 0" style="text-align: center; padding: 20px; color: #86909c">
        验证全部通过 ✓
      </div>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import type { Graph } from '@antv/x6'
import { Message } from '@arco-design/web-vue'
import { getBpmnShapeIcon } from '@x6-bpmn2/plugin'
import GraphCanvas from './components/GraphCanvas.vue'
import SmartFieldsPanel from './components/SmartFieldsPanel.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import ModeComparePanel from './components/ModeComparePanel.vue'
import AdaptersPanel from './components/AdaptersPanel.vue'
import { useSmartEngineSingleton } from './composables/useSmartEngine'

const {
  selectedMode,
  currentMode,
  switchMode,
  enabledNodes,
  disabledNodes,
  resolvedProfile,
  exportXML,
  importXML,
  detectDialect,
  runValidation,
  runFieldValidation,
  createSampleProcess,
} = useSmartEngineSingleton()

const graph = shallowRef<Graph | null>(null)
const canvasRef = ref()

function onGraphReady(g: Graph) {
  graph.value = g
}

const modeColor = computed(() => {
  const map: Record<string, string> = {
    'smartengine-base': 'blue',
    'smartengine-custom': 'orange',
    'smartengine-database': 'green',
  }
  return map[selectedMode.value] || 'blue'
})

const enabledCount = computed(() => enabledNodes.value.length)
const disabledCount = computed(() => disabledNodes.value.length)

// ---- 形状分组 ----
const shapeGroups = computed(() => {
  if (!resolvedProfile.value) return []
  const defs = resolvedProfile.value.definitions.nodes
  const avail = resolvedProfile.value.availability.nodes

  const groups: Record<string, { key: string; label: string; color: string; items: Array<{ shape: string; title: string; status: string }> }> = {}

  const groupConfig: Record<string, { label: string; color: string }> = {
    event: { label: '事件', color: '#00b42a' },
    task: { label: '任务/活动', color: '#165dff' },
    gateway: { label: '网关', color: '#ff7d00' },
    data: { label: '数据', color: '#86909c' },
    swimlane: { label: '泳道', color: '#722ed1' },
    artifact: { label: '工件', color: '#86909c' },
  }

  const categoryMap: Record<string, string> = {
    startEvent: 'event', endEvent: 'event',
    intermediateThrowEvent: 'event', intermediateCatchEvent: 'event',
    boundaryEvent: 'event',
    task: 'task', subProcess: 'task',
    gateway: 'gateway',
    dataObject: 'data',
    swimlane: 'swimlane',
    artifact: 'artifact',
  }

  for (const [shape, def] of Object.entries(defs)) {
    const groupKey = categoryMap[def.category] || 'other'
    const cfg = groupConfig[groupKey] || { label: groupKey, color: '#333' }
    if (!groups[groupKey]) {
      groups[groupKey] = { key: groupKey, label: cfg.label, color: cfg.color, items: [] }
    }
    groups[groupKey].items.push({
      shape,
      title: def.title || shape,
      status: avail[shape] || 'enabled',
    })
  }

  const order = ['event', 'task', 'gateway', 'data', 'swimlane', 'artifact']
  return order.filter((k) => groups[k]).map((k) => groups[k])
})

function onDrag(e: DragEvent, shape: string) {
  e.dataTransfer?.setData('bpmn/shape', shape)
}

function getShapeIcon(shape: string): string {
  return getBpmnShapeIcon(shape)
}

function onModeChange(val: string | number | boolean) {
  switchMode(val as string)
  Message.success(`已切换到: ${currentMode.value.name}`)
}

// ---- XML ----
const xmlModalVisible = ref(false)
const xmlModalTitle = ref('')
const xmlModalMode = ref<'export' | 'import'>('export')
const xmlContent = ref('')
const detectedDialect = ref('')

async function handleExportXML() {
  try {
    xmlContent.value = await exportXML()
    xmlModalTitle.value = '导出 SmartEngine XML'
    xmlModalMode.value = 'export'
    xmlModalVisible.value = true
    Message.success('导出成功')
  } catch (e: any) {
    Message.error(e.message)
  }
}

function handleImportXML() {
  xmlContent.value = ''
  detectedDialect.value = ''
  xmlModalTitle.value = '导入 XML'
  xmlModalMode.value = 'import'
  xmlModalVisible.value = true
}

async function doImport() {
  try {
    detectedDialect.value = detectDialect(xmlContent.value)
    await importXML(xmlContent.value)
    xmlModalVisible.value = false
    Message.success('导入成功')
  } catch (e: any) {
    Message.error(e.message)
  }
}

// ---- 验证 ----
const validationVisible = ref(false)
const validationResults = ref<Array<{ id: string; description: string; result: true | string }>>([])
const fieldErrors = ref<Array<{ node: string; field: string; reason: string }>>([])

function handleValidation() {
  validationResults.value = runValidation()
  fieldErrors.value = runFieldValidation()
  validationVisible.value = true
}

// ---- 示例 ----
function handleCreateSample() {
  createSampleProcess()
  Message.success(`已创建 ${currentMode.value.name} 示例流程`)
}
</script>

<style scoped>
.se-app {
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
  background: linear-gradient(135deg, #0fc6c2, #165dff);
  color: #fff;
}

.app-header h1 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right :deep(.arco-btn) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.app-main {
  flex: 1;
  height: calc(100vh - 48px);
  overflow: hidden;
}

.sider-left,
.sider-right {
  background: #fff;
  overflow-y: auto;
}

.sider-left {
  border-right: 1px solid var(--color-border-2);
}

.sider-right {
  border-left: 1px solid var(--color-border-2);
  padding: 8px;
}

.canvas-wrapper {
  position: relative;
  overflow: hidden;
  background: #f7f8fa;
  height: 100%;
}

.mode-section,
.element-section {
  padding: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mode-option {
  margin-left: 4px;
}

.mode-name {
  font-size: 13px;
  font-weight: 500;
}

.mode-desc {
  font-size: 11px;
  color: var(--color-text-3);
}

.divider {
  height: 1px;
  background: var(--color-border-2);
}

.shape-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shape-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: grab;
  font-size: 12px;
}

.shape-item:hover {
  background: var(--color-fill-2);
}

.shape-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shape-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--color-text-2);
}

.shape-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.shape-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.arco-radio) {
  margin-bottom: 6px;
}

:deep(.arco-layout-sider-children) {
  height: 100%;
  overflow-y: auto;
}

.validation-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  margin-bottom: 4px;
  border-radius: 6px;
}

.validation-item.pass {
  background: #e8ffea;
}

.validation-item.fail {
  background: #ffece8;
}

.v-icon {
  font-size: 16px;
}

.validation-item.pass .v-icon {
  color: #00b42a;
}

.validation-item.fail .v-icon {
  color: #f53f3f;
}

.v-desc {
  font-size: 12px;
  font-weight: 500;
}

.v-reason {
  font-size: 11px;
  color: #f53f3f;
}
</style>
