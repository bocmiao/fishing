import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';

/**
 * 俯视的阿喵（占位版，用代码画）：坐在岸边、面朝水面（画面上方）。
 * 从头顶看下去：圆草帽、从草帽里伸出的两只黑耳朵、帽檐下露出的胡须和两只白手套爪子、
 * 靛蓝外套的背影，以及绕在身旁的黑白尾巴。
 *
 * 正式的拆件（美术指南 CHAR-T01）到位后，按同样的部件结构替换成图片即可。
 */

const INK = 0x1e2629;
const WHITE = 0xf4f0e6;
const INDIGO = 0x44557a;
const INDIGO_DARK = 0x39486a;
const STRAW = 0xc9a36b;
const STRAW_DARK = 0xa4804d;
const STRAW_LIGHT = 0xe0c690;
const PINK = 0xe8a596;

const HAT_R = 50;

function drawHat(g: Graphics, rng: Rng): void {
  // 帽檐：带一处磨损破口的圆
  const pts: number[] = [];
  const segments = 72;
  const notchCenter = Math.PI * 1.2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const d = Math.abs(Math.atan2(Math.sin(a - notchCenter), Math.cos(a - notchCenter)));
    let r = HAT_R + Math.sin(a * 9) * 0.6;
    if (d < 0.22) r -= (1 - d / 0.22) * 8 + rng.range(0, 2.5);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.poly(pts).fill({ color: STRAW });
  // 编织纹：同心圈 + 短的放射纹
  for (let r = 27; r < HAT_R - 1; r += 3.2) {
    g.circle(0, 0, r).stroke({ width: 1.1, color: STRAW_DARK, alpha: 0.26 });
  }
  for (let ring = 0, r = 28; r < HAT_R - 3; r += 3.2, ring++) {
    const steps = Math.floor((Math.PI * 2 * r) / 6);
    for (let i = 0; i < steps; i++) {
      const a = ((i + (ring % 2) * 0.5) / steps) * Math.PI * 2;
      g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      g.lineTo(Math.cos(a) * (r + 2.4), Math.sin(a) * (r + 2.4));
    }
  }
  g.stroke({ width: 1, color: STRAW_LIGHT, alpha: 0.35 });
  // 帽檐外沿
  g.poly(pts).stroke({ width: 1.8, color: 0x957241, alpha: 0.55 });
  // 破口处翘出来的几根草
  for (let i = 0; i < 5; i++) {
    const a = notchCenter + rng.range(-0.3, 0.3);
    const r0 = HAT_R - 5;
    const len = rng.range(5, 11);
    const tilt = rng.range(-0.4, 0.4);
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a + tilt * 0.1) * (r0 + len), Math.sin(a + tilt * 0.1) * (r0 + len));
  }
  g.stroke({ width: 1.3, color: 0xb18a55, alpha: 0.9 });
  // 帽冠：一个受光的圆顶
  g.circle(2, 3, 25).fill({ color: 0x8a6a45, alpha: 0.35 });
  g.circle(0, 0, 24).fill({ color: 0xd4b27a });
  g.circle(-6, -7, 14).fill({ color: 0xe7cd99, alpha: 0.55 });
  g.circle(-9, -10, 6).fill({ color: 0xf2dcae, alpha: 0.4 });
  for (let r = 6; r < 23; r += 3)
    g.circle(0, 0, r).stroke({ width: 0.9, color: STRAW_DARK, alpha: 0.18 });
  // 帽带
  g.circle(0, 0, 25.5).stroke({ width: 3.2, color: 0x7d5f3d, alpha: 0.85 });
}

