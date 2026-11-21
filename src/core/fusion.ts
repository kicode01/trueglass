import { distance } from "./lens";
import { sminCubic } from "./optics";
import { createSpring, onSpringActivity } from "./spring";
import { svgEl } from "./svg";

export interface FusionGroupOptions {
  /** Whether live DOM droplet fusion is enabled (default true). */
  enabled?: boolean;
  /** Maximum C2 smooth-min neck radius in CSS px when pills approach/overlap (default 18). */
  smoothK?: number;
  /** Edge-to-edge proximity threshold in CSS px where liquid fusion begins (default 8). */
  threshold?: number;
  /** CSS selector for participating sibling glass elements (default ":scope > .lg-glass"). */
  selector?: string;
}

export interface FusionGroupHandle {
  update(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  destroy(): void;
}

interface PillBox {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
}

const PAD = 28;
const GRID_STEP = 1.5;
let fusionIdSeq = 0;

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/**
 * Standard Marching Squares edge pairs per 4-bit corner mask:
 * bit 8 = TL, bit 4 = TR, bit 2 = BR, bit 1 = BL.
 * Edge indices: 0 = Top, 1 = Right, 2 = Bottom, 3 = Left.
 */
const MS_TABLE: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[1, 0]],
  [
    [3, 0],
    [1, 2],
  ],
  [[2, 0]],
  [[3, 0]],
  [[0, 3]],
  [[0, 2]],
  [
    [0, 1],
    [2, 3],
  ],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[2, 3]],
  [],
];

/**
 * Extracts airtight, sub-pixel-interpolated closed SVG path loops for the zero-level contour
 * of the C2 `sminCubic` union of arbitrary superellipse pills.
 */
