<template>
  <a-space class="toolbar" :size="4">
    <a-tooltip content="撤销" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onUndo">
        <template #icon>
          <icon-undo />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="重做" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onRedo">
        <template #icon>
          <icon-redo />
        </template>
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" class="toolbar-divider" />

    <a-tooltip content="放大" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onZoomIn">
        <template #icon>
          <icon-zoom-in />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="缩小" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onZoomOut">
        <template #icon>
          <icon-zoom-out />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="适应画布" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onFit">
        <template #icon>
          <icon-fullscreen />
        </template>
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" class="toolbar-divider" />

    <a-tooltip content="导出 JSON" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onExport">
        <template #icon>
          <icon-export />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="导入 JSON" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onImport">
        <template #icon>
          <icon-import />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="查看 X6 JSON" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onViewJson">
        <template #icon>
          <icon-find-replace />
        </template>
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" class="toolbar-divider" />

    <a-tooltip content="导出 BPMN XML" position="bottom" mini>
      <a-button
        size="small"
        type="text"
        class="toolbar-btn"
        data-testid="export-bpmn-xml"
        @click="onExportBpmn"
      >
        <template #icon>
          <icon-code />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="导入 BPMN XML" position="bottom" mini>
      <a-button
        size="small"
        type="text"
        class="toolbar-btn"
        data-testid="open-import-bpmn-xml"
        @click="onImportBpmn"
      >
        <template #icon>
          <icon-code-block />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="加载BPMN示例" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onLoadSampleXml">
        <template #icon>
          <icon-file />
        </template>
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" class="toolbar-divider" />

    <a-tooltip content="bpmn-js 编辑器" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onBpmnEditor">
        <template #icon>
          <icon-edit />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="bpmn-js 验证预览" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onBpmnPreview">
        <template #icon>
          <icon-eye />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="查看原始 XML" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onViewRawXml">
        <template #icon>
          <icon-code-square />
        </template>
      </a-button>
    </a-tooltip>
    <a-tooltip content="校验当前流程" position="bottom" mini>
      <a-button size="small" type="text" class="toolbar-btn" @click="onValidateDiagram">
        校验
      </a-button>
    </a-tooltip>

    <a-divider direction="vertical" class="toolbar-divider" />

    <a-tooltip content="加载示例流程" position="bottom" mini>
      <a-button
        size="small"
        type="text"
        class="toolbar-btn"
        data-testid="load-sample-process"
        @click="onLoadSampleProcess"
      >
        <template #icon>
          <icon-refresh />
        </template>
      </a-button>
    </a-tooltip>
  </a-space>

  <BpmnPreviewModal ref="bpmnPreviewRef" />
  <BpmnEditorModal ref="bpmnEditorRef" :graph="graph" />
  <DiagramValidationModal ref="diagramValidationRef" :graph="graph" />

  <a-modal
    v-model:visible="xmlModalVisible"
    :title="xmlModalTitle"
    :width="720"
    :footer="false"
    unmount-on-close
  >
    <a-textarea
      v-model="xmlModalContent"
      data-testid="bpmn-xml-textarea"
      :auto-size="{ minRows: 10, maxRows: 28 }"
      :readonly="xmlModalReadonly"
      :placeholder="xmlModalReadonly ? '' : '请粘贴 BPMN XML 内容...'"
      style="font-family: 'Courier New', Consolas, monospace; font-size: 13px"
    />
    <div style="margin-top: 12px; text-align: right">
      <a-button v-if="xmlModalReadonly" type="primary" size="small" @click="onCopyXml">复制内容</a-button>
      <a-button
        v-else
        type="primary"
        size="small"
        data-testid="confirm-import-bpmn-xml"
        @click="onConfirmImportBpmn"
      >
        导入
      </a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Modal } from '@arco-design/web-vue'
import type { Graph } from '@antv/x6'
import {
  IconUndo,
  IconRedo,
  IconZoomIn,
  IconZoomOut,
  IconFullscreen,
  IconExport,
  IconImport,
  IconRefresh,
  IconCode,
  IconCodeBlock,
  IconFile,
  IconEye,
  IconFindReplace,
  IconCodeSquare,
  IconEdit,
} from '@arco-design/web-vue/es/icon'
import BpmnPreviewModal from './BpmnPreviewModal.vue'
import BpmnEditorModal from './BpmnEditorModal.vue'
import DiagramValidationModal from './DiagramValidationModal.vue'
import { createSampleProcess } from '../sample-process'
import { SAMPLE_BPMN_XML } from '../sample-bpmn-xml'
import {
  exportStandardBpmnXml,
  importExampleBpmnXml,
} from '../bpmn-xml'

const props = defineProps<{
  graph: Graph | null
}>()

const bpmnPreviewRef = ref<InstanceType<typeof BpmnPreviewModal>>()
const bpmnEditorRef = ref<InstanceType<typeof BpmnEditorModal>>()
const diagramValidationRef = ref<InstanceType<typeof DiagramValidationModal>>()

const xmlModalVisible = ref(false)
const xmlModalTitle = ref('')
const xmlModalContent = ref('')
const xmlModalReadonly = ref(true)

