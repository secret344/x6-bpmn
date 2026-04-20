# 当前项目 SmartEngine 兼容调整方案

SmartEngine Compatibility Adjustment Plan for This Project

## 1. 文档定位

本文档只描述当前仓库需要调整的方案，不复述 BPMN 规范，也不展开 SmartEngine 的完整产品能力。

目标是把这轮已经确认的问题收敛成当前项目可执行的改动边界，避免后续同时改动导入、导出、方言和宿主逻辑时再次分叉。

这不是对外用户文档，也不是最终实现记录。重点是回答三件事：

1. 当前项目到底准备保什么语义。
2. 哪些能力按标准 BPMN 处理，哪些能力按 Smart 方言处理。
3. 代码层面优先改哪里，不改哪里。

## 2. 当前项目已确认的问题

### 2.1 业务元素 id 与导出结果不一致

当前导入链路里，业务元素 id 实际已经直接作为图中的真实 id 使用，代码落点在 [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts) 和 [../packages/x6-plugin-bpmn/src/import/types.ts](../packages/x6-plugin-bpmn/src/import/types.ts)。

问题主要不在业务元素 id，而在导出阶段会重建一批结构层和 DI 层 id，代码落点在 [../packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts)。当前重建对象包括但不限于：

1. `definitions` / `BPMNDiagram` / `BPMNPlane`
2. `LaneSet_*`
3. `*_di` / `*_ed`

这会导致“导入什么，导出还是什么”的预期只对业务元素成立，对结构层和 DI 层并不成立。

### 2.2 Smart 会签语义和标准 BPMN 不一致

标准 BPMN 只支持单个 `completionCondition`。但 SmartEngine 实际支持两个语义槽位：

1. 普通完成条件
2. `action="abort"` 对应的中止条件

当前仓库的 Smart 序列化只支持单个 `multiInstanceCompletionCondition`，代码落点在 [../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts)。

也就是说，当前项目还没有把 Smart 的双条件语义完整建模出来。

### 2.3 标准工具链不能无损保留 Smart 双条件

这点已经通过规范、`bpmn-moddle` 和 `bpmn-js` 行为确认：

1. 标准工具链不会把双 `completionCondition` 当成标准 BPMN 能力处理。
2. 第二个 `completionCondition` 上的 `action="abort"` 不是标准属性。
3. 如果继续把它伪装成标准 BPMN，导入和再导出时就会发生语义丢失或降级。

对当前项目来说，这意味着 Smart 会签必须作为方言能力处理，不能继续混在通用 BPMN 语义里。

### 2.4 非法 XML 目前缺少稳定的入口校验结果

当前 XML 解析入口在 [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)。现状是可以调用 `bpmn-moddle` 完成解析，但还没有把 warnings 和项目关心的一致性问题收敛成稳定的导入结果。

这会带来两个直接问题：

1. XML 本身不合法时，用户只能在后续行为里间接发现异常。
2. 一些“能解析但不适合当前项目语义”的输入没有被明确标注为兼容输入或有损输入。

## 3. 本项目的调整目标

这轮方案只收敛四个目标。

### 3.1 业务元素 id 只保留一份

当前项目的主方案是：

1. BPMN 业务元素 id 直接作为图中真实 id 使用。
2. 不再额外维护一套内部业务 id。
3. 不把“原始业务 id”再冗余存入 `data` 里做第二套主键。

这样可以避免导入后同时维护“图 id”和“业务 id”两套身份体系，减少后续规则、表单、连线和宿主逻辑的同步成本。

### 3.2 结构层与 DI 层 id 按保真元数据处理

对于 `definitions`、`BPMNDiagram`、`BPMNPlane`、`LaneSet`、`BPMNShape`、`BPMNEdge` 这类结构层和 DI 层 id，当前项目不把它们纳入业务主键逻辑。

本项目目标是：

1. 如果导入时拿到了原始结构层 / DI 层 id，就按保真元数据保存。
2. 导出时优先复用保真元数据。
3. 如果缺失，就按当前导出器策略补建。

也就是说，这类 id 的目标是 roundtrip 保真，而不是进入业务逻辑主路径。

### 3.3 Smart 双条件会签按方言字段建模

当前项目不采用“多个 `completionCondition` 数组化”的设计。

本项目目标是把 Smart 会签建成两个明确字段：

1. `multiInstanceCompletionCondition`
2. `multiInstanceAbortCondition`

