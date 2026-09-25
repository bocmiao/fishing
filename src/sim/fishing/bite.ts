import type { Rng } from '../rng/rng';
import type { FishSpecies } from '../data/schema';

/** 没在配置表里写的饵料，按这个兴趣值算 */
const DEFAULT_BAIT_INTEREST = 0.3;

export function baitInterest(species: FishSpecies, baitId: string): number {
  return species.baits[baitId] ?? DEFAULT_BAIT_INTEREST;
}

/** 浮漂落水时，离鱼多近会把它吓跑（像素） */
export function spookRadius(species: FishSpecies): number {
  return 40 + 90 * species.behavior.wariness;
}

/** 鱼能察觉到饵的距离（像素）：饵越对胃口，越远就能被吸引过来 */
export function noticeRadius(species: FishSpecies, baitId: string): number {
  return 150 + 120 * Math.min(2, baitInterest(species, baitId));
}

/** 察觉到饵之后，决定游过来的概率 */
export function approachChance(species: FishSpecies, baitId: string): number {
  const interest = baitInterest(species, baitId);
  const p = 0.25 + 0.4 * interest - 0.35 * species.behavior.wariness;
  return Math.max(0.05, Math.min(0.95, p));
}

export interface Nibble {
  /** 鱼到达饵旁边后的第几秒 */
  at: number;
  /** 这一口把饵偷走了 */
  steals: boolean;
}

export interface BitePlan {
  nibbles: Nibble[];
  /** 真正咬钩的时间；null 表示试探完就走了（或者饵被偷了） */
  biteAt: number | null;
  /** 咬钩后可以提竿的时间窗口（秒） */
  window: number;
}

/** 规划一条鱼到了饵旁边之后的行为：先试探几下，然后咬钩或者离开 */
export function planBite(species: FishSpecies, baitId: string, rng: Rng): BitePlan {
  const b = species.behavior;
  const interest = baitInterest(species, baitId);
  // 越对胃口越干脆，试探次数少一些
  let count = rng.int(b.nibbles[0], b.nibbles[1]);
  if (interest > 1.3 && count > 0 && rng.chance(0.4)) count--;
  const nibbles: Nibble[] = [];
  let t = rng.range(0.5, 1.3);
  for (let i = 0; i < count; i++) {
    const steals = rng.chance(b.baitThief);
    nibbles.push({ at: t, steals });
    if (steals) return { nibbles, biteAt: null, window: 0 };
    t += rng.range(0.55, 1.5);
  }
  const pBite = Math.max(0.15, Math.min(0.97, 0.45 + 0.4 * interest - 0.3 * b.wariness));
  const biteAt = rng.chance(pBite) ? t + rng.range(0.1, 0.7) : null;
  const window = b.biteWindow * rng.range(0.9, 1.1);
  return { nibbles, biteAt, window };
}

/**
 * 提竿时机的好坏 0~1：咬钩后越快提竿越好。
 * 超出窗口返回 0（鱼已经跑了）。
 */
export function strikeQuality(reaction: number, window: number): number {
  if (reaction < 0 || reaction > window) return 0;
  const t = reaction / window;
  return t < 0.35 ? 1 : 1 - ((t - 0.35) / 0.65) * 0.7;
}
