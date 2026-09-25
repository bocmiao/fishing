/**
 * 游戏时钟。
 *
 * 一天从 6:00 开始，到次日 2:00（记作 26:00）结束，之后自动睡觉进入下一天。
 * 默认 1 游戏分钟 = 0.75 现实秒，一天约 15 分钟。
 */

export const DAY_START_MINUTE = 6 * 60;
export const DAY_END_MINUTE = 26 * 60;
export const DAYS_PER_SEASON = 14;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];
export type DayPeriod = 'morning' | 'day' | 'dusk' | 'night';

export const SEASON_NAMES: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

export interface ClockState {
  /** 从 0 开始的天数（第 1 天 = 0） */
  day: number;
  /** 当天从 0:00 起算的分钟数，范围 [DAY_START_MINUTE, DAY_END_MINUTE] */
  minute: number;
}

export interface ClockOptions {
  /** 1 游戏分钟对应多少现实秒 */
  realSecondsPerGameMinute: number;
}

export const DEFAULT_CLOCK_OPTIONS: ClockOptions = { realSecondsPerGameMinute: 0.75 };

export interface ClockAdvanceResult {
  /** 本次推进是否走到了一天的尽头（需要睡觉结算） */
  reachedDayEnd: boolean;
}

export class GameClock {
  private state: ClockState;
  private options: ClockOptions;
  /** 不足 1 游戏分钟的零头（现实秒） */
  private carry = 0;
  paused = false;

  constructor(
    state: ClockState = { day: 0, minute: DAY_START_MINUTE },
    options = DEFAULT_CLOCK_OPTIONS,
  ) {
    this.state = { ...state };
    this.options = { ...options };
  }

  get day(): number {
    return this.state.day;
  }

  get minute(): number {
    return this.state.minute;
  }

  /** 0~23 的小时（26:00 显示为 2 点） */
  get hour(): number {
    return Math.floor(this.state.minute / 60) % 24;
  }

  get season(): Season {
    return SEASONS[Math.floor(this.state.day / DAYS_PER_SEASON) % SEASONS.length] as Season;
  }

  /** 本季第几天，从 1 开始 */
  get dayOfSeason(): number {
    return (this.state.day % DAYS_PER_SEASON) + 1;
  }

  /** 第几年，从 1 开始 */
  get year(): number {
    return Math.floor(this.state.day / (DAYS_PER_SEASON * SEASONS.length)) + 1;
  }

  get period(): DayPeriod {
    return periodOf(this.state.minute);
  }

  /** 当天进度 0~1 */
  get dayProgress(): number {
    return (this.state.minute - DAY_START_MINUTE) / (DAY_END_MINUTE - DAY_START_MINUTE);
  }

  get isDayOver(): boolean {
    return this.state.minute >= DAY_END_MINUTE;
  }

  snapshot(): ClockState {
    return { ...this.state };
  }

  /** 读档时用 */
  set(state: ClockState): void {
    this.state = {
      day: Math.max(0, Math.floor(state.day)),
      minute: Math.max(DAY_START_MINUTE, Math.min(DAY_END_MINUTE, state.minute)),
    };
    this.carry = 0;
  }

  /** 按现实时间推进。走到 26:00 会停住，等待 sleep() */
  advance(realSeconds: number): ClockAdvanceResult {
    if (this.paused || this.isDayOver || realSeconds <= 0) return { reachedDayEnd: false };
    this.carry += realSeconds;
    const minutes = Math.floor(this.carry / this.options.realSecondsPerGameMinute);
    if (minutes <= 0) return { reachedDayEnd: false };
    this.carry -= minutes * this.options.realSecondsPerGameMinute;
    return this.addMinutes(minutes);
  }

  /** 直接加游戏分钟（切换钓位、赶路、打盹等） */
  addMinutes(minutes: number): ClockAdvanceResult {
    if (this.isDayOver) return { reachedDayEnd: false };
    this.state.minute = Math.min(DAY_END_MINUTE, this.state.minute + Math.max(0, minutes));
    return { reachedDayEnd: this.isDayOver };
  }

  /** 睡觉：进入下一天 6:00 */
  sleep(): void {
    this.state = { day: this.state.day + 1, minute: DAY_START_MINUTE };
    this.carry = 0;
  }

  setSpeed(realSecondsPerGameMinute: number): void {
    this.options.realSecondsPerGameMinute = Math.max(0.01, realSecondsPerGameMinute);
  }

  /** 例如 "7:05" */
  formatTime(): string {
    return formatClock(this.state.minute);
  }
}

export function periodOf(minute: number): DayPeriod {
  const m = minute % (24 * 60);
  if (m >= 5 * 60 && m < 8 * 60) return 'morning';
  if (m >= 8 * 60 && m < 17 * 60) return 'day';
  if (m >= 17 * 60 && m < 19 * 60) return 'dusk';
  return 'night';
}

export function formatClock(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.floor(minute % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
