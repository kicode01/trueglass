import { describe, expect, it, vi } from "vitest";
import {
  advanceSpringState,
  analyzeBackdropPixels,
  benchmarkOptics,
  computeBezelProfile,
  concentricRadius,
  createSpring,
  distance,
  generateOpticalMaps,
  lensField,
  lensMap,
  rimMap,
  sampleBezelProfile,
  setAccessibilityModes,
  sminCubic,
  squircleNormal,
  squircleSDF,
  superellipseSDF,
} from "../src/core";
import {
  createButton,
  createGlass,
  createGlassContainer,
  createInput,
  createMenu,
  createSearchField,
  createSegmentedControl,
  createSlider,
  createSwitch,
  createTabBar,
} from "../src/components";

describe("Analytical Harmonic Spring Engine", () => {
  it("converges accurately across underdamped, critically damped, and overdamped regimes", () => {
    const regimes: Array<[number, number]> = [
      [500, 14], // underdamped
      [400, 40], // critically damped (half^2 - k = 0)
      [400, 60], // overdamped
    ];

    for (const [k, c] of regimes) {
      const s = { value: 0, target: 1, velocity: 0, stiffness: k, damping: c };
      for (let i = 0; i < 200; i++) {
        advanceSpringState(s, 1 / 120);
      }
      expect(s.value).toBeCloseTo(1, 2);
      expect(Math.abs(s.velocity)).toBeLessThan(0.05);
    }
  });

  it("sets instant target cleanly without waiting for animation frames", () => {
    const seen: number[] = [];
    const sp = createSpring(0, 400, 28, (v) => seen.push(v));
    sp.set(0.85, true);
    expect(sp.get()).toBeCloseTo(0.85, 4);
    expect(seen.at(-1)).toBeCloseTo(0.85, 4);
    sp.stop();
  });
});

describe("Fluid Glass Snell's Law & Superellipse Optics", () => {
  it("computes accurate signed distances and normals", () => {
    expect(distance(0, 0, 50, 20, 10)).toBe(-20);
    expect(distance(50, 0, 50, 20, 10)).toBe(0);
    expect(squircleSDF(55, 0, 50, 20, 10)).toBe(5);

    const [nx, ny] = squircleNormal(48, 0, 50, 20, 10);
    expect(nx).toBeCloseTo(1, 3);
    expect(ny).toBeCloseTo(0, 3);
  });

  it("produces pixel-accurate rimMap and lensMap/lensField with dynamic light angle", () => {
    const shape = { width: 120, height: 48, radius: 24 };
    const topLeft = rimMap(shape, 0.3, 2, [255, 255, 255, 0.1], -135);
    const rotated = rimMap(shape, 0.3, 2, [255, 255, 255, 0.1], 15);
    expect(topLeft.columns).toBe(240);
    expect(topLeft.rows).toBe(96);
    expect(topLeft.data.some((v) => v > 0)).toBe(true);
    expect(Array.from(topLeft.data.slice(0, 400))).not.toEqual(Array.from(rotated.data.slice(0, 400)));

    const bezelOpts = { strength: 2, dispersion: 0.6, depth: 0.3, maxDepth: 36, dome: 0, splay: 1, relative: true, bezel: true };
    const lMap = lensMap(shape, bezelOpts, { angle: 45, glow: 0.4, spread: 0.5, glowPower: 1.5, edge: 0.5, edgeWidth: 2, edgePower: 1.5 }, 1);
    const centerIdx = (Math.floor(lMap.rows / 2) * lMap.columns + Math.floor(lMap.columns / 2)) * 4;
    expect(lMap.across[centerIdx]).toBe(128);
    expect(lMap.down[centerIdx]).toBe(128);

    const field = lensField(shape, bezelOpts, 1);
    expect(field.data.length).toBe(120 * 48 * 4);
  });

  it("enforces Snell's Law monotonic falloff and Clear <-> Tinted modulation", () => {
    const lut = computeBezelProfile(1.5, 4, 0.6, 128);
    expect(lut[0]!).toBeCloseTo(1, 1);
    expect(lut[lut.length - 1]!).toBe(0);
    expect(sampleBezelProfile(lut, 0.1)).toBeGreaterThan(sampleBezelProfile(lut, 0.7));

    const shape = { width: 120, height: 48, radius: 24 };
    const clearMaps = generateOpticalMaps(shape, { tintAmount: 0 });
    const tintedMaps = generateOpticalMaps(shape, { tintAmount: 1 });
    expect(clearMaps.reachPx).toBeGreaterThan(tintedMaps.reachPx);
  });

  it("executes optical benchmark cleanly with measurable interior skipping", () => {
    const res = benchmarkOptics(240, 56, 28, 4);
    expect(res.fullGridScanMs).toBeGreaterThan(0);
    expect(res.fluidKernelMs).toBeGreaterThan(0);
    expect(res.pixelsSkippedRatio).toBeGreaterThan(0.15);
  });
});

