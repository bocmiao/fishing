import type { Mesh, MeshGeometry, Shader, Texture } from 'pixi.js';
import { NOISE_GLSL, createShaderQuad, resizeQuadGeometry } from '../shaderLib';

/** 同时传给着色器的波纹数量上限 */
export const MAX_SHADER_RIPPLES = 8;

/**
 * 水面：透过水看到的池底 + 焦散光斑 + 缓慢的折射晃动 + 波纹扭曲。
 * 鱼、鱼影、浮在水面的东西都画在它上面。
 */
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uBed;
uniform vec2 uSize;
uniform float uTime;
uniform float uCaustic;
uniform vec4 uRipples[${MAX_SHADER_RIPPLES}];
uniform float uRippleCount;
uniform vec2 uFlow;
uniform float uDim;
${NOISE_GLSL}

// Voronoi：到最近两个点的距离差，差值越小越靠近格子边界
float voronoiEdge(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = length(r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return d2 - d1;
}

void main() {
  vec2 px = vUV * uSize;
  float t = uTime;
  // 有水流时，折射和焦散跟着水流漂
  vec2 fp = px - uFlow * t;

  // 水面缓慢晃动造成的折射
  vec2 wob = vec2(
    vnoise(fp / 190.0 + vec2(t * 0.11, 0.0)),
    vnoise(fp / 190.0 + vec2(3.7, -t * 0.09))
  ) - 0.5;
  vec2 disp = wob * 3.2;

  // 波纹：向外扩散的环，扭曲池底并带一点亮光
  float rippleLight = 0.0;
  for (int i = 0; i < ${MAX_SHADER_RIPPLES}; i++) {
    if (float(i) >= uRippleCount) break;
    vec4 r = uRipples[i];
    vec2 d = px - r.xy;
    float dist = length(d);
    float radius = r.z * 95.0;
    float band = dist - radius;
    float fade = r.w * exp(-r.z * 1.3);
    float wave = sin(band * 0.17) * exp(-abs(band) / 16.0) * fade;
    disp += (d / max(dist, 1.0)) * wave * 5.5;
    rippleLight += wave;
  }

  vec3 col = texture(uBed, clamp((px + disp) / uSize, vec2(0.0), vec2(1.0))).rgb;

  // 焦散：扭曲得很厉害的 Voronoi 边界，稀疏、柔和、成片出现又消失
  vec2 cp = fp / 340.0;
  cp += 0.75 * vec2(fbm3(cp * 0.55 + vec2(t * 0.03, 0.0)), fbm3(cp * 0.55 + vec2(7.3, -t * 0.025)));
  float e1 = voronoiEdge(cp, t * 0.22);
  float e2 = voronoiEdge(cp * 2.1 + 5.3, t * 0.3);
  float c1 = 1.0 - smoothstep(0.0, 0.04, e1);
  float c2 = 1.0 - smoothstep(0.0, 0.025, e2);
  float caustic = c1 * 0.75 + c2 * 0.18;
  caustic *= smoothstep(0.28, 0.78, vnoise(px / 560.0 + vec2(t * 0.018, -t * 0.012)));
  col += caustic * uCaustic * vec3(0.88, 0.98, 0.92);

  col += rippleLight * 0.04;
  col *= 1.0 - uDim;
  finalColor = vec4(col, 1.0);
}
`;

export interface Ripple {
  x: number;
  y: number;
  /** 已经过去的秒数 */
  age: number;
  /** 0~1 */
  strength: number;
}

export class WaterSurface {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  private readonly rippleData = new Float32Array(MAX_SHADER_RIPPLES * 4);
  private time = 0;

  constructor(bed: Texture, width: number, height: number, causticStrength = 0.13) {
    this.mesh = createShaderQuad(width, height, FRAGMENT, {
      uBed: bed.source,
      waterUniforms: {
        uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
        uTime: { value: 0, type: 'f32' },
        uCaustic: { value: causticStrength, type: 'f32' },
        uRipples: { value: this.rippleData, type: 'vec4<f32>', size: MAX_SHADER_RIPPLES },
        uRippleCount: { value: 0, type: 'f32' },
        uFlow: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
        uDim: { value: 0, type: 'f32' },
      },
    });
  }

  private get uniforms(): Record<string, unknown> {
    return (this.mesh.shader!.resources.waterUniforms as { uniforms: Record<string, unknown> })
      .uniforms;
  }

  /** 水流方向和速度（像素 / 秒） */
  setFlow(x: number, y: number): void {
    (this.uniforms.uFlow as Float32Array).set([x, y]);
  }

  /** 整体压暗（阴雨天） */
  setDim(amount: number): void {
    this.uniforms.uDim = amount;
  }

  /** 焦散强度（阴雨天减弱） */
  setCaustic(strength: number): void {
    this.uniforms.uCaustic = strength;
  }

  setBed(bed: Texture): void {
    this.mesh.shader!.resources.uBed = bed.source;
  }

  resize(width: number, height: number): void {
    resizeQuadGeometry(this.mesh.geometry, width, height);
    (this.uniforms.uSize as Float32Array).set([width, height]);
  }

  /** 每帧调用：推进时间，并传入最新的波纹（最多 MAX_SHADER_RIPPLES 个） */
  update(dt: number, ripples: readonly Ripple[]): void {
    this.time += dt;
    const u = this.uniforms;
    u.uTime = this.time;
    const count = Math.min(ripples.length, MAX_SHADER_RIPPLES);
    // 取最新的几个
    const start = ripples.length - count;
    for (let i = 0; i < count; i++) {
      const r = ripples[start + i]!;
      this.rippleData[i * 4] = r.x;
      this.rippleData[i * 4 + 1] = r.y;
      this.rippleData[i * 4 + 2] = r.age;
      this.rippleData[i * 4 + 3] = r.strength;
    }
    u.uRippleCount = count;
  }
}
