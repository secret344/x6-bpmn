import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerArtifactShapes } from '../src/shapes/artifacts'
import {
  BPMN_COLORS,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
} from '../src/utils/constants'

/**
 * 工件图形注册测试（registerArtifactShapes）
 * 验证文本注释和分组 2 种工件图形的配置。
 */
describe('工件图形注册（registerArtifactShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerArtifactShapes()).not.toThrow()
  })

  it('应注册恰好 2 个工件图形', () => {
    registerArtifactShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(2)
  })

  // ==================== Text Annotation ====================

  describe('文本注释（Text Annotation）', () => {
    it('应注册文本注释图形', () => {
      registerArtifactShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_TEXT_ANNOTATION, expect.any(Object), true)
    })

    it('文本注释应继承自 rect', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('文本注释应有左侧括号线', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      const hasBracket = config.markup.some((m: any) => m.selector === 'bracket')
      expect(hasBracket).toBe(true)
      expect(config.attrs.bracket).toBeDefined()
      expect(config.attrs.bracket.stroke).toBe(BPMN_COLORS.annotation.stroke)
    })

    it('文本注释主体无描边（只显示括号线）', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe('none')
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.annotation.fill)
    })

    it('文本注释默认尺寸应为 120×50', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.width).toBe(120)
      expect(config.height).toBe(50)
    })

    it('文本注释标签应左对齐', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TEXT_ANNOTATION)!
      const config = call[1] as any
      expect(config.attrs.label.textAnchor).toBe('start')
    })
  })

  // ==================== Group ====================

  describe('分组（Group）', () => {
    it('应注册分组图形', () => {
      registerArtifactShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_GROUP, expect.any(Object), true)
    })

    it('分组应继承自 rect', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
    })

    it('分组默认尺寸应为 300×200（大容器）', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.width).toBe(300)
      expect(config.height).toBe(200)
    })

    it('分组应有虚线边框', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('10,4')
    })

    it('分组应有圆角', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.rx).toBe(12)
      expect(config.attrs.body.ry).toBe(12)
    })

    it('分组填充色应为透明', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.group.fill)
      expect(config.attrs.body.fill).toBe('transparent')
    })

    it('分组描边应使用 group 颜色', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.group.stroke)
    })

    it('分组 zIndex 应为 -1（渲染在背景层）', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.zIndex).toBe(-1)
    })

    it('分组标签应加粗', () => {
      registerArtifactShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_GROUP)!
      const config = call[1] as any
      expect(config.attrs.label.fontWeight).toBe('bold')
    })
  })

  // ==================== General Artifact Properties ====================

  describe('工件图形通用属性', () => {
    it('所有工件注册时 overwrite 参数应为 true', () => {
      registerArtifactShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('所有工件的 markup 应包含 body 和 label 选择器', () => {
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
