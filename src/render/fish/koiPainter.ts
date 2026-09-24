import { clamp01, fbm, smoothstep, valueNoise } from '../noise';
import type { KoiLook } from './koiLook';

/**
 * 按 KoiLook 逐像素画出一条俯视的鱼（含鳍、花纹、鳞纹、明暗、眼睛）。
 * 纹理横向是身体方向：x = 0 是吻端，x = FISH_TEX_W 是尾鳍末端；纵向中线是脊背。
 */
export const FISH_TEX_W = 256;
export const FISH_TEX_H = 112;

/** 俯视的身体半宽轮廓（占全长的比例），u 从吻端到尾柄 */
const PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.0],
  [0.012, 0.036],
  [0.035, 0.062],
  [0.08, 0.086],
  [0.15, 0.103],
  [0.25, 0.112],
  [0.35, 0.108],
  [0.46, 0.092],
  [0.57, 0.068],
  [0.67, 0.044],
  [0.75, 0.029],
  [0.8, 0.025],
  [0.82, 0.0],
];

function sampleProfile(u: number): number {
  if (u <= 0 || u >= 0.82) return 0;
  let i = 0;
  while (i < PROFILE.length - 2 && PROFILE[i + 1]![0] < u) i++;
  const p0 = PROFILE[Math.max(0, i - 1)]!;
  const p1 = PROFILE[i]!;
  const p2 = PROFILE[i + 1]!;
  const p3 = PROFILE[Math.min(PROFILE.length - 1, i + 2)]!;
  const t = (u - p1[0]) / (p2[0] - p1[0]);
  // Catmull-Rom（按非均匀间距换算切线）
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  const h =
    (2 * t3 - 3 * t2 + 1) * p1[1] +
    (t3 - 2 * t2 + t) * m1 +
    (-2 * t3 + 3 * t2) * p2[1] +
    (t3 - t2) * m2;
  return Math.max(0, h);
}

/** 预先算好每一列的身体半宽（像素）和斜率 */
export function buildBodyTable(
  plump: number,
  width = FISH_TEX_W,
): { hw: Float32Array; slope: Float32Array } {
  const hw = new Float32Array(width);
  const slope = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const u = (x + 0.5) / width;
    const bell = smoothstep(0.03, 0.2, u) * (1 - smoothstep(0.55, 0.78, u));
    hw[x] = sampleProfile(u) * width * (1 + (plump - 1) * bell);
  }
  for (let x = 0; x < width; x++) {
    const a = hw[Math.max(0, x - 1)]!;
    const b = hw[Math.min(width - 1, x + 1)]!;
    slope[x] = (b - a) / 2;
  }
  return { hw, slope };
}