function onUndo() {
  props.graph?.undo()
}
function onRedo() {
  props.graph?.redo()
}
function onZoomIn() {
  props.graph?.zoom(0.1)
}
function onZoomOut() {
  props.graph?.zoom(-0.1)
}
function onFit() {
  props.graph?.zoomToFit({ padding: 40, maxScale: 1 })
}

function onExport() {
  if (!props.graph) return
  const data = props.graph.toJSON()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bpmn-diagram.json'
  a.click()
  URL.revokeObjectURL(url)
}

function onImport() {
  if (!props.graph) return
  const g = props.graph
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        g.fromJSON(data)
        g.zoomToFit({ padding: 40, maxScale: 1 })
      } catch {
        alert('无效的 JSON 文件')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function onViewJson() {
  if (!props.graph) return
  const nodes = props.graph.getNodes()
  const edges = props.graph.getEdges()
  const data = props.graph.toJSON()

  const lines: string[] = []
  lines.push(`=== X6 Graph Summary ===`)
  lines.push(`Nodes: ${nodes.length}, Edges: ${edges.length}\n`)

  lines.push(`--- Edges ---`)
  edges.forEach((edge, i) => {
    const src = edge.getSourceCellId() || '?'
    const tgt = edge.getTargetCellId() || '?'
    const labels = edge.getLabels()
    const label = (labels?.[0]?.attrs as any)?.label?.text || ''
    lines.push(`${i + 1}. [${edge.shape}] ${src} → ${tgt}${label ? ` "${label}"` : ''}`)
  })

  lines.push(`\n--- Full JSON ---`)
  lines.push(JSON.stringify(data, null, 2))

  xmlModalTitle.value = '查看 X6 JSON'
  xmlModalContent.value = lines.join('\n')
  xmlModalReadonly.value = true
  xmlModalVisible.value = true
}

function onLoadSampleProcess() {
  if (!props.graph) return
  createSampleProcess(props.graph)
  setTimeout(() => props.graph?.zoomToFit({ padding: 40, maxScale: 1 }), 100)
}

async function onExportBpmn() {
  if (!props.graph) return
  const xml = await exportStandardBpmnXml(props.graph, { processName: 'BPMN流程' })
  xmlModalTitle.value = '导出 BPMN XML'
  xmlModalContent.value = xml
  xmlModalReadonly.value = true
  xmlModalVisible.value = true
}

function onCopyXml() {
  navigator.clipboard.writeText(xmlModalContent.value).then(() => {
    Modal.success({ title: '已复制', content: '内容已复制到剪贴板' })
  })
}

function onImportBpmn() {
  if (!props.graph) return
  xmlModalTitle.value = '导入 BPMN XML'
  xmlModalContent.value = ''
  xmlModalReadonly.value = false
  xmlModalVisible.value = true
}

async function onConfirmImportBpmn() {
  if (!props.graph) return
  const xml = xmlModalContent.value.trim()
  if (!xml) {
    Modal.warning({ title: '提示', content: '请粘贴 BPMN XML 内容' })
    return
  }
  try {
    await importExampleBpmnXml(props.graph, xml)
    xmlModalVisible.value = false
    const nodeCount = props.graph.getNodes().length
    const edgeCount = props.graph.getEdges().length
    const edgeShapes = props.graph.getEdges().reduce((acc, e) => {
      acc[e.shape] = (acc[e.shape] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const edgeDetail = Object.entries(edgeShapes).map(([s, c]) => `${s}: ${c}`).join(', ')
    Modal.success({
      title: '导入成功',
      content: `节点: ${nodeCount}, 连线: ${edgeCount}\n${edgeDetail}`,
    })
  } catch (err: any) {
    Modal.error({ title: '导入失败', content: err.message || String(err) })
  }
}

function onBpmnEditor() {
  bpmnEditorRef.value?.open()
}

function onValidateDiagram() {
  diagramValidationRef.value?.open()
}

async function onBpmnPreview() {
  if (!props.graph) return
  try {
    const xml = await exportStandardBpmnXml(props.graph, { processName: 'BPMN流程' })
    bpmnPreviewRef.value?.open(xml)
  } catch (err: any) {
    Modal.error({ title: '生成 XML 失败', content: err.message || String(err) })
  }
}

async function onViewRawXml() {
  if (!props.graph) return
  try {
    const xml = await exportStandardBpmnXml(props.graph, { processName: 'BPMN流程' })
    xmlModalTitle.value = '原始 BPMN XML'
    xmlModalContent.value = xml
    xmlModalReadonly.value = true
    xmlModalVisible.value = true
  } catch (err: any) {
    Modal.error({ title: '生成 XML 失败', content: err.message || String(err) })
  }
}

async function onLoadSampleXml() {
  if (!props.graph) return
  try {
    await importExampleBpmnXml(props.graph, SAMPLE_BPMN_XML)
  } catch (err: any) {
    alert('加载示例失败: ' + (err.message || err))
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
}

.toolbar-btn {
  color: rgba(255, 255, 255, 0.85) !important;
}

.toolbar-btn:hover {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

.toolbar-divider {
  border-color: rgba(255, 255, 255, 0.3);
  margin: 0 4px;
}
</style>
