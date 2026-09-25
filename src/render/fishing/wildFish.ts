import { Container } from 'pixi.js';
import { Rng } from '../../sim/rng/rng';
import { randomKoiLook } from '../fish/koiLook';
import type { FishSpecies } from '../../sim/data/schema';
import type { FishInstance } from '../../sim/fishing/catchRoll';
import type { FishAtlas } from '../fish/fishAtlas';
import { FishBody } from '../fish/fishBody';
import { FISH_TEX_H, FISH_TEX_W } from '../fish/koiPainter';
import type { Rect } from '../flock/flock';

/**
 * 钓点水里的鱼影。玩家只看得到剪影（大小暗示体型），钓上来才知道是什么鱼。
 * 每个鱼影背后都是一条具体的鱼（品种、重量都已经定好）。
 */
export type WildState = 'roam' | 'approach' | 'hover' | 'flee' | 'hooked' | 'leave';

export interface WildFish {
  id: number;
  species: FishSpecies;
  fish: FishInstance;
  body: FishBody;
  /** 屏幕上的体长（像素） */
  length: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  cruise: number;
  state: WildState;
  stateTime: number;
  home: { x: number; y: number; r: number };
  group: number;
  /** 0 = 贴水面，1 = 贴水底；越深鱼影越淡 */
  depth: number;
  phase: number;
  effort: number;
  wanderAngle: number;
  /** 被吓过以后多久内不会再靠近饵 */
  wary: number;
  /** 正在游向的点（靠近饵时） */
  target: { x: number; y: number } | null;
  /** 啄一下饵的动画进度（1 → 0） */
  lunge: number;
  moodTimer: number;
  moodSpeed: number;
}

const TAU = Math.PI * 2;
const SILHOUETTE_TINT = 0x10231d;

