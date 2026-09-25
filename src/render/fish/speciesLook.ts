import type { Rng } from '../../sim/rng/rng';
import type { FishSpecies } from '../../sim/data/schema';
import { mixRgb, type Rgb } from '../palette';
import type { KoiLook, PatchBlob } from './koiLook';

function hex(color: string): Rgb {
  const n = parseInt(color.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** 把配置表里野生鱼的配色换成画笔能用的 KoiLook，每条鱼略有差异 */
export function speciesLook(species: FishSpecies, rng: Rng): KoiLook {
  const look = species.look;
  const k = 1 + rng.range(-0.05, 0.05);
  const base = hex(look.base).map((c) => c * k) as unknown as Rgb;
  const back = hex(look.back);
  const shape = species.shape;
  const result: KoiLook = {
    variety: species.name,
    base,
    back,
    metallic: shape === 'slender' ? 0.25 : 0.08,
    scales: 'normal',
    scaleTint: mixRgb(back, [0, 0, 0], 0.3),
    scaleStrength: look.scales,
    patches: [],
    tancho: null,
    fin: hex(look.fin),
    finAlpha: look.finAlpha,
    plump: shape === 'slender' ? rng.range(0.74, 0.82) : shape === 'eel' ? 1 : rng.range(0.95, 1.1),
    finLength: shape === 'eel' ? 0.7 : rng.range(0.85, 1.0),
    seed: rng.int(1, 1_000_000),
    shape,
  };
  if (look.spots) {
    const blobs: PatchBlob[] = Array.from({ length: rng.int(14, 24) }, () => ({
      u: rng.range(0.1, shape === 'eel' ? 0.95 : 0.74),
      v: rng.range(-0.9, 0.9),
      ru: rng.range(0.008, 0.02),
      rv: rng.range(0.12, 0.3),
    }));
    result.patches.push({ color: hex(look.spots), blobs, edgeNoise: 0.3, opacity: 0.75 });
  }
  if (look.bars) {
    // 横纹：沿身体等距排开的窄条
    const blobs: PatchBlob[] = [];
    for (let u = 0.2; u < 0.72; u += rng.range(0.055, 0.07)) {
      blobs.push({ u, v: 0, ru: 0.014, rv: 1.6 });
    }
    result.patches.push({ color: hex(look.bars), blobs, edgeNoise: 0.35, opacity: 0.8 });
  }
  return result;
}
