# 基于 bpmn-js 的 Lane / Participant 重构架构说明

# Lane / Participant Redesign Architecture Based on bpmn-js

## 文档定位 / Document Positioning

本文档是解释型设计文档，目标不是描述当前实现，而是给出一套应当替换现有 `pool-containment + lane-management` 组合的新架构。

This document is an explanation-oriented design document. Its goal is not to describe the current implementation, but to define a new architecture that should replace the current `pool-containment + lane-management` combination.

本文档以 `packages/bpmn-js` 的 Lane / Participant 处理方式作为主参考，以 `packages/x6-plugin-bpmn` 的可维护性和导入导出一致性作为落地目标。

This document uses the Lane / Participant handling in `packages/bpmn-js` as the primary reference and takes maintainability plus import/export consistency in `packages/x6-plugin-bpmn` as the delivery target.

本文档是 lane / participant 重构的唯一描述来源。旧的 X6-only containment 设计说明不再保留，以避免并存两套术语体系和两套架构叙事。

This document is the single source of truth for the lane / participant redesign. The previous X6-only containment design note is no longer kept, so that two terminology systems and two architectural narratives do not coexist.

## 背景与结论 / Background and Conclusion

现有方案的问题，不是某条 containment 规则写错了，而是整体建模方式偏离了 bpmn-js 的对象关系和交互分层。当前实现把 Pool、Lane、FlowNode 都当成 X6 里的通用嵌套节点处理，再通过大量回退、补偿和归一化逻辑去修正非法状态。这会让拖拽、resize、selection、导出语义彼此耦合。

The problem with the current approach is not that one containment rule is wrong, but that the overall modeling approach diverges from the object relationships and interaction layering used by bpmn-js. The current implementation treats Pool, Lane, and FlowNode as generic nested X6 nodes, then relies on rollback, compensation, and normalization logic to repair invalid states. This couples drag, resize, selection, and export semantics too tightly.

重构方向应该是：放弃“用单一 containment 控制器兜住全部 lane/pool 行为”的思路，转为“语义模型、交互约束、布局修复、导出同步”四层分离。

The redesign direction should be to abandon the idea of using one containment controller to cover all lane/pool behavior, and instead separate the system into four layers: semantic model, interaction constraints, layout repair, and export synchronization.

## 替换策略 / Replacement Policy

如果目标不是“兼容演进”，而是“彻底摆脱旧逻辑包袱”，那么本方案应按替换式重构执行，而不是按兼容式重构执行。

If the goal is not “compatible evolution” but “fully dropping old logic baggage”, then this plan should be executed as a replacement refactor rather than a compatibility refactor.

替换式重构的原则如下：

The principles of replacement refactoring are:

1. 任何旧逻辑如果不能明确映射到新架构中的某一层，就不保留。
2. 任何仅为修补旧 containment 状态机而存在的分支、缓存、回退标记，默认删除。
3. 任何把 X6 视觉 parent 当成 BPMN 语义来源的辅助函数，默认删除或降级为纯 UI 工具。
4. 任何同时承担“交互控制 + 语义修复 + 布局补偿”多重职责的旧模块，都应拆解后重写，而不是继续搬运。

1. If a piece of legacy logic cannot be mapped clearly to one layer in the new architecture, do not keep it.
2. Any branch, cache, or rollback marker that exists only to patch the old containment state machine should be deleted by default.
3. Any helper that treats the X6 visual parent as BPMN semantic truth should be deleted or downgraded into a pure UI helper.
4. Any legacy module that mixes interaction control, semantic repair, and layout compensation should be decomposed and rewritten instead of being carried forward.

换句话说，这份文档的默认立场不是“旧逻辑尽量复用”，而是“旧逻辑只有在新架构中有清晰位置时才允许迁移”。

In other words, the default stance of this document is not “reuse as much legacy logic as possible”, but “legacy logic may migrate only when it has a clear place in the new architecture”.

## 名称规范 / Naming Conventions

如果目标是彻底摆脱旧逻辑包袱，那么术语也必须一起收敛。命名不只是文案问题，它决定团队在讨论“视觉壳”“语义容器”“成员关系”时是否还会混淆。

If the goal is to fully drop the old logic baggage, terminology must converge as well. Naming is not only a wording issue; it determines whether the team still confuses the visual shell, the semantic container, and the membership relation.

命名原则如下：

The naming rules are:

1. BPMN 语义层统一使用 `participant`，不再把语义对象命名为 `pool`。
2. 视觉层如需强调外壳，可使用 `participant shell`，而不是继续把外壳和语义对象都统称为 `pool`。
3. 总体能力、模块和架构名统一使用 `swimlane`，避免让 `pool` 误代表整个子系统。
4. `pool` 仅允许作为历史别名出现在迁移注释、兼容常量或用户可见文案中，不再作为新架构的一等命名。

1. Use `participant` consistently in the BPMN semantic layer; do not name semantic objects as `pool` anymore.
2. When the visual shell must be emphasized, use `participant shell` rather than calling both the shell and the semantic object `pool`.
3. Use `swimlane` for subsystem, module, and architecture names so that `pool` does not incorrectly stand in for the whole model.
4. `pool` is allowed only as a historical alias in migration notes, compatibility constants, or user-facing wording; it is no longer a first-class name in the new architecture.

