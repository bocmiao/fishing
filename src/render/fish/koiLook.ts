import type { Rng } from '../../sim/rng/rng';
import { hexToRgb, mixRgb, type Rgb } from '../palette';

/**
 * 一条鱼"长什么样"（表现型），是渲染的输入。
 * M3 的遗传系统会从基因算出 KoiLook；现在先按品种随机生成。
 *
 * 坐标约定：u 沿身体方向，0 = 吻端，1 = 尾鳍末端；
 * v 横向，已按当前位置的身体半宽归一化，-1 ~ 1 为身体两侧边缘。
 */
export interface PatchBlob {
  u: number;
  v: number;
  /** 沿身体方向的半径（占全长的比例） */
  ru: number;
  /** 横向半径（占半宽的比例），大于 1 会包到身体侧面 */
  rv: number;
}

export interface PatchLayer {
  color: Rgb;
  blobs: PatchBlob[];
  /** 斑块边缘的波动程度 */
  edgeNoise: number;
  /** 不透明度，默认 1 */
  opacity?: number;
}

export type ScaleStyle = 'normal' | 'doitsu' | 'reticulated';
/** 体型：鲤形（锦鲤、鲫鱼）、细长（马口鱼、白条）、鳗形（泥鳅、黄鳝） */
export type FishShape = 'carp' | 'slender' | 'eel';

export interface KoiLook {
  /** 品种名，例如"红白" */
  variety: string;
  base: Rgb;
  /** 金属光泽 0~1 */
  metallic: number;
  scales: ScaleStyle;
  /** 鳞片边缘的颜色 */
  scaleTint: Rgb;
  /** 鳞纹明显程度 0~1 */
  scaleStrength: number;
  /** 按顺序叠加的花纹层（例如先红斑再墨斑） */
  patches: PatchLayer[];
  /** 丹顶：头顶的红圆 */
  tancho: { u: number; r: number; color: Rgb } | null;
  fin: Rgb;
  finAlpha: number;
  /** 胖瘦 0.85~1.2 */
  plump: number;
  /** 鳍的大小 0.8~1.5 */
  finLength: number;
  /** 花纹边缘噪声的种子 */
  seed: number;
  /** 体型，默认鲤形 */
  shape?: FishShape;
  /** 背部颜色（野生鱼背深腹浅） */
  back?: Rgb;
}

const WHITE = hexToRgb(0xf4f0e6);
const INK = hexToRgb(0x1e2629);
const RED = hexToRgb(0xdd432d);

function jitter(rng: Rng, c: Rgb, amount: number): Rgb {
  const k = 1 + rng.range(-amount, amount);
  return [c[0] * k, c[1] * k, c[2] * k];
}

function redTone(rng: Rng): Rgb {
  // 从橙红到深朱红
  return mixRgb(hexToRgb(0xe2573a), hexToRgb(0xc9302a), rng.float());
}

function whiteTone(rng: Rng): Rgb {
  return mixRgb(WHITE, hexToRgb(0xfaf6ee), rng.float());
}

function baseLook(rng: Rng, variety: string, base: Rgb): KoiLook {
  return {
    variety,
    base,
    metallic: 0,
    scales: 'normal',
    scaleTint: [0, 0, 0],
    scaleStrength: 0.25,
    patches: [],
    tancho: null,
    fin: whiteTone(rng),
    finAlpha: 0.55,
    plump: rng.range(0.9, 1.1),
    finLength: rng.range(0.9, 1.15),
    seed: rng.int(1, 1_000_000),
  };
}

