import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { Rng } from '../src/sim/rng/rng';
import { GameState, rollWeather } from '../src/sim/state';

const data = getGameData();

describe('GameState', () => {
  it('第一次钓到是新的一页，之后按重量记纪录', () => {
    const state = new GameState(data, 1);
    const sp = data.speciesById.get('crucian')!;
    const small = { ...rollFish(sp, new Rng(1)), weightKg: 0.2 };
    const big = { ...small, uid: 999, weightKg: 0.5 };
    expect(state.recordCatch(small)).toEqual({ newSpecies: true, newRecord: true });
    expect(state.recordCatch(small)).toEqual({ newSpecies: false, newRecord: false });
    expect(state.recordCatch(big)).toEqual({ newSpecies: false, newRecord: true });
    expect(state.journal.get('crucian')).toMatchObject({ caught: 3, bestWeightKg: 0.5 });
  });

  it('鱼护满了就放不进去', () => {
    const state = new GameState(data, 2);
    const sp = data.speciesById.get('crucian')!;
    const rng = new Rng(2);
    for (let i = 0; i < state.keepNetCapacity; i++)
      expect(state.keep(rollFish(sp, rng), 'creek', 'bay')).toBe(true);
    expect(state.keepNetFull).toBe(true);
    expect(state.keep(rollFish(sp, rng), 'creek', 'bay')).toBe(false);
  });

  it('开局塘里只有外公的两条锦鲤', () => {
    const state = new GameState(data, 5);
    expect(state.pond.map((f) => f.name)).toEqual(['大红', '阿金']);
    expect(state.pond.every((f) => f.speciesId === null && f.variety)).toBe(true);
    // 同名的锦鲤每局长得一样
    expect(new GameState(data, 6).pond[0]!.lookSeed).toBe(state.pond[0]!.lookSeed);
  });

  it('鱼护里的鱼可以放进鱼塘，塘满了就放不进', () => {
    const state = new GameState(data, 6);
    const sp = data.speciesById.get('crucian')!;
    const rng = new Rng(6);
    const fish = rollFish(sp, rng);
    state.keep(fish, 'creek', 'bay');
    const released = state.releaseToPond(fish.uid)!;
    expect(released).toMatchObject({ name: '鲫鱼', speciesId: 'crucian', lookSeed: fish.lookSeed });
    expect(released.origin).toContain('屋后小溪');
    expect(state.keepNet).toHaveLength(0);
    expect(state.pond).toHaveLength(3);
    expect(state.releaseToPond(fish.uid)).toBeNull();

    while (!state.pondFull) {
      const f = rollFish(sp, rng);
      state.keep(f, 'creek', 'bay');
      state.releaseToPond(f.uid);
    }
    const extra = rollFish(sp, rng);
    state.keep(extra, 'creek', 'bay');
    expect(state.releaseToPond(extra.uid)).toBeNull();
    expect(state.keepNet).toHaveLength(1);
    expect(state.releaseToWild(extra.uid)).toBe(true);
    expect(state.keepNet).toHaveLength(0);
  });

  it('睡觉进入下一天', () => {
    const state = new GameState(data, 3);
    state.sleep();
    expect(state.clock.day).toBe(1);
  });

  it('天气按季节概率抽取', () => {
    const rng = new Rng(4);
    let rain = 0;
    for (let i = 0; i < 4000; i++) if (rollWeather('spring', rng) === 'rain') rain++;
    expect(rain / 4000).toBeGreaterThan(0.2);
    expect(rain / 4000).toBeLessThan(0.3);
  });
});
