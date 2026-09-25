import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import './ui/styles.css';
// 不用 eval 的着色器同步代码：网页版运行在不允许 eval 的安全策略下，桌面版也照样能用
import 'pixi.js/unsafe-eval';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './app/game';
import { readLaunchParams } from './app/params';
import { createStore } from './app/store';
import { watchUiScale } from './app/uiScale';
import { createScene } from './scenes';
import { App } from './ui/App';
import { initialUiState } from './ui/uiState';

async function main(): Promise<void> {
  const params = readLaunchParams();
  const ui = createStore({ ...initialUiState, debug: params.debug });

  const game = new Game(params, ui);
  const uiRoot = document.getElementById('ui')!;
  watchUiScale(uiRoot);
  createRoot(uiRoot).render(
    createElement(App, { store: ui, send: (cmd) => game.commands.send(cmd) }),
  );
  await game.start(document.getElementById('game')!, createScene);
  if (params.shot) document.body.style.cursor = 'none';
}

main().catch((err) => {
  console.error(err);
  (window as unknown as { __gameError: string }).__gameError = String(err?.stack ?? err);
});
