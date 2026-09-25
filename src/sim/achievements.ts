import type { Achievement, AchievementCondition, RecordKey } from './data/schema';
import { RECORD_KEYS } from './data/schema';
import type { GameState } from './state';

/**
 * 成就：配置表（data/achievements.json）里写条件，这里判断达成没有、进度多少。
 * 条件看的是 GameState 里一辈子的累计记录、外公笔记、鱼塘、口碑、升级这些现成的数据，
 * 所以加一个成就一般只改配置表。以后接 Steam 成就时，按成就 id 对上 Steam 后台的 API 名。
 */

export type Records = Record<RecordKey, number>;

export function emptyRecords(): Records {
  return Object.fromEntries(RECORD_KEYS.map((k) => [k, 0])) as Records;
}

/** 条件的进度：current / target，达成时 current >= target */
export function progressOf(
  state: GameState,
  c: AchievementCondition,
): { current: number; target: number } {
  const data = state.data;
  switch (c.type) {
    case 'record':
      return { current: state.records[c.key], target: c.value };
    case 'species':
      return { current: state.journal.has(c.id) ? 1 : 0, target: 1 };
    case 'weight':
      return { current: state.journal.get(c.id)?.bestWeightKg ?? 0, target: c.kg };
    case 'spotComplete': {
      const all = data.species.filter((s) => s.spots.includes(c.id));
      return { current: all.filter((s) => state.journal.has(s.id)).length, target: all.length };
    }
    case 'journalShare': {
      const target = Math.ceil(data.species.length * c.value);
      return { current: data.species.filter((s) => state.journal.has(s.id)).length, target };
    }
    case 'pond':
      return { current: state.pond.length, target: c.value };
    case 'reputation':
      return { current: state.restaurant.reputation, target: c.value };
    case 'money':
      return { current: state.money, target: c.value };
    case 'upgrade':
      return { current: state.upgrades.has(c.id) ? 1 : 0, target: 1 };
    case 'upgradeCount':
      return { current: state.upgrades.size, target: c.value };
    case 'upgradeShare':
      return {
        current: state.upgrades.size,
        target: Math.ceil(data.upgrades.length * c.value),
      };
    case 'flag':
      return { current: state.flags.has(c.id) ? 1 : 0, target: 1 };
    case 'menu':
      return { current: state.restaurant.menu.length, target: c.value };
  }
}

export function conditionMet(state: GameState, c: AchievementCondition): boolean {
  const p = progressOf(state, c);
  return p.current >= p.target;
}

export function isAchieved(state: GameState, a: Achievement): boolean {
  return conditionMet(state, a.condition);
}

/**
 * 看看有没有新达成的成就：记下是哪天达成的、发奖励。返回这次新达成的。
 * 每帧调用也不贵（几十个条件，都是查表）。
 */
export function checkAchievements(state: GameState): Achievement[] {
  const unlocked: Achievement[] = [];
  for (const a of state.data.achievements) {
    if (state.achievements.has(a.id) || !isAchieved(state, a)) continue;
    state.achievements.set(a.id, state.clock.day);
    if (a.reward?.money) state.earn(a.reward.money);
    for (const [id, n] of Object.entries(a.reward?.items ?? {})) state.inventory.add(id, n);
    state.today.achievements.push(a.id);
    unlocked.push(a);
  }
  return unlocked;
}

/** 奖励写成一句话，例如"¥50、蚯蚓 ×10" */
export function rewardText(state: GameState, a: Achievement): string {
  const parts: string[] = [];
  if (a.reward?.money) parts.push(`¥${a.reward.money}`);
  for (const [id, n] of Object.entries(a.reward?.items ?? {})) {
    parts.push(`${state.itemName(id)} ×${n}`);
  }
  return parts.join('、');
}
