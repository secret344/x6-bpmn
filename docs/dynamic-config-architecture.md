# x6-plugin-bpmn 动态方言内核改造方案

> 基于当前主库代码、结合最终目标重新整理的全量方案。
> 目标不是“在旧结构上打补丁”，而是直接把主库升级为一套**可继承、可编译、可绑定实例、UI 外置**的流程方言内核。

---

## 目录

1. [最终目标](#1-最终目标)
2. [基于当前主库的现状判断](#2-基于当前主库的现状判断)
3. [对当前方案逐部分评审](#3-对当前方案逐部分评审)
4. [最终推荐架构](#4-最终推荐架构)
5. [核心概念设计](#5-核心概念设计)
6. [六层配置模型](#6-六层配置模型)
7. [继承链设计](#7-继承链设计)
8. [编译机制设计](#8-编译机制设计)
9. [运行时机制设计](#9-运行时机制设计)
10. [渲染层设计](#10-渲染层设计)
11. [规则层设计](#11-规则层设计)
12. [字段能力层设计](#12-字段能力层设计)
13. [导入导出层设计](#13-导入导出层设计)
14. [目录结构建议](#14-目录结构建议)
15. [与当前代码的映射关系](#15-与当前代码的映射关系)
16. [直接重构实施顺序](#16-直接重构实施顺序)
17. [测试体系](#17-测试体系)
18. [最终结论](#18-最终结论)

---

## 1. 最终目标

本次改造的最终目标不是单纯做“动态配置”，而是把主库从：

- 一套固定 BPMN 2.0 图形与规则集合

升级为：

- 一套**流程方言内核（Process Dialect Kernel）**

它需要满足：

1. `bpmn2` 作为兜底基础方言
2. `smartengine`(https://github.com/alibaba/SmartEngine/wiki/SmartEngine-UserGuide--Chinese-Version-(%E4%B8%AD%E6%96%87%E7%89%88)) 基于 `bpmn2` 扩展
3. `smartengine` 分 `custom` 与 `database` 两种 mode
4. 用户可以基于任意内置方言增量扩展
5. 切换方言时，节点外观、规则、数据能力、导入导出行为一起变化
6. 主库只负责：
   - 元素定义
   - 渲染规范
   - 规则
   - 字段能力
   - 导入导出
7. 主库**不负责**：
   - UI 字段类型
   - 表单布局
   - 下拉项展示
   - 业务侧文案规范
8. 允许直接全库更新，不以兼容旧内部结构为优先
9. 最终结构必须适合长期维护

---

## 2. 基于当前主库的现状判断

当前主库 `packages/x6-plugin-bpmn/src` 已经具备 4 个天然内核雏形：

### 2.1 渲染内核

来源：

- `shapes/*`
- `connections/index.ts`
- `index.ts -> registerBpmnShapes()`

现状特点：

- 节点和边已经按 BPMN 大类拆分
- 通过 `Graph.registerNode()` / `Graph.registerEdge()` 注册
- 已有良好的工厂化基础，但当前仍偏静态

### 2.2 规则内核

来源：

- `rules/connection-rules.ts`
- `rules/validator.ts`

现状特点：

- 已完成 `shape -> category -> rule` 的建模
- 已有默认规则与自定义覆盖能力
- 这是当前库里最接近“方言规则引擎”的部分

### 2.3 模型内核

来源：

- `config/index.ts`

现状特点：

- 已有 `SHAPE_LABELS`
- 已有 `classifyShape()`
- 已有 `BpmnFormData`
- 已有 `load/save` 数据载入与保存

本质判断：

- 这里现在不是 UI 层，而是**领域数据层 + 分类层 + 标签层**混在一起

### 2.4 序列化内核

来源：

- `export/bpmn-mapping.ts`
- `export/exporter.ts`
- `export/importer.ts`

现状特点：

- `NODE_MAPPING` / `EDGE_MAPPING` 已经是纯映射驱动
- 导入导出主体算法完整
- 具备方言扩展的良好基础

### 2.5 结论

当前主库**不缺能力**，缺的是：

> 一个统一的“方言装配层”。

所以最佳方案不是再造一套完全无关的新系统，而是：

> 把当前分散在 `constants / config / rules / export / shapes` 中的 BPMN2 默认能力，统一提升为一个可继承、可编译、可实例化绑定的方言系统。

---

## 3. 对当前方案逐部分评审

本节针对已有思路逐项判断：哪些应保留，哪些应优化，哪些应替换。

### 3.1 “动态配置”这个表述

#### 当前思路
强调“动态配置体系”。

#### 判断
不够准确。

#### 更优方案
建议升级为：

- 领域概念：`Dialect`
- 配置载体：`Profile`
- 运行时对象：`ProfileContext`

原因：

“动态配置”更像实现手段；“流程方言”更准确描述业务本质。

#### 结论
- **保留**动态化能力
- **升级命名**为方言系统

---

### 3.2 单一大 `Preset/Profile`

#### 当前思路
将不同维度收拢到一个统一 profile 中。

#### 判断
方向对，但如果结构过扁，会越来越大。

#### 更优方案
改成**分层 Profile**，而不是“大一统配置对象”。

也就是说：

- `Profile` 是顶层容器
- 里面分多个子层
- 各子层可独立继承、覆盖、删除、校验

#### 结论
- **保留** `Profile` 作为载体
- **避免** 把所有逻辑都堆进一个平铺对象

---

### 3.3 全局 `activePreset/runtime`

#### 当前思路
用全局活动配置驱动各模块。

#### 判断
不适合长期维护。

问题：

- 多编辑器实例冲突
- 测试隔离困难
- 不同 graph 不能同时使用不同方言

#### 更优方案
改成：

```ts
compileProfile() -> ResolvedProfile -> ProfileContext -> bind to graph
```

#### 结论
- **替换** 全局 active runtime
- **采用** 实例级 `ProfileContext`

---

### 3.4 `visibility include/exclude`

#### 当前思路
通过 include / exclude 控制元素启用与禁用。

#### 判断
可用，但不是最优。

问题：

- 父级排除、子级恢复、孙级再排除，推理困难
- 语义依赖合并顺序

#### 更优方案
拆成单独一层：`availability`

```ts
type Availability = 'enabled' | 'disabled' | 'experimental'
```

#### 结论
- **替换** `include/exclude`
- **采用** 显式 `availability` 状态表

---

### 3.5 `theme` 作为独立层

#### 当前思路
把颜色和图标抽成一层。

#### 判断
方向对，但还不够完整。

#### 更优方案
从 `theme` 升级为 `rendering`：

- theme token
- node renderer factory
- edge renderer factory
- 可能的 shape patch

因为最终渲染层不仅是颜色和图标，还包括 shape 如何生成。

#### 结论
- **保留** theme token
- **升级** 为 `rendering` 层

---

### 3.6 `BpmnFormData` / 数据字段方案

#### 当前思路
把 UI 元数据拿掉，只保留字段定义或默认值。

#### 判断
方向对，但还可以更进一步。

#### 更优方案
主库不要维护“字段定义”，而维护“字段能力”。

也就是：

- 默认值
- normalize
- validate
- serialize
- deserialize

而不是：

- 输入类型
- 表单组件类型
- 下拉项展示
- 布局分组

#### 结论
- **保留** UI 外置原则
- **升级** 为 `FieldCapability`

---

### 3.7 导入导出改造方式

#### 当前思路
先替换读取来源，再慢慢 adapter 化。

#### 判断
如果允许全库重构，这不是最优路径。

#### 更优方案
直接 adapter 化：

- `DialectDetector`
- `ImporterAdapter`
- `ExporterAdapter`

原因：

方言差异最大的地方之一就是导入导出。
继续用一个共享超大导入导出器，后期只会堆更多 `if dialect === ...`。

#### 结论
- **替换** 渐进式导入导出改造思路
- **直接采用** 适配器化序列化架构

---

### 3.8 迁移策略

#### 当前思路
偏渐进式迁移。

#### 判断
与你当前要求不一致。

#### 更优方案
改成“重构批次”，直接按最终结构更新。

#### 结论
- **替换** 迁移式叙述
- **采用** 直接重构批次方案

---

## 4. 最终推荐架构

最终推荐的架构是：

```text
Dialect
  └── Profile
        ├── definitions
        ├── availability
        ├── rendering
        ├── rules
        ├── dataModel
        └── serialization
```

运行时链路：

```text
register profiles
    -> compileProfile(profileId)
    -> ResolvedProfile
    -> createProfileContext(resolved)
    -> bindProfileToGraph(graph, context)
```

导入导出链路：

```text
xml / graph
   -> DialectDetector
   -> ImporterAdapter / ExporterAdapter
   -> ProfileContext.serialization
```

字段层：

```text
FieldCapability
   -> default / normalize / validate / serialize / deserialize
```

这个架构比“动态配置系统”更完整，也更贴合你的边界要求。

---

## 5. 核心概念设计

### 5.1 Dialect

表示一个流程方言概念，例如：

- `bpmn2`
- `smartengine-base`
- `smartengine-custom`
- `smartengine-database`

### 5.2 Profile

表示某个方言的配置载体。

它描述：

- 有哪些元素
- 哪些元素启用
- 如何渲染
- 如何连线
- 有哪些字段能力
- 如何导入导出

### 5.3 ResolvedProfile

表示 profile 经继承、合并、删除语义处理、默认值补齐后的最终结果。

### 5.4 ProfileContext

表示某个 graph/editor 当前绑定的运行时方言上下文。

### 5.5 FieldCapability

表示一个字段在主库里的能力定义。

### 5.6 DialectDetector

表示导入时如何识别 XML 属于哪种方言。

---

## 6. 六层配置模型

### 6.1 definitions

职责：定义元素本体。

```ts
export interface NodeDefinition {
  shape: string
  category: string
  renderer: string
  title?: string
  tags?: string[]
}

export interface EdgeDefinition {
  shape: string
  category: string
  renderer: string
  title?: string
  tags?: string[]
}

export interface DefinitionsSet {
  nodes: Record<string, NodeDefinition>
  edges: Record<string, EdgeDefinition>
}
```

### 6.2 availability

职责：定义当前 profile 中哪些元素启用。

```ts
export type Availability = 'enabled' | 'disabled' | 'experimental'

export interface AvailabilitySet {
  nodes: Record<string, Availability>
  edges: Record<string, Availability>
}
```

### 6.3 rendering

职责：定义视觉与 shape 生成方式。

```ts
export interface ThemeTokens {
  colors: Record<string, any>
  icons: Record<string, string>
}

export type NodeRendererFactory = (tokens: ThemeTokens, node: NodeDefinition) => ShapeDefinition
export type EdgeRendererFactory = (tokens: ThemeTokens, edge: EdgeDefinition) => EdgeDefinitionConfig

export interface RenderingSet {
  theme: ThemeTokens
  nodeRenderers: Record<string, NodeRendererFactory>
  edgeRenderers: Record<string, EdgeRendererFactory>
}
```

### 6.4 rules

职责：定义连接规则与结构约束。

```ts
export interface RuleSet {
  nodeCategories: Record<string, string>
  connectionRules: Record<string, BpmnConnectionRule>
  constraints?: ConstraintRule[]
}
```

其中 `constraints` 处理更高阶规则，如：

- 开始节点数量限制
- 并行网关成对要求
- 特定 mode 下禁用某些事件

### 6.5 dataModel

职责：定义字段能力，不定义 UI。

```ts
export interface FieldValidateContext {
  shape: string
  category: string
  profileId: string
  nodeData?: Record<string, unknown>
}

export interface FieldCapability {
  scope?: 'node' | 'edge' | 'graph'
  defaultValue?: unknown
  description?: string
  normalize?: (value: unknown) => unknown
  validate?: (value: unknown, context: FieldValidateContext) => true | string
  serialize?: (value: unknown) => unknown
  deserialize?: (value: unknown) => unknown
}

export interface DataModelSet {
  fields: Record<string, FieldCapability>
  categoryFields: Record<string, string[]>
  shapeFields?: Record<string, string[]>
}
```

### 6.6 serialization

职责：定义导入导出映射与命名空间。

```ts
export interface SerializationSet {
  namespaces: Record<string, string>
  nodeMapping: Record<string, BpmnNodeMapping>
  edgeMapping: Record<string, BpmnEdgeMapping>
}
```

---

## 7. 继承链设计

推荐最终继承链：

```text
bpmn2
  └── smartengine-base
  ├── smartengine-custom
  └── smartengine-database
```

### 7.1 bpmn2

作为母版方言，提供：

- 当前主库完整 BPMN2 默认元素
- 默认颜色与图标
- 默认规则
- 默认导入导出映射
- 默认字段能力

### 7.2 smartengine-base

只做 SmartEngine 公共扩展：

- `smart:` 命名空间
- SmartEngine 公共字段能力
- SmartEngine 公共序列化扩展

关键原则：

- `smartengine-base` **默认完整继承 BPMN 2.0 全量能力**
- SmartEngine 本身应被视为“BPMN 2.0 + SmartEngine 扩展”
- 不因为进入 SmartEngine 就默认禁用、裁剪或弱化标准 BPMN 元素

也就是说：

> 如果没有额外 mode 要求，直接使用 `smartengine-base` 即可。

### 7.3 smartengine-custom

聚焦服务编排场景要求：

- 不代表 SmartEngine 只能使用这些元素
- 只在“明确要求使用 custom mode 约束”时，才叠加限制与偏好
- 强化 `serviceTask`、`receiveTask`
- 收紧规则
- 形成服务编排推荐能力集

因此这一层的定位应是：

> **要求叠加层**，而不是新的基础方言。

### 7.4 smartengine-database

聚焦审批与工单场景要求：

- 不表示只有该 mode 才“支持 BPMN2.0”
- 只表示在数据库审批流场景下，对标准能力做增强和约束组合
- 增加多实例与审批能力
- 增强任务分配相关字段能力
- 增强序列化处理

---

## 8. 编译机制设计

### 8.1 为什么必须有编译阶段

如果没有编译阶段，所有模块都会在运行时自己猜：

- 父 profile 怎么合并
- 某个元素是否启用
- 某个 renderer 是否存在
- 某个 mapping 是否合法

这会导致：

- 运行时判断过重
- 错误暴露太晚
- 调试困难

### 8.2 compileProfile()

```ts
export interface ResolvedProfile {
  meta: DialectMeta
  definitions: DefinitionsSet
  availability: AvailabilitySet
  rendering: RenderingSet
  rules: RuleSet
  dataModel: DataModelSet
  serialization: SerializationSet
}

export function compileProfile(profileId: string): ResolvedProfile
```

### 8.3 编译阶段职责

1. 解析继承链
2. 合并各层配置
3. 处理删除语义
4. 补齐默认值
5. 校验引用合法性
6. 输出只读 `ResolvedProfile`

### 8.4 删除语义

建议支持：

```ts
export interface RemoveMarker {
  $remove: true
}
```

用于删除父级配置项。

---

## 9. 运行时机制设计

### 9.1 ProfileRegistry

```ts
export interface ProfileRegistry {
  register(profile: Profile): void
  get(id: string): Profile | undefined
  compile(id: string): ResolvedProfile
  list(): string[]
}
```

### 9.2 ProfileContext

```ts
export interface ProfileContext {
  profile: ResolvedProfile
}
```

### 9.3 graph 绑定

```ts
export function bindProfileToGraph(graph: Graph, context: ProfileContext): void
```

职责：

- 注册当前 profile 所需节点和边
- 挂载规则验证能力
- 挂载导入导出所需上下文

### 9.4 为什么不再使用全局状态

因为未来需要支持：

- 多 graph 并行
- 多 profile 并行
- 测试隔离
- 服务端/工具链复用

---

## 10. 渲染层设计

### 10.1 最优结构

不要继续以“每个 shape 一份最终静态对象”为长期方向。

建议：

- 保留当前 `events.ts` / `activities.ts` / `gateways.ts` 的分层思想
- 但底层统一收敛到 renderer factory

### 10.2 结构示意

```ts
export interface ShapeDefinition {
  inherit?: string
  width?: number
  height?: number
  markup?: Array<{ tagName: string; selector: string; [key: string]: any }>
  attrs?: Record<string, Record<string, unknown>>
  ports?: PortsConfig
  [key: string]: any
}

export interface EdgeDefinitionConfig {
  inherit?: string
  attrs?: Record<string, Record<string, unknown>>
  labels?: any[]
  [key: string]: any
}
```

### 10.3 推荐原则

- 颜色、图标、样式来自 `rendering.theme`
- 节点形状来自 `nodeRenderers`
- 边形状来自 `edgeRenderers`
- 外观变化由 profile 决定，而不是散落在业务代码里

---

## 11. 规则层设计

### 11.1 保留当前核心思路

当前 `shape -> category -> rule` 的设计应保留。

### 11.2 扩展方式

规则层应分两部分：

1. 基础连接规则
2. 高阶约束规则

### 11.3 高阶约束示例

- 开始节点最多一个
- 并行网关 fork/join 必须成对
- `custom` mode 禁止 `userTask`
- `database` mode 允许多实例 userTask

### 11.4 结论

规则层不是问题点，反而是当前主库最应该保留和复用的资产。

---

## 12. 字段能力层设计

### 12.1 主库字段边界

主库只维护能力，不维护 UI。

主库负责：

- 默认值
- normalize
- validate
- serialize
- deserialize

主库不负责：

- 输入类型
- 表单组件
- 展示文案
- 布局与分组
- 候选项显示方案

### 12.2 为什么这是最优边界

因为不同业务：

- 审批流
- 服务编排
- 流程治理
- 低代码配置页

对 UI 的要求差异极大，主库很难规范化。

但字段能力是主库必须知道的，否则：

- 无法做默认值填充
- 无法做运行时校验
- 无法做导入导出标准化

### 12.3 与现有 `BpmnFormData` 的关系

建议：

- `BpmnFormData` 不再作为设计中心
- 改为运行时数据载体
- 真正的定义中心迁移到 `DataModelSet.fields`

---

## 13. 导入导出层设计

### 13.1 推荐直接插件化

```ts
export interface DialectDetector {
  detect(xml: string): string
}

export interface ExporterAdapter {
  dialect: string
  exportXML(graph: Graph, context: ProfileContext): Promise<string>
}

export interface ImporterAdapter {
  dialect: string
  importXML(graph: Graph, xml: string, context: ProfileContext): Promise<void>
}
```

### 13.2 为什么 adapter 比共享导入导出器更优

因为方言差异会越来越集中在序列化：

- BPMN2 标准导出
- SmartEngine 扩展命名空间
- SmartEngine requirements 下的多实例结构
- 特定业务方言扩展属性

如果继续共享一个大导入导出器，后续维护成本会越来越高。

### 13.3 当前代码如何承接

不是重写算法，而是：

- 保留 `exporter.ts` / `importer.ts` 中已有成熟算法
- 拆成 `bpmn2 adapter`
- 再做 `smartengine-base adapter`
- 再做 mode 级增强

---

## 14. 目录结构建议

推荐最终目录：

```text
packages/x6-plugin-bpmn/src/
├── core/
│   ├── dialect/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── compiler.ts
│   │   ├── merge.ts
│   │   ├── context.ts
│   │   └── detector.ts
│   ├── rules/
│   │   ├── validator.ts
│   │   └── constraints.ts
│   ├── data-model/
│   │   ├── fields.ts
│   │   ├── normalize.ts
│   │   └── validate.ts
│   └── rendering/
│       ├── shape-types.ts
│       ├── node-renderers.ts
│       └── edge-renderers.ts
├── builtin/
│   ├── bpmn2/
│   │   ├── profile.ts
│   │   ├── definitions.ts
│   │   ├── availability.ts
│   │   ├── rendering.ts
│   │   ├── rules.ts
│   │   ├── data-model.ts
│   │   └── serialization.ts
│   ├── smartengine-base/
│   ├── smartengine-custom/
│   └── smartengine-database/
├── adapters/
│   ├── bpmn2/
│   │   ├── importer.ts
│   │   └── exporter.ts
│   ├── smartengine/
│   │   ├── importer.ts
│   │   └── exporter.ts
│   └── x6/
│       └── bind.ts
├── legacy/
│   └── register-bpmn-shapes.ts
└── index.ts
```

说明：

- `core/` 放内核
- `builtin/` 放内置方言
- `adapters/` 放与 X6 / XML 的适配
- `legacy/` 可选，仅当需要保留外部便捷入口时保留

---

## 15. 与当前代码的映射关系

### 15.1 直接保留

这些部分建议直接复用或只做轻度搬迁：

- `rules/validator.ts` 的核心验证算法
- `rules/connection-rules.ts` 的基础规则设计
- `export/bpmn-mapping.ts` 的映射模型
- `export/exporter.ts` / `importer.ts` 的主体算法

### 15.2 需要拆分

- `config/index.ts`
  - 拆成标签、分类、数据能力、load/save 四块
- `utils/constants.ts`
  - 保留 shape 常量
  - 把颜色和图标迁出

### 15.3 需要重写

- `index.ts`
  - 从单纯 register 入口改为方言系统入口
- 全局 `registered` 机制
  - 改成 graph 绑定式注册

### 15.4 需要新增

- `ProfileRegistry`
- `compileProfile()`
- `ProfileContext`
- `DialectDetector`
- `ImporterAdapter` / `ExporterAdapter`
- `FieldCapability`

---

## 16. 直接重构实施顺序

既然不要求渐进演化，建议按 4 个重构批次推进。

### 批次 1：内核重构

目标：先把“方言系统”立起来。

内容：

- `Dialect/Profile` 类型
- `ProfileRegistry`
- `compileProfile()`
- `ProfileContext`
- `bpmn2` / `smartengine-base` / `smartengine-custom` / `smartengine-database` 基础定义

### 批次 2：规则与字段能力重构

内容：

- 迁移 `connection-rules.ts`
- 改造 `validator.ts` 为 context 驱动
- 建立 `FieldCapability`
- 将 `classifyShape()`、`BpmnFormData` 逻辑收敛到数据模型层

### 批次 3：渲染重构

内容：

- 建立 `rendering` 层
- 提取 node/edge renderer factory
- 将当前 shape 注册逻辑改为 profile 驱动
- 建立 graph 绑定入口

### 批次 4：导入导出重构

内容：

- 建立 `DialectDetector`
- 拆出 BPMN2 / SmartEngine 导入导出 adapter
- 将原有 importer/exporter 按 adapter 重新组织

---

## 17. 测试体系

### 17.1 编译测试

必须验证：

- profile 继承链可正确解析
- 缺失父 profile 会失败
- 循环继承会失败
- 删除语义生效
- 未知 renderer / shape / mapping 引用会失败

### 17.2 ResolvedProfile 快照测试

对编译结果做快照，确保：

- `bpmn2`
- `smartengine-base`
- `smartengine-custom`
- `smartengine-database`

在每次重构后仍然稳定。

### 17.3 规则测试

验证：

- `bpmn2` 下现有规则兼容
- `smartengine-base` 默认继承 BPMN2.0 全量规则能力
- `smartengine-custom` 仅在使用该叠加层时收紧规则
- `smartengine-database` 仅在使用该叠加层时增强审批相关规则
- 高阶约束规则生效

### 17.4 字段能力测试

验证：

- 默认值填充
- normalize 生效
- validate 生效
- serialize / deserialize 生效
- 不同 profile 的字段能力差异正确

### 17.5 渲染测试

验证：

- 同一 shape 在不同 profile 下可有不同外观
- 禁用元素不会被注册
- 多 graph 实例不会互相污染

### 17.6 导入导出测试

验证：

- BPMN2 导入导出兼容现有结果
- SmartEngine 命名空间输出正确
- SmartEngine 扩展属性输出正确
- `smartengine-database` 下的多实例结构输出正确
- detector 可识别方言

---

## 18. 最终结论

最终推荐结论如下：

> 主库应从“固定 BPMN 2.0 插件”升级为“流程方言内核”。
>
> 其核心结构应为：
>
> - `Profile` 作为方言载体
> - `compileProfile()` 作为编译入口
> - `ProfileContext` 作为运行时边界
> - `definitions / availability / rendering / rules / dataModel / serialization` 六层配置模型
> - `FieldCapability` 作为字段能力边界
> - `DialectDetector + ImporterAdapter + ExporterAdapter` 作为导入导出插件体系
>
> 同时，主库只负责能力定义，不维护任何 UI 元数据。

并且必须明确：

> `smartengine-base` 默认支持并继承全量 BPMN2.0；
> `custom` / `database` 的差异不应被建模为“替代 BPMN2.0 的基础方言”，
> 而应被建模为“在特定 mode 要求下叠加的约束 / 增强层”。

如果只保留一句话：

> 当前最优方案不是把 SmartEngine 视为 BPMN2.0 的精简替代，而是把主库重构为一个以 BPMN2.0 为母版、以 SmartEngine 扩展为增强层、以 mode requirements 为叠加层的流程方言系统。
