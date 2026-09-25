import { seedId, type GameData } from './data/gameData';
import type { Weather } from './data/schema';
import { fishPrice, type FishInstance } from './fishing/catchRoll';
import {
  growPlots,
  newPlot,
  workPlot,
  type FarmResult,
  type FarmTool,
  type Plot,
} from './farm/farm';
import { Inventory } from './inventory';
import {
  newRestaurant,
  runHelper,
  type HelperResult,
  type RestaurantState,
} from './restaurant/restaurant';
import { hashString, Rng } from './rng/rng';
import { baseStats, statsWith, upgradeStatus, type UpgradeStats } from './upgrades';
import { GameClock, type Season } from './time/clock';

export const WEATHER_NAMES: Record<Weather, string> = { sunny: '晴', cloudy: '多云', rain: '雨' };

const WEATHER_ODDS: Record<Season, [Weather, number][]> = {
  spring: [
    ['sunny', 0.45],
    ['cloudy', 0.3],
    ['rain', 0.25],
  ],
  summer: [
    ['sunny', 0.55],
    ['cloudy', 0.2],
    ['rain', 0.25],
  ],
  autumn: [
    ['sunny', 0.55],
    ['cloudy', 0.3],
    ['rain', 0.15],
  ],
  winter: [
    ['sunny', 0.5],
    ['cloudy', 0.35],
    ['rain', 0.15],
  ],
};

export function rollWeather(season: Season, rng: Rng): Weather {
  return rng.weighted(WEATHER_ODDS[season], ([, p]) => p)![0];
}

export interface CaughtFish extends FishInstance {
  day: number;
  minute: number;
  spotId: string;
  positionId: string;
}

/** 鱼塘里的一条鱼 */
export interface PondFish {
  /** 编号：钓上来的鱼沿用原来的编号；开局的锦鲤用负数，不会撞号 */
  uid: number;
  /** 野生鱼的品种 id；外公的锦鲤为 null */
  speciesId: string | null;
  /** 锦鲤品种（红白、黄金……）；野生鱼为 null */
  variety: string | null;
  /** 显示的名字：锦鲤有名字，野生鱼就是品种名 */
  name: string;
  weightKg: number;
  lengthCm: number;
  lookSeed: number;
  /** 来历，例如"外公留下的""第 2 天 · 屋后小溪" */
  origin: string;
  note: string;
  /** 放进塘里的那天 */
  day: number;
}

export interface JournalEntry {
  caught: number;
  bestWeightKg: number;
  firstDay: number;
}

/** 今天做了些什么（睡觉时写进一天的小结） */
export interface DayStats {
  caught: number;
  kept: number;
  worms: number;
  harvested: number;
  earned: number;
  spent: number;
  /** 小馆接待了几位客人（自己掌勺的） */
  guests: number;
  /** 小馆的收入（自己掌勺 + 小满代班） */
  restaurantEarned: number;
}

/** 一天结束时给玩家看的小结 */
export interface DaySummary {
  /** 结束的是第几天（从 0 开始） */
  day: number;
  stats: DayStats;
  /** 夜里成熟的作物块数 */
  ripened: number;
  /** 明天的天气 */
  weather: Weather;
  /** 小满代班的结果（这天小馆没自己开门时） */
  helper: HelperResult | null;
  /** 早上蚯蚓床里多出来的蚯蚓 */
  bedWorms: number;
}

/** 买升级的结果 */
export type BuyResult = 'ok' | 'owned' | 'locked' | 'money' | 'unknown';

function emptyStats(): DayStats {
  return {
    caught: 0,
    kept: 0,
    worms: 0,
    harvested: 0,
    earned: 0,
    spent: 0,
    guests: 0,
    restaurantEarned: 0,
  };
}

export interface CatchRecordResult {
  /** 第一次钓到这种鱼（外公笔记新的一页） */
  newSpecies: boolean;
  /** 打破了这种鱼的重量纪录 */
  newRecord: boolean;
}

