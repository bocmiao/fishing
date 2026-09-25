import type { Rng } from '../../sim/rng/rng';

/**
 * 锦鲤群游：分离 / 对齐 / 聚合 + 随机游荡 + 避开边界 + 抢食。
 * 这是纯视觉行为（不影响存档），所以放在渲染层；随机数仍然用可设种子的 Rng。
 */
export interface FishAgent {
  id: number;
  /** 头（吻端）的位置 */
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** 平时巡游的速度 */
  cruise: number;
  /** 体长（像素） */
  length: number;
  /** 0 = 贴着水面，1 = 贴着池底 */
  depth: number;
  targetDepth: number;
  wanderAngle: number;
  /** 摆尾相位 */
  phase: number;
  /** 当前用力程度 0~1，决定摆尾幅度 */
  effort: number;
  /** 最近吃了多少（会慢慢消化） */
  satiety: number;
  /** 一共吃了多少粒 */
  eaten: number;
  /** 胆量：越大对鱼食反应越快 */
  boldness: number;
  /** 发现鱼食前的延迟（秒） */
  noticeDelay: number;
  /** 正在追的那粒鱼食 */
  target: FoodItem | null;
  /** 性格节奏：用于偶尔停下、偶尔加速 */
  moodTimer: number;
  moodSpeed: number;
}

export interface FoodItem {
  x: number;
  y: number;
  alive: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlockParams {
  perception: number;
  alignWeight: number;
  cohesionWeight: number;
  separationWeight: number;
  wanderWeight: number;
  boundaryMargin: number;
  boundaryWeight: number;
  foodRadius: number;
  chaseSpeed: number;
  turnRate: number;
  chaseTurnRate: number;
  /** 超过这个饱腹度就不再追鱼食 */
  fullSatiety: number;
}

export const DEFAULT_FLOCK_PARAMS: FlockParams = {
  perception: 200,
  alignWeight: 0.55,
  cohesionWeight: 0.35,
  separationWeight: 2.4,
  wanderWeight: 0.7,
  boundaryMargin: 140,
  boundaryWeight: 3.2,
  foodRadius: 540,
  chaseSpeed: 150,
  turnRate: 1.5,
  chaseTurnRate: 3.6,
  fullSatiety: 7,
};

const TAU = Math.PI * 2;

/** 鱼头把鱼食往前推一点（鱼食需要有速度字段才会被推动） */
function nudge(item: FoodItem, a: FishAgent): void {
  const moving = item as FoodItem & { vx?: number; vy?: number };
  if (moving.vx === undefined || moving.vy === undefined) return;
  moving.vx += Math.cos(a.heading) * a.speed * 0.02;
  moving.vy += Math.sin(a.heading) * a.speed * 0.02;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return d;
}

export class Flock {
  readonly agents: FishAgent[] = [];
  bounds: Rect;
  /** 鱼要绕开的区域（例如栈台下方） */
  avoid: Rect[] = [];
  params: FlockParams = { ...DEFAULT_FLOCK_PARAMS };
  private nextId = 1;

  constructor(
    bounds: Rect,
    private readonly rng: Rng,
  ) {
    this.bounds = bounds;
  }

  /** 放一条鱼；不给位置就在水里随便找个地方 */
  spawn(length: number, at?: { x: number; y: number; heading: number }): FishAgent {
    const rng = this.rng;
    const b = this.bounds;
    const m = this.params.boundaryMargin;
    let x = at?.x ?? 0;
    let y = at?.y ?? 0;
    for (let tries = 0; !at && tries < 20; tries++) {
      x = rng.range(b.x + m, b.x + b.w - m);
      y = rng.range(b.y + m, b.y + b.h - m);
      if (!this.avoid.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)) break;
    }
    const agent: FishAgent = {
      id: this.nextId++,
      x,
      y,
      heading: at?.heading ?? rng.range(0, TAU),
      speed: 0,
      cruise: rng.range(22, 42) * (0.8 + length / 400),
      length,
      depth: rng.range(0.2, 0.9),
      targetDepth: rng.range(0.2, 0.9),
      wanderAngle: 0,
      phase: rng.range(0, TAU),
      effort: 0,
      satiety: rng.range(0, 2),
      eaten: 0,
      boldness: rng.range(0.6, 1.4),
      noticeDelay: 0,
      target: null,
      moodTimer: rng.range(0, 6),
      moodSpeed: 1,
    };
    agent.speed = agent.cruise;
    this.agents.push(agent);
    return agent;
  }

