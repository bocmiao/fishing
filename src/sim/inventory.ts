/**
 * 库存：饵料、作物、加工品、种子都按 id 记数量。
 * 种子的 id 是 "seed:作物id"（见 gameData.seedId）。
 */
export class Inventory {
  private readonly counts = new Map<string, number>();

  constructor(initial: Record<string, number> = {}) {
    for (const [id, n] of Object.entries(initial)) this.add(id, n);
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0;
  }

  add(id: string, n = 1): void {
    if (n <= 0) return;
    this.counts.set(id, this.count(id) + Math.floor(n));
  }

  /** 拿走 n 个；不够就一个也不拿，返回 false */
  take(id: string, n = 1): boolean {
    if (this.count(id) < n) return false;
    const left = this.count(id) - n;
    if (left > 0) this.counts.set(id, left);
    else this.counts.delete(id);
    return true;
  }

  hasAll(req: Record<string, number>): boolean {
    return Object.entries(req).every(([id, n]) => this.count(id) >= n);
  }

  /** 按清单一起拿走；缺任何一样都不拿 */
  takeAll(req: Record<string, number>): boolean {
    if (!this.hasAll(req)) return false;
    for (const [id, n] of Object.entries(req)) this.take(id, n);
    return true;
  }

  /** 数量大于 0 的东西 */
  entries(): [string, number][] {
    return [...this.counts.entries()].filter(([, n]) => n > 0);
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.entries());
  }
}
