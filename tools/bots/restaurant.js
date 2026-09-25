// 截图脚本用：小馆机器人。
//   'stock'：往活鱼缸里放几条鱼、备点配料、定菜单
//   'cook'：等到有客人点菜，开始做，停在做菜小游戏中间
//   数字 N：营业 N 秒（游戏里的真实秒）：有客人等就开始做，指针走到好区中间就按
(arg = 'stock') => {
  const g = window.__game;
  const st = g.state;
  const sc = g.scene;
  if (arg === 'stock') {
    const fish = [
      ['crucian', 0.32, 23],
      ['crucian', 0.21, 20],
      ['crucian', 0.45, 26],
      ['hooksnout', 0.14, 22],
      ['stone_moroko', 0.012, 8],
      ['stone_moroko', 0.01, 7],
      ['stone_moroko', 0.014, 8],
      ['loach', 0.03, 14],
    ];
    fish.forEach(([speciesId, weightKg, lengthCm], i) =>
      st.restaurant.tank.push({
        uid: 90000 + i,
        speciesId,
        weightKg,
        lengthCm,
        sizeClass: lengthCm > 20 ? 'medium' : 'small',
        trophy: false,
        lookSeed: 1234 + i * 77,
        day: 0,
        minute: 400,
        spotId: 'creek',
        positionId: 'bay',
      }),
    );
    st.inventory.add('scallion', 4);
    st.inventory.add('flour', 2);
    st.setMenu(['braised_crucian', 'fried_minnows', 'fish_noodles', 'corn_cake']);
    sc.update(1 / 60);
    g.game.app.render();
    return sc.debugInfo();
  }
  if (arg === 'cook') {
    // 开始做一道菜，停在做菜小游戏的中间（截图看界面用）
    for (let i = 0; i < 60 * 30 && !sc.cooking; i++) {
      const w = sc.longestWaiting();
      if (w) sc.startCooking(w.id);
      sc.update(1 / 60);
    }
    for (let i = 0; i < 20; i++) sc.update(1 / 60);
    g.game.app.render();
    return sc.debugInfo();
  }
  const frames = Math.round(Number(arg) * 60);
  for (let i = 0; i < frames; i++) {
    const c = sc.cooking;
    if (c) {
      if (Math.abs(c.game.pointer - c.game.zoneCenter) < 0.03) sc.hit();
    } else {
      const w = sc.longestWaiting();
      if (w) sc.startCooking(w.id);
    }
    sc.update(1 / 60);
  }
  g.game.app.render();
  return sc.debugInfo();
};
