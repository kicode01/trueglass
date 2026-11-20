import { createDrawnLens, drawsLens } from "./drawn";
import { createLens, distance, fitBackdropLens, shapeOf, type Lens, type LensOptions, type Shape } from "./lens";
import { createSpring } from "./spring";
import { svgContainer, svgEl } from "./svg";

export const GLASS: LensOptions = {
  strength: 2,
  strengthProperty: "--lg-glass-bend",
  dispersion: 0.6,
  dispersionProperty: "--lg-glass-dispersion",
  depth: 0.3,
  maxDepth: 36,
  dome: 0,
  splay: 1,
  relative: true,
  bezel: true,
  paintsLight: true,
};

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

const RIM_WIDTH = 1.22;
const EDGE_WIDTH = 0.5;

type Colour = readonly [number, number, number, number];

/**
 * Generates pixel-accurate 1.22px bowed rim specular highlight + 0.5px hairline edge
 * at up to 3x DPR, supporting dynamic virtual light rotation (`lightAngleDeg`).
 */
export function rimMap(
  { width, height, radius }: Shape,
  shine: number,
  density: number,
  edge: Colour = [0, 0, 0, 0],
  lightAngleDeg = -135,
): { columns: number; rows: number; data: Uint8ClampedArray } {
  const columns = Math.max(1, Math.round(width * density));
  const rows = Math.max(1, Math.round(height * density));
  const data = new Uint8ClampedArray(columns * rows * 4);
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const corner = clamp(radius, 0, Math.min(halfWidth, halfHeight));
  const half = 0.5 / density;

  const defaultAngle = Math.abs(lightAngleDeg + 135) < 0.01;
  // Light direction vector (at -135deg, matches -(nx + ny) diagonal symmetry; rotates seamlessly on tilt)
  const rad = (lightAngleDeg * Math.PI) / 180;
  const lx = Math.SQRT2 * Math.cos(rad);
  const ly = Math.SQRT2 * Math.sin(rad);

  const band = 2 * RIM_WIDTH + half;
  const innerYLimit = halfHeight - Math.max(corner, band);
  const sideBandCols = Math.ceil(band * density) + 2;
  const skipMidRow = columns > sideBandCols * 2 + 2;

  for (let row = 0; row < rows; row++) {
    const y = ((row + 0.5) / rows) * height - halfHeight;
    const ay = y < 0 ? -y : y;
    const sy = y < 0 ? -1 : 1;
    const qy = ay - halfHeight + corner;
    const rowOff = row * columns;
    const canSkipInterior = skipMidRow && ay < innerYLimit;
    const rightJumpCol = columns - sideBandCols;
    for (let column = 0; column < columns; column++) {
      if (canSkipInterior && column === sideBandCols) {
        column = rightJumpCol;
      }
      const x = ((column + 0.5) / columns) * width - halfWidth;
      const depth = -distance(x, y, halfWidth, halfHeight, corner);
      if (depth < -half || depth > 2 * RIM_WIDTH) continue;

      const ax = x < 0 ? -x : x;
      const sx = x < 0 ? -1 : 1;
      const qx = ax - halfWidth + corner;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        const qx3 = qx * qx * qx;
        const qy3 = qy * qy * qy;
        const nLen = Math.sqrt(qx3 * qx3 + qy3 * qy3);
        if (nLen > 1e-9) {
          const invLen = 1 / nLen;
          nx = sx * qx3 * invLen;
          ny = sy * qy3 * invLen;
        }
      } else if (qx > qy) {
        nx = sx;
      } else {
        ny = sy;
      }

      const aniso = 1 + 0.08 * (ny * ny - nx * nx);
      const facing = (defaultAngle ? Math.abs(nx + ny) : Math.abs(nx * lx + ny * ly)) * aniso;
      const along = (depth > 0 ? depth : 0) / (RIM_WIDTH * Math.sqrt(Math.max(1, facing)));
      const cover = clamp((depth + half) * density, 0, 1);
      const lined = clamp((Math.min(EDGE_WIDTH, depth + half) - Math.max(0, depth - half)) * density, 0, 1);
      const facingCap = facing < 1 ? facing : 1;
      const light =
        along < 1 ? shine * (facingCap * Math.sqrt(facingCap)) * (1 - along * Math.sqrt(along)) * cover : 0;
      const line = edge[3] * lined * (1 - light);
      const alpha = light + line;
      if (alpha <= 0) continue;
      const i = (rowOff + column) * 4;
      for (let channel = 0; channel < 3; channel++) {
        data[i + channel] = Math.round((255 * light + edge[channel]! * line) / alpha);
      }
      data[i + 3] = Math.round(255 * alpha);
    }
  }
  return { columns, rows, data };
}