  /** 撒下鱼食时调用：附近的鱼经过一小段延迟后才会注意到 */
  alertFood(x: number, y: number): void {
    for (const a of this.agents) {
      if (a.target) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d > this.params.foodRadius * 1.3) continue;
      a.noticeDelay = this.rng.range(0.05, 0.9) / a.boldness + d / 700;
    }
  }

  update(
    dt: number,
    food: readonly FoodItem[],
    onEat: (agent: FishAgent, item: FoodItem) => void,
  ): void {
    const p = this.params;
    const rng = this.rng;
    const agents = this.agents;
    const perception2 = p.perception * p.perception;
    const b = this.bounds;

    for (const a of agents) {
      // ---- 周围的鱼 ----
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let count = 0;
      for (const o of agents) {
        if (o === a) continue;
        const dx = o.x - a.x;
        const dy = o.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > perception2) continue;
        const d = Math.sqrt(d2) || 0.001;
        count++;
        aliX += Math.cos(o.heading);
        aliY += Math.sin(o.heading);
        cohX += o.x;
        cohY += o.y;
        // 深度差得多的鱼可以上下错开，不必完全避让
        const depthOverlap = 1 - Math.min(1, Math.abs(o.depth - a.depth) * 1.6);
        const sepDist = (a.length + o.length) * 0.42;
        if (d < sepDist) {
          const k = (1 - d / sepDist) * (0.35 + 0.65 * depthOverlap);
          sepX -= (dx / d) * k;
          sepY -= (dy / d) * k;
        }
      }

      let dirX = Math.cos(a.heading) * 1.2;
      let dirY = Math.sin(a.heading) * 1.2;

      // ---- 鱼食 ----
      if (a.target && !a.target.alive) a.target = null;
      if (a.noticeDelay > 0) {
        a.noticeDelay -= dt;
        if (a.noticeDelay <= 0) a.noticeDelay = 0;
      }
      const hungry = a.satiety < p.fullSatiety;
      if (hungry && a.noticeDelay === 0 && food.length > 0) {
        let best: FoodItem | null = null;
        let bestD = p.foodRadius;
        for (const f of food) {
          if (!f.alive) continue;
          const d = Math.hypot(f.x - a.x, f.y - a.y);
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        a.target = best;
      } else if (!hungry) {
        a.target = null;
      }

      let chasing = false;
      if (a.target) {
        const dx = a.target.x - a.x;
        const dy = a.target.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const mouth = a.length * 0.1 + 7;
        // 到了嘴边也不一定一口吞下：有时会把鱼食拱开，抢食就会持续一会儿
        if (d < mouth && rng.chance(Math.min(1, dt * 7))) {
          a.target.alive = false;
          a.satiety += 1;
          a.eaten += 1;
          onEat(a, a.target);
          a.target = null;
        } else if (d < mouth * 1.8) {
          chasing = true;
          dirX += (dx / d) * 3.2;
          dirY += (dy / d) * 3.2;
          nudge(a.target, a);
        } else {
          chasing = true;
          const w = 3.2;
          dirX += (dx / d) * w;
          dirY += (dy / d) * w;
        }
      }

      // ---- 群体 ----
      if (count > 0) {
        const al = Math.hypot(aliX, aliY) || 1;
        const alignW = chasing ? p.alignWeight * 0.2 : p.alignWeight;
        dirX += (aliX / al) * alignW;
        dirY += (aliY / al) * alignW;
        const cx = cohX / count - a.x;
        const cy = cohY / count - a.y;
        const cl = Math.hypot(cx, cy) || 1;
        const cohW = chasing ? 0 : p.cohesionWeight;
        dirX += (cx / cl) * cohW;
        dirY += (cy / cl) * cohW;
      }
      dirX += sepX * p.separationWeight;
      dirY += sepY * p.separationWeight;

      // ---- 游荡 ----
      a.wanderAngle += rng.normal(0, 1.1) * dt * 2;
      a.wanderAngle *= 1 - Math.min(1, dt * 0.35);
      if (!chasing) {
        dirX += Math.cos(a.heading + a.wanderAngle) * p.wanderWeight;
        dirY += Math.sin(a.heading + a.wanderAngle) * p.wanderWeight;
      }

      // ---- 边界 ----
      const m = p.boundaryMargin;
      const push = (dist: number) => (dist < m ? ((m - dist) / m) ** 2 * p.boundaryWeight : 0);
      dirX += push(a.x - b.x) - push(b.x + b.w - a.x);
      dirY += push(a.y - b.y) - push(b.y + b.h - a.y);
      for (const r of this.avoid) {
        const pad = a.length * 0.6;
        if (a.x > r.x - pad && a.x < r.x + r.w + pad && a.y > r.y - pad && a.y < r.y + r.h + pad) {
          // 从最近的一边推出去
          const left = a.x - (r.x - pad);
          const right = r.x + r.w + pad - a.x;
          const top = a.y - (r.y - pad);
          const bottom = r.y + r.h + pad - a.y;
          const min = Math.min(left, right, top, bottom);
          const k = 2.5;
          if (min === left) dirX -= k;
          else if (min === right) dirX += k;
          else if (min === top) dirY -= k;
          else dirY += k;
        }
      }

      // ---- 转向与速度 ----
      // 转弯半径和体长相关：游得慢时转得也慢，身体不会卷成一团
      const desired = Math.atan2(dirY, dirX);
      const turn = angleDiff(desired, a.heading);
      const nearEdge =
        a.x < b.x + m * 0.45 ||
        a.x > b.x + b.w - m * 0.45 ||
        a.y < b.y + m * 0.45 ||
        a.y > b.y + b.h - m * 0.45;
      const radius = a.length * (chasing ? 0.45 : nearEdge ? 0.5 : 0.95);
      const rate = Math.min(chasing ? p.chaseTurnRate : p.turnRate, 0.22 + a.speed / radius);
      const maxTurn = rate * dt;
      a.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));

      a.moodTimer -= dt;
      if (a.moodTimer <= 0) {
        // 偶尔慢下来悬停，偶尔快游一段
        const r = rng.float();
        a.moodSpeed =
          r < 0.18 ? rng.range(0.15, 0.4) : r > 0.9 ? rng.range(1.4, 1.9) : rng.range(0.8, 1.15);
        a.moodTimer = rng.range(2.5, 8);
      }
      const targetSpeed = chasing
        ? p.chaseSpeed * (0.75 + 0.25 * a.boldness)
        : a.cruise * a.moodSpeed;
      const accel = targetSpeed > a.speed ? (chasing ? 3.5 : 1.2) : 0.8;
      a.speed += (targetSpeed - a.speed) * Math.min(1, dt * accel);

      a.x += Math.cos(a.heading) * a.speed * dt;
      a.y += Math.sin(a.heading) * a.speed * dt;

      // ---- 深度：抢食时浮到水面 ----
      if (chasing) a.targetDepth = 0.02;
      else if (rng.chance(dt * 0.08)) a.targetDepth = rng.range(0.25, 0.95);
      a.depth += (a.targetDepth - a.depth) * Math.min(1, dt * (chasing ? 1.6 : 0.25));

      // ---- 消化 ----
      a.satiety = Math.max(0, a.satiety - dt / 25);

      // ---- 摆尾 ----
      const turning = Math.min(1, Math.abs(turn) / 1.2);
      const effortTarget = Math.min(
        1,
        Math.max(0, (a.speed - a.cruise * 0.4) / (p.chaseSpeed * 0.8)) + turning * 0.35,
      );
      a.effort += (effortTarget - a.effort) * Math.min(1, dt * 3);
      const freq = 0.55 + a.speed / 55;
      a.phase += dt * freq * TAU;
    }
  }
}
