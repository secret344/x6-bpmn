<template>
  <a-layout class="app-layout">
    <!-- 顶部工具栏 -->
    <a-layout-header class="app-header">
      <div class="header-left">
        <span class="header-title">审批流程设计器</span>
      </div>
      <div class="header-actions">
        <a-button size="small" @click="handleZoomIn">
          <template #icon><icon-zoom-in /></template>
          放大
        </a-button>
        <a-button size="small" @click="handleZoomOut">
          <template #icon><icon-zoom-out /></template>
          缩小
        </a-button>
        <a-button size="small" @click="handleFitView">
          <template #icon><icon-expand /></template>
          适应
        </a-button>
        <a-divider direction="vertical" />
        <a-button size="small" type="primary" status="success" @click="handlePrint">
          <template #icon><icon-code /></template>
          查看流程数据
        </a-button>
        <a-divider direction="vertical" />
        <a-button size="small" type="primary" @click="handleExportXml">
          <template #icon><icon-export /></template>
          导出 BPMN XML
        </a-button>
        <a-button size="small" @click="handleImportXml">
          <template #icon><icon-import /></template>
          导入 BPMN XML
        </a-button>
        <a-divider direction="vertical" />
        <a-button size="small" type="outline" status="warning" @click="handleBpmnPreview">
          <template #icon><icon-eye /></template>
          bpmn-js 验证
        </a-button>
      </div>
    </a-layout-header>

    <!-- 画布 -->
    <a-layout-content class="app-content">
      <div ref="containerRef" class="graph-container" />
    </a-layout-content>

    <!-- 流程数据弹框 -->
    <a-modal v-model:visible="dataVisible" title="流程节点数据" :width="500" :footer="false">
      <pre class="flow-data-json">{{ flowDataJson }}</pre>
    </a-modal>

    <!-- BPMN XML 导出弹框 -->
    <a-modal v-model:visible="xmlExportVisible" title="BPMN 2.0 XML" :width="700" :footer="false">
      <a-button size="small" style="margin-bottom: 8px" @click="handleCopyXml">复制到剪贴板</a-button>
      <pre class="flow-data-json">{{ xmlContent }}</pre>
    </a-modal>

    <!-- BPMN XML 导入弹框 -->
    <a-modal v-model:visible="xmlImportVisible" title="导入 BPMN 2.0 XML" :width="700" @ok="handleDoImport" ok-text="导入" cancel-text="取消">
      <a-textarea v-model="xmlImportContent" placeholder="粘贴 BPMN 2.0 XML 内容" :auto-size="{ minRows: 12, maxRows: 24 }" />
    </a-modal>

    <!-- 节点属性配置弹框 -->
    <NodeConfigModal ref="configModalRef" @save="handleConfigSave" />

    <!-- bpmn-js 验证预览弹框 -->
    <BpmnPreviewModal ref="bpmnPreviewRef" />
  </a-layout>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconZoomIn,
  IconZoomOut,
  IconExpand,
  IconCode,
  IconExport,
  IconImport,
  IconEye,
} from '@arco-design/web-vue/es/icon'
import type { Graph, Cell } from '@antv/x6'
import {
  exportBpmnXml,
  importBpmnXml,
} from '@x6-bpmn2/plugin'
import {
  registerShapes,
  createGraph,
  initFlow,
  insertAfter,
  getFlowItems,
  updateApprovalBpmn,
  renameApproval,
  SHAPE_ADD_BTN,
} from './flow'
import NodeConfigModal from './components/NodeConfigModal.vue'
import BpmnPreviewModal from './components/BpmnPreviewModal.vue'

const containerRef = ref<HTMLElement>()
const graphRef = shallowRef<Graph>()
const configModalRef = ref<InstanceType<typeof NodeConfigModal>>()
const bpmnPreviewRef = ref<InstanceType<typeof BpmnPreviewModal>>()

const dataVisible = ref(false)
const flowDataJson = ref('')

const xmlExportVisible = ref(false)
const xmlContent = ref('')

const xmlImportVisible = ref(false)
const xmlImportContent = ref('')

onMounted(async () => {
  registerShapes()

  await nextTick()
  if (!containerRef.value) return

  const graph = createGraph(containerRef.value)
  graphRef.value = graph

  // 监听加号按钮点击
  graph.on('add-button:click', ({ addButtonNode }: any) => {
    const afterIndex = addButtonNode.getData()?.afterIndex ?? 0
    insertAfter(graph, afterIndex)
    Message.success('已添加审批节点')
  })

  // 双击节点打开属性配置面板（排除 add-button）
  graph.on('cell:dblclick', ({ cell }: { cell: Cell }) => {
    if (cell.shape === SHAPE_ADD_BTN) return
    if (cell.isEdge()) return
    configModalRef.value?.open(cell)
  })

  // 初始化默认审批流
  initFlow(graph)
})

// ---- 工具栏 ----
function handleZoomIn() {
  graphRef.value?.zoom(0.1)
}

function handleZoomOut() {
  graphRef.value?.zoom(-0.1)
}

function handleFitView() {
  graphRef.value?.zoomToFit({ padding: 60, maxScale: 1 })
  graphRef.value?.centerContent()
}

function handlePrint() {
  flowDataJson.value = JSON.stringify(getFlowItems(), null, 2)
  dataVisible.value = true
}

// ---- BPMN XML 导出 ----
async function handleExportXml() {
  if (!graphRef.value) return
  try {
    xmlContent.value = await exportBpmnXml(graphRef.value, {
      processId: 'approval-process',
      processName: '审批流程',
    })
    xmlExportVisible.value = true
  } catch (e: any) {
    Message.error(`导出失败: ${e.message}`)
  }
}

function handleCopyXml() {
  navigator.clipboard.writeText(xmlContent.value).then(() => {
    Message.success('已复制到剪贴板')
  })
}

// ---- BPMN XML 导入 ----
function handleImportXml() {
  xmlImportContent.value = ''
  xmlImportVisible.value = true
}

async function handleDoImport() {
  if (!graphRef.value || !xmlImportContent.value.trim()) {
    Message.warning('请输入 XML 内容')
    return
  }
  try {
    await importBpmnXml(graphRef.value, xmlImportContent.value)
    xmlImportVisible.value = false
    Message.success('导入成功')
  } catch (e: any) {
    Message.error(`导入失败: ${e.message}`)
  }
}

// ---- bpmn-js 验证预览 ----
async function handleBpmnPreview() {
  if (!graphRef.value) return
  try {
    const xml = await exportBpmnXml(graphRef.value, {
      processId: 'approval-process',
      processName: '审批流程',
    })
    bpmnPreviewRef.value?.open(xml)
  } catch (e: any) {
    Message.error(`生成 XML 失败: ${e.message}`)
  }
}

// ---- 节点属性保存 ----
function handleConfigSave(cellId: string, bpmn: Record<string, any>, name: string) {
  if (!graphRef.value) return
  updateApprovalBpmn(graphRef.value, cellId, bpmn)
  if (name) {
    renameApproval(graphRef.value, cellId, name)
  }
  Message.success('属性已保存')
}
</script>

<style scoped>
.app-layout {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.graph-container {
  width: 100%;
  height: 100%;
}

.flow-data-json {
  background: #f7f8fa;
  padding: 16px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  max-height: 400px;
  overflow: auto;
  white-space: pre;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}
</style>
