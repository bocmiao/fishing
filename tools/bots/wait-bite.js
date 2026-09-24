// 截图脚本用：一直等到咬钩就提竿（最多 maxSeconds 秒游戏时间）
(maxSeconds = 90) => {
  const g = window.__game;
  const sc = g.scene;
  for (let i = 0; i < maxSeconds * 10; i++) {
    for (let k = 0; k < 6; k++) sc.update(1 / 60);
    const phase = sc.debugInfo().phase;
    if (phase === 'bite') {
      sc.press(true);
      sc.press(false);
      g.game.app.render();
      return `strike after ${(i / 10).toFixed(1)}s -> ${sc.debugInfo().phase}`;
    }
    if (phase !== 'waiting') return `phase ${phase}`;
  }
  return 'no bite';
};
