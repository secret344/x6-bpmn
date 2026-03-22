<template>
  <a-modal
    v-model:visible="visible"
    title="bpmn-js 流程编辑器"
    :width="1200"
    :mask-closable="false"
    :esc-to-close="false"
    draggable
    unmount-on-close
    class="bpmn-editor-modal"
    @before-ok="onConfirm"
    @cancel="onCancel"
  >
    <template #footer>
      <a-space>
        <a-button @click="onCancel">取消</a-button>
        <a-button type="primary" :loading="importing" @click="onConfirm">
          确定导入
        </a-button>
      </a-space>
    </template>

    <div class="bpmn-editor-toolbar">
      <a-space :size="4">
        <a-button size="mini" @click="onNewDiagram">
          <template #icon><icon-plus /></template>
          新建
        </a-button>
        <a-button size="mini" @click="onLoadFromX6">
          <template #icon><icon-sync /></template>
          从X6加载
        </a-button>
        <a-button size="mini" @click="onImportXml">
          <template #icon><icon-import /></template>
          导入XML
        </a-button>
        <a-button size="mini" @click="onExportXml">
          <template #icon><icon-export /></template>
          导出XML
        </a-button>
        <a-button size="mini" @click="onZoomFit">
          <template #icon><icon-fullscreen /></template>
          适应画布
        </a-button>
      </a-space>
    </div>

    <div class="bpmn-editor-body">
      <div class="bpmn-editor-canvas" ref="canvasRef" />
    </div>
  </a-modal>

  <!-- XML 导入/导出弹框 -->
  <a-modal
    v-model:visible="xmlDialogVisible"
    :title="xmlDialogTitle"
    :width="700"
    :footer="xmlDialogReadonly ? false : undefined"
    unmount-on-close
    @before-ok="onConfirmXmlImport"
  >
    <a-textarea
      v-model="xmlDialogContent"
      :auto-size="{ minRows: 12, maxRows: 24 }"
      :readonly="xmlDialogReadonly"
      :placeholder="xmlDialogReadonly ? '' : '请粘贴 BPMN XML 内容...'"
      style="font-family: 'Courier New', Consolas, monospace; font-size: 13px"
    />
    <template v-if="xmlDialogReadonly" #footer>
      <a-button type="primary" size="small" @click="onCopyDialogXml">复制</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { Modal } from '@arco-design/web-vue'
import {
  IconPlus,
  IconSync,
  IconImport,
  IconExport,
  IconFullscreen,
} from '@arco-design/web-vue/es/icon'
import type { Graph } from '@antv/x6'
import { importBpmnXml, exportBpmnXml } from '@x6-bpmn2/plugin'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="240" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const props = defineProps<{
  graph: Graph | null
}>()

const visible = ref(false)
const importing = ref(false)
const canvasRef = ref<HTMLElement>()

// XML dialog state
const xmlDialogVisible = ref(false)
const xmlDialogTitle = ref('')
const xmlDialogContent = ref('')
const xmlDialogReadonly = ref(true)

let modeler: any = null

function open() {
  visible.value = true
}

watch(visible, async (v) => {
  if (v) {
    await nextTick()
    await new Promise((r) => setTimeout(r, 150))
    initModeler()
  } else {
    destroyModeler()
  }
})

async function initModeler() {
  destroyModeler()
  if (!canvasRef.value) return

  modeler = new BpmnModeler({
    container: canvasRef.value,
    keyboard: { bindTo: canvasRef.value },
  })

  try {
    await modeler.importXML(EMPTY_BPMN)
    const canvas = modeler.get('canvas')
    canvas.zoom('fit-viewport')
  } catch (err: any) {
    console.error('bpmn-js modeler init failed:', err)
  }
}

function destroyModeler() {
  if (modeler) {
    try {
      modeler.destroy()
    } catch {
      /* ignore */
    }
    modeler = null
  }
}

