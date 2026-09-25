import { describe, expect, it } from 'vitest';
import { getGameData, seedId } from '../src/sim/data/gameData';
import { rollFish } from '../src/sim/fishing/catchRoll';
import { Rng } from '../src/sim/rng/rng';
import { restore, serialize } from '../src/sim/save';
import { GameState } from '../src/sim/state';
import {
  advanceTutorial,
  currentStep,
  howFor,
  progressText,
  stepProgress,
  tutorialFinished,
} from '../src/sim/tutorial';

const data = getGameData();
const stepIds = () => data.tutorial.steps.map((s) => s.id);

/** 钓一条鲫鱼放进鱼护 */
function catchOne(state: GameState, rng: Rng): number {
  const fish = rollFish(data.speciesById.get('crucian')!, rng);
  state.recordCatch(fish);
  state.keep(fish, 'creek', 'bay');
  return fish.uid;
}

describe('新手引导', () => {
  it('每一步都有 default 的说法', () => {
    for (const step of data.tutorial.steps) expect(step.how.default).toBeTruthy();
  });

  it('开局在第一步，什么都没做不会往下走', () => {
    const state = new GameState(data, 1);
    expect(currentStep(state)?.id).toBe(stepIds()[0]);
    expect(advanceTutorial(state)).toEqual([]);
  });

  it('照着便条过完第一天，一步一步走到头', () => {
    const state = new GameState(data, 2);
    const rng = new Rng(2);
    const walked: string[] = [];
    const next = () => walked.push(...advanceTutorial(state).map((s) => s.id));

    state.flags.add('visit:fishing');
    next();
    const uids = [catchOne(state, rng), catchOne(state, rng), catchOne(state, rng)];
    next();
    state.releaseToPond(uids[0]!);
    next();
    state.flags.add('open:notebook');
    next();
    state.workPlot(0, { kind: 'hand' }, rng);
    state.workPlot(0, { kind: 'hand' }, rng);
    expect(state.inventory.count(seedId('corn'))).toBeGreaterThan(0);
    state.workPlot(0, { kind: 'seed', cropId: 'corn' }, rng);
    next();
    state.toTank(uids[1]!);
    next();
    // 有鱼进缸还不够，菜单上还得有菜
    expect(currentStep(state)?.id).toBe('stock_up');
    expect(stepProgress(state, currentStep(state)!)).toEqual({ met: 1, total: 2 });
    state.setMenu(['braised_crucian']);
    next();
    state.recordDish(26, 0.8, 'braised_crucian');
    next();
    state.sleep();
    next();
    state.flags.add('open:upgrades');
    next();

    expect(walked).toEqual(stepIds());
    expect(tutorialFinished(state)).toBe(true);
    expect(currentStep(state)).toBeNull();
    expect(state.cooked.get('braised_crucian')).toBe(1);
  });

  it('提前做过的事也算：一口气跳过好几步', () => {
    const state = new GameState(data, 3);
    const rng = new Rng(3);
    state.flags.add('visit:fishing');
    for (let i = 0; i < 3; i++) catchOne(state, rng);
    expect(advanceTutorial(state).map((s) => s.id)).toEqual([
      'go_creek',
      'first_fish',
      'keep_three',
    ]);
    expect(currentStep(state)?.id).toBe('pond_release');
  });

  it('便条上的进度：计数的显示几条，好几个条件的显示满足了几个', () => {
    const state = new GameState(data, 6);
    const rng = new Rng(6);
    const step = (id: string) => data.tutorial.steps.find((s) => s.id === id)!;
    catchOne(state, rng);
    expect(progressText(state, step('keep_three'))).toBe('1/3');
    expect(progressText(state, step('first_fish'))).toBe('');
    expect(progressText(state, step('stock_up'))).toBe('0/2');
  });

  it('按画面挑说法：画面名、画面种类、都没有就用 default', () => {
    const step = data.tutorial.steps.find((s) => s.id === 'first_fish')!;
    expect(howFor(step, ['fishing', 'fishing'])).toBe(step.how.fishing);
    expect(howFor(step, ['lake', 'fishing'])).toBe(step.how.fishing);
    expect(howFor(step, ['pond', ''])).toBe(step.how.default);
  });

  it('存档记着走到第几步、便条关没关、做过的小事和菜', () => {
    const state = new GameState(data, 4);
    state.flags.add('visit:fishing');
    advanceTutorial(state);
    state.tutorial.hidden = true;
    state.recordDish(30, 0.9, 'fried_minnows');
    const back = restore(data, JSON.parse(JSON.stringify(serialize(state))));
    expect(back.tutorial).toEqual({ step: 1, hidden: true });
    expect(back.flags.has('visit:fishing')).toBe(true);
    expect(back.cooked.get('fried_minnows')).toBe(1);
  });

  it('没有引导字段的老存档从第一步开始，做过的步骤自动跳过', () => {
    const state = new GameState(data, 5);
    const rng = new Rng(5);
    for (let i = 0; i < 3; i++) catchOne(state, rng);
    const raw = serialize(state) as Record<string, unknown>;
    delete raw.flags;
    delete raw.tutorial;
    delete raw.cooked;
    const records = raw.records as Record<string, number>;
    delete records.kept;
    delete records.sown;
    delete records.tanked;
    const back = restore(data, JSON.parse(JSON.stringify(raw)));
    expect(back.tutorial).toEqual({ step: 0, hidden: false });
    // 老存档没记"去过小溪"、放进鱼护几条，但钓过鱼就说明去过、放过
    expect(advanceTutorial(back).map((s) => s.id)).toEqual([
      'go_creek',
      'first_fish',
      'keep_three',
    ]);
  });
});
