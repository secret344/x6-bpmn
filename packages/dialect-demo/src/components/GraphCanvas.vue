<template>
  <div class="graph-canvas">
    <div ref="containerRef" class="graph-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Graph } from '@antv/x6'
import { Selection } from '@antv/x6/lib/plugin/selection'
import { Transform } from '@antv/x6/lib/plugin/transform'
import { Snapline } from '@antv/x6/lib/plugin/snapline'
import { History } from '@antv/x6/lib/plugin/history'
import { Keyboard } from '@antv/x6/lib/plugin/keyboard'
import { Clipboard } from '@antv/x6/lib/plugin/clipboard'
import {
  getShapeLabel,
  buildBpmnNodeDefaults,
  setupBpmnGraph,
  attachBoundaryToHost,
  resolveBpmnDropAction,
  resolveBpmnEmbeddingTargets,
  BPMN_POOL,
  BPMN_SEQUENCE_FLOW,
} from '@x6-bpmn2/plugin'
import { useDialectSingleton } from '../composables/useDialect'

const emit = defineEmits<{
  graphReady: [graph: Graph]
}>()

const containerRef = ref<HTMLDivElement>()
const { bindDialect, currentDialectId } = useDialectSingleton()

let graph: Graph | null = null
let resizeObserver: ResizeObserver | null = null
let disposeBpmnBehaviors: (() => void) | null = null

/** 当前选中的连线类型 */
const currentEdgeType = ref(BPMN_SEQUENCE_FLOW)

function parseDroppedShape(event: DragEvent): { shape: string; label?: string; width?: number; height?: number } | null {
  const raw = event.dataTransfer?.getData('application/bpmn-shape')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { shape?: string; label?: string; width?: number; height?: number }
      if (parsed.shape) return { shape: parsed.shape, label: parsed.label, width: parsed.width, height: parsed.height }
    } catch {
      // 兼容旧拖拽载荷，继续走 shape 字符串回退。
    }
  }

  const shape = event.dataTransfer?.getData('bpmn/shape')
  return shape ? { shape } : null
}

/** 边工具配置 */
const EDGE_TOOLS = [
  {
    name: 'vertices',
    args: { attrs: { r: 4, fill: '#333', stroke: '#fff', strokeWidth: 2, cursor: 'move' } },
  },
  {
    name: 'segments',
    args: { attrs: { width: 10, height: 8, x: -5, y: -4, fill: '#333', stroke: '#fff', strokeWidth: 2, cursor: 'pointer' } },
  },
  {
    name: 'source-arrowhead',
    args: { attrs: { d: 'M 0, -5 a 5,5,0,1,1,0,10 a 5,5,0,1,1,0,-10', fill: '#333', stroke: '#fff', 'stroke-width': 1, cursor: 'move' } },
  },
  {
    name: 'target-arrowhead',
    args: { attrs: { d: 'M -6, -8 L 0,0 L -6, 8 Z', fill: '#333', stroke: '#fff', 'stroke-width': 1, cursor: 'move' } },
  },
]

