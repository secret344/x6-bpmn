<template>
  <div class="mode-compare-panel">
    <div class="compare-header">
      <div class="compare-title">SmartEngine 三模式对比</div>
      <div class="compare-desc">对比不同模式下元素可用性、字段、约束规则的差异</div>
    </div>

    <!-- 元素可用性对比 -->
    <div class="compare-section">
      <div class="section-title">元素可用性</div>
      <div class="compare-table">
        <div class="table-header">
          <div class="col-shape">元素</div>
          <div class="col-mode">基础</div>
          <div class="col-mode">编排</div>
          <div class="col-mode">审批</div>
        </div>
        <div v-for="item in availabilityComparison" :key="item.shape" class="table-row" :class="{ diff: item.hasDiff }">
          <div class="col-shape" :title="item.shape">{{ item.title }}</div>
          <div class="col-mode">
            <span :class="item.base === 'enabled' ? 'status-on' : 'status-off'">{{ item.base === 'enabled' ? '✓' : '✗' }}</span>
          </div>
          <div class="col-mode">
            <span :class="item.custom === 'enabled' ? 'status-on' : 'status-off'">{{ item.custom === 'enabled' ? '✓' : '✗' }}</span>
          </div>
          <div class="col-mode">
            <span :class="item.database === 'enabled' ? 'status-on' : 'status-off'">{{ item.database === 'enabled' ? '✓' : '✗' }}</span>
          </div>
        </div>
      </div>
      <div class="legend">
        <span class="status-on">✓ 启用</span>
        <span class="status-off">✗ 禁用</span>
        <span class="diff-mark">■ 有差异</span>
      </div>
    </div>

    <!-- 字段对比 -->
    <div class="compare-section">
      <div class="section-title">字段对比 (task 分类)</div>
      <div class="compare-table">
        <div class="table-header">
          <div class="col-shape">字段</div>
          <div class="col-mode">基础</div>
          <div class="col-mode">编排</div>
          <div class="col-mode">审批</div>
        </div>
        <div v-for="item in fieldComparison" :key="item.key" class="table-row" :class="{ diff: item.hasDiff }">
          <div class="col-shape mono" :title="item.key">{{ item.key }}</div>
          <div class="col-mode">
            <span :class="item.base ? 'status-on' : 'status-off'">{{ item.base ? '✓' : '—' }}</span>
          </div>
          <div class="col-mode">
            <span :class="item.custom ? 'status-on' : 'status-off'">{{ item.custom ? '✓' : '—' }}</span>
          </div>
          <div class="col-mode">
            <span :class="item.database ? 'status-on' : 'status-off'">{{ item.database ? '✓' : '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 约束对比 -->
    <div class="compare-section">
      <div class="section-title">约束规则</div>
      <div v-for="mode in constraintModes" :key="mode.id" class="constraint-block">
        <div class="constraint-mode-label" :style="{ color: mode.color }">{{ mode.label }}</div>
        <div v-for="c in mode.constraints" :key="c.id" class="constraint-item">
          <span class="constraint-id">{{ c.id }}</span>
          <span class="constraint-desc">{{ c.description }}</span>
        </div>
        <div v-if="mode.constraints.length === 0" class="empty-hint">无额外约束</div>
      </div>
    </div>

    <!-- 继承链 -->
    <div class="compare-section">
      <div class="section-title">Profile 继承关系</div>
      <div class="inheritance-chain">
        <div class="chain-item">
          <a-tag color="gray">bpmn2</a-tag>
          <span class="chain-arrow">↓</span>
        </div>
        <div class="chain-item">
          <a-tag color="blue">smartengine-base</a-tag>
          <div class="chain-branch">
            <span class="chain-arrow">↙</span>
            <span class="chain-arrow">↘</span>
          </div>
        </div>
        <div class="chain-leaf">
          <a-tag color="orange">smartengine-custom</a-tag>
          <a-tag color="green">smartengine-database</a-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  createProfileRegistry,
  bpmn2Profile,
  smartengineBaseProfile,
  smartengineCustomProfile,
  smartengineDatabaseProfile,
  compileProfile,
  getFieldsForCategory,
} from '@x6-bpmn2/plugin'

// 独立编译三个 profile 用于对比
const registry = createProfileRegistry()
registry.registerAll([bpmn2Profile, smartengineBaseProfile, smartengineCustomProfile, smartengineDatabaseProfile])

const baseResolved = compileProfile('smartengine-base', registry)
const customResolved = compileProfile('smartengine-custom', registry)
const databaseResolved = compileProfile('smartengine-database', registry)

// ---- 元素可用性对比 ----
const availabilityComparison = computed(() => {
  const allShapes = new Set<string>()
  for (const r of [baseResolved, customResolved, databaseResolved]) {
    for (const s of Object.keys(r.availability.nodes)) allShapes.add(s)
  }

  return Array.from(allShapes).map((shape) => {
    const base = baseResolved.availability.nodes[shape] || 'enabled'
    const custom = customResolved.availability.nodes[shape] || 'enabled'
    const database = databaseResolved.availability.nodes[shape] || 'enabled'
    const title = baseResolved.definitions.nodes[shape]?.title || shape.split('-').pop() || shape
    return {
      shape,
      title,
      base,
      custom,
      database,
      hasDiff: !(base === custom && custom === database),
    }
  }).sort((a, b) => {
    if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1
    return a.shape.localeCompare(b.shape)
  })
})

// ---- 字段对比 (task 分类) ----
const fieldComparison = computed(() => {
  const baseFields = getFieldsForCategory('task', baseResolved.dataModel)
  const customFields = getFieldsForCategory('task', customResolved.dataModel)
  const databaseFields = getFieldsForCategory('task', databaseResolved.dataModel)

  const allKeys = new Set<string>()
  for (const f of [...baseFields, ...customFields, ...databaseFields]) allKeys.add(f)

  const baseSet = new Set(baseFields)
  const customSet = new Set(customFields)
  const databaseSet = new Set(databaseFields)

  return Array.from(allKeys).map((key) => ({
    key,
    base: baseSet.has(key),
    custom: customSet.has(key),
    database: databaseSet.has(key),
    hasDiff: !(baseSet.has(key) === customSet.has(key) && customSet.has(key) === databaseSet.has(key)),
  })).sort((a, b) => {
    if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1
    return a.key.localeCompare(b.key)
  })
})

// ---- 约束对比 ----
const constraintModes = computed(() => [
  {
    id: 'smartengine-base',
    label: '基础模式',
    color: '#165dff',
    constraints: baseResolved.rules.constraints.map((c) => ({ id: c.id, description: c.description })),
  },
  {
    id: 'smartengine-custom',
    label: '服务编排模式',
    color: '#ff7d00',
    constraints: customResolved.rules.constraints.map((c) => ({ id: c.id, description: c.description })),
  },
  {
    id: 'smartengine-database',
    label: '审批工单模式',
    color: '#00b42a',
    constraints: databaseResolved.rules.constraints.map((c) => ({ id: c.id, description: c.description })),
  },
])
</script>

<style scoped>
.mode-compare-panel {
  padding: 4px;
}

.compare-header {
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 6px;
  margin-bottom: 12px;
}

.compare-title {
  font-size: 13px;
  font-weight: 600;
}

.compare-desc {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.compare-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 6px;
}

.compare-table {
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: flex;
  background: var(--color-fill-2);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-2);
}

