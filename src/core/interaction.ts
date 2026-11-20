import { createSpring } from "./spring";

export interface AccessibilityState {
  reduceTransparency: boolean;
  increaseContrast: boolean;
  reduceMotion: boolean;
}

const a11yState: AccessibilityState = {
  reduceTransparency: false,
  increaseContrast: false,
  reduceMotion: false,
};

export function getAccessibilityModes(): AccessibilityState {
  return { ...a11yState };
}

export function setAccessibilityModes(modes: Partial<AccessibilityState>): AccessibilityState {
  if (modes.reduceTransparency !== undefined) a11yState.reduceTransparency = modes.reduceTransparency;
  if (modes.increaseContrast !== undefined) a11yState.increaseContrast = modes.increaseContrast;
  if (modes.reduceMotion !== undefined) a11yState.reduceMotion = modes.reduceMotion;

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (a11yState.reduceTransparency) root.setAttribute("data-a11y-transparency", "reduce");
    else root.removeAttribute("data-a11y-transparency");

    if (a11yState.increaseContrast) root.setAttribute("data-a11y-contrast", "high");
    else root.removeAttribute("data-a11y-contrast");

    if (a11yState.reduceMotion) root.setAttribute("data-a11y-motion", "reduce");
    else root.removeAttribute("data-a11y-motion");
  }
  return getAccessibilityModes();
}

export interface PressFeel {
  growPx: number;
  press: readonly [number, number];
  release: readonly [number, number];
}

const POINTER_FEEL: PressFeel = { growPx: 6, press: [420, 29], release: [240, 23] };
const TOUCH_FEEL: PressFeel = { growPx: 15, press: [515, 27], release: [250, 12] };

/**
 * Adds Fluid Glass tactile physics & internal pointer-contact illumination:
 * 1. Pressing tracks contact (x, y) into `--lg-x` and `--lg-y` so the glass glows from inside under the pointer.
 * 2. Rubber-band anisotropic spring scale & translate bounces back past resting size on release.
 */
export function attachInteractivePress(
  element: HTMLElement,
  options: { disabledCheck?: () => boolean } = {},
): () => void {
  const state = [1, 1, 0, 0];
  const paint = () => {
    element.style.scale = `${state[0]!.toFixed(4)} ${state[1]!.toFixed(4)}`;
    element.style.translate = `${state[2]!.toFixed(2)}px ${state[3]!.toFixed(2)}px`;
  };

  const springs = state.map((init, idx) =>
    createSpring(init, POINTER_FEEL.release[0], POINTER_FEEL.release[1], (v) => {
      state[idx] = v;
      paint();
    }),
  );

  let activePointer: { id: number; startX: number; startY: number; box: DOMRect; feel: PressFeel } | null = null;

  const setTargets = (targets: readonly number[], tuning: readonly [number, number]) => {
    springs.forEach((sp, idx) => {
      sp.tune(tuning[0], tuning[1]);
      sp.set(targets[idx] ?? 0);
    });
  };

  const updatePointer = (ev: PointerEvent) => {
    if (!activePointer) return;
    const { box, feel } = activePointer;
    const relX = box.width > 0 ? ((ev.clientX - box.left) / box.width) * 100 : 50;
    const relY = box.height > 0 ? ((ev.clientY - box.top) / box.height) * 100 : 50;
    element.style.setProperty("--lg-x", `${Math.max(0, Math.min(100, relX)).toFixed(1)}%`);
    element.style.setProperty("--lg-y", `${Math.max(0, Math.min(100, relY)).toFixed(1)}%`);

    const w = Math.max(1, box.width);
    const h = Math.max(1, box.height);
    const base = 1 + feel.growPx / Math.max(w, h);
    const aspect = w / h;
    const dx = (ev.clientX - activePointer.startX) / aspect;
    const dy = ev.clientY - activePointer.startY;
    const len = Math.hypot(dx, dy);

    if (len < 0.5) {
      setTargets([base, base, 0, 0], feel.press);
      return;
    }

    const nx = dx / len;
    const ny = dy / len;
    const rubber = 1 - 1 / (1 + len / h / (5 * aspect));
    const stretch = 1 + (6 / h) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
    const horizontal = Math.abs(nx) > Math.abs(ny);

    setTargets(
      [
        base * (horizontal ? stretch : 1 / stretch),
        base * (horizontal ? 1 / stretch : stretch),
        nx * 8 * rubber,
        ny * 8 * rubber,
      ],
      feel.press,
    );
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId === activePointer?.id) updatePointer(ev);
  };

  const onEnd = (ev?: PointerEvent) => {
    if (ev && ev.pointerId !== activePointer?.id) return;
    const feel = activePointer?.feel ?? POINTER_FEEL;
    activePointer = null;
    delete element.dataset.pressed;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    setTargets([1, 1, 0, 0], feel.release);
  };

  const onDown = (ev: PointerEvent) => {
    if (!ev.isPrimary || ev.button !== 0 || activePointer) return;
    if (options.disabledCheck?.() || element.matches(":disabled")) return;
    activePointer = {
      id: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      box: element.getBoundingClientRect(),
      feel: ev.pointerType === "mouse" ? POINTER_FEEL : TOUCH_FEEL,
    };
    element.dataset.pressed = "";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    updatePointer(ev);
  };

  const onReset = () => onEnd();
  element.addEventListener("pointerdown", onDown);
  window.addEventListener("blur", onReset);

  return () => {
    onEnd();
    springs.forEach((sp) => sp.stop());
    element.removeEventListener("pointerdown", onDown);
    window.removeEventListener("blur", onReset);
    element.style.removeProperty("scale");
    element.style.removeProperty("translate");
  };
}

function normalizeAngleDeg(deg: number): number {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && deg > 0 ? 180 : wrapped;
}

/**
 * Listens to pointer parallax & device gyroscope tilt to smoothly rotate the virtual specular light angle
 * on TrueGlass rims ("in some places they move when you tilt your device").
 */
export function attachVirtualTiltLight(
  onAngleChange: (angleDeg: number) => void,
  initialAngleDeg = -135,
): () => void {
  if (typeof window === "undefined") return () => {};

  let stopped = false;
  let currentAngle = initialAngleDeg;
  let lastEmitted = Number.NaN;

  const angleSpring = createSpring(currentAngle, 120, 20, (deg) => {
    currentAngle = deg;
    if (stopped) return;
    if (!Number.isNaN(lastEmitted) && Math.abs(deg - lastEmitted) < 0.2) return;
    lastEmitted = deg;
    onAngleChange(normalizeAngleDeg(deg));
  });

  const steerTo = (rawDeg: number) => {
    if (stopped) return;
    const delta = ((((rawDeg - currentAngle) % 360) + 540) % 360) - 180;
    if (Math.abs(delta) < 0.25) return;
    angleSpring.set(currentAngle + delta);
  };

  const onPointerMove = (ev: PointerEvent) => {
    const nx = (ev.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = (ev.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    if (nx * nx + ny * ny < 0.0025) return;
    steerTo((Math.atan2(ny, nx) * 180) / Math.PI);
  };

  const onDeviceOrientation = (ev: DeviceOrientationEvent) => {
    if (ev.gamma === null || ev.beta === null) return;
    steerTo((Math.atan2(ev.beta - 35, ev.gamma) * 180) / Math.PI);
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });

  return () => {
    stopped = true;
    angleSpring.stop();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("deviceorientation", onDeviceOrientation);
  };
}
