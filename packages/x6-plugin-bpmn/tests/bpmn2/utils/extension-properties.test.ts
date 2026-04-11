import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EXTENSION_PROPERTY_NAMESPACE_URI,
  DEFAULT_EXTENSION_PROPERTY_PREFIX,
  getModdleElementLocalName,
  getModdleElementNamespaceUri,
  getQualifiedExtensionPropertyContainerName,
  getQualifiedExtensionPropertyItemName,
  isExtensionPropertyContainerElement,
  isExtensionPropertyItemElement,
  mergeExtensionPropertySerialization,
  resolveExtensionPropertySerialization,
} from '../../../src/utils/extension-properties'

describe('extension-properties utils', () => {
  it('应支持从显式配置解析扩展属性命名空间', () => {
    const resolved = resolveExtensionPropertySerialization({
      prefix: 'custom',
      namespaceUri: 'http://example.com/custom',
      containerLocalName: 'meta',
      propertyLocalName: 'entry',
    })

    expect(resolved).not.toBeNull()
    expect(resolved).toEqual({
      prefix: 'custom',
      namespaceUri: 'http://example.com/custom',
      containerLocalName: 'meta',
      propertyLocalName: 'entry',
    })
    expect(getQualifiedExtensionPropertyContainerName(resolved)).toBe('custom:meta')
    expect(getQualifiedExtensionPropertyItemName(resolved)).toBe('custom:entry')
  })

  it('应支持从 namespaces 回推命名空间 URI 与前缀', () => {
    const resolvedFromPrefix = resolveExtensionPropertySerialization(
      { prefix: 'vendor' },
      { vendor: 'http://example.com/vendor' },
    )
    const resolvedFromUri = resolveExtensionPropertySerialization(
      { namespaceUri: 'http://example.com/vendor' },
      { vendor: 'http://example.com/vendor' },
    )

    expect(resolvedFromPrefix.namespaceUri).toBe('http://example.com/vendor')
    expect(resolvedFromUri.prefix).toBe('vendor')
  })

  it('应支持显式关闭通用扩展属性序列化', () => {
    expect(resolveExtensionPropertySerialization(false)).toBeNull()
    expect(mergeExtensionPropertySerialization({ prefix: 'custom' }, false)).toBe(false)
    expect(mergeExtensionPropertySerialization(false, { namespaceUri: 'http://example.com/custom' })).toEqual({
      namespaceUri: 'http://example.com/custom',
    })
  })

  it('前缀未在 namespaces 中声明时应回退到默认 URI，但保留显式前缀', () => {
    const resolved = resolveExtensionPropertySerialization({ prefix: 'customized' })

    expect(resolved.prefix).toBe('customized')
    expect(resolved.namespaceUri).toBe(DEFAULT_EXTENSION_PROPERTY_NAMESPACE_URI)
  })

  it('缺省配置时应回退到默认扩展命名空间', () => {
    const resolved = resolveExtensionPropertySerialization()

    expect(resolved.prefix).toBe(DEFAULT_EXTENSION_PROPERTY_PREFIX)
    expect(resolved.namespaceUri).toBe(DEFAULT_EXTENSION_PROPERTY_NAMESPACE_URI)
    expect(resolved.containerLocalName).toBe('properties')
    expect(resolved.propertyLocalName).toBe('property')
  })

  it('不应允许将通用扩展属性配置到 BPMN 主命名空间', () => {
    expect(() => resolveExtensionPropertySerialization({
      prefix: 'bpmn',
      namespaceUri: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    })).toThrow('extensionProperties 不能使用 BPMN 2.0 主命名空间')

    expect(() => resolveExtensionPropertySerialization(
      { prefix: 'bpmn' },
      { bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL' },
    )).toThrow('extensionProperties 不能使用 BPMN 2.0 主命名空间')
  })

  it('应优先读取 moddle 元素上的命名空间 URI，并在缺失时回退到前缀映射', () => {
    const descriptorElement = {
      $type: 'alias:properties',
      $descriptor: { ns: { uri: 'http://example.com/custom' } },
    } as any
    const prefixedElement = { $type: 'vendor:property' } as any
    const plainElement = { $type: 'property' } as any

    expect(getModdleElementNamespaceUri(descriptorElement)).toBe('http://example.com/custom')
    expect(getModdleElementNamespaceUri(prefixedElement, { vendor: 'http://example.com/vendor' })).toBe('http://example.com/vendor')
    expect(getModdleElementNamespaceUri(plainElement)).toBeUndefined()
    expect(getModdleElementLocalName(prefixedElement)).toBe('property')
    expect(getModdleElementLocalName(plainElement)).toBe('property')
  })

  it('应按命名空间与本地名识别扩展属性容器和条目', () => {
    const resolved = resolveExtensionPropertySerialization({
      prefix: 'custom',
      namespaceUri: 'http://example.com/custom',
    })

    const containerWithDescriptor = {
      $type: 'alias:properties',
      $descriptor: { ns: { uri: 'http://example.com/custom' } },
    } as any
    const itemWithPrefixFallback = { $type: 'custom:property' } as any
    const itemWithBarePrefixFallback = { $type: 'custom:property' } as any
    const wrongNamespaceContainer = {
      $type: 'custom:properties',
      $descriptor: { ns: { uri: 'http://example.com/other' } },
    } as any
    const wrongLocalNameItem = { $type: 'custom:meta' } as any
    const wrongPrefixItem = { $type: 'other:property' } as any

    expect(isExtensionPropertyContainerElement(containerWithDescriptor, resolved)).toBe(true)
    expect(isExtensionPropertyItemElement(itemWithBarePrefixFallback, resolved)).toBe(true)
    expect(isExtensionPropertyItemElement(itemWithPrefixFallback, resolved, { custom: 'http://example.com/custom' })).toBe(true)
    expect(isExtensionPropertyContainerElement(wrongNamespaceContainer, resolved)).toBe(false)
    expect(isExtensionPropertyItemElement(wrongLocalNameItem, resolved, { custom: 'http://example.com/custom' })).toBe(false)
    expect(isExtensionPropertyItemElement(wrongPrefixItem, resolved, { other: 'http://example.com/other' })).toBe(false)
  })
})