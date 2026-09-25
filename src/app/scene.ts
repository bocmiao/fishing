import { Container, type Application } from 'pixi.js';
import type { Rng } from '../sim/rng/rng';
import type { GameState } from '../sim/state';
import type { CommandBus } from './commands';
import type { LaunchParams } from './params';
import type { Store } from './store';
import type { UiState } from '../ui/uiState';

/** 画面的逻辑尺寸：高度固定 1080，宽度随窗口比例变化 */
export interface ViewSize {
  width: number;
  height: number;
}

export interface SceneContext {
  app: Application;
  params: LaunchParams;
  rng: Rng;
  ui: Store<UiState>;
  view: ViewSize;
  /** 跨画面共享的游戏状态 */
  state: GameState;
  commands: CommandBus;
}

/**
 * 一个画面（鱼塘、钓鱼、场景插画、地图……）。
 * 方案 C 的行走地图也会是一个 Scene，通过同样的接口打开钓鱼和鱼塘画面。
 */
export abstract class Scene {
  readonly root = new Container();

  constructor(protected readonly ctx: SceneContext) {}

  /** 进入画面：创建显示对象、生成纹理等 */
  abstract enter(): void | Promise<void>;

  /** 每帧调用，dt 为秒 */
  update(_dt: number): void {}

  /** 窗口尺寸变化 */
  resize(_view: ViewSize): void {}

  /** 画面外面改了游戏状态（例如买了升级）：刷新界面上的数字 */
  refresh(): void {}

  /** 离开画面：释放资源 */
  exit(): void {
    this.root.destroy({ children: true });
  }
}
