import type { GameData } from '../data/gameData';
import type { Recipe } from '../data/schema';
import type { Rng } from '../rng/rng';
import type { CaughtFish } from '../state';
import {
  canCook,
  dishPrice,
  emptyReserved,
  reserve,
  takeIngredients,
  type Pantry,
} from './kitchen';

/** 喵记小馆存档里的部分 */
export interface RestaurantState {
  /** 后厨的活鱼缸 */
  tank: CaughtFish[];
  /** 今天的菜单（菜谱 id） */
  menu: string[];
  /** 口碑：越高客人来得越勤，还会有新客人 */
  reputation: number;
  /** 自己不开门的日子，让小满代班 */
  helper: boolean;
  /** 哪一天已经营业过（自己开门或者小满代班）；-1 = 还没营业过 */
  servedDay: number;
  /** 攒下的鱼杂剩菜（满 1 份变成一份堆肥） */
  scraps: number;
  totalGuests: number;
}

export function newRestaurant(): RestaurantState {
  return {
    tank: [],
    menu: [],
    reputation: 0,
    helper: true,
    servedDay: -1,
    scraps: 0,
    totalGuests: 0,
  };
}

export interface HelperResult {
  dishes: string[];
  earned: number;
}

/** 做一道鱼菜攒下的鱼杂剩菜，攒满一份就进堆肥箱 */
export function addScraps(
  r: RestaurantState,
  recipe: Recipe,
  amount: number,
  pantry: Pantry,
): number {
  if (!recipe.fish) return 0;
  r.scraps += amount;
  const whole = Math.floor(r.scraps);
  r.scraps -= whole;
  pantry.inventory.add('compost', whole);
  return whole;
}

/** 口碑涨一点：做得越好涨得越多 */
export function reputationGain(quality: number): number {
  return 0.4 + 0.8 * quality;
}

/**
 * 小满代班：按菜单能做几道做几道（一晚上最多 dishes 道），菜做得一般，收入打折。
 * 不开心的事一概没有：做不出来就少卖几道。
 */
export function runHelper(
  r: RestaurantState,
  pantry: Pantry,
  data: GameData,
  rng: Rng,
): HelperResult {
  const cfg = data.restaurant.helper;
  const limit = rng.int(cfg.dishes[0], cfg.dishes[1]) + Math.floor(r.reputation / 15);
  const dishes: string[] = [];
  let earned = 0;
  for (let i = 0; i < limit; i++) {
    const cookable = r.menu
      .map((id) => data.recipeById.get(id))
      .filter((rec): rec is Recipe => !!rec && canCook(rec, pantry));
    if (cookable.length === 0) break;
    const recipe = rng.pick(cookable);
    const uids = reserve(recipe, pantry, emptyReserved());
    const fish = uids && takeIngredients(recipe, pantry, uids);
    if (!fish) break;
    earned += Math.round(dishPrice(recipe, fish, cfg.quality) * cfg.share);
    addScraps(r, recipe, data.restaurant.compostPerFishDish, pantry);
    r.reputation += reputationGain(cfg.quality) * 0.3;
    r.totalGuests++;
    dishes.push(recipe.name);
  }
  return { dishes, earned };
}
