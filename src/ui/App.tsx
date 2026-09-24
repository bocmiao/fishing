import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameCommand } from '../app/commands';
import type { Store } from '../app/store';
import type { CatchCardUi, FishingUi, UiState } from './uiState';

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
      <NavButton scene={scene} send={send} />
      {scene === 'pond' && <PondHud store={store} />}
      {scene === 'fishing' && <FishingHud store={store} send={send} />}
      <ToastView store={store} />
      {debug && <DebugPanel store={store} />}
      {tuningOpen && <TuningPanel store={store} send={send} />}
      <div className="watch-hint">按 H 退出观鱼模式</div>
    </div>
  );
}

function Plaque({ store }: { store: Store<UiState> }) {
  const title = useUi(store, (s) => s.sceneTitle);
  const subtitle = useUi(store, (s) => s.sceneSubtitle);
  const clock = useUi(store, (s) => s.clockText);
  if (!title) return null;
  return (
    <div className="plaque">
      <div className="plaque-title">
        {title}
        {subtitle && <span className="plaque-pos">· {subtitle}</span>}
      </div>
      {clock && <div className="plaque-sub">{clock}</div>}
    </div>
  );
}

function NavButton({ scene, send }: { scene: string; send: Send }) {
  if (scene === 'pond') {
    return (
      <button className="nav-button card" onClick={() => send({ type: 'goto', scene: 'fishing' })}>
        去屋后小溪钓鱼 →
      </button>
    );
  }
  if (scene === 'fishing') {
    return (
      <button className="nav-button card" onClick={() => send({ type: 'goto', scene: 'pond' })}>
        ← 回锦鲤池
      </button>
    );
  }
  return null;
}

function PondHud({ store }: { store: Store<UiState> }) {
  const hint = useUi(store, (s) => s.hint);
  return <>{hint && <div className="hint card">{hint}</div>}</>;
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
          className={`bait${b.id === fishing.baitId ? ' is-active' : ''}`}
          title={b.note}
          onClick={() => send({ type: 'selectBait', baitId: b.id })}
        >
          <span className="bait-key">{i + 1}</span>
          {b.name}
        </button>
      ))}
    </div>
  );
}

const METER_MAX = 1.2;

function TensionMeter({ store }: { store: Store<UiState> }) {
  const tension = useUi(store, (s) => s.tension);
  const stamina = useUi(store, (s) => s.stamina);
  const side = useUi(store, (s) => s.sideHint);
  const danger = tension > 0.85;
  const slack = tension < 0.12;
  const pct = (v: number) => `${(Math.min(METER_MAX, v) / METER_MAX) * 100}%`;
  return (
    <div className={`meter${danger ? ' is-danger' : ''}${slack ? ' is-slack' : ''}`}>
      <div className="meter-main">
        <div className="meter-label">
          <span>张力</span>
          <span className="meter-state">
            {danger ? '太紧了，快松手！' : slack ? '线松了，快收线！' : '稳住'}
          </span>
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
        <div className="stamina">
          <span>鱼的体力</span>
          <div className="stamina-bar">
            <div style={{ width: `${Math.round(stamina * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className="meter-side">
        {side < 0 && <span>← 鼠标往左带</span>}
        {side > 0 && <span>鼠标往右带 →</span>}
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
