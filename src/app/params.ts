/**
 * 从网址参数读取开发和截图用的选项，例如：
 *   /?scene=pond&seed=7&warmup=20&shot=1
 */
export interface LaunchParams {
  /** 启动时进入的画面 */
  scene: string;
  /** 随机种子；不填则每次随机 */
  seed: number;
  /** 进入画面前先模拟多少秒（让鱼群自然散开） */
  warmup: number;
  /** 截图模式：固定步长、隐藏鼠标 */
  shot: boolean;
  /** 显示调试信息 */
  debug: boolean;
}

export function readLaunchParams(search = window.location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const num = (key: string, fallback: number) => {
    const v = q.get(key);
    if (v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    scene: q.get('scene') ?? 'pond',
    seed: num('seed', Math.floor(Math.random() * 1e9)),
    warmup: num('warmup', 8),
    shot: q.get('shot') === '1',
    debug: q.get('debug') === '1',
  };
}
