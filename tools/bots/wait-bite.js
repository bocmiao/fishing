// 截图脚本用：一直等到咬钩就提竿（最多 maxSeconds 秒游戏时间）；饵被偷了就收竿重抛
(maxSeconds = 90) => {
  const g = window.__game;
  const sc = g.scene;
  const step = (seconds) => {
    for (let k = 0; k < Math.round(seconds * 60); k++) sc.update(1 / 60);
  };
  let recasts = 0;
  for (let i = 0; i < maxSeconds * 10; i++) {
    step(0.1);
    const phase = sc.debugInfo().phase;
    if (phase === 'bite') {
      sc.press(true);
      sc.press(false);
      g.game.app.render();
      return `strike after ${(i / 10).toFixed(1)}s (recasts ${recasts}) -> ${sc.debugInfo().phase}`;
    }
    if ((phase === 'waiting' && sc.baitGone) || phase === 'aim') {
      // 收竿，朝画面中上方重新抛一竿
      sc.retrieve();
      sc.mouse.x = sc.catX + (recasts % 3) * 160 - 160;
      sc.mouse.y = 380;
      step(0.1);
      sc.press(true);
      step(0.8);
      sc.press(false);
      step(1.6);
      recasts++;
    } else if (phase !== 'waiting' && phase !== 'flying') {
      return `phase ${phase}`;
    }
  }
  return 'no bite';
};
