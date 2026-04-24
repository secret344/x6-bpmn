# 泳道 Resize 与 XML 名称设置风险说明 / Swimlane Resize and XML Name Risk Notes

## 文档定位 / Document Purpose

这份文档用于记录当前仓库里已经识别出的高敏感风险区。
This document records the currently identified high-sensitivity risk areas in this repository.

当后续变更触碰这些区域时，代理和开发者都需要先知道哪些假设不能被悄悄改掉。
When future changes touch these areas, agents and developers must know which assumptions cannot be changed silently.

这里的“风险”不是指代码当前有已知缺陷，而是指这些位置依赖明确的事件契约、结构假设或产品策略，一旦改动，最容易引入难以察觉的回归。
The “risks” here do not mean known defects in the current code. They are areas that rely on specific event contracts, structural assumptions, or product policies, and are therefore most likely to introduce subtle regressions when changed.

## 风险区 1：X6 previous position 事件契约 / Risk Area 1: X6 previous-position event contract

涉及文件：
Affected files:

- `packages/x6-plugin-bpmn/src/behaviors/swimlane-resize.ts`
- 重点函数：`liveSizeHandler`、`livePositionHandler`、`getPreviousNodePosition`
  Key functions: `liveSizeHandler`, `livePositionHandler`, `getPreviousNodePosition`

当前修复依赖 X6 在 `change:size` / `change:position` 期间持续提供可靠的 `node.previous('position')`。
The current fix relies on X6 continuing to provide reliable `node.previous('position')` values during `change:size` / `change:position`.

如果 X6 升级、Transform 插件事件顺序变化，或者 `previous('position')` 的写入语义变化，Pool 在 `size-first` 场景下的原始几何恢复就可能失效。
If X6 is upgraded, the Transform plugin changes event order, or the write semantics of `previous('position')` change, original-geometry recovery for Pool in `size-first` scenarios can fail.

触碰该区域时必须警示：
Required warning when touching this area:

- 明确说明是否仍然依赖 `previous('position')`。
  State explicitly whether the code still depends on `previous('position')`.
- 明确说明事件顺序假设是否被修改。
  State explicitly whether the event-order assumption changed.
- 至少重新运行与 `position-first` / `size-first` 相关的单测。
  Re-run at least the unit tests that cover `position-first` / `size-first` flows.

## 风险区 2：Pool preview 回滚的结构假设 / Risk Area 2: structural assumptions in Pool preview rollback

涉及文件：
Affected files:

- `packages/x6-plugin-bpmn/src/behaviors/swimlane-resize.ts`
- 重点函数：`restorePoolPreviewLiveGeometry`、`syncPoolLanes`
  Key functions: `restorePoolPreviewLiveGeometry`, `syncPoolLanes`

当前实现假设 Pool 直属 Lane 先通过 frame 同步恢复，再对非 Lane 后代按 Pool 位移量做回退。
The current implementation assumes that Pool-owned Lanes are restored first through frame sync, and then non-Lane descendants are shifted back by the Pool delta.

这个策略对当前 Pool -> Lane -> Task 结构成立，但如果将来引入更复杂的容器层级、特殊直属子节点，或者改变 Lane 与后代的回滚边界，行为就可能发生偏差。
This strategy is correct for the current Pool -> Lane -> Task structure, but it can drift if future changes introduce deeper container hierarchies, special direct children, or different rollback boundaries between Lanes and descendants.

触碰该区域时必须警示：
Required warning when touching this area:

- 明确说明“Pool 直属 Lane 只做 frame 同步、非 Lane 后代按 delta 回退”这一规则是否保持不变。
  State explicitly whether the rule “Pool-owned Lanes are frame-synced, non-Lane descendants are delta-shifted back” remains unchanged.
- 如果修改了直属子节点或嵌套容器语义，必须指出新语义。
  If direct-child or nested-container semantics changed, describe the new rule explicitly.
- 必须重新运行 pool 轻微拖拽 browser 回归，以及对应的 preview 回滚单测。
  Re-run the slight-drag Pool browser regression and the corresponding preview-rollback unit tests.

## 风险区 3：XML 名称设置 resolver 的非空契约 / Risk Area 3: non-null contract of the XML-name resolver

涉及文件：
Affected files:

- `packages/x6-plugin-bpmn/src/utils/bpmn-xml-names.ts`
- 重点函数：`resolveBpmnXmlNameSettings`、`cloneBpmnXmlNameSettings`
  Key functions: `resolveBpmnXmlNameSettings`, `cloneBpmnXmlNameSettings`

