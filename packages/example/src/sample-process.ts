import { Graph } from '@antv/x6'
import {
  attachBoundaryToHost,
  BPMN_START_EVENT,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ERROR,
  BPMN_BOUNDARY_EVENT_SIGNAL,
  BPMN_END_EVENT,
  BPMN_END_EVENT_ERROR,
  BPMN_END_EVENT_TERMINATE,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SEND_TASK,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_DATA_OBJECT,
  BPMN_DATA_STORE,
  BPMN_TEXT_ANNOTATION,
  BPMN_POOL,
  BPMN_LANE,
  BPMN_TRANSACTION,
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '@x6-bpmn2/plugin'

const QA_NAMESPACE_URI = 'http://x6-bpmn2.example/schema/qa'

function createSemanticBpmnData(
  attrs: Record<string, string> = {},
  extensionProps: Record<string, unknown> = {},
  diAttrs: Record<string, string> = {},
) {
  const hasAttrs = Object.keys(attrs).length > 0
  const hasExtensionProps = Object.keys(extensionProps).length > 0
  const hasDiAttrs = Object.keys(diAttrs).length > 0

  return {
    ...(hasAttrs || hasExtensionProps
      ? {
          bpmn: {
            ...(hasAttrs
              ? {
                  $attrs: attrs,
                  $namespaces: {
                    qa: QA_NAMESPACE_URI,
                  },
                }
              : {}),
            ...extensionProps,
          },
        }
      : {}),
    ...(hasDiAttrs
      ? {
          bpmndi: {
            $attrs: diAttrs,
            $namespaces: {
              qa: QA_NAMESPACE_URI,
            },
          },
        }
      : {}),
  }
}

/**
 * 创建默认的 BPMN 2.0 示例流程。
 */
export function createSampleProcess(graph: Graph) {
  graph.clearCells()

  // ========== 泳池与泳道 ==========
  const pool = graph.addNode({
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 1280,
    height: 480,
    attrs: { headerLabel: { text: '跨角色处理流程' } },
    data: createSemanticBpmnData(
      {
        'qa:participantKey': 'example-collaboration',
        'qa:tenant': 'semantic-lab',
      },
      {
        scenarioTag: 'default-graph',
        testOwner: 'example-team',
      },
      {
        'qa:laneSlot': 'collaboration-shell',
        'qa:renderHint': 'wide-pool',
      },
    ),
  })

  const applicantLane = graph.addNode({
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 1250,
    height: 220,
    attrs: { headerLabel: { text: '发起方' } },
    parent: pool.id,
  })

  const approverLane = graph.addNode({
    shape: BPMN_LANE,
    x: 70,
    y: 260,
    width: 1250,
    height: 260,
    attrs: { headerLabel: { text: '处理方' } },
    parent: pool.id,
  })

  pool.embed(applicantLane)
  pool.embed(approverLane)

  // ========== 开始事件 ==========
  const start = graph.addNode({
    shape: BPMN_START_EVENT,
    x: 120,
    y: 130,
    attrs: { label: { text: '发起\n处理' } },
    parent: applicantLane.id,
  })

  // ========== 发起方任务 ==========
  const fillForm = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 240,
    y: 115,
    attrs: { label: { text: '提交\n材料' } },
    parent: applicantLane.id,
    data: createSemanticBpmnData(
      {
        'qa:formRef': 'capture-sheet',
        'qa:uiHint': 'compact',
      },
      {
        formStage: 'capture',
        prefillEnabled: true,
      },
      {
        'qa:laneSlot': 'capture-card',
        'qa:anchorPreset': 'left-entry',
      },
    ),
  })

  // ========== 数据对象 ==========
  const leaveForm = graph.addNode({
    shape: BPMN_DATA_OBJECT,
    x: 285,
    y: 200,
    attrs: { label: { text: '处理单' } },
    parent: applicantLane.id,
  })

  // ========== 注释 ==========
  const annotation = graph.addNode({
    shape: BPMN_TEXT_ANNOTATION,
    x: 110,
    y: 50,
    attrs: { label: { text: '通过门户\n发起流程' } },
    parent: applicantLane.id,
  })

  // ========== 边界事件 ==========
  // 常规复核任务上附着定时边界事件
  const timerBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_TIMER,
    width: 36,
    height: 36,
    x: 0,  // 由 attachBoundaryToHost 重新定位到边框上
    y: 0,
    attrs: { label: { text: '超时\n提示' } },
  })

  // 高级复核任务上附着错误边界事件
  const errorBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_ERROR,
    width: 36,
    height: 36,
    x: 0,
    y: 0,
    attrs: { label: { text: '处理\n异常' } },
  })

  // 高级复核任务上附着信号边界事件
  const signalBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_SIGNAL,
    width: 36,
    height: 36,
    x: 0,
    y: 0,
    attrs: { label: { text: '终止\n信号' } },
  })

  // ========== 审批网关 ==========
  const gw1 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 390,
    y: 330,
    attrs: { label: { text: '需要\n复核?' } },
    parent: approverLane.id,
  })

  // ========== 常规复核 ==========
  const managerApprove = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 520,
    y: 290,
    attrs: { label: { text: '常规\n复核' } },
    parent: approverLane.id,
    data: createSemanticBpmnData(
      {
        'qa:roleHint': 'basic-review',
      },
      {
        reviewMode: 'guided',
      },
      {
        'qa:laneSlot': 'review-card',
      },
    ),
  })

  // ========== 高级复核 ==========
  const directorApprove = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 520,
    y: 400,
    attrs: { label: { text: '高级\n复核' } },
    parent: approverLane.id,
    data: createSemanticBpmnData(
      {
        'qa:roleHint': 'advanced-review',
      },
      {
        reviewMode: 'escalated',
        notifyExternal: false,
      },
    ),
  })

  // ========== 审批结果网关 ==========
  const gw2 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 710,
    y: 330,
    attrs: { label: { text: '结果\n通过?' } },
    parent: approverLane.id,
  })

  // ========== 发送通知 ==========
  const notify = graph.addNode({
    shape: BPMN_SEND_TASK,
    x: 840,
    y: 315,
    attrs: { label: { text: '发送\n结果' } },
    parent: approverLane.id,
    data: createSemanticBpmnData(
      {
        'qa:channel': 'async-feedback',
      },
      {
        deliveryProfile: 'standard',
      },
      {
        'qa:laneSlot': 'result-card',
        'qa:renderHint': 'async-output',
      },
    ),
  })

  // ========== 归档更新事务 ==========
  const attendanceTransaction = graph.addNode({
    shape: BPMN_TRANSACTION,
    x: 540,
    y: 85,
    width: 280,
    height: 120,
    zIndex: -1,
    attrs: { label: { text: '归档更新事务' } },
    parent: applicantLane.id,
  })

  const transactionStart = graph.addNode({
    shape: BPMN_START_EVENT,
    x: 570,
    y: 127,
    zIndex: 1,
    attrs: { label: { text: '开始' } },
    parent: attendanceTransaction.id,
  })

  const updateAttendance = graph.addNode({
    shape: BPMN_SERVICE_TASK,
    x: 635,
    y: 113,
    zIndex: 1,
    attrs: { label: { text: '更新\n归档记录' } },
    parent: attendanceTransaction.id,
  })

  const transactionEnd = graph.addNode({
    shape: BPMN_END_EVENT,
    x: 760,
    y: 127,
    zIndex: 1,
    attrs: { label: { text: '完成' } },
    parent: attendanceTransaction.id,
  })

  // ========== 数据存储 ==========
  const attendanceDB = graph.addNode({
    shape: BPMN_DATA_STORE,
    x: 900,
    y: 115,
    attrs: { label: { text: '归档\n数据库' } },
    parent: applicantLane.id,
  })

  // ========== 需补充处理 ==========
  const rejectModify = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 840,
    y: 425,
    attrs: { label: { text: '补充\n材料' } },
    parent: approverLane.id,
  })

  // ========== 再次提交网关 ==========
  const gw3 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 1010,
    y: 430,
    attrs: { label: { text: '再次\n提交?' } },
    parent: approverLane.id,
  })

  // ========== 结束事件 ==========
  const endOk = graph.addNode({
    shape: BPMN_END_EVENT,
    x: 1140,
    y: 130,
    attrs: { label: { text: '处理\n完成' } },
    parent: applicantLane.id,
  })

  const endCancel = graph.addNode({
    shape: BPMN_END_EVENT_TERMINATE,
    x: 1150,
    y: 435,
    attrs: { label: { text: '结束\n流程' } },
    parent: approverLane.id,
  })

  // 错误结束事件
  const endError = graph.addNode({
    shape: BPMN_END_EVENT_ERROR,
    x: 1150,
    y: 310,
    attrs: { label: { text: '异常\n结束' } },
    parent: approverLane.id,
  })

  applicantLane.embed(start)
  applicantLane.embed(fillForm)
  applicantLane.embed(leaveForm)
  applicantLane.embed(annotation)
  applicantLane.embed(attendanceTransaction)
  applicantLane.embed(attendanceDB)
  applicantLane.embed(endOk)

  attendanceTransaction.embed(transactionStart)
  attendanceTransaction.embed(updateAttendance)
  attendanceTransaction.embed(transactionEnd)

  approverLane.embed(gw1)
  approverLane.embed(managerApprove)
  approverLane.embed(directorApprove)
  approverLane.embed(gw2)
  approverLane.embed(notify)
  approverLane.embed(rejectModify)
  approverLane.embed(gw3)
  approverLane.embed(endCancel)
  approverLane.embed(endError)

  // ========== 附着边界事件到宿主任务 ==========
  // 定时器边界 → 常规复核
  attachBoundaryToHost(graph, timerBoundary, managerApprove)
  // 错误边界 → 高级复核
  attachBoundaryToHost(graph, errorBoundary, directorApprove)
  // 信号边界 → 高级复核
  attachBoundaryToHost(graph, signalBoundary, directorApprove)

  // ========== 连线 ==========
  // 发起方流程
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: fillForm })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: fillForm, target: gw1 })

  // 根据是否需要高级复核分支
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw1,
    target: managerApprove,
    labels: [{ attrs: { label: { text: '否' } } }],
  })
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw1,
    target: directorApprove,
    labels: [{ attrs: { label: { text: '是' } } }],
  })

  // 汇聚到处理结果
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: managerApprove, target: gw2 })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: directorApprove, target: gw2 })

  // 审批通过
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw2,
    target: notify,
    labels: [{ attrs: { label: { text: '通过' } } }],
    data: createSemanticBpmnData(
      {
        'qa:routeCode': 'approved-route',
      },
      {
        expectedBranch: 'approved',
      },
      {
        'qa:pathHint': 'approved-upper-branch',
      },
    ),
  })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: notify, target: attendanceTransaction })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: attendanceTransaction, target: endOk })
  const transactionFlowStart = graph.addEdge({
    shape: BPMN_SEQUENCE_FLOW,
    source: transactionStart,
    target: updateAttendance,
    zIndex: 0,
  })
  const transactionFlowEnd = graph.addEdge({
    shape: BPMN_SEQUENCE_FLOW,
    source: updateAttendance,
    target: transactionEnd,
    zIndex: 0,
  })
  attendanceTransaction.embed(transactionFlowStart)
  attendanceTransaction.embed(transactionFlowEnd)

  // 审批驳回
  graph.addEdge({
    shape: BPMN_DEFAULT_FLOW,
    source: gw2,
    target: rejectModify,
    labels: [{ attrs: { label: { text: '需补充' } } }],
    data: createSemanticBpmnData(
      {
        'qa:routeCode': 'rework-route',
      },
      {
        expectedBranch: 'rework',
      },
      {
        'qa:pathHint': 'rework-lower-branch',
      },
    ),
  })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: rejectModify, target: gw3 })
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw3,
    target: gw1,
    labels: [{ attrs: { label: { text: '是' } } }],
  })
  graph.addEdge({
    shape: BPMN_DEFAULT_FLOW,
    source: gw3,
    target: endCancel,
    labels: [{ attrs: { label: { text: '否' } } }],
  })

  // 数据关联
  graph.addEdge({ shape: BPMN_DATA_ASSOCIATION, source: fillForm, target: leaveForm })
  graph.addEdge({ shape: BPMN_DATA_ASSOCIATION, source: updateAttendance, target: attendanceDB })

  // 注释关联
  graph.addEdge({ shape: BPMN_ASSOCIATION, source: annotation, target: start })

  // 边界事件出口
  // 定时器超时 → 发送通知（超时后也通知）
  graph.addEdge({
    shape: BPMN_SEQUENCE_FLOW,
    source: timerBoundary,
    target: notify,
    labels: [{ attrs: { label: { text: '超时' } } }],
  })
  // 错误边界 → 异常终止
  graph.addEdge({
    shape: BPMN_SEQUENCE_FLOW,
    source: errorBoundary,
    target: endError,
    labels: [{ attrs: { label: { text: '异常' } } }],
  })
  // 信号边界 → 撤销申请终止
  graph.addEdge({
    shape: BPMN_SEQUENCE_FLOW,
    source: signalBoundary,
    target: endCancel,
    labels: [{ attrs: { label: { text: '终止' } } }],
  })
}
