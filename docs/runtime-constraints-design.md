# X6 运行时约束设计

> 面向 `@x6-bpmn2/plugin` 与业务宿主的通用运行时限制方案。
>
> General runtime constraint design for `@x6-bpmn2/plugin` and host applications.

## 1. 目标

- 将“创建时校验”扩展为“运行时全过程约束”。
- 约束设计必须通用，不能只服务于 BPMN Pool/Lane 场景。
- 约束层需要兼容当前已有的 X6 `connecting`、`embedding`、`translating`、`interacting` 配置方式。
- 约束结果只输出标准化结果和事件，不内置 UI 提示组件。
- 约束能力应可与当前方言系统 `ProfileContext` 协同工作。

- Extend validation from creation-time checks to full runtime constraints.
- The design must be generic rather than limited to BPMN Pool/Lane scenarios.
- The constraint layer must work with existing X6 `connecting`, `embedding`, `translating`, and `interacting` options.
- Constraint evaluation should emit normalized results and events only, without bundling UI components.
- Runtime constraints should integrate with the current dialect system through `ProfileContext`.

## 2. 设计结论

- X6 本身已经提供了运行时限制所需的关键能力：
  - `connecting.validateConnection` 负责连线创建阶段的前置阻止。
  - `embedding.validate` 负责节点嵌入候选父节点的前置阻止。
  - `translating.restrict` 负责节点移动边界的硬限制。
  - `interacting` 负责按节点、按边、按场景关闭交互能力。
  - `node:embedding`、`node:embedded`、`node:change:parent`、`node:change:position` 等事件负责运行时观察与兜底回滚。
- 当前主库已经具备“连线规则”和“结构约束”两类能力，但还缺少一层统一的“运行时约束编排层”。
- 因此推荐方案不是重写现有规则系统，而是在其上增加一层通用的运行时控制模块。

- X6 already exposes the core primitives needed for runtime restriction:
  - `connecting.validateConnection` for pre-emptive connection blocking.
  - `embedding.validate` for pre-emptive embedding blocking.
  - `translating.restrict` for hard movement bounds.
  - `interacting` for enabling or disabling interactions by cell and scenario.
  - Events such as `node:embedding`, `node:embedded`, `node:change:parent`, and `node:change:position` for runtime observation and fallback rollback.
- The plugin already has connection rules and graph-level constraint validation, but it lacks a unified runtime orchestration layer.
- The recommended path is therefore to add a generic runtime control module on top of the current rule system rather than replacing it.

## 3. 当前代码基线

- 现有能力：
  - `createBpmnValidateConnection` 与 `createContextValidateConnection` 已覆盖连线创建阶段。
  - `validateConstraints` 已覆盖图级结构约束，但偏向“主动调用验证”，不是“交互期持续约束”。
  - `DialectManager.bind(graph, dialectId)` 与 `ProfileContext` 已经提供实例级运行时上下文。
- 当前缺口：
  - 缺少统一的运行时事件监听、违规回滚、违规通知出口。
  - 缺少“预检约束”和“提交后兜底约束”的统一抽象。
  - 缺少可复用的节点移动、父子关系变化、数据变更限制框架。

- Existing capabilities:
  - `createBpmnValidateConnection` and `createContextValidateConnection` already cover connection-time validation.
  - `validateConstraints` already supports graph-level structural checks, but it is oriented toward explicit validation calls rather than continuous interaction-time enforcement.
  - `DialectManager.bind(graph, dialectId)` and `ProfileContext` already provide instance-scoped runtime context.
- Current gaps:
  - No unified runtime event listening, violation rollback, or violation notification outlet.
  - No common abstraction that spans preview-phase blocking and commit-phase fallback checks.
  - No reusable framework for movement, parent-child, or data mutation restrictions.

## 4. 总体架构

建议新增一层“运行时约束层”，位置在“Graph 初始化配置”和“业务 UI”之间。

Recommend introducing a dedicated runtime constraint layer between graph initialization and host UI.

```text
Graph/X6 Native Hooks
  -> Runtime Constraint Controller
  -> Existing Rule Engine / ProfileContext
  -> Host Notification Adapter
```

### 4.1 分层职责

