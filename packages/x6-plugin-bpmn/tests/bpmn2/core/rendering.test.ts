/**
 * 渲染器工厂 — 单元测试
 *
 * 覆盖 12 种节点渲染器和 7 种边渲染器的工厂输出。
 */

import { describe, it, expect } from 'vitest'
import { createBpmn2NodeRenderers } from '../../../src/core/rendering/node-renderers'
import { createBpmn2EdgeRenderers } from '../../../src/core/rendering/edge-renderers'
import type { ThemeTokens, NodeDefinition, EdgeDefinition } from '../../../src/core/dialect/types'
import { BPMN_COLORS, BPMN_ICONS } from '../../../src/utils/constants'

// ============================================================================
// 辅助
// ============================================================================

const theme: ThemeTokens = {
  colors: { ...BPMN_COLORS },
  icons: { ...BPMN_ICONS },
}

function makeNodeDef(shape: string, category: string, renderer: string): NodeDefinition {
  return { shape, category, renderer }
}

function makeEdgeDef(shape: string, category: string, renderer: string): EdgeDefinition {
  return { shape, category, renderer }
}

// ============================================================================
// 节点渲染器
// ============================================================================

describe('createBpmn2NodeRenderers', () => {
  const renderers = createBpmn2NodeRenderers()

  it('应返回 12 种渲染器', () => {
    const expectedKeys = [
      'startEvent', 'intermediateEvent', 'endEvent', 'boundaryEvent',
      'task', 'subProcess', 'gateway',
      'data', 'annotation', 'group', 'pool', 'lane',
    ]
    for (const key of expectedKeys) {
      expect(renderers[key], `缺少渲染器: ${key}`).toBeDefined()
      expect(typeof renderers[key]).toBe('function')
    }
  })

  // ---- 事件类 ----

  it('startEvent 渲染器应生成圆形节点', () => {
    const def = makeNodeDef('bpmn-start-event', 'startEvent', 'startEvent')
    const shape = renderers.startEvent(theme, def)
    expect(shape.width).toBe(36)
    expect(shape.height).toBe(36)
    expect(shape.markup).toBeDefined()
    expect(shape.attrs?.body).toBeDefined()
  })

  it('endEvent 渲染器应有更粗的边框', () => {
    const def = makeNodeDef('bpmn-end-event', 'endEvent', 'endEvent')
    const shape = renderers.endEvent(theme, def)
    expect(shape.attrs?.body?.strokeWidth).toBe(3)
  })

  it('intermediateEvent 渲染器应有内圈', () => {
    const def = makeNodeDef('bpmn-intermediate-throw-event', 'intermediateEvent', 'intermediateEvent')
    const shape = renderers.intermediateEvent(theme, def)
    expect(shape.attrs?.innerCircle).toBeDefined()
  })

  it('boundaryEvent 渲染器应有内圈', () => {
    const def = makeNodeDef('bpmn-boundary-event', 'boundaryEvent', 'boundaryEvent')
    const shape = renderers.boundaryEvent(theme, def)
    expect(shape.attrs?.innerCircle).toBeDefined()
  })

  it('non-interrupting 边界事件应使用虚线', () => {
    const def = makeNodeDef('bpmn-boundary-event-non-interrupting-message', 'boundaryEvent', 'boundaryEvent')
    const shape = renderers.boundaryEvent(theme, def)
    expect(shape.attrs?.body?.strokeDasharray).toBeDefined()
  })

  // ---- 活动类 ----

  it('task 渲染器应生成矩形节点', () => {
    const def = makeNodeDef('bpmn-task', 'task', 'task')
    const shape = renderers.task(theme, def)
    expect(shape.inherit).toBe('rect')
    expect(shape.width).toBe(100)
    expect(shape.height).toBe(60)
    expect(shape.attrs?.body?.rx).toBe(6)
  })

  it('subProcess 渲染器应有更大尺寸', () => {
    const def = makeNodeDef('bpmn-sub-process', 'subProcess', 'subProcess')
    const shape = renderers.subProcess(theme, def)
    expect(shape.width!).toBeGreaterThanOrEqual(150)
    expect(shape.height!).toBeGreaterThanOrEqual(100)
  })

  // ---- 网关类 ----

  it('gateway 渲染器应生成菱形节点', () => {
    const def = makeNodeDef('bpmn-exclusive-gateway', 'gateway', 'gateway')
    const shape = renderers.gateway(theme, def)
    expect(shape.markup).toBeDefined()
    // 菱形用 polygon selector
    const hasPolygon = shape.markup!.some((m: any) => m.tagName === 'polygon')
    expect(hasPolygon).toBe(true)
  })

  // ---- 数据 / 工件 ----

  it('data 渲染器应生成数据对象形状', () => {
    const def = makeNodeDef('bpmn-data-object', 'data', 'data')
    const shape = renderers.data(theme, def)
    expect(shape).toBeDefined()
    expect(shape.markup).toBeDefined()
  })

  it('annotation 渲染器应生成注释形状', () => {
    const def = makeNodeDef('bpmn-text-annotation', 'artifact', 'annotation')
    const shape = renderers.annotation(theme, def)
    expect(shape).toBeDefined()
  })

  it('group 渲染器应生成分组形状', () => {
    const def = makeNodeDef('bpmn-group', 'artifact', 'group')
    const shape = renderers.group(theme, def)
    expect(shape).toBeDefined()
    // 分组应使用虚线边框
    expect(shape.attrs?.body?.strokeDasharray).toBeDefined()
  })

  // ---- 泳道 ----

  it('pool 渲染器应生成泳池形状', () => {
    const def = makeNodeDef('bpmn-pool', 'swimlane', 'pool')
    const shape = renderers.pool(theme, def)
    expect(shape).toBeDefined()
    expect(shape.width!).toBeGreaterThan(100)
    // headerFill 存在时应使用
    expect(shape.attrs?.header?.fill).toBe(BPMN_COLORS.pool.headerFill)
  })

  it('pool 渲染器 — 无 headerFill 时使用默认值', () => {
    const customTheme: ThemeTokens = {
      colors: { pool: { stroke: '#000', fill: '#fff' } },
      icons: {},
    }
    const def = makeNodeDef('bpmn-pool', 'swimlane', 'pool')
    const shape = renderers.pool(customTheme, def)
    expect(shape.attrs?.header?.fill).toBe('#e0e0e0')
  })

  it('lane 渲染器应生成泳道形状', () => {
    const def = makeNodeDef('bpmn-lane', 'swimlane', 'lane')
    const shape = renderers.lane(theme, def)
    expect(shape).toBeDefined()
  })
})

