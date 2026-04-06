# 宿主扩展指南

Host Extension Guide

## 1. 先选最小扩展路径 / Choose the Smallest Extension Path First

扩展主库时，先判断你要改的到底是哪一层。不要一上来就复制整套 BPMN2 配置，也不要把业务 UI 直接塞回主库。

When extending the plugin, first decide which layer you are actually changing. Do not copy the whole BPMN2 profile by default, and do not push business UI back into the plugin.

| 你的目标 / Your goal | 推荐做法 / Recommended path |
|---|---|
| 只改某个标准节点的外观 | 传统接口：`registerBpmnShapes()` 后重注册同名 shape |
| 新增几个业务节点，但仍沿用 BPMN2 规则与导出语义 | 基于 `bpmn2` 继承自定义 profile |
| 新增字段默认值、字段验证、序列化能力 | 改 profile 的 `dataModel` 与 `serialization` |
| 新增面板、表单、文案、提示 | 放在宿主项目，不放在主库 |
| 新增通用 BPMN 交互限制 | 放到主库的 `rules` 或 `behaviors` |
| 新增只属于某个产品的限制 | 放到宿主项目 |

| Your goal | Recommended path |
|---|---|
| Restyle an existing standard shape | Traditional API: re-register the same shape after `registerBpmnShapes()` |
| Add a few business nodes while keeping BPMN2 rules and export semantics | Extend `bpmn2` with a custom profile |
| Add field defaults, validation, or serialization behavior | Update the profile `dataModel` and `serialization` layers |
| Add panels, forms, wording, or notifications | Keep them in the host app, not in the plugin |
| Add reusable BPMN interaction restrictions | Put them in plugin `rules` or `behaviors` |
| Add restrictions that belong to one product only | Keep them in the host app |

## 2. 路径 A: 只覆盖标准图形 / Path A: Override a Standard Shape Only

如果你只是想换企业配色、尺寸或圆角，不需要动方言系统。

If you only want to change brand colors, size, or corner radius, you do not need the dialect system.

```ts
import { Graph } from '@antv/x6'
import { registerBpmnShapes, BPMN_USER_TASK } from '@x6-bpmn2/plugin'

registerBpmnShapes()

Graph.registerNode(BPMN_USER_TASK, {
  inherit: 'rect',
  width: 132,
  height: 72,
  attrs: {
    body: {
      fill: '#f4fbf3',
      stroke: '#2f7d32',
      strokeWidth: 2,
      rx: 14,
      ry: 14,
      refWidth: '100%',
      refHeight: '100%',
    },
    label: {
      text: '用户任务',
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fill: '#16351a',
      fontSize: 13,
    },
  },
}, true)
```

这条路径的特点是：

Characteristics of this path:

- shape 名不变。
- 现有连接规则不变。
- 现有 XML 映射不变。
- 成本最低，适合局部视觉定制。

- The shape name stays the same.
- Existing connection rules remain unchanged.
- Existing XML mappings remain unchanged.
- It is the cheapest path and fits local visual customization.

## 3. 路径 B: 基于 Profile 扩展业务方言 / Path B: Extend a Business Dialect with Profile

如果你要新增业务节点、字段能力或部分规则，这才是优先路径。

If you need new business nodes, field capability, or partial rule changes, this is the preferred path.

### 3.1 定义增量 Profile / Define an Incremental Profile

```ts
import type { Profile } from '@x6-bpmn2/plugin'

export const approvalFlowProfile: Profile = {
  meta: {
    id: 'approval-flow',
    name: 'Approval Flow',
    parent: 'bpmn2',
  },
  definitions: {
    nodes: {
      'bpmn-approval-task': {
        shape: 'bpmn-approval-task',
        category: 'task',
        renderer: 'task',
        title: '审批任务',
      },
    },
  },
  availability: {
    nodes: {
      'bpmn-approval-task': 'enabled',
    },
  },
  rules: {
    nodeCategories: {
      'bpmn-approval-task': 'task',
    },
  },
  dataModel: {
    fields: {
      approver: {
        scope: 'node',
        defaultValue: '',
        description: '审批人',
        normalize: (value) => String(value ?? ''),
      },
    },
    shapeFields: {
      'bpmn-approval-task': ['approver'],
    },
  },
  serialization: {
    nodeMapping: {
      'bpmn-approval-task': {
        tag: 'userTask',
      },
    },
  },
}
```

这里的关键是“增量覆盖”而不是“复制父级”。因为 `renderer: 'task'` 会继续复用 BPMN2 已有的任务渲染器。

The key here is incremental override rather than copying the parent. `renderer: 'task'` keeps reusing the BPMN2 task renderer that already exists.

### 3.2 注册并绑定 / Register and Bind

```ts
import {
  createProfileRegistry,
  createDialectManager,
  bpmn2Profile,
  createBpmn2ImporterAdapter,
  createBpmn2ExporterAdapter,
} from '@x6-bpmn2/plugin'

const registry = createProfileRegistry()
registry.register(bpmn2Profile)
registry.register(approvalFlowProfile)

const manager = createDialectManager({ registry })
manager.registerImporter(createBpmn2ImporterAdapter())
manager.registerExporter(createBpmn2ExporterAdapter())

manager.bind(graph, 'approval-flow')
```

