/**
 * BPMN 映射表辅助判断函数 — 补充单元测试
 *
 * 覆盖：isPoolShape、isLaneShape、isSwimlaneShape、isArtifactShape、
 * isBoundaryShape、isDefaultFlow、isConditionalFlow 的正向和反向用例。
 */

import { describe, it, expect } from 'vitest'
import { BpmnModdle } from 'bpmn-moddle'
import {
  NODE_MAPPING,
  EDGE_MAPPING,
  isPoolShape,
  isLaneShape,
  isSwimlaneShape,
  isArtifactShape,
  isBoundaryShape,
  isDefaultFlow,
  isConditionalFlow,
} from '../../../src/export/bpmn-mapping'
import {
  cloneBpmnXmlNameSettings,
  DEFAULT_BPMN_XML_NAME_SETTINGS,
  createBpmnElement,
  createBpmnElementTagRegex,
  createBpmnOpeningTagRegex,
  getBpmnAcceptedTagPrefixPattern,
  getBpmnLocalName,
  getBpmnModdleName,
  mergeBpmnXmlNameSettings,
  resolveBpmnXmlNameSettings,
} from '../../../src/utils/bpmn-xml-names'

// ============================================================================
// isPoolShape
// ============================================================================

describe('isPoolShape', () => {
  it('bpmn-pool 应为 true', () => {
    expect(isPoolShape('bpmn-pool')).toBe(true)
  })

  it('bpmn-lane 应为 false', () => {
    expect(isPoolShape('bpmn-lane')).toBe(false)
  })

  it('任务应为 false', () => {
    expect(isPoolShape('bpmn-user-task')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isPoolShape('')).toBe(false)
  })

  it('未知字符串应为 false', () => {
    expect(isPoolShape('pool')).toBe(false)
  })
})

// ============================================================================
// isLaneShape
// ============================================================================

describe('isLaneShape', () => {
  it('bpmn-lane 应为 true', () => {
    expect(isLaneShape('bpmn-lane')).toBe(true)
  })

  it('bpmn-pool 应为 false', () => {
    expect(isLaneShape('bpmn-pool')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isLaneShape('')).toBe(false)
  })
})

// ============================================================================
// isSwimlaneShape
// ============================================================================

describe('isSwimlaneShape', () => {
  it('bpmn-pool 应为 true', () => {
    expect(isSwimlaneShape('bpmn-pool')).toBe(true)
  })

  it('bpmn-lane 应为 true', () => {
    expect(isSwimlaneShape('bpmn-lane')).toBe(true)
  })

  it('bpmn-user-task 应为 false', () => {
    expect(isSwimlaneShape('bpmn-user-task')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isSwimlaneShape('')).toBe(false)
  })

  it('包含 pool 的随机字符串应为 false', () => {
    expect(isSwimlaneShape('my-pool')).toBe(false)
  })
})

// ============================================================================
// isArtifactShape
// ============================================================================

describe('isArtifactShape', () => {
  it('bpmn-text-annotation 应为 true', () => {
    expect(isArtifactShape('bpmn-text-annotation')).toBe(true)
  })

  it('bpmn-group 应为 true', () => {
    expect(isArtifactShape('bpmn-group')).toBe(true)
  })

  it('bpmn-pool 应为 false', () => {
    expect(isArtifactShape('bpmn-pool')).toBe(false)
  })

  it('bpmn-user-task 应为 false', () => {
    expect(isArtifactShape('bpmn-user-task')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isArtifactShape('')).toBe(false)
  })
})

// ============================================================================
// isBoundaryShape
// ============================================================================

describe('isBoundaryShape', () => {
  it('bpmn-boundary-event 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event')).toBe(true)
  })

  it('bpmn-boundary-event-timer 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-timer')).toBe(true)
  })

  it('bpmn-boundary-event-message 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-message')).toBe(true)
  })

  it('bpmn-boundary-event-error 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-error')).toBe(true)
  })

  it('bpmn-boundary-event-cancel 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-cancel')).toBe(true)
  })

  it('bpmn-boundary-event-compensation 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-compensation')).toBe(true)
  })

  it('bpmn-boundary-event-signal 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-signal')).toBe(true)
  })

  it('bpmn-boundary-event-multiple 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-multiple')).toBe(true)
  })

  it('bpmn-boundary-event-parallel-multiple 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-parallel-multiple')).toBe(true)
  })

  it('bpmn-boundary-event-non-interrupting 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-non-interrupting')).toBe(true)
  })

  it('bpmn-boundary-event-escalation 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-escalation')).toBe(true)
  })

  it('bpmn-boundary-event-conditional 应为 true', () => {
    expect(isBoundaryShape('bpmn-boundary-event-conditional')).toBe(true)
  })

  it('bpmn-start-event 应为 false', () => {
    expect(isBoundaryShape('bpmn-start-event')).toBe(false)
  })

  it('bpmn-end-event 应为 false', () => {
    expect(isBoundaryShape('bpmn-end-event')).toBe(false)
  })

  it('bpmn-user-task 应为 false', () => {
    expect(isBoundaryShape('bpmn-user-task')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isBoundaryShape('')).toBe(false)
  })

  it('不以 bpmn-boundary-event 开头但包含该子串的字符串应为 false', () => {
    expect(isBoundaryShape('x-bpmn-boundary-event')).toBe(false)
  })
})

