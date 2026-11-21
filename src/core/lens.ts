import { svgContainer, svgEl } from "./svg";

export interface LensOptions {
  /** How far in the rim reaches, as a share of the lens's shorter side (or bezel width if `bezel: true`). */
  strength: number;
  /** CSS custom property overriding strength. */
  strengthProperty?: string;
  /** Alternate strength on dark backdrops. */
  darkStrength?: number;
  /** Rim highlight intensity override. */
  shine?: number;
  /** Lit edge width in px. */
  edgeWidth?: number;
  /** Chromatic dispersion strength (at 1, red bends 20% further than blue). */
  dispersion: number;
  /** CSS custom property overriding dispersion. */
  dispersionProperty?: string;
  /** Width of the curved bezel band in px (or share of shorter side when `relative: true`). */
  depth: number;
  /** Sag of the dome whose slope sets the bend along the rim, in px. */
  dome: number;
  /** How far the bend near each side keeps to that side's direction (0..1). */
  splay: number;
  /** Whether `depth` and `dome` scale with the element's shorter side. */
  relative?: boolean;
  /** Whether CSS paints the rim light on top of the frost instead of inside the filter. */
  paintsLight?: boolean;
  /** Chromatic ink fringing mode for crisp labels/icons over glass. */
  ink?: boolean;
  /** Gaussian blur softening over the bent rim, in px. */
  blur?: number;
  /** Exact Snell's law refraction across a squircle bezel. */
  bezel?: boolean;
  /** Maximum bezel depth in px when `relative: true`. */
  maxDepth?: number;
  /** Index of refraction (default 1.5 crown glass). */
  ior?: number;
}

type Ink = "light" | "dark";

export interface Light {
  angle: number;
  glow: number;
  spread: number;
  glowPower: number;
  edge: number;
  edgeWidth: number;
  edgePower: number;
}

const DARK_LIGHT: Light = { angle: 45, glow: 0.4, spread: 0.5, glowPower: 1.5, edge: 0.5, edgeWidth: 2, edgePower: 1.5 };
const LIGHT_LIGHT: Light = { angle: 30, glow: 0.4, spread: 0.5, glowPower: 2, edge: 0.5, edgeWidth: 1.5, edgePower: 1 };

export interface Shape {
  width: number;
  height: number;
  radius: number;
}

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);
const erfApprox = (x: number) => Math.tanh(1.7724538509 * x);

/** Signed distance to a centered rounded rectangle (negative inside, positive outside). */
export function distance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const edge = ox > 0 && oy > 0 ? Math.sqrt(ox * ox + oy * oy) : ox + oy;
  const inner = qx > qy ? qx : qy;
  return edge + (inner < 0 ? inner : 0) - radius;
}

interface Arc {
  radius: number;
  scale: number;
}

function createArc(sag: number, half: number): Arc {
  const radius = (half * half + sag * sag) / (2 * sag);
  let sum = 0;
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * half;
    const slope = x / Math.sqrt(radius * radius - x * x);
    sum += i === 0 || i === 200 ? slope * 0.5 : slope;
  }
  const mean = sum / 200;
  return { radius, scale: mean > 0 ? 0.5 / mean : 1 };
}

const arcSlope = (x: number, { radius, scale }: Arc) => {
  const inside = x < 0.999 * radius ? x : 0.999 * radius;
  return (inside / Math.sqrt(radius * radius - inside * inside)) * scale;
};

const bezelCache = new Map<number, Float32Array>();

function getBezelLut(ior = 1.5): Float32Array {
  const key = Math.round(clamp(ior, 1.02, 2.2) * 100);
  let cached = bezelCache.get(key);
  if (cached) return cached;

  const safeIor = key / 100;
  const samples = new Float32Array(256);
  let most = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = Math.max(0.004, i / (samples.length - 1));
    const inv = 1 - t;
    const surface = Math.pow(Math.max(0, 1 - inv * inv * inv * inv), 0.25);
    const incident = Math.atan((inv * inv * inv) / (surface * surface * surface));
    const refracted = Math.asin(clamp(Math.sin(incident) / safeIor, -0.9999, 0.9999));
    const shift = Math.tan(incident - refracted) * (0.6 + surface);
    samples[i] = shift;
    if (shift > most) most = shift;
  }
  if (most > 0) {
    for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! / most;
  }
  bezelCache.set(key, samples);
  return samples;
}

function sampleBezel(lut: Float32Array, t: number): number {
  const at = clamp(t, 0, 1) * (lut.length - 1);
  const lo = at | 0;
  const a = lut[lo]!;
  return a + (lut[lo < lut.length - 1 ? lo + 1 : lo]! - a) * (at - lo);
}

export function depthOf({ width, height }: Shape, options: LensOptions): number {
  const depth = options.depth * (options.relative ? Math.min(width, height) : 1);
  return options.maxDepth === undefined ? depth : Math.min(depth, options.maxDepth);
}

interface Pull {
  edge: number;
  x: number;
  y: number;
  amount: number;
}

function superellipseDistance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  let edge: number;
  if (ox > 0 && oy > 0) {
    const ox2 = ox * ox;
    const oy2 = oy * oy;
    edge = Math.pow(ox2 * ox2 + oy2 * oy2, 0.25);
  } else {
    edge = ox + oy;
  }
  const inner = qx > qy ? qx : qy;
  return edge + (inner < 0 ? inner : 0) - radius;
}

