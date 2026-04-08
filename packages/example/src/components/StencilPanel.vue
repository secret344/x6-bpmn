<template>
  <div class="stencil-panel">
    <div class="stencil-header">
      <span>组件面板</span>
    </div>
    <a-collapse
      :default-active-key="activeKeys"
      :bordered="false"
      expand-icon-position="right"
    >
      <a-collapse-item
        v-for="group in stencilGroups"
        :key="group.key"
        :header="group.title"
      >
        <div class="stencil-items">
          <div
            v-for="item in group.items"
            :key="item.shape"
            class="stencil-item"
            :data-testid="`stencil-${item.shape}`"
            draggable="true"
            :title="item.label"
            @dragstart="onDragStart($event, item)"
          >
            <div class="stencil-icon" v-html="item.icon"></div>
            <span class="stencil-label">{{ item.label }}</span>
          </div>
        </div>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import type { Graph } from '@antv/x6'
import {
  BPMN_START_EVENT,
  BPMN_START_EVENT_MESSAGE,
  BPMN_START_EVENT_TIMER,
  BPMN_START_EVENT_CONDITIONAL,
  BPMN_START_EVENT_SIGNAL,
  BPMN_START_EVENT_MULTIPLE,
  BPMN_START_EVENT_PARALLEL_MULTIPLE,
  BPMN_INTERMEDIATE_THROW_EVENT,
  BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_THROW_EVENT_LINK,
  BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT,
  BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE,
  BPMN_INTERMEDIATE_CATCH_EVENT_TIMER,
  BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_LINK,
  BPMN_INTERMEDIATE_CATCH_EVENT_ERROR,
  BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL,
  BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION,
  BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL,
  BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE,
  BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT,
  BPMN_BOUNDARY_EVENT_MESSAGE,
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_BOUNDARY_EVENT_ESCALATION,
  BPMN_BOUNDARY_EVENT_CONDITIONAL,
  BPMN_BOUNDARY_EVENT_ERROR,
  BPMN_BOUNDARY_EVENT_CANCEL,
  BPMN_BOUNDARY_EVENT_COMPENSATION,
  BPMN_BOUNDARY_EVENT_SIGNAL,
  BPMN_BOUNDARY_EVENT_MULTIPLE,
  BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE,
  BPMN_BOUNDARY_EVENT_NON_INTERRUPTING,
  BPMN_END_EVENT,
  BPMN_END_EVENT_MESSAGE,
  BPMN_END_EVENT_ESCALATION,
  BPMN_END_EVENT_ERROR,
  BPMN_END_EVENT_CANCEL,
  BPMN_END_EVENT_COMPENSATION,
  BPMN_END_EVENT_SIGNAL,
  BPMN_END_EVENT_TERMINATE,
  BPMN_END_EVENT_MULTIPLE,
  BPMN_TASK,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK,
  BPMN_SEND_TASK,
  BPMN_RECEIVE_TASK,
  BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS,
  BPMN_EVENT_SUB_PROCESS,
  BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_EXCLUSIVE_GATEWAY,
  BPMN_PARALLEL_GATEWAY,
  BPMN_INCLUSIVE_GATEWAY,
  BPMN_COMPLEX_GATEWAY,
  BPMN_EVENT_BASED_GATEWAY,
  BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY,
  BPMN_DATA_OBJECT,
  BPMN_DATA_INPUT,
  BPMN_DATA_OUTPUT,
  BPMN_DATA_STORE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
  BPMN_POOL,
} from '@x6-bpmn2/plugin'

defineProps<{
  graph: Graph | null
}>()

// ============================================================================
// SVG Icons for each BPMN category
// ============================================================================

// -- Events: circle-based icons
const svgEvent = (inner: string, strokeW = 1.5, fill = 'none', stroke = '#52c41a') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>${inner}</svg>`

const svgEventDouble = (inner: string, stroke = '#e6a817') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="14" r="9.5" fill="none" stroke="${stroke}" stroke-width="1"/>${inner}</svg>`

const svgBoundary = (inner: string, stroke = '#722ed1') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="1.5"/><circle cx="14" cy="14" r="9.5" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="3 2"/>${inner}</svg>`

const svgEndEvent = (inner: string, stroke = '#f5222d') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="none" stroke="${stroke}" stroke-width="2.5"/>${inner}</svg>`

// -- Inner marker SVGs
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

// -- Tasks: rounded rect icons
const svgTask = (inner: string, stroke = '#1890ff') =>
  `<svg viewBox="0 0 40 28" width="40" height="28"><rect x="1" y="1" width="38" height="26" rx="4" fill="#f0f5ff" stroke="${stroke}" stroke-width="1.5"/>${inner}</svg>`

