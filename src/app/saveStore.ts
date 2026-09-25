/**
 * 存档放在哪：网页版和开发期用浏览器的 localStorage；接入 Electron 后换成写本地文件。
 * 浏览器可能禁用存储（无痕窗口等），所以每次读写都包在 try 里，失败了游戏照样能玩，只是不存档。
 */
const KEY = 'banmu-fangtang/save';

export function readSave(): unknown | null {
  try {
    const text = window.localStorage.getItem(KEY);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeSave(data: unknown): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 存储不可用，本来也没有存档
  }
}