建议采用以下命名映射：

Use the following naming map:

| 旧称呼 | 新称呼 | 用途 |
|---|---|---|
| Pool | Participant | BPMN 语义对象 |
| Pool 外壳 | ParticipantShell | 图上的视觉壳 |
| Pool/Lane 系统 | Swimlane subsystem | 模块、架构、行为分组 |
| Pool containment | Swimlane policy | 交互约束与边界策略 |
| Pool resize | Swimlane resize | Pool 与 Lane 共用 resize 主链 |

| Old name | New name | Usage |
|---|---|---|
| Pool | Participant | BPMN semantic object |
| Pool shell | ParticipantShell | Visual shell on the graph |
| Pool/Lane system | Swimlane subsystem | Modules, architecture, behavior grouping |
| Pool containment | Swimlane policy | Interaction constraints and boundary policy |
| Pool resize | Swimlane resize | Shared resize pipeline for Participant and Lane |

对代码命名的直接要求如下：

The direct naming requirements for code are:

1. 新增模块不再使用 `pool-*` 前缀。
2. 新增类型、接口、函数名优先使用 `participant`、`swimlane`、`laneMembership`、`processRef`。
3. 现有 `BPMN_POOL` 若暂时保留，只能视为兼容常量，并应在文档与后续重构中明确其语义等价于 `participant`。

1. New modules must not use the `pool-*` prefix anymore.
2. New types, interfaces, and functions should prefer `participant`, `swimlane`, `laneMembership`, and `processRef`.
3. If `BPMN_POOL` remains temporarily, it should be treated only as a compatibility constant, and the documentation plus follow-up refactors should make clear that it is semantically equivalent to `participant`.

## bpmn-js 参考模型 / bpmn-js Reference Model

### 1. Participant 是泳道系统的根，不是普通容器 / Participant Is the Swimlane Root, Not a Generic Container

在 bpmn-js 中，`Participant` 在视觉上是 Pool，在交互上和 Lane 共用一套 resize 与 lane command 体系，在语义上通过 `processRef` 连接到真正承载 `flowElements` 与 `laneSets` 的 `Process`。

In bpmn-js, `Participant` is the Pool visually, shares the same resize and lane-command system as Lane in interactions, and connects semantically through `processRef` to the `Process` that actually owns `flowElements` and `laneSets`.

这意味着 `Participant` 不是“父节点里直接装着 Lane 与普通节点”的简单容器，而是“视觉壳 + 过程语义入口”的复合节点。

That means `Participant` is not a simple container whose children directly include Lanes and normal nodes, but a composite node made of a visual shell plus a process-semantic entry point.

### 2. Lane 是结构分区，不是普通父节点 / Lane Is a Structural Partition, Not a Generic Parent Node

在 bpmn-js 中，`Lane` 的语义父节点是 `LaneSet`，`LaneSet` 又挂在 `Process` 或父 `Lane` 上。`Lane` 用于表达分区和成员关系，但并不直接作为 FlowNode 的最终语义父节点。

In bpmn-js, the semantic parent of a `Lane` is a `LaneSet`, and that `LaneSet` is attached to a `Process` or a parent `Lane`. A `Lane` expresses partitioning and membership, but it is not the final semantic parent of a FlowNode.

这意味着把 FlowNode 直接导出成某个 Lane 的子元素，在 BPMN 语义上是错误方向。

That means exporting a FlowNode as a direct child element of a Lane is the wrong direction semantically in BPMN.

### 3. FlowNode 与 Lane 的关系是“成员关系”，不是“语义归属” / The FlowNode-to-Lane Relation Is Membership, Not Semantic Ownership

在 bpmn-js 中，FlowNode 视觉上可以位于某个 Lane 内，但语义上仍然属于 `Process` 或 `SubProcess` 的 `flowElements`。Lane 与 FlowNode 的联系通过 `Lane.flowNodeRef` 和 `FlowNode.lanes` 双向维护。

In bpmn-js, a FlowNode may visually sit inside a Lane, but semantically it still belongs to the `flowElements` of a `Process` or `SubProcess`. The relation between Lane and FlowNode is maintained through `Lane.flowNodeRef` and `FlowNode.lanes` in both directions.

这意味着图上的嵌套关系只能作为 UI 呈现和命中辅助，不能直接等价成 BPMN 语义树。

That means nesting on the graph can only serve UI presentation and hit-testing; it cannot be treated as the BPMN semantic tree directly.

### 4. Lane 不参与自由拖拽 / Lane Does Not Participate in Free Dragging

bpmn-js 规则层明确禁止包含 Lane 的移动操作。Lane 的主要交互路径是专用命令：`lane.add`、`lane.split`、`lane.resize`。这说明 Lane 被设计成结构节点，而不是一般图元。

The bpmn-js rule layer explicitly blocks move operations that include a Lane. The main Lane interaction paths are dedicated commands: `lane.add`, `lane.split`, and `lane.resize`. This shows that a Lane is designed as a structural node rather than a general-purpose shape.