const iTaskNone = ''
const iUser = '<circle cx="20" cy="10" r="3" fill="none" stroke="#1890ff" stroke-width="1"/><path d="M14,22 C14,17 26,17 26,22" fill="none" stroke="#1890ff" stroke-width="1"/>'
const iService = '<circle cx="17" cy="12" r="4" fill="none" stroke="#1890ff" stroke-width="1"/><circle cx="17" cy="12" r="1.5" fill="#1890ff"/><circle cx="23" cy="16" r="4" fill="none" stroke="#1890ff" stroke-width="1"/><circle cx="23" cy="16" r="1.5" fill="#1890ff"/>'
const iScript = '<rect x="13" y="6" width="14" height="16" rx="1" fill="none" stroke="#1890ff" stroke-width="1"/><line x1="16" y1="10" x2="24" y2="10" stroke="#1890ff" stroke-width="0.8"/><line x1="16" y1="13" x2="24" y2="13" stroke="#1890ff" stroke-width="0.8"/><line x1="16" y1="16" x2="22" y2="16" stroke="#1890ff" stroke-width="0.8"/>'
const iBusinessRule = '<rect x="12" y="7" width="16" height="14" rx="1" fill="none" stroke="#1890ff" stroke-width="1"/><line x1="12" y1="11" x2="28" y2="11" stroke="#1890ff" stroke-width="1"/><line x1="19" y1="11" x2="19" y2="21" stroke="#1890ff" stroke-width="0.8"/>'
const iSend = '<path d="M12 9h16v10H12z" fill="#1890ff" stroke="#1890ff" stroke-width="1"/><path d="M12 9l8 6 8-6" fill="none" stroke="#fff" stroke-width="1"/>'
const iReceive = '<path d="M12 9h16v10H12z" fill="none" stroke="#1890ff" stroke-width="1.2"/><path d="M12 9l8 6 8-6" fill="none" stroke="#1890ff" stroke-width="1.2"/>'
const iManual = '<path d="M12,17 C12,13 16,11 20,11 L26,11 C27,11 28,12 28,13 L28,15 C27,15 26,16 26,17 L12,17z" fill="none" stroke="#1890ff" stroke-width="1"/>'

// -- Sub-Processes
const svgSubProcess = (inner: string, stroke = '#13c2c2', dashed = false) =>
  `<svg viewBox="0 0 44 30" width="44" height="30"><rect x="1" y="1" width="42" height="28" rx="5" fill="#e6fffb" stroke="${stroke}" stroke-width="1.5" ${dashed ? 'stroke-dasharray="5 3"' : ''}/>${inner}</svg>`

const iSubProcess = '<rect x="18" y="20" width="8" height="6" rx="1" fill="none" stroke="#13c2c2" stroke-width="1"/><line x1="22" y1="21" x2="22" y2="25" stroke="#13c2c2" stroke-width="0.8"/><line x1="19" y1="23" x2="25" y2="23" stroke="#13c2c2" stroke-width="0.8"/>'
const iEventSub = '<circle cx="22" cy="10" r="5" fill="none" stroke="#13c2c2" stroke-width="1" stroke-dasharray="2 1.5"/>' + iSubProcess
const iTransaction = '<rect x="3" y="3" width="38" height="24" rx="4" fill="none" stroke="#13c2c2" stroke-width="1"/>' + iSubProcess
const iAdHoc = '<text x="22" y="16" text-anchor="middle" font-size="14" fill="#13c2c2">~</text>' + iSubProcess
const iCallActivity = '<text x="22" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="#13c2c2">CA</text>'

// -- Gateways: diamond icons
const svgGateway = (inner: string, stroke = '#faad14') =>
  `<svg viewBox="0 0 28 28" width="28" height="28"><polygon points="14,2 26,14 14,26 2,14" fill="#fffbe6" stroke="${stroke}" stroke-width="1.5"/>${inner}</svg>`

const iExclusive = '<path d="M10 10l8 8M18 10l-8 8" stroke="#faad14" stroke-width="2"/>'
const iParallel = '<path d="M14 7v14M7 14h14" stroke="#faad14" stroke-width="2"/>'
const iInclusive = '<circle cx="14" cy="14" r="5" fill="none" stroke="#faad14" stroke-width="2"/>'
const iComplex = '<path d="M14 7v14M7 14h14M9 9l10 10M19 9l-10 10" stroke="#faad14" stroke-width="1.5"/>'
const iEventBased = '<circle cx="14" cy="14" r="6" fill="none" stroke="#faad14" stroke-width="1"/><polygon points="14,9 18.5,12.5 17,17.5 11,17.5 9.5,12.5" fill="none" stroke="#faad14" stroke-width="1"/>'
const iExclEventBased = '<circle cx="14" cy="14" r="6" fill="none" stroke="#faad14" stroke-width="1.5"/><path d="M11 11l6 6M17 11l-6 6" stroke="#faad14" stroke-width="1"/>'

