import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerArtifactShapes } from '../src/shapes/artifacts'
import {
  BPMN_COLORS,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
} from '../src/utils/constants'

describe('registerArtifactShapes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('should call registerArtifactShapes without errors', () => {
    expect(() => registerArtifactShapes()).not.toThrow()
  })

  it('should register exactly 2 artifact shapes', () => {
    registerArtifactShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(2)
  })

  // ==================== Text Annotation ====================

  describe('Text Annotation', () => {
    it('should register Text Annotation', () => {
      registerArtifactShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_TEXT_ANNOTATION, expect.any(Object), true)
    })

    it('Text Annotation should inherit from rect', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('Text Annotation should have left bracket line', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      const hasBracket = config.markup.some((m: any) => m.selector === 'bracket')
      expect(hasBracket).toBe(true)
      expect(config.attrs.bracket).toBeDefined()
      expect(config.attrs.bracket.stroke).toBe(BPMN_COLORS.annotation.stroke)
    })

    it('Text Annotation body should have no stroke (only bracket)', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe('none')
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.annotation.fill)
    })

    it('Text Annotation should be 120x50', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.width).toBe(120)
      expect(config.height).toBe(50)
    })

    it('Text Annotation label should be left-aligned', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.label.textAnchor).toBe('start')
    })
  })

  // ==================== Group ====================

  describe('Group', () => {
    it('should register Group', () => {
      registerArtifactShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_GROUP, expect.any(Object), true)
    })

    it('Group should inherit from rect', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('Group should be large (300x200)', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.width).toBe(300)
      expect(config.height).toBe(200)
    })

    it('Group should have dashed border', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('10,4')
    })

    it('Group should have rounded corners', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.rx).toBe(12)
      expect(config.attrs.body.ry).toBe(12)
    })

    it('Group should have transparent fill', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.group.fill)
      expect(config.attrs.body.fill).toBe('transparent')
    })

    it('Group should use group stroke color', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.group.stroke)
    })

    it('Group should have low zIndex (background)', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-1)
    })

    it('Group label should be bold', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.label.fontWeight).toBe('bold')
    })
  })

  // ==================== General Artifact Properties ====================

  describe('General Artifact Properties', () => {
    it('all artifacts should be passed with overwrite=true', () => {
      registerArtifactShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('all artifacts should have body and label selectors', () => {
      registerArtifactShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasBody = config.markup.some((m: any) => m.selector === 'body')
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasBody).toBe(true)
        expect(hasLabel).toBe(true)
      }
    })
  })
})
