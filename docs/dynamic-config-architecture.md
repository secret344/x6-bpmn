# 方言系统架构说明

Dialect System Architecture Guide

## 1. 文档定位 / What This Document Covers

这份文档描述的是 `@x6-bpmn2/plugin` 当前已经落地的方言系统结构，用来替换早期“改造方案”式文档。

This document describes the dialect system that already exists in `@x6-bpmn2/plugin`. It replaces older proposal-style notes.

阅读这份文档时，建议把重点放在三个问题上：

Read this document with three questions in mind:

- 方言系统的核心对象是什么？
- `Profile` 是如何被编译并绑定到具体 graph 实例上的？
- 哪些能力属于主库，哪些能力应该留给宿主？

- What are the core objects in the dialect system?
- How is a `Profile` compiled and bound to a specific graph instance?
- Which responsibilities belong to the plugin and which belong to the host?

## 2. 核心对象 / Core Objects

| 对象 / Object | 作用 / Responsibility | 主要入口 / Main entry |
|---|---|---|
| `Profile` | 方言配置载体，允许只覆盖自己关心的层 | `src/core/dialect/types.ts` |
| `ResolvedProfile` | 编译后的只读结果，已完成继承链合并与默认值补齐 | `src/core/dialect/compiler.ts` |
| `ProfileRegistry` | 注册原始 profile，并缓存编译结果 | `src/core/dialect/registry.ts` |
| `ProfileContext` | 绑定到单个 graph 实例的运行时上下文 | `src/core/dialect/context.ts` |
| `DialectManager` | 高层装配器，负责 `bind()`、导入、导出和校验接线 | `src/adapters/x6/bind.ts` |

| Object | Responsibility | Main entry |
|---|---|---|
| `Profile` | Dialect configuration container that only needs to override the layers it cares about | `src/core/dialect/types.ts` |
| `ResolvedProfile` | Read-only compiled result after inheritance merge and default filling | `src/core/dialect/compiler.ts` |
| `ProfileRegistry` | Stores raw profiles and caches compiled results | `src/core/dialect/registry.ts` |
| `ProfileContext` | Runtime context bound to a single graph instance | `src/core/dialect/context.ts` |
| `DialectManager` | High-level orchestrator for `bind()`, import, export, and validation wiring | `src/adapters/x6/bind.ts` |

这套结构的关键点是：

The key design point is:

- 不存在全局活动方言。
- 每个 graph 绑定自己的 `ProfileContext`。
- 编译和运行时状态被明确分离。

- There is no global active dialect.
- Every graph owns its own `ProfileContext`.
- Compilation state and runtime state are explicitly separated.

## 3. 六层配置模型 / Six-Layer Profile Model

当前 profile 使用六层模型，每层都承担单独职责。

The current profile model has six layers, each with a separate responsibility.

| 层 / Layer | 内容 / What it stores | 典型用途 / Typical use |
|---|---|---|
| `definitions` | 节点与边的定义、分类、renderer 名称、标题 | 新增元素、声明元素身份 |
| `availability` | 元素可用状态：`enabled`、`disabled`、`experimental` | 按方言启用或禁用元素 |
| `rendering` | theme token、节点渲染器、边渲染器 | 控制图形如何注册到 X6 |
| `rules` | 分类映射、连线规则、高阶约束规则 | 控制连接合法性与整图约束 |
| `dataModel` | 字段能力、分类字段、shape 字段 | 定义默认值、规范化、验证、序列化能力 |
| `serialization` | 命名空间、节点映射、边映射 | 控制 XML 导入导出语义 |

| Layer | What it stores | Typical use |
|---|---|---|
| `definitions` | Node and edge definitions, categories, renderer names, titles | Add elements and declare their identity |
| `availability` | Availability states: `enabled`, `disabled`, `experimental` | Turn elements on or off per dialect |
| `rendering` | Theme tokens, node renderers, edge renderers | Control how shapes are registered into X6 |
| `rules` | Category mapping, connection rules, graph-level constraints | Control connection legality and whole-graph constraints |
| `dataModel` | Field capabilities, category fields, shape fields | Define defaults, normalization, validation, and serialization behavior |
| `serialization` | Namespaces, node mappings, edge mappings | Control XML import/export semantics |