1. 原生前置限制层
   - 通过 X6 原生配置直接阻止明显非法操作。
   - 包括 `connecting.validateConnection`、`embedding.validate`、`translating.restrict`、`interacting`。

2. 运行时编排层
   - 统一监听节点移动、嵌入、位置变化、父子关系变化、边端点变化、数据变化。
   - 负责把事件转成统一的“操作上下文”。

3. 规则评估层
   - 复用当前 `ProfileContext.profile.rules`、连接规则、图级约束规则。
   - 新增专门面向运行时操作的规则集合。

4. 违规处置层
   - 根据规则结果执行：放行、阻止、回滚、高亮、通知。
   - UI 提示由宿主注入，不在插件内部实现。

1. Native prevention layer
   - Uses built-in X6 options to block obviously invalid interactions early.
   - Includes `connecting.validateConnection`, `embedding.validate`, `translating.restrict`, and `interacting`.

2. Runtime orchestration layer
   - Listens to movement, embedding, position changes, parent changes, edge endpoint changes, and data changes.
   - Converts native events into normalized operation contexts.

3. Rule evaluation layer
   - Reuses `ProfileContext.profile.rules`, connection rules, and graph-level constraints.
   - Adds a dedicated rule set for runtime operations.

4. Violation handling layer
   - Performs allow, block, revert, highlight, or notify actions.
   - Host applications provide UI feedback instead of the plugin shipping a built-in message component.

## 5. 通用操作模型

### 5.1 操作类型

建议把所有运行时限制统一抽象为以下操作类型：

Recommend normalizing runtime restrictions around the following operation types:

- `node-move-preview`：节点拖拽中的预检。
- `node-move-commit`：节点拖拽完成后的最终检查。
- `node-embed-preview`：节点尝试进入候选父容器时的预检。
- `node-embed-commit`：节点父子关系已经变化后的最终检查。
- `edge-connect-preview`：新建连线时的预检。
- `edge-reconnect-preview`：修改边源/目标端点时的预检。
- `edge-connect-commit`：边端点变更后的最终检查。
- `cell-data-commit`：节点或边数据变更后的检查。
- `graph-validate`：主动触发的整图校验。

- `node-move-preview`: preview while a node is being moved.
- `node-move-commit`: final check after movement is committed.
- `node-embed-preview`: preview when a node enters a candidate parent.
- `node-embed-commit`: final check after parent-child state changes.
- `edge-connect-preview`: preview when creating a new edge.
- `edge-reconnect-preview`: preview when reconnecting an existing edge.
- `edge-connect-commit`: final check after endpoint changes are committed.
- `cell-data-commit`: post-change validation for node or edge data updates.
- `graph-validate`: explicit full-graph validation.

### 5.2 统一结果模型

```ts
export type RuntimeConstraintAction = 'allow' | 'block' | 'revert' | 'warn'

export interface RuntimeConstraintResult {
  valid: boolean
  action: RuntimeConstraintAction
  reason?: string
  ruleId?: string
  severity?: 'info' | 'warning' | 'error'
}
```

该结果模型的关键点是把“是否通过”和“如何处理”拆开。

The key point is to separate pass/fail from the resulting handling strategy.

## 6. 建议的接口形态

### 6.1 规则接口

```ts
export interface RuntimeConstraintContext {
  graph: Graph
  profileContext?: ProfileContext
  operation:
    | 'node-move-preview'
    | 'node-move-commit'
    | 'node-embed-preview'
    | 'node-embed-commit'
    | 'edge-connect-preview'
    | 'edge-reconnect-preview'
    | 'edge-connect-commit'
    | 'cell-data-commit'
    | 'graph-validate'
  cell?: Cell
  node?: Node
  edge?: Edge
  previousParentId?: string | null
  currentParentId?: string | null
  candidateParentId?: string | null
  previousPosition?: { x: number; y: number }
  currentPosition?: { x: number; y: number }
}

export interface RuntimeConstraintRule {
  id: string
  description: string
  appliesTo?: RuntimeConstraintContext['operation'][]
  validate(context: RuntimeConstraintContext): true | string | RuntimeConstraintResult
}
```

该接口与现有 `ConstraintRule` 的风格保持一致，但专门面向交互期操作。

