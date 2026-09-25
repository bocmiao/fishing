import type { Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import { PALETTE, hexToRgb, mixRgb, rgbToHex } from '../palette';

/**
 * 作物的俯视画法（占位，美术指南 PROP-010 到位后换成图片）。
 * 每株画在自己的 Graphics 里、原点是根部，这样可以整株轻轻摆动。
 * growth：0 = 刚冒芽，1 = 长成；ripe = 可以收了（结出玉米棒、麦穗、豆荚）。
 */

const SPROUT = hexToRgb(PALETTE.sprout);
const LEAF = hexToRgb(PALETTE.leaf);
const LEAF_DARK = hexToRgb(PALETTE.leafDark);
const WHEAT = hexToRgb(PALETTE.wheat);
const GOLD = hexToRgb(PALETTE.gold);
const CREAM = hexToRgb(PALETTE.cream);

/** 越嫩越偏嫩芽绿 */
function leafColor(growth: number, dark = false): number {
  return rgbToHex(mixRgb(SPROUT, dark ? LEAF_DARK : LEAF, Math.min(1, growth * 1.3)));
}

/** 一片细长的叶子：从根部往 angle 方向长 length，最宽处 width */
function leafShape(g: Graphics, angle: number, length: number, width: number, color: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const nx = -s;
  const ny = c;
  const at = (t: number, w: number) => [c * length * t + nx * w, s * length * t + ny * w] as const;
  const [ax, ay] = at(0.35, width * 0.5);
  const [bx, by] = at(0.35, -width * 0.5);
  g.moveTo(0, 0)
    .quadraticCurveTo(ax, ay, c * length, s * length)
    .quadraticCurveTo(bx, by, 0, 0)
    .fill({ color });
}

/** 一片椭圆的叶子（青菜）：中心在根部往 angle 方向 length/2 处 */
function ovalLeaf(g: Graphics, angle: number, length: number, width: number, color: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cx = c * length * 0.5;
  const cy = s * length * 0.5;
  const pts: number[] = [];
  for (let k = 0; k < 18; k++) {
    const t = (k / 18) * Math.PI * 2;
    // 靠根部窄一点，像勺子
    const w = width * 0.5 * (Math.cos(t) > 0 ? 1 : 0.65);
    const u = Math.cos(t) * length * 0.5;
    const v = Math.sin(t) * w;
    pts.push(cx + c * u - s * v, cy + s * u + c * v);
  }
  g.poly(pts).fill({ color });
}

function shadow(g: Graphics, r: number): void {
  g.ellipse(3, 4, r, r * 0.8).fill({ color: 0x000000, alpha: 0.14 });
}

function sprout(g: Graphics, growth: number, rng: Rng): void {
  const a = rng.range(0, Math.PI);
  const len = 6 + growth * 20;
  shadow(g, len * 0.6);
  leafShape(g, a, len, len * 0.7, rgbToHex(SPROUT));
  leafShape(g, a + Math.PI, len, len * 0.7, rgbToHex(SPROUT));
}

function corn(g: Graphics, growth: number, ripe: boolean, rng: Rng): void {
  const n = 7;
  const len = 14 + growth * 34;
  shadow(g, len * 0.7);
  const base = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    leafShape(g, a, len * rng.range(0.8, 1.05), 5 + growth * 4, leafColor(growth, i % 2 === 0));
  }
  if (ripe) {
    // 两根玉米棒：外面一层苞叶，里面露出金黄的玉米粒
    for (const a of [base + 0.6, base + 3.6]) {
      ovalLeaf(g, a, 28, 13, leafColor(1));
      ovalLeaf(g, a, 24, 9, rgbToHex(GOLD));
      g.circle(Math.cos(a) * 22, Math.sin(a) * 22, 2.4).fill({ color: rgbToHex(CREAM) });
    }
  }
  // 顶上的雄穗
  g.circle(0, 0, 3 + growth * 2).fill({ color: rgbToHex(ripe ? WHEAT : SPROUT) });
}