这意味着我们不应该继续优化“Lane 如何拖得更稳”，而是应该直接禁止这条交互路径。

That means we should stop trying to make Lane dragging more stable and instead block that interaction path directly.

### 5. Participant 与 Lane 共用一条 resize 主链 / Participant and Lane Share One Resize Pipeline

bpmn-js 在 resize 结束时会把 `Participant` 和 `Lane` 都重定向到 `modeling.resizeLane`，而不是让 Pool 走一套、Lane 走另一套。这是因为它们都属于泳道布局体系。

bpmn-js redirects both `Participant` and `Lane` to `modeling.resizeLane` at resize end instead of giving Pool one path and Lane another. That is because both belong to the same swimlane layout system.

这意味着插件里也不应维持“Pool resize 后再补一次 compact，Lane resize 后再走另一套修复”的双轨设计。

That means the plugin should not keep a split design where Pool resize later triggers one compensation path while Lane resize triggers another.

## X6 与 BPMN 规范可行性 / Feasibility Against X6 and BPMN

先说结论：这套重构方向在 X6 能力边界内可以实现，在 BPMN 规范语义上也站得住，但两边支持的范围不同。BPMN 规范支持的是语义结构，X6 支持的是交互壳层；两者之间的语义桥接必须由插件自己的 swimlane 语义层承担。

The short conclusion is that this redesign is implementable within X6 capabilities and is also defensible against BPMN semantics, but the two sides support different things. BPMN supports the semantic structure, while X6 supports the interaction shell; the semantic bridge between them must be provided by the plugin's own swimlane semantic layer.

### 规范侧可行性 / BPMN-Side Feasibility

以下结论可以直接得到 BPMN 2.0 规范支持：

The following conclusions are directly supported by the BPMN 2.0 specification:

1. `participant` 通过 `processRef` 指向其在 Collaboration 中展示的 Process，因此 Participant 适合作为泳道系统的语义入口，而不是普通图形容器。该点可由规范中 Participant 的 `processRef: Process [0..1]` 属性说明支持。
2. `Lane` 是 Process 内的子分区，规范 §9.2.2 与 §10.7 原文为 “A Lane is a sub-partition within a Process, sometimes within a Pool”，因此 Lane 更适合作为分区结构，而不是 FlowNode 的语义父节点。
3. `LaneSet` 是一个或多个 Lane 的容器，且 Process 可以包含一个或多个 LaneSet；同时 Table 10.134 与 Table 10.135 给出了 `childLaneSet` 和 `flowNodeRefs`。这直接支持“Lane 层级”和“FlowNode 成员关系”分开建模。
4. 规范 §10.7 明确写出 “BPMN does not specify the usage of Lanes”，因此很多业务限制不能写成规范要求，只能写成当前产品策略或实现约束。
5. 规范 §9.3 明确要求 Message Flow 连接两个独立的 Pools，且不得连接同一 Pool 内的两个对象。这支持把 Participant 边界继续作为协作边界看待。

1. A `participant` points to the displayed Process in a Collaboration through `processRef`, so Participant is a valid semantic entry for the swimlane system rather than a generic shape container. This is supported by the Participant attribute definition `processRef: Process [0..1]`.
2. In §9.2.2 and §10.7, a `Lane` is “a sub-partition within a Process, sometimes within a Pool”, so Lane is better modeled as a partition structure rather than as the semantic parent of FlowNodes.
3. A `LaneSet` is the container for one or more Lanes, and a Process can contain one or more LaneSets; Table 10.134 and Table 10.135 also define `childLaneSet` and `flowNodeRefs`. This directly supports modeling Lane hierarchy separately from FlowNode membership.
4. §10.7 explicitly says “BPMN does not specify the usage of Lanes”, so many business restrictions must not be written as BPMN requirements and should instead be described as product policy or implementation constraints.
5. Specification §9.3 explicitly requires Message Flow to connect two separate Pools and forbids connecting two objects within the same Pool. This supports continuing to treat the Participant boundary as the collaboration boundary.

规范侧也有明确边界：BPMN 规范没有定义 Lane 是否允许自由拖拽、Pool 与 Lane 应如何 resize、拖拽过程中是否允许预览补偿等交互细节。因此“Lane 禁止自由拖拽”“resize 结束后再统一收敛”等结论，应写成实现策略，而不是伪装成规范条文。

The specification also has clear limits: BPMN does not define whether a Lane may be freely dragged, how Pool and Lane should resize, or whether live compensation should happen during dragging. Therefore conclusions such as “Lane free-drag is disabled” and “structural convergence happens only after resize ends” must be written as implementation strategy rather than disguised as normative BPMN rules.

### X6 侧可行性 / X6-Side Feasibility

以下结论可以直接得到 X6 实现支持：

The following conclusions are directly supported by the X6 implementation:

