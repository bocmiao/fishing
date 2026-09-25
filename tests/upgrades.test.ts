import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import { Rng } from '../src/sim/rng/rng';
import { restore, serialize } from '../src/sim/save';
import { GameState } from '../src/sim/state';
import { describeEffect } from '../src/sim/upgrades';

const data = getGameData();

function rich(seed: number): GameState {
  const state = new GameState(data, seed);
  state.money = 100_000;
  return state;
}

describe('升级', () => {
  it('钱不够买不了，买了扣钱', () => {
    const state = new GameState(data, 1);
    expect(state.buyUpgrade('rod_carbon')).toBe('money');
    state.money = 1000;
    expect(state.buyUpgrade('rod_carbon')).toBe('ok');
    expect(state.money).toBe(1000 - data.upgradeById.get('rod_carbon')!.price);
    expect(state.buyUpgrade('rod_carbon')).toBe('owned');
  });

  it('要先买前一级', () => {
    const state = rich(2);
    expect(state.buyUpgrade('keepnet_2')).toBe('locked');
    expect(state.buyUpgrade('keepnet_1')).toBe('ok');
    expect(state.keepNetCapacity).toBe(12);
    expect(state.buyUpgrade('keepnet_2')).toBe('ok');
    expect(state.keepNetCapacity).toBe(16);
  });

  it('换鱼竿、鱼线，扩鱼塘，开新地', () => {
    const state = rich(3);
    state.buyUpgrade('rod_carbon');
    state.buyUpgrade('line_tough');
    state.buyUpgrade('pond_1');
    state.buyUpgrade('farm_1');
    expect(state.rod.id).toBe('carbon');
    expect(state.line.strength).toBeGreaterThan(1);
    expect(state.pondCapacity).toBe(18);
    expect(state.plots).toHaveLength(9);
    expect(state.plots[8]!.stage).toBe('wild');
  });

  it('蚯蚓床每天早上给蚯蚓', () => {
    const state = rich(4);
    state.buyUpgrade('worm_bed');
    const worms = state.inventory.count('worm');
    const summary = state.sleep();
    expect(summary.bedWorms).toBe(6);
    expect(state.inventory.count('worm')).toBe(worms + 6);
  });

  it('小馆：大鱼缸、大菜牌', () => {
    const state = rich(5);
    state.buyUpgrade('menu_1');
    state.setMenu(data.recipes.map((r) => r.id));
    expect(state.restaurant.menu).toHaveLength(6);
    state.buyUpgrade('tank_1');
    expect(state.stats.tankCapacity).toBe(16);
  });

  it('买过的升级会存进存档，读档后数值一样', () => {
    const state = rich(6);
    for (const id of ['keepnet_1', 'farm_1', 'farm_2', 'rod_carbon', 'tables_1'])
      state.buyUpgrade(id);
    state.workPlot(10, { kind: 'hand' }, new Rng(1));
    const loaded = restore(data, JSON.parse(JSON.stringify(serialize(state))));
    expect([...loaded.upgrades].sort()).toEqual([...state.upgrades].sort());
    expect(loaded.plots).toHaveLength(12);
    expect(loaded.plots[10]!.stage).toBe(state.plots[10]!.stage);
    expect(loaded.stats).toEqual(state.stats);
    expect(loaded.rod.id).toBe('carbon');
  });

  it('每一项升级都有一句效果说明', () => {
    const state = new GameState(data, 7);
    for (const u of data.upgrades) expect(describeEffect(data, state.stats, u)).not.toBe('');
  });
});
