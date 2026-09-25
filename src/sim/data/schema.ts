import { z } from 'zod';

/**
 * 配置表的结构定义。data/*.json 在启动和测试时都会用这里校验，写错了会直接报出是哪一项。
 */

export const ZONE_TYPES = ['open', 'deep', 'weeds', 'shallow', 'rocks'] as const;
export const PERIODS = ['morning', 'day', 'dusk', 'night'] as const;
export const WEATHERS = ['sunny', 'cloudy', 'rain'] as const;
export const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export const FIGHT_STYLES = ['gentle', 'burst', 'stamina', 'dive', 'sly'] as const;
export const FISH_SHAPES = ['carp', 'slender', 'eel'] as const;

export const ZoneType = z.enum(ZONE_TYPES);
export type ZoneType = z.infer<typeof ZoneType>;
export type Weather = (typeof WEATHERS)[number];
export type Rarity = (typeof RARITIES)[number];
export type FightStyle = (typeof FIGHT_STYLES)[number];

const multipliers = <K extends readonly [string, ...string[]]>(keys: K) =>
  z.partialRecord(z.enum(keys), z.number().min(0));

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色要写成 #RRGGBB');

export const FishSpeciesSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  spots: z.array(z.string()).min(1),
  zones: multipliers(ZONE_TYPES),
  periods: multipliers(PERIODS),
  weather: multipliers(WEATHERS),
  seasons: multipliers(SEASON_KEYS),
  /** 对各种饵料的兴趣，没写的饵料按 0.3 算 */
  baits: z.record(z.string(), z.number().min(0)),
  weightKg: z
    .object({ min: z.number().positive(), mode: z.number().positive(), max: z.number().positive() })
    .refine((w) => w.min <= w.mode && w.mode <= w.max, '要求 min ≤ mode ≤ max'),
  /** 体重 = condition × 体长³（克、厘米），用来从体重推算体长 */
  condition: z.number().positive(),
  shape: z.enum(FISH_SHAPES),
  behavior: z.object({
    /** 警觉性 0~1：越高越容易被吓跑、越不容易靠近 */
    wariness: z.number().min(0).max(1),
    /** 试探（浮漂轻点）次数范围 */
    nibbles: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    /** 咬钩后可以提竿的时间窗口（秒） */
    biteWindow: z.number().positive(),
    /** 游向饵料的速度倍率 */
    approachSpeed: z.number().positive(),
    /** 每次试探把饵偷走的概率 */
    baitThief: z.number().min(0).max(1),
    /** 成群出现时一群几条 */
    school: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  }),
  fight: z.object({
    style: z.enum(FIGHT_STYLES),
    /** 力气 0~1 */
    power: z.number().min(0).max(2),
    /** 体力（秒）：在合适张力下遛多久能遛乏 */
    stamina: z.number().positive(),
  }),
  price: z.number().min(0),
  /** 外公笔记里的线索 */
  note: z.string(),
  /** 被放生的锦鲤：只能放进方塘养，不能做菜、周叔也不收；画的时候按锦鲤的花纹画 */
  koi: z.boolean().default(false),
  look: z.object({
    base: hexColor,
    back: hexColor,
    fin: hexColor,
    finAlpha: z.number().min(0).max(1),
    scales: z.number().min(0).max(1),
    spots: hexColor.optional(),
    bars: hexColor.optional(),
  }),
});
export type FishSpecies = z.infer<typeof FishSpeciesSchema>;

export const ZoneShapeSchema = z.object({
  type: ZoneType,
  x: z.number(),
  y: z.number(),
  rx: z.number().positive(),
  ry: z.number().positive(),
});
export type ZoneShape = z.infer<typeof ZoneShapeSchema>;

export const FishingPositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string(),
  /** 程序生成水底用的种子 */
  seed: z.number().int(),
  /** 岸边的上沿（占画面高度的比例），往下是岸 */
  bankY: z.number().min(0.5).max(0.95),
  /** 区域形状，坐标按画面宽高归一化 */
  zones: z.array(ZoneShapeSchema).max(12),
  shade: z.object({ x: z.number(), y: z.number(), rx: z.number(), ry: z.number() }).optional(),
});
export type FishingPosition = z.infer<typeof FishingPositionSchema>;

export const SpotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 水流方向和速度（像素 / 秒） */
  flow: z.tuple([z.number(), z.number()]),
  /** 水底的样子：溪底多卵石，湖底多淤泥 */
  bed: z.enum(['creek', 'lake']).default('creek'),
  /** 水面上有几丛荷叶 */
  lilies: z.number().int().min(0).default(0),
  positions: z.array(FishingPositionSchema).min(1),
});
export type Spot = z.infer<typeof SpotSchema>;