function parseColour(context: CanvasRenderingContext2D, colour: string): Colour {
  context.fillStyle = "#0000";
  context.fillStyle = colour;
  const value = String(context.fillStyle);
  if (value.startsWith("#")) {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
    return [r!, g!, b!, 1];
  }
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
}

const rims = new Map<string, string>();
let palette: CanvasRenderingContext2D | null | undefined;
let rimScratchCanvas: HTMLCanvasElement | null = null;
let rimScratchCtx: CanvasRenderingContext2D | null = null;

function getPalette(): CanvasRenderingContext2D | null {
  if (palette !== undefined) return palette;
  palette = null;
  if (typeof document === "undefined") return null;
  try {
    palette = document.createElement("canvas").getContext("2d");
  } catch {
    palette = null;
  }
  return palette;
}

function getRimScratch(columns: number, rows: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  if (!rimScratchCanvas) {
    rimScratchCanvas = document.createElement("canvas");
    rimScratchCtx = rimScratchCanvas.getContext("2d");
  }
  if (!rimScratchCtx) return null;
  if (rimScratchCanvas.width !== columns || rimScratchCanvas.height !== rows) {
    rimScratchCanvas.width = columns;
    rimScratchCanvas.height = rows;
  }
  return { canvas: rimScratchCanvas, context: rimScratchCtx };
}

function paintRim(element: HTMLElement): void {
  if (typeof document === "undefined") return;
  const style = getComputedStyle(element);
  const shape = shapeOf(element, style);
  const pal = getPalette();
  if (!shape || !pal) return;

  const tuned = parseFloat(style.getPropertyValue("--lg-rim-shine"));
  const shine = Number.isFinite(tuned) ? clamp(tuned, 0, 1) : 0.13;
  const edge = parseColour(pal, style.getPropertyValue("--lg-edge").trim() || "transparent");
  const angleStr = style.getPropertyValue("--lg-light-angle").trim();
  const angleProp = angleStr ? parseFloat(angleStr) : NaN;
  const lightAngle = Number.isFinite(angleProp) ? angleProp : -135;
  // Rim facing |nx*lx + ny*ly| is 180deg-periodic; fold angle to maximize cache reuse
  const folded = ((lightAngle % 180) + 180) % 180;
  const lightKey = Math.abs(lightAngle + 135) < 0.01 ? "-135" : String(Math.round(folded / 2) * 2);
  const density = typeof window !== "undefined" ? Math.min(devicePixelRatio || 1, 2) : 1;
  const key = [shape.width, shape.height, shape.radius, shine.toFixed(2), edge.join(","), lightKey, density].join("|");

  let url = rims.get(key);
  if (!url) {
    const { columns, rows, data } = rimMap(shape, shine, density, edge, lightAngle);
    const scratch = getRimScratch(columns, rows);
    if (!scratch) return;
    const { canvas, context } = scratch;
    const image = context.createImageData(columns, rows);
    image.data.set(data);
    context.putImageData(image, 0, 0);
    try {
      url = `url("${canvas.toDataURL()}")`;
    } catch {
      return;
    }
    if (rims.size > 160) {
      const oldest = rims.keys().next().value;
      if (oldest !== undefined) rims.delete(oldest);
    }
    rims.set(key, url);
  }
  element.style.setProperty("--lg-rim", url);
  element.setAttribute("data-rim", "");
}

