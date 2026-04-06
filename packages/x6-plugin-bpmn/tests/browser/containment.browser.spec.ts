import { expect, test, type Page } from '@playwright/test'

type ScenarioIds = {
  poolId: string
  laneId: string
  taskId: string
  boundaryId?: string
}

type MessageScenarioIds = {
  leftPoolId: string
  rightPoolId: string
  leftLaneId: string
  rightLaneId: string
  sourceTaskId: string
  targetTaskId: string
}

type NodeSnapshot = {
  id: string
  x: number
  y: number
  width: number
  height: number
  parentId: string | null
}

type EdgeSnapshot = {
  id: string
  shape: string
  sourceId: string | null
  targetId: string | null
}

async function waitForHarness(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__x6PluginBrowserHarness))
}

async function createPoolLaneTaskScenario(page: Page): Promise<ScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createPoolLaneTaskScenario()
  })
}

async function createPoolLaneTaskBoundaryScenario(page: Page): Promise<ScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createPoolLaneTaskBoundaryScenario()
  })
}

async function createTwoPoolMessageScenario(page: Page): Promise<MessageScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createTwoPoolMessageScenario()
  })
}

async function getNodeSnapshot(page: Page, id: string): Promise<NodeSnapshot> {
  return page.evaluate((nodeId) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getNodeSnapshot(nodeId)
  }, id)
}

async function getEdgeSnapshotByShape(page: Page, shape: string): Promise<EdgeSnapshot> {
  return page.evaluate((edgeShape) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getEdgeSnapshotByShape(edgeShape)
  }, shape)
}

async function validateConnection(
  page: Page,
  args: { shape: string; sourceId: string; targetId: string },
): Promise<boolean> {
  return page.evaluate((payload) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.validateConnection(payload)
  }, args)
}

async function addEdge(
  page: Page,
  args: { shape: string; sourceId: string; targetId: string },
): Promise<EdgeSnapshot> {
  return page.evaluate((payload) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.addEdge(payload)
  }, args)
}

async function translateNode(page: Page, id: string, delta: { x: number; y: number }): Promise<void> {
  await page.evaluate(({ nodeId, deltaValue }) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    harness.translateNode(nodeId, deltaValue)
  }, { nodeId: id, deltaValue: delta })
}

async function resizeNode(page: Page, id: string, size: { width: number; height: number }): Promise<void> {
  await page.evaluate(({ nodeId, nextSize }) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    harness.resizeNode(nodeId, nextSize)
  }, { nodeId: id, nextSize: size })
}

async function roundtripXml(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.roundtripXml()
  })
}

async function simulateInvalidMoveWithParentLoss(
  page: Page,
  args: { nodeId: string; parentId: string; x: number; y: number; eventName?: 'node:moving' | 'node:moved' },
): Promise<void> {
  await page.evaluate((payload) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    harness.simulateInvalidMoveWithParentLoss(payload)
  }, args)
}

function expectMovedBy(before: NodeSnapshot, after: NodeSnapshot, delta: { x: number; y: number }): void {
  expect(after.x - before.x).toBeCloseTo(delta.x, 0)
  expect(after.y - before.y).toBeCloseTo(delta.y, 0)
}

test.describe('主库浏览器行为回归', () => {
  test('节点越出 Pool 且父链丢失后，应恢复嵌套并继续随 Pool 联动', async ({ page }) => {
    await waitForHarness(page)

    const scenario = await createPoolLaneTaskScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)

    await simulateInvalidMoveWithParentLoss(page, {
      nodeId: scenario.taskId,
      parentId: scenario.laneId,
      x: 820,
      y: 520,
    })

    const taskRestored = await getNodeSnapshot(page, scenario.taskId)
    expect(taskRestored.parentId).toBe(scenario.laneId)
    expect(taskRestored.x).toBeCloseTo(taskBefore.x, 0)
    expect(taskRestored.y).toBeCloseTo(taskBefore.y, 0)

    const delta = { x: 70, y: 30 }
    await translateNode(page, scenario.poolId, delta)

    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expectMovedBy(laneBefore, laneAfter, delta)
    expectMovedBy(taskRestored, taskAfter, delta)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('宿主越界恢复时，边界事件也应保持附着并随 Pool 联动', async ({ page }) => {
    await waitForHarness(page)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const boundaryBefore = await getNodeSnapshot(page, scenario.boundaryId!)

    await simulateInvalidMoveWithParentLoss(page, {
      nodeId: scenario.taskId,
      parentId: scenario.laneId,
      x: 820,
      y: 520,
    })

    const taskRestored = await getNodeSnapshot(page, scenario.taskId)
    const boundaryRestored = await getNodeSnapshot(page, scenario.boundaryId!)

    expect(taskRestored.parentId).toBe(scenario.laneId)
    expect(boundaryRestored.parentId).toBe(scenario.taskId)
    expect(taskRestored.x).toBeCloseTo(taskBefore.x, 0)
    expect(taskRestored.y).toBeCloseTo(taskBefore.y, 0)

    const delta = { x: 60, y: 25 }
    await translateNode(page, scenario.poolId, delta)

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const boundaryAfter = await getNodeSnapshot(page, scenario.boundaryId!)

    expectMovedBy(taskRestored, taskAfter, delta)
    expectMovedBy(boundaryRestored, boundaryAfter, delta)
    expect(boundaryAfter.parentId).toBe(taskAfter.id)
  })

  test('导出再导入后的 Pool 与 Lane resize 不应打断父链或尺寸结果', async ({ page }) => {
    await waitForHarness(page)

    const scenario = await createPoolLaneTaskScenario(page)
    await roundtripXml(page)

    await resizeNode(page, scenario.poolId, { width: 520, height: 260 })
    await resizeNode(page, scenario.laneId, { width: 460, height: 140 })

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expect(poolAfter.width).toBe(520)
    expect(poolAfter.height).toBe(260)
    expect(laneAfter.width).toBe(460)
    expect(laneAfter.height).toBe(140)
    expect(laneAfter.parentId).toBe(poolAfter.id)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('跨 Pool 连线应按线型区分，消息流往返后保留 terminals', async ({ page }) => {
    await waitForHarness(page)

    const scenario = await createTwoPoolMessageScenario(page)
    const canUseSequenceFlow = await validateConnection(page, {
      shape: 'bpmn-sequence-flow',
      sourceId: scenario.sourceTaskId,
      targetId: scenario.targetTaskId,
    })
    const canUseMessageFlow = await validateConnection(page, {
      shape: 'bpmn-message-flow',
      sourceId: scenario.sourceTaskId,
      targetId: scenario.targetTaskId,
    })

    expect(canUseSequenceFlow).toBe(false)
    expect(canUseMessageFlow).toBe(true)

    await addEdge(page, {
      shape: 'bpmn-message-flow',
      sourceId: scenario.sourceTaskId,
      targetId: scenario.targetTaskId,
    })

    await roundtripXml(page)

    const edgeAfter = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')
    const sourceAfter = await getNodeSnapshot(page, scenario.sourceTaskId)
    const targetAfter = await getNodeSnapshot(page, scenario.targetTaskId)

    expect(edgeAfter.shape).toBe('bpmn-message-flow')
    expect(edgeAfter.sourceId).toBe(sourceAfter.id)
    expect(edgeAfter.targetId).toBe(targetAfter.id)
  })
})