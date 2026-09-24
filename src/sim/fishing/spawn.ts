import type { Rng } from '../rng/rng';
import type { FishSpecies, Rarity, Weather, ZoneType } from '../data/schema';
import type { DayPeriod, Season } from '../time/clock';

export interface SpawnContext {
  spotId: string;
  zone: ZoneType;
  period: DayPeriod;
  weather: Weather;
  season: Season;
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 1,
  uncommon: 0.45,
  rare: 0.15,
  legendary: 0.02,
};

/** 某个品种在当前条件下出现的相对权重；0 表示不会出现 */
export function spawnWeight(species: FishSpecies, ctx: SpawnContext): number {
  if (!species.spots.includes(ctx.spotId)) return 0;
  return (
    RARITY_WEIGHT[species.rarity] *
    (species.zones[ctx.zone] ?? 0.3) *
    (species.periods[ctx.period] ?? 1) *
    (species.weather[ctx.weather] ?? 1) *
    (species.seasons[ctx.season] ?? 1)
  );
}

/** 按权重随机选一个会在这里出现的品种 */
export function pickSpecies(
  all: readonly FishSpecies[],
  ctx: SpawnContext,
  rng: Rng,
): FishSpecies | undefined {
  return rng.weighted(all, (s) => spawnWeight(s, ctx));
}

/** 当前条件下各品种的出现概率（给调试面板和测试用） */
export function spawnTable(
  all: readonly FishSpecies[],
  ctx: SpawnContext,
): { id: string; p: number }[] {
  const weights = all.map((s) => ({ id: s.id, w: spawnWeight(s, ctx) }));
  const total = weights.reduce((sum, x) => sum + x.w, 0) || 1;
  return weights.filter((x) => x.w > 0).map((x) => ({ id: x.id, p: x.w / total }));
}
