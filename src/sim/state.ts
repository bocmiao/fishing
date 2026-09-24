import type { GameData } from './data/gameData';
import type { Weather } from './data/schema';
import type { FishInstance } from './fishing/catchRoll';
import { Rng } from './rng/rng';
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
