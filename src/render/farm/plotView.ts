import { Container, Graphics } from 'pixi.js';
import type { Plot } from '../../sim/farm/farm';
import { Rng } from '../../sim/rng/rng';
import type { Rect } from '../flock/flock';
import { PALETTE } from '../palette';
import { drawCrop } from './cropArt';

/** 每块地里种几行、每行几株 */
const LAYOUT: Record<string, [rows: number, cols: number]> = {
  corn: [2, 4],
  wheat: [3, 5],
  soybean: [2, 4],
  scallion: [3, 5],
  greens: [2, 4],
};

/**
 * 菜地里的一块地（俯视）：土、垄沟、杂草石头、作物。
 * 地的状态变了才重画；作物每帧只做轻微的摆动。
 */
export class PlotView {
  readonly node = new Container();
  private readonly soil = new Graphics();
  private readonly plants = new Container();
  private readonly outline = new Graphics();
  private key = '';
  private readonly phases: number[] = [];

  constructor(
    readonly rect: Rect,
    private readonly seed: number,
  ) {
    this.node.position.set(rect.x, rect.y);
    this.outline.visible = false;
    this.outline
      .roundRect(-4, -4, rect.w + 8, rect.h + 8, 16)
      .stroke({ color: PALETTE.paper, width: 3, alpha: 0.85 });
    this.node.addChild(this.soil, this.plants, this.outline);
  }

  set hover(on: boolean) {
    this.outline.visible = on;
  }

  /** 按地的状态重画（状态没变就什么也不做） */
  sync(plot: Plot, growth: number): void {
    const key = `${plot.stage}|${plot.cropId}|${growth.toFixed(2)}|${plot.watered}|${plot.compost}`;
    if (key === this.key) return;
    this.key = key;
    this.drawSoil(plot);
    this.drawPlants(plot, growth);
  }

  update(time: number): void {
    const kids = this.plants.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i]!.rotation = Math.sin(time * 1.3 + this.phases[i]!) * 0.035;
    }
  }

  /** 挖土时土块飞出来的中心（局部坐标 → 画面坐标） */
  get center(): { x: number; y: number } {
    return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 };
  }

  private drawSoil(plot: Plot): void {
    const g = this.soil;
    const { w, h } = this.rect;
    const rng = new Rng(this.seed);
    g.clear();
    // 影子
    g.roundRect(6, 8, w, h, 14).fill({ color: 0x000000, alpha: 0.12 });
    const base = plot.stage === 'wild' || plot.stage === 'soil' ? PALETTE.soilDry : PALETTE.soil;
    g.roundRect(0, 0, w, h, 14).fill({ color: base });

    if (plot.stage === 'wild') {
      // 杂草和石头
      for (let i = 0; i < 70; i++) {
        const x = rng.range(10, w - 10);
        const y = rng.range(10, h - 10);
        const color = rng.chance(0.5) ? PALETTE.grassDark : PALETTE.grass;
        for (let k = 0; k < 4; k++) {
          const a = rng.range(-Math.PI, Math.PI);
          const l = rng.range(6, 14);
          g.moveTo(x, y)
            .lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
            .stroke({ color, width: 2, cap: 'round' });
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = rng.range(24, w - 24);
        const y = rng.range(24, h - 24);
        const r = rng.range(8, 16);
        g.ellipse(x + 3, y + 4, r, r * 0.8).fill({ color: 0x000000, alpha: 0.18 });
        g.ellipse(x, y, r, r * 0.8).fill({ color: 0x8f978a });
        g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.3).fill({ color: 0xb6bcae });
      }
      return;
    }

    // 泥土的颗粒
    for (let i = 0; i < 90; i++) {
      const x = rng.range(6, w - 6);
      const y = rng.range(6, h - 6);
      g.circle(x, y, rng.range(1, 2.4)).fill({
        color: rng.chance(0.5) ? PALETTE.soilWet : PALETTE.soilDry,
        alpha: 0.5,
      });
    }
    if (plot.stage !== 'soil') {
      // 垄沟：一道道横着的土垄
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y = ((r + 0.5) / rows) * h;
        g.roundRect(10, y - 9, w - 20, 18, 9).fill({ color: PALETTE.soilDry, alpha: 0.45 });
        g.moveTo(14, y + 11)
          .lineTo(w - 14, y + 11)
          .stroke({ color: PALETTE.soilWet, width: 3, alpha: 0.5, cap: 'round' });
      }
    }
    if (plot.compost) {
      for (let i = 0; i < 40; i++) {
        g.circle(rng.range(8, w - 8), rng.range(8, h - 8), rng.range(1.5, 3)).fill({
          color: 0x3a2a1e,
          alpha: 0.7,
        });
      }
    }
    if (plot.watered) {
      g.roundRect(0, 0, w, h, 14).fill({ color: PALETTE.soilWet, alpha: 0.45 });
    }
  }

  private drawPlants(plot: Plot, growth: number): void {
    for (const c of this.plants.removeChildren()) c.destroy();
    this.phases.length = 0;
    if ((plot.stage !== 'growing' && plot.stage !== 'ripe') || !plot.cropId) return;
    const [rows, cols] = LAYOUT[plot.cropId] ?? [2, 4];
    const { w, h } = this.rect;
    const rng = new Rng(this.seed + 7);
    const ripe = plot.stage === 'ripe';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const g = new Graphics();
        g.position.set(
          ((c + 0.5) / cols) * w + rng.range(-5, 5),
          ((r + 0.5) / rows) * h + rng.range(-4, 4),
        );
        drawCrop(g, plot.cropId, growth, ripe, rng);
        this.plants.addChild(g);
        this.phases.push(rng.range(0, Math.PI * 2));
      }
    }
  }
}
