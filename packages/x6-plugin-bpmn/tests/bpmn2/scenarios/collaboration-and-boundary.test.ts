import { afterEach, describe, expect, it } from 'vitest'
import { bpmnRoundtrip } from '../../helpers/roundtrip'
import { createScenarioGraphHelper } from '../../helpers/scenario-test-utils'
import { validateDiagram } from '../../../src/core/validation'
import {
  BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_END_EVENT,
  BPMN_LANE,
  BPMN_MESSAGE_FLOW,
  BPMN_POOL,
  BPMN_RECEIVE_TASK,
  BPMN_SEND_TASK,
  BPMN_SEQUENCE_FLOW,
  BPMN_START_EVENT,
  BPMN_TRANSACTION,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

const scenarioGraphHelper = createScenarioGraphHelper({
  nodeShapes: [
    BPMN_POOL,
    BPMN_LANE,
    BPMN_START_EVENT,
    BPMN_END_EVENT,
    BPMN_SEND_TASK,
    BPMN_RECEIVE_TASK,
    BPMN_TRANSACTION,
    BPMN_BOUNDARY_EVENT_CANCEL,
    BPMN_USER_TASK,
  ],
  edgeShapes: [BPMN_SEQUENCE_FLOW, BPMN_MESSAGE_FLOW],
})

afterEach(() => {
  scenarioGraphHelper.cleanupGraphs()
})

describe('业务场景 —— 协作与边界恢复', () => {
  it('应完整往返跨 Pool 的消息交接流程，并恢复泳道与参与者父链', async () => {
    // 规范来源：formal-11-01-03.pdf §9.2 Pool and Participant、§9.3 Message Flow。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/collaboration-message-flows.bpmn
    // 2. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 Collaboration / Participant / MessageFlow / Lane 定义。
    const { graph, importData, exportedXml } = await bpmnRoundtrip({
      processes: [
        {
          id: 'Process_Requester',
          isExecutable: true,
          elements: [
            {
              kind: 'laneSet',
              id: 'LaneSet_Requester',
              lanes: [{ id: 'Lane_Requester', name: '申请方', flowNodeRefs: ['Start_A', 'Send_A', 'End_A'] }],
            },
            { kind: 'startEvent', id: 'Start_A', name: '发起通知' },
            { kind: 'sendTask', id: 'Send_A', name: '发送请求' },
            { kind: 'endEvent', id: 'End_A', name: '申请完成' },
            { kind: 'sequenceFlow', id: 'Flow_A1', sourceRef: 'Start_A', targetRef: 'Send_A' },
            { kind: 'sequenceFlow', id: 'Flow_A2', sourceRef: 'Send_A', targetRef: 'End_A' },
          ],
        },
        {
          id: 'Process_Handler',
          isExecutable: true,
          elements: [
            {
              kind: 'laneSet',
              id: 'LaneSet_Handler',
              lanes: [{ id: 'Lane_Handler', name: '处理方', flowNodeRefs: ['Start_B', 'Receive_B', 'End_B'] }],
            },
            { kind: 'startEvent', id: 'Start_B', name: '等待处理' },
            { kind: 'receiveTask', id: 'Receive_B', name: '接收请求' },
            { kind: 'endEvent', id: 'End_B', name: '处理完成' },
            { kind: 'sequenceFlow', id: 'Flow_B1', sourceRef: 'Start_B', targetRef: 'Receive_B' },
            { kind: 'sequenceFlow', id: 'Flow_B2', sourceRef: 'Receive_B', targetRef: 'End_B' },
          ],
        },
      ],
      collaboration: {
        id: 'Collaboration_1',
        participants: [
          { id: 'Pool_Requester', name: '申请方池', processRef: 'Process_Requester' },
          { id: 'Pool_Handler', name: '处理方池', processRef: 'Process_Handler' },
        ],
        messageFlows: [
          { id: 'Message_Request', name: '业务请求', sourceRef: 'Send_A', targetRef: 'Receive_B' },
        ],
      },
      shapes: {
        Pool_Requester: { id: 'Pool_Requester', x: 40, y: 40, width: 620, height: 220, isHorizontal: true },
        Lane_Requester: { id: 'Lane_Requester', x: 70, y: 40, width: 590, height: 220, isHorizontal: true },
        Start_A: { id: 'Start_A', x: 120, y: 120, width: 36, height: 36 },
        Send_A: { id: 'Send_A', x: 240, y: 108, width: 120, height: 60 },
        End_A: { id: 'End_A', x: 430, y: 120, width: 36, height: 36 },
        Pool_Handler: { id: 'Pool_Handler', x: 40, y: 340, width: 620, height: 220, isHorizontal: true },
        Lane_Handler: { id: 'Lane_Handler', x: 70, y: 340, width: 590, height: 220, isHorizontal: true },
        Start_B: { id: 'Start_B', x: 120, y: 420, width: 36, height: 36 },
        Receive_B: { id: 'Receive_B', x: 240, y: 408, width: 120, height: 60 },
        End_B: { id: 'End_B', x: 430, y: 420, width: 36, height: 36 },
      },
      edges: {
        Flow_A1: { id: 'Flow_A1', waypoints: [{ x: 156, y: 138 }, { x: 240, y: 138 }] },
        Flow_A2: { id: 'Flow_A2', waypoints: [{ x: 360, y: 138 }, { x: 430, y: 138 }] },
        Flow_B1: { id: 'Flow_B1', waypoints: [{ x: 156, y: 438 }, { x: 240, y: 438 }] },
        Flow_B2: { id: 'Flow_B2', waypoints: [{ x: 360, y: 438 }, { x: 430, y: 438 }] },
        Message_Request: { id: 'Message_Request', waypoints: [{ x: 300, y: 168 }, { x: 300, y: 408 }] },
      },
    }, scenarioGraphHelper.createGraph)

    expect(importData.nodes.find((node) => node.id === 'Lane_Requester')?.parent).toBe('Pool_Requester')
    expect(importData.nodes.find((node) => node.id === 'Send_A')?.parent).toBe('Lane_Requester')
    expect(importData.nodes.find((node) => node.id === 'Receive_B')?.parent).toBe('Lane_Handler')

    expect(graph.getCellById('Lane_Requester')?.getParent?.()?.id).toBe('Pool_Requester')
    expect(graph.getCellById('Send_A')?.getParent?.()?.id).toBe('Lane_Requester')
    expect(graph.getCellById('Receive_B')?.getParent?.()?.id).toBe('Lane_Handler')
    expect(graph.getCellById('Message_Request')?.shape).toBe(BPMN_MESSAGE_FLOW)

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('<bpmn:collaboration id="Collaboration_1"')
    expect(exportedXml).toContain('<bpmn:participant id="Pool_Requester"')
    expect(exportedXml).toContain('<bpmn:messageFlow id="Message_Request"')
    expect(exportedXml).toContain('sourceRef="Send_A"')
    expect(exportedXml).toContain('targetRef="Receive_B"')
  })

  it('应完整往返事务取消边界事件恢复流程，并保持边界事件附着关系', async () => {
    // 规范来源：formal-11-01-03.pdf §10.2.5 Sub-Processes、§13.4.3 Intermediate Boundary Events。
    // 参照实现：
    // 1. packages/bpmn-js/test/fixtures/bpmn/draw/boundary-event-with-refnode.bpmn
    // 2. packages/bpmn-js/test/fixtures/bpmn/draw/activity-markers-simple.bpmn
    // 3. packages/bpmn-moddle/resources/bpmn/xsd/Semantic.xsd 中 BoundaryEvent / Transaction 定义。
    const { graph, importData, exportedXml } = await bpmnRoundtrip({
      processes: [{
        id: 'Process_Recovery',
        isExecutable: true,
        elements: [
          { kind: 'startEvent', id: 'Start_1', name: '发起事务' },
          { kind: 'transaction', id: 'Transaction_1', name: '事务处理' },
          { kind: 'boundaryEvent', id: 'Boundary_Cancel', name: '取消边界', attachedToRef: 'Transaction_1', eventDefinition: 'cancelEventDefinition' },
          { kind: 'userTask', id: 'Task_Recovery', name: '人工恢复' },
          { kind: 'endEvent', id: 'End_Success', name: '成功结束' },
          { kind: 'endEvent', id: 'End_Cancel', name: '取消结束' },
          { kind: 'sequenceFlow', id: 'Flow_Start_Transaction', sourceRef: 'Start_1', targetRef: 'Transaction_1' },
          { kind: 'sequenceFlow', id: 'Flow_Transaction_End', sourceRef: 'Transaction_1', targetRef: 'End_Success' },
          { kind: 'sequenceFlow', id: 'Flow_Cancel_Recovery', sourceRef: 'Boundary_Cancel', targetRef: 'Task_Recovery' },
          { kind: 'sequenceFlow', id: 'Flow_Recovery_End', sourceRef: 'Task_Recovery', targetRef: 'End_Cancel' },
        ],
      }],
      shapes: {
        Start_1: { id: 'Start_1', x: 80, y: 170, width: 36, height: 36 },
        Transaction_1: { id: 'Transaction_1', x: 180, y: 120, width: 180, height: 120, isExpanded: true },
        Boundary_Cancel: { id: 'Boundary_Cancel', x: 300, y: 222, width: 36, height: 36 },
        Task_Recovery: { id: 'Task_Recovery', x: 430, y: 260, width: 120, height: 60 },
        End_Success: { id: 'End_Success', x: 460, y: 150, width: 36, height: 36 },
        End_Cancel: { id: 'End_Cancel', x: 640, y: 272, width: 36, height: 36 },
      },
      edges: {
        Flow_Start_Transaction: { id: 'Flow_Start_Transaction', waypoints: [{ x: 116, y: 188 }, { x: 180, y: 188 }] },
        Flow_Transaction_End: { id: 'Flow_Transaction_End', waypoints: [{ x: 360, y: 188 }, { x: 460, y: 168 }] },
        Flow_Cancel_Recovery: { id: 'Flow_Cancel_Recovery', waypoints: [{ x: 336, y: 240 }, { x: 430, y: 290 }] },
        Flow_Recovery_End: { id: 'Flow_Recovery_End', waypoints: [{ x: 550, y: 290 }, { x: 640, y: 290 }] },
      },
    }, scenarioGraphHelper.createGraph)

    expect(importData.nodes.find((node) => node.id === 'Boundary_Cancel')?.parent).toBe('Transaction_1')
    expect(graph.getCellById('Boundary_Cancel')?.getParent?.()?.id).toBe('Transaction_1')
    expect(graph.getCellById('Transaction_1')?.shape).toBe(BPMN_TRANSACTION)

    const report = await validateDiagram(graph)
    expect(report.issues).toEqual([])
    expect(exportedXml).toContain('<bpmn:transaction id="Transaction_1"')
    expect(exportedXml).toContain('<bpmn:boundaryEvent id="Boundary_Cancel"')
    expect(exportedXml).toContain('attachedToRef="Transaction_1"')
    expect(exportedXml).toContain('<bpmn:cancelEventDefinition')
  })
})