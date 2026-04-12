# childLaneSet 实现技术方案

## 文档定位

这是一份解释型实现设计文档，目标是为 `packages/x6-plugin-bpmn` 增加 `Lane.childLaneSet` 支持，并把运行时结构、导入导出、BPMNDI、交互约束统一到一套可落地模型中。

本文档以两类内容为直接参考：

- [pool.md](./pool.md) 中已经确定的泳道约束模型与阶段划分。
- `packages/bpmn-js` 中 `LaneSet` / `childLaneSet` 的建模、导入遍历、split、resize、delete 实现。

本文档不做新旧方案对比，不讨论兼容式补丁路线，默认目标是给后续实现提供单一设计依据。

## 结论

`childLaneSet` 适合按“Lane 树”实现，而不是按“多一层特殊容器补丁”实现。

落地时应同时维护三棵对应关系一致的树：

1. BPMN 语义树：`process.laneSets[] -> lane -> childLaneSet -> lane ...`
2. X6 运行时树：`Pool -> Lane -> 子 Lane ...`
3. BPMNDI 图形树：每个 Lane 仍然是独立 `BPMNShape`，`childLaneSet` 本身不产生单独 DI 形状

首版实现不需要照搬 bpmn-js 的“从 lanes root 收集全部 Lane，再按几何邻接做 balanced resize”的整套策略；可以继续沿用 [pool.md](./pool.md) 中已经确定的“当前层级优先收敛、跨层只沿贴边链传播”的简化模型。但导入、导出、删除、split、membership 语义必须先和 `childLaneSet` 对齐，否则后续交互规则会继续建立在错误树形结构上。

## 参考实现摘要

### bpmn-js 的几个关键事实

1. `BpmnUpdater.getLaneSet(container)` 会区分两种宿主：
   - 宿主是 `bpmn:Lane` 时，写入 `lane.childLaneSet`
   - 宿主是 `bpmn:Participant` 或 `bpmn:Process` 时，写入 `process.laneSets[0]`
2. `BpmnTreeWalker` 导入时会递归访问 `lane.childLaneSet`，说明嵌套 Lane 是语义树的一部分，而不是导入后再推导的 UI 结构。
3. `SplitLaneHandler` 允许把 Lane 当成父容器继续切分子 Lane，子 Lane 几何按 `LANE_INDENTATION` 缩进后放入父 Lane。
4. `LaneUtil.collectLanes` / `getChildLanes` / `computeLanesResize` 说明 bpmn-js 的 resize 计算以 Lane 树为基础。
5. `ResizeLaneBehavior` 让 `Participant` 和 `Lane` 共用 `modeling.resizeLane` 主链，说明泳道体系应共用一套 resize 入口。

### 对本仓库最有价值的启发

1. `childLaneSet` 不应该在图上渲染成新的 X6 节点；它更像 Lane 的一个逻辑子集合。
2. 顶层 `laneSet` 和嵌套 `childLaneSet` 只是宿主不同，不应拆成两套导入导出逻辑。
3. 运行时的父子关系可以继续复用 `Pool -> Lane -> Lane` 的 X6 嵌套，但导出语义不能只看视觉 parent，必须显式恢复 `laneSet` / `childLaneSet` 层级。
4. delete、split、resize 这些行为最终都要以“当前 Lane 的直接子 Lane 集合”为基本操作域。

## 当前插件现状

### 已有基础

当前实现已经具备三块可复用基础：

1. [packages/x6-plugin-bpmn/src/behaviors/swimlane-layout.ts](../packages/x6-plugin-bpmn/src/behaviors/swimlane-layout.ts)
   - 已有 `getChildLanes`、`collectLanes`、`LANE_INDENTATION`
   - 已经把 Pool / Lane 看成统一泳道容器
2. [packages/x6-plugin-bpmn/src/behaviors/swimlane-delete.ts](../packages/x6-plugin-bpmn/src/behaviors/swimlane-delete.ts)
   - 删除补偿已支持沿嵌套 Lane 递归找贴边接收方
3. [docs/pool.md](./pool.md)
   - 已确定三类约束分离
   - 已确定 preview / commit / reconcile 三阶段
   - 已确定删除 1:1 分配与贴边链传播语义

### 现有缺口

当前真正缺的不是几何工具，而是 Lane 树的语义闭环：

1. [packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)
   - 只读取 `process.laneSets`
   - 只把第一层 `laneSet.lanes[]` 转成 X6 Lane
   - 没有递归读取 `lane.childLaneSet`
