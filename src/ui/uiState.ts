/** React 界面读取的游戏状态（只读；要改东西通过 CommandBus 发指令） */

export interface Option {
  id: string;
  name: string;
  note?: string;
}

export interface FishingUi {
  spotName: string;
  positionId: string;
  positions: Option[];
  baitId: string;
  baits: (Option & { count: number })[];
  keepNet: number;
  keepNetCapacity: number;
  /** 当前阶段的操作提示 */
  hint: string;
}

export interface CatchCardUi {
  uid: number;
  name: string;
  weightText: string;
  lengthText: string;
  rarityText: string;
  newSpecies: boolean;
  newRecord: boolean;
  trophy: boolean;
  /** 外公笔记里的线索 */
  note: string;
  /** 鱼的图片（data URL） */
  image: string;
  price: number;
  keepNetFull: boolean;
}

/** 鱼护里的一条鱼（鱼塘画面的鱼护面板用） */
export interface KeepFishUi {
  uid: number;
  name: string;
  weightText: string;
  /** 鱼的图片（data URL） */
  image: string;
}

export interface PondUi {
  name: string;
  count: number;
  capacity: number;
  keepNet: KeepFishUi[];
}

/** 地图上的一个地方 */
export interface PlaceUi {
  id: string;
  name: string;
  note: string;
  /** 在地图上的位置（0~1） */
  x: number;
  y: number;
  /** 从这里过去要走几分钟（游戏时间） */
  minutes: number;
  here: boolean;
  /** 还去不了（要先修路）：写着要买哪项升级 */
  locked: string;
}

/** 睡觉时弹出的一天小结 */
export interface DaySummaryUi {
  id: number;
  title: string;
  lines: string[];
  /** 接下来的一个小目标（例如"离「大鱼缸」还差 ¥120"） */
  goal: string;
  tomorrow: string;
}

/** 菜地画面：手里能拿的东西（空手、各种种子、堆肥） */
export interface FarmToolUi {
  id: string;
  name: string;
  /** -1 表示不计数（空手） */
  count: number;
  note: string;
  /** 这个季节能不能种 */
  inSeason: boolean;
}

export interface CraftUi {
  id: string;
  name: string;
  note: string;
  inputs: string;
  outputs: string;
  minutes: number;
  can: boolean;
}

export interface StockUi {
  id: string;
  name: string;
  count: number;
}

export interface FarmUi {
  toolId: string;
  tools: FarmToolUi[];
  crafts: CraftUi[];
  stock: StockUi[];
  hint: string;
}

/** 小馆：一条鱼（缸里或鱼护里） */
export interface ShopFishUi {
  uid: number;
  name: string;
  weightText: string;
  /** 卖给周叔的价钱 */
  price: number;
  /** 锦鲤：不进鱼缸、周叔不收 */
  koi: boolean;
}

export interface MenuItemUi {
  id: string;
  name: string;
  note: string;
  ingredients: string;
  price: number;
  onMenu: boolean;
  /** 现在的材料够做几份 */
  servings: number;
}

export interface ShopItemUi {
  id: string;
  name: string;
  price: number;
  owned: number;
}

/** 等菜的客人（界面上的点菜单） */
export interface OrderUi {
  guestId: number;
  guest: string;
  dish: string;
  /** 耐心还剩多少 0~1 */
  patience: number;
  cooking: boolean;
}

/** 打烊时弹出的"今晚的账本" */
export interface NightReportUi {
  id: number;
  title: string;
  lines: string[];
  /** 一位客人的话 */
  quote: string;
  /** 接下来可以做什么的建议 */
  hint: string;
}

export interface RestaurantUi {
  /** prep = 还没开门，open = 营业中，closed = 今天营业过了 */
  status: 'prep' | 'open' | 'closed';
  statusText: string;
  /** 现在能不能开门 */
  canOpen: boolean;
  /** 还没到傍晚：可以在店里忙到开门 */
  canSkip: boolean;
  /** 营业中：可以提前打烊 */
  canClose: boolean;
  /** 菜卖完了时的提示（鱼护里还有鱼就放进缸里接着卖） */
  soldOutHint: string;
  helper: boolean;
  reputation: number;
  menu: MenuItemUi[];
  menuSize: number;
  tank: ShopFishUi[];
  tankCapacity: number;
  keepNet: ShopFishUi[];
  shop: ShopItemUi[];
  orders: OrderUi[];
}

