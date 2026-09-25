import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
  type RenderTexture,
} from 'pixi.js';
import type { GameCommand } from '../app/commands';
import { Scene, type ViewSize } from '../app/scene';
import type { Recipe } from '../sim/data/schema';
import { fishPrice, formatWeight } from '../sim/fishing/catchRoll';
import { CookingGame } from '../sim/restaurant/cooking';
import { canCook, emptyReserved, reserve } from '../sim/restaurant/kitchen';
import { Service, type Guest, type ServiceEvent } from '../sim/restaurant/service';
import type { Rng } from '../sim/rng/rng';
import { WEATHER_NAMES, type CaughtFish } from '../sim/state';
import { formatClock, SEASON_NAMES } from '../sim/time/clock';
import { TopDownCat } from '../render/cat/topDownCat';
import { DirtBurst } from '../render/farm/dirtBurst';
import { ambientAt } from '../render/fx/ambient';
import { FloatingTexts } from '../render/fx/floatText';
import { PostOverlay } from '../render/fx/postOverlay';
import { PALETTE, paletteColor } from '../render/palette';
import { renderEateryFloor } from '../render/restaurant/eateryFloor';
import { FishTank } from '../render/restaurant/fishTank';
import { Counter, drawStool, drawTable, Lantern, MenuBoard } from '../render/restaurant/furniture';
import { GuestSprite } from '../render/restaurant/guestSprite';

const WALL_H = 150;
const DOOR = { x: 200, width: 150 };
const TABLE_R = 64;
/** 凳子离桌子中心多远 */
const SEAT_OFFSET = 108;

interface GuestView {
  sprite: GuestSprite;
  x: number;
  y: number;
  plate: Graphics | null;
  /** 上一帧的状态（状态变了才换气泡） */
  last: string;
}

/**
 * 喵记小馆（方案 B：俯视的店堂）。
 * 白天定菜单、把鱼护里的鱼放进活鱼缸、去隔壁杂货铺和鱼摊；傍晚开门，阿喵在柜台后面掌勺：
 * 客人点了菜，点一下客人（或者按空格）开始做，做菜小游戏里在好区按空格。
 */
export class RestaurantScene extends Scene {
  private rng!: Rng;
  private view!: ViewSize;
  private floor: RenderTexture | null = null;
  private readonly floorSprite = new Sprite();
  private readonly furniture = new Container();
  private readonly guestLayer = new Container();
  private readonly plateLayer = new Container();
  private counter!: Counter;
  private tank!: FishTank;
  private board!: MenuBoard;
  private lanterns: Lantern[] = [];
  private cat!: TopDownCat;
  private post!: PostOverlay;
  private readonly steam = new DirtBurst();
  private readonly floaters = new FloatingTexts();
  private tables: { x: number; y: number }[] = [];
  private seats: { x: number; y: number; table: number }[] = [];

