import type { Rng } from '../rng/rng';

export interface CookingStep {
  name: string;
  /** 指针来回一趟每秒几次 */
  speed: number;
  /** 好区的宽度（0~1） */
  zone: number;
}

/**
 * 做菜小游戏：切配 → 掂锅 → 装盘，每一步指针在条上来回走，在好区里按下空格（或点一下）。
 * 按在好区正中是 1 分，好区边上 0.5 分，偏了也有 0.25 分——菜总能做出来，只是好吃的程度不同。
 */
export class CookingGame {
  step = 0;
  /** 指针位置 0~1 */
  pointer = 0;
  private dir = 1;
  zoneCenter = 0.5;
  readonly results: number[] = [];

  constructor(
    readonly steps: CookingStep[],
    private readonly rng: Rng,
  ) {
    this.newZone();
  }

  get current(): CookingStep | null {
    return this.steps[this.step] ?? null;
  }

  get done(): boolean {
    return this.step >= this.steps.length;
  }

  get zone(): [number, number] {
    const half = (this.current?.zone ?? 0) / 2;
    return [this.zoneCenter - half, this.zoneCenter + half];
  }

  /** 平均成绩 0~1 */
  get quality(): number {
    return this.results.length === 0
      ? 0
      : this.results.reduce((a, b) => a + b, 0) / this.results.length;
  }

  update(dt: number): void {
    const step = this.current;
    if (!step) return;
    this.pointer += this.dir * step.speed * 2 * dt;
    if (this.pointer > 1) {
      this.pointer = 2 - this.pointer;
      this.dir = -1;
    } else if (this.pointer < 0) {
      this.pointer = -this.pointer;
      this.dir = 1;
    }
  }

  /** 按下：记这一步的成绩，进入下一步。返回这一步的分数 */
  hit(): number {
    const step = this.current;
    if (!step) return 0;
    const d = Math.abs(this.pointer - this.zoneCenter) / (step.zone / 2);
    const score = d <= 1 ? 1 - 0.5 * d : 0.25;
    this.results.push(score);
    this.step++;
    this.newZone();
    return score;
  }

  private newZone(): void {
    const step = this.current;
    if (!step) return;
    const half = step.zone / 2;
    this.zoneCenter = this.rng.range(half + 0.08, 1 - half - 0.08);
    // 每一步从离好区远的那一头开始走
    this.pointer = this.zoneCenter > 0.5 ? 0 : 1;
    this.dir = this.pointer === 0 ? 1 : -1;
  }
}
