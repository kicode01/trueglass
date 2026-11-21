const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

export type Rgba = readonly [number, number, number, number];

const NUM_RE = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?|none/gi;
const CACHE_LIMIT = 256;
const colourCache = new Map<string, Rgba>();

let probeCtx: CanvasRenderingContext2D | null | undefined;

function getProbeCtx(): CanvasRenderingContext2D | null {
  if (probeCtx !== undefined) return probeCtx;
  probeCtx = null;
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    probeCtx = c.getContext("2d", { willReadFrequently: true });
  } catch {
    probeCtx = null;
  }
  return probeCtx;
}

function linearToSrgb(c: number): number {
  const x = clamp(c, 0, 1);
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function parseToken(token: string | undefined, pctScale: number, fallback = 0): number {
  if (!token || token.toLowerCase() === "none") return fallback;
  if (token.endsWith("%")) {
    const n = parseFloat(token);
    return Number.isFinite(n) ? (n / 100) * pctScale : fallback;
  }
  const n = parseFloat(token);
  return Number.isFinite(n) ? n : fallback;
}

function parseAngleDeg(raw: string | undefined): number {
  if (!raw || raw.toLowerCase() === "none") return 0;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  const lower = raw.toLowerCase();
  if (lower.endsWith("rad")) return (n * 180) / Math.PI;
  if (lower.endsWith("grad")) return n * 0.9;
  if (lower.endsWith("turn")) return n * 360;
  return n;
}

function oklabToSrgb(L: number, a: number, b: number, alpha: number): Rgba {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb), clamp(alpha, 0, 1)];
}

/**
 * Pure-JS fast parser for standard CSS Color 3 & 4 serializations (hex, rgb/rgba,
 * color(srgb ...), color(srgb-linear ...), oklab(...), oklch(...)).
 * Returns null for color spaces that should be delegated to the browser's color engine.
 */
function parseDirectCssRgba(value: string): Rgba | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "transparent") return [0, 0, 0, 0];

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16) / 255;
      const g = parseInt(hex[1]! + hex[1]!, 16) / 255;
      const b = parseInt(hex[2]! + hex[2]!, 16) / 255;
      const a = hex.length === 4 ? parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && Number.isFinite(a)) {
        return [r, g, b, a];
      }
      return null;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && Number.isFinite(a)) {
        return [r, g, b, a];
      }
      return null;
    }
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("calc(")) return null;

  if (lower.startsWith("rgb(") || lower.startsWith("rgba(")) {
    const inner = trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")"));
    const tokens = inner.match(NUM_RE);
    if (!tokens || tokens.length < 3) return null;
    const r = clamp(parseToken(tokens[0], 255, 0) / 255, 0, 1);
    const g = clamp(parseToken(tokens[1], 255, 0) / 255, 0, 1);
    const b = clamp(parseToken(tokens[2], 255, 0) / 255, 0, 1);
    const a = tokens.length >= 4 ? clamp(parseToken(tokens[3], 1, 1), 0, 1) : 1;
    return [r, g, b, a];
  }

  if (lower.startsWith("color(")) {
    const inner = trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")")).trim();
    const spaceMatch = /^([a-z0-9-]+)\s+(.+)$/i.exec(inner);
    if (!spaceMatch) return null;
    const space = spaceMatch[1]!.toLowerCase();
    const rest = spaceMatch[2]!;
    if (space === "srgb" || space === "srgb-linear") {
      const tokens = rest.match(NUM_RE);
      if (!tokens || tokens.length < 3) return null;
      const c0 = parseToken(tokens[0], 1, 0);
      const c1 = parseToken(tokens[1], 1, 0);
      const c2 = parseToken(tokens[2], 1, 0);
      const a = tokens.length >= 4 ? clamp(parseToken(tokens[3], 1, 1), 0, 1) : 1;
      if (space === "srgb-linear") {
        return [linearToSrgb(c0), linearToSrgb(c1), linearToSrgb(c2), a];
      }
      return [clamp(c0, 0, 1), clamp(c1, 0, 1), clamp(c2, 0, 1), a];
    }
    return null;
  }

  if (lower.startsWith("oklab(")) {
    const inner = trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")"));
    const tokens = inner.match(NUM_RE);
    if (!tokens || tokens.length < 3) return null;
    const L = clamp(parseToken(tokens[0], 1, 0), 0, 1);
    const a = parseToken(tokens[1], 0.4, 0);
    const b = parseToken(tokens[2], 0.4, 0);
    const alpha = tokens.length >= 4 ? clamp(parseToken(tokens[3], 1, 1), 0, 1) : 1;
    return oklabToSrgb(L, a, b, alpha);
  }

  if (lower.startsWith("oklch(")) {
    const inner = trimmed.slice(trimmed.indexOf("(") + 1, trimmed.lastIndexOf(")"));
    const parts = inner.split("/");
    const channels = parts[0]!.trim().split(/\s+/).filter(Boolean);
    if (channels.length < 3) return null;
    const L = clamp(parseToken(channels[0], 1, 0), 0, 1);
    const C = Math.max(0, parseToken(channels[1], 0.4, 0));
    const H = (parseAngleDeg(channels[2]) * Math.PI) / 180;
    const alphaToken = parts[1]?.trim().match(NUM_RE)?.[0];
    const alpha = alphaToken ? clamp(parseToken(alphaToken, 1, 1), 0, 1) : 1;
    return oklabToSrgb(L, C * Math.cos(H), C * Math.sin(H), alpha);
  }

  return null;
}

/**
 * Parses any CSS Color 3/4/5 string into normalized sRGB `[r, g, b, a]` in `[0, 1]`.
 * Handles `oklab(...)`, `oklch(...)`, `color(srgb ...)`, `color(display-p3 ...)`,
 * `color-mix(...)`, `lab(...)`, `lch(...)`, `rgb(...)`, `#hex`, and scientific notation
 * cleanly during live CSS transitions across Chromium, Android WebView, Safari, and Firefox.
 */
export function parseCssRgba(colour: string, fallbackCtx?: CanvasRenderingContext2D | null): Rgba {
  const key = colour.trim();
  const cached = colourCache.get(key);
  if (cached) return cached;

  let result = parseDirectCssRgba(key);

  if (!result) {
    const ctx = getProbeCtx() ?? fallbackCtx ?? null;
    if (ctx) {
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.fillStyle = key;
      const serialized = String(ctx.fillStyle);
      result = parseDirectCssRgba(serialized);

      if (!result && typeof ctx.clearRect === "function" && typeof ctx.fillRect === "function" && typeof ctx.getImageData === "function") {
        try {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "rgba(0, 0, 0, 0)";
          ctx.fillStyle = key;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          result = [data[0]! / 255, data[1]! / 255, data[2]! / 255, data[3]! / 255];
        } catch {
          result = null;
        }
      }
    }
  }

  const finalValue: Rgba = result ?? [0, 0, 0, 0];
  if (colourCache.size >= CACHE_LIMIT) {
    const oldest = colourCache.keys().next().value;
    if (oldest !== undefined) colourCache.delete(oldest);
  }
  colourCache.set(key, finalValue);
  return finalValue;
}