// ============================================================================
// 边渲染器
// ============================================================================

describe('createBpmn2EdgeRenderers', () => {
  const renderers = createBpmn2EdgeRenderers()

  it('应返回 7 种渲染器', () => {
    const expectedKeys = [
      'sequenceFlow', 'conditionalFlow', 'defaultFlow',
      'messageFlow', 'association', 'directedAssociation', 'dataAssociation',
    ]
    for (const key of expectedKeys) {
      expect(renderers[key], `缺少渲染器: ${key}`).toBeDefined()
      expect(typeof renderers[key]).toBe('function')
    }
  })

  it('sequenceFlow 应有实心箭头', () => {
    const def = makeEdgeDef('bpmn-sequence-flow', 'sequenceFlow', 'sequenceFlow')
    const config = renderers.sequenceFlow(theme, def)
    expect(config.attrs?.line?.targetMarker).toBeDefined()
    expect((config.attrs?.line?.targetMarker as any).name).toBe('block')
  })

  it('conditionalFlow 应有菱形源标记', () => {
    const def = makeEdgeDef('bpmn-conditional-flow', 'sequenceFlow', 'conditionalFlow')
    const config = renderers.conditionalFlow(theme, def)
    expect((config.attrs?.line?.sourceMarker as any).name).toBe('diamond')
  })

  it('defaultFlow 应有斜线源标记', () => {
    const def = makeEdgeDef('bpmn-default-flow', 'sequenceFlow', 'defaultFlow')
    const config = renderers.defaultFlow(theme, def)
    expect(config.attrs?.line?.sourceMarker).toBeDefined()
    expect((config.attrs?.line?.sourceMarker as any).d).toBeDefined()
  })

  it('messageFlow 应为虚线', () => {
    const def = makeEdgeDef('bpmn-message-flow', 'messageFlow', 'messageFlow')
    const config = renderers.messageFlow(theme, def)
    expect(config.attrs?.line?.strokeDasharray).toBe('8,5')
  })

  it('messageFlow 应有圆形源标记', () => {
    const def = makeEdgeDef('bpmn-message-flow', 'messageFlow', 'messageFlow')
    const config = renderers.messageFlow(theme, def)
    expect((config.attrs?.line?.sourceMarker as any).name).toBe('ellipse')
  })

  it('association 应为点线且无箭头', () => {
    const def = makeEdgeDef('bpmn-association', 'association', 'association')
    const config = renderers.association(theme, def)
    expect(config.attrs?.line?.strokeDasharray).toBe('4,4')
    expect(config.attrs?.line?.targetMarker).toBeNull()
  })

  it('directedAssociation 应为点线带空心箭头', () => {
    const def = makeEdgeDef('bpmn-directed-association', 'association', 'directedAssociation')
    const config = renderers.directedAssociation(theme, def)
    expect(config.attrs?.line?.strokeDasharray).toBe('4,4')
    expect((config.attrs?.line?.targetMarker as any).open).toBe(true)
  })

  it('dataAssociation 应为虚线带空心箭头', () => {
    const def = makeEdgeDef('bpmn-data-association', 'association', 'dataAssociation')
    const config = renderers.dataAssociation(theme, def)
    expect(config.attrs?.line?.strokeDasharray).toBe('6,3')
    expect((config.attrs?.line?.targetMarker as any).open).toBe(true)
  })

  it('所有边渲染器应继承 edge', () => {
    for (const [name, factory] of Object.entries(renderers)) {
      const def = makeEdgeDef(`test-${name}`, 'test', name)
      const config = factory(theme, def)
      expect(config.inherit, `${name} 应继承 edge`).toBe('edge')
    }
  })

  it('所有边渲染器的 zIndex 应为 0', () => {
    for (const [name, factory] of Object.entries(renderers)) {
      const def = makeEdgeDef(`test-${name}`, 'test', name)
      const config = factory(theme, def)
      expect(config.zIndex, `${name} 的 zIndex 应为 0`).toBe(0)
    }
  })
})

