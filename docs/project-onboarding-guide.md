# 项目上手与代码阅读指南

Project Onboarding and Code Reading Guide

## 1. 适用对象 / Audience

这份文档面向仓库维护者和二次开发者，帮助你快速定位包职责、主库入口和常见改动落点。

This document is for repository maintainers and secondary developers. It helps you quickly locate package responsibilities, library entry points, and common change locations.

## 2. 仓库阅读入口 / Repository Entry Points

建议先按下面顺序建立上下文：

Build context in the following order:

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. `packages/x6-plugin-bpmn/src/index.ts`
4. 再根据任务进入 `src/core/dialect`、`src/rules`、`src/import`、`src/export` 或 `src/behaviors`

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. `packages/x6-plugin-bpmn/src/index.ts`
4. Then move into `src/core/dialect`, `src/rules`, `src/import`, `src/export`, or `src/behaviors` based on the task

## 3. 包职责图 / Package Responsibility Map

| 包 / Package | 作用 / Purpose | 何时查看 / When to open |
|---|---|---|
| `packages/x6-plugin-bpmn` | 主库 | 任何通用能力、规则、导入导出、行为问题 |
| `packages/example` | 标准接入示例 | 想看最直接的宿主接入方式 |
| `packages/dialect-demo` | 方言系统示例 | 想看 `Profile`、`DialectManager`、按图绑定 |
| `packages/smartengine-demo` | SmartEngine 示例 | 想看方言扩展如何落到宿主项目 |
| `packages/approval-flow` | 业务风格示例 | 想看接近业务编辑器的画布组织 |
| `packages/bpmn2-spec` | 规范只读参照 | 修改 BPMN 约束前 |
| `packages/bpmn-moddle` | XML 只读参照实现 | 修改 XML 解析或序列化前 |
| `packages/bpmn-js` | 建模器只读参照实现 | 对照社区交互行为时 |

| Package | Purpose | When to open |
|---|---|---|
| `packages/x6-plugin-bpmn` | Core library | Any reusable capability, rule, import/export, or runtime behavior issue |
| `packages/example` | Baseline integration demo | When you want the most direct host integration |
| `packages/dialect-demo` | Dialect-system demo | When you need `Profile`, `DialectManager`, and per-graph binding examples |
| `packages/smartengine-demo` | SmartEngine demo | When you want host-level dialect extension examples |
| `packages/approval-flow` | Business-flavored demo | When you want a more domain-oriented editor layout |
| `packages/bpmn2-spec` | Read-only spec reference | Before changing BPMN constraints |
| `packages/bpmn-moddle` | Read-only XML reference implementation | Before changing XML parsing or serialization |
| `packages/bpmn-js` | Read-only modeler reference implementation | When comparing community-modeler behavior |

## 4. 主库入口图 / Main Library Entry Map

| 目录 / Directory | 作用 / Responsibility |
|---|---|
| `src/index.ts` | 公开 API 总入口 |
| `src/core/dialect` | 方言注册、编译、上下文、绑定 |
| `src/rules` 与 `src/core/rules` | BPMN 规则与方言规则校验 |
| `src/import` | XML 解析与图装载 |
| `src/export` | 图状态导出 XML |
| `src/behaviors` | 运行时交互行为 |
| `src/core/data-model` | 字段默认值、规范化、校验 |
| `src/shapes`、`src/connections`、`src/config`、`src/utils` | 图形、连接、配置和底层工具 |

| Directory | Responsibility |
|---|---|
| `src/index.ts` | Public API entry |
| `src/core/dialect` | Dialect registration, compilation, context, and binding |
| `src/rules` and `src/core/rules` | BPMN and dialect-aware rule validation |
| `src/import` | XML parsing and graph loading |
| `src/export` | Graph-to-XML export |
| `src/behaviors` | Runtime interaction behaviors |
| `src/core/data-model` | Field defaults, normalization, and validation |
| `src/shapes`, `src/connections`, `src/config`, `src/utils` | Shapes, connections, configuration, and low-level utilities |

## 5. 常见改动落点 / Common Change Locations

| 任务 / Task | 首选目录 / Primary location |
|---|---|
| 新增或修改标准图形 | `src/shapes`、`src/connections` |
| 调整连线规则 | `src/rules`、`src/core/rules` |
| 调整字段能力或校验 | `src/core/data-model` |
| 调整方言继承、合并、编译 | `src/core/dialect` |
| 调整 graph 绑定和运行时上下文 | `src/core/dialect` |
| 调整 XML 导入 | `src/import` |
| 调整 XML 导出 | `src/export` |
| 调整边界事件、containment、swimlane 等行为 | `src/behaviors` |
| 调整宿主接入示例 | 对应 demo 包 |

| Task | Primary location |
|---|---|
| Add or modify standard shapes | `src/shapes`, `src/connections` |
| Adjust connection rules | `src/rules`, `src/core/rules` |
| Adjust field capabilities or validation | `src/core/data-model` |
| Adjust dialect inheritance, merge, or compilation | `src/core/dialect` |
| Adjust graph binding and runtime context | `src/core/dialect` |
| Adjust XML import | `src/import` |
| Adjust XML export | `src/export` |
| Adjust boundary, containment, swimlane, or related behaviors | `src/behaviors` |
| Adjust host integration examples | the relevant demo package |

## 6. 改动前检查 / Pre-change Checks

动手前先确认三件事：

Confirm three things before changing code:

1. 这是主库通用能力，还是某个宿主项目自己的逻辑。
2. 这是 BPMN 规范约束，还是业务产品规则。
3. 这次改动更接近图形、规则、方言、导入、导出还是运行时行为。

1. Whether the change belongs to the reusable library or to a specific host project.
2. Whether the change is a BPMN specification constraint or a business rule.
3. Whether the change is mainly about shapes, rules, dialects, import, export, or runtime behavior.

## 7. 验证顺序 / Validation Order

推荐执行顺序：

Recommended execution order:

```bash
pnpm run typecheck
pnpm --filter @x6-bpmn2/plugin test
pnpm --filter @x6-bpmn2/plugin test:browser
pnpm --filter @x6-bpmn2/plugin test:coverage
```

`pnpm run typecheck` 会覆盖 TypeScript 包和 Vue 包。主库逻辑变更至少跑 `test`，规则、导入导出或运行时行为变更优先补跑 `test:browser` 与 `test:coverage`。

`pnpm run typecheck` covers both TypeScript and Vue packages. Run at least `test` for plugin logic changes, and prefer `test:browser` plus `test:coverage` for rule, import/export, or runtime behavior changes.

## 8. 相关文档 / Related Documents

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. [custom-extension-guide.md](custom-extension-guide.md)
4. [smartengine-xml-extension-reference.md](smartengine-xml-extension-reference.md)

1. [../README.md](../README.md)
2. [../packages/x6-plugin-bpmn/README.md](../packages/x6-plugin-bpmn/README.md)
3. [custom-extension-guide.md](custom-extension-guide.md)
4. [smartengine-xml-extension-reference.md](smartengine-xml-extension-reference.md)