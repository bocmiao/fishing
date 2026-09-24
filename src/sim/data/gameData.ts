import { z } from 'zod';
import fishJson from '../../../data/fish.json';
import itemsJson from '../../../data/items.json';
import spotsJson from '../../../data/spots.json';
import {
  FishSpeciesSchema,
  ItemsSchema,
  SpotSchema,
  type FishSpecies,
  type Items,
  type Spot,
} from './schema';

export interface GameData {
  species: FishSpecies[];
  speciesById: Map<string, FishSpecies>;
  spots: Spot[];
  spotById: Map<string, Spot>;
  items: Items;
}

/** 校验并整理配置表；出错时抛出带路径的错误信息 */
export function parseGameData(raw: { fish: unknown; spots: unknown; items: unknown }): GameData {
  const species = z.object({ species: z.array(FishSpeciesSchema) }).parse(raw.fish).species;
  const spots = z.object({ spots: z.array(SpotSchema) }).parse(raw.spots).spots;
  const items = ItemsSchema.parse(raw.items);

  const speciesById = new Map<string, FishSpecies>();
  for (const s of species) {
    if (speciesById.has(s.id)) throw new Error(`鱼种 id 重复：${s.id}`);
    speciesById.set(s.id, s);
  }
  const spotById = new Map<string, Spot>();
  for (const spot of spots) spotById.set(spot.id, spot);
  const baitIds = new Set(items.baits.map((b) => b.id));
  for (const s of species) {
    for (const spotId of s.spots) {
      if (!spotById.has(spotId)) throw new Error(`鱼种 ${s.id} 引用了不存在的钓点 ${spotId}`);
    }
    for (const baitId of Object.keys(s.baits)) {
      if (!baitIds.has(baitId)) throw new Error(`鱼种 ${s.id} 引用了不存在的饵料 ${baitId}`);
    }
  }
  return { species, speciesById, spots, spotById, items };
}

let cached: GameData | null = null;

export function getGameData(): GameData {
  return (cached ??= parseGameData({ fish: fishJson, spots: spotsJson, items: itemsJson }));
}