这样可以直接对应 SmartEngine 的真实语义位，也能避免把标准 BPMN 和 Smart 方言混在同一个字段模型里。

### 3.4 导入结果要区分标准、兼容和有损

当前项目需要让导入器显式区分三类输入：

1. 标准可保真输入
2. 当前项目可兼容输入
3. 当前项目只能有损处理的输入

这里不一定要马上做成公开 API 上的三种 mode，但内部实现至少要形成这套判断标准。

## 4. 方案原则

### 4.1 保持一个 BPMN importer / exporter 主链路

当前项目不引入第二套独立的 Smart XML importer / exporter。

仍然沿用一套 BPMN 主链路，再通过 profile 或 serialization hook 注入 Smart 方言能力。涉及的主要落点包括：

1. [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)
2. [../packages/x6-plugin-bpmn/src/import/adapter.ts](../packages/x6-plugin-bpmn/src/import/adapter.ts)
3. [../packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts)
4. [../packages/x6-plugin-bpmn/src/export/adapter.ts](../packages/x6-plugin-bpmn/src/export/adapter.ts)
5. [../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts)

### 4.2 标准 BPMN 语义和 Smart 方言语义分层处理

当前项目后续实现里，应当明确分成两层：

1. 标准 BPMN 层：只处理标准节点、标准属性、标准单值 `completionCondition`。
2. Smart 方言层：处理 Smart 扩展属性和 Smart 双条件会签。

这意味着 Smart 扩展不能再伪装成“标准 BPMN 的另一种写法”。

### 4.3 业务 id 保真优先级高于结构 id 保真

如果两者出现冲突，当前项目优先保证业务元素 id 稳定，不为了结构层保真去引入第二套业务 id 或破坏现有图逻辑。

## 5. 需要调整的代码范围

### 5.1 导入侧

主要落点： [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)

当前项目需要在这里补三类能力：

1. 消费 `bpmn-moddle` warnings，并形成稳定的导入诊断结果。
2. 补当前项目需要的一致性检查，例如重复 id、失效引用、`BPMNPlane@bpmnElement` 指向不存在元素等。
3. 在 Smart profile 下识别双条件会签，并把 abort 语义提取到独立字段，而不是默默丢弃。

如果 XML 里出现当前项目无法保真的 Smart 语义，导入结果至少要带明确警告，而不是继续伪装成成功的标准导入。

### 5.2 导出侧

主要落点： [../packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts)

当前项目需要在这里调整两件事：

1. 业务元素 id 继续直接使用节点 / 边的真实 id 导出。
2. 结构层和 DI 层如果存在保真元数据，则优先复用原始 id、属性和命名空间，而不是统一重建。

这里不要求把所有结构对象都升级成业务主对象，只要求 roundtrip 时尽量保持原值。

### 5.3 Smart 序列化侧

主要落点： [../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts)

当前项目需要把 Smart 多实例从“单条件字段”扩展为“两个显式语义字段”：

1. 导入时读取普通 completionCondition。
2. 导入时读取 `action="abort"` 对应的 abortCondition。
3. 导出时在 Smart profile 下分别写回。

当前项目不建议把这个能力设计成通用 BPMN 的数组字段，也不建议在非 Smart profile 下默认输出双条件结构。

### 5.4 导入结果与宿主提示

当前项目需要把“能解析”与“语义完整”区分开。

建议输出至少包含下列维度：

1. `warnings`
2. `compatibilityIssues`
3. `lossyFlags`

这样宿主侧才能知道：

1. 当前 XML 是标准输入，还是 Smart 扩展输入。
2. 当前是否发生了有损降级。
3. 是否需要提醒用户切换到 Smart profile 或修正源 XML。

## 6. 需要明确的字段模型

当前项目建议采用下面这组字段，不新增第二套业务 id。

### 6.1 业务元素身份字段

1. `node.id` / `edge.id`：唯一真实业务 id。

### 6.2 Smart 多实例字段

1. `multiInstance`
2. `multiInstanceType`
3. `multiInstanceCollection`
4. `multiInstanceElementVariable`
5. `multiInstanceCompletionCondition`
6. `multiInstanceAbortCondition`

### 6.3 保真元数据字段

可以继续沿用当前导出器已经支持的保真元数据思路，例如：

1. `data.bpmn.$attrs`
2. `data.bpmn.$namespaces`
3. `data.bpmndi.$attrs`
4. `data.bpmndi.$namespaces`

如果后续要补结构层 id roundtrip，也应优先沿着这类保真元数据扩展，而不是引入新的业务身份字段。

