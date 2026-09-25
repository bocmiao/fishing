import type { GameData } from './data/gameData';
import type { Weather } from './data/schema';
import type { FishInstance } from './fishing/catchRoll';
import { hashString, Rng } from './rng/rng';
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

export interface CatchRecordResult {
  /** 第一次钓到这种鱼（外公笔记新的一页） */
  newSpecies: boolean;
  /** 打破了这种鱼的重量纪录 */
  newRecord: boolean;
}

/**
 * 跨画面共享的游戏状态：时间、天气、鱼护、外公笔记的记录、当前饵料和渔具。
 * 方案 C 的行走地图也读写同一份状态。
 */
export class GameState {
  readonly clock: GameClock;
  weather: Weather;
  money = 0;
  readonly keepNet: CaughtFish[] = [];
  keepNetCapacity: number;
  /** 自家鱼塘：开局只有外公留下的两条锦鲤，钓到的鱼可以放进来养 */
  readonly pond: PondFish[] = [];
  pondCapacity: number;
  readonly journal = new Map<string, JournalEntry>();
  baitId: string;
  rodId: string;
  lineId: string;
  private readonly rng: Rng;

  constructor(
    readonly data: GameData,
    seed: number,
  ) {
    this.rng = new Rng(seed).fork('state');
    this.clock = new GameClock();
    this.weather = rollWeather(this.clock.season, this.rng);
    this.keepNetCapacity = data.items.keepNetCapacity;
    this.pondCapacity = data.pond.capacity;
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

  /** 睡觉：进入新的一天，重新掷天气 */
  sleep(): void {
    this.clock.sleep();
    this.weather = rollWeather(this.clock.season, this.rng);
  }

  cycleWeather(): void {
    const order: Weather[] = ['sunny', 'cloudy', 'rain'];
    this.weather = order[(order.indexOf(this.weather) + 1) % order.length]!;
  }
}
