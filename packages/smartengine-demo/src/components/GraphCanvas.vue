<template>
  <div class="graph-canvas">
    <div ref="containerRef" class="graph-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Graph } from '@antv/x6'
import { Selection } from '@antv/x6-plugin-selection'
import { Transform } from '@antv/x6-plugin-transform'
import { Snapline } from '@antv/x6-plugin-snapline'
import { History } from '@antv/x6-plugin-history'
import { Keyboard } from '@antv/x6-plugin-keyboard'
import { Clipboard } from '@antv/x6-plugin-clipboard'
import {
  registerBpmnShapes,
  getShapeLabel,
  setupBoundaryAttach,
  isBoundaryShape,
  attachBoundaryToHost,
  distanceToRectEdge,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_GROUP,
  BPMN_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_SEQUENCE_FLOW,
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_CALL_ACTIVITY,
} from '@x6-bpmn2/plugin'
import { useSmartEngineSingleton } from '../composables/useSmartEngine'

const emit = defineEmits<{
  graphReady: [graph: Graph]
}>()

const containerRef = ref<HTMLDivElement>()
const {
  bind,
  selectedMode,
  createValidateConnection,
} = useSmartEngineSingleton()

let graph: Graph | null = null
let resizeObserver: ResizeObserver | null = null

const CONTAINER_SHAPES = new Set([
  BPMN_POOL, BPMN_LANE, BPMN_GROUP,
  BPMN_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS, BPMN_AD_HOC_SUB_PROCESS,
])

const ACTIVITY_SHAPES = new Set([
  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK, BPMN_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS, BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
])

const currentEdgeType = ref(BPMN_SEQUENCE_FLOW)

registerBpmnShapes()

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
      router: { name: 'manhattan', args: { padding: 20 } },
      connector: { name: 'rounded', args: { radius: 8 } },
      createEdge() {
        return graph!.createEdge({ shape: currentEdgeType.value })
      },
      validateConnection(...args: any[]) {
        const fn = createValidateConnection(() => currentEdgeType.value)
        if (fn) return fn.apply(this, args as any)
        return true
      },
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: { attrs: { fill: '#fff', stroke: '#0fc6c2', strokeWidth: 4 } },
      },
    },
    embedding: {
      enabled: true,
      findParent({ node }) {
        const bbox = node.getBBox()
        return this.getNodes().filter((n) => {
          if (n.id === node.id) return false
          if (!CONTAINER_SHAPES.has(n.shape as string)) return false
          return n.getBBox().containsRect(bbox)
        })
      },
    },
    interacting: (view) => ({
      nodeMovable: view.cell.shape !== BPMN_POOL,
      magnetConnectable: true,
    }),
  })

  graph.use(new Selection({
    enabled: true,
    multiple: true,
    rubberband: true,
    movable: true,
    showNodeSelectionBox: true,
    showEdgeSelectionBox: true,
  }))
  graph.use(new Transform({ resizing: { enabled: true, minWidth: 40, minHeight: 40 }, rotating: false }))
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

  setupBoundaryAttach(graph)

  graph.on('node:added', ({ node }) => {
    if (isBoundaryShape(node.shape)) {
      for (const host of graph!.getNodes()) {
        if (host.id === node.id || !ACTIVITY_SHAPES.has(host.shape as string)) continue
        const hostBBox = host.getBBox()
        const center = node.getBBox().center
        const dist = distanceToRectEdge(
          { x: center.x, y: center.y },
          { x: hostBBox.x, y: hostBBox.y, width: hostBBox.width, height: hostBBox.height },
        )
        if (dist < 40) {
          attachBoundaryToHost(graph!, node, host)
          break
        }
      }
    }
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

  // 拖放支持
  container.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  })
  container.addEventListener('drop', (e) => {
    e.preventDefault()
    const shape = e.dataTransfer?.getData('bpmn/shape')
    if (!shape || !graph) return
    const point = graph.clientToLocal({ x: e.clientX, y: e.clientY })
    const isGateway = shape.includes('gateway')
    const isEvent = shape.includes('event') || shape.includes('boundary')
    const nodeW = isGateway ? 50 : isEvent ? 36 : 100
    const nodeH = isGateway ? 50 : isEvent ? 36 : 60
    const label = getShapeLabel(shape)
    const newNode = graph.addNode({
      shape,
      x: point.x - nodeW / 2,
      y: point.y - nodeH / 2,
      width: nodeW,
      height: nodeH,
      attrs: { label: { text: label } },
      data: { label },
    })
    // 边界事件自动吸附
    if (isBoundaryShape(shape)) {
      const center = { x: point.x, y: point.y }
      const host = graph.getNodes().find((n) => {
        if (!ACTIVITY_SHAPES.has(n.shape as string) || n.id === newNode.id) return false
        return distanceToRectEdge(center, n.getBBox()) < 30
      })
      if (host) attachBoundaryToHost(graph, newNode, host)
    }
  })

  resizeObserver = new ResizeObserver(() => {
    if (graph && container) graph.resize(container.offsetWidth, container.offsetHeight)
  })
  resizeObserver.observe(container)

  // 绑定 SmartEngine 方言
  bind(graph)

  emit('graphReady', graph)
})

onUnmounted(() => {
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