## 7. 当前项目明确不做的事

这轮方案明确不做下面几件事：

1. 不新增一套和 BPMN 元素 id 并行的内部业务 id 体系。
2. 不把 Smart 双条件会签包装成标准 BPMN 通用能力。
3. 不承诺 `bpmn-js` / Camunda Modeler 能无损 roundtrip 当前项目的 Smart 会签扩展。
4. 不为了 Smart 扩展单独复制一套 XML importer / exporter。
5. 不修改 `packages/bpmn2-spec`、`packages/bpmn-moddle`、`packages/bpmn-js` 等只读参考子模块。

## 8. 建议的实施顺序

当前项目建议按下面顺序落地，避免一次性同时改太多层：

1. 先补导入 warnings 和一致性校验，让非法输入与有损输入可见。
2. 再补 Smart 多实例双字段建模，让 Smart 语义先能被识别和保存。
3. 再调整导出器的结构层 / DI 层保真策略，减少 roundtrip id 漂移。
4. 最后再补宿主层提示、诊断展示和必要的文档对齐。

这个顺序的原因是：如果导入诊断还不可见，后面再做方言和保真，会很难区分是解析问题、建模问题还是导出问题。

## 9. 验收标准

当下面几条同时成立时，可以认为当前项目的方案落地方向正确：

1. 导入一个合法 BPMN XML 后，业务元素 id 在图中和导出结果中保持一致。
2. 结构层和 DI 层存在原始保真信息时，导出结果优先复用原值。
3. Smart profile 下可以稳定 roundtrip 普通完成条件和 abort 条件两个语义位。
4. 标准 profile 下遇到 Smart 双条件输入时，不会伪装成完全无损导入。
5. 非法 XML 和项目级不一致输入会以明确 warnings 或 compatibility issues 暴露出来。

## 10. 相关文档

1. [smartengine-xml-extension-reference.md](smartengine-xml-extension-reference.md)
2. [smartengine-userguide-zh-cn.md](smartengine-userguide-zh-cn.md)
3. [custom-extension-guide.md](custom-extension-guide.md)
4. [project-onboarding-guide.md](project-onboarding-guide.md)

## 11. 实施清单

这一节只回答“落地时先改什么、改哪些文件、补哪些测试”。

### 11.1 第一阶段：导入诊断先可见

目标：先让非法输入、兼容输入和有损输入在导入阶段可见，避免后续继续把问题推迟到导出或运行时。

涉及文件：

1. [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)
2. [../packages/x6-plugin-bpmn/src/import/types.ts](../packages/x6-plugin-bpmn/src/import/types.ts)
3. [../packages/x6-plugin-bpmn/src/import/adapter.ts](../packages/x6-plugin-bpmn/src/import/adapter.ts)

实施项：

1. 在 `parseBpmnXml` 结果中显式消费 `bpmn-moddle` warnings。
2. 为当前项目补充项目级一致性检查，至少覆盖重复 id、失效引用、`BPMNPlane@bpmnElement` 无效引用。
3. 在导入结果中增加诊断字段，至少包含 `warnings`、`compatibilityIssues`、`lossyFlags`。
4. 明确标记 Smart 双条件输入是否被完整保留，不能保留时必须进入有损标记。

测试补点：

1. 在 [../packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts](../packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts) 附近补一个导入诊断分组，覆盖 warnings 与一致性检查输出。
2. 在 [../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts](../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts) 增加“标准 profile 遇到 Smart 双条件 XML”的降级与提示断言。
3. 如果现有测试文件难以容纳诊断断言，再新增独立的 xml-parser 诊断测试文件，但仍放在 `tests/bpmn2` 或 `tests/smart` 现有分组下。

完成标准：

1. 非法 XML 不再只是“能不能 parse”，而是有明确诊断输出。
2. Smart 双条件输入在标准 profile 下会暴露兼容或有损标记。
3. 宿主侧可以基于导入结果知道是否需要提示用户。

### 11.2 第二阶段：补齐 Smart 双条件字段模型

目标：让当前项目先能完整保存 SmartEngine 会签的两个语义位。

涉及文件：

1. [../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-base/serialization.ts)
2. [../packages/x6-plugin-bpmn/src/builtin/smartengine-base/profile.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-base/profile.ts)
3. [../packages/x6-plugin-bpmn/src/builtin/smartengine-database/profile.ts](../packages/x6-plugin-bpmn/src/builtin/smartengine-database/profile.ts)