2. [packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts)
   - 把当前流程中的所有 Lane 平铺回一个顶层 `laneSet`
   - 没有按 Lane 父子关系输出 `childLaneSet`
3. 测试层目前没有 `childLaneSet` roundtrip 基线
4. lane membership 仍偏向“最近视觉父节点”思路，还没有抽成明确的 Lane 祖先语义

这意味着当前代码虽然有“嵌套 Lane 的几何处理”，但还没有“嵌套 Lane 的 BPMN 语义实现”。

## 目标模型

### 总原则

`childLaneSet` 方案应满足以下不变量：

1. Lane 的直接子 Lane 在 BPMN 语义上必须落到 `lane.childLaneSet.lanes[]`。
2. Process 的直接子 Lane 必须落到 `process.laneSets[].lanes[]`。
3. `LaneSet` / `childLaneSet` 只作为逻辑分组存在，不引入新的 X6 可见节点。
4. FlowNode 始终仍属于 `process.flowElements` 或容器 `flowElements`；Lane 只维护 membership，不做 FlowNode 的语义父节点。
5. 运行时 X6 parent 只承担几何容器职责；导出时通过 Lane 树重建 BPMN 语义树。

### 三层结构

#### 1. 语义层

- `Process` 持有顶层 `laneSets`
- `Lane` 可选持有一个 `childLaneSet`
- `Lane.flowNodeRef` 表示成员关系

#### 2. 运行时层

- Pool 是顶层泳道容器
- 顶层 Lane 直接挂在 Pool 下
- 子 Lane 直接挂在父 Lane 下
- 不创建 `LaneSet` 节点

#### 3. 导出层

- 根据运行时 Lane 树递归创建顶层 `laneSet` 与各层 `childLaneSet`
- 每个 Lane 的 `flowNodeRef` 由“最近 Lane 祖先”规则收集
- BPMNDI 仍只导出 Lane 的 `BPMNShape`，不导出 `LaneSet` 图元

## 运行时表示方案

### 不新增 laneSet 图节点

首版实现建议不要把 `laneSet` 建成新的 X6 节点，原因有三点：

1. BPMN 里 `LaneSet` 没有独立图形语义。
2. 当前布局、拖拽、删除、resize 都已经以 Lane 节点为中心实现，插入一层不可见节点只会放大复杂度。
3. bpmn-js 也没有把 `LaneSet` 当成独立可见 shape，而是把它当成业务对象容器。

因此，`laneSet` 应只在内存语义和导入导出时出现，运行时几何继续使用 `Pool -> Lane -> Lane` 树。

### 需要补充的运行时元数据

建议给 Lane 节点的 BPMN 数据补充稳定的泳道语义字段：

```ts
interface SwimlaneSemanticData {
  processId: string
  poolId: string | null
  parentLaneId: string | null
  laneLevel: number
}
```

用途如下：

1. 导入后保留 Lane 层级来源，不依赖后续重新猜测。
2. 导出时可快速校验 Lane 的宿主是 Process 还是父 Lane。
3. 浏览器交互中可直接判断当前操作是否跨流程、跨泳道层级。

这里的 `parentLaneId` 是语义冗余字段，不是唯一事实来源。唯一事实仍然是 X6 的 Lane 父子树；该字段主要用于调试、校验和导入后防漂移。

## 导入方案

### 目标

把 BPMN XML 中的 `laneSets` / `childLaneSet` 递归转换为一致的 X6 Lane 树，同时保留 `flowNodeRef` 到 Lane membership 的映射。

### 建议实现

在 [packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts) 中，把当前“只扫一层 `process.laneSets`”改成统一递归：

```ts
parseLaneContainer(container, parentNodeId, processId, level)
```

其中：

- `container` 可以是 `Process` 或 `Lane`
- `parentNodeId` 是当前导入后 X6 父节点 id
- 如果 `container` 是 `Process`，读取 `container.laneSets`
- 如果 `container` 是 `Lane`，读取 `container.childLaneSet`

递归规则：

1. 先创建当前层 Lane 节点。
2. 建立 `laneFlowNodeParents` 时，不只记录顶层 Lane，也记录每一层 Lane。
3. 若当前 Lane 存在 `childLaneSet`，继续递归创建子 Lane，父节点设为当前 Lane。
4. `isHorizontal` 继续从 DI shape 读取；没有 DI 时按父容器方向兜底。

