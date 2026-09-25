/**
 * 界面跟着窗口缩放：界面按 1920×1080 设计，窗口变小或变大时整体缩放，
 * 贴着窗口四角摆放（不跟着画面留黑边）。手机上最小缩到 0.55，保证字还能看清。
 */
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2;

export function applyUiScale(el: HTMLElement): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(w / DESIGN_W, h / DESIGN_H)));
  const logicalW = w / scale;
  el.style.width = `${logicalW}px`;
  el.style.height = `${h / scale}px`;
  el.style.transform = `scale(${scale})`;
  // 窄屏（手机竖着拿）时换一种排布，避免界面挤在一起
  el.classList.toggle('is-narrow', logicalW < 1100);
  el.classList.toggle('is-portrait', h > w);
}

export function watchUiScale(el: HTMLElement): void {
  applyUiScale(el);
  window.addEventListener('resize', () => applyUiScale(el));
}
