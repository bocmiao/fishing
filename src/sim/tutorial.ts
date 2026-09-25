import { conditionMet, progressOf } from './achievements';
import type { TutorialStep } from './data/schema';
import type { GameState } from './state';

/**
 * 新手引导（小满的便条）：步骤写在 data/tutorial.json，一步一步来。
 * 当前这一步的条件全满足了就走到下一步；提前做过的事也算，会一口气跳过去。
 * 条件和成就共用，看的都是 GameState 里现成的数据，所以各个画面不用为引导埋点。
 */

export function currentStep(state: GameState): TutorialStep | null {
  return state.data.tutorial.steps[state.tutorial.step] ?? null;
}

export function tutorialFinished(state: GameState): boolean {
  return state.tutorial.step >= state.data.tutorial.steps.length;
}

/** 这一步的几个条件满足了几个 */
export function stepProgress(state: GameState, step: TutorialStep): { met: number; total: number } {
  return { met: step.done.filter((c) => conditionMet(state, c)).length, total: step.done.length };
}

/** 便条上的进度：好几个条件时是"满足了几个"，一个计数条件时是"1/3"这样；都没有就是空 */
export function progressText(state: GameState, step: TutorialStep): string {
  if (step.done.length > 1) {
    const p = stepProgress(state, step);
    return `${p.met}/${p.total}`;
  }
  const p = progressOf(state, step.done[0]!);
  return p.target > 1 ? `${Math.min(p.current, p.target)}/${p.target}` : '';
}

/** 当前这一步做到了就往下走（可能连走好几步）。返回这次做到的步骤 */
export function advanceTutorial(state: GameState): TutorialStep[] {
  const done: TutorialStep[] = [];
  for (let step = currentStep(state); step; step = currentStep(state)) {
    if (!step.done.every((c) => conditionMet(state, c))) break;
    done.push(step);
    state.tutorial.step++;
  }
  return done;
}

/** "怎么做"按画面给说法：依次试这些键（画面名、画面种类），都没写就用 default */
export function howFor(step: TutorialStep, keys: string[]): string {
  for (const k of keys) {
    const text = step.how[k];
    if (text) return text;
  }
  return step.how.default ?? '';
}
