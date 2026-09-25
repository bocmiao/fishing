import { describe, expect, it } from 'vitest';
import { getGameData, seedId } from '../src/sim/data/gameData';
import { actionFor, growthOf, newPlot } from '../src/sim/farm/farm';
import { Inventory } from '../src/sim/inventory';
import { Rng } from '../src/sim/rng/rng';
import { GameState } from '../src/sim/state';

const data = getGameData();
const hand = { kind: 'hand' } as const;
const corn = { kind: 'seed', cropId: 'corn' } as const;

describe('库存', () => {
  it('不够就一个也不拿', () => {
    const inv = new Inventory({ worm: 2, flour: 1 });
    expect(inv.take('worm', 3)).toBe(false);
    expect(inv.count('worm')).toBe(2);
    expect(inv.takeAll({ worm: 1, flour: 2 })).toBe(false);
    expect(inv.count('worm')).toBe(2);
    expect(inv.takeAll({ worm: 2, flour: 1 })).toBe(true);
    expect(inv.entries()).toEqual([]);
  });
});

describe('菜地', () => {
  it('开局有外公留下的饵料、种子和 6 块荒地', () => {
    const state = new GameState(data, 1);
    expect(state.inventory.count('worm')).toBe(20);
    expect(state.inventory.count(seedId('corn'))).toBeGreaterThan(0);
    expect(state.plots).toHaveLength(6);
    expect(state.plots.every((p) => p.stage === 'wild')).toBe(true);
  });

  it('点一块地按状态做下一步', () => {
    const p = newPlot();
    expect(actionFor(p, hand)).toBe('clear');
    p.stage = 'soil';
    expect(actionFor(p, hand)).toBe('till');
    p.stage = 'tilled';
    expect(actionFor(p, hand)).toBeNull();
    expect(actionFor(p, corn)).toBe('sow');
    expect(actionFor(p, { kind: 'compost' })).toBe('fertilize');
    p.stage = 'growing';
    expect(actionFor(p, hand)).toBe('water');
    p.watered = true;
    expect(actionFor(p, hand)).toBeNull();
    p.stage = 'ripe';
    expect(actionFor(p, hand)).toBe('harvest');
  });

  it('开荒、翻地能挖到蚯蚓，花掉游戏时间', () => {
    let worms = 0;
    for (let seed = 0; seed < 40; seed++) {
      const state = new GameState(data, seed);
      state.weather = 'sunny';
      const rng = new Rng(seed);
      const before = state.clock.minute;
      const r1 = state.workPlot(0, hand, rng);
      const r2 = state.workPlot(0, hand, rng);
      expect(r1.action).toBe('clear');
      expect(r2.action).toBe('till');
      expect(state.clock.minute - before).toBe(data.farm.minutes.clear + data.farm.minutes.till);
      worms += r1.worms + r2.worms;
      expect(state.inventory.count('worm')).toBe(20 + r1.worms + r2.worms);
    }
    // 平均每块地能挖到 2 条以上
    expect(worms / 40).toBeGreaterThan(2);
  });

  it('种下、浇水、睡几觉就熟了，收获进库存', () => {
    const state = new GameState(data, 3);
    state.weather = 'sunny';
    const rng = new Rng(3);
    state.workPlot(0, hand, rng);
    state.workPlot(0, hand, rng);
    const seeds = state.inventory.count(seedId('corn'));
    expect(state.workPlot(0, corn, rng).ok).toBe(true);
    expect(state.inventory.count(seedId('corn'))).toBe(seeds - 1);
    const crop = data.cropById.get('corn')!;
    for (let d = 0; d < crop.days; d++) {
      expect(state.plots[0]!.stage).toBe('growing');
      state.weather = 'sunny';
      expect(state.workPlot(0, hand, rng).action).toBe('water');
      state.sleep();
    }
    expect(state.plots[0]!.stage).toBe('ripe');
    expect(growthOf(state.plots[0]!, data.cropById)).toBe(1);
    const cornBefore = state.inventory.count('corn');
    const r = state.workPlot(0, hand, rng);
    expect(r.action).toBe('harvest');
    expect(state.inventory.count('corn') - cornBefore).toBeGreaterThanOrEqual(crop.yield[0]);
    expect(state.plots[0]!.stage).toBe('soil');
  });

  it('没浇水就不长，下雨天自己长', () => {
    const state = new GameState(data, 4);
    const rng = new Rng(4);
    state.weather = 'sunny';
    state.workPlot(0, hand, rng);
    state.workPlot(0, hand, rng);
    state.workPlot(0, { kind: 'seed', cropId: 'scallion' }, rng);
    state.weather = 'sunny';
    state.sleep();
    expect(state.plots[0]!.grown).toBe(0);
    state.weather = 'rain';
    state.sleep();
    expect(state.plots[0]!.grown).toBe(1);
  });

  it('不合季节的种不下去', () => {
    const state = new GameState(data, 5);
    const rng = new Rng(5);
    state.workPlot(0, hand, rng);
    state.workPlot(0, hand, rng);
    // 开局是春天，春天不能种的作物
    const offSeason = data.crops.find((c) => !c.seasons.includes('spring'));
    if (offSeason) {
      state.inventory.add(seedId(offSeason.id), 1);
      expect(state.workPlot(0, { kind: 'seed', cropId: offSeason.id }, rng).ok).toBe(false);
    }
    expect(state.workPlot(0, corn, rng).ok).toBe(true);
  });

  it('加工：小麦磨成面粉，面粉和成面饵', () => {
    const state = new GameState(data, 6);
    state.inventory.add('wheat', 1);
    const dough = state.inventory.count('dough');
    const flour = state.inventory.count('flour');
    expect(state.craft('mill_flour')).toBe(true);
    expect(state.inventory.count('flour')).toBe(flour + 2);
    expect(state.craft('mix_dough')).toBe(true);
    expect(state.inventory.count('dough')).toBe(dough + 6);
    expect(state.craft('mill_flour')).toBe(false);
  });
});