1. `interacting` 可以是按视图动态计算的函数或对象，`nodeMovable` 可以针对指定节点类型返回 `false`。这意味着 Lane 自由拖拽可以在交互入口直接禁用，而不是靠拖完再回退。
2. 单节点拖拽和 selection move 都会读取 `translating.restrict`，因此普通 FlowNode 的边界策略可以用同一套 restrict 计算，不需要维护两套平行规则。
3. Transform 会按节点动态解析 resizing 选项，并支持 `minWidth` 与 `minHeight`，因此 Participant 与 Lane 的内容最小尺寸可以在交互主链里被原生限制。
4. X6 的 embedding 提供的是 `findParent` 与 `validate` 这类视觉父子关系能力，它适合做命中、吸附和视觉嵌套，但不能表达 `processRef`、`laneSet`、`flowNodeRefs` 这类 BPMN 语义关系。

1. `interacting` can be a dynamically computed function or object per view, and `nodeMovable` can return `false` for specific node types. This means Lane free-drag can be blocked at the interaction entry point instead of being rolled back afterwards.
2. Both single-node drag and selection move read `translating.restrict`, so the boundary policy for normal FlowNodes can use one shared restrict calculation rather than maintaining two parallel rule systems.
3. Transform parses resizing options dynamically per node and supports `minWidth` and `minHeight`, so the minimum content size of Participant and Lane can be enforced natively in the interaction pipeline.
4. X6 embedding provides visual parent-child capabilities such as `findParent` and `validate`. It is suitable for hit-testing, snapping, and visual nesting, but it cannot express BPMN semantic relations such as `processRef`, `laneSet`, and `flowNodeRefs`.

因此，X6 的能力结论应当写得很明确：它足以承载新的交互层和几何层，但它不会替我们提供 BPMN 泳道语义。也就是说，“这套方案能不能做”的答案是能做；“是不是只靠 X6 就能做完”的答案是否定的。

Therefore the X6-side conclusion should be stated very clearly: X6 is sufficient to support the new interaction and geometry layers, but it will not provide BPMN swimlane semantics for us. In other words, the answer to “can this architecture be implemented” is yes, while the answer to “can it be implemented by X6 alone” is no.

## 对现有插件实现的诊断 / Diagnosis of the Current Plugin

### 1. 把视觉嵌套误当成 BPMN 语义 / Visual Nesting Is Treated as BPMN Semantics

当前 `packages/x6-plugin-bpmn` 中，Pool、Lane、普通节点大量依赖 X6 `embed/unembed` 关系驱动 containment、校验和导出判断。这对于 UI 命中是方便的，但会把“图上在哪个容器里面”误写成“语义上属于哪个 BPMN 容器”。

In the current `packages/x6-plugin-bpmn`, Pool, Lane, and normal nodes rely heavily on X6 `embed/unembed` relations to drive containment, validation, and export decisions. That is convenient for UI hit-testing, but it incorrectly turns “which visual container a node is inside” into “which BPMN semantic container it belongs to”.

### 2. 把 containment 当成总控器 / Containment Is Used as a Master Controller

当前的 `pool-containment.ts` 不仅在做边界限制，也在负责 selection 收尾、非法回退、层级修正、Lane 尺寸兜底、首个 Pool 自动包裹等职责。文件过度集中，意味着任何拖拽或 resize 问题最后都会被修成更多的分支与状态。

The current `pool-containment.ts` is not only handling boundary limits; it also handles selection cleanup, rollback, layer normalization, Lane size fallback, and first-Pool auto-wrap. The file is too centralized, which means every drag or resize problem is eventually “fixed” with more branches and more state.

### 3. Pool 与 Lane 仍是两套局部策略 / Pool and Lane Still Follow Two Local Strategies

虽然当前已经引入 `patchLaneInteracting`、`patchTranslatingRestrict` 和 `patchTransformResizing`，但整体上仍保留“Pool containment 修一套，Lane management 修一套”的结构。这比以前更接近正确方向，但还没有形成统一的泳道子系统。

Although the current implementation already introduced `patchLaneInteracting`, `patchTranslatingRestrict`, and `patchTransformResizing`, the overall structure still behaves like “Pool containment fixes one path and Lane management fixes another”. This is closer to the right direction than before, but it still does not form one unified swimlane subsystem.

### 4. 现有方案不适合继续增量打补丁 / The Current Design Is Not a Good Base for Incremental Patching

如果继续沿着现有模式叠加逻辑，最终结果大概率会是：selection 单独一套规则，Pool resize 单独一套规则，Lane resize 单独一套规则，导出时再做一套语义纠偏。这种结构可运行，但不可维护。

If we keep adding logic on top of the current pattern, the likely result is that selection has its own rule system, Pool resize has another one, Lane resize has a third one, and export adds a fourth semantic-repair path. That structure can run, but it is not maintainable.

## 建议的目标架构 / Recommended Target Architecture

### 总原则 / Core Principle

新的 Lane / Pool 子系统应当围绕“泳道语义模型”组织，而不是围绕“节点 containment 修复”组织。

The new Lane / Pool subsystem should be organized around a swimlane semantic model, not around containment repair.

### 第一层：泳道语义模型 / Layer 1: Swimlane Semantic Model

建议显式引入一个内部语义层，至少维护以下概念：

Introduce an explicit internal semantic layer that maintains at least the following concepts:

| 概念 | 含义 |
|---|---|
| ParticipantShell | 图上的 Participant 外壳，映射到 BPMN `participant` |
| ProcessContext | Pool 对应的 `processRef` 语义上下文 |
| LanePartition | Lane 的分区定义，映射到 `lane` / `laneSet` |
| LaneMembership | FlowNode 到 Lane 的成员关系，而不是父子语义 |

| Concept | Meaning |
|---|---|
| ParticipantShell | The Participant shell on the graph, mapped to BPMN `participant` |
| ProcessContext | The semantic `processRef` context owned by the Pool |
| LanePartition | The partition definition of a Lane, mapped to `lane` / `laneSet` |
| LaneMembership | The membership relation from FlowNode to Lane, not semantic parenting |

这一层应成为导入、运行时同步、导出的共同依据。X6 的 `parent/children` 关系只能作为视觉辅助，不应成为唯一事实来源。

This layer should become the shared basis for import, runtime synchronization, and export. X6 `parent/children` relations may be used as visual helpers, but they must not be the only source of truth.

### 第二层：交互策略层 / Layer 2: Interaction Policy Layer

交互层建议只做四件事：

The interaction layer should do only four things:

1. `Lane` 永远不可自由拖拽。
2. 选区中只要包含 `Lane`，整次 selection move 直接禁用。
3. 普通 FlowNode 的拖拽边界由所属 Pool 内容区决定，而不是由当前视觉父节点决定。
4. `Pool` 与 `Lane` 共用一条 swimlane resize command。

1. `Lane` is never freely draggable.
2. If a selection contains any `Lane`, the whole selection move is disabled.
3. The drag bounds of a normal FlowNode are determined by the content area of its owning Pool, not by the current visual parent node.
4. `Pool` and `Lane` share one swimlane resize command.

这意味着现有 `patchLaneInteracting` 和 `patchTranslatingRestrict` 可以保留方向，但需要收敛到更明确的 policy 模块中，而不是继续扩展 `pool-containment.ts`。

That means the direction behind `patchLaneInteracting` and `patchTranslatingRestrict` can be preserved, but they should move into a clearer policy module instead of continuing to expand `pool-containment.ts`.

### Resize 抖动风险与规避 / Resize Jitter Risk and Mitigation

如果按新方案实施，`Participant` 或 `Lane` 在缩小到内容边界时，不应再出现旧方案那种明显抖动；但前提是必须彻底放弃“在 UI resize 进行过程中再次回写模型几何”的旧做法。

If the new architecture is implemented correctly, `Participant` or `Lane` should no longer show the severe jitter seen in the old design when shrinking against content bounds. However, that is true only if we fully abandon the old practice of writing geometry back into the model again while the UI resize is still in progress.

旧问题的根因不是“X6 天生会抖”，而是“X6 正在执行 resize 时，我们自己的监听器又在 `node:change:size` / `node:change:position` 中继续做 compact、normalize、restore 和兄弟节点补偿”，两套写回同时作用在同一条交互链上，结果就是互相打架。

The root cause of the old issue is not that “X6 jitters by nature”, but that while X6 is actively performing a resize, our own listeners continue to run compact, normalize, restore, and sibling compensation inside `node:change:size` / `node:change:position`. Two write paths act on the same interaction pipeline at the same time, and they fight each other.

尤其是在顶部或左侧方向 resize 时，X6 会先更新 size，再更新 position。如果业务代码在 size 变化阶段就重排 Lane 或修正 Pool，计算依据仍是旧位置，随后 position 再变一次，就会表现成跳动、来回拉扯或兄弟 Lane 错位。

This is especially problematic for top-side or left-side resize. X6 updates size first and position second. If business code rearranges Lanes or repairs the Participant at the size-change stage, it is still using the old position. When position changes afterwards, the result appears as jumping, back-and-forth dragging, or sibling Lane misalignment.

因此，新方案必须满足以下约束：

Therefore, the new design must satisfy the following rules:

1. 内容最小尺寸约束只通过 Transform 的 `minWidth` / `minHeight` 进入交互主链，不再通过 `node:change:size` 中的回退逻辑实现。
2. UI resize 进行过程中，不做 `compactLaneLayout`、成员关系重算、containment restore、兄弟 Lane 补偿等二次模型写回。
3. Pool / Lane 的统一布局修正只在 resize 结束后提交，例如 `node:resized`、命令完成阶段或显式的 swimlane resize command 收尾阶段。
4. 如果后续确实需要“拖动过程中预览兄弟 Lane 跟随”，也应使用预览层或临时计算结果，而不是在 `node:resizing` 中持续修改正式模型。

1. Minimum content-size constraints must enter the interaction pipeline only through Transform `minWidth` / `minHeight`, not through rollback logic inside `node:change:size`.
2. While a UI resize is in progress, do not perform `compactLaneLayout`, membership recomputation, containment restore, or sibling Lane compensation as secondary model writes.
3. Unified Participant / Lane layout repair must be committed only after resize ends, such as in `node:resized`, at command completion, or at the end of an explicit swimlane resize command.
4. If we later need live preview of sibling Lane movement during drag, it should be implemented as a preview layer or temporary computed state, not by continuously mutating the committed model during `node:resizing`.