interface Px {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 预乘 alpha 的"叠在上面"混合 */
function over(dst: Px, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  const k = 1 - a;
  dst.r = r * a + dst.r * k;
  dst.g = g * a + dst.g * k;
  dst.b = b * a + dst.b * k;
  dst.a = a + dst.a * k;
}

/** 椭圆形的胸鳍 / 腹鳍，返回 [alpha, 沿鳍方向的位置 0~1] */
function finShape(
  x: number,
  y: number,
  cx: number,
  cy: number,
  a: number,
  b: number,
  cos: number,
  sin: number,
): [number, number] {
  const dx = x - cx;
  const dy = y - cy;
  const along = dx * cos + dy * sin;
  const across = -dx * sin + dy * cos;
  const e = Math.sqrt((along / a) ** 2 + (across / b) ** 2);
  const alpha = clamp01((1 - e) * b + 0.5);
  const rays = 0.82 + 0.18 * Math.cos((across / b) * 7);
  return [alpha * rays, clamp01((along + a) / (2 * a))];
}

/**
 * 把一条鱼画进 RGBA 数据（非预乘），写入 (ox, oy) 开始的 FISH_TEX_W × FISH_TEX_H 区域。
 * stride 是整张图的宽度（像素）。
 */
export function paintKoi(
  look: KoiLook,
  data: Uint8ClampedArray,
  stride: number,
  ox: number,
  oy: number,
): void {
  const W = FISH_TEX_W;
  const H = FISH_TEX_H;
  const L = W;
  const cy = H / 2;
  const { hw, slope } = buildBodyTable(look.plump);
  const fl = look.finLength;
  const [br, bg, bb] = look.base;
  const [fr, fg, fb] = look.fin;
  const [sr, sg, sb] = look.scaleTint;
  const seed = look.seed;
  const px: Px = { r: 0, g: 0, b: 0, a: 0 };

  // 胸鳍：在头后方，向后外侧张开
  const pecU = 0.2;
  const pecHw = hw[Math.floor(pecU * W)]!;
  const pecA = 0.062 * fl * L;
  const pecB = 0.031 * fl * L;
  const pecAng = 0.62;
  const pecCx = (pecU + 0.05 * fl) * L;
  const pecOff = pecHw + 0.028 * fl * L;
  // 腹鳍
  const pelU = 0.47;
  const pelHw = hw[Math.floor(pelU * W)]!;
  const pelA = 0.034 * fl * L;
  const pelB = 0.016 * fl * L;
  const pelAng = 0.75;
  const pelCx = (pelU + 0.025 * fl) * L;
  const pelOff = pelHw + 0.01 * L;
  // 眼睛
  const eyeU = 0.066;
  const eyeX = eyeU * L;
  const eyeHw = hw[Math.floor(eyeU * W)]!;
  const eyeR = 0.0115 * L;
  const eyeY = eyeHw * 0.84;
  // 尾鳍
  const tailStart = 0.72;
  const tailMaxHw = L * (0.024 + 0.13 * Math.sqrt(fl));

  const scaleSize = (look.scales === 'doitsu' ? 0.055 : 0.03) * L;

  for (let y = 0; y < H; y++) {
    const vpx = y + 0.5 - cy;
    const av = Math.abs(vpx);
    const side = vpx < 0 ? -1 : 1;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / L;
      px.r = 0;
      px.g = 0;
      px.b = 0;
      px.a = 0;

      // ---- 身体后面的鳍：腹鳍、胸鳍、尾鳍 ----
      if (u > pelU - 0.03 && u < pelU + 0.12) {
        const [a, t] = finShape(
          x,
          vpx,
          pelCx,
          side * pelOff,
          pelA,
          pelB,
          Math.cos(pelAng),
          side * Math.sin(pelAng),
        );
        if (a > 0) over(px, fr, fg, fb, a * look.finAlpha * 0.7 * (1 - 0.4 * t));
      }
      if (u > pecU - 0.04 && u < pecU + 0.2) {
        const [a, t] = finShape(
          x,
          vpx,
          pecCx,
          side * pecOff,
          pecA,
          pecB,
          Math.cos(pecAng),
          side * Math.sin(pecAng),
        );
        if (a > 0) over(px, fr, fg, fb, a * look.finAlpha * (1 - 0.45 * t));
      }
      if (u > tailStart) {
        const s = clamp01((u - tailStart) / (1 - tailStart));
        const tailHw = L * 0.024 + (tailMaxHw - L * 0.024) * Math.pow(s, 0.85);
        const fork = 1 - 0.1 * (1 - Math.pow(Math.min(1, av / tailMaxHw), 1.4));
        const aLat = clamp01(tailHw - av + 0.5);
        const aEnd = clamp01((fork - u) * L + 0.5);
        if (aLat > 0 && aEnd > 0) {
          const phi = Math.atan2(vpx, (u - tailStart + 0.03) * L);
          const rays = 0.8 + 0.2 * Math.cos(phi * 28);
          over(px, fr, fg, fb, aLat * aEnd * rays * look.finAlpha * (1 - 0.4 * s));
        }
      }

      // ---- 身体 ----
      const h = hw[x]!;
      if (h > 0) {
        const inv = 1 / Math.sqrt(1 + slope[x]! * slope[x]!);
        const aBody = clamp01((h - av) * inv + 0.5);
        if (aBody > 0) {
          const t = Math.min(1, av / h);
          const vn = vpx / h;
          let r = br;
          let g = bg;
          let b = bb;

          // 鳞纹
          if (u > 0.12 && u < 0.78 && look.scaleStrength > 0) {
            const sy = vpx / scaleSize;
            const row = Math.floor(sy);
            const sx = x / scaleSize + (row & 1) * 0.5;
            const fx = sx - Math.floor(sx) - 0.5;
            const fy = sy - row - 0.5;
            const d = Math.sqrt(fx * fx + fy * fy * 1.4);
            let k = smoothstep(0.3, 0.5, d);
            if (look.scales === 'doitsu') {
              const onRow = av / h < 0.26 || (av / h > 0.8 && av / h < 0.97);
              k = onRow ? k : 0;
            }
            const strength =
              look.scales === 'normal' ? 0.07 : look.scales === 'reticulated' ? 0.3 : 0.55;
            const m = k * strength * look.scaleStrength;
            r += (sr - r) * m;
            g += (sg - g) * m;
            b += (sb - b) * m;
          }

          // 花纹：先把坐标扭曲一下，再把几个斑块柔和地并在一起，边缘再加一点细碎的起伏
          if (look.patches.length > 0) {
            const wu = u + (fbm(u * 5 + 1.3, vn * 1.2, seed + 7, 2) - 0.5) * 0.09;
            const wv = vn + (fbm(u * 5 + 4.1, vn * 1.2 + 2.2, seed + 13, 2) - 0.5) * 0.8;
            for (let li = 0; li < look.patches.length; li++) {
              const layer = look.patches[li]!;
              let sum = 0;
              for (const blob of layer.blobs) {
                const du = (wu - blob.u) / blob.ru;
                if (du > 2 || du < -2) continue;
                const dv = (wv - blob.v) / blob.rv;
                sum += Math.exp((1 - Math.sqrt(du * du + dv * dv)) * 6);
              }
              if (sum < 0.05) continue;
              let field = Math.log(sum) / 6;
              field +=
                (fbm(u * 20, vn * 3.2 + li * 3.1, seed + li * 101, 2) - 0.5) *
                layer.edgeNoise *
                0.7;
              const m = smoothstep(-0.04, 0.04, field);
              if (m > 0) {
                r += (layer.color[0] - r) * m;
                g += (layer.color[1] - g) * m;
                b += (layer.color[2] - b) * m;
              }
            }
          }

          // 丹顶
          if (look.tancho) {
            const dx = (u - look.tancho.u) * L;
            const m = clamp01(look.tancho.r * L - Math.sqrt(dx * dx + vpx * vpx) + 0.5);
            if (m > 0) {
              r += (look.tancho.color[0] - r) * m;
              g += (look.tancho.color[1] - g) * m;
              b += (look.tancho.color[2] - b) * m;
            }
          }

          // 背鳍：俯视时是脊背中线上一道细细的深色
          if (u > 0.3 && u < 0.64 && av < 2.4) {
            const bump = smoothstep(0.3, 0.36, u) * (1 - smoothstep(0.58, 0.64, u));
            const m = 0.2 * (1 - av / 2.4) * bump;
            r *= 1 - m;
            g *= 1 - m;
            b *= 1 - m;
          }

          // 体积感：中间略亮，两侧变暗
          const shade = 1 + 0.07 * (1 - t * t) - 0.2 * smoothstep(0.5, 1, t);
          r *= shade;
          g *= shade;
          b *= shade;

          // 金属光泽
          if (look.metallic > 0) {
            const sheen =
              look.metallic * (0.15 * Math.pow(1 - t, 2.5) + 0.07 * valueNoise(x / 3, y / 3, seed));
            r += (1 - r) * sheen;
            g += (1 - g) * sheen;
            b += (1 - b) * sheen;
          }

          over(px, r, g, b, aBody);
        }
      }

      // ---- 眼睛 ----
      const ex = x + 0.5 - eyeX;
      if (ex > -eyeR - 1 && ex < eyeR + 1) {
        const ey = av - eyeY;
        const m = clamp01(eyeR - Math.sqrt(ex * ex + ey * ey) + 0.5);
        if (m > 0) over(px, 0.1, 0.11, 0.11, m * 0.92);
      }

      const i = ((oy + y) * stride + (ox + x)) * 4;
      if (px.a > 0.002) {
        data[i] = (px.r / px.a) * 255;
        data[i + 1] = (px.g / px.a) * 255;
        data[i + 2] = (px.b / px.a) * 255;
        data[i + 3] = px.a * 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

/**
 * 通用的鱼影纹理：鱼的剪影，边缘很柔和。所有鱼共用一张。
 */
export function paintFishShadow(
  data: Uint8ClampedArray,
  stride: number,
  ox: number,
  oy: number,
): void {
  const W = FISH_TEX_W;
  const H = FISH_TEX_H;
  const L = W;
  const cy = H / 2;
  const { hw } = buildBodyTable(1);
  const soft = 5;
  for (let y = 0; y < H; y++) {
    const av = Math.abs(y + 0.5 - cy);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / L;
      const h = hw[x]!;
      let a = h > 0 ? smoothstep(-soft, soft, h - av) : 0;
      // 胸鳍和尾鳍的影子淡一些
      if (u > 0.18 && u < 0.36) {
        const fin = smoothstep(
          -soft,
          soft,
          h + 0.07 * L * Math.sin(((u - 0.18) / 0.18) * Math.PI) - av,
        );
        a = Math.max(a, fin * 0.45);
      }
      if (u > 0.72) {
        const s = (u - 0.72) / 0.28;
        const tailHw = L * (0.024 + 0.13 * Math.pow(s, 0.85));
        const fin = smoothstep(-soft, soft, tailHw - av) * smoothstep(-soft, soft, (0.98 - u) * L);
        a = Math.max(a, fin * 0.4);
      }
      const i = ((oy + y) * stride + (ox + x)) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = a * 255;
    }
  }
}
