import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Graph } from '@antv/x6'
import { registerActivityShapes } from '../src/shapes/activities'
import {
  BPMN_COLORS,
  BPMN_ICONS,
  BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
  BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
  BPMN_SUB_PROCESS, BPMN_EVENT_SUB_PROCESS, BPMN_TRANSACTION,
  BPMN_AD_HOC_SUB_PROCESS, BPMN_CALL_ACTIVITY,
} from '../src/utils/constants'

/**
 * 活动图形注册测试（registerActivityShapes）
 * 验证 13 种 BPMN 2.0 活动图形的注册参数、配色、尺寸、端口和图标。
 */
describe('活动图形注册（registerActivityShapes）', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registerNodeSpy: any

  beforeEach(() => {
    registerNodeSpy = vi.spyOn(Graph, 'registerNode').mockImplementation(() => undefined as any)
  })

  it('调用不应抛出异常', () => {
    expect(() => registerActivityShapes()).not.toThrow()
  })

  it('应注册恰好 13 个活动图形', () => {
    registerActivityShapes()
    expect(registerNodeSpy).toHaveBeenCalledTimes(13)
  })

  // ==================== Tasks (8) ====================

  describe('任务图形（8 种）', () => {
    const taskNames = [
      BPMN_TASK, BPMN_USER_TASK, BPMN_SERVICE_TASK, BPMN_SCRIPT_TASK,
      BPMN_BUSINESS_RULE_TASK, BPMN_SEND_TASK, BPMN_RECEIVE_TASK, BPMN_MANUAL_TASK,
    ]

    it('应注册全部 8 种任务类型', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        expect(registerNodeSpy).toHaveBeenCalledWith(name, expect.any(Object), true)
      }
    })

    it('所有任务图形应继承自 rect', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.inherit).toBe('rect')
      }
    })

    it('所有任务图形应有圆角 (rx=8, ry=8)', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.rx).toBe(8)
        expect(config.attrs.body.ry).toBe(8)
      }
    })

    it('所有任务图形应使用任务配色', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.body.fill).toBe(BPMN_COLORS.task.fill)
        expect(config.attrs.body.stroke).toBe(BPMN_COLORS.task.stroke)
      }
    })

    it('任务图形默认尺寸应为 100×60', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.width).toBe(100)
        expect(config.height).toBe(60)
      }
    })

    it('所有任务图形应有 4 个连接端口', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.ports.groups).toHaveProperty('top')
        expect(config.ports.groups).toHaveProperty('right')
        expect(config.ports.groups).toHaveProperty('bottom')
        expect(config.ports.groups).toHaveProperty('left')
        expect(config.ports.items).toHaveLength(4)
      }
    })

    it('普通任务（Task）不应有图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeUndefined()
    })

    it('用户任务（User Task）应有用户图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_USER_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon).toBeDefined()
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.user)
    })

    it('服务任务（Service Task）应有服务图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SERVICE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.service)
    })

    it('脚本任务（Script Task）应有脚本图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SCRIPT_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.script)
    })

    it('业务规则任务应有业务规则图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_BUSINESS_RULE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.businessRule)
    })

    it('发送任务（Send Task）应有发送图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SEND_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.send)
    })

    it('接收任务（Receive Task）应有接收图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_RECEIVE_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.receive)
    })

    it('手工任务（Manual Task）应有手工图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_MANUAL_TASK)!
      const config = call[1] as any
      expect(config.attrs.icon.d).toBe(BPMN_ICONS.manual)
    })

    it('所有任务的 attrs.label.text 应有默认文字', () => {
      registerActivityShapes()
      for (const name of taskNames) {
        const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === name)!
        const config = call[1] as any
        expect(config.attrs.label.text).toBeTruthy()
      }
    })
  })

  // ==================== Sub-Process ====================

  describe('子流程（Sub-Process）', () => {
    it('应注册子流程并校验默认尺寸', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.inherit).toBe('rect')
      expect(config.width).toBe(200)
      expect(config.height).toBe(120)
    })

    it('子流程应使用 subProcess 配色', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.subProcess.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.subProcess.stroke)
    })

    it('子流程应有折叠标记图标', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBe(BPMN_ICONS.collapse)
    })

    it('子流程边框不应为虚线', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBeUndefined()
    })
  })

  // ==================== Event Sub-Process ====================

  describe('事件子流程（Event Sub-Process）', () => {
    it('应注册事件子流程图形', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_EVENT_SUB_PROCESS, expect.any(Object), true)
    })

    it('事件子流程边框应为虚线（BPMN 规范）', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.body.strokeDasharray).toBe('8,4')
    })

    it('事件子流程尺寸应与子流程相同', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_EVENT_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.width).toBe(200)
      expect(config.height).toBe(120)
    })
  })

  // ==================== Transaction ====================

  describe('事务（Transaction）', () => {
    it('应注册事务图形', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_TRANSACTION, expect.any(Object), true)
    })

    it('事务应有双边框（innerRect）', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TRANSACTION)!
      const config = call[1] as any
      const hasInnerRect = config.markup.some((m: any) => m.selector === 'innerRect')
      expect(hasInnerRect).toBe(true)
      expect(config.attrs.innerRect).toBeDefined()
    })

    it('事务应使用 subProcess 配色', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_TRANSACTION)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.subProcess.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.subProcess.stroke)
    })
  })

  // ==================== Ad-Hoc Sub-Process ====================

  describe('自由子流程（Ad-Hoc Sub-Process）', () => {
    it('应注册自由子流程图形', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_AD_HOC_SUB_PROCESS, expect.any(Object), true)
    })

    it('自由子流程应有波浪号标记（~）', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_AD_HOC_SUB_PROCESS)!
      const config = call[1] as any
      expect(config.attrs.marker).toBeDefined()
      expect(config.attrs.marker.d).toBe(BPMN_ICONS.adHoc)
    })
  })

  // ==================== Call Activity ====================

  describe('调用活动（Call Activity）', () => {
    it('应注册调用活动图形', () => {
      registerActivityShapes()
      expect(registerNodeSpy).toHaveBeenCalledWith(BPMN_CALL_ACTIVITY, expect.any(Object), true)
    })

    it('调用活动应有粗边框（strokeWidth 4）', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.strokeWidth).toBe(4)
    })

    it('调用活动应使用 callActivity 配色', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.attrs.body.fill).toBe(BPMN_COLORS.callActivity.fill)
      expect(config.attrs.body.stroke).toBe(BPMN_COLORS.callActivity.stroke)
    })

    it('调用活动尺寸应为 100×60（与任务相同）', () => {
      registerActivityShapes()
      const call = registerNodeSpy.mock.calls.find((c: any[]) => c[0] === BPMN_CALL_ACTIVITY)!
      const config = call[1] as any
      expect(config.width).toBe(100)
      expect(config.height).toBe(60)
    })
  })

  // ==================== General Activity Properties ====================

  describe('活动图形通用属性', () => {
    it('所有活动注册时 overwrite 参数应为 true', () => {
      registerActivityShapes()
      for (const call of registerNodeSpy.mock.calls) {
        expect(call[2]).toBe(true)
      }
    })

    it('所有活动的 markup 应包含 body 和 label 选择器', () => {
      registerActivityShapes()
      for (const call of registerNodeSpy.mock.calls) {
        const config = call[1] as any
        const hasBody = config.markup.some((m: any) => m.selector === 'body')
        const hasLabel = config.markup.some((m: any) => m.selector === 'label')
        expect(hasBody).toBe(true)
        expect(hasLabel).toBe(true)
      }
    })
  })
})
