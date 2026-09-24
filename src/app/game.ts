import { Application, Container } from 'pixi.js';
import { getGameData } from '../sim/data/gameData';
import { Rng } from '../sim/rng/rng';
import { GameState } from '../sim/state';
import { CommandBus } from './commands';
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

/** 按名字创建画面 */
export type SceneFactory = (name: string, ctx: SceneContext) => Scene;

export class Game {
  readonly app = new Application();
  readonly commands = new CommandBus();
  readonly state: GameState;
  /** 所有画面都放在这里，按窗口缩放 */
  private readonly world = new Container();
  private scene: Scene | null = null;
  private sceneName = '';
  private factory!: SceneFactory;
  private ctx!: SceneContext;
  private switching = false;
  private fpsTimer = 0;
  private frameCount = 0;
  private updateMsAccum = 0;

  constructor(
    private readonly params: LaunchParams,
    private readonly ui: Store<UiState>,
  ) {
    this.state = new GameState(getGameData(), params.seed);
  }

  async start(mount: HTMLElement, factory: SceneFactory): Promise<void> {
    this.factory = factory;
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
    // 右键用来收竿，不弹出浏览器菜单
    this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = 'static';

    this.ctx = {
      app: this.app,
      params: this.params,
      rng: new Rng(this.params.seed),
      ui: this.ui,
      view: this.layout(),
      state: this.state,
      commands: this.commands,
    };
    this.app.renderer.on('resize', () => {
      const view = this.layout();
      this.ctx.view = view;
      this.scene?.resize(view);
    });
    this.commands.on((cmd) => {
      if (cmd.type === 'goto' && cmd.scene !== this.sceneName) void this.goto(cmd.scene);
    });

    await this.goto(this.params.scene, this.params.warmup);

    if (this.params.shot) {
      // 截图模式：不自动走帧，由截图脚本调用 step() 精确推进
      this.app.ticker.stop();
      this.app.render();
    } else {
      this.app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));
    }
    exposeDebugHandle(this);
  }

  /** 切换到某个画面；warmup 为进入前预先模拟的秒数 */
  async goto(name: string, warmup = 2): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    try {
      const old = this.scene;
      this.scene = null;
      if (old) {
        this.world.removeChild(old.root);
        old.exit();
      }
      const scene = this.factory(name, this.ctx);
      this.sceneName = name;
      await scene.enter();
      scene.resize(this.ctx.view);
      this.world.addChild(scene.root);
      this.scene = scene;
      // 预先模拟一段时间，让画面进入自然状态
      const warmupSteps = Math.round(warmup * 30);
      for (let i = 0; i < warmupSteps; i++) scene.update(1 / 30);
      this.ui.set({ scene: name });
    } finally {
      this.switching = false;
    }
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
    send: (cmd: Parameters<CommandBus['send']>[0]) => game.commands.send(cmd),
    get scene() {
      return game.currentScene;
    },
    get view() {
      return game.view;
    },
    get state() {
      return game.state;
    },
    /** 逻辑坐标 → 页面上的 CSS 像素坐标 */
    toScreen: (x: number, y: number) => game.toScreen(x, y),
  };
}
