# 运行时约束与行为边界

Runtime Guards and Behavior Boundaries

## 1. 文档目的 / Purpose of This Document

这份文档说明主库当前已经落地的运行时限制能力，以及后续如果继续扩展，应当沿着什么边界演进。

This document explains the runtime restriction capabilities that already exist in the plugin and the boundary future extensions should follow.

它不是一份脱离现状的全新方案，而是“当前实现 + 可扩展方向”的说明。

It is not a detached greenfield proposal. It is a description of the current implementation plus the extension boundary.

## 2. 当前已经存在的运行时保护 / Runtime Guards That Already Exist

| 能力 / Capability | 当前入口 / Current entry point | 负责什么 / Responsibility |
|---|---|---|
| 连线预校验 | `createContextValidateConnectionWithResult()`、`DialectManager.bind()` | 在创建连线时阻止明显非法连接 |
| 连线终校验 | `createContextValidateEdgeWithResult()`、`DialectManager.bind()` | 在边实例已经形成后做最终合法性判断 |
| 图级结构约束 | `validateConstraints()` | 主动校验开始事件、结束事件、禁用 shape 等整体规则 |
| 边界事件附着 | `setupBoundaryAttach()` | 处理吸附、边框滑动、宿主 resize、脱附 |
| Pool/Lane containment | `setupPoolContainment()` | 约束流程节点留在合法容器内，并支持回退与违规回调 |

| Capability | Current entry point | Responsibility |
|---|---|---|
| Connection preview validation | `createContextValidateConnectionWithResult()`, `DialectManager.bind()` | Blocks obviously invalid connections while they are being created |
| Connection final validation | `createContextValidateEdgeWithResult()`, `DialectManager.bind()` | Performs a final legality check after an edge exists |
| Graph-level structural constraints | `validateConstraints()` | Explicitly validates whole-graph rules such as start/end events and forbidden shapes |
| Boundary attachment | `setupBoundaryAttach()` | Handles snapping, edge sliding, host resize, and detachment |
| Pool/lane containment | `setupPoolContainment()` | Keeps flow nodes inside legal containers and supports rollback plus violation callbacks |

换句话说，主库现在并不是“只有创建时校验”，而是已经有一组分层的运行时保护。

In other words, the plugin already has a layered runtime guard stack. It is not limited to creation-time validation anymore.

## 3. 当前设计原则 / Current Design Principles

### 3.1 主库负责限制，宿主负责提示 / Plugin Owns Restrictions, Host Owns Messaging

当前实现遵循一个很明确的分工：

The current implementation follows a clear split:

- 主库负责规则、回退、附着、containment 和标准化结果。
- 宿主负责 toast、弹窗、日志、文案和页面反馈。

- The plugin owns rules, rollback, attachment, containment, and normalized results.
- The host owns toasts, dialogs, logging, wording, and page feedback.

例如 `setupPoolContainment()` 只通过 `onViolation` 回调返回结果，不直接弹消息。

For example, `setupPoolContainment()` only reports violations through `onViolation` and does not show UI itself.

### 3.2 优先走 X6 原生钩子，再做提交后兜底 / Prefer Native X6 Hooks First, Then Fallback Checks

当前实现优先利用 X6 原生机制：

The current implementation prefers native X6 mechanisms first:

- `connecting.validateConnection`
- `connecting.validateEdge`
- `embed()` / `unembed()`
- graph 事件，如 `node:added`、`node:moving`、`node:moved`

- `connecting.validateConnection`
- `connecting.validateEdge`
- `embed()` / `unembed()`
- graph events such as `node:added`, `node:moving`, and `node:moved`

如果原生预检不足，再通过事件回调做最终回退。

If native preview checks are not enough, event callbacks provide the final fallback rollback.

### 3.3 一切都绑定到 graph 实例 / Everything Is Bound to the Graph Instance

运行时约束不依赖全局状态，而是跟随 `ProfileContext` 和 graph 实例一起存在。

Runtime restrictions do not depend on global state. They live with the graph instance and its `ProfileContext`.

这使得多个编辑器实例可以同时使用不同方言和不同运行时配置。

That allows multiple editors to use different dialects and runtime setups at the same time.

## 4. 关键链路怎么接起来 / How the Main Runtime Chain Fits Together

### 4.1 方言绑定阶段 / During Dialect Binding

当宿主调用 `DialectManager.bind(graph, dialectId)` 时，除了注册 shape 之外，还会自动接入：

When the host calls `DialectManager.bind(graph, dialectId)`, it does more than register shapes. It also wires:

- `validateConnection`
- `validateEdge`
- 异常回调 `onValidationException`
- 失败回调 `onValidationError`

- `validateConnection`
- `validateEdge`
- `onValidationException`
- `onValidationError`

