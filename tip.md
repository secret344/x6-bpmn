# Tips

## Submodule handling

- Git submodules under `packages/**` are reference or documentation sources and should not be edited directly in this workspace.
- If a submodule has incorrect content, missing docs, or behavior worth tracking, record the issue in this file and handle the actual fix in the upstream submodule repository.

## Current notes

- **Lane top/left resize 正反馈循环**：X6 Transform 插件通过 `node.resize(w, h, {direction:'top'})` 驱动方向性缩放时，BPMN 行为处理器 (`compactLaneLayout` / `adjustAdjacentLanes`) 会在每帧将 Lane 位置重置到 Pool 内容区顶部，导致 bottom-right 锚点逐帧下移。多步拖拽 (`steps > 1`) 下形成正反馈，尺寸指数级膨胀。`resizeNodeByEdge` 测试辅助方法已改为 `steps:1` 来规避。彻底修复需要 Transform 或行为处理器在活跃 resize batch 内协调锚点。
- No active submodule follow-up items are recorded at the moment.