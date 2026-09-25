import type { GameData } from '../data/gameData';
import type { GuestKind, Recipe } from '../data/schema';
import type { Rng } from '../rng/rng';
import type { CaughtFish } from '../state';
import {
  dishPrice,
  emptyReserved,
  release,
  reserve,
  takeIngredients,
  tipFor,
  type Pantry,
  type Reserved,
} from './kitchen';
import { addScraps, reputationGain, type RestaurantState } from './restaurant';

/**
 * 喵记小馆的一次营业（阿喵亲自掌勺）。按游戏分钟推进：
 * 客人进门 → 入座 → 点菜（只点现在做得出来的菜，材料先预留）→ 等菜 → 吃 → 付钱走人。
 * 等太久的客人会喝杯茶先走，不扣口碑；菜卖完了就不再进客人。
 */

export type GuestState = 'walking' | 'seated' | 'waiting' | 'eating' | 'leaving';

export interface Guest {
  id: number;
  kind: GuestKind;
  /** 第几个座位（桌号 × 每桌座位数 + 座位号） */
  seat: number;
  state: GuestState;
  /** 在当前状态待了几分钟 */
  timer: number;
  recipe: Recipe | null;
  /** 为这道菜预留的鱼 */
  fishUids: number[];
  /** 正在为这位客人做菜 */
  cooking: boolean;
  quality: number;
  price: number;
  tip: number;
  /** 走的时候开不开心（吃饱了 / 等不及了） */
  happy: boolean;
}

export type ServiceEvent =
  | { type: 'arrive'; guest: Guest }
  | { type: 'order'; guest: Guest }
  /** 客人没有能点的菜走了；all = 菜单上的菜全卖完了 */
  | { type: 'soldOut'; guest: Guest; all: boolean }
  | { type: 'impatient'; guest: Guest }
  | { type: 'paid'; guest: Guest; amount: number }
  | { type: 'gone'; guest: Guest }
  | { type: 'closed'; summary: ServiceSummary };

export interface ServiceSummary {
  guests: number;
  earned: number;
  reputation: number;
}

const WALK_MINUTES = 3;
const SIT_MINUTES = 2;
const LEAVE_MINUTES = 3;

export class Service {
  readonly guests: Guest[] = [];
  open = true;
  served = 0;
  earned = 0;
  repGained = 0;
  private nextId = 1;
  private arrivalTimer = 2;
  private readonly reserved: Reserved = emptyReserved();
  /** 已经下锅、还没端上去的鱼（算价钱用） */
  private readonly cookedFish = new Map<number, CaughtFish[]>();
  private readonly seatCount: number;

  constructor(
    private readonly data: GameData,
    private readonly restaurant: RestaurantState,
    private readonly pantry: Pantry,
    private readonly rng: Rng,
    /** 收钱（记进 GameState 的钱和今天的账） */
    private readonly earn: (amount: number) => void,
    /** 升级带来的：几张桌子、口碑多涨几成 */
    private readonly opts: { tables: number; reputationBonus: number } = {
      tables: data.restaurant.tables,
      reputationBonus: 0,
    },
  ) {
    this.seatCount = opts.tables * data.restaurant.seatsPerTable;
  }

  /**
   * 菜单上的菜全都做不出来了（除掉已经预留给别的客人的材料）。
   * 每次现算：等不及走掉的客人会把预留的材料还回来，又能接着卖。
   */
  get soldOut(): boolean {
    return !this.menu.some((r) => reserve(r, this.pantry, cloneReserved(this.reserved)) !== null);
  }

  private get menu(): Recipe[] {
    return this.restaurant.menu
      .map((id) => this.data.recipeById.get(id))
      .filter((r): r is Recipe => !!r);
  }

  private freeSeats(): number[] {
    const used = new Set(this.guests.map((g) => g.seat));
    return Array.from({ length: this.seatCount }, (_, i) => i).filter((i) => !used.has(i));
  }

  /** 推进 1 游戏分钟；now 是推进后的时钟（当天的分钟数） */
  tick(now: number): ServiceEvent[] {
    const events: ServiceEvent[] = [];
    const cfg = this.data.restaurant;
    if (this.open && now >= cfg.closeMinute) return this.close();

    // 进新客人
    if (this.open && !this.soldOut && now < cfg.lastOrderMinute) {
      this.arrivalTimer -= 1;
      const seats = this.freeSeats();
      if (this.arrivalTimer <= 0 && seats.length > 0) {
        const kinds = cfg.guests.filter((g) => g.minReputation <= this.restaurant.reputation);
        const kind = this.rng.weighted(kinds, (g) => g.weight)!;
        const guest: Guest = {
          id: this.nextId++,
          kind,
          seat: this.rng.pick(seats),
          state: 'walking',
          timer: 0,
          recipe: null,
          fishUids: [],
          cooking: false,
          quality: 0,
          price: 0,
          tip: 0,
          happy: true,
        };
        this.guests.push(guest);
        events.push({ type: 'arrive', guest });
        const [lo, hi] = cfg.arrivalMinutes;
        this.arrivalTimer = this.rng.range(lo, hi) / (1 + this.restaurant.reputation / 50);
      }
    }

    for (const g of [...this.guests]) {
      g.timer += 1;
      switch (g.state) {
        case 'walking':
          if (g.timer >= WALK_MINUTES) this.setState(g, 'seated');
          break;
        case 'seated':
          if (g.timer >= SIT_MINUTES) events.push(this.order(g));
          break;
        case 'waiting':
          if (!g.cooking && g.timer > cfg.patienceMinutes) {
            this.cancelOrder(g);
            g.happy = false;
            this.setState(g, 'leaving');
            events.push({ type: 'impatient', guest: g });
          }
          break;
        case 'eating':
          if (g.timer >= cfg.eatMinutes) events.push(this.pay(g));
          break;
        case 'leaving':
          if (g.timer >= LEAVE_MINUTES) {
            this.guests.splice(this.guests.indexOf(g), 1);
            events.push({ type: 'gone', guest: g });
          }
          break;
      }
    }
    return events;
  }

