<template>
  <div class="graph-canvas">
    <div ref="graphContainerRef" class="graph-container"></div>
    <div ref="minimapRef" class="minimap-container"></div>

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
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Graph } from "@antv/x6";
import { Selection } from "@antv/x6-plugin-selection";
import { Transform } from "@antv/x6-plugin-transform";
import { Snapline } from "@antv/x6-plugin-snapline";
import { Keyboard } from "@antv/x6-plugin-keyboard";
import { Clipboard } from "@antv/x6-plugin-clipboard";
import { History } from "@antv/x6-plugin-history";
import { MiniMap } from "@antv/x6-plugin-minimap";
import {
  registerBpmnShapes,
  createBpmnValidateConnection,
  setupBoundaryAttach,
  attachBoundaryToHost,
  isBoundaryShape,
  distanceToRectEdge,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_GROUP,
  BPMN_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_CALL_ACTIVITY,
} from "@x6-bpmn2/plugin";
import { currentEdgeType, EDGE_TYPE_OPTIONS } from "../composables/useEdgeType";
import { createSampleProcess } from "../sample-process";

const emit = defineEmits<{
  graphReady: [graph: Graph];
}>();

const graphContainerRef = ref<HTMLDivElement>();
const minimapRef = ref<HTMLDivElement>();

let graph: Graph | null = null;
let resizeObserver: ResizeObserver | null = null;
let disposeBoundaryAttach: (() => void) | null = null;

/** 可作为边界事件宿主的 Activity 图形集合 */
const ACTIVITY_SHAPES = new Set([
  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK, BPMN_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS, BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
]);

/** 可作为容器的图形集合（泳道、子流程等） */
const CONTAINER_SHAPES = new Set([
  BPMN_POOL, BPMN_LANE, BPMN_GROUP,
  BPMN_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_EVENT_SUB_PROCESS, BPMN_AD_HOC_SUB_PROCESS,
]);

registerBpmnShapes();

onMounted(async () => {
  await nextTick();
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
        name: "manhattan",
        args: { padding: 20 },
      },
      connector: {
        name: "rounded",
        args: { radius: 8 },
      },
      createEdge() {
        return graph!.createEdge({ shape: currentEdgeType.value });
      },
      validateConnection: createBpmnValidateConnection(
        () => currentEdgeType.value
      ),
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
        const bbox = node.getBBox();
        const isBE = isBoundaryShape(node.shape);

        // 边界事件：查找边框附近的 Activity 作为宿主
        if (isBE) {
          const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
          return this.getNodes().filter((n) => {
            if (!ACTIVITY_SHAPES.has(n.shape)) return false;
            const targetBBox = n.getBBox();
            const dist = distanceToRectEdge(center, targetBBox);
            return dist < 30;
          });
        }

        // 普通节点：嵌入到容器（泳道、子流程等）
        return this.getNodes().filter((n) => {
          if (!CONTAINER_SHAPES.has(n.shape)) return false;
          return n.getBBox().containsRect(bbox);
        });
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
    const raw = e.dataTransfer!.getData("application/bpmn-shape");
    if (!raw || !graph) return;
    const { shape, width, height, label } = JSON.parse(raw);
    const point = graph.clientToLocal(e.clientX, e.clientY);
    const w =
      width ||
      (shape.includes("gateway")
        ? 50
        : shape.includes("event") || shape.includes("boundary")
          ? 36
          : 100);
    const h =
      height ||
      (shape.includes("gateway")
        ? 50
        : shape.includes("event") || shape.includes("boundary")
          ? 36
          : 60);
    const newNode = graph.addNode({
      shape,
      x: point.x - w / 2,
      y: point.y - h / 2,
      width: w,
      height: h,
      attrs: { label: { text: label } },
    });

    // 如果拖入的是边界事件，自动吸附到最近的 Activity 边框上
    if (isBoundaryShape(shape)) {
      const center = { x: point.x, y: point.y };
      const host = graph.getNodes().find((n) => {
        if (!ACTIVITY_SHAPES.has(n.shape as string) || n.id === newNode.id) return false;
        const bbox = n.getBBox();
        return distanceToRectEdge(center, bbox) < 30;
      });
      if (host) {
        attachBoundaryToHost(graph, newNode, host);
      }
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

  // 安装边界事件吸附行为
  disposeBoundaryAttach = setupBoundaryAttach(graph);

  // 加载示例流程
  createSampleProcess(graph);
  setTimeout(() => graph?.zoomToFit({ padding: 40, maxScale: 1 }), 200);

  emit("graphReady", graph);
});

onUnmounted(() => {
  disposeBoundaryAttach?.();
  disposeBoundaryAttach = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
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
</style>
