import {
  attachInteractivePress,
  attachRefraction,
  createBackdropLens,
  createLens,
  createSpring,
  materializeAllRefractions,
  refitAllRefractions,
  refractsBackdrop,
  sminCubic,
  sminCubicGradient,
  superellipseSDF,
  type LensOptions,
  type RefractionHandle,
  type Spring,
} from "../core";

export const HELD_MS = 150;
const isHeld = (startedAt: number, moved: boolean) => moved || performance.now() - startedAt >= HELD_MS;
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const clampRange = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  }
  return node;
}

const activeSegments = new Set<{ refit(): void }>();

export function materializeAllGlass(): void {
  materializeAllRefractions();
}

export function refitAllGlass(): void {
  refitAllRefractions();
  for (const seg of activeSegments) seg.refit();
}

export type GlassMaterial = "regular" | "clear" | "identity";

function applyGlassMaterial(el: HTMLElement, material: GlassMaterial = "regular", dimmingScrim = false): void {
  el.setAttribute("data-material", material);
  if (dimmingScrim && material === "clear") {
    el.setAttribute("data-scrim", "true");
  } else {
    el.removeAttribute("data-scrim");
  }
}

/** 1. Universal Glass Container (automatically links to `[data-fluid-backdrop]` when overlapping). */
export interface GlassHandle<T extends HTMLElement = HTMLElement> {
  element: T;
  refraction: RefractionHandle;
  materialize(instant?: boolean): void;
  dematerialize(instant?: boolean): void;
  setMaterial(material: GlassMaterial, dimmingScrim?: boolean): void;
  refit(): void;
  destroy(): void;
}

export interface GlassOptions {
  className?: string;
  tag?: keyof HTMLElementTagNameMap;
  interactive?: boolean;
  materializeOnMount?: boolean;
  material?: GlassMaterial;
  dimmingScrim?: boolean;
}

export function createGlass(options: GlassOptions = {}): GlassHandle<HTMLElement> {
  const element = makeEl(options.tag ?? "div", `lg-glass ${options.className ?? ""}`.trim());
  applyGlassMaterial(element, options.material ?? "regular", Boolean(options.dimmingScrim));
  const refraction = attachRefraction(element, false, true, options.materializeOnMount);
  const stopPress = options.interactive ? attachInteractivePress(element) : null;

  return {
    element,
    refraction,
    materialize: (instant) => refraction.materialize(instant),
    dematerialize: (instant) => refraction.dematerialize(instant),
    setMaterial(material, dimmingScrim = false) {
      applyGlassMaterial(element, material, dimmingScrim);
      refraction.refit();
    },
    refit: () => refraction.refit(),
    destroy() {
      stopPress?.();
      refraction.destroy();
    },
  };
}

/** 2. Fluid Glass Button with rubber-band spring press, internal finger glow, and materialize-by-bending. */
export interface ButtonOptions {
  label?: string;
  iconHtml?: string;
  ariaLabel?: string;
  variant?: "glass" | "filled";
  material?: GlassMaterial;
  dimmingScrim?: boolean;
  destructive?: boolean;
  tint?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  materializeOnMount?: boolean;
  onClick?: (ev: MouseEvent) => void;
}

export function createButton(options: ButtonOptions): GlassHandle<HTMLButtonElement> {
  const btn = makeEl("button", "lg-glass lg-button", { type: "button" });
  applyGlassMaterial(btn, options.material ?? "regular", Boolean(options.dimmingScrim));
  if (options.ariaLabel) btn.setAttribute("aria-label", options.ariaLabel);
  if (options.variant === "filled") btn.dataset.variant = "filled";
  if (options.destructive) btn.dataset.destructive = "";
  if (options.tint) {
    btn.dataset.tint = "";
    btn.style.setProperty("--lg-tint", options.tint);
  }
  if (options.iconHtml) {
    btn.dataset.icon = options.iconOnly || !options.label ? "only" : "";
    btn.insertAdjacentHTML("beforeend", options.iconHtml);
  }
  if (options.label && !options.iconOnly) {
    const labelNode = document.createTextNode(options.label);
    btn.appendChild(labelNode);
  }
  if (options.disabled) btn.disabled = true;
  if (options.onClick) btn.addEventListener("click", options.onClick);

  const refraction = attachRefraction(btn, false, true, options.materializeOnMount);
  const stopPress = attachInteractivePress(btn, { disabledCheck: () => btn.disabled });

  return {
    element: btn,
    refraction,
    materialize: (instant) => {
      if (instant) {
        btn.style.transition = "";
        btn.style.opacity = "1";
        refraction.materialize(true);
        return;
      }
      btn.style.transition = "none";
      btn.style.opacity = "0";
      requestAnimationFrame(() => {
        btn.style.transition = "opacity 160ms ease-out, background-color 200ms ease";
        btn.style.opacity = "1";
        refraction.materialize(false);
      });
    },
    dematerialize: (instant) => {
      btn.style.opacity = "0";
      refraction.dematerialize(instant);
    },
    setMaterial(material, dimmingScrim = false) {
      applyGlassMaterial(btn, material, dimmingScrim);
      refraction.refit();
    },
    refit: () => refraction.refit(),
    destroy() {
      stopPress();
      refraction.destroy();
    },
  };
}

/** 3. Fluid Switch: dual-bed stand-in track lens + exclusion mask + spring lift. */
const SWITCH_TRAVEL = 57.9 * 0.375;
const SWITCH_MAX_OVERSHOOT = 0.16;
const SWITCH_LENS: LensOptions = {
  strength: 0.45,
  strengthProperty: "--lg-switch-bend",
  dispersion: 1,
  depth: 2,
  dome: 6,
  splay: 0.4,
};

