import { Container, Graphics } from 'pixi.js';
import type { GameData } from '../../sim/data/gameData';
import { Rng } from '../../sim/rng/rng';
import type { CaughtFish } from '../../sim/state';
import { FishAtlas } from '../fish/fishAtlas';
import { FishBody } from '../fish/fishBody';
import { FISH_TEX_H, FISH_TEX_W } from '../fish/koiPainter';
import { fishLook } from '../fish/pondFishLook';
import type { Rect } from '../flock/flock';
import { screenLength } from '../fishing/wildFish';
import { PALETTE } from '../palette';

interface TankFish {
  uid: number;
  body: FishBody;
  x: number;
  y: number;
  heading: number;
  speed: number;
  turn: number;
  phase: number;
}

/**
 * 后厨的活鱼缸（俯视）：一口长方形的玻璃缸，里面游着缸里的鱼（和鱼护、上鱼卡片上是同一条）。
 * 缸比小溪小，鱼画得小一点。
 */
export class FishTank {
  readonly node = new Container();
  private readonly fishLayer = new Container();
  private readonly bubbles = new Graphics();
  private readonly atlas = new FishAtlas();
  private readonly fish: TankFish[] = [];
  private time = 0;

  constructor(
    readonly rect: Rect,
    private readonly data: GameData,
    private readonly rng: Rng,
  ) {
    const { x, y, w, h } = rect;
    const g = new Graphics();
    g.roundRect(x + 10, y + 12, w, h, 14).fill({ color: 0x000000, alpha: 0.25 });
    g.roundRect(x - 8, y - 8, w + 16, h + 16, 16).fill({ color: PALETTE.woodDark });
    g.roundRect(x, y, w, h, 10).fill({ color: PALETTE.waterDark });
    g.roundRect(x + 6, y + 6, w - 12, h - 12, 8).fill({ color: PALETTE.water, alpha: 0.85 });
    // 缸底的石子
    const r = new Rng(7);
    for (let i = 0; i < 40; i++) {
      g.circle(r.range(x + 10, x + w - 10), r.range(y + 10, y + h - 10), r.range(2, 5)).fill({
        color: r.chance(0.5) ? PALETTE.waterLight : PALETTE.waterDark,
        alpha: 0.6,
      });
    }
    const glass = new Graphics();
    glass.roundRect(x + 8, y + 8, w * 0.35, 10, 5).fill({ color: PALETTE.paper, alpha: 0.18 });
    glass.roundRect(x, y, w, h, 10).stroke({ color: PALETTE.paper, width: 3, alpha: 0.35 });
    this.node.addChild(g, this.fishLayer, this.bubbles, glass);
  }

  /** 按缸里的鱼增删（按编号对齐） */
  sync(tank: CaughtFish[]): void {
    const want = new Set(tank.map((f) => f.uid));
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]!;
      if (!want.has(f.uid)) {
        f.body.destroy();
        this.fish.splice(i, 1);
      }
    }
    let added = false;
    for (const c of tank) {
      if (this.fish.some((f) => f.uid === c.uid)) continue;
      const species = this.data.speciesById.get(c.speciesId);
      if (!species) continue;
      const look = fishLook(species, c.lookSeed);
      const texture = this.atlas.add(look);
      const length = Math.min(this.rect.w * 0.45, screenLength(species, c.lengthCm) * 0.8);
      const aspect =
        (FISH_TEX_H / FISH_TEX_W) *
        (species.shape === 'eel' ? 1.25 : species.shape === 'slender' ? 0.9 : 1.05);
      const body = new FishBody(texture, this.atlas.shadowFor(species.shape), length, aspect);
      const { x, y, w, h } = this.rect;
      const f: TankFish = {
        uid: c.uid,
        body,
        x: this.rng.range(x + 40, x + w - 40),
        y: this.rng.range(y + 40, y + h - 40),
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(18, 32),
        turn: 0,
        phase: this.rng.range(0, Math.PI * 2),
      };
      body.place(f.x, f.y, f.heading);
      this.fishLayer.addChild(body.shadow, body.mesh);
      this.fish.push(f);
      added = true;
    }
    if (added) this.atlas.flush();
  }

  update(dt: number): void {
    this.time += dt;
    const { x, y, w, h } = this.rect;
    for (const f of this.fish) {
      // 慢慢游，碰到缸壁就拐弯
      f.turn += this.rng.range(-1, 1) * dt * 2;
      f.turn *= 0.97;
      const margin = 34;
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (f.x < x + margin || f.x > x + w - margin || f.y < y + margin || f.y > y + h - margin) {
        const want = Math.atan2(cy - f.y, cx - f.x);
        let d = want - f.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        f.turn = d * 2;
      }
      f.heading += f.turn * dt;
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.y += Math.sin(f.heading) * f.speed * dt;
      f.phase += dt * 5;
      f.body.follow(f.x, f.y);
      f.body.draw({ phase: f.phase, amplitude: 0.05 }, 1, 4, 5);
    }
    // 气泡从缸底冒上来
    const b = this.bubbles;
    b.clear();
    for (let i = 0; i < 6; i++) {
      const t = (this.time * 0.35 + i / 6) % 1;
      const bx = x + w * (0.2 + 0.12 * i) + Math.sin(this.time * 2 + i) * 4;
      const by = y + h - 12 - t * (h - 24);
      b.circle(bx, by, 2 + t * 2).stroke({
        color: PALETTE.paper,
        width: 1.2,
        alpha: 0.5 * (1 - t),
      });
    }
  }

  destroy(): void {
    this.node.destroy({ children: true });
    this.atlas.destroy();
  }
}
