import { Application, Container } from 'pixi.js';
import { Rng } from '../sim/rng/rng';
import type { LaunchParams } from './params';
import type { Scene, SceneContext, ViewSize } from './scene';
import type { Store } from './store';
import type { UiState } from '../ui/uiState';

/** 逻辑画面高度固定为 1080，宽度按窗口比例在 4:3 ~ 21:9 之间变化 */
export const VIEW_HEIGHT = 1080;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 21 / 9;
/** 单帧最长步长（秒），防止切回窗口时一下跳太远 */
const MAX_STEP = 1 / 20;

export type SceneFactory = (ctx: SceneContext) => Scene;

export class Game {
  readonly app = new Application();
  /** 所有画面都放在这里，按窗口缩放 */
  private readonly world = new Container();
  private scene: Scene | null = null;
  private ctx!: SceneContext;
  private fpsTimer = 0;
  private frameCount = 0;
  private updateMsAccum = 0;

  constructor(
    private readonly params: LaunchParams,
    private readonly ui: Store<UiState>,
  ) {}

  async start(mount: HTMLElement, factory: SceneFactory): Promise<void> {
    await this.app.init({
      background: '#1c3a3a',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      resizeTo: window,
      preference: 'webgl',
      // 截图模式下需要从画布读取像素
      preserveDrawingBuffer: this.params.shot,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = 'static';

    this.ctx = {
      app: this.app,
      params: this.params,
      rng: new Rng(this.params.seed),
      ui: this.ui,
      view: this.layout(),
    };
    this.app.renderer.on('resize', () => {
      const view = this.layout();
      this.ctx.view = view;
      this.scene?.resize(view);
    });

    await this.switchScene(factory);

    if (this.params.shot) {
      // 截图模式：不自动走帧，由截图脚本调用 step() 精确推进
      this.app.ticker.stop();
      this.app.render();
    } else {
      this.app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));
    }
    exposeDebugHandle(this);
  }

  async switchScene(factory: SceneFactory): Promise<void> {
    if (this.scene) {
      this.world.removeChild(this.scene.root);
      this.scene.exit();
    }
    const scene = factory(this.ctx);
    this.scene = scene;
    await scene.enter();
    scene.resize(this.ctx.view);
    this.world.addChild(scene.root);
    // 预先模拟一段时间，让画面进入自然状态
    const warmupSteps = Math.round(this.params.warmup * 30);
    for (let i = 0; i < warmupSteps; i++) scene.update(1 / 30);
  }

  /** 按固定步长推进若干秒（截图和测试用） */
  step(seconds: number, fps = 60): void {
    const steps = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < steps; i++) this.scene?.update(1 / fps);
    this.app.render();
  }

  get currentScene(): Scene | null {
    return this.scene;
  }

  get view(): ViewSize {
    return this.ctx.view;
  }

  toScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.world.position.x + x * this.world.scale.x,
      y: this.world.position.y + y * this.world.scale.y,
    };
  }

  private tick(dt: number): void {
    const t0 = performance.now();
    this.scene?.update(Math.min(dt, MAX_STEP));
    this.updateMsAccum += performance.now() - t0;
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.ui.set({
        fps: Math.round(this.frameCount / this.fpsTimer),
        frameMs: Math.round((this.updateMsAccum / this.frameCount) * 100) / 100,
      });
      this.fpsTimer = 0;
      this.frameCount = 0;
      this.updateMsAccum = 0;
    }
  }

  /** 按窗口大小计算缩放，保持逻辑高度 1080；超出比例范围的部分留边 */
  private layout(): ViewSize {
    const screen = this.app.screen;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, screen.width / screen.height));
    const width = Math.round(VIEW_HEIGHT * aspect);
    const scale = Math.min(screen.width / width, screen.height / VIEW_HEIGHT);
    this.world.scale.set(scale);
    this.world.position.set(
      Math.round((screen.width - width * scale) / 2),
      Math.round((screen.height - VIEW_HEIGHT * scale) / 2),
    );
    return { width, height: VIEW_HEIGHT };
  }
}

/** 给截图脚本和控制台调试用的入口：window.__game */
function exposeDebugHandle(game: Game): void {
  (window as unknown as { __game: unknown }).__game = {
    ready: true,
    game,
    step: (seconds: number) => game.step(seconds),
    get scene() {
      return game.currentScene;
    },
    get view() {
      return game.view;
    },
    /** 逻辑坐标 → 页面上的 CSS 像素坐标 */
    toScreen: (x: number, y: number) => game.toScreen(x, y),
  };
}
