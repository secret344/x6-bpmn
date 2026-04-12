import type { BpmnModdle, ModdleElement } from 'bpmn-moddle'

export const BPMN_XML_NAMESPACE_URI = 'http://www.omg.org/spec/BPMN/20100524/MODEL'

export type BpmnModdleCreateMode = 'create' | 'createAny'

export interface BpmnXmlNameSettings {
  /** bpmn-moddle 创建标准 BPMN 元素时使用的前缀。 */
  moddlePrefix: string
  /** 标准 BPMN 命名空间 URI。 */
  namespaceUri: string
  /** 导出 XML 时是否将 BPMN 命名空间写为默认 xmlns，从而省略 bpmn: 标签前缀。 */
  useDefaultNamespace?: boolean
  /** 原始 XML 中允许出现的标签前缀；'*' 表示接受任意前缀。 */
  acceptedTagPrefixes?: string[]
  /** 个别元素在 moddle 中的显式名称覆盖。 */
  moddleNames?: Record<string, string>
  /** 个别元素的构造模式；默认使用 moddle.create。 */
  createModes?: Record<string, BpmnModdleCreateMode>
}

export const DEFAULT_BPMN_XML_NAME_SETTINGS: BpmnXmlNameSettings = {
  moddlePrefix: 'bpmn',
  namespaceUri: BPMN_XML_NAMESPACE_URI,
  useDefaultNamespace: false,
  acceptedTagPrefixes: ['*'],
  moddleNames: {
    multipleEventDefinition: 'bpmn:multipleEventDefinition',
  },
  createModes: {
    multipleEventDefinition: 'createAny',
  },
}

function uppercaseFirst(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cloneRecord<T extends string>(value?: Record<string, T>): Record<string, T> | undefined {
  return value ? { ...value } : undefined
}

export function resolveBpmnXmlNameSettings(
  settings?: Partial<BpmnXmlNameSettings>,
): BpmnXmlNameSettings {
  const defaultAcceptedTagPrefixes = DEFAULT_BPMN_XML_NAME_SETTINGS.acceptedTagPrefixes as string[]

  return {
    ...DEFAULT_BPMN_XML_NAME_SETTINGS,
    ...settings,
    acceptedTagPrefixes: settings?.acceptedTagPrefixes
      ? [...settings.acceptedTagPrefixes]
      : [...defaultAcceptedTagPrefixes],
    moddleNames: {
      ...DEFAULT_BPMN_XML_NAME_SETTINGS.moddleNames,
      ...(settings?.moddleNames ?? {}),
    },
    createModes: {
      ...DEFAULT_BPMN_XML_NAME_SETTINGS.createModes,
      ...(settings?.createModes ?? {}),
    },
  }
}

export function cloneBpmnXmlNameSettings(
  settings?: Partial<BpmnXmlNameSettings>,
): BpmnXmlNameSettings | undefined {
  if (!settings) return undefined

  const resolved = resolveBpmnXmlNameSettings(settings)

  return {
    ...resolved,
    acceptedTagPrefixes: resolved.acceptedTagPrefixes
      ? [...resolved.acceptedTagPrefixes]
      : undefined,
    moddleNames: cloneRecord(resolved.moddleNames),
    createModes: cloneRecord(resolved.createModes),
  }
}

export function mergeBpmnXmlNameSettings(
  parent?: Partial<BpmnXmlNameSettings>,
  child?: Partial<BpmnXmlNameSettings>,
): BpmnXmlNameSettings | undefined {
  if (!parent && !child) return undefined

  const base = resolveBpmnXmlNameSettings(parent)
  if (!child) {
    return cloneBpmnXmlNameSettings(base)
  }

  const baseAcceptedTagPrefixes = base.acceptedTagPrefixes as string[]

  return {
    ...base,
    ...child,
    acceptedTagPrefixes: child.acceptedTagPrefixes
      ? [...child.acceptedTagPrefixes]
      : [...baseAcceptedTagPrefixes],
    moddleNames: {
      ...base.moddleNames,
      ...(child.moddleNames ?? {}),
    },
    createModes: {
      ...base.createModes,
      ...(child.createModes ?? {}),
    },
  }
}

export function getBpmnLocalName(name: string): string {
  if (!name) return ''

  const unqualified = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name
  return /^[A-Z]/.test(unqualified)
    ? `${unqualified.charAt(0).toLowerCase()}${unqualified.slice(1)}`
    : unqualified
}

export function getBpmnAcceptedTagPrefixPattern(
  settings?: Partial<BpmnXmlNameSettings>,
): string {
  const resolved = resolveBpmnXmlNameSettings(settings)
  const prefixes = Array.from(new Set(resolved.acceptedTagPrefixes))

  if (prefixes.includes('*')) {
    return '(?:\\w+:)?'
  }

  const explicitPrefixes = prefixes.filter((prefix) => prefix)
  const allowUnprefixed = prefixes.includes('')

  if (explicitPrefixes.length === 0) {
    return ''
  }

  const explicitPattern = explicitPrefixes.length === 1
    ? escapeRegExp(explicitPrefixes[0])
    : `(?:${explicitPrefixes.map(escapeRegExp).join('|')})`

  return allowUnprefixed ? `(?:${explicitPattern}:)?` : `${explicitPattern}:`
}

export function createBpmnOpeningTagRegex(
  localName: string,
  settings?: Partial<BpmnXmlNameSettings>,
  flags = '',
): RegExp {
  const prefixPattern = getBpmnAcceptedTagPrefixPattern(settings)
  return new RegExp(`<${prefixPattern}${escapeRegExp(localName)}\\b`, flags)
}

export function createBpmnElementTagRegex(
  localNames: string[],
  settings?: Partial<BpmnXmlNameSettings>,
  flags = 'g',
): RegExp {
  const prefixPattern = getBpmnAcceptedTagPrefixPattern(settings)
  const tagPattern = localNames.map(escapeRegExp).join('|')
  return new RegExp(
    `<${prefixPattern}(${tagPattern})\\b([^>]*)\\bid="([^"]+)"([^>]*)>([\\s\\S]*?)<\/${prefixPattern}\\1>`,
    flags,
  )
}

export function getBpmnModdleName(
  localName: string,
  settings?: Partial<BpmnXmlNameSettings>,
): string {
  const resolved = resolveBpmnXmlNameSettings(settings)
  return resolved.moddleNames?.[localName] ?? `${resolved.moddlePrefix}:${uppercaseFirst(localName)}`
}

export function createBpmnElement(
  moddle: BpmnModdle,
  localName: string,
  attrs: Record<string, unknown>,
  settings?: Partial<BpmnXmlNameSettings>,
): ModdleElement {
  const resolved = resolveBpmnXmlNameSettings(settings)
  const moddleName = getBpmnModdleName(localName, resolved)

  if (resolved.createModes?.[localName] === 'createAny') {
    return moddle.createAny(moddleName, resolved.namespaceUri, attrs) as ModdleElement
  }

  return moddle.create(moddleName, attrs)
}