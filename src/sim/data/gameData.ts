import { z } from 'zod';
import cropsJson from '../../../data/crops.json';
import farmJson from '../../../data/farm.json';
import fishJson from '../../../data/fish.json';
import goodsJson from '../../../data/goods.json';
import itemsJson from '../../../data/items.json';
import placesJson from '../../../data/places.json';
import pondJson from '../../../data/pond.json';
import recipesJson from '../../../data/recipes.json';
import restaurantJson from '../../../data/restaurant.json';
import spotsJson from '../../../data/spots.json';
import upgradesJson from '../../../data/upgrades.json';
import {
  CropSchema,
  FarmSchema,
  FishSpeciesSchema,
  GoodsSchema,
  ItemsSchema,
  PlacesSchema,
  PondSchema,
  RecipeSchema,
  RestaurantSchema,
  SpotSchema,
  UpgradesSchema,
  type Area,
  type Craft,
  type Crop,
  type FarmConfig,
  type FishSpecies,
  type Items,
  type Place,
  type PondConfig,
  type Recipe,
  type RestaurantConfig,
  type Spot,
  type Upgrade,
  type Upgrades,
} from './schema';

export interface GameData {
  species: FishSpecies[];
  speciesById: Map<string, FishSpecies>;
  spots: Spot[];
  spotById: Map<string, Spot>;
  items: Items;
  pond: PondConfig;
  crops: Crop[];
  cropById: Map<string, Crop>;
  crafts: Craft[];
  farm: FarmConfig;
  places: Place[];
  placeById: Map<string, Place>;
  homePlace: string;
  recipes: Recipe[];
  recipeById: Map<string, Recipe>;
  restaurant: RestaurantConfig;
  upgrades: Upgrade[];
  upgradeById: Map<string, Upgrade>;
  upgradeGroups: Upgrades['groups'];
  /** 库存里每种东西的名字（饵料、货物、种子） */
  itemNames: Map<string, string>;
  /** 杂货铺的价格 */
  itemPrices: Map<string, number>;
  /** 杂货铺卖什么（饵料、配料、所有种子） */
  shopItems: string[];
  travelMinutes(from: Area, to: Area): number;
}

/** 种子在库存里的 id */
export function seedId(cropId: string): string {
  return `seed:${cropId}`;
}

export interface RawGameData {
  fish: unknown;
  spots: unknown;
  items: unknown;
  pond: unknown;
  goods: unknown;
  crops: unknown;
  farm: unknown;
  places: unknown;
  recipes: unknown;
  restaurant: unknown;
  upgrades: unknown;
}