/** 做菜小游戏 */
export interface CookingUi {
  dish: string;
  guest: string;
  steps: string[];
  step: number;
  /** 指针 0~1 */
  pointer: number;
  zone: [number, number];
  results: number[];
}

/** 升级面板里的一项 */
export interface UpgradeUi {
  id: string;
  name: string;
  note: string;
  /** 效果，例如"鱼护 8 → 12 条" */
  effect: string;
  price: number;
  status: 'owned' | 'available' | 'locked';
  /** locked 时：要先买哪一项 */
  requires: string;
}

export interface UpgradeGroupUi {
  id: string;
  name: string;
  note: string;
  items: UpgradeUi[];
}

/** 成就达成时弹出的横幅 */
export interface AchievementToastUi {
  id: number;
  name: string;
  desc: string;
  reward: string;
}

/** 外公笔记：一种鱼的一页 */
export interface SpeciesPageUi {
  id: string;
  name: string;
  caught: boolean;
  count: number;
  best: string;
  note: string;
  rarity: string;
  spot: string;
  /** 鱼的图（data URL）；没钓到过的画成剪影 */
  image: string;
}

export interface AchievementUi {
  id: string;
  name: string;
  desc: string;
  done: boolean;
  /** 第几天达成的（从 1 开始），没达成为 0 */
  day: number;
  progress: number;
  progressText: string;
  reward: string;
}

export interface NotebookUi {
  species: SpeciesPageUi[];
  groups: { id: string; name: string; items: AchievementUi[] }[];
  done: number;
  total: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export interface UiState {
  /** 当前画面：pond / fishing */
  scene: string;
  /** 当前画面名称，例如 "锦鲤池" */
  sceneTitle: string;
  sceneSubtitle: string;
  /** 观鱼模式：隐藏界面和阿喵 */
  watchMode: boolean;
  /** 底部的操作提示（鱼塘） */
  hint: string;
  /** 例如 "第 1 天 · 春 · 6:40 · 晴" */
  clockText: string;
  toast: Toast | null;
  money: number;
  places: PlaceUi[];
  daySummary: DaySummaryUi | null;
  upgrades: UpgradeGroupUi[];
  achievementToast: AchievementToastUi | null;
  notebook: NotebookUi | null;
  /** 胡须感应：附近有少见的鱼 */
  sense: boolean;

  pond: PondUi | null;
  farm: FarmUi | null;
  restaurant: RestaurantUi | null;
  nightReport: NightReportUi | null;
  cooking: CookingUi | null;
  fishing: FishingUi | null;
  fightActive: boolean;
  tension: number;
  /** 鱼的体力 0~1 */
  stamina: number;
  /** 收线力度 0~1（连按空格的快慢） */
  reel: number;
  /** 建议往哪边带竿：-1 左、1 右、0 不用 */
  sideHint: number;
  /** 鱼钻进水草的程度 0~1 */
  snag: number;
  catchCard: CatchCardUi | null;

  tuningOpen: boolean;
  tuning: Record<string, number>;

  /** 玩家在用触屏：提示换成"点屏幕" */
  touch: boolean;

  /** 调试信息 */
  debug: boolean;
  fps: number;
  frameMs: number;
  fishCount: number;
  pelletsEaten: number;
}

export const initialUiState: UiState = {
  scene: '',
  sceneTitle: '',
  sceneSubtitle: '',
  watchMode: false,
  hint: '',
  clockText: '',
  toast: null,
  money: 0,
  places: [],
  daySummary: null,
  upgrades: [],
  achievementToast: null,
  notebook: null,
  sense: false,
  pond: null,
  farm: null,
  restaurant: null,
  nightReport: null,
  cooking: null,
  fishing: null,
  fightActive: false,
  tension: 0,
  stamina: 1,
  reel: 0,
  sideHint: 0,
  snag: 0,
  catchCard: null,
  tuningOpen: false,
  tuning: {},
  touch: false,
  debug: false,
  fps: 0,
  frameMs: 0,
  fishCount: 0,
  pelletsEaten: 0,
};
