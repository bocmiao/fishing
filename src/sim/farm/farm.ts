import type { Crop, FarmConfig } from '../data/schema';
import { seedId } from '../data/gameData';
import type { Inventory } from '../inventory';
import type { Rng } from '../rng/rng';
import type { Season } from '../time/clock';

/**
 * 菜地：几块地，每块地按"荒地 → 空地 → 翻好的地 → 长着 → 熟了"轮转。
 * 翻地时能挖到蚯蚓，这是前期蚯蚓的主要来源。作物不会枯死，没浇水只是那天不长。
 */

export type PlotStage = 'wild' | 'soil' | 'tilled' | 'growing' | 'ripe';

export interface Plot {
  stage: PlotStage;
  cropId: string | null;
  /** 已经长了几天（浇过水的天数，施肥的地长得快一些） */
  grown: number;
  /** 今天浇过水 */
  watered: boolean;
  /** 施过堆肥（到收获为止） */
  compost: boolean;
}

export type PlotAction = 'clear' | 'till' | 'sow' | 'water' | 'fertilize' | 'harvest';

export const PLOT_ACTION_NAMES: Record<PlotAction, string> = {
  clear: '开荒',
  till: '翻地',
  sow: '播种',
  water: '浇水',
  fertilize: '施肥',
  harvest: '收获',
};

export interface FarmContext {
  crops: Map<string, Crop>;
  config: FarmConfig;
  inventory: Inventory;
  rng: Rng;
  season: Season;
  raining: boolean;
}

export interface FarmResult {
  ok: boolean;
  action: PlotAction | null;
  /** 给玩家看的一句话 */
  message: string;
  /** 花掉的游戏分钟 */
  minutes: number;
  worms: number;
  /** 收获了什么 */
  harvest: { id: string; count: number } | null;
  seedBack: boolean;
}

/** 玩家手里拿着的东西：某种种子、堆肥，或者空手 */
export type FarmTool = { kind: 'seed'; cropId: string } | { kind: 'compost' } | { kind: 'hand' };

export function newPlot(): Plot {
  return { stage: 'wild', cropId: null, grown: 0, watered: false, compost: false };
}

/** 点一块地会做什么（按地的状态和手里拿的东西） */
export function actionFor(plot: Plot, tool: FarmTool): PlotAction | null {
  if (tool.kind === 'compost') {
    return !plot.compost && (plot.stage === 'tilled' || plot.stage === 'growing')
      ? 'fertilize'
      : null;
  }
  switch (plot.stage) {
    case 'wild':
      return 'clear';
    case 'soil':
      return 'till';
    case 'tilled':
      return tool.kind === 'seed' ? 'sow' : null;
    case 'growing':
      return plot.watered ? null : 'water';
    case 'ripe':
      return 'harvest';
  }
}

function fail(message: string): FarmResult {
  return { ok: false, action: null, message, minutes: 0, worms: 0, harvest: null, seedBack: false };
}

/** 翻地的时候挖蚯蚓 */
function digWorms(plot: Plot, chance: number, ctx: FarmContext): number {
  const w = ctx.config.worms;
  if (!ctx.rng.chance(chance)) return 0;
  return (
    ctx.rng.int(w.min, w.max) +
    (ctx.raining ? w.rainBonus : 0) +
    (plot.compost ? w.compostBonus : 0)
  );
}

/** 对一块地做一次操作 */
export function workPlot(plot: Plot, tool: FarmTool, ctx: FarmContext): FarmResult {
  const action = actionFor(plot, tool);
  const minutes = ctx.config.minutes;
  const done = (message: string, extra: Partial<FarmResult> = {}): FarmResult => ({
    ok: true,
    action,
    message,
    minutes: action ? minutes[action] : 0,
    worms: 0,
    harvest: null,
    seedBack: false,
    ...extra,
  });

  switch (action) {
    case 'clear': {
      const worms = digWorms(plot, ctx.config.worms.clearChance, ctx);
      plot.stage = 'soil';
      ctx.inventory.add('worm', worms);
      return done(worms > 0 ? `拔掉杂草，翻出 ${worms} 条蚯蚓` : '拔掉杂草，搬走了石头', {
        worms,
      });
    }
    case 'till': {
      const worms = digWorms(plot, ctx.config.worms.tillChance, ctx);
      plot.stage = 'tilled';
      ctx.inventory.add('worm', worms);
      return done(worms > 0 ? `翻好了地，挖到 ${worms} 条蚯蚓` : '翻好了地', { worms });
    }
    case 'sow': {
      if (tool.kind !== 'seed') return fail('先选一种种子');
      const crop = ctx.crops.get(tool.cropId);
      if (!crop) return fail('没有这种作物');
      if (!crop.seasons.includes(ctx.season)) return fail(`${crop.name}这个季节种不了`);
      if (!ctx.inventory.take(seedId(crop.id))) return fail(`${crop.name}种子用完了`);
      plot.stage = 'growing';
      plot.cropId = crop.id;
      plot.grown = 0;
      // 下雨天种下去，当天就算浇过水
      plot.watered = ctx.raining;
      return done(`种下了${crop.name}（${crop.days} 天成熟）`);
    }
    case 'water':
      plot.watered = true;
      return done('浇好了水');
    case 'fertilize':
      if (!ctx.inventory.take('compost')) return fail('没有堆肥了');
      plot.compost = true;
      return done('施了一把堆肥');
    case 'harvest': {
      const crop = plot.cropId ? ctx.crops.get(plot.cropId) : undefined;
      if (!crop) return fail('这块地什么也没长');
      const base = ctx.rng.int(crop.yield[0], crop.yield[1]);
      const count = Math.round(base * (plot.compost ? 1 + ctx.config.compostYieldBonus : 1));
      ctx.inventory.add(crop.produce, count);
      const seedBack = ctx.rng.chance(ctx.config.seedReturnChance);
      if (seedBack) ctx.inventory.add(seedId(crop.id));
      Object.assign(plot, newPlot(), { stage: 'soil' });
      return done(`收了 ${count} 份${crop.name}${seedBack ? '，还留下一颗种子' : ''}`, {
        harvest: { id: crop.produce, count },
        seedBack,
      });
    }
    default:
      if (tool.kind === 'compost') return fail('这块地现在不用施肥');
      if (plot.stage === 'tilled') return fail('选一种种子再点这块地');
      if (plot.stage === 'growing') return fail('今天已经浇过水了');
      return fail('');
  }
}

/** 睡觉时：浇过水（或下了雨）的地长一天 */
export function growPlots(
  plots: Plot[],
  ctx: Pick<FarmContext, 'crops' | 'config'>,
  rained: boolean,
): number {
  let ripened = 0;
  for (const plot of plots) {
    if (plot.stage !== 'growing') continue;
    if (plot.watered || rained) {
      plot.grown += 1 + (plot.compost ? ctx.config.compostGrowBonus : 0);
      const crop = plot.cropId ? ctx.crops.get(plot.cropId) : undefined;
      if (crop && plot.grown >= crop.days) {
        plot.stage = 'ripe';
        ripened++;
      }
    }
    plot.watered = false;
  }
  return ripened;
}

/** 作物长到哪一步了：0 = 刚种下，1 = 成熟 */
export function growthOf(plot: Plot, crops: Map<string, Crop>): number {
  if (plot.stage === 'ripe') return 1;
  if (plot.stage !== 'growing' || !plot.cropId) return 0;
  const crop = crops.get(plot.cropId);
  return crop ? Math.min(1, plot.grown / crop.days) : 0;
}
