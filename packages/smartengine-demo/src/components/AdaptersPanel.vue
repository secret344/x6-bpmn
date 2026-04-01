<template>
  <div class="adapters-panel">
    <!-- 适配器架构 -->
    <div class="adapter-section">
      <div class="section-title">适配器架构</div>
      <div class="adapter-diagram">
        <div class="adapter-box export">
          <div class="adapter-label">导出链</div>
          <div class="adapter-chain">
            <div class="chain-step">Graph Cells</div>
            <span class="arrow">→</span>
            <div class="chain-step">SmartEngine Exporter</div>
            <span class="arrow">→</span>
            <div class="chain-step highlight">BPMN XML + SE 扩展</div>
          </div>
        </div>
        <div class="adapter-box import">
          <div class="adapter-label">导入链</div>
          <div class="adapter-chain">
            <div class="chain-step highlight">BPMN XML</div>
            <span class="arrow">→</span>
            <div class="chain-step">SmartEngine Importer</div>
            <span class="arrow">→</span>
            <div class="chain-step">Graph Cells</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 命名空间信息 -->
    <div class="adapter-section">
      <div class="section-title">SmartEngine 命名空间</div>
      <div class="ns-info">
        <div class="ns-row">
          <span class="ns-label">前缀</span>
          <span class="ns-value mono">smartengine:</span>
        </div>
        <div class="ns-row">
          <span class="ns-label">URI</span>
          <span class="ns-value mono">http://smartengine.alibaba.com/schema</span>
        </div>
        <div class="ns-row">
          <span class="ns-label">扩展字段位置</span>
          <span class="ns-value">extensionElements 内</span>
        </div>
      </div>
    </div>

    <!-- 导出预览 -->
    <div class="adapter-section">
      <div class="section-title">
        实时导出预览
        <a-button size="mini" type="text" @click="refreshPreview">刷新</a-button>
      </div>
      <div class="xml-stats" v-if="xmlStats">
        <a-tag size="small" color="blue">{{ xmlStats.nodeCount }} 个节点</a-tag>
        <a-tag size="small" color="green">{{ xmlStats.edgeCount }} 条边</a-tag>
        <a-tag size="small" color="orange">{{ xmlStats.xmlLength }} 字符</a-tag>
        <a-tag v-if="xmlStats.hasSmartengineNS" size="small" color="purple">含 SE 命名空间</a-tag>
      </div>
      <pre class="xml-preview" v-if="xmlPreview">{{ xmlPreview }}</pre>
      <div v-else class="empty-hint">画布无内容或未初始化</div>
    </div>

    <!-- 方言检测演示 -->
    <div class="adapter-section">
      <div class="section-title">方言检测 (DialectDetector)</div>
      <a-textarea
        v-model="detectInput"
        :auto-size="{ minRows: 3, maxRows: 6 }"
        placeholder="粘贴 XML 片段，自动检测方言类型..."
        style="font-family: monospace; font-size: 11px"
        @input="onDetectInput"
      />
      <div class="detect-result" v-if="detectResult">
        <span>检测结果:</span>
        <a-tag :color="detectResultColor">{{ detectResult }}</a-tag>
      </div>
    </div>

    <!-- 适配器详情 -->
    <div class="adapter-section">
      <div class="section-title">SmartEngine 适配器特性</div>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-name">🔧 命名空间注入</div>
          <div class="feature-desc">导出时自动在 definitions 标签添加 SmartEngine 命名空间声明</div>
        </div>
        <div class="feature-item">
          <div class="feature-name">📋 扩展字段序列化</div>
          <div class="feature-desc">smartAction/smartType/smartRetry 等字段序列化为 extensionElements</div>
        </div>
        <div class="feature-item">
          <div class="feature-name">🔄 继承链回退</div>
          <div class="feature-desc">
            导入时按优先级尝试适配器:
            <div class="fallback-chain">SmartEngine Importer → BPMN2 Importer</div>
          </div>
        </div>
        <div class="feature-item">
          <div class="feature-name">📐 自动布局</div>
          <div class="feature-desc">导入时若无位置信息，自动应用层次布局算法</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Graph } from '@antv/x6'
import { useSmartEngineSingleton } from '../composables/useSmartEngine'

const props = defineProps<{ graph: Graph | null }>()

const { exportXML, detectDialect } = useSmartEngineSingleton()

// ---- 导出预览 ----
const xmlPreview = ref('')
const xmlStats = ref<{ nodeCount: number; edgeCount: number; xmlLength: number; hasSmartengineNS: boolean } | null>(null)

async function refreshPreview() {
  if (!props.graph) return
  try {
    const xml = await exportXML()
    // 截取前 1000 字符
    xmlPreview.value = xml.length > 1000 ? xml.slice(0, 1000) + '\n... (截断)' : xml
    xmlStats.value = {
      nodeCount: props.graph.getNodes().length,
      edgeCount: props.graph.getEdges().length,
      xmlLength: xml.length,
      hasSmartengineNS: xml.includes('smartengine'),
    }
  } catch (e: any) {
    xmlPreview.value = `导出失败: ${e.message}`
    xmlStats.value = null
  }
}

// ---- 方言检测 ----
const detectInput = ref('')
const detectResult = ref('')
const detectResultColor = ref('blue')

function onDetectInput() {
  if (!detectInput.value.trim()) {
    detectResult.value = ''
    return
  }
  try {
    detectResult.value = detectDialect(detectInput.value)
    const colorMap: Record<string, string> = {
      'smartengine-base': 'blue',
      'smartengine-custom': 'orange',
      'smartengine-database': 'green',
      bpmn2: 'gray',
    }
    detectResultColor.value = colorMap[detectResult.value] || 'purple'
  } catch {
    detectResult.value = '检测失败'
    detectResultColor.value = 'red'
  }
}
</script>

<style scoped>
.adapters-panel {
  padding: 4px;
}

.adapter-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.adapter-diagram {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.adapter-box {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border-2);
}

.adapter-box.export {
  background: #e8f7ff;
}

.adapter-box.import {
  background: #e8ffea;
}

.adapter-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 4px;
}

.adapter-chain {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chain-step {
  background: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  border: 1px solid var(--color-border-2);
}

.chain-step.highlight {
  background: #165dff;
  color: #fff;
  border-color: #165dff;
}

.arrow {
  color: var(--color-text-3);
  font-size: 12px;
}

.ns-info {
  background: var(--color-fill-1);
  border-radius: 6px;
  padding: 8px;
}

.ns-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 11px;
}

.ns-label {
  color: var(--color-text-3);
}

.ns-value {
  color: var(--color-text-1);
  font-weight: 500;
}

.ns-value.mono {
  font-family: monospace;
}

.xml-stats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.xml-preview {
  background: var(--color-fill-2);
  padding: 8px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.detect-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-3);
  padding: 8px;
  text-align: center;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 6px;
}

.feature-name {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 11px;
  color: var(--color-text-3);
}

.fallback-chain {
  margin-top: 4px;
  font-family: monospace;
  font-size: 11px;
  color: #165dff;
}
</style>