// -- Data: document/store icons
const svgData = (inner: string) =>
  `<svg viewBox="0 0 28 32" width="28" height="32">${inner}</svg>`

const iDataObject = '<path d="M6 2h10l6 6v22H6z" fill="#f0f0f0" stroke="#595959" stroke-width="1.2"/><path d="M16 2v6h6" fill="none" stroke="#595959" stroke-width="1.2"/>'
const iDataInput = iDataObject + '<polygon points="9,15 14,12 14,18" fill="#595959"/>'
const iDataOutput = iDataObject + '<polygon points="10,15 15,12 15,18" fill="none" stroke="#595959" stroke-width="1"/>'
const iDataStore = '<path d="M5 8c0-3 18-3 18 0v16c0 3-18 3-18 0z" fill="#f0f0f0" stroke="#595959" stroke-width="1.2"/><path d="M5 8c0 3 18 3 18 0" fill="none" stroke="#595959" stroke-width="1.2"/>'

// -- Artifacts & Swimlanes
const svgArtifact = (inner: string) =>
  `<svg viewBox="0 0 40 24" width="40" height="24">${inner}</svg>`

const iAnnotation = '<line x1="10" y1="2" x2="10" y2="22" stroke="#595959" stroke-width="1.5"/><line x1="10" y1="2" x2="30" y2="2" stroke="#595959" stroke-width="1"/><text x="14" y="15" font-size="8" fill="#595959">T</text>'
const iGroup = '<rect x="2" y="2" width="36" height="20" rx="4" fill="none" stroke="#595959" stroke-width="1.5" stroke-dasharray="6 3"/>'
const iPool = '<rect x="2" y="2" width="36" height="20" rx="1" fill="#e6f7ff" stroke="#1890ff" stroke-width="1.5"/><line x1="10" y1="2" x2="10" y2="22" stroke="#1890ff" stroke-width="1"/><text x="6" y="14" font-size="7" fill="#1890ff" transform="rotate(-90 6 14)">P</text>'

// ============================================================================
// Stencil group definitions with Chinese titles and icons
// ============================================================================

interface StencilItem {
  shape: string
  label: string
  icon: string
  width?: number
  height?: number
}

interface StencilGroup {
  key: string
  title: string
  items: StencilItem[]
}

