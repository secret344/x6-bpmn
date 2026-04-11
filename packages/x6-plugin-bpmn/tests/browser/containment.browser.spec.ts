import { expect, test } from '@playwright/test'

import { createBrowserScreenshotTaker } from './screenshot-taker'
import {
  waitForHarness,
  createPoolLaneTaskScenario,
  createStandaloneTaskScenario,
  addFirstPoolScenario,
  createPoolLaneTaskBoundaryScenario,
  createTwoPoolMessageScenario,
  createMultiLaneScenario,
  addLaneToPoolInBrowser,
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

  test('Lane 拖入另一 Pool 时，应回到原 Pool 并保持原父链', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createTwoPoolMessageScenario(page)
    const laneBefore = await getNodeSnapshot(page, scenario.leftLaneId)
    const taskBefore = await getNodeSnapshot(page, scenario.sourceTaskId)
    await takeScreenshot(page, '跨 Pool 拖拽 Lane 前的初始布局')

    await dragNodeBy(page, scenario.leftLaneId, { x: 440, y: 0 }, { startOffset: { x: 250, y: 80 } })
    await takeScreenshot(page, 'Lane 试图拖入另一 Pool 后自动恢复')

    const laneAfter = await getNodeSnapshot(page, scenario.leftLaneId)
    const taskAfter = await getNodeSnapshot(page, scenario.sourceTaskId)

    expect(laneAfter.parentId).toBe(scenario.leftPoolId)
    expectPositionNear(laneAfter, laneBefore)
    expect(taskAfter.parentId).toBe(laneAfter.id)
    expectPositionNear(taskAfter, taskBefore)
  })

  test('Lane 直接拖拽时，应被禁止且不影响内部任务', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskScenario(page)
    const laneBefore = await getNodeSnapshot(page, scenario.laneId)
    const taskBefore = await getNodeSnapshot(page, scenario.taskId)
    await takeScreenshot(page, 'Lane 平移前内部任务保持初始位置')

    await dragNodeBy(page, scenario.laneId, { x: -20, y: 0 }, { startOffset: { x: 250, y: 80 } })
    await takeScreenshot(page, 'Lane 平移后内部任务保持原位')

    const laneAfter = await getNodeSnapshot(page, scenario.laneId)
    const taskAfter = await getNodeSnapshot(page, scenario.taskId)

    expectPositionNear(laneAfter, laneBefore)
    expect(taskAfter.parentId).toBe(laneAfter.id)
    expectPositionNear(taskAfter, taskBefore)
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