在这个约束下，X6 负责做“把拖拽手柄限制在最小尺寸以上”，业务层只负责做“交互结束后的结构收敛”。这样两层不会争抢同一次 resize 的控制权，抖动问题才会真正消失。

Under these constraints, X6 is responsible for “keeping the resize handle above the minimum size”, and the business layer is responsible only for “structural convergence after the interaction ends”. The two layers no longer compete for control of the same resize, which is the condition required to eliminate jitter for real.

结论上，这个风险仍然存在于错误实现里，但不属于新架构本身。只要我们不再把旧的 `node:change:size` 回写路径带进新方案，它就不是必须接受的 X6 缺陷。

In short, the risk still exists in a wrong implementation, but it is not inherent to the new architecture itself. As long as we do not carry the old `node:change:size` write-back path into the new design, it is not an unavoidable X6 defect.

### 第三层：泳道布局层 / Layer 3: Swimlane Layout Layer

布局层应只负责几何，不负责语义判断。它的职责应当包括：

The layout layer should only handle geometry and not semantic decisions. Its responsibilities should include:

1. Pool 内容区计算。
2. Lane 紧密排列与兄弟 Lane 补偿。
3. Swimlane 最小尺寸计算。
4. 首个 Pool 自动包裹等纯布局行为。

1. Pool content-area calculation.
2. Tight Lane packing and sibling Lane compensation.
3. Swimlane minimum-size calculation.
4. Pure layout behavior such as first-Pool auto-wrap.

现有 `lane-management.ts` 和 `swimlane-layout.ts` 的不少逻辑可以保留，但必须禁止它们再顺手做语义归属修复。

Much of the current logic in `lane-management.ts` and `swimlane-layout.ts` can stay, but they must stop repairing semantic ownership as a side effect.

这一层还应遵守一个附加原则：几何计算函数尽量保持纯函数化，例如内容边界、最小尺寸、兄弟 Lane 补偿、selection restrict 区域都应由可复用的纯计算函数给出，而不是分散在事件监听器里临时拼装。

This layer should also follow an additional principle: geometry calculations should stay as pure as possible. Content bounds, minimum size, sibling-Lane compensation, and selection restrict areas should come from reusable pure calculation functions rather than being assembled ad hoc inside event listeners.

### 第四层：成员关系同步层 / Layer 4: Membership Synchronization Layer

建议新增独立的 lane membership 同步模块，在以下时机统一重算：

Add a dedicated lane-membership synchronization module that recomputes membership at the following points:

1. 导入完成后。
2. FlowNode move / resize 完成后。
3. Lane resize 完成后。
4. Pool / Lane 新增、删除、分裂完成后。

1. After import completes.
2. After FlowNode move / resize completes.
3. After Lane resize completes.
4. After Pool / Lane add, delete, or split completes.

重算的结果不是“重新决定节点 parent”，而是更新内部 membership model，并为导出准备 `flowNodeRef` 数据。

The result of recomputation should not be “reassign node parent”. It should update the internal membership model and prepare `flowNodeRef` data for export.

### 第五层：导入导出适配层 / Layer 5: Import/Export Adaptation Layer

导入时，应把 BPMN 的 `participant -> processRef -> laneSets -> flowNodeRef` 结构还原成图上的三种关系：

On import, the BPMN structure `participant -> processRef -> laneSets -> flowNodeRef` should be restored into three graph-level relations:

1. ParticipantShell 的视觉外壳。
2. LanePartition 的层级结构。
3. FlowNode 与 Lane 的成员关系。

1. The visual shell of the ParticipantShell.
2. The hierarchy of LanePartition objects.
3. The membership relation between FlowNode and Lane.

导出时，应反向生成 BPMN 语义：FlowNode 回到 `Process.flowElements` 或 `SubProcess.flowElements`，Lane 的成员列表通过 `flowNodeRef` 输出，而不是靠 X6 parent 推断。

On export, BPMN semantics should be produced in the opposite direction: FlowNodes go back to `Process.flowElements` or `SubProcess.flowElements`, and Lane membership is emitted via `flowNodeRef` instead of being inferred from X6 parent relations.

## 推荐的代码组织 / Recommended Code Organization

如果采用替换式重构，建议直接以以下模块为目标结构，旧模块只作为迁移参考，不作为保留对象。

If a replacement-style refactor is chosen, the following modules should be treated as the target structure directly. Legacy modules are only migration references, not preservation targets.

| 建议模块 | 主要职责 |
|---|---|
| `src/behaviors/swimlane-policy.ts` | `interacting`、selection move 禁止、`translating.restrict` |
| `src/behaviors/swimlane-resize.ts` | Pool / Lane 共用 resize command 与最小尺寸约束 |
| `src/behaviors/swimlane-layout.ts` | 几何计算与紧凑布局 |
| `src/core/swimlane-membership.ts` | Lane 成员关系模型与重算 |
| `src/import/swimlane-import.ts` | Lane / Pool 语义导入装配 |
| `src/export/swimlane-export.ts` | `laneSet`、`flowNodeRef`、`participant/processRef` 导出 |