This mirrors the current `ConstraintRule` style while targeting interaction-time operations.

### 6.2 控制器接口

```ts
export interface RuntimeConstraintControllerOptions {
  profileContext?: ProfileContext
  rules?: RuntimeConstraintRule[]
  onViolation?: (result: RuntimeConstraintResult, context: RuntimeConstraintContext) => void
  enablePreviewBlock?: boolean
  enableCommitRollback?: boolean
}

export function setupRuntimeConstraints(
  graph: Graph,
  options: RuntimeConstraintControllerOptions,
): () => void
```

返回值为清理函数，风格与现有 `setupBoundaryAttach` 一致。

The function returns a disposer, matching the style of `setupBoundaryAttach`.

## 7. 与现有运行时设置的协同方式

### 7.1 `connecting.validateConnection`

- 继续复用现有 `createBpmnValidateConnection` / `createContextValidateConnection`。
- 对于运行时约束层，应把它视为“边连接预检通道”，不重复实现 BPMN 连线规则。

- Keep using `createBpmnValidateConnection` and `createContextValidateConnection`.
- In the runtime layer, treat them as the edge-connection preview channel instead of reimplementing BPMN connection rules.

### 7.2 `embedding.validate`

- 用于“禁止移入非法父容器”。
- 例如：Pool 外节点不得嵌入 Lane；Task 不得移入 Black Box Pool；边界事件不得嵌入非 Activity 宿主。

- Use it to prevent invalid parent candidates.
- Examples include forbidding nodes from entering illegal lanes, forbidding tasks from entering black-box pools, and forbidding boundary events from attaching to non-activity hosts.

### 7.3 `translating.restrict`

- 用于“禁止拖出容器边界”的硬限制。
- 例如：任务节点一旦属于某个 Pool 或 Lane，则拖拽时直接限制在该容器范围内。
- 对于“必须留在原容器中”的规则，优先使用 `translating.restrict`，而不是仅靠落下后回滚。

- Use it as the hard boundary mechanism for “cannot leave this container”.
- For example, once a task belongs to a pool or lane, movement can be restricted to that container’s bounds.
- Prefer `translating.restrict` over post-drop rollback for hard containment rules.

### 7.4 `interacting`

- 用于按节点、按模式关闭某些交互能力。
- 例如：Pool 默认不可移动；只读模式下节点不可拖拽、端口不可连线。

- Use it to disable interaction capabilities by node type or mode.
- For example, pools can be immovable by default, or node dragging and connection can be disabled in read-only mode.

### 7.5 事件监听兜底

- 监听 `node:embedded`、`node:change:parent`、`node:change:position`、`edge:change:source`、`edge:change:target`。
- 当原生前置限制不足时，在提交后执行最终校验并回滚。

- Listen to `node:embedded`, `node:change:parent`, `node:change:position`, `edge:change:source`, and `edge:change:target`.
- Use them as commit-time fallback checks when native preview blocking alone is insufficient.

## 8. 与方言系统的协同方式

### 8.1 不新增全局状态

- 运行时约束必须绑定到 `graph` 实例。
- `ProfileContext` 继续作为方言规则和数据模型的来源。

- Runtime constraints must remain bound to the graph instance.
- `ProfileContext` should continue to provide dialect rules and data-model metadata.

### 8.2 推荐扩展点

建议在现有 `RuleSet` 之外增加可选字段：

Recommend adding an optional field beside the existing `RuleSet`:

```ts
interface RuleSet {
  nodeCategories: Record<string, BpmnNodeCategory>
  connectionRules: Record<string, BpmnConnectionRule>
  constraints: ConstraintRule[]
  runtimeConstraints?: RuntimeConstraintRule[]
}
```

这样可以让不同方言在继承链中覆写运行时交互限制，而不影响现有导入导出和连接规则结构。

This allows dialects to override runtime interaction policies through the inheritance chain without affecting import/export or connection rules.

## 9. 推荐的最小代码调整

为了让方案与当前代码完全契合，建议做以下最小改造：

The following minimal adjustments are recommended for alignment with the current codebase:

