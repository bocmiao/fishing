import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { spawnTable } from '../src/sim/fishing/spawn';
import { Rng } from '../src/sim/rng/rng';
import { GameState } from '../src/sim/state';

const data = getGameData();

describe('荷花湖', () => {
  it('要先修路才能去', () => {
    const state = new GameState(data, 1);
    expect(state.placeOpen('lake')).toBe(false);
    expect(state.placeOpen('fishing')).toBe(true);
    state.money = 10_000;
    expect(state.buyUpgrade('road_lake')).toBe('ok');
    expect(state.placeOpen('lake')).toBe(true);
  });

  it('湖里出湖里的鱼，溪里出溪里的鱼，锦鲤是稀有的', () => {
    const ctx = { zone: 'weeds', period: 'day', weather: 'sunny', season: 'spring' } as const;
    const lake = spawnTable(data.species, { ...ctx, spotId: 'lotus_lake' });
    const creek = spawnTable(data.species, { ...ctx, spotId: 'creek' });
    const lakeIds = new Set(lake.map((x) => x.id));
    expect(lakeIds.has('common_carp')).toBe(true);
    expect(lakeIds.has('crucian')).toBe(false);
    expect(creek.some((x) => x.id === 'common_carp')).toBe(false);
    const koi = lake.find((x) => x.id === 'released_koi')!;
    expect(koi.p).toBeGreaterThan(0);
    expect(koi.p).toBeLessThan(0.1);
  });

  it('锦鲤只看不吃：不进活鱼缸、周叔不收，但能放进方塘', () => {
    const state = new GameState(data, 2);
    const koi = rollFish(data.speciesById.get('released_koi')!, new Rng(2));
    state.keep(koi, 'lotus_lake', 'lotus');
    expect(state.toTank(koi.uid)).toBe(false);
    expect(state.sellFish(koi.uid)).toBe(0);
    expect(state.keepNet).toHaveLength(1);
    const pondFish = state.releaseToPond(koi.uid)!;
    expect(pondFish.speciesId).toBe('released_koi');
    expect(pondFish.origin).toContain('荷花湖');
  });

  it('湖里的鱼能做成菜', () => {
    const state = new GameState(data, 3);
    const carp = rollFish(data.speciesById.get('common_carp')!, new Rng(3));
    state.keep(carp, 'lotus_lake', 'pier');
    expect(state.toTank(carp.uid)).toBe(true);
    expect(data.recipes.some((r) => r.fish?.species.includes('common_carp'))).toBe(true);
  });
});
