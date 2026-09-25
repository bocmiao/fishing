import { RenderTexture, type Renderer } from 'pixi.js';
import { PALETTE, glslVec3 } from '../palette';
import { NOISE_GLSL, createShaderQuad } from '../shaderLib';

/**
 * 喵记小馆的地面（俯视）：一条条长短不一的木地板，最上面是墙（两扇纸窗、左边是门），
 * 墙根有一道影子。程序生成的占位图，美术指南 SCENE-003 到位后换成图片。
 */
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uSize;
uniform float uSeed;
uniform float uWallH;
uniform vec2 uDoor;
${NOISE_GLSL}

const vec3 WOOD_LIGHT = ${glslVec3(PALETTE.woodLight)};
const vec3 WOOD = ${glslVec3(PALETTE.wood)};
const vec3 WOOD_DARK = ${glslVec3(PALETTE.woodDark)};
const vec3 WOOD_SHADOW = ${glslVec3(PALETTE.woodShadow)};
const vec3 PAPER = ${glslVec3(PALETTE.paper)};
const vec3 GLOW = ${glslVec3(PALETTE.lanternGlow)};
const vec3 NIGHT = ${glslVec3(PALETTE.waterDeep)};

void main() {
  vec2 px = vUV * uSize;
  // 地板：每条 58 像素宽，横向分成长短不一的几段
  float plankH = 58.0;
  float row = floor(px.y / plankH);
  float segLen = 380.0 + 160.0 * hash12(vec2(row, 3.1 + uSeed));
  float offset = hash12(vec2(row, 7.7 + uSeed)) * segLen;
  float seg = floor((px.x + offset) / segLen);
  float tone = hash12(vec2(row, seg) + uSeed);
  vec3 col = mix(WOOD, WOOD_LIGHT, 0.25 + 0.6 * tone);
  // 木纹：沿着板子方向拉长的噪声
  float grain = fbm(vec2((px.x + offset) / 90.0, px.y / 7.0) + vec2(seg * 3.1, row * 1.7));
  col *= 0.9 + 0.2 * grain;
  // 板缝
  float fy = mod(px.y, plankH);
  float fx = mod(px.x + offset, segLen);
  float gap = max(1.0 - smoothstep(0.0, 2.5, fy), 1.0 - smoothstep(0.0, 2.0, min(fx, segLen - fx)));
  col = mix(col, WOOD_SHADOW, gap * 0.8);

  // 墙
  if (px.y < uWallH) {
    vec3 wall = mix(WOOD_DARK, WOOD, 0.25 + 0.15 * fbm(vec2(px.x / 200.0, px.y / 30.0) + 5.0));
    // 竖着的木板墙
    float board = mod(px.x, 96.0);
    wall = mix(wall, WOOD_SHADOW, (1.0 - smoothstep(0.0, 3.0, min(board, 96.0 - board))) * 0.7);
    // 两扇纸窗，透出一点暖光
    for (int i = 0; i < 2; i++) {
      float cx = uSize.x * (i == 0 ? 0.36 : 0.6);
      vec2 d = abs(px - vec2(cx, uWallH * 0.48)) - vec2(120.0, uWallH * 0.3);
      float win = 1.0 - smoothstep(-1.0, 1.0, max(d.x, d.y));
      // 窗格
      float lat = step(0.92, fract((px.x - cx) / 40.0)) + step(0.9, fract(px.y / 22.0));
      vec3 paper = mix(PAPER, GLOW, 0.35) * (1.0 - clamp(lat, 0.0, 1.0) * 0.35);
      wall = mix(wall, paper, win);
    }
    // 门：一个开口，外面是夜色
    vec2 dd = abs(px - vec2(uDoor.x, uWallH * 0.5)) - vec2(uDoor.y * 0.5, uWallH * 0.5 + 2.0);
    float door = 1.0 - smoothstep(-1.0, 1.0, max(dd.x, dd.y));
    wall = mix(wall, NIGHT * 0.8, door);
    col = wall;
  }
  // 墙根的影子
  float shade = 1.0 - smoothstep(uWallH, uWallH + 40.0, px.y);
  if (px.y >= uWallH) col *= 1.0 - shade * 0.35;
  // 暖光从中间往四周暗下去
  vec2 c = vUV - vec2(0.5, 0.55);
  col *= 1.0 - dot(c, c) * 0.5;
  col *= 0.97 + 0.05 * fbm3(px / 24.0 + 1.3);
  finalColor = vec4(col, 1.0);
}
`;

export function renderEateryFloor(
  renderer: Renderer,
  width: number,
  height: number,
  wallHeight: number,
  door: { x: number; width: number },
  seed: number,
): RenderTexture {
  const quad = createShaderQuad(width, height, FRAGMENT, {
    floorUniforms: {
      uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uSeed: { value: (seed % 1000) * 0.37, type: 'f32' },
      uWallH: { value: wallHeight, type: 'f32' },
      uDoor: { value: new Float32Array([door.x, door.width]), type: 'vec2<f32>' },
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
