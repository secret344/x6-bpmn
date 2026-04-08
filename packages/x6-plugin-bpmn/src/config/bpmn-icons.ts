/**
 * BPMN 图标 SVG 生成器
 *
 * 提供 shapeName → SVG HTML 的映射，可在任何消费端的 Stencil/面板中复用。
 * 所有 SVG 均为 28×28 视窗（事件/网关）或 40×28（任务）或 28×32（数据）。
 */

// ============================================================================
// 内部标记 SVG 片段
// ============================================================================

const iNone = ''
const iMessage = '<path d="M8 10h12v8H8z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 10l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.2"/>'
const iTimer = '<circle cx="14" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M14 10v4l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1"/>'
const iConditional = '<rect x="10" y="9" width="8" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/><line x1="11" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="0.8"/><line x1="11" y1="14.5" x2="17" y2="14.5" stroke="currentColor" stroke-width="0.8"/><line x1="11" y1="17" x2="17" y2="17" stroke="currentColor" stroke-width="0.8"/>'
const iSignal = '<polygon points="14,7 21,21 7,21" fill="none" stroke="currentColor" stroke-width="1.2"/>'
const iMultiple = '<polygon points="14,7 20,12 18,20 10,20 8,12" fill="none" stroke="currentColor" stroke-width="1.2"/>'
const iParallelMultiple = '<path d="M14 8v12M8 14h12" stroke="currentColor" stroke-width="2"/>'
const iEscalation = '<polygon points="14,7 19,21 14,15 9,21" fill="none" stroke="currentColor" stroke-width="1.2"/>'
const iLink = '<polygon points="10,9 18,14 10,19" fill="currentColor" stroke="none"/>'
const iCompensation = '<polygon points="14,9 8,14 14,19" fill="none" stroke="currentColor" stroke-width="1.2"/><polygon points="20,9 14,14 20,19" fill="none" stroke="currentColor" stroke-width="1.2"/>'
const iError = '<polyline points="9,19 12,10 15,17 19,8" fill="none" stroke="currentColor" stroke-width="1.5"/>'
const iCancel = '<path d="M10 10l8 8M18 10l-8 8" stroke="currentColor" stroke-width="1.5"/>'
const iTerminate = '<circle cx="14" cy="14" r="6" fill="currentColor"/>'
const iNonInterrupting = '<circle cx="14" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/>'

// ============================================================================
// 外形生成器
// ============================================================================

/** 单圈事件（开始/空白） */
const svgEvent = (inner: string, strokeW = 1.5, fill = 'none', stroke = '#52c41a') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>${inner}</svg>`

/** 双圈事件（中间抛出/捕获） */
const svgEventDouble = (inner: string, stroke = '#e6a817') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="14" r="9.5" fill="none" stroke="${stroke}" stroke-width="1"/>${inner}</svg>`

/** 边界事件（虚线内圈） */
const svgBoundary = (inner: string, stroke = '#722ed1') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="14" r="9.5" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="3 2"/>${inner}</svg>`

/** 结束事件（粗圈） */
const svgEndEvent = (inner: string, stroke = '#f5222d') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="2.5"/>${inner}</svg>`

/** 任务（圆角矩形） */
const svgTask = (inner: string, stroke = '#1890ff') =>
  `<svg viewBox="0 0 40 28" width="40" height="28"><rect x="1" y="1" width="38" height="26" rx="4" fill="#f0f5ff" stroke="${stroke}" stroke-width="1.5"/>${inner}</svg>`

/** 子流程 */
const svgSubProcess = (inner: string, stroke = '#13c2c2', dashed = false) =>
  `<svg viewBox="0 0 44 30" width="44" height="30"><rect x="1" y="1" width="42" height="28" rx="5" fill="#e6fffb" stroke="${stroke}" stroke-width="1.5" ${dashed ? 'stroke-dasharray="5 3"' : ''}/>${inner}</svg>`

