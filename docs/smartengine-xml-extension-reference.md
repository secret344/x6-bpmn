# SmartEngine XML 扩展参考

SmartEngine XML Extension Reference

## 1. 文档定位 / Purpose

这是一份参考页，只回答 SmartEngine XML 导出与导入中需要查阅的事实：命名空间、标签规则、字段映射、适用节点和验证命令。

This is a reference page. It focuses on the facts needed for SmartEngine XML export and import: namespaces, tag rules, field mappings, supported nodes, and verification commands.

## 2. 命名空间 / Namespaces

SmartEngine XML 使用下列命名空间配置：

SmartEngine XML uses the following namespace configuration:

| 项 / Item | 值 / Value |
|---|---|
| Smart 前缀 / Smart prefix | `smart` |
| Smart 命名空间 / Smart namespace | `http://smartengine.org/schema/process` |
| BPMN 模型命名空间 / BPMN model namespace | `http://www.omg.org/spec/BPMN/20100524/MODEL` |
| Smart 扩展承载位置 / Smart extension container | `extensionElements` |

## 3. BPMN 标签规则 / BPMN Tag Rules

`smartengine-custom` 也就是服务编排模式，导出标准 BPMN 元素时使用默认 BPMN 命名空间，因此标签写成无前缀形式。

`smartengine-custom`, which is the service orchestration mode, exports standard BPMN elements under the default BPMN namespace, so the tags are emitted without the `bpmn:` prefix.

适用范围包括 `definitions`、`process`、`startEvent`、`serviceTask`、`exclusiveGateway`、`transaction`、`sequenceFlow` 等标准 BPMN 标签。

This applies to standard BPMN tags such as `definitions`, `process`, `startEvent`, `serviceTask`, `exclusiveGateway`, `transaction`, and `sequenceFlow`.

示例：

Example:

```xml
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="Process_1">
    <startEvent id="StartEvent_1" />
    <serviceTask id="ServiceTask_1" />
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ServiceTask_1" />
  </process>
</definitions>
```

`smartengine-base` 和 `smartengine-database` 仍按常规 BPMN 导出，标准 BPMN 标签保留 `bpmn:` 前缀。

`smartengine-base` and `smartengine-database` continue to export standard BPMN tags with the `bpmn:` prefix.

## 4. Smart 字段映射 / Smart Field Mapping

宿主数据应放在节点的 `data.bpmn` 下。字段与 XML 的对应关系如下：

Host data should be stored under node `data.bpmn`. The field-to-XML mapping is:

| 宿主字段 / Host field | XML 结构 / XML structure | 说明 / Notes |
|---|---|---|
| `smartClass` | `smart:class="..."` | 写到 BPMN 元素属性上 / Serialized as a BPMN element attribute |
| `smartProperties` | `<smart:properties><smart:property ... /></smart:properties>` | 宿主值为 JSON 数组字符串 / Host value is a JSON array string |
| `smartExecutionListeners` | `<smart:executionListener ... />` | 宿主值为 JSON 数组字符串 / Host value is a JSON array string |

`smartProperties` 和 `smartExecutionListeners` 是宿主字段名，不是 XML 标签名。

`smartProperties` and `smartExecutionListeners` are host-side field names, not XML tag names.

## 5. 支持节点 / Supported Nodes

内置 SmartEngine profile 当前对以下 BPMN 节点应用 Smart 序列化：

The built-in SmartEngine profiles currently apply Smart serialization to the following BPMN nodes:

| 节点 / Node | Smart 字段支持 / Smart field support |
|---|---|
| `serviceTask` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `receiveTask` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `exclusiveGateway` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `userTask` | `smartProperties`、`smartExecutionListeners` |

`userTask` 不输出 `smart:class`，但仍输出 `smart:properties` 和 `smart:executionListener`。

`userTask` does not output `smart:class`, but it still outputs `smart:properties` and `smart:executionListener`.

## 6. XML 结构示例 / XML Structure Examples

服务编排模式中的 `serviceTask` 示例：

Example `serviceTask` in service orchestration mode:

```xml
<serviceTask id="ServiceTask_1" name="调用服务" smart:class="com.example.ServiceDelegation">
  <extensionElements>
    <smart:properties>
      <smart:property name="serviceName" value="serviceA" />
    </smart:properties>
    <smart:executionListener event="ACTIVITY_START" class="com.example.StartListener" />
  </extensionElements>
</serviceTask>
```

审批场景中的 `userTask` 示例：

Example `userTask` in an approval scenario:

```xml
<bpmn:userTask id="UserTask_1" name="人工复核">
  <bpmn:extensionElements>
    <smart:properties>
      <smart:property name="taskType" value="manual-review" />
    </smart:properties>
    <smart:executionListener event="ACTIVITY_START" class="com.example.StartListener" />
  </bpmn:extensionElements>
</bpmn:userTask>
```

## 7. 验证命令 / Verification Commands

和这份参考页直接相关的验证命令：

The verification commands directly related to this reference page are:

```bash
pnpm typecheck
pnpm run test
pnpm run test:smartengine:browser
```

`pnpm typecheck` 验证类型范围。`pnpm run test` 覆盖插件侧 SmartEngine roundtrip。`pnpm run test:smartengine:browser` 覆盖 SmartEngine demo 的预览与导出链路。

`pnpm typecheck` validates the type-checking scope. `pnpm run test` covers plugin-side SmartEngine roundtrips. `pnpm run test:smartengine:browser` covers the SmartEngine demo preview and export flow.