export const ItemsSchema = z.object({
  baits: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        note: z.string(),
        /** 开局外公留下的数量 */
        startCount: z.number().int().min(0),
        /** 杂货铺的单价（元） */
        price: z.number().min(0),
      }),
    )
    .min(1),
  rods: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        note: z.string(),
        /** 最远抛投距离（像素） */
        range: z.number().positive(),
        /** 抛投精度 0~1 */
        accuracy: z.number().min(0).max(1),
        /** 收线速度（像素 / 秒） */
        reelSpeed: z.number().positive(),
      }),
    )
    .min(1),
  lines: z
    .array(z.object({ id: z.string(), name: z.string(), strength: z.number().positive() }))
    .min(1),
  keepNetCapacity: z.number().int().positive(),
  /** 开局外公旧钱包里的钱 */
  startMoney: z.number().min(0),
  /** 开局外公灶屋里剩下的东西（葱、面粉……） */
  startGoods: z.record(z.string(), z.number().int().positive()).default({}),
});
export type Items = z.infer<typeof ItemsSchema>;
export type Bait = Items['baits'][number];
export type Rod = Items['rods'][number];
export type FishingLine = Items['lines'][number];

export const PondSchema = z.object({
  name: z.string(),
  /** 塘里最多养几条鱼（以后扩建鱼塘可以变大） */
  capacity: z.number().int().positive(),
  /** 开局时塘里就有的鱼：外公留下的锦鲤 */
  starters: z.array(
    z.object({
      /** 锦鲤品种名，要和画笔里的品种对得上（红白、黄金……） */
      variety: z.string(),
      name: z.string(),
      weightKg: z.number().positive(),
      lengthCm: z.number().positive(),
      note: z.string(),
    }),
  ),
});
export type PondConfig = z.infer<typeof PondSchema>;

const amounts = z.record(z.string(), z.number().int().positive());

/** 除了饵料以外的东西：作物、加工品、材料。库存里和饵料用同一套 id */
export const GoodsSchema = z.object({
  goods: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      note: z.string(),
      /** 卖给杂货铺 / 从杂货铺买的参考价（元） */
      price: z.number().min(0),
    }),
  ),
  /** 阿婆杂货铺卖的东西（种子另外全都卖） */
  shop: z.array(z.string()).default([]),
  /** 在家里做的加工：石磨磨面、和面饵、点豆腐 */
  crafts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      note: z.string(),
      inputs: amounts,
      outputs: amounts,
      /** 花掉的游戏分钟 */
      minutes: z.number().min(0),
    }),
  ),
});
export type Goods = z.infer<typeof GoodsSchema>;
export type Good = Goods['goods'][number];
export type Craft = Goods['crafts'][number];

export const CropSchema = z.object({
  id: z.string(),
  name: z.string(),
  seasons: z.array(z.enum(SEASON_KEYS)).min(1),
  /** 浇够几天水成熟 */
  days: z.number().int().positive(),
  /** 收获数量 [最少, 最多] */
  yield: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** 收获得到的东西（饵料或货物的 id） */
  produce: z.string(),
  seedPrice: z.number().min(0),
  /** 开局外公留下的种子 */
  startSeeds: z.number().int().min(0),
  note: z.string(),
});
export type Crop = z.infer<typeof CropSchema>;

export const FarmSchema = z.object({
  name: z.string(),
  plots: z.number().int().positive(),
  /** 每种操作花掉的游戏分钟 */
  minutes: z.object({
    clear: z.number().min(0),
    till: z.number().min(0),
    sow: z.number().min(0),
    water: z.number().min(0),
    harvest: z.number().min(0),
    fertilize: z.number().min(0),
  }),
  /** 翻地挖蚯蚓 */
  worms: z.object({
    clearChance: z.number().min(0).max(1),
    tillChance: z.number().min(0).max(1),
    min: z.number().int().min(0),
    max: z.number().int().min(0),
    /** 当天下雨，多挖到几条 */
    rainBonus: z.number().int().min(0),
    /** 施过堆肥的地，多挖到几条 */
    compostBonus: z.number().int().min(0),
  }),
  /** 施了堆肥，收获多几成 */
  compostYieldBonus: z.number().min(0),
  /** 施了堆肥，每天多长几天（按天数算） */
  compostGrowBonus: z.number().min(0),
  /** 收获时留下一颗种子的概率 */
  seedReturnChance: z.number().min(0).max(1),
});
export type FarmConfig = z.infer<typeof FarmSchema>;

export const AREAS = ['home', 'creek', 'village', 'lake'] as const;
export type Area = (typeof AREAS)[number];

