/**
 * 方言合并工具 — 单元测试
 *
 * 覆盖 mergeRecords、各层合并函数、$remove 删除语义、
 * 约束去重、categoryFields 去重、mergeProfileLayers 整体合并。
 */

import { describe, it, expect } from 'vitest'
import {
  mergeRecords,
  mergeDefinitions,
  mergeAvailability,
  mergeRendering,
  mergeRules,
  mergeDataModel,
  mergeSerialization,
  mergeProfileLayers,
} from '../../../src/core/dialect/merge'
import { DEFAULT_BPMN_XML_NAME_SETTINGS } from '../../../src/utils/bpmn-xml-names'
import type {
  DefinitionsSet,
  AvailabilitySet,
  RenderingSet,
  RuleSet,
  DataModelSet,
  SerializationSet,
  Profile,
  ConstraintRule,
  NodeRendererFactory,
  EdgeRendererFactory,
} from '../../../src/core/dialect/types'

// ============================================================================
// mergeRecords
// ============================================================================

describe('mergeRecords', () => {
  it('应将子记录合并到父记录', () => {
    const parent = { a: 1, b: 2 }
    const child = { b: 3, c: 4 }
    const result = mergeRecords(parent, child)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('不应修改原始的父记录', () => {
    const parent = { a: 1, b: 2 }
    const child = { b: 3 }
    mergeRecords(parent, child)
    expect(parent).toEqual({ a: 1, b: 2 })
  })

  it('应处理 $remove 删除语义', () => {
    const parent = { a: 1, b: 2, c: 3 }
    const child = { b: { $remove: true } as any, d: 4 }
    const result = mergeRecords(parent, child)
    expect(result).toEqual({ a: 1, c: 3, d: 4 })
    expect('b' in result).toBe(false)
  })

  it('应处理空父级', () => {
    const result = mergeRecords({}, { a: 1 })
    expect(result).toEqual({ a: 1 })
  })

  it('应处理空子级', () => {
    const result = mergeRecords({ a: 1 }, {})
    expect(result).toEqual({ a: 1 })
  })

  it('$remove 不存在的 key 应无副作用', () => {
    const parent = { a: 1 }
    const child = { nonexistent: { $remove: true } as any }
    const result = mergeRecords(parent, child)
    expect(result).toEqual({ a: 1 })
  })
})

// ============================================================================
// mergeDefinitions
// ============================================================================

describe('mergeDefinitions', () => {
  const parentDef: DefinitionsSet = {
    nodes: {
      task: { shape: 'bpmn-task', category: 'task', renderer: 'task' },
      gateway: { shape: 'bpmn-gateway', category: 'gateway', renderer: 'gateway' },
    },
    edges: {
      seq: { shape: 'bpmn-seq', category: 'sequenceFlow', renderer: 'seq' },
    },
  }

  it('应合并子节点定义', () => {
    const child: Partial<DefinitionsSet> = {
      nodes: {
        newNode: { shape: 'bpmn-new', category: 'task', renderer: 'task' },
      },
    }
    const result = mergeDefinitions(parentDef, child)
    expect(Object.keys(result.nodes)).toContain('newNode')
    expect(Object.keys(result.nodes)).toContain('task')
    expect(result.edges).toEqual(parentDef.edges)
  })

  it('应用子定义覆盖父定义', () => {
    const child: Partial<DefinitionsSet> = {
      nodes: {
        task: { shape: 'bpmn-task-v2', category: 'task', renderer: 'taskV2' },
      },
    }
    const result = mergeDefinitions(parentDef, child)
    expect(result.nodes.task.shape).toBe('bpmn-task-v2')
    expect(result.nodes.task.renderer).toBe('taskV2')
  })

  it('应通过 $remove 删除父级节点定义', () => {
    const child: Partial<DefinitionsSet> = {
      nodes: { gateway: { $remove: true } } as any,
    }
    const result = mergeDefinitions(parentDef, child)
    expect('gateway' in result.nodes).toBe(false)
    expect('task' in result.nodes).toBe(true)
  })

  it('子级无 edges 时应浅拷贝父级 edges', () => {
    const child: Partial<DefinitionsSet> = { nodes: {} }
    const result = mergeDefinitions(parentDef, child)
    expect(result.edges).toEqual(parentDef.edges)
    expect(result.edges).not.toBe(parentDef.edges) // 浅拷贝
  })
})

// ============================================================================
// mergeAvailability
// ============================================================================

describe('mergeAvailability', () => {
  const parent: AvailabilitySet = {
    nodes: { task: 'enabled', gateway: 'enabled' },
    edges: { seq: 'enabled' },
  }

  it('应用子级覆盖可用状态', () => {
    const child: Partial<AvailabilitySet> = {
      nodes: { task: 'disabled' },
    }
    const result = mergeAvailability(parent, child)
    expect(result.nodes.task).toBe('disabled')
    expect(result.nodes.gateway).toBe('enabled')
  })

  it('应新增子级可用状态', () => {
    const child: Partial<AvailabilitySet> = {
      nodes: { newNode: 'experimental' },
    }
    const result = mergeAvailability(parent, child)
    expect(result.nodes.newNode).toBe('experimental')
  })
})

// ============================================================================
// mergeRendering
// ============================================================================

describe('mergeRendering', () => {
  const dummyRenderer: NodeRendererFactory = () => ({ inherit: 'rect', width: 100, height: 60 })
  const dummyEdgeRenderer: EdgeRendererFactory = () => ({ inherit: 'edge' })

  const parent: RenderingSet = {
    theme: {
      colors: { primary: '#000', secondary: '#ccc' },
      icons: { user: 'M 0 0' },
    },
    nodeRenderers: { task: dummyRenderer },
    edgeRenderers: { seq: dummyEdgeRenderer },
  }

  it('应合并主题颜色', () => {
    const child: Partial<RenderingSet> = {
      theme: { colors: { primary: '#fff', tertiary: '#aaa' }, icons: {} },
    }
    const result = mergeRendering(parent, child)
    expect(result.theme.colors.primary).toBe('#fff')
    expect(result.theme.colors.secondary).toBe('#ccc')
    expect(result.theme.colors.tertiary).toBe('#aaa')
  })

  it('应合并渲染器', () => {
    const newRenderer: NodeRendererFactory = () => ({ inherit: 'circle' })
    const child: Partial<RenderingSet> = {
      nodeRenderers: { gateway: newRenderer },
    }
    const result = mergeRendering(parent, child)
    expect(result.nodeRenderers.task).toBe(dummyRenderer)
    expect(result.nodeRenderers.gateway).toBe(newRenderer)
  })

  it('无子级 theme 时应拷贝父级 theme', () => {
    const result = mergeRendering(parent, {})
    expect(result.theme.colors).toEqual(parent.theme.colors)
    expect(result.theme.colors).not.toBe(parent.theme.colors)
  })
})

// ============================================================================
// mergeRules
// ============================================================================

describe('mergeRules', () => {
  const parentRule: ConstraintRule = {
    id: 'rule-1',
    description: '父级规则',
    validate: () => true,
  }

  const parent: RuleSet = {
    nodeCategories: { task: 'task' as any, gateway: 'gateway' as any },
    connectionRules: { task: { allowedTargets: ['gateway'] } as any },
    constraints: [parentRule],
  }

  it('应合并 nodeCategories', () => {
    const child: Partial<RuleSet> = {
      nodeCategories: { newCat: 'event' as any },
    }
    const result = mergeRules(parent, child)
    expect(result.nodeCategories.newCat).toBe('event')
    expect(result.nodeCategories.task).toBe('task')
  })

  it('应按 ID 去重约束规则（子级覆盖父级）', () => {
    const childRule: ConstraintRule = {
      id: 'rule-1',
      description: '子级覆盖规则',
      validate: () => '失败',
    }
    const child: Partial<RuleSet> = {
      constraints: [childRule],
    }
    const result = mergeRules(parent, child)
    expect(result.constraints.length).toBe(1)
    expect(result.constraints[0].description).toBe('子级覆盖规则')
  })

  it('应合并新约束规则', () => {
    const newRule: ConstraintRule = {
      id: 'rule-2',
      description: '新规则',
      validate: () => true,
    }
    const child: Partial<RuleSet> = {
      constraints: [newRule],
    }
    const result = mergeRules(parent, child)
    expect(result.constraints.length).toBe(2)
  })
})

// ============================================================================
// mergeDataModel
// ============================================================================

describe('mergeDataModel', () => {
  const parent: DataModelSet = {
    fields: {
      assignee: { scope: 'node', defaultValue: '' },
      dueDate: { scope: 'node', defaultValue: null },
    },
    categoryFields: {
      task: ['assignee', 'dueDate'],
    },
  }

  it('应合并字段定义', () => {
    const child: Partial<DataModelSet> = {
      fields: { priority: { scope: 'node', defaultValue: 'medium' } },
    }
    const result = mergeDataModel(parent, child)
    expect(result.fields.priority).toBeDefined()
    expect(result.fields.assignee).toBeDefined()
  })

  it('应通过 $remove 删除字段', () => {
    const child: Partial<DataModelSet> = {
      fields: { dueDate: { $remove: true } } as any,
    }
    const result = mergeDataModel(parent, child)
    expect('dueDate' in result.fields).toBe(false)
    expect('assignee' in result.fields).toBe(true)
  })

  it('应合并 categoryFields 并去重', () => {
    const child: Partial<DataModelSet> = {
      categoryFields: {
        task: ['assignee', 'priority'], // assignee 与父级重复
        event: ['eventType'],
      },
    }
    const result = mergeDataModel(parent, child)
    expect(result.categoryFields.task).toContain('assignee')
    expect(result.categoryFields.task).toContain('dueDate')
    expect(result.categoryFields.task).toContain('priority')
    // assignee 不应重复
    expect(result.categoryFields.task.filter((f) => f === 'assignee').length).toBe(1)
    expect(result.categoryFields.event).toEqual(['eventType'])
  })

  it('应合并 shapeFields', () => {
    const child: Partial<DataModelSet> = {
      shapeFields: { 'bpmn-user-task': ['assignee', 'dueDate'] },
    }
    const result = mergeDataModel(parent, child)
    expect(result.shapeFields?.['bpmn-user-task']).toEqual(['assignee', 'dueDate'])
  })
})

// ============================================================================
// mergeSerialization
// ============================================================================

describe('mergeSerialization', () => {
  const parent: SerializationSet = {
    namespaces: { bpmn: 'http://bpmn.io' },
    xmlNames: DEFAULT_BPMN_XML_NAME_SETTINGS,
    nodeMapping: { task: { tag: 'bpmn:task' } as any },
    edgeMapping: { seq: { tag: 'bpmn:sequenceFlow' } as any },
  }

  it('应合并命名空间', () => {
    const child: Partial<SerializationSet> = {
      namespaces: { smart: 'http://smart.io' },
    }
    const result = mergeSerialization(parent, child)
    expect(result.namespaces.bpmn).toBe('http://bpmn.io')
    expect(result.namespaces.smart).toBe('http://smart.io')
  })

  it('应合并节点映射', () => {
    const child: Partial<SerializationSet> = {
      nodeMapping: { newNode: { tag: 'bpmn:serviceTask' } as any },
    }
    const result = mergeSerialization(parent, child)
    expect(result.nodeMapping.task).toBeDefined()
    expect(result.nodeMapping.newNode).toBeDefined()
  })

  it('应支持 $remove 删除映射', () => {
    const child: Partial<SerializationSet> = {
      edgeMapping: { seq: { $remove: true } } as any,
    }
    const result = mergeSerialization(parent, child)
    expect('seq' in result.edgeMapping).toBe(false)
  })

  it('应合并 xmlNames 的前缀与特殊构造配置', () => {
    const child: Partial<SerializationSet> = {
      xmlNames: {
        acceptedTagPrefixes: ['', 'flow'],
        createModes: { formalExpression: 'create' },
      },
    }
    const result = mergeSerialization(parent, child)
    expect(result.xmlNames?.moddlePrefix).toBe('bpmn')
    expect(result.xmlNames?.acceptedTagPrefixes).toEqual(['', 'flow'])
    expect(result.xmlNames?.createModes?.multipleEventDefinition).toBe('createAny')
    expect(result.xmlNames?.createModes?.formalExpression).toBe('create')
  })
})

// ============================================================================
// mergeProfileLayers（完整 profile 合并）
// ============================================================================

describe('mergeProfileLayers', () => {
  it('应完整合并所有六层配置', () => {
    const parent = {
      definitions: { nodes: { a: { shape: 'a', category: 'task', renderer: 'task' } }, edges: {} } as DefinitionsSet,
      availability: { nodes: { a: 'enabled' as const }, edges: {} } as AvailabilitySet,
      rendering: {
        theme: { colors: {}, icons: {} },
        nodeRenderers: {},
        edgeRenderers: {},
      } as RenderingSet,
      rules: { nodeCategories: {}, connectionRules: {}, constraints: [] } as RuleSet,
      dataModel: { fields: {}, categoryFields: {} } as DataModelSet,
      serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} } as SerializationSet,
    }

    const child: Profile = {
      meta: { id: 'child', name: 'Child', parent: 'parent' },
      definitions: {
        nodes: { b: { shape: 'b', category: 'event', renderer: 'event' } },
      },
      availability: { nodes: { a: 'disabled' } },
    }

    const result = mergeProfileLayers(parent, child)
    expect(result.definitions.nodes.a).toBeDefined()
    expect(result.definitions.nodes.b).toBeDefined()
    expect(result.availability.nodes.a).toBe('disabled')
  })

  it('子级无层定义时应拷贝父级', () => {
    const parent = {
      definitions: { nodes: { a: { shape: 'a', category: 'task', renderer: 'task' } }, edges: {} } as DefinitionsSet,
      availability: { nodes: {}, edges: {} },
      rendering: { theme: { colors: {}, icons: {} }, nodeRenderers: {}, edgeRenderers: {} },
      rules: { nodeCategories: {}, connectionRules: {}, constraints: [] },
      dataModel: { fields: {}, categoryFields: {} },
      serialization: { namespaces: {}, nodeMapping: {}, edgeMapping: {} },
    }

    const child: Profile = {
      meta: { id: 'child', name: 'Child' },
    }

    const result = mergeProfileLayers(parent, child)
    expect(result.definitions.nodes.a).toBeDefined()
    // 确保是拷贝而非同一引用
    expect(result.definitions.nodes).not.toBe(parent.definitions.nodes)
  })
})

