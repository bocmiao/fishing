import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent,
  type RenderTexture,
} from 'pixi.js';
import type { GameCommand } from '../app/commands';
import { Scene, type SceneContext, type ViewSize } from '../app/scene';
import type { FishingPosition, FishSpecies, Spot } from '../sim/data/schema';
import {
  approachChance,
  noticeRadius,
  planBite,
  spookRadius,
  strikeQuality,
  type BitePlan,
} from '../sim/fishing/bite';
import { fishPrice, formatWeight, rollFish } from '../sim/fishing/catchRoll';
import { DEFAULT_FIGHT_PARAMS, Fight, type FightParams } from '../sim/fishing/fight';
import { ReelCrank } from '../sim/fishing/reel';
import { pickSpecies } from '../sim/fishing/spawn';
import { zoneAt } from '../sim/fishing/zones';
import { Rng } from '../sim/rng/rng';
import { SEASON_NAMES } from '../sim/time/clock';
import { WEATHER_NAMES } from '../sim/state';
import { TopDownCat } from '../render/cat/topDownCat';
import { FishAtlas } from '../render/fish/fishAtlas';
import { renderFishImage } from '../render/fish/fishImage';
import { speciesLook } from '../render/fish/speciesLook';
import { AimReticle, Bobber, FishingLine, Rod } from '../render/fishing/tackle';
import { WildFishPool, type WildFish } from '../render/fishing/wildFish';
import { ambientAt } from '../render/fx/ambient';
import { PostOverlay } from '../render/fx/postOverlay';
import { Rain } from '../render/fx/rain';
import { Specks } from '../render/fx/specks';
import { renderCreek } from '../render/water/creekBed';
import { RippleField } from '../render/water/ripples';
import { WaterSurface } from '../render/water/waterSurface';

type Phase = 'aim' | 'charge' | 'flying' | 'waiting' | 'bite' | 'fight' | 'result';

const HINTS: Record<Phase, string> = {
  aim: '移动鼠标瞄准，按住左键蓄力，松开抛竿',
  charge: '松开抛竿',
  flying: '',
  waiting: '等鱼咬钩……浮漂沉下去时按空格（或点击）提竿，没动静时点击收竿',
  bite: '咬钩了！快按空格！',
  fight: '',
  result: '',
};

/** 触屏上的说法（没有鼠标和空格） */
const TOUCH_HINTS: Partial<Record<Phase, string>> = {
  aim: '按住屏幕瞄准蓄力，松开抛竿',
  waiting: '等鱼咬钩……浮漂沉下去时点屏幕提竿（没动静时点屏幕收竿）',
  bite: '咬钩了！快点屏幕！',
};

const RARITY_TEXT: Record<string, string> = {
  common: '常见',
  uncommon: '少见',
  rare: '稀有',
  legendary: '传说',
};
const MIN_CAST = 90;
const MAX_AIM = 0.75;

export interface FishingSceneOptions {
  spotId: string;
  positionId?: string;
}

/**
 * 钓鱼画面（方案 B）：俯视一段溪水，阿喵坐在岸边。
 * 进入参数只有"哪个钓点的哪个钓位"，方案 C 的行走地图也用同样的参数打开这里。
 */
export class FishingScene extends Scene {
  private rng!: Rng;
  private view!: ViewSize;
  private spot!: Spot;
  private position!: FishingPosition;
  private speciesHere: FishSpecies[] = [];

  private readonly worldLayer = new Container();
  private water!: WaterSurface;
  private bed: RenderTexture | null = null;
  private bankTex: RenderTexture | null = null;
  private readonly bank = new Sprite();
  private readonly bedShadowLayer = new Container();
  private readonly surfaceLayer = new Container();
  private atlas!: FishAtlas;
  private pool!: WildFishPool;
  private ripples!: RippleField;
  private rain!: Rain;
  private specks!: Specks;
  private rod!: Rod;
  private line!: FishingLine;
  private bobber!: Bobber;
  private reticle!: AimReticle;
  private cat!: TopDownCat;
  private post!: PostOverlay;
  private readonly fade = new Graphics();
  /** 咬钩时浮漂上方蹦出的"！" */
  private readonly alert = new Text({
    text: '！',
    style: {
      fontFamily: 'Noto Serif SC, serif',
      fontSize: 40,
      fontWeight: '600',
      fill: 0xf5ebdb,
      stroke: { color: 0x1c3a3a, width: 5 },
    },
  });
  private fadeAlpha = 1;
  private fadeTarget = 0;
  private pendingPosition: string | null = null;

