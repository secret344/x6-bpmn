# 项目上手与代码阅读指南

Project Onboarding and Code Reading Guide

## 1. 包级职责图 / Package-Level Responsibility Map

| 包 / Package | 角色 / Role | 什么时候打开 / When to open |
|---|---|---|
| `packages/x6-plugin-bpmn` | 主库 | 任何通用能力、规则、导入导出、行为问题都先看这里 |
| `packages/example` | 标准接入示例 | 想看主库如何被最直接地接入时 |
| `packages/dialect-demo` | 方言系统示例 | 想看 `DialectManager` 与 `Profile` 的宿主用法时 |
| `packages/smartengine-demo` | SmartEngine 方言示例 | 想看业务方言如何扩展 BPMN2 时 |
| `packages/approval-flow` | 业务风格示例 | 想看贴近业务界面的实际画布组织时 |
| `packages/bpmn2-spec` | 官方规范与中文辅助材料 | 修改规范性约束之前 |
| `packages/bpmn-moddle` | XML/moddle 参照实现 | 调整 XML 解析与序列化行为时 |
| `packages/bpmn-js` | 社区建模器参照实现 | 对照社区交互实现时 |

| Package | Role | When to open |
|---|---|---|
| `packages/x6-plugin-bpmn` | Main library | Start here for any reusable capability, rule, import/export, or behavior issue |
| `packages/example` | Baseline integration demo | Open when you want the most direct example of plugin integration |
| `packages/dialect-demo` | Dialect-system demo | Open when you want the host usage of `DialectManager` and `Profile` |
| `packages/smartengine-demo` | SmartEngine dialect demo | Open when you want to see business dialects extending BPMN2 |
| `packages/approval-flow` | Business-flavored demo | Open when you want a domain-oriented canvas organization example |
| `packages/bpmn2-spec` | Official spec and Chinese reference material | Read before changing spec-driven constraints |
| `packages/bpmn-moddle` | XML/moddle reference implementation | Read when changing XML parse/serialize behavior |
| `packages/bpmn-js` | Community modeler reference implementation | Read when comparing community interaction behavior |

## 2. 主库分层 / Main Library Layers

| 目录 / Directory | 作用 / Responsibility |
|---|---|
| `src/index.ts` | 总入口，统一导出公开能力 |
| `src/core/dialect` | 方言注册、编译、绑定与运行时入口 |
| `src/rules` 与 `src/core/rules` | BPMN 规则与方言规则适配 |
| `src/import` 与 `src/export` | XML 与图状态的双向转换 |
| `src/behaviors` | 边界事件附着、containment 等运行时行为 |
| `src/shapes`、`src/connections`、`src/config`、`src/utils` | 图形定义、分类、标签、常量 |

| Directory | Responsibility |
|---|---|
| `src/index.ts` | Public entry point |
| `src/core/dialect` | Dialect registration, compilation, binding, and runtime entry points |
| `src/rules` and `src/core/rules` | BPMN rules and dialect-aware rule adapters |
| `src/import` and `src/export` | Two-way conversion between XML and graph state |
| `src/behaviors` | Runtime behaviors such as boundary attachment and containment |
| `src/shapes`, `src/connections`, `src/config`, `src/utils` | Shape definitions, classification, labels, and constants |

## 3. 建议阅读顺序 / Recommended Reading Order

1. `src/index.ts`
2. `src/core/dialect/types.ts`
3. `src/core/dialect/registry.ts`
4. `src/core/dialect/compiler.ts`
5. `src/core/dialect/context.ts`
6. `src/core/dialect/index.ts`
7. `src/rules/validator.ts`
8. `src/core/rules/validator.ts`
9. `src/import/index.ts` -> `src/import/xml-parser.ts` -> `src/import/graph-loader.ts`
10. `src/export/index.ts` -> `src/export/bpmn-mapping.ts` -> `src/export/exporter.ts`
11. `src/behaviors/boundary-attach.ts` 与 `src/behaviors/pool-containment.ts`