onMounted(async () => {
  await nextTick()
  const container = containerRef.value!
  const w = container.offsetWidth || 800
  const h = container.offsetHeight || 600

  graph = new Graph({
    container,
    width: w,
    height: h,
    grid: {
      visible: true,
      type: 'doubleMesh',
      args: [
        { color: '#eee', thickness: 1 },
        { color: '#ddd', thickness: 1, factor: 4 },
      ],
    },
    panning: { enabled: true, modifiers: 'shift' },
    mousewheel: {
      enabled: true,
      modifiers: ['ctrl', 'meta'],
      zoomAtMousePosition: true,
      minScale: 0.2,
      maxScale: 3,
    },
    connecting: {
      snap: true,
      allowBlank: false,
      allowLoop: false,
      highlight: true,
      router: { name: 'orth', args: { padding: 20 } },
      connector: { name: 'rounded', args: { radius: 8 } },
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: { attrs: { fill: '#fff', stroke: '#165dff', strokeWidth: 4 } },
      },
    },
    embedding: {
      enabled: true,
      findParent({ node }) {
        return resolveBpmnEmbeddingTargets(this, node)
      },
    },
    interacting: (view) => {
      const shape = view.cell.shape
      return {
        nodeMovable: shape !== BPMN_POOL,
        magnetConnectable: true,
      }
    },
  })

  // 插件
  graph.use(new Selection({
    enabled: true,
    multiple: true,
    rubberband: true,
    movable: true,
    showNodeSelectionBox: true,
    showEdgeSelectionBox: true,
  }))
  graph.use(new Transform({
    resizing: { enabled: true, minWidth: 40, minHeight: 40, preserveAspectRatio: false },
    rotating: false,
  }))
  graph.use(new Snapline({ enabled: true }))
  graph.use(new History({ enabled: true }))
  graph.use(new Keyboard({ enabled: true, global: true }))
  graph.use(new Clipboard({ enabled: true }))

  // 快捷键
  graph.bindKey(['backspace', 'delete'], () => {
    const cells = graph!.getSelectedCells()
    if (cells.length) graph!.removeCells(cells)
    return false
  })
  graph.bindKey('meta+z', () => { graph!.undo(); return false })
  graph.bindKey('meta+shift+z', () => { graph!.redo(); return false })
  graph.bindKey('meta+c', () => { graph!.copy(graph!.getSelectedCells()); return false })
  graph.bindKey('meta+v', () => { graph!.paste({ offset: 32 }); return false })
  graph.bindKey('meta+a', () => { graph!.select(graph!.getCells()); return false })

  disposeBpmnBehaviors = setupBpmnGraph(graph, {
    edgeShape: () => currentEdgeType.value,
  })

  // 边工具：悬停/选中时显示
  graph.on('edge:mouseenter', ({ edge }) => {
    if (!edge.hasTools()) edge.addTools(EDGE_TOOLS)
  })
  graph.on('edge:mouseleave', ({ edge }) => {
    if (!graph!.isSelected(edge)) edge.removeTools()
  })
  graph.on('edge:selected', ({ edge }) => {
    if (!edge.hasTools()) edge.addTools(EDGE_TOOLS)
  })
  graph.on('edge:unselected', ({ edge }) => {
    edge.removeTools()
  })

  // 拖放支持：从 StencilPanel 拖入元素
  container.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  })
  container.addEventListener('drop', (e) => {
    e.preventDefault()
    const payload = parseDroppedShape(e)
    if (!payload || !graph) return
    const { shape } = payload
    const point = graph.clientToLocal(e.clientX, e.clientY)
    const { width: nodeW, height: nodeH, attrs, data: rawData } = buildBpmnNodeDefaults(shape, {
      label: payload.label || getShapeLabel(shape),
      width: payload.width,
      height: payload.height,
    })
    const { label: _legacyLabel, ...data } = (rawData || {}) as Record<string, unknown>
    const draftNode = graph.createNode({
      shape,
      x: point.x - nodeW / 2,
      y: point.y - nodeH / 2,
      width: nodeW,
      height: nodeH,
      attrs,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    })
    const dropAction = resolveBpmnDropAction(graph, draftNode)
    if (dropAction.kind === 'reject') return

    const newNode = graph.addNode(draftNode)
    if (dropAction.kind === 'attach-boundary') {
      attachBoundaryToHost(graph, newNode, dropAction.host)
      return
    }

    if (dropAction.parent) {
      dropAction.parent.embed(newNode)
    }
  })

  // 自动调整大小
  resizeObserver = new ResizeObserver(() => {
    if (!graph || !container) return
    graph.resize(container.offsetWidth, container.offsetHeight)
  })
  resizeObserver.observe(container)

  // 绑定方言
  bindDialect(graph, currentDialectId.value)

  emit('graphReady', graph)
})

onUnmounted(() => {
  disposeBpmnBehaviors?.()
  disposeBpmnBehaviors = null
  resizeObserver?.disconnect()
  graph?.dispose()
})
</script>

<style scoped>
.graph-canvas {
  width: 100%;
  height: 100%;
  position: relative;
}

.graph-container {
  width: 100%;
  height: 100%;
}
</style>
