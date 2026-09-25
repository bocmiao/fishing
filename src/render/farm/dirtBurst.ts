import { Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import { PALETTE } from '../palette';

interface Clod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 离地高度（俯视看不到，用来算影子和落地） */
  z: number;
  vz: number;
  r: number;
  color: number;
  age: number;
  life: number;
}

interface Worm {
  x: number;
  y: number;
  angle: number;
  len: number;
  phase: number;
  age: number;
  life: number;
}

/** 挖地时飞起来的土块、浇水的水珠，还有翻出来扭几下的蚯蚓 */
export class DirtBurst {
  readonly node = new Graphics();
  private readonly clods: Clod[] = [];
  private readonly worms: Worm[] = [];

  burst(x: number, y: number, count: number, rng: Rng, color: number = PALETTE.soil): void {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const v = rng.range(40, 160);
      this.clods.push({
        x: x + rng.range(-30, 30),
        y: y + rng.range(-20, 20),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.7,
        z: 0,
        vz: rng.range(120, 260),
        r: rng.range(2.5, 6),
        color,
        age: 0,
        life: rng.range(0.8, 1.4),
      });
    }
  }

  addWorms(x: number, y: number, count: number, rng: Rng): void {
    for (let i = 0; i < count; i++) {
      this.worms.push({
        x: x + rng.range(-60, 60),
        y: y + rng.range(-40, 40),
        angle: rng.range(0, Math.PI * 2),
        len: rng.range(16, 24),
        phase: rng.range(0, Math.PI * 2),
        age: 0,
        life: rng.range(1.4, 2),
      });
    }
  }

  update(dt: number): void {
    const g = this.node;
    g.clear();
    for (let i = this.clods.length - 1; i >= 0; i--) {
      const c = this.clods[i]!;
      c.age += dt;
      if (c.z > 0 || c.vz > 0) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vz -= 700 * dt;
        c.z = Math.max(0, c.z + c.vz * dt);
        if (c.z === 0) c.vz = 0;
      }
      const alpha = Math.min(1, (c.life - c.age) / 0.3);
      if (c.age >= c.life) {
        this.clods.splice(i, 1);
        continue;
      }
      g.circle(c.x + c.z * 0.25, c.y + c.z * 0.3, c.r).fill({
        color: 0x000000,
        alpha: 0.15 * alpha,
      });
      g.circle(c.x, c.y - c.z * 0.5, c.r).fill({ color: c.color, alpha });
    }
    for (let i = this.worms.length - 1; i >= 0; i--) {
      const w = this.worms[i]!;
      w.age += dt;
      if (w.age >= w.life) {
        this.worms.splice(i, 1);
        continue;
      }
      const alpha = Math.min(1, w.age / 0.15, (w.life - w.age) / 0.4);
      // 一条扭来扭去的小曲线
      const c = Math.cos(w.angle);
      const s = Math.sin(w.angle);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6 - 0.5;
        const wave = Math.sin(t * 7 + w.phase + w.age * 9) * 3.2;
        pts.push([w.x + c * t * w.len - s * wave, w.y + s * t * w.len + c * wave]);
      }
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [px, py] of pts.slice(1)) g.lineTo(px, py);
      g.stroke({ color: PALETTE.worm, width: 4, cap: 'round', join: 'round', alpha });
    }
  }
}
