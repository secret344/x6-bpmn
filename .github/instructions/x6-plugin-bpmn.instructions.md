---
description: "Use when editing x6-plugin-bpmn source or tests. Enforce business-driven tests and 100% coverage verification."
applyTo:
  - "packages/x6-plugin-bpmn/src/**/*.ts"
  - "packages/x6-plugin-bpmn/tests/**/*.test.ts"
---

# x6-plugin-bpmn 变更规范 / Change Guardrails

## 语言规范 / Language Conventions

- **代码注释**（`//`、`/* */`、JSDoc）必须使用**中文**。
  Code comments (`//`, `/* */`, JSDoc) must be written in **Chinese only**.
- **文档文件**（`.md`、`.instructions.md`、`.prompt.md` 等）须使用**中英双语**，中文在前，英文紧随其后。
  Documentation files (`.md`, `.instructions.md`, `.prompt.md`, etc.) must be **bilingual**: Chinese first, English immediately after.
- 变量名、函数名、类型名等标识符保持英文。
  Identifiers (variables, functions, types) remain in English.

## 适用范围 / When this applies
- 规则、图形、适配器、导出流水线、几何计算、连线、行为处理器或方言管理的任何逻辑变更。
  Any logic change in rules, shapes, adapters, export pipeline, geometry, connections, behavior handlers, or dialect management.
- 插件运行时行为的任何回归修复。
  Any regression fix in plugin runtime behavior.

## 强制验证 / Mandatory validation
- 完成前必须执行测试。Always execute tests before finalizing.
- 变更跨多个模块、影响行为契约或修改分支逻辑时，运行 `npm run test:coverage`。
  Run `npm run test:coverage` when change spans multiple modules, affects behavior contracts, or modifies branching logic.
- 范围较小的独立变更至少运行 `npm run test`。
  Run at least `npm run test` for narrowly scoped updates.

## 测试质量要求 / Business-related test policy
- 添加代表真实 BPMN 或 SmartEngine 使用路径的测试。
  Add tests that represent real BPMN or SmartEngine usage paths.
- 优先编写包含"准备—操作—断言"的场景测试。
  Prefer scenario tests that include setup, action, and expected domain behavior.
- 避免仅为提高覆盖率而添加的测试用例。
  Avoid test cases whose only purpose is touching lines for coverage.
- 在能断言业务结果时，避免仅检查存在性的弱断言。
  Avoid weak assertions like existence-only checks if business outcomes can be asserted.
- 无头浏览器测试必须生成并断言视觉快照，不能只保留截图产物或仅验证流程通过。
  Headless browser tests must generate and assert visual snapshots; saving screenshot artifacts or asserting pass/fail alone is insufficient.
- 若预期的界面变化会更新基线快照，需在回归中显式更新快照并复核差异是否符合业务预期。
  When intended UI changes require new baselines, update the snapshots explicitly during regression and review the visual diffs against expected business behavior.
- 浏览器回归测试文件必须放在 `packages/x6-plugin-bpmn/tests/browser/*.spec.ts`；若同一行为域已有对应 spec，必须复用该文件，不得为同类回归再创建平行重复 spec。
  Browser regression specs must live under `packages/x6-plugin-bpmn/tests/browser/*.spec.ts`; if a spec already exists for the same behavior area, reuse it instead of creating a parallel duplicate spec.
- 某个浏览器 spec 的快照基线只能放在 `packages/x6-plugin-bpmn/tests/browser/<spec-file>.ts-snapshots/` 下，并按测试用例目录归档。
  Snapshot baselines for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/<spec-file>.ts-snapshots/`, organized by test-case folders.
- 某个浏览器 spec 的运行期截图产物只能放在 `packages/x6-plugin-bpmn/tests/browser/artifacts/screenshots/` 下，并与快照使用相同的测试用例目录结构。
  Runtime screenshot artifacts for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/artifacts/screenshots/`, using the same test-case folder structure as snapshots.
- 运行期截图产物必须在测试执行时直接落盘到该固定目录，以便人工核验；不得先写到其他位置，再通过事后迁移或清理来修正目录结构。
  Runtime screenshot artifacts must be written directly to that fixed directory during test execution so they remain available for manual verification; do not write them elsewhere first and normalize the structure later via moving or cleanup.