function angleDiff(a: number, b: number): number {
  return ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** 体长（厘米）换算成屏幕上的像素 */
export function screenLength(species: FishSpecies, lengthCm: number): number {
  return (18 + lengthCm * 1.9) * (species.shape === 'eel' ? 1.1 : 1);
}

export class WildFishPool {
  readonly layer = new Container();
  readonly shadowLayer = new Container();
  readonly fish: WildFish[] = [];
  bounds: Rect;
  private nextId = 1;
  private nextGroup = 1;

  constructor(
    private readonly atlas: FishAtlas,
    bounds: Rect,
    private readonly rng: Rng,
  ) {
    this.bounds = bounds;
  }

  /** 在 (x, y) 附近放一条鱼（成群的鱼共用一个 group） */
  add(
    species: FishSpecies,
    fish: FishInstance,
    x: number,
    y: number,
    group = this.nextGroup++,
  ): WildFish {
    const rng = this.rng;
    const length = screenLength(species, fish.lengthCm);
    const shadow = this.atlas.shadowFor(species.shape);
    // 野鱼在水里只看得到深色的影子；放生的锦鲤颜色鲜亮，从水面上就能看出花纹
    // （调用方在一批 add 之后会 atlas.flush()）
    const texture = species.koi ? this.atlas.add(randomKoiLook(new Rng(fish.lookSeed))) : shadow;
    const aspect =
      (FISH_TEX_H / FISH_TEX_W) *
      (species.shape === 'eel' ? 1.25 : species.shape === 'slender' ? 0.9 : 1.05);
    const body = new FishBody(texture, shadow, length, aspect);
    const heading = rng.range(0, TAU);
    body.place(x, y, heading);
    if (!species.koi) body.mesh.tint = SILHOUETTE_TINT;
    body.shadow.tint = 0x000000;
    this.layer.addChild(body.mesh);
    this.shadowLayer.addChild(body.shadow);
    const f: WildFish = {
      id: this.nextId++,
      species,
      fish,
      body,
      length,
      x,
      y,
      heading,
      speed: 0,
      cruise: (16 + length * 0.22) * species.behavior.approachSpeed,
      state: 'roam',
      stateTime: 0,
      home: { x, y, r: 140 + rng.range(0, 80) },
      group,
      depth: rng.range(0.2, 0.8),
      phase: rng.range(0, TAU),
      effort: 0,
      wanderAngle: 0,
      wary: 0,
      target: null,
      lunge: 0,
      moodTimer: rng.range(0, 4),
      moodSpeed: 1,
    };
    f.speed = f.cruise;
    this.fish.push(f);
    return f;
  }

  newGroup(): number {
    return this.nextGroup++;
  }

  remove(f: WildFish): void {
    const i = this.fish.indexOf(f);
    if (i >= 0) this.fish.splice(i, 1);
    f.body.destroy();
  }

  setState(f: WildFish, state: WildState): void {
    f.state = state;
    f.stateTime = 0;
  }

  /** 让附近的鱼受惊逃开 */
  spook(x: number, y: number, radius: (f: WildFish) => number): WildFish[] {
    const spooked: WildFish[] = [];
    for (const f of this.fish) {
      if (f.state === 'hooked' || f.state === 'leave') continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < radius(f)) {
        this.scare(f, x, y);
        spooked.push(f);
      }
    }
    return spooked;
  }

  scare(f: WildFish, fromX: number, fromY: number): void {
    f.heading = Math.atan2(f.y - fromY, f.x - fromX) + this.rng.range(-0.4, 0.4);
    f.target = null;
    f.wary = this.rng.range(8, 14);
    f.speed = f.cruise * 4;
    this.setState(f, 'flee');
  }

  update(dt: number): void {
    const rng = this.rng;
    const b = this.bounds;
    const m = 90;
    for (const f of this.fish) {
      f.stateTime += dt;
      f.wary = Math.max(0, f.wary - dt);
      f.lunge = Math.max(0, f.lunge - dt * 4);
      if (f.state === 'hooked') {
        this.animate(f, dt);
        continue;
      }

      let dirX = Math.cos(f.heading) * 1.2;
      let dirY = Math.sin(f.heading) * 1.2;
      let targetSpeed = f.cruise;
      let turnRadius = f.length * 0.9;

      switch (f.state) {
        case 'roam': {
          // 同一群的鱼靠拢、对齐
          let cx = 0;
          let cy = 0;
          let ax = 0;
          let ay = 0;
          let n = 0;
          for (const o of this.fish) {
            if (o === f || o.group !== f.group) continue;
            cx += o.x;
            cy += o.y;
            ax += Math.cos(o.heading);
            ay += Math.sin(o.heading);
            n++;
            const d = Math.hypot(o.x - f.x, o.y - f.y) || 1;
            const sep = (f.length + o.length) * 0.5;
            if (d < sep) {
              dirX -= ((o.x - f.x) / d) * (1 - d / sep) * 2.5;
              dirY -= ((o.y - f.y) / d) * (1 - d / sep) * 2.5;
            }
          }
          if (n > 0) {
            const tx = cx / n - f.x;
            const ty = cy / n - f.y;
            const tl = Math.hypot(tx, ty) || 1;
            dirX += (tx / tl) * 0.5 + (ax / n) * 0.6;
            dirY += (ty / tl) * 0.5 + (ay / n) * 0.6;
          }
          // 不离家太远
          const hx = f.home.x - f.x;
          const hy = f.home.y - f.y;
          const hd = Math.hypot(hx, hy);
          if (hd > f.home.r) {
            dirX += (hx / hd) * ((hd - f.home.r) / 80);
            dirY += (hy / hd) * ((hd - f.home.r) / 80);
          }
          f.wanderAngle += rng.normal(0, 1.2) * dt * 2;
          f.wanderAngle *= 1 - Math.min(1, dt * 0.4);
          dirX += Math.cos(f.heading + f.wanderAngle) * 0.8;
          dirY += Math.sin(f.heading + f.wanderAngle) * 0.8;
          f.moodTimer -= dt;
          if (f.moodTimer <= 0) {
            const r = rng.float();
            f.moodSpeed =
              r < 0.3 ? rng.range(0.1, 0.35) : r > 0.9 ? rng.range(1.5, 2.2) : rng.range(0.7, 1.1);
            f.moodTimer = rng.range(2, 6);
          }
          targetSpeed = f.cruise * f.moodSpeed;
          break;
        }
        case 'approach': {
          if (!f.target) {
            this.setState(f, 'roam');
            break;
          }
          const dx = f.target.x - f.x;
          const dy = f.target.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          dirX = (dx / d) * 3;
          dirY = (dy / d) * 3;
          // 快到了就慢下来
          targetSpeed = f.cruise * Math.min(1.6, 0.35 + d / 120);
          turnRadius = f.length * 0.5;
          break;
        }
        case 'hover': {
          if (!f.target) {
            this.setState(f, 'roam');
            break;
          }
          // 停在饵旁边，嘴对着饵，偶尔往前啄一下
          const dx = f.target.x - f.x;
          const dy = f.target.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          dirX = dx / d;
          dirY = dy / d;
          targetSpeed = d > 10 ? 10 + f.lunge * 70 : f.lunge * 70 - 6;
          turnRadius = f.length * 0.3;
          break;
        }
        case 'flee': {
          targetSpeed = f.cruise * 3.5;
          if (f.stateTime > 1.2) this.setState(f, 'roam');
          break;
        }
        case 'leave': {
          targetSpeed = f.cruise * 1.4;
          // 往最近的画面边缘游走
          const toTop = f.y - b.y;
          const toLeft = f.x - b.x;
          const toRight = b.x + b.w - f.x;
          const min = Math.min(toTop, toLeft, toRight);
          const exit = min === toTop ? -Math.PI / 2 : min === toLeft ? Math.PI : 0;
          dirX = Math.cos(exit) * 3;
          dirY = Math.sin(exit) * 3;
          break;
        }
      }

      // 边界（离开的鱼不受约束）
      if (f.state !== 'leave') {
        const push = (dist: number) => (dist < m ? ((m - dist) / m) ** 2 * 3.5 : 0);
        dirX += push(f.x - b.x) - push(b.x + b.w - f.x);
        dirY += push(f.y - b.y) - push(b.y + b.h - f.y);
      }

      const desired = Math.atan2(dirY, dirX);
      const turn = angleDiff(desired, f.heading);
      const rate = Math.min(4, 0.3 + Math.abs(f.speed) / Math.max(10, turnRadius));
      f.heading += Math.max(-rate * dt, Math.min(rate * dt, turn));
      const accel = targetSpeed > f.speed ? (f.state === 'flee' ? 8 : 1.5) : 1.2;
      f.speed += (targetSpeed - f.speed) * Math.min(1, dt * accel);
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.y += Math.sin(f.heading) * f.speed * dt;

      const effortTarget = Math.min(
        1,
        Math.max(0, (f.speed - f.cruise * 0.4) / (f.cruise * 3)) +
          Math.min(1, Math.abs(turn)) * 0.3,
      );
      f.effort += (effortTarget - f.effort) * Math.min(1, dt * 3);
      f.phase += dt * (0.6 + Math.abs(f.speed) / 40) * TAU;
      this.animate(f, dt);
    }
  }

  /** 离开画面的鱼 */
  takeGone(): WildFish[] {
    const b = this.bounds;
    const gone = this.fish.filter(
      (f) => f.state === 'leave' && (f.y < b.y - 80 || f.x < b.x - 80 || f.x > b.x + b.w + 80),
    );
    for (const f of gone) this.remove(f);
    return gone;
  }

  private animate(f: WildFish, _dt: number): void {
    f.body.follow(f.x, f.y);
    const lift = 1 - f.depth;
    f.body.draw(
      { phase: f.phase, amplitude: 0.04 + 0.06 * f.effort },
      1,
      5 + 9 * lift,
      6 + 11 * lift,
    );
    // 越深越淡
    f.body.mesh.alpha = (0.34 + 0.3 * lift) * (f.species.koi ? 1.5 : 1);
    f.body.shadow.alpha = 0.08 + 0.06 * lift;
  }
}
