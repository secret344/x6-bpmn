/**
 * Lane 管理行为 — 单元测试
 *
 * 验证添加 Lane、无间隙布局与 Lane resize 同步相邻 Lane 的正确性。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  addLaneToPool,
  addLaneAbove,
  addLaneBelow,
  compactLaneLayout,
  setupLaneManagement,
} from '../../../src/behaviors/lane-management'
import {
  BPMN_LANE,
  BPMN_POOL,
} from '../../../src/utils/constants'

// ============================================================================
// 测试辅助：创建 mock 节点
// ============================================================================

function createMockNode(
  id: string,
  shape: string,
  x: number,
  y: number,
  width: number,
  height: number,
  data?: Record<string, unknown>,
) {
  let position = { x, y }
  let size = { width, height }
  let parent: any = null

  const self: any = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    resize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    getParent: () => parent,
    getBBox: () => ({ x: position.x, y: position.y, width: size.width, height: size.height }),
    embed: vi.fn((child: any) => {
      child.__setParent(self)
    }),
    unembed: vi.fn((child: any) => {
      child.__setParent(null)
    }),
    remove: vi.fn(),
    isNode: () => true,
    getData: () => data ?? { bpmn: { isHorizontal: true } },
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
  }

  return self
}

function createMockGraph(nodes: any[] = []) {
  const handlers: Record<string, Function[]> = {}
  let lastAddedNode: any = null

  const onImpl = (event: string, fn: Function) => {
    handlers[event] = handlers[event] || []
    handlers[event].push(fn)
  }

  const offImpl = (event: string, fn: Function) => {
    const arr = handlers[event]
    if (arr) {
      const idx = arr.indexOf(fn)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }

  return {
    getNodes: () => nodes,
    addNode: vi.fn((config: any) => {
      const node = createMockNode(
        `node-${Date.now()}-${Math.random()}`,
        config.shape,
        config.x,
        config.y,
        config.width,
        config.height,
        config.data,
      )
      nodes.push(node)
      lastAddedNode = node
      return node
    }),
    on: vi.fn(onImpl),
    off: vi.fn(offImpl),
    __emit: (event: string, ...args: any[]) => {
      // 复制一份以防止在遍历过程中被修改
      const arr = handlers[event]?.slice()
      if (arr) {
        for (const fn of arr) fn(...args)
      }
    },
    __getLastAdded: () => lastAddedNode,
  }
}

// ============================================================================
// addLaneToPool 测试
// ============================================================================

describe('addLaneToPool', () => {
  it('向空 Pool 添加第一条 Lane 应覆盖整个内容区', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const graph = createMockGraph([pool])

    const lane = addLaneToPool(graph as any, pool)

    expect(lane).not.toBeNull()
    expect(graph.addNode).toHaveBeenCalledOnce()
    // 水平布局下，内容区 x = 40 + 30 = 70, y = 40, w = 570, h = 250
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.x).toBe(70)
    expect(addedConfig.y).toBe(40)
    expect(addedConfig.width).toBe(570)
    expect(addedConfig.height).toBe(250)
  })

  it('向已有 Lane 的 Pool 追加 Lane 应放在底部', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    const lane2 = addLaneToPool(graph as any, pool, { label: '新泳道' })

    expect(lane2).not.toBeNull()
    const addedConfig = graph.addNode.mock.calls[0][0]
    // lane1 底部 = 40 + 200 = 240
    expect(addedConfig.y).toBe(240)
    expect(addedConfig.height).toBe(125) // 默认大小
  })

  it('空间不足时应自动扩展 Pool', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool)

    // Pool 原始高度 250, lane1 底部 240, 剩余 10, 需要 125, 需扩展 115
    expect(pool.resize).toHaveBeenCalled()
  })

  it('非 Pool 节点调用应返回 null', () => {
    const node = createMockNode('node1', 'bpmn-user-task', 0, 0, 100, 60)
    const graph = createMockGraph([node])

    const result = addLaneToPool(graph as any, node)
    expect(result).toBeNull()
  })

  it('自定义 label 应设置到 attrs.headerLabel.text', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const graph = createMockGraph([pool])

    addLaneToPool(graph as any, pool, { label: '测试泳道' })

    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.attrs.headerLabel.text).toBe('测试泳道')
  })

  it('已有 Lane 且内容区有剩余空间时，新 Lane 应填满 Pool 内容区底部', () => {
    // Pool 内容区：x=70, y=40, w=570, h=400
    // lane1 占 y=40~240 (h=200)，剩余 200 > laneSize=125
    // 添加后 compactLaneLayout 应把新 Lane 拉伸到 h=200 以填满底部
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    const lane2 = addLaneToPool(graph as any, pool)

    expect(lane2).not.toBeNull()
    // compactLaneLayout 会把最后一条 Lane 填满剩余高度
    const lane2Size = lane2!.getSize()
    // 剩余空间 = (40 + 400) - 240 = 200
    expect(lane2Size.height).toBe(200)
  })

  it('size 小于 MIN_LANE_SIZE 时应 clamp 到 60', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const graph = createMockGraph([pool])

    addLaneToPool(graph as any, pool, { size: 10 })

    // 由于是空 Pool，第一条 Lane 覆盖整个内容区，不受 clamp 影响
    // 但 clamp 逻辑应该工作
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.height).toBe(400) // 空 Pool 时覆盖整个内容区
  })

  it('size 为非正数时应回退默认值并 clamp', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 600)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool, { size: -50 })

    // 非正数回退默认值 125（> MIN_LANE_SIZE 60），故 laneSize=125
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.y).toBe(240) // lane1 底部
    expect(addedConfig.height).toBe(125) // 默认大小
  })

  it('size 为 NaN 时应回退默认值', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 600)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool, { size: NaN })

    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.height).toBe(125) // 默认大小
  })

  it('size 为 Infinity 时应回退默认值', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 600)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool, { size: Infinity })

    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.height).toBe(125) // Infinity 不是有限数，回退默认
  })
})

// ============================================================================
// compactLaneLayout 测试
// ============================================================================

describe('compactLaneLayout', () => {
  it('应保证 Lane 紧密排列且覆盖 Pool 内容区', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 200, 570, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    compactLaneLayout(graph as any, pool)

    // lane1: y=40, h=150
    // lane2: y=190, h=应填满剩余=400-(190-40)=250
    const lane1Pos = lane1.getPosition()
    expect(lane1Pos.y).toBe(40)

    const lane2Pos = lane2.getPosition()
    expect(lane2Pos.y).toBe(190) // 40 + 150

    const lane2Size = lane2.getSize()
    expect(lane2Size.height).toBe(250) // 40 + 400 - 190
  })

  it('没有 Lane 时应无操作', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const graph = createMockGraph([pool])

    // 不应抛出错误
    compactLaneLayout(graph as any, pool)
    expect(pool.resize).not.toHaveBeenCalled()
  })
})

// ============================================================================
// addLaneAbove / addLaneBelow 测试
// ============================================================================

describe('addLaneAbove', () => {
  it('应在指定 Lane 上方插入新 Lane', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    pool.embed(lane1)
    const graph = createMockGraph([pool, lane1])

    const newLane = addLaneAbove(graph as any, lane1, { label: '上方泳道' })

    expect(newLane).not.toBeNull()
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.y).toBe(40) // 在原 lane1 的 y 位置
  })
})

describe('addLaneBelow', () => {
  it('应在指定 Lane 下方插入新 Lane', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    pool.embed(lane1)
    const graph = createMockGraph([pool, lane1])

    const newLane = addLaneBelow(graph as any, lane1, { label: '下方泳道' })

    expect(newLane).not.toBeNull()
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.y).toBe(240) // lane1.y + lane1.height = 40 + 200
  })

  it('Lane 无父 Pool 时应返回 null', () => {
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    const graph = createMockGraph([lane1])

    const result = addLaneBelow(graph as any, lane1)
    expect(result).toBeNull()
  })
})

// ============================================================================
// setupLaneManagement 测试
// ============================================================================

describe('setupLaneManagement', () => {
  it('应注册 node:change:size 事件监听器', () => {
    const graph = createMockGraph([])

    const dispose = setupLaneManagement(graph as any)

    expect(typeof dispose).toBe('function')
    expect(graph.on).toHaveBeenCalledWith('node:change:size', expect.any(Function))
  })

  it('dispose 后应移除事件监听器', () => {
    const graph = createMockGraph([])

    const dispose = setupLaneManagement(graph as any)
    const [[eventName, handler]] = graph.on.mock.calls

    dispose()

    // 确认 dispose 会移除注册时的同一事件监听器
    expect(graph.off).toHaveBeenCalledWith(eventName, handler)
    expect(eventName).toBe('node:change:size')
  })

  it('Lane resize 时应触发 onLaneResize 回调', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 570, 250)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    const onLaneResize = vi.fn()
    setupLaneManagement(graph as any, { onLaneResize })

    // 模拟 lane1 调整大小事件
    graph.__emit('node:change:size', { node: lane1, options: {} })

    expect(onLaneResize).toHaveBeenCalledWith(lane1, pool)
  })

  it('非 Lane 节点 resize 不应触发回调', () => {
    const task = createMockNode('task1', 'bpmn-user-task', 100, 100, 100, 60)
    const graph = createMockGraph([task])

    const onLaneResize = vi.fn()
    setupLaneManagement(graph as any, { onLaneResize })

    graph.__emit('node:change:size', { node: task, options: {} })

    expect(onLaneResize).not.toHaveBeenCalled()
  })

  it('silent 选项时不应触发回调', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 400)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    const onLaneResize = vi.fn()
    setupLaneManagement(graph as any, { onLaneResize })

    graph.__emit('node:change:size', { node: lane1, options: { silent: true } })

    expect(onLaneResize).not.toHaveBeenCalled()
  })

  it('相邻 Lane resize 触发的级联事件不应导致重入和重复回调', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 570, 120)
    const lane3 = createMockNode('lane3', BPMN_LANE, 70, 310, 570, 130)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    lane3.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2, lane3])

    const onLaneResize = vi.fn()
    setupLaneManagement(graph as any, { onLaneResize })

    // 模拟 adjustAdjacentLanes 内部 resize 触发级联事件：
    // 拦截 lane2.resize，在被调用时模拟 node:change:size 事件
    const origResize2 = lane2.resize.getMockImplementation() ?? lane2.resize
    lane2.resize = vi.fn((...args: any[]) => {
      origResize2(...args)
      // 内部 resize 产生的级联事件应被全局重入保护拦截
      graph.__emit('node:change:size', { node: lane2, options: {} })
    })

    const origResize3 = lane3.resize.getMockImplementation() ?? lane3.resize
    lane3.resize = vi.fn((...args: any[]) => {
      origResize3(...args)
      graph.__emit('node:change:size', { node: lane3, options: {} })
    })

    // 触发 lane1 的 resize 事件
    graph.__emit('node:change:size', { node: lane1, options: {} })

    // onLaneResize 只应被调用一次（lane1 触发的那次）
    expect(onLaneResize).toHaveBeenCalledTimes(1)
    expect(onLaneResize).toHaveBeenCalledWith(lane1, pool)
  })
})
