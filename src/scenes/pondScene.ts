import {
  Container,
  Rectangle,
  Texture,
  type FederatedPointerEvent,
  type RenderTexture,
} from 'pixi.js';
import { Scene, type SceneContext, type ViewSize } from '../app/scene';
import type { Rng } from '../sim/rng/rng';
import { TopDownCat } from '../render/cat/topDownCat';
import { FishAtlas } from '../render/fish/fishAtlas';
import { FishBody } from '../render/fish/fishBody';
import { FISH_TEX_H, FISH_TEX_W } from '../render/fish/koiPainter';
import { randomKoiLook, type KoiLook } from '../render/fish/koiLook';
import { Flock, type FishAgent } from '../render/flock/flock';
import { ambientAt } from '../render/fx/ambient';
import { PelletField } from '../render/fx/pellets';
import { PostOverlay } from '../render/fx/postOverlay';
import { Specks } from '../render/fx/specks';
import { hexToRgb, mixRgb, rgbToHex } from '../render/palette';
import { Deck } from '../render/props/deck';
import { LilyPads } from '../render/props/lilyPads';
import { renderProceduralPondBed } from '../render/water/pondBed';
import { RippleField } from '../render/water/ripples';
import { WaterSurface } from '../render/water/waterSurface';
import { SEASON_NAMES } from '../sim/time/clock';
import { WEATHER_NAMES } from '../sim/state';

interface Koi {
  agent: FishAgent;
  body: FishBody;
  look: KoiLook;
}

const FISH_COUNT = 64;
const DEEP_TINT = hexToRgb(0x6a9a84);

/**
 * 鱼塘画面（M0 技术验证）：锦鲤群游、点击撒饲料、观鱼模式。
 */
export class PondScene extends Scene {
  private rng!: Rng;
  private view!: ViewSize;
  private bed!: RenderTexture;
  private water!: WaterSurface;
  private readonly shadowLayer = new Container();
  private readonly fishLayer = new Container();
  private readonly surfaceLayer = new Container();
  private atlas!: FishAtlas;
  private flock!: Flock;
  private readonly koi: Koi[] = [];
  private pellets!: PelletField;
  private ripples!: RippleField;
  private specks!: Specks;
  private lilies!: LilyPads;
  private deck!: Deck;
  private cat!: TopDownCat;
  private post!: PostOverlay;
  private pelletsEaten = 0;
  private ambientTimer = 0;
  private uiTimer = 0;
  private catAlpha = 1;
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(ctx: SceneContext) {
    super(ctx);
  }

