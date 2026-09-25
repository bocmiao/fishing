import {
  Container,
  Rectangle,
  Sprite,
  Text,
  type FederatedPointerEvent,
  type RenderTexture,
} from 'pixi.js';
import type { GameCommand } from '../app/commands';
import { Scene, type ViewSize } from '../app/scene';
import { seedId } from '../sim/data/gameData';
import {
  actionFor,
  growthOf,
  PLOT_ACTION_NAMES,
  type FarmTool,
  type PlotAction,
} from '../sim/farm/farm';
import type { Rng } from '../sim/rng/rng';
import { WEATHER_NAMES } from '../sim/state';
import { SEASON_NAMES } from '../sim/time/clock';
import { TopDownCat } from '../render/cat/topDownCat';
import { DirtBurst } from '../render/farm/dirtBurst';
import { renderFarmGround, type FieldRect } from '../render/farm/farmGround';
import { PlotView } from '../render/farm/plotView';
import { ambientAt } from '../render/fx/ambient';
import { FloatingTexts } from '../render/fx/floatText';
import { PostOverlay } from '../render/fx/postOverlay';
import { Rain } from '../render/fx/rain';
import { PALETTE } from '../render/palette';

const COLS = 3;
const ROWS = 2;
const PLOT_W = 330;
const PLOT_H = 240;
const GAP = 40;
const FIELD_TOP = 150;

/** 界面上工具的 id：hand、compost，或者 seed:作物id */
function toolFromId(id: string): FarmTool {
  if (id === 'compost') return { kind: 'compost' };
  if (id.startsWith('seed:')) return { kind: 'seed', cropId: id.slice(5) };
  return { kind: 'hand' };
}

/**
 * 菜地（方案 B：点击式）：老宅旁边的几块地。
 * 点一块地做下一步活（开荒、翻地、播种、浇水、收获），翻地时能挖到蚯蚓；
 * 旁边的石磨和灶台能把小麦磨成面粉、和成面饵，把黄豆点成豆腐。
 */