/**
 * 跨画面共享的游戏状态：时间、天气、钱、库存、鱼护、鱼塘、菜地、外公笔记、当前饵料和渔具。
 * 方案 C 的行走地图也读写同一份状态。存档见 save.ts。
 */
export class GameState {
  readonly clock: GameClock;
  weather: Weather;
  money: number;
  readonly inventory: Inventory;
  /** 菜地的每一块地 */
  readonly plots: Plot[] = [];
  /** 买过的升级 */
  readonly upgrades = new Set<string>();
  /** 升级之后的各项数值（鱼护、鱼塘、菜地、小馆……） */
  stats: UpgradeStats;
  /** 喵记小馆：活鱼缸、菜单、口碑 */
  readonly restaurant: RestaurantState = newRestaurant();
  /** 现在在哪（地点 id，也是画面名） */
  place: string;
  today: DayStats = emptyStats();
  /** 最近一次睡觉的小结（界面显示完就清掉） */
  lastSummary: DaySummary | null = null;
  readonly keepNet: CaughtFish[] = [];
  keepNetCapacity: number;
  /** 自家鱼塘：开局只有外公留下的两条锦鲤，钓到的鱼可以放进来养 */
  readonly pond: PondFish[] = [];
  pondCapacity: number;
  readonly journal = new Map<string, JournalEntry>();
  baitId: string;
  rodId: string;
  lineId: string;
  private rng: Rng;

  constructor(
    readonly data: GameData,
    /** 这一局的种子（存档里也记着） */
    readonly seed: number,
  ) {
    this.rng = new Rng(seed).fork('state');
    this.clock = new GameClock();
    this.weather = rollWeather(this.clock.season, this.rng);
    this.stats = baseStats(data);
    this.keepNetCapacity = this.stats.keepNetCapacity;
    this.pondCapacity = this.stats.pondCapacity;
    data.pond.starters.forEach((k, i) => {
      this.pond.push({
        uid: -(i + 1),
        speciesId: null,
        variety: k.variety,
        name: k.name,
        weightKg: k.weightKg,
        lengthCm: k.lengthCm,
        lookSeed: hashString(`koi:${k.name}`),
        origin: '外公留下的',
        note: k.note,
        day: 0,
      });
    });
    this.baitId = data.items.baits[0]!.id;
    this.rodId = data.items.rods[0]!.id;
    this.lineId = data.items.lines[0]!.id;
    this.money = data.items.startMoney;
    // 外公留下的：一罐蚯蚓、半袋面粉做的面饵、一把玉米，还有一小包种子
    this.inventory = new Inventory();
    for (const b of data.items.baits) this.inventory.add(b.id, b.startCount);
    for (const c of data.crops) this.inventory.add(seedId(c.id), c.startSeeds);
    for (const [id, n] of Object.entries(data.items.startGoods)) this.inventory.add(id, n);
    for (let i = 0; i < data.farm.plots; i++) this.plots.push(newPlot());
    this.place = data.homePlace;
  }

  // ---------------------------------------------------------------- 升级

  /** 按买过的升级重新算各项数值：鱼护、鱼塘容量、鱼竿鱼线、菜地块数…… */
  applyUpgrades(): void {
    this.stats = statsWith(this.data, this.upgrades);
    this.keepNetCapacity = this.stats.keepNetCapacity;
    this.pondCapacity = this.stats.pondCapacity;
    this.rodId = this.stats.rodId;
    this.lineId = this.stats.lineId;
    // 新开的地是荒地，要自己开荒（开荒也能挖到蚯蚓）
    while (this.plots.length < this.stats.plots) this.plots.push(newPlot());
  }

  buyUpgrade(id: string): BuyResult {
    const upgrade = this.data.upgradeById.get(id);
    if (!upgrade) return 'unknown';
    const status = upgradeStatus(upgrade, this.upgrades);
    if (status !== 'available') return status;
    if (!this.spend(upgrade.price)) return 'money';
    this.upgrades.add(id);
    this.applyUpgrades();
    return 'ok';
  }

  /** 天气相关的随机数（存档后重新读档时按天数重新派生，不需要存状态） */
  reseed(seed: number): void {
    this.rng = new Rng(seed).fork(`state:${this.clock.day}`);
  }

