import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../../sim/rng/rng';
import type { Rect } from '../flock/flock';

/**
 * 塘边的小木栈台（俯视）：阿喵坐在上面。占位素材，正式美术到位后替换。
 * 栈台从画面底边伸进水里，木板横向铺设。
 */
export class Deck {
  readonly node = new Container();
  readonly shadow = new Graphics();
  readonly rect: Rect;

  constructor(x: number, bottom: number, width: number, depth: number, rng: Rng) {
    this.rect = { x: x - width / 2, y: bottom - depth, w: width, h: depth };
    const r = this.rect;
    // 影子投向右下
    this.shadow.roundRect(r.x + 10, r.y + 12, r.w, r.h, 6).fill({ color: 0x0f231d, alpha: 0.3 });

    const g = new Graphics();
    const plankH = 27;
    const gap = 3;
    const tones = [0x9b7a55, 0x8d6c4a, 0xa3825c, 0x94734f];
    for (let y = r.y, i = 0; y < r.y + r.h; y += plankH + gap, i++) {
      const h = Math.min(plankH, r.y + r.h - y);
      const tone = tones[(i + rng.int(0, 3)) % tones.length]!;
      const inset = rng.range(0, 3);
      g.roundRect(r.x + inset, y, r.w - inset * 2 + rng.range(-2, 2), h, 2).fill({ color: tone });
      // 木纹
      for (let k = 0; k < 3; k++) {
        const gy = y + h * (0.25 + 0.25 * k) + rng.range(-2, 2);
        g.moveTo(r.x + 6, gy);
        let px = r.x + 6;
        while (px < r.x + r.w - 8) {
          px += rng.range(18, 40);
          g.lineTo(Math.min(px, r.x + r.w - 8), gy + rng.range(-1.2, 1.2));
        }
      }
      g.stroke({ width: 1, color: 0x6e5236, alpha: 0.35 });
      // 钉子
      g.circle(r.x + 12, y + h / 2, 1.8).fill({ color: 0x4d3a28, alpha: 0.8 });
      g.circle(r.x + r.w - 12, y + h / 2, 1.8).fill({ color: 0x4d3a28, alpha: 0.8 });
      // 受光的上沿
      g.moveTo(r.x + 3, y + 1)
        .lineTo(r.x + r.w - 3, y + 1)
        .stroke({ width: 1.2, color: 0xd6b88e, alpha: 0.35 });
    }
    // 伸进水里的两根木桩
    for (const px of [r.x + 8, r.x + r.w - 8]) {
      g.circle(px, r.y + 6, 11).fill({ color: 0x5f4630 });
      g.circle(px - 2, r.y + 4, 7).fill({ color: 0x7b5c3f });
      g.circle(px - 2, r.y + 4, 3.5).stroke({ width: 1, color: 0x5a4230, alpha: 0.6 });
    }
    this.node.addChild(g);
  }
}