// ============================================================================
// isDefaultFlow
// ============================================================================

describe('isDefaultFlow', () => {
  it('bpmn-default-flow 应为 true', () => {
    expect(isDefaultFlow('bpmn-default-flow')).toBe(true)
  })

  it('bpmn-sequence-flow 应为 false', () => {
    expect(isDefaultFlow('bpmn-sequence-flow')).toBe(false)
  })

  it('bpmn-conditional-flow 应为 false', () => {
    expect(isDefaultFlow('bpmn-conditional-flow')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isDefaultFlow('')).toBe(false)
  })
})

// ============================================================================
// isConditionalFlow
// ============================================================================

describe('isConditionalFlow', () => {
  it('bpmn-conditional-flow 应为 true', () => {
    expect(isConditionalFlow('bpmn-conditional-flow')).toBe(true)
  })

  it('bpmn-sequence-flow 应为 false', () => {
    expect(isConditionalFlow('bpmn-sequence-flow')).toBe(false)
  })

  it('bpmn-default-flow 应为 false', () => {
    expect(isConditionalFlow('bpmn-default-flow')).toBe(false)
  })

  it('空字符串应为 false', () => {
    expect(isConditionalFlow('')).toBe(false)
  })
})

// ============================================================================
// NODE_MAPPING 完整性
// ============================================================================

describe('NODE_MAPPING 完整性', () => {
  it('所有映射的 tag 应为非空字符串', () => {
    for (const [shape, mapping] of Object.entries(NODE_MAPPING)) {
      expect(mapping.tag, `${shape} 应有有效 tag`).toBeTruthy()
      expect(typeof mapping.tag).toBe('string')
    }
  })

  it('eventDefinition 字段（如有）应以 EventDefinition 结尾', () => {
    for (const [shape, mapping] of Object.entries(NODE_MAPPING)) {
      if (mapping.eventDefinition) {
        expect(
          mapping.eventDefinition,
          `${shape} 的 eventDefinition 应以 EventDefinition 结尾`,
        ).toMatch(/EventDefinition$/)
      }
    }
  })

  it('所有边界事件映射应有 cancelActivity 属性', () => {
    for (const [shape, mapping] of Object.entries(NODE_MAPPING)) {
      if (shape.startsWith('bpmn-boundary-event')) {
        expect(mapping.attrs?.cancelActivity, `${shape} 应有 cancelActivity`).toBeDefined()
      }
    }
  })
})

// ============================================================================
// EDGE_MAPPING 完整性
// ============================================================================

describe('EDGE_MAPPING 完整性', () => {
  it('所有映射的 tag 应为非空字符串', () => {
    for (const [shape, mapping] of Object.entries(EDGE_MAPPING)) {
      expect(mapping.tag, `${shape} 应有有效 tag`).toBeTruthy()
    }
  })

  it('顺序流类型不应标记为 collaboration', () => {
    expect(EDGE_MAPPING['bpmn-sequence-flow'].isCollaboration).toBeFalsy()
    expect(EDGE_MAPPING['bpmn-conditional-flow'].isCollaboration).toBeFalsy()
    expect(EDGE_MAPPING['bpmn-default-flow'].isCollaboration).toBeFalsy()
  })

  it('顺序流类型不应标记为 artifact', () => {
    expect(EDGE_MAPPING['bpmn-sequence-flow'].isArtifact).toBeFalsy()
    expect(EDGE_MAPPING['bpmn-conditional-flow'].isArtifact).toBeFalsy()
    expect(EDGE_MAPPING['bpmn-default-flow'].isArtifact).toBeFalsy()
  })
})