/** 红白的"段"：沿背部分布的几块大红斑 */
function kohakuBlobs(rng: Rng): PatchBlob[] {
  const steps = rng.int(2, 3);
  const blobs: PatchBlob[] = [];
  let u = rng.range(0.06, 0.14);
  for (let i = 0; i < steps && u < 0.68; i++) {
    const ru = rng.range(0.07, 0.14);
    blobs.push({ u: u + ru * 0.6, v: rng.range(-0.3, 0.3), ru, rv: rng.range(0.9, 1.5) });
    // 常常再延伸出一块，和前一块连成不规则的形状
    if (rng.chance(0.55)) {
      blobs.push({
        u: u + ru * 1.5,
        v: rng.range(-0.55, 0.55),
        ru: ru * rng.range(0.5, 0.9),
        rv: rng.range(0.6, 1.2),
      });
    }
    u += ru * 2 + rng.range(0.03, 0.1);
  }
  return blobs;
}

function sumiSpots(rng: Rng, count: number, big = false): PatchBlob[] {
  return Array.from({ length: count }, () => ({
    u: rng.range(0.14, 0.7),
    v: rng.range(-0.8, 0.8),
    ru: big ? rng.range(0.04, 0.09) : rng.range(0.015, 0.04),
    rv: big ? rng.range(0.4, 0.9) : rng.range(0.15, 0.45),
  }));
}

type VarietyMaker = (rng: Rng) => KoiLook;

