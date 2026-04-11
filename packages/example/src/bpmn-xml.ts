import type { Graph } from '@antv/x6'
import {
  EDGE_MAPPING,
  NODE_MAPPING,
  exportBpmnXml,
  importBpmnXml,
  type ExportBpmnOptions,
  type ImportBpmnOptions,
} from '@x6-bpmn2/plugin'

const CAMUNDA_NAMESPACE_URI = 'http://camunda.org/schema/1.0/bpmn'
const EXAMPLE_NAMESPACE_URI = 'http://x6-bpmn2.io/schema/example'

const DEFAULT_EXTENSION_PROPERTIES = {
  prefix: 'camunda',
  namespaceUri: CAMUNDA_NAMESPACE_URI,
  containerLocalName: 'properties',
  propertyLocalName: 'property',
} as const

type ExampleBpmnData = Record<string, unknown>
type NodeSerializationHandler = NonNullable<NonNullable<ExportBpmnOptions['serialization']>['nodeSerializers']>[string]
type EdgeSerializationHandler = NonNullable<NonNullable<ExportBpmnOptions['serialization']>['edgeSerializers']>[string]

interface AttributeMapping {
  key: string
  attrName: string
  valueType?: 'boolean'
}

const CAMUNDA_INLINE_ATTRIBUTE_MAPPINGS: AttributeMapping[] = [
  { key: 'assignee', attrName: 'camunda:assignee' },
  { key: 'candidateUsers', attrName: 'camunda:candidateUsers' },
  { key: 'candidateGroups', attrName: 'camunda:candidateGroups' },
  { key: 'formKey', attrName: 'camunda:formKey' },
  { key: 'dueDate', attrName: 'camunda:dueDate' },
  { key: 'resultVariable', attrName: 'camunda:resultVariable' },
  { key: 'isAsync', attrName: 'camunda:async', valueType: 'boolean' },
]

const EXAMPLE_INLINE_NODE_ATTRIBUTE_MAPPINGS: AttributeMapping[] = [
  { key: 'calledElement', attrName: 'example:calledElement' },
  { key: 'scriptFormat', attrName: 'example:scriptFormat' },
  { key: 'script', attrName: 'example:script' },
  { key: 'activationCondition', attrName: 'example:activationCondition' },
  { key: 'timerType', attrName: 'example:timerType' },
  { key: 'timerValue', attrName: 'example:timerValue' },
  { key: 'messageRef', attrName: 'example:messageRef' },
  { key: 'messageName', attrName: 'example:messageName' },
  { key: 'signalRef', attrName: 'example:signalRef' },
  { key: 'signalName', attrName: 'example:signalName' },
  { key: 'errorRef', attrName: 'example:errorRef' },
  { key: 'errorCode', attrName: 'example:errorCode' },
  { key: 'escalationRef', attrName: 'example:escalationRef' },
  { key: 'escalationCode', attrName: 'example:escalationCode' },
  { key: 'linkName', attrName: 'example:linkName' },
  { key: 'activityRef', attrName: 'example:activityRef' },
  { key: 'isCollection', attrName: 'example:isCollection', valueType: 'boolean' },
]

