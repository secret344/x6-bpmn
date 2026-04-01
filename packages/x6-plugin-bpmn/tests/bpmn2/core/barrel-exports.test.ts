/**
 * Barrel re-export 文件 — 导入可达性测试
 *
 * 确保所有 barrel index.ts 的导出符号可正常导入。
 * 这些文件仅做 re-export，只需验证导入不抛错即可达到行覆盖。
 */

import { describe, it, expect } from 'vitest'

describe('src/builtin/index.ts barrel', () => {
  it('应导出所有内置 profile', async () => {
    const mod = await import('../../../src/builtin')
    expect(mod.bpmn2Profile).toBeDefined()
    expect(mod.smartengineBaseProfile).toBeDefined()
    expect(mod.smartengineCustomProfile).toBeDefined()
    expect(mod.smartengineDatabaseProfile).toBeDefined()
  })
})

describe('src/core/index.ts barrel', () => {
  it('应导出 dialect 子模块符号', async () => {
    const mod = await import('../../../src/core')
    expect(mod.ProfileRegistry).toBeDefined()
    expect(mod.compileProfile).toBeDefined()
    expect(mod.createProfileContext).toBeDefined()
    expect(mod.DialectDetector).toBeDefined()
  })

  it('应导出 rendering 子模块符号', async () => {
    const mod = await import('../../../src/core')
    expect(mod.createBpmn2NodeRenderers).toBeDefined()
    expect(mod.createBpmn2EdgeRenderers).toBeDefined()
  })

  it('应导出 rules 子模块符号', async () => {
    const mod = await import('../../../src/core')
    expect(mod.validateConnectionWithContext).toBeDefined()
    expect(mod.createContextValidateConnection).toBeDefined()
    expect(mod.createStartEventLimit).toBeDefined()
    expect(mod.requireStartEvent).toBeDefined()
    expect(mod.validateConstraints).toBeDefined()
  })

  it('应导出 data-model 子模块符号', async () => {
    const mod = await import('../../../src/core')
    expect(mod.getFieldDefaultValue).toBeDefined()
    expect(mod.normalizeFieldValue).toBeDefined()
    expect(mod.validateFieldValue).toBeDefined()
    expect(mod.buildDefaultData).toBeDefined()
  })
})

describe('src/core/dialect/index.ts barrel', () => {
  it('应导出所有 dialect 公共 API', async () => {
    const mod = await import('../../../src/core/dialect')
    // Registry
    expect(mod.ProfileRegistry).toBeDefined()
    expect(mod.createProfileRegistry).toBeDefined()
    // Compiler
    expect(mod.compileProfile).toBeDefined()
    // Merge
    expect(mod.mergeRecords).toBeDefined()
    expect(mod.mergeDefinitions).toBeDefined()
    expect(mod.mergeAvailability).toBeDefined()
    expect(mod.mergeRendering).toBeDefined()
    expect(mod.mergeRules).toBeDefined()
    expect(mod.mergeDataModel).toBeDefined()
    expect(mod.mergeSerialization).toBeDefined()
    expect(mod.mergeProfileLayers).toBeDefined()
    // Context
    expect(mod.createProfileContext).toBeDefined()
    expect(mod.bindProfileToGraph).toBeDefined()
    expect(mod.getProfileContext).toBeDefined()
    expect(mod.unbindProfile).toBeDefined()
    // Detector
    expect(mod.DialectDetector).toBeDefined()
    expect(mod.createDialectDetector).toBeDefined()
    expect(mod.smartEngineNamespaceRule).toBeDefined()
    // Types
    expect(mod.isRemoveMarker).toBeDefined()
  })
})

describe('src/core/data-model/index.ts barrel', () => {
  it('应导出数据模型函数', async () => {
    const mod = await import('../../../src/core/data-model')
    expect(mod.getFieldDefaultValue).toBeDefined()
    expect(mod.normalizeFieldValue).toBeDefined()
    expect(mod.validateFieldValue).toBeDefined()
    expect(mod.serializeFieldValue).toBeDefined()
    expect(mod.deserializeFieldValue).toBeDefined()
    expect(mod.getFieldsForCategory).toBeDefined()
    expect(mod.getFieldsForShape).toBeDefined()
    expect(mod.buildDefaultData).toBeDefined()
    expect(mod.validateFields).toBeDefined()
  })
})

describe('src/core/rendering/index.ts barrel', () => {
  it('应导出渲染器工厂', async () => {
    const mod = await import('../../../src/core/rendering')
    expect(mod.createBpmn2NodeRenderers).toBeDefined()
    expect(mod.createBpmn2EdgeRenderers).toBeDefined()
  })
})

describe('src/core/rules/index.ts barrel', () => {
  it('应导出规则与约束函数', async () => {
    const mod = await import('../../../src/core/rules')
    expect(mod.validateConnectionWithContext).toBeDefined()
    expect(mod.createContextValidateConnection).toBeDefined()
    expect(mod.createStartEventLimit).toBeDefined()
    expect(mod.createEndEventLimit).toBeDefined()
    expect(mod.requireStartEvent).toBeDefined()
    expect(mod.requireEndEvent).toBeDefined()
    expect(mod.createForbiddenShapes).toBeDefined()
    expect(mod.validateConstraints).toBeDefined()
  })
})

describe('src/adapters/index.ts barrel', () => {
  it('应导出所有适配器工厂和管理器', async () => {
    const mod = await import('../../../src/adapters')
    expect(mod.createBpmn2ExporterAdapter).toBeDefined()
    expect(mod.createBpmn2ImporterAdapter).toBeDefined()
    expect(mod.createSmartEngineExporterAdapter).toBeDefined()
    expect(mod.createSmartEngineImporterAdapter).toBeDefined()
    expect(mod.DialectManager).toBeDefined()
    expect(mod.createDialectManager).toBeDefined()
  })
})
