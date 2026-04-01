<template>
  <div class="constraints-panel">
    <div class="section-title">约束规则清单</div>

    <!-- 规则列表 -->
    <div v-if="constraints.length > 0">
      <div v-for="rule in constraints" :key="rule.id" class="rule-item">
        <div class="rule-header">
          <a-tag size="small" color="purple">{{ rule.id }}</a-tag>
        </div>
        <div class="rule-desc">{{ rule.description }}</div>
      </div>
    </div>
    <a-empty v-else description="当前 Profile 没有约束规则" />

    <!-- 实时验证 -->
    <div class="section-title" style="margin-top: 16px">实时验证</div>
    <a-button type="primary" size="small" long @click="runValidation">
      运行约束验证
    </a-button>

    <div v-if="results.length > 0" class="results-list">
      <div
        v-for="r in results"
        :key="r.id"
        class="result-item"
        :class="{ pass: r.result === true, fail: r.result !== true }"
      >
        <span class="result-icon">{{ r.result === true ? '✓' : '✗' }}</span>
        <div class="result-content">
          <div class="result-desc">{{ r.description }}</div>
          <div v-if="r.result !== true" class="result-reason">{{ r.result }}</div>
        </div>
      </div>
    </div>

    <div v-if="hasRun && results.length === 0" class="empty-results">
      没有定义约束规则
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Graph } from '@antv/x6'
import { useDialectSingleton } from '../composables/useDialect'

const props = defineProps<{
  graph: Graph | null
}>()

const { constraints, runConstraintValidation } = useDialectSingleton()
const results = ref<Array<{ id: string; description: string; result: true | string }>>([])
const hasRun = ref(false)

function runValidation() {
  results.value = runConstraintValidation()
  hasRun.value = true
}
</script>

<style scoped>
.constraints-panel {
  padding: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
}

.rule-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  background: var(--color-fill-1);
  border-radius: 6px;
}

.rule-header {
  margin-bottom: 4px;
}

.rule-desc {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.4;
}

.results-list {
  margin-top: 12px;
}

.result-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border-radius: 6px;
}

.result-item.pass {
  background: #e8ffea;
}

.result-item.fail {
  background: #ffece8;
}

.result-icon {
  font-size: 16px;
  line-height: 1;
}

.result-item.pass .result-icon {
  color: #00b42a;
}

.result-item.fail .result-icon {
  color: #f53f3f;
}

.result-desc {
  font-size: 12px;
  font-weight: 500;
}

.result-reason {
  font-size: 11px;
  color: #f53f3f;
  margin-top: 2px;
}

.empty-results {
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
  padding: 16px 0;
}
</style>
