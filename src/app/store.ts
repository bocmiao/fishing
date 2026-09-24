/**
 * 极简的可订阅状态容器，用来把游戏状态同步给 React 界面。
 * 界面只读状态；要改游戏数据，通过场景或逻辑层暴露的指令完成。
 */
export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      let changed = false;
      for (const key in patch) {
        if (!Object.is(state[key], patch[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
