import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import './ui/styles.css';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './app/game';
import { readLaunchParams } from './app/params';
import { createStore } from './app/store';
import { createScene } from './scenes';
import { App } from './ui/App';
import { initialUiState } from './ui/uiState';

async function main(): Promise<void> {
  const params = readLaunchParams();
  const ui = createStore({ ...initialUiState, debug: params.debug });

  const game = new Game(params, ui);
  createRoot(document.getElementById('ui')!).render(
    createElement(App, { store: ui, send: (cmd) => game.commands.send(cmd) }),
  );
  await game.start(document.getElementById('game')!, createScene);
  if (params.shot) document.body.style.cursor = 'none';
}

main().catch((err) => {
  console.error(err);
  (window as unknown as { __gameError: string }).__gameError = String(err?.stack ?? err);
});
