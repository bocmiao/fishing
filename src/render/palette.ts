/**
 * 色板，和 docs/art-audio-guide.md 第 1.2 节保持一致。
 * 改颜色请先改文档，再同步到这里。
 */
export const PALETTE = {
  // 场景
  water: 0x6a9a84,
  waterLight: 0x8aab92,
  waterDark: 0x4a7a6a,
  waterDeep: 0x33584e,
  paper: 0xf5ebdb,
  card: 0xe6e9de,
  accent: 0x1c3a3a,
  // 鱼和主角
  ink: 0x1e2629,
  fishWhite: 0xf4f0e6,
  vermilion: 0xdd432d,
  gold: 0xe4a33b,
  slateBlue: 0x4b7079,
  indigo: 0x44557a,
  straw: 0xc9a36b,
  bamboo: 0xd2a24c,
  cream: 0xede4d0,
  pink: 0xe8a596,
} as const;

export type Rgb = readonly [number, number, number];

/** 0xRRGGBB → [0~1, 0~1, 0~1] */
export function hexToRgb(hex: number): Rgb {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

/** [0~1, 0~1, 0~1] → 0xRRGGBB */
export function rgbToHex(rgb: Rgb): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(rgb[0]) << 16) | (c(rgb[1]) << 8) | c(rgb[2]);
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scaleRgb(a: Rgb, k: number): Rgb {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** 给 GLSL 用的 vec3 字面量 */
export function glslVec3(hex: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
}
