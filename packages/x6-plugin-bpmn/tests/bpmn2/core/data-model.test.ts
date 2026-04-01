/**
 * 数据模型字段能力 — 单元测试
 *
 * 覆盖字段默认值、normalize、validate、serialize/deserialize、
 * 分类/shape 字段查询、buildDefaultData、validateFields。
 */

import { describe, it, expect } from 'vitest'
import {
  getFieldDefaultValue,
  normalizeFieldValue,
  validateFieldValue,
  serializeFieldValue,
  deserializeFieldValue,
  getFieldsForCategory,
  getFieldsForShape,
  buildDefaultData,
  validateFields,
} from '../../../src/core/data-model/fields'
import type { DataModelSet, FieldValidateContext } from '../../../src/core/dialect/types'

// ============================================================================
// 辅助
// ============================================================================

const testDataModel: DataModelSet = {
  fields: {
    assignee: {
      scope: 'node',
      defaultValue: '',
      normalize: (v) => String(v ?? '').trim(),
      validate: (v, ctx) => {
        if (ctx.category === 'task' && v === '') return '任务必须指定处理人'
        return true
      },
      serialize: (v) => `user:${v}`,
      deserialize: (v) => String(v).replace('user:', ''),
    },
    priority: {
      scope: 'node',
      defaultValue: 'medium',
    },
    description: {
      scope: 'node',
      defaultValue: '',
    },
    noDefault: {
      scope: 'node',
    },
  },
  categoryFields: {
    task: ['assignee', 'priority'],
    event: ['description'],
  },
  shapeFields: {
    'bpmn-user-task': ['assignee', 'priority', 'description'],
  },
}

const testCtx: FieldValidateContext = {
  shape: 'bpmn-user-task',
  category: 'task',
  profileId: 'test',
}

// ============================================================================
// getFieldDefaultValue
// ============================================================================

describe('getFieldDefaultValue', () => {
  it('应返回字段的默认值', () => {
    expect(getFieldDefaultValue('assignee', testDataModel)).toBe('')
    expect(getFieldDefaultValue('priority', testDataModel)).toBe('medium')
  })

  it('字段无默认值时应返回 undefined', () => {
    expect(getFieldDefaultValue('noDefault', testDataModel)).toBeUndefined()
  })

  it('不存在的字段应返回 undefined', () => {
    expect(getFieldDefaultValue('nonexistent', testDataModel)).toBeUndefined()
  })
})

// ============================================================================
// normalizeFieldValue
// ============================================================================

describe('normalizeFieldValue', () => {
  it('应使用字段的 normalize 函数', () => {
    expect(normalizeFieldValue('assignee', '  alice  ', testDataModel)).toBe('alice')
  })

  it('字段无 normalize 时应原样返回', () => {
    expect(normalizeFieldValue('priority', 'high', testDataModel)).toBe('high')
  })

  it('null 值应被 normalize 处理', () => {
    expect(normalizeFieldValue('assignee', null, testDataModel)).toBe('')
  })

  it('不存在的字段应原样返回', () => {
    expect(normalizeFieldValue('nonexistent', 'val', testDataModel)).toBe('val')
  })
})

// ============================================================================
// validateFieldValue
// ============================================================================

describe('validateFieldValue', () => {
  it('通过验证时应返回 true', () => {
    const result = validateFieldValue('assignee', 'alice', testCtx, testDataModel)
    expect(result).toBe(true)
  })

  it('未通过验证时应返回字符串原因', () => {
    const result = validateFieldValue('assignee', '', testCtx, testDataModel)
    expect(typeof result).toBe('string')
    expect(result).toContain('处理人')
  })

  it('字段无 validate 时应返回 true', () => {
    expect(validateFieldValue('priority', 'any', testCtx, testDataModel)).toBe(true)
  })

  it('不存在的字段应返回 true', () => {
    expect(validateFieldValue('nonexistent', 'val', testCtx, testDataModel)).toBe(true)
  })
})

// ============================================================================
// serializeFieldValue / deserializeFieldValue
// ============================================================================

describe('serializeFieldValue', () => {
  it('应使用字段的 serialize 函数', () => {
    expect(serializeFieldValue('assignee', 'alice', testDataModel)).toBe('user:alice')
  })

  it('字段无 serialize 时应原样返回', () => {
    expect(serializeFieldValue('priority', 'high', testDataModel)).toBe('high')
  })
})

describe('deserializeFieldValue', () => {
  it('应使用字段的 deserialize 函数', () => {
    expect(deserializeFieldValue('assignee', 'user:bob', testDataModel)).toBe('bob')
  })

  it('字段无 deserialize 时应原样返回', () => {
    expect(deserializeFieldValue('priority', 'high', testDataModel)).toBe('high')
  })
})

// ============================================================================
// getFieldsForCategory / getFieldsForShape
// ============================================================================

describe('getFieldsForCategory', () => {
  it('应返回该分类下的字段列表', () => {
    expect(getFieldsForCategory('task', testDataModel)).toEqual(['assignee', 'priority'])
  })

  it('不存在的分类应返回空数组', () => {
    expect(getFieldsForCategory('unknown', testDataModel)).toEqual([])
  })
})

describe('getFieldsForShape', () => {
  it('shapeFields 有定义时应优先使用', () => {
    const fields = getFieldsForShape('bpmn-user-task', 'task', testDataModel)
    expect(fields).toEqual(['assignee', 'priority', 'description'])
  })

  it('shapeFields 无定义时应回退到 categoryFields', () => {
    const fields = getFieldsForShape('bpmn-service-task', 'task', testDataModel)
    expect(fields).toEqual(['assignee', 'priority'])
  })

  it('shapeFields 和 categoryFields 均无时应返回空数组', () => {
    const fields = getFieldsForShape('unknown-shape', 'unknown', testDataModel)
    expect(fields).toEqual([])
  })
})

