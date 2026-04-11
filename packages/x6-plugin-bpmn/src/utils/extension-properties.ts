import type { ModdleElement } from 'bpmn-moddle'
import type { ExtensionPropertySerialization } from '../core/dialect/types'

const BPMN_MODEL_NAMESPACE_URI = 'http://www.omg.org/spec/BPMN/20100524/MODEL'

export const DEFAULT_EXTENSION_PROPERTY_NAMESPACE_URI = 'http://x6-bpmn2.io/schema'
export const DEFAULT_EXTENSION_PROPERTY_PREFIX = 'modeler'

const DEFAULT_EXTENSION_CONTAINER_LOCAL_NAME = 'properties'
const DEFAULT_EXTENSION_PROPERTY_LOCAL_NAME = 'property'

export interface ResolvedExtensionPropertySerialization {
  prefix: string
  namespaceUri: string
  containerLocalName: string
  propertyLocalName: string
}

export type ExtensionPropertySerializationSetting = ExtensionPropertySerialization | false | undefined

function getNamespacePrefixByUri(
  namespaces: Record<string, string>,
  namespaceUri: string,
): string | undefined {
  const matchedEntry = Object.entries(namespaces).find(([, uri]) => uri === namespaceUri)
  return matchedEntry?.[0]
}

export function resolveExtensionPropertySerialization(
  settings?: ExtensionPropertySerialization | false,
  namespaces: Record<string, string> = {},
): ResolvedExtensionPropertySerialization | null {
  if (settings === false) {
    return null
  }

  const namespaceUri = settings?.namespaceUri
    ?? (settings?.prefix ? namespaces[settings.prefix] : undefined)
    ?? namespaces[DEFAULT_EXTENSION_PROPERTY_PREFIX]
    ?? DEFAULT_EXTENSION_PROPERTY_NAMESPACE_URI

  const prefix = settings?.prefix
    ?? getNamespacePrefixByUri(namespaces, namespaceUri)
    ?? DEFAULT_EXTENSION_PROPERTY_PREFIX

  if (namespaceUri === BPMN_MODEL_NAMESPACE_URI) {
    throw new Error('extensionProperties 不能使用 BPMN 2.0 主命名空间；请改用非 BPMN 扩展命名空间')
  }

  return {
    prefix,
    namespaceUri,
    containerLocalName: settings?.containerLocalName ?? DEFAULT_EXTENSION_CONTAINER_LOCAL_NAME,
    propertyLocalName: settings?.propertyLocalName ?? DEFAULT_EXTENSION_PROPERTY_LOCAL_NAME,
  }
}

export function mergeExtensionPropertySerialization(
  base?: ExtensionPropertySerializationSetting,
  override?: ExtensionPropertySerializationSetting,
): ExtensionPropertySerializationSetting {
  if (override === false) {
    return false
  }

  if (base === false) {
    return override
  }

  if (base || override) {
    return {
      ...(base ?? {}),
      ...(override ?? {}),
    }
  }

  return undefined
}

export function getQualifiedExtensionPropertyContainerName(
  settings: ResolvedExtensionPropertySerialization,
): string {
  return `${settings.prefix}:${settings.containerLocalName}`
}

export function getQualifiedExtensionPropertyItemName(
  settings: ResolvedExtensionPropertySerialization,
): string {
  return `${settings.prefix}:${settings.propertyLocalName}`
}

export function getModdleElementTypeName(element: ModdleElement): string {
  /* istanbul ignore next -- 防御性回退，合法 moddle 元素都会提供 $type */
  return String(element.$type || (element as { name?: string }).name || '')
}

function getModdleElementPrefix(element: ModdleElement): string {
  const typeName = getModdleElementTypeName(element)
  return typeName.includes(':') ? typeName.slice(0, typeName.indexOf(':')) : ''
}

export function getModdleElementLocalName(element: ModdleElement): string {
  const typeName = getModdleElementTypeName(element)
  return typeName.includes(':') ? typeName.slice(typeName.indexOf(':') + 1) : typeName
}

export function getModdleElementNamespaceUri(
  element: ModdleElement,
  namespaces: Record<string, string> = {},
): string | undefined {
  const descriptorUri = (element as { $descriptor?: { ns?: { uri?: string } } }).$descriptor?.ns?.uri
  if (typeof descriptorUri === 'string' && descriptorUri) {
    return descriptorUri
  }

  const prefix = getModdleElementPrefix(element)
  return prefix ? namespaces[prefix] : undefined
}

function isMatchingExtensionNamespace(
  element: ModdleElement,
  settings: ResolvedExtensionPropertySerialization,
  namespaces: Record<string, string>,
): boolean {
  const namespaceUri = getModdleElementNamespaceUri(element, namespaces)
  if (namespaceUri) {
    return namespaceUri === settings.namespaceUri
  }

  return getModdleElementPrefix(element) === settings.prefix
}

export function isExtensionPropertyContainerElement(
  element: ModdleElement,
  settings: ResolvedExtensionPropertySerialization,
  namespaces: Record<string, string> = {},
): boolean {
  return getModdleElementLocalName(element) === settings.containerLocalName
    && isMatchingExtensionNamespace(element, settings, namespaces)
}

export function isExtensionPropertyItemElement(
  element: ModdleElement,
  settings: ResolvedExtensionPropertySerialization,
  namespaces: Record<string, string> = {},
): boolean {
  return getModdleElementLocalName(element) === settings.propertyLocalName
    && isMatchingExtensionNamespace(element, settings, namespaces)
}