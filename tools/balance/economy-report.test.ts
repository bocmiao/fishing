/**
 * 经济节奏报告（调参工具）：npm run balance
 * 模拟一个"普通玩家"过一年（56 天）：每天钓鱼、种地、傍晚开店、有钱就按顺序添置升级，
 * 打印每天赚多少、什么时候买得起哪一项。数值都是估计，用来看节奏快慢，不是精确预测。
 */
import { it } from 'vitest';
import { getGameData, seedId } from '../../src/sim/data/gameData';
import type { Recipe } from '../../src/sim/data/schema';
import { rollFish } from '../../src/sim/fishing/catchRoll';
import { emptyReserved, reserve } from '../../src/sim/restaurant/kitchen';
import { Service } from '../../src/sim/restaurant/service';
import { Rng } from '../../src/sim/rng/rng';
import { GameState } from '../../src/sim/state';

const data = getGameData();

/** 小溪里大概的上鱼比例 */
const CATCH_MIX: [string, number][] = [
  ['crucian', 0.35],
  ['sharpbelly', 0.18],
  ['stone_moroko', 0.2],
  ['hooksnout', 0.12],
  ['loach', 0.09],
  ['swamp_eel', 0.06],
];

/** 修了路以后去荷花湖钓（锦鲤放进方塘，不算收入） */
const LAKE_MIX: [string, number][] = [
  ['common_carp', 0.28],
  ['grass_carp', 0.24],
  ['bream', 0.26],
  ['snakehead', 0.1],
  ['culter', 0.1],
  ['released_koi', 0.02],
];

/** 普通玩家添置的先后顺序 */
const WISHLIST = [
  'keepnet_1',
  'tank_1',
  'menu_1',
  'line_tough',
  'farm_1',
  'worm_bed',
  'rod_carbon',
  'tables_1',
  'pond_1',
  'sign_1',
  'stove_1',
  'road_lake',
  'keepnet_2',
  'farm_2',
  'line_big',
  'pond_2',
  'rod_han',
];

const CROP_CYCLE = ['scallion', 'corn', 'wheat', 'soybean', 'greens'];

function fishPerDay(state: GameState): number {
  const bonus = state.rod.id === 'han_handmade' ? 4 : state.rod.id === 'carbon' ? 2 : 0;
  return Math.min(state.keepNetCapacity, 8 + bonus);
}

function tendFarm(state: GameState, rng: Rng, day: number): void {
  const hand = { kind: 'hand' } as const;
  state.plots.forEach((plot, i) => {
    if (plot.stage === 'tilled') {
      const cropId = CROP_CYCLE[(i + day) % CROP_CYCLE.length]!;
      const crop = data.cropById.get(cropId)!;
      if (!crop.seasons.includes(state.clock.season)) return;
      if (state.inventory.count(seedId(cropId)) === 0) state.buy(seedId(cropId), 1);
      state.workPlot(i, { kind: 'seed', cropId }, rng);
      state.workPlot(i, hand, rng);
    } else if (plot.stage === 'growing' && state.inventory.count('compost') > 0 && !plot.compost) {
      state.workPlot(i, { kind: 'compost' }, rng);
    } else {
      state.workPlot(i, hand, rng);
    }
  });
  while (state.inventory.count('soybean') >= 2) state.craft('make_tofu');
  while (state.inventory.count('wheat') >= 1) state.craft('mill_flour');
}

/** 开店前去阿婆那里补配料：缸里要红烧、清蒸的鱼有几条就备几根葱，面粉留两份 */
function restock(state: GameState): void {
  const needScallion = state.restaurant.tank.filter((f) =>
    ['crucian', 'hooksnout', 'swamp_eel', 'common_carp', 'bream', 'culter'].includes(f.speciesId),
  ).length;
  const short = needScallion - state.inventory.count('scallion');
  if (short > 0) state.buy('scallion', short);
  const flour = 2 - state.inventory.count('flour');
  if (flour > 0) state.buy('flour', flour);
  // 酸菜鱼要青菜，黑鱼片汤要豆腐
  const grass = state.restaurant.tank.filter((f) => f.speciesId === 'grass_carp').length;
  const greens = grass * 2 - state.inventory.count('greens');
  if (greens > 0) state.buy('greens', greens);
  const snake = state.restaurant.tank.filter((f) => f.speciesId === 'snakehead').length;
  const tofu = snake - state.inventory.count('tofu');
  if (tofu > 0) state.buy('tofu', tofu);
}

/** 按现在的材料挑最赚钱的几道菜 */
function pickMenu(state: GameState): string[] {
  const pantry = { inventory: state.inventory, tank: state.restaurant.tank };
  const value = (r: Recipe) => {
    const reserved = emptyReserved();
    let n = 0;
    while (n < 20 && reserve(r, pantry, reserved)) n++;
    return n * r.price;
  };
  return [...data.recipes]
    .sort((a, b) => value(b) - value(a))
    .filter((r) => value(r) > 0)
    .slice(0, state.stats.menuSize)
    .map((r) => r.id);
}