export const PlacesSchema = z.object({
  places: z.array(
    z.object({
      /** 同时也是画面名（?scene= 用的名字） */
      id: z.string(),
      name: z.string(),
      area: z.enum(AREAS),
      note: z.string(),
      /** 在手绘地图上的位置（0~1） */
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      /** 要先买了哪项升级才能去（例如修路） */
      requires: z.string().optional(),
    }),
  ),
  /** 睡醒时在哪 */
  home: z.string(),
  /** 两个区域之间赶路花的游戏分钟（不分方向） */
  travel: z.array(z.object({ from: z.enum(AREAS), to: z.enum(AREAS), minutes: z.number().min(0) })),
});
export type Places = z.infer<typeof PlacesSchema>;
export type Place = Places['places'][number];

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 要用的鱼：species 为空表示什么鱼都行；null 表示不用鱼 */
  fish: z.object({ species: z.array(z.string()), count: z.number().int().positive() }).nullable(),
  /** 要用的配料（库存里的东西） */
  goods: z.record(z.string(), z.number().int().positive()),
  /** 一份的基础价（元） */
  price: z.number().positive(),
  note: z.string(),
  /** 盘子里菜的颜色（palette.ts 里的颜色名） */
  color: z.string().default('cream'),
});
export type Recipe = z.infer<typeof RecipeSchema>;

/** 界面和画面用的颜色名，对应 palette.ts 里的 PALETTE */
const paletteKey = z.string();

export const RestaurantSchema = z.object({
  name: z.string(),
  /** 营业时间（当天从 0:00 起的分钟） */
  openMinute: z.number(),
  closeMinute: z.number(),
  /** 过了这个点不再进新客人 */
  lastOrderMinute: z.number(),
  tankCapacity: z.number().int().positive(),
  menuSize: z.number().int().positive(),
  tables: z.number().int().positive(),
  seatsPerTable: z.number().int().positive(),
  /** 口碑为 0 时，客人之间隔几分钟来一位 [最短, 最长] */
  arrivalMinutes: z.tuple([z.number().positive(), z.number().positive()]),
  /** 点了菜最多等几分钟 */
  patienceMinutes: z.number().positive(),
  eatMinutes: z.number().positive(),
  /** 小满代班：收入打几折、菜做得怎么样、一晚上卖几道 */
  helper: z.object({
    share: z.number().min(0).max(1),
    quality: z.number().min(0).max(1),
    dishes: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  }),
  /** 每做一道鱼菜，攒下多少堆肥（鱼杂和剩菜） */
  compostPerFishDish: z.number().min(0),
  /** 做菜小游戏：每一步指针的速度（来回一趟每秒几次）和好区的宽度（0~1） */
  cooking: z.object({
    steps: z
      .array(
        z.object({ name: z.string(), speed: z.number().positive(), zone: z.number().positive() }),
      )
      .min(1),
  }),
  guests: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        animal: z.enum(['rabbit', 'duck', 'dog', 'otter', 'buffalo', 'fox']),
        color: paletteKey,
        accent: paletteKey,
        likes: z.array(z.string()),
        /** 不吃鱼 */
        vegetarian: z.boolean(),
        /** 口碑到多少才会来 */
        minReputation: z.number().min(0),
        weight: z.number().positive(),
      }),
    )
    .min(1),
});
export type RestaurantConfig = z.infer<typeof RestaurantSchema>;
export type GuestKind = RestaurantConfig['guests'][number];

/** 一项升级的效果：数字是升级后的新值（不是增量）；rod / line 是换上的渔具 id */
export const UpgradeEffectSchema = z
  .object({
    keepNetCapacity: z.number().int().positive(),
    pondCapacity: z.number().int().positive(),
    plots: z.number().int().positive(),
    rod: z.string(),
    line: z.string(),
    /** 每天早上蚯蚓床里多出来的蚯蚓 */
    dailyWorms: z.number().int().min(0),
    tankCapacity: z.number().int().positive(),
    menuSize: z.number().int().positive(),
    tables: z.number().int().positive(),
    /** 做菜小游戏好区的宽度倍率 */
    cookingEase: z.number().positive(),
    /** 口碑多涨几成 */
    reputationBonus: z.number().min(0),
    /** 能去一个新地方了（地点 id） */
    unlockPlace: z.string(),
  })
  .partial();
export type UpgradeEffect = z.infer<typeof UpgradeEffectSchema>;

export const UpgradesSchema = z.object({
  groups: z.array(z.object({ id: z.string(), name: z.string(), note: z.string() })),
  upgrades: z.array(
    z.object({
      id: z.string(),
      group: z.string(),
      name: z.string(),
      note: z.string(),
      price: z.number().positive(),
      /** 要先买了哪一项 */
      requires: z.string().nullable(),
      effect: UpgradeEffectSchema,
    }),
  ),
});
export type Upgrades = z.infer<typeof UpgradesSchema>;
export type Upgrade = Upgrades['upgrades'][number];