  itemName(id: string): string {
    return this.data.itemNames.get(id) ?? id;
  }

  /** 当前饵料还剩几份 */
  get baitLeft(): number {
    return this.inventory.count(this.baitId);
  }

  /** 饵被鱼叼走、被偷吃，或者鱼上钩了：用掉一份 */
  useBait(): void {
    this.inventory.take(this.baitId);
  }

  earn(amount: number): void {
    this.money += amount;
    this.today.earned += amount;
  }

  /** 花钱；不够就不花，返回 false */
  spend(amount: number): boolean {
    if (this.money < amount) return false;
    this.money -= amount;
    this.today.spent += amount;
    return true;
  }

  /** 在菜地的第 i 块地上干一次活，花掉相应的游戏时间 */
  workPlot(i: number, tool: FarmTool, rng: Rng): FarmResult {
    const plot = this.plots[i];
    if (!plot) throw new Error(`没有第 ${i} 块地`);
    const result = workPlot(plot, tool, {
      crops: this.data.cropById,
      config: this.data.farm,
      inventory: this.inventory,
      rng,
      season: this.clock.season,
      raining: this.weather === 'rain',
    });
    if (result.ok) {
      this.clock.addMinutes(result.minutes);
      this.today.worms += result.worms;
      if (result.harvest) this.today.harvested += result.harvest.count;
    }
    return result;
  }

  /** 在家里加工（磨面、和面饵、点豆腐）；材料不够返回 false */
  craft(craftId: string): boolean {
    const craft = this.data.crafts.find((c) => c.id === craftId);
    if (!craft || !this.inventory.takeAll(craft.inputs)) return false;
    for (const [id, n] of Object.entries(craft.outputs)) this.inventory.add(id, n);
    this.clock.addMinutes(craft.minutes);
    return true;
  }

  get rod() {
    return this.data.items.rods.find((r) => r.id === this.rodId)!;
  }

  get line() {
    return this.data.items.lines.find((l) => l.id === this.lineId)!;
  }

  get keepNetFull(): boolean {
    return this.keepNet.length >= this.keepNetCapacity;
  }

  /** 记下一次上鱼（不管放生还是留下，笔记都会记） */
  recordCatch(fish: FishInstance): CatchRecordResult {
    this.today.caught++;
    const prev = this.journal.get(fish.speciesId);
    if (!prev) {
      this.journal.set(fish.speciesId, {
        caught: 1,
        bestWeightKg: fish.weightKg,
        firstDay: this.clock.day,
      });
      return { newSpecies: true, newRecord: true };
    }
    prev.caught++;
    const newRecord = fish.weightKg > prev.bestWeightKg;
    if (newRecord) prev.bestWeightKg = fish.weightKg;
    return { newSpecies: false, newRecord };
  }

  /** 放进鱼护；满了返回 false */
  keep(fish: FishInstance, spotId: string, positionId: string): boolean {
    if (this.keepNetFull) return false;
    this.today.kept++;
    this.keepNet.push({
      ...fish,
      day: this.clock.day,
      minute: this.clock.minute,
      spotId,
      positionId,
    });
    return true;
  }

  get pondFull(): boolean {
    return this.pond.length >= this.pondCapacity;
  }

  /** 把鱼护里的一条鱼放进自家鱼塘；塘满了或找不到这条鱼返回 null */
  releaseToPond(uid: number): PondFish | null {
    if (this.pondFull) return null;
    const i = this.keepNet.findIndex((f) => f.uid === uid);
    if (i < 0) return null;
    const [f] = this.keepNet.splice(i, 1) as [CaughtFish];
    const species = this.data.speciesById.get(f.speciesId);
    const spotName = this.data.spotById.get(f.spotId)?.name ?? '';
    const fish: PondFish = {
      uid: f.uid,
      speciesId: f.speciesId,
      variety: null,
      name: species?.name ?? f.speciesId,
      weightKg: f.weightKg,
      lengthCm: f.lengthCm,
      lookSeed: f.lookSeed,
      origin: `第 ${f.day + 1} 天 · ${spotName}`,
      note: species?.note ?? '',
      day: this.clock.day,
    };
    this.pond.push(fish);
    return fish;
  }

