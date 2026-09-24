import type { FishingPosition, ZoneType } from '../data/schema';

/** 岸边往上这么多（占画面高度）都算浅滩 */
const SHALLOW_BAND = 0.12;
const PRIORITY: Record<ZoneType, number> = { rocks: 4, weeds: 3, deep: 2, shallow: 1, open: 0 };

/**
 * 某个钓位上 (nx, ny) 处属于哪种区域。坐标按画面宽高归一化到 0~1。
 * 形状重叠时按 石缝 > 水草 > 深水 > 浅滩 > 开阔水面 取优先级高的。
 */
export function zoneAt(position: FishingPosition, nx: number, ny: number): ZoneType {
  let best: ZoneType = ny > position.bankY - SHALLOW_BAND ? 'shallow' : 'open';
  for (const z of position.zones) {
    const dx = (nx - z.x) / z.rx;
    const dy = (ny - z.y) / z.ry;
    if (dx * dx + dy * dy <= 1 && PRIORITY[z.type] > PRIORITY[best]) best = z.type;
  }
  return best;
}

/** 是否在水里（岸边以上） */
export function isWater(position: FishingPosition, ny: number): boolean {
  return ny < position.bankY;
}
