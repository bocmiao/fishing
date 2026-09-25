import { z } from 'zod';
import type { GameData } from './data/gameData';
import { WEATHERS } from './data/schema';
import { reserveUids } from './fishing/catchRoll';
import { GameState } from './state';

/**
 * 存档：把 GameState 变成可以 JSON 保存的数据，再还原回来。
 * 结构一旦发布就不能随便改：改了要升 SAVE_VERSION，并在 migrate() 里把旧版转成新版。
 * 同一个版本里新增的字段一律给默认值，老存档读进来也不会出错。
 */
export const SAVE_VERSION = 1;

const SizeClass = z.enum(['small', 'medium', 'large', 'huge']);

const FishSchema = z.object({
  uid: z.number(),
  speciesId: z.string(),
  weightKg: z.number(),
  lengthCm: z.number(),
  sizeClass: SizeClass,
  trophy: z.boolean(),
  lookSeed: z.number(),
});

const CaughtFishSchema = FishSchema.extend({
  day: z.number(),
  minute: z.number(),
  spotId: z.string(),
  positionId: z.string(),
});

const PondFishSchema = z.object({
  uid: z.number(),
  speciesId: z.string().nullable(),
  variety: z.string().nullable(),
  name: z.string(),
  weightKg: z.number(),
  lengthCm: z.number(),
  lookSeed: z.number(),
  origin: z.string(),
  note: z.string(),
  day: z.number(),
});

const PlotSchema = z.object({
  stage: z.enum(['wild', 'soil', 'tilled', 'growing', 'ripe']),
  cropId: z.string().nullable(),
  grown: z.number(),
  watered: z.boolean(),
  compost: z.boolean(),
});

const StatsSchema = z.object({
  caught: z.number().default(0),
  kept: z.number().default(0),
  worms: z.number().default(0),
  harvested: z.number().default(0),
  earned: z.number().default(0),
  spent: z.number().default(0),
});

export const SaveSchemaV1 = z.object({
  version: z.literal(1),
  seed: z.number(),
  clock: z.object({ day: z.number(), minute: z.number() }),
  weather: z.enum(WEATHERS),
  money: z.number(),
  inventory: z.record(z.string(), z.number()),
  keepNet: z.array(CaughtFishSchema),
  keepNetCapacity: z.number(),
  pond: z.array(PondFishSchema),
  pondCapacity: z.number(),
  journal: z.array(
    z.tuple([
      z.string(),
      z.object({ caught: z.number(), bestWeightKg: z.number(), firstDay: z.number() }),
    ]),
  ),
  plots: z.array(PlotSchema).default([]),
  baitId: z.string(),
  rodId: z.string(),
  lineId: z.string(),
  place: z.string(),
  today: StatsSchema.default({ caught: 0, kept: 0, worms: 0, harvested: 0, earned: 0, spent: 0 }),
});
export type SaveData = z.infer<typeof SaveSchemaV1>;

export function serialize(state: GameState): SaveData {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    clock: state.clock.snapshot(),
    weather: state.weather,
    money: state.money,
    inventory: state.inventory.toJSON(),
    keepNet: state.keepNet.map((f) => ({ ...f })),
    keepNetCapacity: state.keepNetCapacity,
    pond: state.pond.map((f) => ({ ...f })),
    pondCapacity: state.pondCapacity,
    journal: [...state.journal.entries()].map(([id, e]) => [id, { ...e }]),
    plots: state.plots.map((p) => ({ ...p })),
    baitId: state.baitId,
    rodId: state.rodId,
    lineId: state.lineId,
    place: state.place,
    today: { ...state.today },
  };
}

/** 把任何版本的存档转成当前版本；认不出来就抛错 */
export function migrate(raw: unknown): SaveData {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 1) return SaveSchemaV1.parse(raw);
  throw new Error(`认不出的存档版本：${String(version)}`);
}

/** 从存档还原游戏状态。配置表里已经没有的东西（被删掉的鱼、饵料）直接丢掉 */
export function restore(data: GameData, raw: unknown): GameState {
  const save = migrate(raw);
  const state = new GameState(data, save.seed);
  state.clock.set(save.clock);
  state.reseed(save.seed);
  state.weather = save.weather;
  state.money = save.money;

  for (const [id] of state.inventory.entries()) state.inventory.take(id, state.inventory.count(id));
  for (const [id, n] of Object.entries(save.inventory))
    if (data.itemNames.has(id)) state.inventory.add(id, n);

  state.keepNet.push(...save.keepNet.filter((f) => data.speciesById.has(f.speciesId)));
  state.keepNetCapacity = save.keepNetCapacity;
  state.pond.length = 0;
  state.pond.push(
    ...save.pond.filter((f) => f.speciesId === null || data.speciesById.has(f.speciesId)),
  );
  state.pondCapacity = save.pondCapacity;
  for (const [id, e] of save.journal) if (data.speciesById.has(id)) state.journal.set(id, e);

  // 地块数量以配置表为准（扩建以后变多，存档里少的补成荒地）
  save.plots.forEach((p, i) => {
    const plot = state.plots[i];
    if (plot && (p.cropId === null || data.cropById.has(p.cropId))) Object.assign(plot, p);
  });

  if (data.items.baits.some((b) => b.id === save.baitId)) state.baitId = save.baitId;
  if (data.items.rods.some((r) => r.id === save.rodId)) state.rodId = save.rodId;
  if (data.items.lines.some((l) => l.id === save.lineId)) state.lineId = save.lineId;
  if (data.placeById.has(save.place)) state.place = save.place;
  state.today = { ...save.today };

  const maxUid = Math.max(0, ...state.keepNet.map((f) => f.uid), ...state.pond.map((f) => f.uid));
  reserveUids(maxUid + 1);
  return state;
}
