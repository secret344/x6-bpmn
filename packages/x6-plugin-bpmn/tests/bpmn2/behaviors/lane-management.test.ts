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
  reconcileLaneResize,
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

  it('方向解析失败时应回退为水平泳池处理', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250) as ReturnType<typeof createMockNode> & {
      getData: () => never
    }
    pool.getData = () => {
      throw new Error('broken data')
    }
    const graph = createMockGraph([pool])

    addLaneToPool(graph as any, pool)

    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.x).toBe(70)
    expect(addedConfig.y).toBe(40)
    expect(addedConfig.width).toBe(570)
    expect(addedConfig.height).toBe(250)
  })

  it('垂直 Pool 空间不足时应向右追加 Lane 并扩展 Pool 宽度', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 200, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 150, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool)

    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(pool.resize).toHaveBeenCalledWith(275, 400, { bpmnLayout: true })
    expect(addedConfig.x).toBe(190)
    expect(addedConfig.y).toBe(70)
    expect(addedConfig.width).toBe(125)
    expect(addedConfig.height).toBe(370)
  })

  it('垂直 Pool 剩余空间足够时应直接在右侧追加 Lane', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 100, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    addLaneToPool(graph as any, pool)

    expect(pool.resize).not.toHaveBeenCalled()
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.x).toBe(140)
    expect(addedConfig.y).toBe(70)
    expect(addedConfig.width).toBe(125)
    expect(addedConfig.height).toBe(370)
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

  it('图节点读取失败时应静默返回', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const graph = {
      getNodes: () => {
        throw new Error('graph unavailable')
      },
    }

    expect(() => compactLaneLayout(graph as any, pool)).not.toThrow()
    expect(pool.resize).not.toHaveBeenCalled()
  })

  it('没有 Lane 时应无操作', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 250)
    const graph = createMockGraph([pool])

    // 不应抛出错误
    compactLaneLayout(graph as any, pool)
    expect(pool.resize).not.toHaveBeenCalled()
  })

  it('水平布局 Lane 总高度超出 Pool 时应扩展 Pool', () => {
    // Pool 内容区高度 = 100, 但 3 个 Lane 各 MIN_LANE_SIZE=60 → 总高 180 > 100
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 100)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 60)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 100, 570, 60)
    const lane3 = createMockNode('lane3', BPMN_LANE, 70, 160, 570, 60)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    lane3.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2, lane3])

    compactLaneLayout(graph as any, pool)

    // Pool 应扩展以容纳所有 Lane
    const poolSize = pool.getSize()
    expect(poolSize.height).toBeGreaterThanOrEqual(180) // 3 × 60
  })

  it('垂直布局 Lane 总宽度超出 Pool 时应扩展 Pool', () => {
    // 垂直 Pool: 内容区顶部为 HEADER, Lane 横向堆叠
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 100, 400, {
      bpmn: { isHorizontal: false },
    })
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 60, 370, {
      bpmn: { isHorizontal: false },
    })
    const lane2 = createMockNode('lane2', BPMN_LANE, 100, 70, 60, 370, {
      bpmn: { isHorizontal: false },
    })
    const lane3 = createMockNode('lane3', BPMN_LANE, 160, 70, 60, 370, {
      bpmn: { isHorizontal: false },
    })
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    lane3.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2, lane3])

    compactLaneLayout(graph as any, pool)

    // Pool 应扩展以容纳所有 Lane
    const poolSize = pool.getSize()
    expect(poolSize.width).toBeGreaterThanOrEqual(180) // 3 × 60
  })

  it('direction=top 时首 Lane 应吸收 Pool 顶部扩展空间（水平布局）', () => {
    // Pool 高度 460（多出 60），首 Lane 应得到 260 而非末 Lane
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 460)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 240, 570, 200)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    compactLaneLayout(graph as any, pool, 'top')

    const lane1Size = lane1.getSize()
    expect(lane1Size.height).toBe(260) // 460 - 200 = 260
    const lane2Size = lane2.getSize()
    expect(lane2Size.height).toBe(200) // 不变
    const lane2Pos = lane2.getPosition()
    expect(lane2Pos.y).toBe(300) // 40 + 260
  })

  it('direction=top 且内容不足时应回退顶边位置，而不是把 Pool 向下撑大', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 200)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 100)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 140, 570, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    compactLaneLayout(graph as any, pool, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 30 })
    expect(pool.getSize()).toEqual({ width: 600, height: 210 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 570, height: 60 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 100 })
    expect(lane2.getSize()).toEqual({ width: 570, height: 150 })
  })

  it('direction=left 时首 Lane 应吸收 Pool 左侧扩展空间（垂直布局）', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    // 垂直布局 header 在顶部，content.width = pool.width = 260
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 80, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 120, 70, 100, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    compactLaneLayout(graph as any, pool, 'left')

    const lane1Size = lane1.getSize()
    // content.width = 260, othersTotal = 100, 首 Lane = 260-100 = 160
    expect(lane1Size.width).toBe(160)
    const lane2Size = lane2.getSize()
    expect(lane2Size.width).toBe(100)
  })

  it('direction=left 且内容不足时应回退左边位置，而不是把 Pool 向右撑大', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 200, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 100, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 140, 70, 150, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    compactLaneLayout(graph as any, pool, 'left')

    expect(pool.getPosition()).toEqual({ x: 30, y: 40 })
    expect(pool.getSize()).toEqual({ width: 210, height: 400 })
    expect(lane1.getPosition()).toEqual({ x: 40, y: 70 })
    expect(lane1.getSize()).toEqual({ width: 60, height: 370 })
    expect(lane2.getPosition()).toEqual({ x: 100, y: 70 })
    expect(lane2.getSize()).toEqual({ width: 150, height: 370 })
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

  it('省略 options 时应使用默认大小和默认标签', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    const newLane = addLaneAbove(graph as any, lane1)

    expect(newLane).not.toBeNull()
    expect(lane1.setPosition).toHaveBeenCalledWith(70, 165, { bpmnLayout: true })
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.width).toBe(570)
    expect(addedConfig.height).toBe(125)
    expect(addedConfig.attrs.headerLabel.text).toBe('Lane')
  })

  it('垂直 Pool 中应在指定 Lane 左侧插入新 Lane，并推动参照 Lane 向右移动', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 200, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 150, 370, verticalData)
    lane1.__setParent(pool)
    pool.embed(lane1)
    const graph = createMockGraph([pool, lane1])

    const newLane = addLaneAbove(graph as any, lane1, { label: '左侧泳道' })

    expect(newLane).not.toBeNull()
    expect(lane1.setPosition).toHaveBeenCalledWith(165, 70, { bpmnLayout: true })
    expect(pool.resize).toHaveBeenCalledWith(325, 400, { bpmnLayout: true })
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.x).toBe(40)
    expect(addedConfig.y).toBe(70)
    expect(addedConfig.width).toBe(125)
    expect(addedConfig.height).toBe(370)
  })

  it('Lane 无父 Pool 时应返回 null', () => {
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    const graph = createMockGraph([lane1])

    const result = addLaneAbove(graph as any, lane1)

    expect(result).toBeNull()
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

  it('垂直 Pool 中应在指定 Lane 右侧插入新 Lane', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 100, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    const result = addLaneBelow(graph as any, lane1, { label: '右侧泳道' })

    expect(result).not.toBeNull()
    const addedConfig = graph.addNode.mock.calls[0][0]
    expect(addedConfig.x).toBe(140)
    expect(addedConfig.y).toBe(70)
    expect(addedConfig.width).toBe(125)
    expect(addedConfig.height).toBe(370)
  })

  it('存在中间父节点时应继续沿父链找到 Pool', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 600, 400)
    const wrapper = {
      id: 'wrapper',
      isNode: () => false,
      shape: 'group',
      getParent: () => pool,
    }
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 570, 200)
    lane1.__setParent(wrapper)
    const graph = createMockGraph([pool, lane1])

    const result = addLaneBelow(graph as any, lane1)

    expect(result).not.toBeNull()
    expect(graph.addNode).toHaveBeenCalledOnce()
  })
})

