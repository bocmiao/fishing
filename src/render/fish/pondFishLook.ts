import type { GameData } from '../../sim/data/gameData';
import { Rng } from '../../sim/rng/rng';
import type { PondFish } from '../../sim/state';
import { screenLength } from '../fishing/wildFish';
import { FISH_TEX_H, FISH_TEX_W } from './koiPainter';
import { koiLookOf, type KoiLook } from './koiLook';
import { speciesLook } from './speciesLook';

export interface PondFishLook {
  look: KoiLook;
  /** 屏幕上的体长（像素），和小溪里同一个比例 */
  length: number;
  /** 身体网格的宽高比 */
  aspect: number;
}

/**
 * 塘里一条鱼的长相：锦鲤按品种画，野生鱼按配置表的配色画。
 * 都用鱼自己的 lookSeed，所以和上鱼卡片上的是同一条鱼。
 */
export function pondFishLook(fish: PondFish, data: GameData): PondFishLook {
  const rng = new Rng(fish.lookSeed);
  const species = fish.speciesId ? data.speciesById.get(fish.speciesId) : undefined;
  if (!species) {
    return {
      look: koiLookOf(fish.variety ?? '', rng),
      length: 18 + fish.lengthCm * 1.9,
      aspect: FISH_TEX_H / FISH_TEX_W,
    };
  }
  const shape = species.shape;
  return {
    look: speciesLook(species, rng),
    length: screenLength(species, fish.lengthCm),
    aspect: (FISH_TEX_H / FISH_TEX_W) * (shape === 'eel' ? 1.25 : shape === 'slender' ? 0.9 : 1.05),
  };
}