function createPuller(shape: Shape, options: LensOptions): (x: number, y: number, pull: Pull) => void {
  const halfWidth = shape.width * 0.5;
  const halfHeight = shape.height * 0.5;
  const radius = clamp(shape.radius, 0, Math.min(halfWidth, halfHeight));
  const depth = depthOf(shape, options);

  if (options.bezel) {
    const lut = getBezelLut(options.ior ?? 1.5);
    const round = clamp(Math.max(radius, depth), 0, Math.min(halfWidth, halfHeight));
    return (x, y, pull) => {
      pull.edge = distance(x, y, halfWidth, halfHeight, radius);
      pull.x = pull.y = pull.amount = 0;
      if (pull.edge >= 0 || depth <= 0) return;
      const g2Dist = superellipseDistance(x, y, halfWidth, halfHeight, radius);
      if (-g2Dist >= depth) return;
      const ax = x < 0 ? -x : x;
      const ay = y < 0 ? -y : y;
      const qx = ax - halfWidth + round;
      const qy = ay - halfHeight + round;
      if (qx > 0 && qy > 0) {
        const qx3 = qx * qx * qx;
        const qy3 = qy * qy * qy;
        const nLen = Math.sqrt(qx3 * qx3 + qy3 * qy3);
        if (nLen > 1e-9) {
          const invLen = 1 / nLen;
          pull.x = (x < 0 ? -1 : 1) * qx3 * invLen;
          pull.y = (y < 0 ? -1 : 1) * qy3 * invLen;
        }
      } else if (qx > qy) {
        pull.x = x < 0 ? -1 : 1;
      } else {
        pull.y = y < 0 ? -1 : 1;
      }
      pull.amount = sampleBezel(lut, -g2Dist / depth);
    };
  }

  const dome = options.dome * (options.relative ? Math.min(shape.width, shape.height) : 1);
  const { splay } = options;
  const innerWidth = Math.max(0, halfWidth - depth);
  const innerHeight = Math.max(0, halfHeight - depth);
  const innerRadius = clamp(radius, 0, Math.min(innerWidth, innerHeight));
  const ramp = depth > 0 ? 1 / (depth * Math.SQRT2) : 1e6;
  const sag = Math.max(0.01, Math.min(dome, Math.min(halfWidth, halfHeight) - 1));
  const across = dome > 0 ? createArc(sag, halfWidth) : null;
  const down = dome > 0 ? createArc(sag, halfHeight) : null;
  const reach = 0.5 * Math.min(halfWidth, halfHeight);

  return (x, y, pull) => {
    pull.edge = distance(x, y, halfWidth, halfHeight, radius);
    pull.x = pull.y = pull.amount = 0;
    if (pull.edge >= 0) return;
    const ax = x < 0 ? -x : x;
    const ay = y < 0 ? -y : y;
    const sx = x < 0 ? -1 : 1;
    const sy = y < 0 ? -1 : 1;
    let dx = across ? sx * arcSlope(ax, across) : clamp(x / halfWidth, -1, 1);
    let dy = down ? sy * arcSlope(ay, down) : clamp(y / halfHeight, -1, 1);

    if (splay < 1 && reach > 0) {
      const keepX = Math.max(0, 1 - (halfHeight - ay) / reach) * (1 - splay);
      const keepY = Math.max(0, 1 - (halfWidth - ax) / reach) * (1 - splay);
      if (keepX > 0.001 || keepY > 0.001) {
        const before = Math.sqrt(dx * dx + dy * dy);
        dx *= 1 - keepX;
        dy *= 1 - keepY;
        const after = Math.sqrt(dx * dx + dy * dy);
        if (after > 0.001) {
          const ratio = before / after;
          dx *= ratio;
          dy *= ratio;
        }
      }
    }
    pull.x = dx;
    pull.y = dy;
    pull.amount = 0.5 * (1 + erfApprox(distance(x, y, innerWidth, innerHeight, innerRadius) * ramp));
  };
}

const bends = ({ edge, amount }: Pull) => Math.min(1, amount * 20, -edge);

export interface LensMap {
  columns: number;
  rows: number;
  across: Uint8ClampedArray;
  down: Uint8ClampedArray;
  light: Uint8ClampedArray;
  shape: Uint8ClampedArray;
}

