# SmartEngine XML 扩展参考

SmartEngine XML Extension Reference

## 1. 适用范围 / Scope

这份文档是 SmartEngine XML 扩展的参考页，给仓库维护者和宿主接入者查命名空间、字段映射和回退规则用。

This page is a reference for SmartEngine XML extensions. It is intended for repository maintainers and host integrators who need to look up namespace rules, field mappings, and fallback behavior.

## 2. 官方命名空间 / Official Namespace

SmartEngine 导出时使用的官方前缀和 URI 如下：

The official prefix and URI used during SmartEngine export are:

| 项 / Item | 值 / Value |
|---|---|
| XML 前缀 / XML prefix | `smart` |
| 命名空间 URI / Namespace URI | `http://smartengine.org/schema/process` |
| 扩展承载位置 / Extension container | `bpmn:extensionElements` |

说明：方言检测仍兼容历史 URI `http://smartengine.alibaba.com/schema`，但新导出应统一写成官方 URI。

Note: dialect detection still accepts the legacy URI `http://smartengine.alibaba.com/schema`, but new exports should always use the official URI.

## 3. 服务编排模式的 BPMN 标签前缀 / BPMN Tag Prefix in Custom Mode

`smartengine-custom` 也就是服务编排模式，导出时会把 BPMN 模型命名空间写成默认 `xmlns`，因此 `startEvent`、`serviceTask`、`process`、`sequenceFlow` 这类标准 BPMN 标签不会再带 `bpmn:` 前缀。

`smartengine-custom`, which is the service orchestration mode, exports the BPMN model namespace as the default `xmlns`. As a result, standard BPMN tags such as `startEvent`, `serviceTask`, `process`, and `sequenceFlow` are emitted without the `bpmn:` prefix.

这是服务编排模式的专属导出限制，不影响 `smartengine-base`、`smartengine-database` 或普通 BPMN 2.0 导出；这些模式仍保持 `bpmn:*` 标签前缀。

This is a service-orchestration-specific export rule. It does not affect `smartengine-base`, `smartengine-database`, or plain BPMN 2.0 export; those modes continue to emit `bpmn:*` tags.

示例：

Example:

```xml
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="Process_1">
    <startEvent id="StartEvent_1" />
    <serviceTask id="ServiceTask_1" smart:class="com.example.ServiceDelegation" />
  </process>
</definitions>
```

如果服务编排模式的导出里仍出现 `<bpmn:startEvent>` 这类标签，优先检查 profile 的 `serialization.xmlNames.useDefaultNamespace` 是否生效，以及导出阶段是否又把 `xmlns:bpmn` 重新注入回根节点。

If the service orchestration export still contains tags such as `<bpmn:startEvent>`, first verify that the profile `serialization.xmlNames.useDefaultNamespace` is active and that the export pipeline did not inject `xmlns:bpmn` back onto the root element.

## 4. 宿主字段到 XML 的映射 / Host Field to XML Mapping

宿主侧应把 SmartEngine 数据放在节点的 `data.bpmn` 下。字段名和 XML 输出的对应关系如下：

Hosts should store SmartEngine data under node `data.bpmn`. The mapping between host fields and XML output is:

| 宿主字段 / Host field | XML 输出 / XML output | 说明 / Notes |
|---|---|---|
| `smartClass` | `smart:class="..."` | 以内联属性写到 BPMN 元素上 / Serialized as an inline attribute |
| `smartProperties` | `<smart:properties><smart:property ... /></smart:properties>` | 宿主值是 JSON 数组字符串 / Host value is a JSON array string |
| `smartExecutionListeners` | `<smart:executionListener ... />` | 宿主值是 JSON 数组字符串 / Host value is a JSON array string |

`smartProperties` 和 `smartExecutionListeners` 是宿主数据模型里的字段名，不是 XML 里的元素名。导出后的 XML 必须是 `smart:*` 扩展元素。

`smartProperties` and `smartExecutionListeners` are host-side data-model field names, not XML element names. The exported XML must use `smart:*` extension elements.

## 5. 当前支持的 Smart 节点类别 / Supported Smart Node Categories

当前内置 SmartEngine profile 会对下列 BPMN 节点应用 Smart 序列化规则：

The built-in SmartEngine profile currently applies Smart serialization rules to the following BPMN node categories:

| 节点 / Node | Smart 字段支持 / Smart field support |
|---|---|
| `serviceTask` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `receiveTask` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `exclusiveGateway` | `smartClass`、`smartProperties`、`smartExecutionListeners` |
| `userTask` | `smartProperties`、`smartExecutionListeners` |

其中 `userTask` 不导出 `smart:class`，但它的 `smartProperties` 和 `smartExecutionListeners` 也必须使用 `smart:*` 扩展，而不是通用扩展容器。

`userTask` does not export `smart:class`, but its `smartProperties` and `smartExecutionListeners` must still be serialized as `smart:*` extensions instead of the generic extension container.

## 6. 回退规则 / Fallback Rules

`modeler:properties` 是通用扩展属性容器，只应用在没有专用 profile 序列化器接管的普通扩展字段上。

`modeler:properties` is the generic extension-property container. It should only be used for ordinary extension fields that are not handled by a dedicated profile serializer.

对于 SmartEngine 专属字段，规则是：

For SmartEngine-specific fields, the rule is:

1. `smartClass` 只能导出成 `smart:class`。
2. `smartProperties` 只能导出成 `smart:properties` / `smart:property`。
3. `smartExecutionListeners` 只能导出成 `smart:executionListener`。
4. 如果导出结果出现 `modeler:properties` 承载上述 Smart 字段，说明节点没有走到 Smart 序列化器，应该优先检查 profile 的 `nodeSerializers` 配置。

1. `smartClass` must serialize only as `smart:class`.
2. `smartProperties` must serialize only as `smart:properties` / `smart:property`.
3. `smartExecutionListeners` must serialize only as `smart:executionListener`.
4. If the export result places those Smart fields under `modeler:properties`, the node did not go through the Smart serializer. Check the profile `nodeSerializers` configuration first.

## 7. 参考示例 / Reference Example

下面这段 XML 体现了正确的 SmartEngine 导出结构：

The snippet below shows the correct SmartEngine export structure:

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

如果这里变成 `modeler:properties`，那不是 SmartEngine 文档要求，而是实现回退到了通用扩展路径。

If this turns into `modeler:properties`, that is not a SmartEngine documentation requirement. It means the implementation fell back to the generic extension path.

## 8. 回归验证命令 / Regression Verification Commands

和这条规则直接相关的回归验证命令如下：

The regression commands directly related to this rule are:

```bash
pnpm run test
pnpm run test:smartengine:browser
```

`pnpm run test` 覆盖插件侧 SmartEngine 序列化 roundtrip。`pnpm run test:smartengine:browser` 覆盖 SmartEngine demo 的适配器预览和导出按钮链路。

`pnpm run test` covers plugin-side SmartEngine serialization roundtrips. `pnpm run test:smartengine:browser` covers the SmartEngine demo preview and export-button flow.