describe('BPMN XML 名称工具', () => {
  it('应提取本地名并保留空字符串兜底', () => {
    expect(getBpmnLocalName('bpmn:StartEvent')).toBe('startEvent')
    expect(getBpmnLocalName('StartEvent')).toBe('startEvent')
    expect(getBpmnLocalName('startEvent')).toBe('startEvent')
    expect(getBpmnLocalName(':')).toBe('')
    expect(getBpmnLocalName('')).toBe('')
  })

  it('应根据配置生成允许的标签前缀模式', () => {
    expect(getBpmnAcceptedTagPrefixPattern()).toBe('(?:\\w+:)?')
    expect(getBpmnAcceptedTagPrefixPattern({ acceptedTagPrefixes: [''] })).toBe('')
    expect(getBpmnAcceptedTagPrefixPattern({ acceptedTagPrefixes: ['flow'] })).toBe('flow:')
    expect(getBpmnAcceptedTagPrefixPattern({ acceptedTagPrefixes: ['', 'flow', 'alt'] })).toBe('(?:(?:flow|alt):)?')
  })

  it('应根据配置构建 opening/tag 正则', () => {
    const opening = createBpmnOpeningTagRegex('startEvent', { acceptedTagPrefixes: ['', 'flow'] })
    const element = createBpmnElementTagRegex(['startEvent'], { acceptedTagPrefixes: ['', 'flow'] })

    expect(opening.test('<startEvent id="Start_1">')).toBe(true)
    expect(opening.test('<flow:startEvent id="Start_1">')).toBe(true)
    expect(element.test('<flow:startEvent id="Start_1"></flow:startEvent>')).toBe(true)
  })

  it('应根据配置生成 moddle 名称并处理 createAny 特例', () => {
    const moddle = new BpmnModdle()
    const task = createBpmnElement(moddle, 'task', { id: 'Task_1' })
    const multiple = createBpmnElement(moddle, 'multipleEventDefinition', { id: 'Event_1' })

    expect(getBpmnModdleName('task')).toBe('bpmn:Task')
    expect(getBpmnModdleName('')).toBe('bpmn:')
    expect(getBpmnModdleName('multipleEventDefinition', DEFAULT_BPMN_XML_NAME_SETTINGS)).toBe('bpmn:multipleEventDefinition')
    expect(task.$type).toBe('bpmn:Task')
    expect((multiple as { name?: string }).name || multiple.$type).toBe('bpmn:multipleEventDefinition')
  })

  it('应解析并合并默认 XML 名称配置', () => {
    const resolved = resolveBpmnXmlNameSettings()
    const customized = resolveBpmnXmlNameSettings({
      acceptedTagPrefixes: ['', 'flow'],
      moddleNames: { task: 'flow:Task' },
      createModes: { formalExpression: 'create' },
    })
    const merged = mergeBpmnXmlNameSettings(resolved, {
      moddleNames: { task: 'bpmn:Task' },
      createModes: { formalExpression: 'create' },
    })

    expect(resolved.acceptedTagPrefixes).toEqual(['*'])
    expect(customized.acceptedTagPrefixes).toEqual(['', 'flow'])
    expect(customized.moddleNames).toBeDefined()
    expect(customized.createModes).toBeDefined()
    expect(merged?.moddleNames).toBeDefined()
    expect(merged?.createModes).toBeDefined()
    expect(customized.moddleNames?.task).toBe('flow:Task')
    expect(customized.createModes?.formalExpression).toBe('create')
    expect(merged?.moddleNames?.task).toBe('bpmn:Task')
    expect(merged?.createModes?.formalExpression).toBe('create')
    expect(merged?.createModes?.multipleEventDefinition).toBe('createAny')
  })

  it('应处理 clone/merge 的空输入与仅父级输入', () => {
    const cloned = cloneBpmnXmlNameSettings({
      moddlePrefix: 'bpmn',
      namespaceUri: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    })
    const parentOnly = mergeBpmnXmlNameSettings(DEFAULT_BPMN_XML_NAME_SETTINGS)
    const mergedWithoutCreateModes = mergeBpmnXmlNameSettings(DEFAULT_BPMN_XML_NAME_SETTINGS, {
      moddleNames: { serviceTask: 'bpmn:ServiceTask' },
    })

    expect(cloneBpmnXmlNameSettings()).toBeUndefined()
    expect(mergeBpmnXmlNameSettings()).toBeUndefined()
    expect(cloned?.acceptedTagPrefixes).toBeUndefined()
    expect(parentOnly?.acceptedTagPrefixes).toEqual(['*'])
    expect(mergedWithoutCreateModes?.createModes).toBeDefined()
    expect(mergedWithoutCreateModes?.moddleNames).toBeDefined()
    expect(mergedWithoutCreateModes?.createModes?.multipleEventDefinition).toBe('createAny')
    expect(mergedWithoutCreateModes?.moddleNames?.serviceTask).toBe('bpmn:ServiceTask')
  })

})
