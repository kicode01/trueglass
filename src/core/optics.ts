export interface GlassShape {
  width: number;
  height: number;
  radius: number;
}

export interface OpticalConfig {
  /** Refractive index of the virtual lens medium (default 1.5 for crown glass). */
  ior: number;
  /** Chromatic dispersion strength (0 = achromatic, 1 = standard crown split, 2 = prismatic). */
  dispersion: number;
  /** Width of the curved bezel band in px (clamped by element shorter half-side). */
  bezelDepth: number;
  /** Relative refractive reach multiplier (0.5 .. 3.0). */
  strength: number;
  /** Dynamic thickness factor (1.0 normal bar/button, ~1.8–2.2 open menu). */
  thicknessScale: number;
  /** Clear <-> Tinted appearance continuum: 0 = pure Clear, 1 = high-contrast Tinted. */
  tintAmount: number;
  /** Virtual light direction in degrees (0 = right, -135 = top-left, driven dynamically by tilt/pointer). */
  lightAngleDeg: number;
  /** Specular rim highlight intensity (0..1). */
  rimShine: number;
  /** Subtle edge stroke opacity (0..1). */
  edgeOpacity: number;
  /** Frost blur sigma in px. */
  blur: number;
}

export const DEFAULT_OPTICS: OpticalConfig = {
  ior: 1.5,
  dispersion: 0.75,
  bezelDepth: 22,
  strength: 1.35,
  thicknessScale: 1.0,
  tintAmount: 0.14,
  lightAngleDeg: -135,
  rimShine: 0.34,
  edgeOpacity: 0.14,
  blur: 2.5,
};

