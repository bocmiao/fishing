import type { GameData } from './data/gameData';
import type { Upgrade } from './data/schema';

/**
 * 升级（添置渔具、修缮老宅、装修小馆）：每一项的效果是"升级后的新值"。
 * 这里把买过的升级合起来算出现在的各项数值，GameState 用它设鱼护容量、换鱼竿等。
 */
export interface UpgradeStats {
  keepNetCapacity: number;
  pondCapacity: number;
  plots: number;
  rodId: string;
  lineId: string;
  dailyWorms: number;
  tankCapacity: number;
  menuSize: number;
  tables: number;
  cookingEase: number;
  reputationBonus: number;
}

export function baseStats(data: GameData): UpgradeStats {
  return {
    keepNetCapacity: data.items.keepNetCapacity,
    pondCapacity: data.pond.capacity,
    plots: data.farm.plots,
    rodId: data.items.rods[0]!.id,
    lineId: data.items.lines[0]!.id,
    dailyWorms: 0,
    tankCapacity: data.restaurant.tankCapacity,
    menuSize: data.restaurant.menuSize,
    tables: data.restaurant.tables,
    cookingEase: 1,
    reputationBonus: 0,
  };
}

/** 买过的升级合起来的数值：数字取最大的；鱼竿、鱼线按配置表里的顺序，后面的更好 */
export function statsWith(data: GameData, owned: ReadonlySet<string>): UpgradeStats {
  const s = baseStats(data);
  const rodRank = (id: string) => data.items.rods.findIndex((r) => r.id === id);
  const lineRank = (id: string) => data.items.lines.findIndex((l) => l.id === id);
  for (const u of data.upgrades) {
    if (!owned.has(u.id)) continue;
    const e = u.effect;
    if (e.keepNetCapacity) s.keepNetCapacity = Math.max(s.keepNetCapacity, e.keepNetCapacity);
    if (e.pondCapacity) s.pondCapacity = Math.max(s.pondCapacity, e.pondCapacity);
    if (e.plots) s.plots = Math.max(s.plots, e.plots);
    if (e.rod && rodRank(e.rod) > rodRank(s.rodId)) s.rodId = e.rod;
    if (e.line && lineRank(e.line) > lineRank(s.lineId)) s.lineId = e.line;
    if (e.dailyWorms) s.dailyWorms = Math.max(s.dailyWorms, e.dailyWorms);
    if (e.tankCapacity) s.tankCapacity = Math.max(s.tankCapacity, e.tankCapacity);
    if (e.menuSize) s.menuSize = Math.max(s.menuSize, e.menuSize);
    if (e.tables) s.tables = Math.max(s.tables, e.tables);
    if (e.cookingEase) s.cookingEase = Math.max(s.cookingEase, e.cookingEase);
    if (e.reputationBonus) s.reputationBonus = Math.max(s.reputationBonus, e.reputationBonus);
  }
  return s;
}

export type UpgradeStatus = 'owned' | 'available' | 'locked';

export function upgradeStatus(upgrade: Upgrade, owned: ReadonlySet<string>): UpgradeStatus {
  if (owned.has(upgrade.id)) return 'owned';
  if (upgrade.requires && !owned.has(upgrade.requires)) return 'locked';
  return 'available';
}

/** 给玩家看的一句话：这项升级让什么从多少变成多少 */
export function describeEffect(data: GameData, now: UpgradeStats, upgrade: Upgrade): string {
  const e = upgrade.effect;
  const parts: string[] = [];
  if (e.keepNetCapacity) parts.push(`鱼护 ${now.keepNetCapacity} → ${e.keepNetCapacity} 条`);
  if (e.pondCapacity) parts.push(`方塘 ${now.pondCapacity} → ${e.pondCapacity} 条`);
  if (e.plots) parts.push(`菜地 ${now.plots} → ${e.plots} 块`);
  if (e.rod) {
    const a = data.items.rods.find((r) => r.id === now.rodId)!;
    const b = data.items.rods.find((r) => r.id === e.rod)!;
    parts.push(`抛竿 ${a.range} → ${b.range}，收线 ${a.reelSpeed} → ${b.reelSpeed}`);
  }
  if (e.line) {
    const a = data.items.lines.find((l) => l.id === now.lineId)!;
    const b = data.items.lines.find((l) => l.id === e.line)!;
    parts.push(`鱼线强度 ${a.strength} → ${b.strength}`);
  }
  if (e.dailyWorms) parts.push(`每天早上多 ${e.dailyWorms} 条蚯蚓`);
  if (e.tankCapacity) parts.push(`活鱼缸 ${now.tankCapacity} → ${e.tankCapacity} 条`);
  if (e.menuSize) parts.push(`菜单 ${now.menuSize} → ${e.menuSize} 道`);
  if (e.tables) parts.push(`桌子 ${now.tables} → ${e.tables} 张`);
  if (e.cookingEase) parts.push(`做菜好区宽 ${Math.round((e.cookingEase - 1) * 100)}%`);
  if (e.reputationBonus) parts.push(`口碑多涨 ${Math.round(e.reputationBonus * 100)}%`);
  return parts.join('，');
}