export interface SwitchOptions {
  checked?: boolean;
  ariaLabel: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export interface SwitchHandle {
  element: HTMLButtonElement;
  getChecked(): boolean;
  setChecked(next: boolean): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

export function createSwitch(options: SwitchOptions): SwitchHandle {
  let checked = Boolean(options.checked);

  const btn = makeEl("button", "lg-switch", {
    type: "button",
    role: "switch",
    "aria-checked": String(checked),
    "aria-label": options.ariaLabel,
  });
  if (options.disabled) btn.disabled = true;

  const bed = makeEl("span", "lg-switch-bed", { "aria-hidden": "true" });
  const bedTrack = makeEl("span", "lg-switch-track");
  const fill = makeEl("span", "lg-switch-fill");
  bedTrack.appendChild(fill);
  bed.appendChild(bedTrack);

  const inset = makeEl("span", "lg-switch-bed lg-switch-inset", { "aria-hidden": "true" });
  const insetTrack = makeEl("span", "lg-switch-track");
  const insetFill = makeEl("span", "lg-switch-fill");
  insetTrack.appendChild(insetFill);
  inset.appendChild(insetTrack);

  const thumb = makeEl("span", "lg-switch-thumb", { "aria-hidden": "true" });
  const face = makeEl("span", "lg-thumb-face");
  thumb.appendChild(face);
  btn.append(bed, inset, thumb);

  const fills = [fill, insetFill];
  const lens = createLens(thumb, inset, SWITCH_LENS, bed);

  let x = 0;
  let scale = 0.65;
  const paint = () => {
    thumb.style.transform = `translate(${x}px, -50%) scale(${scale})`;
    lens.update();
  };

  const initial = checked ? 1 : 0;
  const posSpring = createSpring(initial, 1000, 80, (value) => {
    x = value * SWITCH_TRAVEL;
    paint();
  });
  const colorSpring = createSpring(initial, 1000, 80, (value) => {
    for (const f of fills) f.style.opacity = String(clamp01(value));
  });
  const liftSpring = createSpring(0, 2000, 80, (value) => {
    scale = 0.65 + 0.25 * value;
    face.style.opacity = String(1 - 0.85 * clamp01(value));
    btn.style.setProperty("--lg-lift", String(clamp01(value)));
    lens.setActive(value > 0.01);
    paint();
  });

  posSpring.paint();
  colorSpring.paint();
  liftSpring.paint();

  let gesture: { id: number; x: number; y: number; from: number; moved: boolean; at: number; box: DOMRect } | null = null;
  let ignoreClick = false;

  const sync = () => {
    posSpring.set(checked ? 1 : 0);
    colorSpring.set(checked ? 1 : 0);
  };

  const setCheckedInternal = (next: boolean) => {
    if (next === checked) return;
    checked = next;
    btn.setAttribute("aria-checked", String(checked));
    options.onChange?.(checked);
    sync();
  };

  const settle = (next?: boolean) => {
    const old = gesture;
    gesture = null;
    liftSpring.set(0);
    if (old && btn.hasPointerCapture?.(old.id)) btn.releasePointerCapture(old.id);
    if (next === undefined || next === checked) {
      sync();
      return;
    }
    setCheckedInternal(next);
  };

  const onDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || btn.disabled) return;
    event.preventDefault();
    ignoreClick = false;
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: checked ? 1 : 0,
      moved: false,
      at: performance.now(),
      box: btn.getBoundingClientRect(),
    };
    btn.setPointerCapture?.(event.pointerId);
    liftSpring.set(1);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    const dx = event.clientX - gesture.x;
    const dy = Math.abs(event.clientY - gesture.y);
    if (!isHeld(gesture.at, gesture.moved) && dy > 10 && dy > Math.abs(dx) + 4) {
      ignoreClick = true;
      settle();
      return;
    }
    if (!gesture.moved && Math.abs(dx) < 4) return;
    gesture.moved = true;
    const value = gesture.from + dx / SWITCH_TRAVEL;
    const overshoot = value < 0 ? value : value > 1 ? value - 1 : 0;
    const dampedOvershoot =
      overshoot === 0
        ? 0
        : Math.sign(overshoot) *
          SWITCH_MAX_OVERSHOOT *
          (1 - Math.exp(-Math.abs(overshoot) / (22 * SWITCH_MAX_OVERSHOOT)));
    posSpring.set(clamp01(value) + dampedOvershoot);
    colorSpring.set(value > 0.5 ? 1 : 0);
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    ignoreClick = true;
    const { from, x: startX, moved, box } = gesture;
    const value = from + (event.clientX - startX) / SWITCH_TRAVEL;
    const near = event.clientY >= box.top - 24 && event.clientY <= box.bottom + 24;
    settle(moved ? value > 0.5 : near ? !checked : undefined);
  };

  const onTouchMove = (event: TouchEvent) => {
    if (gesture && event.cancelable && isHeld(gesture.at, gesture.moved)) event.preventDefault();
  };

  const onCancel = () => {
    if (!gesture) return;
    ignoreClick = true;
    settle();
  };

  const onClick = () => {
    if (ignoreClick) ignoreClick = false;
    else if (!btn.disabled) setCheckedInternal(!checked);
  };

  btn.addEventListener("pointerdown", onDown);
  btn.addEventListener("pointermove", onMove);
  btn.addEventListener("pointerup", onUp);
  btn.addEventListener("pointercancel", onCancel);
  btn.addEventListener("lostpointercapture", onCancel);
  btn.addEventListener("touchmove", onTouchMove, { passive: false });
  btn.addEventListener("click", onClick);

  return {
    element: btn,
    getChecked: () => checked,
    setChecked: setCheckedInternal,
    setDisabled(disabled) {
      btn.disabled = disabled;
    },
    destroy() {
      posSpring.stop();
      colorSpring.stop();
      liftSpring.stop();
      lens.destroy();
      btn.removeEventListener("pointerdown", onDown);
      btn.removeEventListener("pointermove", onMove);
      btn.removeEventListener("pointerup", onUp);
      btn.removeEventListener("pointercancel", onCancel);
      btn.removeEventListener("lostpointercapture", onCancel);
      btn.removeEventListener("touchmove", onTouchMove);
      btn.removeEventListener("click", onClick);
    },
  };
}

/** 4. Fluid Slider: magnified stand-in track refracted inside a 60x40 glass thumb lens. */
const SLIDER_LENS: LensOptions = {
  strength: 0.75,
  strengthProperty: "--lg-slider-bend",
  dispersion: 0.65,
  depth: 2,
  dome: 5,
  splay: 0.5,
};

export interface SliderOptions {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  onInput?: (value: number) => void;
}

export interface SliderHandle {
  element: HTMLDivElement;
  input: HTMLInputElement;
  getValue(): number;
  setValue(next: number): void;
  setStep(step: number): void;
  setDisabled(disabled: boolean): void;
  destroy(): void;
}

export function createSlider(options: SliderOptions): SliderHandle {
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  let step = options.step ?? 1;
  let value = options.value ?? min;

  const root = makeEl("div", `lg-slider ${options.className ?? ""}`.trim());
  const bed = makeEl("span", "lg-slider-bed", { "aria-hidden": "true" });
  const track = makeEl("span", "lg-slider-track");
  const fill = makeEl("span", "lg-slider-fill");
  track.appendChild(fill);
  bed.appendChild(track);

  const magnified = makeEl("span", "lg-slider-bed lg-slider-magnified", { "aria-hidden": "true" });
  const magTrack = makeEl("span", "lg-slider-track");
  const magFill = makeEl("span", "lg-slider-fill");
  magTrack.appendChild(magFill);
  magnified.appendChild(magTrack);

  const thumb = makeEl("span", "lg-slider-thumb", { "aria-hidden": "true" });
  const face = makeEl("span", "lg-thumb-face");
  thumb.appendChild(face);

  const input = makeEl("input", "", {
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
    "aria-label": options.ariaLabel,
  });
  if (options.disabled) input.disabled = true;

  root.append(bed, magnified, thumb, input);

  const lens = createLens(thumb, magnified, SLIDER_LENS, bed);

  const updateProgress = (v: number) => {
    const progress = max > min ? clamp01((v - min) / (max - min)) : 0;
    root.style.setProperty("--lg-progress", String(progress));
    lens.update();
  };
  updateProgress(value);

  const liftSpring = createSpring(0, 2000, 80, (amount) => {
    const lifted = clamp01(amount);
    thumb.style.scale = String(0.6 + 0.4 * amount);
    root.style.setProperty("--lg-lift", String(lifted));
    face.style.opacity = String(1 - 0.85 * lifted);
    lens.setActive(amount > 0.01);
    lens.update();
  });
  liftSpring.paint();

  const hold = () => {
    if (!input.disabled) liftSpring.set(1);
  };
  const release = () => liftSpring.set(0);
  const ends = ["pointerup", "pointercancel", "lostpointercapture", "blur"] as const;

  const onInputEvent = () => {
    value = Number(input.value);
    updateProgress(value);
    options.onInput?.(value);
  };

  input.addEventListener("pointerdown", hold);
  ends.forEach((t) => input.addEventListener(t, release));
  window.addEventListener("pointerup", release);
  input.addEventListener("input", onInputEvent);

  return {
    element: root,
    input,
    getValue: () => value,
    setValue(next) {
      value = clampRange(next, min, max);
      input.value = String(value);
      updateProgress(value);
    },
    setStep(nextStep) {
      step = nextStep;
      input.step = String(step);
    },
    setDisabled(disabled) {
      input.disabled = disabled;
    },
    destroy() {
      liftSpring.stop();
      lens.destroy();
      input.removeEventListener("pointerdown", hold);
      ends.forEach((t) => input.removeEventListener(t, release));
      window.removeEventListener("pointerup", release);
      input.removeEventListener("input", onInputEvent);
    },
  };
}

