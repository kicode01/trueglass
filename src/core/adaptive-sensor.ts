export interface BackdropSample {
  /** Perceptual relative luminance Y in [0, 1] directly under the glass element. */
  luminance: number;
  /** High-frequency local contrast / edge variance in [0, 1] (text/detail vs flat white). */
  contrastVariance: number;
  /** Recommended polarity: "dark" when under a night shot/dark scene, "light" over bright sunset/white. */
  recommendedTheme: "light" | "dark";
  /** Adaptive shadow opacity scalar [0.04 .. 0.36]: darker under scrolling text, lighter over plain white. */
  adaptiveShadowAlpha: number;
  /** Coarse mean backdrop RGB color (0..255) for ambient color spill into large panels. */
  ambientRgb: readonly [number, number, number];
}

/**
 * Pure analytical luminance, edge-variance, and ambient chroma evaluator for an RGBA sample grid.
 * Used both by live canvas/video samplers and automated unit tests.
 */
export function analyzeBackdropPixels(rgba: Uint8ClampedArray, width: number, height: number): BackdropSample {
  const totalPixels = Math.max(1, width * height);
  let sumY = 0;
  let sumY2 = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  let prevY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = (rgba[idx] ?? 0) / 255;
      const g = (rgba[idx + 1] ?? 0) / 255;
      const b = (rgba[idx + 2] ?? 0) / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumR += r;
      sumG += g;
      sumB += b;
      sumY += lum;
      sumY2 += lum * lum;
      if (x > 0) {
        edgeSum += Math.abs(lum - prevY);
        edgeCount++;
      }
      prevY = lum;
    }
  }

  const luminance = sumY / totalPixels;
  const variance = Math.max(0, sumY2 / totalPixels - luminance * luminance);
  const edgeEnergy = edgeCount > 0 ? edgeSum / edgeCount : 0;

  // Combine global variance with horizontal spatial edge energy to distinguish
  // sharp scrolling text over light pages from uniform white backgrounds.
  const contrastVariance = Math.min(1, Math.sqrt(variance) * 1.4 + edgeEnergy * 3.2);
  const recommendedTheme: "light" | "dark" = luminance < 0.44 ? "dark" : "light";

  // Shadow darkens over scrolling text and lightens over plain white pages.
  const adaptiveShadowAlpha =
    recommendedTheme === "dark"
      ? 0.28 + 0.14 * contrastVariance
      : 0.06 + 0.26 * contrastVariance;

  return {
    luminance: Number(luminance.toFixed(4)),
    contrastVariance: Number(contrastVariance.toFixed(4)),
    recommendedTheme,
    adaptiveShadowAlpha: Number(adaptiveShadowAlpha.toFixed(4)),
    ambientRgb: [
      Math.round((sumR / totalPixels) * 255),
      Math.round((sumG / totalPixels) * 255),
      Math.round((sumB / totalPixels) * 255),
    ],
  };
}

export interface AdaptiveSensorOptions {
  intervalMs?: number;
  surfaceSize?: "small" | "medium" | "large";
  onSample?: (sample: BackdropSample) => void;
}

/**
 * Attaches an adaptive backdrop sensor that observes a backdrop canvas, video, or HTML scene
 * behind `glassElement` and continuously updates `data-theme` (for small/medium controls),
 * `--lg-ambient-spill`, and `--lg-adaptive-shadow` without jarring switches (with hysteresis).
 */
export function attachAdaptiveBackdropSensor(
  glassElement: HTMLElement,
  sampleSource: () => BackdropSample | null,
  options: AdaptiveSensorOptions = {},
): { update(): void; setSurfaceSize(size: "small" | "medium" | "large"): void; destroy(): void } {
  const intervalMs = options.intervalMs ?? 90;
  let surfaceSize = options.surfaceSize ?? "small";
  let timerId = 0;
  let lastTheme: "light" | "dark" = (glassElement.getAttribute("data-theme") as "light" | "dark") || "light";
  let destroyed = false;

  let lastSignature = "";

  const update = () => {
    if (destroyed) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const sample = sampleSource();
    if (!sample) return;

    if (surfaceSize !== "large") {
      // Hysteresis around Y = 0.44 prevents flicker on mid-tone photos
      if (lastTheme === "light" && sample.luminance < 0.38) {
        lastTheme = "dark";
      } else if (lastTheme === "dark" && sample.luminance > 0.50) {
        lastTheme = "light";
      }
    }

    const [ar, ag, ab] = sample.ambientRgb;
    const sig = `${lastTheme}|${sample.luminance.toFixed(2)}|${sample.adaptiveShadowAlpha.toFixed(3)}|${sample.contrastVariance.toFixed(3)}|${ar},${ag},${ab}`;
    if (sig === lastSignature) return;
    lastSignature = sig;

    if (surfaceSize !== "large") {
      glassElement.setAttribute("data-theme", lastTheme);
    }

    const activeSample: BackdropSample = {
      ...sample,
      recommendedTheme: lastTheme,
    };

    glassElement.style.setProperty("--lg-ambient-spill", `rgb(${ar} ${ag} ${ab} / 0.18)`);
    glassElement.setAttribute("data-backdrop-luma", sample.luminance.toFixed(2));
    glassElement.style.setProperty("--lg-adaptive-shadow", sample.adaptiveShadowAlpha.toFixed(3));
    glassElement.style.setProperty("--lg-contrast-energy", sample.contrastVariance.toFixed(3));
    options.onSample?.(activeSample);
  };

  if (typeof window !== "undefined") {
    if (intervalMs > 0) timerId = window.setInterval(update, intervalMs);
    requestAnimationFrame(update);
  }

  return {
    update,
    setSurfaceSize(next) {
      surfaceSize = next;
      glassElement.setAttribute("data-surface-size", next);
      update();
    },
    destroy() {
      destroyed = true;
      if (timerId && typeof window !== "undefined") {
        window.clearInterval(timerId);
      }
    },
  };
}
