/**
 * 遛鱼数值报告（不是测试，是调参工具）：
 *   npx vitest run tools/balance --dir tools
 * 用几种"机器人钓手"跑每种鱼，打印上鱼率和用时。
 * 机器人和真人一样通过 ReelCrank 连按空格收线：rate = 每秒按几下。
 * 试参数：FIGHT='{"reelBase":0.6}' CRANK='{"decay":2.2}' npm run balance
 */
import { it } from 'vitest';
import { getGameData } from '../../src/sim/data/gameData';
import type { FishSpecies } from '../../src/sim/data/schema';
import { rollFish } from '../../src/sim/fishing/catchRoll';
import { Fight, type FightInput, type FightParams } from '../../src/sim/fishing/fight';
import { ReelCrank, type CrankParams } from '../../src/sim/fishing/reel';
import { Rng } from '../../src/sim/rng/rng';

type Controller = (f: Fight, t: number) => FightInput;

const DT = 1 / 60;
const fightParams = JSON.parse(process.env.FIGHT ?? '{}') as Partial<FightParams>;
const crankParams = JSON.parse(process.env.CRANK ?? '{}') as Partial<CrankParams>;

/** 连按空格的手：想收线时每秒按 rate 下，不想收就停手 */
function masher(rate: number): (want: boolean) => number {
  const crank = new ReelCrank(crankParams);
  let next = 0;
  return (want) => {
    next -= DT;
    if (want && next <= 0) {
      crank.press();
      next += 1 / rate;
    }
    if (!want) next = 0;
    crank.update(DT);
    return crank.intensity;
  };
}

/** 有反应延迟的"人"：看到的是 delay 秒之前的张力 */
function human(delay: number, threshold: number, counter: boolean, rate: number): () => Controller {
  return () => {
    const history: { t: number; tension: number; lateral: number }[] = [];
    const hand = masher(rate);
    return (f, t) => {
      history.push({ t, tension: f.state.tension, lateral: f.state.lateral });
      while (history.length > 1 && history[1]!.t <= t - delay) history.shift();
      const seen = history[0]!;
      return {
        reel: hand(seen.tension < threshold),
        rodSide: counter ? -Math.sign(seen.lateral) : 0,
      };
    };
  };
}

const controllers: Record<string, () => Controller> = {
  熟手: human(0.2, 0.62, true, 8),
  新手: human(0.35, 0.75, false, 6),
  新手反拉: human(0.35, 0.75, true, 6),
  手慢: human(0.35, 0.75, true, 3.5),
  死按: () => {
    const hand = masher(10);
    return () => ({ reel: hand(true), rodSide: 0 });
  },
};

function run(sp: FishSpecies, seed: number, make: () => Controller) {
  const rng = new Rng(seed);
  const fish = rollFish(sp, rng);
  const fight = new Fight(
    { species: sp, fish, distance: 480, reelSpeed: 150, lineStrength: 1, hookQuality: 0.6 },
    rng,
    fightParams,
  );
  const ctl = make();
  let maxT = 0;
  for (let t = 0; t < 120 && !fight.state.outcome; t += DT) {
    fight.step(DT, ctl(fight, t));
    maxT = Math.max(maxT, fight.state.tension);
  }
  return { outcome: fight.state.outcome ?? 'timeout', time: fight.state.elapsed, maxT };
}

it('fight report', () => {
  const data = getGameData();
  const rows: string[] = [];
  for (const sp of data.species) {
    for (const [name, make] of Object.entries(controllers)) {
      const n = 60;
      const res = Array.from({ length: n }, (_, i) => run(sp, 1000 + i, make));
      const landed = res.filter((r) => r.outcome === 'landed');
      const snapped = res.filter((r) => r.outcome === 'snapped').length;
      const escaped = res.filter((r) => r.outcome === 'escaped').length;
      const snagged = res.filter((r) => r.outcome === 'snagged').length;
      const times = landed.map((r) => r.time).sort((a, b) => a - b);
      const med = times[Math.floor(times.length / 2)] ?? NaN;
      rows.push(
        `${sp.name.padEnd(4, '　')} ${name}  上鱼 ${String(Math.round((landed.length / n) * 100)).padStart(3)}%  断线 ${String(snapped).padStart(2)}  脱钩 ${String(escaped).padStart(2)}  挂草 ${String(snagged).padStart(2)}  用时中位 ${med.toFixed(1).padStart(5)}s`,
      );
    }
  }
  process.stdout.write('\n' + rows.join('\n') + '\n');
});
