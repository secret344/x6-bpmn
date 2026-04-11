import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Graph } from '@antv/x6'
import { describe, expect, it, vi } from 'vitest'
import {
  BPMN_SEND_TASK,
  BPMN_USER_TASK,
} from '../../src'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from '../helpers/behavior-test-graph'

registerBehaviorTestShapes([BPMN_USER_TASK, BPMN_SEND_TASK])

function createTestGraph(): Graph {
  return createBehaviorTestGraph(800, 600)
}

describe('example demo XML wrapper', () => {
  it('exportStandardBpmnXml 应注入 example 序列化配置', async () => {
    vi.resetModules()
    const exportBpmnXml = vi.fn().mockResolvedValue('<bpmn:definitions />')
    const importBpmnXml = vi.fn()
    vi.doMock('@x6-bpmn2/plugin', () => ({
      exportBpmnXml,
      importBpmnXml,
      NODE_MAPPING: {},
      EDGE_MAPPING: {},
    }))

    const moduleUrl = pathToFileURL(resolve(import.meta.dirname, '../../../example/src/bpmn-xml.ts')).href
    const mod = await import(moduleUrl)
    await mod.exportStandardBpmnXml({} as never, {
      processName: 'BPMN流程',
      serialization: {
        namespaces: { custom: 'http://example.com/custom' },
      },
    })

    expect(exportBpmnXml).toHaveBeenCalledWith({} as never, expect.objectContaining({
      processName: 'BPMN流程',
      serialization: expect.objectContaining({
        extensionProperties: {
          prefix: 'camunda',
          namespaceUri: 'http://camunda.org/schema/1.0/bpmn',
          containerLocalName: 'properties',
          propertyLocalName: 'property',
        },
        namespaces: expect.objectContaining({
          custom: 'http://example.com/custom',
          camunda: 'http://camunda.org/schema/1.0/bpmn',
          example: 'http://x6-bpmn2.io/schema/example',
        }),
        nodeSerializers: expect.any(Object),
        edgeSerializers: expect.any(Object),
      }),
    }))

    vi.doUnmock('@x6-bpmn2/plugin')
    vi.resetModules()
  })

  it('应仅将显式配置的字段导出为内联属性，其余字段回落到扩展属性并可导回', async () => {
    vi.resetModules()
    vi.doMock('@x6-bpmn2/plugin', async () => import('../../src'))

    const moduleUrl = pathToFileURL(resolve(import.meta.dirname, '../../../example/src/bpmn-xml.ts')).href
    const mod = await import(moduleUrl)

    const graph = createTestGraph()
    graph.addNode({
      shape: BPMN_USER_TASK,
      id: 'userTask1',
      x: 80,
      y: 120,
      width: 120,
      height: 70,
      attrs: { label: { text: '审批' } },
      data: {
        label: '审批',
        bpmn: {
          assignee: '#{userId}',
          dueDate: '${dueDate}',
          priority: '50',
        },
      },
    })
    graph.addNode({
      shape: BPMN_SEND_TASK,
      id: 'sendTask1',
      x: 260,
      y: 120,
      width: 120,
      height: 70,
      attrs: { label: { text: '通知' } },
      data: {
        label: '通知',
        bpmn: {
          implementationType: 'delegateExpression',
          implementation: '${notifyDelegate}',
          resultVariable: 'notifyResult',
          isAsync: true,
          messageRef: 'Message_1',
          messageName: '审批通知',
        },
      },
    })

    const xml = await mod.exportStandardBpmnXml(graph)

    expect(xml).toContain('xmlns:camunda="http://camunda.org/schema/1.0/bpmn"')
    expect(xml).toContain('xmlns:example="http://x6-bpmn2.io/schema/example"')
    expect(xml).toContain('camunda:assignee="#{userId}"')
    expect(xml).toContain('camunda:dueDate="${dueDate}"')
    expect(xml).toContain('<bpmn:extensionElements>')
    expect(xml).toContain('name="priority" value="50"')
    expect(xml).not.toContain('camunda:priority="50"')
    expect(xml).toContain('camunda:delegateExpression="${notifyDelegate}"')
    expect(xml).toContain('camunda:resultVariable="notifyResult"')
    expect(xml).toContain('camunda:async="true"')
    expect(xml).toContain('example:messageRef="Message_1"')
    expect(xml).toContain('example:messageName="审批通知"')
    expect(xml).toContain('<camunda:properties>')
    expect(xml).toContain('<camunda:property name="priority" value="50"')

    const importedGraph = createTestGraph()
    await mod.importExampleBpmnXml(importedGraph, xml, { zoomToFit: false })

    const importedUserTask = importedGraph.getCellById('userTask1')
    const importedSendTask = importedGraph.getCellById('sendTask1')

    expect(((importedUserTask?.getData() as any)?.bpmn ?? {}).assignee).toBe('#{userId}')
    expect(((importedUserTask?.getData() as any)?.bpmn ?? {}).dueDate).toBe('${dueDate}')
    expect(((importedUserTask?.getData() as any)?.bpmn ?? {}).priority).toBe('50')
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).implementationType).toBe('delegateExpression')
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).implementation).toBe('${notifyDelegate}')
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).resultVariable).toBe('notifyResult')
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).isAsync).toBe(true)
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).messageRef).toBe('Message_1')
    expect(((importedSendTask?.getData() as any)?.bpmn ?? {}).messageName).toBe('审批通知')

    destroyBehaviorTestGraph(graph)
    destroyBehaviorTestGraph(importedGraph)

    vi.doUnmock('@x6-bpmn2/plugin')
    vi.resetModules()
  })
})
