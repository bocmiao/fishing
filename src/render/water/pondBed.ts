import { RenderTexture, type Renderer } from 'pixi.js';
import { glslVec3 } from '../palette';
import { NOISE_GLSL, createShaderQuad } from '../shaderLib';

/**
 * 程序生成的占位池底：青苔斑块、沙地、石头、边缘更深。
 * 正式的池底图（美术指南 BG-001）到位后，换成图片即可，水面着色器不用改。
 */
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uSize;
uniform float uSeed;
${NOISE_GLSL}

const vec3 BASE = ${glslVec3(0x6a9a84)};
const vec3 LIGHT = ${glslVec3(0x8aab92)};
const vec3 DARK = ${glslVec3(0x4a7a6a)};
const vec3 DEEP = ${glslVec3(0x33584e)};
const vec3 STONE_DARK = ${glslVec3(0x44695c)};
const vec3 STONE_LIGHT = ${glslVec3(0x7c9a8a)};
const vec3 MOSS = ${glslVec3(0x557f5f)};

void main() {
  vec2 px = vUV * uSize;
  vec2 p = px / 460.0 + uSeed;

  // 大尺度的扭曲噪声，形成有机的斑块
  vec2 q = vec2(fbm(p + vec2(1.7, 9.2)), fbm(p + vec2(8.3, 2.8)));
  float n = fbm(p + 1.9 * q);
  float n2 = fbm(px / 150.0 + q * 2.0 + 13.1 + uSeed);
  float n3 = fbm3(px / 36.0 + 3.7 + uSeed);

  vec3 col = BASE;
  // 沙地（偏亮）
  float sand = 1.0 - smoothstep(0.3, 0.4, n);
  col = mix(col, LIGHT, sand * 0.42);
  // 藻斑（偏暗），边缘有水彩晕染的深色边
  float algae = smoothstep(0.53, 0.61, n);
  col = mix(col, DARK, algae * (0.6 + 0.4 * n2));
  float algaeEdge = smoothstep(0.50, 0.555, n) * (1.0 - smoothstep(0.555, 0.63, n));
  col *= 1.0 - algaeEdge * 0.06;
  // 中尺度斑驳
  col *= 0.93 + 0.14 * n2;

  // 石头：稀疏的网格，每格小概率有一块
  float cell = 170.0;
  vec2 gi = floor(px / cell);
  float shadow = 0.0;
  float stoneMask = 0.0;
  vec3 stoneCol = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 c = gi + vec2(float(x), float(y));
      if (hash12(c + uSeed * 3.1) > 0.14) continue;
      vec2 center = (c + 0.2 + 0.6 * hash22(c + uSeed)) * cell;
      float r = mix(13.0, 34.0, hash12(c * 1.7 + 4.2));
      float ang = hash12(c + 9.1) * 6.2831;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 d = px - center;
      vec2 dr = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y) / vec2(1.0, 0.74);
      float wob = (vnoise(dr / r * 1.8 + c * 5.0) - 0.5) * 0.35 * r;
      float sd = length(dr) - r - wob;
      vec2 ds = d - vec2(6.0, 7.0);
      vec2 dsr = vec2(ca * ds.x - sa * ds.y, sa * ds.x + ca * ds.y) / vec2(1.0, 0.74);
      float sds = length(dsr) - r - wob;
      shadow = max(shadow, 1.0 - smoothstep(-5.0, 11.0, sds));
      float m = 1.0 - smoothstep(-1.2, 1.2, sd);
      if (m > stoneMask) {
        vec2 nrm = normalize(d + 1e-4);
        float lit = dot(nrm, normalize(vec2(-0.7, -0.75)));
        float rim = smoothstep(-0.7 * r, 0.0, sd);
        vec3 sc = mix(STONE_DARK, STONE_LIGHT, 0.4 + 0.3 * lit * rim + 0.25 * vnoise(px / 8.0));
        float moss = smoothstep(0.42, 0.68, fbm3(px / 20.0 + c));
        sc = mix(sc, MOSS, moss * 0.55);
        stoneCol = sc;
        stoneMask = m;
      }
    }
  }
  col *= 1.0 - shadow * 0.16;
  col = mix(col, stoneCol, stoneMask * 0.9);

  // 池塘边缘：更深、青苔更密
  float edgeDist = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
  float edge = 1.0 - smoothstep(0.0, 240.0, edgeDist + (n2 - 0.5) * 180.0);
  col = mix(col, DEEP, edge * 0.65);

  // 左上方光线稍亮
  col *= 0.96 + 0.08 * (1.0 - clamp(vUV.x * 0.5 + vUV.y * 0.6, 0.0, 1.0));
  // 细颗粒（纸张 / 水彩质感）
  col *= 0.975 + 0.05 * n3;
  finalColor = vec4(col, 1.0);
}
`;

export function renderProceduralPondBed(
  renderer: Renderer,
  width: number,
  height: number,
  seed: number,
): RenderTexture {
  const quad = createShaderQuad(width, height, FRAGMENT, {
    bedUniforms: {
      uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uSeed: { value: (seed % 1000) * 0.37, type: 'f32' },
    },
  });
  const texture = RenderTexture.create({
    width,
    height,
    resolution: Math.min(renderer.resolution, 1.5),
    antialias: false,
  });
  renderer.render({ container: quad, target: texture, clear: true });
  quad.destroy();
  return texture;
}
