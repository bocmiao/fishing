import { describe, expect, it } from 'vitest';
import { checkAchievements, progressOf } from '../src/sim/achievements';
import { getGameData } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { Rng } from '../src/sim/rng/rng';
import { restore, serialize } from '../src/sim/save';
import { GameState } from '../src/sim/state';

const data = getGameData();
const achievement = (id: string) => data.achievementById.get(id)!;

describe('成就', () => {
  it('开局什么成就也没有', () => {
    const state = new GameState(data, 1);
    expect(checkAchievements(state)).toEqual([]);
  });

  it('钓到第一条鱼：达成、发奖励、记在今天，只达成一次', () => {
    const state = new GameState(data, 2);
    const money = state.money;
    state.recordCatch(rollFish(data.speciesById.get('crucian')!, new Rng(2)));
    const fresh = checkAchievements(state).map((a) => a.id);
    expect(fresh).toContain('first_fish');
    expect(state.money).toBe(money + achievement('first_fish').reward!.money!);
    expect(state.today.achievements).toContain('first_fish');
    expect(checkAchievements(state)).toEqual([]);
  });

  it('计数类的成就有进度', () => {
    const state = new GameState(data, 3);
    const rng = new Rng(3);
    for (let i = 0; i < 4; i++) state.recordCatch(rollFish(data.speciesById.get('crucian')!, rng));
    expect(progressOf(state, achievement('fish_10').condition)).toEqual({ current: 4, target: 10 });
  });

  it('小溪的鱼全钓到过', () => {
    const state = new GameState(data, 4);
    const rng = new Rng(4);
    for (const sp of data.species.filter((s) => s.spots.includes('creek'))) {
      state.recordCatch(rollFish(sp, rng));
    }
    expect(checkAchievements(state).map((a) => a.id)).toContain('creek_all');
  });

  it('小馆：卖菜、口碑、最好的一晚都会算', () => {
    const state = new GameState(data, 5);
    state.recordDish(40, 0.95);
    state.recordNight(320);
    const ids = checkAchievements(state).map((a) => a.id);
    expect(ids).toContain('dish_first');
    expect(ids).toContain('night_300');
    expect(state.records.perfectDishes).toBe(1);
  });

  it('菜地、睡觉也记着', () => {
    const state = new GameState(data, 6);
    const rng = new Rng(6);
    for (let i = 0; i < 6; i++) state.workPlot(i, { kind: 'hand' }, rng);
    state.sleep();
    expect(state.records.worms).toBeGreaterThan(0);
    expect(state.records.daysPlayed).toBe(1);
  });

  it('成就和累计记录会存进存档', () => {
    const state = new GameState(data, 7);
    state.recordCatch(rollFish(data.speciesById.get('crucian')!, new Rng(7)));
    checkAchievements(state);
    const loaded = restore(data, JSON.parse(JSON.stringify(serialize(state))));
    expect(loaded.achievements.get('first_fish')).toBe(0);
    expect(loaded.records.fishCaught).toBe(1);
    expect(checkAchievements(loaded)).toEqual([]);
  });

  it('老存档没有成就字段也能读', () => {
    const save = serialize(new GameState(data, 8)) as Record<string, unknown>;
    delete save.records;
    delete save.achievements;
    const loaded = restore(data, save);
    expect(loaded.records.fishCaught).toBe(0);
    expect(loaded.achievements.size).toBe(0);
  });

  it('每一个成就的条件都能算出进度', () => {
    const state = new GameState(data, 9);
    for (const a of data.achievements) {
      const p = progressOf(state, a.condition);
      expect(p.target).toBeGreaterThan(0);
    }
  });
});