const VARIETIES: { weight: number; make: VarietyMaker }[] = [
  {
    weight: 5,
    make: (rng) => {
      const look = baseLook(rng, '红白', whiteTone(rng));
      look.patches.push({ color: redTone(rng), blobs: kohakuBlobs(rng), edgeNoise: 0.5 });
      return look;
    },
  },
  {
    weight: 4,
    make: (rng) => {
      const look = baseLook(rng, '大正三色', whiteTone(rng));
      look.patches.push({ color: redTone(rng), blobs: kohakuBlobs(rng), edgeNoise: 0.5 });
      look.patches.push({ color: INK, blobs: sumiSpots(rng, rng.int(3, 7)), edgeNoise: 0.25 });
      return look;
    },
  },
  {
    weight: 3,
    make: (rng) => {
      const look = baseLook(rng, '昭和三色', INK);
      look.patches.push({ color: redTone(rng), blobs: kohakuBlobs(rng), edgeNoise: 0.5 });
      look.patches.push({
        color: whiteTone(rng),
        blobs: sumiSpots(rng, rng.int(2, 4), true),
        edgeNoise: 0.3,
      });
      look.fin = mixRgb(INK, WHITE, 0.55);
      return look;
    },
  },
  {
    weight: 2,
    make: (rng) => {
      const look = baseLook(rng, '白写', whiteTone(rng));
      const blobs = sumiSpots(rng, rng.int(3, 5), true);
      blobs.push({ u: rng.range(0.05, 0.12), v: rng.range(-0.3, 0.3), ru: 0.08, rv: 1.1 });
      look.patches.push({ color: INK, blobs, edgeNoise: 0.4 });
      return look;
    },
  },
  {
    weight: 1.2,
    make: (rng) => {
      const look = baseLook(rng, '丹顶', whiteTone(rng));
      look.tancho = { u: rng.range(0.1, 0.13), r: rng.range(0.045, 0.06), color: redTone(rng) };
      return look;
    },
  },
  {
    weight: 2,
    make: (rng) => {
      const gold = jitter(rng, hexToRgb(0xe4a33b), 0.06);
      const look = baseLook(rng, '黄金', gold);
      look.metallic = rng.range(0.75, 1);
      look.fin = mixRgb(gold, WHITE, 0.35);
      look.scaleTint = hexToRgb(0x8a5a1a);
      look.scaleStrength = 0.35;
      return look;
    },
  },
  {
    weight: 1.5,
    make: (rng) => {
      const look = baseLook(rng, '白金', hexToRgb(0xe9e7dc));
      look.metallic = 1;
      look.scaleTint = hexToRgb(0x9a9a8c);
      look.scaleStrength = 0.35;
      return look;
    },
  },
  {
    weight: 1.5,
    make: (rng) => {
      const red = jitter(rng, hexToRgb(0xd9532f), 0.06);
      const look = baseLook(rng, '红鲤', red);
      look.fin = mixRgb(red, WHITE, 0.3);
      return look;
    },
  },
  {
    weight: 1.5,
    make: (rng) => {
      const look = baseLook(rng, '乌鲤', INK);
      look.fin = mixRgb(INK, WHITE, 0.25);
      look.finAlpha = 0.65;
      return look;
    },
  },
  {
    weight: 1.5,
    make: (rng) => {
      const brown = jitter(rng, hexToRgb(0x9c7048), 0.07);
      const look = baseLook(rng, '茶鲤', brown);
      look.scales = 'reticulated';
      look.scaleTint = hexToRgb(0x5a3a22);
      look.scaleStrength = 0.8;
      look.fin = mixRgb(brown, WHITE, 0.25);
      look.plump = rng.range(1.05, 1.2);
      return look;
    },
  },
  {
    weight: 1,
    make: (rng) => {
      const look = baseLook(rng, '落叶', hexToRgb(0x8d9ba2));
      look.scales = 'reticulated';
      look.scaleTint = hexToRgb(0x56646c);
      look.scaleStrength = 0.6;
      look.patches.push({
        color: hexToRgb(0xb07a4a),
        blobs: kohakuBlobs(rng).map((b) => ({ ...b, rv: b.rv * 0.9 })),
        edgeNoise: 0.45,
      });
      return look;
    },
  },
  {
    weight: 1,
    make: (rng) => {
      const look = baseLook(rng, '秋翠', hexToRgb(0xa3b6bf));
      look.scales = 'doitsu';
      look.scaleTint = hexToRgb(0x3f5a6e);
      look.scaleStrength = 0.9;
      // 红色在身体两侧
      const blobs: PatchBlob[] = [];
      for (let u = 0.12; u < 0.7; u += rng.range(0.08, 0.14)) {
        blobs.push({ u, v: 1.1, ru: rng.range(0.05, 0.08), rv: 0.45 });
        blobs.push({ u: u + rng.range(-0.03, 0.03), v: -1.1, ru: rng.range(0.05, 0.08), rv: 0.45 });
      }
      look.patches.push({ color: redTone(rng), blobs, edgeNoise: 0.3 });
      look.fin = mixRgb(RED, WHITE, 0.45);
      return look;
    },
  },
  {
    weight: 1,
    make: (rng) => {
      const look = baseLook(rng, '浅黄', hexToRgb(0x7f97a4));
      look.scales = 'reticulated';
      look.scaleTint = hexToRgb(0x3b5361);
      look.scaleStrength = 0.9;
      const blobs: PatchBlob[] = [];
      for (let u = 0.1; u < 0.72; u += 0.1) {
        blobs.push({ u, v: 1.15, ru: 0.07, rv: 0.4 });
        blobs.push({ u, v: -1.15, ru: 0.07, rv: 0.4 });
      }
      look.patches.push({ color: redTone(rng), blobs, edgeNoise: 0.35 });
      look.fin = mixRgb(RED, WHITE, 0.4);
      return look;
    },
  },
  {
    weight: 0.8,
    make: (rng) => {
      const yellow = jitter(rng, hexToRgb(0xe6c45a), 0.05);
      const look = baseLook(rng, '黄鲤', yellow);
      look.fin = mixRgb(yellow, WHITE, 0.4);
      return look;
    },
  },
];

export function randomKoiLook(rng: Rng): KoiLook {
  const maker = rng.weighted(VARIETIES, (v) => v.weight)!;
  return maker.make(rng);
}

export const KOI_VARIETY_NAMES = [
  '红白',
  '大正三色',
  '昭和三色',
  '白写',
  '丹顶',
  '黄金',
  '白金',
  '红鲤',
  '乌鲤',
  '茶鲤',
  '落叶',
  '秋翠',
  '浅黄',
  '黄鲤',
] as const;