1. `src/index.ts`
2. `src/core/dialect/types.ts`
3. `src/core/dialect/registry.ts`
4. `src/core/dialect/compiler.ts`
5. `src/core/dialect/context.ts`
6. `src/core/dialect/index.ts`
7. `src/rules/validator.ts`
8. `src/core/rules/validator.ts`
9. `src/import/index.ts` -> `src/import/xml-parser.ts` -> `src/import/graph-loader.ts`
10. `src/export/index.ts` -> `src/export/bpmn-mapping.ts` -> `src/export/exporter.ts`
11. `src/behaviors/boundary-attach.ts` and `src/behaviors/pool-containment.ts`

## 4. 常见改动应该去哪里 / Where Common Changes Usually Belong

| 任务 / Task | 首选目录 / Primary directory |
|---|---|
| 新增标准图形或调整图形渲染 | `src/shapes`、`src/connections` |
| 修改连线规则 | `src/rules`、`src/core/rules` |
| 修改字段默认值、规范化、字段校验 | `src/core/data-model` |
| 修改方言继承、合并、编译 | `src/core/dialect` |
| 修改 graph 绑定、自动校验接线 | `src/core/dialect` |
| 修改 XML 解析 | `src/import` |
| 修改 XML 导出 | `src/export` |
| 修改边界事件或 containment 交互 | `src/behaviors` |
| 修改宿主接入示例 | 对应 demo 包或 `packages/example` |

| Task | Primary directory |
|---|---|
| Add a standard shape or adjust shape rendering | `src/shapes`, `src/connections` |
| Change connection rules | `src/rules`, `src/core/rules` |
| Change field defaults, normalization, or validation | `src/core/data-model` |
| Change dialect inheritance, merge, or compilation | `src/core/dialect` |
| Change graph binding or auto-wired validation | `src/core/dialect` |
| Change XML parsing | `src/import` |
| Change XML export | `src/export` |
| Change boundary or containment interactions | `src/behaviors` |
| Change host integration examples | the relevant demo package or `packages/example` |

## 5. 修改前的三个检查点 / Three Checks Before You Change Anything

1. 这是主库能力，还是某个 demo 的宿主逻辑？
2. 这是 BPMN 规范约束，还是业务方自己定义的限制？
3. 这条链路更接近图形注册、方言绑定、导入，还是导出？

1. Is this a core library capability or host logic inside a demo?
2. Is this a BPMN specification constraint or a business-defined restriction?
3. Is the change closer to shape registration, dialect binding, import, or export?

## 6. 测试与验证 / Tests and Validation

主库测试位于 `packages/x6-plugin-bpmn/tests`，目录基本与 `src` 对应。

Plugin tests live under `packages/x6-plugin-bpmn/tests` and mostly mirror `src`.

- `tests/bpmn2`：标准 BPMN2 行为和能力测试。
- `tests/smart`：SmartEngine 相关测试。
- `tests/helpers`：共享测试工具，只放工具，不放 `describe` / `it`。

- `tests/bpmn2`: standard BPMN2 behavior and capability tests.
- `tests/smart`: SmartEngine-related tests.
- `tests/helpers`: shared test helpers only; no `describe` / `it` blocks belong here.

推荐验证顺序：

Recommended validation order:

```bash
pnpm --filter @x6-bpmn2/plugin test:browser
pnpm --filter @x6-bpmn2/plugin test:coverage
```

如果只改了局部逻辑，至少运行主库测试；涉及规则、导入导出或运行时行为时，按上面的顺序做完整验证。示例项目不再保留独立自动化测试入口。

If you only change a small isolated path, run the plugin tests at minimum. For rule, import/export, or runtime behavior changes, use the full validation order above. The example app no longer keeps a separate automated test entry.

## 7. 相关文档 / Related Documents

- [../README.md](../README.md)：工作区总览。
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)：主库 API 与模块说明。
- [custom-extension-guide.md](custom-extension-guide.md)：宿主如何按最小代价扩展标准图形、Profile 与 XML 语义。

- [../README.md](../README.md): workspace overview.
- [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md): main library API and module guide.
- [custom-extension-guide.md](custom-extension-guide.md): how host apps extend standard shapes, profiles, and XML semantics with minimal changes.