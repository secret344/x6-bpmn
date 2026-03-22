# BPMN 2.0 插件局部定制指南

> 在 `@x6-bpmn2/plugin` 标准 74 节点 + 7 连线的基础上，**只改你需要的部分**，其余全部复用。

---

## 目录

1. [核心思路](#1-核心思路)
2. [最简定制：改外观](#2-最简定制改外观)
3. [局部定制：加几个业务节点](#3-局部定制加几个业务节点)
4. [用 Vue 组件渲染节点内容](#4-用-vue-组件渲染节点内容)
5. [让自定义节点支持 XML 导出](#5-让自定义节点支持-xml-导出)
6. [给自定义节点加配置表单](#6-给自定义节点加配置表单)
7. [完整示例：审批任务](#7-完整示例审批任务)
8. [注意事项](#8-注意事项)

---

## 1. 核心思路

插件已注册了 **74 节点 + 7 连线**，覆盖 BPMN 2.0 全部标准元素。定制时**不需要重来一遍**，只需：

```typescript
import { registerBpmnShapes } from '@x6-bpmn2/plugin'

// 第一步：照常注册所有标准节点（一行搞定）
registerBpmnShapes()

// 第二步：只对你需要的几个做定制
// ... 下面按需求选一种方式 ...
```

**你不碰的节点 = 零改动。** 选择下面最适合你场景的一种方式即可。

---

## 2. 最简定制：改外观

> 场景：某个标准节点的颜色/图标/尺寸不满意，想换成企业风格。

在 `registerBpmnShapes()` **之后**，用同名重新注册并传 `true` 即可覆盖：

```typescript
import { Graph } from '@antv/x6'
import { registerBpmnShapes, BPMN_USER_TASK } from '@x6-bpmn2/plugin'

registerBpmnShapes()

// 只覆盖用户任务的外观，其余 73 个节点不动
Graph.registerNode(BPMN_USER_TASK, {
  inherit: 'rect',
  width: 120,
  height: 70,
  attrs: {
    body: { fill: '#e8f0fe', stroke: '#1a73e8', strokeWidth: 2, rx: 12, ry: 12, refWidth: '100%', refHeight: '100%' },
    label: { textAnchor: 'middle', textVerticalAnchor: 'middle', refX: '50%', refY: '50%', fontSize: 13, fill: '#333' },
  },
  // ports 保持标准 4 端口即可
  ports: {
    groups: {
      top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
    },
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
  },
}, true)  // ← true = 覆盖
```

**改动量：1 处。**  
shape 名没变 → 导出/导入映射自动生效，无需改其他任何东西。

---

## 3. 局部定制：加几个业务节点

> 场景：标准节点不够用，需要加 1~2 个业务专属节点（如"审批任务"）。

### 3.1 注册新 shape（必做）

```typescript
import { Graph } from '@antv/x6'

export const MY_APPROVAL_TASK = 'bpmn-approval-task'

Graph.registerNode(MY_APPROVAL_TASK, {
  inherit: 'rect',
  width: 120, height: 70,
  attrs: {
    body: { fill: '#fff8e1', stroke: '#ff8f00', strokeWidth: 2, rx: 8, ry: 8, refWidth: '100%', refHeight: '100%' },
    label: { textAnchor: 'middle', textVerticalAnchor: 'middle', refX: '50%', refY: '50%', fontSize: 13, fill: '#333', text: '审批' },
  },
  ports: {
    groups: {
      top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
    },
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
  },
}, true)
```

现在就可以在画布上使用 `graph.addNode({ shape: 'bpmn-approval-task' })` 了。

### 3.2 放到 Stencil 面板（可选）

在 `StencilPanel.vue` 的分组数组里加一项即可：

```typescript
stencil.load([
  { shape: MY_APPROVAL_TASK, label: '审批任务' },
], '自定义任务')
```

**不做这步也没关系**，只是左侧拖拽面板里看不到，仍然可以通过代码/导入添加。

---

## 4. 用 Vue 组件渲染节点内容

> 场景：SVG 图标不够用，想用 Vue 组件（Arco Design 图标、自定义组件等）来渲染节点。

### 4.1 安装依赖

```bash
npm install @antv/x6-vue-shape
```

### 4.2 写一个节点 Vue 组件

```vue
<!-- ApprovalNode.vue -->
<template>
  <div class="approval-node" :class="{ selected: isSelected }">
    <div class="node-icon">
      <icon-check-circle-fill :size="24" />
    </div>
    <div class="node-label">{{ label }}</div>
    <div class="node-badge">{{ assignee || '未指定' }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { IconCheckCircleFill } from '@arco-design/web-vue/es/icon'
import type { Node } from '@antv/x6'

// X6 注入当前节点实例
const getNode = inject<() => Node>('getNode')!
const node = getNode()

const label = ref(node.getAttrs()?.label?.text || '审批')
const assignee = ref(node.getData()?.bpmn?.approver || '')
const isSelected = ref(false)

onMounted(() => {
  // 监听节点数据变化，自动更新显示
  node.on('change:data', ({ current }) => {
    assignee.value = current?.bpmn?.approver || ''
  })
  node.on('change:attrs', ({ current }) => {
    label.value = current?.label?.text || '审批'
  })
  // 选中态
  node.on('selected', () => (isSelected.value = true))
  node.on('unselected', () => (isSelected.value = false))
})
</script>

<style scoped>
.approval-node {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff8e1;
  border: 2px solid #ff8f00;
  border-radius: 8px;
  font-size: 13px;
  cursor: default;
  user-select: none;
}
.approval-node.selected {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
.node-icon {
  color: #ff8f00;
  margin-bottom: 2px;
}
.node-label {
  font-weight: 500;
  color: #333;
}
.node-badge {
  font-size: 11px;
  color: #999;
}
</style>
```

### 4.3 注册为 X6 节点

```typescript
import { register } from '@antv/x6-vue-shape'
import ApprovalNode from './ApprovalNode.vue'

export const MY_APPROVAL_TASK = 'bpmn-approval-task'

register({
  shape: MY_APPROVAL_TASK,
  width: 120,
  height: 70,
  component: ApprovalNode,
  // 端口仍然使用 X6 原生配置
  ports: {
    groups: {
      top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
    },
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
  },
})
```

用法和普通 shape 完全一样：

```typescript
graph.addNode({
  shape: MY_APPROVAL_TASK,
  x: 200, y: 100,
  data: { bpmn: { approver: '张经理' } },
})
```

### 4.4 覆盖标准节点为 Vue 组件

同样可以覆盖已有的标准 BPMN 节点，只需用相同的 shape 名注册：

```typescript
import { register } from '@antv/x6-vue-shape'
import { BPMN_USER_TASK } from '@x6-bpmn2/plugin'
import CustomUserTask from './CustomUserTask.vue'

// 用 Vue 组件替换标准用户任务的渲染
register({
  shape: BPMN_USER_TASK,
  width: 100,
  height: 60,
  component: CustomUserTask,
  ports: { /* ... */ },
  effect: ['data'],  // 当 data 变化时重新渲染组件
})
```

shape 名没变 → 导出/导入映射自动生效。

### 4.5 要点

| 项 | 说明 |
|---|------|
| **获取节点实例** | 组件内通过 `inject('getNode')` 获取当前 `Node` 对象 |
| **响应数据变化** | 监听 `node.on('change:data', ...)` 更新组件状态 |
| **effect 选项** | `register({ effect: ['data'] })` 可自动在 data 变更时触发 Vue 组件重渲染 |
| **端口不受影响** | ports 仍由 X6 SVG 层渲染，Vue 组件只替换节点主体内容 |
| **性能** | Vue 组件节点比纯 SVG 略重，几十个没问题，上百个建议用 SVG |

---

## 5. 让自定义节点支持 XML 导出

> 只有需要导出 BPMN XML 时才需要这一步。不导出 XML 的项目可以跳过。

```typescript
import { NODE_MAPPING } from '@x6-bpmn2/plugin'

// 一行：把自定义 shape 映射到标准 BPMN 标签
NODE_MAPPING[MY_APPROVAL_TASK] = { tag: 'userTask' }
```

映射后导出 XML 时，审批任务会输出为标准 `<bpmn2:userTask>`，Camunda/Flowable 等引擎可以识别。

导入时反向映射自动生效（同一 tag 有多个 shape 时按先注册先匹配）。

---

## 6. 给自定义节点加配置表单

> 只在需要双击编辑弹框时改。如果不需要配置面板，跳过此步。

在 `NodeConfigModal.vue` 中补两处即可：

**① 识别分类：**

```typescript
function classifyShape(s: string): ShapeCategory {
  if (s === 'bpmn-approval-task') return 'approvalTask'
  // ... 原有标准逻辑不动 ...
}
```

**② 加表单片段：**

```vue
<template v-if="shapeCategory === 'approvalTask'">
  <a-form-item label="审批人">
    <a-input v-model="form.approver" />
  </a-form-item>
  <a-form-item label="审批方式">
    <a-select v-model="form.approvalMode">
      <a-option value="sequential">依次审批</a-option>
      <a-option value="parallel">会签</a-option>
    </a-select>
  </a-form-item>
</template>
```

数据存在 `cell.getData().bpmn` 里，和标准节点一致。

---

## 7. 完整示例：审批任务

把上面几步串起来，**整个定制只有一个文件**：

```typescript
// src/custom/approval-task.ts
import { Graph } from '@antv/x6'
import { registerBpmnShapes, NODE_MAPPING } from '@x6-bpmn2/plugin'

export const APPROVAL_TASK = 'bpmn-approval-task'

export function setup() {
  // 1. 注册全部标准节点
  registerBpmnShapes()

  // 2. 注册自定义审批节点
  Graph.registerNode(APPROVAL_TASK, {
    inherit: 'rect',
    width: 120, height: 70,
    attrs: {
      body: { fill: '#fff8e1', stroke: '#ff8f00', strokeWidth: 2, rx: 8, ry: 8, refWidth: '100%', refHeight: '100%' },
      label: { textAnchor: 'middle', textVerticalAnchor: 'middle', refX: '50%', refY: '50%', fontSize: 13, text: '审批' },
    },
    ports: {
      groups: {
        top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
        bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
        left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
        right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#5F95FF', fill: '#fff' } } },
      },
      items: [{ group: 'top' }, { group: 'bottom' }, { group: 'left' }, { group: 'right' }],
    },
  }, true)

  // 3. 映射到标准 BPMN 标签（需要导出 XML 时才加）
  NODE_MAPPING[APPROVAL_TASK] = { tag: 'userTask' }
}
```

在应用入口调用 `setup()` 即可，**其余 74 个标准节点 + 7 条连线零改动**。

---

## 8. 注意事项

| 要点 | 说明 |
|------|------|
| **覆盖用 `true`** | `Graph.registerNode(name, config, true)` 第三个参数必须为 `true` |
| **命名避免冲突** | 新节点不要用已存在的名字（如 `bpmn-user-task`），除非你就是要覆盖它 |
| **映射到标准标签** | 推荐 `userTask` / `serviceTask` / `scriptTask`，保证与 Camunda/Flowable 互操作 |
| **按需递进** | 只改外观 → 不需要 mapping；不导出 XML → 不需要 mapping；不需要配置面板 → 不碰 Modal |
| **不要 fork 源码** | 所有定制都通过"注册后覆盖"实现，保持插件可独立升级 |

### 按需递进速查

```
你的需求是什么？
  ├─ 改某个节点的外观        → 只做第 2 节（1 处改动）
  ├─ 加一个业务节点（SVG）    → 做第 3 节（1 处改动）
  ├─ 用 Vue 组件渲染节点      → 做第 4 节（1 个 .vue + 注册）
  ├─ 业务节点要导出 XML       → 再加第 5 节（+1 行）
  └─ 业务节点要配置弹框       → 再加第 6 节（+2 处改动）
```