function drawEar(g: Graphics): void {
  // 以耳根为原点，耳尖朝 -y；耳根处露出一点头顶的黑毛
  g.ellipse(0, 3, 13, 6).fill({ color: INK });
  g.poly([-12, 4, 12, 4, 4, -21, 1, -25, -2, -21]).fill({ color: INK });
  g.poly([-5.5, 1, 5.5, 1, 1.5, -15]).fill({ color: PINK, alpha: 0.75 });
  // 耳朵里的白色绒毛
  g.moveTo(-2.5, -1)
    .lineTo(-0.5, -9)
    .moveTo(1.5, 0)
    .lineTo(3, -8)
    .stroke({ width: 1.1, color: WHITE, alpha: 0.9 });
  // 耳廓受光的一侧
  g.moveTo(-11, 3).lineTo(-1.5, -22).stroke({ width: 1.2, color: 0x4a5358, alpha: 0.8 });
}

function drawBody(g: Graphics): void {
  // 外套的背影
  g.ellipse(0, 34, 44, 34).fill({ color: INDIGO });
  g.ellipse(0, 44, 39, 23).fill({ color: INDIGO_DARK, alpha: 0.55 });
  g.ellipse(-12, 22, 22, 12).fill({ color: 0x5a6b93, alpha: 0.35 });
  // 后背中缝
  g.moveTo(0, 30).lineTo(0, 66).stroke({ width: 1.4, color: 0x2f3b57, alpha: 0.55 });
  // 袖子上的补丁
  g.roundRect(-44, 28, 15, 13, 3).fill({ color: 0x8d9196 });
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    g.moveTo(-43 + t * 13, 28.5).lineTo(-42 + t * 13, 30.5);
    g.moveTo(-43 + t * 13, 39.5).lineTo(-42 + t * 13, 41.5);
  }
  g.stroke({ width: 0.9, color: 0x5d6166, alpha: 0.9 });
}

function drawPaw(g: Graphics): void {
  // 袖口（靛蓝）+ 内衫袖口（米白）+ 白手套爪子
  g.ellipse(0, 9, 10, 7).fill({ color: INDIGO_DARK });
  g.ellipse(0, 4, 9, 4).fill({ color: 0xede4d0 });
  g.ellipse(0, -2, 10, 8).fill({ color: WHITE });
  g.moveTo(-3.5, -8)
    .lineTo(-3, -3)
    .moveTo(3.5, -8)
    .lineTo(3, -3)
    .stroke({ width: 1, color: 0xc4bcae });
}

export class TopDownCat {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly tail = new Graphics();
  private readonly body = new Container();
  private readonly head = new Container();
  private readonly whiskers = new Graphics();
  private readonly earL = new Container();
  private readonly earR = new Container();
  private readonly pawL = new Container();
  private readonly pawR = new Container();
  /** 两只爪子（握竿时一起转向瞄准方向） */
  private readonly hands = new Container();

  private time = 0;
  private lookAngle = 0;
  private lookTarget = 0;
  private earTwitch = 0;
  private earTwitchSide = 1;
  private nextTwitch = 2;
  private pawReach = 0;
  private tailExcite = 0;
  private whiskerTwitch = 0;
  private aim = 0;
  private aimTarget = 0;
  private swing = 0;
  private strikeT = 0;
  private lean = 0;
  private leanTarget = 0;
  private mood: 'neutral' | 'happy' | 'sad' = 'neutral';
  private moodTime = 0;

  constructor(private readonly rng: Rng) {
    this.shadow.ellipse(8, 22, 60, 54).fill({ color: 0x1d160f, alpha: 0.22 });

    const bodyG = new Graphics();
    drawBody(bodyG);
    this.body.addChild(bodyG);

    for (const [paw, x] of [
      [this.pawL, -17],
      [this.pawR, 17],
    ] as const) {
      const g = new Graphics();
      drawPaw(g);
      paw.addChild(g);
      paw.position.set(x, -55);
    }

    // 头部组：胡须 → 帽子 → 耳朵，一起转向看的方向
    const hatShadow = new Graphics();
    hatShadow.circle(5, 7, HAT_R).fill({ color: 0x14100b, alpha: 0.28 });
    const hat = new Graphics();
    drawHat(hat, rng);
    for (const [ear, side] of [
      [this.earL, -1],
      [this.earR, 1],
    ] as const) {
      const g = new Graphics();
      drawEar(g);
      ear.addChild(g);
      ear.position.set(side * 17, -13);
      ear.rotation = side * 0.55;
    }
    this.head.addChild(this.whiskers, hatShadow, hat, this.earL, this.earR);

    this.hands.addChild(this.pawL, this.pawR);
    this.root.addChild(this.shadow, this.tail, this.body, this.hands, this.head);
    this.drawWhiskers();
    this.drawTail();
  }