.table-row {
  display: flex;
  border-top: 1px solid var(--color-border-1);
  font-size: 11px;
}

.table-row.diff {
  background: #fffbe6;
}

.col-shape {
  flex: 2;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-shape.mono {
  font-family: monospace;
}

.col-mode {
  flex: 1;
  padding: 4px 6px;
  text-align: center;
}

.status-on {
  color: #00b42a;
  font-weight: 600;
}

.status-off {
  color: #c9cdd4;
}

.legend {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;
  color: var(--color-text-3);
}

.diff-mark {
  color: #faad14;
}

.constraint-block {
  margin-bottom: 10px;
}

.constraint-mode-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.constraint-item {
  display: flex;
  gap: 6px;
  padding: 3px 8px;
  font-size: 11px;
}

.constraint-id {
  font-family: monospace;
  color: var(--color-text-3);
  flex-shrink: 0;
}

.constraint-desc {
  color: var(--color-text-2);
}

.empty-hint {
  font-size: 11px;
  color: var(--color-text-4);
  padding: 4px 8px;
}

.inheritance-chain {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--color-fill-1);
  border-radius: 6px;
}

.chain-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.chain-branch {
  display: flex;
  gap: 40px;
  font-size: 14px;
  color: var(--color-text-3);
}

.chain-arrow {
  color: var(--color-text-3);
  font-size: 14px;
}

.chain-leaf {
  display: flex;
  gap: 16px;
}
</style>