const repaints = new Set<() => void>();
let unwatch: (() => void) | undefined;

function onThemeChange(repaint: () => void): () => void {
  repaints.add(repaint);
  if (!unwatch && typeof document !== "undefined") {
    const run = () => repaints.forEach((each) => each());
    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"], subtree: true });
    const scheme = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    scheme?.addEventListener?.("change", run);
    unwatch = () => {
      observer.disconnect();
      scheme?.removeEventListener?.("change", run);
    };
  }
  return () => {
    repaints.delete(repaint);
    if (repaints.size) return;
    unwatch?.();
    unwatch = undefined;
  };
}

function whenIdle(callback: () => void): () => void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout: 250 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 16);
  return () => clearTimeout(handle);
}

interface Fitting {
  refit(): void;
  stop(): void;
}

function refitting(element: HTMLElement, fit: () => void, properties: string[]): Fitting {
  let cancel: (() => void) | undefined;
  let rafId = 0;
  let fitted = false;
  let stopped = false;
  const runFit = () => {
    if (stopped) return;
    fitted = true;
    fit();
  };
  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      cancel?.();
      cancel = whenIdle(runFit);
    });
    observer.observe(element);
  }
  if (typeof requestAnimationFrame === "function") {
    rafId = requestAnimationFrame(runFit);
  }
  return {
    refit: () => {
      if (stopped) return;
      if (fitted) fit();
      else runFit();
    },
    stop: () => {
      stopped = true;
      cancel?.();
      if (rafId && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
      observer?.disconnect();
      for (const name of properties) element.style.removeProperty(name);
    },
  };
}

export const refractsBackdrop = (): boolean =>
  typeof navigator !== "undefined" && /Chrom(?:e|ium)|Edg\//.test(navigator.userAgent);

const BACKDROP_MARK = "data-fluid-backdrop";

function visibleBox(element: HTMLElement): DOMRect {
  let { left, top, right, bottom } = element.getBoundingClientRect();
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (!/hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) continue;
    const clip = node.getBoundingClientRect();
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

function findBackdrop(element: HTMLElement): HTMLElement | null {
  if (typeof document === "undefined" || !element.isConnected) return null;
  const box = element.getBoundingClientRect();
  const behind = (candidate: HTMLElement) => {
    if (candidate.contains(element) || element.contains(candidate)) return false;
    const other = visibleBox(candidate);
    if (box.width === 0 && box.height === 0 && other.width === 0 && other.height === 0) return true;
    return other.left < box.right && other.right > box.left && other.top < box.bottom && other.bottom > box.top;
  };
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const found = [...node.querySelectorAll<HTMLElement>(`[${BACKDROP_MARK}]`)].find(behind);
    if (found) return found;
  }
  return null;
}

const followed = new Map<HTMLElement, Set<Lens>>();
let following = 0;

function follow(): void {
  for (const lenses of followed.values()) lenses.values().next().value?.update();
  following = followed.size ? requestAnimationFrame(follow) : 0;
}

const SELECTION_PROPERTIES = ["--lg-filter", "--lg-rim", "--lg-rim-bright"];

interface Selection {
  filter: string;
  rim: string;
  brightRim: string;
}

const selections = new Map<string, Selection>();

function profile(bezel: number, thickness: number): { samples: Float32Array; maximum: number } {
  const samples = new Float32Array(128);
  let maximum = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = Math.max(0.001, i / (samples.length - 1));
    const surface = Math.pow(1 - Math.pow(1 - t, 4), 0.25);
    const incident = Math.atan(Math.pow(1 - t, 3) / Math.pow(surface, 3));
    const refracted = Math.asin(Math.sin(incident) / 1.5);
    samples[i] = Math.tan(incident - refracted) * (thickness + surface * bezel);
    maximum = Math.max(maximum, samples[i]!);
  }
  return { samples, maximum };
}

