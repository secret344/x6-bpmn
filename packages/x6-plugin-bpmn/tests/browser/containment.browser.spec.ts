import { expect, test, type Locator, type Page } from '@playwright/test'

import { createBrowserScreenshotTaker } from './screenshot-taker'

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

type DragPoint = {
  x: number
  y: number
}

type DragOptions = {
  startOffset?: DragPoint
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

async function getSelectedCellIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getSelectedCellIds()
  })
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

async function getEdgeCountByShape(page: Page, shape: string): Promise<number> {
  return page.evaluate((edgeShape) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getEdgeCountByShape(edgeShape)
  }, shape)
}

function expectMovedBy(before: NodeSnapshot, after: NodeSnapshot, delta: { x: number; y: number }): void {
  expect(after.x - before.x).toBeCloseTo(delta.x, 0)
  expect(after.y - before.y).toBeCloseTo(delta.y, 0)
}

function expectPositionNear(actual: NodeSnapshot, expected: DragPoint, tolerance = 10): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance)
}

function getNodeCenter(snapshot: NodeSnapshot): DragPoint {
  return {
    x: snapshot.x + snapshot.width / 2,
    y: snapshot.y + snapshot.height / 2,
  }
}

function distanceToRectEdge(point: DragPoint, rect: Pick<NodeSnapshot, 'x' | 'y' | 'width' | 'height'>): number {
  const left = point.x - rect.x
  const right = rect.x + rect.width - point.x
  const top = point.y - rect.y
  const bottom = rect.y + rect.height - point.y
  return Math.min(Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom))
}

function getNodeLocator(page: Page, id: string): Locator {
  return page.locator(`.x6-node[data-cell-id="${id}"]`).first()
}

function getPortLocator(page: Page, id: string, group: 'left' | 'right' | 'top' | 'bottom'): Locator {
  return page.locator(`.x6-node[data-cell-id="${id}"] .x6-port-${group} .x6-port-body`).first()
}

async function getCenter(locator: Locator): Promise<DragPoint> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('无法定位浏览器交互目标区域')
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

async function clearSelection(page: Page): Promise<void> {
  const graph = page.locator('#graph')
  const box = await graph.boundingBox()
  if (!box) {
    throw new Error('无法定位图布区域')
  }

  await graph.click({
    position: {
      x: Math.max(box.width - 24, 24),
      y: Math.max(box.height - 24, 24),
    },
    force: true,
  })
  await expect.poll(() => getSelectedCellIds(page)).toEqual([])
}

async function clickNode(page: Page, id: string, offset?: DragPoint): Promise<void> {
  const locator = getNodeLocator(page, id)
  await expect(locator).toBeVisible()

  if (!(await getSelectedCellIds(page)).includes(id)) {
    await clearSelection(page)
  }

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  await locator.click({
    position: {
      x: offset?.x ?? box.width / 2,
      y: offset?.y ?? box.height / 2,
    },
    force: true,
  })

  if ((await getSelectedCellIds(page)).includes(id)) {
    return
  }

  const labels = locator.locator('text')
  for (let index = 0; index < await labels.count(); index += 1) {
    await labels.nth(index).click({ force: true })
    if ((await getSelectedCellIds(page)).includes(id)) {
      return
    }
  }

  const shapes = locator.locator('path, rect, polygon, ellipse')
  for (let index = 0; index < await shapes.count(); index += 1) {
    await shapes.nth(index).click({ force: true })
    if ((await getSelectedCellIds(page)).includes(id)) {
      return
    }
  }

  await expect.poll(() => getSelectedCellIds(page)).toContain(id)
}

async function dragNodeBy(page: Page, id: string, delta: DragPoint, options: DragOptions = {}): Promise<void> {
  const locator = getNodeLocator(page, id)
  await expect(locator).toBeVisible()

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  const startX = box.x + (options.startOffset?.x ?? box.width / 2)
  const startY = box.y + (options.startOffset?.y ?? box.height / 2)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 20 })
  await page.mouse.up()
}

