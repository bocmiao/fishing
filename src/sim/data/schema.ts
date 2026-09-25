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
  positions: z.array(FishingPositionSchema).min(1),
});
export type Spot = z.infer<typeof SpotSchema>;

export const ItemsSchema = z.object({
  baits: z.array(z.object({ id: z.string(), name: z.string(), note: z.string() })).min(1),
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
