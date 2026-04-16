<template>
  <div class="graph-canvas">
    <div ref="graphContainerRef" class="graph-container" data-testid="graph-container"></div>
    <div ref="minimapRef" class="minimap-container"></div>

    <!-- Pool 右侧悬浮菜单（参照 bpmn.js 交互：点选 Pool 后显示添加 Lane 按钮） -->
    <div
      v-if="poolMenuVisible"
      class="pool-float-menu"
      :style="{ top: poolMenuPos.y + 'px', left: poolMenuPos.x + 'px' }"
    >
      <button class="pool-menu-btn" title="添加泳道" @click="onAddLane">
        <svg viewBox="0 0 20 20" width="18" height="18">
          <rect x="1" y="1" width="18" height="18" rx="2" fill="#fff" stroke="#1890ff" stroke-width="1.5"/>
          <line x1="10" y1="5" x2="10" y2="15" stroke="#1890ff" stroke-width="2"/>
          <line x1="5" y1="10" x2="15" y2="10" stroke="#1890ff" stroke-width="2"/>
        </svg>
        <span>添加泳道</span>
      </button>
    </div>

    <!-- 连线类型浮动选择器 -->
    <div class="edge-type-panel">
      <div class="edge-type-title">连线类型</div>
      <div class="edge-type-list">
        <div
          v-for="opt in EDGE_TYPE_OPTIONS"
          :key="opt.value"
          class="edge-type-item"
          :class="{ active: opt.value === currentEdgeType }"
          :title="opt.desc"
          @click="currentEdgeType = opt.value"
        >
          <svg
            class="edge-type-icon"
            viewBox="0 0 32 12"
            width="32"
            height="12"
            v-html="opt.svg"
          />
          <span class="edge-type-label">{{ opt.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from "vue";
import { Graph, type Node } from "@antv/x6";
import { Message } from "@arco-design/web-vue";
import { Selection } from "@antv/x6/lib/plugin/selection";
import { Transform } from "@antv/x6/lib/plugin/transform";
import { Snapline } from "@antv/x6/lib/plugin/snapline";
import { Keyboard } from "@antv/x6/lib/plugin/keyboard";
import { Clipboard } from "@antv/x6/lib/plugin/clipboard";
import { History } from "@antv/x6/lib/plugin/history";
import { MiniMap } from "@antv/x6/lib/plugin/minimap";
import {
  getShapeLabel,
  buildBpmnNodeDefaults,
  registerBpmnShapes,
  setupBpmnGraph,
  attachBoundaryToHost,
  isBoundaryShape,
  findBoundaryAttachHost,
  findContainingBpmnParent,
  resolveBpmnEmbeddingTargets,
  isContainedFlowNode,
  addLaneToPool,
  isPoolShape,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_GROUP,
} from "@x6-bpmn2/plugin";
import { currentEdgeType, EDGE_TYPE_OPTIONS } from "../composables/useEdgeType";
import { createSampleProcess } from "../sample-process";
import { exportStandardBpmnXml, importExampleBpmnXml } from "../bpmn-xml";

const emit = defineEmits<{
  graphReady: [graph: Graph];
}>();

const graphContainerRef = ref<HTMLDivElement>();
const minimapRef = ref<HTMLDivElement>();

declare global {
  interface Window {
    __x6BpmnExampleGraph?: Graph;
    __x6BpmnExampleReady?: boolean;
    __x6BpmnExampleApi?: {
      exportXml: () => Promise<string>;
      importXml: (xml: string) => Promise<void>;
      getSelectedCellIds: () => string[];
      isReady: () => boolean;
    };
  }
}

let graph: Graph | null = null;
let resizeObserver: ResizeObserver | null = null;
let disposeBpmnBehaviors: (() => void) | null = null;

// ==================== Pool 右侧悬浮菜单状态 ====================
const poolMenuVisible = ref(false);
const poolMenuPos = reactive({ x: 0, y: 0 });
let selectedPoolNode: Node | null = null;

function updatePoolMenu() {
  if (!graph || !selectedPoolNode) {
    poolMenuVisible.value = false;
    return;
  }
  const bbox = selectedPoolNode.getBBox();
  const graphRect = graph.localToClient({ x: bbox.x + bbox.width, y: bbox.y });
  poolMenuPos.x = graphRect.x + 8;
  poolMenuPos.y = graphRect.y;
  poolMenuVisible.value = true;
}

function hidePoolMenu() {
  poolMenuVisible.value = false;
  selectedPoolNode = null;
}

function onAddLane() {
  if (!graph || !selectedPoolNode) return;
  const lane = addLaneToPool(graph, selectedPoolNode, { label: '泳道' });
  if (!lane) {
    Message.warning('无法添加泳道');
    return;
  }
  updatePoolMenu();
}

function parseDroppedShape(event: DragEvent): { shape: string; label?: string; width?: number; height?: number } | null {
  const raw = event.dataTransfer?.getData("application/bpmn-shape");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { shape?: string; label?: string; width?: number; height?: number };
    if (!parsed.shape) return null;

    return {
      shape: parsed.shape,
      label: parsed.label,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return null;
  }
}

onMounted(async () => {
  await nextTick();
  if (typeof window !== "undefined") {
    window.__x6BpmnExampleReady = false;
  }

  // 先注册 BPMN 图形，确保示例初始化时 addNode/addEdge 可直接识别各类 shape。
  registerBpmnShapes();

  const container = graphContainerRef.value!;
  const minimapContainer = minimapRef.value!;

  // Ensure container has dimensions
  const width = container.offsetWidth || container.clientWidth || 800;
  const height = container.offsetHeight || container.clientHeight || 600;

  graph = new Graph({
    container,
    width,
    height,
    grid: {
      visible: true,
      type: "doubleMesh",
      args: [
        { color: "#eee", thickness: 1 },
        { color: "#ddd", thickness: 1, factor: 4 },
      ],
    },
    panning: {
      enabled: true,
      modifiers: "shift",
    },
    mousewheel: {
      enabled: true,
      modifiers: ["ctrl", "meta"],
      zoomAtMousePosition: true,
      minScale: 0.2,
      maxScale: 3,
    },
    connecting: {
      snap: true,
      allowBlank: false,
      allowLoop: false,
      highlight: true,
      router: {
        name: "orth",
        args: { padding: 20 },
      },
      connector: {
        name: "rounded",
        args: { radius: 8 },
      },
    },
    highlighting: {
      magnetAdsorbed: {
        name: "stroke",
        args: { attrs: { fill: "#5F95FF", stroke: "#5F95FF" } },
      },
    },
    interacting: {
      edgeLabelMovable: true,
    },
    embedding: {
      enabled: true,
      findParent({ node }) {
        return resolveBpmnEmbeddingTargets(this, node);
      },
    },
  });

  // Plugins
  graph.use(
    new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      movable: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: true,
      rubberEdge: true,
    }),
  );
  graph.use(
    new Transform({
      resizing: { enabled: true },
      rotating: { enabled: false },
    }),
  );
  graph.use(new Snapline({ enabled: true }));
  graph.use(new Keyboard({ enabled: true, global: true }));
  graph.use(new Clipboard({ enabled: true }));
  graph.use(new History({ enabled: true }));
  graph.use(
    new MiniMap({
      container: minimapContainer,
      width: 200,
      height: 130,
      padding: 10,
    }),
  );

  // Keyboard shortcuts
  graph.bindKey(["backspace", "delete"], () => {
    const cells = graph!.getSelectedCells();
    if (cells.length) graph!.removeCells(cells);
    return false;
  });
  graph.bindKey("meta+z", () => {
    graph!.undo();
    return false;
  });
  graph.bindKey("meta+shift+z", () => {
    graph!.redo();
    return false;
  });
  graph.bindKey("meta+c", () => {
    graph!.copy(graph!.getSelectedCells());
    return false;
  });
  graph.bindKey("meta+v", () => {
    graph!.paste({ offset: 32 });
    return false;
  });
  graph.bindKey("meta+a", () => {
    graph!.select(graph!.getCells());
    return false;
  });

  // Drop handler for stencil
  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  });
  container.addEventListener("drop", (e) => {
    e.preventDefault();
    const payload = parseDroppedShape(e);
    if (!payload || !graph) return;
    const { shape } = payload;
    const point = graph.clientToLocal(e.clientX, e.clientY);
    const { width: w, height: h, attrs, data } = buildBpmnNodeDefaults(shape, {
      label: payload.label || getShapeLabel(shape),
      width: payload.width,
      height: payload.height,
    });
    const label = payload.label || getShapeLabel(shape);
    const draftNode = graph.createNode({
      shape,
      x: point.x - w / 2,
      y: point.y - h / 2,
      width: w,
      height: h,
      attrs,
      data,
    });
    const hasPoolNodes = graph.getNodes().some((candidate) => isPoolShape(candidate.shape));

    if (isBoundaryShape(shape)) {
      const host = findBoundaryAttachHost(graph, draftNode);
      if (!host) {
        Message.warning("边界事件必须附着到活动边框上");
        return;
      }

      const newNode = graph.addNode(draftNode);
      attachBoundaryToHost(graph, newNode, host);
      return;
    }

    const parent = findContainingBpmnParent(graph, draftNode);
    if (shape === BPMN_LANE && !parent) {
      Message.warning("Lane 必须放置在 Pool 内");
      return;
    }

    if (isContainedFlowNode(shape) && hasPoolNodes && !parent) {
      Message.warning("流程节点必须位于 Pool 或 Lane 容器内");
      return;
    }

    const newNode = graph.addNode(draftNode);
    if (parent) {
      parent.embed(newNode);
    }
  });

  // Resize observer for reliable dimension tracking
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) {
        graph?.resize(w, h);
      }
    }
  });
  resizeObserver.observe(container);

  // Edge tools: show vertices/segments handles on hover for path editing
  graph.on("edge:mouseenter", ({ edge }) => {
    if (!edge.hasTools()) {
      edge.addTools([
        {
          name: "vertices",
          args: {
            attrs: {
              r: 4,
              fill: "#333",
              stroke: "#fff",
              strokeWidth: 2,
              cursor: "move",
            },
          },
        },
        {
          name: "segments",
          args: {
            attrs: {
              width: 10,
              height: 8,
              x: -5,
              y: -4,
              fill: "#333",
              stroke: "#fff",
              strokeWidth: 2,
              cursor: "pointer",
            },
          },
        },
        {
          name: "source-arrowhead",
          args: {
            attrs: {
              d: "M 0, -5 a 5,5,0,1,1,0,10 a 5,5,0,1,1,0,-10",
              fill: "#333",
              stroke: "#fff",
              "stroke-width": 1,
              cursor: "move",
            },
          },
        },
        {
          name: "target-arrowhead",
          args: {
            attrs: {
              d: "M -6, -8 L 0,0 L -6, 8 Z",
              fill: "#333",
              stroke: "#fff",
              "stroke-width": 1,
              cursor: "move",
            },
          },
        },
      ]);
    }
  });
  graph.on("edge:mouseleave", ({ edge }) => {
    // Keep tools if edge is selected
    if (!graph!.isSelected(edge)) {
      edge.removeTools();
    }
  });
  // Keep tools visible while edge is selected
  graph.on("edge:selected", ({ edge }) => {
    if (!edge.hasTools()) {
      edge.addTools([
        {
          name: "vertices",
          args: {
            attrs: {
              r: 4,
              fill: "#333",
              stroke: "#fff",
              strokeWidth: 2,
              cursor: "move",
            },
          },
        },
        {
          name: "segments",
          args: {
            attrs: {
              width: 10,
              height: 8,
              x: -5,
              y: -4,
              fill: "#333",
              stroke: "#fff",
              strokeWidth: 2,
              cursor: "pointer",
            },
          },
        },
        {
          name: "source-arrowhead",
          args: {
            attrs: {
              d: "M 0, -5 a 5,5,0,1,1,0,10 a 5,5,0,1,1,0,-10",
              fill: "#333",
              stroke: "#fff",
              "stroke-width": 1,
              cursor: "move",
            },
          },
        },
        {
          name: "target-arrowhead",
          args: {
            attrs: {
              d: "M -6, -8 L 0,0 L -6, 8 Z",
              fill: "#333",
              stroke: "#fff",
              "stroke-width": 1,
              cursor: "move",
            },
          },
        },
      ]);
    }
  });
  graph.on("edge:unselected", ({ edge }) => {
    edge.removeTools();
  });

  // Pool 选中时显示右侧悬浮菜单（添加泳道按钮）
  graph.on("node:selected", ({ node }) => {
    if (node.shape === BPMN_POOL) {
      selectedPoolNode = node;
      updatePoolMenu();
    }
  });
  graph.on("node:unselected", ({ node }) => {
    if (node.shape === BPMN_POOL && selectedPoolNode?.id === node.id) {
      hidePoolMenu();
    }
  });
  // 拖拽或缩放画布时更新菜单位置
  graph.on("translate", () => updatePoolMenu());
  graph.on("scale", () => updatePoolMenu());
  // Pool 大小变化时更新菜单位置
  graph.on("node:change:size", ({ node }) => {
    if (node.shape === BPMN_POOL && selectedPoolNode?.id === node.id) {
      updatePoolMenu();
    }
  });
  graph.on("node:change:position", ({ node }) => {
    if (node.shape === BPMN_POOL && selectedPoolNode?.id === node.id) {
      updatePoolMenu();
    }
  });

  // 加载默认示例流程
  createSampleProcess(graph);

  // 安装 BPMN 行为与校验器。
  // 延后到示例流程创建完成之后，避免初始化批量加点时触发容器误报。
  disposeBpmnBehaviors = setupBpmnGraph(graph, {
    edgeShape: () => currentEdgeType.value,
    validate: {
      onValidationError(result: { reason?: string }) {
        if (result.reason) {
            console.log(result)
          Message.warning(result.reason);
        }
      },
    },
    behaviors: {
      poolContainment: {
        onViolation(_node, reason: string) {
          if (reason) {
            Message.warning(reason);
          }
        },
      },
    },
  });

  const markReady = () => {
    graph?.zoomToFit({ padding: 40, maxScale: 1 });
    if (typeof window !== "undefined") {
      window.__x6BpmnExampleReady = true;
    }
  };

  setTimeout(markReady, 200);

  emit("graphReady", graph);

  if (typeof window !== "undefined") {
    window.__x6BpmnExampleGraph = graph;
    window.__x6BpmnExampleApi = {
      exportXml: () => exportStandardBpmnXml(graph!, { processName: "示例流程" }),
      importXml: (xml: string) => importExampleBpmnXml(graph!, xml),
      getSelectedCellIds: () => graph!.getSelectedCells().map((cell) => cell.id),
      isReady: () => Boolean(window.__x6BpmnExampleReady),
    };
  }
});

