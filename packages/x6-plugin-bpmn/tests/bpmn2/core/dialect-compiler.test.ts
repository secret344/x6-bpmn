/**
 * Profile 编译器 — 单元测试
 *
 * 覆盖 compileProfile 的继承链解析、层合并、默认值补齐、
 * 引用校验、$remove 语义。
 */

import { describe, it, expect, vi } from 'vitest'
import { compileProfile } from '../../../src/core/dialect/compiler'
import { ProfileRegistry } from '../../../src/core/dialect/registry'
import type { Profile, NodeRendererFactory, EdgeRendererFactory } from '../../../src/core/dialect/types'

// ============================================================================
// 辅助
// ============================================================================

const dummyNodeRenderer: NodeRendererFactory = () => ({ inherit: 'rect', width: 100, height: 60 })
const dummyEdgeRenderer: EdgeRendererFactory = () => ({ inherit: 'edge' })

function makeProfile(id: string, parent?: string, overrides?: Partial<Profile>): Profile {
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
      nodeRenderers: { task: dummyNodeRenderer },
      edgeRenderers: {},
    },
    rules: { nodeCategories: {}, connectionRules: {}, constraints: [] },
    dataModel: { fields: {}, categoryFields: {} },
    serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
    ...overrides,
  }
}

// ============================================================================
// 基本编译
// ============================================================================

describe('compileProfile — 基本编译', () => {
  it('应编译单个无父级 Profile', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('base'))
    const resolved = compileProfile('base', registry)
    expect(resolved.meta.id).toBe('base')
    expect(resolved.definitions.nodes['base-node']).toBeDefined()
  })

  it('编译结果的 meta 应来自叶 Profile', () => {
    const registry = new ProfileRegistry()
    const parent = makeProfile('parent')
    parent.meta.description = '父级描述'
    const child = makeProfile('child', 'parent')
    child.meta.description = '子级描述'
    registry.registerAll([parent, child])

    const resolved = compileProfile('child', registry)
    expect(resolved.meta.id).toBe('child')
    expect(resolved.meta.description).toBe('子级描述')
  })
})

// ============================================================================
// 继承与合并
// ============================================================================

describe('compileProfile — 继承与合并', () => {
  it('应合并父子两级节点定义', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('parent'))
    registry.register(makeProfile('child', 'parent'))

    const resolved = compileProfile('child', registry)
    expect(resolved.definitions.nodes['parent-node']).toBeDefined()
    expect(resolved.definitions.nodes['child-node']).toBeDefined()
  })

  it('应合并三级继承链', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('grandparent'))
    registry.register(makeProfile('parent', 'grandparent'))
    registry.register(makeProfile('child', 'parent'))

    const resolved = compileProfile('child', registry)
    expect(resolved.definitions.nodes['grandparent-node']).toBeDefined()
    expect(resolved.definitions.nodes['parent-node']).toBeDefined()
    expect(resolved.definitions.nodes['child-node']).toBeDefined()
  })

  it('子级应覆盖父级同名节点定义', () => {
    const registry = new ProfileRegistry()
    const parent = makeProfile('parent')
    const child = makeProfile('child', 'parent')
    // child 覆盖 parent 的节点
    child.definitions = {
      nodes: {
        'parent-node': { shape: 'overridden', category: 'event', renderer: 'task' },
      },
      edges: {},
    }
    registry.registerAll([parent, child])

    const resolved = compileProfile('child', registry)
    expect(resolved.definitions.nodes['parent-node'].shape).toBe('overridden')
    expect(resolved.definitions.nodes['parent-node'].category).toBe('event')
  })

  it('$remove 应从合并后删除指定节点', () => {
    const registry = new ProfileRegistry()
    const parent = makeProfile('parent')
    const child: Profile = {
      meta: { id: 'child', name: 'child', parent: 'parent' },
      definitions: {
        nodes: { 'parent-node': { $remove: true } } as any,
        edges: {},
      },
    }
    registry.registerAll([parent, child])

    const resolved = compileProfile('child', registry)
    expect('parent-node' in resolved.definitions.nodes).toBe(false)
  })
})

// ============================================================================
// 默认 availability 补齐
// ============================================================================

describe('compileProfile — availability 默认值', () => {
  it('未声明的节点 availability 应默认为 enabled', () => {
    const registry = new ProfileRegistry()
    const profile = makeProfile('base')
    // 不设置 availability
    profile.availability = undefined
    registry.register(profile)

    const resolved = compileProfile('base', registry)
    expect(resolved.availability.nodes['base-node']).toBe('enabled')
  })

  it('显式设置的 availability 应保留', () => {
    const registry = new ProfileRegistry()
    const profile = makeProfile('base')
    profile.availability = { nodes: { 'base-node': 'disabled' }, edges: {} }
    registry.register(profile)

    const resolved = compileProfile('base', registry)
    expect(resolved.availability.nodes['base-node']).toBe('disabled')
  })
})

// ============================================================================
// 引用校验
// ============================================================================