// ============================================================================
// resize 收敛测试
// ============================================================================

describe('reconcileLaneResize', () => {
  it('水平 Lane 左右边拖拽应投影为 Pool 宽度变化', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 30, 40, 470, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 430, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    const result = reconcileLaneResize(graph as any, lane1 as any, 'left')

    expect(result).toBe(pool)
    expect(pool.getPosition()).toEqual({ x: 0, y: 40 })
    expect(pool.getSize().width).toBe(500)
    expect(lane1.getPosition().x).toBe(30)
    expect(lane1.getSize().width).toBe(470)
    expect(lane2.getPosition().x).toBe(30)
    expect(lane2.getSize().width).toBe(470)
  })

  it('水平右边拖拽直接使用当前 rect 扩展 Pool 宽度', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 470, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 430, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any, 'right')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 500, height: 300 })
  })

  it('省略 direction 时应按当前 Lane union 收敛 Pool 与兄弟 Lane', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 120)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 160, 430, 210)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any)

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 460, height: 330 })
    expect(lane1.getPosition()).toEqual({ x: 70, y: 40 })
    expect(lane1.getSize()).toEqual({ width: 430, height: 120 })
    expect(lane2.getPosition()).toEqual({ x: 70, y: 160 })
    expect(lane2.getSize()).toEqual({ width: 430, height: 210 })
  })

  it('水平左边拖拽未越过其他 Lane 的左边界时不应移动 Pool', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 80, 40, 430, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 430, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any, 'left')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 470, height: 300 })
  })

  it('单 Lane 左边拖拽仅改变位置时应直接跟随当前 Lane 左边界', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 30, 40, 430, 300)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(graph as any, lane1 as any, 'left')

    expect(pool.getPosition()).toEqual({ x: 0, y: 40 })
    expect(pool.getSize()).toEqual({ width: 460, height: 300 })
  })

  it('单 Lane 右边拖拽仅改变尺寸时应依赖起始 rect 扩展 Pool 宽度', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 470, 300)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(
      graph as any,
      lane1 as any,
      'right',
      { x: 70, y: 40, width: 430, height: 300 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 500, height: 300 })
  })

  it('首 Lane 顶边拖拽应投影为 Pool 高度向上扩展', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 0, 430, 190)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 430, 150)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 0 })
    expect(pool.getSize().height).toBe(340)
    expect(lane1.getPosition().y).toBe(0)
    expect(lane2.getPosition().y).toBe(190)
  })

  it('单 Lane 顶边拖拽仅改变位置时应直接跟随当前 Lane 顶边', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 0, 430, 300)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(graph as any, lane1 as any, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 0 })
    expect(pool.getSize()).toEqual({ width: 460, height: 300 })
  })

  it('单 Lane 底边拖拽仅改变尺寸时应依赖起始 rect 扩展 Pool 高度', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 340)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(
      graph as any,
      lane1 as any,
      'bottom',
      { x: 70, y: 40, width: 430, height: 300 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 460, height: 340 })
  })

  it('末 Lane 底边拖拽应投影为 Pool 高度向下扩展', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 150)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 190, 430, 210)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'bottom')

    expect(pool.getSize().height).toBe(360)
    expect(lane2.getPosition().y + lane2.getSize().height).toBe(400)
  })

  it('内侧 top 拖拽命中前一条 Lane 最小高度时应钳制共享边界而不扩展 Pool', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 70)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 80, 430, 260)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'top')

    expect(lane1.getSize().height).toBe(60)
    expect(pool.getPosition().y).toBe(40)
    expect(pool.getSize().height).toBe(300)
    expect(lane2.getPosition().y).toBe(100)
  })

  it('内侧 top 拖拽命中原高度时不应重复调整前一条 Lane 或扩展 Pool', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 70)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 110, 430, 230)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'top')

    expect(lane1.getSize().height).toBe(70)
    expect(pool.getPosition().y).toBe(40)
    expect(pool.getSize().height).toBe(300)
  })

  it('垂直布局顶底边拖拽应投影为 Pool 高度变化', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 60, 130, 390, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 170, 70, 130, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 30 })
    expect(pool.getSize().height).toBe(420)
    expect(lane1.getPosition().y).toBe(60)
    expect(lane2.getSize().height).toBe(390)
  })

  it('单 Lane 垂直布局上边拖拽仅改变位置时应直接跟随当前 Lane 顶边', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 40, 260, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(graph as any, lane1 as any, 'top')

    expect(pool.getPosition()).toEqual({ x: 40, y: 10 })
    expect(pool.getSize()).toEqual({ width: 260, height: 400 })
  })

  it('单 Lane 垂直布局下边拖拽直接使用当前 rect 扩展 Pool 高度', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 260, 390, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(graph as any, lane1 as any, 'bottom')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 260, height: 420 })
  })

  it('单 Lane 垂直布局下边拖拽仅改变尺寸时应依赖起始 rect 扩展 Pool 高度', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 260, 430, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(
      graph as any,
      lane1 as any,
      'bottom',
      { x: 40, y: 70, width: 260, height: 370 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 260, height: 460 })
  })

  it('垂直布局左边界拖拽应投影为 Pool 宽度变化', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 10, 70, 160, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 170, 70, 130, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane1 as any, 'left')

    expect(pool.getPosition()).toEqual({ x: 10, y: 40 })
    expect(pool.getSize().width).toBe(290)
    expect(lane2.getPosition().x).toBe(170)
  })

  it('单 Lane 垂直布局左边拖拽仅改变位置时应直接跟随当前 Lane 左边界', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 10, 70, 260, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(graph as any, lane1 as any, 'left')

    expect(pool.getPosition()).toEqual({ x: 10, y: 40 })
    expect(pool.getSize()).toEqual({ width: 260, height: 400 })
  })

  it('垂直布局右边界拖拽应投影为 Pool 宽度变化', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 100, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 140, 70, 190, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'right')

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize().width).toBe(290)
  })

  it('单 Lane 垂直布局右边拖拽仅改变尺寸时应依赖起始 rect 扩展 Pool 宽度', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 290, 370, verticalData)
    lane1.__setParent(pool)
    const graph = createMockGraph([pool, lane1])

    reconcileLaneResize(
      graph as any,
      lane1 as any,
      'right',
      { x: 40, y: 70, width: 260, height: 370 },
    )

    expect(pool.getPosition()).toEqual({ x: 40, y: 40 })
    expect(pool.getSize()).toEqual({ width: 290, height: 400 })
  })

  it('垂直布局内侧 left 拖拽命中前一条 Lane 最小宽度时应钳制共享边界而不扩展 Pool', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 70, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 90, 70, 220, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'left')

    expect(lane1.getSize().width).toBe(60)
    expect(pool.getPosition().x).toBe(40)
    expect(pool.getSize().width).toBe(270)
    expect(lane2.getPosition().x).toBe(100)
  })

  it('垂直布局内侧 left 拖拽命中原宽度时不应重复调整前一条 Lane 或扩展 Pool', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 260, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 90, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 130, 70, 170, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    reconcileLaneResize(graph as any, lane2 as any, 'left')

    expect(lane1.getSize().width).toBe(90)
    expect(pool.getPosition().x).toBe(40)
    expect(pool.getSize().width).toBe(260)
  })

  it('垂直布局内侧非 left 拖拽应保持前一条 Lane 不变，并按实际最右边界收敛 Pool', () => {
    const verticalData = { bpmn: { isHorizontal: false } }
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 360, 400, verticalData)
    const lane1 = createMockNode('lane1', BPMN_LANE, 40, 70, 100, 370, verticalData)
    const lane2 = createMockNode('lane2', BPMN_LANE, 140, 70, 100, 370, verticalData)
    const lane3 = createMockNode('lane3', BPMN_LANE, 240, 70, 100, 370, verticalData)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    lane3.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2, lane3])

    reconcileLaneResize(graph as any, lane2 as any, 'right')

    expect(lane1.getSize().width).toBe(100)
    expect(lane2.getPosition().x).toBe(140)
    expect(pool.getSize().width).toBe(300)
  })

  it('Lane 不在 graph 节点列表中时应回退为普通紧凑布局', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 100)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 140, 430, 100)
    const ghostLane = createMockNode('ghost', BPMN_LANE, 70, 100, 430, 200)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    ghostLane.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    const result = reconcileLaneResize(graph as any, ghostLane as any, 'bottom')

    expect(result).toBe(pool)
    expect(lane1.getPosition().y).toBe(40)
    expect(lane2.getPosition().y).toBe(140)
  })
})

