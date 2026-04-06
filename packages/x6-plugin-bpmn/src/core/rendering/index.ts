/**
 * 核心渲染层 — 模块入口
 *
 * 这里不直接关心宿主 UI，而是负责把 Profile 中的节点、边定义
 * 转成可注册到 X6 的 renderer 集合。
 */

export { createBpmn2NodeRenderers } from './node-renderers'
export { createBpmn2EdgeRenderers } from './edge-renderers'