/** Computes greyscale displacement, rim highlight, and lens shape buffers using Uint32Array word writes. */
export function lensMap(shape: Shape, options: LensOptions, light: Light, density: number): LensMap {
  const { width, height } = shape;
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const columns = Math.max(1, Math.round(width * density));
  const rows = Math.max(1, Math.round(height * density));
  const len = columns * rows * 4;

  const across = new Uint8ClampedArray(len);
  const down = new Uint8ClampedArray(len);
  const lightBuf = new Uint8ClampedArray(len);
  const shapeMask = new Uint8ClampedArray(len);

  const across32 = new Uint32Array(across.buffer);
  const down32 = new Uint32Array(down.buffer);
  const light32 = new Uint32Array(lightBuf.buffer);
  const shape32 = new Uint32Array(shapeMask.buffer);

  across32.fill(0xff808080);
  down32.fill(0xff808080);
  light32.fill(0x00808080);

  const pullAt = createPuller(shape, options);
  const pull: Pull = { edge: 0, x: 0, y: 0, amount: 0 };
  const rad = (light.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const glowStart = (1 - light.spread) * Math.SQRT2;
  const glowRange = light.spread * Math.SQRT2;

  // Fast interior skip for flat plateau inside bezel-only lenses
  const bezelDepth = options.bezel ? depthOf(shape, options) : 0;
  const corner = clamp(shape.radius, 0, Math.min(halfWidth, halfHeight));
  const innerYLimit = options.bezel ? halfHeight - bezelDepth - 1.5 : -1;
  const sideBand = Math.max(corner, bezelDepth) + 1.5;
  const leftSkipCol = Math.min(columns, Math.ceil(sideBand * density) + 1);
  const rightSkipCol = Math.max(leftSkipCol, columns - leftSkipCol);
  const canSkipFlatMid = options.bezel && rightSkipCol > leftSkipCol + 2;

  for (let row = 0; row < rows; row++) {
    const y = ((row + 0.5) / rows) * height - halfHeight;
    const ay = y < 0 ? -y : y;
    const nyNorm = clamp(y / halfHeight, -1, 1);
    const rowOff = row * columns;
    const skipRowMid = canSkipFlatMid && ay < innerYLimit;
    for (let column = 0; column < columns; column++) {
      if (skipRowMid && column === leftSkipCol) {
        shape32.fill(0xff000000, rowOff + leftSkipCol, rowOff + rightSkipCol);
        column = rightSkipCol - 1;
        continue;
      }
      const pxIdx = rowOff + column;
      const x = ((column + 0.5) / columns) * width - halfWidth;
      pullAt(x, y, pull);
      const { edge, amount: falloff } = pull;
      const inside = (255 * clamp(-edge, 0, 1) + 0.5) | 0;
      if (edge >= 0) {
        shape32[pxIdx] = inside << 24;
        continue;
      }

      const shapeGrey = (255 * falloff + 0.5) | 0;
      shape32[pxIdx] = (inside << 24) | (shapeGrey << 16) | (shapeGrey << 8) | shapeGrey;

      if (falloff > 0) {
        const ax = ((0.5 - 0.5 * pull.x * falloff) * 255 + 0.5) | 0;
        const dy = ((0.5 - 0.5 * pull.y * falloff) * 255 + 0.5) | 0;
        // Pack R=ax, G=dy, B=128, A=255 into across32 so userSpaceOnUse filters displace X & Y in 1 pass
        across32[pxIdx] = 0xff800000 | (dy << 8) | ax;
        down32[pxIdx] = 0xff000000 | (dy << 16) | (dy << 8) | dy;
      }

      const facing = Math.abs(clamp(x / halfWidth, -1, 1) * cos + nyNorm * sin);
      const glow =
        glowRange > 0.001
          ? light.glow * Math.pow(clamp((facing - glowStart) / glowRange, 0, 1), light.glowPower) * falloff
          : 0;
      const rim = light.edge * Math.max(0, 1 + edge / light.edgeWidth) * Math.pow(facing, light.edgePower);
      const amount = glow + rim < 1 ? glow + rim : 1;
      const lGrey = (127 * amount + 128.5) | 0;
      const lAlpha = (255 * bends(pull) + 0.5) | 0;
      light32[pxIdx] = (lAlpha << 24) | (lGrey << 16) | (lGrey << 8) | lGrey;
    }
  }

  return { columns, rows, across, down, light: lightBuf, shape: shapeMask };
}

export function lensField(
  shape: Shape,
  options: LensOptions,
  density: number,
): { columns: number; rows: number; data: Float32Array } {
  const { width, height } = shape;
  const columns = Math.max(1, Math.round(width * density));
  const rows = Math.max(1, Math.round(height * density));
  const data = new Float32Array(columns * rows * 4);
  const pullAt = createPuller(shape, options);
  const pull: Pull = { edge: 0, x: 0, y: 0, amount: 0 };

  for (let row = 0; row < rows; row++) {
    const y = ((row + 0.5) / rows) * height - height * 0.5;
    for (let column = 0; column < columns; column++) {
      const x = ((column + 0.5) / columns) * width - width * 0.5;
      pullAt(x, y, pull);
      if (pull.edge >= 0) continue;
      const i = (row * columns + column) * 4;
      data[i] = pull.x * pull.amount;
      data[i + 1] = pull.y * pull.amount;
      data[i + 2] = Math.max(0, bends(pull));
      data[i + 3] = clamp(-pull.edge, 0, 1);
    }
  }
  return { columns, rows, data };
}

interface EncodedMaps {
  across: string;
  down: string;
  light: string;
  shape: string;
}

const encodedCache = new Map<string, EncodedMaps>();

function encodeMaps(key: string, draw: () => LensMap): EncodedMaps | null {
  const cached = encodedCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  const map = draw();
  const canvas = document.createElement("canvas");
  canvas.width = map.columns;
  canvas.height = map.rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(map.columns, map.rows);
  const toPng = (buf: Uint8ClampedArray) => {
    img.data.set(buf);
    ctx.putImageData(img, 0, 0);
    try {
      return canvas.toDataURL();
    } catch {
      return "";
    }
  };

  const needDown = boxUnits();
  const result: EncodedMaps = {
    across: toPng(map.across),
    down: needDown ? toPng(map.down) : "",
    light: toPng(map.light),
    shape: toPng(map.shape),
  };

  if (encodedCache.size > 48) {
    const first = encodedCache.keys().next().value;
    if (first !== undefined) encodedCache.delete(first);
  }
  encodedCache.set(key, result);
  return result;
}

export type QualityTier = "high" | "balanced" | "eco";

export const isAndroid = (): boolean =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

export const isIOS = (): boolean =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1));

export const isSamsungInternet = (): boolean =>
  typeof navigator !== "undefined" && /SamsungBrowser\//i.test(navigator.userAgent);

export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

export const isMobileDevice = (): boolean => isAndroid() || isIOS() || isCoarsePointer();

/**
 * Desktop Chromium (Chrome, Edge, Brave, Arc, Opera, Vivaldi) supports GPU-accelerated
 * `backdrop-filter: url(#svg)`. Android Chromium, Samsung Internet, Firefox, Safari, and
 * iOS WebKit browsers route instead to the GPU WebGL2 drawn-lens path for 60–120fps parity.
 */
export const refractsBackdrop = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/Chrom(?:e|ium)|Edg\//.test(ua)) return false;
  if (/Android|SamsungBrowser\/|CriOS|FxiOS|EdgiOS|EdgA\//.test(ua)) return false;
  return true;
};