const EXAMPLE_INLINE_EDGE_ATTRIBUTE_MAPPINGS: AttributeMapping[] = [
  { key: 'messageRef', attrName: 'example:messageRef' },
  { key: 'messageName', attrName: 'example:messageName' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getElementAttributes(element: unknown): Record<string, unknown> {
  const record = element as { $attrs?: Record<string, unknown> }
  if (!record.$attrs) {
    record.$attrs = {}
  }
  return record.$attrs
}

function readStringValue(data: ExampleBpmnData, key: string): string | undefined {
  const value = data[key]
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized === '' ? undefined : normalized
}

function readBooleanValue(data: ExampleBpmnData, key: string): boolean | undefined {
  const value = data[key]
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function writeAttribute(
  attrs: Record<string, unknown>,
  attrName: string,
  value: string | boolean | undefined,
): void {
  if (value === undefined || value === '') {
    delete attrs[attrName]
    return
  }
  attrs[attrName] = typeof value === 'boolean' ? String(value) : value
}

function exportMappedAttributes(
  bpmnData: ExampleBpmnData,
  element: unknown,
  mappings: AttributeMapping[],
): string[] {
  const attrs = getElementAttributes(element)

  for (const mapping of mappings) {
    const value = mapping.valueType === 'boolean'
      ? readBooleanValue(bpmnData, mapping.key)
      : readStringValue(bpmnData, mapping.key)
    writeAttribute(attrs, mapping.attrName, value)
  }

  return mappings.map((mapping) => mapping.key)
}

function exportImplementationAttributes(bpmnData: ExampleBpmnData, element: unknown): string[] {
  const attrs = getElementAttributes(element)
  delete attrs['camunda:class']
  delete attrs['camunda:expression']
  delete attrs['camunda:delegateExpression']
  delete attrs['camunda:decisionRef']

  const implementationType = readStringValue(bpmnData, 'implementationType')
  const implementation = readStringValue(bpmnData, 'implementation')

  if (implementationType && implementation) {
    if (implementationType === 'dmn') {
      attrs['camunda:decisionRef'] = implementation
    } else if (
      implementationType === 'class'
      || implementationType === 'expression'
      || implementationType === 'delegateExpression'
    ) {
      attrs[`camunda:${implementationType}`] = implementation
    }
  }

  return ['implementationType', 'implementation']
}

function readMappedAttributes(element: unknown, mappings: AttributeMapping[]): ExampleBpmnData {
  const attrs = isRecord((element as { $attrs?: unknown }).$attrs)
    ? (element as { $attrs: Record<string, unknown> }).$attrs
    : {}
  const result: ExampleBpmnData = {}

  for (const mapping of mappings) {
    const rawValue = attrs[mapping.attrName]
    if (mapping.valueType === 'boolean') {
      if (rawValue === true || rawValue === 'true') result[mapping.key] = true
      else if (rawValue === false || rawValue === 'false') result[mapping.key] = false
      continue
    }
    if (typeof rawValue === 'string' && rawValue.trim() !== '') {
      result[mapping.key] = rawValue
    }
  }

  return result
}

function importImplementationAttributes(element: unknown): ExampleBpmnData {
  const attrs = isRecord((element as { $attrs?: unknown }).$attrs)
    ? (element as { $attrs: Record<string, unknown> }).$attrs
    : {}

  const implementationMappings: Array<[string, string]> = [
    ['class', 'camunda:class'],
    ['expression', 'camunda:expression'],
    ['delegateExpression', 'camunda:delegateExpression'],
    ['dmn', 'camunda:decisionRef'],
  ]

  for (const [implementationType, attrName] of implementationMappings) {
    const rawValue = attrs[attrName]
    if (typeof rawValue === 'string' && rawValue.trim() !== '') {
      return {
        implementationType,
        implementation: rawValue,
      }
    }
  }

  return {}
}

function createExampleNodeSerializers(): Record<string, NodeSerializationHandler> {
  const handler: NodeSerializationHandler = {
    export: ({ bpmnData, element }) => ({
      omitBpmnKeys: [
        ...exportMappedAttributes(bpmnData, element, CAMUNDA_INLINE_ATTRIBUTE_MAPPINGS),
        ...exportMappedAttributes(bpmnData, element, EXAMPLE_INLINE_NODE_ATTRIBUTE_MAPPINGS),
        ...exportImplementationAttributes(bpmnData, element),
      ],
    }),
    import: ({ element }) => ({
      ...readMappedAttributes(element, CAMUNDA_INLINE_ATTRIBUTE_MAPPINGS),
      ...readMappedAttributes(element, EXAMPLE_INLINE_NODE_ATTRIBUTE_MAPPINGS),
      ...importImplementationAttributes(element),
    }),
  }

  return Object.fromEntries(
    Object.keys(NODE_MAPPING).map((shape) => [shape, handler]),
  )
}

function createExampleEdgeSerializers(): Record<string, EdgeSerializationHandler> {
  const handler: EdgeSerializationHandler = {
    export: ({ edgeData, element }) => ({
      omitBpmnKeys: exportMappedAttributes(edgeData, element, EXAMPLE_INLINE_EDGE_ATTRIBUTE_MAPPINGS),
    }),
    import: ({ element }) => readMappedAttributes(element, EXAMPLE_INLINE_EDGE_ATTRIBUTE_MAPPINGS),
  }

  return Object.fromEntries(
    Object.keys(EDGE_MAPPING).map((shape) => [shape, handler]),
  )
}

function withStandardExportSerialization(options: ExportBpmnOptions = {}): ExportBpmnOptions {
  const extensionProperties = options.serialization?.extensionProperties === false
    ? false
    : {
        ...DEFAULT_EXTENSION_PROPERTIES,
        ...(options.serialization?.extensionProperties ?? {}),
      }

  return {
    ...options,
    serialization: {
      ...(options.serialization ?? {}),
      extensionProperties,
      namespaces: {
        camunda: CAMUNDA_NAMESPACE_URI,
        example: EXAMPLE_NAMESPACE_URI,
        ...(options.serialization?.namespaces ?? {}),
      },
      nodeSerializers: {
        ...createExampleNodeSerializers(),
        ...(options.serialization?.nodeSerializers ?? {}),
      },
      edgeSerializers: {
        ...createExampleEdgeSerializers(),
        ...(options.serialization?.edgeSerializers ?? {}),
      },
    },
  }
}

function withStandardImportSerialization(options: ImportBpmnOptions = {}): ImportBpmnOptions {
  const extensionProperties = options.serialization?.extensionProperties === false
    ? false
    : {
        ...DEFAULT_EXTENSION_PROPERTIES,
        ...(options.serialization?.extensionProperties ?? {}),
      }

  return {
    ...options,
    serialization: {
      ...(options.serialization ?? {}),
      extensionProperties,
      namespaces: {
        camunda: CAMUNDA_NAMESPACE_URI,
        example: EXAMPLE_NAMESPACE_URI,
        ...(options.serialization?.namespaces ?? {}),
      },
      nodeSerializers: {
        ...createExampleNodeSerializers(),
        ...(options.serialization?.nodeSerializers ?? {}),
      },
      edgeSerializers: {
        ...createExampleEdgeSerializers(),
        ...(options.serialization?.edgeSerializers ?? {}),
      },
    },
  }
}

export function exportStandardBpmnXml(
  graph: Graph,
  options: ExportBpmnOptions = {},
): Promise<string> {
  return exportBpmnXml(graph, withStandardExportSerialization(options))
}

export function importExampleBpmnXml(
  graph: Graph,
  xml: string,
  options: ImportBpmnOptions = {},
): Promise<void> {
  return importBpmnXml(graph, xml, withStandardImportSerialization(options))
}

