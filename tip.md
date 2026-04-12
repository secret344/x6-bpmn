# 仓库维护备注

Repository Maintenance Notes

## 1. 子模块处理规则 / Submodule Handling Rule

`packages/**` 下的参照子模块只用于规范、XML 语义和社区实现比对，不在当前工作区直接修改。

Reference submodules under `packages/**` are used only for specification, XML semantics, and community-implementation comparison. Do not edit them directly in this workspace.

如果参照子模块存在问题、缺少信息，或者需要后续跟踪，请先记录在这份文件中，再去对应上游仓库处理。

If a reference submodule has an issue, is missing information, or needs follow-up, record it in this file first and then handle the actual fix in the upstream repository.

## 2. 当前实现备注 / Current Implementation Notes

- **Lane top/left resize 正反馈循环**：X6 Transform 插件通过 `node.resize(w, h, { direction: 'top' })` 驱动方向性缩放时，BPMN 行为处理器 `compactLaneLayout` 和 `adjustAdjacentLanes` 会在每帧把 Lane 位置重置到 Pool 内容区顶部，导致右下锚点持续下移。多步拖拽时会形成正反馈，尺寸快速放大。当前测试辅助方法 `resizeNodeByEdge` 已使用 `steps: 1` 规避该问题。彻底修复需要 Transform 与行为处理器在活跃 resize batch 内协同锚点策略。
- 目前没有新的子模块跟踪事项。

- **Lane top/left resize positive feedback loop**: when the X6 Transform plugin drives directional resize with `node.resize(w, h, { direction: 'top' })`, the BPMN behavior handlers `compactLaneLayout` and `adjustAdjacentLanes` reset the lane position to the top of the pool content area on every frame. This keeps pushing the bottom-right anchor downward. With multi-step dragging, the size can grow rapidly due to positive feedback. The current test helper `resizeNodeByEdge` avoids the problem by using `steps: 1`. A real fix requires coordination between Transform and the behavior handlers during an active resize batch.
- There are currently no new submodule follow-up items.