export const boxUnits = (): boolean =>
  typeof navigator !== "undefined" &&
  /AppleWebKit\//.test(navigator.userAgent) &&
  !/Chrom(?:e|ium)|Android/.test(navigator.userAgent);

/** Evaluates device hardware signals (memory, cores, Save-Data, reduced motion) dynamically. */
export function getQualityTier(): QualityTier {
  if (typeof navigator === "undefined") return "high";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || nav.connection?.saveData) return "eco";
  const mem = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  if ((typeof mem === "number" && mem <= 2) || (typeof cores === "number" && cores > 0 && cores <= 2)) {
    return "eco";
  }
  if (isMobileDevice() || (typeof mem === "number" && mem <= 4) || (typeof cores === "number" && cores > 0 && cores <= 4)) {
    return "balanced";
  }
  return "high";
}

let runtimeQualityScale = 1;
let slowFrames = 0;
let fastFrames = 0;

/** Dynamically adapts WebGL resolution scale on mobile/Android GPUs if interactive frame times spike. */
export function recordFrameTime(frameMs: number): void {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return;
  if (frameMs > 26) {
    slowFrames++;
    fastFrames = 0;
    if (slowFrames >= 8 && runtimeQualityScale > 0.78) {
      runtimeQualityScale = Math.max(0.75, runtimeQualityScale - 0.12);
      slowFrames = 0;
    }
  } else if (frameMs < 15) {
    fastFrames++;
    slowFrames = 0;
    if (fastFrames >= 45 && runtimeQualityScale < 1) {
      runtimeQualityScale = Math.min(1, runtimeQualityScale + 0.08);
      fastFrames = 0;
    }
  }
}

export const getRuntimeQualityScale = (): number => runtimeQualityScale;

export function getOpticalDpr(kind: "lens" | "drawn" | "title" | "rim" = "drawn"): number {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const tier = getQualityTier();
  const cap =
    tier === "eco"
      ? kind === "title"
        ? 1.25
        : 1
      : tier === "balanced"
        ? kind === "title"
          ? 1.75
          : 1.5
        : 2;
  const base = kind === "title" && tier === "high" ? Math.max(raw, 1.5) : raw;
  const scaled = kind === "drawn" ? Math.min(base, cap) * runtimeQualityScale : Math.min(base, cap);
  return Math.max(1, Number(scaled.toFixed(2)));
}

const CHANNELS = [
  "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0",
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0",
  "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",
];

interface GraphPart {
  boxed: SVGElement[];
  rays: [SVGElement, SVGElement?][];
  soften?: SVGElement;
}

const matrix = (input: string, values: string, result: string) =>
  svgEl("feColorMatrix", { in: input, type: "matrix", values, result });

const sumOp = (a: string, b: string, k2: number, k3: number, result: string) =>
  svgEl("feComposite", { in: a, in2: b, operator: "arithmetic", k2, k3, result });

function spreadPass(k: number): SVGElement[] {
  return [
    ...CHANNELS.map((channel, i) => matrix(`ray-${k}-${i}`, `${channel}  0 0 0 0.3333 0`, `light-${k}-${i}`)),
    sumOp(`light-${k}-0`, `light-${k}-1`, 1, 1, `light-${k}-01`),
    sumOp(`light-${k}-01`, `light-${k}-2`, 1, 1, `spread-${k}`),
    matrix(`spread-${k}`, "3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0", `bent-${k}`),
  ];
}

function inkedPass(k: number, page: Ink): SVGElement[] {
  const white = page === "light" ? 1 : 0;
  const steps: SVGElement[] = [];
  const own = (i: number) =>
    [0, 1, 2]
      .map((r) => (r === i ? `${[0, 1, 2].map((c) => (c === i ? (white ? -1 : 1) : 0)).join(" ")} 0 ${white}` : "0 0 0 0 0"))
      .join("  ") + "  0 0 0 1 0";

  CHANNELS.forEach((_, i) => {
    const ray = `ray-${k}-${i}`;
    steps.push(
      matrix(ray, "0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1", `cover-${k}-${i}`),
      matrix(ray, "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", `covers-${k}-${i}`),
      matrix(ray, own(i), `inks-${k}-${i}`),
    );
  });

  steps.push(
    svgEl("feBlend", { in: `cover-${k}-0`, in2: `cover-${k}-1`, mode: "lighten", result: `most-${k}-01` }),
    svgEl("feBlend", { in: `most-${k}-01`, in2: `cover-${k}-2`, mode: "lighten", result: `most-${k}` }),
    matrix(`most-${k}`, `0 0 0 0 ${white}  0 0 0 0 ${white}  0 0 0 0 ${white}  1 0 0 0 0`, `inked-${k}`),
  );

  let at = `inked-${k}`;
  CHANNELS.forEach((_, i) => {
    const [gain, loss] = white ? [`covers-${k}-${i}`, `inks-${k}-${i}`] : [`inks-${k}-${i}`, `covers-${k}-${i}`];
    steps.push(
      sumOp(at, gain, i === 0 ? 0.5 : 1, 0.5, `inked-${k}-${i}a`),
      sumOp(`inked-${k}-${i}a`, loss, 1, -0.5, `inked-${k}-${i}b`),
    );
    at = `inked-${k}-${i}b`;
  });

  const double = svgEl("feComponentTransfer", { in: at, result: `bent-${k}` });
  double.append(svgEl("feFuncA", { type: "linear", slope: 2, intercept: 0 }));
  steps.push(double);
  return steps;
}

interface FilterGraph {
  filter: SVGElement;
  parts: GraphPart[];
}

interface BendSpec {
  maps: EncodedMaps;
  shine: number;
  ink?: Ink;
  blur?: number;
}

