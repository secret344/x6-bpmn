# @x6-bpmn2/plugin

`@x6-bpmn2/plugin` 是工作区里的主库，负责 BPMN 2.0 图形、规则、运行时行为，以及 XML 导入导出。

`@x6-bpmn2/plugin` is the main library in this workspace. It owns BPMN 2.0 shapes, rules, runtime behaviors, and XML import/export.

## 1. 使用方式 / Usage Modes

1. 传统接口：注册图形、挂接连线校验、直接做导入导出。
2. 方言接口：通过 `Profile`、`ProfileRegistry`、`DialectManager` 绑定不同规则和序列化能力。

1. Traditional API: register shapes, wire connection validation, and import/export directly.
2. Dialect API: bind different rule sets and serialization behavior through `Profile`, `ProfileRegistry`, and `DialectManager`.

## 2. 模块总览 / Module Overview

| 目录 / Directory | 作用 / Responsibility | 典型入口 / Typical entry points |
|---|---|---|
| `src/index.ts` | 总入口，统一导出传统接口与方言接口 | `registerBpmnShapes`, `DialectManager` |
| `src/shapes` | BPMN 节点图形定义 | `registerEventShapes`, `registerActivityShapes` |
| `src/connections` | BPMN 连接线定义 | `registerConnectionShapes` |
| `src/rules` | 传统 BPMN 连线规则 | `validateBpmnConnection`, `createBpmnValidateConnection` |
| `src/core/dialect` | Profile 注册、绑定与方言运行时能力 | `ProfileRegistry`, `createDialectManager` |
| `src/core/rules` | 方言感知的规则入口 | `createContextValidateConnection`, `createContextValidateEdge` |
| `src/core/data-model` | 字段能力与默认值、规范化、校验 | `buildDefaultData`, `validateFields` |
| `src/import` | XML -> 中间数据 -> 图形 | `parseBpmnXml`, `loadBpmnGraph` |
| `src/export` | 图形 -> BPMN XML | `exportBpmnXml`, `createBpmn2ExporterAdapter` |
| `src/behaviors` | 运行时交互行为 | `setupBoundaryAttach`, `setupPoolContainment` |
| `src/builtin` | 内置方言定义 | `bpmn2Profile`, `smartengineBaseProfile` |
| `src/config` | 标签、分类、图标与配置辅助 | `getShapeLabel`, `classifyShape` |
| `src/utils` | 常量与低层工具 | `BPMN_*` 常量 |

| Directory | Responsibility | Typical entry points |
|---|---|---|
| `src/index.ts` | Main entry, exporting both traditional and dialect APIs | `registerBpmnShapes`, `DialectManager` |
| `src/shapes` | BPMN node shape definitions | `registerEventShapes`, `registerActivityShapes` |
| `src/connections` | BPMN edge definitions | `registerConnectionShapes` |
| `src/rules` | Traditional BPMN connection rules | `validateBpmnConnection`, `createBpmnValidateConnection` |
| `src/core/dialect` | Profile registration, binding, and dialect runtime APIs | `ProfileRegistry`, `createDialectManager` |
| `src/core/rules` | Dialect-aware rule entry points | `createContextValidateConnection`, `createContextValidateEdge` |
| `src/core/data-model` | Field capabilities, defaults, normalization, validation | `buildDefaultData`, `validateFields` |
| `src/import` | XML -> intermediate data -> graph | `parseBpmnXml`, `loadBpmnGraph` |
| `src/export` | Graph -> BPMN XML | `exportBpmnXml`, `createBpmn2ExporterAdapter` |
| `src/behaviors` | Runtime graph behaviors | `setupBoundaryAttach`, `setupPoolContainment` |
| `src/builtin` | Built-in dialect definitions | `bpmn2Profile`, `smartengineBaseProfile` |
| `src/config` | Labels, classification, icons, and config helpers | `getShapeLabel`, `classifyShape` |
| `src/utils` | Constants and low-level helpers | `BPMN_*` constants |

## 3. 常用入口 / Common Entry Points

1. [src/index.ts](src/index.ts)：公开 API 总入口。
2. [src/core/dialect](src/core/dialect)：方言注册、绑定和运行时入口。
3. [src/import/index.ts](src/import/index.ts) 与 [src/export/index.ts](src/export/index.ts)：XML 双向转换与相关工厂。
4. [src/behaviors](src/behaviors)：边界事件附着、Pool/Lane containment 等运行时行为。

1. [src/index.ts](src/index.ts): public API entry.
2. [src/core/dialect](src/core/dialect): dialect registration, binding, and runtime entry points.
3. [src/import/index.ts](src/import/index.ts) and [src/export/index.ts](src/export/index.ts): XML round-trip and related factories.
4. [src/behaviors](src/behaviors): runtime behaviors such as boundary attachment and Pool/Lane containment.

## 4. 两条主要 API 路线 / Two Main API Paths

### 4.1 传统接口 / Traditional API

```ts
import { Graph } from '@antv/x6'
import {
  registerBpmnShapes,
  createBpmnValidateConnection,
  exportBpmnXml,
  importBpmnXml,
} from '@x6-bpmn2/plugin'

registerBpmnShapes()

const graph = new Graph({
  container: document.getElementById('container')!,
  width: 1200,
  height: 800,
  connecting: {
    createEdge() {
      return graph.createEdge({ shape: 'bpmn-sequence-flow' })
    },
    validateConnection: createBpmnValidateConnection(() => 'bpmn-sequence-flow'),
  },
})

const xml = await exportBpmnXml(graph)
await importBpmnXml(graph, xml)
```

### 4.2 方言接口 / Dialect API

