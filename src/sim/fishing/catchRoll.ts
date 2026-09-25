import type { Rng } from '../rng/rng';
import type { FishSpecies } from '../data/schema';

export type SizeClass = 'small' | 'medium' | 'large' | 'huge';

export const SIZE_CLASS_NAMES: Record<SizeClass, string> = {
  small: '小',
  medium: '中',
  large: '大',
  huge: '巨',
};

/** 一条具体的鱼（水里的鱼影、钓上来的鱼都是它） */
export interface FishInstance {
  uid: number;
  speciesId: string;
  weightKg: number;
  lengthCm: number;
  sizeClass: SizeClass;
  /** 是否是特别大的个体 */
  trophy: boolean;
  /** 长相的随机种子：卡片上、鱼塘里画出来的是同一条鱼 */
  lookSeed: number;
}

/** 三角分布：大部分落在 mode 附近，少数接近 min 或 max */
export function triangular(rng: Rng, min: number, mode: number, max: number): number {
  const u = rng.float();
  const c = (mode - min) / (max - min || 1);
  return u < c
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/** 由体重（公斤）推算体长（厘米）：体重克数 = condition × 体长³ */
export function lengthFromWeight(species: FishSpecies, weightKg: number): number {
  return Math.cbrt((weightKg * 1000) / species.condition);
}

export function sizeClassOf(lengthCm: number): SizeClass {
  if (lengthCm < 12) return 'small';
  if (lengthCm < 28) return 'medium';
  if (lengthCm < 50) return 'large';
  return 'huge';
}

let nextUid = 1;

/** 读档后调用：之后新钓的鱼编号从 min 往上走，不会和存档里的鱼撞号 */
export function reserveUids(min: number): void {
  nextUid = Math.max(nextUid, Math.floor(min));
}

/** 随机生成一条某个品种的鱼 */
export function rollFish(species: FishSpecies, rng: Rng): FishInstance {
  const { min, mode, max } = species.weightKg;
  let weight = triangular(rng, min, mode, max);
  let trophy = false;
  // 4% 的概率是个大家伙
  if (rng.chance(0.04)) {
    weight = Math.min(max * 1.25, weight * rng.range(1.3, 1.7));
    trophy = true;
  }
  weight = Math.round(weight * 1000) / 1000;
  const lengthCm = Math.round(lengthFromWeight(species, weight) * 10) / 10;
  return {
    uid: nextUid++,
    speciesId: species.id,
    weightKg: weight,
    lengthCm,
    sizeClass: sizeClassOf(lengthCm),
    trophy,
    lookSeed: rng.int(1, 1_000_000_000),
  };
}

/** 显示用的重量文字，按钓鱼人的习惯：不到 1 两用克，不到半斤用两，再重用斤（1 两 = 50 克） */
export function formatWeight(weightKg: number): string {
  const grams = weightKg * 1000;
  if (grams < 50) return `${Math.max(1, Math.round(grams))} 克`;
  if (grams < 500) return `${(grams / 50).toFixed(1)} 两`;
  return `${(grams / 500).toFixed(1)} 斤`;
}
