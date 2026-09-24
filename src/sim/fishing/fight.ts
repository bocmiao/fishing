import type { Rng } from '../rng/rng';
import type { FightStyle, FishSpecies } from '../data/schema';
import type { FishInstance } from './catchRoll';

/**
 * 遛鱼：张力小游戏的规则。纯逻辑，按固定时间步推进，方便测试和调参。
 *
 * 玩家按住收线，张力朝"收线目标"上升；松开放线，张力朝"放线目标"下降。
 * 两个目标都随鱼的拉力变化：鱼猛冲时，一直收线张力就会冲进红区。
 * 张力保持在安全区间里，鱼的体力持续下降；鱼乏了就能拉到岸边。
 */

export interface FightParams {
  /** 收线时张力上升的速度（每秒） */
  riseRate: number;
  /** 鱼的拉力让张力额外上升的速度（每秒，按拉力 1 计）：猛冲时张力会窜得很快 */
  pullRiseRate: number;
  /** 放线时张力下降的速度（每秒） */
  fallRate: number;
  /** 收线时张力的基础目标 */
  reelBase: number;
  /** 收线时鱼的拉力对张力目标的影响 */
  reelPullGain: number;
  /** 放线时鱼的拉力对张力目标的影响 */
  slackPullGain: number;
  /** 安全区间（在这里面鱼的体力会下降） */
  sweetLow: number;
  sweetHigh: number;
  /** 低于这个张力算松线 */
  slackThreshold: number;
  /** 松线超过这么多秒鱼就脱钩 */
  slackGrace: number;
  /** 张力超过鱼线强度这么多秒就断线 */
  breakGrace: number;
  /** 体力消耗倍率 */
  staminaDrain: number;
  /** 鱼往外游的速度（像素 / 秒，按拉力 1 计） */
  swimSpeed: number;
  /** 鱼还有力气时，离岸最近也要保持的距离范围（像素）：体力越少，越能拉近 */
  holdRange: number;
  /** 竿子往反方向带时，最多能抵消多少拉力 */
  leverage: number;
  /** 离岸这么近（像素）就算拉上来了 */
  landDistance: number;
  /** 最长出线（像素），线放完了张力会猛增 */
  maxLine: number;
}

export const DEFAULT_FIGHT_PARAMS: FightParams = {
  riseRate: 0.9,
  pullRiseRate: 2.0,
  fallRate: 1.3,
  reelBase: 0.42,
  reelPullGain: 0.62,
  slackPullGain: 0.22,
  sweetLow: 0.3,
  sweetHigh: 0.85,
  slackThreshold: 0.12,
  slackGrace: 1.6,
  breakGrace: 0.3,
  staminaDrain: 1,
  swimSpeed: 110,
  holdRange: 300,
  leverage: 0.45,
  landDistance: 70,
  maxLine: 900,
};

export type FightMode = 'steady' | 'burst' | 'rest' | 'dive';
export type FightOutcome = 'landed' | 'snapped' | 'escaped';

export interface FightInput {
  /** 是否按住收线 */
  reeling: boolean;
  /** 竿子往哪边带：-1 左 ~ 1 右 */
  rodSide: number;
}

export interface FightSetup {
  species: FishSpecies;
  fish: FishInstance;
  /** 开始时鱼离岸的距离（像素） */
  distance: number;
  /** 收线速度（像素 / 秒） */
  reelSpeed: number;
  /** 鱼线强度，1 = 普通线 */
  lineStrength: number;
  /** 提竿时机好坏 0~1，好的话鱼一开始就少一截体力 */
  hookQuality: number;
}

export interface FightState {
  tension: number;
  stamina: number;
  staminaMax: number;
  /** 鱼离岸的距离（像素） */
  distance: number;
  /** 鱼当前的拉力（已乘上力气和体力） */
  pull: number;
  /** 鱼往哪边窜：-1 左 ~ 1 右 */
  lateral: number;
  mode: FightMode;
  modeTime: number;
  slackTime: number;
  overTime: number;
  elapsed: number;
  outcome: FightOutcome | null;
}

export interface FightEvent {
  type: 'burst' | 'turn' | 'danger' | 'slack' | FightOutcome;
}

/** 体重越接近这个品种的上限，力气和体力越大 */
function sizeFactor(species: FishSpecies, fish: FishInstance): number {
  const { min, max } = species.weightKg;
  const t = Math.max(0, Math.min(1.3, (fish.weightKg - min) / (max - min || 1)));
  return 0.75 + 0.6 * t;
}

export class Fight {
  readonly state: FightState;
  private readonly style: FightStyle;
  private readonly power: number;
  private readonly params: FightParams;
  private readonly events: FightEvent[] = [];

  constructor(
    private readonly setup: FightSetup,
    private readonly rng: Rng,
    params: Partial<FightParams> = {},
  ) {
    this.params = { ...DEFAULT_FIGHT_PARAMS, ...params };
    const k = sizeFactor(setup.species, setup.fish);
    this.style = setup.species.fight.style;
    this.power = setup.species.fight.power * k;
    const staminaMax = setup.species.fight.stamina * k;
    this.state = {
      tension: 0.35,
      stamina: staminaMax * (1 - 0.15 * setup.hookQuality),
      staminaMax,
      distance: Math.min(setup.distance, this.params.maxLine),
      pull: 0,
      lateral: rng.chance(0.5) ? 1 : -1,
      mode: 'burst',
      modeTime: rng.range(0.4, 0.8),
      slackTime: 0,
      overTime: 0,
      elapsed: 0,
      outcome: null,
    };
  }