  private service: Service | null = null;
  private cooking: { guestId: number; recipe: Recipe; game: CookingGame } | null = null;
  private readonly guests = new Map<number, GuestView>();
  private lastMinute = 0;
  private time = 0;
  private uiTimer = 0;
  private tankTimer = 0;
  private toastId = 0;
  private closedText = '';
  private unsubscribe: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  enter(): void {
    const state = this.ctx.state;
    this.rng = this.ctx.rng.fork('restaurant');
    this.view = { ...this.ctx.view };
    this.cat = new TopDownCat(this.rng.fork('cat'));
    this.post = new PostOverlay(this.view.width, this.view.height, 0.38, 0.06);
    this.root.addChild(
      this.floorSprite,
      this.furniture,
      this.plateLayer,
      this.guestLayer,
      this.steam.node,
      this.cat.root,
      this.floaters.node,
      this.post.mesh,
    );
    this.layout();
    this.lastMinute = state.clock.minute;
    if (state.servedToday) this.closedText = '今天已经营业过了，明天再来吧';

    this.root.eventMode = 'static';
    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      const p = e.getLocalPosition(this.root);
      if (this.cooking) return this.hit();
      const g = this.guestAt(p.x, p.y);
      if (g) this.startCooking(g.id);
    });
    window.addEventListener('keydown', this.onKey);
    this.unsubscribe = this.ctx.commands.on((cmd) => this.handleCommand(cmd));

    // 第一次来：按现在能做的菜先排一个菜单
    if (state.restaurant.menu.length === 0) this.suggestMenu();

    this.ctx.ui.set({
      scene: 'restaurant',
      sceneTitle: state.data.restaurant.name,
      sceneSubtitle: '',
      watchMode: false,
      catchCard: null,
      fightActive: false,
      debug: this.ctx.params.debug,
      clockText: this.clockText(),
      cooking: null,
    });
    this.pushUi();
    if (state.keepNet.length > 0) {
      this.toast(`鱼护里有 ${state.keepNet.length} 条鱼，放进活鱼缸才能做菜`, 'info');
    }
  }

  // ---------------------------------------------------------------- 布局

  private layout(): void {
    const { width: w, height: h } = this.view;
    const old = this.floor;
    this.floor = renderEateryFloor(this.ctx.app.renderer, w, h, WALL_H, DOOR, this.ctx.params.seed);
    this.floorSprite.texture = this.floor;
    old?.destroy(true);

    // 鱼缸自己带着一张鱼的图集，先单独销毁
    this.tank?.destroy();
    for (const c of this.furniture.removeChildren()) c.destroy({ children: true });
    const cx = w / 2 + 90;
    this.tables = [
      { x: cx - 330, y: 330 },
      { x: cx + 330, y: 330 },
      { x: cx - 330, y: 590 },
      { x: cx + 330, y: 590 },
    ].slice(0, this.ctx.state.data.restaurant.tables);
    this.seats = [];
    this.tables.forEach((t, i) => {
      for (const s of [-1, 1]) this.seats.push({ x: t.x + s * SEAT_OFFSET, y: t.y, table: i });
    });
    for (const s of this.seats) this.furniture.addChild(drawStool(s.x, s.y));
    for (const t of this.tables) this.furniture.addChild(drawTable(t.x, t.y, TABLE_R));

    this.counter = new Counter(w / 2, 790, 900, 100);
    this.furniture.addChild(this.counter.node);
    this.tank = new FishTank(
      { x: 46, y: 470, w: 240, h: 330 },
      this.ctx.state.data,
      this.rng.fork('tank'),
    );
    this.furniture.addChild(this.tank.node);
    this.tank.sync(this.ctx.state.restaurant.tank);
    this.board = new MenuBoard(w - 470, 14, this.ctx.state.data.restaurant.menuSize);
    this.furniture.addChild(this.board.node);
    this.lanterns = [0.3, 0.55, 0.85].map((f, i) => new Lantern(w * f, WALL_H + 4, i * 1.7));
    for (const l of this.lanterns) this.furniture.addChild(l.node);
    this.cat.root.position.set(w / 2, h - 90);
    this.cat.lookAt(0, -1);
    this.post.resize(w, h);
    this.root.hitArea = new Rectangle(0, 0, w, h);
    this.updateBoard();
  }

  private updateBoard(): void {
    const data = this.ctx.state.data;
    this.board.setMenu(
      this.ctx.state.restaurant.menu.map((id) => data.recipeById.get(id)?.name ?? ''),
    );
  }

  private get doorPos(): { x: number; y: number } {
    return { x: DOOR.x, y: WALL_H - 10 };
  }

  // ---------------------------------------------------------------- 营业

  private get pantry() {
    const state = this.ctx.state;
    return { inventory: state.inventory, tank: state.restaurant.tank };
  }

  /** 开门：傍晚、今天还没营业过、菜单上有菜 */
  private canOpen(): boolean {
    const state = this.ctx.state;
    const cfg = state.data.restaurant;
    const m = state.clock.minute;
    return (
      !this.service &&
      !state.servedToday &&
      m >= cfg.openMinute &&
      m < cfg.lastOrderMinute &&
      state.restaurant.menu.length > 0
    );
  }

  private openShop(): void {
    const state = this.ctx.state;
    if (!this.canOpen()) return;
    state.restaurant.servedDay = state.clock.day;
    this.service = new Service(
      state.data,
      state.restaurant,
      this.pantry,
      this.rng.fork('service'),
      (n) => {
        state.earn(n);
        state.today.restaurantEarned += n;
        state.today.guests++;
      },
    );
    this.toast('开门营业！客人点了菜，点一下客人或者按空格开始做', 'good');
    this.pushUi();
  }

  private handleEvents(events: ServiceEvent[]): void {
    const state = this.ctx.state;
    for (const e of events) {
      switch (e.type) {
        case 'arrive': {
          const sprite = new GuestSprite(e.guest.kind);
          const d = this.doorPos;
          sprite.node.position.set(d.x, d.y);
          this.guestLayer.addChild(sprite.node);
          this.guests.set(e.guest.id, { sprite, x: d.x, y: d.y, plate: null, last: 'walking' });
          break;
        }
        case 'order':
          this.guests.get(e.guest.id)?.sprite.setBubble(e.guest.recipe!.name, 'order');
          break;
        case 'soldOut':
          this.guests.get(e.guest.id)?.sprite.setBubble('卖完啦？', 'sad');
          this.toast('菜单上的菜都卖完了，今晚不再进客人', 'info');
          break;
        case 'impatient':
          this.guests.get(e.guest.id)?.sprite.setBubble('下次再来', 'sad');
          this.toast(`${e.guest.kind.name}等不及，喝了杯茶先走了`, 'info');
          break;
        case 'paid': {
          const v = this.guests.get(e.guest.id);
          if (v) {
            v.sprite.setBubble(e.guest.quality >= 0.85 ? '太好吃了！' : '好吃', 'happy');
            v.plate?.destroy();
            v.plate = null;
            this.floaters.add(v.x, v.y - 40, `+¥${e.amount}`, PALETTE.gold);
          }
          break;
        }
        case 'gone': {
          const v = this.guests.get(e.guest.id);
          v?.sprite.node.destroy({ children: true });
          v?.plate?.destroy();
          this.guests.delete(e.guest.id);
          break;
        }
        case 'closed': {
          const s = e.summary;
          this.closedText = `今晚接待了 ${s.guests} 位客人，收入 ¥${s.earned}，口碑 +${s.reputation.toFixed(1)}`;
          this.toast(`打烊了。${this.closedText}`, 'good');
          if (this.cooking) this.cooking = null;
          this.ctx.ui.set({ cooking: null });
          break;
        }
      }
    }
    if (events.length > 0) {
      this.tank.sync(state.restaurant.tank);
      this.pushUi();
    }
  }

  private startCooking(guestId: number): void {
    if (!this.service || this.cooking) return;
    const recipe = this.service.startCooking(guestId);
    if (!recipe) return;
    const game = new CookingGame(
      this.ctx.state.data.restaurant.cooking.steps,
      this.rng.fork(`cook:${guestId}`),
    );
    this.cooking = { guestId, recipe, game };
    this.guests.get(guestId)?.sprite.setBubble('做着呢…', 'cooking');
    const s = this.counter.stove;
    const cat = this.cat.root.position;
    this.cat.lookAt(s.x - cat.x, s.y - cat.y);
    this.tank.sync(this.ctx.state.restaurant.tank);
    this.pushUi();
  }

  /** 客人按等得最久的排 */
  private longestWaiting(): Guest | null {
    const waiting = (this.service?.guests ?? []).filter((g) => g.state === 'waiting' && !g.cooking);
    waiting.sort((a, b) => b.timer - a.timer);
    return waiting[0] ?? null;
  }

  private hit(): void {
    const c = this.cooking;
    if (!c || !this.service) return;
    const score = c.game.hit();
    const at = c.game.step === 1 ? this.counter.board : this.counter.stove;
    this.steam.burst(at.x, at.y, 10, this.rng, score >= 0.75 ? PALETTE.paper : PALETTE.card);
    this.floaters.add(
      at.x,
      at.y - 50,
      score >= 0.9 ? '好！' : score >= 0.5 ? '还行' : '哎呀',
      score >= 0.9 ? PALETTE.gold : PALETTE.paper,
    );
    this.cat.toss();
    if (!c.game.done) return;
    const guest = this.service.serve(c.guestId, c.game.quality);
    this.cooking = null;
    this.ctx.ui.set({ cooking: null });
    if (guest) this.servePlate(guest, c.recipe);
    this.pushUi();
  }

  /** 菜端上桌：客人面前放一只盘子 */
  private servePlate(guest: Guest, recipe: Recipe): void {
    const v = this.guests.get(guest.id);
    const seat = this.seats[guest.seat];
    if (!v || !seat) return;
    v.sprite.setBubble(null);
    const t = this.tables[seat.table]!;
    const g = new Graphics();
    g.position.set(seat.x + (t.x - seat.x) * 0.52, seat.y + (t.y - seat.y) * 0.52);
    g.circle(3, 4, 24).fill({ color: 0x000000, alpha: 0.2 });
    g.circle(0, 0, 24).fill({ color: PALETTE.fishWhite });
    g.circle(0, 0, 19).stroke({ color: PALETTE.slateBlue, width: 2, alpha: 0.5 });
    const food = paletteColor(recipe.color);
    if (recipe.fish) {
      g.ellipse(-2, 0, 13, 6).fill({ color: food });
      g.poly([10, 0, 17, -6, 17, 6]).fill({ color: food });
    } else {
      g.circle(0, 0, 12).fill({ color: food });
    }
    this.plateLayer.addChild(g);
    v.plate = g;
    this.floaters.add(v.x, v.y - 50, recipe.name, PALETTE.paper);
  }

  private guestAt(x: number, y: number): Guest | null {
    for (const g of this.service?.guests ?? []) {
      const v = this.guests.get(g.id);
      if (v && g.state === 'waiting' && Math.hypot(v.x - x, v.y - y) < 60) return g;
    }
    return null;
  }

  // ---------------------------------------------------------------- 指令

  private handleCommand(cmd: GameCommand): void {
    const state = this.ctx.state;
    switch (cmd.type) {
      case 'openShop':
        this.openShop();
        break;
      case 'skipToEvening': {
        const open = state.data.restaurant.openMinute;
        if (!this.service && state.clock.minute < open) {
          state.clock.addMinutes(open - state.clock.minute);
          this.toast('在店里擦桌子、备菜，忙到了傍晚', 'info');
        }
        break;
      }
      case 'toggleHelper':
        state.restaurant.helper = !state.restaurant.helper;
        break;
      case 'setMenu':
        if (this.service?.open) {
          this.toast('营业中不能改菜单', 'info');
          break;
        }
        state.setMenu(cmd.recipeIds);
        this.updateBoard();
        break;
      case 'toTank': {
        const uids = cmd.uid === 'all' ? state.keepNet.map((f) => f.uid) : [cmd.uid];
        let moved = 0;
        for (const uid of uids) if (state.toTank(uid)) moved++;
        if (moved < uids.length) this.toast('活鱼缸满了', 'info');
        else if (moved > 0) this.toast(`${moved} 条鱼放进了活鱼缸`, 'good');
        this.tank.sync(state.restaurant.tank);
        break;
      }
      case 'sellFish': {
        const price = state.sellFish(cmd.uid);
        if (price > 0) this.toast(`卖给周叔，得了 ¥${price}`, 'good');
        this.tank.sync(state.restaurant.tank);
        break;
      }
      case 'buy':
        if (state.buy(cmd.itemId, cmd.count)) {
          this.toast(`买了 ${cmd.count} 份${state.itemName(cmd.itemId)}`, 'good');
        } else {
          this.toast('钱不够了', 'bad');
        }
        break;
      case 'cookFor':
        this.startCooking(cmd.guestId);
        break;
      case 'cookHit':
        this.hit();
        break;
      default:
        return;
    }
    this.pushUi();
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (this.cooking) this.hit();
      else {
        const g = this.longestWaiting();
        if (g) this.startCooking(g.id);
      }
    } else if (e.code === 'F3') {
      this.ctx.ui.set({ debug: !this.ctx.ui.get().debug });
      e.preventDefault();
    }
  }

  /** 按现在做得出来的菜排一个菜单（第一次来的时候） */
  private suggestMenu(): void {
    const state = this.ctx.state;
    const ids = state.data.recipes.filter((r) => canCook(r, this.pantry)).map((r) => r.id);
    state.setMenu(ids);
  }

  // ---------------------------------------------------------------- 每帧

  override update(dt: number): void {
    this.time += dt;
    const state = this.ctx.state;
    state.clock.advance(dt);
    if (state.clock.isDayOver) {
      this.service?.close();
      state.sleep();
      return;
    }
    // 按游戏分钟推进营业
    while (this.lastMinute < state.clock.minute) {
      this.lastMinute++;
      if (this.service) this.handleEvents(this.service.tick(this.lastMinute));
    }
    if (this.service && !this.service.open && this.service.guests.length === 0) this.service = null;

    this.cooking?.game.update(dt);
    this.updateGuests(dt);
    this.counter.update(dt, this.cooking ? 1 : 0);
    for (const l of this.lanterns) l.update(this.time);
    this.tankTimer -= dt;
    if (this.tankTimer <= 0) {
      this.tankTimer = 1;
      this.tank.sync(state.restaurant.tank);
    }
    this.tank.update(dt);
    this.steam.update(dt);
    this.floaters.update(dt);
    this.cat.update(dt);

    const amb = ambientAt(state.clock.minute, state.weather);
    // 屋里：天色的影响弱一些，入夜后有灯笼的暖光
    this.post.setTint(amb.tint, amb.tintAlpha * 0.5);

    if (this.cooking) {
      const g = this.cooking.game;
      const guest = this.service?.guests.find((x) => x.id === this.cooking!.guestId);
      this.ctx.ui.set({
        cooking: {
          dish: this.cooking.recipe.name,
          guest: guest?.kind.name ?? '',
          steps: g.steps.map((s) => s.name),
          step: g.step,
          pointer: g.pointer,
          zone: g.zone,
          results: [...g.results],
        },
      });
    }
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.25;
      this.ctx.ui.set({ clockText: this.clockText() });
      this.pushUi();
    }
  }

  private updateGuests(dt: number): void {
    const cfg = this.ctx.state.data.restaurant;
    for (const g of this.service?.guests ?? []) {
      const v = this.guests.get(g.id);
      if (!v) continue;
      const seat = this.seats[g.seat]!;
      const target = g.state === 'leaving' ? this.doorPos : seat;
      const dx = target.x - v.x;
      const dy = target.y - v.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, 260 * dt);
      if (dist > 1) {
        v.x += (dx / dist) * step;
        v.y += (dy / dist) * step;
        v.sprite.facing = Math.atan2(dy, dx);
      } else if (g.state !== 'leaving') {
        const t = this.tables[seat.table]!;
        v.sprite.facing = Math.atan2(t.y - seat.y, t.x - seat.x);
      }
      v.sprite.node.position.set(v.x, v.y);
      if (g.state !== v.last) {
        if (g.state === 'seated') v.sprite.setBubble('…', 'think');
        v.last = g.state;
      }
      if (g.state === 'waiting' && !g.cooking) {
        v.sprite.setPatience(Math.max(0, 1 - g.timer / cfg.patienceMinutes));
      } else {
        v.sprite.setPatience(1);
      }
      if (g.state === 'leaving') v.sprite.node.alpha = Math.max(0, 1 - g.timer / 3);
      v.sprite.update(dt, g.state === 'eating');
    }
  }

  // ---------------------------------------------------------------- 界面

  private fishUi(f: CaughtFish) {
    const species = this.ctx.state.data.speciesById.get(f.speciesId);
    return {
      uid: f.uid,
      name: species?.name ?? f.speciesId,
      weightText: formatWeight(f.weightKg),
      price: species ? fishPrice(species, f) : 0,
    };
  }

  private servings(recipe: Recipe): number {
    const reserved = emptyReserved();
    let n = 0;
    while (n < 20 && reserve(recipe, this.pantry, reserved)) n++;
    return n;
  }

  private pushUi(): void {
    const state = this.ctx.state;
    this.updateBoard();
    const data = state.data;
    const cfg = data.restaurant;
    const r = state.restaurant;
    const m = state.clock.minute;
    const open = this.service?.open ?? false;
    const status: 'prep' | 'open' | 'closed' = open
      ? 'open'
      : state.servedToday
        ? 'closed'
        : 'prep';
    let statusText: string;
    if (open) {
      const s = this.service!;
      statusText = `营业中 · 接待 ${s.served} 位 · 今晚 ¥${s.earned}${s.soldOut ? ' · 菜卖完了' : ''}`;
    } else if (status === 'closed') {
      statusText = this.closedText || '今天已经营业过了';
    } else if (m < cfg.openMinute) {
      statusText = `准备中 · ${formatClock(cfg.openMinute)} 开门`;
    } else if (m >= cfg.lastOrderMinute) {
      statusText = '太晚了，今天不开门了';
    } else {
      statusText = r.menu.length > 0 ? '可以开门了' : '先定好菜单再开门';
    }
    const describe = (recipe: Recipe) => {
      const parts: string[] = [];
      if (recipe.fish) {
        const names = recipe.fish.species.map((id) => data.speciesById.get(id)?.name ?? id);
        parts.push(`${names.length > 0 ? names.join('或') : '随便什么鱼'} ×${recipe.fish.count}`);
      }
      for (const [id, n] of Object.entries(recipe.goods)) parts.push(`${state.itemName(id)} ×${n}`);
      return parts.join(' + ');
    };
    this.ctx.ui.set({
      restaurant: {
        status,
        statusText,
        canOpen: this.canOpen(),
        canSkip: !this.service && !state.servedToday && m < cfg.openMinute,
        helper: r.helper,
        reputation: Math.round(r.reputation * 10) / 10,
        menu: data.recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          note: recipe.note,
          ingredients: describe(recipe),
          price: recipe.price,
          onMenu: r.menu.includes(recipe.id),
          servings: this.servings(recipe),
        })),
        menuSize: cfg.menuSize,
        tank: r.tank.map((f) => this.fishUi(f)),
        tankCapacity: cfg.tankCapacity,
        keepNet: state.keepNet.map((f) => this.fishUi(f)),
        shop: [...data.items.baits.map((b) => b.id), ...data.crops.map((c) => `seed:${c.id}`)].map(
          (id) => ({
            id,
            name: state.itemName(id),
            price: data.itemPrices.get(id) ?? 0,
            owned: state.inventory.count(id),
          }),
        ),
        orders: (this.service?.guests ?? [])
          .filter((g) => g.state === 'waiting')
          .map((g) => ({
            guestId: g.id,
            guest: g.kind.name,
            dish: g.recipe?.name ?? '',
            patience: g.cooking ? 1 : Math.max(0, 1 - g.timer / cfg.patienceMinutes),
            cooking: g.cooking,
          })),
      },
    });
  }

  private clockText(): string {
    const s = this.ctx.state;
    const c = s.clock;
    return `第 ${c.day + 1} 天 · ${SEASON_NAMES[c.season]} · ${c.formatTime()} · ${WEATHER_NAMES[s.weather]} · 口碑 ${s.restaurant.reputation.toFixed(0)}`;
  }

  private toast(text: string, tone: 'good' | 'bad' | 'info'): void {
    this.ctx.ui.set({ toast: { id: ++this.toastId, text, tone } });
  }

  override resize(view: ViewSize): void {
    if (view.width === this.view.width && view.height === this.view.height) return;
    this.view = { ...view };
    this.layout();
  }

  override exit(): void {
    // 营业中走开：客人吃完的照样付钱，其余的客人就先回去了
    this.service?.close();
    window.removeEventListener('keydown', this.onKey);
    this.unsubscribe?.();
    this.ctx.ui.set({ restaurant: null, cooking: null });
    const floor = this.floor;
    this.tank.destroy();
    super.exit();
    floor?.destroy(true);
  }

  /** 截图机器人用 */
  debugInfo(): Record<string, unknown> {
    return {
      open: this.service?.open ?? false,
      guests: (this.service?.guests ?? []).map(
        (g) => `${g.kind.name}:${g.state}:${g.recipe?.name ?? ''}`,
      ),
      cooking: this.cooking?.recipe.name ?? null,
      tank: this.ctx.state.restaurant.tank.length,
      money: this.ctx.state.money,
    };
  }
}