  private phase: Phase = 'aim';
  private time = 0;
  private mouse = { x: 0, y: 0 };
  /** 最近一次操作是不是触屏：决定提示怎么说、点屏幕算不算摇轮 */
  private touch = false;
  /** 遛鱼时连按空格（触屏：连点屏幕）摇线轮 */
  private readonly crank = new ReelCrank();
  private aimAngle = 0;
  private charge = 0;
  private chargeTime = 0;
  private flight = { fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, duration: 1 };
  private floatX = 0;
  private floatY = 0;
  private landX = 0;
  private landY = 0;
  private baitGone = false;
  private suitor: WildFish | null = null;
  private plan: BitePlan | null = null;
  private planTime = 0;
  private nibbleIndex = 0;
  private lastNibbleAt = -10;
  private noticeTimer = 0;
  private biteTimer = 0;
  private fight: Fight | null = null;
  private hooked: WildFish | null = null;
  private fightAngle = 0;
  private thrashTimer = 0;
  private landed: WildFish | null = null;
  private populationTimer = 0;
  private senseTimer = 0;
  private uiTimer = 0;
  private toastId = 0;
  private readonly tuning: FightParams = { ...DEFAULT_FIGHT_PARAMS };
  private unsubscribe: (() => void) | null = null;
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private readonly onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);

  constructor(
    ctx: SceneContext,
    private readonly options: FishingSceneOptions,
  ) {
    super(ctx);
  }

  enter(): void {
    const data = this.ctx.state.data;
    this.rng = this.ctx.rng.fork('fishing');
    this.view = { ...this.ctx.view };
    this.spot = data.spotById.get(this.options.spotId)!;
    this.speciesHere = data.species.filter((s) => s.spots.includes(this.spot.id));
    const { width: w, height: h } = this.view;

    this.atlas = new FishAtlas();
    this.ripples = new RippleField();
    this.rain = new Rain({ x: 0, y: 0, w, h }, this.rng.fork('rain'));
    this.specks = new Specks({ x: 0, y: 0, w, h }, 30, this.rng.fork('specks'));
    this.specks.drift = { x: this.spot.flow[0] * 0.8, y: this.spot.flow[1] * 0.8 };
    this.rod = new Rod();
    this.line = new FishingLine();
    this.bobber = new Bobber();
    this.reticle = new AimReticle();
    this.cat = new TopDownCat(this.rng.fork('cat'));
    this.post = new PostOverlay(w, h);
    this.pool = new WildFishPool(this.atlas, { x: 0, y: 0, w, h: 800 }, this.rng.fork('wild'));

    // 真正的溪底在 loadPosition 里生成
    this.water = new WaterSurface(Texture.WHITE, w, h);
    this.water.setFlow(this.spot.flow[0], this.spot.flow[1]);

    this.alert.anchor.set(0.5, 1);
    this.alert.visible = false;
    this.surfaceLayer.addChild(
      this.ripples.graphics,
      this.rain.node,
      this.specks.container,
      this.line.node,
      this.bobber.shadow,
      this.bobber.node,
      this.reticle.node,
      this.alert,
    );
    this.bedShadowLayer.addChild(this.pool.shadowLayer, this.rod.shadow);
    this.worldLayer.addChild(
      this.water.mesh,
      this.bedShadowLayer,
      this.pool.layer,
      this.surfaceLayer,
      this.bank,
    );
    this.fade.rect(0, 0, w, h).fill({ color: 0x0f1f1b });
    this.root.addChild(this.worldLayer, this.rod.node, this.cat.root, this.post.mesh, this.fade);

    this.loadPosition(this.options.positionId ?? this.spot.positions[0]!.id);

    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(0, 0, w, h);
    this.root.on('pointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      this.setTouch(e.pointerType === 'touch');
      this.onPointerMove(e);
      if (e.button === 2) this.retrieve();
      // 遛鱼时鼠标只管带竿，收线靠空格；触屏没有空格，点一下摇一圈
      else if (this.phase === 'fight') {
        if (this.touch) this.crank.press();
      } else this.press(true);
    });
    this.root.on('pointerup', () => this.press(false));
    this.root.on('pointerupoutside', () => this.press(false));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.unsubscribe = this.ctx.commands.on((cmd) => this.handleCommand(cmd));
    this.mouse = { x: w / 2, y: h * 0.4 };

    this.ctx.ui.set({
      scene: 'fishing',
      watchMode: false,
      hint: '',
      catchCard: null,
      fightActive: false,
      debug: this.ctx.params.debug,
      tuning: this.tuningForUi(),
    });
    this.pushFishingUi();
  }

  // ---------------------------------------------------------------- 钓位

  private get catX(): number {
    return this.view.width / 2;
  }

  private get catY(): number {
    return this.position.bankY * this.view.height + 64;
  }

  /** 水面的下沿（再往下是岸） */
  private get waterBottom(): number {
    return this.position.bankY * this.view.height - 30;
  }

  private loadPosition(id: string): void {
    const pos = this.spot.positions.find((p) => p.id === id) ?? this.spot.positions[0]!;
    this.position = pos;
    const { width: w, height: h } = this.view;
    const creek = renderCreek(this.ctx.app.renderer, w, h, pos, { x: this.catX, y: this.catY + 8 });
    // 先换上新的，再销毁旧的（着色器还绑着旧纹理）
    const oldBed = this.bed;
    const oldBank = this.bankTex;
    this.bed = creek.bed;
    this.bankTex = creek.bank;
    this.water.setBed(creek.bed);
    this.bank.texture = creek.bank;
    oldBed?.destroy(true);
    oldBank?.destroy(true);
    this.cat.root.position.set(this.catX, this.catY);

    // 清掉上一个钓位的鱼
    for (const f of [...this.pool.fish]) this.pool.remove(f);
    this.pool.bounds = { x: 0, y: 0, w, h: this.waterBottom };
    this.resetCast();
    const target = this.targetPopulation();
    for (let i = 0; i < 20 && this.pool.fish.length < target; i++) this.spawnGroup(false);
    this.atlas.flush();
  }

  private targetPopulation(): number {
    return this.ctx.state.clock.period === 'night' ? 7 : 9;
  }

  /** 按当前条件出一群鱼；entering 为 true 时从画面边缘游进来 */
  private spawnGroup(entering: boolean, forceSpecies?: FishSpecies): void {
    const rng = this.rng;
    const { width: w, height: h } = this.view;
    const clock = this.ctx.state.clock;
    for (let tries = 0; tries < 12; tries++) {
      const x = rng.range(80, w - 80);
      const y = rng.range(70, this.waterBottom - 90);
      const zone = zoneAt(this.position, x / w, y / h);
      const sp =
        forceSpecies ??
        pickSpecies(
          this.speciesHere,
          {
            spotId: this.spot.id,
            zone,
            period: clock.period,
            weather: this.ctx.state.weather,
            season: clock.season,
          },
          rng,
        );
      if (!sp) continue;
      const n = rng.int(sp.behavior.school[0], sp.behavior.school[1]);
      const group = this.pool.newGroup();
      for (let i = 0; i < n; i++) {
        const fish = rollFish(sp, rng);
        let sx = x + rng.range(-50, 50);
        let sy = y + rng.range(-40, 40);
        if (entering) {
          const edge = rng.int(0, 2);
          sx = edge === 0 ? -40 - i * 20 : edge === 1 ? w + 40 + i * 20 : x + rng.range(-60, 60);
          sy = edge === 2 ? -40 - i * 20 : y + rng.range(-40, 40);
        }
        const f = this.pool.add(sp, fish, sx, sy, group);
        f.home = { x, y, r: 120 + rng.range(0, 90) };
        if (entering) {
          f.heading = Math.atan2(y - sy, x - sx);
          f.body.place(sx, sy, f.heading);
        }
      }
      return;
    }
  }

  // ---------------------------------------------------------------- 输入

  private onPointerMove(e: FederatedPointerEvent): void {
    const p = e.getLocalPosition(this.root);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  }

  private setTouch(touch: boolean): void {
    if (touch === this.touch) return;
    this.touch = touch;
    this.ctx.ui.set({ touch });
    this.pushFishingUi();
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    // 按住空格的自动连发不算：要自己一下一下地按
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space') {
      this.setTouch(false);
      if (this.phase === 'fight') {
        if (down) this.crank.press();
      } else this.press(down);
    } else if (down && e.code === 'Escape') {
      this.retrieve();
    } else if (down && e.code === 'F2') {
      this.ctx.ui.set({ tuningOpen: !this.ctx.ui.get().tuningOpen });
      e.preventDefault();
    } else if (down && e.code === 'F3') {
      this.ctx.ui.set({ debug: !this.ctx.ui.get().debug });
      e.preventDefault();
    } else if (down && /^Digit[1-9]$/.test(e.code)) {
      const bait = this.ctx.state.data.items.baits[Number(e.code.slice(5)) - 1];
      if (bait) this.selectBait(bait.id);
    }
  }

  private press(down: boolean): void {
    if (!down) {
      if (this.phase === 'charge') this.cast();
      return;
    }
    switch (this.phase) {
      case 'aim':
        if (!this.ensureBait()) break;
        this.phase = 'charge';
        this.chargeTime = 0;
        break;
      case 'waiting':
        this.pullOut();
        break;
      case 'bite':
        this.strike();
        break;
      default:
        break;
    }
  }

  private handleCommand(cmd: GameCommand): void {
    const state = this.ctx.state;
    switch (cmd.type) {
      case 'selectBait':
        this.selectBait(cmd.baitId);
        break;
      case 'selectPosition':
        if (
          cmd.positionId !== this.position.id &&
          (this.phase === 'aim' || this.phase === 'waiting')
        ) {
          this.pendingPosition = cmd.positionId;
          this.fadeTarget = 1;
        }
        break;
      case 'catchDecision':
        this.decide(cmd.keep);
        break;
      case 'debug':
        if (cmd.action === 'addHour') state.clock.addMinutes(60);
        else if (cmd.action === 'cycleWeather') state.cycleWeather();
        else if (cmd.action === 'sleep') state.sleep();
        else if (cmd.action === 'spawnRare') {
          const rare = this.speciesHere.find((s) => s.rarity === 'rare');
          if (rare) {
            this.spawnGroup(true, rare);
            this.atlas.flush();
          }
        } else if (
          cmd.action === 'setParam' &&
          cmd.key &&
          cmd.key in this.tuning &&
          cmd.value !== undefined
        ) {
          (this.tuning as unknown as Record<string, number>)[cmd.key] = cmd.value;
          this.ctx.ui.set({ tuning: this.tuningForUi() });
        }
        this.pushFishingUi();
        break;
      default:
        break;
    }
  }

  /** 抛竿前看看饵还有没有；当前的用完了就换一种还有的 */
  private ensureBait(): boolean {
    const state = this.ctx.state;
    if (state.baitLeft > 0) return true;
    const used = state.itemName(state.baitId);
    const other = state.data.items.baits.find((b) => state.inventory.count(b.id) > 0);
    if (other) {
      state.baitId = other.id;
      this.toast(`${used}用完了，换上了${other.name}`, 'info');
      this.pushFishingUi();
      return true;
    }
    this.toast('饵都用完了……去菜地挖点蚯蚓，或者到小馆隔壁的杂货铺买', 'bad');
    return false;
  }

  private selectBait(baitId: string): void {
    const state = this.ctx.state;
    if (state.baitId === baitId || !state.data.items.baits.some((b) => b.id === baitId)) return;
    if (state.inventory.count(baitId) === 0) {
      this.toast(`没有${state.itemName(baitId)}了`, 'info');
      return;
    }
    state.baitId = baitId;
    const name = state.data.items.baits.find((b) => b.id === baitId)!.name;
    // 换饵要先收竿
    if (this.phase === 'waiting') this.retrieve();
    this.toast(`换上了${name}`, 'info');
    this.pushFishingUi();
  }

  // ---------------------------------------------------------------- 抛竿

  private get rodBase(): { x: number; y: number } {
    const b = this.cat.rodBase;
    return { x: this.catX + b.x, y: this.catY + b.y };
  }

  private castTarget(): { x: number; y: number; dist: number; scatter: number } {
    const rod = this.ctx.state.rod;
    const dist = MIN_CAST + this.charge * (rod.range - MIN_CAST);
    const dx = Math.sin(this.aimAngle);
    const dy = -Math.cos(this.aimAngle);
    let x = this.rod.tipX + dx * dist;
    let y = this.rod.tipY + dy * dist;
    x = Math.max(30, Math.min(this.view.width - 30, x));
    y = Math.max(30, Math.min(this.waterBottom - 20, y));
    const scatter = 8 + (1 - rod.accuracy) * dist * 0.16;
    return { x, y, dist, scatter };
  }

  private cast(): void {
    const t = this.castTarget();
    const ang = this.rng.range(0, Math.PI * 2);
    const r = Math.sqrt(this.rng.float()) * t.scatter;
    this.landX = Math.max(30, Math.min(this.view.width - 30, t.x + Math.cos(ang) * r));
    this.landY = Math.max(30, Math.min(this.waterBottom - 20, t.y + Math.sin(ang) * r));
    this.flight = {
      fromX: this.rod.tipX,
      fromY: this.rod.tipY,
      toX: this.landX,
      toY: this.landY,
      t: 0,
      duration: 0.45 + t.dist / 1500,
    };
    this.bobber.state = 'flying';
    this.cat.castSwing();
    this.reticle.clear();
    this.phase = 'flying';
    this.pushFishingUi();
  }

  private land(): void {
    this.floatX = this.landX;
    this.floatY = this.landY;
    this.bobber.state = 'floating';
    this.ripples.add(this.floatX, this.floatY, 0.9, 2, 3);
    const spooked = this.pool.spook(this.floatX, this.floatY, (f) =>
      f.fish.sizeClass === 'small' ? spookRadius(f.species) * 0.7 : spookRadius(f.species),
    );
    if (spooked.length > 0) this.toast('扑通——把鱼吓跑了', 'info');
    this.phase = 'waiting';
    this.baitGone = false;
    this.suitor = null;
    this.plan = null;
    this.noticeTimer = 0.6;
    this.pushFishingUi();
  }

  /** 等鱼时点击：有鱼在试探就是提早了，否则就是收竿 */
  private pullOut(): void {
    if (this.suitor && this.suitor.state === 'hover') {
      const early = this.time - this.lastNibbleAt < 0.7;
      this.pool.scare(this.suitor, this.floatX, this.floatY + 30);
      if (early) this.toast('太早了，鱼被吓跑了', 'bad');
    }
    this.retrieve();
  }

  private retrieve(): void {
    if (this.phase !== 'waiting' && this.phase !== 'bite' && this.phase !== 'charge') return;
    if (this.phase === 'waiting' || this.phase === 'bite')
      this.ripples.add(this.floatX, this.floatY, 0.35, 1, 2);
    if (this.suitor && this.suitor.state !== 'flee') this.pool.setState(this.suitor, 'roam');
    this.resetCast();
  }

  private resetCast(): void {
    this.phase = 'aim';
    this.bobber.state = 'hidden';
    this.line.clear();
    this.suitor = null;
    this.plan = null;
    this.hooked = null;
    this.fight = null;
    this.ctx.ui.set({ fightActive: false, sideHint: 0, snag: 0, reel: 0 });
    this.pushFishingUi();
  }

  // ---------------------------------------------------------------- 等鱼、咬钩

  private tryAttract(): void {
    const bait = this.ctx.state.baitId;
    const candidates = this.pool.fish
      .filter((f) => f.state === 'roam' && f.wary === 0)
      .map((f) => ({ f, d: Math.hypot(f.x - this.floatX, f.y - this.floatY) }))
      .filter(({ f, d }) => d < noticeRadius(f.species, bait))
      .sort((a, b) => a.d - b.d);
    for (const { f } of candidates) {
      if (this.rng.chance(approachChance(f.species, bait) * 0.35)) {
        this.suitor = f;
        f.target = { x: this.floatX, y: this.floatY };
        this.pool.setState(f, 'approach');
        return;
      }
    }
  }

  private updateWaiting(dt: number): void {
    // 浮漂顺着水流慢慢漂一点
    const drift = Math.hypot(this.floatX - this.landX, this.floatY - this.landY);
    if (drift < 60) {
      this.floatX += this.spot.flow[0] * 0.12 * dt;
      this.floatY += this.spot.flow[1] * 0.12 * dt;
    }
    this.noticeTimer -= dt;
    if (this.noticeTimer <= 0) {
      this.noticeTimer = 0.4;
      if (!this.suitor && !this.baitGone) this.tryAttract();
    }
    const f = this.suitor;
    if (!f) return;
    if (f.state !== 'approach' && f.state !== 'hover') {
      this.suitor = null;
      return;
    }
    f.target = { x: this.floatX, y: this.floatY };
    if (f.state === 'approach') {
      if (Math.hypot(f.x - this.floatX, f.y - this.floatY) < 14) {
        this.pool.setState(f, 'hover');
        this.plan = planBite(f.species, this.ctx.state.baitId, this.rng);
        this.planTime = 0;
        this.nibbleIndex = 0;
      }
      return;
    }
    const plan = this.plan!;
    this.planTime += dt;
    while (
      this.nibbleIndex < plan.nibbles.length &&
      this.planTime >= plan.nibbles[this.nibbleIndex]!.at
    ) {
      const nibble = plan.nibbles[this.nibbleIndex++]!;
      this.bobber.nibble();
      f.lunge = 1;
      this.lastNibbleAt = this.time;
      this.ripples.add(this.floatX, this.floatY, 0.3, 0.8, 1);
      if (nibble.steals) {
        this.baitGone = true;
        this.ctx.state.useBait();
        this.toast('饵被偷吃了……点击收竿重新挂饵', 'bad');
        this.pool.setState(f, 'roam');
        f.wary = 5;
        this.suitor = null;
        this.pushFishingUi();
        return;
      }
    }
    if (plan.biteAt !== null && this.planTime >= plan.biteAt) {
      this.phase = 'bite';
      this.biteTimer = 0;
      this.bobber.state = 'sunk';
      this.ripples.add(this.floatX, this.floatY, 0.9, 1.4, 2);
      this.pushFishingUi();
      return;
    }
    const last = plan.nibbles[plan.nibbles.length - 1]?.at ?? 0;
    if (
      plan.biteAt === null &&
      this.nibbleIndex >= plan.nibbles.length &&
      this.planTime > last + 1.6
    ) {
      // 试探完没兴趣，走了
      this.pool.setState(f, 'roam');
      f.wary = 4;
      this.suitor = null;
    }
  }

  private updateBite(dt: number): void {
    this.biteTimer += dt;
    const f = this.suitor;
    if (f) {
      // 鱼叼着饵往外拖，浮漂跟着走
      this.floatX += Math.cos(f.heading) * 14 * dt;
      this.floatY += Math.sin(f.heading) * 14 * dt;
      f.target = { x: this.floatX, y: this.floatY };
    }
    if (!f || this.biteTimer > (this.plan?.window ?? 0)) {
      if (f) this.pool.scare(f, this.floatX, this.floatY + 40);
      this.baitGone = this.rng.chance(0.5);
      if (this.baitGone) this.ctx.state.useBait();
      this.toast(this.baitGone ? '提竿慢了，鱼叼着饵跑了' : '提竿慢了，鱼跑了', 'bad');
      this.suitor = null;
      this.phase = 'waiting';
      this.bobber.state = 'floating';
      this.pushFishingUi();
    }
  }

  private strike(): void {
    const f = this.suitor;
    const window = this.plan?.window ?? 0;
    const quality = strikeQuality(this.biteTimer, window);
    if (!f || quality <= 0) return;
    this.cat.strike();
    this.pool.setState(f, 'hooked');
    this.hooked = f;
    // 鱼咬住了饵：不管最后上没上来，这份饵都用掉了
    this.ctx.state.useBait();
    const base = this.rodBase;
    const dist = Math.hypot(f.x - base.x, f.y - base.y);
    this.fightAngle = Math.atan2(f.x - base.x, base.y - f.y);
    const state = this.ctx.state;
    this.fight = new Fight(
      {
        species: f.species,
        fish: f.fish,
        distance: dist,
        reelSpeed: state.rod.reelSpeed,
        lineStrength: state.line.strength,
        hookQuality: quality,
      },
      this.rng.fork('fight'),
      this.tuning,
    );
    this.crank.reset();
    this.bobber.state = 'hidden';
    this.ripples.add(f.x, f.y, 1, 1.6, 4);
    if (quality >= 1) this.toast('好竿！', 'good');
    this.phase = 'fight';
    this.ctx.ui.set({ fightActive: true });
    this.pushFishingUi();
  }

  // ---------------------------------------------------------------- 遛鱼

  private updateFight(dt: number): void {
    const fight = this.fight!;
    const f = this.hooked!;
    const base = this.rodBase;
    const rodSide = Math.max(-1, Math.min(1, (this.mouse.x - this.catX) / 260));
    this.crank.update(dt);
    const events = fight.step(dt, { reel: this.crank.intensity, rodSide });
    const s = fight.state;

    // 鱼往一边窜：绕着岸边的角度慢慢移动
    this.fightAngle += s.lateral * (0.2 + s.pull * 0.8) * dt * 0.7;
    this.fightAngle = Math.max(-1.1, Math.min(1.1, this.fightAngle));
    const d = Math.max(36, s.distance);
    const tx = base.x + Math.sin(this.fightAngle) * d;
    const ty = Math.min(this.waterBottom, base.y - Math.cos(this.fightAngle) * d);
    const prevX = f.x;
    const prevY = f.y;
    f.x += (tx - f.x) * Math.min(1, dt * 6);
    f.y += (ty - f.y) * Math.min(1, dt * 6);
    const vx = f.x - prevX;
    const vy = f.y - prevY;
    const tired = s.stamina / s.staminaMax < 0.12;
    // 有力气时头朝外挣，乏了就被拖着头朝岸
    const away = Math.atan2(f.y - base.y, f.x - base.x);
    const moving = Math.hypot(vx, vy) > 0.4 ? Math.atan2(vy, vx) : away;
    f.heading = tired ? away + Math.PI : moving * 0.3 + (away + s.lateral * 0.7) * 0.7;
    f.effort = Math.min(1, s.pull * 1.3);
    f.phase += dt * (2 + s.pull * 10);
    f.depth = 0.15;

    this.thrashTimer -= dt;
    if (s.pull > 0.55 && this.thrashTimer <= 0) {
      this.thrashTimer = 0.28;
      this.ripples.add(f.x, f.y, 0.35 + s.pull * 0.2, 0.9, 2);
    }
    for (const e of events) {
      if (e.type === 'burst') this.ripples.add(f.x, f.y, 0.8, 1.3, 4);
      else if (e.type === 'landed') this.onLanded();
      else if (e.type === 'snapped') this.onLost('鱼线断了！', f);
      else if (e.type === 'escaped') this.onLost('线太松，鱼脱钩跑了', f);
      else if (e.type === 'snagged') this.onLost('鱼钻进水草，线挂断了', f);
    }
    if (this.phase !== 'fight') return;

    const lateralHint =
      s.mode === 'dive' ||
      s.snag > 0.05 ||
      (Math.abs(s.lateral) > 0.45 && s.pull > 0.3 && f.species.fight.style === 'dive')
        ? -Math.sign(s.lateral)
        : 0;
    this.ctx.ui.set({
      tension: s.tension,
      stamina: s.staminaMax > 0 ? s.stamina / s.staminaMax : 0,
      reel: this.crank.intensity,
      snag: s.snag,
      sideHint: lateralHint,
    });
  }

  private onLanded(): void {
    const f = this.hooked!;
    const state = this.ctx.state;
    const record = state.recordCatch(f.fish);
    const look = speciesLook(f.species, new Rng(f.fish.lookSeed));
    const sp = f.species;
    const price = fishPrice(sp, f.fish);
    this.ripples.add(f.x, f.y, 1, 1.4, 6);
    this.pool.remove(f);
    this.landed = f;
    this.hooked = null;
    this.fight = null;
    this.cat.react('happy');
    this.cat.twitchWhiskers();
    this.line.clear();
    this.phase = 'result';
    state.clock.paused = true;
    this.ctx.ui.set({
      fightActive: false,
      sideHint: 0,
      catchCard: {
        uid: f.fish.uid,
        name: sp.name,
        weightText: formatWeight(f.fish.weightKg),
        lengthText: `${f.fish.lengthCm.toFixed(1)} 厘米`,
        rarityText: RARITY_TEXT[sp.rarity] ?? '',
        newSpecies: record.newSpecies,
        newRecord: record.newRecord && !record.newSpecies,
        trophy: f.fish.trophy,
        note: sp.note,
        image: renderFishImage(look, 2),
        price,
        keepNetFull: state.keepNetFull,
      },
    });
    this.pushFishingUi();
  }

  private onLost(text: string, f: WildFish): void {
    this.pool.setState(f, 'roam');
    this.pool.scare(f, this.rodBase.x, this.rodBase.y);
    this.cat.react('sad');
    this.toast(text, 'bad');
    this.resetCast();
  }

  private decide(keep: boolean): void {
    if (this.phase !== 'result' || !this.landed) return;
    const state = this.ctx.state;
    const f = this.landed;
    if (keep && state.keep(f.fish, this.spot.id, this.position.id)) {
      const tip = state.keepNet.length === 1 ? '，回方塘可以放进塘里养' : '';
      this.toast(`放进鱼护（${state.keepNet.length}/${state.keepNetCapacity}）${tip}`, 'good');
    } else {
      this.toast(keep ? '鱼护满了，只好放生' : '放生了，快快长大吧', 'info');
      this.ripples.add(this.catX + 40, this.waterBottom - 10, 0.8, 1.6, 3);
    }
    this.landed = null;
    state.clock.paused = false;
    this.ctx.ui.set({ catchCard: null });
    this.resetCast();
  }

  // ---------------------------------------------------------------- 每帧

  override update(dt: number): void {
    this.time += dt;
    const state = this.ctx.state;
    const clock = state.clock;
    clock.advance(dt);
    // 2:00 了：遛完这条鱼就回家睡觉（Game 会切回家里，弹出一天的小结）
    if (clock.isDayOver && this.phase !== 'fight' && this.phase !== 'result') state.sleep();

    // 淡入淡出（切换钓位）
    this.fadeAlpha += (this.fadeTarget - this.fadeAlpha) * Math.min(1, dt * 7);
    if (this.pendingPosition && this.fadeAlpha > 0.97) {
      this.loadPosition(this.pendingPosition);
      this.pendingPosition = null;
      clock.addMinutes(10);
      this.fadeTarget = 0;
      this.pushFishingUi();
    }
    this.fade.alpha = this.fadeAlpha;
    this.fade.visible = this.fadeAlpha > 0.01;

    // 瞄准
    const base = this.rodBase;
    if (this.phase === 'aim' || this.phase === 'charge') {
      const a = Math.atan2(this.mouse.x - base.x, base.y - Math.min(this.mouse.y, base.y - 40));
      this.aimAngle = Math.max(-MAX_AIM, Math.min(MAX_AIM, a));
      this.cat.setAim(this.aimAngle);
      this.cat.setLean(0);
    } else if (this.phase === 'waiting' || this.phase === 'bite' || this.phase === 'flying') {
      const a = Math.atan2(this.floatX - base.x, base.y - this.floatY);
      if (this.phase !== 'flying') this.cat.setAim(Math.max(-MAX_AIM, Math.min(MAX_AIM, a)));
    }

    switch (this.phase) {
      case 'charge': {
        this.chargeTime += dt;
        // 力度来回摆动：按太久会回落，松手的时机也有讲究
        const cycle = (this.chargeTime / 1.25) % 2;
        this.charge = cycle < 1 ? cycle : 2 - cycle;
        break;
      }
      case 'flying': {
        const fl = this.flight;
        fl.t = Math.min(1, fl.t + dt / fl.duration);
        const e = fl.t;
        this.bobber.x = fl.fromX + (fl.toX - fl.fromX) * e;
        this.bobber.y = fl.fromY + (fl.toY - fl.fromY) * e;
        this.bobber.height = Math.sin(e * Math.PI);
        if (fl.t >= 1) this.land();
        break;
      }
      case 'waiting':
        this.updateWaiting(dt);
        break;
      case 'bite':
        this.updateBite(dt);
        break;
      case 'fight':
        this.updateFight(dt);
        break;
      default:
        break;
    }

    // 竿子
    const fight = this.fight;
    if (fight && this.hooked) {
      const s = fight.state;
      const rodSide = Math.max(-1, Math.min(1, (this.mouse.x - this.catX) / 260));
      const rodAngle = this.fightAngle * 0.85 + rodSide * 0.25;
      this.cat.setAim(rodAngle);
      this.cat.setLean(Math.min(1, s.tension));
      this.rod.draw({
        baseX: base.x,
        baseY: base.y,
        angle: this.cat.rodAngle,
        bend: Math.min(1, s.tension * 0.9),
        bendSide: Math.sign(this.fightAngle - this.cat.rodAngle) || 0,
      });
      this.line.draw(
        this.rod.tipX,
        this.rod.tipY,
        this.hooked.x,
        this.hooked.y,
        Math.min(1, s.tension * 1.4),
      );
    } else {
      const lift = this.cat.swingLift;
      this.rod.draw({
        baseX: base.x,
        baseY: base.y,
        angle: this.cat.rodAngle,
        bend: lift * 0.3,
        bendSide: -1,
      });
    }

    // 浮漂与鱼线
    if (this.phase === 'waiting' || this.phase === 'bite') {
      this.bobber.x = this.floatX;
      this.bobber.y = this.floatY;
      if (this.bobber.state !== 'sunk') this.bobber.state = 'floating';
      this.line.draw(
        this.rod.tipX,
        this.rod.tipY,
        this.floatX,
        this.floatY,
        this.phase === 'bite' ? 0.8 : 0.15,
        0.6,
      );
    } else if (this.phase === 'flying') {
      this.line.draw(this.rod.tipX, this.rod.tipY, this.bobber.x, this.bobber.y, 0.3);
    }
    if (this.phase === 'aim' || this.phase === 'charge') {
      if (this.phase === 'charge') {
        const t = this.castTarget();
        this.reticle.draw(t.x, t.y, t.scatter, this.rod.tipX, this.rod.tipY, true, dt);
      } else {
        this.reticle.clear();
      }
    }
    this.bobber.update(dt);
    this.alert.visible = this.phase === 'bite';
    if (this.alert.visible) {
      const pop = Math.min(1, this.biteTimer * 8);
      this.alert.position.set(this.floatX + 6, this.floatY - 16 - pop * 10);
      this.alert.scale.set(0.6 + pop * 0.5);
    }

    // 鱼群
    this.pool.update(dt);
    this.populationTimer -= dt;
    if (this.populationTimer <= 0) {
      this.populationTimer = this.rng.range(10, 18);
      const roaming = this.pool.fish.filter((f) => f.state === 'roam' && f !== this.suitor);
      if (roaming.length > 3 && this.rng.chance(0.5)) {
        const leaver = this.rng.pick(roaming);
        for (const f of this.pool.fish)
          if (f.group === leaver.group) this.pool.setState(f, 'leave');
      }
      if (this.pool.fish.length < this.targetPopulation()) {
        this.spawnGroup(true);
        this.atlas.flush();
      }
    }
    this.pool.takeGone();

    // 胡须感应：附近有少见的鱼
    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 3;
      const cx = this.phase === 'waiting' ? this.floatX : this.catX;
      const cy = this.phase === 'waiting' ? this.floatY : this.catY - 300;
      const rare = this.pool.fish.some(
        (f) => f.species.rarity !== 'common' && Math.hypot(f.x - cx, f.y - cy) < 420,
      );
      if (rare) this.cat.twitchWhiskers();
      if (rare !== this.ctx.ui.get().sense) this.ctx.ui.set({ sense: rare });
    }

    // 天气与时段
    const amb = ambientAt(clock.minute, state.weather);
    this.water.setDim(amb.dim);
    this.water.setCaustic(amb.caustic);
    this.post.setTint(amb.tint, amb.tintAlpha);
    this.rain.intensity = amb.rain;

    this.water.update(dt, this.ripples.ripples);
    this.ripples.update(dt);
    this.rain.update(dt);
    this.specks.update(dt);
    this.cat.update(dt);

    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.25;
      this.ctx.ui.set({ clockText: this.clockText() });
    }
  }

  // ---------------------------------------------------------------- 界面

  private clockText(): string {
    const s = this.ctx.state;
    const c = s.clock;
    return `第 ${c.day + 1} 天 · ${SEASON_NAMES[c.season]} · ${c.formatTime()} · ${WEATHER_NAMES[s.weather]}`;
  }

  private pushFishingUi(): void {
    const state = this.ctx.state;
    const hint =
      this.baitGone && this.phase === 'waiting'
        ? this.touch
          ? '饵没了，点屏幕收竿重新挂饵'
          : '饵没了，点击收竿重新挂饵'
        : ((this.touch ? TOUCH_HINTS[this.phase] : undefined) ?? HINTS[this.phase]);
    this.ctx.ui.set({
      sceneTitle: this.spot.name,
      sceneSubtitle: this.position.name,
      clockText: this.clockText(),
      fishing: {
        spotName: this.spot.name,
        positionId: this.position.id,
        positions: this.spot.positions.map((p) => ({ id: p.id, name: p.name, note: p.note })),
        baitId: state.baitId,
        baits: state.data.items.baits.map((b) => ({
          id: b.id,
          name: b.name,
          note: b.note,
          count: state.inventory.count(b.id),
        })),
        keepNet: state.keepNet.length,
        keepNetCapacity: state.keepNetCapacity,
        hint,
      },
    });
  }

  private toast(text: string, tone: 'good' | 'bad' | 'info'): void {
    this.ctx.ui.set({ toast: { id: ++this.toastId, text, tone } });
  }

  private tuningForUi(): Record<string, number> {
    return { ...this.tuning } as unknown as Record<string, number>;
  }

  override refresh(): void {
    this.pushFishingUi();
  }

  override resize(view: ViewSize): void {
    if (view.width === this.view.width && view.height === this.view.height) return;
    this.view = { ...view };
    this.water.resize(view.width, view.height);
    this.post.resize(view.width, view.height);
    this.fade.clear().rect(0, 0, view.width, view.height).fill({ color: 0x0f1f1b });
    this.root.hitArea = new Rectangle(0, 0, view.width, view.height);
    this.loadPosition(this.position.id);
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.unsubscribe?.();
    this.ctx.state.clock.paused = false;
    this.ctx.ui.set({ fishing: null, fightActive: false, catchCard: null, sense: false });
    // 先销毁显示对象，再销毁它们用到的纹理
    this.water.setBed(Texture.EMPTY);
    super.exit();
    this.atlas.destroy();
    this.bed?.destroy(true);
    this.bankTex?.destroy(true);
  }

  /** 调试 / 截图用：当前阶段和鱼的情况 */
  debugInfo(): Record<string, unknown> {
    return {
      phase: this.phase,
      position: this.position.id,
      fish: this.pool.fish.map((f) => `${f.species.name}:${f.state}`),
      tension: this.fight?.state.tension,
    };
  }
}
