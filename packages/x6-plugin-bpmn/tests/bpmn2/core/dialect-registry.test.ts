/**
 * ProfileRegistry — 单元测试
 *
 * 覆盖注册、查询、编译、缓存失效、继承链、循环检测。
 */

import { describe, it, expect } from 'vitest'
import { ProfileRegistry, createProfileRegistry } from '../../../src/core/dialect/registry'
import type { Profile } from '../../../src/core/dialect/types'

// ============================================================================
// 辅助工厂
// ============================================================================

function createMinimalProfile(id: string, parent?: string): Profile {
  return {
    meta: { id, name: id, parent },
    definitions: {
      nodes: {
        [`${id}-node`]: { shape: `${id}-shape`, category: 'task', renderer: 'task' },
      },
      edges: {},
    },
    rendering: {
      theme: { colors: {}, icons: {} },
      nodeRenderers: { task: () => ({ inherit: 'rect', width: 100, height: 60 }) },
      edgeRenderers: {},
    },
    rules: { nodeCategories: {}, connectionRules: {}, constraints: [] },
    dataModel: { fields: {}, categoryFields: {} },
    serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
  }
}

// ============================================================================
// 基本操作
// ============================================================================

describe('ProfileRegistry — 基本操作', () => {
  it('createProfileRegistry 应返回 ProfileRegistry 实例', () => {
    const registry = createProfileRegistry()
    expect(registry).toBeInstanceOf(ProfileRegistry)
  })

  it('register 后 has 应返回 true', () => {
    const registry = new ProfileRegistry()
    const profile = createMinimalProfile('test')
    registry.register(profile)
    expect(registry.has('test')).toBe(true)
  })

  it('未注册的 ID has 应返回 false', () => {
    const registry = new ProfileRegistry()
    expect(registry.has('unknown')).toBe(false)
  })

  it('get 应返回已注册的原始 Profile', () => {
    const registry = new ProfileRegistry()
    const profile = createMinimalProfile('test')
    registry.register(profile)
    expect(registry.get('test')).toBe(profile)
  })

  it('get 未注册的 ID 应返回 undefined', () => {
    const registry = new ProfileRegistry()
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('list 应返回所有注册 ID', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('a'))
    registry.register(createMinimalProfile('b'))
    expect(registry.list().sort()).toEqual(['a', 'b'])
  })

  it('registerAll 应批量注册', () => {
    const registry = new ProfileRegistry()
    registry.registerAll([createMinimalProfile('a'), createMinimalProfile('b')])
    expect(registry.has('a')).toBe(true)
    expect(registry.has('b')).toBe(true)
    expect(registry.list().length).toBe(2)
  })
})

// ============================================================================
// 编译
// ============================================================================

describe('ProfileRegistry — 编译', () => {
  it('compile 应返回 ResolvedProfile', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('base'))
    const resolved = registry.compile('base')
    expect(resolved.meta.id).toBe('base')
    expect(resolved.definitions.nodes['base-node']).toBeDefined()
  })

  it('compile 结果应被缓存', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('base'))
    const first = registry.compile('base')
    const second = registry.compile('base')
    expect(first).toBe(second) // 同一引用
  })

  it('重新注册后缓存应失效', () => {
    const registry = new ProfileRegistry()
    const profile = createMinimalProfile('base')
    registry.register(profile)
    const first = registry.compile('base')

    const updated = createMinimalProfile('base')
    registry.register(updated)
    const second = registry.compile('base')
    expect(first).not.toBe(second)
  })

  it('父级重新注册后子级缓存应级联失效', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('parent'))
    registry.register(createMinimalProfile('child', 'parent'))

    const childResolved1 = registry.compile('child')

    // 重新注册父级
    registry.register(createMinimalProfile('parent'))
    const childResolved2 = registry.compile('child')
    expect(childResolved1).not.toBe(childResolved2)
  })
})

// ============================================================================
// 继承链
// ============================================================================

describe('ProfileRegistry — 继承链', () => {
  it('无父级应返回单元素链', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('root'))
    expect(registry.getInheritanceChain('root')).toEqual(['root'])
  })

  it('应按根到叶返回继承链', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('grandparent'))
    registry.register(createMinimalProfile('parent', 'grandparent'))
    registry.register(createMinimalProfile('child', 'parent'))
    expect(registry.getInheritanceChain('child')).toEqual(['grandparent', 'parent', 'child'])
  })

  it('循环继承应抛出异常', () => {
    const registry = new ProfileRegistry()
    const a = createMinimalProfile('a', 'b')
    const b = createMinimalProfile('b', 'a')
    registry.register(a)
    registry.register(b)
    expect(() => registry.getInheritanceChain('a')).toThrow('Circular inheritance')
  })

  it('自引用应抛出循环检测异常', () => {
    const registry = new ProfileRegistry()
    const self = createMinimalProfile('self', 'self')
    registry.register(self)
    expect(() => registry.getInheritanceChain('self')).toThrow('Circular inheritance')
  })

  it('未注册的 ID 应返回含该 ID 的链', () => {
    const registry = new ProfileRegistry()
    // 未注册也能返回自身（getInheritanceChain 只遍历已有的 profiles）
    const chain = registry.getInheritanceChain('unknown')
    expect(chain).toEqual(['unknown'])
  })
})

// ============================================================================
// 异常场景
// ============================================================================

describe('ProfileRegistry — 异常场景', () => {
  it('compile 未注册的 ID 应抛出异常', () => {
    const registry = new ProfileRegistry()
    expect(() => registry.compile('nonexistent')).toThrow()
  })

  it('重复注册相同 ID 应覆盖（不抛出）', () => {
    const registry = new ProfileRegistry()
    const profile1 = createMinimalProfile('dup')
    const profile2 = createMinimalProfile('dup')
    registry.register(profile1)
    registry.register(profile2)
    expect(registry.get('dup')).toBe(profile2)
  })

  it('registerAll 空数组应不报错', () => {
    const registry = new ProfileRegistry()
    registry.registerAll([])
    expect(registry.list().length).toBe(0)
  })

  it('list 空注册表应返回空数组', () => {
    const registry = new ProfileRegistry()
    expect(registry.list()).toEqual([])
  })
})

// ============================================================================
// 缓存一致性
// ============================================================================

describe('ProfileRegistry — 缓存一致性', () => {
  it('兄弟 profile 互不影响缓存', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('parent'))
    registry.register(createMinimalProfile('childA', 'parent'))
    registry.register(createMinimalProfile('childB', 'parent'))

    const resolvedA = registry.compile('childA')
    const resolvedB = registry.compile('childB')
    expect(resolvedA).not.toBe(resolvedB)
    expect(resolvedA.meta.id).toBe('childA')
    expect(resolvedB.meta.id).toBe('childB')
  })

  it('多次编译不同 profile 不会互相干扰', () => {
    const registry = new ProfileRegistry()
    registry.register(createMinimalProfile('a'))
    registry.register(createMinimalProfile('b'))

    const ra = registry.compile('a')
    const rb = registry.compile('b')
    const ra2 = registry.compile('a')

    expect(ra).toBe(ra2) // 缓存命中
    expect(ra).not.toBe(rb)
  })
})
