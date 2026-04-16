# BPMN 编辑器回归问题排查与实现记录 / BPMN Editor Regression Investigation and Implementation Notes

## 文档定位

本文档用于内部研发对齐本轮 BPMN 编辑器 6 类问题的排查结论、方案设计、已落地实现和当前未收敛风险。

这不是对外用户文档，也不是最终发布说明。重点是把“问题为什么发生”“这轮改了什么”“哪些点还需要继续验证”记录清楚，避免后续继续在同一类问题上重复试错。

## 问题总览

| 编号 | 问题现象 | 主要根因 | 方案方向 | 当前状态 |
| --- | --- | --- | --- | --- |
| 1 | Pool 或 Lane 从上边、左上角向内 resize 后，Pool 外框、Lane 分隔线和兄弟 Lane 几何容易错位 | Lane resize 提交阶段只写局部矩形，没有先把 Pool 外边界变化投影回兄弟 Lane；preview 与 commit 也存在收敛差异 | 在 Lane commit 阶段先计算新的 Pool 边界，再把外边界变化同步到贴边 Lane，最后统一 compact | 已部分实现；单元测试已补，浏览器回归仍未完全收敛 |
| 2 | 节点拖入 Pool 空白区、Lane、子流程或边界宿主时，不同 demo 的行为不一致 | demo 侧各自维护容器判断和边界宿主判断，规则分叉 | 抽出共享 embedding/drop helper，并在 drop 前先解析合法宿主或容器，再决定是否 addNode | 已实现于 example、dialect-demo、smartengine-demo |
| 3 | 边界事件直接拖拽、选框拖拽、宿主联动时附着关系不稳定，默认脱离语义不一致 | 旧逻辑主要依赖直接拖拽事件，未覆盖 selection drag 或位置变更路径；默认脱离距离也过于宽松 | 为边界事件增加 position-change 重吸附，设置有限默认 detachDistance，并增加自同步保护 | 核心逻辑已实现，单元测试已补，浏览器路径仍有失败 |
| 4 | 非法连线时报错信息过于笼统，难以定位是开始事件、结束事件还是边界事件约束 | validator 只返回通用分类错误，未按节点类别生成可解释提示 | 为入线和出线分别生成节点类别感知的原因文案 | 已实现并补充规则测试 |
| 5 | 删除 Pool 后，其 Lane 与内部任务的级联删除行为缺少稳定回归保障 | 行为依赖 X6 embed 删除链，浏览器回归覆盖不足，实际交互路径尚未稳定验证 | 保持 Pool/Lane/内部节点嵌套关系一致，并补充浏览器回归 | 已补浏览器用例，但当前浏览器回归仍失败，尚不能标记为完全解决 |
| 6 | demo 侧存在过多自定义 BPMN 放置和嵌套规则，主库能力没有被复用 | 示例工程长期复制主库逻辑，导致交互语义漂移 | 将宿主查找、容器查找、drop 校验下沉到插件 helper，并逐个 demo 替换 | 已覆盖 example、dialect-demo、smartengine-demo；approval-flow 仍是独立实现路径，未纳入本轮重构 |

## 本轮已落地实现

### 1. 主库新增共享 embedding / drop helper

新增 `packages/x6-plugin-bpmn/src/behaviors/embedding.ts`，统一提供以下能力：

- `findBoundaryAttachHost`
- `findContainingBpmnParent`
- `resolveContainingBpmnParents`
- `resolveBpmnEmbeddingTargets`

这一步的目标不是增加新规则，而是把原本散落在 demo 里的判断逻辑收回主库，形成唯一的 BPMN 放置入口。

### 2. 边界事件附着行为增强

在 `packages/x6-plugin-bpmn/src/behaviors/boundary-attach.ts` 中，本轮做了三类调整：

- 导出默认宿主集合，避免外部再硬编码一份宿主列表。
- 将默认 `detachDistance` 调整为 `48`，使“明显拖离宿主才解除附着”成为默认策略。
- 新增 `node:change:position` 路径的重吸附逻辑，覆盖选框拖拽或程序化位置变化场景。

同时增加了边界事件自同步标记，避免内部 setPosition 再次触发自身监听导致循环修正。

### 3. Pool containment 在新增节点时做延后收敛