export function buildFusionPath(pills: readonly PillBox[], width: number, height: number, k: number): string {
  if (!pills.length || width <= 0 || height <= 0) return "";
  const cols = Math.ceil(width / GRID_STEP) + 1;
  const rows = Math.ceil(height / GRID_STEP) + 1;
  const field = new Float32Array(cols * rows);

  // Tight bounding box around pills + smoothK margin to skip distant empty cells
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pills) {
    if (p.cx - p.hw < minX) minX = p.cx - p.hw;
    if (p.cy - p.hh < minY) minY = p.cy - p.hh;
    if (p.cx + p.hw > maxX) maxX = p.cx + p.hw;
    if (p.cy + p.hh > maxY) maxY = p.cy + p.hh;
  }
  const margin = k + GRID_STEP * 3;
  const gxMin = Math.max(1, Math.floor((minX - margin) / GRID_STEP));
  const gyMin = Math.max(1, Math.floor((minY - margin) / GRID_STEP));
  const gxMax = Math.min(cols - 2, Math.ceil((maxX + margin) / GRID_STEP));
  const gyMax = Math.min(rows - 2, Math.ceil((maxY + margin) / GRID_STEP));

  field.fill(64);
  for (let gy = gyMin; gy <= gyMax; gy++) {
    const y = gy * GRID_STEP;
    const rowOff = gy * cols;
    for (let gx = gxMin; gx <= gxMax; gx++) {
      const x = gx * GRID_STEP;
      const p0 = pills[0]!;
      let d = distance(x - p0.cx, y - p0.cy, p0.hw, p0.hh, p0.r);
      for (let i = 1; i < pills.length; i++) {
        const pi = pills[i]!;
        const di = distance(x - pi.cx, y - pi.cy, pi.hw, pi.hh, pi.r);
        d = k > 0.05 ? sminCubic(d, di, k) : d < di ? d : di;
      }
      field[rowOff + gx] = d;
    }
  }

  // Build directed edge graph keyed by canonical integer grid-edge IDs
  const vertX = new Map<number, number>();
  const vertY = new Map<number, number>();
  const nextEdge = new Map<number, number>();

  // Edge key encoding: horizontal edges (top/bottom) use type 0, vertical edges (left/right) use type 1
  const hKey = (gx: number, gy: number) => (gy * cols + gx) * 2;
  const vKey = (gx: number, gy: number) => (gy * cols + gx) * 2 + 1;

  const edgeVertex = (gx: number, gy: number, edge: number, dTL: number, dTR: number, dBR: number, dBL: number): number => {
    const x0 = gx * GRID_STEP;
    const y0 = gy * GRID_STEP;
    let id: number;
    let px: number;
    let py: number;
    if (edge === 0) {
      id = hKey(gx, gy);
      const t = clamp(dTL / (dTL - dTR || 1e-6), 0.001, 0.999);
      px = x0 + t * GRID_STEP;
      py = y0;
    } else if (edge === 1) {
      id = vKey(gx + 1, gy);
      const t = clamp(dTR / (dTR - dBR || 1e-6), 0.001, 0.999);
      px = x0 + GRID_STEP;
      py = y0 + t * GRID_STEP;
    } else if (edge === 2) {
      id = hKey(gx, gy + 1);
      const t = clamp(dBL / (dBL - dBR || 1e-6), 0.001, 0.999);
      px = x0 + t * GRID_STEP;
      py = y0 + GRID_STEP;
    } else {
      id = vKey(gx, gy);
      const t = clamp(dTL / (dTL - dBL || 1e-6), 0.001, 0.999);
      px = x0;
      py = y0 + t * GRID_STEP;
    }
    if (!vertX.has(id)) {
      vertX.set(id, px);
      vertY.set(id, py);
    }
    return id;
  };

  for (let gy = Math.max(0, gyMin - 1); gy <= Math.min(rows - 2, gyMax); gy++) {
    const r0 = gy * cols;
    const r1 = (gy + 1) * cols;
    for (let gx = Math.max(0, gxMin - 1); gx <= Math.min(cols - 2, gxMax); gx++) {
      const dTL = field[r0 + gx]!;
      const dTR = field[r0 + gx + 1]!;
      const dBR = field[r1 + gx + 1]!;
      const dBL = field[r1 + gx]!;
      const mask = (dTL <= 0 ? 8 : 0) | (dTR <= 0 ? 4 : 0) | (dBR <= 0 ? 2 : 0) | (dBL <= 0 ? 1 : 0);
      if (mask === 0 || mask === 15) continue;

      let pairs = MS_TABLE[mask]!;
      if (mask === 5 || mask === 10) {
        const centerInside = dTL + dTR + dBR + dBL <= 0;
        if (mask === 5) {
          pairs = centerInside ? [[3, 0], [1, 2]] : [[3, 2], [1, 0]];
        } else {
          pairs = centerInside ? [[0, 1], [2, 3]] : [[0, 3], [2, 1]];
        }
      }
      for (const [eFrom, eTo] of pairs) {
        const a = edgeVertex(gx, gy, eFrom, dTL, dTR, dBR, dBL);
        const b = edgeVertex(gx, gy, eTo, dTL, dTR, dBR, dBL);
        nextEdge.set(a, b);
      }
    }
  }

  // Trace closed contour loops, apply one light Laplacian smoothing pass, and emit SVG path
  const visited = new Set<number>();
  const parts: string[] = [];

  for (const start of nextEdge.keys()) {
    if (visited.has(start)) continue;
    const xs: number[] = [];
    const ys: number[] = [];
    let cur: number | undefined = start;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      xs.push(vertX.get(cur)!);
      ys.push(vertY.get(cur)!);
      cur = nextEdge.get(cur);
    }
    const n = xs.length;
    if (n < 3) continue;

    // 1-pass light closed-loop smoothing removes 2px grid micro-facets while preserving sharp pill corners
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    if (n >= 6) {
      for (let i = 0; i < n; i++) {
        const prev = (i - 1 + n) % n;
        const next = (i + 1) % n;
        sx[i] = xs[i]! * 0.6 + (xs[prev]! + xs[next]!) * 0.2;
        sy[i] = ys[i]! * 0.6 + (ys[prev]! + ys[next]!) * 0.2;
      }
    } else {
      for (let i = 0; i < n; i++) {
        sx[i] = xs[i]!;
        sy[i] = ys[i]!;
      }
    }

    let seg = `M${sx[0]!.toFixed(1)} ${sy[0]!.toFixed(1)}`;
    for (let i = 1; i < n; i++) {
      seg += `L${sx[i]!.toFixed(1)} ${sy[i]!.toFixed(1)}`;
    }
    parts.push(`${seg}Z`);
  }

  return parts.join(" ");
}

