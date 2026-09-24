import { Container, Graphics } from 'pixi.js';

/**
 * 钓具的俯视画法：竹竿、鱼线、红白浮漂、瞄准圈。全部用代码画，每帧重画（图形很简单）。
 * 角度约定：0 = 朝上（朝水面），正值向右。
 */

const BAMBOO = 0xd2a24c;
const BAMBOO_DARK = 0x9c7430;
const BAMBOO_LIGHT = 0xecc983;
const LINE = 0xeef3ee;

export interface RodPose {
  baseX: number;
  baseY: number;
  angle: number;
  /** 弯曲程度 0~1 */
  bend: number;
  /** 往哪边弯：-1 左 ~ 1 右 */
  bendSide: number;
}

export class Rod {
  readonly node = new Graphics();
  readonly shadow = new Graphics();
  readonly length = 250;
  tipX = 0;
  tipY = 0;

  draw(p: RodPose): void {
    const n = 12;
    const dx = Math.sin(p.angle);
    const dy = -Math.cos(p.angle);
    const nx = Math.cos(p.angle);
    const ny = Math.sin(p.angle);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const along = this.length * s * (1 - p.bend * 0.12 * s);
      const side = p.bendSide * p.bend * this.length * 0.32 * s * s;
      pts.push({ x: p.baseX + dx * along + nx * side, y: p.baseY + dy * along + ny * side });
    }
    this.tipX = pts[n]!.x;
    this.tipY = pts[n]!.y;

    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(n, i + 1)]!;
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      const w = 3.2 - (i / n) * 2.2;
      left.push(pts[i]!.x - (ty / len) * w, pts[i]!.y + (tx / len) * w);
      right.push(pts[i]!.x + (ty / len) * w, pts[i]!.y - (tx / len) * w);
    }
    const outline = [...left];
    for (let i = n; i >= 0; i--) outline.push(right[i * 2]!, right[i * 2 + 1]!);

    const g = this.node;
    g.clear();
    g.poly(outline).fill({ color: BAMBOO });
    // 受光的一侧
    const hl: number[] = [];
    for (let i = 0; i <= n; i++)
      hl.push((left[i * 2]! * 2 + pts[i]!.x) / 3, (left[i * 2 + 1]! * 2 + pts[i]!.y) / 3);
    g.poly([...hl, ...[...pts].reverse().flatMap((q) => [q.x, q.y])]).fill({
      color: BAMBOO_LIGHT,
      alpha: 0.5,
    });
    // 竹节
    for (let i = 1; i < n; i += 2) {
      const w = 3.4 - (i / n) * 2.2;
      const a = pts[i - 1]!;
      const b = pts[i + 1]!;
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      g.moveTo(pts[i]!.x - (ty / len) * w, pts[i]!.y + (tx / len) * w);
      g.lineTo(pts[i]!.x + (ty / len) * w, pts[i]!.y - (tx / len) * w);
    }
    g.stroke({ width: 1.4, color: BAMBOO_DARK, alpha: 0.9 });
    // 握把上缠的麻绳
    g.circle(pts[0]!.x, pts[0]!.y, 4).fill({ color: 0x8a6a45 });

    const s = this.shadow;
    s.clear();
    s.poly(outline.map((v, i) => v + (i % 2 === 0 ? 14 : 18))).fill({
      color: 0x000000,
      alpha: 0.16,
    });
  }
}

/** 鱼线：从竿梢到浮漂（或上钩的鱼），松的时候下垂成弧线，紧的时候拉直 */
export class FishingLine {
  readonly node = new Graphics();

  draw(fromX: number, fromY: number, toX: number, toY: number, tension: number, sway = 0): void {
    const g = this.node;
    g.clear();
    const mx = (fromX + toX) / 2;
    const my = (fromY + toY) / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const slack = Math.max(0, 1 - tension) * Math.min(60, len * 0.14);
    // 下垂方向：画面里往下（岸的方向）一点，再加上水流带来的偏移
    const cx = mx + (-dy / len) * sway * slack + slack * 0.15;
    const cy = my + slack * 0.6;
    g.moveTo(fromX, fromY);
    g.quadraticCurveTo(cx, cy, toX, toY);
    g.stroke({ width: 1.3, color: LINE, alpha: 0.55 + 0.3 * Math.min(1, tension) });
  }