在 `packages/x6-plugin-bpmn/src/behaviors/pool-containment.ts` 中，新增节点后不再立即假设父链已经稳定，而是在动画帧内执行一次延后 settle：

- 先尝试找到合法父容器并 embed。
- 再执行位置与尺寸 clamp。
- 如果存在 Pool 且当前节点属于必须受 containment 约束的流程节点，但最终仍无合法容器，则直接报违规并移除节点。

这一步主要解决“先 addNode，再发现位置不合法”的中间脏状态问题。

### 4. Lane resize 提交阶段先投影 Pool 边界变化

在 `packages/x6-plugin-bpmn/src/behaviors/swimlane-resize.ts` 中，Lane resize 的 commit 流程被调整为：

- 先根据 Lane preview 推导新的 Pool 矩形。
- 把 Pool 外边界变化通过 `syncPoolLanes` 投影回兄弟 Lane。
- 再写入当前 Lane 与兄弟 Lane 几何。
- 最后执行 `compactLaneLayout`。

这一步是对问题 1 的核心修复尝试，但浏览器路径仍显示存在残余不一致，需要继续收敛 preview / commit 结果。

### 5. 连线报错信息细化

在 `packages/x6-plugin-bpmn/src/rules/validator.ts` 中，增加了边类型说明和节点类别感知文案生成：

- `describeEdgeShape`
- `buildOutgoingTypeReason`
- `buildIncomingTypeReason`

当前开始事件、结束事件、边界事件在非法连线时会返回更具体的中文提示，而不是统一的类别不允许错误。

### 6. demo 接入方式统一

以下 demo 已改为优先复用主库 helper，而不是自行判断宿主和容器：

- `packages/example/src/components/GraphCanvas.vue`
- `packages/dialect-demo/src/components/GraphCanvas.vue`
- `packages/smartengine-demo/src/components/GraphCanvas.vue`

本轮改动重点包括：

- `embedding.findParent` 统一走 `resolveBpmnEmbeddingTargets`
- drop 时先 `createNode`，再判断宿主或容器是否合法，最后才 `addNode`
- 边界事件如果找不到宿主，直接拒绝放置
- 在存在 Pool 的前提下，普通流程节点如果没有合法容器，直接拒绝放置

`packages/approval-flow` 仍然通过自定义 `flow.ts` 和 `App.vue` 维护图初始化与交互，不在本轮 helper 收敛覆盖范围内。

## 测试与验证结果

### 已执行命令

- 仓库根目录：`pnpm run typecheck`
- 插件目录：`npm run test`
- 插件目录：`npm run test:coverage`
- 插件目录：`npm run test:browser`

### 当前结果

- `pnpm run typecheck`：通过。
- `packages/x6-plugin-bpmn npm run test`：通过，`59` 个测试文件、`1643` 个测试用例全部通过。
- `packages/x6-plugin-bpmn npm run test:coverage`：所有测试通过，但全局覆盖率阈值失败。
- `packages/x6-plugin-bpmn npm run test:browser`：构建通过，浏览器回归 `55 passed / 25 failed`。

### 当前覆盖率阈值结果

`npm run test:coverage` 的当前全局结果为：

- Statements: `96.71%`
- Branches: `93.32%`
- Functions: `99.19%`
- Lines: `96.69%`

这说明“实现可以运行并通过现有逻辑测试”与“仓库要求的 100% 覆盖率重新达标”仍然是两件事，后者还没有恢复。

## 当前未收敛项

### 1. 浏览器回归仍有 25 项失败

目前失败主要集中在以下几类路径：

- containment 相关的 direct drag 和 selection drag
- 边界事件附着与宿主联动
- 删除 Pool 后级联删除 Lane 与内部任务
- 部分 swimlane resize 视觉快照
- 个别跨 Pool 连线路径

这意味着本轮改动已经覆盖了核心逻辑和部分单元路径，但真实浏览器手势链路还没有完全闭环。

### 2. 问题 1 仍属于“部分收敛”

当前实现已经把 Pool 外边界变化先投影回 Lane，但从浏览器结果看，preview ghost、提交几何和快照基线之间仍存在差异，尤其是在 top、top-left、top-right 等路径上。

### 3. 问题 5 仍不能标记为已完成

