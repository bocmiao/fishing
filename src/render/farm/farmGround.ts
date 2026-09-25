import { RenderTexture, type Renderer } from 'pixi.js';
import { PALETTE, glslVec3 } from '../palette';
import { NOISE_GLSL, createShaderQuad } from '../shaderLib';

/**
 * 菜地画面的地面（俯视）：草地，中间一大块压实的泥土地（地块画在上面），
 * 底部一条小路通到阿喵坐的地头。程序生成的占位图，美术指南 BG-020 到位后换成图片。
 */
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uSize;
uniform float uSeed;
uniform vec4 uField;
uniform vec2 uCat;
${NOISE_GLSL}

const vec3 GRASS = ${glslVec3(PALETTE.grass)};
const vec3 GRASS_LIGHT = ${glslVec3(PALETTE.grassLight)};
const vec3 GRASS_DARK = ${glslVec3(PALETTE.grassDark)};
const vec3 EARTH = ${glslVec3(PALETTE.soilDry)};
const vec3 EARTH_DARK = ${glslVec3(PALETTE.soil)};

// 到圆角矩形边缘的距离（里面为负）
float roundRect(vec2 p, vec2 center, vec2 halfSize, float r) {
  vec2 q = abs(p - center) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = vUV * uSize;
  // 俯视的草：两个方向交叉的短草叶，不要一个方向的长条（像下雨）
  vec2 r1 = mat2(0.8, -0.6, 0.6, 0.8) * px;
  vec2 r2 = mat2(0.8, 0.6, -0.6, 0.8) * px;
  float blades = max(vnoise(vec2(r1.x / 2.6, r1.y / 6.0)), vnoise(vec2(r2.x / 2.6, r2.y / 6.0) + 17.0));
  float patches = fbm(px / 110.0 + uSeed);
  vec3 col = mix(GRASS_DARK, GRASS, smoothstep(0.25, 0.72, patches));
  col = mix(col, GRASS_LIGHT, smoothstep(0.72, 0.95, blades) * 0.35);
  col *= 0.94 + 0.08 * vnoise(px / 7.0);
  // 零星的三叶草小团
  vec2 cell = floor(px / 46.0);
  vec2 c = (cell + 0.2 + 0.6 * hash22(cell + uSeed)) * 46.0;
  float clover = 1.0 - smoothstep(4.0, 7.0, length(px - c) + (vnoise(px / 3.0) - 0.5) * 4.0);
  col = mix(col, GRASS_LIGHT * 1.05, clover * step(hash12(cell + 3.3), 0.25) * 0.7);

  // 地块外面一圈压实的泥土，边缘不规则
  vec2 center = uField.xy + uField.zw * 0.5;
  float wobble = (fbm(px / 60.0 + uSeed * 1.3) - 0.5) * 36.0;
  float field = roundRect(px, center, uField.zw * 0.5 + 34.0, 40.0) + wobble;
  // 地头的小路：从地块下沿通到阿喵那里
  float path = abs(px.x - uCat.x - sin(px.y / 90.0) * 14.0) - 70.0 + wobble * 0.6;
  path = max(path, uField.y + uField.w - px.y);
  float seat = length((px - uCat) / vec2(150.0, 90.0)) * 100.0 - 100.0 + wobble;
  float earth = min(min(field, path), seat);
  float e = 1.0 - smoothstep(-4.0, 4.0, earth);
  vec3 dirt = mix(EARTH_DARK, EARTH, 0.55 + 0.45 * fbm(px / 40.0 + 7.0));
  dirt *= 0.94 + 0.1 * vnoise(px / 5.0);
  col = mix(col, dirt, e);
  // 泥土和草的交界处有一圈深一点的草根
  float rim = (1.0 - smoothstep(0.0, 14.0, abs(earth))) * (1.0 - e);
  col = mix(col, GRASS_DARK, rim * 0.35);

  // 左上方光线稍亮 + 细颗粒
  col *= 0.95 + 0.08 * (1.0 - clamp(vUV.x * 0.5 + vUV.y * 0.6, 0.0, 1.0));
  col *= 0.975 + 0.05 * fbm3(px / 26.0 + 3.7);
  finalColor = vec4(col, 1.0);
}
`;

export interface FieldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function renderFarmGround(
  renderer: Renderer,
  width: number,
  height: number,
  field: FieldRect,
  cat: { x: number; y: number },
  seed: number,
): RenderTexture {
  const quad = createShaderQuad(width, height, FRAGMENT, {
    groundUniforms: {
      uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uSeed: { value: (seed % 1000) * 0.37, type: 'f32' },
      uField: { value: new Float32Array([field.x, field.y, field.w, field.h]), type: 'vec4<f32>' },
      uCat: { value: new Float32Array([cat.x, cat.y]), type: 'vec2<f32>' },
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
