# BPMN 2.0 规则落实与逐步验证清单

> 规范来源：<https://www.omg.org/spec/BPMN/2.0.2/PDF/>
>
> 本文档只做一件事：把仓库里已经落实的 BPMN 2.0 规则、对应代码落点、逐步验证方式，以及最终全量验证流程集中到一个独立文档中，方便按规范“边阅读边落实、边验证”。

## 1. 落实原则

后续如果继续按 OMG BPMN 2.0 规范补充或调整能力，统一遵循以下顺序，不要一股脑改完再回头验证：

1. 先读官方规范对应类别。
2. 只落实当前类别的常量、图形、映射、规则。
3. 先跑当前类别的针对性验证。
4. 通过后再进入下一个类别。
5. 全部类别完成后，再跑一次全量验证。

推荐的落实顺序：

1. 事件
2. 活动
3. 网关
4. 数据元素
5. 工件
6. 泳道
7. 连接对象
8. XML 导入导出映射
9. 连线规则与约束
10. 全量回归

## 2. 当前已落实范围总览

当前仓库在 `@x6-bpmn2/plugin` 中已经把 BPMN 2.0 核心图元落实为：

- 47 个事件变体
- 13 个活动
- 6 个网关
- 4 个数据元素
- 2 个工件
- 2 个泳道
- 7 个连接线

合计：

- 74 个节点
- 7 个边
- 81 个 BPMN 元素

对应自动化总量校验位于：

- `packages/x6-plugin-bpmn/tests/bpmn2/integration/bpmn-spec-compliance.test.ts`

## 3. 规则落点矩阵

| 规范主题 | 代码落点 | 自动验证 | 需要人工对照的点 |
|---|---|---|---|
| 事件 | `src/utils/constants.ts`、`src/shapes/events.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/events.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 事件种类数量、触发图标、开始/中间/结束事件边框样式 |
| 活动 | `src/utils/constants.ts`、`src/shapes/activities.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/activities.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 任务类别、子流程/事件子流程/事务/调用活动的视觉差异 |
| 网关 | `src/utils/constants.ts`、`src/shapes/gateways.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/gateways.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 菱形外观、内部标记、事件网关/排他事件网关区分 |
| 数据元素 | `src/utils/constants.ts`、`src/shapes/data.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/data.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 数据对象折角、输入/输出标记、数据存储形状 |
| 工件 | `src/utils/constants.ts`、`src/shapes/artifacts.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/artifacts.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 分组虚线圆角框、文本注释左侧括号 |
| 泳道 | `src/utils/constants.ts`、`src/shapes/swimlanes.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/shapes/swimlanes.test.ts`、`tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | Pool / Lane 的容器关系与语义 |
| 连接对象 | `src/connections/index.ts`、`src/export/bpmn-mapping.ts` | `tests/bpmn2/integration/bpmn-spec-compliance.test.ts` | 顺序流 / 消息流 / 关联的线型与箭头 |
| 连线规则 | `src/rules/connection-rules.ts`、`src/rules/validator.ts` | `tests/bpmn2/rules/connection-rules.test.ts`、`tests/bpmn2/rules/connections.test.ts` | 开始事件不可入线、结束事件不可出线、数据/工件只允许特定连接 |
| 导入导出 | `src/export/bpmn-mapping.ts`、`src/export/exporter.ts`、`src/export/importer.ts` | `tests/bpmn2/export/bpmn-mapping.test.ts`、`tests/bpmn2/export/export.test.ts`、`tests/bpmn2/adapters/adapters.test.ts` | 图形名与 BPMN XML tag / eventDefinition / attrs 是否一致 |

## 4. 按规范逐步验证的执行方法

### 4.1 事件

先对照 OMG BPMN 2.0 中事件相关定义，再核对仓库内以下内容：

- 常量是否齐全：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 图形是否注册：`packages/x6-plugin-bpmn/src/shapes/events.ts`
- XML tag / eventDefinition 是否映射到 BPMN 元素：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证是否覆盖：`packages/x6-plugin-bpmn/tests/bpmn2/integration/bpmn-spec-compliance.test.ts`

重点检查：

- 开始事件数量
- 中间抛出 / 中间捕获事件数量
- 边界事件是否区分中断/非中断
- 结束事件是否覆盖消息、升级、错误、取消、补偿、信号、终止、多重

### 4.2 活动

按“任务 → 子流程 → 事件子流程 → 事务 → 自由子流程 → 调用活动”的顺序核对：

- 常量：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 形状：`packages/x6-plugin-bpmn/src/shapes/activities.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/shapes/activities.test.ts`

重点检查：

- 8 类任务是否齐全
- 调用活动是否粗边框
- 事件子流程是否虚线边框
- 事务是否双边框

### 4.3 网关

核对：

- 常量：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 形状：`packages/x6-plugin-bpmn/src/shapes/gateways.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/shapes/gateways.test.ts`

重点检查：