如果你的扩展仍然遵守 BPMN2 的 XML 语义，通常不需要写新的 importer/exporter；复用 BPMN2 适配器就够了。

If your extension still follows BPMN2 XML semantics, you usually do not need a new importer/exporter. Reusing the BPMN2 adapters is enough.

## 4. 路径 C: 表单与 UI 留在宿主 / Path C: Keep Forms and UI in the Host

主库的 `dataModel` 只表达字段能力，不表达 UI 组件类型、布局或下拉项展示。

The plugin `dataModel` only expresses field capability. It does not define form widgets, layout, or option rendering.

宿主可以基于 `ProfileContext` 拿到字段列表，再自行渲染面板：

The host can read field lists from `ProfileContext` and render its own panel:

```ts
import {
  getFieldsForShape,
  buildDefaultData,
  validateFields,
} from '@x6-bpmn2/plugin'

const fields = getFieldsForShape(shape, category, context.profile.dataModel)
const defaultData = buildDefaultData(fields, context.profile.dataModel)
const failures = validateFields(formData, fields, {
  shape,
  category,
  profileId: context.profile.meta.id,
  nodeData: formData,
}, context.profile.dataModel)
```

建议把 UI 职责拆成两段：

It is useful to split UI responsibility into two parts:

- 主库给出“有哪些字段、默认值是什么、是否合规”。
- 宿主决定“怎么渲染、怎么布局、怎么提示用户”。

- The plugin tells you which fields exist, their defaults, and whether the values are valid.
- The host decides how to render, layout, and communicate them to the user.

## 5. 什么时候需要新适配器 / When You Need a New Adapter

下面这些情况通常意味着你要新增 importer/exporter adapter，而不仅仅是改 profile：

The following cases usually mean you need a new importer/exporter adapter instead of only changing the profile:

- 需要新的 XML 命名空间处理。
- 需要新的 extensionElements 结构。
- 同一个 shape 需要非 BPMN2 标准标签或特殊序列化逻辑。
- 导入阶段需要恢复 BPMN2 基础 importer 不知道的业务数据。

- You need new XML namespace handling.
- You need a new `extensionElements` structure.
- A shape requires non-standard BPMN2 tags or special serialization behavior.
- Import must restore business data that the baseline BPMN2 importer does not understand.

如果只是把一个业务节点映射到标准 `userTask`、`serviceTask`、`exclusiveGateway` 之类的标签，优先先试 profile 的 `serialization` 层。

If you only map a business node to standard tags such as `userTask`, `serviceTask`, or `exclusiveGateway`, try the `serialization` layer in the profile first.

## 6. 什么时候改主库，什么时候改示例 / When to Change the Plugin vs the Demo

一个简单判断标准：

A simple rule of thumb:

- 任何 BPMN 通用行为、可复用方言能力、可复用 XML 语义，改主库。
- 任何页面交互、提示文案、业务流程面板、产品限定规则，改宿主或 demo。

- Change the plugin for reusable BPMN behavior, reusable dialect capability, or reusable XML semantics.
- Change the host or demo for page interaction, copywriting, business panels, or product-specific rules.

例如：

For example:

- Pool/Lane containment 属于主库，因为这是 BPMN 通用交互限制。
- containment 失败后弹什么提示，属于宿主，因为这是页面表达。

- Pool/lane containment belongs in the plugin because it is a reusable BPMN interaction rule.
- The message shown after a containment violation belongs in the host because it is page-level expression.

## 7. 扩展前检查清单 / Extension Checklist

1. 这次变化是视觉覆盖、方言增量，还是 XML 语义变化？
2. 现有 `bpmn2` 或 `smartengine-*` profile 能不能复用，而不是复制？
3. 这次改动是否把 UI 逻辑错误地下沉到了主库？
4. 如果改的是运行时交互，是否优先放在主库行为层，并提供回调给宿主处理提示？
5. 如果改了主库源码，是否补了真实场景测试？

1. Is the change only visual, an incremental dialect change, or an XML semantic change?
2. Can an existing `bpmn2` or `smartengine-*` profile be extended instead of copied?
3. Did any UI logic accidentally leak into the plugin?
4. If the change affects runtime interaction, should it live in plugin behavior code with callbacks for host messaging?
5. If plugin source changed, did you add realistic tests?

## 8. 相关阅读 / Related Reading

- [dynamic-config-architecture.md](dynamic-config-architecture.md)：看 profile、context 和 `DialectManager` 的整体结构。
- [runtime-constraints-design.md](runtime-constraints-design.md)：看交互限制和行为模块应该落在哪一层。
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)：看公开 API 和源码入口。

- [dynamic-config-architecture.md](dynamic-config-architecture.md): review the overall structure of profiles, contexts, and `DialectManager`.
- [runtime-constraints-design.md](runtime-constraints-design.md): see where interaction restrictions and behavior modules belong.
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md): review the public API and source entry points.