describe("Adaptive Backdrop Luminance & Scroll-Contrast Sensor", () => {
  it("distinguishes dark night shot, plain white, and high-contrast scrolling text", () => {
    const w = 16;
    const h = 8;
    const makeSolid = (r: number, g: number, b: number) => {
      const buf = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
      return buf;
    };

    const night = analyzeBackdropPixels(makeSolid(12, 18, 32), w, h);
    expect(night.recommendedTheme).toBe("dark");
    expect(night.luminance).toBeLessThan(0.15);

    const plainWhite = analyzeBackdropPixels(makeSolid(252, 252, 252), w, h);
    expect(plainWhite.recommendedTheme).toBe("light");
    expect(plainWhite.contrastVariance).toBe(0);

    const textBuf = makeSolid(252, 252, 252);
    for (let x = 0; x < w; x++) {
      if (x % 2 === 1) {
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          textBuf[idx] = textBuf[idx + 1] = textBuf[idx + 2] = 20;
        }
      }
    }
    const scrollingText = analyzeBackdropPixels(textBuf, w, h);
    expect(scrollingText.contrastVariance).toBeGreaterThan(plainWhite.contrastVariance);
    expect(scrollingText.adaptiveShadowAlpha).toBeGreaterThan(plainWhite.adaptiveShadowAlpha);
  });
});

