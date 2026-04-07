# x6-bpmn2

一个面向 BPMN 2.0 与流程方言扩展的 X6 工作区：既包含可发布的主库，也包含几个用于集成验证和使用示例的示例应用。

An X6 workspace for BPMN 2.0 and process-dialect extensions. It contains the publishable core plugin as well as several demo applications for integration verification and usage examples.

## 1. 仓库定位 / Repository Purpose

这个仓库不是单一示例项目，而是一个分层工作区：

This repository is not a single demo app. It is a layered workspace:

- `packages/x6-plugin-bpmn` 是主库，负责图形注册、方言系统、规则、导入导出、运行时行为。
- `packages/example` 是标准 BPMN 编辑器示例，用来验证主库的基础能力。
- `packages/dialect-demo` 用来验证方言扩展、Profile 编译与按实例绑定。
- `packages/smartengine-demo` 用来验证 SmartEngine 相关方言与宿主集成方式。
- `packages/approval-flow` 是偏业务表达的示例，用来观察主库在具体场景中的落地效果。
- `packages/bpmn2-spec`、`packages/bpmn-moddle`、`packages/bpmn-js` 是只读参照子模块，不参与当前 workspace 的构建与安装。

- `packages/x6-plugin-bpmn` is the main library. It owns shape registration, dialect infrastructure, rules, import/export, and runtime behaviors.
- `packages/example` is the standard BPMN editor demo used to validate baseline plugin capabilities.
- `packages/dialect-demo` validates dialect extension, profile compilation, and per-graph binding.
- `packages/smartengine-demo` validates SmartEngine-related dialects and host integration patterns.
- `packages/approval-flow` is a more business-oriented demo that shows how the plugin lands in a concrete scenario.
- `packages/bpmn2-spec`, `packages/bpmn-moddle`, and `packages/bpmn-js` are read-only reference submodules and are not part of the active workspace build/install flow.

## 2. 新人先看什么 / Where Newcomers Should Start

如果你是第一次进入这个仓库，建议按下面顺序阅读：

If this is your first time in the repository, read in this order:

1. 本 README：先理解工作区里有哪些包、每个包负责什么。
2. [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md)：看整体结构、关键运行链路、改动入口。
3. [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md)：进入主库视角，看公开 API、模块职责和源码阅读顺序。
4. [packages/x6-plugin-bpmn/src/index.ts](packages/x6-plugin-bpmn/src/index.ts)：看主库总入口导出了什么。
5. 按你的任务再深入到 `src/core`、`src/rules`、`src/import`、`src/export` 或某个 demo。

1. This README: understand which packages exist and what each one is for.
2. [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md): get the overall structure, key runtime flows, and common change entry points.
3. [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md): switch to the plugin view and learn the public API, module responsibilities, and code reading order.
4. [packages/x6-plugin-bpmn/src/index.ts](packages/x6-plugin-bpmn/src/index.ts): inspect the main library entry and exported surfaces.
5. Then go deeper into `src/core`, `src/rules`, `src/import`, `src/export`, or a specific demo based on your task.

## 3. 工作区地图 / Workspace Map

| 路径 / Path | 作用 / Purpose | 新人何时看 / When to read |
|---|---|---|
| `packages/x6-plugin-bpmn` | 主库，所有通用能力都在这里实现 | 任何主功能、规则、导入导出、行为相关任务都先看这里 |
| `packages/example` | 标准 BPMN 编辑器示例 | 想看主库怎样被最直接地接入时看这里 |
| `packages/dialect-demo` | 方言系统示例 | 想看 `DialectManager`、`Profile`、`bind()` 的宿主用法时看这里 |
| `packages/smartengine-demo` | SmartEngine 相关示例 | 想看 BPMN2 基础能力如何被业务方言扩展时看这里 |
| `packages/approval-flow` | 业务风格示例 | 想看更贴近业务编辑器的画布表达时看这里 |
| `docs` | 上手与扩展文档 | 需要了解仓库结构、接入方式和扩展路径时看这里 |
| `packages/bpmn2-spec` | BPMN 2.0 官方规范与中文辅助材料 | 修改规范性约束前必须查这里 |
| `packages/bpmn-moddle` | BPMN XML/moddle 参考实现 | 查 XML 解析、序列化语义时看这里 |
| `packages/bpmn-js` | 社区 BPMN 设计器参考实现 | 对照建模器交互、社区实现时看这里 |

| Path | Purpose | When to read |
|---|---|---|
| `packages/x6-plugin-bpmn` | Main library with all reusable capabilities | Read this first for any core feature, rule, import/export, or runtime behavior work |
| `packages/example` | Standard BPMN editor demo | Read when you want the most direct host integration example |
| `packages/dialect-demo` | Dialect-system demo | Read when you want to see `DialectManager`, `Profile`, and `bind()` in a host app |
| `packages/smartengine-demo` | SmartEngine-related demo | Read when you want to see BPMN2 capabilities extended into a business dialect |
| `packages/approval-flow` | Business-flavored demo | Read when you want a more domain-oriented editor example |
| `docs` | Onboarding and extension documents | Read when you need repository structure, integration guidance, or extension paths |
| `packages/bpmn2-spec` | BPMN 2.0 official specification and Chinese reference material | Mandatory before changing specification-driven constraints |
| `packages/bpmn-moddle` | BPMN XML/moddle reference implementation | Read when checking XML parsing or serialization behavior |
| `packages/bpmn-js` | Community BPMN modeler reference implementation | Read when comparing editor interactions and community behavior |

