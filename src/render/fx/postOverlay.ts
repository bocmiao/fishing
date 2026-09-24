import type { Mesh, MeshGeometry, Shader } from 'pixi.js';
import { NOISE_GLSL, createShaderQuad, resizeQuadGeometry } from '../shaderLib';

/**
 * 最上层的画面处理：四角轻微压暗 + 纸张颗粒。
 * 输出是预乘 alpha：rgb 大于 0 表示提亮，alpha 大于 0 表示压暗。
 */
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uSize;
uniform float uVignette;
uniform float uGrain;
uniform vec4 uTint;
${NOISE_GLSL}

void main() {
  vec2 px = vUV * uSize;
  vec2 c = vUV - 0.5;
  c.x *= uSize.x / uSize.y;
  float v = smoothstep(0.45, 1.05, length(c)) * uVignette;
  // 纸张颗粒：高频噪声 + 少量纤维感
  float n = vnoise(px / 1.6) * 0.6 + vnoise(px / 5.0 + 11.0) * 0.4 - 0.5;
  float fiber = vnoise(vec2(px.x / 40.0, px.y / 3.0)) - 0.5;
  n = (n + fiber * 0.35) * uGrain;
  float lighten = max(n, 0.0);
  float darken = max(-n, 0.0);
  // 时段色调：清晨偏暖、黄昏偏橘、夜里偏深蓝
  float a = clamp(uTint.a + v + darken, 0.0, 1.0);
  finalColor = vec4(uTint.rgb * uTint.a + vec3(lighten), a);
}
`;

export class PostOverlay {
  readonly mesh: Mesh<MeshGeometry, Shader>;

  constructor(width: number, height: number, vignette = 0.32, grain = 0.07) {
    this.mesh = createShaderQuad(width, height, FRAGMENT, {
      postUniforms: {
        uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
        uVignette: { value: vignette, type: 'f32' },
        uGrain: { value: grain, type: 'f32' },
        uTint: { value: new Float32Array([0, 0, 0, 0]), type: 'vec4<f32>' },
      },
    });
    this.mesh.eventMode = 'none';
  }

  /** 整体色调（0xRRGGBB 与不透明度） */
  setTint(color: number, alpha: number): void {
    const u = (this.mesh.shader!.resources.postUniforms as { uniforms: { uTint: Float32Array } })
      .uniforms;
    u.uTint.set([
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
      alpha,
    ]);
  }

  resize(width: number, height: number): void {
    resizeQuadGeometry(this.mesh.geometry, width, height);
    const u = (this.mesh.shader!.resources.postUniforms as { uniforms: { uSize: Float32Array } })
      .uniforms;
    u.uSize.set([width, height]);
  }
}