  get tunables(): FightParams {
    return this.params;
  }

  /** 推进 dt 秒，返回这一步发生的事件 */
  step(dt: number, input: FightInput): FightEvent[] {
    this.events.length = 0;
    const s = this.state;
    if (s.outcome) return this.events;
    const p = this.params;
    s.elapsed += dt;

    this.updateMode(dt);

    // ---- 鱼的拉力 ----
    const fatigue = s.staminaMax > 0 ? s.stamina / s.staminaMax : 0;
    let force = this.modeForce() * this.power * (0.3 + 0.7 * fatigue);
    if (s.stamina <= 0) force = 0.05;
    // 竿子往鱼窜的反方向带，能卸掉一部分力
    const relief = p.leverage * Math.max(0, Math.min(1, -input.rodSide * s.lateral));
    const diveBonus = s.mode === 'dive' ? 1 + 0.45 * (1 - relief / p.leverage) : 1;
    force *= (1 - relief) * diveBonus;
    s.pull = force;

    // ---- 张力 ----
    const target = input.reeling ? p.reelBase + force * p.reelPullGain : force * p.slackPullGain;
    const rate = target > s.tension ? p.riseRate + force * p.pullRiseRate : p.fallRate;
    s.tension += Math.sign(target - s.tension) * Math.min(Math.abs(target - s.tension), rate * dt);
    // 线放完了，张力猛增
    if (s.distance >= p.maxLine && force > 0.2) s.tension += dt * 1.5;

    // ---- 距离 ----
    // 线绷紧时收线才有用；鱼一直按拉力往外游
    if (input.reeling) s.distance -= this.setup.reelSpeed * Math.min(1.2, s.tension / 0.5) * dt;
    s.distance += p.swimSpeed * force * dt;
    // 鱼还有力气就不肯靠近：体力剩一成以上时，离岸至少保持 hold
    const hold = p.landDistance + p.holdRange * Math.max(0, (fatigue - 0.1) / 0.9);
    if (s.distance < hold) s.distance += (hold - s.distance) * Math.min(1, dt * 2);
    s.distance = Math.max(0, Math.min(p.maxLine, s.distance));

    // ---- 体力 ----
    if (s.tension >= p.sweetLow) {
      const inSweet = s.tension <= p.sweetHigh;
      s.stamina -= dt * p.staminaDrain * (inSweet ? 0.35 + 0.6 * s.tension : 1.1);
    } else if (s.tension < p.slackThreshold) {
      s.stamina = Math.min(s.staminaMax, s.stamina + dt * 0.25);
    }
    s.stamina = Math.max(0, s.stamina);

    // ---- 断线 / 脱钩 / 上岸 ----
    const breakAt = this.setup.lineStrength;
    if (s.tension > breakAt) {
      if (s.overTime === 0) this.events.push({ type: 'danger' });
      s.overTime += dt;
      if (s.overTime > p.breakGrace) return this.finish('snapped');
    } else {
      s.overTime = 0;
    }
    if (s.tension < p.slackThreshold) {
      if (s.slackTime === 0) this.events.push({ type: 'slack' });
      s.slackTime += dt;
      if (s.slackTime > p.slackGrace) return this.finish('escaped');
    } else {
      s.slackTime = 0;
    }
    if (s.distance <= p.landDistance) return this.finish('landed');
    return this.events;
  }

  private finish(outcome: FightOutcome): FightEvent[] {
    this.state.outcome = outcome;
    this.events.push({ type: outcome });
    return this.events;
  }

  /** 不同挣扎方式对应的拉力曲线 */
  private modeForce(): number {
    const s = this.state;
    switch (s.mode) {
      case 'burst':
        return 1.55;
      case 'dive':
        return 1.0;
      case 'rest':
        return 0.25;
      case 'steady':
      default:
        return 0.6 + 0.15 * Math.sin(s.elapsed * 2.3);
    }
  }

  private updateMode(dt: number): void {
    const s = this.state;
    const rng = this.rng;
    s.modeTime -= dt;
    if (s.modeTime > 0) return;
    const prev = s.mode;
    const r = rng.float();
    switch (this.style) {
      case 'gentle':
        s.mode = r < 0.12 ? 'burst' : r < 0.3 ? 'rest' : 'steady';
        break;
      case 'burst':
        s.mode = prev === 'burst' ? (r < 0.3 ? 'rest' : 'steady') : r < 0.55 ? 'burst' : 'steady';
        break;
      case 'stamina':
        s.mode = r < 0.1 ? 'burst' : 'steady';
        break;
      case 'dive':
        s.mode = prev === 'dive' ? 'steady' : r < 0.5 ? 'dive' : r < 0.65 ? 'burst' : 'steady';
        break;
      case 'sly':
        s.mode = prev === 'rest' ? 'burst' : r < 0.5 ? 'rest' : 'steady';
        break;
    }
    const durations: Record<FightMode, [number, number]> = {
      burst: [0.45, 0.9],
      dive: [1.2, 2.4],
      rest: [1.5, 3.5],
      steady: [1.5, 3.2],
    };
    const [lo, hi] = durations[s.mode];
    s.modeTime = rng.range(lo, hi);
    if (s.mode === 'burst') this.events.push({ type: 'burst' });
    // 换方向
    if (s.mode === 'dive' || rng.chance(0.45)) {
      const next = s.mode === 'dive' ? (rng.chance(0.5) ? 1 : -1) : rng.range(-1, 1);
      if (Math.sign(next) !== Math.sign(s.lateral)) this.events.push({ type: 'turn' });
      s.lateral = next;
    }
  }
}
