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
  BPMN_SEQUENCE_FLOW,
  BPMN_CONDITIONAL_FLOW,
  BPMN_DEFAULT_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from '@x6-bpmn2/plugin'

/**
 * 创建默认的 BPMN 2.0 示例流程 — 员工请假审批流程
 */
export function createSampleProcess(graph: Graph) {
  graph.clearCells()

  // ========== 泳池与泳道 ==========
  const pool = graph.addNode({
    shape: BPMN_POOL,
    x: 40,
    y: 40,
    width: 1100,
    height: 460,
    attrs: { headerLabel: { text: '员工请假审批流程' } },
  })

  graph.addNode({
    shape: BPMN_LANE,
    x: 70,
    y: 40,
    width: 1070,
    height: 200,
    attrs: { headerLabel: { text: '申请人' } },
    parent: pool.id,
  })

  graph.addNode({
    shape: BPMN_LANE,
    x: 70,
    y: 240,
    width: 1070,
    height: 260,
    attrs: { headerLabel: { text: '审批人' } },
    parent: pool.id,
  })

  // ========== 开始事件 ==========
  const start = graph.addNode({
    shape: BPMN_START_EVENT,
    x: 120,
    y: 120,
    attrs: { label: { text: '发起\n申请' } },
  })

  // ========== 申请人任务 ==========
  const fillForm = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 210,
    y: 105,
    attrs: { label: { text: '填写\n请假单' } },
  })

  // ========== 数据对象 ==========
  const leaveForm = graph.addNode({
    shape: BPMN_DATA_OBJECT,
    x: 230,
    y: 190,
    attrs: { label: { text: '请假单' } },
  })

  // ========== 注释 ==========
  const annotation = graph.addNode({
    shape: BPMN_TEXT_ANNOTATION,
    x: 110,
    y: 50,
    attrs: { label: { text: '员工通过\nOA系统发起' } },
  })

  // ========== 边界事件 ==========
  // 主管审批任务上附着定时边界事件（超时提醒）
  const timerBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_TIMER,
    width: 36,
    height: 36,
    x: 0,  // 由 attachBoundaryToHost 重新定位到边框上
    y: 0,
    attrs: { label: { text: '超时\n提醒' } },
  })

  // 总监审批任务上附着错误边界事件（审批异常）
  const errorBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_ERROR,
    width: 36,
    height: 36,
    x: 0,
    y: 0,
    attrs: { label: { text: '审批\n异常' } },
  })

  // 总监审批任务上附着信号边界事件（取消信号）
  const signalBoundary = graph.addNode({
    shape: BPMN_BOUNDARY_EVENT_SIGNAL,
    width: 36,
    height: 36,
    x: 0,
    y: 0,
    attrs: { label: { text: '取消\n信号' } },
  })

  // ========== 审批网关 ==========
  const gw1 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 370,
    y: 300,
    attrs: { label: { text: '天数?' } },
  })

  // ========== 主管审批 ==========
  const managerApprove = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 470,
    y: 260,
    attrs: { label: { text: '主管\n审批' } },
  })

  // ========== 总监审批 ==========
  const directorApprove = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 470,
    y: 370,
    attrs: { label: { text: '总监\n审批' } },
  })

  // ========== 审批结果网关 ==========
  const gw2 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 620,
    y: 300,
    attrs: { label: { text: '通过?' } },
  })

  // ========== 发送通知 ==========
  const notify = graph.addNode({
    shape: BPMN_SEND_TASK,
    x: 730,
    y: 285,
    attrs: { label: { text: '发送\n通知' } },
  })

  // ========== 更新考勤 ==========
  const updateAttendance = graph.addNode({
    shape: BPMN_SERVICE_TASK,
    x: 730,
    y: 105,
    attrs: { label: { text: '更新\n考勤系统' } },
  })

  // ========== 数据存储 ==========
  const attendanceDB = graph.addNode({
    shape: BPMN_DATA_STORE,
    x: 870,
    y: 105,
    attrs: { label: { text: '考勤\n数据库' } },
  })

  // ========== 驳回 — 修改申请 ==========
  const rejectModify = graph.addNode({
    shape: BPMN_USER_TASK,
    x: 730,
    y: 395,
    attrs: { label: { text: '修改\n申请' } },
  })

  // ========== 重新提交网关 ==========
  const gw3 = graph.addNode({
    shape: BPMN_EXCLUSIVE_GATEWAY,
    x: 880,
    y: 400,
    attrs: { label: { text: '重新\n提交?' } },
  })

  // ========== 结束事件 ==========
  const endOk = graph.addNode({
    shape: BPMN_END_EVENT,
    x: 1000,
    y: 120,
    attrs: { label: { text: '审批\n完成' } },
  })

  const endCancel = graph.addNode({
    shape: BPMN_END_EVENT_TERMINATE,
    x: 1000,
    y: 405,
    attrs: { label: { text: '撤销\n申请' } },
  })

  // 错误结束（异常终止）
  const endError = graph.addNode({
    shape: BPMN_END_EVENT_ERROR,
    x: 1000,
    y: 280,
    attrs: { label: { text: '异常\n终止' } },
  })

  // ========== 附着边界事件到宿主任务 ==========
  // 定时器边界 → 主管审批（超时提醒）
  attachBoundaryToHost(graph, timerBoundary, managerApprove)
  // 错误边界 → 总监审批（审批异常）
  attachBoundaryToHost(graph, errorBoundary, directorApprove)
  // 信号边界 → 总监审批（取消信号）
  attachBoundaryToHost(graph, signalBoundary, directorApprove)

  // ========== 连线 ==========
  // 申请人流程
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: start, target: fillForm })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: fillForm, target: gw1 })

  // 根据天数分支
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw1,
    target: managerApprove,
    labels: [{ attrs: { label: { text: '≤3天' } } }],
  })
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw1,
    target: directorApprove,
    labels: [{ attrs: { label: { text: '>3天' } } }],
  })

  // 汇聚到审批结果
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: managerApprove, target: gw2 })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: directorApprove, target: gw2 })

  // 审批通过
  graph.addEdge({
    shape: BPMN_CONDITIONAL_FLOW,
    source: gw2,
    target: notify,
    labels: [{ attrs: { label: { text: '通过' } } }],
  })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: notify, target: updateAttendance })
  graph.addEdge({ shape: BPMN_SEQUENCE_FLOW, source: updateAttendance, target: endOk })

  // 审批驳回
  graph.addEdge({
    shape: BPMN_DEFAULT_FLOW,
    source: gw2,
    target: rejectModify,
    labels: [{ attrs: { label: { text: '驳回' } } }],
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
    labels: [{ attrs: { label: { text: '取消' } } }],
  })
}