/** 网关（菱形） */
const svgGateway = (inner: string, stroke = '#faad14') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><polygon points="14,2 26,14 14,26 2,14" fill="#fffbe6" stroke="${stroke}" stroke-width="1.5"/>${inner}</svg>`

/** 数据元素 */
const svgData = (inner: string) =>
  `<svg viewBox="0 0 28 32" width="28" height="32">${inner}</svg>`

/** 工件/泳道 */
const svgArtifact = (inner: string) =>
  `<svg viewBox="0 0 40 24" width="40" height="24">${inner}</svg>`

// ============================================================================
// 任务内部标记
// ============================================================================

const iUser = '<circle cx="20" cy="10" r="3" fill="none" stroke="#1890ff" stroke-width="1"/><path d="M14,22 C14,17 26,17 26,22" fill="none" stroke="#1890ff" stroke-width="1"/>'
const iService = '<circle cx="17" cy="12" r="4" fill="none" stroke="#1890ff" stroke-width="1"/><circle cx="17" cy="12" r="1.5" fill="#1890ff"/><circle cx="23" cy="16" r="4" fill="none" stroke="#1890ff" stroke-width="1"/><circle cx="23" cy="16" r="1.5" fill="#1890ff"/>'
const iScript = '<rect x="13" y="6" width="14" height="16" rx="1" fill="none" stroke="#1890ff" stroke-width="1"/><line x1="16" y1="10" x2="24" y2="10" stroke="#1890ff" stroke-width="0.8"/><line x1="16" y1="13" x2="24" y2="13" stroke="#1890ff" stroke-width="0.8"/><line x1="16" y1="16" x2="22" y2="16" stroke="#1890ff" stroke-width="0.8"/>'
const iBusinessRule = '<rect x="12" y="7" width="16" height="14" rx="1" fill="none" stroke="#1890ff" stroke-width="1"/><line x1="12" y1="11" x2="28" y2="11" stroke="#1890ff" stroke-width="1"/><line x1="19" y1="11" x2="19" y2="21" stroke="#1890ff" stroke-width="0.8"/>'
const iSend = '<path d="M12 9h16v10H12z" fill="#1890ff" stroke="#1890ff" stroke-width="1"/><path d="M12 9l8 6 8-6" fill="none" stroke="#fff" stroke-width="1"/>'
const iReceive = '<path d="M12 9h16v10H12z" fill="none" stroke="#1890ff" stroke-width="1.2"/><path d="M12 9l8 6 8-6" fill="none" stroke="#1890ff" stroke-width="1.2"/>'
const iManual = '<path d="M12,17 C12,13 16,11 20,11 L26,11 C27,11 28,12 28,13 L28,15 C27,15 26,16 26,17 L12,17z" fill="none" stroke="#1890ff" stroke-width="1"/>'

// 子流程内部标记
const iSubProcessBase = '<rect x="18" y="20" width="8" height="6" rx="1" fill="none" stroke="#13c2c2" stroke-width="1"/><line x1="22" y1="21" x2="22" y2="25" stroke="#13c2c2" stroke-width="0.8"/><line x1="19" y1="23" x2="25" y2="23" stroke="#13c2c2" stroke-width="0.8"/>'
const iEventSub = '<circle cx="22" cy="10" r="5" fill="none" stroke="#13c2c2" stroke-width="1" stroke-dasharray="2 1.5"/>' + iSubProcessBase
const iTransaction = '<rect x="3" y="3" width="38" height="24" rx="4" fill="none" stroke="#13c2c2" stroke-width="1"/>' + iSubProcessBase
const iAdHoc = '<text x="22" y="16" text-anchor="middle" font-size="14" fill="#13c2c2">~</text>' + iSubProcessBase
const iCallActivity = '<text x="22" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="#13c2c2">CA</text>'

// 网关内部标记
const iExclusive = '<path d="M10 10l8 8M18 10l-8 8" stroke="#faad14" stroke-width="2"/>'
const iParallel = '<path d="M14 7v14M7 14h14" stroke="#faad14" stroke-width="2"/>'
const iInclusive = '<circle cx="14" cy="14" r="5" fill="none" stroke="#faad14" stroke-width="2"/>'
const iComplex = '<path d="M14 7v14M7 14h14M9 9l10 10M19 9l-10 10" stroke="#faad14" stroke-width="1.5"/>'
const iEventBased = '<circle cx="14" cy="14" r="6" fill="none" stroke="#faad14" stroke-width="1"/><polygon points="14,9 18.5,12.5 17,17.5 11,17.5 9.5,12.5" fill="none" stroke="#faad14" stroke-width="1"/>'
const iExclEventBased = '<circle cx="14" cy="14" r="6" fill="none" stroke="#faad14" stroke-width="1.5"/><path d="M11 11l6 6M17 11l-6 6" stroke="#faad14" stroke-width="1"/>'

// 数据内部标记
const iDataObject = '<path d="M6 2h10l6 6v22H6z" fill="#f0f0f0" stroke="#595959" stroke-width="1.2"/><path d="M16 2v6h6" fill="none" stroke="#595959" stroke-width="1.2"/>'
const iDataInput = iDataObject + '<polygon points="9,15 14,12 14,18" fill="#595959"/>'
const iDataOutput = iDataObject + '<polygon points="10,15 15,12 15,18" fill="none" stroke="#595959" stroke-width="1"/>'
const iDataStore = '<path d="M5 8c0-3 18-3 18 0v16c0 3-18 3-18 0z" fill="#f0f0f0" stroke="#595959" stroke-width="1.2"/><path d="M5 8c0 3 18 3 18 0" fill="none" stroke="#595959" stroke-width="1.2"/>'

// 工件/泳道内部标记
const iAnnotation = '<line x1="10" y1="2" x2="10" y2="22" stroke="#595959" stroke-width="1.5"/><line x1="10" y1="2" x2="30" y2="2" stroke="#595959" stroke-width="1"/><text x="14" y="15" font-size="8" fill="#595959">T</text>'
const iGroup = '<rect x="2" y="2" width="36" height="20" rx="4" fill="none" stroke="#595959" stroke-width="1.5" stroke-dasharray="6 3"/>'
const iPool = '<rect x="2" y="2" width="36" height="20" rx="1" fill="#e6f7ff" stroke="#1890ff" stroke-width="1.5"/><line x1="10" y1="2" x2="10" y2="22" stroke="#1890ff" stroke-width="1"/><text x="6" y="14" font-size="7" fill="#1890ff" transform="rotate(-90 6 14)">P</text>'
const iLane = '<rect x="2" y="2" width="36" height="20" rx="1" fill="#f6ffed" stroke="#52c41a" stroke-width="1.2"/><line x1="10" y1="2" x2="10" y2="22" stroke="#52c41a" stroke-width="1"/>'

// ============================================================================
// 事件标记名 → 内部 SVG 映射
// ============================================================================

function getEventMarker(shape: string): string {
  if (shape.includes('-message')) return iMessage
  if (shape.includes('-timer')) return iTimer
  if (shape.includes('-conditional')) return iConditional
  if (shape.includes('-parallel-multiple')) return iParallelMultiple
  if (shape.includes('-multiple')) return iMultiple
  if (shape.includes('-signal')) return iSignal
  if (shape.includes('-escalation')) return iEscalation
  if (shape.includes('-link')) return iLink
  if (shape.includes('-compensation')) return iCompensation
  if (shape.includes('-error')) return iError
  if (shape.includes('-cancel')) return iCancel
  if (shape.includes('-terminate')) return iTerminate
  if (shape.includes('-non-interrupting')) return iNonInterrupting
  return iNone
}

// ============================================================================
// 主入口：根据 shape 名称生成 SVG 图标
// ============================================================================

/**
 * 根据 BPMN 图形名称返回完整的 SVG HTML 字符串，用于渲染图标。
 *
 * @example
 * ```ts
 * import { getBpmnShapeIcon } from '@x6-bpmn2/plugin'
 *
 * const iconHtml = getBpmnShapeIcon('bpmn-user-task')
 * // => '<svg viewBox="0 0 40 28" ...>...</svg>'
 * ```
 */
export function getBpmnShapeIcon(shape: string): string {
  // ---- Start events ----
  if (shape.startsWith('bpmn-start-event'))
    return svgEvent(getEventMarker(shape))

  // ---- Intermediate throw events ----
  if (shape.startsWith('bpmn-intermediate-throw-event'))
    return svgEventDouble(getEventMarker(shape))

  // ---- Intermediate catch events ----
  if (shape.startsWith('bpmn-intermediate-catch-event'))
    return svgEventDouble(getEventMarker(shape), '#1890ff')

  // ---- Boundary events ----
  if (shape.startsWith('bpmn-boundary-event'))
    return svgBoundary(getEventMarker(shape))

  // ---- End events ----
  if (shape.startsWith('bpmn-end-event'))
    return svgEndEvent(getEventMarker(shape))

  // ---- Tasks ----
  if (shape === 'bpmn-task') return svgTask('')
  if (shape === 'bpmn-user-task') return svgTask(iUser)
  if (shape === 'bpmn-service-task') return svgTask(iService)
  if (shape === 'bpmn-script-task') return svgTask(iScript)
  if (shape === 'bpmn-business-rule-task') return svgTask(iBusinessRule)
  if (shape === 'bpmn-send-task') return svgTask(iSend)
  if (shape === 'bpmn-receive-task') return svgTask(iReceive)
  if (shape === 'bpmn-manual-task') return svgTask(iManual)

  // ---- Sub-processes ----
  if (shape === 'bpmn-sub-process') return svgSubProcess(iSubProcessBase)
  if (shape === 'bpmn-event-sub-process') return svgSubProcess(iEventSub, '#13c2c2', true)
  if (shape === 'bpmn-transaction') return svgSubProcess(iTransaction)
  if (shape === 'bpmn-ad-hoc-sub-process') return svgSubProcess(iAdHoc)
  if (shape === 'bpmn-call-activity') return svgSubProcess(iCallActivity)

  // ---- Gateways ----
  if (shape === 'bpmn-exclusive-gateway') return svgGateway(iExclusive)
  if (shape === 'bpmn-parallel-gateway') return svgGateway(iParallel)
  if (shape === 'bpmn-inclusive-gateway') return svgGateway(iInclusive)
  if (shape === 'bpmn-complex-gateway') return svgGateway(iComplex)
  if (shape === 'bpmn-event-based-gateway') return svgGateway(iEventBased)
  if (shape === 'bpmn-exclusive-event-based-gateway') return svgGateway(iExclEventBased)

  // ---- Data ----
  if (shape === 'bpmn-data-object') return svgData(iDataObject)
  if (shape === 'bpmn-data-input') return svgData(iDataInput)
  if (shape === 'bpmn-data-output') return svgData(iDataOutput)
  if (shape === 'bpmn-data-store') return svgData(iDataStore)

  // ---- Artifacts ----
  if (shape === 'bpmn-text-annotation') return svgArtifact(iAnnotation)
  if (shape === 'bpmn-group') return svgArtifact(iGroup)

  // ---- Swimlanes ----
  if (shape === 'bpmn-pool') return svgArtifact(iPool)
  if (shape === 'bpmn-lane') return svgArtifact(iLane)

  // ---- Fallback: generic circle ----
  return `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="10" fill="#f0f0f0" stroke="#999" stroke-width="1.5"/><text x="14" y="18" text-anchor="middle" font-size="10" fill="#666">?</text></svg>`
}
