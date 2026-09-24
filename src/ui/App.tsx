import { useSyncExternalStore } from 'react';
import type { Store } from '../app/store';
import type { UiState } from './uiState';

function useUi<T>(store: Store<UiState>, select: (s: UiState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

export function App({ store }: { store: Store<UiState> }) {
  const watch = useUi(store, (s) => s.watchMode);
  const title = useUi(store, (s) => s.sceneTitle);
  const hint = useUi(store, (s) => s.hint);
  const fishCount = useUi(store, (s) => s.fishCount);
  const debug = useUi(store, (s) => s.debug);

  return (
    <div className={`ui-root${watch ? ' is-watching' : ''}`}>
      {title && (
        <div className="plaque">
          <div className="plaque-title">{title}</div>
          <div className="plaque-sub">{fishCount} 尾锦鲤</div>
        </div>
      )}
      {hint && <div className="hint card">{hint}</div>}
      {debug && <DebugPanel store={store} />}
      <div className="watch-hint">按 H 退出观鱼模式</div>
    </div>
  );
}

function DebugPanel({ store }: { store: Store<UiState> }) {
  const fps = useUi(store, (s) => s.fps);
  const frameMs = useUi(store, (s) => s.frameMs);
  const eaten = useUi(store, (s) => s.pelletsEaten);
  return (
    <div className="debug card">
      <div>FPS {fps}</div>
      <div>逻辑 {frameMs} ms / 帧</div>
      <div>已吃鱼食 {eaten}</div>
    </div>
  );
}
