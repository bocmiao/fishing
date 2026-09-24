// 截图脚本用：一直等到咬钩（不提竿），用来截"咬钩了"的画面
(maxSeconds = 90) => {
  const g = window.__game;
  const sc = g.scene;
  for (let i = 0; i < maxSeconds * 10; i++) {
    for (let k = 0; k < 6; k++) sc.update(1 / 60);
    if (sc.debugInfo().phase === 'bite') {
      for (let k = 0; k < 8; k++) sc.update(1 / 60);
      g.game.app.render();
      return `bite after ${(i / 10).toFixed(1)}s`;
    }
    if (sc.debugInfo().phase !== 'waiting') return `phase ${sc.debugInfo().phase}`;
  }
  return 'no bite';
};