```ts
import { Graph } from '@antv/x6'
import {
  createProfileRegistry,
  createDialectManager,
  bpmn2Profile,
  smartengineBaseProfile,
  createBpmn2ExporterAdapter,
  createBpmn2ImporterAdapter,
} from '@x6-bpmn2/plugin'

const registry = createProfileRegistry()
registry.register(bpmn2Profile)
registry.register(smartengineBaseProfile)

const manager = createDialectManager({ registry })
manager.registerExporter(createBpmn2ExporterAdapter())
manager.registerImporter(createBpmn2ImporterAdapter())

const graph = new Graph({
  container: document.getElementById('container')!,
  width: 1200,
  height: 800,
})

manager.bind(graph, 'bpmn2')
```

## 5. 关键链路 / Key Flows

| 链路 / Flow | 入口 / Entry | 说明 / Notes |
|---|---|---|
| 图形注册 / Shape registration | `registerBpmnShapes()` | 注册 BPMN 节点和连线到 X6 |
| 方言绑定 / Dialect binding | `ProfileRegistry.register()` -> `DialectManager.bind()` | 将规则、渲染、导入导出能力绑定到 graph |
| XML 导入 / XML import | `parseBpmnXml()` -> `loadBpmnGraph()` | 先解析，再装载 |
| XML 导出 / XML export | `exportBpmnXml()` | 从图状态生成标准 BPMN XML |

| Flow | Entry | Notes |
|---|---|---|
| Shape registration | `registerBpmnShapes()` | Registers BPMN nodes and edges into X6 |
| Dialect binding | `ProfileRegistry.register()` -> `DialectManager.bind()` | Binds rules, rendering, and serialization to a graph |
| XML import | `parseBpmnXml()` -> `loadBpmnGraph()` | Parse first, then load |
| XML export | `exportBpmnXml()` | Generates standard BPMN XML from graph state |

## 6. 改功能时该去哪一层 / Where to Change Things

| 你要改什么 / What you want to change | 先看哪里 / Start here |
|---|---|
| 新增或修改 BPMN 图形 | `src/shapes`、`src/connections` |
| 调整连线合法性 | `src/rules`、`src/core/rules` |
| 调整字段默认值、规范化、字段校验 | `src/core/data-model` |
| 调整方言继承、合并、编译 | `src/core/dialect` |
| 调整 graph 与方言的绑定方式 | `src/core/dialect` |
| 调整 XML 解析或导出 | `src/import`、`src/export` |
| 调整边界事件附着、Pool/Lane containment | `src/behaviors` |
| 调整宿主 demo 接入方式 | 对应 `packages/*-demo` 或 `packages/example` |

| What you want to change | Start here |
|---|---|
| Add or modify BPMN shapes | `src/shapes`, `src/connections` |
| Change connection legality | `src/rules`, `src/core/rules` |
| Change field defaults, normalization, or field validation | `src/core/data-model` |
| Change dialect inheritance, merge, or compilation | `src/core/dialect` |
| Change graph-to-dialect binding behavior | `src/core/dialect` |
| Change XML parsing or export | `src/import`, `src/export` |
| Change boundary attachment or containment interactions | `src/behaviors` |
| Change host demo integration | the relevant `packages/*-demo` or `packages/example` |

## 7. 测试与验证 / Tests and Validation

主库改动后默认在包目录执行下面的命令：

After changing the plugin, these are the default commands to run in the package directory:

```bash
pnpm run test
pnpm run test:coverage
```

```bash
pnpm run test
pnpm run test:coverage
```

如果修改了 `src/**` 或 `tests/**`，至少跑 `pnpm run test`；跨模块、规则或运行时行为变更优先跑 `pnpm run test:coverage`。

If you change `src/**` or `tests/**`, run at least `pnpm run test`; for cross-module, rule, or runtime behavior changes, prefer `pnpm run test:coverage`.

### 7.1 主库与 Demo 的测试职责 / Test Responsibilities Between Plugin and Demo

1. 主库 `packages/x6-plugin-bpmn`：负责规则、导入导出、运行时行为，以及核心结构在真实浏览器里的回归。
2. 示例 `packages/example`：负责宿主接入后的端到端交互和 UI 事件链。

1. Plugin `packages/x6-plugin-bpmn`: owns rules, import/export, runtime behaviors, and core structural regression in a real browser.
2. Example `packages/example`: provides manual integration and UI verification only; automated regression is maintained in the plugin package.

推荐验证顺序如下：

Recommended validation order:

```bash
pnpm run test:coverage
pnpm run test:browser
```

```bash
pnpm run test:coverage
pnpm run test:browser
```

`pnpm run test:browser` 使用 `packages/x6-plugin-bpmn/tests/browser` 下的独立 Playwright harness，补足 jsdom 不稳定的真实图实例场景。

`pnpm run test:browser` uses the standalone Playwright harness under `packages/x6-plugin-bpmn/tests/browser` to cover real graph-instance scenarios that are hard to stabilize in jsdom.

## 8. 相关文档 / Related Documents

- [../../README.md](../../README.md)：工作区级别总览。
- [../../docs/project-onboarding-guide.md](../../docs/project-onboarding-guide.md)：新人上手与源码阅读导览。
- [../../docs/custom-extension-guide.md](../../docs/custom-extension-guide.md)：宿主如何按最小代价扩展图形、Profile 与 XML 语义。

- [../../README.md](../../README.md): workspace-level overview.
- [../../docs/project-onboarding-guide.md](../../docs/project-onboarding-guide.md): newcomer onboarding and source reading guide.
- [../../docs/custom-extension-guide.md](../../docs/custom-extension-guide.md): how host apps extend shapes, profiles, and XML semantics with minimal changes.

## 9. 许可 / License

MIT

MIT
