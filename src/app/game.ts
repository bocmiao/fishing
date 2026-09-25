import { Application, Container } from 'pixi.js';
import { getGameData } from '../sim/data/gameData';
import { Rng } from '../sim/rng/rng';
import { checkAchievements, progressOf, rewardText } from '../sim/achievements';
import type { Achievement } from '../sim/data/schema';
import { formatWeight } from '../sim/fishing/catchRoll';
import { hashString } from '../sim/rng/rng';
import { renderFishImage } from '../render/fish/fishImage';
import { fishLook } from '../render/fish/pondFishLook';
import { restore, serialize } from '../sim/save';
import { WEATHER_NAMES, GameState, type DaySummary } from '../sim/state';
import { SEASON_NAMES } from '../sim/time/clock';
import { describeEffect, statsWith, upgradeStatus } from '../sim/upgrades';
import { CommandBus } from './commands';
import { randomSeed, type LaunchParams } from './params';
import { clearSave, readSave, writeSave } from './saveStore';
import type { Scene, SceneContext, ViewSize } from './scene';
import type { Store } from './store';
import type { UiState } from '../ui/uiState';

/** 逻辑画面高度固定为 1080，宽度按窗口比例在 4:3 ~ 21:9 之间变化 */
export const VIEW_HEIGHT = 1080;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 21 / 9;
/** 单帧最长步长（秒），防止切回窗口时一下跳太远 */
const MAX_STEP = 1 / 20;
/** 自动存档的间隔（现实秒） */
const AUTOSAVE_SECONDS = 15;

/** 按名字创建画面 */
export type SceneFactory = (name: string, ctx: SceneContext) => Scene;

export class Game {
  readonly app = new Application();
  readonly commands = new CommandBus();
  state: GameState;
  /** 这一局是不是从存档接着玩的 */
  private readonly loaded: boolean;
  private saveTimer = 0;
  private summaryId = 0;
  private toastId = 100_000;
  /** 等着弹出的成就横幅（一个一个弹） */
  private readonly achievementQueue: Achievement[] = [];
  private achievementTimer = 0;
  private achievementCheck = 0;
  private achievementToastId = 0;
  /** 外公笔记里鱼的图，按鱼种缓存 */
  private readonly speciesImages = new Map<string, string>();
  private helperRng!: Rng;
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
    const saved = params.shot || params.fresh ? null : readSave();
    let state: GameState | null = null;
    if (saved) {
      try {
        state = restore(getGameData(), saved);
      } catch (err) {
        console.warn('存档读不出来，重新开始', err);
      }
    }
    this.loaded = state !== null;
    this.state = state ?? new GameState(getGameData(), params.seed);
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