describe('compileProfile — 引用校验', () => {
  it('缺失的渲染器应发出 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {
          myNode: { shape: 'test-shape', category: 'task', renderer: 'nonexistentRenderer' },
        },
        edges: {},
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: { task: dummyNodeRenderer }, // 注册了 'task'，但 myNode 引用 'nonexistentRenderer'
        edgeRenderers: {},
      },
    }
    registry.register(profile)
    compileProfile('test', registry)

    expect(warnSpy).toHaveBeenCalled()
    const warnMsg = warnSpy.mock.calls[0][0]
    expect(warnMsg).toContain('nonexistentRenderer')

    warnSpy.mockRestore()
  })

  it('禁用的节点不应校验渲染器', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {
          myNode: { shape: 'test-shape', category: 'task', renderer: 'nonexistent' },
        },
        edges: {},
      },
      availability: {
        nodes: { myNode: 'disabled' },
        edges: {},
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: { task: dummyNodeRenderer },
        edgeRenderers: {},
      },
    }
    registry.register(profile)
    compileProfile('test', registry)

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ============================================================================
// 异常场景
// ============================================================================

describe('compileProfile — 异常场景', () => {
  it('编译不存在的 Profile 应抛出异常', () => {
    const registry = new ProfileRegistry()
    expect(() => compileProfile('nonexistent', registry)).toThrow('not found')
  })

  it('父级 Profile 未注册应抛出异常', () => {
    const registry = new ProfileRegistry()
    const child = makeProfile('child', 'missing-parent')
    registry.register(child)
    expect(() => compileProfile('child', registry)).toThrow('not found')
  })

  it('循环继承应抛出异常', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('a', 'b'))
    registry.register(makeProfile('b', 'a'))
    expect(() => compileProfile('a', registry)).toThrow('Circular')
  })

  it('自引用继承应抛出异常', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('self', 'self'))
    expect(() => compileProfile('self', registry)).toThrow('Circular')
  })
})

// ============================================================================
// 边界场景
// ============================================================================

describe('compileProfile — 边界场景', () => {
  it('无 definitions 的子 Profile 应继承父级 definitions', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('parent'))
    const child: Profile = {
      meta: { id: 'child', name: 'child', parent: 'parent' },
    }
    registry.register(child)

    const resolved = compileProfile('child', registry)
    expect(resolved.definitions.nodes['parent-node']).toBeDefined()
  })

  it('无 rendering 的 Profile 不应校验渲染器引用', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {
          myNode: { shape: 'test', category: 'task', renderer: 'someRenderer' },
        },
        edges: {},
      },
      // 不设置 rendering — nodeRenderers 为空
    }
    registry.register(profile)
    compileProfile('test', registry)

    // nodeRenderers 为空时不应触发 warn
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('边定义中缺失的渲染器也应发出 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {},
        edges: {
          myEdge: { shape: 'test-edge', category: 'seq', renderer: 'missingEdgeRenderer' },
        },
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: {},
        edgeRenderers: { seq: dummyEdgeRenderer }, // 注册了 'seq'，但 myEdge 引用 'missingEdgeRenderer'
      },
    }
    registry.register(profile)
    compileProfile('test', registry)

    expect(warnSpy).toHaveBeenCalled()
    const warnMsg = warnSpy.mock.calls[0][0]
    expect(warnMsg).toContain('missingEdgeRenderer')
    warnSpy.mockRestore()
  })

  it('edge 的 availability 默认值应补齐为 enabled', () => {
    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {},
        edges: {
          myEdge: { shape: 'e', category: 'seq', renderer: 'seq' },
        },
      },
    }
    registry.register(profile)
    const resolved = compileProfile('test', registry)
    expect(resolved.availability.edges.myEdge).toBe('enabled')
  })

  it('禁用的边不应校验渲染器引用', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {},
        edges: {
          myEdge: { shape: 'e', category: 'seq', renderer: 'nonexistentEdgeRenderer' },
        },
      },
      availability: {
        nodes: {},
        edges: { myEdge: 'disabled' },
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: {},
        edgeRenderers: { seq: dummyEdgeRenderer },
      },
    }
    registry.register(profile)
    compileProfile('test', registry)

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('edgeRenderers 为空时不应校验边渲染器引用', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const registry = new ProfileRegistry()
    const profile: Profile = {
      meta: { id: 'test', name: 'test' },
      definitions: {
        nodes: {},
        edges: {
          myEdge: { shape: 'e', category: 'seq', renderer: 'someRenderer' },
        },
      },
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: {},
        edgeRenderers: {},
      },
    }
    registry.register(profile)
    compileProfile('test', registry)

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('深度继承（5 级）应正确合并', () => {
    const registry = new ProfileRegistry()
    registry.register(makeProfile('L1'))
    registry.register(makeProfile('L2', 'L1'))
    registry.register(makeProfile('L3', 'L2'))
    registry.register(makeProfile('L4', 'L3'))
    registry.register(makeProfile('L5', 'L4'))

    const resolved = compileProfile('L5', registry)
    expect(resolved.definitions.nodes['L1-node']).toBeDefined()
    expect(resolved.definitions.nodes['L5-node']).toBeDefined()
    expect(resolved.meta.id).toBe('L5')
  })
})
