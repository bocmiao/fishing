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
}

/** 睡觉时弹出的一天小结 */
export interface DaySummaryUi {
  id: number;
  title: string;
  lines: string[];
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
  /** 胡须感应：附近有少见的鱼 */
  sense: boolean;

  pond: PondUi | null;
  farm: FarmUi | null;
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
  sense: false,
  pond: null,
  farm: null,
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