/** 5 & 6. Shared TabBar & SegmentedControl with 3-layer synchronized ink refraction + chromatic dispersion. */
const TAB_LENS: LensOptions = {
  strength: 0.2,
  strengthProperty: "--lg-tab-bend",
  dispersion: 2,
  dispersionProperty: "--lg-tab-dispersion",
  depth: 4,
  dome: 0,
  splay: 1,
  ink: true,
  blur: 2,
};

const SEGMENT_LENS: LensOptions = {
  strength: 0.3,
  strengthProperty: "--lg-segment-bend",
  dispersion: 0.1,
  depth: 2.5,
  dome: 0,
  splay: 1,
};

const REST_SPRING = [1024, 58.9, 676, 47.8] as const;
const DRAG_SPRING = [2500, 94, 576, 44.2] as const;
const UNDER_THRESHOLD = 0.5;

export interface SegmentChoice {
  value: string;
  label: string;
  iconHtml?: string;
}

export interface SegmentsOptions {
  kind: "tab-bar" | "segmented";
  items: SegmentChoice[];
  value?: string;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: string) => void;
}

export interface SegmentsHandle {
  element: HTMLDivElement;
  getValue(): string;
  setValue(next: string, instant?: boolean): void;
  refit(): void;
  destroy(): void;
}

function renderTabContent(item: SegmentChoice): string {
  if (!item.iconHtml) return `<span class="lg-tab-text">${item.label}</span>`;
  return `<span class="lg-tab-icon" aria-hidden="true">${item.iconHtml}</span><span class="lg-tab-label">${item.label}</span>`;
}

