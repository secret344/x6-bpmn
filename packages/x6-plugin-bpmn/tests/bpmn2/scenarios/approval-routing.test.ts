import { afterEach, describe, expect, it } from 'vitest'
import { bpmnRoundtrip } from '../../helpers/roundtrip'
import { createScenarioGraphHelper } from '../../helpers/scenario-test-utils'
import { validateDiagram } from '../../../src/core/validation'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_END_EVENT,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_START_EVENT,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

const scenarioGraphHelper = createScenarioGraphHelper({
  nodeShapes: [
    BPMN_START_EVENT,
    BPMN_END_EVENT,
    BPMN_USER_TASK,
    BPMN_SERVICE_TASK,
    BPMN_EXCLUSIVE_GATEWAY,
    BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
    BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
    BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  ],
  edgeShapes: [BPMN_SEQUENCE_FLOW, BPMN_CONDITIONAL_FLOW, BPMN_DEFAULT_FLOW],
})

afterEach(() => {
  scenarioGraphHelper.cleanupGraphs()
})

describe('业务场景 —— 审批路由', () => {
  it('应完整往返排他网关审批分支，并保留条件流与默认流', async () => {
    // 规范来源：formal-11-01-03.pdf §10.5 Gateway、§13 BPMN Execution Semantics。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/draw/conditional-flow-gateways.bpmn
    // 2. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 Gateway / SequenceFlow 定义。
    const { graph, exportedXml } = await bpmnRoundtrip({
      processes: [{
        id: 'Process_Approval',
        isExecutable: true,
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '提交申请' },
          { kind: 'userTask', id: 'Task_Review', name: '人工复核' },
          { kind: 'exclusiveGateway', id: 'Gateway_Review', name: '金额判断', default: 'Flow_Default_Manual' },
          { kind: 'serviceTask', id: 'Task_AutoApprove', name: '自动通过' },
          { kind: 'userTask', id: 'Task_ManualApprove', name: '人工审批' },
          { kind: 'endEvent', id: 'End_Approved', name: '审批结束' },
          { kind: 'sequenceFlow', id: 'Flow_Start_Review', sourceRef: 'Start_1', targetRef: 'Task_Review' },
          { kind: 'sequenceFlow', id: 'Flow_Review_Gateway', sourceRef: 'Task_Review', targetRef: 'Gateway_Review' },
          {
            kind: 'sequenceFlow',
            id: 'Flow_Condition_Auto',
            sourceRef: 'Gateway_Review',
            targetRef: 'Task_AutoApprove',
            hasCondition: true,
            conditionBody: '${amount < 1000}',
          },
          { kind: 'sequenceFlow', id: 'Flow_Default_Manual', sourceRef: 'Gateway_Review', targetRef: 'Task_ManualApprove' },
          { kind: 'sequenceFlow', id: 'Flow_Auto_End', sourceRef: 'Task_AutoApprove', targetRef: 'End_Approved' },
          { kind: 'sequenceFlow', id: 'Flow_Manual_End', sourceRef: 'Task_ManualApprove', targetRef: 'End_Approved' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 80, y: 160, width: 36, height: 36 },
        Task_Review: { id: 'Task_Review', x: 160, y: 148, width: 120, height: 60 },
        Gateway_Review: { id: 'Gateway_Review', x: 330, y: 152, width: 50, height: 50 },
        Task_AutoApprove: { id: 'Task_AutoApprove', x: 450, y: 80, width: 120, height: 60 },
        Task_ManualApprove: { id: 'Task_ManualApprove', x: 450, y: 230, width: 120, height: 60 },
        End_Approved: { id: 'End_Approved', x: 650, y: 160, width: 36, height: 36 },
      },
      edges: {
        Flow_Start_Review: { id: 'Flow_Start_Review', waypoints: [{ x: 116, y: 178 }, { x: 160, y: 178 }] },
        Flow_Review_Gateway: { id: 'Flow_Review_Gateway', waypoints: [{ x: 280, y: 178 }, { x: 330, y: 178 }] },
        Flow_Condition_Auto: { id: 'Flow_Condition_Auto', waypoints: [{ x: 380, y: 178 }, { x: 450, y: 110 }] },
        Flow_Default_Manual: { id: 'Flow_Default_Manual', waypoints: [{ x: 380, y: 178 }, { x: 450, y: 260 }] },
        Flow_Auto_End: { id: 'Flow_Auto_End', waypoints: [{ x: 570, y: 110 }, { x: 650, y: 178 }] },
        Flow_Manual_End: { id: 'Flow_Manual_End', waypoints: [{ x: 570, y: 260 }, { x: 650, y: 178 }] },
      },
    }, scenarioGraphHelper.createGraph)

    const conditionEdge = graph.getCellById('Flow_Condition_Auto')
    const defaultEdge = graph.getCellById('Flow_Default_Manual')
    expect(conditionEdge?.isEdge?.()).toBe(true)
    expect(defaultEdge?.isEdge?.()).toBe(true)
    expect(conditionEdge?.shape).toBe(BPMN_CONDITIONAL_FLOW)
    expect(defaultEdge?.shape).toBe(BPMN_DEFAULT_FLOW)

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('default="Flow_Default_Manual"')
    expect(exportedXml).toContain('<bpmn:conditionExpression')
    expect(exportedXml).toContain('id="Flow_Condition_Auto"')
  })

  it('应完整往返事件网关等待消息或超时的业务流', async () => {
    // 规范来源：formal-11-01-03.pdf §10.5.6 Event-Based Gateway。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/features/rules/event-based-gateway-outgoing-edge.bpmn
    // 2. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 EventBasedGateway 定义。
    const { graph, exportedXml } = await bpmnRoundtrip({
      processes: [{
        id: 'Process_Waiting',
        isExecutable: true,
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '发起等待' },
          { kind: 'eventBasedGateway', id: 'Gateway_Waiting', name: '等待触发' },
          { kind: 'intermediateCatchEvent', id: 'Catch_Message', name: '收到回执', eventDefinition: 'messageEventDefinition' },
          { kind: 'intermediateCatchEvent', id: 'Catch_Timer', name: '等待超时', eventDefinition: 'timerEventDefinition' },
          { kind: 'serviceTask', id: 'Task_ProcessReply', name: '处理回执' },
          { kind: 'userTask', id: 'Task_TimeoutFollowup', name: '超时跟进' },
          { kind: 'endEvent', id: 'End_1', name: '流程结束' },
          { kind: 'sequenceFlow', id: 'Flow_Start_Gateway', sourceRef: 'Start_1', targetRef: 'Gateway_Waiting' },
          { kind: 'sequenceFlow', id: 'Flow_Gateway_Message', sourceRef: 'Gateway_Waiting', targetRef: 'Catch_Message' },
          { kind: 'sequenceFlow', id: 'Flow_Gateway_Timer', sourceRef: 'Gateway_Waiting', targetRef: 'Catch_Timer' },
          { kind: 'sequenceFlow', id: 'Flow_Message_Task', sourceRef: 'Catch_Message', targetRef: 'Task_ProcessReply' },
          { kind: 'sequenceFlow', id: 'Flow_Timer_Task', sourceRef: 'Catch_Timer', targetRef: 'Task_TimeoutFollowup' },
          { kind: 'sequenceFlow', id: 'Flow_Reply_End', sourceRef: 'Task_ProcessReply', targetRef: 'End_1' },
          { kind: 'sequenceFlow', id: 'Flow_Timeout_End', sourceRef: 'Task_TimeoutFollowup', targetRef: 'End_1' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 80, y: 170, width: 36, height: 36 },
        Gateway_Waiting: { id: 'Gateway_Waiting', x: 200, y: 163, width: 50, height: 50 },
        Catch_Message: { id: 'Catch_Message', x: 340, y: 90, width: 36, height: 36 },
        Catch_Timer: { id: 'Catch_Timer', x: 340, y: 250, width: 36, height: 36 },
        Task_ProcessReply: { id: 'Task_ProcessReply', x: 430, y: 78, width: 120, height: 60 },
        Task_TimeoutFollowup: { id: 'Task_TimeoutFollowup', x: 430, y: 238, width: 120, height: 60 },
        End_1: { id: 'End_1', x: 650, y: 170, width: 36, height: 36 },
      },
      edges: {
        Flow_Start_Gateway: { id: 'Flow_Start_Gateway', waypoints: [{ x: 116, y: 188 }, { x: 200, y: 188 }] },
        Flow_Gateway_Message: { id: 'Flow_Gateway_Message', waypoints: [{ x: 250, y: 188 }, { x: 340, y: 108 }] },
        Flow_Gateway_Timer: { id: 'Flow_Gateway_Timer', waypoints: [{ x: 250, y: 188 }, { x: 340, y: 268 }] },
        Flow_Message_Task: { id: 'Flow_Message_Task', waypoints: [{ x: 376, y: 108 }, { x: 430, y: 108 }] },
        Flow_Timer_Task: { id: 'Flow_Timer_Task', waypoints: [{ x: 376, y: 268 }, { x: 430, y: 268 }] },
        Flow_Reply_End: { id: 'Flow_Reply_End', waypoints: [{ x: 550, y: 108 }, { x: 650, y: 188 }] },
        Flow_Timeout_End: { id: 'Flow_Timeout_End', waypoints: [{ x: 550, y: 268 }, { x: 650, y: 188 }] },
      },
    }, scenarioGraphHelper.createGraph)

    expect(graph.getCellById('Gateway_Waiting')?.shape).toBe(BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY)
    expect(graph.getCellById('Catch_Message')?.shape).toBe(BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE)
    expect(graph.getCellById('Catch_Timer')?.shape).toBe(BPMN_INTERMEDIATE_CATCH_EVENT_TIMER)

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('<bpmn:eventBasedGateway id="Gateway_Waiting"')
    expect(exportedXml).toContain('<bpmn:messageEventDefinition')
    expect(exportedXml).toContain('<bpmn:timerEventDefinition')
  })
})