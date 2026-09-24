import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import type { Rect } from '../flock/flock';

interface Pad {
  node: Container;
  shadow: Graphics;
  baseRotation: number;
  sway: number;
  x: number;
  y: number;
}

/** 一片睡莲叶（俯视）：带缺口的圆，叶脉从中心放射 */
function drawPad(g: Graphics, r: number, notchAngle: number, rng: Rng, shadow = false): void {
  const notch = rng.range(0.28, 0.42);
  const a0 = notchAngle + notch / 2;
  const a1 = notchAngle + Math.PI * 2 - notch / 2;
  const shape = (radius: number) => {
    g.moveTo(0, 0);
    g.arc(0, 0, radius, a0, a1);
    g.closePath();
  };
  if (shadow) {
    shape(r);
    g.fill({ color: 0x0f231d, alpha: 0.26 });
    return;
  }
  const hue = rng.range(-1, 1);
  const base = hue > 0.3 ? 0x6a9460 : hue < -0.3 ? 0x5b8858 : 0x638e5c;
  shape(r);
  g.fill({ color: base });
  // 内圈略亮
  shape(r * 0.78);
  g.fill({ color: 0x7ea673, alpha: 0.35 });
  // 叶脉
  const veins = 11 + Math.floor(rng.range(0, 5));
  for (let i = 0; i < veins; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / veins;
    g.moveTo(Math.cos(a) * r * 0.08, Math.sin(a) * r * 0.08);
    g.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93);
  }
  g.stroke({ width: 1.1, color: 0x4a7447, alpha: 0.45 });
  // 边缘
  g.arc(0, 0, r - 0.8, a0, a1);
  g.stroke({ width: 1.6, color: 0x46704a, alpha: 0.55 });
  // 左上的受光面
  g.arc(0, 0, r * 0.62, Math.PI * 1.05, Math.PI * 1.45);
  g.stroke({ width: r * 0.35, color: 0xa9c79a, alpha: 0.12 });
}

/** 一朵睡莲花（俯视）：几层花瓣，中间是黄色花蕊 */
function drawFlower(g: Graphics, r: number, rng: Rng): void {
  const layers = [
    { count: 10, len: r, wid: r * 0.32, color: 0xf1e2e0, tip: 0xe3adb6 },
    { count: 8, len: r * 0.72, wid: r * 0.28, color: 0xf7ecea, tip: 0xeab9c1 },
    { count: 6, len: r * 0.46, wid: r * 0.22, color: 0xfbf4f1, tip: 0xf0c9ce },
  ];
  const spin = rng.range(0, Math.PI * 2);
  // 每片花瓣是一个两头尖的多边形，从花心向外旋转排开
  layers.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      const a = spin + (i / layer.count) * Math.PI * 2 + li * 0.3;
      const pts: number[] = [];
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const along = t * layer.len;
        const half = Math.sin(t * Math.PI) * layer.wid * 0.5 * (1 - 0.3 * t);
        pts.push(along, half);
      }
      for (let s = steps; s >= 0; s--) {
        const t = s / steps;
        const along = t * layer.len;
        const half = Math.sin(t * Math.PI) * layer.wid * 0.5 * (1 - 0.3 * t);
        pts.push(along, -half);
      }
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rotated: number[] = [];
      for (let k = 0; k < pts.length; k += 2) {
        rotated.push(pts[k]! * ca - pts[k + 1]! * sa, pts[k]! * sa + pts[k + 1]! * ca);
      }
      g.poly(rotated).fill({ color: layer.color });
      g.poly(rotated).stroke({ width: 0.8, color: layer.tip, alpha: 0.55 });
    }
  });
  g.circle(0, 0, r * 0.2).fill({ color: 0xe8c35a });
  g.circle(-r * 0.05, -r * 0.05, r * 0.1).fill({ color: 0xf3db8a });
}

/**
 * 几丛睡莲，浮在水面、轻轻摇动。叶子的影子落在池底。
 */
export class LilyPads {
  readonly surface = new Container();
  readonly shadows = new Container();
  private readonly pads: Pad[] = [];
  private time = 0;

  constructor(bounds: Rect, avoid: Rect[], rng: Rng, clusters = 4) {
    const spots = this.pickClusterSpots(bounds, avoid, rng, clusters);
    for (const spot of spots) {
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const r = rng.range(22, 48) * (i === 0 ? 1.15 : 1);
        const ang = rng.range(0, Math.PI * 2);
        const dist = i === 0 ? 0 : rng.range(40, 95);
        const x = spot.x + Math.cos(ang) * dist;
        const y = spot.y + Math.sin(ang) * dist;
        const node = new Container();
        const leaf = new Graphics();
        const notch = rng.range(0, Math.PI * 2);
        drawPad(leaf, r, notch, rng);
        node.addChild(leaf);
        if (rng.chance(0.3)) {
          const flower = new Graphics();
          drawFlower(flower, r * rng.range(0.45, 0.6), rng);
          flower.position.set(rng.range(-r * 0.2, r * 0.2), rng.range(-r * 0.2, r * 0.2));
          node.addChild(flower);
        }
        const shadow = new Graphics();
        drawPad(shadow, r * 1.02, notch, rng, true);
        node.position.set(x, y);
        shadow.position.set(x + 10, y + 12);
        this.surface.addChild(node);
        this.shadows.addChild(shadow);
        this.pads.push({ node, shadow, baseRotation: 0, sway: rng.range(0, Math.PI * 2), x, y });
      }
    }
  }

  private pickClusterSpots(
    bounds: Rect,
    avoid: Rect[],
    rng: Rng,
    count: number,
  ): { x: number; y: number }[] {
    const spots: { x: number; y: number }[] = [];
    for (let tries = 0; tries < 200 && spots.length < count; tries++) {
      // 靠近边缘
      const edge = rng.int(0, 3);
      const inset = rng.range(60, 190);
      let x = rng.range(bounds.x + 80, bounds.x + bounds.w - 80);
      let y = rng.range(bounds.y + 80, bounds.y + bounds.h - 80);
      if (edge === 0) y = bounds.y + inset;
      else if (edge === 1) y = bounds.y + bounds.h - inset;
      else if (edge === 2) x = bounds.x + inset;
      else x = bounds.x + bounds.w - inset;
      const blocked = avoid.some(
        (r) => x > r.x - 160 && x < r.x + r.w + 160 && y > r.y - 160 && y < r.y + r.h + 160,
      );
      const crowded = spots.some((s) => Math.hypot(s.x - x, s.y - y) < 420);
      if (!blocked && !crowded) spots.push({ x, y });
    }
    return spots;
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.pads) {
      p.sway += dt * 0.35;
      const rot = Math.sin(p.sway) * 0.05;
      const dx = Math.sin(p.sway * 0.7) * 1.5;
      p.node.rotation = rot;
      p.node.position.set(p.x + dx, p.y);
      p.shadow.rotation = rot;
      p.shadow.position.set(p.x + dx + 10, p.y + 12);
    }
  }
}
