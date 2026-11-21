import { createSpring, prefersReducedMotion } from "./spring";

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

  let activePointer: {
    id: number;
    startX: number;
    startY: number;
    box: DOMRect;
    feel: PressFeel;
    isTouch: boolean;
    pulledFar: boolean;
  } | null = null;
  let suppressClickUntil = 0;

  const setTargets = (targets: readonly number[], tuning: readonly [number, number]) => {
    springs.forEach((sp, idx) => {
      sp.tune(tuning[0], tuning[1]);
      sp.set(targets[idx] ?? 0);
    });
  };

  const updatePointer = (ev: PointerEvent) => {
    if (!activePointer) return;
    const { box, feel, isTouch } = activePointer;
    const relX = box.width > 0 ? ((ev.clientX - box.left) / box.width) * 100 : 50;
    const relY = box.height > 0 ? ((ev.clientY - box.top) / box.height) * 100 : 50;
    element.style.setProperty("--lg-x", `${Math.max(0, Math.min(100, relX)).toFixed(1)}%`);
    element.style.setProperty("--lg-y", `${Math.max(0, Math.min(100, relY)).toFixed(1)}%`);

    const rawDx = ev.clientX - activePointer.startX;
    const rawDy = ev.clientY - activePointer.startY;
    const pullThreshold = element.closest("[data-fusion-group]") ? 20 : 40;
    if (Math.hypot(rawDx, rawDy) > pullThreshold) activePointer.pulledFar = true;

    const w = Math.max(1, box.width);
    const h = Math.max(1, box.height);
    const base = 1 + feel.growPx / Math.max(w, h);
    const aspect = w / h;
    const dx = rawDx / aspect;
    const dy = rawDy;
    const len = Math.hypot(dx, dy);

    if (len < 0.5) {
      setTargets([base, base, 0, 0], feel.press);
      return;
    }

    const nx = dx / len;
    const ny = dy / len;
    const rubber = 1 - 1 / (1 + len / h / (5 * aspect));
    const inFusion = Boolean(element.closest("[data-fusion-group]"));
    const stretchGain = isTouch ? 9 : 6;
    const pullTravel = inFusion ? (isTouch ? 20 : 16) : isTouch ? 13 : 8;
    const stretch = 1 + (stretchGain / h) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
    const horizontal = Math.abs(nx) > Math.abs(ny);

    setTargets(
      [
        base * (horizontal ? stretch : 1 / stretch),
        base * (horizontal ? 1 / stretch : stretch),
        nx * pullTravel * rubber,
        ny * pullTravel * rubber,
      ],
      feel.press,
    );
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId === activePointer?.id) updatePointer(ev);
  };

  const onTouchMove = (ev: TouchEvent) => {
    if (activePointer && ev.cancelable) ev.preventDefault();
  };

  const onClickCapture = (ev: MouseEvent) => {
    if (ev.isTrusted && ev.detail !== 0 && performance.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  };

  const onEnd = (ev?: PointerEvent) => {
    if (ev && ev.pointerId !== activePointer?.id) return;
    const old = activePointer;
    const feel = old?.feel ?? POINTER_FEEL;
    activePointer = null;
    delete element.dataset.pressed;
    if (old) {
      if (element.hasPointerCapture?.(old.id)) {
        try {
          element.releasePointerCapture(old.id);
        } catch {
          // Ignore if already released
        }
      }
      if (ev && ev.type === "pointerup" && old.pulledFar) {
        const inFusion = Boolean(element.closest("[data-fusion-group]"));
        const slack = 28;
        const inside =
          ev.clientX >= old.box.left - slack &&
          ev.clientX <= old.box.right + slack &&
          ev.clientY >= old.box.top - slack &&
          ev.clientY <= old.box.bottom + slack;
        if (inFusion || !inside) suppressClickUntil = performance.now() + 400;
      }
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    setTargets([1, 1, 0, 0], feel.release);
  };

  const onDown = (ev: PointerEvent) => {
    if (!ev.isPrimary || ev.button !== 0 || activePointer) return;
    if (options.disabledCheck?.() || element.matches(":disabled")) return;
    const isTouch = ev.pointerType !== "mouse";
    activePointer = {
      id: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      box: element.getBoundingClientRect(),
      feel: isTouch ? TOUCH_FEEL : POINTER_FEEL,
      isTouch,
      pulledFar: false,
    };
    try {
      element.setPointerCapture?.(ev.pointerId);
    } catch {
      // Synthetic events in tests may not have an active pointer id
    }
    if (isTouch) hapticTap(5);
    element.dataset.pressed = "";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    updatePointer(ev);
  };

  const onReset = () => onEnd();
  element.addEventListener("pointerdown", onDown);
  element.addEventListener("lostpointercapture", onEnd);
  element.addEventListener("touchmove", onTouchMove, { passive: false });
  element.addEventListener("click", onClickCapture, true);
  window.addEventListener("blur", onReset);

  return () => {
    onEnd();
    springs.forEach((sp) => sp.stop());
    element.removeEventListener("pointerdown", onDown);
    element.removeEventListener("lostpointercapture", onEnd);
    element.removeEventListener("touchmove", onTouchMove);
    element.removeEventListener("click", onClickCapture, true);
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
 * Subtle tactile micro-haptic pulse on Android devices (`navigator.vibrate`).
 * Silently no-ops on desktop, iOS Safari, or when Reduced Motion is active.
 */
export function hapticTap(durationMs = 8): void {
  if (prefersReducedMotion()) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Ignored if blocked before user gesture
    }
  }
}

/**
 * Requests iOS 13+ Safari DeviceOrientation permission when required inside a user gesture.
 * Resolves to `true` on platforms where orientation events require no explicit permission.
 */
export async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const doe = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  if (!doe || typeof doe.requestPermission !== "function") return true;
  try {
    return (await doe.requestPermission()) === "granted";
  } catch {
    return false;
  }
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
  let hasGyro = false;

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
    if (hasGyro && ev.pointerType === "touch") return;
    const nx = (ev.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = (ev.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    if (nx * nx + ny * ny < 0.0025) return;
    steerTo((Math.atan2(ny, nx) * 180) / Math.PI);
  };

  const onDeviceOrientation = (ev: DeviceOrientationEvent) => {
    if (ev.gamma === null || ev.beta === null) return;
    hasGyro = true;
    const angle = (typeof screen !== "undefined" && screen.orientation?.angle) || 0;
    let gx = ev.gamma;
    let gy = ev.beta - 35;
    if (angle === 90) {
      gx = ev.beta - 35;
      gy = -ev.gamma;
    } else if (angle === 270 || angle === -90) {
      gx = -(ev.beta - 35);
      gy = ev.gamma;
    } else if (angle === 180) {
      gx = -ev.gamma;
      gy = -(ev.beta - 35);
    }
    steerTo((Math.atan2(gy, gx) * 180) / Math.PI);
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
