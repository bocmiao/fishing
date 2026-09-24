// 截图脚本用：把时钟拨到某个时刻（小时），例如 21 表示 21:00
(hour = 12) => {
  const g = window.__game;
  const clock = g.state.clock;
  clock.addMinutes(Math.max(0, hour * 60 - clock.minute));
  for (let k = 0; k < 30; k++) g.scene.update(1 / 60);
  g.game.app.render();
  return clock.formatTime();
};
