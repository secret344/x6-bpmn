# @x6-bpmn2/plugin

工作区主库，负责 BPMN 图形、规则、方言系统、导入导出和运行时行为。

The core library in this workspace. It owns BPMN shapes, rules, dialect infrastructure, import/export, and runtime behavior.

## 1. 公开能力 / Public Capabilities

主库提供两条主要使用路径：

The library provides two main usage paths:

1. 传统接口：注册图形、接入校验、直接导入导出 XML。
2. 方言接口：通过 `Profile`、`ProfileRegistry`、`DialectManager` 管理规则和序列化能力。

1. Traditional API: register shapes, wire validation, and import/export XML directly.
2. Dialect API: manage rules and serialization through `Profile`, `ProfileRegistry`, and `DialectManager`.

## 2. 模块结构 / Module Structure

| 目录 / Directory | 作用 / Responsibility |
|---|---|
| `src/index.ts` | 公开 API 总入口 |
| `src/shapes` | BPMN 节点图形 |
| `src/connections` | BPMN 边图形 |
| `src/rules` | 标准 BPMN 连线规则 |
| `src/core/dialect` | 方言注册、编译、上下文、绑定 |
| `src/core/rules` | 方言感知的规则入口 |
| `src/core/data-model` | 字段默认值、规范化、校验 |
| `src/import` | XML 解析和图装载 |
| `src/export` | 图状态导出 XML |
| `src/behaviors` | 运行时图交互行为 |
| `src/builtin` | 内置 profile |
| `src/config`、`src/utils` | 配置、常量和低层工具 |

| Directory | Responsibility |
|---|---|
| `src/index.ts` | Public API entry |
| `src/shapes` | BPMN node shapes |
| `src/connections` | BPMN edge shapes |
| `src/rules` | Standard BPMN connection rules |
| `src/core/dialect` | Dialect registration, compilation, context, and binding |
| `src/core/rules` | Dialect-aware rule entry points |
| `src/core/data-model` | Field defaults, normalization, and validation |
| `src/import` | XML parsing and graph loading |
| `src/export` | Graph-to-XML export |
| `src/behaviors` | Runtime graph behaviors |
| `src/builtin` | Built-in profiles |
| `src/config`, `src/utils` | Configuration, constants, and low-level utilities |

## 3. 快速接入 / Quick Start

### 3.1 传统接口 / Traditional API

```ts
import { Graph } from '@antv/x6'
import { setupBpmnGraph, exportBpmnXml, importBpmnXml } from '@x6-bpmn2/plugin'

const graph = new Graph({
  container: document.getElementById('container')!,
  width: 1200,
  height: 800,
})

setupBpmnGraph(graph)

const xml = await exportBpmnXml(graph)
await importBpmnXml(graph, xml)
```

### 3.2 方言接口 / Dialect API

```ts
import { Graph } from '@antv/x6'
import {
  createProfileRegistry,
  createDialectManager,
  bpmn2Profile,
  createBpmn2ExporterAdapter,
  createBpmn2ImporterAdapter,
} from '@x6-bpmn2/plugin'

const registry = createProfileRegistry()
registry.register(bpmn2Profile)

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

## 4. 常见改动落点 / Common Change Locations

| 改动类型 / Change type | 首选位置 / Primary location |
|---|---|
| BPMN 图形 | `src/shapes`、`src/connections` |
| 连线规则 | `src/rules`、`src/core/rules` |
| 字段能力和校验 | `src/core/data-model` |
| 方言继承、合并、编译 | `src/core/dialect` |
| XML 导入 | `src/import` |
| XML 导出 | `src/export` |
| 运行时行为 | `src/behaviors` |
| 宿主 demo 接入 | 对应 demo 包 |

| Change type | Primary location |
|---|---|
| BPMN shapes | `src/shapes`, `src/connections` |
| Connection rules | `src/rules`, `src/core/rules` |
| Field capability and validation | `src/core/data-model` |
| Dialect inheritance, merge, or compilation | `src/core/dialect` |
| XML import | `src/import` |
| XML export | `src/export` |
| Runtime behavior | `src/behaviors` |
| Host demo integration | the relevant demo package |

## 5. 验证命令 / Validation Commands

在包目录下执行：

Run in the package directory:

```bash
pnpm run test
pnpm run test:coverage
pnpm run test:browser
```

主库源码或测试变更至少执行 `pnpm run test`。规则、导入导出或运行时行为变更优先补跑 `test:coverage` 与 `test:browser`。

Run at least `pnpm run test` for plugin source or test changes. Prefer `test:coverage` and `test:browser` for rule, import/export, or runtime behavior changes.

## 6. 相关文档 / Related Documents

1. [../../README.md](../../README.md)
2. [../../docs/project-onboarding-guide.md](../../docs/project-onboarding-guide.md)
3. [../../docs/child-laneset-architecture.md](../../docs/child-laneset-architecture.md)
4. [../../docs/custom-extension-guide.md](../../docs/custom-extension-guide.md)
5. [../../docs/smartengine-xml-extension-reference.md](../../docs/smartengine-xml-extension-reference.md)

1. [../../README.md](../../README.md)
2. [../../docs/project-onboarding-guide.md](../../docs/project-onboarding-guide.md)
3. [../../docs/child-laneset-architecture.md](../../docs/child-laneset-architecture.md)
4. [../../docs/custom-extension-guide.md](../../docs/custom-extension-guide.md)
5. [../../docs/smartengine-xml-extension-reference.md](../../docs/smartengine-xml-extension-reference.md)

## 7. 许可 / License

MIT

MIT