### 导入后的 membership 规则

导入完成后，FlowNode 与 Lane 的关系按 BPMN 原语恢复：

1. `flowNodeRef` 决定节点属于哪个 Lane。
2. 如果一个节点既在某个 Lane 的 `flowNodeRef` 中，又嵌在该 Lane 的子孙 Lane 范围中，优先以最深层 Lane 为 membership。
3. 边界事件仍跟随宿主任务的 Lane 祖先链处理，不额外单独发明一套 membership 规则。

## 导出方案

### 目标

从 X6 运行时的 Lane 树恢复出 BPMN 语义树：

- 顶层 Lane 导出到 `process.laneSets[0].lanes`
- 子 Lane 导出到 `parentLane.childLaneSet.lanes`

### 建议实现

在 [packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts) 中，替换当前“把全部 Lane 平铺成一个 `laneSet`”的做法，改为两步：

1. 先按 X6 树构建当前 Process 的顶层 Lane 列表。
2. 对每个 Lane 递归调用 `buildLaneElement(laneNode, context)`。

推荐结构：

```ts
function buildLaneElement(laneNode, context): ModdleElement {
  const childLaneNodes = getChildLanes(laneNode)
  const laneElement = createLane(...)

  if (childLaneNodes.length > 0) {
    laneElement.childLaneSet = createLaneSet(
      childLaneNodes.map((child) => buildLaneElement(child, context)),
    )
  }

  return laneElement
}
```

### `flowNodeRef` 收集规则

导出时不要按“节点的直接视觉父节点”判断 Lane 归属，而应按最近 Lane 祖先收集：

1. 普通 FlowNode：取其最近 Lane 祖先。
2. 边界事件：继承宿主任务的最近 Lane 祖先。
3. 子 Lane 内部的 FlowNode 不再同时写入父 Lane `flowNodeRef`，避免父子 Lane 重复持有同一成员。

这条规则可以保证导出的 membership 与 Lane 树层级一致，也更接近 bpmn-js 的更新方向。

### 顶层 laneSet 的组织方式

建议每个 Process 仍只导出一个顶层 `laneSet`，原因如下：

1. 当前仓库已经按单顶层 `laneSet` 组织测试与导出逻辑。
2. bpmn-js 也优先取/建 `laneSets[0]` 作为默认 Lane 根。
3. 首版 `childLaneSet` 落地的重点是支持 Lane 嵌套，而不是同时扩展多顶层 `laneSet` 管理。

如果未来确实需要多个顶层 `laneSet`，应另开方案，不和本次 `childLaneSet` 一起扩张范围。

## BPMNDI 方案

### 结论

`childLaneSet` 不需要新增 DI 元素；仍然只导出每个 Lane 自身的 `BPMNShape`。

### 原因

1. BPMNDI 里参与布局的是 Lane 的 bounds，而不是 `LaneSet` 容器图元。
2. 当前导入器已经按 `di.shapes.get(laneId)` 读取 Lane bounds，这条路径可以直接递归扩展。
3. 当前渲染层本身就是基于 Lane 几何，不需要额外的 `LaneSet` 可视壳。

### 导入导出要求

1. 每个嵌套 Lane 仍必须有自己独立的 `BPMNShape`。
2. 子 Lane bounds 必须继续遵守当前方向下的 `LANE_INDENTATION` 视觉缩进。
3. 如果 XML 中存在 `childLaneSet` 但缺失子 Lane DI，首版可以按父 Lane 内容区做保守兜底布局，但要在文档和测试里明确这是降级路径。

## 交互与布局方案

### 保持与 pool.md 一致的收敛原则

`childLaneSet` 引入后，交互层仍保持 [pool.md](./pool.md) 中已经确定的原则：

1. preview 只算合法 ghost。
2. commit 只写当前层级最终几何。
3. reconcile 默认只在当前层级内分配空间。
4. 跨层传播只沿贴边链进行，不直接扩散到整棵 Lane 树。

### 与 bpmn-js 的差异

这里要明确写成实现策略，而不是误写成参考事实：

1. bpmn-js balanced resize 会从 lanes root 递归收集所有 Lane 再判断相邻补偿。
2. 本仓库首版仍采用当前层级优先收敛模型。

这个偏离是允许的，但必须满足一个前提：导入导出与运行时树必须先统一，否则“局部收敛”会建立在错误的层级结构上。

### add / split / delete 的具体要求

