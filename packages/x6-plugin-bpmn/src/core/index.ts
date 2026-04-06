/**
 * 核心模块入口
 *
 * 统一导出 dialect、rendering、rules、data-model 子模块。
 * 新同学阅读主库时，建议优先从 dialect 子模块进入，
 * 先理解 Profile 如何注册、编译和绑定，再回头看规则层与渲染层。
 */

export * from './dialect'
export * from './rendering'
export * from './rules'
export * from './data-model'
export * from './validation'
