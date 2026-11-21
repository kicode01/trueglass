export interface Spring {
  get(): number;
  target(): number;
  paint(): void;
  set(nextTarget: number, instant?: boolean): void;
  tune(stiffness: number, damping: number): void;
  stop(): void;
}

interface SpringState {
  value: number;
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;
  onUpdate: (value: number) => void;
}

const activeSprings = new Set<SpringState>();
const activityListeners = new Set<() => void>();
let rafId = 0;
let lastTime = 0;

export function onSpringActivity(fn: () => void): void {
  activityListeners.add(fn);
}

function notifyActivity(): void {
  for (const fn of activityListeners) fn();
}

/** Closed-form exact analytical solver for x'' + c x' + k(x - target) = 0. */
export function advanceSpringState(s: Pick<SpringState, "value" | "target" | "velocity" | "stiffness" | "damping">, dt: number): void {
  if (dt <= 0) return;
  const x0 = s.value - s.target;
  const v0 = s.velocity;
  const half = s.damping * 0.5;
  const discriminant = half * half - s.stiffness;

  if (Math.abs(discriminant) < 1e-4) {
    const decay = Math.exp(-half * dt);
    const b = v0 + half * x0;
    s.value = s.target + decay * (x0 + b * dt);
    s.velocity = decay * (v0 - half * b * dt);
  } else if (discriminant > 0) {
    const root = Math.sqrt(discriminant);
    const r1 = -half + root;
    const r2 = -half - root;
    const a = (v0 - r2 * x0) / (r1 - r2);
    const b = x0 - a;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    s.value = s.target + a * e1 + b * e2;
    s.velocity = a * r1 * e1 + b * r2 * e2;
  } else {
    const omega = Math.sqrt(-discriminant);
    const decay = Math.exp(-half * dt);
    const cos = Math.cos(omega * dt);
    const sin = Math.sin(omega * dt);
    s.value = s.target + decay * (x0 * cos + ((v0 + half * x0) / omega) * sin);
    s.velocity = decay * (v0 * cos - ((half * v0 + s.stiffness * x0) / omega) * sin);
  }
}

function tick(now: number): void {
  rafId = 0;
  const dt = Math.min(0.064, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  for (const s of activeSprings) {
    advanceSpringState(s, dt);
    if (Math.abs(s.value - s.target) < 1e-4 && Math.abs(s.velocity) < 1e-3) {
      s.value = s.target;
      s.velocity = 0;
      activeSprings.delete(s);
    }
    s.onUpdate(s.value);
  }
  notifyActivity();

  if (activeSprings.size > 0) {
    rafId = requestAnimationFrame(tick);
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-a11y-motion") === "reduce") {
    return true;
  }
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export const isReducedMotion = prefersReducedMotion;

export function createSpring(
  initial: number,
  stiffness: number,
  damping: number,
  onUpdate: (value: number) => void,
): Spring {
  const s: SpringState = {
    value: initial,
    target: initial,
    velocity: 0,
    stiffness,
    damping,
    onUpdate,
  };

  return {
    get: () => s.value,
    target: () => s.target,
    paint: () => s.onUpdate(s.value),
    set(nextTarget: number, instant = false) {
      s.target = nextTarget;
      const hidden = typeof document !== "undefined" && document.hidden;
      if (instant || hidden || prefersReducedMotion()) {
        s.value = nextTarget;
        s.velocity = 0;
        activeSprings.delete(s);
        s.onUpdate(nextTarget);
        notifyActivity();
        return;
      }
      activeSprings.add(s);
      notifyActivity();
      if (!rafId && typeof requestAnimationFrame === "function") {
        lastTime = Number(
          (typeof document !== "undefined" && document.timeline?.currentTime) || performance.now(),
        );
        rafId = requestAnimationFrame(tick);
      }
    },
    tune(nextStiffness: number, nextDamping: number) {
      s.stiffness = nextStiffness;
      s.damping = nextDamping;
    },
    stop() {
      activeSprings.delete(s);
    },
  };
}
