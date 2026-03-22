import { describe, it, expect } from 'vitest'
import {
  registerEventShapes,
  registerActivityShapes,
  registerGatewayShapes,
  registerDataShapes,
  registerArtifactShapes,
  registerSwimlaneShapes,
} from '../src/shapes'
import * as utilsBarrel from '../src/utils/index'
import * as layoutBarrel from '../src/layout/index'

/**
 * 模块桶导出测试
 * 验证 shapes、utils、layout 各入口文件正确导出所需函数和常量。
 */
describe('shapes/index 桶导出', () => {
  it('应导出 registerEventShapes 函数', () => {
    expect(typeof registerEventShapes).toBe('function')
  })

  it('应导出 registerActivityShapes 函数', () => {
    expect(typeof registerActivityShapes).toBe('function')
  })

  it('应导出 registerGatewayShapes 函数', () => {
    expect(typeof registerGatewayShapes).toBe('function')
  })

  it('应导出 registerDataShapes 函数', () => {
    expect(typeof registerDataShapes).toBe('function')
  })

  it('应导出 registerArtifactShapes 函数', () => {
    expect(typeof registerArtifactShapes).toBe('function')
  })

  it('应导出 registerSwimlaneShapes 函数', () => {
    expect(typeof registerSwimlaneShapes).toBe('function')
  })
})

describe('utils/index 桶导出', () => {
  it('应重导出各项常量', () => {
    expect(utilsBarrel).toHaveProperty('BPMN_START_EVENT')
    expect(utilsBarrel).toHaveProperty('BPMN_COLORS')
    expect(utilsBarrel).toHaveProperty('BPMN_ICONS')
  })
})

describe('layout/index 占位模块', () => {
  it('应导出空模块（留给未来布局功能使用）', () => {
    expect(layoutBarrel).toBeDefined()
    expect(typeof layoutBarrel).toBe('object')
  })
})
