import { describe, it, expect } from 'vitest'
import { buildSwimlaneAttrs, resolveSwimlaneIsHorizontal } from '../../../src/shapes/swimlane-presentation'
import { BPMN_POOL, BPMN_LANE } from '../../../src/utils/constants'

describe('swimlane-presentation', () => {
  it('Pool 在未传标签时应回退到默认标题并保留粗体样式', () => {
    const attrs = buildSwimlaneAttrs(BPMN_POOL)

    expect(attrs.headerLabel.text).toBe('Pool')
    expect(attrs.headerLabel.fontWeight).toBe('bold')
    expect(attrs.headerLabel.transform).toBe('rotate(-90)')
  })

  it('Lane 垂直布局时应使用顶部标题栏且不带粗体', () => {
    const attrs = buildSwimlaneAttrs(BPMN_LANE, undefined, false)

    expect(attrs.header.height).toBe(30)
    expect(attrs.header.refWidth).toBe('100%')
    expect(attrs.headerLabel.text).toBe('Lane')
    expect(attrs.headerLabel.fontWeight).toBeUndefined()
    expect(attrs.headerLabel.transform).toBeUndefined()
  })

  it('应优先使用持久化的 isHorizontal', () => {
    expect(resolveSwimlaneIsHorizontal({ bpmn: { isHorizontal: false } }, { width: 900, height: 200 })).toBe(false)
  })

  it('缺失持久化方向时应按宽高比和默认值回退', () => {
    expect(resolveSwimlaneIsHorizontal({}, { width: 200, height: 600 })).toBe(false)
    expect(resolveSwimlaneIsHorizontal(undefined)).toBe(true)
  })
})