// ============================================================================
// 异常 / 边界场景
// ============================================================================

describe('mergeRecords — 边界场景', () => {
  it('两个空对象合并应返回空对象', () => {
    expect(mergeRecords({}, {})).toEqual({})
  })

  it('$remove 值为非对象 true 应视为普通赋值', () => {
    const parent = { a: 1 }
    const child = { b: true as any }
    const result = mergeRecords(parent, child)
    expect(result).toEqual({ a: 1, b: true })
  })

  it('多个 $remove 应同时生效', () => {
    const parent = { a: 1, b: 2, c: 3, d: 4 }
    const child = {
      a: { $remove: true } as any,
      c: { $remove: true } as any,
    }
    const result = mergeRecords(parent, child)
    expect(result).toEqual({ b: 2, d: 4 })
  })

  it('子级值为 null 或 undefined 时应仍设置', () => {
    const parent = { a: 1, b: 2 }
    const child = { a: null as any, b: undefined as any }
    const result = mergeRecords(parent, child)
    expect(result.a).toBeNull()
    expect(result.b).toBeUndefined()
  })
})

describe('mergeDefinitions — 边界场景', () => {
  it('子级为空 Partial 时应拷贝所有父级定义', () => {
    const parent: DefinitionsSet = {
      nodes: { a: { shape: 'a', category: 'task', renderer: 'task' } },
      edges: { b: { shape: 'b', category: 'seq', renderer: 'seq' } },
    }
    const result = mergeDefinitions(parent, {})
    expect(result.nodes.a).toBeDefined()
    expect(result.edges.b).toBeDefined()
  })

  it('$remove 边定义应生效', () => {
    const parent: DefinitionsSet = {
      nodes: {},
      edges: { seq: { shape: 'seq', category: 'seq', renderer: 'seq' } },
    }
    const child: Partial<DefinitionsSet> = {
      edges: { seq: { $remove: true } } as any,
    }
    const result = mergeDefinitions(parent, child)
    expect('seq' in result.edges).toBe(false)
  })
})