这让“规则属于当前方言”这件事真正进入交互期，而不是只停留在导入导出阶段。

That brings dialect-specific rules into live interaction rather than limiting them to import/export.

### 4.2 行为模块阶段 / During Runtime Behavior Modules

对一些 X6 原生语义不足以完整表达的 BPMN 行为，主库单独提供行为模块：

For BPMN interactions that X6 primitives do not fully express on their own, the plugin provides dedicated behavior modules:

- `setupBoundaryAttach()` 处理边界事件与宿主 Activity 的特殊附着关系。
- `setupPoolContainment()` 处理流程节点与 Pool/Lane 的容器归属。

- `setupBoundaryAttach()` handles the special attachment relationship between boundary events and host activities.
- `setupPoolContainment()` handles container ownership between flow nodes and pools/lanes.

这些模块的特点是：

These modules share the same characteristics:

- 它们只负责交互机制。
- 它们不内置 UI。
- 它们可以单独安装和清理。

- They only own interaction mechanics.
- They do not bundle UI.
- They can be installed and disposed independently.

## 5. 什么时候新增运行时行为 / When to Add a New Runtime Behavior

新增运行时限制时，先判断问题属于哪一类：

When adding a new runtime restriction, first decide which category it belongs to:

| 问题类型 / Problem type | 推荐落点 / Recommended home |
|---|---|
| 连线是否合法 | `src/rules` 或 `src/core/rules` |
| 整张图结构是否完整 | `constraints` 规则 |
| 节点移动、嵌入、附着、容器归属 | `src/behaviors` |
| 页面级禁用、只读模式、业务提示 | 宿主项目 |

| Problem type | Recommended home |
|---|---|
| Whether a connection is legal | `src/rules` or `src/core/rules` |
| Whether the whole graph is structurally complete | `constraints` rules |
| Node movement, embedding, attachment, or containment | `src/behaviors` |
| Page-level disable states, read-only mode, or business messaging | Host application |

如果一个限制具有“BPMN 通用可复用性”，就应该优先考虑主库；如果它只在某个产品页面中成立，就不应该硬塞回主库。

If a restriction is generally reusable for BPMN, it should usually live in the plugin. If it only makes sense in one product page, it should stay in the host.

## 6. 新增运行时限制时的实现要求 / Implementation Rules for New Runtime Restrictions

1. 优先用原生预检能力，减少落地后再回滚。
2. 如果必须回滚，回滚逻辑不能破坏现有附着、嵌入和父子关系同步。
3. 返回标准化结果或回调，不直接耦合 UI 组件。
4. 测试优先使用真实 X6 Graph 和线性拖拽过程，避免无意义 mock。
5. 如果改的是 BPMN 规范性限制，先查只读参照子模块，再决定实现。

1. Prefer native preview hooks so fewer operations need post-commit rollback.
2. If rollback is required, it must not break existing attachment, embedding, or parent-child synchronization.
3. Return normalized results or callbacks without coupling directly to UI components.
4. Prefer real X6 Graph tests and linear drag flows instead of low-value mocks.
5. If the change affects BPMN specification constraints, consult the read-only reference submodules first.

## 7. 当前边界与后续演进 / Current Boundary and Future Evolution

当前主库还没有一个完全通用的“单控制器式 runtime constraint framework”。

The plugin does not yet have a single generic runtime-constraint controller.

但这并不意味着需要推翻现有实现。更合理的方向是：

That does not mean the current implementation should be replaced. The more reasonable direction is:

- 继续保留已落地的行为模块。
- 如果多个行为开始共享同一套事件编排，再抽象出更通用的控制器。
- 通用控制器必须复用现有 `ProfileContext`、规则层和行为模块，而不是另起一套平行系统。

- Keep the existing behavior modules.
- If multiple behaviors start sharing the same orchestration pattern, then extract a more generic controller.
- Any generic controller must reuse the current `ProfileContext`, rule layer, and behavior modules instead of creating a parallel system.

这条边界很重要，因为它能避免“为了抽象而抽象”，也能避免把已经稳定的行为重新写坏。

That boundary matters because it avoids abstraction for its own sake and reduces the risk of rewriting already stable behavior incorrectly.

## 8. 相关阅读 / Related Reading

- [dynamic-config-architecture.md](dynamic-config-architecture.md)：看这些运行时能力是如何挂到 profile/context 体系上的。
- [custom-extension-guide.md](custom-extension-guide.md)：看宿主何时应该扩展主库，何时应该只做页面层接入。
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)：看入口 API 和相关源码目录。

- [dynamic-config-architecture.md](dynamic-config-architecture.md): see how these runtime capabilities attach to the profile/context architecture.
- [custom-extension-guide.md](custom-extension-guide.md): see when the host should extend the plugin and when it should stay at page level.
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md): review the entry API and related source directories.