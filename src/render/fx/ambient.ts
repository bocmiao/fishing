import type { Weather } from '../../sim/data/schema';

export interface Ambient {
  /** 叠在画面上的色调 */
  tint: number;
  tintAlpha: number;
  /** 水面压暗 0~1 */
  dim: number;
  /** 焦散强度 */
  caustic: number;
  /** 雨点密度（每秒） */
  rain: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** 按一天中的时间（分钟，6:00 = 360，次日 2:00 = 1560）和天气，给出画面氛围 */
export function ambientAt(minute: number, weather: Weather): Ambient {
  let tint = 0x000000;
  let tintAlpha = 0;
  let night = 0;
  if (minute < 7 * 60) {
    // 清晨：淡淡的暖光
    tint = 0xffd9a8;
    tintAlpha = lerp(0.1, 0, (minute - 6 * 60) / 60);
  } else if (minute >= 17 * 60 && minute < 19 * 60) {
    tint = 0xff9f5e;
    tintAlpha = lerp(0, 0.14, (minute - 17 * 60) / 90);
  } else if (minute >= 19 * 60) {
    tint = 0x0c1a2e;
    night = lerp(0, 1, (minute - 19 * 60) / 60);
    tintAlpha = 0.52 * night;
  }
  const weatherDim = weather === 'rain' ? 0.12 : weather === 'cloudy' ? 0.05 : 0;
  const weatherCaustic = weather === 'rain' ? 0.03 : weather === 'cloudy' ? 0.07 : 0.13;
  return {
    tint,
    tintAlpha,
    dim: weatherDim,
    caustic: weatherCaustic * (1 - night * 0.8),
    rain: weather === 'rain' ? 42 : 0,
  };
}