describe("Zero-Dependency Fluid Glass UI Components", () => {
  it("renders dual-bed Switch & Slider, 3-layer inked TabBar/SegmentedControl, morphing Menu & Input", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const glass = createGlass({ materializeOnMount: false });
    expect(glass.element.classList.contains("lg-glass")).toBe(true);

    const onClick = vi.fn();
    const btn = createButton({ label: "Continue", variant: "filled", onClick });
    btn.element.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    btn.materialize(true);
    expect(btn.refraction.bendProgress()).toBeCloseTo(1, 2);

    const onSwitch = vi.fn();
    const sw = createSwitch({ ariaLabel: "Wi-Fi", checked: false, onChange: onSwitch });
    expect(sw.element.getAttribute("role")).toBe("switch");
    expect(sw.element.querySelector(".lg-switch-inset")).not.toBeNull();
    sw.element.click();
    expect(sw.getChecked()).toBe(true);
    expect(onSwitch).toHaveBeenCalledWith(true);

    const slider = createSlider({ ariaLabel: "Volume", min: 0, max: 100, value: 40 });
    expect(slider.element.querySelector(".lg-slider-magnified")).not.toBeNull();
    slider.setValue(75);
    expect(slider.getValue()).toBe(75);

    const tabBar = createTabBar({
      ariaLabel: "Photos",
      value: "library",
      items: [
        { value: "library", label: "Library" },
        { value: "collections", label: "Collections" },
      ],
    });
    expect(tabBar.element.getAttribute("role")).toBe("tablist");
    expect(tabBar.element.querySelector(".lg-tab-lensed")).not.toBeNull();
    expect(tabBar.element.querySelector(".lg-tab-tint")).not.toBeNull();
    tabBar.setValue("collections", true);
    expect(tabBar.getValue()).toBe("collections");

    const seg = createSegmentedControl({
      ariaLabel: "Range",
      value: "day",
      items: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
      ],
    });
    expect(seg.element.getAttribute("role")).toBe("radiogroup");

    const onSelect = vi.fn();
    const menu = createMenu({
      ariaLabel: "Actions",
      items: [
        { label: "Copy", onSelect },
        { type: "separator" },
        { label: "Delete", destructive: true },
      ],
    });
    expect(menu.isOpen()).toBe(false);
    menu.open();
    expect(menu.isOpen()).toBe(true);
    expect(menu.element.querySelector(".lg-menu-glyph")).not.toBeNull();
    const firstItem = menu.element.querySelector<HTMLButtonElement>(".lg-menu-item")!;
    firstItem.click();
    expect(onSelect).toHaveBeenCalledTimes(1);

    const search = createSearchField({ placeholder: "Search" });
    search.input.value = "Fluid";
    search.input.dispatchEvent(new Event("input"));
    const clearBtn = search.element.querySelector<HTMLButtonElement>(".lg-input-clear")!;
    expect(clearBtn.hidden).toBe(false);
    clearBtn.click();
    expect(search.input.value).toBe("");

    const inp = createInput({ placeholder: "Plain" });
    expect(inp.element.classList.contains("lg-input")).toBe(true);

    container.append(
      glass.element,
      btn.element,
      sw.element,
      slider.element,
      tabBar.element,
      seg.element,
      menu.element,
      search.element,
      inp.element,
    );

    [glass, btn, sw, slider, tabBar, seg, menu, search, inp].forEach((c) => c.destroy());
    container.remove();
  });

  it("lazily binds detached createGlass() elements to [data-fluid-backdrop] once mounted and refitted", () => {
    const mockCtx = {
      fillStyle: "#0000",
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: () => {},
    } as unknown as CanvasRenderingContext2D;
    const ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => mockCtx);
    const dataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/png;base64,AA==");

    const stage = document.createElement("div");
    const backdrop = document.createElement("div");
    backdrop.setAttribute("data-fluid-backdrop", "");

    // Create glass BEFORE attaching to DOM or backdrop container (vanilla TS construction order)
    const glass = createGlass({ materializeOnMount: false });
    glass.element.style.borderRadius = "75px";

    const mockBox = (el: HTMLElement, width: number, height: number) => {
      Object.defineProperty(el, "offsetWidth", { configurable: true, value: width });
      Object.defineProperty(el, "offsetHeight", { configurable: true, value: height });
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, height));
    };

    try {
      mockBox(backdrop, 400, 300);
      mockBox(glass.element, 210, 150);

      stage.append(backdrop, glass.element);
      document.body.appendChild(stage);

      expect(backdrop.style.filter).toBe("");
      glass.refit();
      expect(backdrop.style.filter).toMatch(/^url\(["']?#fluid-glass-lens-\d+-\d+["']?\)$/);
    } finally {
      glass.destroy();
      stage.remove();
      ctxSpy.mockRestore();
      dataUrlSpy.mockRestore();
    }
  });

  it("supports G2 superellipse SDF, concentric radii, C2 sminCubic merging, material variants, and a11y overrides", () => {
    expect(concentricRadius(32, 8)).toBe(24);
    expect(concentricRadius(10, 14)).toBe(0);

    // G2 L^4 superellipse matches flat axis distance at center and curves smoothly in corners
    expect(superellipseSDF(0, 0, 50, 20, 10, 4)).toBe(-20);
    expect(superellipseSDF(45, 15, 50, 20, 10, 4)).toBeLessThan(squircleSDF(45, 15, 50, 20, 10));

    // C2 sminCubic creates a continuous liquid neck strictly below min(d1, d2) inside k
    expect(sminCubic(5, 5, 24)).toBeCloseTo(5 - 24 / 6, 4);
    expect(sminCubic(5, 40, 24)).toBe(5);

    const glass = createGlass({ material: "clear", dimmingScrim: true });
    expect(glass.element.getAttribute("data-material")).toBe("clear");
    expect(glass.element.getAttribute("data-scrim")).toBe("true");
    glass.setMaterial("identity");
    expect(glass.element.getAttribute("data-material")).toBe("identity");
    expect(glass.element.hasAttribute("data-scrim")).toBe(false);
    glass.dematerialize(true);
    expect(glass.refraction.bendProgress()).toBe(0);
    glass.destroy();

    const tealBuf = new Uint8ClampedArray([10, 120, 210, 255, 10, 120, 210, 255]);
    const tealSample = analyzeBackdropPixels(tealBuf, 2, 1);
    expect(tealSample.ambientRgb).toEqual([10, 120, 210]);

    const a11y = setAccessibilityModes({ reduceTransparency: true, increaseContrast: true, reduceMotion: true });
    expect(a11y).toEqual({ reduceTransparency: true, increaseContrast: true, reduceMotion: true });
    expect(document.documentElement.getAttribute("data-a11y-transparency")).toBe("reduce");
    expect(document.documentElement.getAttribute("data-a11y-contrast")).toBe("high");
    expect(document.documentElement.getAttribute("data-a11y-motion")).toBe("reduce");
    setAccessibilityModes({ reduceTransparency: false, increaseContrast: false, reduceMotion: false });
  });

  it("bounds switch drag overshoot asymptotically so the thumb cannot detach from its track", () => {
    setAccessibilityModes({ reduceMotion: true });
    const sw = createSwitch({ ariaLabel: "Wi-Fi", checked: false });
    document.body.appendChild(sw.element);
    const thumb = sw.element.querySelector<HTMLSpanElement>(".lg-switch-thumb")!;
    const SWITCH_TRAVEL = 57.9 * 0.375;

    const firePointer = (type: string, clientX: number) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(ev, { isPrimary: true, button: 0, pointerId: 1, clientX, clientY: 10 });
      sw.element.dispatchEvent(ev);
    };
    const parseX = () => {
      const m = thumb.style.transform.match(/translate\(([-\d.]+)px/);
      return m ? Number(m[1]) : NaN;
    };

    try {
      firePointer("pointerdown", 500);
      firePointer("pointermove", 2500); // extreme right drag (+2000px)
      const rightX = parseX();
      expect(rightX).toBeGreaterThan(SWITCH_TRAVEL);
      expect(rightX).toBeLessThanOrEqual(SWITCH_TRAVEL * 1.16 + 0.01);

      firePointer("pointermove", -1500); // extreme left drag (-2000px)
      const leftX = parseX();
      expect(leftX).toBeLessThan(0);
      expect(leftX).toBeGreaterThanOrEqual(-SWITCH_TRAVEL * 0.16 - 0.01);

      firePointer("pointerup", -1500);
    } finally {
      sw.destroy();
      sw.element.remove();
      setAccessibilityModes({ reduceMotion: false });
    }
  });

  it("supports GlassEffectContainer C2 droplet fusion, enforces variant homogeneity, and computes G2 bezel/rim normals", () => {
    expect(() =>
      createGlassContainer({
        childrenVariants: ["regular", "clear"],
      }),
    ).toThrow(/mix 'regular' and 'clear'/i);

    const container = createGlassContainer({
      childrenVariants: ["regular", "regular"],
      gap: 10,
      smoothK: 26,
    });
    expect(container.getGap()).toBe(10);
    expect(container.getSmoothK()).toBe(26);
    container.setGap(-8);
    container.setSmoothK(34);
    expect(container.getGap()).toBe(-8);
    expect(container.getSmoothK()).toBe(34);
    expect(container.element.querySelectorAll(".lg-droplet-item").length).toBe(2);
    container.destroy();

    // Verify G2 L^4 superellipse bezel displacement & anisotropic rim highlights around corners
    const shape = { width: 100, height: 40, radius: 14 };
    const light = { angle: 45, glow: 0.4, spread: 0.5, glowPower: 1.5, edge: 0.5, edgeWidth: 2, edgePower: 1.5 };
    const lMap = lensMap(
      shape,
      { strength: 2, dispersion: 0.6, depth: 0.3, maxDepth: 20, dome: 0, splay: 1, relative: true, bezel: true },
      light,
      1,
    );
    // Asymmetric point strictly inside the top-left corner band produces non-equal L^4 normal displacement
    const cornerPx = (3 * lMap.columns + 6) * 4;
    expect(lMap.across[cornerPx]).not.toBe(128);
    expect(lMap.down[cornerPx]).not.toBe(128);
    expect(lMap.across[cornerPx]).not.toBe(lMap.down[cornerPx]);

    const rMap = rimMap(shape, 0.35, 2, [255, 255, 255, 0.08], -135);
    expect(rMap.data.some((v, idx) => idx % 4 === 3 && v > 0)).toBe(true);
  });

  it("excludes overlay lenses, magnifier lens, filled buttons, and identity glass from reduce-transparency opaque surface", async () => {
    const fsSpecifier = "node:fs";
    const pathSpecifier = "node:path";
    const { readFileSync } = (await import(/* @vite-ignore */ fsSpecifier)) as {
      readFileSync: (filePath: string, enc: "utf8") => string;
    };
    const { resolve } = (await import(/* @vite-ignore */ pathSpecifier)) as {
      resolve: (...segments: string[]) => string;
    };
    const stylesCss = readFileSync(resolve("src", "styles.css"), "utf8");
    const ruleMatch = stylesCss.match(/(:root\[data-a11y-transparency="reduce"\][^{]*)\{[\s\S]*?\}/);
    expect(ruleMatch).not.toBeNull();
    const selectorList = ruleMatch![1]!.trim();

    const host = document.createElement("div");
    const tabBar = createTabBar({
      ariaLabel: "Library",
      value: "radio",
      items: [
        { value: "home", label: "Home" },
        { value: "radio", label: "Radio" },
      ],
    });
    const seg = createSegmentedControl({
      ariaLabel: "Range",
      value: "week",
      items: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
      ],
    });
    const magnifierLens = createGlass({ className: "lens", materializeOnMount: false });
    const glassBtn = createButton({ label: "Continue", variant: "glass", materializeOnMount: false });
    const filledBtn = createButton({ label: "Run", variant: "filled", materializeOnMount: false });
    const identityGlass = createGlass({ material: "identity", materializeOnMount: false });
    const search = createSearchField({ placeholder: "Search" });
    const menu = createMenu({ ariaLabel: "Options", items: [{ label: "Pin" }] });

    host.append(
      tabBar.element,
      seg.element,
      magnifierLens.element,
      glassBtn.element,
      filledBtn.element,
      identityGlass.element,
      search.element,
      menu.element,
    );
    document.body.appendChild(host);

    try {
      setAccessibilityModes({ reduceTransparency: true });
      const matched = new Set(Array.from(document.querySelectorAll(selectorList)));

      expect(matched.has(tabBar.element.querySelector(".lg-tab-lens")!)).toBe(false);
      expect(matched.has(seg.element.querySelector(".lg-tab-lens")!)).toBe(false);
      expect(matched.has(magnifierLens.element)).toBe(false);
      expect(matched.has(filledBtn.element)).toBe(false);
      expect(matched.has(identityGlass.element)).toBe(false);

      expect(matched.has(tabBar.element.querySelector(".lg-tab-bar-glass")!)).toBe(true);
      expect(matched.has(seg.element.querySelector(".lg-tab-bar-glass")!)).toBe(true);
      expect(matched.has(glassBtn.element)).toBe(true);
      expect(matched.has(search.element)).toBe(true);
      expect(matched.has(menu.element.querySelector(".lg-menu-surface")!)).toBe(true);
    } finally {
      [tabBar, seg, magnifierLens, glassBtn, filledBtn, identityGlass, search, menu].forEach((c) => c.destroy());
      host.remove();
      setAccessibilityModes({ reduceTransparency: false });
    }
  });
});
