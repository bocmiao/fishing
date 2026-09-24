import { FISH_TEX_H, FISH_TEX_W, paintKoi } from './koiPainter';
import type { KoiLook } from './koiLook';

/** 把一条鱼画成图片（data URL），给界面上的卡片用 */
export function renderFishImage(look: KoiLook, scale = 2): string {
  const w = Math.round(FISH_TEX_W * scale);
  const h = Math.round(FISH_TEX_H * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(w, h);
  paintKoi(look, image.data, w, 0, 0, scale);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