function buildFilterGraph(lenses: BendSpec[], box: boolean, standIn: boolean): FilterGraph {
  const unit = box ? "objectBoundingBox" : "userSpaceOnUse";
  const filter = svgEl("filter", {
    filterUnits: unit,
    primitiveUnits: unit,
    "color-interpolation-filters": "sRGB",
  });
  if (box) {
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "1");
    filter.setAttribute("height", "1");
  }

  const single = lenses.length === 1;
  const parts = lenses.map(({ maps, shine, blur, ink }, k): GraphPart => {
    const merged = (name: string) => (single ? name : `${name}-${k}`);
    const image = (href: string, result: string) => svgEl("feImage", { href, preserveAspectRatio: "none", result });

    if (!box) {
      const boxed: SVGElement[] = [
        image(maps.across, `across-${k}`),
        image(maps.light, merged("raw")),
        svgEl("feFlood", { "flood-color": "rgb(128, 128, 128)", result: `neutral-${k}` }),
      ];
      if (standIn) boxed.push(image(maps.shape, merged("shape")));
      filter.append(
        ...boxed,
        svgEl("feComposite", { in: `across-${k}`, in2: `neutral-${k}`, operator: "over", result: `field-${k}` }),
      );

      const rays = CHANNELS.map((_, i): [SVGElement, SVGElement?] => {
        const disp = svgEl("feDisplacementMap", {
          in: "SourceGraphic",
          in2: `field-${k}`,
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: `ray-${k}-${i}`,
        });
        boxed.push(disp);
        filter.append(disp);
        return [disp];
      });

      filter.append(...(ink ? inkedPass(k, ink) : spreadPass(k)));

      let soften: SVGElement | undefined;
      if (blur) {
        soften = svgEl("feGaussianBlur", { in: `bent-${k}`, result: `soft-${k}` });
        const weight = image(maps.shape, `weight-${k}`);
        boxed.push(weight);
        filter.append(
          weight,
          svgEl("feColorMatrix", {
            in: `weight-${k}`,
            type: "matrix",
            values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",
            result: `bends-${k}`,
          }),
          soften,
          svgEl("feComposite", { in: `soft-${k}`, in2: `bends-${k}`, operator: "in", result: `soft-in-${k}` }),
          svgEl("feComposite", { in: `bent-${k}`, in2: `bends-${k}`, operator: "out", result: `sharp-${k}` }),
          svgEl("feComposite", { in: `soft-in-${k}`, in2: `sharp-${k}`, operator: "arithmetic", k2: 1, k3: 1, result: `softened-${k}` }),
        );
      }

      const bent = blur ? `softened-${k}` : `bent-${k}`;
      let lit = bent;
      if (shine > 0) {
        const white = `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ${-128 / 255}`;
        filter.append(
          svgEl("feColorMatrix", { in: merged("raw"), type: "matrix", values: white, result: `glint-${k}` }),
          svgEl("feComposite", { in: `glint-${k}`, in2: bent, operator: "arithmetic", k2: shine, k3: 1, result: `lit-${k}` }),
        );
        lit = `lit-${k}`;
      } else if (shine < 0) {
        const row = `0 0 ${shine} 0 ${1 - (128 * shine) / 255}`;
        filter.append(
          svgEl("feColorMatrix", { in: merged("raw"), type: "matrix", values: `${row}  ${row}  ${row}  0 0 0 0 1`, result: `shade-${k}` }),
          svgEl("feComposite", { in: `shade-${k}`, in2: bent, operator: "arithmetic", k1: 1, result: `lit-${k}` }),
        );
        lit = `lit-${k}`;
      }

      filter.append(svgEl("feComposite", { in: lit, in2: merged("raw"), operator: "in", result: merged("inside") }));
      return { boxed, rays, soften };
    }

    const boxed = [
      image(maps.across, `across-${k}`),
      image(maps.down, `down-${k}`),
      image(maps.light, merged("raw")),
      svgEl("feFlood", { "flood-color": "rgb(128, 128, 128)", result: `neutral-${k}` }),
    ];
    if (standIn) boxed.push(image(maps.shape, merged("shape")));
    filter.append(...boxed);

    for (const pull of ["across", "down"]) {
      const half = svgEl("feComponentTransfer", { in: `${pull}-grey-${k}`, result: `${pull}-pull-${k}` });
      half.append(svgEl("feFuncA", { type: "linear", slope: 0, intercept: 0.5 }));
      filter.append(
        svgEl("feComposite", { in: `${pull}-${k}`, in2: `neutral-${k}`, operator: "over", result: `${pull}-grey-${k}` }),
        half,
      );
    }

    const rays = CHANNELS.map((_, i): [SVGElement, SVGElement] => {
      const across = svgEl("feDisplacementMap", {
        in: "SourceGraphic",
        in2: `across-pull-${k}`,
        xChannelSelector: "R",
        yChannelSelector: "A",
        result: `across-${k}-${i}`,
      });
      const down = svgEl("feDisplacementMap", {
        in: `across-${k}-${i}`,
        in2: `down-pull-${k}`,
        xChannelSelector: "A",
        yChannelSelector: "R",
        result: `ray-${k}-${i}`,
      });
      boxed.push(across, down);
      filter.append(across, down);
      return [across, down];
    });

    filter.append(...(ink ? inkedPass(k, ink) : spreadPass(k)));

    let soften: SVGElement | undefined;
    if (blur) {
      soften = svgEl("feGaussianBlur", { in: `bent-${k}`, result: `soft-${k}` });
      const weight = image(maps.shape, `weight-${k}`);
      boxed.push(weight);
      filter.append(
        weight,
        svgEl("feColorMatrix", {
          in: `weight-${k}`,
          type: "matrix",
          values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0",
          result: `bends-${k}`,
        }),
        soften,
        svgEl("feComposite", { in: `soft-${k}`, in2: `bends-${k}`, operator: "in", result: `soft-in-${k}` }),
        svgEl("feComposite", { in: `bent-${k}`, in2: `bends-${k}`, operator: "out", result: `sharp-${k}` }),
        svgEl("feComposite", { in: `soft-in-${k}`, in2: `sharp-${k}`, operator: "arithmetic", k2: 1, k3: 1, result: `softened-${k}` }),
      );
    }

    const bent = blur ? `softened-${k}` : `bent-${k}`;
    let lit = bent;
    if (shine > 0) {
      const white = `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ${-128 / 255}`;
      filter.append(
        svgEl("feColorMatrix", { in: merged("raw"), type: "matrix", values: white, result: `glint-${k}` }),
        svgEl("feComposite", { in: `glint-${k}`, in2: bent, operator: "arithmetic", k2: shine, k3: 1, result: `lit-${k}` }),
      );
      lit = `lit-${k}`;
    } else if (shine < 0) {
      const row = `0 0 ${shine} 0 ${1 - (128 * shine) / 255}`;
      filter.append(
        svgEl("feColorMatrix", { in: merged("raw"), type: "matrix", values: `${row}  ${row}  ${row}  0 0 0 0 1`, result: `shade-${k}` }),
        svgEl("feComposite", { in: `shade-${k}`, in2: bent, operator: "arithmetic", k1: 1, result: `lit-${k}` }),
      );
      lit = `lit-${k}`;
    }

    filter.append(svgEl("feComposite", { in: lit, in2: merged("raw"), operator: "in", result: merged("inside") }));
    return { boxed, rays, soften };
  });

  if (!single) {
    for (const name of ["raw", "inside", ...(standIn ? ["shape"] : [])]) {
      const merge = svgEl("feMerge", { result: name });
      lenses.forEach((_, k) => merge.append(svgEl("feMergeNode", { in: `${name}-${k}` })));
      filter.append(merge);
    }
  }

  // Exact inside/outside alpha split leaves un-bent center pixels pixel-identical to SourceGraphic
  filter.append(
    svgEl("feComposite", { in: "SourceGraphic", in2: "raw", operator: "out", result: "outside" }),
    svgEl("feComposite", { in: "inside", in2: "outside", operator: "arithmetic", k2: 1, k3: 1, result: "seen" }),
  );
  if (standIn) filter.append(svgEl("feComposite", { in: "seen", in2: "shape", operator: "in" }));
  return { filter, parts };
}

