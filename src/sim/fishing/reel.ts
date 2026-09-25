/**
 * 渔轮：把"连按空格"换算成收线力度。
 * 每按一下给渔轮加一把劲，劲头随时间衰减；按得越快，力度越接近 1。
 * 按默认参数：每秒 5 下约 0.6，7 下约 0.8，9 下以上接近满力。
 */
export interface CrankParams {
  /** 每按一下增加的力度 */
  impulse: number;
  /** 力度每秒衰减的速率 */
  decay: number;
}

export const DEFAULT_CRANK: CrankParams = { impulse: 0.3, decay: 2.6 };

export class ReelCrank {
  private energy = 0;
  private readonly params: CrankParams;

  constructor(params: Partial<CrankParams> = {}) {
    this.params = { ...DEFAULT_CRANK, ...params };
  }

  press(): void {
    this.energy = Math.min(1.25, this.energy + this.params.impulse);
  }

  update(dt: number): void {
    this.energy *= Math.exp(-this.params.decay * dt);
  }

  /** 当前收线力度 0~1 */
  get intensity(): number {
    return Math.min(1, this.energy);
  }

  reset(): void {
    this.energy = 0;
  }
}
