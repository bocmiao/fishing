import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { FISH_TEX_H, FISH_TEX_W, paintFishShadow, paintKoi } from './koiPainter';
import type { KoiLook } from './koiLook';

const PAGE_SIZE = 2048;
/** 格子之间留边，避免缩小（mipmap）时相邻的鱼互相渗色 */
const PAD = 2;
const CELL_W = FISH_TEX_W + PAD * 2;
const CELL_H = FISH_TEX_H + PAD * 2;
const COLS = Math.floor(PAGE_SIZE / CELL_W);
const ROWS = Math.floor(PAGE_SIZE / CELL_H);

interface Page {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  source: CanvasSource;
  used: number;
  dirty: boolean;
}

/**
 * 把程序画出的鱼纹理打包进几张大图，所有鱼共用少数几个纹理，渲染时可以合批。
 */
export class FishAtlas {
  private readonly pages: Page[] = [];
  private readonly scratch = new ImageData(FISH_TEX_W, FISH_TEX_H);
  readonly shadow: Texture;

  constructor() {
    this.shadow = this.allocate((data) => paintFishShadow(data, FISH_TEX_W, 0, 0));
  }

  /** 画一条鱼，返回它的纹理 */
  add(look: KoiLook): Texture {
    return this.allocate((data) => paintKoi(look, data, FISH_TEX_W, 0, 0));
  }

  /** 把新画的鱼上传到显卡；在一批 add() 之后调用一次 */
  flush(): void {
    for (const page of this.pages) {
      if (page.dirty) {
        page.source.update();
        page.dirty = false;
      }
    }
  }

  destroy(): void {
    for (const page of this.pages) page.source.destroy();
    this.pages.length = 0;
  }

  private allocate(paint: (data: Uint8ClampedArray) => void): Texture {
    let page = this.pages[this.pages.length - 1];
    if (!page || page.used >= COLS * ROWS) page = this.newPage();
    const slot = page.used++;
    const x = (slot % COLS) * CELL_W + PAD;
    const y = Math.floor(slot / COLS) * CELL_H + PAD;
    this.scratch.data.fill(0);
    paint(this.scratch.data);
    page.ctx.putImageData(this.scratch, x, y);
    page.dirty = true;
    return new Texture({ source: page.source, frame: new Rectangle(x, y, FISH_TEX_W, FISH_TEX_H) });
  }

  private newPage(): Page {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_SIZE;
    canvas.height = PAGE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    const source = new CanvasSource({
      resource: canvas,
      resolution: 1,
      autoGenerateMipmaps: true,
      scaleMode: 'linear',
    });
    source.style.mipmapFilter = 'linear';
    const page: Page = { canvas, ctx, source, used: 0, dirty: true };
    this.pages.push(page);
    return page;
  }
}
