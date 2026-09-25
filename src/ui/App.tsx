import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameCommand } from '../app/commands';
import type { Store } from '../app/store';
import type { CatchCardUi, FishingUi, PondUi, UiState } from './uiState';

type Send = (cmd: GameCommand) => void;

function useUi<T>(store: Store<UiState>, select: (s: UiState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

export function App({ store, send }: { store: Store<UiState>; send: Send }) {
  const scene = useUi(store, (s) => s.scene);
  const watch = useUi(store, (s) => s.watchMode);
  const debug = useUi(store, (s) => s.debug);
  const tuningOpen = useUi(store, (s) => s.tuningOpen);

  return (
    <div className={`ui-root${watch ? ' is-watching' : ''}`}>
      <Plaque store={store} />
      <MapButton store={store} send={send} />
      {scene === 'pond' && <PondHud store={store} send={send} />}
      {scene === 'fishing' && <FishingHud store={store} send={send} />}
      <ToastView store={store} />
      {debug && <DebugPanel store={store} />}
      {tuningOpen && <TuningPanel store={store} send={send} />}
      <button className="watch-exit" onClick={() => send({ type: 'toggleWatch' })}>
        退出观鱼（H）
      </button>
      <DaySummaryCard store={store} send={send} />
      <div className="rotate-hint">把手机横过来玩更舒服</div>
    </div>
  );
}

function Plaque({ store }: { store: Store<UiState> }) {
  const title = useUi(store, (s) => s.sceneTitle);
  const subtitle = useUi(store, (s) => s.sceneSubtitle);
  const clock = useUi(store, (s) => s.clockText);
  const money = useUi(store, (s) => s.money);
  if (!title) return null;
  return (
    <div className="plaque">
      <div className="plaque-title">
        {title}
        {subtitle && <span className="plaque-pos">· {subtitle}</span>}
        <span className="plaque-money">¥{money}</span>
      </div>
      {clock && <div className="plaque-sub">{clock}</div>}
    </div>
  );
}

function MapButton({ store, send }: { store: Store<UiState>; send: Send }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button className="nav-button card" onClick={() => setOpen(true)}>
        地图<kbd>M</kbd>
      </button>
      {open && <MapPanel store={store} send={send} onClose={() => setOpen(false)} />}
    </>
  );
}

/** 夹在外公笔记里的手绘地图：点一个地方就走过去 */
function MapPanel({
  store,
  send,
  onClose,
}: {
  store: Store<UiState>;
  send: Send;
  onClose: () => void;
}) {
  const places = useUi(store, (s) => s.places);
  const clock = useUi(store, (s) => s.clockText);
  // 睡觉和重新开始都要再点一次确认（网页版里浏览器的确认框可能被拦掉）
  const [confirm, setConfirm] = useState<'sleep' | 'reset' | null>(null);
  return (
    <div className="map-backdrop" onClick={onClose}>
      <div className="map card" onClick={(e) => e.stopPropagation()}>
        <div className="map-head">
          <span className="map-title">柳溪村</span>
          <span className="map-clock">{clock}</span>
          <button className="map-close" onClick={onClose} aria-label="关上地图">
            ×
          </button>
        </div>
        <div className="map-paper">
          <MapArt />
          {places.map((p) => (
            <button
              key={p.id}
              className={`map-pin${p.here ? ' is-here' : ''}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              title={p.note}
              disabled={p.here}
              onClick={() => {
                send({ type: 'travel', placeId: p.id });
                onClose();
              }}
            >
              <span className="map-pin-dot" />
              <span className="map-pin-name">{p.name}</span>
              <span className="map-pin-time">
                {p.here ? '你在这里' : p.minutes > 0 ? `走 ${p.minutes} 分钟` : '就在旁边'}
              </span>
            </button>
          ))}
        </div>
        <div className="map-footer">
          <button
            onClick={() => {
              if (confirm !== 'sleep') return setConfirm('sleep');
              send({ type: 'sleep' });
              onClose();
            }}
          >
            {confirm === 'sleep' ? '确定结束今天？再点一次' : '回家睡觉（结束今天）'}
          </button>
          <button
            className="map-reset"
            onClick={() => {
              if (confirm !== 'reset') return setConfirm('reset');
              send({ type: 'newGame' });
              onClose();
            }}
          >
            {confirm === 'reset' ? '存档会清掉，再点一次确定' : '重新开始'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 地图上的小溪、小路、房子（手绘风格的占位画） */
function MapArt() {
  return (
    <svg className="map-art" viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden>
      <path className="map-river" d="M-2 10 C 15 6, 25 20, 40 15 S 62 8, 72 17 S 92 30, 102 24" />
      <path className="map-road" d="M30 38 C 38 30, 45 24, 52 17" />
      <path className="map-road" d="M30 38 C 45 42, 60 36, 78 37" />
      <path className="map-road" d="M16 27 C 20 32, 25 36, 30 38" />
      <g className="map-house">
        <path d="M19 44 l4.5 -3.5 l4.5 3.5 v5 h-9 z" />
      </g>
      <g className="map-house">
        <path d="M72 46 l4 -3 l4 3 v4 h-8 z" />
        <path d="M81 47 l3 -2.5 l3 2.5 v3.5 h-6 z" />
        <path d="M66 48 l3 -2.5 l3 2.5 v3.5 h-6 z" />
      </g>
      <g className="map-field">
        <path d="M6 20 h9 v5.5 h-9 z M6 21.8 h9 M6 23.6 h9" />
      </g>
      <ellipse className="map-pond" cx="30" cy="40" rx="4.5" ry="2.6" />
    </svg>
  );
}

function DaySummaryCard({ store, send }: { store: Store<UiState>; send: Send }) {
  const summary = useUi(store, (s) => s.daySummary);
  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        send({ type: 'dismissSummary' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summary, send]);
  if (!summary) return null;
  return (
    <div className="catch-backdrop">
      <div className="summary card">
        <h2>{summary.title}</h2>
        <ul>
          {summary.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div className="summary-tomorrow">明天 · {summary.tomorrow}</div>
        <div className="catch-actions">
          <button className="primary" onClick={() => send({ type: 'dismissSummary' })}>
            起床
            <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function PondHud({ store, send }: { store: Store<UiState>; send: Send }) {
  const hint = useUi(store, (s) => s.hint);
  const pond = useUi(store, (s) => s.pond);
  const [open, setOpen] = useState(false);
  const hasFish = (pond?.keepNet.length ?? 0) > 0;
  return (
    <>
      {hint && <div className="hint card">{hint}</div>}
      {pond && (
        <div className="pond-count card">
          <div className="keepnet-label">{pond.name}</div>
          <div className="keepnet-count">
            {pond.count}
            <span>/{pond.capacity} 条</span>
          </div>
        </div>
      )}
      {pond && hasFish && (
        <button className="keepnet-button card" onClick={() => setOpen(!open)}>
          鱼护里有 {pond.keepNet.length} 条鱼
          <span>{open ? '收起' : '看看'}</span>
        </button>
      )}
      {pond && hasFish && open && <KeepNetPanel pond={pond} send={send} />}
      <button className="watch-button card" onClick={() => send({ type: 'toggleWatch' })}>
        观鱼
      </button>
    </>
  );
}

function KeepNetPanel({ pond, send }: { pond: PondUi; send: Send }) {
  const room = pond.capacity - pond.count;
  return (
    <div className="keepnet-panel card">
      <div className="keepnet-panel-title">
        鱼护
        <span>{room > 0 ? `塘里还能养 ${room} 条` : '塘里满了，以后可以扩建鱼塘'}</span>
      </div>
      <ul>
        {pond.keepNet.map((f) => (
          <li key={f.uid}>
            <img src={f.image} alt={f.name} />
            <div className="keepnet-fish">
              <b>{f.name}</b>
              <span>{f.weightText}</span>
            </div>
            <button
              className="primary"
              disabled={room <= 0}
              onClick={() => send({ type: 'releaseToPond', uid: f.uid })}
            >
              放进塘里
            </button>
            <button onClick={() => send({ type: 'releaseToWild', uid: f.uid })}>放生</button>
          </li>
        ))}
      </ul>
      {pond.keepNet.length > 1 && room > 0 && (
        <button
          className="primary keepnet-all"
          onClick={() => send({ type: 'releaseToPond', uid: 'all' })}
        >
          全部放进塘里
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 钓鱼

function FishingHud({ store, send }: { store: Store<UiState>; send: Send }) {
  const fishing = useUi(store, (s) => s.fishing);
  const fightActive = useUi(store, (s) => s.fightActive);
  const card = useUi(store, (s) => s.catchCard);
  const sense = useUi(store, (s) => s.sense);
  if (!fishing) return null;
  return (
    <>
      <PositionTabs fishing={fishing} send={send} />
      <BaitBar fishing={fishing} send={send} />
      <div className="keepnet card">
        <div className="keepnet-label">鱼护</div>
        <div className="keepnet-count">
          {fishing.keepNet}
          <span>/{fishing.keepNetCapacity}</span>
        </div>
      </div>
      {!fightActive && !card && fishing.hint && (
        <div className="hint card fishing-hint">{fishing.hint}</div>
      )}
      {sense && !card && <div className="sense">胡须动了动……附近好像有少见的鱼</div>}
      {fightActive && <TensionMeter store={store} />}
      {card && <CatchCard card={card} send={send} />}
    </>
  );
}

function PositionTabs({ fishing, send }: { fishing: FishingUi; send: Send }) {
  return (
    <div className="tabs">
      {fishing.positions.map((p) => (
        <button
          key={p.id}
          className={`tab${p.id === fishing.positionId ? ' is-active' : ''}`}
          title={p.note}
          onClick={() => send({ type: 'selectPosition', positionId: p.id })}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function BaitBar({ fishing, send }: { fishing: FishingUi; send: Send }) {
  return (
    <div className="baits card">
      <div className="baits-label">饵料</div>
      {fishing.baits.map((b, i) => (
        <button
          key={b.id}
          className={`bait${b.id === fishing.baitId ? ' is-active' : ''}${b.count === 0 ? ' is-empty' : ''}`}
          title={b.note}
          disabled={b.count === 0}
          onClick={() => send({ type: 'selectBait', baitId: b.id })}
        >
          <span className="bait-key">{i + 1}</span>
          {b.name}
          <span className="bait-count">{b.count}</span>
        </button>
      ))}
    </div>
  );
}

const METER_MAX = 1.2;

function TensionMeter({ store }: { store: Store<UiState> }) {
  const tension = useUi(store, (s) => s.tension);
  const stamina = useUi(store, (s) => s.stamina);
  const reel = useUi(store, (s) => s.reel);
  const side = useUi(store, (s) => s.sideHint);
  const touch = useUi(store, (s) => s.touch);
  const snag = useUi(store, (s) => s.snag);
  const danger = tension > 0.85;
  const slack = tension < 0.12;
  const pct = (v: number) => `${(Math.min(METER_MAX, v) / METER_MAX) * 100}%`;
  const mash = touch ? '连点屏幕' : '狂按空格';
  const state =
    snag > 0.25
      ? '鱼往水草里钻，快往反方向带竿！'
      : danger
        ? '太紧了，停一停！'
        : slack
          ? `线松了，${mash}！`
          : '稳住';
  return (
    <div className={`meter${danger || snag > 0.25 ? ' is-danger' : ''}${slack ? ' is-slack' : ''}`}>
      <div className="meter-main">
        <div className="meter-label">
          <span>张力</span>
          <span className="meter-state">{state}</span>
        </div>
        <div className="meter-bar">
          <div className="zone slack" style={{ left: 0, width: pct(0.12) }} />
          <div
            className="zone low"
            style={{ left: pct(0.12), width: `calc(${pct(0.3)} - ${pct(0.12)})` }}
          />
          <div
            className="zone sweet"
            style={{ left: pct(0.3), width: `calc(${pct(0.85)} - ${pct(0.3)})` }}
          />
          <div
            className="zone warn"
            style={{ left: pct(0.85), width: `calc(${pct(1)} - ${pct(0.85)})` }}
          />
          <div className="zone snap" style={{ left: pct(1), right: 0 }} />
          <div className="meter-marker" style={{ left: pct(tension) }} />
        </div>
        <div className="gauges">
          <div className="gauge reel">
            <span>收线</span>
            <div className="gauge-bar">
              <div style={{ width: `${Math.round(reel * 100)}%` }} />
            </div>
          </div>
          <div className="gauge stamina">
            <span>鱼的体力</span>
            <div className="gauge-bar">
              <div style={{ width: `${Math.round(stamina * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="meter-help">
          {touch
            ? '连点屏幕收线，停手放线 · 点在哪边，竿就往哪边带'
            : '狂按空格收线，停手放线 · 鼠标往鱼窜的反方向带竿'}
        </div>
      </div>
      <div className="meter-side">
        {side < 0 && <span>{touch ? '← 点左边带竿' : '← 鼠标往左带'}</span>}
        {side > 0 && <span>{touch ? '点右边带竿 →' : '鼠标往右带 →'}</span>}
      </div>
    </div>
  );
}

function CatchCard({ card, send }: { card: CatchCardUi; send: Send }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'KeyE') && !card.keepNetFull)
        send({ type: 'catchDecision', keep: true });
      else if (e.code === 'KeyR' || e.code === 'Escape')
        send({ type: 'catchDecision', keep: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, send]);
  return (
    <div className="catch-backdrop">
      <div className="catch card">
        <div className="catch-badges">
          {card.newSpecies && <span className="badge new">外公笔记 · 新的一页</span>}
          {card.newRecord && <span className="badge record">新纪录</span>}
          {card.trophy && <span className="badge trophy">大家伙</span>}
        </div>
        <img className="catch-image" src={card.image} alt={card.name} />
        <div className="catch-title">
          <h2>{card.name}</h2>
          <span className="rarity">{card.rarityText}</span>
        </div>
        <div className="catch-stats">
          {card.weightText} · {card.lengthText} · 估价 ¥{card.price}
        </div>
        <p className="catch-note">外公的笔记：「{card.note}」</p>
        <div className="catch-actions">
          <button
            className="primary"
            disabled={card.keepNetFull}
            onClick={() => send({ type: 'catchDecision', keep: true })}
          >
            {card.keepNetFull ? '鱼护满了' : '放进鱼护'}
            <kbd>E</kbd>
          </button>
          <button onClick={() => send({ type: 'catchDecision', keep: false })}>
            放生
            <kbd>R</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 通用

function ToastView({ store }: { store: Store<UiState> }) {
  const toast = useUi(store, (s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast card tone-${toast.tone}${visible ? ' is-visible' : ''}`}>
      {toast.text}
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
      <div className="debug-tip">F2 调参面板</div>
    </div>
  );
}

const TUNING_KEYS: { key: string; label: string; min: number; max: number; step: number }[] = [
  { key: 'riseRate', label: '收线时张力上升', min: 0.2, max: 2, step: 0.05 },
  { key: 'pullRiseRate', label: '鱼猛冲时张力上升', min: 0, max: 4, step: 0.1 },
  { key: 'fallRate', label: '放线时张力下降', min: 0.2, max: 3, step: 0.05 },
  { key: 'reelBase', label: '收线基础张力', min: 0.2, max: 0.8, step: 0.01 },
  { key: 'reelPullGain', label: '鱼的拉力 → 张力', min: 0.2, max: 1.2, step: 0.02 },
  { key: 'slackGrace', label: '松线多久脱钩（秒）', min: 0.5, max: 4, step: 0.1 },
  { key: 'breakGrace', label: '超限多久断线（秒）', min: 0.05, max: 1, step: 0.01 },
  { key: 'staminaDrain', label: '鱼体力消耗倍率', min: 0.3, max: 3, step: 0.05 },
  { key: 'swimSpeed', label: '鱼往外游的速度', min: 30, max: 250, step: 5 },
  { key: 'holdRange', label: '有力气时保持的距离', min: 0, max: 500, step: 10 },
  { key: 'leverage', label: '反方向带竿卸力', min: 0, max: 0.8, step: 0.01 },
  { key: 'snagRate', label: '钻底时钻草速度', min: 0, max: 2, step: 0.05 },
  { key: 'lowDrain', label: '张力偏低时体力消耗', min: 0, max: 1, step: 0.05 },
];

function TuningPanel({ store, send }: { store: Store<UiState>; send: Send }) {
  const tuning = useUi(store, (s) => s.tuning);
  return (
    <div className="tuning card">
      <div className="tuning-title">调参面板（F2 关闭）</div>
      <div className="tuning-actions">
        <button onClick={() => send({ type: 'debug', action: 'addHour' })}>+1 小时</button>
        <button onClick={() => send({ type: 'debug', action: 'cycleWeather' })}>换天气</button>
        <button onClick={() => send({ type: 'debug', action: 'spawnRare' })}>来条稀有鱼</button>
        <button onClick={() => send({ type: 'debug', action: 'sleep' })}>睡到明天</button>
      </div>
      {TUNING_KEYS.map((t) => (
        <label key={t.key} className="tuning-row">
          <span>{t.label}</span>
          <input
            type="range"
            min={t.min}
            max={t.max}
            step={t.step}
            value={tuning[t.key] ?? 0}
            onChange={(e) =>
              send({ type: 'debug', action: 'setParam', key: t.key, value: Number(e.target.value) })
            }
          />
          <em>{(tuning[t.key] ?? 0).toFixed(2)}</em>
        </label>
      ))}
      <div className="tuning-tip">改动对下一次遛鱼生效</div>
    </div>
  );
}
