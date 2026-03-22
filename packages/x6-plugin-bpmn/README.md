# @x6-bpmn2/plugin

基于 [AntV X6](https://x6.antv.antgroup.com/) 的 **BPMN 2.0 完整图形插件**。

一行代码注册全部 BPMN 2.0 图形（事件 / 活动 / 网关 / 数据元素 / 工件 / 泳道 / 连接线），并内置 XML 导入导出，开箱即用。

---

## 特性

- **78+ BPMN 图形**：覆盖 BPMN 2.0 规范中全部节点和连接线类型
- **XML 导入导出**：基于 `bpmn-moddle`，支持 BPMN 2.0 标准 XML 的双向转换
- **边界事件吸附**：内置 `setupBoundaryAttach` 行为，拖放自动吸附、边框约束、宿主 resize 联动
- **表单数据管理**：内置 `BpmnFormData` 接口和 `loadBpmnFormData` / `saveBpmnFormData` 工具
- **中文标签**：所有图形预置中文显示名称（`SHAPE_LABELS`）
- **可选注册**：通过 `BpmnPluginOptions` 按类别开关图形注册
- **TypeScript 优先**：完整类型定义，100% TypeScript 编写

## 安装

```bash
npm install @x6-bpmn2/plugin @antv/x6
# 或
pnpm add @x6-bpmn2/plugin @antv/x6
```

> `@antv/x6` 为 peer dependency，需要 `>=2.0.0`。

## 快速开始

```ts
import { Graph } from '@antv/x6'
import { registerBpmnShapes } from '@x6-bpmn2/plugin'

// 1. 注册所有 BPMN 图形（仅需调用一次）
registerBpmnShapes()

// 2. 创建画布
const graph = new Graph({
  container: document.getElementById('container')!,
  width: 1000,
  height: 600,
})

// 3. 使用 BPMN 图形
graph.addNode({ shape: 'bpmn-start-event', x: 100, y: 200 })
graph.addNode({ shape: 'bpmn-user-task', x: 300, y: 180, attrs: { label: { text: '审批' } } })
graph.addEdge({ shape: 'bpmn-sequence-flow', source: 'node1', target: 'node2' })
```

## 按需注册

```ts
registerBpmnShapes({
  events: true,       // 事件（开始 / 中间 / 结束 / 边界）
  activities: true,   // 活动（任务 / 子流程 / 调用活动）
  gateways: true,     // 网关
  data: true,         // 数据元素
  artifacts: true,    // 工件（文本注释 / 分组）
  swimlanes: true,    // 泳道（池 / 泳道）
  connections: true,  // 连接线（顺序流 / 消息流 / 关联）
})
```

## XML 导入导出

```ts
import { exportBpmnXml, importBpmnXml } from '@x6-bpmn2/plugin'

// 导出为 BPMN 2.0 XML
const xml = await exportBpmnXml(graph, {
  processId: 'Process_1',
  processName: '审批流程',
})

// 从 XML 导入
await importBpmnXml(graph, xml, {
  clearGraph: true,   // 导入前清空画布
  zoomToFit: true,    // 导入后自适应缩放
})
```

## 表单数据管理

```ts
import {
  classifyShape,
  loadBpmnFormData,
  saveBpmnFormData,
  getShapeLabel,
} from '@x6-bpmn2/plugin'

// 获取图形中文名
getShapeLabel('bpmn-user-task') // → '用户任务'

// 分类图形
classifyShape('bpmn-user-task') // → 'userTask'

// 从节点加载表单数据
const formData = loadBpmnFormData(selectedNode)

// 保存表单数据
const bpmn = saveBpmnFormData('userTask', formData)
selectedNode.setData({ bpmn })
```

## 边界事件吸附行为

`setupBoundaryAttach` 为 X6 画布补充 BPMN 边界事件的吸附交互，复用 X6 内置的父子关系（子节点跟随移动、级联删除），仅新增 X6 不提供的三个 BPMN 特有逻辑：

| 行为 | 说明 |
|------|------|
| 拖放吸附 | 边界事件落在 Activity 边框 30px 内时自动 snap 到边框并建立父子关系 |
| 边框约束 | 已吸附的边界事件拖拽时只能沿宿主边框滑动 |
| 宿主 resize | 宿主尺寸变化后按存储的 `side + ratio` 重新定位边界事件 |

```ts
import { setupBoundaryAttach, attachBoundaryToHost } from '@x6-bpmn2/plugin'

// 安装行为（在 graph 初始化后调用）
const dispose = setupBoundaryAttach(graph, {
  snapDistance: 30,     // 吸附阈值（px），默认 30
  detachDistance: 60,   // 脱离阈值（px），默认 60；设为 Infinity 禁止脱离
  constrainToEdge: true // 拖拽时约束在边框上，默认 true
})

// 程序化附着（导入流程 / 初始化示例数据时使用）
const timerEvent = graph.addNode({ shape: BPMN_BOUNDARY_EVENT_TIMER, ... })
attachBoundaryToHost(graph, timerEvent, userTaskNode)

// 组件卸载时清理
dispose()
```

**数据模型**：吸附后 `node.getData().bpmn` 自动写入：

```ts
{
  bpmn: {
    attachedToRef: 'hostNodeId',
    boundaryPosition: { side: 'bottom', ratio: 0.75 } // 边 + 在该边的位置比例 [0,1]
  }
}
```

## 图形名称常量

所有图形名称以 `BPMN_*` 常量导出，避免硬编码字符串：

```ts
import {
  BPMN_START_EVENT,
  BPMN_USER_TASK,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_SEQUENCE_FLOW,
  // ... 78+ 常量
} from '@x6-bpmn2/plugin'
```

## 支持的 BPMN 元素

### 事件（48 种变体）

| 类别 | 类型 |
|------|------|
| 开始事件 | 无、消息、定时、条件、信号、多重、并行多重 |
| 中间抛出事件 | 无、消息、升级、链接、补偿、信号、多重 |
| 中间捕获事件 | 无、消息、定时、升级、条件、链接、错误、取消、补偿、信号、多重、并行多重 |
| 边界事件 | 无、消息、定时、升级、条件、错误、取消、补偿、信号、多重、并行多重、非中断 |
| 结束事件 | 无、消息、升级、错误、取消、补偿、信号、终止、多重 |

### 活动（13 种）

任务、用户任务、服务任务、脚本任务、业务规则任务、发送任务、接收任务、手工任务、子流程、事件子流程、事务、自由子流程、调用活动

### 网关（6 种）

排他网关、并行网关、包容网关、复杂网关、事件网关、排他事件网关

### 数据元素（4 种）

数据对象、数据输入、数据输出、数据存储

### 工件（2 种）

文本注释、分组

### 泳道（2 种）

池、泳道

### 连接线（7 种）

顺序流、条件流、默认流、消息流、关联、定向关联、数据关联

## 项目结构

```
src/
├── index.ts              # 插件入口，统一注册和导出
├── utils/
│   ├── constants.ts      # 图形名称常量、颜色、图标、类型定义
│   └── index.ts          # 工具模块入口
├── shapes/
│   ├── shared.ts         # 共享配置（端口、标签样式）
│   ├── activities.ts     # 任务和子流程图形
│   ├── events.ts         # 事件图形（48 种变体）
│   ├── gateways.ts       # 网关图形
│   ├── data.ts           # 数据元素图形
│   ├── artifacts.ts      # 工件图形
│   ├── swimlanes.ts      # 泳道图形
│   └── index.ts          # 图形模块入口
├── connections/
│   └── index.ts          # 连接线图形（7 种）
├── config/
│   └── index.ts          # 中文标签、分类、表单数据管理
├── export/
│   ├── exporter.ts       # X6 Graph → BPMN 2.0 XML
│   ├── importer.ts       # BPMN 2.0 XML → X6 Graph
│   ├── bpmn-mapping.ts   # 图形 ↔ BPMN 标签映射表
│   ├── bpmn-moddle.d.ts  # bpmn-moddle 类型声明
│   └── index.ts          # 导出模块入口
├── behaviors/
│   ├── boundary-attach.ts # 边界事件吸附行为（snap / 约束 / resize 联动）
│   ├── geometry.ts        # 几何工具（snapToRectEdge / boundaryPositionToPoint）
│   └── index.ts           # 行为模块入口
└── layout/
    └── index.ts          # 布局（预留）
```

## API 参考

### `registerBpmnShapes(options?)`

注册所有 BPMN 2.0 图形。多次调用安全，图形仅注册一次。

### `forceRegisterBpmnShapes(options?)`

强制重新注册（适用于 HMR / 开发场景）。

### `exportBpmnXml(graph, options?)`

将 X6 图形导出为 BPMN 2.0 XML 字符串。返回 `Promise<string>`。

### `importBpmnXml(graph, xml, options?)`

将 BPMN 2.0 XML 导入到 X6 图形。返回 `Promise<void>`。

### `classifyShape(shapeName)`

根据图形名称返回 BPMN 元素分类（`ShapeCategory`）。

### `getShapeLabel(shapeName)`

获取图形的中文显示标签。

### `loadBpmnFormData(cell)`

从单元格加载 BPMN 表单数据。

### `saveBpmnFormData(category, formData, shapeName?)`

构建要持久化的 BPMN 数据对象。

### `NODE_MAPPING` / `EDGE_MAPPING`

图形名称到 BPMN XML 标签的映射表。

### `setupBoundaryAttach(graph, options?)`

安装边界事件吸附行为。返回 `dispose()` 函数用于卸载。

### `attachBoundaryToHost(graph, boundary, host)`

程序化将边界事件节点吸附到宿主节点（snap 位置 + 建立父子关系 + 持久化位置比例）。

### `snapToRectEdge(point, rect)`

计算平面点到矩形边框最近点，返回 `{ point, side, ratio, distance }`。

### `boundaryPositionToPoint(pos, rect)`

将 `BoundaryPosition`（`side + ratio`）还原为矩形边框上的绝对坐标。

### `distanceToRectEdge(point, rect)`

返回点到矩形边框的最短距离（内外均适用）。

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听变更）
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage
```

## 许可

MIT
