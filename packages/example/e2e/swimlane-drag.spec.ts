import { expect, test, type Page } from '@playwright/test'

type NodeSnapshot = {
  id: string
  x: number
  y: number
  parentId: string | null
  label: string | null
  width: number
  height: number
}

type NodeLocator = {
  shape: string
  label: string
}

type EdgeSnapshot = {
  id: string
  shape: string
  sourceId: string | null
  targetId: string | null
}

async function waitForGraph(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__x6BpmnExampleGraph))
}

async function clearGraph(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__x6BpmnExampleGraph?.clearCells()
  })
  await page.waitForFunction(() => window.__x6BpmnExampleGraph?.getCells().length === 0)
}

async function dropStencilShape(
  page: Page,
  shape: string,
  target: { x: number; y: number },
): Promise<void> {
  await page.evaluate(({ shape, target }) => {
    const source = document.querySelector(`[data-testid="stencil-${shape}"]`)
    const canvas = document.querySelector('[data-testid="graph-container"]')

    if (!(source instanceof HTMLElement) || !(canvas instanceof HTMLElement)) {
      throw new Error(`无法找到拖拽源或画布: ${shape}`)
    }

    const dataTransfer = new DataTransfer()
    const rect = canvas.getBoundingClientRect()
    const clientX = rect.left + target.x
    const clientY = rect.top + target.y

    source.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }))

    canvas.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX,
      clientY,
    }))

    canvas.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX,
      clientY,
    }))
  }, { shape, target })
}

async function getNodeSnapshot(page: Page, shape: string, label: string): Promise<NodeSnapshot> {
  const snapshot = await page.evaluate(({ shape, label }) => {
    const graph = window.__x6BpmnExampleGraph
    if (!graph) return null

    const node = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === shape && text === label
    })

    if (!node) return null

    const position = node.getPosition()
    const size = node.getSize()
    const text = node.getAttrByPath('headerLabel/text')
      ?? node.getAttrByPath('label/text')
      ?? node.getData()?.label
    return {
      id: node.id,
      x: position.x,
      y: position.y,
      parentId: node.getParent()?.id ?? null,
      label: text ? String(text) : null,
      width: size.width,
      height: size.height,
    }
  }, { shape, label })

  if (!snapshot) {
    throw new Error(`未找到节点: ${shape} / ${label}`)
  }

  return snapshot
}

async function getNodeSnapshotsByShape(page: Page, shape: string): Promise<NodeSnapshot[]> {
  return page.evaluate((targetShape) => {
    const graph = window.__x6BpmnExampleGraph
    if (!graph) return []

    return graph.getNodes()
      .filter((node) => node.shape === targetShape)
      .map((node) => {
        const position = node.getPosition()
        const size = node.getSize()
        const text = node.getAttrByPath('headerLabel/text')
          ?? node.getAttrByPath('label/text')
          ?? node.getData()?.label

        return {
          id: node.id,
          x: position.x,
          y: position.y,
          parentId: node.getParent()?.id ?? null,
          label: text ? String(text) : null,
          width: size.width,
          height: size.height,
        }
      })
      .sort((left, right) => left.y - right.y || left.x - right.x)
  }, shape)
}

async function roundtripXml(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = window.__x6BpmnExampleApi
    if (!api) throw new Error('图测试接口尚未就绪')

    const xml = await api.exportXml()
    await api.importXml(xml)
  })
}

async function exportXml(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const api = window.__x6BpmnExampleApi
    if (!api) throw new Error('图测试接口尚未就绪')
    return api.exportXml()
  })
}

async function validateConfiguredConnection(
  page: Page,
  options: { shape: string; source: NodeLocator; target: NodeLocator },
): Promise<boolean> {
  return page.evaluate(({ shape, source, target }) => {
    const graph = window.__x6BpmnExampleGraph
    const validateConnection = graph?.options.connecting?.validateConnection

    if (!graph || typeof validateConnection !== 'function') {
      throw new Error('图实例未配置连线预校验')
    }

    const sourceNode = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === source.shape && text === source.label
    })
    const targetNode = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === target.shape && text === target.label
    })

    if (!sourceNode || !targetNode) {
      throw new Error(`无法找到待校验节点: ${source.shape}/${source.label} -> ${target.shape}/${target.label}`)
    }

    const edge = graph.createEdge({ shape })
    return validateConnection({
      edge,
      sourceCell: sourceNode,
      targetCell: targetNode,
      targetMagnet: {} as object,
    })
  }, options)
}