  /** 让阿喵看向某个点（本地坐标，相对猫的位置） */
  lookAt(dx: number, dy: number): void {
    // 面朝 -y；只在前方 ±0.45 弧度内转头
    const a = Math.atan2(dx, -dy);
    this.lookTarget = Math.max(-0.45, Math.min(0.45, a * 0.6));
  }

  /** 撒饲料的动作：右爪往前一伸，尾巴翘一下 */
  toss(): void {
    this.pawReach = 1;
    this.tailExcite = 1;
  }

  /** 胡须抖动（胡须感应） */
  twitchWhiskers(): void {
    this.whiskerTwitch = 1;
  }

  /** 握竿瞄准的方向（0 = 正前方，正值向右） */
  setAim(angle: number): void {
    this.aimTarget = Math.max(-0.7, Math.min(0.7, angle));
    this.lookTarget = this.aimTarget * 0.6;
  }

  /** 甩竿 */
  castSwing(): void {
    this.swing = 1;
    this.tailExcite = 0.6;
  }

  /** 提竿 */
  strike(): void {
    this.strikeT = 1;
  }

  /** 遛鱼时往后仰，0~1 */
  setLean(amount: number): void {
    this.leanTarget = Math.max(0, Math.min(1, amount));
  }

  react(kind: 'happy' | 'sad'): void {
    this.mood = kind;
    this.moodTime = 2.6;
    if (kind === 'happy') this.tailExcite = 1;
  }

  /** 甩竿动画进行中时竿子往后扬的程度 0~1（画面上竿子会显得短一些） */
  get swingLift(): number {
    return Math.sin(this.swing * Math.PI);
  }

  /** 竿子握把的位置（相对猫的坐标） */
  get rodBase(): { x: number; y: number } {
    // 爪子中间 (0, -52) 随 hands 旋转，再加上后仰的位移
    const r = this.hands.rotation;
    return {
      x: 52 * Math.sin(r) + this.hands.position.x,
      y: -52 * Math.cos(r) + this.hands.position.y,
    };
  }

  get rodAngle(): number {
    return this.hands.rotation;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;

    // 呼吸
    const breath = Math.sin(t * 1.9) * 0.012;
    this.body.scale.set(1 + breath, 1 - breath * 0.6);

    // 转头
    this.lookAngle += (this.lookTarget - this.lookAngle) * Math.min(1, dt * 3);
    this.head.rotation = this.lookAngle + Math.sin(t * 0.7) * 0.02;
    this.lookTarget *= 1 - Math.min(1, dt * 0.25);

    // 耳朵偶尔抖一下
    this.nextTwitch -= dt;
    if (this.nextTwitch <= 0) {
      this.earTwitch = 1;
      this.earTwitchSide = this.rng.chance(0.5) ? 1 : -1;
      this.nextTwitch = this.rng.range(2.5, 7);
    }
    this.earTwitch = Math.max(0, this.earTwitch - dt * 5);
    const twitch = Math.sin(this.earTwitch * Math.PI) * 0.35;
    this.moodTime = Math.max(0, this.moodTime - dt);
    if (this.moodTime === 0) this.mood = 'neutral';
    const earBase = this.mood === 'happy' ? 0.3 : this.mood === 'sad' ? 1.05 : 0.55;
    this.earL.rotation = -earBase - (this.earTwitchSide < 0 ? twitch : 0);
    this.earR.rotation = earBase + (this.earTwitchSide > 0 ? twitch : 0);

    // 握竿：瞄准、甩竿、提竿、后仰
    this.aim += (this.aimTarget - this.aim) * Math.min(1, dt * 8);
    this.swing = Math.max(0, this.swing - dt * 2.6);
    this.strikeT = Math.max(0, this.strikeT - dt * 4);
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 6);
    const swingBack = -Math.sin(this.swing * Math.PI) * 0.55;
    this.hands.rotation = this.aim + swingBack;
    const pullBack = this.lean * 9 + Math.sin(this.strikeT * Math.PI) * 10;
    this.hands.position.set(0, pullBack);
    this.head.position.set(0, pullBack * 0.5);