- 不得为已有 browser spec 另建平铺 png、兄弟级 snapshot 目录或替代 artifact 目录；同一用例只允许在既有目录内更新文件，避免重复创建。
  Do not create flat png files, sibling snapshot folders, or alternate artifact directories for an existing browser spec; update files only within the existing directory structure to avoid duplicate creation.
- 浏览器 spec 文件按业务域拆分：容器/拖拽行为一个 spec，泳道 resize 行为一个 spec，连线规则一个 spec 等。不要把所有测试强制塞进同一个 spec 文件。
  Browser spec files should be organized by business domain: containment/drag behavior in one spec, swimlane resize behavior in another, connection rules in another, etc. Do not force all browser tests into a single spec file.
- 直接拖拽（`node:moved`）与选区拖拽（`batch:stop` `move-selection`）是完全不同的交互路径，行为差异场景必须分别编写测试用例。
  Direct drag (`node:moved`) and selection drag (`batch:stop` `move-selection`) are distinct interaction paths; create separate test cases for each when the behavior differs.
- 生成的 spec 文件名不得与浏览器测试目录内已有 spec 文件名重复。
  Generated spec file names must not duplicate any existing spec file name in the browser test directory.
- 发现架构性问题且补丁无法清晰修复时，允许且鼓励全面重构，而非层叠变通。
  When an architectural issue is discovered that a patch cannot cleanly fix, thorough refactoring is permitted and encouraged over incremental workarounds.

## 推荐回归流程 / Recommended regression flow
1. 通过失败测试复现问题。Reproduce problem via failing test.
2. 修复实现。Fix implementation.
3. 重新运行完整插件测试，验证覆盖率阈值维持 100%。
   Re-run full plugin tests and verify coverage thresholds remain 100%.

## 测试 XML 生成规范 / Test XML Generation

**禁止**在测试文件中使用原始 XML 模板字符串。所有 BPMN XML 必须通过标准工具链生成。
Do **not** write raw XML template strings in test files. All BPMN XML must be generated through the standard toolchain.

### 标准测试工具 / Standard test utilities

| 工具 / Utility | 路径 / Path | 用途 / Purpose |
|---|---|---|
| `buildAndValidateBpmn(spec)` | `tests/helpers/bpmn-builder.ts` | 通过 bpmn-moddle 将声明式规格构建为合法 XML / Build valid XML from a declarative spec via bpmn-moddle |
| `bpmnRoundtrip(spec, createGraph)` | `tests/helpers/roundtrip.ts` | 完整五步往返：构建 → 解析 → 加载 → 导出 → 验证 / Full 5-step roundtrip: build → parse → load → export → validate |
| `validateBpmnXml(xml)` | `tests/helpers/bpmn-builder.ts` | 仅验证已有 XML 是否合法 / Validate an existing XML string only |

### 往返测试五步流程 / 5-step roundtrip flow

```
1. buildAndValidateBpmn(spec)   → 入口 XML（经 bpmn-moddle 验证）
2. parseBpmnXml(xml)            → 中间 JSON（BpmnImportData）
3. loadBpmnGraph(graph, data)   → X6 图形节点/边加载
4. exportBpmnXml(graph)         → 导出 XML
5. validateBpmnXml(exportedXml) → 出口 XML（经 bpmn-moddle 验证）
```

新增导入/导出/往返相关测试时**必须**使用 `bpmnRoundtrip`；仅测试解析或节点映射时可单独使用 `buildAndValidateBpmn`。
Use `bpmnRoundtrip` for any import/export/roundtrip test. Use `buildAndValidateBpmn` alone only when testing parsing or node-mapping in isolation.

## 文件拆分规范 / File Splitting Conventions

### 源码目录结构 / Source directory layout (`src/`)

每个子目录对应一个业务域，不得跨域混写逻辑：
Each subdirectory corresponds to one business domain. Do not place logic across domains.

| 目录 / Directory | 职责 / Responsibility |
|---|---|
| `src/rules/` | BPMN 连线约束、节点分类、Pool 边界验证 / Connection constraints, node categories, Pool boundary |
| `src/import/` | XML → JSON 解析、JSON → 图形加载（两步拆分） / XML→JSON parse + JSON→Graph load (two-step split) |
| `src/export/` | 图形 → XML 导出流水线 / Graph→XML export pipeline |
| `src/shapes/` | 节点形状定义 / Node shape definitions |
| `src/adapters/` | BPMN2 / SmartEngine / X6 三方适配器 / Adapters for BPMN2, SmartEngine, X6 |
| `src/config/` | 图标、样式等静态配置 / Icons, styles and static config |
| `src/behaviors/` | 图形交互行为处理器 / Graph interaction behavior handlers |
| `src/builtin/` | 内置方言/Profile 定义 / Built-in dialect and profile definitions |
| `src/core/` | 方言编译、合并、检测等核心逻辑 / Dialect compile, merge, detect core logic |
| `src/utils/` | 无业务依赖的纯工具函数 / Pure utilities with no business dependencies |