describe('mergeRules — 边界场景', () => {
  it('空约束列表合并应返回空', () => {
    const parent: RuleSet = { nodeCategories: {}, connectionRules: {}, constraints: [] }
    const child: Partial<RuleSet> = { constraints: [] }
    const result = mergeRules(parent, child)
    expect(result.constraints.length).toBe(0)
  })

  it('无 ID 的约束规则应照常添加', () => {
    const rule1: ConstraintRule = { id: '', description: '无ID规则', validate: () => true }
    const parent: RuleSet = { nodeCategories: {}, connectionRules: {}, constraints: [rule1] }
    const child: Partial<RuleSet> = {}
    const result = mergeRules(parent, child)
    expect(result.constraints.length).toBe(1)
  })
})

describe('mergeDataModel — 边界场景', () => {
  it('空 DataModel 合并应返回空', () => {
    const parent: DataModelSet = { fields: {}, categoryFields: {} }
    const child: Partial<DataModelSet> = {}
    const result = mergeDataModel(parent, child)
    expect(Object.keys(result.fields).length).toBe(0)
    expect(Object.keys(result.categoryFields).length).toBe(0)
  })

  it('categoryFields 中同类别完全相同的数组应去重', () => {
    const parent: DataModelSet = {
      fields: {},
      categoryFields: { task: ['a', 'b'] },
    }
    const child: Partial<DataModelSet> = {
      categoryFields: { task: ['a', 'b'] },
    }
    const result = mergeDataModel(parent, child)
    expect(result.categoryFields.task).toEqual(['a', 'b'])
    expect(result.categoryFields.task.length).toBe(2)
  })
})