当前 `cloneBpmnXmlNameSettings(...)` 使用非空断言，前提是 `resolveBpmnXmlNameSettings(...)` 总会补齐 `acceptedTagPrefixes`、`moddleNames`、`createModes`。
`cloneBpmnXmlNameSettings(...)` currently uses non-null assertions and depends on `resolveBpmnXmlNameSettings(...)` always populating `acceptedTagPrefixes`, `moddleNames`, and `createModes`.

如果后续有人削弱 resolver 的默认填充语义，这里的类型通过不再等于运行时安全。
If the resolver’s default-population behavior is weakened later, type-check success here will no longer imply runtime safety.

触碰该区域时必须警示：
Required warning when touching this area:

- 明确说明 resolver 是否仍然保证这些字段非空。
  State explicitly whether the resolver still guarantees these fields are non-null.
- 如果不再保证，必须一起调整 clone / merge 逻辑与测试，而不是只改一侧。
  If that guarantee changes, update clone / merge logic and tests together instead of changing only one side.
- 至少重新运行 `bpmn-mapping` 相关测试与构建。
  Re-run at least the `bpmn-mapping` tests and the package build.

## 风险区 4：example wrapper 的产品语义 / Risk Area 4: product semantics of the example wrapper

涉及文件：
Affected files:

- `packages/example/src/bpmn-xml.ts`
- `packages/x6-plugin-bpmn/tests/demo/example-export-wrapper.test.ts`

当前 example demo 明确选择 `extensionProperties: false`，表示它追求标准 BPMN 展示与演示，而不是未知扩展字段的保真 roundtrip。
The current example demo explicitly chooses `extensionProperties: false`, meaning it is optimized for standard BPMN demo behavior rather than faithful round-tripping of unknown extension fields.

如果后续有人把 example 当成“未知字段也必须导入导出保真”的样例，这里会再次出现语义冲突。
If someone later treats the example demo as a sample that must preserve unknown fields through import/export, this area will become semantically inconsistent again.

触碰该区域时必须警示：
Required warning when touching this area:

- 明确说明 example 仍然是“标准 BPMN 演示”还是改成“扩展保真演示”。
  State explicitly whether the example remains a “standard BPMN demo” or is being changed into an “extension-preserving demo”.
- 若定位变化，必须同步更新 wrapper 测试与相关说明文档。
  If that product positioning changes, update the wrapper tests and related documentation together.

## 触碰风险区时的统一警示要求 / Unified warning requirements when touching risk areas

只要修改命中了上面的任一风险区，最终汇报或 PR 说明里必须额外包含三项内容：
Whenever a change touches any risk area above, the final report or PR description must include these three items:

1. 触碰了哪一个风险区。
   Which risk area was touched.
2. 该风险区依赖的关键假设是否保持不变。
   Whether the key assumption behind that risk area remains unchanged.
3. 为验证该假设，重新运行了哪些定向测试或命令。
   Which targeted tests or commands were re-run to validate that assumption.

如果修改改变了这些假设本身，必须同步更新这份文档，而不是只更新代码或测试。
If the change modifies those assumptions themselves, this document must be updated together with the code and tests.

## 最低定向验证建议 / Minimum targeted validation guidance

- 触碰风险区 1 或 2：优先运行 `packages/x6-plugin-bpmn/tests/bpmn2/behaviors/swimlane-resize.test.ts` 中相关用例，以及 `packages/x6-plugin-bpmn/tests/browser/swimlane-resize.browser.spec.ts` 的 Pool 轻微拖拽回归。
  For Risk Area 1 or 2: prioritize the relevant cases in `packages/x6-plugin-bpmn/tests/bpmn2/behaviors/swimlane-resize.test.ts` and the Pool slight-drag regression in `packages/x6-plugin-bpmn/tests/browser/swimlane-resize.browser.spec.ts`.
- 触碰风险区 3：至少运行 `packages/x6-plugin-bpmn/tests/bpmn2/export/bpmn-mapping.test.ts` 与 `npm run build`。
  For Risk Area 3: run at least `packages/x6-plugin-bpmn/tests/bpmn2/export/bpmn-mapping.test.ts` and `npm run build`.
- 触碰风险区 4：至少运行 `packages/x6-plugin-bpmn/tests/demo/example-export-wrapper.test.ts`。
  For Risk Area 4: run at least `packages/x6-plugin-bpmn/tests/demo/example-export-wrapper.test.ts`.
