import { Mesh, MeshGeometry, Shader } from 'pixi.js';

/**
 * 全屏（或任意矩形）着色器网格的公共部分。
 * PixiJS v8 会自动提供 uProjectionMatrix、uWorldTransformMatrix、uTransformMatrix。
 */
export const QUAD_VERTEX = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

/** 常用的哈希和噪声函数 */
export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
`;

/** 一个 width × height 的矩形网格，左上角在 (0, 0)，UV 从 0 到 1 */
export function createQuadGeometry(width: number, height: number): MeshGeometry {
  return new MeshGeometry({
    positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
}

/** 改变矩形网格的尺寸 */
export function resizeQuadGeometry(geometry: MeshGeometry, width: number, height: number): void {
  const buffer = geometry.getBuffer('aPosition');
  buffer.data = new Float32Array([0, 0, width, 0, width, height, 0, height]);
  buffer.update();
}

export function createShaderQuad(
  width: number,
  height: number,
  fragment: string,
  resources: Record<string, unknown>,
): Mesh<MeshGeometry, Shader> {
  const shader = Shader.from({
    gl: { vertex: QUAD_VERTEX, fragment },
    resources,
  });
  return new Mesh({ geometry: createQuadGeometry(width, height), shader });
}