interface PlacedLens {
  x: number;
  y: number;
  width: number;
  height: number;
  reach: number;
  dispersion: number;
  blur: number;
}

function placeLenses(fg: FilterGraph, placed: PlacedLens[], across: number, down: number, box: boolean): void {
  if (!box) {
    fg.filter.setAttribute("x", "0");
    fg.filter.setAttribute("y", "0");
    fg.filter.setAttribute("width", String(across));
    fg.filter.setAttribute("height", String(down));
  }
  placed.forEach((lens, k) => {
    const part = fg.parts[k]!;
    const spectrum = [1 + 0.2 * lens.dispersion, 1 + 0.1 * lens.dispersion, 1];
    part.rays.forEach(([pullAcross, pullDown], i) => {
      pullAcross.setAttribute("scale", String((box ? lens.reach / across : lens.reach) * spectrum[i]!));
      pullDown?.setAttribute("scale", String((lens.reach / down) * spectrum[i]!));
    });
    const blur = Math.max(lens.blur, 0.01);
    part.soften?.setAttribute("stdDeviation", box ? `${blur / across} ${blur / down}` : String(blur));
    const rect = box
      ? { x: lens.x / across, y: lens.y / down, width: lens.width / across, height: lens.height / down }
      : { x: lens.x, y: lens.y, width: lens.width, height: lens.height };
    for (const element of part.boxed) {
      for (const [key, value] of Object.entries(rect)) element.setAttribute(key, String(value));
    }
  });
}

interface FitResult {
  maps: EncodedMaps;
  key: string;
  shine: number;
  ink?: Ink;
  blur: number;
  reach: number;
  dispersion: number;
  width: number;
  height: number;
}

export function shapeOf(glass: HTMLElement, style: CSSStyleDeclaration = getComputedStyle(glass)): Shape | null {
  const width = glass.offsetWidth;
  const height = glass.offsetHeight;
  if (!width || !height) return null;
  const corner = style.borderTopLeftRadius;
  const radius = Math.min(
    width * 0.5,
    height * 0.5,
    corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0,
  );
  return { width, height, radius };
}

export function tuningOf(
  style: CSSStyleDeclaration,
  shape: Shape,
  options: LensOptions,
): { reach: number; dispersion: number; page: number } {
  const page = parseFloat(style.getPropertyValue("--lg-lens-shine")) || 0;
  const tuned = options.strengthProperty ? parseFloat(style.getPropertyValue(options.strengthProperty)) : NaN;
  const own = page > 0 ? (options.darkStrength ?? options.strength) : options.strength;
  const strength = Number.isFinite(tuned) ? tuned : own;
  const split = options.dispersionProperty ? parseFloat(style.getPropertyValue(options.dispersionProperty)) : NaN;
  const dispersion = Number.isFinite(split) ? Math.max(0, split) : options.dispersion;
  const iorProp = parseFloat(style.getPropertyValue("--lg-ior"));
  const activeOpts = Number.isFinite(iorProp) ? { ...options, ior: iorProp } : options;
  const reach = strength * (activeOpts.bezel ? depthOf(shape, activeOpts) : Math.min(shape.width, shape.height));
  return { reach, dispersion, page };
}

