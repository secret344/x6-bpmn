# x6-bpmn2

面向 BPMN 2.0、方言扩展和宿主集成验证的 X6 工作区。

An X6 workspace for BPMN 2.0, dialect extension, and host integration validation.

## 1. 仓库定位 / Repository Scope

这个仓库服务于两类工作：

This repository serves two kinds of work:

1. 维护可复用主库 `packages/x6-plugin-bpmn`。
2. 通过示例和宿主项目验证主库能力是否可落地。

1. Maintain the reusable core library `packages/x6-plugin-bpmn`.
2. Validate that library capabilities work in demos and host-style projects.

## 2. 主要包 / Main Packages

| 路径 / Path | 作用 / Purpose |
|---|---|
| `packages/x6-plugin-bpmn` | 主库，负责图形、规则、方言系统、导入导出和运行时行为 |
| `packages/example` | 标准 BPMN 接入示例 |
| `packages/dialect-demo` | 方言系统与 Profile 绑定示例 |
| `packages/smartengine-demo` | SmartEngine 方言和宿主集成示例 |
| `packages/approval-flow` | 业务风格宿主示例 |
| `packages/bpmn2-spec` | BPMN 2.0 规范只读参照 |
| `packages/bpmn-moddle` | XML/moddle 只读参照实现 |
| `packages/bpmn-js` | 社区建模器只读参照实现 |

| Path | Purpose |
|---|---|
| `packages/x6-plugin-bpmn` | Core library for shapes, rules, dialects, import/export, and runtime behavior |
| `packages/example` | Baseline BPMN integration demo |
| `packages/dialect-demo` | Dialect and Profile binding demo |
| `packages/smartengine-demo` | SmartEngine dialect and host integration demo |
| `packages/approval-flow` | Business-flavored host demo |
| `packages/bpmn2-spec` | Read-only BPMN 2.0 specification reference |
| `packages/bpmn-moddle` | Read-only XML/moddle reference implementation |
| `packages/bpmn-js` | Read-only community modeler reference implementation |

## 3. 推荐阅读顺序 / Recommended Reading Order

如果你要改主库或排查问题，建议按下面顺序进入：

If you need to change the core library or investigate behavior, use this reading order:

1. [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md)
2. [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md)
3. [packages/x6-plugin-bpmn/src/index.ts](packages/x6-plugin-bpmn/src/index.ts)
4. 根据任务继续看 `src/core/dialect`、`src/rules`、`src/import`、`src/export` 或 `src/behaviors`

1. [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md)
2. [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md)
3. [packages/x6-plugin-bpmn/src/index.ts](packages/x6-plugin-bpmn/src/index.ts)
4. Continue into `src/core/dialect`, `src/rules`, `src/import`, `src/export`, or `src/behaviors` based on the task

## 4. 常用命令 / Common Commands

```bash
pnpm install

pnpm run dev
pnpm run dev:approval
pnpm run dev:dialect
pnpm run dev:smartengine

pnpm run build:plugin
pnpm run build
pnpm run typecheck

pnpm run test
pnpm run test:coverage
pnpm run test:plugin:browser
pnpm run test:smartengine:browser
```

`pnpm run typecheck` 会对 TypeScript 包运行 `tsc --noEmit`，对 Vue 包运行 `vue-tsc --noEmit`。

`pnpm run typecheck` runs `tsc --noEmit` for TypeScript packages and `vue-tsc --noEmit` for Vue packages.

## 5. 规则来源 / Authoritative References

涉及规范、XML 语义和社区建模器行为时，以下目录是权威参照：

Use these directories as the authoritative references for specification rules, XML semantics, and community-modeler behavior:

1. [packages/bpmn2-spec/formal-11-01-03.pdf](packages/bpmn2-spec/formal-11-01-03.pdf)
2. [packages/bpmn-moddle](packages/bpmn-moddle)
3. [packages/bpmn-js](packages/bpmn-js)

这些参照子模块在当前工作区中保持只读；发现问题时记录到 [tip.md](tip.md)，不要直接修改子模块内容。

These reference submodules are read-only in this workspace. Record issues in [tip.md](tip.md) instead of editing the submodules directly.

## 6. 仓库文档入口 / Documentation Entry Points

| 文档 / Document | 用途 / Use |
|---|---|
| [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md) | 新人上手、结构理解、阅读顺序 |
| [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md) | 主库 API 和模块职责 |
| [docs/custom-extension-guide.md](docs/custom-extension-guide.md) | 宿主如何扩展图形、Profile 和 XML 语义 |
| [docs/smartengine-xml-extension-reference.md](docs/smartengine-xml-extension-reference.md) | SmartEngine XML 参考页 |
| [tip.md](tip.md) | 仓库维护备注和需跟踪的问题 |

| Document | Use |
|---|---|
| [docs/project-onboarding-guide.md](docs/project-onboarding-guide.md) | Onboarding, structure, and reading order |
| [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md) | Core library API and module responsibilities |
| [docs/custom-extension-guide.md](docs/custom-extension-guide.md) | How host apps extend shapes, profiles, and XML semantics |
| [docs/smartengine-xml-extension-reference.md](docs/smartengine-xml-extension-reference.md) | SmartEngine XML reference |
| [tip.md](tip.md) | Repository maintenance notes and tracked issues |

## 7. 许可 / License

MIT

MIT
