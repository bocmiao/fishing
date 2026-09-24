// 截图脚本用：简单的遛鱼机器人，张力低就收线、高就放线，竿子往鱼窜的反方向带
(seconds = 30) => {
  const g = window.__game;
  const sc = g.scene;
  let down = false;
  for (let i = 0; i < seconds * 60; i++) {
    const f = sc.fight;
    if (!f) break;
    const want = f.state.tension < 0.62;
    if (want !== down) {
      sc.press(want);
      down = want;
    }
    sc.mouse.x = sc.catX - Math.sign(f.state.lateral) * 200;
    sc.update(1 / 60);
  }
  if (down) sc.press(false);
  g.game.app.render();
  return sc.debugInfo();
};
