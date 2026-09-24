import { describe, expect, it } from 'vitest';
import {
  DAY_END_MINUTE,
  DAY_START_MINUTE,
  DAYS_PER_SEASON,
  GameClock,
  formatClock,
  periodOf,
} from '../src/sim/time/clock';

describe('GameClock', () => {
  it('从第 1 天 6:00 开始', () => {
    const clock = new GameClock();
    expect(clock.day).toBe(0);
    expect(clock.formatTime()).toBe('6:00');
    expect(clock.season).toBe('spring');
    expect(clock.dayOfSeason).toBe(1);
    expect(clock.year).toBe(1);
  });

  it('默认一天约 15 分钟现实时间', () => {
    const clock = new GameClock();
    const realSeconds = (DAY_END_MINUTE - DAY_START_MINUTE) * 0.75;
    expect(realSeconds / 60).toBe(15);
    clock.advance(realSeconds - 1);
    expect(clock.isDayOver).toBe(false);
    const result = clock.advance(1);
    expect(result.reachedDayEnd).toBe(true);
    expect(clock.isDayOver).toBe(true);
  });

  it('小于 1 游戏分钟的时间会累积', () => {
    const clock = new GameClock();
    for (let i = 0; i < 4; i++) clock.advance(0.25);
    expect(clock.minute).toBe(DAY_START_MINUTE + 1);
  });

  it('到 26:00 停住，睡觉后进入下一天 6:00', () => {
    const clock = new GameClock({ day: 3, minute: DAY_END_MINUTE - 5 });
    clock.addMinutes(60);
    expect(clock.minute).toBe(DAY_END_MINUTE);
    expect(clock.formatTime()).toBe('2:00');
    clock.advance(100);
    expect(clock.minute).toBe(DAY_END_MINUTE);
    clock.sleep();
    expect(clock.day).toBe(4);
    expect(clock.minute).toBe(DAY_START_MINUTE);
  });

  it('暂停时不走', () => {
    const clock = new GameClock();
    clock.paused = true;
    clock.advance(100);
    expect(clock.minute).toBe(DAY_START_MINUTE);
  });

  it('季节和年份按天数计算', () => {
    expect(new GameClock({ day: DAYS_PER_SEASON, minute: 600 }).season).toBe('summer');
    expect(new GameClock({ day: DAYS_PER_SEASON * 3 + 13, minute: 600 }).season).toBe('winter');
    const nextYear = new GameClock({ day: DAYS_PER_SEASON * 4, minute: 600 });
    expect(nextYear.season).toBe('spring');
    expect(nextYear.year).toBe(2);
  });

  it('时段划分', () => {
    expect(periodOf(6 * 60)).toBe('morning');
    expect(periodOf(12 * 60)).toBe('day');
    expect(periodOf(18 * 60)).toBe('dusk');
    expect(periodOf(22 * 60)).toBe('night');
    expect(periodOf(25 * 60)).toBe('night');
  });

  it('时间格式', () => {
    expect(formatClock(6 * 60 + 5)).toBe('6:05');
    expect(formatClock(25 * 60 + 30)).toBe('1:30');
  });
});