async function addEdge(page: Page, options: { shape: string; source: NodeLocator; target: NodeLocator }): Promise<EdgeSnapshot> {
  const snapshot = await page.evaluate(({ shape, source, target }) => {
    const graph = window.__x6BpmnExampleGraph
    if (!graph) return null

    const sourceNode = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === source.shape && text === source.label
    })
    const targetNode = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === target.shape && text === target.label
    })

    if (!sourceNode || !targetNode) return null

    const edge = graph.addEdge({
      shape,
      source: sourceNode,
      target: targetNode,
    })

    return {
      id: edge.id,
      shape: edge.shape,
      sourceId: edge.getSourceCellId?.() ?? null,
      targetId: edge.getTargetCellId?.() ?? null,
    }
  }, options)

  if (!snapshot) {
    throw new Error(`未能创建连线: ${options.shape}`)
  }

  return snapshot
}

async function getEdgeSnapshotById(page: Page, id: string): Promise<EdgeSnapshot> {
  const snapshot = await page.evaluate((edgeId) => {
    const graph = window.__x6BpmnExampleGraph
    const edge = graph?.getCellById(edgeId)

    if (!edge?.isEdge?.()) return null

    return {
      id: edge.id,
      shape: edge.shape,
      sourceId: edge.getSourceCellId?.() ?? null,
      targetId: edge.getTargetCellId?.() ?? null,
    }
  }, id)

  if (!snapshot) {
    throw new Error(`未找到连线: ${id}`)
  }

  return snapshot
}

async function getEdgeSnapshotByShape(page: Page, shape: string): Promise<EdgeSnapshot> {
  const snapshot = await page.evaluate((targetShape) => {
    const graph = window.__x6BpmnExampleGraph
    const edge = graph?.getEdges().find((candidate) => candidate.shape === targetShape)

    if (!edge) return null

    return {
      id: edge.id,
      shape: edge.shape,
      sourceId: edge.getSourceCellId?.() ?? null,
      targetId: edge.getTargetCellId?.() ?? null,
    }
  }, shape)

  if (!snapshot) {
    throw new Error(`未找到连线类型: ${shape}`)
  }

  return snapshot
}

async function retargetEdge(page: Page, edgeId: string, target: NodeLocator): Promise<void> {
  await page.evaluate(({ edgeId, target }) => {
    const graph = window.__x6BpmnExampleGraph
    const edge = graph?.getCellById(edgeId)

    if (!graph || !edge?.isEdge?.()) {
      throw new Error(`无法找到待重连的边: ${edgeId}`)
    }

    const targetNode = graph.getNodes().find((candidate) => {
      const text = candidate.getAttrByPath('headerLabel/text')
        ?? candidate.getAttrByPath('label/text')
        ?? candidate.getData()?.label
      return candidate.shape === target.shape && text === target.label
    })

    if (!targetNode) {
      throw new Error(`无法找到重连目标节点: ${target.shape}/${target.label}`)
    }

    edge.setTarget(targetNode)
  }, { edgeId, target })
}

async function dragCellById(page: Page, id: string, delta: { x: number; y: number }): Promise<void> {
  await page.evaluate(({ id, delta }) => {
    const graph = window.__x6BpmnExampleGraph
    const cell = graph?.getCellById(id)

    if (!graph || !cell?.isNode?.()) {
      throw new Error(`无法找到待移动节点: ${id}`)
    }

    cell.translate(delta.x, delta.y)
  }, { id, delta })
}

async function resizeCellById(
  page: Page,
  id: string,
  size: { width: number; height: number },
): Promise<void> {
  await page.evaluate(({ id, size }) => {
    const graph = window.__x6BpmnExampleGraph
    const cell = graph?.getCellById(id)

    if (!graph || !cell?.isNode?.()) {
      throw new Error(`无法找到待缩放节点: ${id}`)
    }

    cell.resize(size.width, size.height)
  }, { id, size })
}