1. 在 `src/core/rules/` 下新增运行时约束模块。
   - 建议目录：`src/core/runtime-constraints/` 或 `src/core/rules/runtime.ts`。

2. 在 `RuleSet` 中增加 `runtimeConstraints?: RuntimeConstraintRule[]`。

3. 新增 `setupRuntimeConstraints(graph, options)`。
   - 负责安装事件监听、前置限制桥接、回滚与违规通知。

4. 新增 `createRuntimeGraphOptions(graph, options)` 或等价工具。
   - 负责把 `embedding.validate`、`translating.restrict`、`interacting` 这种原生 X6 配置与运行时约束控制器统一拼装。

5. 保持 UI 外置。
   - 主库只通过 `onViolation` 回调返回原因、规则 ID、严重程度。

1. Add a runtime-constraint module under `src/core/rules/`.
   - Recommended location: `src/core/runtime-constraints/` or `src/core/rules/runtime.ts`.

2. Extend `RuleSet` with `runtimeConstraints?: RuntimeConstraintRule[]`.

3. Add `setupRuntimeConstraints(graph, options)`.
   - It should install listeners, bridge preview guards, perform rollback, and emit violation callbacks.

4. Add `createRuntimeGraphOptions(graph, options)` or an equivalent helper.
   - It should compose native X6 settings such as `embedding.validate`, `translating.restrict`, and `interacting` together with the runtime controller.

5. Keep UI external.
   - The plugin should only emit normalized reasons, rule IDs, and severity through `onViolation`.

## 10. Pool 场景示例

### 10.1 业务规则

- 已归属某个 Pool 的任务节点，不允许被拖到外部空白区。
- 已归属某个 Lane 的任务节点，不允许被拖出其上级 Pool。
- 如果业务开启“内部流程模式”，则允许存在未归属任何 Pool 的任务；否则空白区任务视为违规。

- A task already owned by a pool cannot be dragged into blank space outside that pool.
- A task already owned by a lane cannot leave its enclosing pool.
- If the host enables an internal-process mode, unpooled tasks are allowed; otherwise tasks in blank space are treated as violations.

### 10.2 技术落点

- 预检阶段：
  - 使用 `translating.restrict` 把节点限制在当前 Pool 或 Lane 的边界内。
  - 使用 `embedding.validate` 禁止进入非法候选容器。
- 提交阶段：
  - 监听 `node:change:parent` 和 `node:change:position`。
  - 如果节点脱离原 Pool 且不满足“内部流程模式”，则回滚并触发 `onViolation`。

- Preview phase:
  - Use `translating.restrict` to keep the node within the current pool or lane bounds.
  - Use `embedding.validate` to block illegal container candidates.
- Commit phase:
  - Listen to `node:change:parent` and `node:change:position`.
  - If the node leaves its pool and internal-process mode is not enabled, revert and emit `onViolation`.

## 11. 推荐落地顺序

1. 第一阶段：统一事件与结果模型。
2. 第二阶段：接入 Pool/Lane、宿主 Activity、只读模式三类核心限制。
3. 第三阶段：把运行时约束纳入 `Profile` 继承链。
4. 第四阶段：在示例项目中演示提示与回滚。

1. Phase 1: unify event and result models.
2. Phase 2: implement three core restrictions: Pool/Lane containment, boundary-event host restrictions, and read-only mode.
3. Phase 3: move runtime constraints into the `Profile` inheritance chain.
4. Phase 4: demonstrate user notification and rollback in the example applications.

## 12. 最终建议

- 当前主库不需要推翻现有连接规则和方言系统。
- 最优做法是在当前 `ProfileContext + X6 原生 hooks + 规则引擎` 之上，新增一个通用运行时约束控制器。
- 这套设计既能满足 BPMN Pool/Lane 等强语义场景，也能承载审批流、SmartEngine、只读编辑、权限控制等更通用的运行时限制。

- The current plugin does not need a rewrite of its connection rules or dialect system.
- The preferred path is to add a generic runtime constraint controller on top of the existing `ProfileContext + native X6 hooks + rule engine` stack.
- This design can support strong BPMN semantics such as Pool/Lane containment while also covering approval-flow constraints, SmartEngine scenarios, read-only editing, and permission-driven runtime restrictions.