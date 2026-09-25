/**
 * 小馆营业数值报告（调参工具）：npm run balance
 * 按几种备货和"厨师"（做一道菜要几分钟、做得多好）跑一晚上，看接待几位、赚多少、几位等不及走了。
 */
import { it } from 'vitest';
import { getGameData } from '../../src/sim/data/gameData';
import { rollFish } from '../../src/sim/fishing/catchRoll';
import { Service } from '../../src/sim/restaurant/service';
import { Rng } from '../../src/sim/rng/rng';
import { GameState } from '../../src/sim/state';

const data = getGameData();

function evening(
  seed: number,
  fishCount: number,
  cookMinutes: number,
  quality: number,
  rep: number,
) {
  const state = new GameState(data, seed);
  const rng = new Rng(seed);
  const species = ['crucian', 'crucian', 'hooksnout', 'stone_moroko', 'stone_moroko', 'loach'];
  for (let i = 0; i < fishCount; i++) {
    const f = rollFish(data.speciesById.get(species[i % species.length]!)!, rng);
    state.keep(f, 'creek', 'bay');
    state.toTank(f.uid);
  }
  state.inventory.add('scallion', 6);
  state.inventory.add('flour', 3);
  state.restaurant.reputation = rep;
  state.setMenu(['braised_crucian', 'steamed_hooksnout', 'fish_noodles', 'corn_cake']);
  const service = new Service(
    data,
    state.restaurant,
    { inventory: state.inventory, tank: state.restaurant.tank },
    rng,
    (n) => state.earn(n),
  );
  let arrived = 0;
  let impatient = 0;
  let cookingFor = -1;
  let until = 0;
  for (let m = data.restaurant.openMinute; m <= data.restaurant.closeMinute; m++) {
    for (const e of service.tick(m)) {
      if (e.type === 'arrive') arrived++;
      if (e.type === 'impatient') impatient++;
    }
    if (cookingFor >= 0 && m >= until) {
      service.serve(cookingFor, quality);
      cookingFor = -1;
    }
    if (cookingFor < 0) {
      const g = service.guests.find((x) => x.state === 'waiting' && !x.cooking);
      if (g && service.startCooking(g.id)) {
        cookingFor = g.id;
        until = m + cookMinutes;
      }
    }
  }
  return {
    arrived,
    served: service.served,
    earned: service.earned,
    impatient,
    soldOut: service.soldOut,
  };
}

it('restaurant report', () => {
  const rows: string[] = [];
  for (const [fish, cook, q, rep] of [
    [4, 8, 0.8, 0],
    [8, 8, 0.8, 0],
    [8, 12, 0.6, 0],
    [8, 8, 0.8, 20],
    [12, 8, 0.9, 40],
  ] as const) {
    const res = Array.from({ length: 30 }, (_, i) => evening(500 + i, fish, cook, q, rep));
    const avg = (k: 'arrived' | 'served' | 'earned' | 'impatient') =>
      (res.reduce((s, r) => s + r[k], 0) / res.length).toFixed(1);
    const sold = res.filter((r) => r.soldOut).length;
    rows.push(
      `鱼 ${String(fish).padStart(2)} 条  做一道 ${cook} 分钟  成绩 ${q}  口碑 ${String(rep).padStart(2)}  →  来了 ${avg('arrived')} 位，接待 ${avg('served')}，收入 ¥${avg('earned')}，等不及 ${avg('impatient')}，卖完 ${sold}/30 晚`,
    );
  }
  process.stdout.write('\n' + rows.join('\n') + '\n');
});
