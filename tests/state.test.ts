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
