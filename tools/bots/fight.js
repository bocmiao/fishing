// 截图脚本用：简单的遛鱼机器人，张力低就连按空格（每秒 8 下）、高就停手，竿子往鱼窜的反方向带
(seconds = 30) => {
  const g = window.__game;
  const sc = g.scene;
  let next = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const f = sc.fight;
    if (!f) break;
    next -= 1 / 60;
    if (f.state.tension < 0.62) {
      if (next <= 0) {
        sc.crank.press();
        next += 1 / 8;
      }
    } else next = 0;
    sc.mouse.x = sc.catX - Math.sign(f.state.lateral) * 200;
    sc.update(1 / 60);
  }
  g.game.app.render();
  return sc.debugInfo();
};
