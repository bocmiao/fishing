import { Container, Graphics, Text } from 'pixi.js';
import { PALETTE } from '../palette';

/**
 * 小馆里的家具（俯视，占位）：桌子、凳子、柜台和灶、灯笼、墙上的菜牌。
 * 全部用 Graphics 画，正式美术到位后替换。
 */

export function drawTable(x: number, y: number, r: number): Graphics {
  const g = new Graphics();
  g.position.set(x, y);
  g.circle(8, 10, r).fill({ color: 0x000000, alpha: 0.22 });
  g.circle(0, 0, r).fill({ color: PALETTE.woodDark });
  g.circle(0, 0, r - 6).fill({ color: PALETTE.woodLight });
  // 桌面的木纹
  for (let i = -3; i <= 3; i++) {
    const yy = i * (r / 4);
    const half = Math.sqrt(Math.max(0, (r - 10) ** 2 - yy * yy));
    g.moveTo(-half, yy).lineTo(half, yy).stroke({ color: PALETTE.wood, width: 1.5, alpha: 0.5 });
  }
  g.circle(-r * 0.3, -r * 0.3, r * 0.25).fill({ color: PALETTE.paper, alpha: 0.08 });
  return g;
}

export function drawStool(x: number, y: number): Graphics {
  const g = new Graphics();
  g.position.set(x, y);
  g.circle(5, 6, 26).fill({ color: 0x000000, alpha: 0.2 });
  g.circle(0, 0, 26).fill({ color: PALETTE.wood });
  g.circle(0, 0, 20).fill({ color: PALETTE.woodLight });
  return g;
}

/** 柜台：一长条，右边是灶和铁锅，左边是砧板 */
export class Counter {
  readonly node = new Container();
  readonly stove: { x: number; y: number };
  readonly board: { x: number; y: number };
  private readonly wok = new Graphics();
  private flame = 0;

  constructor(cx: number, y: number, width: number, depth: number) {
    const x = cx - width / 2;
    const g = new Graphics();
    g.roundRect(x + 10, y + 14, width, depth, 10).fill({ color: 0x000000, alpha: 0.25 });
    g.roundRect(x, y, width, depth, 10).fill({ color: PALETTE.woodDark });
    g.roundRect(x + 6, y + 6, width - 12, depth - 18, 8).fill({ color: PALETTE.wood });
    for (let i = 1; i < 6; i++) {
      const lx = x + (width / 6) * i;
      g.moveTo(lx, y + 8)
        .lineTo(lx, y + depth - 14)
        .stroke({ color: PALETTE.woodShadow, width: 2, alpha: 0.4 });
    }
    // 灶
    this.stove = { x: cx + width * 0.28, y: y + depth / 2 - 6 };
    const s = this.stove;
    g.roundRect(s.x - 90, s.y - 44, 180, 88, 12).fill({ color: PALETTE.iron });
    g.circle(s.x, s.y, 36).fill({ color: PALETTE.woodShadow });
    // 砧板和菜刀
    this.board = { x: cx - width * 0.28, y: y + depth / 2 - 6 };
    const b = this.board;
    g.roundRect(b.x - 70, b.y - 34, 140, 68, 14).fill({ color: PALETTE.straw });
    g.roundRect(b.x - 64, b.y - 28, 128, 56, 12).stroke({ color: PALETTE.woodLight, width: 2 });
    g.roundRect(b.x + 20, b.y - 20, 50, 12, 3).fill({ color: 0xc8ccc4 });
    g.roundRect(b.x + 66, b.y - 20, 22, 12, 3).fill({ color: PALETTE.woodDark });
    this.node.addChild(g, this.wok);
    this.drawWok(0);
  }

  /** heat 0~1：锅下的火有多旺（做菜的时候） */
  update(dt: number, heat: number): void {
    this.flame += dt * (4 + heat * 10);
    this.drawWok(heat);
  }

  private drawWok(heat: number): void {
    const w = this.wok;
    const { x, y } = this.stove;
    w.clear();
    if (heat > 0.01) {
      // 锅边窜出来的火苗
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + this.flame * 0.3;
        const r = 40 + Math.sin(this.flame + i * 1.7) * 4 * heat;
        w.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 5 + 3 * heat).fill({
          color: i % 2 ? PALETTE.gold : PALETTE.vermilion,
          alpha: 0.5 * heat,
        });
      }
    }
    w.circle(x, y, 34).fill({ color: 0x2a2e2d });
    w.circle(x, y, 27).fill({ color: 0x4a504e });
    w.circle(x - 8, y - 8, 9).fill({ color: 0xffffff, alpha: 0.08 });
    w.roundRect(x + 30, y - 6, 46, 12, 5).fill({ color: PALETTE.woodDark });
  }
}

/** 挂在墙上的红灯笼：轻轻晃，底下一圈暖光 */
export class Lantern {
  readonly node = new Container();
  private readonly body = new Graphics();
  private phase: number;

  constructor(x: number, y: number, phase: number) {
    this.phase = phase;
    this.node.position.set(x, y);
    const glow = new Graphics();
    for (let r = 90; r > 10; r -= 16) {
      glow.circle(0, 18, r).fill({ color: PALETTE.lanternGlow, alpha: 0.035 });
    }
    this.body.circle(0, 0, 22).fill({ color: PALETTE.vermilion });
    this.body.ellipse(0, 0, 22, 9).stroke({ color: PALETTE.woodShadow, width: 2, alpha: 0.35 });
    this.body.ellipse(0, 0, 10, 22).stroke({ color: PALETTE.woodShadow, width: 1.5, alpha: 0.3 });
    this.body.circle(-6, -7, 6).fill({ color: PALETTE.lanternGlow, alpha: 0.5 });
    this.body.roundRect(-8, -26, 16, 6, 2).fill({ color: PALETTE.gold });
    this.body.roundRect(-8, 20, 16, 6, 2).fill({ color: PALETTE.gold });
    this.node.addChild(glow, this.body);
  }

  update(time: number): void {
    this.body.rotation = Math.sin(time * 0.9 + this.phase) * 0.05;
  }
}

/** 墙上的菜牌：写着今天的菜 */
export class MenuBoard {
  readonly node = new Container();
  private readonly lines: Text[] = [];

  constructor(x: number, y: number, slots: number) {
    this.node.position.set(x, y);
    const g = new Graphics();
    const h = 34 + slots * 30;
    g.roundRect(6, 8, 180, h, 6).fill({ color: 0x000000, alpha: 0.25 });
    g.roundRect(0, 0, 180, h, 6).fill({ color: PALETTE.woodShadow });
    g.roundRect(6, 6, 168, h - 12, 4).fill({ color: PALETTE.cream });
    const title = new Text({
      text: '今日菜单',
      style: {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: 17,
        fontWeight: '600',
        fill: PALETTE.vermilion,
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(90, 10);
    this.node.addChild(g, title);
    for (let i = 0; i < slots; i++) {
      const t = new Text({
        text: '',
        style: { fontFamily: 'Noto Serif SC, serif', fontSize: 16, fill: PALETTE.ink },
      });
      t.anchor.set(0.5, 0);
      t.position.set(90, 38 + i * 30);
      this.lines.push(t);
      this.node.addChild(t);
    }
  }

  setMenu(names: string[]): void {
    this.lines.forEach((t, i) => {
      const text = names[i] ?? (i === 0 ? '（还没定）' : '');
      if (t.text !== text) t.text = text;
    });
  }
}
