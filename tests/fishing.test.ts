import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/sim/data/gameData';
import type { FishSpecies } from '../src/sim/data/schema';
import { planBite, strikeQuality } from '../src/sim/fishing/bite';
import { formatWeight, rollFish, triangular } from '../src/sim/fishing/catchRoll';
import { Fight, type FightInput } from '../src/sim/fishing/fight';
import { pickSpecies, spawnTable, spawnWeight } from '../src/sim/fishing/spawn';
import { zoneAt } from '../src/sim/fishing/zones';
import { Rng } from '../src/sim/rng/rng';

const data = getGameData();
const species = (id: string): FishSpecies => data.speciesById.get(id)!;
const creek = data.spotById.get('creek')!;
const bay = creek.positions.find((p) => p.id === 'bay')!;

describe('配置表', () => {
  it('能通过校验', () => {
    expect(data.species.length).toBeGreaterThanOrEqual(5);
    expect(creek.positions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('区域', () => {
  it('深潭、水草、浅滩按形状判断', () => {
    expect(zoneAt(bay, 0.37, 0.38)).toBe('deep');
    expect(zoneAt(bay, 0.79, 0.34)).toBe('weeds');
    expect(zoneAt(bay, 0.5, 0.8)).toBe('shallow');
    expect(zoneAt(bay, 0.95, 0.1)).toBe('open');
  });
});

describe('出鱼', () => {
  const base = {
    spotId: 'creek',
    zone: 'deep' as const,
    weather: 'sunny' as const,
    season: 'spring' as const,
  };

  it('黄鳝白天几乎不出，夜里常见', () => {
    const eel = species('swamp_eel');
    const day = spawnWeight(eel, { ...base, zone: 'rocks', period: 'day' });
    const night = spawnWeight(eel, { ...base, zone: 'rocks', period: 'night' });
    expect(night).toBeGreaterThan(day * 20);
  });

  it('下雨天泥鳅明显变多', () => {
    const loach = species('loach');
    const sunny = spawnWeight(loach, { ...base, zone: 'shallow', period: 'day' });
    const rain = spawnWeight(loach, { ...base, zone: 'shallow', period: 'day', weather: 'rain' });
    expect(rain).toBeGreaterThan(sunny * 4);
  });

  it('概率表加起来是 1，按权重抽取', () => {
    const ctx = { ...base, period: 'morning' as const };
    const table = spawnTable(data.species, ctx);
    expect(table.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1, 6);
    const rng = new Rng(1);
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const s = pickSpecies(data.species, ctx, rng)!;
      counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
    }
    for (const row of table)
      expect(Math.abs((counts.get(row.id) ?? 0) / 4000 - row.p)).toBeLessThan(0.03);
  });

  it('不在这个钓点的鱼不会出现', () => {
    expect(spawnWeight(species('crucian'), { ...base, spotId: 'river', period: 'day' })).toBe(0);
  });
});

describe('钓上来的鱼', () => {
  it('体重落在范围内，体长由体重推算', () => {
    const rng = new Rng(3);
    const crucian = species('crucian');
    for (let i = 0; i < 500; i++) {
      const f = rollFish(crucian, rng);
      expect(f.weightKg).toBeGreaterThanOrEqual(crucian.weightKg.min);
      expect(f.weightKg).toBeLessThanOrEqual(crucian.weightKg.max * 1.25);
      expect(f.lengthCm).toBeGreaterThan(5);
      expect(f.lengthCm).toBeLessThan(45);
    }
  });

  it('三角分布集中在众数附近', () => {
    const rng = new Rng(4);
    const xs = Array.from({ length: 5000 }, () => triangular(rng, 0, 0.2, 1));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeCloseTo((0 + 0.2 + 1) / 3, 1);
  });

  it('重量按斤两显示', () => {
    expect(formatWeight(0.012)).toBe('12 克');
    expect(formatWeight(0.25)).toBe('5.0 两');
    expect(formatWeight(0.75)).toBe('1.5 斤');
  });
});

describe('咬钩', () => {
  it('麦穗鱼试探得多，经常偷饵', () => {
    const rng = new Rng(5);
    let steals = 0;
    let nibbles = 0;
    for (let i = 0; i < 400; i++) {
      const plan = planBite(species('stone_moroko'), 'dough', rng);
      nibbles += plan.nibbles.length;
      if (plan.nibbles.some((n) => n.steals)) steals++;
    }
    expect(nibbles / 400).toBeGreaterThan(2);
    expect(steals / 400).toBeGreaterThan(0.4);
  });

  it('马口鱼几乎不试探，直接咬', () => {
    const rng = new Rng(6);
    let direct = 0;
    for (let i = 0; i < 300; i++) {
      const plan = planBite(species('hooksnout'), 'worm', rng);
      if (plan.nibbles.length <= 1 && plan.biteAt !== null) direct++;
    }
    expect(direct / 300).toBeGreaterThan(0.6);
  });

  it('试探时间递增，咬钩在最后', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const plan = planBite(species('crucian'), 'worm', rng);
      for (let k = 1; k < plan.nibbles.length; k++) {
        expect(plan.nibbles[k]!.at).toBeGreaterThan(plan.nibbles[k - 1]!.at);
      }
      if (plan.biteAt !== null && plan.nibbles.length > 0) {
        expect(plan.biteAt).toBeGreaterThan(plan.nibbles[plan.nibbles.length - 1]!.at);
      }
    }
  });

  it('提竿越快越好，超时为 0', () => {
    expect(strikeQuality(0.1, 1)).toBe(1);
    expect(strikeQuality(0.9, 1)).toBeLessThan(0.5);
    expect(strikeQuality(1.2, 1)).toBe(0);
  });
});

/** 一个简单的"机器人钓手"：张力低了就收线，高了就放线，竿子往鱼窜的反方向带 */
function botInput(fight: Fight): FightInput {
  const s = fight.state;
  return { reeling: s.tension < 0.62, rodSide: -Math.sign(s.lateral) };
}

/** 有反应延迟的钓手：看到的是 delay 秒之前的状态 */
function delayed(delay: number, counter: boolean): (f: Fight) => FightInput {
  const history: { t: number; tension: number; lateral: number }[] = [];
  return (f) => {
    const t = f.state.elapsed;
    history.push({ t, tension: f.state.tension, lateral: f.state.lateral });
    while (history.length > 1 && history[1]!.t <= t - delay) history.shift();
    const seen = history[0]!;
    return { reeling: seen.tension < 0.75, rodSide: counter ? -Math.sign(seen.lateral) : 0 };
  };
}

function runFight(
  sp: FishSpecies,
  seed: number,
  controller: (f: Fight) => FightInput,
  maxSeconds = 120,
): { outcome: string | null; time: number } {
  const rng = new Rng(seed);
  const fish = rollFish(sp, rng);
  const fight = new Fight(
    { species: sp, fish, distance: 480, reelSpeed: 150, lineStrength: 1, hookQuality: 0.7 },
    rng,
  );
  const dt = 1 / 60;
  for (let t = 0; t < maxSeconds && !fight.state.outcome; t += dt)
    fight.step(dt, controller(fight));
  return { outcome: fight.state.outcome, time: fight.state.elapsed };
}

describe('遛鱼', () => {
  it('会操作的话，每种鱼都能钓上来，时间合理', () => {
    for (const sp of data.species) {
      let landed = 0;
      const times: number[] = [];
      for (let i = 0; i < 40; i++) {
        const r = runFight(sp, 100 + i, botInput);
        if (r.outcome === 'landed') {
          landed++;
          times.push(r.time);
        }
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)] ?? Infinity;
      expect(landed / 40, `${sp.name} 上鱼率`).toBeGreaterThan(0.85);
      expect(median, `${sp.name} 遛鱼时长中位数`).toBeGreaterThan(2);
      expect(median, `${sp.name} 遛鱼时长中位数`).toBeLessThan(30);
    }
  });

  it('一直不收线，鱼会脱钩', () => {
    const r = runFight(species('crucian'), 1, () => ({ reeling: false, rodSide: 0 }));
    expect(r.outcome).toBe('escaped');
  });

  it('大力的鱼一直死拉，鱼线会断', () => {
    let snapped = 0;
    for (let i = 0; i < 20; i++) {
      const r = runFight(species('swamp_eel'), 200 + i, () => ({ reeling: true, rodSide: 0 }));
      if (r.outcome === 'snapped') snapped++;
    }
    expect(snapped).toBeGreaterThan(10);
  });

  it('竿子往反方向带，钻底的鱼好遛得多（反应慢一点的人也一样）', () => {
    const eel = species('swamp_eel');
    let withCounter = 0;
    let without = 0;
    for (let i = 0; i < 30; i++) {
      if (runFight(eel, 300 + i, delayed(0.35, true)).outcome === 'landed') withCounter++;
      if (runFight(eel, 300 + i, delayed(0.35, false)).outcome === 'landed') without++;
    }
    expect(withCounter).toBeGreaterThan(24);
    expect(without).toBeLessThan(withCounter / 2);
  });
});