| Proposed module | Primary responsibility |
|---|---|
| `src/behaviors/swimlane-policy.ts` | `interacting`, selection-move blocking, `translating.restrict` |
| `src/behaviors/swimlane-resize.ts` | Shared Pool/Lane resize command and minimum-size constraints |
| `src/behaviors/swimlane-layout.ts` | Geometry calculation and compact layout |
| `src/core/swimlane-membership.ts` | Lane membership model and recomputation |
| `src/import/swimlane-import.ts` | Lane/Pool semantic assembly on import |
| `src/export/swimlane-export.ts` | Export of `laneSet`, `flowNodeRef`, and `participant/processRef` |

这套模块边界也意味着可以主动删除旧文件中的无关逻辑，而不是为了“平滑迁移”继续让它们并存。

These module boundaries also mean that unrelated logic inside legacy files can be removed proactively instead of being kept around for a “smooth migration”.

旧的 `pool-containment.ts`、`lane-management.ts`、`x6-pool-containment-redesign.md` 这类名称，只应作为迁移期遗留名出现，不应再生成新的同类命名。

Legacy names such as `pool-containment.ts`, `lane-management.ts`, and `x6-pool-containment-redesign.md` should exist only as migration leftovers and must not inspire new names of the same kind.

## 补充落地建议 / Additional Delivery Recommendations

除了上面的目标分层，还建议把以下工程策略一起写成重构边界，避免方案落地时再次滑回旧结构。

Besides the target layering above, the following engineering strategies should also be written down as part of the refactor boundary so that the implementation does not slide back into the old structure.

1. 预览态与提交态分离：拖拽和 resize 过程只做预览和约束，不做正式语义提交；membership 重算、lane 紧凑布局、导出语义修正只在交互结束或命令收尾时提交。
2. 命令边界统一：Participant resize、Lane resize、add lane、split lane、delete lane、membership recompute 都应有清晰的命令完成边界，而不是散落在 `node:change:*` 监听器里逐步堆叠。
3. 视觉 parent 与语义来源强制分离：即使 X6 图上保留 embed 关系，也只能把它当作 UI 辅助缓存，任何 BPMN 导出与业务判断都必须优先读取 swimlane semantic model。
4. 先列删除清单再动手迁移：在真正改代码前，先明确旧 `pool-containment.ts` 中哪些职责会被删除、哪些会迁到新模块、哪些会降级为纯 UI 工具，避免迁移过程中把旧状态机悄悄带过去。
5. 命名迁移分阶段执行：兼容常量和用户可见文案允许短期保留 `pool`，但内部类型、模块、接口、事件和测试标题应先完成 `participant` / `swimlane` 收敛。

1. Separate preview state from committed state: drag and resize should do preview plus constraints only, not final semantic commits; membership recomputation, lane compaction, and export-semantic repair should commit only when the interaction ends or the command tail completes.
2. Unify command boundaries: Participant resize, Lane resize, add lane, split lane, delete lane, and membership recomputation should all have explicit command completion boundaries rather than being gradually layered through scattered `node:change:*` listeners.
3. Enforce a hard split between visual parent and semantic source: even if X6 embed relations remain on the graph, they should be treated only as UI helper cache; BPMN export and business decisions must read the swimlane semantic model first.
4. Create a delete list before the migration starts: explicitly decide which responsibilities in the old `pool-containment.ts` will be removed, which will move to new modules, and which will degrade into pure UI helpers, so that the legacy state machine is not quietly carried forward.
5. Execute naming migration in phases: compatibility constants and user-facing wording may keep `pool` temporarily, but internal types, modules, interfaces, events, and test titles should converge to `participant` / `swimlane` first.

## 迁移阶段建议 / Suggested Migration Phases

### Phase 1: 建立新骨架，不复用旧控制器 / Build the New Skeleton Without Reusing the Old Controller

先直接建立 `swimlane-policy`、`swimlane-resize`、`swimlane-membership` 的目标模块，不把 `pool-containment.ts` 当作核心入口继续扩展。

Start by creating the target modules `swimlane-policy`, `swimlane-resize`, and `swimlane-membership` directly. Do not keep expanding `pool-containment.ts` as the core entry point.

这一阶段允许复制必要的几何计算，但不允许复制旧状态机结构。

At this stage, it is acceptable to copy necessary geometry calculations, but not to copy the legacy state-machine structure.

### Phase 2: 切换导入、运行时同步、导出到新语义模型 / Switch Import, Runtime Sync, and Export to the New Semantic Model

当 membership model 可工作后，优先让导入、运行时同步、导出都切到新模型。只要新模型已经接管某条链路，旧链路上的等价推断逻辑就应立即删除。

Once the membership model works, move import, runtime synchronization, and export to the new model first. As soon as the new model owns a pipeline, the equivalent inference logic in the legacy path should be deleted immediately.

### Phase 3: 合并 Pool 与 Lane 的 resize 主链 / Merge Pool and Lane Resize into One Pipeline