describe('mergeRendering — 边界场景', () => {
  it('子级只覆盖 icons 不影响 colors', () => {
    const dummyNodeR: NodeRendererFactory = () => ({ inherit: 'rect', width: 100, height: 60 })
    const parent: RenderingSet = {
      theme: { colors: { primary: '#000' }, icons: { user: 'old' } },
      nodeRenderers: { task: dummyNodeR },
      edgeRenderers: {},
    }
    const child: Partial<RenderingSet> = {
      theme: { colors: {}, icons: { user: 'new', service: 'svc' } },
    }
    const result = mergeRendering(parent, child)
    expect(result.theme.colors.primary).toBe('#000')
    expect(result.theme.icons.user).toBe('new')
    expect(result.theme.icons.service).toBe('svc')
  })
})

describe('mergeAvailability — 边界场景', () => {
  it('子级无 edges 时应浅拷贝父级 edges', () => {
    const parent: AvailabilitySet = {
      nodes: { a: 'enabled' },
      edges: { b: 'enabled' },
    }
    const result = mergeAvailability(parent, { nodes: { a: 'disabled' } })
    expect(result.edges.b).toBe('enabled')
    expect(result.nodes.a).toBe('disabled')
  })

  it('子级无 nodes 时应浅拷贝父级 nodes', () => {
    const parent: AvailabilitySet = {
      nodes: { a: 'enabled' },
      edges: { b: 'enabled' },
    }
    const result = mergeAvailability(parent, { edges: { b: 'disabled' } })
    expect(result.nodes.a).toBe('enabled')
    expect(result.edges.b).toBe('disabled')
  })
})