    this.helperRng = new Rng(this.params.seed).fork('helper');
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
      else if (cmd.type === 'travel') this.travel(cmd.placeId);
      else if (cmd.type === 'sleep') this.state.sleep();
      else if (cmd.type === 'newGame') this.newGame();
      else if (cmd.type === 'buyUpgrade') this.buyUpgrade(cmd.upgradeId);
      else if (cmd.type === 'openNotebook') this.pushNotebook();
      else if (cmd.type === 'dismissSummary') {
        this.state.clock.paused = false;
        this.ui.set({ daySummary: null });
      }
    });
    if (!this.params.shot) {
      // 关掉页面、切到别的标签页时存一下
      window.addEventListener('pagehide', () => this.save());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.save();
      });
    }

    const first = this.params.scene ?? (this.loaded ? this.state.place : this.state.data.homePlace);
    await this.goto(first, this.params.warmup);

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
      if (this.state.data.placeById.has(name)) this.state.place = name;
      this.pushPlaces();
      this.pushUpgrades();
      // 预先模拟一段时间，让画面进入自然状态
      const warmupSteps = Math.round(warmup * 30);
      for (let i = 0; i < warmupSteps; i++) scene.update(1 / 30);
      this.ui.set({ scene: name });
      this.save();
    } finally {
      this.switching = false;
    }
  }

  /** 从地图去某个地方：先花掉路上的时间；走到半夜就直接回家睡觉 */
  private travel(placeId: string): void {
    const data = this.state.data;
    const place = data.placeById.get(placeId);
    if (!place || placeId === this.sceneName || this.switching) return;
    if (!this.state.placeOpen(placeId)) {
      const need = place.requires ? data.upgradeById.get(place.requires)?.name : '';
      this.ui.set({
        toast: {
          id: ++this.toastId,
          text: `还去不了${place.name}：要先「${need}」（按 U 添置）`,
          tone: 'info',
        },
      });
      return;
    }
    const from = data.placeById.get(this.state.place)?.area ?? 'home';
    const { reachedDayEnd } = this.state.clock.addMinutes(data.travelMinutes(from, place.area));
    if (reachedDayEnd) this.state.sleep();
    else void this.goto(placeId);
  }

  private newGame(): void {
    clearSave();
    this.state = new GameState(getGameData(), randomSeed());
    this.ctx.state = this.state;
    this.ui.set({ daySummary: null, money: this.state.money });
    this.sceneName = '';
    void this.goto(this.state.data.homePlace);
  }

  private buyUpgrade(id: string): void {
    const state = this.state;
    const upgrade = state.data.upgradeById.get(id);
    const result = state.buyUpgrade(id);
    const text =
      result === 'ok'
        ? `添置了${upgrade?.name ?? ''}`
        : result === 'money'
          ? '钱还不够'
          : result === 'locked'
            ? '要先买前面那一项'
            : '';
    if (text) {
      this.ui.set({ toast: { id: ++this.toastId, text, tone: result === 'ok' ? 'good' : 'info' } });
    }
    if (result === 'ok') {
      this.pushUpgrades();
      this.pushPlaces();
      if (upgrade?.effect.unlockPlace) {
        const name = state.data.placeById.get(upgrade.effect.unlockPlace)?.name ?? '';
        this.ui.set({
          toast: { id: ++this.toastId, text: `路修好了！打开地图（M）就能去${name}`, tone: 'good' },
        });
      }
      this.scene?.refresh();
      this.save();
    }
  }

  /** 买这一项之前的数值（已经买过的升级也显示"从多少变成多少"，而不是"12 → 12"） */
  private statsBefore(id: string) {
    const state = this.state;
    if (!state.upgrades.has(id)) return state.stats;
    const data = state.data;
    const dependsOn = (uid: string): boolean => {
      const req = data.upgradeById.get(uid)?.requires;
      return !!req && (req === id || dependsOn(req));
    };
    const without = new Set([...state.upgrades].filter((u) => u !== id && !dependsOn(u)));
    return statsWith(data, without);
  }

  /** 升级面板：每一项现在是什么状态、买了会怎样 */
  private pushUpgrades(): void {
    const state = this.state;
    const data = state.data;
    this.ui.set({
      upgrades: data.upgradeGroups.map((g) => ({
        id: g.id,
        name: g.name,
        note: g.note,
        items: data.upgrades
          .filter((u) => u.group === g.id)
          .map((u) => ({
            id: u.id,
            name: u.name,
            note: u.note,
            effect: describeEffect(data, this.statsBefore(u.id), u),
            price: u.price,
            status: upgradeStatus(u, state.upgrades),
            requires: u.requires ? (data.upgradeById.get(u.requires)?.name ?? '') : '',
          })),
      })),
    });
  }

  /** 存档（截图模式不存，免得影响之后的正常游戏） */
  save(): void {
    if (this.params.shot) return;
    writeSave(serialize(this.state));
    this.saveTimer = 0;
  }

  /** 每帧更新之后：处理睡觉、自动存档、刷新钱数 */
  private afterUpdate(dt: number): void {
    const state = this.state;
    const summary = state.lastSummary;
    if (summary) {
      state.lastSummary = null;
      this.showSummary(summary);
      // 醒来在家里
      if (this.sceneName !== state.data.homePlace) void this.goto(state.data.homePlace);
      else this.save();
    }
    // 成就：隔一会儿查一次，新达成的排队弹横幅
    this.achievementCheck -= dt;
    if (this.achievementCheck <= 0) {
      this.achievementCheck = 0.25;
      const fresh = checkAchievements(state);
      if (fresh.length > 0) {
        this.achievementQueue.push(...fresh);
        this.save();
        if (this.ui.get().notebook) this.pushNotebook();
      }
    }
    this.achievementTimer -= dt;
    if (this.achievementTimer <= 0) {
      const next = this.achievementQueue.shift();
      if (next) {
        this.achievementTimer = 4;
        this.ui.set({
          achievementToast: {
            id: ++this.achievementToastId,
            name: next.name,
            desc: next.desc,
            reward: rewardText(state, next),
          },
        });
      } else if (this.ui.get().achievementToast) {
        this.ui.set({ achievementToast: null });
      }
    }
    // 到了打烊时间，今天还没营业：小满代班
    const helper = state.runHelperIfDue(this.helperRng);
    if (helper && helper.dishes.length > 0) {
      this.ui.set({
        toast: {
          id: ++this.toastId,
          text: `小满代班：卖了 ${helper.dishes.length} 道菜，收入 ¥${helper.earned}`,
          tone: 'good',
        },
      });
    }
    this.saveTimer += dt;
    if (this.saveTimer > AUTOSAVE_SECONDS) this.save();
    if (this.ui.get().money !== state.money) this.ui.set({ money: state.money });
  }

  private showSummary(summary: DaySummary): void {
    // 看小结的时候新的一天先不走
    this.state.clock.paused = true;
    const s = summary.stats;
    const clock = this.state.clock;
    const lines: string[] = [];
    if (s.caught > 0) lines.push(`钓到 ${s.caught} 条鱼，放进鱼护 ${s.kept} 条`);
    const best = this.state.data.speciesById.get(s.bestFishSpecies);
    if (best) lines.push(`最大的一条：${best.name} ${formatWeight(s.bestFishKg)}`);
    if (s.worms > 0) lines.push(`在菜地挖到 ${s.worms} 条蚯蚓`);
    if (s.harvested > 0) lines.push(`收获了 ${s.harvested} 份作物`);
    if (summary.bedWorms > 0) lines.push(`蚯蚓床里又多了 ${summary.bedWorms} 条蚯蚓`);
    if (s.guests > 0) lines.push(`小馆接待了 ${s.guests} 位客人`);
    if (s.restaurantEarned > 0) lines.push(`小馆一共收入 ¥${s.restaurantEarned}`);
    const helper = summary.helper;
    if (helper && helper.dishes.length > 0) {
      lines.push(`小满代班卖了 ${helper.dishes.length} 道菜，收入 ¥${helper.earned}`);
    }
    if (s.earned > 0 || s.spent > 0) lines.push(`进账 ¥${s.earned}，花销 ¥${s.spent}`);
    if (summary.ripened > 0) lines.push(`夜里有 ${summary.ripened} 块地的作物熟了`);
    if (s.achievements.length > 0) {
      const names = s.achievements.map((id) => this.state.data.achievementById.get(id)?.name ?? id);
      lines.push(`达成成就：${names.join('、')}`);
    }
    if (lines.length === 0) lines.push('安安静静的一天');
    this.ui.set({
      daySummary: {
        id: ++this.summaryId,
        title: `第 ${summary.day + 1} 天结束`,
        lines,
        goal: this.nextGoal(),
        tomorrow: `第 ${clock.day + 1} 天 · ${SEASON_NAMES[clock.season]} · ${WEATHER_NAMES[summary.weather]}`,
      },
    });
  }

  /** 下一个小目标：最便宜的、还没买的升级 */
  private nextGoal(): string {
    const state = this.state;
    const next = state.data.upgrades
      .filter((u) => upgradeStatus(u, state.upgrades) === 'available')
      .sort((a, b) => a.price - b.price)[0];
    if (!next) return '';
    return state.money >= next.price
      ? `够买「${next.name}」了（按 U 添置）`
      : `离「${next.name}」还差 ¥${next.price - state.money}`;
  }

  /** 外公笔记：每种鱼一页（没钓到过的只有外公的线索），成就按分类列出进度 */
  private pushNotebook(): void {
    const state = this.state;
    const data = state.data;
    const rarity: Record<string, string> = {
      common: '常见',
      uncommon: '少见',
      rare: '稀有',
      legendary: '传说',
    };
    const species = data.species.map((sp) => {
      const entry = state.journal.get(sp.id);
      let image = this.speciesImages.get(sp.id);
      if (!image) {
        image = renderFishImage(fishLook(sp, hashString(`journal:${sp.id}`)), 0.6);
        this.speciesImages.set(sp.id, image);
      }
      return {
        id: sp.id,
        name: sp.name,
        caught: !!entry,
        count: entry?.caught ?? 0,
        best: entry ? formatWeight(entry.bestWeightKg) : '',
        note: sp.note,
        rarity: rarity[sp.rarity] ?? '',
        spot: sp.spots.map((id) => data.spotById.get(id)?.name ?? id).join('、'),
        image,
      };
    });
    const groups = data.achievementCategories.map((c) => ({
      id: c.id,
      name: c.name,
      items: data.achievements
        .filter((a) => a.category === c.id)
        .map((a) => {
          const day = state.achievements.get(a.id);
          const p = progressOf(state, a.condition);
          const done = day !== undefined;
          const counted = p.target > 1;
          const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
          const unit = a.condition.type === 'weight' ? ' 公斤' : '';
          return {
            id: a.id,
            name: a.name,
            desc: a.desc,
            done,
            day: done ? day + 1 : 0,
            progress: done ? 1 : Math.min(1, p.current / p.target),
            progressText:
              !done && counted
                ? `${fmt(Math.min(p.current, p.target))}/${fmt(p.target)}${unit}`
                : '',
            reward: rewardText(state, a),
          };
        }),
    }));
    this.ui.set({
      notebook: {
        species,
        groups,
        done: state.achievements.size,
        total: data.achievements.length,
      },
    });
  }

  /** 地图上各个地方离这里多远 */
  private pushPlaces(): void {
    const data = this.state.data;
    const here = data.placeById.get(this.state.place);
    this.ui.set({
      places: data.places.map((p) => ({
        id: p.id,
        name: p.name,
        note: p.note,
        x: p.x,
        y: p.y,
        minutes: here ? data.travelMinutes(here.area, p.area) : 0,
        here: p.id === this.state.place,
        locked: this.state.placeOpen(p.id)
          ? ''
          : `要先「${data.upgradeById.get(p.requires ?? '')?.name ?? ''}」`,
      })),
    });
  }

  /** 按固定步长推进若干秒（截图和测试用） */
  step(seconds: number, fps = 60): void {
    const steps = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < steps; i++) {
      this.scene?.update(1 / fps);
      this.afterUpdate(1 / fps);
    }
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
    this.afterUpdate(dt);
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