onUnmounted(() => {
  disposeBpmnBehaviors?.();
  disposeBpmnBehaviors = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (typeof window !== "undefined" && window.__x6BpmnExampleGraph === graph) {
    delete window.__x6BpmnExampleGraph;
    delete window.__x6BpmnExampleReady;
    delete window.__x6BpmnExampleApi;
  }
  graph?.dispose();
  graph = null;
});
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

.minimap-container {
  position: absolute;
  bottom: 12px;
  right: 12px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

/* 连线类型浮动选择面板 */
.edge-type-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #fff;
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 6px 0;
  z-index: 10;
  user-select: none;
  min-width: 120px;
}

.edge-type-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  padding: 2px 10px 4px;
  border-bottom: 1px solid var(--color-border-1);
  margin-bottom: 2px;
}

.edge-type-list {
  display: flex;
  flex-direction: column;
}

.edge-type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 12px;
  color: var(--color-text-2);
}

.edge-type-item:hover {
  background: var(--color-fill-2);
}

.edge-type-item.active {
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
  font-weight: 500;
}

.edge-type-icon {
  flex-shrink: 0;
}

.edge-type-label {
  white-space: nowrap;
}

/* Pool 右侧悬浮菜单 */
.pool-float-menu {
  position: fixed;
  z-index: 100;
  background: #fff;
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px;
  user-select: none;
}

.pool-menu-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-2);
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.pool-menu-btn:hover {
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
}
</style>