export class FarmScene extends Scene {
  private rng!: Rng;
  private view!: ViewSize;
  private ground: RenderTexture | null = null;
  private readonly groundSprite = new Sprite();
  private readonly plotLayer = new Container();
  private plots: PlotView[] = [];
  private readonly dirt = new DirtBurst();
  private readonly floaters = new FloatingTexts();
  private readonly label = new Text({
    text: '',
    style: {
      fontFamily: 'Noto Serif SC, serif',
      fontSize: 20,
      fontWeight: '600',
      fill: PALETTE.paper,
      stroke: { color: PALETTE.accent, width: 5 },
    },
  });
  private cat!: TopDownCat;
  private rain!: Rain;
  private post!: PostOverlay;
  private toolId = 'hand';
  private hover = -1;
  private time = 0;
  private uiTimer = 0;
  private toastId = 0;
  private unsubscribe: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  enter(): void {
    this.rng = this.ctx.rng.fork('farm');
    this.view = { ...this.ctx.view };
    this.cat = new TopDownCat(this.rng.fork('cat'));
    this.rain = new Rain(
      { x: 0, y: 0, w: this.view.width, h: this.view.height },
      this.rng.fork('rain'),
    );
    this.post = new PostOverlay(this.view.width, this.view.height);
    this.label.anchor.set(0.5, 1);
    this.label.visible = false;
    this.root.addChild(
      this.groundSprite,
      this.plotLayer,
      this.dirt.node,
      this.cat.root,
      this.floaters.node,
      this.label,
      this.rain.node,
      this.post.mesh,
    );
    this.layout();

    this.root.eventMode = 'static';
    this.root.on('pointermove', (e: FederatedPointerEvent) => {
      const p = e.getLocalPosition(this.root);
      this.setHover(this.plotAt(p.x, p.y));
    });
    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      const p = e.getLocalPosition(this.root);
      const i = this.plotAt(p.x, p.y);
      this.setHover(i);
      if (i >= 0) this.work(i);
    });
    window.addEventListener('keydown', this.onKey);
    this.unsubscribe = this.ctx.commands.on((cmd) => this.handleCommand(cmd));

    this.ctx.ui.set({
      scene: 'farm',
      sceneTitle: this.ctx.state.data.farm.name,
      sceneSubtitle: '',
      watchMode: false,
      catchCard: null,
      fightActive: false,
      debug: this.ctx.params.debug,
      clockText: this.clockText(),
    });
    this.pushFarmUi();
    const state = this.ctx.state;
    if (state.plots.every((p) => p.stage === 'wild')) {
      this.toast('外公的菜地荒了好久……先开荒，翻地时能挖到蚯蚓', 'info');
    }
  }

  // ---------------------------------------------------------------- 布局

  private get field(): FieldRect {
    const w = COLS * PLOT_W + (COLS - 1) * GAP;
    const h = ROWS * PLOT_H + (ROWS - 1) * GAP;
    return { x: Math.round((this.view.width - w) / 2), y: FIELD_TOP, w, h };
  }

  private get catPos(): { x: number; y: number } {
    return { x: this.view.width / 2, y: this.view.height - 110 };
  }

  /** 按画面大小摆好地面、地块和阿喵（窗口大小变了也调用） */
  private layout(): void {
    const { width: w, height: h } = this.view;
    const field = this.field;
    const old = this.ground;
    this.ground = renderFarmGround(
      this.ctx.app.renderer,
      w,
      h,
      field,
      this.catPos,
      this.ctx.params.seed,
    );
    this.groundSprite.texture = this.ground;
    old?.destroy(true);

    for (const p of this.plots) p.node.destroy({ children: true });
    this.plots = [];
    const count = this.ctx.state.plots.length;
    for (let i = 0; i < count; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const view = new PlotView(
        { x: field.x + c * (PLOT_W + GAP), y: field.y + r * (PLOT_H + GAP), w: PLOT_W, h: PLOT_H },
        this.ctx.params.seed * 31 + i * 101,
      );
      this.plots.push(view);
      this.plotLayer.addChild(view.node);
    }
    this.cat.root.position.set(this.catPos.x, this.catPos.y);
    this.post.resize(w, h);
    this.rain.bounds = { x: 0, y: 0, w, h };
    this.root.hitArea = new Rectangle(0, 0, w, h);
  }

  private plotAt(x: number, y: number): number {
    return this.plots.findIndex(
      (p) => x >= p.rect.x && x <= p.rect.x + p.rect.w && y >= p.rect.y && y <= p.rect.y + p.rect.h,
    );
  }

  // ---------------------------------------------------------------- 干活

  private get tool(): FarmTool {
    return toolFromId(this.toolId);
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    if (this.hover >= 0) this.plots[this.hover]!.hover = false;
    this.hover = i;
    if (i >= 0) this.plots[i]!.hover = true;
    this.updateLabel();
  }

  /** 鼠标放在地上时，头上显示点下去会做什么 */
  private updateLabel(): void {
    const i = this.hover;
    const plot = this.ctx.state.plots[i];
    if (!plot || i < 0) {
      this.label.visible = false;
      return;
    }
    const action = actionFor(plot, this.tool);
    const data = this.ctx.state.data;
    let text: string;
    if (action) {
      const minutes = data.farm.minutes[action];
      text = `${this.actionText(action)} · ${minutes} 分钟`;
    } else if (plot.stage === 'growing') {
      const crop = plot.cropId ? data.cropById.get(plot.cropId) : undefined;
      text = crop ? `${crop.name} · 还要 ${Math.max(1, Math.ceil(crop.days - plot.grown))} 天` : '';
    } else if (plot.stage === 'tilled') {
      text = '选一种种子来种';
    } else {
      text = '';
    }
    const r = this.plots[i]!.rect;
    this.label.text = text;
    // 标签放在地块里靠上的地方，不和顶上的提示条挤在一起
    this.label.position.set(r.x + r.w / 2, r.y + 34);
    this.label.visible = text !== '';
  }

  private actionText(action: PlotAction): string {
    const plot = this.ctx.state.plots[this.hover];
    const data = this.ctx.state.data;
    if (action === 'sow' && this.tool.kind === 'seed') {
      return `种${data.cropById.get(this.tool.cropId)?.name ?? ''}`;
    }
    if (action === 'harvest' && plot?.cropId) {
      return `收${data.cropById.get(plot.cropId)?.name ?? ''}`;
    }
    return PLOT_ACTION_NAMES[action];
  }

  private work(i: number): void {
    const state = this.ctx.state;
    const view = this.plots[i]!;
    const result = state.workPlot(i, this.tool, this.rng);
    if (!result.ok) {
      if (result.message) this.toast(result.message, 'info');
      return;
    }
    const { x, y } = view.center;
    const cat = this.cat.root.position;
    this.cat.lookAt(x - cat.x, y - cat.y);
    this.cat.toss();
    switch (result.action) {
      case 'clear':
      case 'till':
        this.dirt.burst(x, y, 26, this.rng, PALETTE.soil);
        if (result.worms > 0) {
          this.dirt.addWorms(x, y, Math.min(result.worms, 5), this.rng);
          this.floaters.add(x, y - 30, `+${result.worms} 蚯蚓`, PALETTE.worm);
        }
        break;
      case 'water':
        this.dirt.burst(x, y, 30, this.rng, PALETTE.waterLight);
        break;
      case 'fertilize':
        this.dirt.burst(x, y, 16, this.rng, PALETTE.soilWet);
        break;
      case 'sow':
        this.dirt.burst(x, y, 8, this.rng, PALETTE.soilDry);
        break;
      case 'harvest':
        this.dirt.burst(x, y, 22, this.rng, PALETTE.leaf);
        if (result.harvest) {
          this.floaters.add(
            x,
            y - 30,
            `+${result.harvest.count} ${state.itemName(result.harvest.id)}`,
            PALETTE.gold,
          );
        }
        break;
      default:
        break;
    }
    this.toast(result.message, 'good');
    // 种子用完了就放下
    if (this.toolId !== 'hand' && state.inventory.count(this.toolId) === 0) this.toolId = 'hand';
    this.updateLabel();
    this.pushFarmUi();
  }

  private handleCommand(cmd: GameCommand): void {
    const state = this.ctx.state;
    if (cmd.type === 'selectTool') {
      this.toolId = cmd.toolId === this.toolId ? 'hand' : cmd.toolId;
      this.updateLabel();
      this.pushFarmUi();
    } else if (cmd.type === 'craft') {
      const craft = state.data.crafts.find((c) => c.id === cmd.craftId);
      if (craft && state.craft(craft.id)) {
        const made = Object.entries(craft.outputs)
          .map(([id, n]) => `${n} 份${state.itemName(id)}`)
          .join('、');
        this.toast(`${craft.name}：做好了 ${made}`, 'good');
        this.pushFarmUi();
      } else if (craft) {
        this.toast('材料不够', 'info');
      }
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (/^Digit[1-9]$/.test(e.code)) {
      const tools = this.toolIds();
      const id = tools[Number(e.code.slice(5)) - 1];
      if (id) this.ctx.commands.send({ type: 'selectTool', toolId: id });
    } else if (e.code === 'F3') {
      this.ctx.ui.set({ debug: !this.ctx.ui.get().debug });
      e.preventDefault();
    }
  }

  // ---------------------------------------------------------------- 每帧

  override update(dt: number): void {
    this.time += dt;
    const state = this.ctx.state;
    state.clock.advance(dt);
    if (state.clock.isDayOver) state.sleep();

    for (let i = 0; i < this.plots.length; i++) {
      const plot = state.plots[i]!;
      const view = this.plots[i]!;
      view.sync(plot, growthOf(plot, state.data.cropById));
      view.update(this.time);
    }
    this.dirt.update(dt);
    this.floaters.update(dt);
    this.cat.update(dt);

    const amb = ambientAt(state.clock.minute, state.weather);
    this.post.setTint(amb.tint, amb.tintAlpha);
    this.rain.intensity = amb.rain;
    this.rain.update(dt);

    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.5;
      this.ctx.ui.set({ clockText: this.clockText() });
    }
  }

  // ---------------------------------------------------------------- 界面

  private toolIds(): string[] {
    return ['hand', ...this.ctx.state.data.crops.map((c) => seedId(c.id)), 'compost'];
  }

  private pushFarmUi(): void {
    const state = this.ctx.state;
    const data = state.data;
    const season = state.clock.season;
    const inv = state.inventory;
    const describe = (items: Record<string, number>) =>
      Object.entries(items)
        .map(([id, n]) => `${state.itemName(id)} ×${n}`)
        .join(' + ');
    this.ctx.ui.set({
      farm: {
        toolId: this.toolId,
        tools: [
          { id: 'hand', name: '空手', count: -1, note: '开荒、翻地、浇水、收获', inSeason: true },
          ...data.crops.map((c) => ({
            id: seedId(c.id),
            name: c.name,
            count: inv.count(seedId(c.id)),
            note: `${c.note}（${c.days} 天，${c.seasons.map((s) => SEASON_NAMES[s]).join('')}）`,
            inSeason: c.seasons.includes(season),
          })),
          {
            id: 'compost',
            name: '堆肥',
            count: inv.count('compost'),
            note: data.itemNames.has('compost') ? '施在地里，长得快、收得多' : '',
            inSeason: true,
          },
        ],
        crafts: data.crafts.map((c) => ({
          id: c.id,
          name: c.name,
          note: c.note,
          inputs: describe(c.inputs),
          outputs: describe(c.outputs),
          minutes: c.minutes,
          can: inv.hasAll(c.inputs),
        })),
        stock: inv
          .entries()
          .filter(([id]) => !id.startsWith('seed:'))
          .map(([id, count]) => ({ id, name: state.itemName(id), count })),
        hint: '点一块地干活：荒地先开荒，翻地时能挖到蚯蚓　·　选一种种子，再点翻好的地',
      },
    });
  }

  private clockText(): string {
    const s = this.ctx.state;
    const c = s.clock;
    return `第 ${c.day + 1} 天 · ${SEASON_NAMES[c.season]} · ${c.formatTime()} · ${WEATHER_NAMES[s.weather]}`;
  }

  private toast(text: string, tone: 'good' | 'bad' | 'info'): void {
    this.ctx.ui.set({ toast: { id: ++this.toastId, text, tone } });
  }

  override resize(view: ViewSize): void {
    if (view.width === this.view.width && view.height === this.view.height) return;
    this.view = { ...view };
    this.layout();
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.unsubscribe?.();
    this.ctx.ui.set({ farm: null });
    const ground = this.ground;
    super.exit();
    ground?.destroy(true);
  }

  /** 截图机器人用 */
  debugInfo(): Record<string, unknown> {
    return {
      plots: this.ctx.state.plots.map((p) => `${p.stage}:${p.cropId ?? ''}:${p.grown}`),
      worms: this.ctx.state.inventory.count('worm'),
      tool: this.toolId,
    };
  }
}