实施项：

1. 新增 `multiInstanceAbortCondition` 字段能力定义。
2. 导入 Smart 多实例时，把 `action="abort"` 的条件提取到 `multiInstanceAbortCondition`。
3. 导出 Smart 多实例时，普通完成条件继续写 `completionCondition`，中止条件写带 `action="abort"` 的表达式。
4. 保持标准 BPMN profile 不输出 Smart 双条件结构。

测试补点：

1. 在 [../packages/x6-plugin-bpmn/tests/smart/builtin/builtin-profiles.test.ts](../packages/x6-plugin-bpmn/tests/smart/builtin/builtin-profiles.test.ts) 增加 `multiInstanceAbortCondition` 的字段定义、normalize 和 validate 断言。
2. 在 [../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-serialization-contract.test.ts](../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-serialization-contract.test.ts) 增加 import/export 双条件 contract 断言。
3. 在 [../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts](../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts) 增加完整 Smart 双条件 roundtrip 场景。

完成标准：

1. Smart profile 下，双条件导入后不会丢失 abort 语义。
2. Smart profile 下，双条件导出后能再次导入并还原两个字段。
3. 标准 profile 仍保持单值 `completionCondition` 模型。

### 11.3 第三阶段：结构层与 DI 层保真

目标：减少 roundtrip 时结构层 / DI 层 id 和属性漂移，但不引入第二套业务 id。

涉及文件：

1. [../packages/x6-plugin-bpmn/src/import/xml-parser.ts](../packages/x6-plugin-bpmn/src/import/xml-parser.ts)
2. [../packages/x6-plugin-bpmn/src/export/exporter.ts](../packages/x6-plugin-bpmn/src/export/exporter.ts)

实施项：

1. 导入时提取结构层与 DI 层的原始 id、`$attrs`、`$namespaces` 到保真元数据。
2. 导出时优先复用已保存的结构层和 DI 元信息，而不是直接重建。
3. 业务元素 id 继续直接取 `node.id` / `edge.id`，不做额外映射。
4. 缺失保真元数据时再回退到当前导出器的补建逻辑。

测试补点：

1. 在 [../packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts](../packages/x6-plugin-bpmn/tests/bpmn2/export/export.test.ts) 增加结构层 / DI 层原始属性复用断言。
2. 在 [../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts](../packages/x6-plugin-bpmn/tests/smart/serialization/smartengine-xml-roundtrip.test.ts) 增加带 Smart 命名空间和保真属性的 roundtrip 断言。
3. 用现有 roundtrip helper 验证导入导出后业务元素 id 不漂移。

完成标准：

1. 业务元素 id roundtrip 稳定。
2. 结构层和 DI 层如果存在原始元数据，导出优先复用。
3. 保真失败只影响结构层，不影响业务主键路径。

### 11.4 第四阶段：宿主接入与提示对齐

目标：让宿主项目能消费新的诊断结果和 Smart 字段，而不是只在底层保存能力。

涉及文件：

1. [../packages/x6-plugin-bpmn/src/import/adapter.ts](../packages/x6-plugin-bpmn/src/import/adapter.ts)
2. 相关 demo 或宿主接入层
3. [smartengine-xml-extension-reference.md](smartengine-xml-extension-reference.md)

实施项：

1. 明确 adapter 层是否透出诊断结果。
2. 明确 Smart profile 宿主如何展示 `multiInstanceAbortCondition`。
3. 把“标准输入 / 兼容输入 / 有损输入”的含义同步到宿主文案或日志。
4. 在 Smart XML 参考文档中补一段“当前项目兼容边界”，说明双条件属于 Smart 方言，不属于标准 BPMN 通用能力。

测试补点：

1. 优先补单元测试，避免把第一轮验证压到浏览器回归。
2. 如果 demo 已存在 Smart 导入导出回归路径，再补一条最小场景验证宿主提示链路。

完成标准：

1. 宿主能拿到导入诊断并做提示。
2. Smart 方言字段能在宿主侧被识别和编辑。
3. 文档和实现对 Smart 双条件语义的表述保持一致。

### 11.5 建议的提交切分

为了控制回归面，建议不要把所有改动压成一个大提交。

建议最少拆成三段：

1. 导入诊断与类型补充。
2. Smart 双条件字段与序列化。
3. 结构层 / DI 层保真与 roundtrip 测试。

如果宿主提示层变动较多，可以再拆出第四段单独提交。