async function expectSingleMainGraphRootView(page: Page, id: string): Promise<void> {
  const nodeCount = await page.evaluate((cellId) => {
    return document.querySelectorAll(`[data-testid="graph-container"] .x6-node[data-cell-id="${cellId}"]`).length
  }, id)

  expect(nodeCount).toBe(1)
}

function expectMovedBy(snapshotBefore: NodeSnapshot, snapshotAfter: NodeSnapshot, delta: { x: number; y: number }): void {
  expect(snapshotAfter.x - snapshotBefore.x).toBeCloseTo(delta.x, 0)
  expect(snapshotAfter.y - snapshotBefore.y).toBeCloseTo(delta.y, 0)
}

test.describe('泳道拖拽回归', () => {
  test('新建 lane 嵌入 pool 后应跟随 pool 一起移动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')

    expect(laneBefore.parentId).toBe(poolBefore.id)

    const delta = { x: 120, y: 45 }
    await dragCellById(page, poolBefore.id, delta)

    const poolAfter = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneAfter = await getNodeSnapshot(page, 'bpmn-lane', '道')

    expectMovedBy(poolBefore, poolAfter, delta)
    expectMovedBy(laneBefore, laneAfter, delta)
    expect(laneAfter.parentId).toBe(poolAfter.id)
  })

  test('导出再导入后 pool 不应出现重复视图，且 lane 与流程节点仍应跟随', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-start-event', { x: 340, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 500, y: 260 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const startBefore = await getNodeSnapshot(page, 'bpmn-start-event', '空白')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expect(laneBefore.parentId).toBe(poolBefore.id)
    expect(startBefore.parentId).toBe(laneBefore.id)
    expect(taskBefore.parentId).toBe(laneBefore.id)

    const delta = { x: 90, y: 40 }
    await dragCellById(page, poolBefore.id, delta)

    const poolAfter = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneAfter = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const startAfter = await getNodeSnapshot(page, 'bpmn-start-event', '空白')
    const taskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expectMovedBy(poolBefore, poolAfter, delta)
    expectMovedBy(laneBefore, laneAfter, delta)
    expectMovedBy(startBefore, startAfter, delta)
    expectMovedBy(taskBefore, taskAfter, delta)
    expect(laneAfter.parentId).toBe(poolAfter.id)
    expect(startAfter.parentId).toBe(laneAfter.id)
    expect(taskAfter.parentId).toBe(laneAfter.id)

    await expectSingleMainGraphRootView(page, poolAfter.id)
  })

  test('双 lane 场景导出再导入后应保留各自父链并随 pool 一起移动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 220 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 310 })
    await dropStencilShape(page, 'bpmn-start-event', { x: 340, y: 220 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 500, y: 310 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const lanesBefore = await getNodeSnapshotsByShape(page, 'bpmn-lane')
    const startBefore = await getNodeSnapshot(page, 'bpmn-start-event', '空白')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expect(lanesBefore).toHaveLength(2)
    expect(lanesBefore[0].parentId).toBe(poolBefore.id)
    expect(lanesBefore[1].parentId).toBe(poolBefore.id)
    expect(startBefore.parentId).toBe(lanesBefore[0].id)
    expect(taskBefore.parentId).toBe(lanesBefore[1].id)

    const delta = { x: 80, y: 35 }
    await dragCellById(page, poolBefore.id, delta)

    const poolAfter = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const lanesAfter = await getNodeSnapshotsByShape(page, 'bpmn-lane')
    const startAfter = await getNodeSnapshot(page, 'bpmn-start-event', '空白')
    const taskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expectMovedBy(poolBefore, poolAfter, delta)
    expectMovedBy(lanesBefore[0], lanesAfter[0], delta)
    expectMovedBy(lanesBefore[1], lanesAfter[1], delta)
    expectMovedBy(startBefore, startAfter, delta)
    expectMovedBy(taskBefore, taskAfter, delta)
    expect(startAfter.parentId).toBe(lanesAfter[0].id)
    expect(taskAfter.parentId).toBe(lanesAfter[1].id)
    await expectSingleMainGraphRootView(page, poolAfter.id)
  })

  test('lane 内的边界事件导出再导入后应继续附着宿主并随 pool 移动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 430, y: 260 })
    await dropStencilShape(page, 'bpmn-boundary-event-timer', { x: 480, y: 260 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')
    const boundaryBefore = await getNodeSnapshot(page, 'bpmn-boundary-event-timer', '定时')

    expect(taskBefore.parentId).toBe(laneBefore.id)
    expect(boundaryBefore.parentId).toBe(taskBefore.id)

    const delta = { x: 70, y: 30 }
    await dragCellById(page, poolBefore.id, delta)

    const taskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')
    const boundaryAfter = await getNodeSnapshot(page, 'bpmn-boundary-event-timer', '定时')

    expectMovedBy(taskBefore, taskAfter, delta)
    expectMovedBy(boundaryBefore, boundaryAfter, delta)
    expect(boundaryAfter.parentId).toBe(taskAfter.id)
  })

  test('节点越出 pool 时若父链意外丢失，回退后拖拽 pool 仍应联动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 430, y: 260 })

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    await page.evaluate(({ laneId, taskId }) => {
      const graph = window.__x6BpmnExampleGraph
      const lane = graph?.getCellById(laneId)
      const task = graph?.getCellById(taskId)

      if (!graph || !lane?.isNode?.() || !task?.isNode?.()) {
        throw new Error('无法定位待恢复父链的节点')
      }

      lane.unembed(task)
      task.setPosition(820, 520)

      if (typeof (graph as { trigger?: (name: string, payload: unknown) => void }).trigger === 'function') {
        ;(graph as { trigger: (name: string, payload: unknown) => void }).trigger('node:moved', { node: task })
        return
      }

      if (typeof (graph as { emit?: (name: string, payload: unknown) => void }).emit === 'function') {
        ;(graph as { emit: (name: string, payload: unknown) => void }).emit('node:moved', { node: task })
      }
    }, { laneId: laneBefore.id, taskId: taskBefore.id })

    const taskRestored = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expect(taskRestored.parentId).toBe(laneBefore.id)
    expect(taskRestored.x).toBeCloseTo(taskBefore.x, 0)
    expect(taskRestored.y).toBeCloseTo(taskBefore.y, 0)

    const delta = { x: 70, y: 30 }
    await dragCellById(page, poolBefore.id, delta)

    const laneAfter = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const taskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expectMovedBy(laneBefore, laneAfter, delta)
    expectMovedBy(taskRestored, taskAfter, delta)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('lane 内的子流程导出再导入后应保持归属并随 pool 移动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-sub-process', { x: 420, y: 260 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const subprocessBefore = await getNodeSnapshot(page, 'bpmn-sub-process', '子流程')

    expect(subprocessBefore.parentId).toBe(laneBefore.id)

    const delta = { x: 65, y: 25 }
    await dragCellById(page, poolBefore.id, delta)

    const subprocessAfter = await getNodeSnapshot(page, 'bpmn-sub-process', '子流程')

    expectMovedBy(subprocessBefore, subprocessAfter, delta)
    expect(subprocessAfter.parentId).toBe(laneBefore.id)
  })

  test('导出再导入后的 pool 与 lane resize 不应打断父子关系或产生重复视图', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 430, y: 260 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    await resizeCellById(page, poolBefore.id, { width: 520, height: 260 })
    await resizeCellById(page, laneBefore.id, { width: 460, height: 140 })

    const poolAfter = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneAfter = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const taskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')

    expect(poolAfter.width).toBe(520)
    expect(poolAfter.height).toBe(260)
    expect(laneAfter.width).toBe(460)
    expect(laneAfter.height).toBe(140)
    expect(laneAfter.parentId).toBe(poolAfter.id)
    expect(taskAfter.parentId).toBe(laneAfter.id)
    await expectSingleMainGraphRootView(page, poolAfter.id)
  })

  test('跨 pool 连线应按线型区分，消息流往返后保留 terminals 与 XML 语义', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 240, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 240, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 240, y: 260 })

    await dropStencilShape(page, 'bpmn-pool', { x: 640, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 640, y: 260 })
    await dropStencilShape(page, 'bpmn-service-task', { x: 640, y: 260 })

    const canUseSequenceFlow = await validateConfiguredConnection(page, {
      shape: 'bpmn-sequence-flow',
      source: { shape: 'bpmn-user-task', label: '用户任务' },
      target: { shape: 'bpmn-service-task', label: '服务任务' },
    })
    const canUseMessageFlow = await validateConfiguredConnection(page, {
      shape: 'bpmn-message-flow',
      source: { shape: 'bpmn-user-task', label: '用户任务' },
      target: { shape: 'bpmn-service-task', label: '服务任务' },
    })

    expect(canUseSequenceFlow).toBe(false)
    expect(canUseMessageFlow).toBe(true)

    const sourceNode = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')
    const targetNode = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')
    const edgeBefore = await addEdge(page, {
      shape: 'bpmn-message-flow',
      source: { shape: 'bpmn-user-task', label: '用户任务' },
      target: { shape: 'bpmn-service-task', label: '服务任务' },
    })

    await roundtripXml(page)

    const sourceAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')
    const targetAfter = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')
    const edgeAfter = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')
    const xml = await exportXml(page)

    expect(edgeAfter.shape).toBe('bpmn-message-flow')
    expect(edgeAfter.sourceId).toBe(sourceAfter.id)
    expect(edgeAfter.targetId).toBe(targetAfter.id)
    expect(xml).toContain('<bpmn:messageFlow')
    expect(xml).toContain(`sourceRef="${sourceAfter.id}"`)
    expect(xml).toContain(`targetRef="${targetAfter.id}"`)
  })

  test('消息流导入后重连目标节点应保留新目标并继续导出为 MessageFlow', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 240, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 240, y: 260 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 240, y: 260 })

    await dropStencilShape(page, 'bpmn-pool', { x: 640, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 640, y: 220 })
    await dropStencilShape(page, 'bpmn-lane', { x: 640, y: 320 })
    await dropStencilShape(page, 'bpmn-service-task', { x: 640, y: 220 })
    await dropStencilShape(page, 'bpmn-send-task', { x: 640, y: 320 })

    const edge = await addEdge(page, {
      shape: 'bpmn-message-flow',
      source: { shape: 'bpmn-user-task', label: '用户任务' },
      target: { shape: 'bpmn-service-task', label: '服务任务' },
    })

    await roundtripXml(page)

    const importedEdge = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')
    await retargetEdge(page, importedEdge.id, { shape: 'bpmn-send-task', label: '发送任务' })

    const sendTask = await getNodeSnapshot(page, 'bpmn-send-task', '发送任务')
    const edgeRetargeted = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')

    expect(edgeRetargeted.shape).toBe('bpmn-message-flow')
    expect(edgeRetargeted.targetId).toBe(sendTask.id)

    await roundtripXml(page)

    const edgeAfter = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')
    const xml = await exportXml(page)
    const sendTaskAfter = await getNodeSnapshot(page, 'bpmn-send-task', '发送任务')

    expect(edgeAfter.shape).toBe('bpmn-message-flow')
    expect(edgeAfter.targetId).toBe(sendTaskAfter.id)
    expect(xml).toContain('<bpmn:messageFlow')
    expect(xml).toContain(`targetRef="${sendTask.id}"`)
  })

  test('lane 内嵌子流程的内部节点与边界事件导入后应同时随子流程和 pool 联动', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-sub-process', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-service-task', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-boundary-event-timer', { x: 470, y: 260 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const laneBefore = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const subprocessBefore = await getNodeSnapshot(page, 'bpmn-sub-process', '子流程')
    const taskBefore = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')
    const boundaryBefore = await getNodeSnapshot(page, 'bpmn-boundary-event-timer', '定时')

    expect(subprocessBefore.parentId).toBe(laneBefore.id)
    expect(taskBefore.parentId).toBe(subprocessBefore.id)
    expect(boundaryBefore.parentId).toBe(subprocessBefore.id)

    const subprocessDelta = { x: 40, y: 18 }
    await dragCellById(page, subprocessBefore.id, subprocessDelta)

    const subprocessMoved = await getNodeSnapshot(page, 'bpmn-sub-process', '子流程')
    const taskMoved = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')
    const boundaryMoved = await getNodeSnapshot(page, 'bpmn-boundary-event-timer', '定时')

    expectMovedBy(subprocessBefore, subprocessMoved, subprocessDelta)
    expectMovedBy(taskBefore, taskMoved, subprocessDelta)
    expectMovedBy(boundaryBefore, boundaryMoved, subprocessDelta)
    expect(taskMoved.parentId).toBe(subprocessMoved.id)
    expect(boundaryMoved.parentId).toBe(subprocessMoved.id)

    const poolDelta = { x: 70, y: 26 }
    await dragCellById(page, poolBefore.id, poolDelta)

    const laneAfter = await getNodeSnapshot(page, 'bpmn-lane', '道')
    const subprocessAfter = await getNodeSnapshot(page, 'bpmn-sub-process', '子流程')
    const taskAfter = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')
    const boundaryAfter = await getNodeSnapshot(page, 'bpmn-boundary-event-timer', '定时')

    expectMovedBy(laneBefore, laneAfter, poolDelta)
    expectMovedBy(subprocessMoved, subprocessAfter, poolDelta)
    expectMovedBy(taskMoved, taskAfter, poolDelta)
    expectMovedBy(boundaryMoved, boundaryAfter, poolDelta)
    expect(subprocessAfter.parentId).toBe(laneAfter.id)
    expect(taskAfter.parentId).toBe(subprocessAfter.id)
    expect(boundaryAfter.parentId).toBe(subprocessAfter.id)
  })

  test('多次 resize 与 lane 位移往返后应保持尺寸、父链与主画布单视图', async ({ page }) => {
    await waitForGraph(page)
    await clearGraph(page)

    await dropStencilShape(page, 'bpmn-pool', { x: 420, y: 260 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 220 })
    await dropStencilShape(page, 'bpmn-lane', { x: 420, y: 320 })
    await dropStencilShape(page, 'bpmn-user-task', { x: 340, y: 220 })
    await dropStencilShape(page, 'bpmn-service-task', { x: 500, y: 320 })

    await roundtripXml(page)

    const poolBefore = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const lanesBefore = await getNodeSnapshotsByShape(page, 'bpmn-lane')
    const serviceTaskBefore = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')

    await dragCellById(page, lanesBefore[1].id, { x: 0, y: 18 })

    const laneMoved = await getNodeSnapshotsByShape(page, 'bpmn-lane')
    const serviceTaskMoved = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')

    expectMovedBy(lanesBefore[1], laneMoved[1], { x: 0, y: 18 })
    expectMovedBy(serviceTaskBefore, serviceTaskMoved, { x: 0, y: 18 })

    await resizeCellById(page, poolBefore.id, { width: 560, height: 320 })
    await resizeCellById(page, laneMoved[0].id, { width: 500, height: 120 })
    await resizeCellById(page, laneMoved[1].id, { width: 500, height: 150 })

    await roundtripXml(page)

    const poolAfter = await getNodeSnapshot(page, 'bpmn-pool', '池')
    const lanesAfter = await getNodeSnapshotsByShape(page, 'bpmn-lane')
    const userTaskAfter = await getNodeSnapshot(page, 'bpmn-user-task', '用户任务')
    const serviceTaskAfter = await getNodeSnapshot(page, 'bpmn-service-task', '服务任务')

    expect(poolAfter.width).toBe(560)
    expect(poolAfter.height).toBe(320)
    expect(lanesAfter[0].width).toBe(500)
    expect(lanesAfter[0].height).toBe(120)
    expect(lanesAfter[1].width).toBe(500)
    expect(lanesAfter[1].height).toBe(150)
    expect(lanesAfter[0].parentId).toBe(poolAfter.id)
    expect(lanesAfter[1].parentId).toBe(poolAfter.id)
    expect(userTaskAfter.parentId).toBe(lanesAfter[0].id)
    expect(serviceTaskAfter.parentId).toBe(lanesAfter[1].id)
    await expectSingleMainGraphRootView(page, poolAfter.id)
  })
})