虽然已经增加“删除 Pool 时应同时删除其 Lane 与内部任务”的浏览器回归，但该用例目前仍失败，因此只能确认“问题已进入可复现、可验证状态”，不能确认“行为已经修复完毕”。

### 4. demo 清理还没有覆盖 approval-flow

本轮只统一了共享 GraphCanvas 模式下的三个 demo。`approval-flow` 仍使用独立初始化和交互代码，因此“所有 demo 完全回到主库规则”这一目标尚未完成。

## 下一步建议

1. 优先按浏览器失败聚类继续收敛 containment 与 boundary attach，因为这两类最直接对应用户反馈的问题 2、3、5。
2. 单独补覆盖率恢复工作，不要把 coverage 回补与浏览器行为修复混在同一轮里，否则回归面会继续扩大。
3. 如果要完成问题 6，下一步应评估 `approval-flow` 是否需要抽象到与 GraphCanvas 同一套接入层。

---

## Scope

This document is an internal R&D note for aligning on the investigation results, solution direction, implemented changes, and remaining risks for the six BPMN editor regressions discussed in this round.

It is not an external user guide and not a release note. The purpose is to record why each issue happened, what was changed, and which parts still need follow-up validation.

## Summary Of Issues

| ID | Symptom | Primary Cause | Solution Direction | Current State |
| --- | --- | --- | --- | --- |
| 1 | Pool or Lane resize from top or top-left causes Pool outline and sibling Lane geometry to drift apart | Lane resize commit updated only local bounds and did not first project Pool outer-boundary changes back to sibling Lanes; preview and commit also diverged | Compute the next Pool rectangle first, project the outer-boundary delta back to edge-aligned Lanes, then compact once | Partially implemented; unit coverage added, browser regressions still open |
| 2 | Dropping nodes into Pool blank areas, Lanes, subprocesses, or boundary hosts behaves differently across demos | Demo packages duplicated their own container and host resolution logic | Introduce shared embedding/drop helpers and validate the host or container before `addNode` | Implemented in example, dialect-demo, and smartengine-demo |
| 3 | Boundary-event attachment becomes unstable across direct drag, selection drag, and host-follow paths | Old logic mainly relied on direct drag events, did not cover selection drag or generic position changes, and had an overly loose default detach threshold | Add re-snapping on `node:change:position`, use a finite default `detachDistance`, and guard against self-triggered sync loops | Core logic implemented and unit-tested, browser paths still failing |
| 4 | Invalid connection messages are too generic and hard to map to start, end, or boundary-event constraints | The validator returned generic category failures instead of node-type-aware messages | Build dedicated incoming and outgoing reason messages based on node category | Implemented and covered by rule tests |
| 5 | Deleting a Pool lacks stable regression proof that its Lane and inner tasks are removed with it | The behavior depends on the X6 embed/delete chain and had insufficient browser coverage | Keep Pool/Lane/child nesting consistent and add browser regression coverage | Browser regression was added, but it still fails, so the fix is not yet confirmed |
| 6 | Demo packages contain too much custom BPMN placement and nesting logic instead of reusing plugin behavior | Demo code drifted away from the plugin over time | Move host lookup, container lookup, and drop validation into plugin helpers and replace per-demo logic incrementally | Implemented for example, dialect-demo, and smartengine-demo; approval-flow is still an independent path |

## Implemented Changes

### 1. Shared embedding and drop helpers were added to the plugin

`packages/x6-plugin-bpmn/src/behaviors/embedding.ts` now centralizes:

- `findBoundaryAttachHost`
- `findContainingBpmnParent`
- `resolveContainingBpmnParents`
- `resolveBpmnEmbeddingTargets`

The goal is not to invent new rules, but to make the plugin the single source of truth for BPMN placement decisions.

### 2. Boundary-event attachment logic was strengthened

In `packages/x6-plugin-bpmn/src/behaviors/boundary-attach.ts`, this round introduced:

- exported default host-shape sets so external code no longer needs to duplicate them
- a default `detachDistance` of `48`, so a boundary event detaches only after being dragged clearly away from the host
- re-snapping logic on `node:change:position`, which covers selection drag and programmatic position updates

It also adds a boundary-sync marker to prevent the behavior from re-entering itself while it is correcting positions.

### 3. Pool containment now performs deferred settle after node creation

In `packages/x6-plugin-bpmn/src/behaviors/pool-containment.ts`, newly added nodes are no longer assumed to have a stable parent chain immediately. Instead, an animation-frame settle now:

- tries to find and embed into a legal parent container
- clamps position and size
- removes the node if Pools exist and the node is still illegal after settlement

This targets the dirty intermediate state where a node was added first and only later discovered to be invalid.

### 4. Lane resize commit now projects Pool-boundary changes first

In `packages/x6-plugin-bpmn/src/behaviors/swimlane-resize.ts`, Lane resize commit now:

- derives the next Pool rectangle from the Lane preview
- projects Pool-boundary changes back to sibling Lanes through `syncPoolLanes`
- applies the current Lane and sibling Lane geometry
- runs `compactLaneLayout`

This is the main implementation attempt for issue 1, but browser results show that preview, commit, and visual baseline still need more alignment.

### 5. Connection validation messages are now more specific

`packages/x6-plugin-bpmn/src/rules/validator.ts` now includes:

- `describeEdgeShape`
- `buildOutgoingTypeReason`
- `buildIncomingTypeReason`

Start events, end events, and boundary events now report more actionable Chinese error messages instead of a single generic category restriction.

### 6. Demo integration was unified where possible

The following demos now reuse plugin helpers instead of implementing their own host and container rules:

- `packages/example/src/components/GraphCanvas.vue`
- `packages/dialect-demo/src/components/GraphCanvas.vue`
- `packages/smartengine-demo/src/components/GraphCanvas.vue`

The main changes were:

- `embedding.findParent` now goes through `resolveBpmnEmbeddingTargets`
- drop logic creates a draft node first, validates the host or container, and only then calls `addNode`
- boundary events are rejected if no valid host is found
- ordinary flow nodes are rejected when Pools exist but no legal container is resolved

`packages/approval-flow` still initializes and manages the graph through its own `flow.ts` and `App.vue`, so it was not covered by this helper migration.

## Validation Results

### Executed Commands

- Repository root: `pnpm run typecheck`
- Plugin package: `npm run test`
- Plugin package: `npm run test:coverage`
- Plugin package: `npm run test:browser`

### Current Results

- `pnpm run typecheck`: passed.
- `packages/x6-plugin-bpmn npm run test`: passed with `59` test files and `1643` test cases.
- `packages/x6-plugin-bpmn npm run test:coverage`: all tests passed, but global coverage thresholds failed.
- `packages/x6-plugin-bpmn npm run test:browser`: build passed, browser regression ended at `55 passed / 25 failed`.

### Current Coverage Threshold Result

The current global coverage numbers from `npm run test:coverage` are:

- Statements: `96.71%`
- Branches: `93.32%`
- Functions: `99.19%`
- Lines: `96.69%`

This means the implementation is runnable and covered by existing logic tests, but the repository-level 100% threshold has not yet been restored.

## Remaining Open Items

### 1. Browser regressions still fail in 25 scenarios

The remaining failures cluster around:

- containment direct-drag and selection-drag paths
- boundary-event attachment and host-follow behavior
- deleting a Pool together with its Lane and inner tasks
- part of the swimlane resize visual snapshots
- some cross-Pool connection scenarios

This means the core logic and unit paths are covered, but the full browser gesture paths are not yet closed.

### 2. Issue 1 is still only partially converged

Pool-boundary changes are now projected back to Lanes first, but browser results still show divergence between preview ghost, committed geometry, and the snapshot baseline, especially on top, top-left, and top-right paths.

### 3. Issue 5 cannot be marked as done yet

The browser regression for “deleting a Pool also deletes its Lane and inner task” now exists, but it still fails. So the outcome is reproducible and measurable, but not yet confirmed as fixed.

### 4. Demo cleanup still does not cover approval-flow

This round unified the three shared `GraphCanvas`-style demos only. `approval-flow` still has independent graph bootstrap and interaction code, so the goal of “all demos fully returning to plugin-owned rules” is not finished.

## Recommended Next Steps

1. Prioritize containment and boundary-attach browser clusters, because they map most directly to user-reported issues 2, 3, and 5.
2. Restore coverage in a separate pass instead of mixing it with browser-behavior fixes, otherwise the regression surface will keep growing.
3. If issue 6 should be completed end-to-end, evaluate whether `approval-flow` should move onto the same integration layer as the other `GraphCanvas` demos.