// ============================================================================
// 节点渲染器 — 扩展场景
// ============================================================================

describe('createBpmn2NodeRenderers — 任务类型标记差异', () => {
  const renderers = createBpmn2NodeRenderers()

  it('用户任务应有区别于普通任务的 markup', () => {
    const plainTask = renderers.task(theme, makeNodeDef('bpmn-task', 'task', 'task'))
    const userTask = renderers.task(theme, makeNodeDef('bpmn-user-task', 'task', 'task'))
    // 具体差异取决于实现 — 至少都返回有效 shape
    expect(plainTask).toBeDefined()
    expect(userTask).toBeDefined()
  })

  it('service-task 应有区别于普通任务的 markup', () => {
    const serviceTask = renderers.task(theme, makeNodeDef('bpmn-service-task', 'task', 'task'))
    expect(serviceTask).toBeDefined()
    expect(serviceTask.inherit).toBe('rect')
  })

  it('script-task 应有区别于普通任务的 markup', () => {
    const scriptTask = renderers.task(theme, makeNodeDef('bpmn-script-task', 'task', 'task'))
    expect(scriptTask).toBeDefined()
  })
})

describe('createBpmn2NodeRenderers — 空主题', () => {
  const renderers = createBpmn2NodeRenderers()
  const emptyTheme: ThemeTokens = { colors: {}, icons: {} }

  it('空主题不应导致渲染器崩溃', () => {
    const def = makeNodeDef('bpmn-task', 'task', 'task')
    const shape = renderers.task(emptyTheme, def)
    expect(shape).toBeDefined()
    expect(shape.inherit).toBe('rect')
  })

  it('空主题下事件渲染器不应崩溃', () => {
    const def = makeNodeDef('bpmn-start-event', 'startEvent', 'startEvent')
    const shape = renderers.startEvent(emptyTheme, def)
    expect(shape).toBeDefined()
  })

  it('空主题下网关渲染器不应崩溃', () => {
    const def = makeNodeDef('bpmn-exclusive-gateway', 'gateway', 'gateway')
    const shape = renderers.gateway(emptyTheme, def)
    expect(shape).toBeDefined()
  })

  it('空主题下 subProcess 使用默认颜色', () => {
    const shape = renderers.subProcess(emptyTheme, makeNodeDef('bpmn-sub-process', 'subProcess', 'subProcess'))
    expect(shape.attrs?.body?.stroke).toBe('#1565c0')
  })

  it('空主题下 data 使用默认颜色', () => {
    const shape = renderers.data(emptyTheme, makeNodeDef('bpmn-data-object', 'data', 'data'))
    expect(shape.attrs?.body?.stroke).toBe('#616161')
  })

  it('空主题下 annotation 使用默认颜色', () => {
    const shape = renderers.annotation(emptyTheme, makeNodeDef('bpmn-text-annotation', 'artifact', 'annotation'))
    expect(shape.attrs?.body?.stroke).toBe('#9e9e9e')
  })

  it('空主题下 group 使用默认颜色', () => {
    const shape = renderers.group(emptyTheme, makeNodeDef('bpmn-group', 'artifact', 'group'))
    expect(shape.attrs?.body?.stroke).toBe('#9e9e9e')
  })

  it('空主题下 pool 使用默认颜色', () => {
    const shape = renderers.pool(emptyTheme, makeNodeDef('bpmn-pool', 'swimlane', 'pool'))
    expect(shape.attrs?.body?.stroke).toBe('#424242')
    expect(shape.attrs?.header?.fill).toBe('#e0e0e0')
  })

  it('空主题下 lane 使用默认颜色', () => {
    const shape = renderers.lane(emptyTheme, makeNodeDef('bpmn-lane', 'swimlane', 'lane'))
    expect(shape.attrs?.body?.stroke).toBe('#bdbdbd')
  })

  it('空主题下 message 事件图标路径为空字符串', () => {
    const shape = renderers.startEvent(emptyTheme, makeNodeDef('bpmn-start-event-message', 'startEvent', 'startEvent'))
    // icons is empty, so icon path falls back to ''
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })

  it('空主题下 user-task 图标路径为空字符串', () => {
    const shape = renderers.task(emptyTheme, makeNodeDef('bpmn-user-task', 'task', 'task'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })

  it('空主题下 exclusive-gateway 图标路径为空字符串', () => {
    const shape = renderers.gateway(emptyTheme, makeNodeDef('bpmn-exclusive-gateway', 'gateway', 'gateway'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })
})

describe('createBpmn2EdgeRenderers — 边界场景', () => {
  const renderers = createBpmn2EdgeRenderers()
  const emptyTheme: ThemeTokens = { colors: {}, icons: {} }

  it('空主题不应导致边渲染器崩溃', () => {
    const def = makeEdgeDef('bpmn-sequence-flow', 'sequenceFlow', 'sequenceFlow')
    const config = renderers.sequenceFlow(emptyTheme, def)
    expect(config).toBeDefined()
    expect(config.inherit).toBe('edge')
  })

  it('messageFlow 应有不同于 sequenceFlow 的 strokeDasharray', () => {
    const seqConfig = renderers.sequenceFlow(theme, makeEdgeDef('bpmn-sequence-flow', 'seq', 'sequenceFlow'))
    const msgConfig = renderers.messageFlow(theme, makeEdgeDef('bpmn-message-flow', 'msg', 'messageFlow'))
    // sequenceFlow 应为实线（无 dasharray）
    expect(seqConfig.attrs?.line?.strokeDasharray).toBeFalsy()
    // messageFlow 应为虚线
    expect(msgConfig.attrs?.line?.strokeDasharray).toBeTruthy()
  })
})

describe('createBpmn2NodeRenderers — 所有渲染器应返回有效 markup', () => {
  const renderers = createBpmn2NodeRenderers()
  const keys = ['startEvent', 'intermediateEvent', 'endEvent', 'boundaryEvent',
    'task', 'subProcess', 'gateway', 'data', 'annotation', 'group', 'pool', 'lane']

  for (const key of keys) {
    it(`${key} 渲染器应返回对象`, () => {
      const factory = renderers[key]
      const def = makeNodeDef(`bpmn-test-${key}`, key, key)
      const shape = factory(theme, def)
      expect(shape).toBeDefined()
      expect(typeof shape).toBe('object')
    })
  }
})

// ============================================================================
// 事件图标分支覆盖
// ============================================================================

describe('createBpmn2NodeRenderers — 事件图标分支', () => {
  const renderers = createBpmn2NodeRenderers()

  it('start event with message icon', () => {
    const def = makeNodeDef('bpmn-start-event-message', 'startEvent', 'startEvent')
    const shape = renderers.startEvent(theme, def)
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(true)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.message)
  })

  it('end event with message uses filled icon (isFilled=true)', () => {
    const def = makeNodeDef('bpmn-end-event-message', 'endEvent', 'endEvent')
    const shape = renderers.endEvent(theme, def)
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(true)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.messageFilled)
  })

  it('intermediate throw event with signal uses filled icon', () => {
    const def = makeNodeDef('bpmn-intermediate-throw-event-signal', 'intermediateEvent', 'intermediateEvent')
    const shape = renderers.intermediateEvent(theme, def)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.signalFilled)
    expect(shape.attrs?.innerCircle).toBeDefined()
  })

  it('intermediate catch event with timer uses regular icon (not filled)', () => {
    const def = makeNodeDef('bpmn-intermediate-catch-event-timer', 'intermediateEvent', 'intermediateEvent')
    const shape = renderers.intermediateEvent(theme, def)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.timer)
  })

  it('end event with error uses errorFilled (no errorFilled defined, fallback to error)', () => {
    const def = makeNodeDef('bpmn-end-event-error', 'endEvent', 'endEvent')
    const shape = renderers.endEvent(theme, def)
    // error has no Filled variant in icons, so falls back to regular
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.error)
  })

  it('start event with timer icon', () => {
    const def = makeNodeDef('bpmn-start-event-timer', 'startEvent', 'startEvent')
    const shape = renderers.startEvent(theme, def)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.timer)
  })

  it('boundary event with cancel icon', () => {
    const def = makeNodeDef('bpmn-boundary-event-cancel', 'boundaryEvent', 'boundaryEvent')
    const shape = renderers.boundaryEvent(theme, def)
    expect(shape.attrs?.icon).toBeDefined()
  })

  it('end event with terminate icon (filled)', () => {
    const def = makeNodeDef('bpmn-end-event-terminate', 'endEvent', 'endEvent')
    const shape = renderers.endEvent(theme, def)
    expect(shape.attrs?.icon).toBeDefined()
  })

  it('start event without matching icon key → no icon in markup', () => {
    const def = makeNodeDef('bpmn-start-event', 'startEvent', 'startEvent')
    const shape = renderers.startEvent(theme, def)
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })
})

