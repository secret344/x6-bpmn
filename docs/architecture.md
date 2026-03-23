# X6-BPMN 架构设计文档

> 面向可扩展规则的 BPMN 2.0 建模器架构

## 目录

1. [核心设计原则](#1-核心设计原则)
2. [架构总览](#2-架构总览)
3. [分层架构](#3-分层架构)
4. [规则预设系统](#4-规则预设系统)
5. [序列化适配器系统](#5-序列化适配器系统)
6. [扩展性设计](#6-扩展性设计)
7. [如何满足需求](#7-如何满足需求)

---

## 1. 核心设计原则

### 1.1 标准模型不可动摇

**BPMN 2.0 是稳定的基础层，只随 OMG 规范版本更新。**

```
┌─────────────────────────────────────────────────────────────┐
│                    BPMN 2.0 标准层                           │
│  - 74 个标准节点 + 7 种连接线                                │
│  - 符合 OMG BPMN 2.0 规范                                   │
│  - 零频率变更（仅随规范更新）                                │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ 严格遵守
                            │
         ┌──────────────────┴───────────────────┐
         │                                      │
┌────────┴───────────┐                ┌────────┴────────────┐
│  SmartEngine 预设   │                │   用户自定义预设     │
│  - 独立演化         │                │   - 完全可定制       │
│  - 不影响基础层     │                │   - 基于任何预设继承  │
└────────────────────┘                └─────────────────────┘
```

### 1.2 规则库独立演化

每个规则预设（如 SmartEngine）都是独立模块，可以：

- **独立维护**：在自己的模块内工作，不影响其他预设
- **独立测试**：拥有独立的测试套件
- **独立扩展**：添加新规则不影响已有预设

### 1.3 契约明确

所有规则预设都遵守同一个接口：

```typescript
interface BpmnRulePreset {
  name: string                      // 预设名称
  extends?: string                  // 继承的父预设
  connectionRules?: {...}           // 连线规则
  nodeProperties?: {...}            // 节点属性定义
  validators?: [...]                // 自定义验证器
  shapeCategoryOverrides?: {...}    // 节点分类覆盖
  shapeLabelOverrides?: {...}       // 节点标签覆盖
}
```

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                         用户应用层                            │
│  - 拖拽建模 UI                                                │
│  - 属性配置面板                                               │
│  - 流程导入/导出                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     X6-BPMN 插件层                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  规则预设系统   │  │ 序列化适配器    │  │   验证器系统   │ │
│  │  (Rule Presets)│  │ (Serialization) │  │  (Validators) │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  BPMN 2.0 标准模型库                    │  │
│  │  - 74 标准节点   - 7 连接线类型   - 标准映射表          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      AntV X6 图形引擎                         │
│  - 节点渲染   - 边连接   - 事件处理   - 布局管理             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 分层架构

### 3.1 第一层：BPMN 2.0 标准模型库（不可变层）

**位置**：`src/shapes/`, `src/utils/constants.ts`, `src/export/bpmn-mapping.ts`

**职责**：
- 定义 74 个标准 BPMN 2.0 节点形状
- 定义 7 种连接线类型
- 提供 BPMN XML ↔ X6 Shape 的双向映射

**特点**：
- ✅ 严格遵循 BPMN 2.0 OMG 规范
- ✅ 零频率变更（仅随 OMG 规范更新）
- ✅ 所有上层模块的稳定基础

**示例**：
```typescript
// 标准节点定义
export const BPMN_USER_TASK = 'bpmn-user-task'
export const BPMN_SERVICE_TASK = 'bpmn-service-task'
export const BPMN_START_EVENT = 'bpmn-start-event'
// ... 74 个标准节点

// 标准映射（双向）
export const NODE_MAPPING = {
  'bpmn-user-task': { tag: 'userTask' },
  'bpmn-service-task': { tag: 'serviceTask' },
  // ...
}
```

### 3.2 第二层：规则预设系统（可扩展层）

**位置**：`src/rules/presets/`

**职责**：
- 定义不同工作流引擎的连线规则
- 定义节点属性配置
- 提供自定义验证逻辑

**核心组件**：

#### 3.2.1 预设注册中心
```typescript
// src/rules/presets/registry.ts
registerPreset(preset: BpmnRulePreset)    // 注册预设
resolvePreset(name: string)               // 解析预设（展平继承链）
createExtendedPreset(...)                 // 创建继承预设
```

#### 3.2.2 内置预设

**BPMN 2.0 预设**（基础预设）：
```typescript
export const BPMN2_PRESET: BpmnRulePreset = {
  name: 'bpmn2',
  description: 'BPMN 2.0 标准规则（OMG 规范）',
  connectionRules: DEFAULT_CONNECTION_RULES,  // 标准连线规则
  nodeProperties: { /* 标准属性 */ },
}
```

**SmartEngine 预设**（扩展预设）：
```typescript
export const SMARTENGINE_PRESET: BpmnRulePreset = {
  name: 'smartengine',
  extends: 'bpmn2',  // 继承 BPMN 2.0
  description: '阿里巴巴 SmartEngine 工作流引擎规则',
  connectionRules: {
    startEvent: { maxOutgoing: 1 },  // 覆盖：只允许一条出线
  },
  nodeProperties: { /* SmartEngine 特定属性 */ },
}
```

#### 3.2.3 继承机制

```
DEFAULT_CONNECTION_RULES (默认规则)
         ↓
    BPMN2_PRESET (BPMN 2.0 标准)
         ↓
SMARTENGINE_PRESET (SmartEngine)
         ↓
   MY_CUSTOM_PRESET (用户自定义)
```

每层预设可以：
- **继承**：复用父预设的所有规则
- **覆盖**：替换父预设的特定规则
- **追加**：添加新的规则

### 3.3 第三层：序列化适配器系统（引擎特定层）

**位置**：`src/rules/presets/serialization-adapter.ts`, `*-adapter.ts`

**职责**：
- 处理不同工作流引擎的 XML 序列化格式
- 管理引擎特定的命名空间和扩展属性
- 提供导出/导入生命周期钩子

**核心接口**：
```typescript
interface SerializationAdapter {
  name: string
  namespaces?: Record<string, string>  // 自定义命名空间

  // 导出钩子
  beforeExport?(moddle: BpmnModdle): void
  onExportNode?(context: ExportContext): void
  onExportEdge?(context: ExportContext): void
  afterExport?(xml: string): string | undefined

  // 导入钩子
  beforeImport?(xml: string, moddle: BpmnModdle): string | undefined
  onImportNode?(context: ImportContext): void
  onImportEdge?(context: ImportContext): void
  afterImport?(): void
}
```

**内置适配器**：

1. **BPMN 2.0 适配器**（标准适配器）：
   ```typescript
   export const bpmn2SerializationAdapter: SerializationAdapter = {
     name: 'bpmn2',
     description: 'BPMN 2.0 标准序列化适配器（OMG 规范）',
     // 无额外命名空间
     // 无特殊处理
   }
   ```

2. **SmartEngine 适配器**（引擎特定）：
   ```typescript
   export const smartEngineSerializationAdapter: SerializationAdapter = {
     name: 'smartengine',
     namespaces: {
       smart: 'http://smartengine.alibaba.com/schema'  // SmartEngine 命名空间
     },
     onExportNode(context) {
       // 转换 implementation → smart:class
       if (context.cell.shape === 'bpmn-service-task') {
         const impl = context.cell.getData().bpmn?.implementation
         if (impl) {
           context.element.$attrs['smart:class'] = impl
         }
       }
     },
     onImportNode(context) {
       // 转换 smart:class → implementation
       if (context.element.$attrs['smart:class']) {
         context.cellData.data.bpmn.implementation =
           context.element.$attrs['smart:class']
       }
     }
   }
   ```

**导出流程**：
```
用户调用 exportBpmnXml(graph, { adapter: 'smartengine' })
    ↓
1. 解析适配器：getSerializationAdapter('smartengine')
    ↓
2. beforeExport(moddle)
    ↓
3. 遍历节点 → onExportNode(context)  [处理 smart:class]
    ↓
4. 遍历边 → onExportEdge(context)
    ↓
5. 注入命名空间到 definitions
    ↓
6. moddle.toXML(definitions)
    ↓
7. afterExport(xml) → 返回最终 XML
```

### 3.4 第四层：验证器系统

**位置**：`src/rules/validator.ts`

**职责**：
- 在连线时验证规则
- 执行预设定义的自定义验证器
- 返回验证结果和错误信息

**工作流程**：
```typescript
// 用户尝试连接节点 A → B
graph.on('edge:connected', ({ edge }) => {
  const preset = resolvePreset('smartengine')
  const result = validateBpmnConnection(
    sourceNode, targetNode, edge, preset
  )

  if (!result.valid) {
    // 阻止连接，显示错误信息
    edge.remove()
    message.error(result.reason)
  }
})
```

---

## 4. 规则预设系统

### 4.1 预设的组成部分

每个预设包含以下部分：

#### 4.1.1 连线规则 (Connection Rules)
```typescript
connectionRules: {
  startEvent: {
    allowedOutgoing: ['sequence-flow'],  // 允许的出线类型
    maxOutgoing: 1,                      // 最多出线数量
    noIncoming: true,                    // 禁止入线
    allowedTargets: ['task', 'gateway'], // 允许的目标节点类别
  },
  // ... 其他节点类别
}
```

#### 4.1.2 节点属性定义 (Node Properties)
```typescript
nodeProperties: {
  'bpmn-user-task': [
    {
      key: 'assignee',
      label: '处理人',
      type: 'string',
      required: true,
      group: '任务分配'
    },
    {
      key: 'candidateUsers',
      label: '候选用户',
      type: 'string',
      group: '任务分配'
    },
  ],
  // ... 其他节点类型
}
```

#### 4.1.3 自定义验证器 (Custom Validators)
```typescript
validators: [
  {
    name: 'no-multi-start',
    description: '流程中只能有一个开始节点',
    validate: (context) => {
      const startEvents = graph.getNodes().filter(
        n => n.shape.includes('start-event')
      )
      return {
        valid: startEvents.length <= 1,
        reason: '流程中只能有一个开始节点'
      }
    }
  }
]
```

### 4.2 预设继承

支持多级继承，子预设自动继承并可覆盖父预设的规则：

```typescript
// 1. 创建基于 SmartEngine 的自定义预设
createExtendedPreset('my-rules', 'smartengine', {
  connectionRules: {
    startEvent: {
      maxOutgoing: 2  // 覆盖：允许 2 条出线
    },
  },
  nodeProperties: {
    'bpmn-user-task': [
      {
        key: 'priority',
        label: '优先级',
        type: 'select',
        options: [
          { label: '低', value: 'low' },
          { label: '高', value: 'high' }
        ]
      }  // 追加新属性
    ]
  }
})

// 2. 使用自定义预设
const rules = resolvePreset('my-rules')
```

### 4.3 预设解析

`resolvePreset()` 会展平继承链，合并所有父预设的规则：

```typescript
// 继承链：DEFAULT_RULES → BPMN2 → SmartEngine → my-rules

const resolved = resolvePreset('my-rules')
// 返回：
// {
//   name: 'my-rules',
//   connectionRules: {
//     startEvent: { maxOutgoing: 2, ... },  // 来自 my-rules (覆盖)
//     endEvent: { ... },                     // 来自 DEFAULT_RULES (继承)
//     // ... 所有节点类别的完整规则
//   },
//   nodeProperties: { ... },  // 合并所有层级的属性定义
//   validators: [ ... ],      // 合并所有层级的验证器
// }
```

---

## 5. 序列化适配器系统

### 5.1 为什么需要序列化适配器？

不同的工作流引擎对 BPMN 2.0 有不同的扩展：

**标准 BPMN 2.0**：
```xml
<bpmn2:serviceTask id="Task_1" name="Send Email">
  <bpmn2:extensionElements>
    <x6bpmn:properties>
      <x6bpmn:property name="implementation" value="EmailService"/>
    </x6bpmn:properties>
  </bpmn2:extensionElements>
</bpmn2:serviceTask>
```

**SmartEngine**：
```xml
<bpmn2:serviceTask
  id="Task_1"
  name="Send Email"
  smart:class="EmailService">  <!-- SmartEngine 扩展 -->
  <bpmn2:extensionElements>
    <smart:properties>
      <smart:property name="timeout" value="30"/>
    </smart:properties>
  </bpmn2:extensionElements>
</bpmn2:serviceTask>
```

### 5.2 适配器生命周期

#### 导出流程
```
用户数据 (X6 Graph)
    ↓ beforeExport()  [初始化]
转换为 BPMN moddle 元素
    ↓ onExportNode()  [节点转换，添加 smart:class]
    ↓ onExportEdge()  [边转换]
注入命名空间
    ↓
生成 XML
    ↓ afterExport()   [后处理 XML]
最终 XML
```

#### 导入流程
```
BPMN XML 字符串
    ↓ beforeImport()  [预处理 XML]
解析为 BPMN moddle 元素
    ↓ onImportNode()  [节点转换，提取 smart:class]
    ↓ onImportEdge()  [边转换]
创建 X6 节点/边
    ↓ afterImport()   [清理]
X6 Graph
```

### 5.3 使用适配器

```typescript
// 导出时指定适配器
const xml = await exportBpmnXml(graph, {
  adapter: 'smartengine'  // 使用注册的适配器
})

// 或使用自定义适配器实例
const xml = await exportBpmnXml(graph, {
  adapter: myCustomAdapter
})

// 导入时也支持
await importBpmnXml(graph, xml, {
  adapter: 'smartengine'
})
```

### 5.4 创建自定义适配器

```typescript
// 1. 定义适配器
const camundaAdapter: SerializationAdapter = {
  name: 'camunda',
  namespaces: {
    camunda: 'http://camunda.org/schema/1.0/bpmn'
  },
  onExportNode(context) {
    const { cell, element } = context
    const bpmn = cell.getData().bpmn

    // 转换 assignee → camunda:assignee
    if (bpmn?.assignee) {
      element.$attrs['camunda:assignee'] = bpmn.assignee
    }

    // 转换 candidateGroups → camunda:candidateGroups
    if (bpmn?.candidateGroups) {
      element.$attrs['camunda:candidateGroups'] = bpmn.candidateGroups
    }
  },
  onImportNode(context) {
    const { element, cellData } = context
    const attrs = element.$attrs || {}

    // 提取 camunda: 属性
    if (!cellData.data) cellData.data = {}
    if (!cellData.data.bpmn) cellData.data.bpmn = {}

    if (attrs['camunda:assignee']) {
      cellData.data.bpmn.assignee = attrs['camunda:assignee']
    }
    if (attrs['camunda:candidateGroups']) {
      cellData.data.bpmn.candidateGroups = attrs['camunda:candidateGroups']
    }
  }
}

// 2. 注册适配器
registerSerializationAdapter(camundaAdapter)

// 3. 使用
const xml = await exportBpmnXml(graph, { adapter: 'camunda' })
```

---

## 6. 扩展性设计

### 6.1 扩展点汇总

| 扩展点 | 位置 | 用途 |
|--------|------|------|
| **规则预设** | `src/rules/presets/` | 定义连线规则、节点属性、验证器 |
| **序列化适配器** | `src/rules/presets/*-adapter.ts` | 处理引擎特定的 XML 格式 |
| **自定义节点** | 应用层 | 添加业务特定的节点类型 |
| **自定义连接线** | 应用层 | 添加业务特定的连接线 |
| **自定义验证器** | 预设中的 `validators` | 添加业务逻辑验证 |
| **节点渲染** | Vue 组件 + `@antv/x6-vue-shape` | 自定义节点外观 |

### 6.2 扩展示例：添加 Flowable 支持

#### 步骤 1：创建 Flowable 预设
```typescript
// src/rules/presets/flowable.ts
export const FLOWABLE_PRESET: BpmnRulePreset = {
  name: 'flowable',
  extends: 'bpmn2',
  description: 'Flowable 工作流引擎规则',
  nodeProperties: {
    'bpmn-user-task': [
      { key: 'formKey', label: '表单标识', type: 'string' },
      { key: 'assignee', label: '处理人', type: 'string' },
      { key: 'dueDate', label: '到期时间', type: 'string' },
    ]
  }
}

// 注册预设
registerPreset(FLOWABLE_PRESET)
```

#### 步骤 2：创建 Flowable 适配器
```typescript
// src/rules/presets/flowable-adapter.ts
export const flowableSerializationAdapter: SerializationAdapter = {
  name: 'flowable',
  namespaces: {
    flowable: 'http://flowable.org/bpmn'
  },
  onExportNode(context) {
    const { cell, element } = context
    const bpmn = cell.getData().bpmn

    if (bpmn?.formKey) {
      element.$attrs['flowable:formKey'] = bpmn.formKey
    }
    if (bpmn?.assignee) {
      element.$attrs['flowable:assignee'] = bpmn.assignee
    }
  },
  onImportNode(context) {
    const { element, cellData } = context
    const attrs = element.$attrs || {}

    if (!cellData.data) cellData.data = {}
    if (!cellData.data.bpmn) cellData.data.bpmn = {}

    if (attrs['flowable:formKey']) {
      cellData.data.bpmn.formKey = attrs['flowable:formKey']
    }
    if (attrs['flowable:assignee']) {
      cellData.data.bpmn.assignee = attrs['flowable:assignee']
    }
  }
}

// 注册适配器
registerSerializationAdapter(flowableSerializationAdapter)
```

#### 步骤 3：使用
```typescript
// 应用中使用 Flowable 预设
const rules = resolvePreset('flowable')

// 导出 Flowable 格式的 XML
const xml = await exportBpmnXml(graph, {
  adapter: 'flowable'
})
```

### 6.3 扩展示例：添加自定义审批节点

```typescript
// 1. 定义节点形状
Graph.registerNode('bpmn-approval-task', {
  inherit: 'rect',
  width: 120,
  height: 70,
  attrs: {
    body: {
      fill: '#fff8e1',
      stroke: '#ff8f00'
    },
    label: { text: '审批' }
  },
  ports: { /* 标准 4 端口 */ }
})

// 2. 添加到节点映射（支持 XML 导出）
NODE_MAPPING['bpmn-approval-task'] = { tag: 'userTask' }

// 3. 在预设中定义属性
createExtendedPreset('my-approval', 'bpmn2', {
  nodeProperties: {
    'bpmn-approval-task': [
      { key: 'approver', label: '审批人', type: 'string' },
      { key: 'approvalMode', label: '审批方式', type: 'select',
        options: [
          { label: '依次审批', value: 'sequential' },
          { label: '会签', value: 'parallel' }
        ]
      }
    ]
  }
})
```

---

## 7. 如何满足需求

### 7.1 需求：支持所有 BPMN 2.0 节点

✅ **实现**：
- 第一层（BPMN 2.0 标准模型库）包含完整的 74 个标准节点
- 完全符合 BPMN 2.0 OMG 规范
- 提供双向 XML 映射

**证据**：
- `src/shapes/` - 所有标准节点的形状定义
- `src/export/bpmn-mapping.ts` - 完整的节点映射表
- `src/utils/constants.ts` - 74 个节点常量定义

### 7.2 需求：BPMN 2.0 是不可动摇的标准

✅ **实现**：
- BPMN 2.0 模型库是独立的第一层，不依赖任何规则预设
- 所有预设必须基于 BPMN 2.0 或其衍生预设
- 标准模型库只随 OMG 规范更新

**证据**：
```typescript
// BPMN2_PRESET 是所有预设的根
export const BPMN2_PRESET: BpmnRulePreset = {
  name: 'bpmn2',
  // 无 extends，是根预设
}

// SmartEngine 必须继承 BPMN 2.0
export const SMARTENGINE_PRESET: BpmnRulePreset = {
  name: 'smartengine',
  extends: 'bpmn2',  // 强制基于 BPMN 2.0
}
```

### 7.3 需求：规则库独立演化

✅ **实现**：
- 每个规则预设是独立的模块文件
- 预设之间通过名称引用，无直接依赖
- 修改一个预设不影响其他预设

**证据**：
```
src/rules/presets/
  ├── bpmn2.ts              # BPMN 2.0 预设（独立）
  ├── smartengine.ts        # SmartEngine 预设（独立）
  ├── bpmn2-adapter.ts      # BPMN 2.0 适配器（独立）
  └── smartengine-adapter.ts # SmartEngine 适配器（独立）
```

### 7.4 需求：可供配置的形式，像 BPMN 2.0 一样使用

✅ **实现**：
- 通过预设名称切换规则：`resolvePreset('smartengine')`
- 通过适配器名称切换序列化：`exportBpmnXml(graph, { adapter: 'smartengine' })`
- 切换后所有行为（连线规则、属性、XML 格式）自动适配

**示例**：
```typescript
// 使用 BPMN 2.0
const bpmn2Rules = resolvePreset('bpmn2')
const bpmn2Xml = await exportBpmnXml(graph, { adapter: 'bpmn2' })

// 使用 SmartEngine（用法完全相同）
const smartRules = resolvePreset('smartengine')
const smartXml = await exportBpmnXml(graph, { adapter: 'smartengine' })
```

### 7.5 需求：全方面可配置（节点定义、属性、连线规则等）

✅ **实现**：

| 配置项 | 实现方式 |
|--------|----------|
| **节点定义** | `nodeProperties` 定义每个节点的可配置属性 |
| **连线规则** | `connectionRules` 定义连线约束（类型、数量、目标） |
| **节点分类** | `shapeCategoryOverrides` 覆盖节点的分类 |
| **节点标签** | `shapeLabelOverrides` 自定义节点的显示名称 |
| **验证逻辑** | `validators` 添加自定义验证函数 |
| **XML 格式** | `SerializationAdapter` 定制序列化格式 |

### 7.6 需求：内置 SmartEngine，可定制其他类 SmartEngine

✅ **实现**：
- SmartEngine 作为内置预设和适配器自动注册
- 用户可以基于 SmartEngine 或 BPMN 2.0 创建自己的预设
- 所有自定义预设都必须基于 BPMN 2.0

**示例**：
```typescript
// 内置 SmartEngine
resolvePreset('smartengine')  // 开箱即用

// 创建类 SmartEngine 的自定义预设
createExtendedPreset('my-engine', 'smartengine', {
  connectionRules: { /* 覆盖规则 */ }
})

// 或基于 BPMN 2.0 创建全新预设
createExtendedPreset('another-engine', 'bpmn2', {
  // 完全自定义
})
```

### 7.7 需求：契约明确，接口稳定

✅ **实现**：
- 所有预设遵循 `BpmnRulePreset` 接口
- 所有适配器遵循 `SerializationAdapter` 接口
- 接口的输入和输出都是"标准 BPMN 2.0 模型"

**契约**：
```typescript
// 输入：标准 BPMN 2.0 X6 Graph
// 输出：标准 BPMN 2.0 XML（带引擎特定扩展）
exportBpmnXml(graph: Graph, options?: { adapter?: string }): Promise<string>

// 输入：标准 BPMN 2.0 XML（带引擎特定扩展）
// 输出：标准 BPMN 2.0 X6 Graph
importBpmnXml(graph: Graph, xml: string, options?: { adapter?: string }): Promise<void>
```

### 7.8 需求：结构清晰，易于维护

✅ **实现**：

```
packages/x6-plugin-bpmn/
├── src/
│   ├── shapes/                    # 第一层：BPMN 2.0 标准节点
│   │   ├── activities.ts
│   │   ├── events.ts
│   │   ├── gateways.ts
│   │   └── ...
│   ├── rules/                     # 第二层：规则系统
│   │   ├── connection-rules.ts    # 基础连线规则
│   │   ├── validator.ts           # 验证器
│   │   └── presets/               # 第三层：预设系统
│   │       ├── types.ts           # 类型定义
│   │       ├── registry.ts        # 注册中心
│   │       ├── bpmn2.ts           # BPMN 2.0 预设
│   │       ├── smartengine.ts     # SmartEngine 预设
│   │       ├── serialization-adapter.ts  # 适配器接口
│   │       ├── bpmn2-adapter.ts   # BPMN 2.0 适配器
│   │       └── smartengine-adapter.ts # SmartEngine 适配器
│   ├── export/                    # XML 导入/导出
│   │   ├── exporter.ts
│   │   ├── importer.ts
│   │   └── bpmn-mapping.ts
│   └── ...
└── tests/                         # 测试
    ├── presets.test.ts            # 预设测试
    └── export.test.ts             # 导出/导入测试
```

**特点**：
- ✅ 清晰的分层架构
- ✅ 单一职责原则（每个文件职责明确）
- ✅ 低耦合高内聚
- ✅ 易于定位和修改

---

## 8. 总结

X6-BPMN 插件通过**分层架构**和**预设系统**实现了：

1. **标准不动摇**：BPMN 2.0 作为不可变的基础层
2. **独立演化**：每个规则预设独立维护，互不影响
3. **契约明确**：统一的接口和数据模型
4. **高度可扩展**：多个扩展点，支持各种定制需求
5. **结构清晰**：清晰的分层和模块划分

这个架构使得：
- **维护者**：可以独立维护各个预设，不影响其他部分
- **使用者**：可以像使用 BPMN 2.0 一样使用任何预设
- **扩展者**：可以轻松创建自己的预设和适配器

---

## 附录：API 快速参考

### 规则预设 API
```typescript
// 注册预设
registerPreset(preset: BpmnRulePreset): void

// 解析预设（展平继承链）
resolvePreset(name: string): ResolvedBpmnRulePreset

// 创建继承预设
createExtendedPreset(
  name: string,
  parentName: string,
  overrides: Partial<BpmnRulePreset>
): BpmnRulePreset

// 获取/列出预设
getPreset(name: string): BpmnRulePreset | undefined
listPresets(): string[]
```

### 序列化适配器 API
```typescript
// 注册适配器
registerSerializationAdapter(adapter: SerializationAdapter): void

// 获取/列出适配器
getSerializationAdapter(name: string): SerializationAdapter | undefined
listSerializationAdapters(): string[]
```

### 导入/导出 API
```typescript
// 导出 XML
exportBpmnXml(
  graph: Graph,
  options?: {
    processId?: string
    processName?: string
    adapter?: string | SerializationAdapter
  }
): Promise<string>

// 导入 XML
importBpmnXml(
  graph: Graph,
  xml: string,
  options?: {
    clearGraph?: boolean
    zoomToFit?: boolean
    adapter?: string | SerializationAdapter
  }
): Promise<void>
```

### 验证 API
```typescript
// 验证连接
validateBpmnConnection(
  sourceNode: Node,
  targetNode: Node,
  edge: Edge,
  preset: ResolvedBpmnRulePreset
): BpmnValidationResult

// 创建 X6 验证函数
createBpmnValidateConnection(
  preset: ResolvedBpmnRulePreset
): (args: ValidateConnectionArgs) => boolean
```