引入显式的 swimlane resize command，让 Pool 和 Lane 走同一条布局与最小尺寸链路，并删除旧的双轨补偿逻辑。

Introduce an explicit swimlane resize command so that Pool and Lane use one shared layout and minimum-size pipeline, then delete the old dual-track compensation logic.

### Phase 4: 删除旧 containment 外壳 / Remove the Legacy Containment Shell

当新 policy、membership、resize 三层都已接管后，旧 `pool-containment.ts` 中无法映射到新架构的逻辑应整体删除，而不是保留成兜底遗产。

Once the new policy, membership, and resize layers have taken over, the logic inside the old `pool-containment.ts` that cannot be mapped into the new architecture should be removed entirely instead of being preserved as fallback legacy.

如果最终只剩极少量纯 UI 约束逻辑，则应把它迁移到新的 `swimlane-policy.ts`，而不是继续保留原文件。

If only a very small amount of pure UI-constraint logic remains at the end, it should move into `swimlane-policy.ts` rather than keeping the original file alive.

## 不建议继续做的事 / What Should Not Continue

1. 不建议继续把 Lane 当成普通可拖拽图元优化。
2. 不建议继续把 X6 parent 关系当成 BPMN 语义来源。
3. 不建议继续在 `pool-containment.ts` 中叠加 selection 状态机。
4. 不建议继续让 Pool resize 与 Lane resize 走两套不同的修复链。
5. 不建议为了减少改动量而保留与新架构无关的旧逻辑壳层。

1. Do not continue optimizing Lane as a generic draggable shape.
2. Do not continue treating X6 parent relations as the BPMN semantic source.
3. Do not continue embedding a selection state machine inside `pool-containment.ts`.
4. Do not continue using separate repair pipelines for Pool resize and Lane resize.
5. Do not keep unrelated legacy shell logic merely to reduce the size of the refactor.

## 测试设计建议 / Test Design Recommendations

后续实现这套架构时，测试不应只验证“节点还在容器里”，而应验证更接近业务和语义的结果。

When implementing this architecture, tests should not only verify that “a node remains inside a container”. They should assert results that are closer to business behavior and BPMN semantics.

建议至少覆盖以下场景：

Cover at least the following scenarios:

1. FlowNode 移入、移出 Lane 后，membership model 与导出 `flowNodeRef` 同步更新。
2. 选区包含 Lane 时，selection move 被直接拒绝。
3. Pool resize 与 Lane resize 共享同一套最小尺寸和兄弟补偿结果。
4. 导入包含 `participant + processRef + laneSet + flowNodeRef` 的 XML 后，图状态与导出回写保持稳定。
5. 直接拖拽与 selection move 分别验证，确保两条交互路径都遵守同一套 swimlane policy。
6. Participant 或 Lane 缩小到内容边界时，不出现抖动、来回拉扯或兄弟 Lane 错位，并通过浏览器快照回归固定下来。

1. After a FlowNode enters or leaves a Lane, the membership model and exported `flowNodeRef` update together.
2. When a selection contains a Lane, selection move is rejected directly.
3. Pool resize and Lane resize share the same minimum-size and sibling-compensation behavior.
4. After importing XML that contains `participant + processRef + laneSet + flowNodeRef`, graph state and exported round-trip output remain stable.
5. Direct drag and selection move should be validated separately so that both interaction paths obey the same swimlane policy.
6. When a Participant or Lane shrinks to the content boundary, there should be no jitter, tug-of-war, or sibling-Lane misalignment, and that behavior should be fixed by browser snapshot regression.

## 最终判断 / Final Judgment

对 `x6-plugin-bpmn` 来说，更合理的方向不是继续修补现有 containment 体系，而是按照 bpmn-js 的思路重建一套“ParticipantShell + ProcessContext + LanePartition + LaneMembership”的泳道子系统。

For `x6-plugin-bpmn`, the more reasonable direction is not to keep patching the current containment system, but to rebuild the swimlane subsystem around the bpmn-js model of `ParticipantShell + ProcessContext + LanePartition + LaneMembership`.

这条路线与 BPMN 规范并不冲突，X6 也具备实现它所需的交互能力。真正需要我们自己负责的，不是“如何继续修旧 containment”，而是“如何把 X6 的交互壳层和 BPMN 的语义结构之间的桥接层设计清楚”。

This direction does not conflict with the BPMN specification, and X6 has the interaction capabilities required to implement it. What we must design ourselves is not “how to keep repairing the old containment layer”, but “how to make the bridge between the X6 interaction shell and the BPMN semantic structure explicit and maintainable”.

如果选择这条路，就应接受一个前提：与该架构无关的旧 containment 逻辑不是“以后再清理”的技术债，而是“应在重构过程中主动删除”的阻碍项。

If this direction is chosen, one premise should be accepted: legacy containment logic that does not belong in the new architecture is not merely “technical debt to clean up later”, but an active obstacle that should be removed during the refactor.

只有这样，拖拽、resize、导入、导出和语义一致性才会真正收敛到同一个架构中心。

Only then can drag, resize, import, export, and semantic consistency truly converge around one architectural center.