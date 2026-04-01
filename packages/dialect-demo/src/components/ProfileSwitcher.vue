<template>
  <div class="profile-switcher">
    <div class="section-title">方言切换 Profile Switching</div>
    <a-radio-group
      v-model="currentDialectId"
      direction="vertical"
      @change="handleSwitch"
    >
      <a-radio
        v-for="d in AVAILABLE_DIALECTS"
        :key="d.id"
        :value="d.id"
      >
        <div class="dialect-option">
          <div class="dialect-name">{{ d.name }}</div>
          <div class="dialect-desc">{{ d.desc }}</div>
        </div>
      </a-radio>
    </a-radio-group>

    <div class="info-row" style="margin-top: 12px">
      <a-tag color="arcoblue" size="small">当前: {{ currentDialectId }}</a-tag>
    </div>

    <div class="info-row">
      <span class="info-label">继承链:</span>
      <div class="chain-list">
        <a-tag
          v-for="(id, idx) in inheritanceChain"
          :key="id"
          :color="idx === inheritanceChain.length - 1 ? 'arcoblue' : 'gray'"
          size="small"
        >
          {{ id }}
        </a-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { useDialectSingleton, AVAILABLE_DIALECTS } from '../composables/useDialect'

const { currentDialectId, inheritanceChain, switchDialect, graphRef } = useDialectSingleton()

function handleSwitch(val: string | number | boolean) {
  if (!graphRef.value) {
    Message.warning('画布尚未初始化')
    return
  }
  switchDialect(val as string)
  Message.success(`已切换到: ${AVAILABLE_DIALECTS.find((d) => d.id === val)?.name}`)
}
</script>

<style scoped>
.profile-switcher {
  padding: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 10px;
}

.dialect-option {
  margin-left: 4px;
}

.dialect-name {
  font-size: 13px;
  font-weight: 500;
}

.dialect-desc {
  font-size: 11px;
  color: var(--color-text-3);
  line-height: 1.3;
}

.info-row {
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  flex-wrap: wrap;
}

.info-label {
  font-size: 12px;
  color: var(--color-text-3);
  white-space: nowrap;
}

.chain-list {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

:deep(.arco-radio) {
  margin-bottom: 6px;
}
</style>
