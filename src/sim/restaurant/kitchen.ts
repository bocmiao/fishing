import type { Recipe } from '../data/schema';
import type { Inventory } from '../inventory';
import type { CaughtFish } from '../state';

/**
 * 后厨：一道菜要用哪些鱼和配料、够不够、做出来卖多少钱。
 * 鱼只从活鱼缸里拿（鱼护里的鱼要先放进缸里）。
 */

export interface Pantry {
  inventory: Inventory;
  tank: CaughtFish[];
}

/** 已经被别的订单预留下的东西（客人点了菜、还没开始做） */
export interface Reserved {
  fish: Set<number>;
  goods: Map<string, number>;
}

export function emptyReserved(): Reserved {
  return { fish: new Set(), goods: new Map() };
}

function fishFits(recipe: Recipe, f: CaughtFish): boolean {
  const species = recipe.fish?.species ?? [];
  return species.length === 0 || species.includes(f.speciesId);
}

/**
 * 这道菜用缸里的哪几条鱼。指定了鱼种的菜挑大的（大鱼做的菜贵），
 * "什么鱼都行"的菜挑小的，把好鱼留给招牌菜。不够返回 null。
 */
export function pickFish(
  recipe: Recipe,
  tank: CaughtFish[],
  reserved: Reserved,
): CaughtFish[] | null {
  if (!recipe.fish) return [];
  const any = recipe.fish.species.length === 0;
  const pool = tank
    .filter((f) => !reserved.fish.has(f.uid) && fishFits(recipe, f))
    .sort((a, b) => (any ? a.weightKg - b.weightKg : b.weightKg - a.weightKg));
  return pool.length >= recipe.fish.count ? pool.slice(0, recipe.fish.count) : null;
}

export function goodsAvailable(recipe: Recipe, inventory: Inventory, reserved: Reserved): boolean {
  return Object.entries(recipe.goods).every(
    ([id, n]) => inventory.count(id) - (reserved.goods.get(id) ?? 0) >= n,
  );
}

export function canCook(recipe: Recipe, pantry: Pantry, reserved = emptyReserved()): boolean {
  return (
    goodsAvailable(recipe, pantry.inventory, reserved) &&
    pickFish(recipe, pantry.tank, reserved) !== null
  );
}

/** 把一道菜的材料记到预留里，返回预留了哪几条鱼 */
export function reserve(recipe: Recipe, pantry: Pantry, reserved: Reserved): number[] | null {
  if (!goodsAvailable(recipe, pantry.inventory, reserved)) return null;
  const fish = pickFish(recipe, pantry.tank, reserved);
  if (!fish) return null;
  for (const f of fish) reserved.fish.add(f.uid);
  for (const [id, n] of Object.entries(recipe.goods)) {
    reserved.goods.set(id, (reserved.goods.get(id) ?? 0) + n);
  }
  return fish.map((f) => f.uid);
}

export function release(recipe: Recipe, fishUids: number[], reserved: Reserved): void {
  for (const uid of fishUids) reserved.fish.delete(uid);
  for (const [id, n] of Object.entries(recipe.goods)) {
    reserved.goods.set(id, Math.max(0, (reserved.goods.get(id) ?? 0) - n));
  }
}

/** 真正下锅：从缸里捞出这几条鱼、从库存里拿走配料。材料不齐就什么也不拿 */
export function takeIngredients(
  recipe: Recipe,
  pantry: Pantry,
  fishUids: number[],
): CaughtFish[] | null {
  const fish = fishUids.map((uid) => pantry.tank.find((f) => f.uid === uid));
  if (fish.some((f) => !f) || !pantry.inventory.hasAll(recipe.goods)) return null;
  pantry.inventory.takeAll(recipe.goods);
  for (const f of fish) pantry.tank.splice(pantry.tank.indexOf(f!), 1);
  return fish as CaughtFish[];
}

const SIZE_BONUS: Record<CaughtFish['sizeClass'], number> = {
  small: 0,
  medium: 0.1,
  large: 0.25,
  huge: 0.4,
};

/** 一道菜卖多少钱：quality 0~1 是做菜小游戏的成绩；鱼越大越贵 */
export function dishPrice(recipe: Recipe, fish: CaughtFish[], quality: number): number {
  const size =
    fish.length === 0
      ? 0
      : fish.reduce((s, f) => s + SIZE_BONUS[f.sizeClass] + (f.trophy ? 0.3 : 0), 0) / fish.length;
  return Math.round(recipe.price * (0.75 + 0.5 * quality) * (1 + size));
}

/** 做得特别好，客人多给的小费 */
export function tipFor(price: number, quality: number): number {
  return quality >= 0.85 ? Math.round(price * 0.15) : 0;
}
