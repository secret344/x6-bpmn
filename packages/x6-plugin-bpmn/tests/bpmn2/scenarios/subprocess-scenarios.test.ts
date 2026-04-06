import { afterEach, describe, expect, it } from 'vitest'
import { bpmnRoundtrip } from '../../helpers/roundtrip'
import { createScenarioGraphHelper } from '../../helpers/scenario-test-utils'
import { validateDiagram } from '../../../src/core/validation'
import {
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_END_EVENT,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_MANUAL_TASK,
  BPMN_SEQUENCE_FLOW,
  BPMN_START_EVENT,
  BPMN_START_EVENT_MESSAGE,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

const scenarioGraphHelper = createScenarioGraphHelper({
  nodeShapes: [
    BPMN_START_EVENT,
    BPMN_START_EVENT_MESSAGE,
    BPMN_END_EVENT,
    BPMN_USER_TASK,
    BPMN_MANUAL_TASK,
    BPMN_EVENT_SUB_PROCESS,
    BPMN_AD_HOC_SUB_PROCESS,
  ],
  edgeShapes: [BPMN_SEQUENCE_FLOW],
})

afterEach(() => {
  scenarioGraphHelper.cleanupGraphs()
})

describe('业务场景 —— 子流程编排', () => {
  it('应完整往返带内部处理链路的事件子流程', async () => {
    // 规范来源：formal-11-01-03.pdf §13.4.4 Event Sub-Processes。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/event-sub-processes.bpmn
    // 2. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 SubProcess / StartEvent 定义。
    const { graph, importData, exportedXml } = await bpmnRoundtrip({
      processes: [{
        id: 'Process_Exception',
        isExecutable: true,
        elements: [
          { kind: 'startEvent', id: 'Start_Main', name: '主流程开始' },
          { kind: 'userTask', id: 'Task_Main', name: '主线处理' },
          { kind: 'endEvent', id: 'End_Main', name: '主流程结束' },
          { kind: 'subProcess', id: 'EventSub_1', name: '补件事件子流程', triggeredByEvent: true },
          {
            kind: 'startEvent',
            id: 'Start_Message',
            name: '收到补件通知',
            eventDefinition: 'messageEventDefinition',
            parentRef: 'EventSub_1',
          },
          { kind: 'userTask', id: 'Task_Recheck', name: '补件复核', parentRef: 'EventSub_1' },
          { kind: 'endEvent', id: 'End_EventSub', name: '事件处理完成', parentRef: 'EventSub_1' },
          { kind: 'sequenceFlow', id: 'Flow_Main_1', sourceRef: 'Start_Main', targetRef: 'Task_Main' },
          { kind: 'sequenceFlow', id: 'Flow_Main_2', sourceRef: 'Task_Main', targetRef: 'End_Main' },
          { kind: 'sequenceFlow', id: 'Flow_Event_1', sourceRef: 'Start_Message', targetRef: 'Task_Recheck', parentRef: 'EventSub_1' },
          { kind: 'sequenceFlow', id: 'Flow_Event_2', sourceRef: 'Task_Recheck', targetRef: 'End_EventSub', parentRef: 'EventSub_1' },
        ],
      }],
      shapes: {
        Start_Main: { id: 'Start_Main', x: 80, y: 110, width: 36, height: 36 },
        Task_Main: { id: 'Task_Main', x: 170, y: 98, width: 120, height: 60 },
        End_Main: { id: 'End_Main', x: 350, y: 110, width: 36, height: 36 },
        EventSub_1: { id: 'EventSub_1', x: 80, y: 240, width: 360, height: 180, isExpanded: true },
        Start_Message: { id: 'Start_Message', x: 120, y: 305, width: 36, height: 36 },
        Task_Recheck: { id: 'Task_Recheck', x: 210, y: 292, width: 120, height: 60 },
        End_EventSub: { id: 'End_EventSub', x: 370, y: 305, width: 36, height: 36 },
      },
      edges: {
        Flow_Main_1: { id: 'Flow_Main_1', waypoints: [{ x: 116, y: 128 }, { x: 170, y: 128 }] },
        Flow_Main_2: { id: 'Flow_Main_2', waypoints: [{ x: 290, y: 128 }, { x: 350, y: 128 }] },
        Flow_Event_1: { id: 'Flow_Event_1', waypoints: [{ x: 156, y: 323 }, { x: 210, y: 323 }] },
        Flow_Event_2: { id: 'Flow_Event_2', waypoints: [{ x: 330, y: 323 }, { x: 370, y: 323 }] },
      },
    }, scenarioGraphHelper.createGraph)

    expect(graph.getCellById('EventSub_1')?.shape).toBe(BPMN_EVENT_SUB_PROCESS)
    expect(graph.getCellById('Start_Message')?.shape).toBe(BPMN_START_EVENT_MESSAGE)
    expect(importData.nodes.find((node) => node.id === 'Start_Message')?.parent).toBe('EventSub_1')
    expect(importData.nodes.find((node) => node.id === 'Task_Recheck')?.parent).toBe('EventSub_1')
    expect(importData.nodes.find((node) => node.id === 'End_EventSub')?.parent).toBe('EventSub_1')
    expect(graph.getCellById('Start_Message')?.getParent?.()?.id).toBe('EventSub_1')
    expect(graph.getCellById('Task_Recheck')?.getParent?.()?.id).toBe('EventSub_1')
    expect(graph.getCellById('End_EventSub')?.getParent?.()?.id).toBe('EventSub_1')

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('<bpmn:subProcess id="EventSub_1"')
    expect(exportedXml).toContain('triggeredByEvent="true"')
    expect(exportedXml).toContain('<bpmn:startEvent id="Start_Message"')
    expect(exportedXml).toContain('<bpmn:sequenceFlow id="Flow_Event_1"')
  })

  it('应完整往返带内部自由任务集的 ad-hoc 子流程', async () => {
    // 规范来源：formal-11-01-03.pdf §13.2.5 Ad-Hoc Sub-Process。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/draw/activity-markers-simple.bpmn
    // 2. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 AdHocSubProcess 定义。
    const { graph, importData, exportedXml } = await bpmnRoundtrip({
      processes: [{
        id: 'Process_Assessment',
        isExecutable: true,
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '评估开始' },
          { kind: 'adHocSubProcess', id: 'AdHoc_1', name: '现场评估' },
          { kind: 'endEvent', id: 'End_1', name: '评估完成' },
          { kind: 'manualTask', id: 'Task_Document', name: '资料核查', parentRef: 'AdHoc_1' },
          { kind: 'userTask', id: 'Task_Onsite', name: '现场走访', parentRef: 'AdHoc_1' },
          { kind: 'sequenceFlow', id: 'Flow_1', sourceRef: 'Start_1', targetRef: 'AdHoc_1' },
          { kind: 'sequenceFlow', id: 'Flow_2', sourceRef: 'AdHoc_1', targetRef: 'End_1' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 80, y: 180, width: 36, height: 36 },
        AdHoc_1: { id: 'AdHoc_1', x: 170, y: 120, width: 340, height: 180, isExpanded: true },
        End_1: { id: 'End_1', x: 580, y: 180, width: 36, height: 36 },
        Task_Document: { id: 'Task_Document', x: 220, y: 150, width: 120, height: 60 },
        Task_Onsite: { id: 'Task_Onsite', x: 360, y: 220, width: 120, height: 60 },
      },
      edges: {
        Flow_1: { id: 'Flow_1', waypoints: [{ x: 116, y: 198 }, { x: 170, y: 198 }] },
        Flow_2: { id: 'Flow_2', waypoints: [{ x: 510, y: 198 }, { x: 580, y: 198 }] },
      },
    }, scenarioGraphHelper.createGraph)

    expect(graph.getCellById('AdHoc_1')?.shape).toBe(BPMN_AD_HOC_SUB_PROCESS)
    expect(graph.getCellById('Task_Document')?.shape).toBe(BPMN_MANUAL_TASK)
    expect(graph.getCellById('Task_Onsite')?.shape).toBe(BPMN_USER_TASK)
    expect(importData.nodes.find((node) => node.id === 'Task_Document')?.parent).toBe('AdHoc_1')
    expect(importData.nodes.find((node) => node.id === 'Task_Onsite')?.parent).toBe('AdHoc_1')
    expect(graph.getCellById('Task_Document')?.getParent?.()?.id).toBe('AdHoc_1')
    expect(graph.getCellById('Task_Onsite')?.getParent?.()?.id).toBe('AdHoc_1')

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('<bpmn:adHocSubProcess id="AdHoc_1"')
    expect(exportedXml).toContain('<bpmn:manualTask id="Task_Document"')
    expect(exportedXml).toContain('<bpmn:userTask id="Task_Onsite"')
    expect(exportedXml).toContain('<bpmn:sequenceFlow id="Flow_1"')
    expect(exportedXml).toContain('<bpmn:sequenceFlow id="Flow_2"')
  })
})