    // 爪子
    this.pawReach = Math.max(0, this.pawReach - dt * 3);
    const reach = Math.sin(this.pawReach * Math.PI);
    this.pawR.position.set(17 + reach * 6, -55 - reach * 16);
    this.pawL.position.set(-17, -55 + Math.sin(t * 1.9) * 0.4);

    this.tailExcite = Math.max(0, this.tailExcite - dt * 0.8);
    this.whiskerTwitch = Math.max(0, this.whiskerTwitch - dt * 2.5);
    this.drawTail();
    if (this.whiskerTwitch > 0) this.drawWhiskers();
  }

  private drawWhiskers(): void {
    const g = this.whiskers;
    g.clear();
    const jitter = Math.sin(this.time * 40) * this.whiskerTwitch * 0.12;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + side * (0.95 + i * 0.28 + jitter);
        const x0 = side * 12;
        const y0 = -42;
        const len = 42 - i * 3;
        g.moveTo(x0, y0);
        g.quadraticCurveTo(
          x0 + Math.cos(a) * len * 0.55,
          y0 + Math.sin(a) * len * 0.55 - 3,
          x0 + Math.cos(a) * len,
          y0 + Math.sin(a) * len,
        );
      }
    }
    g.stroke({ width: 1.1, color: WHITE, alpha: 0.85 });
  }

  /** 尾巴：从身后绕到右侧，末端是白色 */
  private drawTail(): void {
    const g = this.tail;
    g.clear();
    const t = this.time;
    const sway =
      Math.sin(t * 1.3) * 0.18 +
      Math.sin(t * 2.9) * 0.05 +
      this.tailExcite * Math.sin(t * 9) * 0.25;
    const n = 12;
    const pts: { x: number; y: number }[] = [];
    let x = 26;
    let y = 58;
    let ang = 0.15;
    const seg = 8.2;
    for (let i = 0; i < n; i++) {
      pts.push({ x, y });
      const k = i / (n - 1);
      ang -= 0.2 + k * 0.1 + sway * k * 0.6;
      x += Math.cos(ang) * seg;
      y += Math.sin(ang) * seg;
    }
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const q = pts[Math.min(n - 1, i + 1)]!;
      const o = pts[Math.max(0, i - 1)]!;
      const tx = q.x - o.x;
      const ty = q.y - o.y;
      const len = Math.hypot(tx, ty) || 1;
      const w = 7.5 * (1 - (i / (n - 1)) * 0.45);
      left.push(p.x - (ty / len) * w, p.y + (tx / len) * w);
      right.push(p.x + (ty / len) * w, p.y - (tx / len) * w);
    }
    const outline: number[] = [...left];
    for (let i = n - 1; i >= 0; i--) outline.push(right[i * 2]!, right[i * 2 + 1]!);
    // 尾巴影子
    g.poly(outline.map((v, i) => v + (i % 2 === 0 ? 5 : 6))).fill({ color: 0x1d160f, alpha: 0.2 });
    g.poly(outline).fill({ color: INK });
    // 白色尾尖
    const tipStart = Math.floor(n * 0.72);
    const tip: number[] = [];
    for (let i = tipStart; i < n; i++) tip.push(left[i * 2]!, left[i * 2 + 1]!);
    const end = pts[n - 1]!;
    tip.push(end.x + (end.x - pts[n - 2]!.x) * 0.6, end.y + (end.y - pts[n - 2]!.y) * 0.6);
    for (let i = n - 1; i >= tipStart; i--) tip.push(right[i * 2]!, right[i * 2 + 1]!);
    g.poly(tip).fill({ color: WHITE });
  }
}