function selectionMaps(width: number, height: number, radius: number) {
  const density = typeof window !== "undefined" ? Math.min((devicePixelRatio || 1) * 1.5, 3) : 1;
  const half = 0.5 / density;
  const bezel = clamp(Math.min(width, height) * 0.12, 4, 10);
  const thickness = clamp(Math.min(width, height) * 0.2, 8, 24);
  const { samples, maximum } = profile(bezel, thickness);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * density);
  canvas.height = Math.ceil(height * density);
  const context = canvas.getContext("2d")!;
  const field = context.createImageData(canvas.width, canvas.height);
  const shine = context.createImageData(canvas.width, canvas.height);
  const bright = context.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = ((x + 0.5) * width) / canvas.width - width * 0.5;
      const py = ((y + 0.5) * height) / canvas.height - height * 0.5;
      const qx = Math.abs(px) - (width * 0.5 - radius);
      const qy = Math.abs(py) - (height * 0.5 - radius);
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const len = Math.sqrt(ox * ox + oy * oy);
      const dist = radius - (len + Math.min(Math.max(qx, qy), 0));
      let nx = 0;
      let ny = 0;
      if (ox > 0 && oy > 0) {
        const ox3 = ox * ox * ox;
        const oy3 = oy * oy * oy;
        const nLen = Math.sqrt(ox3 * ox3 + oy3 * oy3) || 1;
        nx = (ox3 / nLen) * Math.sign(px);
        ny = (oy3 / nLen) * Math.sign(py);
      } else {
        nx = qx > qy ? Math.sign(px) : 0;
        ny = qx > qy ? 0 : Math.sign(py);
      }

      let shift = 0;
      if (dist >= 0 && dist < bezel) {
        const sample = (dist / bezel) * (samples.length - 1);
        const lower = Math.floor(sample);
        const a = samples[lower]!;
        const b = samples[Math.min(lower + 1, samples.length - 1)]!;
        shift = a + (b - a) * (sample - lower);
      }

      const i = (y * canvas.width + x) * 4;
      field.data[i] = Math.round(127.5 + ((nx * shift) / maximum) * 127.5);
      field.data[i + 1] = Math.round(127.5 + ((ny * shift) / maximum) * 127.5);
      field.data[i + 2] = 128;
      field.data[i + 3] = 255;

      const light = -(nx + ny) * Math.SQRT1_2;
      const glint = Math.max(light, 0) ** 3;
      const reflected = Math.max(-light, 0) ** 3;
      shine.data[i] = shine.data[i + 1] = shine.data[i + 2] = 255;

      let alpha = 0;
      if (dist >= -half && dist < 3.2) {
        const cover = clamp((dist + half) * density, 0, 1);
        const bands = [0.38, 0.58, 0.78].map((centre) => Math.exp(-(((dist - centre) / 0.42) ** 2)));
        const peak = Math.max(...bands);
        alpha = cover * peak * (0.22 + 0.85 * glint + 0.48 * reflected) * 0.92;
        for (let channel = 0; channel < 3; channel++) {
          shine.data[i + channel] = Math.round(255 * (0.82 + 0.18 * (peak ? bands[channel]! / peak : 0)));
        }
        const wide = [0.42, 0.56, 0.7].map((centre) => Math.exp(-(((dist - centre) / 0.46) ** 2)));
        const top = Math.max(...wide);
        for (let channel = 0; channel < 3; channel++) {
          bright.data[i + channel] = Math.round(255 * (0.86 + 0.14 * (top ? wide[channel]! / top : 0)));
        }
        bright.data[i + 3] = Math.round(clamp(cover * top * (0.62 + 0.34 * glint + 0.18 * reflected), 0, 1) * 255);
      }
      shine.data[i + 3] = Math.round(clamp(alpha, 0, 1) * 255);
    }
  }

  context.putImageData(field, 0, 0);
  const displacement = canvas.toDataURL();
  context.putImageData(shine, 0, 0);
  const highlight = canvas.toDataURL();
  context.putImageData(bright, 0, 0);
  const brightHighlight = canvas.toDataURL();
  return { displacement, highlight, brightHighlight, scale: maximum * 2 };
}

