import { RenderTexture, type Renderer } from 'pixi.js';
import type { FishingPosition } from '../../sim/data/schema';
import { glslVec3 } from '../palette';
import { NOISE_GLSL, createShaderQuad } from '../shaderLib';

/**
 * 程序生成的占位溪底和岸边（正式图：美术指南 BG-002）。
 * 区域形状来自配置表，所以画出来的深潭、水草、石缝和出鱼规则用的是同一份数据。
 */
const MAX_ZONES = 12;
const ZONE_CODE: Record<string, number> = { deep: 1, weeds: 2, rocks: 3, shallow: 4, open: 0 };

const COMMON = /* glsl */ `
uniform vec2 uSize;
uniform float uSeed;
uniform float uBankY;
${NOISE_GLSL}

/** 岸线的高度（像素），带一点起伏 */
float bankEdge(float x) {
  return uBankY + (vnoise(vec2(x / 140.0, uSeed)) - 0.5) * 34.0 + (vnoise(vec2(x / 37.0, uSeed + 3.0)) - 0.5) * 10.0;
}
`;

const BED_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec4 uZones[${MAX_ZONES}];
uniform float uZoneTypes[${MAX_ZONES}];
uniform float uZoneCount;
uniform vec4 uShade;
uniform float uMud;
${COMMON}

const vec3 SILT_DARK = ${glslVec3(0x6f8a78)};
const vec3 SILT_LIGHT = ${glslVec3(0x93a88f)};
const vec3 STONE_A = ${glslVec3(0xa3a28c)};
const vec3 STONE_B = ${glslVec3(0x8d9580)};
const vec3 STONE_C = ${glslVec3(0x9d8a6c)};
const vec3 STONE_D = ${glslVec3(0x7f9290)};
const vec3 WATER = ${glslVec3(0x5f8f80)};
const vec3 DEEP = ${glslVec3(0x2c554f)};
const vec3 WEED_DARK = ${glslVec3(0x355d3f)};
const vec3 WEED_LIGHT = ${glslVec3(0x5e8a55)};

/** 某类区域在这里的强度 0~1（椭圆内为 1，边缘柔和过渡） */
float zoneMask(vec2 px, float code, float soft) {
  float m = 0.0;
  for (int i = 0; i < ${MAX_ZONES}; i++) {
    if (float(i) >= uZoneCount) break;
    if (abs(uZoneTypes[i] - code) > 0.5) continue;
    vec4 z = uZones[i];
    vec2 d = (px - z.xy) / z.zw;
    float wob = (vnoise(px / 70.0 + float(i) * 3.1) - 0.5) * 0.35;
    float e = length(d) + wob;
    m = max(m, 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.4, e));
  }
  return m;
}

vec3 stoneTone(float h) {
  return h < 0.25 ? STONE_A : h < 0.5 ? STONE_B : h < 0.75 ? STONE_C : STONE_D;
}

/**
 * 散落的圆石：每个格子里按概率放一块，形状是随机旋转的椭圆，左上受光。
 * 返回 rgb 和 a（石头的覆盖度），shadowOut 返回石头投在底上的影子。
 */
vec4 stones(vec2 px, float cell, float density, float rMin, float rMax, float seed, out float shadowOut) {
  vec2 gi = floor(px / cell);
  vec4 best = vec4(0.0);
  shadowOut = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = gi + vec2(float(x), float(y));
      if (hash12(c + seed) > density) continue;
      vec2 center = (c + 0.2 + 0.6 * hash22(c + seed * 1.7)) * cell;
      float r = mix(rMin, rMax, hash12(c * 1.37 + seed));
      float ang = hash12(c + seed + 9.1) * 6.2831;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 d = px - center;
      vec2 q = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) / vec2(1.0, mix(0.6, 0.9, hash12(c + 3.3)));
      float dist = length(q) - r;
      vec2 ds = d - vec2(r * 0.25 + 1.5, r * 0.3 + 2.0);
      vec2 qs = vec2(ca * ds.x - sa * ds.y, sa * ds.x + ca * ds.y) / vec2(1.0, mix(0.6, 0.9, hash12(c + 3.3)));
      shadowOut = max(shadowOut, 1.0 - smoothstep(-2.0, r * 0.5 + 3.0, length(qs) - r));
      float m = 1.0 - smoothstep(-1.0, 1.0, dist);
      if (m > best.a) {
        vec2 n = d / max(r, 1.0);
        float lit = clamp(0.62 - dot(n, vec2(0.55, 0.62)) * 0.45, 0.0, 1.0);
        vec3 tone = stoneTone(hash12(c + seed * 2.9));
        float rim = smoothstep(-r * 0.35, 0.0, dist);
        vec3 sc = tone * (0.78 + 0.4 * lit) * (1.0 - rim * 0.12);
        sc *= 0.94 + 0.12 * vnoise(px / 3.0 + c);
        best = vec4(sc, m);
      }
    }
  }
  return best;
}

