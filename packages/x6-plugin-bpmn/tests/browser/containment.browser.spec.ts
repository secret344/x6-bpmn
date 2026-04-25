import { expect, test } from '@playwright/test'

import { createBrowserScreenshotTaker } from './screenshot-taker'
import {
  waitForHarness,
  createPoolLaneTaskScenario,
  createPoolLaneTransactionScenario,
  createPoolTwoLaneTransactionExtractionScenario,
  createPoolTwoLaneTransactionInternalScenario,
  createStandaloneTaskScenario,
  createTransactionWrapScenario,
  addFirstPoolScenario,
  createPoolLaneTaskBoundaryScenario,
  createTwoPoolMessageScenario,
  createExampleLikeMultiLaneScenarioInBrowser,
  createMultiLaneScenario,
  addLaneToPoolInBrowser,
  removeNodeInBrowser,
  removeSelectedCellsInBrowser,
  selectCellInBrowser,
  getNodeSnapshot,
  getPoolLaneSnapshots,
  getEdgeSnapshotByShape,
  getSelectedCellIds,
  roundtripXml,
  getEdgeCountByShape,
  expectMovedNear,
  expectPositionNear,
  expectInsideRect,
  getNodeCenter,
  distanceToRectEdge,
  getNodeLocator,
  clickNode,
  dragNodeBy,
  dragSelectionBoxBy,
  dragSelectionBoxWithOvershoot,
  resizeNodeBy,
  selectEdgeShape,
  dragConnection,
} from './helpers'

type FourLaneScenario = Awaited<ReturnType<typeof createMultiLaneScenario>> & {
  lane3Id: string
  lane4Id: string
  lane3TaskId: string
  lane4TaskId: string
}

async function createFourLaneScenario(page: Parameters<typeof createMultiLaneScenario>[0]): Promise<FourLaneScenario> {
  const scenario = await createMultiLaneScenario(page)
  const addedLane3 = await addLaneToPoolInBrowser(page, scenario.poolId)
  const addedLane4 = await addLaneToPoolInBrowser(page, scenario.poolId)

  expect(addedLane3).not.toBeNull()
  expect(addedLane4).not.toBeNull()
  await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(4)

  return {
    ...scenario,
    lane3Id: addedLane3!.laneId,
    lane4Id: addedLane4!.laneId,
    lane3TaskId: addedLane3!.addedTaskId,
    lane4TaskId: addedLane4!.addedTaskId,
  }
}