1. `addLaneToPool` 需要扩展为“向任意泳道容器加子 Lane”，而不是只对 Pool 生效。
2. split Lane 时，父容器可以是 Pool，也可以是 Lane；几何仍沿用 `LANE_INDENTATION`。
3. delete Lane 时，继续沿用现有 [packages/x6-plugin-bpmn/src/behaviors/swimlane-delete.ts](../packages/x6-plugin-bpmn/src/behaviors/swimlane-delete.ts) 的贴边接收方递归逻辑。
4. 删除最后一个子 Lane 且该层没有同级接收方时，非 Lane 内容仍回挂父容器；这条规则对 `childLaneSet` 同样成立。

## 模块拆分建议

为了避免把 `childLaneSet` 再次堆进单个大文件，建议按职责拆开：

1. 新增 `src/behaviors/swimlane-tree.ts`
   - `getParentLane`
   - `getTopLevelLanesForProcess`
   - `walkLaneTree`
   - `resolveNearestLaneAncestor`
2. `src/import/xml-parser.ts`
   - 只负责 XML 到运行时节点的递归构建
3. `src/export/exporter.ts`
   - 只负责运行时 Lane 树到 BPMN `laneSet` / `childLaneSet` 的递归输出
4. `src/behaviors/lane-management.ts` / `swimlane-resize.ts` / `swimlane-delete.ts`
   - 继续负责交互和几何，不再负责推断 XML 层级

这样可以把“语义树恢复”从“交互几何修复”里分离出去。

## 实施顺序

### 阶段 1：语义树闭环

先完成以下工作：

1. 导入支持递归 `childLaneSet`
2. 导出支持递归 `childLaneSet`
3. 加入最小 roundtrip 用例

这一阶段完成前，不建议先改大量交互逻辑，因为当前最大的风险不是交互算法，而是语义树仍然不完整。

### 阶段 2：交互命令扩展

在语义树闭环后，再补：

1. Lane 作为父容器的 add / split
2. 当前层级 sibling 识别从“父节点下所有 Lane”提升为“直接子 Lane 集合”
3. resize / delete / preview 在嵌套层级下的回归用例

### 阶段 3：浏览器与兼容验证

最后补齐：

1. 导入嵌套 Lane XML 的浏览器快照
2. 嵌套 Lane resize / delete / split 交互回归
3. 与顶层 laneSet 现有行为的兼容回归

## 测试建议

首版至少补以下测试：

1. 单个 Pool 下两层嵌套 Lane 的 XML 导入
2. 两层嵌套 Lane 的 XML roundtrip 导出
3. 父 Lane 仅导出 `childLaneSet`，不重复收集子 Lane `flowNodeRef`
4. 子 Lane 删除后按贴边链补偿几何
5. 父 Lane split 后生成 `childLaneSet`
6. 缺失子 Lane DI 时的降级导入

测试位置建议：

1. 单元回归放在 `tests/bpmn2/export/swimlane-roundtrip.test.ts`
2. 交互回归放在现有 swimlane browser spec 中按业务域补充，不新建重复主题 spec

## 风险与取舍

### 风险 1：继续把视觉 parent 当成 BPMN 语义来源

这是最需要避免的错误。X6 parent 只能表达几何容器，不足以表达 `laneSet` / `childLaneSet` 语义。

### 风险 2：父 Lane 和子 Lane 重复持有同一 `flowNodeRef`

如果不严格按“最近 Lane 祖先”收集 membership，导出 XML 会出现重复归属，后续 roundtrip 很难稳定。

### 风险 3：过早照搬 bpmn-js 全量 balanced resize

当前仓库已经在 [pool.md](./pool.md) 中选定局部收敛策略。`childLaneSet` 首版应优先完成语义树闭环，再决定是否吸收 bpmn-js 的全量 resize 传播模型。

## 建议结论

`childLaneSet` 的正确实现路径不是“在现有 laneSet 导出上再补一层递归”，而是先把 Lane 从“几何节点集合”提升为“完整语义树”。

具体落地上，建议按下面的顺序执行：

1. 递归导入 `process.laneSets` 与 `lane.childLaneSet`
2. 递归导出顶层 `laneSet` 与各层 `childLaneSet`
3. 把 membership 固定为最近 Lane 祖先规则
4. 在此基础上再扩展 add / split / resize / delete 的嵌套交互

这样做可以保持当前仓库已经确定的局部收敛策略，同时把 `childLaneSet` 对齐到 bpmn-js 和 BPMN 语义的正确方向。