describe('mergeRendering — theme null 分支', () => {
  const dummyNodeR: NodeRendererFactory = () => ({ inherit: 'rect', width: 100, height: 60 })
  it('child.theme 存在但 colors 为 undefined 时应使用空对象', () => {
    const parent: RenderingSet = {
      theme: { colors: { primary: '#000' }, icons: { user: 'u' } },
      nodeRenderers: { task: dummyNodeR },
      edgeRenderers: {},
    }
    const child: Partial<RenderingSet> = {
      theme: { icons: { newIcon: 'n' } } as any,
    }
    const result = mergeRendering(parent, child)
    expect(result.theme.colors.primary).toBe('#000')
    expect(result.theme.icons.newIcon).toBe('n')
  })

  it('child.theme 存在但 icons 为 undefined 时应使用空对象', () => {
    const parent: RenderingSet = {
      theme: { colors: { primary: '#000' }, icons: { user: 'u' } },
      nodeRenderers: { task: dummyNodeR },
      edgeRenderers: {},
    }
    const child: Partial<RenderingSet> = {
      theme: { colors: { primary: '#111' } } as any,
    }
    const result = mergeRendering(parent, child)
    expect(result.theme.colors.primary).toBe('#111')
    expect(result.theme.icons.user).toBe('u')
  })
})

describe('mergeDataModel — shapeFields 边界', () => {
  it('子级无 shapeFields 且父级无 shapeFields 应返回 undefined', () => {
    const parent: DataModelSet = { fields: {}, categoryFields: {} }
    const result = mergeDataModel(parent, {})
    expect(result.shapeFields).toBeUndefined()
  })

  it('子级无 shapeFields 但父级有 shapeFields 应拷贝', () => {
    const parent: DataModelSet = { fields: {}, categoryFields: {}, shapeFields: { task: ['f1'] } }
    const result = mergeDataModel(parent, {})
    expect(result.shapeFields).toEqual({ task: ['f1'] })
  })

  it('子级有 shapeFields 但父级无 shapeFields 应合并空', () => {
    const parent: DataModelSet = { fields: {}, categoryFields: {} }
    const result = mergeDataModel(parent, { shapeFields: { task: ['f2'] } })
    expect(result.shapeFields).toEqual({ task: ['f2'] })
  })
})

describe('mergeSerialization — 边界场景', () => {
  it('子级覆盖命名空间应生效', () => {
    const parent: SerializationSet = {
      namespaces: { bpmn: 'http://old' },
      nodeMapping: {},
      edgeMapping: {},
    }
    const child: Partial<SerializationSet> = {
      namespaces: { bpmn: 'http://new' },
    }
    const result = mergeSerialization(parent, child)
    expect(result.namespaces.bpmn).toBe('http://new')
  })
})
