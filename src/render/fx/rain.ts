import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import type { Rect } from '../flock/flock';

interface Drop {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}

/**
 * 雨：水面上此起彼伏的小圆圈（俯视看不到雨丝，只看到雨点打在水上）。
 */
export class Rain {
  readonly node = new Container();
  private readonly g = new Graphics();
  private readonly drops: Drop[] = [];
  private carry = 0;
  /** 每秒多少滴，0 = 不下雨 */
  intensity = 0;

  constructor(
    private bounds: Rect,
    private readonly rng: Rng,
  ) {
    this.node.addChild(this.g);
  }

  update(dt: number): void {
    const b = this.bounds;
    this.carry += dt * this.intensity;
    while (this.carry >= 1) {
      this.carry -= 1;
      this.drops.push({
        x: this.rng.range(b.x, b.x + b.w),
        y: this.rng.range(b.y, b.y + b.h),
        age: 0,
        life: this.rng.range(0.6, 1.1),
        size: this.rng.range(6, 16),
      });
    }
    const g = this.g;
    g.clear();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.age += dt;
      if (d.age >= d.life) {
        this.drops.splice(i, 1);
        continue;
      }
      const t = d.age / d.life;
      const r = 1.5 + d.size * t;
      g.circle(d.x, d.y, r).stroke({ width: 1.1, color: 0xe9f1ec, alpha: 0.4 * (1 - t) });
      if (t < 0.15) g.circle(d.x, d.y, 1.4).fill({ color: 0xf2f7f3, alpha: 0.6 });
    }
  }
}
