import { describe, it, expect } from 'vitest'
import { buildTestXml } from '../../helpers/xml-test-utils'
import { parseBpmnXml } from '../../../src/import'
import {
  BPMN_BOUNDARY_EVENT_MESSAGE,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ERROR,
} from '../../../src/utils/constants'

describe('parseBpmnXml — 边界事件默认 cancelActivity 匹配', () => {
  it('省略 cancelActivity 时，消息/定时/错误边界事件应按 interrupting 默认值 true 匹配原图形', async () => {
    const xml = await buildTestXml({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'task', id: 'Task_1', name: '任务' },
          { kind: 'boundaryEvent', id: 'BE_MSG', attachedToRef: 'Task_1', cancelActivity: true, eventDefinition: 'messageEventDefinition' },
          { kind: 'boundaryEvent', id: 'BE_TIMER', attachedToRef: 'Task_1', cancelActivity: true, eventDefinition: 'timerEventDefinition' },
          { kind: 'boundaryEvent', id: 'BE_ERR', attachedToRef: 'Task_1', cancelActivity: true, eventDefinition: 'errorEventDefinition' },
        ],
      }],
      shapes: {
        Task_1: { id: 'Task_1', x: 160, y: 120, width: 100, height: 60 },
        BE_MSG: { id: 'BE_MSG', x: 175, y: 162, width: 36, height: 36 },
        BE_TIMER: { id: 'BE_TIMER', x: 205, y: 162, width: 36, height: 36 },
        BE_ERR: { id: 'BE_ERR', x: 235, y: 162, width: 36, height: 36 },
      },
    })

    const importData = await parseBpmnXml(xml)

    expect(importData.nodes.find((node) => node.id === 'BE_MSG')?.shape).toBe(BPMN_BOUNDARY_EVENT_MESSAGE)
    expect(importData.nodes.find((node) => node.id === 'BE_TIMER')?.shape).toBe(BPMN_BOUNDARY_EVENT_TIMER)
    expect(importData.nodes.find((node) => node.id === 'BE_ERR')?.shape).toBe(BPMN_BOUNDARY_EVENT_ERROR)
  })
})