export interface OpticalMaps {
  columns: number;
  rows: number;
  /** Maximum radial displacement reach in CSS px at 100% scale. */
  reachPx: number;
  /** Precomputed Snell's law bezel displacement LUT (128 samples, 0=edge..1=inner). */
  profile: Float32Array;
  /** Greyscale horizontal displacement channel (128 = neutral) for sRGB-safe SVG filter. */
  across: Uint8ClampedArray;
  /** Greyscale vertical displacement channel (128 = neutral) for sRGB-safe SVG filter. */
  down: Uint8ClampedArray;
  /** Combined RGBA map (R=dx, G=dy, B=edgeMask, A=255) for WebGL stage & inspector canvas. */
  combined: Uint8ClampedArray;
  /** Dynamic tilt-reactive specular rim highlight + subtle inner edge line. */
  rim: Uint8ClampedArray;
  /** Generation time in ms. */
  elapsedMs: number;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** Enforces hardware concentricity for nested squircle containers (`max(0, outerRadius - padding)`). */
export function concentricRadius(outerRadius: number, padding: number): number {
  return Math.max(0, outerRadius - padding);
}

/**
 * G2 continuous-curvature Superellipse (L^p squircle, p = 4 default) SDF.
 * Prevents G1 specular kinks at corner transitions compared to circular-arc roundrects.
 */
export function superellipseSDF(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
  p = 4,
): number {
  const r = clamp(radius, 0, Math.min(halfWidth, halfHeight));
  const qx = Math.abs(x) - halfWidth + r;
  const qy = Math.abs(y) - halfHeight + r;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const edge = ox > 0 && oy > 0 ? Math.pow(Math.pow(ox, p) + Math.pow(oy, p), 1 / p) : ox + oy;
  const inner = qx > qy ? qx : qy;
  return edge + (inner < 0 ? inner : 0) - r;
}

/** C2 cubic polynomial smooth minimum (`sminCubic`) for liquid droplet fusion & bridge continuity. */
export function sminCubic(d1: number, d2: number, k: number): number {
  if (k <= 0.0001) return Math.min(d1, d2);
  const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
  return Math.min(d1, d2) - (1 / 6) * h * h * h * k;
}

/** Finite-difference 2D unit outward gradient for compound/merged SDFs. */
export function sminCubicGradient(
  x: number,
  y: number,
  sdfFn: (px: number, py: number) => number,
  eps = 0.5,
): { d: number; gx: number; gy: number } {
  const d = sdfFn(x, y);
  const dx = sdfFn(x + eps, y) - sdfFn(x - eps, y);
  const dy = sdfFn(x, y + eps) - sdfFn(x, y - eps);
  const len = Math.hypot(dx, dy) || 1;
  return { d, gx: dx / len, gy: dy / len };
}

/**
 * Signed distance to a centered rounded rectangle (negative inside, positive outside).
 * Used symmetrically across all 4 quadrants.
 */
export function squircleSDF(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  radius: number,
): number {
  const r = clamp(radius, 0, Math.min(halfW, halfH));
  const qx = Math.abs(x) - halfW + r;
  const qy = Math.abs(y) - halfH + r;
  return Math.hypot(qx > 0 ? qx : 0, qy > 0 ? qy : 0) + Math.min(qx > qy ? qx : qy, 0) - r;
}

/** Outward surface normal for the squircle SDF at (x, y). */
export function squircleNormal(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  cornerRadius: number,
): [number, number] {
  const r = clamp(cornerRadius, 0, Math.min(halfW, halfH));
  const qx = Math.abs(x) - halfW + r;
  const qy = Math.abs(y) - halfH + r;
  if (qx > 0 && qy > 0) {
    const len = Math.hypot(qx, qy);
    if (len > 1e-6) {
      return [(Math.sign(x) * qx) / len, (Math.sign(y) * qy) / len];
    }
  }
  return qx > qy ? [Math.sign(x) || 1, 0] : [0, Math.sign(y) || 1];
}

const profileCache = new Map<string, Float32Array>();

/**
 * Computes exact normalized Snell's law refraction shift through a squircle bezel cross-section.
 * t = 0 is the outer edge (maximum curvature & bend), t = 1 is where bezel meets flat glass (0 bend).
 */
export function computeBezelProfile(
  ior = 1.5,
  squirclePower = 4,
  baseThickness = 0.6,
  samplesCount = 128,
): Float32Array {
  const safeIor = Math.max(1.01, ior);
  const key = `${safeIor.toFixed(3)}|${squirclePower}|${baseThickness.toFixed(2)}|${samplesCount}`;
  const cached = profileCache.get(key);
  if (cached) return cached;

  const lut = new Float32Array(samplesCount);
  let maxShift = 0;

  for (let i = 0; i < samplesCount; i++) {
    const t = clamp(i / (samplesCount - 1), 0.003, 1);
    const inv = 1 - t;
    const z = Math.pow(Math.max(0, 1 - Math.pow(inv, squirclePower)), 1 / squirclePower);
    if (inv <= 1e-5 || z <= 1e-5) {
      lut[i] = 0;
      continue;
    }
    const slope = Math.pow(inv, squirclePower - 1) / Math.pow(z, squirclePower - 1);
    const incident = Math.atan(slope);
    const refracted = Math.asin(clamp(Math.sin(incident) / safeIor, -0.9999, 0.9999));
    const shift = Math.tan(incident - refracted) * (baseThickness + z);
    lut[i] = shift;
    if (shift > maxShift) maxShift = shift;
  }

  if (maxShift > 0) {
    for (let i = 0; i < samplesCount; i++) {
      lut[i] = lut[i]! / maxShift;
    }
  }
  lut[samplesCount - 1] = 0;
  profileCache.set(key, lut);
  return lut;
}

/** Smoothly samples the Snell LUT at normalized bezel position t in [0, 1]. */
export function sampleBezelProfile(lut: Float32Array, t: number): number {
  const pos = clamp(t, 0, 1) * (lut.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, lut.length - 1);
  const a = lut[lo]!;
  return a + (lut[hi]! - a) * (pos - lo);
}

/**
 * Generates optical displacement & tilt-reactive rim highlight maps using flat-interior skipping.
 * Flat interior pixels fill via Uint32Array word fill so only the curved bezel perimeter evaluates normals.
 */
export function generateOpticalMaps(
  shape: GlassShape,
  partialConfig: Partial<OpticalConfig> = {},
  density = 1,
): OpticalMaps {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const cfg = { ...DEFAULT_OPTICS, ...partialConfig };

  const width = Math.max(4, shape.width);
  const height = Math.max(4, shape.height);
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const corner = clamp(shape.radius, 0, Math.min(halfW, halfH));
  const bezel = clamp(cfg.bezelDepth * cfg.thicknessScale, 2, Math.min(halfW, halfH));
  const normalCorner = clamp(Math.max(corner, bezel), 0, Math.min(halfW, halfH));

  // Clear mode gives crisper magnification; Tinted softly tempers extreme edge stretch while lifting fill contrast
  const reachPx = bezel * cfg.strength * cfg.thicknessScale * (1 - 0.18 * cfg.tintAmount);
  const profile = computeBezelProfile(cfg.ior, 4, 0.55 * cfg.thicknessScale, 128);

  const safeDensity = clamp(density, 0.5, 2);
  const columns = Math.max(2, Math.round(width * safeDensity));
  const rows = Math.max(2, Math.round(height * safeDensity));
  const pixelCount = columns * rows;

  const across = new Uint8ClampedArray(pixelCount * 4);
  const down = new Uint8ClampedArray(pixelCount * 4);
  const combined = new Uint8ClampedArray(pixelCount * 4);
  const rim = new Uint8ClampedArray(pixelCount * 4);

  const across32 = new Uint32Array(across.buffer);
  const down32 = new Uint32Array(down.buffer);
  const combined32 = new Uint32Array(combined.buffer);
  const rim32 = new Uint32Array(rim.buffer);

  // Instant 32-bit word initialization to neutral displacement (128, 128, 128, 255)
  across32.fill(0xff808080);
  down32.fill(0xff808080);
  combined32.fill(0xff808080);

  // Precompute light vector from tilt/pointer angle
  const lightRad = (cfg.lightAngleDeg * Math.PI) / 180;
  const lx = Math.cos(lightRad);
  const ly = Math.sin(lightRad);

  // Flat interior bounding box (pixels strictly inside here have sdf < -bezel -> zero displacement!)
  const flatHalfW = Math.max(0, halfW - normalCorner - 1);
  const flatHalfH = Math.max(0, halfH - bezel - 1);
  const flatCoreW = Math.max(0, halfW - bezel - 1);
  const flatCoreH = Math.max(0, halfH - normalCorner - 1);

  const rimWidth = 1.45;
  const edgeStrokeWidth = 0.65;
  const halfPx = 0.5 / safeDensity;
  const lutMax = profile.length - 1;
  const invCols = width / columns;
  const invRows = height / rows;
  const rimMaxDepth = rimWidth * 2.2;

  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * invRows - halfH;
    const ay = y < 0 ? -y : y;
    const sy = y < 0 ? -1 : 1;
    const qy = ay - halfH + corner;
    const nqy = ay - halfH + normalCorner;
    const oy = qy > 0 ? qy : 0;
    const rowOffset = row * columns;

    const inCoreRow = ay < flatCoreH;
    const inBandRow = ay < flatHalfH;

    for (let col = 0; col < columns; col++) {
      const x = (col + 0.5) * invCols - halfW;
      const ax = x < 0 ? -x : x;

      if (inCoreRow && ax < flatHalfW) {
        const nextCol = Math.floor((flatHalfW + halfW) / invCols) - 1;
        if (nextCol > col) {
          col = nextCol;
          continue;
        }
      } else if (inBandRow && ax < flatCoreW) {
        const nextCol = Math.floor((flatCoreW + halfW) / invCols) - 1;
        if (nextCol > col) {
          col = nextCol;
          continue;
        }
      }

      const qx = ax - halfW + corner;
      const ox = qx > 0 ? qx : 0;
      const edgeDist = ox > 0 && oy > 0 ? Math.sqrt(ox * ox + oy * oy) : ox + oy;
      const insideDist = qx > qy ? qx : qy;
      const exactDist = edgeDist + (insideDist < 0 ? insideDist : 0) - corner;
      const depth = -exactDist;

      if (depth < -halfPx) {
        if (depth < -halfPx) {
          const pxIdx = rowOffset + col;
          combined32[pxIdx] = 0x00808080;
        }
        continue;
      }

      const pxIdx = rowOffset + col;
      const sx = x < 0 ? -1 : 1;
      const nqx = ax - halfW + normalCorner;
      let nx = 0;
      let ny = 0;
      if (nqx > 0 && nqy > 0) {
        const invLen = 1 / Math.sqrt(nqx * nqx + nqy * nqy);
        nx = sx * nqx * invLen;
        ny = sy * nqy * invLen;
      } else if (nqx > nqy) {
        nx = sx;
      } else {
        ny = sy;
      }

      if (depth > 0 && depth < bezel) {
        const t = (depth / bezel) * lutMax;
        const lo = t | 0;
        const a = profile[lo]!;
        const amount = a + (profile[lo < lutMax ? lo + 1 : lutMax]! - a) * (t - lo);
        const edgeFade = depth < 1 ? depth : 1;
        const pullX = nx * amount * edgeFade;
        const pullY = ny * amount * edgeFade;

        const gx = (128 - 127 * pullX + 0.5) | 0;
        const gy = (128 - 127 * pullY + 0.5) | 0;
        const cx = (128 + 127 * pullX + 0.5) | 0;
        const cy = (128 + 127 * pullY + 0.5) | 0;
        const cz = (255 * amount + 0.5) | 0;

        across32[pxIdx] = 0xff000000 | (gx << 16) | (gx << 8) | gx;
        down32[pxIdx] = 0xff000000 | (gy << 16) | (gy << 8) | gy;
        combined32[pxIdx] = 0xff000000 | (cz << 16) | (cy << 8) | cx;
      }

      if (depth <= rimMaxDepth) {
        const dot = nx * lx + ny * ly;
        const facingRaw = dot > 0 ? dot : -dot * 0.45;
        const facing = facingRaw * facingRaw;
        const along = (depth > 0 ? depth : 0) / (rimWidth * (0.9 + 0.4 * facing));
        const aaCover = clamp((depth + halfPx) * safeDensity, 0, 1);
        const light = along < 1 ? cfg.rimShine * facing * (1 - along * Math.sqrt(along)) * aaCover : 0;
        const stroke =
          depth >= 0 && depth <= edgeStrokeWidth
            ? cfg.edgeOpacity * clamp((edgeStrokeWidth - depth + halfPx) * safeDensity, 0, 1) * aaCover
            : 0;
        const alpha = light + stroke;
        if (alpha > 0.002) {
          const a8 = ((alpha > 1 ? 1 : alpha) * 255 + 0.5) | 0;
          rim32[pxIdx] = (a8 << 24) | 0x00ffffff;
        }
      }
    }
  }

