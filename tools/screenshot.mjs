#!/usr/bin/env node
/**
 * 启动开发服务器，用无头浏览器打开游戏，按步骤操作并截图。
 *
 * 用法：
 *   npm run shot -- --scene pond --seed 7 --warmup 12
 *   npm run shot -- --actions "shot:before;click:900,500;step:2;shot:after"
 *
 * 动作（用分号分隔）：
 *   step:秒数        按固定步长推进游戏
 *   click:x,y        在逻辑坐标 (x, y) 处点击（1080 高的画面坐标）
 *   move:x,y         把鼠标移到 (x, y)
 *   down:x,y / up    在 (x, y) 按下鼠标 / 松开鼠标（用来蓄力、收线）
 *   key:按键         按一个键，例如 key:h
 *   wait:毫秒        等待真实时间（让 CSS 过渡动画播完）
 *   shot:名字        截图保存为 <out>/<名字>.png
 *   perf:帧数        测量逻辑更新的平均耗时（毫秒 / 帧）
 *   eval:代码        在页面里执行一段 JS 并打印结果（代码里不能有分号）
 *   evalfile:文件@参数  执行文件里的函数表达式，例如 tools/bots/fight.js@30
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const { chromium } = await import('playwright');

const { values } = parseArgs({
  options: {
    scene: { type: 'string', default: 'pond' },
    seed: { type: 'string', default: '7' },
    warmup: { type: 'string', default: '10' },
    width: { type: 'string', default: '1920' },
    height: { type: 'string', default: '1080' },
    out: { type: 'string', default: 'screenshots' },
    actions: { type: 'string', default: '' },
    query: { type: 'string', default: '' },
  },
});

const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ logLevel: 'error', server: { port: 5174, strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:5174/';

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: Number(values.width), height: Number(values.height) },
  deviceScaleFactor: 1,
});
const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning')
    problems.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

const query = new URLSearchParams({
  scene: values.scene,
  seed: values.seed,
  warmup: values.warmup,
  shot: '1',
});
for (const pair of values.query.split('&').filter(Boolean)) {
  const [k, v = ''] = pair.split('=');
  query.set(k, v);
}

let exitCode = 0;
try {
  const t0 = Date.now();
  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => window.__game?.ready || window.__gameError, null, {
    timeout: 120_000,
  });
  const err = await page.evaluate(() => window.__gameError);
  if (err) throw new Error(`游戏启动失败：\n${err}`);
  console.log(`ready in ${Date.now() - t0} ms`);
  // 等字体加载完，界面文字才不会是默认字体
  await page.evaluate(() => document.fonts.ready);

  const actions = (values.actions || `shot:${values.scene}`)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const action of actions) {
    const idx = action.indexOf(':');
    const name = idx < 0 ? action : action.slice(0, idx);
    const arg = idx < 0 ? '' : action.slice(idx + 1);
    if (name === 'step') {
      await page.evaluate((s) => window.__game.step(s), Number(arg));
    } else if (name === 'click') {
      const [x, y] = arg.split(',').map(Number);
      const p = await page.evaluate(([lx, ly]) => window.__game.toScreen(lx, ly), [x, y]);
      await page.mouse.click(p.x, p.y);
      await page.evaluate(() => window.__game.step(1 / 60));
    } else if (name === 'move' || name === 'down') {
      const [x, y] = arg.split(',').map(Number);
      const p = await page.evaluate(([lx, ly]) => window.__game.toScreen(lx, ly), [x, y]);
      await page.mouse.move(p.x, p.y);
      if (name === 'down') await page.mouse.down();
      await page.evaluate(() => window.__game.step(1 / 60));
    } else if (name === 'up') {
      await page.mouse.up();
      await page.evaluate(() => window.__game.step(1 / 60));
    } else if (name === 'wait') {
      // 等待真实时间（例如 CSS 过渡动画）
      await page.waitForTimeout(Number(arg) || 500);
    } else if (name === 'key') {
      await page.keyboard.press(arg);
      await page.evaluate(() => window.__game.step(1 / 60));
    } else if (name === 'shot') {
      await page.evaluate(() => window.__game.game.app.render());
      const file = resolve(outDir, `${arg || 'shot'}.png`);
      await page.screenshot({ path: file });
      console.log(`saved ${file}`);
    } else if (name === 'perf') {
      const frames = Number(arg) || 300;
      const ms = await page.evaluate((n) => {
        const scene = window.__game.scene;
        const t = performance.now();
        for (let i = 0; i < n; i++) scene.update(1 / 60);
        return (performance.now() - t) / n;
      }, frames);
      console.log(`logic update: ${ms.toFixed(3)} ms/frame over ${frames} frames`);
    } else if (name === 'evalfile') {
      // 文件内容是一个函数表达式，例如 (seconds) => { ... }；@ 后面是参数
      const [file, param] = arg.split('@');
      const code = readFileSync(resolve(file), 'utf8').trim().replace(/;\s*$/, '');
      const result = await page.evaluate(
        `(${code})(${param === undefined ? '' : JSON.stringify(Number(param))})`,
      );
      console.log(`evalfile ${file}: ${JSON.stringify(result)}`);
    } else if (name === 'eval') {
      const result = await page.evaluate(arg);
      console.log(`eval: ${JSON.stringify(result)}`);
    } else {
      throw new Error(`未知动作：${action}`);
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  exitCode = 1;
} finally {
  if (problems.length) {
    console.log('--- console ---');
    for (const p of problems.slice(0, 40)) console.log(p);
  }
  await browser.close();
  await server.close();
}
process.exit(exitCode);
