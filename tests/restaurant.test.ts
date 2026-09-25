import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { CookingGame } from '../src/sim/restaurant/cooking';
import { canCook, dishPrice, emptyReserved, pickFish } from '../src/sim/restaurant/kitchen';
import { Service, type ServiceEvent } from '../src/sim/restaurant/service';
import { Rng } from '../src/sim/rng/rng';
import { restore, serialize } from '../src/sim/save';
import { GameState } from '../src/sim/state';

const data = getGameData();
const recipe = (id: string) => data.recipeById.get(id)!;

/** 往缸里放几条鱼 */
function stock(state: GameState, speciesId: string, n: number, rng: Rng): void {
  const sp = data.speciesById.get(speciesId)!;
  for (let i = 0; i < n; i++) {
    const f = rollFish(sp, rng);
    state.keep(f, 'creek', 'bay');
    state.toTank(f.uid);
  }
}

/** 跑一晚上：bot 为 true 时有个机器人厨师，客人一点菜就做（每道做 8 分钟） */
function runEvening(state: GameState, seed: number, bot: boolean, quality = 0.8) {
  const rng = new Rng(seed);
  const service = new Service(
    data,
    state.restaurant,
    { inventory: state.inventory, tank: state.restaurant.tank },
    rng,
    (n) => state.earn(n),
  );
  const events: ServiceEvent[] = [];
  let cookingUntil = -1;
  let cookingFor = -1;
  for (let m = data.restaurant.openMinute; m <= data.restaurant.closeMinute + 5; m++) {
    events.push(...service.tick(m));
    if (!bot) continue;
    if (cookingFor >= 0 && m >= cookingUntil) {
      service.serve(cookingFor, quality);
      cookingFor = -1;
    }
    if (cookingFor < 0) {
      const waiting = service.guests.find((g) => g.state === 'waiting' && !g.cooking);
      if (waiting && service.startCooking(waiting.id)) {
        cookingFor = waiting.id;
        cookingUntil = m + 8;
      }
    }
  }
  return { service, events };
}

describe('后厨', () => {
  it('材料齐了才能做，缸里挑鱼', () => {
    const state = new GameState(data, 1);
    const rng = new Rng(1);
    const pantry = { inventory: state.inventory, tank: state.restaurant.tank };
    expect(canCook(recipe('braised_crucian'), pantry)).toBe(false);
    stock(state, 'crucian', 2, rng);
    expect(canCook(recipe('braised_crucian'), pantry)).toBe(false);
    state.inventory.add('scallion', 1);
    expect(canCook(recipe('braised_crucian'), pantry)).toBe(true);
    expect(pickFish(recipe('fried_minnows'), pantry.tank, emptyReserved())).toBeNull();
    // 鱼汤面什么鱼都行，挑小的
    const any = pickFish(recipe('fish_noodles'), pantry.tank, emptyReserved())!;
    expect(any[0]!.weightKg).toBe(Math.min(...pantry.tank.map((f) => f.weightKg)));
  });

  it('做得越好越贵', () => {
    const r = recipe('corn_cake');
    expect(dishPrice(r, [], 1)).toBeGreaterThan(dishPrice(r, [], 0.5));
  });
});

describe('做菜小游戏', () => {
  it('按在好区正中是满分，偏了也有保底分', () => {
    const game = new CookingGame(data.restaurant.cooking.steps, new Rng(3));
    game.pointer = game.zoneCenter;
    expect(game.hit()).toBe(1);
    game.pointer = game.zoneCenter > 0.5 ? 0 : 1;
    expect(game.hit()).toBe(0.25);
    game.pointer = game.zoneCenter;
    game.hit();
    expect(game.done).toBe(true);
    expect(game.quality).toBeCloseTo(0.75);
  });

  it('指针来回走，不会跑出条外', () => {
    const game = new CookingGame(data.restaurant.cooking.steps, new Rng(4));
    for (let i = 0; i < 600; i++) {
      game.update(1 / 60);
      expect(game.pointer).toBeGreaterThanOrEqual(0);
      expect(game.pointer).toBeLessThanOrEqual(1);
    }
  });
});

