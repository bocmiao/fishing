import { Mesh, MeshGeometry, type Texture } from 'pixi.js';

/** 脊柱上的点数，越多身体弯曲越圆滑 */
export const SPINE_POINTS = 14;

/**
 * 沿一条折线铺开的纹理条带：纹理的横向贴在折线上，纵向是宽度。
 * 用来画会弯曲、摆尾的鱼身和鱼影。
 */
export class StripGeometry extends MeshGeometry {
  readonly count: number;

  constructor(count: number) {
    const uvs = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      uvs[i * 4] = u;
      uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 2] = u;
      uvs[i * 4 + 3] = 1;
    }
    const indices = new Uint32Array((count - 1) * 6);
    for (let i = 0, k = 0; i < count - 1; i++) {
      const a = i * 2;
      indices[k++] = a;
      indices[k++] = a + 1;
      indices[k++] = a + 2;
      indices[k++] = a + 2;
      indices[k++] = a + 1;
      indices[k++] = a + 3;
    }
    super({ positions: new Float32Array(count * 4), uvs, indices });
    this.count = count;
  }

  /**
   * 按折线更新顶点。points 为 [x0, y0, x1, y1, ...]，halfWidth 为条带半宽。
   * offsetX / offsetY 用于整体平移（例如鱼影相对鱼身的偏移）。
   */
  setPath(points: Float32Array, halfWidth: number, offsetX = 0, offsetY = 0): void {
    const buffer = this.getBuffer('aPosition');
    const out = buffer.data as Float32Array;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const prev = Math.max(0, i - 1);
      const next = Math.min(n - 1, i + 1);
      let tx = points[next * 2]! - points[prev * 2]!;
      let ty = points[next * 2 + 1]! - points[prev * 2 + 1]!;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // 法线（左侧）
      const nx = -ty * halfWidth;
      const ny = tx * halfWidth;
      const x = points[i * 2]! + offsetX;
      const y = points[i * 2 + 1]! + offsetY;
      out[i * 4] = x + nx;
      out[i * 4 + 1] = y + ny;
      out[i * 4 + 2] = x - nx;
      out[i * 4 + 3] = y - ny;
    }
    buffer.update();
  }
}

export interface SwimPose {
  /** 摆尾相位（弧度） */
  phase: number;
  /** 摆尾幅度（占体长的比例） */
  amplitude: number;
}

/**
 * 一条鱼的身体：一串首尾相连的脊柱点，头部由外部（群游算法）驱动，
 * 身体其余部分像链条一样跟随，再叠加从头到尾传递的摆动波。
 */
export class FishBody {
  readonly mesh: Mesh<StripGeometry>;
  readonly shadow: Mesh<StripGeometry>;
  /** 链条（不含摆动） */
  readonly spine = new Float32Array(SPINE_POINTS * 2);
  /** 最终绘制用的点（含摆动） */
  private readonly drawn = new Float32Array(SPINE_POINTS * 2);
  private readonly segment: number;

  constructor(
    texture: Texture,
    shadowTexture: Texture,
    readonly length: number,
    /** 纹理的宽长比 */
    readonly aspect: number,
  ) {
    this.segment = length / (SPINE_POINTS - 1);
    this.mesh = new Mesh({ geometry: new StripGeometry(SPINE_POINTS), texture });
    this.shadow = new Mesh({ geometry: new StripGeometry(SPINE_POINTS), texture: shadowTexture });
  }

  /** 把身体摆成一条直线：头在 (x, y)，朝向 angle */
  place(x: number, y: number, angle: number): void {
    const dx = -Math.cos(angle) * this.segment;
    const dy = -Math.sin(angle) * this.segment;
    for (let i = 0; i < SPINE_POINTS; i++) {
      this.spine[i * 2] = x + dx * i;
      this.spine[i * 2 + 1] = y + dy * i;
    }
  }

  get headX(): number {
    return this.spine[0]!;
  }

  get headY(): number {
    return this.spine[1]!;
  }

  /** 头移动到新位置，身体跟随；maxBend 限制相邻两节的最大弯折（弧度） */
  follow(x: number, y: number, maxBend = 0.14): void {
    const s = this.spine;
    s[0] = x;
    s[1] = y;
    let prevAngle = 0;
    for (let i = 1; i < SPINE_POINTS; i++) {
      const px = s[(i - 1) * 2]!;
      const py = s[(i - 1) * 2 + 1]!;
      let angle = Math.atan2(s[i * 2 + 1]! - py, s[i * 2]! - px);
      if (i > 1) {
        let d = angle - prevAngle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (d > maxBend) angle = prevAngle + maxBend;
        else if (d < -maxBend) angle = prevAngle - maxBend;
      }
      s[i * 2] = px + Math.cos(angle) * this.segment;
      s[i * 2 + 1] = py + Math.sin(angle) * this.segment;
      prevAngle = angle;
    }
  }

  /**
   * 叠加摆尾后更新网格。
   * scale：整体缩放（越深越小）；shadowOffset：鱼影相对鱼身的偏移。
   */
  draw(pose: SwimPose, scale: number, shadowX: number, shadowY: number): void {
    const s = this.spine;
    const d = this.drawn;
    const n = SPINE_POINTS;
    const hx = s[0]!;
    const hy = s[1]!;
    const amp = pose.amplitude * this.length;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const prev = Math.max(0, i - 1);
      const next = Math.min(n - 1, i + 1);
      let tx = s[next * 2]! - s[prev * 2]!;
      let ty = s[next * 2 + 1]! - s[prev * 2 + 1]!;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // 波从头传到尾，越靠后幅度越大
      const envelope = 0.12 + 0.88 * k * k;
      const wave = Math.sin(pose.phase - k * 5.2) * amp * envelope;
      const x = s[i * 2]! - ty * wave;
      const y = s[i * 2 + 1]! + tx * wave;
      // 以头为中心缩放
      d[i * 2] = hx + (x - hx) * scale;
      d[i * 2 + 1] = hy + (y - hy) * scale;
    }
    const halfWidth = (this.length * this.aspect * scale) / 2;
    this.mesh.geometry.setPath(d, halfWidth);
    this.shadow.geometry.setPath(d, halfWidth * 1.04, shadowX, shadowY);
  }

  destroy(): void {
    this.mesh.destroy();
    this.shadow.destroy();
  }
}