### 测试目录结构 / Test directory layout (`tests/`)

| 目录 / Directory | 职责 / Responsibility |
|---|---|
| `tests/helpers/` | 共享测试工具（bpmn-builder、roundtrip）；不得包含 `it`/`describe` / Shared test utilities; must not contain `it`/`describe` |
| `tests/bpmn2/` | 所有 BPMN 2.0 业务路径测试，按域与 `src/` 镜像 / All BPMN 2.0 tests, mirroring `src/` by domain |
| `tests/smart/` | SmartEngine 方言相关测试 / SmartEngine dialect tests |

### 拆分原则 / When to split a file

- 单个测试文件超过 **400 行**时应考虑按测试场景拆分。
  Split a test file when it exceeds **400 lines**; group by test scenario.
- 单个源码文件承担超过一个业务职责时必须拆分。
  Split a source file when it carries more than one business responsibility.
- 新增功能时，若对应域目录下已有文件可扩展，优先扩展而非新建。
  Prefer extending an existing file in the correct domain directory over creating a new one.

## BPMN 规范约束来源 / BPMN Constraint Authority

**所有 BPMN 约束条文以官方规范文档为唯一准据，不得在本文件或代码注释中自行归纳或硬编码约束结论。**
All BPMN constraint rules must be grounded in the official specification. Do not summarise or hardcode constraint conclusions in this file or in code comments.

规范文档位置 / Specification document:
```
packages/bpmn2-spec/formal-11-01-03.pdf
```

辅助中文详解 / Supporting Chinese reference:
```
packages/bpmn2-spec/BPMN2_详细规范/
```

### 约束验证流程 / Constraint verification workflow

当需要新增、修改或验证任何 BPMN 连线规则、节点约束、Pool/Lane 边界规则、网关行为时，**必须**：
When adding, changing, or verifying any BPMN connection rule, node constraint, Pool/Lane boundary rule, or gateway behavior, you **must**:

1. 在 `packages/bpmn2-spec/formal-11-01-03.pdf` 中找到对应章节和条款编号。
   Locate the relevant section and clause number in `packages/bpmn2-spec/formal-11-01-03.pdf`.
2. 在测试或代码注释中引用该章节编号（如 `§13.2.2`）作为来源。
   Cite that section number (e.g. `§13.2.2`) in the test or code comment as the authoritative source.
3. 若规范中未覆盖某行为，不得将其视为约束，应在 PR 说明中注明。
   If the spec does not cover a behavior, do not treat it as a constraint; note it in the PR description.
4. 若仓库中的描述、测试名称、注释、已有总结或中文详解与规范不一致，必须回查 PDF 原文并以 PDF 为准，同步修正实现或表述。
  If repository descriptions, test names, comments, prior summaries, or the Chinese reference differ from the spec, re-check the original PDF text and use the PDF as the authority, then align the implementation or wording.
5. 若 PDF 仅能支持弱推导、不能支持明确禁止，不得把该结论写成“规范要求”；应改写为“当前实现限制”或“产品约束”。
  If the PDF supports only a weak inference and not an explicit prohibition, do not write the conclusion as a normative BPMN requirement; describe it as a current implementation limit or product constraint instead.

### 禁止事项 / Prohibited
- 禁止在本指令文件内写死具体 BPMN 约束条文（如"顺序流不得跨 Pool"）。
  Do not hardcode specific BPMN constraint statements in this instruction file (e.g. "sequence flow must not cross pools").
- 禁止以非规范来源（博客、经验总结等）作为约束依据。
  Do not use non-specification sources (blog posts, experience summaries, etc.) as the basis for constraints.
- 禁止在未回查 `formal-11-01-03.pdf` 原文前，仅依据仓库现有表述复述或扩大解释 BPMN 约束。
  Do not restate or broaden BPMN constraints based only on repository wording before checking the original `formal-11-01-03.pdf` text.
