<p align="center">
  <img src="public/icon.png" alt="TrueGlass" width="128" height="128" />
</p>

# TrueGlass — Physically-Based Optical Glass Engine & UI Suite

**Live Demo:** [https://trueglass.vercel.app](https://trueglass.vercel.app) ([true-glass.vercel.app](https://true-glass.vercel.app))  
**Repository:** [https://github.com/kicode01/trueglass](https://github.com/kicode01/trueglass)

A zero-dependency, physically-based **TrueGlass** optical engine and interactive UI component library built in strict TypeScript (`ES2022`). TrueGlass replaces uniform translucent blurs with real-time Snell's law bezel refraction, Cauchy RGB chromatic dispersion, continuous-curvature $G^2$ superellipse geometry, dynamic specular rim lighting, closed-form analytical spring physics, and $C^2$ cubic smooth-min (`sminCubic`) droplet fusion.

---

## Key Capabilities

- **Zero Runtime Dependencies & Publishable npm Package**: Pure TypeScript & Web Platform APIs with clean tree-shakeable ESM exports (`trueglass`, `trueglass/core`, `trueglass/components`, `trueglass/styles.css`) and full `.d.ts` declarations.
- **Dual-Engine Cross-Browser Optical Pipeline**:
  - **sRGB-Locked SVG Filter Graph** ([src/core/lens.ts](src/core/lens.ts), [src/core/refraction.ts](src/core/refraction.ts)): Multi-channel `<feDisplacementMap>` with RGB chromatic split and an exact `inside`/`outside` alpha composite that leaves flat center interiors crystal-clear.
  - **Shared WebGL2 Shaders & Cross-Browser Rasterizer** ([src/core/drawn.ts](src/core/drawn.ts), [src/core/webgl-stage.ts](src/core/webgl-stage.ts)): Hardware GPU `BEND` / `SOFTEN` / `FINISH` shader passes for browsers without SVG `backdrop-filter: url(...)` support (Safari/Firefox), with automatic hidden-tab and off-screen viewport pausing.
- **Pure-GPU Dynamic Specular Rim & Pointer/Gyroscope Tilt Lighting** ([src/trueglass.css](src/trueglass.css), [src/core/interaction.ts](src/core/interaction.ts)): Drives directional dual-lobe specular rims directly from `--lg-light-angle` / `--lg-lx` / `--lg-ly` on the GPU with zero per-frame canvas baking, paired with lazy pointer/device-orientation tilt and shortest-arc `±180°` seam unwrapping.
- **3D WebGL2 Crystal Glass Typography** ([src/glass-title.ts](src/glass-title.ts)): Exact 2D Euclidean Distance Transform (EDT) dome heightfield with Scharr normals, Schlick Fresnel reflections, Snell's law total internal reflection (TIR), Cauchy RGB prism dispersion, and interactive tilt caustics.
- **$G^2$ Superellipse ($L^4$) Geometry & Snell's Law Profiles** ([src/core/optics.ts](src/core/optics.ts)): Continuous-curvature squircle corner normals and precomputed Snell's law displacement LUTs eliminate $G^1$ specular kinks around rounded corners, including dedicated meniscus lift & prismatic dispersion on `TabBar`.
- **$C^2$ Droplet Fusion & Light Bleed (`createGlassContainer`)**: Evaluates multiple controls inside a single unified WebGL2 backdrop pass using `sminCubic(d1, d2, k)`, rendering continuous liquid bridges, RGB neck dispersion, Schlick Fresnel rims, and Gaussian pointer illumination bleeding across sibling controls.
- **Material Variants, Clear ↔ Tinted Continuum & Materialize-by-Bending**: Supports `"regular" | "clear" | "identity"` glass materials, optional dimming scrim, continuous `--lg-tint-amount` modulation, and optical bend-in/bend-out `materialize()` / `dematerialize()` transitions.
- **Closed-Form 2nd-Order Harmonic Springs** ([src/core/spring.ts](src/core/spring.ts)): Analytical solver covering underdamped, critically damped, and overdamped motion at 60–240 Hz without Euler drift.
- **Event-Driven Adaptive Luminance & Contrast Sensor** ([src/core/adaptive-sensor.ts](src/core/adaptive-sensor.ts)): Samples backdrop luminance $Y$, horizontal spatial contrast variance $\sigma_Y$, and ambient chroma with hysteresis to flip light/dark polarity (`small`/`medium` controls), lock polarity with ambient color spill (`large` panels), and modulate grounding shadow opacity over text vs. plain white regions.
- **Hardware Concentricity & Explicit Accessibility Overrides** ([src/core/interaction.ts](src/core/interaction.ts), [src/trueglass.css](src/trueglass.css)): `concentricRadius(outer, pad)` math plus opt-in `Reduce Transparency`, `Increase Contrast`, and `Reduce Motion` modes scoped cleanly to `:root[data-a11y-*]`.

### What TrueGlass Ships Beyond Standard Glass Libraries

| Capability | Typical CSS / Glisse-Style Demos | TrueGlass |
| :--- | :--- | :--- |
| Snell's Law Bezel + RGB Dispersion | Basic blur or Chromium-only filter | Dual-engine: sRGB SVG filter + WebGL2 fallback |
| Single-Pass $C^2$ Droplet Fusion (`sminCubic`) | Not included | Built-in WebGL2 `createGlassContainer` + touch bleed |
| Adaptive Luminance & Contrast Sensor | Manual light/dark toggle only | Hysteresis polarity flip, ambient spill & adaptive shadow |
| Dynamic Tilt Specular Lighting | Static rim or heavy CPU re-baking | Pure-GPU `--lg-light-angle` + lazy pointer/gyro tilt |
| Material Variants & Materialize-by-Bending | Single glass look / opacity fades | `regular` / `clear` / `scrim` / `identity` + optical bend |
| First-Class Accessibility Overrides | Rarely handled | `reduceTransparency`, `increaseContrast`, `reduceMotion` |
| Reusable npm Package (`trueglass/core` + CSS) | Demo repo only | Zero-dep tree-shakeable ESM + `.d.ts` + isolated `styles.css` |

---

## Optical Pipeline & Architecture

```mermaid
flowchart LR
  BG["Underlying Scene / Backdrop ([data-fluid-backdrop])"] --> SDF["G2 L4 Superellipse SDF & C2 sminCubic Union"]
  SDF --> LUT["Snell's Law Bezel LUT (IOR 1.50, Flat Interior Skip)"]
  LUT --> DISP["RGB Chromatic Dispersion (sRGB SVG Filter / WebGL2 Shader)"]
  BG --> SENSOR["Adaptive Sensor (Luma Y, Contrast sigma_Y, Ambient RGB)"]
  SENSOR --> POLARITY["Polarity Flip / Ambient Spill & Adaptive Shadow"]
  DISP --> RIM["1.22px Bowed Specular Rim & 0.5px Hairline Edge"]
  RIM --> OUT["Crisp Foreground Controls (No Glass-on-Glass Stacking)"]
  POLARITY --> OUT
```

---

## Installation & Quick Start

```bash
npm install trueglass
```

Import the stylesheet once and mount any component or headless glass surface:

```ts
import { createButton, createGlass, createTabBar } from "trueglass";
import "trueglass/styles.css";

const btn = createButton({
  label: "Continue",
  onClick: () => console.log("Pressed"),
});
document.body.appendChild(btn.element);
```

Want only the headless optical engine (Snell bezels, springs, adaptive luminance sensor) without UI widgets?

```ts
import { attachRefraction, attachAdaptiveBackdropSensor, createSpring } from "trueglass/core";
```

---

## Local Development

```bash
npm install
npm run dev        # Start Vite showcase on http://localhost:5173/
npm test           # Run Vitest unit test suite
npm run build      # Type-check and build showcase site to dist/
npm run build:lib  # Build publishable npm library + .d.ts types + styles.css to dist-lib/
```

---

## Core Engine API (`src/core`)

| Module | Key Exports | Purpose |
| :--- | :--- | :--- |
| [optics.ts](src/core/optics.ts) | `superellipseSDF`, `sminCubic`, `sminCubicGradient`, `concentricRadius`, `computeBezelProfile`, `generateOpticalMaps`, `benchmarkOptics` | $G^2$ squircle math, $C^2$ union blending, Snell bezel LUTs, and flat-interior-skipping `Uint32Array` map kernel. |
| [lens.ts](src/core/lens.ts) | `createLens`, `createBackdropLens`, `fitBackdropLens`, `lensMap`, `lensField`, `distance`, `shapeOf` | sRGB `<feDisplacementMap>` SVG filter graph generator, $L^4$ corner normals, and stand-in exclusion masking. |
| [refraction.ts](src/core/refraction.ts) | `GLASS`, `rimMap`, `attachRefraction`, `refitAllRefractions`, `materializeAllRefractions` | Lazy `[data-fluid-backdrop]` binding, up to 3x DPR anisotropic Fresnel rim painting, and spring materialize/dematerialize. |
| [drawn.ts](src/core/drawn.ts) | `createDrawnLens`, `drawsLens` | WebGL2 three-stage (`BEND`/`SOFTEN`/`FINISH`) backdrop lens renderer for non-SVG `backdrop-filter` engines. |
| [spring.ts](src/core/spring.ts) | `createSpring`, `advanceSpringState`, `isReducedMotion` | Closed-form 2nd-order differential spring animator across all damping regimes. |
| [adaptive-sensor.ts](src/core/adaptive-sensor.ts) | `analyzeBackdropPixels`, `attachAdaptiveBackdropSensor` | Real-time luminance, edge-contrast variance, hysteresis polarity flipping, and ambient color spill tracking. |
| [interaction.ts](src/core/interaction.ts) | `attachInteractivePress`, `attachVirtualTiltLight`, `setAccessibilityModes`, `getAccessibilityModes` | Anisotropic rubber-band pointer stretch, internal finger contact glow, tilt lighting, and `data-a11y-*` toggles. |
| [webgl-stage.ts](src/core/webgl-stage.ts) | `drawCrossSectionRays`, `createWebGLBackdropLens`, `readElementRegionPixels` | Interactive cross-section Snell ray visualizer and standalone WebGL2 lens stage. |

---

## UI Component Suite (`src/components`)

Import directly from [src/components/index.ts](src/components/index.ts) (alongside [src/styles.css](src/styles.css)):

* **`createGlass(options)`**: Universal TrueGlass container with automatic `[data-fluid-backdrop]` linking, `material` variants (`"regular" | "clear" | "identity"`), optional `dimmingScrim`, and `materialize()` / `dematerialize()`.
* **`createGlassContainer(options)`**: Shared sampling container uniting child pills inside one WebGL2 pass with `sminCubic` liquid bridge morphing, chromatic neck dispersion, cross-sibling touch glow, and homogeneous material validation (throws if `"regular"` and `"clear"` children are mixed).
* **`createButton(options)`**: TrueGlass pill button with rubber-band spring press, tap shimmer sweep (`[data-shimmer]`), `glass` / `filled` variants, custom `tint`, `destructive` styling, and materialize-by-bending.
* **`createSwitch(options)`**: Dual-bed stand-in refraction switch with exclusion masking, spring lift, drag scrubbing, and asymptotic bounded overshoot.
* **`createSlider(options)`**: Continuous or stepped slider with a lifted 60x40px magnifying thumb lens refracting an inset track layer.
* **`createTabBar(options)` & `createSegmentedControl(options)`**: Three-layer synchronized ink refraction + chromatic dispersion capsule bars with interactive thumb dragging and scroll minimization support.
* **`createMenu(options)`**: Trigger-to-card clip-path morphing menu featuring scale-dependent blur/shadow spread, icon blur drift, exponential rubber resistance, and magnetic row scrubbing.
* **`createSearchField(options)` & `createInput(options)`**: Capsule text and search inputs with animated clear button and glass backdrop adaptation.

---

## CSS Custom Properties & Accessibility Modes

### Optical & Surface Tokens ([src/styles.css](src/styles.css))

| Property | Default (Dark / Light) | Effect |
| :--- | :--- | :--- |
| `--lg-glass-bend` | `2` (or per-element override) | Refracted squircle bezel displacement reach. |
| `--lg-glass-dispersion` | `0.6` | Chromatic R/G/B separation strength along curved edges. |
| `--lg-ior` | `1.5` | Refractive index passed into the Snell bezel solver. |
| `--lg-blur` | `3px` | Interior frost blur radius before tint modulation. |
| `--lg-tint-amount` | `0` (`0..1`) | Clear-to-Tinted appearance continuum scalar. |
| `--lg-rim-shine` | `0.13` / `0.3` | Directional bowed specular rim highlight intensity. |
| `--lg-light-angle` | `-135` | Specular rim light vector angle in degrees (rotated by tilt or sliders). |
| `--lg-ambient-spill` | `transparent` | Backdrop mean chroma tint applied to large adaptive panels. |
| `--lg-adaptive-shadow` | dynamic (`0.06..0.42`) | Contrast-driven grounding shadow opacity. |

### Accessibility Overrides (`setAccessibilityModes`)

| API Flag | DOM Root Attribute | Behavior |
| :--- | :--- | :--- |
| `reduceTransparency` | `data-a11y-transparency="reduce"` | Raises surface opacity (`--lg-surface`) and frosted backdrop blur for maximum legibility. |
| `increaseContrast` | `data-a11y-contrast="high"` | Adds high-contrast 1.5px foreground borders and crisp outer separation shadows. |
| `reduceMotion` | `data-a11y-motion="reduce"` | Collapses CSS transitions/animations and snaps harmonic springs instantaneously to targets. |

---

## License

[MIT](LICENSE)
