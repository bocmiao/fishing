/**
 * 从网址参数读取开发和截图用的选项，例如：
 *   /?scene=pond&seed=7&warmup=20&shot=1
 */
export interface LaunchParams {
  /** 启动时进入的画面；不指定就回到存档里的地方（没有存档就在家） */
  scene: string | null;
  /** 随机种子；不填则每次随机 */
  seed: number;
  /** 进入画面前先模拟多少秒（让鱼群自然散开） */
  warmup: number;
  /** 截图模式：固定步长、隐藏鼠标 */
  shot: boolean;
  /** 显示调试信息 */
  debug: boolean;
  /** 不读存档，从头开始（?fresh=1，网页版用 #new） */
  fresh: boolean;
}

export function readLaunchParams(
  search = window.location.search,
  hash = window.location.hash,
): LaunchParams {
  const q = new URLSearchParams(search);
  // 网页版只能用 #fishing 这样的锚点（拿不到网址参数）；#new 表示重新开始
  const hashWord = /^#[a-z]+$/.test(hash) ? hash.slice(1) : null;
  const hashScene = hashWord === 'new' ? null : hashWord;
  const num = (key: string, fallback: number) => {
    const v = q.get(key);
    if (v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    scene: q.get('scene') ?? hashScene,
    seed: num('seed', randomSeed()),
    warmup: num('warmup', 8),
    shot: q.get('shot') === '1',
    debug: q.get('debug') === '1',
    fresh: q.get('fresh') === '1' || hashWord === 'new',
  };
}

/** 没指定种子时随机取一个（只在启动时用一次，游戏里的随机数都来自 Rng） */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % 1_000_000_000;
}