  /** 把鱼护里的一条鱼放生 */
  releaseToWild(uid: number): boolean {
    const i = this.keepNet.findIndex((f) => f.uid === uid);
    if (i < 0) return false;
    this.keepNet.splice(i, 1);
    return true;
  }

  // ---------------------------------------------------------------- 小馆

  /** 鱼护里的鱼放进小馆的活鱼缸；缸满了返回 false */
  toTank(uid: number): boolean {
    const r = this.restaurant;
    if (r.tank.length >= this.stats.tankCapacity) return false;
    const i = this.keepNet.findIndex((f) => f.uid === uid);
    if (i < 0) return false;
    r.tank.push(...this.keepNet.splice(i, 1));
    return true;
  }

  /** 卖给周叔（鱼护里或者缸里的鱼），返回卖了多少钱；找不到这条鱼返回 0 */
  sellFish(uid: number): number {
    for (const list of [this.keepNet, this.restaurant.tank]) {
      const i = list.findIndex((f) => f.uid === uid);
      if (i < 0) continue;
      const [fish] = list.splice(i, 1) as [CaughtFish];
      const species = this.data.speciesById.get(fish.speciesId);
      const price = species ? fishPrice(species, fish) : 0;
      this.earn(price);
      return price;
    }
    return 0;
  }

  /** 在阿婆的杂货铺买东西（饵料、种子）；钱不够返回 false */
  buy(itemId: string, count = 1): boolean {
    const price = this.data.itemPrices.get(itemId);
    if (price === undefined || count <= 0 || !this.spend(price * count)) return false;
    this.inventory.add(itemId, count);
    return true;
  }

  setMenu(recipeIds: string[]): void {
    const ids = recipeIds.filter(
      (id, i) => this.data.recipeById.has(id) && recipeIds.indexOf(id) === i,
    );
    this.restaurant.menu = ids.slice(0, this.stats.menuSize);
  }

  /** 今天小馆营业过没有（自己开门或小满代班） */
  get servedToday(): boolean {
    return this.restaurant.servedDay === this.clock.day;
  }

  /**
   * 过了打烊时间、今天还没营业过：小满代班（开着代班、定了菜单才会）。
   * 返回代班的结果；不需要代班返回 null。
   */
  runHelperIfDue(rng: Rng, force = false): HelperResult | null {
    const r = this.restaurant;
    if (this.servedToday) return null;
    if (!force && this.clock.minute < this.data.restaurant.closeMinute) return null;
    r.servedDay = this.clock.day;
    if (!r.helper || r.menu.length === 0) return null;
    const result = runHelper(r, { inventory: this.inventory, tank: r.tank }, this.data, rng);
    this.earn(result.earned);
    this.today.restaurantEarned += result.earned;
    return result;
  }

  /** 睡觉：夜里作物生长，进入新的一天，重新掷天气，回到家里。返回这一天的小结 */
  sleep(): DaySummary {
    const day = this.clock.day;
    // 早早睡了、小馆还没营业：小满照样去开门
    const helper = this.runHelperIfDue(this.rng, true);
    const rained = this.weather === 'rain';
    const bedWorms = this.stats.dailyWorms;
    this.inventory.add('worm', bedWorms);
    const ripened = growPlots(
      this.plots,
      { crops: this.data.cropById, config: this.data.farm },
      rained,
    );
    this.clock.sleep();
    this.weather = rollWeather(this.clock.season, this.rng);
    this.place = this.data.homePlace;
    const summary: DaySummary = {
      bedWorms,
      day,
      stats: this.today,
      ripened,
      weather: this.weather,
      helper,
    };
    this.today = emptyStats();
    this.lastSummary = summary;
    return summary;
  }

  cycleWeather(): void {
    const order: Weather[] = ['sunny', 'cloudy', 'rain'];
    this.weather = order[(order.indexOf(this.weather) + 1) % order.length]!;
  }
}
