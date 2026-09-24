/** React 界面读取的游戏状态 */
export interface UiState {
  /** 当前画面名称，例如 "锦鲤池" */
  sceneTitle: string;
  /** 观鱼模式：隐藏界面和阿喵 */
  watchMode: boolean;
  /** 底部的操作提示 */
  hint: string;
  /** 调试信息 */
  debug: boolean;
  fps: number;
  frameMs: number;
  fishCount: number;
  pelletsEaten: number;
}

export const initialUiState: UiState = {
  sceneTitle: '',
  watchMode: false,
  hint: '',
  debug: false,
  fps: 0,
  frameMs: 0,
  fishCount: 0,
  pelletsEaten: 0,
};