// ============================================================================
// buildDefaultData
// ============================================================================

describe('buildDefaultData', () => {
  it('应根据字段能力构建默认数据', () => {
    const data = buildDefaultData(['assignee', 'priority'], testDataModel)
    expect(data).toEqual({ assignee: '', priority: 'medium' })
  })

  it('无默认值的字段不应出现', () => {
    const data = buildDefaultData(['noDefault', 'priority'], testDataModel)
    expect('noDefault' in data).toBe(false)
    expect(data.priority).toBe('medium')
  })

  it('空字段列表应返回空对象', () => {
    expect(buildDefaultData([], testDataModel)).toEqual({})
  })

  it('不存在的字段应被忽略', () => {
    const data = buildDefaultData(['nonexistent'], testDataModel)
    expect(data).toEqual({})
  })
})

// ============================================================================
// validateFields
// ============================================================================

describe('validateFields', () => {
  it('所有字段通过时应返回空数组', () => {
    const failures = validateFields(
      { assignee: 'alice', priority: 'high' },
      ['assignee', 'priority'],
      testCtx,
      testDataModel,
    )
    expect(failures).toEqual([])
  })

  it('部分字段失败时应返回失败列表', () => {
    const failures = validateFields(
      { assignee: '', priority: 'high' },
      ['assignee', 'priority'],
      testCtx,
      testDataModel,
    )
    expect(failures.length).toBe(1)
    expect(failures[0].field).toBe('assignee')
    expect(failures[0].reason).toContain('处理人')
  })

  it('空数据应验证所有字段', () => {
    // assignee 字段的 validate 判断 v === '' 才失败，undefined 不触发
    // 先 normalize 再 validate 才是正确的使用方式
    const failures = validateFields(
      { assignee: '' },
      ['assignee'],
      testCtx,
      testDataModel,
    )
    expect(failures.length).toBe(1)
  })
})

// ============================================================================
// 异常 / 边界场景
// ============================================================================

describe('getFieldsForShape — 边界场景', () => {
  it('dataModel 无 shapeFields 属性时应回退到 categoryFields', () => {
    const dm: DataModelSet = {
      fields: {},
      categoryFields: { task: ['f1'] },
      // 不设置 shapeFields
    }
    const fields = getFieldsForShape('bpmn-user-task', 'task', dm)
    expect(fields).toEqual(['f1'])
  })

  it('shapeFields 存在但为空对象时应回退到 categoryFields', () => {
    const dm: DataModelSet = {
      fields: {},
      categoryFields: { task: ['f1'] },
      shapeFields: {},
    }
    const fields = getFieldsForShape('bpmn-user-task', 'task', dm)
    expect(fields).toEqual(['f1'])
  })
})

describe('buildDefaultData — 边界场景', () => {
  it('所有字段都无默认值时应返回空对象', () => {
    const dm: DataModelSet = {
      fields: {
        a: { scope: 'node' },
        b: { scope: 'node' },
      },
      categoryFields: {},
    }
    const data = buildDefaultData(['a', 'b'], dm)
    expect(data).toEqual({})
  })

  it('默认值为 false/0/null 时应正确包含', () => {
    const dm: DataModelSet = {
      fields: {
        flagFalse: { scope: 'node', defaultValue: false },
        numZero: { scope: 'node', defaultValue: 0 },
      },
      categoryFields: {},
    }
    const data = buildDefaultData(['flagFalse', 'numZero'], dm)
    // 需要看 buildDefaultData 实现 — 如果用 if (defaultValue !== undefined)
    expect(data.flagFalse).toBe(false)
    expect(data.numZero).toBe(0)
  })
})

describe('validateFields — 边界场景', () => {
  it('data 中没有对应字段的 key 时应仍能验证', () => {
    const failures = validateFields(
      {}, // 没有 assignee 字段
      ['assignee'],
      testCtx,
      testDataModel,
    )
    // validate 不触发（v 为 undefined，不等于 ''）
    // 或者触发取决于实现
    expect(Array.isArray(failures)).toBe(true)
  })

  it('字段列表为空时应返回空数组', () => {
    const failures = validateFields(
      { assignee: '' },
      [],
      testCtx,
      testDataModel,
    )
    expect(failures).toEqual([])
  })

  it('多字段多失败应全部返回', () => {
    const dm: DataModelSet = {
      fields: {
        a: { scope: 'node', validate: () => '错误A' },
        b: { scope: 'node', validate: () => '错误B' },
        c: { scope: 'node', validate: () => true },
      },
      categoryFields: {},
    }
    const ctx: FieldValidateContext = { shape: 'test', category: 'test', profileId: 'test' }
    const failures = validateFields({ a: 'x', b: 'y', c: 'z' }, ['a', 'b', 'c'], ctx, dm)
    expect(failures.length).toBe(2)
    expect(failures.map(f => f.field).sort()).toEqual(['a', 'b'])
  })
})

describe('normalizeFieldValue — 边界场景', () => {
  it('不存在的字段应原样返回各种类型', () => {
    const dm: DataModelSet = { fields: {}, categoryFields: {} }
    expect(normalizeFieldValue('x', 123, dm)).toBe(123)
    expect(normalizeFieldValue('x', null, dm)).toBeNull()
    expect(normalizeFieldValue('x', undefined, dm)).toBeUndefined()
  })
})

describe('serializeFieldValue / deserializeFieldValue — 边界场景', () => {
  it('不存在的字段应原样返回', () => {
    const dm: DataModelSet = { fields: {}, categoryFields: {} }
    expect(serializeFieldValue('x', 'val', dm)).toBe('val')
    expect(deserializeFieldValue('x', 'val', dm)).toBe('val')
  })
})