function selectionLens(width: number, height: number, radius: number): Selection {
  const key = [width, height, radius].join("-");
  const cached = selections.get(key);
  if (cached) return cached;

  const { displacement, highlight, brightHighlight, scale } = selectionMaps(width, height, radius);
  const id = `fluid-glass-selection-${selections.size}`;
  const box = { x: 0, y: 0, width, height };
  const filter = svgEl("filter", {
    id,
    ...box,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  filter.append(svgEl("feImage", { href: displacement, ...box, preserveAspectRatio: "none", result: "field" }));
  const channels = [
    ["r", 1.035, "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"],
    ["g", 1, "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"],
    ["b", 0.965, "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"],
  ] as const;
  for (const [name, factor, values] of channels) {
    filter.append(
      svgEl("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "field",
        scale: scale * factor,
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: `${name}-ray`,
      }),
      svgEl("feColorMatrix", { in: `${name}-ray`, type: "matrix", values, result: name }),
    );
  }
  filter.append(
    svgEl("feComposite", { in: "r", in2: "g", operator: "arithmetic", k2: 1, k3: 1, result: "rg" }),
    svgEl("feComposite", { in: "rg", in2: "b", operator: "arithmetic", k2: 1, k3: 1 }),
  );
  svgContainer().append(filter);

  const result = { filter: `url("#${id}")`, rim: `url("${highlight}")`, brightRim: `url("${brightHighlight}")` };
  selections.set(key, result);
  return result;
}

function fitSelection(element: HTMLElement, filtered: boolean): void {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) return;
  const corner = getComputedStyle(element).borderTopLeftRadius;
  const radius = Math.min(
    width * 0.5,
    height * 0.5,
    corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0,
  );
  const { filter, rim, brightRim } = selectionLens(width, height, radius);
  if (filtered) element.style.setProperty("--lg-filter", filter);
  element.style.setProperty("--lg-rim", rim);
  element.style.setProperty("--lg-rim-bright", brightRim);
}

export interface RefractionHandle {
  refit(): void;
  repaintRim(): void;
  materialize(instant?: boolean): void;
  dematerialize(instant?: boolean): void;
  bendProgress(): number;
  destroy(): void;
}

const activeRefractions = new Set<RefractionHandle>();

export function refitAllRefractions(): void {
  for (const h of activeRefractions) h.refit();
}

export function materializeAllRefractions(): void {
  for (const h of activeRefractions) h.materialize(false);
}

