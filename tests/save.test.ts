import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { Rng } from '../src/sim/rng/rng';
import { migrate, restore, serialize } from '../src/sim/save';
import { GameState } from '../src/sim/state';

const data = getGameData();

describe('存档', () => {
  it('存了再读，状态一样', () => {
    const state = new GameState(data, 9);
    const rng = new Rng(9);
    const fish = rollFish(data.speciesById.get('crucian')!, rng);
    state.recordCatch(fish);
    state.keep(fish, 'creek', 'bay');
    state.earn(35);
    state.workPlot(0, { kind: 'hand' }, rng);
    state.clock.addMinutes(125);
    state.baitId = 'dough';
    state.place = 'farm';

    const json = JSON.parse(JSON.stringify(serialize(state)));
    const loaded = restore(data, json);
    expect(serialize(loaded)).toEqual(serialize(state));
    expect(loaded.keepNet[0]!.lookSeed).toBe(fish.lookSeed);
    expect(loaded.journal.get('crucian')!.caught).toBe(1);
  });

  it('读档后新钓的鱼不会和存档里的鱼撞号', () => {
    const state = new GameState(data, 10);
    const fish = { ...rollFish(data.speciesById.get('crucian')!, new Rng(1)), uid: 50_000 };
    state.keep(fish, 'creek', 'bay');
    restore(data, JSON.parse(JSON.stringify(serialize(state))));
    expect(rollFish(data.speciesById.get('crucian')!, new Rng(2)).uid).toBeGreaterThan(50_000);
  });

  it('认不出的版本直接报错，缺字段的老存档补默认值', () => {
    expect(() => migrate({ version: 99 })).toThrow();
    const save = serialize(new GameState(data, 11)) as Record<string, unknown>;
    delete save.today;
    delete save.plots;
    const loaded = restore(data, save);
    expect(loaded.today.caught).toBe(0);
    expect(loaded.plots).toHaveLength(data.farm.plots);
  });
});