function fitLens(glass: HTMLElement, options: LensOptions): FitResult | null {
  const style = getComputedStyle(glass);
  const shape = shapeOf(glass, style);
  if (!shape) return null;
  const { width, height, radius } = shape;
  const { reach, dispersion, page } = tuningOf(style, shape, options);
  const shine = options.paintsLight ? 0 : options.shine === undefined ? page : Math.sign(page || 1) * options.shine;
  const tier = getQualityTier();
  const baseDensity = getOpticalDpr("lens");
  const areaLimit = tier === "eco" ? 12000 : tier === "balanced" ? 20000 : 32000;
  const density = width * height > areaLimit ? 1 : baseDensity;
  const baseTheme = page < 0 && !options.paintsLight ? LIGHT_LIGHT : DARK_LIGHT;
  const light: Light = {
    ...baseTheme,
    edgeWidth: options.edgeWidth ?? baseTheme.edgeWidth,
  };
  const iorProp = parseFloat(style.getPropertyValue("--lg-ior"));
  const effectiveOpts = Number.isFinite(iorProp) ? { ...options, ior: iorProp } : options;
  const key = [width, height, radius, density, light.angle, light.edgeWidth, JSON.stringify(effectiveOpts)].join("|");
  const maps = encodeMaps(key, () => lensMap(shape, effectiveOpts, light, density));
  const blur = effectiveOpts.blur ?? 0;
  const ink: Ink | undefined = effectiveOpts.ink ? (page < 0 ? "light" : "dark") : undefined;
  return maps ? { maps, key: `${key}|${shine}|${ink}`, shine, ink, blur, reach, dispersion, width, height } : null;
}

export interface Lens {
  setActive(active: boolean): void;
  update(amount?: number): boolean | void;
  refit(): void;
  destroy(): void;
}

interface Member {
  glass: HTMLElement;
  options: LensOptions;
  replaces?: HTMLElement;
  amount: number;
  fit?: FitResult;
  placed?: PlacedLens;
}

interface Surface {
  content: HTMLElement;
  lenses: number;
  members: Member[];
  name: string;
  standIn: boolean;
  graph?: FilterGraph;
  built: string;
  placed: string;
  version: number;
}

const surfaces = new Map<HTMLElement, Surface>();
let madeCount = 0;

function renderSurface(surface: Surface): boolean {
  const { content } = surface;
  const across = content.offsetWidth;
  const down = content.offsetHeight;
  const from = content.getBoundingClientRect();
  const shown: Member[] = [];

  if (across && down) {
    const unit = from.width / across || 1;
    for (const member of surface.members) {
      if (!member.replaces && member.amount <= 0.002) continue;
      const at = member.glass.getBoundingClientRect();
      if (!member.fit || !at.width || !at.height) continue;
      const width = at.width / unit;
      const height = at.height / unit;
      const reach = member.fit.reach * (Math.min(width, height) / Math.min(member.fit.width, member.fit.height)) * member.amount;
      const { dispersion } = member.fit;
      const blur = member.fit.blur * member.amount;
      member.placed = { x: (at.left - from.left) / unit, y: (at.top - from.top) / unit, width, height, reach, dispersion, blur };
      shown.push(member);
    }
  }

  if (!shown.length) {
    const changed = surface.placed !== "";
    surface.placed = "";
    content.style.removeProperty("filter");
    if (surface.standIn) content.style.removeProperty("visibility");
    surface.standIn = false;
    return changed;
  }

  const box = boxUnits();
  const standIn = shown.some((member) => member.replaces);
  surface.standIn = standIn;
  const structure = shown.map((member) => member.fit!.key).join("\n") + (standIn ? "\nstand-in" : "");
  if (structure !== surface.built || !surface.graph) {
    surface.graph?.filter.remove();
    surface.graph = buildFilterGraph(shown.map((member) => member.fit!), box, standIn);
    svgContainer().append(surface.graph.filter);
    surface.built = structure;
    surface.placed = "";
  }

  const placed = shown.map((member) => member.placed!);
  const next = [across, down, ...placed.flatMap((p) => [p.x, p.y, p.width, p.height, p.reach, p.dispersion, p.blur])]
    .map((v) => v.toFixed(2))
    .join(" ");
  if (next === surface.placed) return false;
  surface.placed = next;
  placeLenses(surface.graph, placed, across, down, box);
  surface.graph.filter.id = `${surface.name}-${++surface.version}`;
  content.style.filter = `url("#${surface.graph.filter.id}")`;

  for (const member of shown) {
    if (!member.replaces) continue;
    content.style.visibility = "visible";
    const { x, y, width, height } = member.placed!;
    const behind = member.replaces.getBoundingClientRect();
    const unit = from.width / across || 1;
    applyMask(member.replaces, {
      image: `url("${member.fit!.maps.shape}"), linear-gradient(#000, #000)`,
      position: `${x + (from.left - behind.left) / unit}px ${y + (from.top - behind.top) / unit}px, 0 0`,
      size: `${width}px ${height}px, 100% 100%`,
    });
  }
  return true;
}

const MASKING = ["image", "position", "size", "repeat", "composite"] as const;

function applyMask(element: HTMLElement, layers?: { image: string; position: string; size: string }): void {
  for (const part of MASKING) {
    element.style.removeProperty(`-webkit-mask-${part}`);
    element.style.removeProperty(`mask-${part}`);
  }
  if (!layers) return;
  const values = { ...layers, repeat: "no-repeat", composite: "exclude" };
  for (const part of MASKING) {
    element.style.setProperty(`-webkit-mask-${part}`, part === "composite" ? "xor" : values[part]);
    element.style.setProperty(`mask-${part}`, values[part]);
  }
}