## 4. 关键运行链路 / Key Runtime Flows

最常见的四条链路如下：

The four most common flows are:

1. 图形注册：`registerBpmnShapes()` -> X6 全局注册表 -> demo 或宿主开始创建节点与边。
2. 方言绑定：`ProfileRegistry` -> `compileProfile()` -> `createProfileContext()` -> `DialectManager.bind(graph, dialectId)`。
3. XML 导入：`parseBpmnXml()` -> `loadBpmnGraph()` -> 运行时行为补齐。
4. XML 导出：图形与数据遍历 -> `NODE_MAPPING` / `EDGE_MAPPING` -> `bpmn-moddle` 序列化。

1. Shape registration: `registerBpmnShapes()` -> X6 global registry -> demo or host starts creating nodes and edges.
2. Dialect binding: `ProfileRegistry` -> `compileProfile()` -> `createProfileContext()` -> `DialectManager.bind(graph, dialectId)`.
3. XML import: `parseBpmnXml()` -> `loadBpmnGraph()` -> runtime behaviors rehydrate what pure graph loading cannot express alone.
4. XML export: graph and data traversal -> `NODE_MAPPING` / `EDGE_MAPPING` -> `bpmn-moddle` serialization.

这些链路的详细阅读入口已经整理在 [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md)。

Detailed entry points for these flows are collected in [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md).

## 5. 常用命令 / Common Commands

```bash
# 根目录安装依赖
pnpm install

# 启动标准示例
pnpm run dev

# 启动其它示例
pnpm run dev:approval
pnpm run dev:dialect
pnpm run dev:smartengine

# 构建
pnpm run build:plugin
pnpm run build

# 主库测试
pnpm run test
pnpm run test:coverage
```

```bash
# Install dependencies at repo root
pnpm install

# Start the baseline demo
pnpm run dev

# Start other demos
pnpm run dev:approval
pnpm run dev:dialect
pnpm run dev:smartengine

# Build
pnpm run build:plugin
pnpm run build

# Plugin tests
pnpm run test
pnpm run test:coverage
```

## 6. 目录结构 / Directory Layout

```text
x6-bpmn2/
├── packages/
│   ├── x6-plugin-bpmn/
│   ├── example/
│   ├── approval-flow/
│   ├── dialect-demo/
│   ├── smartengine-demo/
│   ├── bpmn2-spec/        # 只读规范参照
│   ├── bpmn-moddle/       # 只读 XML/moddle 参照
│   └── bpmn-js/           # 只读建模器参照
├── docs/
│   ├── project-onboarding-guide.md
│   └── custom-extension-guide.md
├── package.json
└── AGENTS.md
```

```text
x6-bpmn2/
├── packages/
│   ├── x6-plugin-bpmn/
│   ├── example/
│   ├── approval-flow/
│   ├── dialect-demo/
│   ├── smartengine-demo/
│   ├── bpmn2-spec/        # read-only spec reference
│   ├── bpmn-moddle/       # read-only XML/moddle reference
│   └── bpmn-js/           # read-only modeler reference
├── docs/
│   ├── project-onboarding-guide.md
│   └── custom-extension-guide.md
├── package.json
└── AGENTS.md
```

## 7. 规则与参照 / Rules and References

在这个仓库里，BPMN 约束、XML 行为和社区交互的权威来源分别是：

In this repository, the authoritative references for BPMN constraints, XML behavior, and community interactions are:

- [packages/bpmn2-spec/formal-11-01-03.pdf](packages/bpmn2-spec/formal-11-01-03.pdf)：官方 BPMN 2.0 规范。
- [packages/bpmn-moddle](packages/bpmn-moddle)：BPMN XML/moddle 参考实现。
- [packages/bpmn-js](packages/bpmn-js)：社区 BPMN 建模器参考实现。

- [packages/bpmn2-spec/formal-11-01-03.pdf](packages/bpmn2-spec/formal-11-01-03.pdf): the official BPMN 2.0 specification.
- [packages/bpmn-moddle](packages/bpmn-moddle): the BPMN XML/moddle reference implementation.
- [packages/bpmn-js](packages/bpmn-js): the community BPMN modeler reference implementation.

这些子模块在当前工作区中保持只读；若发现问题，应记录到根目录 `tip.md`，而不是直接修改子模块内容。

These submodules are read-only in the current workspace. If you discover an issue, record it in root `tip.md` instead of editing submodule contents directly.

## 8. 进一步阅读 / Further Reading

- [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md)：新人快速理解整体结构、改动入口与阅读顺序。
- [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md)：主库公开 API、模块职责与代码阅读建议。
- [docs/custom-extension-guide.md](docs/custom-extension-guide.md)：宿主如何按最小代价扩展图形、Profile 与 XML 语义。

- [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md): the fastest way for a newcomer to understand the whole structure, change entry points, and reading order.
- [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md): public API, module responsibilities, and code reading advice for the main library.
- [docs/custom-extension-guide.md](docs/custom-extension-guide.md): how a host extends shapes, profiles, and XML semantics with the smallest viable change.

## 9. 许可 / License

MIT

MIT
