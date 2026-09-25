// 截图脚本用：把菜地摆成各种样子看画面。mode = 'mixed'（荒地、翻好、长一半、熟了）或 'ripe'（每种作物都熟了）
(mode = 'mixed') => {
  const g = window.__game;
  const st = g.state;
  const sc = g.scene;
  const crops = st.data.crops.map((c) => c.id);
  const set = (i, stage, cropId = null, grown = 0, extra = {}) =>
    Object.assign(st.plots[i], { stage, cropId, grown, watered: false, compost: false }, extra);
  if (mode === 'ripe') {
    st.plots.forEach((_, i) => set(i, 'ripe', crops[i % crops.length], 9));
  } else {
    set(0, 'wild');
    set(1, 'tilled', null, 0, { compost: true });
    set(2, 'growing', 'corn', 1, { watered: true });
    set(3, 'growing', 'wheat', 4);
    set(4, 'growing', 'greens', 2, { watered: true });
    set(5, 'ripe', 'corn', 6);
  }
  sc.update(1 / 60);
  g.game.app.render();
  return sc.debugInfo();
};