  clear(): void {
    this.node.clear();
  }
}

export type BobberState = 'hidden' | 'flying' | 'floating' | 'nibble' | 'sunk';

/** 红白浮漂（俯视）：红色漂顶 + 白色漂身，还有落在水上的影子 */
export class Bobber {
  readonly node = new Container();
  readonly shadow = new Graphics();
  private readonly body = new Graphics();
  state: BobberState = 'hidden';
  x = 0;
  y = 0;
  /** 飞行时离水面的高度 0~1 */
  height = 0;
  private time = 0;
  private dip = 0;

  constructor() {
    this.body.circle(0, 0, 7.5).fill({ color: 0xf4f0e6 });
    this.body.circle(0, 0, 7.5).stroke({ width: 1, color: 0xb9b2a4, alpha: 0.7 });
    this.body.circle(-0.6, -0.6, 5).fill({ color: 0xdd432d });
    this.body.circle(-2, -2.2, 1.6).fill({ color: 0xf6c0b3, alpha: 0.9 });
    this.body.circle(0, 0, 1.2).fill({ color: 0x3b2320 });
    this.node.addChild(this.body);
    this.shadow.ellipse(0, 0, 8, 7).fill({ color: 0x000000, alpha: 0.22 });
    this.node.visible = false;
    this.shadow.visible = false;
  }

  /** 试探：浮漂往下点一下 */
  nibble(): void {
    this.dip = 1;
  }

  update(dt: number): void {
    this.time += dt;
    this.dip = Math.max(0, this.dip - dt * 5);
    const visible = this.state !== 'hidden';
    this.node.visible = visible;
    this.shadow.visible = visible;
    if (!visible) return;
    let scale = 1;
    let alpha = 1;
    let sx = 3;
    let sy = 4;
    switch (this.state) {
      case 'flying':
        scale = 1 + this.height * 0.9;
        sx = 3 + this.height * 40;
        sy = 4 + this.height * 60;
        break;
      case 'floating':
        scale = 1 + Math.sin(this.time * 2.4) * 0.03;
        break;
      case 'nibble':
        scale = 1 - Math.sin(this.dip * Math.PI) * 0.28;
        alpha = 1 - Math.sin(this.dip * Math.PI) * 0.25;
        break;
      case 'sunk':
        scale = 0.55;
        alpha = 0.35;
        break;
    }
    if (this.state === 'floating' && this.dip > 0) scale *= 1 - Math.sin(this.dip * Math.PI) * 0.28;
    this.node.position.set(this.x, this.y);
    this.node.scale.set(scale);
    this.node.alpha = alpha;
    this.shadow.position.set(this.x + sx, this.y + sy);
    this.shadow.alpha = this.state === 'sunk' ? 0.3 : 1;
  }
}

/** 瞄准圈：落点 + 散布范围 */
export class AimReticle {
  readonly node = new Graphics();
  private time = 0;

  draw(
    x: number,
    y: number,
    radius: number,
    fromX: number,
    fromY: number,
    charging: boolean,
    dt: number,
  ): void {
    this.time += dt;
    const g = this.node;
    g.clear();
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 5);
    // 虚线圈
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      if (i % 2) continue;
      const a0 = (i / segs) * Math.PI * 2 + this.time * 0.6;
      const a1 = ((i + 1) / segs) * Math.PI * 2 + this.time * 0.6;
      g.moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
      g.arc(x, y, radius, a0, a1);
    }
    g.stroke({ width: 1.6, color: 0xf5ebdb, alpha: pulse });
    g.circle(x, y, 2.2).fill({ color: 0xf5ebdb, alpha: 0.85 });
    if (charging) {
      // 从竿梢到落点的虚线轨迹
      const n = 14;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const px = fromX + (x - fromX) * t;
        const py = fromY + (y - fromY) * t - Math.sin(t * Math.PI) * 26;
        g.circle(px, py, 1.4).fill({ color: 0xf5ebdb, alpha: 0.5 });
      }
    }
  }

  clear(): void {
    this.node.clear();
  }
}
