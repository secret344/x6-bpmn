<template>
  <a-modal
    v-model:visible="visible"
    title="bpmn-js 验证预览"
    :width="1100"
    :footer="false"
    draggable
    unmount-on-close
    class="bpmn-preview-modal"
  >
    <div class="bpmn-preview-status">
      <a-tag v-if="status === 'loading'" color="blue">加载中...</a-tag>
      <a-tag v-else-if="status === 'success'" color="green">验证通过 — bpmn-js 渲染成功</a-tag>
      <a-tag v-else-if="status === 'error'" color="red">验证失败</a-tag>
      <span v-if="warnings.length" class="bpmn-preview-warn">
        {{ warnings.length }} 条警告
      </span>
    </div>
    <div v-if="errorMsg" class="bpmn-preview-error">{{ errorMsg }}</div>
    <div class="bpmn-preview-body">
      <div class="bpmn-preview-canvas" ref="canvasRef" />
      <div class="bpmn-preview-xml">
        <pre>{{ xmlContent }}</pre>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

const visible = ref(false)
const xmlContent = ref('')
const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMsg = ref('')
const warnings = ref<string[]>([])
const canvasRef = ref<HTMLElement>()

let viewer: any = null

function open(xml: string) {
  xmlContent.value = xml
  status.value = 'loading'
  errorMsg.value = ''
  warnings.value = []
  visible.value = true
}

watch(visible, async (v) => {
  if (v) {
    await nextTick()
    // Wait for the modal DOM to be ready
    await new Promise(r => setTimeout(r, 100))
    renderBpmn()
  } else {
    destroyViewer()
  }
})

async function renderBpmn() {
  destroyViewer()
  if (!canvasRef.value || !xmlContent.value) return

  try {
    viewer = new NavigatedViewer({
      container: canvasRef.value,
    })
    const result = await viewer.importXML(xmlContent.value)
    warnings.value = (result.warnings || []).map((w: any) => w.message || String(w))
    status.value = 'success'
    // Fit to viewport
    const canvas = viewer.get('canvas')
    canvas.zoom('fit-viewport')
  } catch (err: any) {
    status.value = 'error'
    errorMsg.value = err.message || String(err)
    warnings.value = (err.warnings || []).map((w: any) => w.message || String(w))
  }
}

function destroyViewer() {
  if (viewer) {
    try { viewer.destroy() } catch { /* ignore */ }
    viewer = null
  }
}

onBeforeUnmount(() => {
  destroyViewer()
})

defineExpose({ open })
</script>

<style>
/* Modal-level (unscoped) overrides for bpmn-js */
.bpmn-preview-modal .arco-modal-body {
  padding: 12px 16px;
}
</style>

<style scoped>
.bpmn-preview-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.bpmn-preview-warn {
  color: #ff7d00;
  font-size: 13px;
}
.bpmn-preview-error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #f53f3f;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}
.bpmn-preview-body {
  display: flex;
  gap: 12px;
  height: 520px;
}
.bpmn-preview-canvas {
  flex: 1;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  position: relative;
}
.bpmn-preview-xml {
  width: 420px;
  min-width: 320px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #f7f8fa;
  overflow: auto;
}
.bpmn-preview-xml pre {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  color: #1d2129;
}
</style>
