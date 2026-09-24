import { Container, Sprite } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import type { Rect } from '../flock/flock';
import { valueNoise } from '../noise';
import { getSoftDotTexture } from './pellets';

interface Speck {
  sprite: Sprite;
  x: number;
  y: number;
  twinkle: number;
  speed: number;
  size: number;
}

/**
 * 水面上缓缓漂动、忽明忽暗的小光点（花粉、微尘、反光）。
 */
export class Specks {
  readonly container = new Container();
  private readonly items: Speck[] = [];
  private time = 0;

  constructor(
    private bounds: Rect,
    count: number,
    private readonly rng: Rng,
  ) {
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(getSoftDotTexture());
      sprite.anchor.set(0.5);
      const size = rng.range(2.2, 5.5);
      sprite.width = size;
      sprite.height = size;
      this.container.addChild(sprite);
      this.items.push({
        sprite,
        x: rng.range(bounds.x, bounds.x + bounds.w),
        y: rng.range(bounds.y, bounds.y + bounds.h),
        twinkle: rng.range(0, Math.PI * 2),
        speed: rng.range(3, 9),
        size,
      });
    }
  }

  resize(bounds: Rect): void {
    this.bounds = bounds;
  }

  update(dt: number): void {
    this.time += dt;
    const b = this.bounds;
    for (const s of this.items) {
      // 沿着缓慢变化的流场漂
      const ang = valueNoise(s.x / 400, s.y / 400 + this.time * 0.02, 7) * Math.PI * 4;
      s.x += Math.cos(ang) * s.speed * dt;
      s.y += Math.sin(ang) * s.speed * dt;
      if (s.x < b.x) s.x += b.w;
      if (s.x > b.x + b.w) s.x -= b.w;
      if (s.y < b.y) s.y += b.h;
      if (s.y > b.y + b.h) s.y -= b.h;
      s.twinkle += dt * (0.6 + this.rng.float() * 0.1);
      s.sprite.position.set(s.x, s.y);
      s.sprite.alpha = 0.18 + 0.5 * Math.max(0, Math.sin(s.twinkle));
    }
  }
}