void main() {
  vec2 px = vUV * uSize;
  float bank = bankEdge(px.x);

  // 区域
  float deep = zoneMask(px, 1.0, 0.75);
  float weed = zoneMask(px, 2.0, 0.6);
  float rocks = zoneMask(px, 3.0, 0.5);
  float nearBank = smoothstep(bank - 200.0, bank - 20.0, px.y);

  // 水深：开阔水面中等，深潭很深，靠岸变浅
  float depth = 0.4 + 0.6 * deep - 0.32 * nearBank + (fbm(px / 330.0 + 7.0) - 0.5) * 0.22;
  depth = clamp(depth, 0.0, 1.0);

  // 底：淤泥和细沙（湖底淤泥多，颜色深一些、偏绿）
  vec3 col = mix(SILT_DARK, SILT_LIGHT, smoothstep(0.3, 0.7, fbm(px / 160.0 + uSeed)));
  col = mix(col, SILT_DARK * vec3(0.85, 0.95, 0.85), uMud * 0.5);
  col *= 0.94 + 0.12 * vnoise(px / 7.0);

  // 小卵石（越深越少、越看不清）
  float sh1;
  vec4 s1 = stones(px, 24.0, mix(0.55, 0.15, depth) * (1.0 - weed * 0.6) * (1.0 - uMud * 0.85), 4.0, 9.5, uSeed, sh1);
  col *= 1.0 - sh1 * 0.22;
  col = mix(col, s1.rgb, s1.a);
  // 大一些的石头
  float sh2;
  vec4 s2 = stones(px, 70.0, 0.22 * (1.0 - depth * 0.7) * (1.0 - uMud * 0.9), 10.0, 19.0, uSeed + 31.0, sh2);
  col *= 1.0 - sh2 * 0.28;
  col = mix(col, s2.rgb, s2.a);
  // 石缝区：大石头挤在一起
  if (rocks > 0.02) {
    float sh3;
    vec4 s3 = stones(px, 64.0, 0.9 * rocks, 20.0, 34.0, uSeed + 57.0, sh3);
    col = mix(col, col * 0.55, rocks * 0.5);
    col *= 1.0 - sh3 * 0.4 * rocks;
    col = mix(col, s3.rgb, s3.a * rocks);
  }
  // 水草：顺着水流方向拉长的草叶
  if (weed > 0.0) {
    float strands = fbm(vec2(px.x / 48.0, px.y / 5.5) + uSeed);
    float clump = fbm(px / 55.0 + 11.0);
    float w = weed * smoothstep(0.38, 0.58, strands * 0.55 + clump * 0.6);
    vec3 wc = mix(WEED_DARK, WEED_LIGHT, smoothstep(0.4, 0.8, strands));
    col *= 1.0 - weed * 0.18;
    col = mix(col, wc, w * 0.9);
  }

  // 水色：越深越暗、越偏青；湖水更浑一些
  col = mix(col, WATER, 0.28 + depth * 0.2 + uMud * 0.12);
  col = mix(col, DEEP, smoothstep(0.35, 1.0, depth) * 0.78);

  // 柳荫
  if (uShade.z > 0.0) {
    vec2 d = (px - uShade.xy) / uShade.zw;
    float s = 1.0 - smoothstep(0.55, 1.05, length(d) + (vnoise(px / 45.0) - 0.5) * 0.3);
    col *= 1.0 - s * 0.3;
  }

  // 左上方光线稍亮 + 细颗粒
  col *= 0.95 + 0.08 * (1.0 - clamp(vUV.x * 0.5 + vUV.y * 0.6, 0.0, 1.0));
  col *= 0.975 + 0.05 * fbm3(px / 30.0 + 3.7);
  finalColor = vec4(col, 1.0);
}
`;

const BANK_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uCat;
${COMMON}

const vec3 GRASS = ${glslVec3(0x6d8a58)};
const vec3 GRASS_LIGHT = ${glslVec3(0x8aa46c)};
const vec3 GRASS_DARK = ${glslVec3(0x4f6b44)};
const vec3 WET = ${glslVec3(0x3d5847)};
const vec3 STONE = ${glslVec3(0x9aa393)};
const vec3 STONE_DARK = ${glslVec3(0x6f7a6c)};

void main() {
  vec2 px = vUV * uSize;
  float edge = bankEdge(px.x);
  float inside = smoothstep(edge - 1.5, edge + 1.5, px.y);
  if (inside <= 0.0) {
    // 岸边在水面上投下一点点阴影
    float shade = 1.0 - smoothstep(edge - 16.0, edge, px.y);
    finalColor = vec4(0.0, 0.0, 0.0, (1.0 - shade) * 0.18);
    return;
  }
  // 草地：草叶的细纹 + 大块深浅
  float blades = vnoise(vec2(px.x / 3.2, px.y / 11.0));
  float patches = fbm(px / 90.0 + uSeed);
  vec3 col = mix(GRASS_DARK, GRASS, smoothstep(0.25, 0.7, patches));
  col = mix(col, GRASS_LIGHT, smoothstep(0.62, 0.9, blades) * 0.45);
  // 贴着水的一圈湿泥
  float wet = 1.0 - smoothstep(edge, edge + 16.0 + 6.0 * vnoise(px / 20.0), px.y);
  col = mix(col, WET, wet * 0.85);
  // 岸边零星的石头
  vec2 cell = floor(px / 70.0);
  vec2 c = (cell + 0.25 + 0.5 * hash22(cell + uSeed)) * 70.0;
  float r = mix(9.0, 20.0, hash12(cell + 4.0));
  float onEdge = 1.0 - smoothstep(10.0, 40.0, abs(c.y - edge - 14.0));
  if (hash12(cell + 7.7) < 0.55 && onEdge > 0.0) {
    float d = length((px - c) / vec2(1.0, 0.75));
    float m = (1.0 - smoothstep(r - 1.0, r + 1.0, d)) * onEdge;
    float lit = dot(normalize(px - c + 0.001), normalize(vec2(-0.7, -0.7)));
    vec3 sc = mix(STONE_DARK, STONE, 0.5 + 0.35 * lit);
    col = mix(col, sc, m);
  }
  // 阿喵坐的那块大青石
  vec2 d = (px - uCat) / vec2(96.0, 62.0);
  float slab = 1.0 - smoothstep(0.95, 1.02, length(d) + (vnoise(px / 30.0) - 0.5) * 0.08);
  float lit = clamp(0.6 - d.y * 0.4 - d.x * 0.2, 0.0, 1.0);
  col = mix(col, mix(STONE_DARK, STONE, lit), slab);
  col *= 0.97 + 0.05 * fbm3(px / 12.0);
  finalColor = vec4(col * inside, inside);
}
`;

