import { Container, Sprite, Texture } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import type { FoodItem } from '../flock/flock';

export interface Pellet extends FoodItem {
  vx: number;
  vy: number;
  age: number;
  bob: number;
  sprite: Sprite;
  shadow: Sprite;
}

/** 生成一粒鱼食的小纹理（暖棕色圆粒，左上有高光） */
function makePelletTexture(): Texture {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.4, size * 0.38, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#d9a468');
  g.addColorStop(0.55, '#a8703f');
  g.addColorStop(0.9, '#7c4f2b');
  g.addColorStop(1, 'rgba(124,79,43,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(canvas);
}

function makeSoftDotTexture(): Texture {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

let pelletTexture: Texture | null = null;
let softDotTexture: Texture | null = null;

export function getSoftDotTexture(): Texture {
  return (softDotTexture ??= makeSoftDotTexture());
}

/**
 * 浮在水面的鱼食。本体画在水面层（鱼的上面），影子画在池底（鱼的下面）。
 */
export class PelletField {
  readonly surface = new Container();
  readonly shadows = new Container();
  readonly pellets: Pellet[] = [];

  constructor(private readonly rng: Rng) {
    pelletTexture ??= makePelletTexture();
  }

  /** 在 (x, y) 附近撒一把，返回每粒落水的位置 */
  scatter(x: number, y: number, count: number): { x: number; y: number }[] {
    const rng = this.rng;
    const drops: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const dist = Math.sqrt(rng.float()) * 46;
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist;
      const sprite = new Sprite(pelletTexture!);
      sprite.anchor.set(0.5);
      const size = rng.range(6.5, 9);
      sprite.width = size;
      sprite.height = size;
      const shadow = new Sprite(getSoftDotTexture());
      shadow.anchor.set(0.5);
      shadow.tint = 0x10241f;
      shadow.alpha = 0.25;
      shadow.width = size * 1.6;
      shadow.height = size * 1.6;
      this.surface.addChild(sprite);
      this.shadows.addChild(shadow);
      this.pellets.push({
        x: px,
        y: py,
        vx: Math.cos(ang) * rng.range(4, 14),
        vy: Math.sin(ang) * rng.range(4, 14),
        age: 0,
        bob: rng.range(0, Math.PI * 2),
        alive: true,
        sprite,
        shadow,
      });
      drops.push({ x: px, y: py });
    }
    return drops;
  }

  update(dt: number): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i]!;
      p.age += dt;
      // 最多漂一分钟，之后慢慢化掉
      if (!p.alive || p.age > 60) {
        p.sprite.destroy();
        p.shadow.destroy();
        this.pellets.splice(i, 1);
        continue;
      }
      const damp = Math.exp(-dt * 1.4);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.bob += dt * 2.2;
      const fade = p.age > 55 ? (60 - p.age) / 5 : 1;
      p.sprite.position.set(p.x, p.y + Math.sin(p.bob) * 0.6);
      p.sprite.alpha = fade;
      p.shadow.position.set(p.x + 9, p.y + 11);
      p.shadow.alpha = 0.22 * fade;
    }
  }

  get aliveCount(): number {
    return this.pellets.length;
  }
}
