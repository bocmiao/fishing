/**
 * 可设种子的随机数生成器（sfc32）。
 *
 * 逻辑层和渲染层都用它，不直接调用 Math.random()，这样同一个种子总能得到同样的结果：
 * 测试可复现、截图可复现、数值模拟可复现。
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string = 1) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    // 用 splitmix32 把一个种子扩展成四个状态字
    let x = s;
    const next = () => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    // 预热，消除初始状态的相关性
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  /** 32 位无符号整数 */
  nextUint32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** [0, 1) 的浮点数 */
  float(): number {
    return this.nextUint32() / 4294967296;
  }

  /** [min, max) 的浮点数 */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** [min, max] 的整数（包含两端） */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** 以概率 p 返回 true */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** 从数组里随机取一个 */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[Math.floor(this.float() * items.length)] as T;
  }

  /** 按权重随机取一个；权重全为 0 时返回 undefined */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return undefined;
    let r = this.float() * total;
    for (const item of items) {
      r -= Math.max(0, weight(item));
      if (r < 0) return item;
    }
    return items[items.length - 1];
  }

  /** 标准正态分布（Box-Muller） */
  normal(mean = 0, stdDev = 1): number {
    let u = 0;
    while (u === 0) u = this.float();
    const v = this.float();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** 派生一个独立的子生成器（例如每条鱼一个）。会消耗本生成器的一个随机数 */
  fork(label: string | number = 0): Rng {
    const salt = typeof label === 'string' ? hashString(label) : label >>> 0;
    return new Rng((this.nextUint32() ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
  }
}

/** 字符串哈希（FNV-1a），用于把文字种子转成数字 */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