async function onConfirm() {
  if (!modeler || !props.graph) return
  importing.value = true
  try {
    const { xml } = await modeler.saveXML({ format: true })
    if (!xml) {
      Modal.warning({ title: '提示', content: '无法获取编辑器中的 BPMN XML' })
      importing.value = false
      return
    }
    await importBpmnXml(props.graph, xml)
    visible.value = false
    const nodeCount = props.graph.getNodes().length
    const edgeCount = props.graph.getEdges().length
    Modal.success({
      title: '导入成功',
      content: `已将 bpmn-js 中的流程导入到 X6 画布。节点: ${nodeCount}, 连线: ${edgeCount}`,
    })
  } catch (err: any) {
    Modal.error({ title: '导入失败', content: err.message || String(err) })
  } finally {
    importing.value = false
  }
}

function onCancel() {
  visible.value = false
}

/** 新建空白流程 */
async function onNewDiagram() {
  if (!modeler) return
  try {
    await modeler.importXML(EMPTY_BPMN)
    const canvas = modeler.get('canvas')
    canvas.zoom('fit-viewport')
  } catch (err: any) {
    console.error('New diagram failed:', err)
  }
}

/** 从当前 X6 画布加载流程 */
async function onLoadFromX6() {
  if (!modeler || !props.graph) return
  try {
    const xml = await exportBpmnXml(props.graph, { processName: 'BPMN流程' })
    await modeler.importXML(xml)
    const canvas = modeler.get('canvas')
    canvas.zoom('fit-viewport')
    Modal.info({ title: '提示', content: '已从 X6 画布加载流程到编辑器' })
  } catch (err: any) {
    Modal.error({
      title: '加载失败',
      content: err.message || String(err),
    })
  }
}

/** 弹出 XML 文本框供用户粘贴导入 */
function onImportXml() {
  xmlDialogTitle.value = '导入 BPMN XML'
  xmlDialogContent.value = ''
  xmlDialogReadonly.value = false
  xmlDialogVisible.value = true
}

/** 将粘贴的 XML 导入到 bpmn-js 编辑器 */
async function onConfirmXmlImport() {
  if (!modeler) return
  const xml = xmlDialogContent.value.trim()
  if (!xml) {
    Modal.warning({ title: '提示', content: '请粘贴 BPMN XML 内容' })
    return false
  }
  try {
    await modeler.importXML(xml)
    const canvas = modeler.get('canvas')
    canvas.zoom('fit-viewport')
    xmlDialogVisible.value = false
    return true
  } catch (err: any) {
    Modal.error({ title: 'XML 加载失败', content: err.message || String(err) })
    return false
  }
}

/** 导出当前编辑器中的 XML */
async function onExportXml() {
  if (!modeler) return
  try {
    const { xml } = await modeler.saveXML({ format: true })
    xmlDialogTitle.value = '当前 BPMN XML'
    xmlDialogContent.value = xml || ''
    xmlDialogReadonly.value = true
    xmlDialogVisible.value = true
  } catch (err: any) {
    Modal.error({ title: '导出失败', content: err.message || String(err) })
  }
}

function onCopyDialogXml() {
  navigator.clipboard.writeText(xmlDialogContent.value).then(() => {
    Modal.success({ title: '已复制', content: '内容已复制到剪贴板' })
  })
}

/** 适应画布 */
function onZoomFit() {
  if (!modeler) return
  const canvas = modeler.get('canvas')
  canvas.zoom('fit-viewport')
}

onBeforeUnmount(() => {
  destroyModeler()
})

defineExpose({ open })
</script>

<style>
/* Modal-level (unscoped) overrides */
.bpmn-editor-modal .arco-modal-body {
  padding: 8px 16px 12px;
}
</style>

<style scoped>
.bpmn-editor-toolbar {
  margin-bottom: 8px;
}
.bpmn-editor-body {
  height: 560px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  position: relative;
}
.bpmn-editor-canvas {
  width: 100%;
  height: 100%;
}

/* bpmn-js palette / properties panel sizing inside modal */
.bpmn-editor-canvas :deep(.djs-palette) {
  top: 8px;
  left: 8px;
}
</style>