  enter(): void {
    const { app } = this.ctx;
    this.rng = this.ctx.rng.fork('pond');
    this.view = { ...this.ctx.view };
    const { width: w, height: h } = this.view;

    this.bed = renderProceduralPondBed(app.renderer, w, h, this.ctx.params.seed);
    this.water = new WaterSurface(this.bed, w, h);

    this.deck = new Deck(w / 2, h, 300, 150, this.rng.fork('deck'));
    this.flock = new Flock({ x: 0, y: 0, w, h }, this.rng.fork('flock'));
    this.flock.avoid = [this.deck.rect];

    this.atlas = new FishAtlas();
    const fishRng = this.rng.fork('fish');
    for (let i = 0; i < FISH_COUNT; i++) this.addKoi(randomKoiLook(fishRng), fishRng);
    this.atlas.flush();

    this.pellets = new PelletField(this.rng.fork('pellets'));
    this.ripples = new RippleField();
    this.lilies = new LilyPads({ x: 0, y: 0, w, h }, [this.deck.rect], this.rng.fork('lily'));
    this.specks = new Specks({ x: 0, y: 0, w, h }, 46, this.rng.fork('specks'));

    this.cat = new TopDownCat(this.rng.fork('cat'));
    this.cat.root.position.set(w / 2, h - 88);

    this.post = new PostOverlay(w, h);

    this.fishLayer.sortableChildren = true;
    this.shadowLayer.addChild(this.lilies.shadows, this.pellets.shadows, this.deck.shadow);
    this.surfaceLayer.addChild(
      this.ripples.graphics,
      this.lilies.surface,
      this.pellets.surface,
      this.specks.container,
    );
    this.root.addChild(
      this.water.mesh,
      this.shadowLayer,
      this.fishLayer,
      this.surfaceLayer,
      this.deck.node,
      this.cat.root,
      this.post.mesh,
    );

    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(0, 0, w, h);
    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      const p = e.getLocalPosition(this.root);
      this.feed(p.x, p.y);
    });
    window.addEventListener('keydown', this.onKey);

    this.ctx.ui.set({
      scene: 'pond',
      sceneTitle: '锦鲤池',
      sceneSubtitle: '',
      clockText: this.clockText(),
      hint: '点击水面撒鱼食　·　H 观鱼模式',
      fishing: null,
      fightActive: false,
      catchCard: null,
      sense: false,
      fishCount: this.koi.length,
      pelletsEaten: 0,
      watchMode: false,
      debug: this.ctx.params.debug,
    });
  }

  private addKoi(look: KoiLook, rng: Rng): void {
    const texture = this.atlas.add(look);
    const length = Math.max(68, Math.min(150, rng.normal(104, 20)));
    const agent = this.flock.spawn(length);
    const body = new FishBody(texture, this.atlas.shadow, length, FISH_TEX_H / FISH_TEX_W);
    body.place(agent.x, agent.y, agent.heading);
    this.shadowLayer.addChild(body.shadow);
    this.fishLayer.addChild(body.mesh);
    this.koi.push({ agent, body, look });
  }

  /** 撒一把鱼食 */
  feed(x: number, y: number): void {
    const d = this.deck.rect;
    if (x > d.x - 20 && x < d.x + d.w + 20 && y > d.y - 30) return;
    const drops = this.pellets.scatter(x, y, this.rng.int(14, 20));
    this.ripples.add(x, y, 1, 2.6, 6);
    for (const p of drops) this.ripples.add(p.x, p.y, 0.3, 1.2, 1);
    this.flock.alertFood(x, y);
    const cat = this.cat.root.position;
    this.cat.lookAt(x - cat.x, y - cat.y);
    this.cat.toss();
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'h' || e.key === 'H') {
      this.ctx.ui.set({ watchMode: !this.ctx.ui.get().watchMode });
    } else if (e.key === 'F3') {
      this.ctx.ui.set({ debug: !this.ctx.ui.get().debug });
      e.preventDefault();
    }
  }

  private clockText(): string {
    const s = this.ctx.state;
    const c = s.clock;
    return `第 ${c.day + 1} 天 · ${SEASON_NAMES[c.season]} · ${c.formatTime()} · ${WEATHER_NAMES[s.weather]}`;
  }

  override update(dt: number): void {
    const state = this.ctx.state;
    if (state.clock.advance(dt).reachedDayEnd) state.sleep();
    const amb = ambientAt(state.clock.minute, state.weather);
    this.water.setDim(amb.dim);
    this.water.setCaustic(amb.caustic);
    this.post.setTint(amb.tint, amb.tintAlpha);
    this.water.update(dt, this.ripples.ripples);
    this.flock.update(dt, this.pellets.pellets, (agent, item) => {
      this.pelletsEaten++;
      this.ripples.add(item.x, item.y, 0.45, 1.1, 2);
      agent.effort = 1;
    });

    for (const k of this.koi) {
      const a = k.agent;
      k.body.follow(a.x, a.y);
      const scale = 1 - a.depth * 0.1;
      const lift = 1 - a.depth;
      const reach = (0.35 + 1.15 * lift) * (a.length / 110);
      k.body.draw(
        { phase: a.phase, amplitude: 0.035 + 0.055 * a.effort },
        scale,
        9 * reach,
        11 * reach,
      );
      k.body.mesh.zIndex = -a.depth;
      k.body.mesh.tint = rgbToHex(mixRgb([1, 1, 1], DEEP_TINT, 0.06 + a.depth * 0.4));
      k.body.mesh.alpha = 1 - a.depth * 0.16;
      k.body.shadow.alpha = 0.2 + 0.12 * a.depth;
    }

    // 偶尔有鱼到水面啄一下，带起小波纹
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = this.rng.range(1.5, 4);
      const shallow = this.koi.filter((k) => k.agent.depth < 0.35);
      if (shallow.length > 0) {
        const k = this.rng.pick(shallow);
        this.ripples.add(k.agent.x, k.agent.y, 0.35, 1.6, 2);
      }
    }

    this.pellets.update(dt);
    this.ripples.update(dt);
    this.lilies.update(dt);
    this.specks.update(dt);
    this.cat.update(dt);

    const watch = this.ctx.ui.get().watchMode;
    this.catAlpha += ((watch ? 0 : 1) - this.catAlpha) * Math.min(1, dt * 4);
    this.cat.root.alpha = this.catAlpha;
    this.cat.root.visible = this.catAlpha > 0.01;

    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.5;
      this.ctx.ui.set({
        fishCount: this.koi.length,
        pelletsEaten: this.pelletsEaten,
        clockText: this.clockText(),
      });
    }
  }

  override resize(view: ViewSize): void {
    if (view.width === this.view.width && view.height === this.view.height) return;
    // 简单处理：重新生成池底并更新各层尺寸（鱼和装饰保持原位）
    this.view = { ...view };
    const { width: w, height: h } = view;
    const old = this.bed;
    this.bed = renderProceduralPondBed(this.ctx.app.renderer, w, h, this.ctx.params.seed);
    this.water.setBed(this.bed);
    this.water.resize(w, h);
    old.destroy(true);
    this.post.resize(w, h);
    this.flock.bounds = { x: 0, y: 0, w, h };
    this.specks.resize({ x: 0, y: 0, w, h });
    this.root.hitArea = new Rectangle(0, 0, w, h);
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKey);
    // 先销毁显示对象，再销毁它们用到的纹理
    this.water.setBed(Texture.EMPTY);
    super.exit();
    this.atlas.destroy();
    this.bed.destroy(true);
  }

  /** 调试用：返回每条鱼的品种统计 */
  debugVarieties(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of this.koi) out[k.look.variety] = (out[k.look.variety] ?? 0) + 1;
    return out;
  }
}
