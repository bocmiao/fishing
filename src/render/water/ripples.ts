import { Graphics } from 'pixi.js';
import type { Ripple } from './waterSurface';

interface RippleItem extends Ripple {
  maxAge: number;
  /** 起始半径 */
  r0: number;
  /** 扩散速度（像素 / 秒），和水面着色器里的 95 保持一致 */
  speed: number;
}

/**
 * 水面上向外扩散的波纹圈。同时把最新的波纹交给水面着色器做折射扭曲。
 */
export class RippleField {
  readonly graphics = new Graphics();
  private readonly items: RippleItem[] = [];

  get ripples(): readonly Ripple[] {
    return this.items;
  }

  add(x: number, y: number, strength = 1, maxAge = 2.4, r0 = 3): void {
    this.items.push({ x, y, age: 0, strength, maxAge, r0, speed: 95 });
    if (this.items.length > 64) this.items.shift();
  }

  update(dt: number): void {
    const g = this.graphics;
    g.clear();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const r = this.items[i]!;
      r.age += dt;
      if (r.age >= r.maxAge) {
        this.items.splice(i, 1);
        continue;
      }
      const life = 1 - r.age / r.maxAge;
      const radius = r.r0 + r.age * r.speed;
      const alpha = r.strength * 0.42 * life * life;
      g.circle(r.x, r.y, radius).stroke({
        width: 1.8 * (0.6 + 0.4 * life),
        color: 0xeef6f0,
        alpha,
      });
      if (radius > 14) {
        g.circle(r.x, r.y, radius * 0.72).stroke({
          width: 1.2,
          color: 0xeef6f0,
          alpha: alpha * 0.5,
        });
      }
    }
  }
}