function isFuseEligible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.getAttribute("data-variant") === "filled") return false;
  if (el.getAttribute("data-material") === "identity") return false;
  if (el.hasAttribute("data-dematerialized")) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.1) return false;
  return true;
}

/**
 * Attaches live C2 `sminCubic` liquid droplet fusion to adjacent glass DOM controls (e.g. grouped buttons).
 * When a control is pressed and pulled toward a sibling, both pills melt into a single continuous frosted
 * liquid contour with a unified Fresnel specular rim and cross-sibling internal touch glow.
 */
export function attachGlassFusionGroup(
  container: HTMLElement,
  options: FusionGroupOptions = {},
): FusionGroupHandle {
  let enabled = options.enabled ?? true;
  const maxSmoothK = options.smoothK ?? 18;
  const threshold = options.threshold ?? 8;
  const selector = options.selector ?? ":scope > .lg-glass";

  if (enabled) container.setAttribute("data-fusion-group", "");

  const id = `lg-fusion-${++fusionIdSeq}`;
  const layer = document.createElement("div");
  layer.className = "lg-fusion-layer";
  layer.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "lg-fusion-backdrop";

  const svg = svgEl("svg", { class: "lg-fusion-svg", "aria-hidden": "true" });
  const defs = svgEl("defs", {});

  const clip = svgEl("clipPath", { id: `${id}-clip` });
  const clipPath = svgEl("path", { d: "" });
  clip.append(clipPath);

  const rimGrad = svgEl("linearGradient", { id: `${id}-rim`, x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
  rimGrad.append(
    svgEl("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": "0.62" }),
    svgEl("stop", { offset: "28%", "stop-color": "#ffffff", "stop-opacity": "0.18" }),
    svgEl("stop", { offset: "50%", "stop-color": "#ffffff", "stop-opacity": "0.06" }),
    svgEl("stop", { offset: "74%", "stop-color": "#d8ecff", "stop-opacity": "0.16" }),
    svgEl("stop", { offset: "100%", "stop-color": "#e8f4ff", "stop-opacity": "0.46" }),
  );

  const glowGrad = svgEl("radialGradient", { id: `${id}-glow` });
  glowGrad.append(
    svgEl("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": "0.24" }),
    svgEl("stop", { offset: "45%", "stop-color": "#d6ecff", "stop-opacity": "0.08" }),
    svgEl("stop", { offset: "100%", "stop-color": "#ffffff", "stop-opacity": "0" }),
  );

  defs.append(clip, rimGrad, glowGrad);

  const group = svgEl("g", { "clip-path": `url("#${id}-clip")` });
  const glowCircle = svgEl("circle", { cx: 0, cy: 0, r: 120, fill: `url("#${id}-glow")`, opacity: 0 });
  const edgePath = svgEl("path", { d: "", fill: "none", stroke: "var(--lg-edge)", "stroke-width": 1.1 });
  const rimPath = svgEl("path", { d: "", fill: "none", stroke: `url("#${id}-rim")`, "stroke-width": 2.4 });
  group.append(glowCircle, edgePath, rimPath);
  svg.append(defs, group);

  layer.append(backdrop, svg);
  container.prepend(layer);

  let destroyed = false;
  let rafId = 0;
  let idleFrames = 0;
  let activeFusing = false;
  let touchX = 0;
  let touchY = 0;
  let pointerDown = false;
  let touchGlow = 0;
  let fusionMix = 0;
  let fusedEls: HTMLElement[] = [];

  const getItems = (): HTMLElement[] => {
    try {
      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.classList.contains("lg-fusion-layer") && isFuseEligible(el),
      );
    } catch {
      return Array.from(container.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("lg-glass") && isFuseEligible(el),
      );
    }
  };

  const clearFused = () => {
    if (!activeFusing && fusedEls.length === 0) return;
    activeFusing = false;
    container.removeAttribute("data-fusing");
    layer.style.opacity = "0";
    for (const el of fusedEls) el.removeAttribute("data-fused");
    fusedEls = [];
  };

  const glowSpring = createSpring(0, 380, 30, (v) => {
    touchGlow = clamp(v, 0, 1);
    wake();
  });

  const mixSpring = createSpring(0, 420, 32, (v) => {
    fusionMix = clamp(v, 0, 1);
    wake();
  });

  const renderFrame = (): boolean => {
    if (destroyed || !enabled) {
      clearFused();
      return false;
    }
    const items = getItems();
    if (items.length < 2) {
      clearFused();
      return false;
    }

    const hostRect = container.getBoundingClientRect();
    if (hostRect.width <= 0 || hostRect.height <= 0) {
      clearFused();
      return false;
    }

    const rects = items.map((el) => el.getBoundingClientRect());
    const anyPressed = pointerDown || items.some((el) => el.hasAttribute("data-pressed"));
    const anyMoved = items.some((el) => {
      const tr = el.style.translate.trim();
      const sc = el.style.scale.trim();
      if (tr) {
        const nums = tr.match(/-?[\d.]+/g);
        if (nums && nums.some((n) => Math.abs(parseFloat(n)) > 0.15)) return true;
      }
      if (sc) {
        const nums = sc.match(/-?[\d.]+/g);
        if (nums && nums.some((n) => Math.abs(parseFloat(n) - 1) > 0.003)) return true;
      }
      return false;
    });

    // Compute closest edge-to-edge gap between any sibling pair
    let minGap = Infinity;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const dx = Math.max(0, Math.max(b.left - a.right, a.left - b.right));
        const dy = Math.max(0, Math.max(b.top - a.bottom, a.top - b.bottom));
        const edgeGap = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
        // Signed overlap when intersecting
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const signedGap = overlapX > 0 && overlapY > 0 ? -Math.min(overlapX, overlapY) : edgeGap;
        if (signedGap < minGap) minGap = signedGap;
      }
    }

    const wantsFusion = (anyPressed || anyMoved) && minGap < threshold;
    if (wantsFusion && mixSpring.target() !== 1) mixSpring.set(1);
    else if (!wantsFusion && mixSpring.target() !== 0) mixSpring.set(0);

    if (!wantsFusion && fusionMix < 0.015) {
      clearFused();
      return false;
    }

    // Sync glass surface styling from the first sibling so fused backdrop matches seamlessly
    const refStyle = getComputedStyle(items[0]!);
    const layerW = Math.ceil(hostRect.width + PAD * 2);
    const layerH = Math.ceil(hostRect.height + PAD * 2);
    layer.style.left = `${-PAD}px`;
    layer.style.top = `${-PAD}px`;
    layer.style.width = `${layerW}px`;
    layer.style.height = `${layerH}px`;
    layer.style.opacity = "1";
    svg.setAttribute("viewBox", `0 0 ${layerW} ${layerH}`);

    const blurProp = refStyle.getPropertyValue("--lg-blur").trim() || "12px";
    const bgProp = refStyle.getPropertyValue("--lg-glass").trim() || "rgb(20 22 30 / 0.56)";
    backdrop.style.setProperty("--lg-fusion-blur", blurProp);
    backdrop.style.setProperty("--lg-fusion-bg", bgProp);

    // Build live pill boxes in layer coordinates
    const pills: PillBox[] = items.map((el, idx) => {
      const r = rects[idx]!;
      const st = idx === 0 ? refStyle : getComputedStyle(el);
      const rawRad = st.borderTopLeftRadius;
      const rad = rawRad.endsWith("%") ? (Math.min(r.width, r.height) * parseFloat(rawRad)) / 100 : parseFloat(rawRad) || r.height * 0.5;
      return {
        cx: r.left - hostRect.left + PAD + r.width * 0.5,
        cy: r.top - hostRect.top + PAD + r.height * 0.5,
        hw: r.width * 0.5,
        hh: r.height * 0.5,
        r: Math.min(r.width * 0.5, r.height * 0.5, rad),
      };
    });

    const proximity = clamp((threshold - minGap) / (threshold + 8), 0, 1);
    const k = maxSmoothK * proximity * fusionMix;
    const d = buildFusionPath(pills, layerW, layerH, k);

    if (!d) {
      clearFused();
      return false;
    }

    const clipVal = `path("${d}")`;
    backdrop.style.clipPath = clipVal;
    (backdrop.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath = clipVal;
    clipPath.setAttribute("d", d);
    edgePath.setAttribute("d", d);
    rimPath.setAttribute("d", d);

    glowCircle.setAttribute("cx", (touchX - hostRect.left + PAD).toFixed(1));
    glowCircle.setAttribute("cy", (touchY - hostRect.top + PAD).toFixed(1));
    glowCircle.setAttribute("opacity", (touchGlow * fusionMix).toFixed(3));

    if (!activeFusing) {
      activeFusing = true;
      container.setAttribute("data-fusing", "");
    }
    const nextSet = new Set(items);
    for (const prev of fusedEls) {
      if (!nextSet.has(prev)) prev.removeAttribute("data-fused");
    }
    for (const el of items) el.setAttribute("data-fused", "");
    fusedEls = items;

    return anyPressed || anyMoved || fusionMix > 0.015;
  };

  const loop = () => {
    rafId = 0;
    if (destroyed) return;
    const active = renderFrame();
    if (active) {
      idleFrames = 0;
      rafId = requestAnimationFrame(loop);
    } else if (idleFrames < 8) {
      idleFrames++;
      rafId = requestAnimationFrame(loop);
    }
  };

  const wake = () => {
    if (destroyed) return;
    idleFrames = 0;
    if (!rafId && typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(loop);
    }
  };

  const onPointerDown = (ev: PointerEvent) => {
    if (!enabled) return;
    pointerDown = true;
    touchX = ev.clientX;
    touchY = ev.clientY;
    glowSpring.set(1);
    wake();
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!enabled || !pointerDown) return;
    touchX = ev.clientX;
    touchY = ev.clientY;
    wake();
  };

  const onPointerEnd = () => {
    if (!pointerDown) return;
    pointerDown = false;
    glowSpring.set(0);
    wake();
  };

  container.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  const stopSpringWatch = onSpringActivity(() => {
    if (enabled && (pointerDown || activeFusing || fusionMix > 0.01)) wake();
  });

  return {
    update: () => {
      renderFrame();
    },
    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        container.setAttribute("data-fusion-group", "");
        wake();
      } else {
        pointerDown = false;
        glowSpring.set(0, true);
        mixSpring.set(0, true);
        clearFused();
        container.removeAttribute("data-fusion-group");
      }
    },
    isEnabled: () => enabled,
    destroy() {
      destroyed = true;
      if (rafId && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
      stopSpringWatch();
      glowSpring.stop();
      mixSpring.stop();
      clearFused();
      container.removeAttribute("data-fusion-group");
      container.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      layer.remove();
    },
  };
}