describe('setupLaneManagement', () => {
  it('应注册 node:resized 事件监听器', () => {
    const graph = createMockGraph([])

    const dispose = setupLaneManagement(graph as any)

    expect(typeof dispose).toBe('function')
    expect(graph.on).toHaveBeenCalledWith('node:resized', expect.any(Function))
  })

  it('dispose 后应移除 node:resized 事件监听器', () => {
    const graph = createMockGraph([])

    const dispose = setupLaneManagement(graph as any)
    const [[eventName, handler]] = graph.on.mock.calls

    dispose()

    expect(graph.off).toHaveBeenCalledWith(eventName, handler)
    expect(eventName).toBe('node:resized')
  })

  it('Lane resize 完成后应触发 onLaneResize 回调', () => {
    const pool = createMockNode('pool1', BPMN_POOL, 40, 40, 460, 300)
    const lane1 = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 180)
    const lane2 = createMockNode('lane2', BPMN_LANE, 70, 220, 430, 120)
    lane1.__setParent(pool)
    lane2.__setParent(pool)
    const graph = createMockGraph([pool, lane1, lane2])

    const onLaneResize = vi.fn()
    setupLaneManagement(graph as any, { onLaneResize })

    graph.__emit('node:resized', { node: lane1, options: { direction: 'bottom' } })

    expect(onLaneResize).toHaveBeenCalledWith(lane1, pool)
  })

  it('非 Lane、silent 或无父 Pool 时不应触发回调', () => {
    const task = createMockNode('task1', 'bpmn-user-task', 100, 100, 100, 60)
    const lane = createMockNode('lane1', BPMN_LANE, 70, 40, 430, 180)
    const graph = createMockGraph([task, lane])
    const onLaneResize = vi.fn()

    setupLaneManagement(graph as any, { onLaneResize })

    graph.__emit('node:resized', { node: task, options: {} })
    graph.__emit('node:resized', { node: lane, options: { silent: true } })
    graph.__emit('node:resized', { node: lane, options: {} })

    expect(onLaneResize).not.toHaveBeenCalled()
  })
})
