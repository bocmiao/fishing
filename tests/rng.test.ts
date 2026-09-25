import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/sim/rng/rng';

describe('Rng', () => {
  it('同一个种子得到同样的序列', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.float()).toBe(b.float());
  });

  it('不同种子得到不同的序列', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 8 }, () => a.nextUint32());
    const sb = Array.from({ length: 8 }, () => b.nextUint32());
    expect(sa).not.toEqual(sb);
  });

  it('文字种子与其哈希值等价', () => {
    expect(new Rng('pond').float()).toBe(new Rng(hashString('pond')).float());
  });

  it('float 落在 [0, 1)，分布大致均匀', () => {
    const rng = new Rng(7);
    const buckets = new Array(10).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const x = rng.float();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      buckets[Math.floor(x * 10)]++;
    }
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan((n / 10) * 0.1);
  });

  it('int 包含两端', () => {
    const rng = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('weighted 按权重抽取，忽略 0 权重', () => {
    const rng = new Rng(9);
    const counts = { a: 0, b: 0, c: 0 };
    const items = [
      { id: 'a' as const, w: 1 },
      { id: 'b' as const, w: 3 },
      { id: 'c' as const, w: 0 },
    ];
    for (let i = 0; i < 8000; i++) counts[rng.weighted(items, (x) => x.w)!.id]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.6);
    expect(counts.b / counts.a).toBeLessThan(3.4);
    expect(rng.weighted(items, () => 0)).toBeUndefined();
  });

  it('fork 出的子生成器可复现且彼此独立', () => {
    const a = new Rng(5).fork('fish');
    const b = new Rng(5).fork('fish');
    const c = new Rng(5).fork('cat');
    const first = a.float();
    expect(first).toBe(b.float());
    expect(first).not.toBe(c.float());
  });
});
