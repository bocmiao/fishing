import {
  Container,
  Rectangle,
  Text,
  Texture,
  type FederatedPointerEvent,
  type RenderTexture,
} from 'pixi.js';
import type { GameCommand } from '../app/commands';
import { Scene, type SceneContext, type ViewSize } from '../app/scene';
import { formatWeight } from '../sim/fishing/catchRoll';
import { Rng } from '../sim/rng/rng';
import type { PondFish } from '../sim/state';
import { TopDownCat } from '../render/cat/topDownCat';
import { FishAtlas } from '../render/fish/fishAtlas';
import { FishBody } from '../render/fish/fishBody';
import { renderFishImage } from '../render/fish/fishImage';
import type { KoiLook } from '../render/fish/koiLook';
import { pondFishLook } from '../render/fish/pondFishLook';
import { speciesLook } from '../render/fish/speciesLook';
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
  fish: PondFish;
}

const DEEP_TINT = hexToRgb(0x6a9a84);
/** 一次放好几条鱼时，每条之间隔多久（秒） */
const RELEASE_INTERVAL = 0.45;
const TAG_SECONDS = 3.5;

/**
 * 自家鱼塘：外公留下的锦鲤和自己钓回来的鱼在这里养着。
 * 点击水面撒饲料，点一条鱼看它是谁；鱼护里的鱼可以放进来；H 观鱼模式。
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
  /** 点鱼时浮在它头上的名牌：名字 + 一行小字（品种、来历） */
  private readonly tag = new Container();
  private readonly tagName = new Text({
    text: '',
    style: {
      fontFamily: 'Noto Serif SC, serif',
      fontSize: 24,
      fontWeight: '600',
      fill: 0xf5ebdb,
      stroke: { color: 0x1c3a3a, width: 5 },
    },
  });
  private readonly tagDetail = new Text({
    text: '',
    style: {
      fontFamily: 'Noto Serif SC, serif',
      fontSize: 15,
      fill: 0xe6e9de,
      stroke: { color: 0x1c3a3a, width: 4 },
    },
  });
  private tagged: Koi | null = null;
  private tagTime = 0;
  private readonly releaseQueue: number[] = [];
  private releaseTimer = 0;
  /** 鱼护面板里的鱼图，按编号缓存 */
  private readonly images = new Map<number, string>();
  private toastId = 0;
  private pelletsEaten = 0;
  private ambientTimer = 0;
  private uiTimer = 0;
  private catAlpha = 1;
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);
  private unsubscribe: (() => void) | null = null;

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
    for (const f of this.ctx.state.pond) this.addFish(f);
    this.atlas.flush();

    this.pellets = new PelletField(this.rng.fork('pellets'));
    this.ripples = new RippleField();
    this.lilies = new LilyPads({ x: 0, y: 0, w, h }, [this.deck.rect], this.rng.fork('lily'));
    this.specks = new Specks({ x: 0, y: 0, w, h }, 46, this.rng.fork('specks'));

    this.cat = new TopDownCat(this.rng.fork('cat'));
    this.cat.root.position.set(w / 2, h - 88);

    this.post = new PostOverlay(w, h);
    this.tagName.anchor.set(0.5, 1);
    this.tagDetail.anchor.set(0.5, 1);
    this.tagName.y = -22;
    this.tag.addChild(this.tagName, this.tagDetail);
    this.tag.visible = false;

    this.fishLayer.sortableChildren = true;
    this.shadowLayer.addChild(this.lilies.shadows, this.pellets.shadows, this.deck.shadow);
    this.surfaceLayer.addChild(
      this.ripples.graphics,
      this.lilies.surface,
      this.pellets.surface,
      this.specks.container,
      this.tag,
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
      const hit = this.fishAt(p.x, p.y);
      if (hit) this.showTag(hit);
      else this.feed(p.x, p.y);
    });
    window.addEventListener('keydown', this.onKey);
    this.unsubscribe = this.ctx.commands.on((cmd) => this.handleCommand(cmd));

    const state = this.ctx.state;
    this.ctx.ui.set({
      scene: 'pond',
      sceneTitle: state.data.pond.name,
      sceneSubtitle: '',
      clockText: this.clockText(),
      hint: '点击水面撒鱼食　·　点一条鱼看看它是谁　·　H 观鱼模式',
      fishing: null,
      fightActive: false,
      catchCard: null,
      sense: false,
      fishCount: this.koi.length,
      pelletsEaten: 0,
      watchMode: false,
      debug: this.ctx.params.debug,
    });
    this.pushPondUi();
    if (state.keepNet.length > 0) {
      this.toast(`鱼护里有 ${state.keepNet.length} 条鱼，可以放进塘里养`, 'info');
    } else if (state.pond.every((f) => f.speciesId === null) && state.clock.day < 2) {
      this.toast('塘里只有外公留下的两条锦鲤……去屋后小溪钓些鱼回来养吧', 'info');
    }
  }

  private addFish(fish: PondFish, at?: { x: number; y: number; heading: number }): Koi {
    const { look, length, aspect } = pondFishLook(fish, this.ctx.state.data);
    const texture = this.atlas.add(look);
    const agent = this.flock.spawn(length, at);
    const body = new FishBody(texture, this.atlas.shadowFor(look.shape ?? 'carp'), length, aspect);
    body.place(agent.x, agent.y, agent.heading);
    this.shadowLayer.addChild(body.shadow);
    this.fishLayer.addChild(body.mesh);
    const koi = { agent, body, look, fish };
    this.koi.push(koi);
    return koi;
  }

  private handleCommand(cmd: GameCommand): void {
    const state = this.ctx.state;
    if (cmd.type === 'toggleWatch') {
      this.toggleWatch();
    } else if (cmd.type === 'releaseToPond') {
      const uids = cmd.uid === 'all' ? state.keepNet.map((f) => f.uid) : [cmd.uid];
      for (const uid of uids) if (!this.releaseQueue.includes(uid)) this.releaseQueue.push(uid);
      if (state.pond.length + this.releaseQueue.length > state.pondCapacity)
        this.toast(`塘里最多养 ${state.pondCapacity} 条，放不下的先留在鱼护里`, 'info');
    } else if (cmd.type === 'releaseToWild') {
      if (state.releaseToWild(cmd.uid)) {
        this.images.delete(cmd.uid);
        this.toast('放回小溪了，快快长大吧', 'info');
        this.pushPondUi();
      }
    }
  }

  /** 从栈台前放一条鱼下水 */
  private releaseOne(uid: number): void {
    const state = this.ctx.state;
    const fish = state.releaseToPond(uid);
    if (!fish) return;
    this.images.delete(uid);
    const d = this.deck.rect;
    const x = d.x + d.w / 2 + this.rng.range(-d.w * 0.35, d.w * 0.35);
    const y = d.y - 26;
    const koi = this.addFish(fish, { x, y, heading: -Math.PI / 2 + this.rng.range(-0.5, 0.5) });
    this.atlas.flush();
    koi.agent.depth = 0.02;
    koi.agent.effort = 1;
    this.ripples.add(x, y, 1, 2.2, 5);
    this.ripples.add(x, y - 20, 0.5, 1.4, 2);
    const cat = this.cat.root.position;
    this.cat.lookAt(x - cat.x, y - cat.y);
    this.cat.toss();
    this.toast(
      `${fish.name}游进了${state.data.pond.name}（${state.pond.length}/${state.pondCapacity}）`,
      'good',
    );
    this.pushPondUi();
  }

  /** 点到的鱼（离点击位置最近、且在身体范围内的那条） */
  private fishAt(x: number, y: number): Koi | null {
    let best: Koi | null = null;
    let bestD = Infinity;
    for (const k of this.koi) {
      const a = k.agent;
      // agent 的位置是鱼头，身体中心在头后面半个身长
      const cx = a.x - Math.cos(a.heading) * a.length * 0.4;
      const cy = a.y - Math.sin(a.heading) * a.length * 0.4;
      const d = Math.hypot(x - cx, y - cy);
      if (d < Math.max(28, a.length * 0.5) && d < bestD) {
        best = k;
        bestD = d;
      }
    }
    return best;
  }

  private showTag(k: Koi): void {
    const f = k.fish;
    const detail = f.variety
      ? `${f.variety}锦鲤 · ${f.origin}`
      : `${formatWeight(f.weightKg)} · ${f.origin}`;
    this.tagName.text = f.name;
    this.tagDetail.text = detail;
    this.tagged = k;
    this.tagTime = TAG_SECONDS;
  }

  private pushPondUi(): void {
    const state = this.ctx.state;
    this.ctx.ui.set({
      pond: {
        name: state.data.pond.name,
        count: state.pond.length,
        capacity: state.pondCapacity,
        keepNet: state.keepNet.map((f) => ({
          uid: f.uid,
          name: state.data.speciesById.get(f.speciesId)?.name ?? f.speciesId,
          weightText: formatWeight(f.weightKg),
          image: this.imageFor(f.uid, f.speciesId, f.lookSeed),
        })),
      },
      fishCount: this.koi.length,
    });
  }

  private imageFor(uid: number, speciesId: string, lookSeed: number): string {
    let url = this.images.get(uid);
    const species = this.ctx.state.data.speciesById.get(speciesId);
    if (!url && species) {
      url = renderFishImage(speciesLook(species, new Rng(lookSeed)), 0.7);
      this.images.set(uid, url);
    }
    return url ?? '';
  }

  private toast(text: string, tone: 'good' | 'bad' | 'info'): void {
    this.ctx.ui.set({ toast: { id: ++this.toastId, text, tone } });
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

  private toggleWatch(): void {
    this.ctx.ui.set({ watchMode: !this.ctx.ui.get().watchMode });
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'h' || e.key === 'H') {
      this.toggleWatch();
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

    // 一条一条地放鱼下水
    this.releaseTimer -= dt;
    if (this.releaseQueue.length > 0 && this.releaseTimer <= 0) {
      this.releaseTimer = RELEASE_INTERVAL;
      const uid = this.releaseQueue.shift()!;
      if (state.pondFull) this.releaseQueue.length = 0;
      else this.releaseOne(uid);
    }

    // 名牌跟着鱼走，时间到了淡出
    if (this.tagged && this.tagTime > 0) {
      this.tagTime -= dt;
      const a = this.tagged.agent;
      const cx = a.x - Math.cos(a.heading) * a.length * 0.4;
      const cy = a.y - Math.sin(a.heading) * a.length * 0.4;
      this.tag.position.set(cx, cy - a.length * 0.3 - 10);
      this.tag.alpha = Math.min(1, this.tagTime / 0.5, (TAG_SECONDS - this.tagTime) / 0.2);
      this.tag.visible = true;
    } else {
      this.tagged = null;
      this.tag.visible = false;
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
        pelletsEaten: this.pelletsEaten,
        clockText: this.clockText(),
      });
    }
  }

  override refresh(): void {
    this.pushPondUi();
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
    this.unsubscribe?.();
    this.ctx.ui.set({ watchMode: false, pond: null });
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
