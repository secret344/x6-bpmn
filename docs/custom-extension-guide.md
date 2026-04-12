# 宿主扩展指南

Host Extension Guide

## 1. 文档目标 / Document Goal

这份文档用于帮助宿主项目选择最小改动路径来扩展仓库主库。

This document helps host projects choose the smallest-change path for extending the core library.

## 2. 先判断改动属于哪一层 / Decide Which Layer You Are Changing

| 目标 / Goal | 推荐路径 / Recommended path |
|---|---|
| 只改标准节点外观 | 重新注册同名 shape |
| 新增业务节点，但沿用 BPMN2 规则和标准标签 | 基于 `bpmn2` 扩展 profile |
| 新增字段默认值、校验或序列化能力 | 修改 profile 的 `dataModel` 和 `serialization` |
| 新增页面面板、表单、提示和交互文案 | 留在宿主项目 |
| 新增通用 BPMN 交互限制 | 改主库 `rules` 或 `behaviors` |
| 新增产品专属限制 | 放到宿主项目 |

| Goal | Recommended path |
|---|---|
| Restyle an existing standard node | Re-register the same shape |
| Add business nodes while keeping BPMN2 rules and standard tags | Extend `bpmn2` with a profile |
| Add field defaults, validation, or serialization | Update profile `dataModel` and `serialization` |
| Add panels, forms, messages, or page interactions | Keep them in the host project |
| Add reusable BPMN interaction restrictions | Change plugin `rules` or `behaviors` |
| Add product-only restrictions | Keep them in the host project |

## 3. 路径 A: 只覆盖标准图形 / Path A: Override a Standard Shape

如果只改外观，不需要方言系统。

If you only change appearance, you do not need the dialect system.

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
    },
  },
}, true)
```

这条路径保持 shape 名、连线规则和 XML 映射不变。

This path keeps the shape name, connection rules, and XML mapping unchanged.

## 4. 路径 B: 基于 Profile 扩展方言 / Path B: Extend a Dialect with Profile

当你需要业务节点、字段能力或部分规则变化时，优先用 profile。

Use a profile first when you need business nodes, field capability, or partial rule changes.

### 4.1 定义增量 Profile / Define an Incremental Profile

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

重点是增量覆盖，而不是复制父级 profile。

The goal is incremental override rather than copying the parent profile.

### 4.2 注册并绑定 / Register and Bind

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

如果扩展仍使用标准 BPMN2 标签和结构，优先复用现有导入导出工厂。

If the extension still uses standard BPMN2 tags and structure, reuse the existing import/export factories first.

## 5. 路径 C: 宿主 UI 留在宿主 / Path C: Keep Host UI in the Host

主库 `dataModel` 只表达字段能力，不表达表单布局或页面交互。

The plugin `dataModel` expresses field capability, not form layout or page interaction.

```ts
import {
  getFieldsForShape,
  buildDefaultData,
  validateFields,
} from '@x6-bpmn2/plugin'

const fields = getFieldsForShape(shape, category, context.profile.dataModel)
const defaults = buildDefaultData(fields, context.profile.dataModel)
const failures = validateFields(formData, fields, {
  shape,
  category,
  profileId: context.profile.meta.id,
  nodeData: formData,
}, context.profile.dataModel)
```

主库负责字段存在、默认值和校验结果；宿主负责展示方式和用户交互。

The plugin owns field existence, defaults, and validation results. The host owns presentation and user interaction.

## 6. 什么时候需要新的导入导出入口 / When You Need a New Import or Export Entry

以下情况通常需要新增导入或导出入口：

The following cases usually require a new import or export entry:

1. 需要新的 XML 命名空间。
2. 需要新的 `extensionElements` 结构。
3. 同一个 shape 需要非标准 BPMN 标签或特殊序列化逻辑。
4. 导入阶段需要恢复基础 importer 不认识的业务数据。

1. You need a new XML namespace.
2. You need a new `extensionElements` structure.
3. A shape requires non-standard BPMN tags or special serialization logic.
4. Import must restore business data that the baseline importer does not recognize.

## 7. 主库和宿主的边界 / Boundary Between Plugin and Host

这条边界应保持稳定：

Keep this boundary stable:

1. 可复用 BPMN 行为、方言能力、XML 语义放主库。
2. 页面交互、提示文案、业务面板和产品限制放宿主。

1. Reusable BPMN behavior, dialect capability, and XML semantics belong in the plugin.
2. Page interaction, copywriting, business panels, and product restrictions belong in the host.

## 8. 扩展前检查清单 / Extension Checklist

1. 这次改动是视觉覆盖、方言增量，还是 XML 语义变化。
2. 现有 `bpmn2` 或 `smartengine-*` profile 能否复用。
3. 是否把宿主 UI 逻辑错误地下沉到了主库。
4. 如果改了主库源码，是否补了真实场景测试。

1. Is the change a visual override, dialect increment, or XML semantic change.
2. Can an existing `bpmn2` or `smartengine-*` profile be reused.
3. Has any host UI logic been pushed into the plugin by mistake.
4. If plugin source changed, were realistic tests added.

## 9. 相关阅读 / Related Reading

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. [project-onboarding-guide.md](project-onboarding-guide.md)

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. [project-onboarding-guide.md](project-onboarding-guide.md)