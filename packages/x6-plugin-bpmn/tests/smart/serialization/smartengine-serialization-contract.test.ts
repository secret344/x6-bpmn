import { BpmnModdle } from 'bpmn-moddle'
import { describe, expect, it, vi } from 'vitest'
import { smartengineBaseProfile } from '../../../src/builtin/smartengine-base/profile'
import {
  createSmartJsonArrayField,
  createSmartNodeSerializer,
  smartConditionalFlowSerializer,
} from '../../../src/builtin/smartengine-base/serialization'
import { mergeSerialization } from '../../../src/core/dialect/merge'
import { exportBpmnXml } from '../../../src/export/exporter'
import { parseBpmnXml } from '../../../src/import'
import {
  BPMN_CONDITIONAL_FLOW,
  BPMN_SEQUENCE_FLOW,
  BPMN_SERVICE_TASK,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'
import { buildAndValidateBpmn } from '../../helpers/bpmn-builder'

describe('SmartEngine serialization contracts', () => {
  it('smartProperties 字段应处理空值、非数组输入与非法 JSON', () => {
    const field = smartengineBaseProfile.dataModel!.fields!.smartProperties

    expect(field.normalize!('   ')).toBe('')
    expect(field.normalize!(' \n ')).toBe('')
    expect(field.normalize!({ name: 'config', value: 1 })).toBe('[{"name":"config","value":1}]')
    expect(field.normalize!('{')).toBe('{')
    expect(field.validate!(undefined, {} as any)).toBe(true)
    expect(field.validate!('{"name":"config"}', {} as any)).toBe('smartProperties 必须是 JSON 数组')
    expect(field.validate!('[1]', {} as any)).toBe('smartProperties 中的每一项必须是对象')
  })

  it('自定义 JSON 数组字段在 validator 抛出非 Error 时应返回通用错误', () => {
    const field = createSmartJsonArrayField('自定义字段', 'customField', () => {
      throw 'boom'
    })

    expect(field.validate!('[{}]', {} as any)).toBe('customField 格式无效')
  })

  it('Smart node serializer 应支持默认空实现', () => {
    const serializer = createSmartNodeSerializer()
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:ServiceTask', { id: 'Task_1' })

    expect(serializer.export!({
      shape: BPMN_SERVICE_TASK,
      category: 'serviceTask' as any,
      bpmnData: {},
      element,
      moddle,
      namespaces: {},
    })).toEqual({ omitBpmnKeys: [] })

    expect(serializer.import!({
      shape: BPMN_SERVICE_TASK,
      category: 'serviceTask' as any,
      element,
      namespaces: {},
    })).toEqual({})
  })

  it('Smart node serializer 应序列化复杂属性并忽略空自动属性', () => {
    const serializer = createSmartNodeSerializer({
      readProperties: true,
      readExecutionListeners: true,
      autoPropertyKeys: ['approvalType'],
      multiInstance: true,
    })
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:UserTask', { id: 'Task_1' })

    const result = serializer.export!({
      shape: BPMN_USER_TASK,
      category: 'userTask' as any,
      bpmnData: {
        smartProperties: [
          { name: 'config', value: { retry: 1 } },
          { name: 'enabled', value: true },
        ],
        smartExecutionListeners: [
          { event: 'ACTIVITY_END', class: 'com.example.EndListener' },
        ],
        approvalType: '',
        multiInstance: true,
        multiInstanceType: 'parallel',
        multiInstanceCollection: '',
        multiInstanceElementVariable: '',
        multiInstanceCompletionCondition: '',
        multiInstanceAbortCondition: '',
      },
      element,
      moddle,
      namespaces: {},
    })!

    expect(result.omitBpmnKeys).toEqual(expect.arrayContaining([
      'smartProperties',
      'smartExecutionListeners',
      'multiInstance',
      'multiInstanceType',
      'multiInstanceCollection',
      'multiInstanceElementVariable',
      'multiInstanceCompletionCondition',
      'multiInstanceAbortCondition',
    ]))

    const extensionValues = ((element.extensionElements as any).values || []) as Array<Record<string, any>>
    const propertiesContainer = extensionValues.find((value) => String(value.$type || value.name).includes('smart:properties'))
    const listener = extensionValues.find((value) => String(value.$type || value.name).includes('smart:executionListener'))

    expect(propertiesContainer?.$children?.map((child: Record<string, any>) => child.value)).toEqual([
      '{"retry":1}',
      'true',
    ])
    expect(listener).toMatchObject({
      event: 'ACTIVITY_END',
      class: 'com.example.EndListener',
    })
    expect((element.loopCharacteristics as any).$attrs).toEqual({})
  })

  it('Smart node serializer 导入时应支持自动属性回填与并行多实例缺省值', () => {
    const serializer = createSmartNodeSerializer({
      readProperties: true,
      readExecutionListeners: true,
      autoPropertyKeys: ['approvalType'],
      multiInstance: true,
    })
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:UserTask', { id: 'Task_2' })
    const properties = moddle.createAny('smart:properties', 'http://smartengine.org/schema/process', {
      $children: [
        moddle.createAny('smart:property', 'http://smartengine.org/schema/process', {
          name: 'approvalType',
          value: 'review',
        }),
      ],
    })

    element.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [properties] })
    element.loopCharacteristics = moddle.create('bpmn:MultiInstanceLoopCharacteristics', {
      isSequential: false,
    })

    expect(serializer.import!({
      shape: BPMN_USER_TASK,
      category: 'userTask' as any,
      element,
      namespaces: {},
    })).toEqual({
      approvalType: 'review',
      multiInstance: true,
      multiInstanceType: 'parallel',
    })
  })

  it('Smart node serializer 导入时应识别 abort completionCondition', () => {
    const serializer = createSmartNodeSerializer({
      multiInstance: true,
    })
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:UserTask', { id: 'Task_Abort_1' })
    const loop = moddle.create('bpmn:MultiInstanceLoopCharacteristics', {
      isSequential: true,
    })
    const completionCondition = moddle.create('bpmn:FormalExpression', {
      body: '${nrOfRejectedInstances > 0}',
    })
    ;(completionCondition.$attrs || {}).action = 'abort'
    loop.completionCondition = completionCondition
    element.loopCharacteristics = loop

    expect(serializer.import!({
      shape: BPMN_USER_TASK,
      category: 'userTask' as any,
      element,
      namespaces: {},
    })).toEqual({
      multiInstance: true,
      multiInstanceType: 'sequential',
      multiInstanceAbortCondition: '${nrOfRejectedInstances > 0}',
    })
  })

  it('Smart node serializer 在空 smartClass 且无多实例结构时应返回空补丁', () => {
    const serializer = createSmartNodeSerializer({
      allowSmartClass: true,
      readProperties: true,
      readExecutionListeners: true,
      multiInstance: true,
    })
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:UserTask', { id: 'Task_3' })

    expect(serializer.import!({
      shape: BPMN_USER_TASK,
      category: 'userTask' as any,
      element,
      namespaces: {},
    })).toEqual({})

    expect(serializer.export!({
      shape: BPMN_USER_TASK,
      category: 'userTask' as any,
      bpmnData: {
        smartClass: '',
      },
      element: moddle.create('bpmn:UserTask', { id: 'Task_4' }),
      moddle,
      namespaces: {},
    })).toEqual({ omitBpmnKeys: ['smartClass', 'smartProperties', 'smartExecutionListeners'] })
  })

  it('条件流 serializer 在缺少 conditionExpression 时应安全返回空补丁', () => {
    const moddle = new BpmnModdle()
    const element = moddle.create('bpmn:SequenceFlow', { id: 'Flow_1' })

    expect(smartConditionalFlowSerializer.export!({
      shape: BPMN_CONDITIONAL_FLOW,
      edgeData: {},
      element,
      moddle,
      namespaces: {},
    })).toEqual({ omitBpmnKeys: ['conditionExpression', 'conditionExpressionType'] })

    expect(smartConditionalFlowSerializer.import!({
      shape: BPMN_CONDITIONAL_FLOW,
      element,
      namespaces: {},
    })).toEqual({})

    const defaultTypeElement = moddle.create('bpmn:SequenceFlow', { id: 'Flow_2' })
    defaultTypeElement.conditionExpression = moddle.create('bpmn:FormalExpression', {})

    expect(smartConditionalFlowSerializer.export!({
      shape: BPMN_CONDITIONAL_FLOW,
      edgeData: { conditionExpressionType: '', conditionExpression: '' },
      element: defaultTypeElement,
      moddle,
      namespaces: {},
    })).toEqual({ omitBpmnKeys: ['conditionExpression', 'conditionExpressionType'] })
    expect((defaultTypeElement.conditionExpression as any).$attrs).toEqual({ type: 'mvel' })

    expect(smartConditionalFlowSerializer.import!({
      shape: BPMN_CONDITIONAL_FLOW,
      element: defaultTypeElement,
      namespaces: {},
    })).toEqual({ conditionExpressionType: 'mvel' })

    const bodyOnlyElement = moddle.create('bpmn:SequenceFlow', { id: 'Flow_3' })
    bodyOnlyElement.conditionExpression = moddle.create('bpmn:FormalExpression', {
      body: 'amount > 1',
    })

    expect(smartConditionalFlowSerializer.import!({
      shape: BPMN_CONDITIONAL_FLOW,
      element: bodyOnlyElement,
      namespaces: {},
    })).toEqual({ conditionExpression: 'amount > 1' })
  })

  it('parseBpmnXml 在未提供命名空间时应向 serializer 钩子传空对象', async () => {
    const nodeImport = vi.fn(() => ({ importedByNodeSerializer: true }))
    const edgeImport = vi.fn(() => ({ importedByEdgeSerializer: true }))
    const { xml } = await buildAndValidateBpmn({
      processes: [{
        id: 'Process_1',
        elements: [
          { kind: 'startEvent', id: 'start_1', outgoing: ['flow_1'] },
          { kind: 'serviceTask', id: 'task_1', incoming: ['flow_1'], outgoing: ['flow_2'] },
          { kind: 'endEvent', id: 'end_1', incoming: ['flow_2'] },
          { kind: 'sequenceFlow', id: 'flow_1', sourceRef: 'start_1', targetRef: 'task_1' },
          { kind: 'sequenceFlow', id: 'flow_2', sourceRef: 'task_1', targetRef: 'end_1' },
        ],
      }],
      shapes: {
        start_1: { id: 'start_1', x: 80, y: 120, width: 36, height: 36 },
        task_1: { id: 'task_1', x: 180, y: 108, width: 120, height: 60 },
        end_1: { id: 'end_1', x: 360, y: 120, width: 36, height: 36 },
      },
      edges: {
        flow_1: { id: 'flow_1', waypoints: [{ x: 116, y: 138 }, { x: 180, y: 138 }] },
        flow_2: { id: 'flow_2', waypoints: [{ x: 300, y: 138 }, { x: 360, y: 138 }] },
      },
    })

    const imported = await parseBpmnXml(xml, {
      serialization: {
        nodeSerializers: {
          [BPMN_SERVICE_TASK]: { import: nodeImport } as any,
        },
        edgeSerializers: {
          [BPMN_SEQUENCE_FLOW]: { import: edgeImport } as any,
        },
      },
    })

    expect(nodeImport).toHaveBeenCalledWith(expect.objectContaining({ namespaces: {} }))
    expect(edgeImport).toHaveBeenCalledWith(expect.objectContaining({ namespaces: {} }))
    expect(imported.nodes.find((node) => node.id === 'task_1')?.data).toEqual({
      bpmn: { importedByNodeSerializer: true },
    })
    expect(imported.edges.find((edge) => edge.id === 'flow_1')?.data).toEqual({
      bpmn: { importedByEdgeSerializer: true },
    })
  })

  it('mergeSerialization 应在父级缺省可选块时合并子级配置', () => {
    const nodeSerializer = createSmartNodeSerializer()
    const merged = mergeSerialization({
      namespaces: { smart: 'http://smartengine.org/schema/process' },
      nodeMapping: {},
      edgeMapping: {},
      targetNamespace: 'Examples',
    }, {
      processAttributes: { version: '1.0.0' },
      nodeSerializers: { [BPMN_SERVICE_TASK]: nodeSerializer },
      edgeSerializers: { [BPMN_CONDITIONAL_FLOW]: smartConditionalFlowSerializer },
    })

    expect(merged.processAttributes).toEqual({ version: '1.0.0' })
    expect(merged.nodeSerializers).toEqual({ [BPMN_SERVICE_TASK]: nodeSerializer })
    expect(merged.edgeSerializers).toEqual({ [BPMN_CONDITIONAL_FLOW]: smartConditionalFlowSerializer })
  })

  it('exportBpmnXml 在 serializer 不返回 omitBpmnKeys 且节点无 bpmnData 时应继续导出', async () => {
    const node = {
      id: 'task_1',
      shape: BPMN_SERVICE_TASK,
      getPosition: () => ({ x: 80, y: 80 }),
      getSize: () => ({ width: 120, height: 60 }),
      getData: () => undefined,
      getAttrs: () => ({}),
      getParent: () => null,
      isNode: () => true,
    }

    const xml = await exportBpmnXml({
      getNodes: () => [node],
      getEdges: () => [],
      getCellById: () => node,
    } as any, {
      serialization: {
        nodeSerializers: {
          [BPMN_SERVICE_TASK]: {
            export: () => undefined,
          } as any,
        },
      },
    })

    expect(xml).toContain('<bpmn:serviceTask')
  })
})