export interface CreekTextures {
  bed: RenderTexture;
  bank: RenderTexture;
}

export function renderCreek(
  renderer: Renderer,
  width: number,
  height: number,
  position: FishingPosition,
  cat: { x: number; y: number },
  /** 湖底（淤泥多、石头少、水浑一点）还是溪底 */
  style: 'creek' | 'lake' = 'creek',
): CreekTextures {
  const zones = new Float32Array(MAX_ZONES * 4);
  const types = new Float32Array(MAX_ZONES);
  position.zones.slice(0, MAX_ZONES).forEach((z, i) => {
    zones.set([z.x * width, z.y * height, z.rx * width, z.ry * height], i * 4);
    types[i] = ZONE_CODE[z.type] ?? 0;
  });
  const shade = position.shade
    ? [
        position.shade.x * width,
        position.shade.y * height,
        position.shade.rx * width,
        position.shade.ry * height,
      ]
    : [0, 0, 0, 0];
  const common = {
    uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
    uSeed: { value: position.seed * 0.73, type: 'f32' },
    uBankY: { value: position.bankY * height, type: 'f32' },
  };
  const resolution = Math.min(renderer.resolution, 1.5);

  const bedQuad = createShaderQuad(width, height, BED_FRAGMENT, {
    bedUniforms: {
      ...common,
      uZones: { value: zones, type: 'vec4<f32>', size: MAX_ZONES },
      uZoneTypes: { value: types, type: 'f32', size: MAX_ZONES },
      uZoneCount: { value: Math.min(MAX_ZONES, position.zones.length), type: 'f32' },
      uShade: { value: new Float32Array(shade), type: 'vec4<f32>' },
      uMud: { value: style === 'lake' ? 1 : 0, type: 'f32' },
    },
  });
  const bed = RenderTexture.create({ width, height, resolution });
  renderer.render({ container: bedQuad, target: bed, clear: true });
  bedQuad.destroy();

  const bankQuad = createShaderQuad(width, height, BANK_FRAGMENT, {
    bankUniforms: {
      ...common,
      uCat: { value: new Float32Array([cat.x, cat.y]), type: 'vec2<f32>' },
    },
  });
  const bank = RenderTexture.create({ width, height, resolution });
  renderer.render({ container: bankQuad, target: bank, clear: true, clearColor: [0, 0, 0, 0] });
  bankQuad.destroy();

  return { bed, bank };
}

/** 和着色器里一样的岸线函数，给逻辑判断用（鱼不能游上岸、浮漂不能落在岸上） */
export function bankEdgeY(position: FishingPosition, height: number, _x: number): number {
  // 着色器里的起伏最多 ±22 像素，这里取保守值
  return position.bankY * height - 22;
}