test.describe('主库浏览器行为回归', () => {
  test('先放任务再放第一个 Pool 时，应自动包裹现有节点并保持任务位于 Pool 上层', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const standalone = await createStandaloneTaskScenario(page)
    const taskBefore = await getNodeSnapshot(page, standalone.taskId)
    await takeScreenshot(page, '首个泳池创建前的独立任务')

    const scenario = await addFirstPoolScenario(page)
    await takeScreenshot(page, '新增首个泳池后自动包裹现有任务')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expect(taskAfter.parentId).toBe(poolAfter.id)
    expect(poolAfter.x).toBeLessThan(taskBefore.x)
    expect(poolAfter.y).toBeLessThan(taskBefore.y)
    expect(poolAfter.x + poolAfter.width).toBeGreaterThan(taskAfter.x + taskAfter.width)
    expect(poolAfter.y + poolAfter.height).toBeGreaterThan(taskAfter.y + taskAfter.height)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('先放开始节点再放事务时，开始节点拖入事务后不应被事务遮住', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createTransactionWrapScenario(page)
    const startBefore = await getNodeSnapshot(page, scenario.startId)
    const transactionBefore = await getNodeSnapshot(page, scenario.transactionId)
    await takeScreenshot(page, '事务创建后开始节点尚未嵌入')

    const delta = {
      x: transactionBefore.x + transactionBefore.width / 2 - (startBefore.x + startBefore.width / 2),
      y: transactionBefore.y + transactionBefore.height / 2 - (startBefore.y + startBefore.height / 2),
    }
    await dragNodeBy(page, scenario.startId, delta)
    await expect.poll(async () => (await getNodeSnapshot(page, scenario.startId)).parentId).toBe(scenario.transactionId)
    await takeScreenshot(page, '开始节点拖入事务后仍显示在事务上层')

    const startAfter = await getNodeSnapshot(page, scenario.startId)
    const transactionAfter = await getNodeSnapshot(page, scenario.transactionId)

    expect(startAfter.parentId).toBe(scenario.transactionId)
    expectInsideRect(startAfter, transactionAfter)
  })

  test('新增 Lane 后，Pool 内事务节点不应被新增 Lane 遮住', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTransactionScenario(page)
    const transactionBefore = await getNodeSnapshot(page, scenario.transactionId)
    await takeScreenshot(page, '新增-Lane-前事务位于-Pool-空白区')

    const added = await addLaneToPoolInBrowser(page, scenario.poolId)
    expect(added).not.toBeNull()
    await takeScreenshot(page, '新增-Lane-后事务仍应显示在-Lane-上层')

    const addedLane = await getNodeSnapshot(page, added!.laneId)
    const transactionAfter = await getNodeSnapshot(page, scenario.transactionId)
    const poolAfter = await getNodeSnapshot(page, scenario.poolId)

    expect(transactionAfter.parentId).toBe(scenario.poolId)
    expect(addedLane.parentId).toBe(scenario.poolId)
    expect(addedLane.y).toBeCloseTo(poolAfter.y, 0)
    expect(transactionAfter.y).toBeGreaterThanOrEqual(addedLane.y)
    expect(transactionAfter.y + transactionAfter.height).toBeLessThanOrEqual(addedLane.y + addedLane.height)

    await clickNode(page, scenario.transactionId, { x: 20, y: 20 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.transactionId])
    expect(transactionAfter).toEqual(transactionBefore)
  })

  test('事务跨 Lane 拖拽时，内部节点仍应保持事务父级', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolTwoLaneTransactionInternalScenario(page)
    const transactionBefore = await getNodeSnapshot(page, scenario.transactionId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, '事务跨-Lane-拖拽前内部节点属于事务')

    await dragNodeBy(page, scenario.transactionId, { x: 0, y: 170 }, { startOffset: { x: 28, y: 24 } })
    await takeScreenshot(page, '事务跨-Lane-拖拽后内部节点仍属于事务')

    const lane2After = await getNodeSnapshot(page, scenario.lane2Id)
    const transactionAfter = await getNodeSnapshot(page, scenario.transactionId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const transactionDelta = {
      x: transactionAfter.x - transactionBefore.x,
      y: transactionAfter.y - transactionBefore.y,
    }

    expect([scenario.lane1Id, scenario.lane2Id, scenario.poolId]).toContain(transactionAfter.parentId)
    expect(taskAfter.parentId).toBe(scenario.transactionId)
    expect(transactionAfter.y).toBeGreaterThan(transactionBefore.y)
    expectMovedNear(taskBefore, taskAfter, transactionDelta)
    if (transactionAfter.parentId === scenario.lane2Id) {
      expectInsideRect(transactionAfter, lane2After)
    }
    expectInsideRect(taskAfter, transactionAfter)
  })

  test('选中事务后拖拽选框跨 Lane 时，内部节点仍应保持事务父级', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolTwoLaneTransactionInternalScenario(page)
    const transactionBefore = await getNodeSnapshot(page, scenario.transactionId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)

    await clickNode(page, scenario.transactionId, { x: 30, y: 30 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.transactionId])
    await takeScreenshot(page, '选中事务后跨-Lane-拖拽前内部节点属于事务')

    await dragSelectionBoxBy(page, { x: 0, y: 170 })
    await takeScreenshot(page, '选中事务后跨-Lane-拖拽后内部节点仍属于事务')

    const lane2After = await getNodeSnapshot(page, scenario.lane2Id)
    const transactionAfter = await getNodeSnapshot(page, scenario.transactionId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const transactionDelta = {
      x: transactionAfter.x - transactionBefore.x,
      y: transactionAfter.y - transactionBefore.y,
    }

    expect([scenario.lane1Id, scenario.lane2Id, scenario.poolId]).toContain(transactionAfter.parentId)
    expect(taskAfter.parentId).toBe(scenario.transactionId)
    expect(transactionAfter.y).toBeGreaterThan(transactionBefore.y)
    expectMovedNear(taskBefore, taskAfter, transactionDelta)
    if (transactionAfter.parentId === scenario.lane2Id) {
      expectInsideRect(transactionAfter, lane2After)
    }
    expectInsideRect(taskAfter, transactionAfter)
  })

  test('事务内部节点直接拖出事务后，应改挂目标 Lane 并断开与事务内部节点的连线', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolTwoLaneTransactionExtractionScenario(page)
    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-sequence-flow')).toBe(1)
    await takeScreenshot(page, '事务内部节点拖出前保持事务内连线')

    await dragNodeBy(page, scenario.taskId, { x: 0, y: 190 })
    await takeScreenshot(page, '事务内部节点拖出后改挂目标-Lane-并断开内部连线')

    const lane2After = await getNodeSnapshot(page, scenario.lane2Id)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const peerTaskAfter = await getNodeSnapshot(page, scenario.peerTaskId)

    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-sequence-flow')).toBe(0)
    expect(taskAfter.parentId).toBe(scenario.lane2Id)
    expect(peerTaskAfter.parentId).toBe(scenario.transactionId)
    expectInsideRect(taskAfter, lane2After)
  })

  test('事务内部节点选中拖出事务后，应改挂目标 Lane 并断开与事务内部节点的连线', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolTwoLaneTransactionExtractionScenario(page)
    await clickNode(page, scenario.taskId)
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.taskId])
    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-sequence-flow')).toBe(1)
    await takeScreenshot(page, '事务内部节点选中拖出前保持事务内连线')

    await dragSelectionBoxBy(page, { x: 0, y: 190 })
    await takeScreenshot(page, '事务内部节点选中拖出后改挂目标-Lane-并断开内部连线')

    const lane2After = await getNodeSnapshot(page, scenario.lane2Id)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const peerTaskAfter = await getNodeSnapshot(page, scenario.peerTaskId)

    await expect.poll(() => getEdgeCountByShape(page, 'bpmn-sequence-flow')).toBe(0)
    expect(taskAfter.parentId).toBe(scenario.lane2Id)
    expect(peerTaskAfter.parentId).toBe(scenario.transactionId)
    expectInsideRect(taskAfter, lane2After)
  })

  test('节点拖向 Pool 外部时，应被钳制在 Pool 内容区并继续随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    await takeScreenshot(page, '初始泳池布局')

    await dragNodeBy(page, scenario.taskId, { x: 700, y: 430 })
    await takeScreenshot(page, '任务拖向泳池外部后被边界钳制')

    const taskClamped = await getNodeSnapshot(page, scenario.taskId)
    expect(taskClamped.parentId).toBe(scenario.poolId)
    expect(taskClamped.x).toBeGreaterThan(taskBefore.x)
    expect(taskClamped.y).toBeGreaterThan(taskBefore.y)
    expectInsideRect(taskClamped, {
      x: laneBefore.x,
      y: poolBefore.y,
      width: poolBefore.width - (laneBefore.x - poolBefore.x),
      height: poolBefore.height,
    })

    const delta = { x: 70, y: 30 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '泳池拖动后任务继续联动')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const actualPoolDelta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expectMovedNear(laneBefore, laneAfter, actualPoolDelta)
    expect(taskAfter.parentId).toBe(poolAfter.id)
    expectInsideRect(taskAfter, {
      x: laneAfter.x,
      y: poolAfter.y,
      width: poolAfter.width - (laneAfter.x - poolAfter.x),
      height: poolAfter.height,
    })
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

    expectMovedNear(laneBefore, await getNodeSnapshot(page, scenario.laneId), actualPoolDelta)
    expect(taskAfter.parentId).toBe(poolAfter.id)
    expectInsideRect(taskAfter, {
      x: laneBefore.x + actualPoolDelta.x,
      y: poolAfter.y,
      width: poolAfter.width - ((laneBefore.x + actualPoolDelta.x) - poolAfter.x),
      height: poolAfter.height,
    })
  })

  test('删除 Pool 时，应同时删除其 Lane 与内部任务', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    await clickNode(page, scenario.poolId, { x: 12, y: 40 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.poolId])
    await takeScreenshot(page, '删除 Pool 前的单泳池布局')

    await page.keyboard.press('Delete')
    await takeScreenshot(page, '删除 Pool 后泳道与任务一并移除')

    await expect(getNodeLocator(page, scenario.poolId)).toHaveCount(0)
    await expect(getNodeLocator(page, scenario.laneId)).toHaveCount(0)
    await expect(getNodeLocator(page, scenario.taskId)).toHaveCount(0)
  })

  test('选中后拖动选框越界时，应被钳制在 Pool 内容区', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)

    await clickNode(page, scenario.taskId)
    await takeScreenshot(page, '选中任务后显示选框')

    await dragSelectionBoxBy(page, { x: 700, y: 430 })
    await takeScreenshot(page, '选框拖向泳池外部后任务被边界钳制')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    expect(taskAfter.parentId).toBe(scenario.poolId)
    expectInsideRect(taskAfter, {
      x: laneBefore.x,
      y: poolBefore.y,
      width: poolBefore.width - (laneBefore.x - poolBefore.x),
      height: poolBefore.height,
    })
  })

  test('选中后持续拖动选框越界时，也应持续被钳制在 Pool 内容区', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)

    await clickNode(page, scenario.taskId)
    await takeScreenshot(page, '持续拖拽前的选框状态')

    await dragSelectionBoxWithOvershoot(page, { x: 520, y: 360 }, { x: 900, y: 620 })
    await takeScreenshot(page, '持续越界拖拽后任务仍被边界钳制')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    expect(taskAfter.parentId).toBe(scenario.poolId)
    expectInsideRect(taskAfter, {
      x: laneBefore.x,
      y: poolBefore.y,
      width: poolBefore.width - (laneBefore.x - poolBefore.x),
      height: poolBefore.height,
    })
  })

  test('选中 Pool 后拖动选框时，Pool、Lane 与内部任务应整体联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)

    await clickNode(page, scenario.poolId, { x: 12, y: 40 })
    await takeScreenshot(page, '选中 Pool 后显示选框')

    await dragSelectionBoxBy(page, { x: 90, y: 50 })
    await takeScreenshot(page, '拖动 Pool 选框后的整体联动')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const actualDelta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expectMovedNear(poolBefore, poolAfter, { x: 90, y: 50 })
    expectMovedNear(laneBefore, laneAfter, actualDelta)
    expectMovedNear(taskBefore, taskAfter, actualDelta)
    expect(laneAfter.parentId).toBe(poolAfter.id)
    expect(taskAfter.parentId).toBe(laneAfter.id)
  })

  test('删除底部-Lane-后直接拖拽-Pool-时,上方-Lane-的任务应继续联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createExampleLikeMultiLaneScenarioInBrowser(page)
    await takeScreenshot(page, '删除底部-Lane-前的双-Lane-布局')

    expect(await selectCellInBrowser(page, scenario.lane2Id)).toEqual([scenario.lane2Id])
    expect(await removeSelectedCellsInBrowser(page)).toEqual([scenario.lane2Id])
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(1)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDelete = await getNodeSnapshot(page, scenario.lane1Id)
    const startAfterDelete = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDelete = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '删除底部-Lane-后上方-Lane-与任务状态')

    expect(remainingLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(remainingLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(startAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(taskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(endAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)

    const delta = { x: 180, y: 130 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '删除底部-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDrag = await getNodeSnapshot(page, scenario.lane1Id)
    const startAfterDrag = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDrag = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDrag = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDrag = await getNodeSnapshot(page, scenario.sendTaskId)
    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(remainingLaneAfterDelete, remainingLaneAfterDrag, actualPoolDelta)
    expectMovedNear(startAfterDelete, startAfterDrag, actualPoolDelta)
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expectMovedNear(serviceTaskAfterDelete, serviceTaskAfterDrag, actualPoolDelta)
    expectMovedNear(endAfterDelete, endAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expectMovedNear(sendTaskAfterDelete, sendTaskAfterDrag, actualPoolDelta)
    expect(remainingLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(startAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(taskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(serviceTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(endAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(sendTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
  })

  test('通过真实选中与-Delete-删除底部-Lane-后直接拖拽-Pool-时,上方-Lane-的任务应继续联动', async ({
    page,
  }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createExampleLikeMultiLaneScenarioInBrowser(page)
    await takeScreenshot(page, '真实交互删除底部-Lane-前的双-Lane-布局')

    await clickNode(page, scenario.lane2Id, { x: 12, y: 40 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.lane2Id])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(1)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDelete = await getNodeSnapshot(page, scenario.lane1Id)
    const startAfterDelete = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDelete = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '真实交互删除底部-Lane-后上方-Lane-与任务状态')

    expect(remainingLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(remainingLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(startAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(taskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(endAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)

    const delta = { x: 180, y: 130 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '真实交互删除底部-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDrag = await getNodeSnapshot(page, scenario.lane1Id)
    const startAfterDrag = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDrag = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDrag = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDrag = await getNodeSnapshot(page, scenario.sendTaskId)
    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(remainingLaneAfterDelete, remainingLaneAfterDrag, actualPoolDelta)
    expectMovedNear(startAfterDelete, startAfterDrag, actualPoolDelta)
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expectMovedNear(serviceTaskAfterDelete, serviceTaskAfterDrag, actualPoolDelta)
    expectMovedNear(endAfterDelete, endAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expectMovedNear(sendTaskAfterDelete, sendTaskAfterDrag, actualPoolDelta)
    expect(remainingLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(startAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(taskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(serviceTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(endAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(sendTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
  })

  test('通过真实选中与-Delete-删除最后一条-Lane-后直接拖拽-Pool-时,Pool-内任务应继续联动', async ({
    page,
  }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const poolBeforeDelete = await getNodeSnapshot(page, scenario.poolId)
    const taskBeforeDelete = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, '真实交互删除最后一条-Lane-前的单-Lane-布局')

    await clickNode(page, scenario.laneId, { x: 12, y: 40 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.laneId])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(0)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, '真实交互删除最后一条-Lane-后任务回挂-Pool')

    expect(taskAfterDelete.parentId).toBe(poolAfterDelete.id)
    expectPositionNear(taskAfterDelete, taskBeforeDelete)

    const delta = { x: 180, y: 130 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '真实交互删除最后一条-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(poolBeforeDelete, poolAfterDelete, { x: 0, y: 0 })
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expect(taskAfterDrag.parentId).toBe(poolAfterDrag.id)
    expectInsideRect(taskAfterDrag, {
      x: poolAfterDrag.x + 30,
      y: poolAfterDrag.y,
      width: poolAfterDrag.width - 30,
      height: poolAfterDrag.height,
    })
  })

  test('通过真实选中与-Delete-删除首个-Lane-后直接拖拽-Pool-时,迁入任务不应跟随-Lane-首边位移再次漂移', async ({
    page,
  }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createExampleLikeMultiLaneScenarioInBrowser(page)
    const startBeforeDelete = await getNodeSnapshot(page, scenario.startId)
    const taskBeforeDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskBeforeDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endBeforeDelete = await getNodeSnapshot(page, scenario.endId)
    await takeScreenshot(page, '真实交互删除首个-Lane-前的双-Lane-布局')

    await clickNode(page, scenario.lane1Id, { x: 12, y: 40 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.lane1Id])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(1)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDelete = await getNodeSnapshot(page, scenario.lane2Id)
    const startAfterDelete = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDelete = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '真实交互删除首个-Lane-后迁入任务状态')

    expect(remainingLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(remainingLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(startAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(taskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(endAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expectPositionNear(startAfterDelete, startBeforeDelete)
    expectPositionNear(taskAfterDelete, taskBeforeDelete)
    expectPositionNear(serviceTaskAfterDelete, serviceTaskBeforeDelete)
    expectPositionNear(endAfterDelete, endBeforeDelete)

    const delta = { x: 180, y: 130 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '真实交互删除首个-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDrag = await getNodeSnapshot(page, scenario.lane2Id)
    const startAfterDrag = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDrag = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDrag = await getNodeSnapshot(page, scenario.endId)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDrag = await getNodeSnapshot(page, scenario.sendTaskId)
    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(remainingLaneAfterDelete, remainingLaneAfterDrag, actualPoolDelta)
    expectMovedNear(startAfterDelete, startAfterDrag, actualPoolDelta)
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expectMovedNear(serviceTaskAfterDelete, serviceTaskAfterDrag, actualPoolDelta)
    expectMovedNear(endAfterDelete, endAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expectMovedNear(sendTaskAfterDelete, sendTaskAfterDrag, actualPoolDelta)
    expect(startAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(taskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(serviceTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(endAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(sendTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
  })

  test('连续删除底部两条-Lane-后直接拖拽-Pool-时,剩余-Lane-与任务应继续联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createFourLaneScenario(page)
    await takeScreenshot(page, '连续删除底部-Lane-前的四-Lane-布局')

    expect(await selectCellInBrowser(page, scenario.lane4Id)).toEqual([scenario.lane4Id])
    expect(await removeSelectedCellsInBrowser(page)).toEqual([scenario.lane4Id])
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(3)
    expect(await selectCellInBrowser(page, scenario.lane3Id)).toEqual([scenario.lane3Id])
    expect(await removeSelectedCellsInBrowser(page)).toEqual([scenario.lane3Id])

    const [topLaneAfterDelete, bottomLaneAfterDelete] = (await getPoolLaneSnapshots(page, scenario.poolId))
      .slice()
      .sort((left, right) => left.y - right.y)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const startAfterDelete = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    await takeScreenshot(page, '连续删除底部两条-Lane-后剩余-Lane-与任务状态')

    expect(topLaneAfterDelete.id).toBe(scenario.lane1Id)
    expect(bottomLaneAfterDelete.id).toBe(scenario.lane2Id)
    expect(topLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(bottomLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(topLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(bottomLaneAfterDelete.y).toBeCloseTo(topLaneAfterDelete.y + topLaneAfterDelete.height, 0)
    expect(startAfterDelete.parentId).toBe(topLaneAfterDelete.id)
    expect(taskAfterDelete.parentId).toBe(topLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(topLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(bottomLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(bottomLaneAfterDelete.id)

    const delta = { x: 180, y: 130 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '连续删除底部两条-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const topLaneAfterDrag = await getNodeSnapshot(page, scenario.lane1Id)
    const bottomLaneAfterDrag = await getNodeSnapshot(page, scenario.lane2Id)
    const startAfterDrag = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDrag = await getNodeSnapshot(page, scenario.serviceTaskId)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)

    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(topLaneAfterDelete, topLaneAfterDrag, actualPoolDelta)
    expectMovedNear(bottomLaneAfterDelete, bottomLaneAfterDrag, actualPoolDelta)
    expectMovedNear(startAfterDelete, startAfterDrag, actualPoolDelta)
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expectMovedNear(serviceTaskAfterDelete, serviceTaskAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expect(topLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(bottomLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(startAfterDrag.parentId).toBe(topLaneAfterDrag.id)
    expect(taskAfterDrag.parentId).toBe(topLaneAfterDrag.id)
    expect(serviceTaskAfterDrag.parentId).toBe(topLaneAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(bottomLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(bottomLaneAfterDrag.id)
  })

  test('宿主拖向 Pool 外部时，边界事件也应保持附着并随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const boundaryBefore = await getNodeSnapshot(page, scenario.boundaryId!)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    await takeScreenshot(page, '边界事件初始附着状态')

    await dragNodeBy(page, scenario.taskId, { x: 700, y: 430 })
    await takeScreenshot(page, '宿主拖向泳池外部后边界事件仍保持附着')

    await expect.poll(() => getNodeSnapshot(page, scenario.boundaryId!)).toMatchObject({
      parentId: scenario.taskId,
    })

    const taskClamped = await getNodeSnapshot(page, scenario.taskId)
    const boundaryClamped = await getNodeSnapshot(page, scenario.boundaryId!)

    expect(taskClamped.parentId).toBe(scenario.poolId)
    expect(boundaryClamped.parentId).toBe(scenario.taskId)
    expectInsideRect(taskClamped, {
      x: laneBefore.x,
      y: poolBefore.y,
      width: poolBefore.width - (laneBefore.x - poolBefore.x),
      height: poolBefore.height,
    })

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

    expect(boundaryAfter.parentId).toBe(taskAfter.id)
    expectInsideRect(taskAfter, {
      x: laneBefore.x + actualPoolDelta.x,
      y: poolAfter.y,
      width: poolAfter.width - ((laneBefore.x + actualPoolDelta.x) - poolAfter.x),
      height: poolAfter.height,
    })
    expect(distanceToRectEdge(getNodeCenter(boundaryAfter), taskAfter)).toBeCloseTo(0, 1)
    expect(
      Math.abs(boundaryAfter.x - boundaryClamped.x) + Math.abs(boundaryAfter.y - boundaryClamped.y),
    ).toBeGreaterThan(0)
  })

  test('直接拖拽边界事件脱离宿主后，仍应被限制在 Pool 范围内', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    const boundaryBefore = await getNodeSnapshot(page, scenario.boundaryId!)
    await takeScreenshot(page, '边界事件直拖前状态')

    await dragNodeBy(page, scenario.boundaryId!, { x: 760, y: 520 })
    await takeScreenshot(page, '边界事件直拖脱离宿主后仍受泳池限制')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const boundaryAfter = await getNodeSnapshot(page, scenario.boundaryId!)

    expect(taskAfter.parentId).toBe(scenario.laneId)
    expectPositionNear(taskAfter, taskBefore)
    expect(boundaryAfter.parentId).not.toBe(scenario.taskId)
    expect([scenario.laneId, scenario.poolId]).toContain(boundaryAfter.parentId ?? '')
    expect(Math.abs(boundaryAfter.x - boundaryBefore.x) + Math.abs(boundaryAfter.y - boundaryBefore.y)).toBeGreaterThan(0)
    expectInsideRect(boundaryAfter, {
      x: laneBefore.x,
      y: poolBefore.y,
      width: poolBefore.width - (laneBefore.x - poolBefore.x),
      height: poolBefore.height,
    })
  })

  test('选中后的边界事件拖动选框时，仍应沿宿主边框滑动而不是直接脱离', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)

    await clickNode(page, scenario.boundaryId!)
    await takeScreenshot(page, '边界事件选中后的初始状态')

    await dragSelectionBoxBy(page, { x: 18, y: 12 })
    await takeScreenshot(page, '边界事件选中拖动后仍保持附着')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const boundaryAfter = await getNodeSnapshot(page, scenario.boundaryId!)

    expectPositionNear(taskAfter, taskBefore)
    expect(boundaryAfter.parentId).toBe(taskAfter.id)
    expect(distanceToRectEdge(getNodeCenter(boundaryAfter), taskAfter)).toBeCloseTo(0, 1)
  })

  test('导入后的任务首次直接拖拽越界时，也应被钳制在导入后的 Pool 内容区', async ({ page }, testInfo) => {
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

    await takeScreenshot(page, '导入后首次直拖越界后的任务位置')

    const taskAfter = await getNodeSnapshot(page, scenario.taskId)
    const taskBoxAfter = await taskLocator.boundingBox()
    if (!taskBoxAfter) {
      throw new Error('无法定位导入后任务的恢复渲染位置')
    }

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const laneAfter = await getNodeSnapshot(page, scenario.laneId)

    expect(taskAfter.parentId).toBe(scenario.poolId)
    expect(taskAfter.x).toBeGreaterThan(taskBefore.x)
    expect(taskAfter.y).toBeGreaterThan(taskBefore.y)
    expectInsideRect(taskAfter, {
      x: laneAfter.x,
      y: poolAfter.y,
      width: poolAfter.width - (laneAfter.x - poolAfter.x),
      height: poolAfter.height,
    })
    expect(Math.max(Math.abs(taskBoxAfter.x - taskBoxBefore.x), Math.abs(taskBoxAfter.y - taskBoxBefore.y))).toBeGreaterThan(10)
  })

  test('Lane 尝试拖向另一 Pool 时，应保持原位并维持原父链', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createTwoPoolMessageScenario(page)
    const laneBefore = await getNodeSnapshot(page, scenario.leftLaneId)
    const taskBefore = await getNodeSnapshot(page, scenario.sourceTaskId)
    await takeScreenshot(page, '跨-Pool-尝试拖拽-Lane-前的初始布局')

    await dragNodeBy(page, scenario.leftLaneId, { x: 440, y: 0 }, { startOffset: { x: 250, y: 80 } })
    await takeScreenshot(page, '跨-Pool-尝试拖拽-Lane-后保持原位')

    const laneAfter = await getNodeSnapshot(page, scenario.leftLaneId)
    const taskAfter = await getNodeSnapshot(page, scenario.sourceTaskId)

    expect(laneAfter.parentId).toBe(scenario.leftPoolId)
    expectPositionNear(laneAfter, laneBefore)
    expect(taskAfter.parentId).toBe(laneAfter.id)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('Lane 直接拖拽时，应保持原位且不影响内部任务', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, 'Lane-直接拖拽前内部任务保持初始位置')

    await dragNodeBy(page, scenario.laneId, { x: -20, y: 0 }, { startOffset: { x: 250, y: 80 } })
    await takeScreenshot(page, 'Lane-直接拖拽后仍保持原位')

    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expectPositionNear(laneAfter, laneBefore)
    expect(laneAfter.parentId).toBe(scenario.poolId)
    expect(taskAfter.parentId).toBe(laneAfter.id)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('三 Lane 场景中直接拖拽中间 Lane 时，应保持原位且不覆盖兄弟 Lane', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const added = await addLaneToPoolInBrowser(page, scenario.poolId)

    expect(added).not.toBeNull()

    const lane1Before = await getNodeSnapshot(page, scenario.lane1Id)
    const middleLaneBefore = await getNodeSnapshot(page, scenario.lane2Id)
    const lane3Before = await getNodeSnapshot(page, added!.laneId)
    const gatewayBefore = await getNodeSnapshot(page, scenario.gatewayId)
    const task2Before = await getNodeSnapshot(page, scenario.task2Id)
    await takeScreenshot(page, '三-Lane-中间-Lane-直接拖拽前状态')

    await dragNodeBy(page, scenario.lane2Id, { x: 0, y: -260 }, { startOffset: { x: 240, y: 80 } })
    await takeScreenshot(page, '三-Lane-中间-Lane-直接拖拽后仍保持原位')

    const lane1After = await getNodeSnapshot(page, scenario.lane1Id)
    const middleLaneAfter = await getNodeSnapshot(page, scenario.lane2Id)
    const lane3After = await getNodeSnapshot(page, added!.laneId)
    const gatewayAfter = await getNodeSnapshot(page, scenario.gatewayId)
    const task2After = await getNodeSnapshot(page, scenario.task2Id)

    expectPositionNear(lane1After, lane1Before)
    expectPositionNear(middleLaneAfter, middleLaneBefore)
    expectPositionNear(lane3After, lane3Before)
    expect(middleLaneAfter.parentId).toBe(scenario.poolId)
    expect(task2After.parentId).toBe(middleLaneAfter.id)
    expect(gatewayAfter.parentId).toBe(middleLaneAfter.id)
    expectPositionNear(task2After, task2Before)
    expectPositionNear(gatewayAfter, gatewayBefore)
    expect(middleLaneAfter.y).toBeGreaterThanOrEqual(lane1After.y + lane1After.height - 1)
    expect(lane3After.y).toBeGreaterThanOrEqual(middleLaneAfter.y + middleLaneAfter.height - 1)
  })

  test('三 Lane 场景中选区拖拽中间 Lane 时，应保持原位且不覆盖兄弟 Lane', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const added = await addLaneToPoolInBrowser(page, scenario.poolId)

    expect(added).not.toBeNull()

    const lane1Before = await getNodeSnapshot(page, scenario.lane1Id)
    const middleLaneBefore = await getNodeSnapshot(page, scenario.lane2Id)
    const lane3Before = await getNodeSnapshot(page, added!.laneId)
    const task2Before = await getNodeSnapshot(page, scenario.task2Id)

    await clickNode(page, scenario.lane2Id, { x: 240, y: 80 })
    await expect.poll(() => getSelectedCellIds(page)).toContain(scenario.lane2Id)
    await takeScreenshot(page, '三-Lane-中间-Lane-选中后准备拖拽')

    await dragSelectionBoxBy(page, { x: 0, y: -260 })
    await takeScreenshot(page, '三-Lane-中间-Lane-选区拖拽后仍保持原位')

    const lane1After = await getNodeSnapshot(page, scenario.lane1Id)
    const middleLaneAfter = await getNodeSnapshot(page, scenario.lane2Id)
    const lane3After = await getNodeSnapshot(page, added!.laneId)
    const task2After = await getNodeSnapshot(page, scenario.task2Id)

    expectPositionNear(lane1After, lane1Before)
    expectPositionNear(middleLaneAfter, middleLaneBefore)
    expectPositionNear(lane3After, lane3Before)
    expect(task2After.parentId).toBe(middleLaneAfter.id)
    expectPositionNear(task2After, task2Before)
    expect(middleLaneAfter.y).toBeGreaterThanOrEqual(lane1After.y + lane1After.height - 1)
    expect(lane3After.y).toBeGreaterThanOrEqual(middleLaneAfter.y + middleLaneAfter.height - 1)
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

  test('多 Lane Pool 拖拽时，所有 Lane 和内部任务应随 Pool 联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const poolBefore = await getNodeSnapshot(page, scenario.poolId)
    const lane1Before = await getNodeSnapshot(page, scenario.lane1Id)
    const lane2Before = await getNodeSnapshot(page, scenario.lane2Id)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, '多 Lane 拖拽前的初始布局')

    const delta = { x: 80, y: 50 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '多 Lane Pool 拖拽后的联动结果')

    const poolAfter = await getNodeSnapshot(page, scenario.poolId)
    const lane1After = await getNodeSnapshot(page, scenario.lane1Id)
    const lane2After = await getNodeSnapshot(page, scenario.lane2Id)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    const actualPoolDelta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    // 所有子节点应跟随 Pool 移动
    expectMovedNear(lane1Before, lane1After, actualPoolDelta)
    expectMovedNear(lane2Before, lane2After, actualPoolDelta)
    expectMovedNear(taskBefore, taskAfter, actualPoolDelta)

    // 父链不变
    expect(lane1After.parentId).toBe(poolAfter.id)
    expect(lane2After.parentId).toBe(poolAfter.id)
    expect(taskAfter.parentId).toBe(lane1After.id)

    // Lane 之间仍无间隙
    expect(lane2After.y).toBeCloseTo(lane1After.y + lane1After.height, 0)
  })

  test('删除第一个 Lane 后拖拽 Pool 时，剩余 Lane 与其内部节点应继续联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    await takeScreenshot(page, '删除第一条-Lane-前的多-Lane-布局')

    expect(await removeNodeInBrowser(page, scenario.lane1Id)).toBe(true)

    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(1)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDelete = await getNodeSnapshot(page, scenario.lane2Id)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '删除第一条-Lane-后剩余-Lane-与节点状态')

    expect(remainingLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(remainingLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(gatewayAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)

    const delta = { x: 85, y: 55 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '删除第一条-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterDrag = await getNodeSnapshot(page, scenario.lane2Id)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDrag = await getNodeSnapshot(page, scenario.sendTaskId)

    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(remainingLaneAfterDelete, remainingLaneAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expectMovedNear(sendTaskAfterDelete, sendTaskAfterDrag, actualPoolDelta)

    expect(remainingLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(sendTaskAfterDrag.parentId).toBe(remainingLaneAfterDrag.id)
    expect(remainingLaneAfterDrag.y).toBeCloseTo(poolAfterDrag.y, 0)
  })

  test('删除靠中的 Lane 后直接拖拽 Pool 时，其上方 Lane 的任务应继续联动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createFourLaneScenario(page)
    await takeScreenshot(page, '删除靠中-Lane-前的四-Lane-布局')

    expect(await removeNodeInBrowser(page, scenario.lane3Id)).toBe(true)

    const lanesAfterDelete = await expect.poll(async () => {
      const lanes = await getPoolLaneSnapshots(page, scenario.poolId)
      return lanes.slice().sort((left, right) => left.y - right.y)
    })
      .toHaveLength(3)
    void lanesAfterDelete

    const [topLaneAfterDelete, middleLaneAfterDelete, bottomLaneAfterDelete] = (await getPoolLaneSnapshots(page, scenario.poolId))
      .slice()
      .sort((left, right) => left.y - right.y)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const lane4TaskAfterDelete = await getNodeSnapshot(page, scenario.lane4TaskId)
    await takeScreenshot(page, '删除靠中-Lane-后剩余三条-Lane-与任务状态')

    expect(topLaneAfterDelete.id).toBe(scenario.lane1Id)
    expect(middleLaneAfterDelete.id).toBe(scenario.lane2Id)
    expect(bottomLaneAfterDelete.id).toBe(scenario.lane4Id)
    expect(topLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(middleLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(bottomLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(topLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(middleLaneAfterDelete.y).toBeCloseTo(topLaneAfterDelete.y + topLaneAfterDelete.height, 0)
    expect(bottomLaneAfterDelete.y).toBeCloseTo(middleLaneAfterDelete.y + middleLaneAfterDelete.height, 0)
    expect(taskAfterDelete.parentId).toBe(topLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(topLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(middleLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(middleLaneAfterDelete.id)
    expect(lane4TaskAfterDelete.parentId).toBe(bottomLaneAfterDelete.id)

    const delta = { x: 95, y: 60 }
    await dragNodeBy(page, scenario.poolId, delta, { startOffset: { x: 12, y: 40 } })
    await takeScreenshot(page, '删除靠中-Lane-后拖拽-Pool-仍保持联动')

    const poolAfterDrag = await getNodeSnapshot(page, scenario.poolId)
    const topLaneAfterDrag = await getNodeSnapshot(page, scenario.lane1Id)
    const middleLaneAfterDrag = await getNodeSnapshot(page, scenario.lane2Id)
    const bottomLaneAfterDrag = await getNodeSnapshot(page, scenario.lane4Id)
    const taskAfterDrag = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDrag = await getNodeSnapshot(page, scenario.serviceTaskId)
    const gatewayAfterDrag = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDrag = await getNodeSnapshot(page, scenario.task2Id)
    const lane4TaskAfterDrag = await getNodeSnapshot(page, scenario.lane4TaskId)

    const actualPoolDelta = {
      x: poolAfterDrag.x - poolAfterDelete.x,
      y: poolAfterDrag.y - poolAfterDelete.y,
    }

    expectMovedNear(topLaneAfterDelete, topLaneAfterDrag, actualPoolDelta)
    expectMovedNear(middleLaneAfterDelete, middleLaneAfterDrag, actualPoolDelta)
    expectMovedNear(bottomLaneAfterDelete, bottomLaneAfterDrag, actualPoolDelta)
    expectMovedNear(taskAfterDelete, taskAfterDrag, actualPoolDelta)
    expectMovedNear(serviceTaskAfterDelete, serviceTaskAfterDrag, actualPoolDelta)
    expectMovedNear(gatewayAfterDelete, gatewayAfterDrag, actualPoolDelta)
    expectMovedNear(task2AfterDelete, task2AfterDrag, actualPoolDelta)
    expectMovedNear(lane4TaskAfterDelete, lane4TaskAfterDrag, actualPoolDelta)
    expect(topLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(middleLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(bottomLaneAfterDrag.parentId).toBe(poolAfterDrag.id)
    expect(taskAfterDrag.parentId).toBe(topLaneAfterDrag.id)
    expect(serviceTaskAfterDrag.parentId).toBe(topLaneAfterDrag.id)
    expect(gatewayAfterDrag.parentId).toBe(middleLaneAfterDrag.id)
    expect(task2AfterDrag.parentId).toBe(middleLaneAfterDrag.id)
    expect(lane4TaskAfterDrag.parentId).toBe(bottomLaneAfterDrag.id)
  })

  test('新增第三条-Lane-后删除首个-Lane-时,只有紧邻-Lane-应吸收全部高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const added = await addLaneToPoolInBrowser(page, scenario.poolId)

    expect(added).not.toBeNull()
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(3)
    const [deletedLaneBeforeDelete, adjacentLaneBeforeDelete, fartherLaneBeforeDelete] = (await getPoolLaneSnapshots(page, scenario.poolId))
      .slice()
      .sort((left, right) => left.y - right.y)
    await takeScreenshot(page, '新增第三条-Lane-后的三-Lane-布局')

    await clickNode(page, scenario.lane1Id, { x: 12, y: 40 })
    await expect.poll(() => getSelectedCellIds(page)).toEqual([scenario.lane1Id])
    await page.keyboard.press('Delete')
    await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(2)

    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const [adjacentLaneAfterDelete, fartherLaneAfterDelete] = (await getPoolLaneSnapshots(page, scenario.poolId))
      .slice()
      .sort((left, right) => left.y - right.y)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    const addedTaskAfterDelete = await getNodeSnapshot(page, added!.addedTaskId)
    await takeScreenshot(page, '新增第三条-Lane-后删除首个-Lane-的高度分配结果')

    expect(deletedLaneBeforeDelete.id).toBe(scenario.lane1Id)
    expect(adjacentLaneBeforeDelete.id).toBe(scenario.lane2Id)
    expect(fartherLaneBeforeDelete.id).toBe(added!.laneId)
    expect(adjacentLaneAfterDelete.id).toBe(scenario.lane2Id)
    expect(fartherLaneAfterDelete.id).toBe(added!.laneId)
    expect(adjacentLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(fartherLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(adjacentLaneAfterDelete.y).toBeCloseTo(deletedLaneBeforeDelete.y, 0)
    expect(adjacentLaneAfterDelete.height).toBeCloseTo(
      adjacentLaneBeforeDelete.height + deletedLaneBeforeDelete.height,
      0,
    )
    expect(fartherLaneAfterDelete.y).toBeCloseTo(fartherLaneBeforeDelete.y, 0)
    expect(fartherLaneAfterDelete.height).toBeCloseTo(fartherLaneBeforeDelete.height, 0)
    expect(gatewayAfterDelete.parentId).toBe(adjacentLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(adjacentLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(adjacentLaneAfterDelete.id)
    expect(addedTaskAfterDelete.parentId).toBe(fartherLaneAfterDelete.id)
  })

  test('选区拖拽 Pool 碰撞另一 Pool 时，不应重叠且最终位于合法位置', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createTwoPoolMessageScenario(page)
    const leftPoolBefore = await getNodeSnapshot(page, scenario.leftPoolId)
    const rightPoolBefore = await getNodeSnapshot(page, scenario.rightPoolId)
    const leftLaneBefore = await getNodeSnapshot(page, scenario.leftLaneId)
    const sourceTaskBefore = await getNodeSnapshot(page, scenario.sourceTaskId)
    await takeScreenshot(page, '双 Pool 拖拽前的初始布局')

    // 收集浏览器控制台错误
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // 选中左 Pool 后通过选区拖拽向右碰撞另一个 Pool
    await clickNode(page, scenario.leftPoolId, { x: 12, y: 40 })
    await dragSelectionBoxBy(page, { x: 300, y: 0 })
    await takeScreenshot(page, '选区拖拽碰撞后的布局')

    const leftPoolAfter = await getNodeSnapshot(page, scenario.leftPoolId)
    const rightPoolAfter = await getNodeSnapshot(page, scenario.rightPoolId)
    const leftLaneAfter = await getNodeSnapshot(page, scenario.leftLaneId)
    const sourceTaskAfter = await getNodeSnapshot(page, scenario.sourceTaskId)

    // 碰撞后不得与 right Pool 重叠，位于任何合法位置均可
    expect(leftPoolAfter.x + leftPoolAfter.width).toBeLessThanOrEqual(rightPoolAfter.x + 1)

    // right Pool 不应被影响
    expectPositionNear(rightPoolBefore, rightPoolAfter)
    expect(rightPoolAfter.width).toBeCloseTo(rightPoolBefore.width, 0)
    expect(rightPoolAfter.height).toBeCloseTo(rightPoolBefore.height, 0)

    // 子 Lane 和 Task 应随 Pool 恢复，父链正确
    const actualDelta = { x: leftPoolAfter.x - leftPoolBefore.x, y: leftPoolAfter.y - leftPoolBefore.y }
    expectMovedNear(leftLaneBefore, leftLaneAfter, actualDelta)
    expectMovedNear(sourceTaskBefore, sourceTaskAfter, actualDelta)
    expect(leftLaneAfter.parentId).toBe(leftPoolAfter.id)
    expect(sourceTaskAfter.parentId).toBe(leftLaneAfter.id)

    // 拖拽期间不应刷屏控制台错误
    expect(consoleErrors.length).toBeLessThan(5)
  })
})