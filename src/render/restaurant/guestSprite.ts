import { Container, Graphics, Text } from 'pixi.js';
import type { GuestKind } from '../../sim/data/schema';
import { PALETTE, paletteColor } from '../palette';

/** 气泡的样子：想点什么、点好的菜、正在做、吃开心了、等不及了 */
export type BubbleTone = 'think' | 'order' | 'cooking' | 'happy' | 'sad';

const BUBBLE_FILL: Record<BubbleTone, number> = {
  think: PALETTE.cream,
  order: PALETTE.paper,
  cooking: PALETTE.lanternGlow,
  happy: PALETTE.paper,
  sad: PALETTE.card,
};

/**
 * 小馆的客人（俯视的拟人小动物，占位画法）。身体朝 +x 画，转身用 rotation；
 * 头上的气泡不跟着转。
 */
export class GuestSprite {
  readonly node = new Container();
  private readonly body = new Graphics();
  private readonly bubble = new Container();
  private readonly bubbleBg = new Graphics();
  private readonly bubbleText = new Text({
    text: '',
    style: {
      fontFamily: 'Noto Serif SC, serif',
      fontSize: 18,
      fontWeight: '600',
      fill: PALETTE.ink,
    },
  });
  private readonly ring = new Graphics();
  private bob = 0;
  private patience = 1;

  constructor(readonly kind: GuestKind) {
    this.drawBody();
    this.bubbleText.anchor.set(0.5);
    this.bubble.addChild(this.bubbleBg, this.ring, this.bubbleText);
    this.bubble.position.set(0, -74);
    this.bubble.visible = false;
    this.node.addChild(this.body, this.bubble);
  }

  /** 朝向（弧度，0 = 朝右） */
  set facing(angle: number) {
    this.body.rotation = angle;
  }

  setBubble(text: string | null, tone: BubbleTone = 'order'): void {
    if (text === null) {
      this.bubble.visible = false;
      return;
    }
    this.bubble.visible = true;
    this.bubbleText.text = text;
    const w = Math.max(56, this.bubbleText.width + 30);
    const g = this.bubbleBg;
    g.clear();
    g.roundRect(-w / 2 + 3, -19, w, 40, 14).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(-w / 2, -22, w, 40, 14).fill({ color: BUBBLE_FILL[tone] });
    g.poly([-8, 17, 8, 17, 0, 30]).fill({ color: BUBBLE_FILL[tone] });
    this.bubbleText.alpha = tone === 'sad' ? 0.6 : 1;
    this.ring.position.set(-w / 2 - 4, -2);
    this.drawRing();
  }

  /** 等菜的耐心 0~1（气泡左边的一圈） */
  setPatience(p: number): void {
    if (Math.abs(p - this.patience) < 0.01) return;
    this.patience = p;
    this.drawRing();
  }

  private drawRing(): void {
    const g = this.ring;
    g.clear();
    if (this.patience >= 0.999) return;
    g.circle(0, 0, 11).fill({ color: PALETTE.paper });
    const color = this.patience > 0.35 ? PALETTE.leaf : PALETTE.vermilion;
    g.moveTo(0, 0)
      .arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.patience)
      .lineTo(0, 0)
      .fill({ color });
  }

  /** 吃东西时轻轻点头 */
  update(dt: number, eating: boolean): void {
    this.bob += dt * (eating ? 7 : 2);
    const s = 1 + Math.sin(this.bob) * (eating ? 0.035 : 0.012);
    this.body.scale.set(s);
  }

  private drawBody(): void {
    const g = this.body;
    const color = paletteColor(this.kind.color);
    const accent = paletteColor(this.kind.accent);
    // 影子和肩膀（衣服用靛蓝，和阿喵的外套呼应）
    g.ellipse(4, 6, 30, 34).fill({ color: 0x000000, alpha: 0.2 });
    g.ellipse(-8, 0, 26, 32).fill({ color: PALETTE.indigo });
    switch (this.kind.animal) {
      case 'rabbit':
        // 长耳朵往后倒
        for (const s of [-1, 1]) {
          g.ellipse(-30, s * 11, 22, 7).fill({ color });
          g.ellipse(-30, s * 11, 15, 3.5).fill({ color: accent });
        }
        break;
      case 'dog':
      case 'fox':
        for (const s of [-1, 1]) {
          g.poly([-4, s * 8, -14, s * 26, 6, s * 18]).fill({ color });
          if (this.kind.animal === 'fox')
            g.poly([-10, s * 20, -14, s * 26, -6, s * 23]).fill({ color: accent });
        }
        break;
      case 'otter':
        for (const s of [-1, 1]) g.circle(-4, s * 17, 6).fill({ color });
        break;
      case 'buffalo':
        for (const s of [-1, 1]) {
          g.moveTo(-2, s * 14)
            .quadraticCurveTo(-4, s * 34, -22, s * 32)
            .stroke({ color: PALETTE.cream, width: 6, cap: 'round' });
        }
        break;
      case 'duck':
        break;
    }
    g.circle(0, 0, 20).fill({ color });
    switch (this.kind.animal) {
      case 'duck':
        g.ellipse(22, 0, 11, 7).fill({ color: accent });
        g.circle(-18, 0, 7).fill({ color });
        break;
      case 'dog':
      case 'fox':
        g.ellipse(16, 0, 10, 8).fill({ color: accent });
        g.circle(24, 0, 3).fill({ color: PALETTE.ink });
        break;
      case 'otter':
        g.ellipse(12, 0, 10, 11).fill({ color: accent });
        g.circle(20, 0, 3).fill({ color: PALETTE.ink });
        break;
      case 'buffalo':
        g.ellipse(16, 0, 10, 12).fill({ color: accent });
        break;
      case 'rabbit':
        g.circle(18, 0, 3).fill({ color: accent });
        break;
    }
    // 头顶一点高光
    g.circle(-6, -6, 7).fill({ color: PALETTE.fishWhite, alpha: 0.12 });
  }
}