function createSegmentsComponent(opts: SegmentsOptions): SegmentsHandle {
  const segmented = opts.kind === "segmented";
  let activeIdx = opts.items.findIndex((i) => i.value === opts.value);
  if (activeIdx < 0 && opts.items.length > 0) activeIdx = 0;
  const icons = !segmented && opts.items.some((i) => Boolean(i.iconHtml));

  const bar = makeEl("div", `${segmented ? "lg-segmented" : "lg-tab-bar"} ${opts.className ?? ""}`.trim(), {
    role: segmented ? "radiogroup" : "tablist",
  });
  if (opts.ariaLabel) bar.setAttribute("aria-label", opts.ariaLabel);
  if (icons) bar.setAttribute("data-icons", "");
  bar.style.setProperty("--lg-index", String(Math.max(activeIdx, 0)));
  bar.style.setProperty("--lg-tabs", String(opts.items.length));

  const glass = makeEl("span", "lg-glass lg-tab-bar-glass", { "aria-hidden": "true" });
  const thumb = segmented ? makeEl("span", "lg-segmented-thumb", { "aria-hidden": "true" }) : null;
  const labels = makeEl("span", "lg-tab-labels", { role: "none" });
  const lensed = makeEl("span", "lg-tab-labels lg-tab-lensed", { "aria-hidden": "true" });
  const tint = makeEl("span", "lg-tab-tint", { "aria-hidden": "true" });
  const row = makeEl("span", "lg-tab-row");
  tint.appendChild(row);
  const lens = makeEl("span", "lg-glass lg-tab-lens", { "aria-hidden": "true" });

  const tabButtons: HTMLButtonElement[] = [];
  const lensedCopies: HTMLSpanElement[] = [];

  opts.items.forEach((item, index) => {
    const html = renderTabContent(item);
    const btn = makeEl("button", "lg-tab", {
      type: "button",
      role: segmented ? "radio" : "tab",
      tabindex: index === activeIdx ? "0" : "-1",
    });
    if (segmented) btn.setAttribute("aria-checked", String(index === activeIdx));
    else btn.setAttribute("aria-selected", String(index === activeIdx));
    if (index === activeIdx) btn.setAttribute("data-selected", "");
    btn.innerHTML = `<span class="lg-tab-face">${html}</span>`;
    tabButtons.push(btn);
    labels.appendChild(btn);

    const copy = makeEl("span", "lg-tab-copy");
    if (index === activeIdx) copy.setAttribute("data-selected", "");
    copy.innerHTML = html;
    lensedCopies.push(copy);
    lensed.appendChild(copy);

    const tintCopy = makeEl("span", "lg-tab-copy");
    tintCopy.innerHTML = html;
    row.appendChild(tintCopy);
  });

  bar.append(glass);
  if (thumb) bar.append(thumb);
  bar.append(labels, lensed, tint, lens);

  const glassRefraction = attachRefraction(glass);
  const lensRefraction = attachRefraction(lens, true, segmented);

  const lensOptions = segmented ? SEGMENT_LENS : TAB_LENS;
  const refraction = createLens(lens, lensed, lensOptions, labels);
  const backdrop = !segmented && refractsBackdrop() ? createBackdropLens(lens, lensOptions) : null;

  let slot = 0;
  let width = 0;
  let height = 0;
  let inset = 0;
  let padding = 0;
  let growX = 16;
  let growY = 12;
  let shown = false;
  let lensing = false;
  let gesture: { id: number; x: number; anchor: number; moved: boolean; box: DOMRect; at: number } | null = null;
  const state = { x: 0, lift: 0 };

  const markAway = () => {
    bar.toggleAttribute("data-away", activeIdx < 0 || Math.abs(state.x - activeIdx * slot) > 0.5);
  };

  const measure = (): boolean => {
    const style = getComputedStyle(bar);
    padding = parseFloat(style.paddingLeft) || 0;
    const clientW = bar.clientWidth;
    const totalW = clientW || opts.items.length * (icons ? 72 : 84);
    slot = (totalW - padding - (parseFloat(style.paddingRight) || 0)) / opts.items.length;
    inset = parseFloat(style.getPropertyValue("--lg-thumb-inset")) || 0;
    width = Math.max(1, slot - 2 * inset);
    height = lens.offsetHeight || (icons ? 52 : 32);
    growX = parseFloat(style.getPropertyValue("--lg-lens-grow-x")) || 0;
    growY = parseFloat(style.getPropertyValue("--lg-lens-grow-y")) || 0;
    return clientW > 0;
  };

  const paint = () => {
    const { x, lift } = state;
    const sx = 1 + (growX / Math.max(1, width)) * lift;
    const sy = 1 + (growY / Math.max(1, height)) * lift;
    const transform = `translateX(${x}px) scale(${sx}, ${sy})`;
    lens.style.transform = tint.style.transform = transform;
    if (thumb) thumb.style.transform = transform;
    lens.style.setProperty("--lg-lift", String(clamp01(lift)));
    lens.style.setProperty("--lg-lift-y", String(sy));
    row.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-x + (sx - 1) * (inset + width * 0.5)}px, ${(sy - 1) * (inset + height * 0.5)}px)`;
    if (!gesture && lift < 0.01) delete bar.dataset.refracting;
    markAway();

    if (lift > 0.01 !== lensing) {
      lensing = lift > 0.01;
      bar.toggleAttribute("data-lensing", lensing);
      refraction.setActive(lensing);
    }

    const amount = clamp01(lift);
    const under = clamp01((lift - UNDER_THRESHOLD) / (1 - UNDER_THRESHOLD));
    lens.style.setProperty("--lg-rest", String(clamp01(1 - lift / UNDER_THRESHOLD)));
    lens.style.setProperty("--lg-under", String(under));
    bar.toggleAttribute("data-under", lift > UNDER_THRESHOLD);
    refraction.update(amount);
    backdrop?.update(under);
  };

  const xSpring = createSpring(0, REST_SPRING[0], REST_SPRING[1], (v) => {
    state.x = v;
    paint();
  });
  const liftSpring = createSpring(0, REST_SPRING[2], REST_SPRING[3], (v) => {
    state.lift = v;
    paint();
  });

  const move = (target: number, lifted: boolean, instant = false) => {
    const [sxK, sxD, lK, lD] = gesture ? DRAG_SPRING : REST_SPRING;
    xSpring.tune(sxK, sxD);
    liftSpring.tune(lK, lD);
    xSpring.set(target, instant);
    liftSpring.set(lifted ? 1 : 0, instant);
  };

  const settle = (instant = false) => {
    markAway();
    if (gesture) return;
    const show = activeIdx >= 0;
    if (show) delete bar.dataset.hidden;
    else bar.dataset.hidden = "";
    const hasLayout = bar.clientWidth > 0;
    if (show) move(activeIdx * slot, false, instant || !shown);
    shown = show && hasLayout;
  };

  const setActiveIndex = (idx: number, instant = false, notify = true) => {
    const clamped = clampRange(idx, 0, opts.items.length - 1);
    const changed = clamped !== activeIdx;
    activeIdx = clamped;
    bar.style.setProperty("--lg-index", String(activeIdx));
    tabButtons.forEach((b, i) => {
      const sel = i === activeIdx;
      b.toggleAttribute("data-selected", sel);
      b.tabIndex = sel ? 0 : -1;
      b.setAttribute(segmented ? "aria-checked" : "aria-selected", String(sel));
      lensedCopies[i]?.toggleAttribute("data-selected", sel);
    });
    settle(instant);
    if (changed && notify) opts.onChange?.(opts.items[activeIdx]!.value);
  };

  const position = (event: PointerEvent) =>
    clampRange(gesture!.anchor + event.clientX - gesture!.x, 0, slot * (tabButtons.length - 1));

  const light = (event: PointerEvent, box: DOMRect) => {
    glass.style.setProperty("--lg-x", `${clampRange(((event.clientX - box.left) / Math.max(1, box.width)) * 100, 0, 100)}%`);
    lens.style.setProperty("--lg-x", `${clampRange(((event.clientX - box.left - padding - inset - state.x) / Math.max(1, width)) * 100, 0, 100)}%`);
  };

  const release = () => {
    const old = gesture;
    gesture = null;
    delete bar.dataset.lifted;
    delete lens.dataset.pressed;
    if (old && bar.hasPointerCapture?.(old.id)) bar.releasePointerCapture(old.id);
    return old;
  };

  let suppressClick = false;

  const onDown = (event: PointerEvent) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>(".lg-tab");
    if (!event.isPrimary || event.button !== 0 || gesture || !tab) return;
    measure();
    bar.toggleAttribute("data-light", parseFloat(getComputedStyle(lens).getPropertyValue("--lg-lens-shine")) < 0);
    backdrop?.refit();
    const box = bar.getBoundingClientRect();
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      anchor: tabButtons.indexOf(tab) * slot,
      moved: false,
      box,
      at: performance.now(),
    };
    suppressClick = false;
    bar.dataset.lifted = "";
    bar.dataset.refracting = "";
    delete bar.dataset.hidden;
    lens.dataset.pressed = "";
    light(event, box);
    move(gesture.anchor, true, !shown);
    shown = true;
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    if (!gesture.moved && Math.abs(event.clientX - gesture.x) > 6) {
      gesture.moved = true;
      bar.setPointerCapture?.(event.pointerId);
    }
    if (gesture.moved) move(position(event), true);
    light(event, gesture.box);
  };

  const onEnd = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    if (event.type === "lostpointercapture" && event.target !== bar) return;
    const idx = Math.round(position(event) / Math.max(1, slot));
    const { moved, box } = release()!;
    const near = event.clientY >= box.top - 24 && event.clientY <= box.bottom + 24;
    if (event.type === "pointerup" && (moved || near)) {
      suppressClick = true;
      setActiveIndex(idx, false, true);
    } else {
      suppressClick = moved;
      settle();
    }
  };

  const onTouchMove = (event: TouchEvent) => {
    if (gesture && event.cancelable && isHeld(gesture.at, gesture.moved)) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    if (event.isTrusted && suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const tab = (event.target as Element).closest<HTMLButtonElement>(".lg-tab");
    if (!tab) return;
    setActiveIndex(tabButtons.indexOf(tab), false, true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabButtons.length - 1
          : (activeIdx + (event.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length;
    setActiveIndex(next, false, true);
    tabButtons[next]?.focus();
  };

  const syncLayout = () => {
    measure();
    refraction.refit();
    glassRefraction.refit();
    lensRefraction.refit();
    backdrop?.refit();
    if (!gesture) settle(true);
  };

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncLayout) : null;
  ro?.observe(bar);
  const mountRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(syncLayout) : 0;

  measure();
  bar.dataset.ready = "";
  settle(true);

  bar.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
  bar.addEventListener("lostpointercapture", onEnd);
  bar.addEventListener("touchmove", onTouchMove, { passive: false });
  bar.addEventListener("click", onClick, true);
  bar.addEventListener("keydown", onKeyDown);

  const handle: SegmentsHandle = {
    element: bar,
    getValue: () => opts.items[activeIdx]!.value,
    setValue(next, instant = false) {
      const idx = opts.items.findIndex((i) => i.value === next);
      if (idx >= 0) setActiveIndex(idx, instant, false);
    },
    refit() {
      syncLayout();
    },
    destroy() {
      activeSegments.delete(handle);
      if (mountRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(mountRaf);
      xSpring.stop();
      liftSpring.stop();
      refraction.destroy();
      backdrop?.destroy();
      glassRefraction.destroy();
      lensRefraction.destroy();
      ro?.disconnect();
      bar.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      bar.removeEventListener("lostpointercapture", onEnd);
      bar.removeEventListener("touchmove", onTouchMove);
      bar.removeEventListener("click", onClick, true);
      bar.removeEventListener("keydown", onKeyDown);
    },
  };
  activeSegments.add(handle);
  return handle;
}

export const createTabBar = (options: Omit<SegmentsOptions, "kind">) =>
  createSegmentsComponent({ ...options, kind: "tab-bar" });

export const createSegmentedControl = (options: Omit<SegmentsOptions, "kind">) =>
  createSegmentsComponent({ ...options, kind: "segmented" });

/** 7. Trigger-to-Card Clip-Path Morphing Menu + Icon Blur Drift + Magnetic Row Scrubbing. */
export interface MenuEntryItem {
  type?: "item";
  label: string;
  iconHtml?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export type MenuEntry = MenuEntryItem | { type: "separator" };

export interface MenuOptions {
  ariaLabel: string;
  triggerIconHtml?: string;
  align?: "start" | "end";
  items: MenuEntry[];
}

export interface MenuHandle {
  element: HTMLDivElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
}

const DEFAULT_ELLIPSIS = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg>`;
const rubberResistance = (value: number) => Math.sign(value) * 7 * (1 - Math.exp((-Math.abs(value) * 0.12) / 7));

