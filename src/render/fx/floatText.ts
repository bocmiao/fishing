import { Container, Text } from 'pixi.js';
import { PALETTE } from '../palette';

interface Floater {
  text: Text;
  age: number;
  life: number;
}

/** 往上飘、慢慢消失的小字，例如"+2 蚯蚓" */
export class FloatingTexts {
  readonly node = new Container();
  private readonly items: Floater[] = [];

  add(x: number, y: number, message: string, color: number = PALETTE.paper): void {
    const text = new Text({
      text: message,
      style: {
        fontFamily: 'Noto Serif SC, serif',
        fontSize: 26,
        fontWeight: '600',
        fill: color,
        stroke: { color: PALETTE.accent, width: 5 },
      },
    });
    text.anchor.set(0.5, 1);
    text.position.set(x, y);
    this.node.addChild(text);
    this.items.push({ text, age: 0, life: 1.6 });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i]!;
      f.age += dt;
      const t = f.age / f.life;
      f.text.y -= dt * 38 * (1 - t * 0.6);
      f.text.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      f.text.scale.set(t < 0.1 ? 0.7 + t * 3 : 1);
      if (f.age >= f.life) {
        f.text.destroy();
        this.items.splice(i, 1);
      }
    }
  }
}