const stencilGroups: StencilGroup[] = [
  {
    key: 'start',
    title: '开始事件',
    items: [
      { shape: BPMN_START_EVENT, label: '空白', icon: svgEvent(iNone) },
      { shape: BPMN_START_EVENT_MESSAGE, label: '消息', icon: svgEvent(iMessage) },
      { shape: BPMN_START_EVENT_TIMER, label: '定时', icon: svgEvent(iTimer) },
      { shape: BPMN_START_EVENT_CONDITIONAL, label: '条件', icon: svgEvent(iConditional) },
      { shape: BPMN_START_EVENT_SIGNAL, label: '信号', icon: svgEvent(iSignal) },
      { shape: BPMN_START_EVENT_MULTIPLE, label: '多重', icon: svgEvent(iMultiple) },
      { shape: BPMN_START_EVENT_PARALLEL_MULTIPLE, label: '并行多重', icon: svgEvent(iParallelMultiple) },
    ],
  },
  {
    key: 'throw',
    title: '中间抛出事件',
    items: [
      { shape: BPMN_INTERMEDIATE_THROW_EVENT, label: '空白', icon: svgEventDouble(iNone) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_MESSAGE, label: '消息', icon: svgEventDouble(iMessage) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_ESCALATION, label: '升级', icon: svgEventDouble(iEscalation) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_LINK, label: '链接', icon: svgEventDouble(iLink) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_COMPENSATION, label: '补偿', icon: svgEventDouble(iCompensation) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_SIGNAL, label: '信号', icon: svgEventDouble(iSignal) },
      { shape: BPMN_INTERMEDIATE_THROW_EVENT_MULTIPLE, label: '多重', icon: svgEventDouble(iMultiple) },
    ],
  },
  {
    key: 'catch',
    title: '中间捕获事件',
    items: [
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT, label: '空白', icon: svgEventDouble(iNone, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_MESSAGE, label: '消息', icon: svgEventDouble(iMessage, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_TIMER, label: '定时', icon: svgEventDouble(iTimer, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_ESCALATION, label: '升级', icon: svgEventDouble(iEscalation, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_CONDITIONAL, label: '条件', icon: svgEventDouble(iConditional, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_LINK, label: '链接', icon: svgEventDouble(iLink, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_ERROR, label: '错误', icon: svgEventDouble(iError, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_CANCEL, label: '取消', icon: svgEventDouble(iCancel, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_COMPENSATION, label: '补偿', icon: svgEventDouble(iCompensation, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_SIGNAL, label: '信号', icon: svgEventDouble(iSignal, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_MULTIPLE, label: '多重', icon: svgEventDouble(iMultiple, '#1890ff') },
      { shape: BPMN_INTERMEDIATE_CATCH_EVENT_PARALLEL_MULTIPLE, label: '并行多重', icon: svgEventDouble(iParallelMultiple, '#1890ff') },
    ],
  },
  {
    key: 'boundary',
    title: '边界事件',
    items: [
      { shape: BPMN_BOUNDARY_EVENT, label: '空白', icon: svgBoundary(iNone) },
      { shape: BPMN_BOUNDARY_EVENT_MESSAGE, label: '消息', icon: svgBoundary(iMessage) },
      { shape: BPMN_BOUNDARY_EVENT_TIMER, label: '定时', icon: svgBoundary(iTimer) },
      { shape: BPMN_BOUNDARY_EVENT_ESCALATION, label: '升级', icon: svgBoundary(iEscalation) },
      { shape: BPMN_BOUNDARY_EVENT_CONDITIONAL, label: '条件', icon: svgBoundary(iConditional) },
      { shape: BPMN_BOUNDARY_EVENT_ERROR, label: '错误', icon: svgBoundary(iError) },
      { shape: BPMN_BOUNDARY_EVENT_CANCEL, label: '取消', icon: svgBoundary(iCancel) },
      { shape: BPMN_BOUNDARY_EVENT_COMPENSATION, label: '补偿', icon: svgBoundary(iCompensation) },
      { shape: BPMN_BOUNDARY_EVENT_SIGNAL, label: '信号', icon: svgBoundary(iSignal) },
      { shape: BPMN_BOUNDARY_EVENT_MULTIPLE, label: '多重', icon: svgBoundary(iMultiple) },
      { shape: BPMN_BOUNDARY_EVENT_PARALLEL_MULTIPLE, label: '并行多重', icon: svgBoundary(iParallelMultiple) },
      { shape: BPMN_BOUNDARY_EVENT_NON_INTERRUPTING, label: '非中断', icon: svgBoundary(iNonInterrupting) },
    ],
  },
  {
    key: 'end',
    title: '结束事件',
    items: [
      { shape: BPMN_END_EVENT, label: '空白', icon: svgEndEvent(iNone) },
      { shape: BPMN_END_EVENT_MESSAGE, label: '消息', icon: svgEndEvent(iMessage) },
      { shape: BPMN_END_EVENT_ESCALATION, label: '升级', icon: svgEndEvent(iEscalation) },
      { shape: BPMN_END_EVENT_ERROR, label: '错误', icon: svgEndEvent(iError) },
      { shape: BPMN_END_EVENT_CANCEL, label: '取消', icon: svgEndEvent(iCancel) },
      { shape: BPMN_END_EVENT_COMPENSATION, label: '补偿', icon: svgEndEvent(iCompensation) },
      { shape: BPMN_END_EVENT_SIGNAL, label: '信号', icon: svgEndEvent(iSignal) },
      { shape: BPMN_END_EVENT_TERMINATE, label: '终止', icon: svgEndEvent(iTerminate) },
      { shape: BPMN_END_EVENT_MULTIPLE, label: '多重', icon: svgEndEvent(iMultiple) },
    ],
  },
  {
    key: 'tasks',
    title: '任务',
    items: [
      { shape: BPMN_TASK, label: '任务', icon: svgTask(iTaskNone), width: 100, height: 60 },
      { shape: BPMN_USER_TASK, label: '用户任务', icon: svgTask(iUser), width: 100, height: 60 },
      { shape: BPMN_SERVICE_TASK, label: '服务任务', icon: svgTask(iService), width: 100, height: 60 },
      { shape: BPMN_SCRIPT_TASK, label: '脚本任务', icon: svgTask(iScript), width: 100, height: 60 },
      { shape: BPMN_BUSINESS_RULE_TASK, label: '业务规则', icon: svgTask(iBusinessRule), width: 100, height: 60 },
      { shape: BPMN_SEND_TASK, label: '发送任务', icon: svgTask(iSend), width: 100, height: 60 },
      { shape: BPMN_RECEIVE_TASK, label: '接收任务', icon: svgTask(iReceive), width: 100, height: 60 },
      { shape: BPMN_MANUAL_TASK, label: '手动任务', icon: svgTask(iManual), width: 100, height: 60 },
    ],
  },
  {
    key: 'subprocesses',
    title: '子流程',
    items: [
      { shape: BPMN_SUB_PROCESS, label: '子流程', icon: svgSubProcess(iSubProcess), width: 140, height: 90 },
      { shape: BPMN_EVENT_SUB_PROCESS, label: '事件子流程', icon: svgSubProcess(iEventSub, '#13c2c2', true), width: 140, height: 90 },
      { shape: BPMN_TRANSACTION, label: '事务', icon: svgSubProcess(iTransaction), width: 140, height: 90 },
      { shape: BPMN_AD_HOC_SUB_PROCESS, label: '临时', icon: svgSubProcess(iAdHoc), width: 140, height: 90 },
      { shape: BPMN_CALL_ACTIVITY, label: '调用活动', icon: svgSubProcess(iCallActivity), width: 100, height: 60 },
    ],
  },
  {
    key: 'gateways',
    title: '网关',
    items: [
      { shape: BPMN_EXCLUSIVE_GATEWAY, label: '排他', icon: svgGateway(iExclusive) },
      { shape: BPMN_PARALLEL_GATEWAY, label: '并行', icon: svgGateway(iParallel) },
      { shape: BPMN_INCLUSIVE_GATEWAY, label: '包容', icon: svgGateway(iInclusive) },
      { shape: BPMN_COMPLEX_GATEWAY, label: '复杂', icon: svgGateway(iComplex) },
      { shape: BPMN_EVENT_BASED_GATEWAY, label: '事件', icon: svgGateway(iEventBased) },
      { shape: BPMN_EXCLUSIVE_EVENT_BASED_GATEWAY, label: '排他事件', icon: svgGateway(iExclEventBased) },
    ],
  },
  {
    key: 'data',
    title: '数据',
    items: [
      { shape: BPMN_DATA_OBJECT, label: '数据对象', icon: svgData(iDataObject) },
      { shape: BPMN_DATA_INPUT, label: '数据输入', icon: svgData(iDataInput) },
      { shape: BPMN_DATA_OUTPUT, label: '数据输出', icon: svgData(iDataOutput) },
      { shape: BPMN_DATA_STORE, label: '数据存储', icon: svgData(iDataStore) },
    ],
  },
  {
    key: 'artifacts',
    title: '工件与泳道',
    items: [
      { shape: BPMN_TEXT_ANNOTATION, label: '文本注释', icon: svgArtifact(iAnnotation), width: 100, height: 40 },
      { shape: BPMN_GROUP, label: '分组', icon: svgArtifact(iGroup), width: 160, height: 100 },
      { shape: BPMN_POOL, label: '池', icon: svgArtifact(iPool), width: 400, height: 200 },
    ],
  },
]

const activeKeys = stencilGroups.map((g) => g.key)

function onDragStart(e: DragEvent, item: StencilItem) {
  e.dataTransfer!.setData(
    'application/bpmn-shape',
    JSON.stringify({
      shape: item.shape,
      width: item.width,
      height: item.height,
      label: item.label,
    }),
  )
  e.dataTransfer!.effectAllowed = 'copy'
}
</script>

<style scoped>
.stencil-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stencil-panel :deep(.arco-collapse) {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.stencil-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-1);
  border-bottom: 1px solid var(--color-border-2);
  flex-shrink: 0;
}

.stencil-items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px;
}

.stencil-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 4px;
  cursor: grab;
  transition: background 0.15s, box-shadow 0.15s;
  user-select: none;
  border: 1px solid transparent;
}

.stencil-item:hover {
  background: var(--color-primary-light-1);
  border-color: var(--color-primary-light-3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.stencil-item:active {
  cursor: grabbing;
}

.stencil-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-text-2);
}

.stencil-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.stencil-label {
  font-size: 10px;
  color: var(--color-text-3);
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Override Arco collapse padding */
:deep(.arco-collapse-item-content) {
  padding: 4px 8px !important;
}
:deep(.arco-collapse-item-header) {
  font-size: 12px !important;
  padding: 8px 12px !important;
}
</style>