  const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { columns, rows, reachPx, profile, across, down, combined, rim, elapsedMs };
}

/**
 * Benchmarks a standard full-grid brute-force CPU scan (4 RGBA buffers) against
 * Fluid Glass's flat-interior-skipping unified Uint32Array kernel on identical glass dimensions.
 */
export interface OpticsBenchmarkResult {
  width: number;
  height: number;
  iterations: number;
  fullGridScanMs: number;
  fluidKernelMs: number;
  speedup: number;
  pixelsSkippedRatio: number;
}

export function benchmarkOptics(
  width = 280,
  height = 56,
  radius = 28,
  iterations = 12,
): OpticsBenchmarkResult {
  const bezel = computeBezelProfile(1.5, 4, 0.6, 256);

  // Measure full-grid brute-force pixel loop (4 RGBA buffers per call)
  const fullGridStart = performance.now();
  const cols = width;
  const rows = height;
  for (let iter = 0; iter < iterations; iter++) {
    const bufA = new Uint8ClampedArray(cols * rows * 4);
    const bufB = new Uint8ClampedArray(cols * rows * 4);
    const bufC = new Uint8ClampedArray(cols * rows * 4);
    const bufD = new Uint8ClampedArray(cols * rows * 4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c + 0.5 - width * 0.5;
        const y = r + 0.5 - height * 0.5;
        const qx = Math.abs(x) - width * 0.5 + radius;
        const qy = Math.abs(y) - height * 0.5 + radius;
        const edge = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
        const i = (r * cols + c) * 4;
        if (edge < 0) {
          const t = clamp(-edge / 22, 0, 1);
          const idx = Math.floor(t * 255);
          const v = Math.round(128 - 127 * bezel[idx]!);
          bufA[i] = bufA[i + 1] = bufA[i + 2] = v;
          bufB[i] = bufB[i + 1] = bufB[i + 2] = v;
          bufC[i] = bufC[i + 1] = bufC[i + 2] = Math.round(255 * Math.pow(Math.max(0, 1 - t), 1.5));
          bufD[i] = bufD[i + 1] = bufD[i + 2] = 255;
        }
        bufA[i + 3] = bufB[i + 3] = bufC[i + 3] = bufD[i + 3] = 255;
      }
    }
  }
  const fullGridScanMs = Math.max(0.05, performance.now() - fullGridStart);

  // Measure Fluid Glass flat-interior-skipping unified kernel
  const fluidStart = performance.now();
  let lastMaps!: OpticalMaps;
  for (let iter = 0; iter < iterations; iter++) {
    lastMaps = generateOpticalMaps({ width, height, radius }, { lightAngleDeg: -135 + iter }, 1);
  }
  const fluidKernelMs = Math.max(0.05, performance.now() - fluidStart);
  void lastMaps;

  // Approximate interior ratio for a pill of width x height with 22px bezel
  const innerW = Math.max(0, width - 44);
  const innerH = Math.max(0, height - 44);
  const pixelsSkippedRatio = clamp((innerW * innerH) / (width * height), 0, 0.95);

  return {
    width,
    height,
    iterations,
    fullGridScanMs,
    fluidKernelMs,
    speedup: Number((fullGridScanMs / fluidKernelMs).toFixed(2)),
    pixelsSkippedRatio,
  };
}