describe('营业', () => {
  function stocked(seed: number): GameState {
    const state = new GameState(data, seed);
    const rng = new Rng(seed);
    stock(state, 'crucian', 5, rng);
    stock(state, 'stone_moroko', 6, rng);
    state.inventory.add('scallion', 6);
    state.inventory.add('flour', 3);
    state.setMenu(['braised_crucian', 'fried_minnows', 'fish_noodles', 'corn_cake']);
    return state;
  }

  it('有人掌勺：客人吃完付钱，口碑上涨，打烊时收尾', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = stocked(seed);
      const money = state.money;
      const { service, events } = runEvening(state, seed, true);
      expect(service.served).toBeGreaterThan(3);
      expect(state.money - money).toBe(service.earned);
      expect(state.restaurant.reputation).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'closed')).toBe(true);
      expect(service.open).toBe(false);
      // 吃素的客人不会点鱼
      for (const e of events) {
        if (e.type === 'order' && e.guest.kind.vegetarian) expect(e.guest.recipe!.fish).toBeNull();
      }
      expect(state.inventory.entries().every(([, n]) => n > 0)).toBe(true);
    }
  });

  it('没人做菜：客人等不及就走，不扣钱，预留的鱼都还在缸里', () => {
    const state = stocked(20);
    const tank = state.restaurant.tank.length;
    const { service, events } = runEvening(state, 20, false);
    expect(service.served).toBe(0);
    expect(events.some((e) => e.type === 'impatient')).toBe(true);
    expect(state.restaurant.tank.length).toBe(tank);
  });

  it('菜卖完了就不再进客人', () => {
    const state = new GameState(data, 21);
    state.inventory.add('corn', 6);
    state.inventory.take('corn', state.inventory.count('corn') - 6);
    state.setMenu(['corn_cake']);
    const { service } = runEvening(state, 21, true);
    expect(service.served).toBeLessThanOrEqual(2);
    expect(service.soldOut).toBe(true);
  });
});

describe('小满代班', () => {
  it('过了打烊没开门，小满按菜单卖几道，收入打折，一天只代一次', () => {
    const state = new GameState(data, 30);
    const rng = new Rng(30);
    stock(state, 'crucian', 4, rng);
    state.inventory.add('scallion', 4);
    state.setMenu(['braised_crucian']);
    expect(state.runHelperIfDue(rng)).toBeNull();
    state.clock.addMinutes(data.restaurant.closeMinute - state.clock.minute);
    const result = state.runHelperIfDue(rng)!;
    expect(result.dishes.length).toBeGreaterThan(0);
    expect(result.earned).toBeGreaterThan(0);
    expect(result.earned).toBeLessThan(
      result.dishes.length * recipe('braised_crucian').price * 1.25,
    );
    expect(state.runHelperIfDue(rng)).toBeNull();
  });

  it('早早睡了，小满也会去开门', () => {
    const state = new GameState(data, 31);
    state.inventory.add('corn', 9);
    state.setMenu(['corn_cake']);
    const summary = state.sleep();
    expect(summary.helper?.dishes.length).toBeGreaterThan(0);
  });
});

describe('鱼摊和杂货铺', () => {
  it('卖鱼进账，买东西花钱，钱不够买不了', () => {
    const state = new GameState(data, 40);
    const f = rollFish(data.speciesById.get('crucian')!, new Rng(40));
    state.keep(f, 'creek', 'bay');
    const money = state.money;
    const price = state.sellFish(f.uid);
    expect(price).toBeGreaterThan(0);
    expect(state.money).toBe(money + price);
    expect(state.buy('worm', 5)).toBe(true);
    expect(state.buy('seed:corn', 10_000)).toBe(false);
  });

  it('小馆的状态会存进存档', () => {
    const state = new GameState(data, 41);
    stock(state, 'crucian', 2, new Rng(41));
    state.setMenu(['braised_crucian', 'corn_cake']);
    state.restaurant.reputation = 7.5;
    const loaded = restore(data, JSON.parse(JSON.stringify(serialize(state))));
    expect(loaded.restaurant.tank).toHaveLength(2);
    expect(loaded.restaurant.menu).toEqual(['braised_crucian', 'corn_cake']);
    expect(loaded.restaurant.reputation).toBe(7.5);
  });
});

describe('卖完了又有了', () => {
  it('客人等不及走掉、还回预留的材料后，又能接着进客人', () => {
    const state = new GameState(data, 50);
    state.inventory.take('corn', state.inventory.count('corn'));
    state.inventory.add('corn', 6);
    state.setMenu(['corn_cake']);
    // 没人做菜：两位客人点完就把玉米预留光了，等不及走了以后又能进新客人
    const { events } = runEvening(state, 50, false);
    const orders = events.filter((e) => e.type === 'order').length;
    expect(orders).toBeGreaterThan(2);
  });
});