  /** 客人点菜：优先点爱吃的；吃素的只点不用鱼的菜；什么都做不出来就说卖完了 */
  private order(g: Guest): ServiceEvent {
    const options = this.menu.filter(
      (r) =>
        (!g.kind.vegetarian || !r.fish) &&
        reserve(r, this.pantry, cloneReserved(this.reserved)) !== null,
    );
    if (options.length === 0) {
      g.happy = false;
      this.setState(g, 'leaving');
      return { type: 'soldOut', guest: g, all: this.soldOut };
    }
    const liked = options.filter((r) => g.kind.likes.includes(r.id));
    const recipe =
      liked.length > 0 && this.rng.chance(0.65) ? this.rng.pick(liked) : this.rng.pick(options);
    g.recipe = recipe;
    g.fishUids = reserve(recipe, this.pantry, this.reserved) ?? [];
    this.setState(g, 'waiting');
    return { type: 'order', guest: g };
  }

  private cancelOrder(g: Guest): void {
    if (g.recipe) release(g.recipe, g.fishUids, this.reserved);
    g.fishUids = [];
  }

  /** 开始给这位客人做菜：材料下锅。返回做的是哪道菜 */
  startCooking(guestId: number): Recipe | null {
    const g = this.guests.find((x) => x.id === guestId);
    if (!g || g.state !== 'waiting' || g.cooking || !g.recipe) return null;
    if (this.guests.some((x) => x.cooking)) return null;
    release(g.recipe, g.fishUids, this.reserved);
    const fish = takeIngredients(g.recipe, this.pantry, g.fishUids);
    if (!fish) {
      // 材料对不上了（不太会发生）：重新预留一次
      g.fishUids = reserve(g.recipe, this.pantry, this.reserved) ?? [];
      return null;
    }
    g.cooking = true;
    this.cookedFish.set(g.id, fish);
    return g.recipe;
  }

  /** 菜做好了端上桌；quality 是小游戏的成绩 */
  serve(guestId: number, quality: number): Guest | null {
    const g = this.guests.find((x) => x.id === guestId);
    if (!g || !g.cooking || !g.recipe) return null;
    const fish = this.cookedFish.get(g.id) ?? [];
    this.cookedFish.delete(g.id);
    g.cooking = false;
    g.quality = quality;
    g.price = dishPrice(g.recipe, fish, quality);
    g.tip = tipFor(g.price, quality);
    addScraps(this.restaurant, g.recipe, this.data.restaurant.compostPerFishDish, this.pantry);
    this.setState(g, 'eating');
    return g;
  }

  /** 正在做的那一位（没有就是 null） */
  get cookingGuest(): Guest | null {
    return this.guests.find((g) => g.cooking) ?? null;
  }

  private pay(g: Guest): ServiceEvent {
    const amount = g.price + g.tip;
    this.earn(amount);
    this.earned += amount;
    this.served++;
    const gain = reputationGain(g.quality) * (1 + this.opts.reputationBonus);
    this.restaurant.reputation += gain;
    this.repGained += gain;
    this.restaurant.totalGuests++;
    this.setState(g, 'leaving');
    return { type: 'paid', guest: g, amount };
  }

  /** 打烊：还在等的客人先走，正在吃的吃完付钱，正在做的菜照样端上去 */
  close(): ServiceEvent[] {
    if (!this.open) return [];
    this.open = false;
    const events: ServiceEvent[] = [];
    for (const g of this.guests) {
      if (g.cooking) this.serve(g.id, 0.6);
      if (g.state === 'eating') events.push(this.pay(g));
      else if (g.state !== 'leaving') {
        this.cancelOrder(g);
        this.setState(g, 'leaving');
      }
    }
    events.push({
      type: 'closed',
      summary: { guests: this.served, earned: this.earned, reputation: this.repGained },
    });
    return events;
  }

  private setState(g: Guest, state: GuestState): void {
    g.state = state;
    g.timer = 0;
  }
}

function cloneReserved(r: Reserved): Reserved {
  return { fish: new Set(r.fish), goods: new Map(r.goods) };
}