export function createLens(glass: HTMLElement, content: HTMLElement, options: LensOptions, replaces?: HTMLElement): Lens {
  let surface = surfaces.get(content);
  if (!surface) {
    surface = {
      content,
      lenses: 0,
      members: [],
      name: `fluid-glass-lens-${madeCount++}`,
      standIn: false,
      built: "",
      placed: "",
      version: 0,
    };
    surfaces.set(content, surface);
  }
  const shared = surface;
  shared.lenses++;
  const member: Member = { glass, options, replaces, amount: 1 };
  let active = false;

  const prepare = () => {
    member.fit = fitLens(glass, options) ?? undefined;
  };

  const lens: Lens = {
    setActive(next) {
      if (next === active) return;
      active = next;
      if (active) {
        shared.members.push(member);
        prepare();
      } else {
        const idx = shared.members.indexOf(member);
        if (idx >= 0) shared.members.splice(idx, 1);
        if (replaces) applyMask(replaces);
      }
      renderSurface(shared);
    },
    update(amount) {
      if (amount !== undefined) member.amount = clamp(amount, 0, 1.5);
      if (active) return renderSurface(shared);
      return false;
    },
    refit() {
      if (!active) return;
      prepare();
      renderSurface(shared);
    },
    destroy() {
      lens.setActive(false);
      if (--shared.lenses > 0) return;
      shared.graph?.filter.remove();
      surfaces.delete(content);
    },
  };
  return lens;
}

export interface BackdropLens {
  update(amount: number): void;
  refit(): void;
  destroy(): void;
}

export function createBackdropLens(glass: HTMLElement, options: LensOptions): BackdropLens {
  const name = `fluid-glass-bend-${madeCount++}`;
  let fitted: FitResult | null = null;
  let built: FilterGraph | null = null;
  let key = "";
  let amount = 0;
  let version = 0;

  const draw = () => {
    if (!fitted || !built) return;
    const { width, height, dispersion, blur } = fitted;
    const reach = fitted.reach * amount;
    placeLenses(built, [{ x: 0, y: 0, width, height, reach, dispersion, blur: blur * amount }], width, height, false);
    built.filter.id = `${name}-${++version}`;
    glass.style.setProperty("--lg-filter", `url("#${built.filter.id}")`);
  };

  return {
    update(next) {
      next = Math.round(clamp(next, 0, 1) * 20) / 20;
      if (next === amount) return;
      amount = next;
      draw();
    },
    refit() {
      fitted = fitLens(glass, options);
      if (!fitted) return;
      if (fitted.key !== key) {
        built?.filter.remove();
        built = buildFilterGraph([{ maps: fitted.maps, shine: 0, blur: fitted.blur }], false, false);
        svgContainer().append(built.filter);
        key = fitted.key;
      }
      draw();
    },
    destroy() {
      built?.filter.remove();
      built = null;
      glass.style.removeProperty("--lg-filter");
    },
  };
}

const backdropFilters = new Map<string, { name: string; el: SVGElement }>();

export function fitBackdropLens(glass: HTMLElement, options: LensOptions, bendScale = 1): void {
  const quantized = Math.round(clamp(bendScale, 0, 1.3) * 20) / 20;
  if (quantized <= 0.005) {
    glass.style.removeProperty("--lg-filter");
    return;
  }
  const fitted = fitLens(glass, options);
  if (!fitted) return;
  const { maps, key, shine, reach, dispersion, width, height } = fitted;
  const scaledReach = reach * quantized;
  const id = `${key}|${scaledReach.toFixed(2)}|${dispersion}`;
  let entry = backdropFilters.get(id);
  if (!entry) {
    if (backdropFilters.size >= 64) {
      const oldestKey = backdropFilters.keys().next().value;
      if (oldestKey !== undefined) {
        backdropFilters.get(oldestKey)?.el.remove();
        backdropFilters.delete(oldestKey);
      }
    }
    const name = `fluid-glass-backdrop-${madeCount++}`;
    if (shine === 0) {
      // Lean 8-node direct RG displacement filter when shine === 0 (eliminates 15 redundant nodes per backdrop filter)
      const box = { x: 0, y: 0, width, height };
      const filter = svgEl("filter", {
        id: name,
        ...box,
        filterUnits: "userSpaceOnUse",
        primitiveUnits: "userSpaceOnUse",
        "color-interpolation-filters": "sRGB",
      });
      filter.append(svgEl("feImage", { href: maps.across, ...box, preserveAspectRatio: "none", result: "field" }));
      if (dispersion <= 0.01) {
        filter.append(
          svgEl("feDisplacementMap", {
            in: "SourceGraphic",
            in2: "field",
            scale: scaledReach,
            xChannelSelector: "R",
            yChannelSelector: "G",
          }),
        );
      } else {
        const spectrum = [1 + 0.2 * dispersion, 1 + 0.1 * dispersion, 1];
        CHANNELS.forEach((channel, i) => {
          filter.append(
            svgEl("feDisplacementMap", {
              in: "SourceGraphic",
              in2: "field",
              scale: scaledReach * spectrum[i]!,
              xChannelSelector: "R",
              yChannelSelector: "G",
              result: `ray-${i}`,
            }),
            matrix(`ray-${i}`, `${channel}  0 0 0 0.3333 0`, `ch-${i}`),
          );
        });
        filter.append(
          sumOp("ch-0", "ch-1", 1, 1, "ch-01"),
          sumOp("ch-01", "ch-2", 1, 1, "spread"),
          matrix("spread", "3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0", "bent"),
        );
      }
      svgContainer().append(filter);
      entry = { name, el: filter };
    } else {
      const built = buildFilterGraph([{ maps, shine }], false, false);
      placeLenses(built, [{ x: 0, y: 0, width, height, reach: scaledReach, dispersion, blur: 0 }], width, height, false);
      built.filter.id = name;
      svgContainer().append(built.filter);
      entry = { name, el: built.filter };
    }
    backdropFilters.set(id, entry);
  }
  glass.style.setProperty("--lg-filter", `url("#${entry.name}")`);
}