这六层模型把“元素是什么”“能不能用”“长什么样”“怎么连”“有哪些字段”“怎么进出 XML”拆开了。

The six-layer model separates element identity, availability, rendering, rules, field capability, and XML semantics.

## 4. 实际运行链路 / Actual Runtime Flow

### 4.1 注册与编译 / Registration and Compilation

1. 宿主把内置或自定义 profile 注册到 `ProfileRegistry`。
2. `registry.compile(dialectId)` 解析继承链并调用 `compileProfile()`。
3. 编译结果变成 `ResolvedProfile`，并在注册表内缓存。

1. The host registers built-in or custom profiles in `ProfileRegistry`.
2. `registry.compile(dialectId)` resolves the inheritance chain and calls `compileProfile()`.
3. The result becomes a cached `ResolvedProfile`.

### 4.2 绑定到 Graph / Binding to Graph

1. `DialectManager.bind(graph, dialectId)` 创建 `ProfileContext`。
2. `bindProfileToGraph()` 按 profile 中启用的元素把节点和边注册到 X6。
3. 当前 graph 与 `ProfileContext` 通过 `WeakMap` 绑定。

1. `DialectManager.bind(graph, dialectId)` creates a `ProfileContext`.
2. `bindProfileToGraph()` registers enabled nodes and edges into X6 based on the profile.
3. The graph and its `ProfileContext` are linked through `WeakMap` storage.

### 4.3 校验自动接线 / Automatic Validation Wiring

`DialectManager.bind()` 还会自动处理两件事：

`DialectManager.bind()` also auto-wires two more pieces:

- 接入 `graph.options.connecting.validateConnection`
- 接入 `graph.options.connecting.validateEdge`

- It wires `graph.options.connecting.validateConnection`
- It wires `graph.options.connecting.validateEdge`

这意味着方言切换后，连线规则会跟着当前 profile 一起变化，而不是依赖全局规则表。

That means connection validation follows the currently bound profile instead of a global rule table.

### 4.4 导入导出 / Import and Export

- 导入时，`DialectManager.importXML()` 可以先检测方言，再按方言分发 importer。
- 导出时，`DialectManager.exportXML()` 根据当前 graph 的 `ProfileContext` 选择 exporter。

- During import, `DialectManager.importXML()` can detect the dialect first and dispatch to the right importer.
- During export, `DialectManager.exportXML()` selects the exporter based on the graph's current `ProfileContext`.

## 5. 继承与编译语义 / Inheritance and Compilation Semantics

编译阶段有几条必须记住的规则：

There are a few compile-time rules worth remembering:

1. 继承链从根到叶合并，父级先合并，子级后覆盖。
2. 各层都是独立合并，不要求子 profile 提供完整对象。
3. `$remove` 用于在子级明确删除父级配置项。
4. `availability` 对已定义但未显式设置状态的元素默认补成 `enabled`。
5. renderer 缺失不会阻断编译，但会输出 warning，方便在开发期定位。
6. 注册新 profile 后，会失效自己及其子 profile 的编译缓存。

1. The inheritance chain is merged from root to leaf, with parents applied before children.
2. Each layer merges independently, so a child profile only needs to provide partial overrides.
3. `$remove` explicitly deletes inherited configuration.
4. `availability` defaults to `enabled` for defined elements that do not declare a state.
5. Missing renderers do not abort compilation, but they emit warnings for development-time diagnosis.
6. Registering a new profile invalidates the compile cache for itself and its descendants.

## 6. 内置方言层级 / Built-In Dialect Hierarchy

当前主库已经内置了一条明确的方言层级：

The plugin already ships with a clear built-in dialect hierarchy:

- `bpmn2`：基础母版方言，提供标准 BPMN 2.0 的默认定义、规则、字段能力和序列化映射。
- `smartengine-base`：在 `bpmn2` 上叠加 SmartEngine 公共扩展。
- `smartengine-custom`：在 `smartengine-base` 上增加 custom 模式差异。
- `smartengine-database`：在 `smartengine-base` 上增加 database 模式差异。