- 排他、并行、包容、复杂、事件、排他事件网关是否齐全
- 外框是否统一为菱形
- 内部图标是否与 BPMN 语义一致

### 4.4 数据元素

核对：

- 常量：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 形状：`packages/x6-plugin-bpmn/src/shapes/data.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/shapes/data.test.ts`

重点检查：

- 数据对象折角
- 数据输入/输出方向标记
- 数据存储外观

### 4.5 工件

核对：

- 常量：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 形状：`packages/x6-plugin-bpmn/src/shapes/artifacts.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/shapes/artifacts.test.ts`

重点检查：

- 文本注释是否只保留左侧括号语义
- 分组是否为虚线圆角矩形

### 4.6 泳道

核对：

- 常量：`packages/x6-plugin-bpmn/src/utils/constants.ts`
- 形状：`packages/x6-plugin-bpmn/src/shapes/swimlanes.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/shapes/swimlanes.test.ts`

重点检查：

- Pool 对应 participant
- Lane 对应 lane

### 4.7 连接对象

核对：

- 形状：`packages/x6-plugin-bpmn/src/connections/index.ts`
- XML 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/integration/bpmn-spec-compliance.test.ts`

重点检查：

- 顺序流：实线 + 实心箭头
- 条件流：带菱形起点标记
- 默认流：默认流斜杠标记
- 消息流：虚线 + 圆形起点 + 空心箭头
- 关联 / 定向关联 / 数据关联的线型区分

### 4.8 连线规则

这部分是“语义规则”落实，不只看图形。

核对：

- 规则定义：`packages/x6-plugin-bpmn/src/rules/connection-rules.ts`
- 校验实现：`packages/x6-plugin-bpmn/src/rules/validator.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/rules/connection-rules.test.ts`
- 集成验证：`packages/x6-plugin-bpmn/tests/bpmn2/rules/connections.test.ts`

重点检查：

- 开始事件不可入线
- 结束事件不可出线
- 边界事件不可作为入线目标
- 数据元素只允许数据关联/关联
- 工件只允许关联

### 4.9 XML 导入导出映射

核对：

- 映射：`packages/x6-plugin-bpmn/src/export/bpmn-mapping.ts`
- 导出：`packages/x6-plugin-bpmn/src/export/exporter.ts`
- 导入：`packages/x6-plugin-bpmn/src/export/importer.ts`
- 自动验证：`packages/x6-plugin-bpmn/tests/bpmn2/export/bpmn-mapping.test.ts`、`packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts`

重点检查：

- `tag` 是否对应 BPMN 标准元素名
- `eventDefinition` 是否与事件类型一致
- 附加属性是否正确，例如：
  - `parallelMultiple`
  - `cancelActivity`
  - `triggeredByEvent`
  - `eventGatewayType`

## 5. 本仓库的逐步验证命令

先跑规则对照验证，再跑全量验证。

### 5.1 逐步验证

只验证规范对照主文件：

```bash
cd packages/x6-plugin-bpmn
npm run test -- tests/bpmn2/integration/bpmn-spec-compliance.test.ts
```

如果正在落实连线规则或映射规则，再补跑：

```bash
cd packages/x6-plugin-bpmn
npm run test -- tests/bpmn2/rules/connection-rules.test.ts
```

```bash
cd packages/x6-plugin-bpmn
npm run test -- tests/bpmn2/export/bpmn-mapping.test.ts
```

### 5.2 最终全量验证

```bash
cd packages/x6-plugin-bpmn
npm run test
```

如果本次改动涉及 `src/**` 里的运行时逻辑、分支规则或跨模块调整，再执行覆盖率校验：

```bash
cd packages/x6-plugin-bpmn
npm run test:coverage
```

## 6. 本次核对结论

本次核对后，仓库已经具备以下基础：

1. 规范类别级自动化验证文件已存在：
   - `packages/x6-plugin-bpmn/tests/bpmn2/integration/bpmn-spec-compliance.test.ts`
2. 规则级验证文件已存在：
   - `packages/x6-plugin-bpmn/tests/bpmn2/rules/connection-rules.test.ts`
   - `packages/x6-plugin-bpmn/tests/bpmn2/rules/connections.test.ts`
3. 映射级验证文件已存在：
   - `packages/x6-plugin-bpmn/tests/bpmn2/export/bpmn-mapping.test.ts`
   - `packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts`
4. 当前缺少的是“规范条款 → 代码落点 → 验证流程”的独立说明文档，本文档即补齐这一缺口。

## 7. 后续新增规则时的最小执行模板

以后每新增一条 BPMN 规则，按下面模板执行：

1. 在官方规范中定位条款。
2. 只修改对应类别的实现文件。
3. 先补该类别的定向测试。
4. 运行该类别的定向测试。
5. 回到本文档补登记：
   - 规则内容
   - 代码落点
   - 验证文件
6. 最后再跑一次 `npm run test`。

这样才能保证规则落实是“逐步对照、逐步验证、最后总验”，而不是一次性堆改动。