export function createMenu(options: MenuOptions): MenuHandle {
  const iconHtml = options.triggerIconHtml ?? DEFAULT_ELLIPSIS;
  const align = options.align ?? "end";
  const root = makeEl("div", "lg-menu");

  const triggerHandle = createButton({
    iconHtml,
    iconOnly: true,
    ariaLabel: options.ariaLabel,
    onClick: () => (opened ? close() : open()),
  });
  const trigger = triggerHandle.element;
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");

  const card = makeEl("div", "lg-menu-card", {
    role: "menu",
    "aria-label": options.ariaLabel,
    "data-align": align,
    "data-phase": "closed",
  });
  card.hidden = true;

  const surface = makeEl("span", "lg-menu-surface", { "aria-hidden": "true" });
  const glyph = makeEl("span", "lg-menu-glyph", { "aria-hidden": "true" });
  glyph.innerHTML = iconHtml;
  const content = makeEl("div", "lg-menu-content", { role: "none" });
  const plate = makeEl("span", "lg-menu-plate", { "aria-hidden": "true" });
  content.appendChild(plate);

  const itemEntries: Array<{ btn: HTMLButtonElement; entry: MenuEntryItem }> = [];
  options.items.forEach((entry) => {
    if (entry.type === "separator") {
      content.appendChild(makeEl("div", "lg-menu-separator", { role: "separator" }));
      return;
    }
    const row = makeEl("button", "lg-menu-item", { type: "button", role: "menuitem" });
    if (entry.destructive) row.dataset.destructive = "";
    if (entry.disabled) row.disabled = true;
    if (entry.iconHtml) row.insertAdjacentHTML("beforeend", entry.iconHtml);
    row.appendChild(document.createTextNode(entry.label));

    row.addEventListener("pointerdown", (ev) => {
      const box = row.getBoundingClientRect();
      const px = box.width > 0 ? ((ev.clientX - box.left) / box.width) * 100 : 50;
      const py = box.height > 0 ? ((ev.clientY - box.top) / box.height) * 100 : 50;
      row.style.setProperty("--lg-item-x", `${px.toFixed(1)}%`);
      row.style.setProperty("--lg-item-y", `${py.toFixed(1)}%`);
      row.dataset.pressed = "";
    });
    const clearPress = () => delete row.dataset.pressed;
    row.addEventListener("pointerup", clearPress);
    row.addEventListener("pointercancel", clearPress);
    row.addEventListener("pointerleave", clearPress);

    itemEntries.push({ btn: row, entry });
    content.appendChild(row);
  });

  card.append(surface, glyph, content);
  root.append(trigger, card);

  let opened = false;
  let leaving = false;
  let from = { width: 40, height: 40 };
  let to = { width: 210, height: 180 };
  let radius = 20;
  let origin = { x: 190, y: 20 };

  const shapeSpring: Spring = createSpring(0, 600, 46, (value) => {
    const t = clamp01(value);
    const settled = t === 1;
    const width = from.width + (to.width - from.width) * t;
    const height = from.height + (to.height - from.height) * t;
    const scale = 0.5 + 0.5 * t;
    const trailing = align !== "start";
    const local = (edge: number, centre: number) => centre + (edge - centre) / scale;
    const left = local(trailing ? to.width - width : 0, origin.x);
    const right = local(trailing ? to.width : width, origin.x);
    const bottom = local(height, origin.y);
    const top = local(0, origin.y);

    surface.style.width = settled ? "" : `${width}px`;
    surface.style.height = settled ? "" : `${height}px`;
    surface.style.opacity = String(clamp01(t / 0.2));
    surface.style.setProperty("--lg-menu-blur", `${(3 + 19 * t).toFixed(1)}px`);
    surface.style.setProperty("--lg-menu-shadow-spread", `${(6 + 34 * t).toFixed(1)}px`);
    surface.style.setProperty("--lg-menu-rim-opacity", `${(0.45 + 0.55 * t).toFixed(2)}`);
    trigger.style.opacity = t === 0 ? "" : String(1 - clamp01(t / 0.2));

    const drift = 0.3 * t;
    const dx = ((trailing ? to.width - width * 0.5 : width * 0.5) - origin.x) * drift;
    const dy = (height * 0.5 - origin.y) * drift;
    glyph.style.opacity = String(1 - clamp01(t / 0.45));
    glyph.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + 0.6 * t})`;
    glyph.style.filter = `blur(${8 * t}px)`;

    content.style.opacity = String(leaving ? clamp01((t - 0.55) / 0.45) : clamp01((t - 0.15) / 0.6));
    content.style.transform = settled ? "" : `scale(${scale})`;
    content.style.filter = settled ? "" : `blur(${6 * (1 - t)}px)`;
    content.style.clipPath = settled
      ? ""
      : `inset(${top}px ${to.width - right}px ${to.height - bottom}px ${left}px round ${radius / scale}px)`;

    if (leaving && value === 0) {
      card.hidden = true;
      card.dataset.phase = "closed";
      trigger.style.opacity = "";
    }
  });

  const offset = { scale: 1, x: 0, y: 0 };
  const paintDrag = () => {
    card.style.scale = String(offset.scale);
    card.style.translate = `${offset.x}px ${offset.y}px`;
  };
  const scaleSpring = createSpring(1, 650, 36, (v) => {
    offset.scale = v;
    paintDrag();
  });
  const xSpring = createSpring(0, 600, 30, (v) => {
    offset.x = v;
    paintDrag();
  });
  const ySpring = createSpring(0, 600, 30, (v) => {
    offset.y = v;
    paintDrag();
  });

  let currentRow: HTMLButtonElement | null = null;
  let gesture: { id: number; x: number; y: number } | null = null;
  let suppressClickUntil = 0;

  const highlight = (row: HTMLButtonElement | null) => {
    if (currentRow === row) return;
    const first = !currentRow;
    currentRow = row;
    if (!row) {
      delete card.dataset.scrubbing;
      plate.style.opacity = "0";
      return;
    }
    card.dataset.scrubbing = "";
    plate.style.width = `${row.offsetWidth}px`;
    plate.style.height = `${row.offsetHeight}px`;
    if (first) plate.style.transition = "none";
    plate.style.transform = `translate(${row.offsetLeft}px, ${row.offsetTop}px)`;
    plate.style.opacity = "1";
    if (first) {
      void plate.offsetWidth;
      plate.style.transition = "";
    }
  };

  const rowAt = (clientX: number, clientY: number) => {
    const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLButtonElement>(".lg-menu-item");
    return row && !row.disabled && card.contains(row) ? row : null;
  };

  const open = () => {
    if (opened) return;
    opened = true;
    leaving = false;
    card.hidden = false;
    card.dataset.phase = "open";
    trigger.setAttribute("aria-expanded", "true");

    from = { width: trigger.offsetWidth || 40, height: trigger.offsetHeight || 40 };
    to = { width: card.offsetWidth || 210, height: card.offsetHeight || 180 };
    radius = parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 20;
    const trailing = align !== "start";
    origin = { x: trailing ? to.width - from.width * 0.5 : from.width * 0.5, y: from.height * 0.5 };
    content.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    glyph.style.width = `${from.width}px`;
    glyph.style.height = `${from.height}px`;

    shapeSpring.tune(600, 46);
    shapeSpring.paint();
    shapeSpring.set(1);
    itemEntries.find((e) => !e.btn.disabled)?.btn.focus({ preventScroll: true });
  };

  const close = (restoreFocus = true) => {
    if (!opened) return;
    opened = false;
    leaving = true;
    card.dataset.phase = "leaving";
    trigger.setAttribute("aria-expanded", "false");
    shapeSpring.tune(900, 57);
    shapeSpring.set(0);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };

  const toggle = () => (opened ? close() : open());

  const onDown = (ev: PointerEvent) => {
    if (!ev.isPrimary || ev.button !== 0) return;
    gesture = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    card.setPointerCapture?.(ev.pointerId);
    card.dataset.pressed = "";
    scaleSpring.set(1 + 5 / Math.max(card.offsetWidth, card.offsetHeight, 200));
    highlight(rowAt(ev.clientX, ev.clientY));
  };

  const onMove = (ev: PointerEvent) => {
    if (!gesture) {
      const row = ev.pointerType === "mouse" ? rowAt(ev.clientX, ev.clientY) : null;
      if (row) highlight(row);
      return;
    }
    if (ev.pointerId !== gesture.id) return;
    highlight(rowAt(ev.clientX, ev.clientY));
    xSpring.set(rubberResistance(ev.clientX - gesture.x), true);
    ySpring.set(rubberResistance(ev.clientY - gesture.y), true);
  };

  const onEnd = (ev: PointerEvent) => {
    if (ev.pointerId !== gesture?.id) return;
    const chosen = ev.type === "pointerup" ? rowAt(ev.clientX, ev.clientY) : null;
    highlight(null);
    gesture = null;
    delete card.dataset.pressed;
    scaleSpring.set(1);
    xSpring.set(0);
    ySpring.set(0);
    suppressClickUntil = performance.now() + 500;
    chosen?.click();
  };

  const onClick = (ev: MouseEvent) => {
    const row = (ev.target as Element).closest<HTMLButtonElement>(".lg-menu-item");
    if (!row || (ev.detail !== 0 && performance.now() < suppressClickUntil)) return;
    const matched = itemEntries.find((item) => item.btn === row);
    if (!matched) return;
    close();
    matched.entry.onSelect?.();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
    } else if (ev.key === "Tab") {
      close(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
      ev.preventDefault();
      const enabled = itemEntries.filter((e) => !e.btn.disabled).map((e) => e.btn);
      const idx = enabled.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        ev.key === "Home"
          ? 0
          : ev.key === "End"
            ? enabled.length - 1
            : (idx + (ev.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
      enabled[next]?.focus();
      highlight(enabled[next] ?? null);
    }
  };

  const onOutside = (ev: PointerEvent) => {
    if (opened && !root.contains(ev.target as Node)) close(false);
  };

  card.addEventListener("pointerdown", onDown);
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerleave", (e) => {
    if (!gesture && e.pointerType === "mouse") highlight(null);
  });
  card.addEventListener("pointerup", onEnd);
  card.addEventListener("pointercancel", onEnd);
  card.addEventListener("lostpointercapture", onEnd);
  card.addEventListener("click", onClick);
  card.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onOutside, true);

  return {
    element: root,
    isOpen: () => opened,
    open,
    close: () => close(true),
    toggle,
    destroy() {
      [shapeSpring, scaleSpring, xSpring, ySpring].forEach((s) => s.stop());
      triggerHandle.destroy();
      document.removeEventListener("pointerdown", onOutside, true);
    },
  };
}

/** 8. Fluid Input & SearchField capsule. */
const SEARCH_ICON = `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm2.35 4.65a.5.5 0 0 1 0 .7L8.71 8l1.64 1.65a.5.5 0 0 1-.7.7L8 8.71l-1.65 1.64a.5.5 0 0 1-.7-.7L7.29 8 5.65 6.35a.5.5 0 0 1 .7-.7L8 7.29l1.65-1.64a.5.5 0 0 1 .7 0Z"/></svg>`;

export interface SearchFieldOptions {
  placeholder?: string;
  value?: string;
  ariaLabel?: string;
  iconHtml?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  onInput?: (value: string) => void;
}

export interface InputHandle {
  element: HTMLDivElement;
  input: HTMLInputElement;
  setDisabled(disabled: boolean): void;
  refit(): void;
  destroy(): void;
}

export function createSearchField(options: SearchFieldOptions = {}): InputHandle {
  const wrap = makeEl("div", `lg-glass lg-input ${options.className ?? ""}`.trim());
  const refraction = attachRefraction(wrap);

  const icon = makeEl("span", "lg-input-icon", { "aria-hidden": "true" });
  icon.innerHTML = options.iconHtml ?? SEARCH_ICON;

  const input = makeEl("input", "", {
    type: "search",
    placeholder: options.placeholder ?? "Search",
    value: options.value ?? "",
    "aria-label": options.ariaLabel ?? options.placeholder ?? "Search",
  });
  if (options.disabled) input.disabled = true;

  const clearBtn = makeEl("button", "lg-input-clear", {
    type: "button",
    "aria-label": "Clear",
  });
  clearBtn.innerHTML = CLEAR_ICON;
  clearBtn.hidden = !(options.clearable ?? true) || !input.value;

  const syncClear = () => {
    clearBtn.hidden = !(options.clearable ?? true) || input.value.length === 0;
  };

  input.addEventListener("input", () => {
    syncClear();
    options.onInput?.(input.value);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    syncClear();
    options.onInput?.("");
    input.focus();
  });

  wrap.append(icon, input, clearBtn);

  return {
    element: wrap,
    input,
    setDisabled(disabled) {
      input.disabled = disabled;
    },
    refit: () => refraction.refit(),
    destroy() {
      refraction.destroy();
    },
  };
}

export const createInput = (options: SearchFieldOptions = {}) =>
  createSearchField({ clearable: false, iconHtml: "", ...options });

/** 9. Shared GlassEffectContainer: Two-pass WebGL2 C2 sminCubic Droplet Fusion + Cross-Sibling Touch Light Bleed. */
export interface GlassContainerOptions {
  childrenVariants?: GlassMaterial[];
  backdropSrc?: string;
  gap?: number;
  smoothK?: number;
  tint?: number;
  ariaLabel?: string;
  onGapChange?: (gap: number) => void;
}

export interface GlassContainerHandle {
  element: HTMLDivElement;
  setGap(gapPx: number): void;
  getGap(): number;
  setSmoothK(k: number): void;
  getSmoothK(): number;
  setTint(tint: number): void;
  setBackdropSrc(src: string): void;
  refit(): void;
  destroy(): void;
}

const DROPLET_VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = (pos + 1.0) * 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const DROPLET_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uSize;
uniform vec4 uPillA; // cx, cy, hw, hh
uniform vec4 uPillB; // cx, cy, hw, hh
uniform float uRadiusA;
uniform float uRadiusB;
uniform float uSmoothK;
uniform float uTint;
uniform vec2 uTouchPos;
uniform float uTouchStrength;
in vec2 vUv;
out vec4 outColor;

float sdSuperellipse(vec2 p, vec2 b, float r) {
  float rad = clamp(r, 0.0, min(b.x, b.y));
  vec2 q = abs(p) - b + rad;
  vec2 o = max(q, 0.0);
  float edge = (o.x > 0.0 && o.y > 0.0)
    ? pow(pow(o.x, 4.0) + pow(o.y, 4.0), 0.25)
    : (o.x + o.y);
  return edge + min(max(q.x, q.y), 0.0) - rad;
}

float sminC(float a, float b, float k) {
  if (k <= 0.001) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - (1.0 / 6.0) * h * h * h * k;
}

float sceneSDF(vec2 px) {
  float d1 = sdSuperellipse(px - uPillA.xy, uPillA.zw, uRadiusA);
  float d2 = sdSuperellipse(px - uPillB.xy, uPillB.zw, uRadiusB);
  return sminC(d1, d2, uSmoothK);
}

vec3 sampleBackdropPx(vec2 px) {
  if (uHasTex < 0.5) {
    vec2 uv = px / max(uSize, vec2(1.0));
    float ridge = exp(-pow((uv.y - (0.62 - 0.34 * uv.x)) * 12.0, 2.0));
    return mix(vec3(0.06, 0.08, 0.18), vec3(0.26, 0.38, 0.72), uv.y) + vec3(0.32, 0.44, 0.68) * ridge;
  }
  float aspect = max(0.5, uSize.x / max(1.0, uSize.y));
  vec2 norm = px / max(uSize, vec2(1.0)) - 0.5;
  // Crop cleanly around the primary diagonal S-curve ridge (0.415, 0.432)
  vec2 texUv = vec2(0.415 + norm.x * 0.46, 0.432 + norm.y * (0.46 / aspect));
  return texture(uTex, clamp(texUv, 0.002, 0.998)).rgb;
}

vec3 sampleBlurBackdrop(vec2 px, float spread) {
  if (spread <= 0.25) return sampleBackdropPx(px);
  vec3 sum = sampleBackdropPx(px) * 0.24;
  sum += sampleBackdropPx(px + vec2( spread,  spread)) * 0.14;
  sum += sampleBackdropPx(px + vec2(-spread,  spread)) * 0.14;
  sum += sampleBackdropPx(px + vec2( spread, -spread)) * 0.14;
  sum += sampleBackdropPx(px + vec2(-spread, -spread)) * 0.14;
  sum += sampleBackdropPx(px + vec2( spread * 1.8, 0.0)) * 0.05;
  sum += sampleBackdropPx(px - vec2( spread * 1.8, 0.0)) * 0.05;
  sum += sampleBackdropPx(px + vec2(0.0,  spread * 1.8)) * 0.05;
  sum += sampleBackdropPx(px - vec2(0.0,  spread * 1.8)) * 0.05;
  return sum;
}

void main() {
  vec2 px = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
  float d = sceneSDF(px);
  vec3 bgSharp = sampleBackdropPx(px);

  if (d > 0.75) {
    // Grounding micro-shadow just outside the merged contour
    float sh = exp(-max(0.0, d - 0.5) * 0.16) * 0.28;
    outColor = vec4(bgSharp * (1.0 - sh), 1.0);
    return;
  }

  float bezelW = 20.0;
  float depth = max(0.0, -d);
  float x = clamp(depth / bezelW, 0.0, 1.0);

  // Finite-difference 2D outward unit gradient across compound C2 SDF
  float eps = 0.6;
  vec2 grad = vec2(
    sceneSDF(px + vec2(eps, 0.0)) - sceneSDF(px - vec2(eps, 0.0)),
    sceneSDF(px + vec2(0.0, eps)) - sceneSDF(px - vec2(0.0, eps))
  );
  float gLen = length(grad);
  vec2 n2 = gLen > 1e-4 ? grad / gLen : vec2(0.0, 0.0);

  // 2.5D squircle bevel slope + Snell refraction shift
  float bendProfile = 0.0;
  float h = 1.0;
  if (x < 0.998) {
    float xc = max(0.004, x);
    float inv = 1.0 - xc;
    h = pow(max(0.001, 1.0 - pow(inv, 4.0)), 0.25);
    float hp = min(4.2, pow(inv, 3.0) / max(0.01, pow(h, 3.0)));
    float inc = atan(hp);
    float refr = asin(clamp(sin(inc) / 1.50, -0.999, 0.999));
    bendProfile = tan(inc - refr) * (0.62 + h);
  }

  float reachPx = bezelW * 1.45 * (1.0 - 0.18 * uTint);
  vec2 shiftPx = n2 * bendProfile * reachPx;

  // Cauchy R/G/B chromatic dispersion across the liquid neck & rim
  float dispScale = 0.24;
  float blurPx = 1.4 + uTint * 5.0;
  float r = sampleBlurBackdrop(px - shiftPx * (1.0 + dispScale), blurPx).r;
  float g = sampleBlurBackdrop(px - shiftPx * (1.0 + 0.5 * dispScale), blurPx).g;
  float b = sampleBlurBackdrop(px - shiftPx, blurPx).b;
  vec3 refracted = vec3(r, g, b);

  // Subtle adaptive surface lift + internal legibility contrast
  vec3 glassCol = mix(refracted * 1.04 + vec3(0.025), vec3(0.88, 0.92, 0.98), 0.08 + uTint * 0.24);

  // Schlick Fresnel + anisotropic diagonal rim highlight (-135 deg primary + bounce highlight)
  vec2 lightDir = normalize(vec2(-0.7071, -0.7071));
  float dotL = dot(n2, lightDir);
  float dualFacing = pow(abs(dotL), 1.35) * (1.0 + 0.08 * (n2.y * n2.y - n2.x * n2.x));
  float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(h, 0.0, 1.0), 3.2);
  float rimBand = smoothstep(2.4, 0.0, depth);
  float rimAlpha = clamp((0.18 + 0.48 * fresnel) * dualFacing * rimBand, 0.0, 0.85);
  glassCol = mix(glassCol, vec3(1.0), rimAlpha);

  // Cross-sibling Gaussian touch glow spilling through the liquid bridge & nearby rims
  float touchDist = length(px - uTouchPos);
  float gaussianGlow = uTouchStrength * exp(-0.5 * (touchDist * touchDist) / (72.0 * 72.0));
  float rimBleed = 0.35 + 0.65 * rimBand;
  glassCol += vec3(0.78, 0.90, 1.0) * gaussianGlow * (0.22 + 0.28 * rimBleed);

  float aa = clamp(-d + 0.65, 0.0, 1.0);
  outColor = vec4(mix(bgSharp, glassCol, aa), 1.0);
}`;

const LIB_ICON = `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"/></svg>`;