function evening(state: GameState, rng: Rng): number {
  const before = state.money;
  const service = new Service(
    data,
    state.restaurant,
    { inventory: state.inventory, tank: state.restaurant.tank },
    rng,
    (n) => state.earn(n),
    { tables: state.stats.tables, reputationBonus: state.stats.reputationBonus },
  );
  state.restaurant.servedDay = state.clock.day;
  // 做一道菜大约 8 分钟（游戏时间），成绩 0.75，有新灶台好一点
  const quality = Math.min(1, 0.75 * (state.stats.cookingEase > 1 ? 1.12 : 1));
  let cooking = -1;
  let until = 0;
  for (let m = data.restaurant.openMinute; m <= data.restaurant.closeMinute; m++) {
    service.tick(m);
    if (cooking >= 0 && m >= until) {
      service.serve(cooking, quality);
      cooking = -1;
    }
    if (cooking < 0) {
      const g = service.guests.find((x) => x.state === 'waiting' && !x.cooking);
      if (g && service.startCooking(g.id)) {
        cooking = g.id;
        until = m + 8;
      }
    }
  }
  return state.money - before;
}

function simulate(seed: number, days: number) {
  const state = new GameState(data, seed);
  const rng = new Rng(seed);
  const bought = new Map<string, number>();
  const income: number[] = [];
  for (let day = 0; day < days; day++) {
    const start = state.money;
    // 钓鱼：每条鱼用掉一份饵，不够就去杂货铺买蚯蚓
    for (let i = 0; i < fishPerDay(state); i++) {
      if (state.inventory.count('worm') === 0) state.buy('worm', 5);
      state.baitId = 'worm';
      state.useBait();
      const mix = state.placeOpen('lake') ? LAKE_MIX : CATCH_MIX;
      const [speciesId] = rng.weighted(mix, ([, w]) => w)!;
      const fish = rollFish(data.speciesById.get(speciesId)!, rng);
      state.recordCatch(fish);
      state.keep(fish, 'creek', 'bay');
    }
    tendFarm(state, rng, day);
    // 鱼护里的鱼进缸，放不下的卖给周叔；锦鲤放进方塘
    for (const f of [...state.keepNet]) {
      if (state.isKoi(f.speciesId)) state.releaseToPond(f.uid) ?? state.releaseToWild(f.uid);
      else if (!state.toTank(f.uid)) state.sellFish(f.uid);
    }
    restock(state);
    state.setMenu(pickMenu(state));
    evening(state, rng);
    // 缸里剩下的小鱼（凑不够一道菜）卖掉，缸留给明天
    if (state.restaurant.tank.length > state.stats.tankCapacity - 2) {
      state.sellFish(state.restaurant.tank[0]!.uid);
    }
    income.push(state.money - start);
    // 按顺序添置：买得起下一项就买，买不起就攒着（不跳过去买便宜的）
    for (const id of WISHLIST) {
      if (state.upgrades.has(id)) continue;
      const u = data.upgradeById.get(id)!;
      if (state.money - u.price < 60 || state.buyUpgrade(id) !== 'ok') break;
      bought.set(id, day + 1);
    }
    state.sleep();
  }
  return { bought, income, reputation: state.restaurant.reputation, money: state.money };
}

it('economy report', () => {
  const runs = Array.from({ length: 12 }, (_, i) => simulate(700 + i, 56));
  const lines: string[] = ['', '—— 每天收入（12 局平均）——'];
  for (const d of [1, 3, 5, 7, 10, 14, 21, 28, 35, 42, 49, 56]) {
    const avg = runs.reduce((s, r) => s + r.income[d - 1]!, 0) / runs.length;
    lines.push(`第 ${String(d).padStart(2)} 天  ¥${avg.toFixed(0)}`);
  }
  lines.push('—— 平均第几天买得起（一年 56 天，买不起的记作 >56）——');
  for (const id of WISHLIST) {
    const days = runs.map((r) => r.bought.get(id) ?? 99).sort((a, b) => a - b);
    const med = days[Math.floor(days.length / 2)]!;
    const u = data.upgradeById.get(id)!;
    lines.push(
      `${u.name.padEnd(8, '　')} ¥${String(u.price).padStart(4)}  第 ${med > 56 ? '>56' : String(med).padStart(2)} 天`,
    );
  }
  const rep = runs.reduce((s, r) => s + r.reputation, 0) / runs.length;
  lines.push(`一年后口碑平均 ${rep.toFixed(0)}`);
  process.stdout.write(lines.join('\n') + '\n');
});
