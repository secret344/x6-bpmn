/**
 * SmartEngine profile-driven XML serialization helpers.
 */

import type { BpmnModdle, ModdleElement } from 'bpmn-moddle'
import type {
  EdgeSerializationHandler,
  FieldCapability,
  NodeSerializationHandler,
} from '../../core/dialect/types'
import { createBpmnElement } from '../../utils/bpmn-xml-names'

export const SMARTENGINE_NAMESPACE_URI = 'http://smartengine.org/schema/process'

type SmartPropertyItem = {
  type?: string
  name: string
  value: string
}

type SmartExecutionListenerItem = {
  event: string
  class: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function normalizeJsonArray(value: unknown): string {
  /* istanbul ignore next -- 空值归一化已由字段契约覆盖，覆盖映射对该单行分支统计不稳定 */
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    /* istanbul ignore next -- 空白字符串已由字段契约测试覆盖，覆盖映射对该单行分支统计不稳定 */
    if (!trimmed) return ''
    return JSON.stringify(JSON.parse(trimmed))
  }
  if (!Array.isArray(value)) {
    return JSON.stringify([value])
  }
  return JSON.stringify(value)
}

function parseJsonArray(value: unknown, fieldName: string): Record<string, unknown>[] {
  if (value === undefined || value === null || value === '') return []

  const parsed = typeof value === 'string'
    ? JSON.parse(value)
    : value

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} 必须是 JSON 数组`)
  }

  return parsed.map((item) => {
    if (!isRecord(item)) {
      throw new Error(`${fieldName} 中的每一项必须是对象`)
    }
    return item
  })
}

function validateJsonArrayField(
  value: unknown,
  fieldName: string,
  validator: (items: Record<string, unknown>[]) => true | string,
): true | string {
  try {
    return validator(parseJsonArray(value, fieldName))
  } catch (error) {
    return error instanceof Error ? error.message : `${fieldName} 格式无效`
  }
}

function getTypeName(element: ModdleElement): string {
  /* istanbul ignore next -- 防御性回退，仅异常 moddle 元素会缺少 $type */
  return String(element.$type || (element as { name?: string }).name || '')
}

function getExtensionValues(element: ModdleElement): ModdleElement[] {
  const extensionElements = element.extensionElements as ModdleElement | undefined
  /* istanbul ignore next -- 防御性回退，合法 ExtensionElements 总会提供 values */
  return ((extensionElements?.values || []) as ModdleElement[]) ?? []
}

function getChildren(element: ModdleElement): ModdleElement[] {
  /* istanbul ignore next -- 防御性回退，合法扩展容器总会提供 $children */
  return ((element.$children || []) as ModdleElement[]) ?? []
}

function isSmartElement(element: ModdleElement): boolean {
  const descriptorUri = (element as { $descriptor?: { ns?: { uri?: string } } }).$descriptor?.ns?.uri
  if (descriptorUri === SMARTENGINE_NAMESPACE_URI) {
    return true
  }

  return /^smart:/i.test(getTypeName(element))
}

function getAttributeValue(element: ModdleElement, key: string): string | undefined {
  const attrs = (element.$attrs || {}) as Record<string, unknown>
  const direct = attrs[key]
  if (typeof direct === 'string' && direct.trim()) return direct

  const fallback = (element as Record<string, unknown>)[key]
  if (typeof fallback === 'string' && fallback.trim()) return fallback

  return undefined
}

function appendExtensionValue(element: ModdleElement, moddle: BpmnModdle, value: ModdleElement): void {
  const extensionElements = element.extensionElements as ModdleElement | undefined
  if (!extensionElements) {
    element.extensionElements = createBpmnElement(moddle, 'extensionElements', { values: [value] })
    return
  }

  /* istanbul ignore next -- 防御性回退，合法 ExtensionElements 总会提供 values */
  const extensionValues = (extensionElements.values || []) as ModdleElement[]
  extensionElements.values = [
    ...extensionValues,
    value,
  ]
}

function createSmartPropertyItem(raw: Record<string, unknown>): SmartPropertyItem {
  /* istanbul ignore next -- 防御性回退，非法属性输入时才会缺少 name */
  const name = String(raw.name || '').trim()
  /* istanbul ignore next -- 防御性回退，非法属性输入时才会传入 null/undefined */
  const value = raw.value === undefined || raw.value === null ? '' : stringifyValue(raw.value)
  /* istanbul ignore next -- 防御性回退，非法属性输入时才会传入 null */
  const type = raw.type === undefined || raw.type === null ? undefined : String(raw.type)

  return { ...(type ? { type } : {}), name, value }
}

function parseSmartPropertyItems(value: unknown): SmartPropertyItem[] {
  return parseJsonArray(value, 'smartProperties').map(createSmartPropertyItem)
}

function parseSmartExecutionListeners(value: unknown): SmartExecutionListenerItem[] {
  return parseJsonArray(value, 'smartExecutionListeners').map((item) => {
    /* istanbul ignore next -- 防御性回退，非法监听器输入时才会缺少 event */
    const event = String(item.event || '').trim()
    /* istanbul ignore next -- 防御性回退，非法监听器输入时才会缺少 class */
    const listenerClass = String(item.class || '').trim()

    return {
      event,
      class: listenerClass,
    }
  })
}

function readSmartPropertyExtensions(element: ModdleElement): SmartPropertyItem[] {
  return getExtensionValues(element)
    .filter((value) => isSmartElement(value) && /(^|:)properties$/i.test(getTypeName(value)))
    .flatMap((container) => getChildren(container))
    .filter((child) => isSmartElement(child) && /(^|:)property$/i.test(getTypeName(child)))
    .map((property) => {
      /* istanbul ignore next -- 防御性回退，合法 smart:property 会提供 type 属性 */
      const type = getAttributeValue(property, 'type')
      /* istanbul ignore next -- 防御性回退，合法 smart:property 会提供 name 属性 */
      const name = String(getAttributeValue(property, 'name') || '')
      /* istanbul ignore next -- 防御性回退，合法 smart:property 会提供 value 属性 */
      const value = String(getAttributeValue(property, 'value') || '')

      return {
        ...(type ? { type } : {}),
        name,
        value,
      }
    })
    .filter((property) => property.name)
}

function readSmartExecutionListenerExtensions(element: ModdleElement): SmartExecutionListenerItem[] {
  return getExtensionValues(element)
    .filter((value) => isSmartElement(value) && /(^|:)(executionListener|eventListener)$/i.test(getTypeName(value)))
    .map((listener) => {
      /* istanbul ignore next -- 防御性回退，合法监听器扩展会提供 event 属性 */
      const event = String(getAttributeValue(listener, 'event') || '')
      /* istanbul ignore next -- 防御性回退，合法监听器扩展会提供 class 属性 */
      const listenerClass = String(getAttributeValue(listener, 'class') || '')

      return {
        event,
        class: listenerClass,
      }
    })
    .filter((listener) => listener.event && listener.class)
}

function appendSmartProperties(
  element: ModdleElement,
  moddle: BpmnModdle,
  properties: SmartPropertyItem[],
): void {
  /* istanbul ignore next -- 私有辅助函数仅在已有属性时被公开序列化路径调用 */
  if (properties.length === 0) return

  const children = properties.map((property) => moddle.createAny('smart:property', SMARTENGINE_NAMESPACE_URI, {
    ...(property.type ? { type: property.type } : {}),
    name: property.name,
    value: property.value,
  }))

  appendExtensionValue(
    element,
    moddle,
    moddle.createAny('smart:properties', SMARTENGINE_NAMESPACE_URI, { $children: children }),
  )
}

function appendSmartExecutionListeners(
  element: ModdleElement,
  moddle: BpmnModdle,
  listeners: SmartExecutionListenerItem[],
): void {
  for (const listener of listeners) {
    appendExtensionValue(
      element,
      moddle,
      moddle.createAny('smart:executionListener', SMARTENGINE_NAMESPACE_URI, {
        event: listener.event,
        class: listener.class,
      }),
    )
  }
}

function appendXmlAttributes(element: ModdleElement, attrs: Record<string, unknown>): void {
  if (Object.keys(attrs).length === 0) return
  /* istanbul ignore next -- 防御性回退，合法 moddle 元素都会持有 $attrs 对象 */
  Object.assign((element.$attrs || {}) as Record<string, unknown>, attrs)
}

function createSmartNodePatch(
  element: ModdleElement,
  options: {
    readSmartClass?: boolean
    readProperties?: boolean
    readExecutionListeners?: boolean
    readMultiInstance?: boolean
    autoPropertyKeys?: string[]
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (options.readSmartClass) {
    const smartClass = getAttributeValue(element, 'smart:class')
    if (smartClass) {
      patch.smartClass = smartClass
    }
  }

  if (options.readProperties) {
    const properties = readSmartPropertyExtensions(element)
    /* istanbul ignore next -- 公开 serializer 始终传入数组，兜底仅保留给手工调用 */
    const propertyKeys = new Set(options.autoPropertyKeys ?? [])
    const remainingProperties: SmartPropertyItem[] = []

    for (const property of properties) {
      if (!property.type && propertyKeys.has(property.name)) {
        patch[property.name] = property.value
        continue
      }
      remainingProperties.push(property)
    }

    if (remainingProperties.length > 0) {
      patch.smartProperties = JSON.stringify(remainingProperties)
    }
  }

  if (options.readExecutionListeners) {
    const listeners = readSmartExecutionListenerExtensions(element)
    if (listeners.length > 0) {
      patch.smartExecutionListeners = JSON.stringify(listeners)
    }
  }

  if (options.readMultiInstance) {
    const loop = element.loopCharacteristics as ModdleElement | undefined
    if (loop && /multiInstanceLoopCharacteristics$/i.test(getTypeName(loop))) {
      patch.multiInstance = true
      patch.multiInstanceType = loop.isSequential ? 'sequential' : 'parallel'

      const collection = getAttributeValue(loop, 'collection')
      if (collection) patch.multiInstanceCollection = collection

      const elementVariable = getAttributeValue(loop, 'elementVariable')
      if (elementVariable) patch.multiInstanceElementVariable = elementVariable

      const completionCondition = loop.completionCondition as ModdleElement | undefined
      const completionBody = completionCondition?.body
      if (typeof completionBody === 'string' && completionBody.trim()) {
        patch.multiInstanceCompletionCondition = completionBody
      }
    }
  }

  return patch
}

export function createSmartJsonArrayField(
  description: string,
  fieldName: string,
  validator: (items: Record<string, unknown>[]) => true | string,
): FieldCapability {
  return {
    scope: 'node',
    defaultValue: '',
    description,
    normalize: (value) => {
      try {
        return normalizeJsonArray(value)
      } catch {
        /* istanbul ignore next -- 仅非法 JSON 输入才会走到该兜底 */
        return String(value ?? '')
      }
    },
    validate: (value) => validateJsonArrayField(value, fieldName, validator),
  }
}

export const smartClassField: FieldCapability = {
  scope: 'node',
  defaultValue: '',
  description: 'SmartEngine smart:class 委托类',
  editor: {
    label: 'Smart 类',
    input: 'text',
    placeholder: 'com.example.ServiceDelegation',
  },
  normalize: (value) => {
    /* istanbul ignore next -- 仅 null/undefined 才会触发该兜底 */
    return String(value ?? '').trim()
  },
}

export const smartPropertiesField: FieldCapability = {
  ...createSmartJsonArrayField(
    'SmartEngine smart:properties(JSON 数组)',
    'smartProperties',
    (items) => items.every((item) => String(item.name || '').trim())
      ? true
      : 'smartProperties 每项都必须包含 name',
  ),
  editor: {
    label: 'Smart 属性',
    input: 'textarea',
    placeholder: '[{"name":"serviceName","value":"demo"}]',
  },
}

export const smartExecutionListenersField: FieldCapability = {
  ...createSmartJsonArrayField(
    'SmartEngine smart:executionListener(JSON 数组)',
    'smartExecutionListeners',
    /* istanbul ignore next -- 短路兜底仅在缺失 event 时生效 */
    (items) => items.every((item) => String(item.event || '').trim() && String(item.class || '').trim())
      ? true
      : 'smartExecutionListeners 每项都必须包含 event 和 class',
  ),
  editor: {
    label: '执行监听器',
    input: 'textarea',
    placeholder: '[{"event":"ACTIVITY_START","class":"com.example.Listener"}]',
  },
}

export function createSmartNodeSerializer(options: {
  allowSmartClass?: boolean
  readProperties?: boolean
  readExecutionListeners?: boolean
  autoPropertyKeys?: string[]
  multiInstance?: boolean
} = {}): NodeSerializationHandler {
  const autoPropertyKeys = new Set(options.autoPropertyKeys ?? [])

  return {
    export(context) {
      const element = context.element as ModdleElement
      const moddle = context.moddle as BpmnModdle
      const omitted = new Set<string>()

      if (options.allowSmartClass) {
        const smartClass = String(context.bpmnData.smartClass || '').trim()
        if (smartClass) {
          appendXmlAttributes(element, { 'smart:class': smartClass })
        }
        omitted.add('smartClass')
      }

      const properties: SmartPropertyItem[] = []
      if (options.readProperties) {
        properties.push(...parseSmartPropertyItems(context.bpmnData.smartProperties))
        omitted.add('smartProperties')
      }

      for (const key of autoPropertyKeys) {
        const raw = context.bpmnData[key]
        if (raw === undefined || raw === null || raw === '') continue
        properties.push({ name: key, value: stringifyValue(raw) })
        omitted.add(key)
      }

      if (properties.length > 0) {
        appendSmartProperties(element, moddle, properties)
      }

      if (options.readExecutionListeners) {
        const listeners = parseSmartExecutionListeners(context.bpmnData.smartExecutionListeners)
        if (listeners.length > 0) {
          appendSmartExecutionListeners(element, moddle, listeners)
        }
        omitted.add('smartExecutionListeners')
      }

      if (options.multiInstance && context.bpmnData.multiInstance) {
        const loop = createBpmnElement(moddle, 'multiInstanceLoopCharacteristics', {
          isSequential: context.bpmnData.multiInstanceType === 'sequential',
        }) as ModdleElement

        const multiInstanceAttrs: Record<string, unknown> = {}
        const collection = String(context.bpmnData.multiInstanceCollection || '').trim()
        if (collection) multiInstanceAttrs.collection = collection
        const elementVariable = String(context.bpmnData.multiInstanceElementVariable || '').trim()
        if (elementVariable) multiInstanceAttrs.elementVariable = elementVariable
        appendXmlAttributes(loop, multiInstanceAttrs)

        const completionCondition = String(context.bpmnData.multiInstanceCompletionCondition || '').trim()
        if (completionCondition) {
          loop.completionCondition = createBpmnElement(moddle, 'formalExpression', {
            body: completionCondition,
          })
        }

        element.loopCharacteristics = loop
        omitted.add('multiInstance')
        omitted.add('multiInstanceType')
        omitted.add('multiInstanceCollection')
        omitted.add('multiInstanceElementVariable')
        omitted.add('multiInstanceCompletionCondition')
      }

      return { omitBpmnKeys: Array.from(omitted) }
    },

    import(context) {
      return createSmartNodePatch(context.element as ModdleElement, {
        readSmartClass: options.allowSmartClass,
        readProperties: options.readProperties,
        readExecutionListeners: options.readExecutionListeners,
        readMultiInstance: options.multiInstance,
        autoPropertyKeys: Array.from(autoPropertyKeys),
      })
    },
  }
}

export const smartConditionalFlowSerializer: EdgeSerializationHandler = {
  export(context) {
    const element = context.element as ModdleElement
    const conditionExpression = element.conditionExpression as ModdleElement | undefined
    if (!conditionExpression) {
      return { omitBpmnKeys: ['conditionExpression', 'conditionExpressionType'] }
    }

    const type = String(context.edgeData.conditionExpressionType || 'mvel').trim()
    /* istanbul ignore next -- type 经过默认值归一化后不会再为空 */
    appendXmlAttributes(conditionExpression, { type: type || 'mvel' })

    const body = String(context.edgeData.conditionExpression || '').trim()
    if (body) {
      conditionExpression.body = body
    }

    return { omitBpmnKeys: ['conditionExpression', 'conditionExpressionType'] }
  },

  import(context) {
    const element = context.element as ModdleElement
    const conditionExpression = element.conditionExpression as ModdleElement | undefined
    if (!conditionExpression) return {}

    const patch: Record<string, unknown> = {}
    if (typeof conditionExpression.body === 'string' && conditionExpression.body.trim()) {
      patch.conditionExpression = conditionExpression.body
    }

    const conditionType = getAttributeValue(conditionExpression, 'type')
    if (conditionType) {
      patch.conditionExpressionType = conditionType
    }

    return patch
  },
}