- `bpmn2`: the root dialect providing standard BPMN 2.0 definitions, rules, field capability, and serialization mappings.
- `smartengine-base`: layers SmartEngine shared behavior on top of `bpmn2`.
- `smartengine-custom`: adds custom-mode differences on top of `smartengine-base`.
- `smartengine-database`: adds database-mode differences on top of `smartengine-base`.

宿主新增业务方言时，通常不应该复制整份 BPMN2 配置，而是继承某个现有 profile 再做增量覆盖。

When a host adds a business dialect, it usually should not copy the full BPMN2 configuration. It should extend an existing profile and apply incremental overrides.

## 7. 职责边界 / Ownership Boundaries

### 7.1 主库负责什么 / What the Plugin Owns

- 元素定义与分类。
- 元素可用性。
- 节点与边的渲染注册。
- BPMN 通用连线规则与结构约束。
- 字段能力，如默认值、规范化、验证、序列化。
- XML 导入导出语义。
- 可复用的运行时行为，如边界事件附着、Pool/Lane containment。

- Element definition and classification.
- Element availability.
- Node and edge renderer registration.
- Reusable BPMN connection rules and structural constraints.
- Field capability such as defaults, normalization, validation, and serialization.
- XML import/export semantics.
- Reusable runtime behaviors such as boundary attachment and pool/lane containment.

### 7.2 宿主负责什么 / What the Host Owns

- 表单布局与字段组件。
- Stencil 分组和面板组织。
- 提示文案、消息弹窗、业务提醒。
- 只适用于某个产品的业务限制。
- 页面级交互与状态管理。

- Form layout and field widgets.
- Stencil grouping and panel organization.
- Messages, toasts, and product-specific wording.
- Business restrictions that only apply to one product.
- Page-level interaction and state management.

一句话概括：主库负责可复用能力，宿主负责呈现与业务表达。

In one sentence: the plugin owns reusable capability, while the host owns presentation and business expression.

## 8. 改动定位 / Where Changes Usually Belong

| 变更类型 / Change type | 首选目录 / Primary directory |
|---|---|
| 调整 profile 类型、继承、编译行为 | `src/core/dialect` |
| 调整节点或边 renderer | `src/core/rendering` |
| 调整连线规则或约束规则 | `src/rules`、`src/core/rules` |
| 调整字段默认值与字段能力 | `src/core/data-model`、`src/builtin/*/profile.ts` |
| 调整 XML 映射与命名空间 | `src/export`、`src/builtin/*/profile.ts` |
| 调整 graph 绑定与自动校验装配 | `src/adapters/x6/bind.ts` |

| Change type | Primary directory |
|---|---|
| Change profile types, inheritance, or compilation | `src/core/dialect` |
| Change node or edge renderers | `src/core/rendering` |
| Change connection rules or constraint rules | `src/rules`, `src/core/rules` |
| Change field defaults or field capability | `src/core/data-model`, `src/builtin/*/profile.ts` |
| Change XML mappings or namespaces | `src/export`, `src/builtin/*/profile.ts` |
| Change graph binding or automatic validation wiring | `src/adapters/x6/bind.ts` |

## 9. 相关阅读 / Related Reading

- [project-onboarding-guide.md](project-onboarding-guide.md)：从工作区视角理解这套架构落在什么位置。
- [custom-extension-guide.md](custom-extension-guide.md)：看宿主如何沿着现有方言体系做增量扩展。
- [runtime-constraints-design.md](runtime-constraints-design.md)：看运行时限制与行为模块如何挂到这套架构上。
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)：看主库 API 面和推荐阅读顺序。

- [project-onboarding-guide.md](project-onboarding-guide.md): understand where the dialect system sits in the workspace.
- [custom-extension-guide.md](custom-extension-guide.md): see how host apps extend the current dialect architecture incrementally.
- [runtime-constraints-design.md](runtime-constraints-design.md): see how runtime guards and behavior modules attach to this architecture.
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md): review the plugin API surface and recommended reading order.