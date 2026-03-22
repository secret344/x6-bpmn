# x6-bpmn2

基于 [AntV X6 v2](https://x6.antv.antgroup.com/) 的 **BPMN 2.0 完整图形套件** —— 包含插件库、交互行为扩展和可运行的示例应用。

---

## 仓库结构

```
x6-bpmn2/
├── packages/
│   ├── x6-plugin-bpmn/   # 核心插件（npm 包 @x6-bpmn2/plugin）
│   ├── example/           # 完整 BPMN 编辑器示例（Vue 3 + Vite）
│   └── approval-flow/     # 审批流设计器示例（Vue 3 + Vite）
└── docs/
    └── custom-extension-guide.md  # 局部定制指南
```

## 核心包：@x6-bpmn2/plugin

> 详细文档见 [packages/x6-plugin-bpmn/README.md](packages/x6-plugin-bpmn/README.md)

**功能：**
- **78+ BPMN 图形**：覆盖 BPMN 2.0 全部节点和连接线（事件 / 活动 / 网关 / 数据元素 / 工件 / 泳道 / 连接线）
- **XML 导入导出**：基于 `bpmn-moddle`，支持标准 BPMN 2.0 XML 双向转换
- **边界事件吸附**：`setupBoundaryAttach` — 拖放自动 snap、边框约束、宿主 resize 联动
- **表单数据管理**：内置 `loadBpmnFormData` / `saveBpmnFormData`
- **连接规则验证**：`createBpmnValidateConnection` 按 BPMN 规范校验连线合法性

## 快速开始

```bash
# 安装依赖（根目录）
npm install

# 启动示例编辑器
npm run dev

# 启动审批流示例
npm run dev:approval
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 example 示例（热更新） |
| `npm run dev:approval` | 启动 approval-flow 示例 |
| `npm run build:plugin` | 构建插件（输出到 `dist/`） |
| `npm run build:example` | 构建示例应用 |
| `npm run build` | 构建插件 + 示例 |

## 插件开发

```bash
cd packages/x6-plugin-bpmn

# 开发模式（监听变更，自动重新构建）
npm run dev

# 运行测试
npm test

# 构建
npm run build
```

## 示例应用

[packages/example](packages/example) 展示了完整的 BPMN 编辑器，包含：

- 图形面板（拖放 78+ BPMN 元素）
- 属性面板（节点配置）
- 工具栏（导入 / 导出 XML、undo/redo、fit）
- 边界事件吸附交互（拖放到 Activity 边框自动吸附）
- 内置员工请假审批流示例（含 3 种边界事件）

## 许可

MIT
