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

describe('shapes/index barrel export', () => {
  it('should export registerEventShapes', () => {
    expect(typeof registerEventShapes).toBe('function')
  })

  it('should export registerActivityShapes', () => {
    expect(typeof registerActivityShapes).toBe('function')
  })

  it('should export registerGatewayShapes', () => {
    expect(typeof registerGatewayShapes).toBe('function')
  })

  it('should export registerDataShapes', () => {
    expect(typeof registerDataShapes).toBe('function')
  })

  it('should export registerArtifactShapes', () => {
    expect(typeof registerArtifactShapes).toBe('function')
  })

  it('should export registerSwimlaneShapes', () => {
    expect(typeof registerSwimlaneShapes).toBe('function')
  })
})

describe('utils/index barrel export', () => {
  it('should re-export constants', () => {
    expect(utilsBarrel).toHaveProperty('BPMN_START_EVENT')
    expect(utilsBarrel).toHaveProperty('BPMN_COLORS')
    expect(utilsBarrel).toHaveProperty('BPMN_ICONS')
  })
})

describe('layout/index placeholder', () => {
  it('should export empty module (placeholder for future)', () => {
    expect(layoutBarrel).toBeDefined()
    expect(typeof layoutBarrel).toBe('object')
  })
})