function wheat(g: Graphics, growth: number, ripe: boolean, rng: Rng): void {
  const n = 16;
  const len = 9 + growth * 22;
  shadow(g, len * 0.6);
  const color = ripe ? rgbToHex(WHEAT) : leafColor(growth);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const l = len * rng.range(0.6, 1);
    g.moveTo(0, 0)
      .lineTo(Math.cos(a) * l, Math.sin(a) * l)
      .stroke({ color, width: 2.2, cap: 'round' });
    if (ripe || growth > 0.85) {
      // 麦穗
      g.ellipse(Math.cos(a) * l, Math.sin(a) * l, 2.6, 2.6).fill({
        color: rgbToHex(mixRgb(WHEAT, GOLD, ripe ? 0.35 : 0)),
      });
    }
  }
}

function soybean(g: Graphics, growth: number, ripe: boolean, rng: Rng): void {
  const clusters = 4;
  const spread = 6 + growth * 12;
  const r = 4 + growth * 5;
  shadow(g, spread + r);
  const color = ripe ? rgbToHex(mixRgb(LEAF, WHEAT, 0.5)) : leafColor(growth);
  const base = rng.range(0, Math.PI * 2);
  for (let k = 0; k < clusters; k++) {
    const a = base + (k / clusters) * Math.PI * 2;
    const cx = Math.cos(a) * spread;
    const cy = Math.sin(a) * spread;
    // 三出复叶
    for (let j = 0; j < 3; j++) {
      const b = a + (j - 1) * 0.9;
      g.circle(cx + Math.cos(b) * r * 0.8, cy + Math.sin(b) * r * 0.8, r).fill({ color });
    }
    if (ripe) {
      g.ellipse(cx * 0.5, cy * 0.5, 2.5, 6)
        .fill({ color: rgbToHex(mixRgb(SPROUT, CREAM, 0.4)) })
        .stroke({ color: rgbToHex(LEAF_DARK), width: 0.8, alpha: 0.5 });
    }
  }
}

function scallion(g: Graphics, growth: number, ripe: boolean, rng: Rng): void {
  const n = 6;
  const len = 10 + growth * 26 + (ripe ? 4 : 0);
  shadow(g, len * 0.45);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const l = len * rng.range(0.7, 1);
    const ex = Math.cos(a) * l;
    const ey = Math.sin(a) * l;
    g.moveTo(0, 0)
      .lineTo(ex, ey)
      .stroke({ color: leafColor(growth, true), width: 4, cap: 'round' });
    g.moveTo(ex * 0.7, ey * 0.7)
      .lineTo(ex, ey)
      .stroke({ color: leafColor(growth), width: 2.4, cap: 'round' });
  }
  g.circle(0, 0, 3.2).fill({ color: rgbToHex(CREAM) });
}

function greens(g: Graphics, growth: number, ripe: boolean, rng: Rng): void {
  const n = 6;
  const len = 9 + growth * 20 + (ripe ? 3 : 0);
  shadow(g, len * 0.8);
  const base = rng.range(0, Math.PI * 2);
  // 勺子形的叶子，中间一道浅色叶脉
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2;
    ovalLeaf(g, a, len, 8 + growth * 11, leafColor(growth, i % 2 === 1));
    g.moveTo(0, 0)
      .lineTo(Math.cos(a) * len * 0.8, Math.sin(a) * len * 0.8)
      .stroke({ color: rgbToHex(mixRgb(SPROUT, CREAM, 0.5)), width: 1.4, alpha: 0.8 });
  }
  g.circle(0, 0, 3).fill({ color: rgbToHex(SPROUT) });
}

/** 画一株作物；cropId 不认识就画成嫩芽 */
export function drawCrop(
  g: Graphics,
  cropId: string,
  growth: number,
  ripe: boolean,
  rng: Rng,
): void {
  if (growth < 0.12 && !ripe) return sprout(g, growth, rng);
  switch (cropId) {
    case 'corn':
      return corn(g, growth, ripe, rng);
    case 'wheat':
      return wheat(g, growth, ripe, rng);
    case 'soybean':
      return soybean(g, growth, ripe, rng);
    case 'scallion':
      return scallion(g, growth, ripe, rng);
    case 'greens':
      return greens(g, growth, ripe, rng);
    default:
      return sprout(g, growth, rng);
  }
}