/** 校验并整理配置表；出错时抛出带路径的错误信息 */
export function parseGameData(raw: RawGameData): GameData {
  const species = z.object({ species: z.array(FishSpeciesSchema) }).parse(raw.fish).species;
  const spots = z.object({ spots: z.array(SpotSchema) }).parse(raw.spots).spots;
  const items = ItemsSchema.parse(raw.items);
  const pond = PondSchema.parse(raw.pond);
  const goods = GoodsSchema.parse(raw.goods);
  const crops = z.object({ crops: z.array(CropSchema) }).parse(raw.crops).crops;
  const farm = FarmSchema.parse(raw.farm);
  const places = PlacesSchema.parse(raw.places);
  const recipes = z.object({ recipes: z.array(RecipeSchema) }).parse(raw.recipes).recipes;
  const restaurant = RestaurantSchema.parse(raw.restaurant);
  const upgrades = UpgradesSchema.parse(raw.upgrades);

  const speciesById = unique(species, '鱼种');
  const spotById = unique(spots, '钓点');
  const cropById = unique(crops, '作物');
  const placeById = unique(places.places, '地点');
  const recipeById = unique(recipes, '菜谱');
  const upgradeById = unique(upgrades.upgrades, '升级');

  const itemNames = new Map<string, string>();
  const itemPrices = new Map<string, number>();
  for (const b of items.baits) {
    itemNames.set(b.id, b.name);
    itemPrices.set(b.id, b.price);
  }
  for (const g of goods.goods) {
    if (itemNames.has(g.id)) throw new Error(`物品 id 重复：${g.id}`);
    itemNames.set(g.id, g.name);
    itemPrices.set(g.id, g.price);
  }
  for (const c of crops) {
    itemNames.set(seedId(c.id), `${c.name}种子`);
    itemPrices.set(seedId(c.id), c.seedPrice);
  }

  const baitIds = new Set(items.baits.map((b) => b.id));
  for (const s of species) {
    for (const spotId of s.spots) {
      if (!spotById.has(spotId)) throw new Error(`鱼种 ${s.id} 引用了不存在的钓点 ${spotId}`);
    }
    for (const baitId of Object.keys(s.baits)) {
      if (!baitIds.has(baitId)) throw new Error(`鱼种 ${s.id} 引用了不存在的饵料 ${baitId}`);
    }
  }
  for (const c of crops) {
    if (!itemNames.has(c.produce)) throw new Error(`作物 ${c.id} 的收获 ${c.produce} 不存在`);
    if (c.yield[0] > c.yield[1]) throw new Error(`作物 ${c.id} 的收获数量写反了`);
  }
  for (const craft of goods.crafts) {
    for (const id of [...Object.keys(craft.inputs), ...Object.keys(craft.outputs)]) {
      if (!itemNames.has(id)) throw new Error(`加工 ${craft.id} 用到了不存在的东西 ${id}`);
    }
  }
  if (!placeById.has(places.home)) throw new Error(`家 ${places.home} 不在地点表里`);
  const shopItems = [...goods.shop, ...crops.map((c) => seedId(c.id))];
  for (const id of [...shopItems, ...Object.keys(items.startGoods)]) {
    if (!itemNames.has(id)) throw new Error(`杂货铺或开局物品里的 ${id} 不存在`);
  }
  for (const r of recipes) {
    for (const id of r.fish?.species ?? []) {
      if (!speciesById.has(id)) throw new Error(`菜谱 ${r.id} 用到了不存在的鱼 ${id}`);
    }
    for (const id of Object.keys(r.goods)) {
      if (!itemNames.has(id)) throw new Error(`菜谱 ${r.id} 用到了不存在的配料 ${id}`);
    }
  }
  const groupIds = new Set(upgrades.groups.map((g) => g.id));
  for (const u of upgrades.upgrades) {
    if (!groupIds.has(u.group)) throw new Error(`升级 ${u.id} 的分组 ${u.group} 不存在`);
    if (u.requires && !upgradeById.has(u.requires)) {
      throw new Error(`升级 ${u.id} 要求的 ${u.requires} 不存在`);
    }
    if (u.effect.rod && !items.rods.some((r) => r.id === u.effect.rod)) {
      throw new Error(`升级 ${u.id} 换上的鱼竿 ${u.effect.rod} 不存在`);
    }
    if (u.effect.line && !items.lines.some((l) => l.id === u.effect.line)) {
      throw new Error(`升级 ${u.id} 换上的鱼线 ${u.effect.line} 不存在`);
    }
  }
  for (const g of restaurant.guests) {
    for (const id of g.likes) {
      if (!recipeById.has(id)) throw new Error(`客人 ${g.id} 爱吃的 ${id} 不在菜谱里`);
    }
  }

  const travel = places.travel;
  const travelMinutes = (from: Area, to: Area): number => {
    const t = travel.find(
      (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
    );
    return t?.minutes ?? 0;
  };

  return {
    species,
    speciesById,
    spots,
    spotById,
    items,
    pond,
    crops,
    cropById,
    crafts: goods.crafts,
    farm,
    places: places.places,
    placeById,
    homePlace: places.home,
    recipes,
    recipeById,
    restaurant,
    upgrades: upgrades.upgrades,
    upgradeById,
    upgradeGroups: upgrades.groups,
    itemNames,
    itemPrices,
    shopItems,
    travelMinutes,
  };
}

function unique<T extends { id: string }>(list: T[], what: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const x of list) {
    if (map.has(x.id)) throw new Error(`${what} id 重复：${x.id}`);
    map.set(x.id, x);
  }
  return map;
}

let cached: GameData | null = null;

export function getGameData(): GameData {
  return (cached ??= parseGameData({
    fish: fishJson,
    spots: spotsJson,
    items: itemsJson,
    pond: pondJson,
    goods: goodsJson,
    crops: cropsJson,
    farm: farmJson,
    places: placesJson,
    recipes: recipesJson,
    restaurant: restaurantJson,
    upgrades: upgradesJson,
  }));
}
