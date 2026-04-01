/**
 * 流程方言内核 — Profile 注册表
 *
 * 管理所有已注册的 Profile，支持注册、查询、列表等操作。
 * 单独实例化，不使用全局状态，支持多注册表并存。
 */

import type { Profile, ResolvedProfile } from './types'
import { compileProfile } from './compiler'

/**
 * ProfileRegistry — 方言 Profile 注册表
 *
 * 用于注册和管理 Profile 定义，提供编译入口。
 */
export class ProfileRegistry {
  private profiles = new Map<string, Profile>()
  private compiled = new Map<string, ResolvedProfile>()

  /**
   * 注册一个 Profile。
   * 注册后会清除该 profile 及其所有子 profile 的编译缓存。
   */
  register(profile: Profile): void {
    this.profiles.set(profile.meta.id, profile)
    // 清除编译缓存（该 profile 及所有引用它的子 profile）
    this.invalidateCache(profile.meta.id)
  }

  /**
   * 批量注册多个 Profile。
   */
  registerAll(profiles: Profile[]): void {
    for (const profile of profiles) {
      this.profiles.set(profile.meta.id, profile)
    }
    // 全部清除编译缓存
    this.compiled.clear()
  }

  /**
   * 获取已注册的原始 Profile 定义。
   */
  get(id: string): Profile | undefined {
    return this.profiles.get(id)
  }

  /**
   * 检查 Profile 是否已注册。
   */
  has(id: string): boolean {
    return this.profiles.has(id)
  }

  /**
   * 编译指定 Profile，返回 ResolvedProfile。
   * 编译结果会被缓存，再次调用直接返回缓存。
   */
  compile(id: string): ResolvedProfile {
    const cached = this.compiled.get(id)
    if (cached) return cached

    const resolved = compileProfile(id, this)
    this.compiled.set(id, resolved)
    return resolved
  }

  /**
   * 列出所有已注册的 Profile ID。
   */
  list(): string[] {
    return Array.from(this.profiles.keys())
  }

  /**
   * 获取指定 profile 的继承链（从根到叶）。
   */
  getInheritanceChain(id: string): string[] {
    const chain: string[] = []
    const visited = new Set<string>()
    let currentId: string | undefined = id

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(`Circular inheritance detected: ${chain.join(' -> ')} -> ${currentId}`)
      }
      visited.add(currentId)
      chain.unshift(currentId)
      const profile = this.profiles.get(currentId)
      currentId = profile?.meta.parent
    }

    return chain
  }

  /**
   * 清除指定 profile 及其所有子 profile 的编译缓存。
   */
  private invalidateCache(id: string, visited: Set<string> = new Set()): void {
    if (visited.has(id)) return // 防止循环继承引起无限递归
    visited.add(id)
    this.compiled.delete(id)
    // 清除所有以 id 为父级的 profile 缓存
    for (const [profileId, profile] of this.profiles) {
      if (profile.meta.parent === id) {
        this.invalidateCache(profileId, visited)
      }
    }
  }
}

/**
 * 创建一个新的 ProfileRegistry 实例。
 */
export function createProfileRegistry(): ProfileRegistry {
  return new ProfileRegistry()
}