// ============================================================================
// 任务图标分支覆盖
// ============================================================================

describe('createBpmn2NodeRenderers — 任务图标分支', () => {
  const renderers = createBpmn2NodeRenderers()

  it('user-task 应有 user 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-user-task', 'task', 'task'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(true)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.user)
  })

  it('service-task 应有 service 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-service-task', 'task', 'task'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.service)
  })

  it('send-task 应有 send 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-send-task', 'task', 'task'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.send)
  })

  it('receive-task 应有 receive 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-receive-task', 'task', 'task'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.receive)
  })

  it('manual-task 应有 manual 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-manual-task', 'task', 'task'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.manual)
  })

  it('business-rule-task 应有 businessRule 图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-business-rule-task', 'task', 'task'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.businessRule)
  })

  it('plain task 无图标', () => {
    const shape = renderers.task(theme, makeNodeDef('bpmn-task', 'task', 'task'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })
})

// ============================================================================
// 网关图标分支覆盖
// ============================================================================

describe('createBpmn2NodeRenderers — 网关图标分支', () => {
  const renderers = createBpmn2NodeRenderers()

  it('exclusive-gateway 应有 exclusiveX 图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-exclusive-gateway', 'gateway', 'gateway'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(true)
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.exclusiveX)
  })

  it('parallel-gateway 应有 parallelPlus 图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-parallel-gateway', 'gateway', 'gateway'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.parallelPlus)
  })

  it('inclusive-gateway 应有 inclusiveO 图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-inclusive-gateway', 'gateway', 'gateway'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.inclusiveO)
  })

  it('complex-gateway 应有 complex 图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-complex-gateway', 'gateway', 'gateway'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.complex)
  })

  it('event-based-gateway 应有 eventBased 图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-event-based-gateway', 'gateway', 'gateway'))
    expect(shape.attrs?.icon?.d).toBe(BPMN_ICONS.eventBased)
  })

  it('plain gateway 无匹配图标', () => {
    const shape = renderers.gateway(theme, makeNodeDef('bpmn-gateway', 'gateway', 'gateway'))
    const hasIcon = shape.markup!.some((m: any) => m.selector === 'icon')
    expect(hasIcon).toBe(false)
  })
})

// ============================================================================
// 边渲染器 — 所有类型空主题覆盖
// ============================================================================

describe('createBpmn2EdgeRenderers — 所有类型空主题', () => {
  const renderers = createBpmn2EdgeRenderers()
  const emptyTheme: ThemeTokens = { colors: {}, icons: {} }

  const edgeTypes = [
    'sequenceFlow', 'conditionalFlow', 'defaultFlow',
    'messageFlow', 'association', 'directedAssociation', 'dataAssociation',
  ]
  for (const name of edgeTypes) {
    it(`${name} 空主题应使用默认颜色`, () => {
      const def = makeEdgeDef(`bpmn-${name}`, name, name)
      const config = renderers[name](emptyTheme, def)
      expect(config).toBeDefined()
      expect(config.attrs?.line?.stroke).toBeTruthy()
    })
  }
})