async function dragSelectionBoxBy(page: Page, delta: DragPoint): Promise<void> {
  const locator = page.locator('.x6-widget-selection-box').first()
  await expect(locator).toBeVisible()

  const center = await getCenter(locator)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + delta.x, center.y + delta.y, { steps: 20 })
  await page.mouse.up()
}

async function dragSelectionBoxWithOvershoot(
  page: Page,
  firstDelta: DragPoint,
  secondDelta: DragPoint,
): Promise<void> {
  const locator = page.locator('.x6-widget-selection-box').first()
  await expect(locator).toBeVisible()

  const center = await getCenter(locator)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + firstDelta.x, center.y + firstDelta.y, { steps: 20 })
  await page.mouse.move(center.x + secondDelta.x, center.y + secondDelta.y, { steps: 20 })
  await page.mouse.up()
}

async function resizeNodeBy(page: Page, id: string, delta: DragPoint, selectOffset?: DragPoint): Promise<void> {
  await clickNode(page, id, selectOffset)

  const handle = page.locator('.x6-widget-transform-resize[data-position="bottom-right"]').last()
  await expect(handle).toBeVisible()

  const center = await getCenter(handle)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + delta.x, center.y + delta.y, { steps: 20 })
  await page.mouse.up()
}

async function selectEdgeShape(page: Page, shape: 'bpmn-sequence-flow' | 'bpmn-message-flow'): Promise<void> {
  const testId = shape === 'bpmn-message-flow' ? 'edge-shape-message' : 'edge-shape-sequence'
  await page.getByTestId(testId).click()
}

async function dragConnection(
  page: Page,
  args: {
    sourceId: string
    sourceGroup: 'left' | 'right' | 'top' | 'bottom'
    targetId: string
    targetGroup: 'left' | 'right' | 'top' | 'bottom'
  },
): Promise<void> {
  const source = getPortLocator(page, args.sourceId, args.sourceGroup)
  const target = getPortLocator(page, args.targetId, args.targetGroup)
  await expect(source).toBeVisible()
  await expect(target).toBeVisible()

  const sourceCenter = await getCenter(source)
  const targetCenter = await getCenter(target)

  await page.mouse.move(sourceCenter.x, sourceCenter.y)
  await page.mouse.down()
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 24 })
  await page.mouse.up()
}