export function createGlassContainer(options: GlassContainerOptions = {}): GlassContainerHandle {
  if (options.childrenVariants) {
    const hasRegular = options.childrenVariants.includes("regular");
    const hasClear = options.childrenVariants.includes("clear");
    if (hasRegular && hasClear) {
      throw new Error("GlassEffectContainer cannot mix 'regular' and 'clear' material variants in the same sampling group.");
    }
  }

  let gap = options.gap ?? 8;
  let smoothK = options.smoothK ?? 26;
  let tint = options.tint ?? 0.08;
  let backdropSrc = options.backdropSrc ?? "/img/fluid-dark.webp";

  const root = makeEl("div", "lg-droplet-stage", {
    role: "group",
    "aria-label": options.ariaLabel ?? "Shared Fluid Glass Container",
  });

  const canvas = makeEl("canvas", "lg-droplet-canvas");
  root.appendChild(canvas);

  const PILL_W = 148;
  const PILL_H = 52;
  const ORB_W = 52;
  const ORB_H = 52;

  const pillAEl = makeEl("button", "lg-droplet-item", {
    type: "button",
    "aria-label": "Library",
  });
  pillAEl.innerHTML = `${LIB_ICON}<span>Library</span>`;

  const orbBEl = makeEl("button", "lg-droplet-item lg-droplet-orb", {
    type: "button",
    "aria-label": "Drag or hold companion search orb",
  });
  orbBEl.innerHTML = SEARCH_ICON;

  root.append(pillAEl, orbBEl);

  let width = 640;
  let height = 240;
  let touchX = 320;
  let touchY = 120;
  let touchStrength = 0;

  let gl: WebGL2RenderingContext | null = null;
  let prog: WebGLProgram | null = null;
  let tex: WebGLTexture | null = null;
  let hasTex = false;
  let imgEl: HTMLImageElement | null = null;
  let destroyed = false;

  const uniforms: Record<string, WebGLUniformLocation | null> = {};

  const initGL = () => {
    try {
      gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    } catch {
      gl = null;
    }
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl!.createShader(type);
      if (!sh) return null;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) return null;
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, DROPLET_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, DROPLET_FRAG);
    if (!vs || !fs) {
      gl = null;
      return;
    }
    prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl = null;
      return;
    }

    tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    for (const name of [
      "uTex",
      "uHasTex",
      "uSize",
      "uPillA",
      "uPillB",
      "uRadiusA",
      "uRadiusB",
      "uSmoothK",
      "uTint",
      "uTouchPos",
      "uTouchStrength",
    ]) {
      uniforms[name] = gl.getUniformLocation(prog, name);
    }
  };

  const loadTexture = (src: string) => {
    if (typeof Image === "undefined") return;
    const im = new Image();
    imgEl = im;
    im.onload = () => {
      if (destroyed || imgEl !== im) return;
      if (gl && tex) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        hasTex = true;
      }
      render();
    };
    im.src = src;
  };

  const computeCenters = () => {
    const span = PILL_W + gap + ORB_W;
    const leftEdge = (width - span) * 0.5;
    const cy = height * 0.5;
    const ax = leftEdge + PILL_W * 0.5;
    const bx = leftEdge + PILL_W + gap + ORB_W * 0.5;
    return { ax, ay: cy, bx, by: cy };
  };

  const syncDomPositions = (ax: number, ay: number, bx: number, by: number) => {
    pillAEl.style.width = `${PILL_W}px`;
    pillAEl.style.height = `${PILL_H}px`;
    pillAEl.style.transform = `translate(${(ax - PILL_W * 0.5).toFixed(1)}px, ${(ay - PILL_H * 0.5).toFixed(1)}px)`;

    orbBEl.style.width = `${ORB_W}px`;
    orbBEl.style.height = `${ORB_H}px`;
    orbBEl.style.transform = `translate(${(bx - ORB_W * 0.5).toFixed(1)}px, ${(by - ORB_H * 0.5).toFixed(1)}px)`;
  };

  const renderFallback2D = (ax: number, ay: number, bx: number, by: number) => {
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const step = 4;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, width, height);
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      ctx.drawImage(imgEl, 0, height * 0.25, width, height * 0.5, 0, 0, width, height);
    }
    const sdf = (px: number, py: number) => {
      const d1 = superellipseSDF(px - ax, py - ay, PILL_W * 0.5, PILL_H * 0.5, 26, 4);
      const d2 = superellipseSDF(px - bx, py - by, ORB_W * 0.5, ORB_H * 0.5, 26, 4);
      return sminCubic(d1, d2, smoothK);
    };
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const { d } = sminCubicGradient(x + step * 0.5, y + step * 0.5, sdf, 0.5);
        if (d <= 0) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  };

  const render = () => {
    if (destroyed) return;
    const rectW = root.clientWidth;
    const rectH = root.clientHeight;
    if (rectW > 0 && rectH > 0) {
      width = rectW;
      height = rectH;
    }

    const { ax, ay, bx, by } = computeCenters();
    syncDomPositions(ax, ay, bx, by);

    if (gl && prog) {
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const cw = Math.max(2, Math.round(width * dpr));
      const ch = Math.max(2, Math.round(height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(prog);
      if (tex && hasTex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(uniforms.uTex!, 0);
      }
      gl.uniform1f(uniforms.uHasTex!, hasTex ? 1.0 : 0.0);
      gl.uniform2f(uniforms.uSize!, width, height);
      gl.uniform4f(uniforms.uPillA!, ax, ay, PILL_W * 0.5, PILL_H * 0.5);
      gl.uniform4f(uniforms.uPillB!, bx, by, ORB_W * 0.5, ORB_H * 0.5);
      gl.uniform1f(uniforms.uRadiusA!, PILL_H * 0.5);
      gl.uniform1f(uniforms.uRadiusB!, ORB_H * 0.5);
      gl.uniform1f(uniforms.uSmoothK!, smoothK);
      gl.uniform1f(uniforms.uTint!, tint);
      gl.uniform2f(uniforms.uTouchPos!, touchX, touchY);
      gl.uniform1f(uniforms.uTouchStrength!, touchStrength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    renderFallback2D(ax, ay, bx, by);
  };

  const glowSpring = createSpring(0, 460, 34, (v) => {
    touchStrength = clamp01(v);
    render();
  });

  let dragState: { id: number; startX: number; startGap: number } | null = null;

  const updatePointerCoords = (ev: PointerEvent) => {
    const box = root.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      touchX = ev.clientX - box.left;
      touchY = ev.clientY - box.top;
    }
  };

  const onDown = (ev: PointerEvent) => {
    if (!ev.isPrimary || ev.button !== 0) return;
    updatePointerCoords(ev);
    glowSpring.set(1);
    const onOrb = (ev.target as Element)?.closest?.(".lg-droplet-orb") || touchX > width * 0.45;
    if (onOrb) {
      dragState = { id: ev.pointerId, startX: ev.clientX, startGap: gap };
      root.setPointerCapture?.(ev.pointerId);
      root.dataset.dragging = "";
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (dragState && ev.pointerId === dragState.id) {
      const nextGap = clampRange(Math.round(dragState.startGap + (ev.clientX - dragState.startX)), -16, 64);
      gap = nextGap;
      options.onGapChange?.(gap);
      updatePointerCoords(ev);
      render();
    } else if (touchStrength > 0.01) {
      updatePointerCoords(ev);
      render();
    }
  };

  const onEnd = (ev: PointerEvent) => {
    if (dragState && ev.pointerId === dragState.id) {
      dragState = null;
      delete root.dataset.dragging;
      if (root.hasPointerCapture?.(ev.pointerId)) root.releasePointerCapture(ev.pointerId);
    }
    glowSpring.set(0);
  };

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onEnd);
  root.addEventListener("pointercancel", onEnd);

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(render) : null;
  ro?.observe(root);

  initGL();
  loadTexture(backdropSrc);
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(render) : 0;

  return {
    element: root,
    setGap(next) {
      gap = clampRange(next, -16, 64);
      render();
    },
    getGap: () => gap,
    setSmoothK(k) {
      smoothK = clampRange(k, 0, 56);
      render();
    },
    getSmoothK: () => smoothK,
    setTint(next) {
      tint = clamp01(next);
      render();
    },
    setBackdropSrc(src) {
      backdropSrc = src;
      loadTexture(src);
    },
    refit: () => render(),
    destroy() {
      destroyed = true;
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      glowSpring.stop();
      ro?.disconnect();
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onEnd);
      root.removeEventListener("pointercancel", onEnd);
      if (gl) {
        if (tex) gl.deleteTexture(tex);
        if (prog) gl.deleteProgram(prog);
      }
    },
  };
}