export function attachRefraction(
  element: HTMLElement,
  selection = false,
  bendsBackdrop = true,
  materializeOnMount = false,
): RefractionHandle {
  let bendScale = materializeOnMount ? 0 : 1;
  let boundSource: HTMLElement | null = null;
  let activeLens: Lens | null = null;
  let usesDrawn = false;

  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const applyBend = () => {
    if (selection) return;
    const isIdentity = element.getAttribute("data-material") === "identity";
    const m = clamp(bendScale, 0, 1);
    // Front-load refractive curvature + subtle caustic swell so light bends BEFORE frost/label fill in
    const bendVisual = m <= 0.002 ? 0 : Math.min(1.4, Math.pow(m, 0.52) * (1 + 0.32 * Math.sin(m * Math.PI)));
    const rimAlpha = m <= 0.002 ? 0 : Math.min(1, Math.pow(m, 0.62) * 1.15);
    const surfaceAlpha = smoothstep(0.28, 0.94, m);
    const contentAlpha = smoothstep(0.32, 0.92, m);
    const effectiveBend = isIdentity ? 0 : bendVisual;

    if (m >= 0.999) {
      element.style.removeProperty("--lg-materialize");
      element.style.removeProperty("--lg-rim-alpha");
      element.style.removeProperty("--lg-surface-alpha");
      element.style.removeProperty("--lg-content-alpha");
      element.removeAttribute("data-materializing");
    } else {
      element.style.setProperty("--lg-materialize", m.toFixed(4));
      element.style.setProperty("--lg-rim-alpha", rimAlpha.toFixed(4));
      element.style.setProperty("--lg-surface-alpha", surfaceAlpha.toFixed(4));
      element.style.setProperty("--lg-content-alpha", contentAlpha.toFixed(4));
      element.setAttribute("data-materializing", "");
    }
    element.toggleAttribute("data-dematerialized", m < 0.01);

    if (boundSource && activeLens) {
      activeLens.update(effectiveBend);
      return;
    }
    if (refractsBackdrop()) fitBackdropLens(element, GLASS, effectiveBend);
  };

  const fit = () => {
    paintRim(element);
    if (!boundSource && element.isConnected) {
      const found = findBackdrop(element);
      if (found) {
        boundSource = found;
        element.style.removeProperty("--lg-filter");
        usesDrawn = drawsLens();
        activeLens = usesDrawn ? createDrawnLens(element, found, GLASS) : createLens(element, found, GLASS);
        activeLens.setActive(true);
        applyBend();
        if (!usesDrawn) {
          let lenses = followed.get(found);
          if (!lenses) followed.set(found, (lenses = new Set()));
          lenses.add(activeLens);
          following ||= requestAnimationFrame(follow);
        }
        return;
      }
    }
    if (boundSource && activeLens) {
      activeLens.refit();
    }
    applyBend();
  };

  const fitting = selection
    ? refitting(
        element,
        () => fitSelection(element, bendsBackdrop && refractsBackdrop()),
        bendsBackdrop ? SELECTION_PROPERTIES : SELECTION_PROPERTIES.filter((name) => name !== "--lg-filter"),
      )
    : refitting(element, fit, [
        "--lg-filter",
        "--lg-rim",
        "--lg-materialize",
        "--lg-rim-alpha",
        "--lg-surface-alpha",
        "--lg-content-alpha",
      ]);

  const bendSpring = createSpring(bendScale, 72, 14, (v) => {
    bendScale = Math.max(0, Math.min(1.25, v));
    applyBend();
  });

  if (!selection) applyBend();
  const stopWatching = selection ? () => {} : onThemeChange(() => paintRim(element));
  if (materializeOnMount) {
    requestAnimationFrame(() => bendSpring.set(1));
  }

  const handle: RefractionHandle = {
    refit: () => fitting.refit(),
    repaintRim: () => {
      if (!selection) paintRim(element);
    },
    materialize(instant = false) {
      if (instant) {
        bendSpring.set(1, true);
        return;
      }
      if (bendScale > 0.85) {
        bendSpring.set(0, true);
        requestAnimationFrame(() => bendSpring.set(1, false));
      } else {
        bendSpring.set(1, false);
      }
    },
    dematerialize(instant = false) {
      bendSpring.set(0, instant);
    },
    bendProgress: () => bendScale,
    destroy() {
      activeRefractions.delete(handle);
      bendSpring.stop();
      stopWatching();
      fitting.stop();
      if (boundSource && activeLens) {
        const lenses = followed.get(boundSource);
        lenses?.delete(activeLens);
        if (lenses && !lenses.size) followed.delete(boundSource);
      }
      activeLens?.destroy();
      activeLens = null;
      boundSource = null;
      element.removeAttribute("data-rim");
      element.removeAttribute("data-materializing");
      element.removeAttribute("data-dematerialized");
    },
  };

  activeRefractions.add(handle);
  return handle;
}