test.describe('主库浏览器行为回归', () => {
  test('节点越出 Pool 后，应恢复嵌套并继续随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    await takeScreenshot(page, '初始泳池布局')

    await dragNodeBy(page, scenario.taskId, { x: 700, y: 430 })
    await takeScreenshot(page, '任务拖出泳池后自动恢复')

    await expect.poll(() => getNodeSnapshot(page, scenario.taskId)).toMatchObject({
      parentId: scenario.laneId,
    })

    const taskRestored = await getNodeSnapshot(page, scenario.taskId)
    expect(taskRestored.parentId).toBe(scenario.laneId)
    expectPositionNear(taskRestored, taskBefore)

    const delta = { x: 70, y: 30 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '泳池拖动后任务继续联动')

    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expectMovedBy(laneBefore, laneAfter, delta)
    expectMovedBy(taskRestored, taskAfter, delta)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('节点移动到 Pool 空白区时，应挂在 Pool 上并继续随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, '初始泳池与泳道布局')

    const relocationDelta = { x: 160, y: 120 }
    await dragNodeBy(page, scenario.taskId, relocationDelta)
    await takeScreenshot(page, '任务移动到 Pool 空白区后保持合法')

    const taskInPool = await getNodeSnapshot(page, scenario.taskId)
    expect(taskInPool.parentId).toBe(scenario.poolId)
    expect(taskInPool.y).toBeGreaterThan(laneBefore.y + laneBefore.height)
    expectPositionNear(taskInPool, {
      x: taskBefore.x + relocationDelta.x,
      y: taskBefore.y + relocationDelta.y,
    })

    const delta = { x: 70, y: 30 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '拖动 Pool 后空白区任务继续联动')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const actualPoolDelta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expectMovedBy(taskInPool, taskAfter, actualPoolDelta)
    expect(taskAfter.parentId).toBe(poolAfter.id)
  })

  test('选中后拖动选框越界时，应回到拖拽前位置', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)

    await clickNode(page, scenario.taskId)
    await takeScreenshot(page, '选中任务后显示选框')

    await dragSelectionBoxBy(page, { x: 700, y: 430 })
    await takeScreenshot(page, '选框拖出泳池后任务自动恢复')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    expect(taskAfter.parentId).toBe(scenario.laneId)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('选中后持续拖动选框越界时，也应锁定在拖拽前位置', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)

    await clickNode(page, scenario.taskId)
    await takeScreenshot(page, '持续拖拽前的选框状态')

    await dragSelectionBoxWithOvershoot(page, { x: 520, y: 360 }, { x: 900, y: 620 })
    await takeScreenshot(page, '持续越界拖拽后任务仍回到起点')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    expect(taskAfter.parentId).toBe(scenario.laneId)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('宿主越界恢复时，边界事件也应保持附着并随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const boundaryBefore = await getNodeSnapshot(page, scenario.boundaryId!)
    await takeScreenshot(page, '边界事件初始附着状态')

    await dragNodeBy(page, scenario.taskId, { x: 700, y: 430 })
    await takeScreenshot(page, '宿主被拖出后边界事件仍恢复附着')

    await expect.poll(() => getNodeSnapshot(page, scenario.boundaryId!)).toMatchObject({
      parentId: scenario.taskId,
    })

    const taskRestored = await getNodeSnapshot(page, scenario.taskId)
    const boundaryRestored = await getNodeSnapshot(page, scenario.boundaryId!)

    expect(taskRestored.parentId).toBe(scenario.laneId)
    expect(boundaryRestored.parentId).toBe(scenario.taskId)
    expectPositionNear(taskRestored, taskBefore)

    const delta = { x: 60, y: 25 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '泳池拖动后边界事件继续跟随宿主')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const boundaryAfter = await getNodeSnapshot(page, scenario.boundaryId!)
    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const actualPoolDelta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expectMovedBy(taskRestored, taskAfter, actualPoolDelta)
    expectMovedBy(boundaryRestored, boundaryAfter, actualPoolDelta)
    expect(boundaryAfter.parentId).toBe(taskAfter.id)
  })

  test('直接拖拽边界事件越界时，默认配置下仍应保持附着在宿主边框', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const boundaryBefore = await getNodeSnapshot(page, scenario.boundaryId!)
    await takeScreenshot(page, '边界事件直拖前状态')

    await dragNodeBy(page, scenario.boundaryId!, { x: 760, y: 520 })
    await takeScreenshot(page, '边界事件直拖越界后仍附着宿主')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const boundaryAfter = await getNodeSnapshot(page, scenario.boundaryId!)

    expect(taskAfter.parentId).toBe(scenario.laneId)
    expectPositionNear(taskAfter, taskBefore)
    expect(boundaryAfter.parentId).toBe(taskAfter.id)
    expect(distanceToRectEdge(getNodeCenter(boundaryAfter), taskAfter)).toBeCloseTo(0, 1)
    expect(Math.abs(boundaryAfter.x - boundaryBefore.x) + Math.abs(boundaryAfter.y - boundaryBefore.y)).toBeGreaterThan(0)
  })

  test('导入后的任务首次直接拖拽越界时，也应回到导入后的合法位置', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    await roundtripXml(page)

    const taskLocator = getNodeLocator(page, scenario.taskId)
    await expect(taskLocator).toBeVisible()

    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const taskBoxBefore = await taskLocator.boundingBox()
    if (!taskBoxBefore) {
      throw new Error('无法定位导入后任务的初始渲染位置')
    }

    await takeScreenshot(page, '导入后首次直拖前的任务位置')

    await dragNodeBy(page, scenario.taskId, { x: 700, y: 430 })

    await expect.poll(() => getNodeSnapshot(page, scenario.taskId)).toMatchObject({
      parentId: scenario.laneId,
    })

    await expect.poll(async () => {
      const box = await taskLocator.boundingBox()
      if (!box) {
        return Number.POSITIVE_INFINITY
      }

      return Math.max(Math.abs(box.x - taskBoxBefore.x), Math.abs(box.y - taskBoxBefore.y))
    }).toBeLessThanOrEqual(10)

    await takeScreenshot(page, '导入后首次直拖越界后的任务位置')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const taskBoxAfter = await taskLocator.boundingBox()
    if (!taskBoxAfter) {
      throw new Error('无法定位导入后任务的恢复渲染位置')
    }

    expect(taskAfter.parentId).toBe(scenario.laneId)
    expectPositionNear(taskAfter, taskBefore)
    expect(Math.max(Math.abs(taskBoxAfter.x - taskBoxBefore.x), Math.abs(taskBoxAfter.y - taskBoxBefore.y))).toBeLessThanOrEqual(10)
  })

  test('导出再导入后的 Pool resize 与 Lane resize 尝试不应打断父链或既有尺寸结果', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    await roundtripXml(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    await takeScreenshot(page, '导入导出往返后的初始布局')

    await resizeNodeBy(page, scenario.poolId, { x: 120, y: 40 }, { x: 12, y: 40 })
    await takeScreenshot(page, '泳池缩放后的布局')
    const poolAfterPoolResize = await getNodeSnapshot(page, scenario.poolId)
    const laneAfterPoolResize = await getNodeSnapshot(page, scenario.laneId)

    await resizeNodeBy(page, scenario.laneId, { x: 90, y: 20 }, { x: 250, y: 80 })
    await takeScreenshot(page, '泳道缩放后的布局')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expect(poolAfterPoolResize.width).toBeGreaterThan(poolBefore.width)
    expect(poolAfterPoolResize.height).toBeGreaterThan(poolBefore.height)
    expect(poolAfter.width).toBeCloseTo(poolAfterPoolResize.width, 0)
    expect(poolAfter.height).toBeCloseTo(poolAfterPoolResize.height, 0)
    expect(laneAfter.width).toBeGreaterThanOrEqual(laneAfterPoolResize.width)
    expect(laneAfter.height).toBeGreaterThanOrEqual(laneAfterPoolResize.height)
    expect(laneAfter.width).toBeGreaterThanOrEqual(laneBefore.width)
    expect(laneAfter.height).toBeGreaterThanOrEqual(laneBefore.height)
    expect(laneAfter.parentId).toBe(poolAfter.id)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('跨 Pool 连线应按线型区分，消息流往返后保留 terminals', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createTwoPoolMessageScenario(page)
    await takeScreenshot(page, '跨泳池任务初始布局')

    await selectEdgeShape(page, 'bpmn-sequence-flow')
    await dragConnection(page, {
      sourceId: scenario.sourceTaskId,
      sourceGroup: 'right',
      targetId: scenario.targetTaskId,
      targetGroup: 'left',
    })
    await takeScreenshot(page, '尝试使用顺序流跨泳池连线')

    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-sequence-flow')).toBe(0)

    await selectEdgeShape(page, 'bpmn-message-flow')
    await dragConnection(page, {
      sourceId: scenario.sourceTaskId,
      sourceGroup: 'right',
      targetId: scenario.targetTaskId,
      targetGroup: 'left',
    })
    await takeScreenshot(page, '使用消息流跨泳池连线成功')

    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-message-flow')).toBe(1)

    await roundtripXml(page)
    await takeScreenshot(page, '消息流往返导入导出后仍保留 terminals')

    const edgeAfter = await getEdgeSnapshotByShape(page, 'bpmn-message-flow')
    const sourceAfter = await getNodeSnapshot(page, scenario.sourceTaskId)
    const targetAfter = await getNodeSnapshot(page, scenario.targetTaskId)

    expect(edgeAfter.shape).toBe('bpmn-message-flow')
    expect(edgeAfter.sourceId).toBe(sourceAfter.id)
    expect(edgeAfter.targetId).toBe(targetAfter.id)
  })
})