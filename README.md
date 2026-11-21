<p align="center">
  <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/public/icon.png" alt="TrueGlass" width="104" height="104" />
</p>

<h1 align="center">TrueGlass</h1>

<p align="center">
  <strong>Physically-Based Optical Glass Engine &amp; UI Component Suite for the Web</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/trueglass"><img src="https://img.shields.io/npm/v/trueglass?style=flat-square&color=0088ff&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/trueglass"><img src="https://img.shields.io/badge/dependencies-0-30d158?style=flat-square" alt="zero dependencies" /></a>
  <a href="https://www.npmjs.com/package/trueglass"><img src="https://img.shields.io/badge/TypeScript-ES2022-3178c6?style=flat-square" alt="TypeScript ES2022" /></a>
  <a href="https://github.com/kicode01/trueglass/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748b?style=flat-square" alt="MIT License" /></a>
  <a href="https://trueglass.vercel.app"><img src="https://img.shields.io/badge/live%20studio-trueglass.vercel.app-38bdf8?style=flat-square" alt="Live Studio" /></a>
</p>

<p align="center">
  <a href="https://trueglass.vercel.app"><strong>Live Studio</strong></a> ·
  <a href="https://www.npmjs.com/package/trueglass"><strong>npm Package</strong></a> ·
  <a href="#studio-showcase"><strong>Showcase</strong></a> ·
  <a href="#optical-architecture"><strong>Architecture</strong></a> ·
  <a href="#installation"><strong>Installation</strong></a> ·
  <a href="#ui-component-suite"><strong>Components</strong></a> ·
  <a href="#headless-core-api"><strong>Core API</strong></a>
</p>

<p align="center">
  <a href="https://trueglass.vercel.app">
    <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/hero-showcase.png" alt="TrueGlass Live Optical Studio — refracted TabBar, Button, Slider, Switch, and SearchField over fluid wallpaper" width="100%" />
  </a>
</p>

---

## Why TrueGlass

Standard CSS glassmorphism (`backdrop-filter: blur(...)`) treats glass as a flat, uniformly frosted rectangle. **TrueGlass** is a zero-dependency, strict TypeScript (`ES2022`) optical engine and UI suite that models the real physical behavior of curved optical glass:

<p align="center">
  <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/snell-bezel-diagram.svg" alt="Cross-section comparison of flat CSS backdrop-filter blur versus TrueGlass G2 superellipse Snell bezel refraction and Cauchy RGB chromatic dispersion" width="100%" />
</p>

- **Snell's Law Bezel Refraction** — Precomputed $G^2$ superellipse ($L^4$) corner normals and surface height profiles bend underlying pixels cleanly along curved glass rims while leaving flat interior centers distortion-free.
- **Cauchy RGB Chromatic Dispersion** — Splits Red, Green, and Blue rays across separate refractive indices along high-curvature bezels and lifted droplet meniscuses.
- **Dual-Engine Cross-Browser Pipeline** — Pairs an sRGB-locked packed-RG `<feDisplacementMap>` SVG filter graph in Chromium with a 3-stage WebGL2 rasterizer (`BEND → SOFTEN → FINISH`) for WebKit & Gecko, with off-screen viewport culling and background-tab idle pausing.
- **Single-Pass $C^2$ Droplet Fusion** — Evaluates sibling glass controls inside a shared WebGL2 pass using cubic smooth-minimum (`sminCubic(d1, d2, k)`), producing continuous liquid necks and cross-sibling Gaussian touch illumination.
- **Pure-GPU Dynamic Specular Rim Lighting** — Drives dual-lobe directional Fresnel rim highlights directly on the GPU via `--lg-light-angle` (`--lg-lx`, `--lg-ly`), paired with lazy pointer parallax and device-orientation tilt (`attachVirtualTiltLight`) with shortest-arc `±180°` seam unwrapping.
- **Closed-Form 2nd-Order Harmonic Springs** — Analytical differential equation solver across underdamped, critically damped, and overdamped regimes at 60–240 Hz without Euler drift.
- **Event-Driven Adaptive Luminance & Contrast Sensor** — Samples underlying scene luminance ($Y$), horizontal edge-contrast variance ($\sigma_Y$), and ambient chroma with hysteresis to automatically flip light/dark polarity, project ambient color spill onto large panels, and modulate grounding shadows.
- **First-Class Accessibility Overrides** — Built-in `reduceTransparency`, `increaseContrast`, and `reduceMotion` modes cleanly scoped to `:root[data-a11y-*]`.

### Capability Matrix

| Capability | Standard CSS Glass (`backdrop-filter: blur`) | TrueGlass |
| :--- | :--- | :--- |
| **Perimeter Refraction** | Uniform flat blur across entire box | Snell's law $G^2$ superellipse bezel + clear interior |
| **Chromatic Dispersion** | None | Multi-channel Cauchy R/G/B refractive split |
| **Cross-Browser Engine** | Single CSS property | sRGB SVG filter graph + 3-stage WebGL2 rasterizer |
| **Droplet Merging** | Hard overlapping borders | Single-pass WebGL2 $C^2$ `sminCubic` liquid bridge fusion |
| **Specular Rim Lighting** | Static border color | Pure-GPU directional Fresnel rim + pointer/gyroscope tilt |
| **Backdrop Adaptation** | Manual theme classes | Hysteresis luminance ($Y$) & edge-variance ($\sigma_Y$) sensor |
| **Material Continuum** | Single opacity | `regular` / `clear` / `scrim` / `identity` + materialize-by-bending |
| **Accessibility** | Manual overrides required | Built-in `reduceTransparency`, `increaseContrast`, `reduceMotion` |

---

## Studio Showcase

Explore every optical module interactively at **[trueglass.vercel.app](https://trueglass.vercel.app)**.

### 1. Glass Magnifier & Optical Lab
Drag the velocity-coupled spring lens across typography and tune **Bend**, **Cauchy Dispersion**, **Frost**, **Rim Specular**, **Clear ↔ Tinted Continuum**, and **GPU Light Tilt** in real time.

<p align="center">
  <a href="https://trueglass.vercel.app/#optics-lab">
    <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/optics-lab.png" alt="TrueGlass Magnifier and Optical Lab showing live Snell refraction over typography and interactive optical sliders" width="100%" />
  </a>
</p>

### 2. Shared Glass Container · $C^2$ Droplet Fusion
Unites adjacent glass controls inside a single WebGL2 backdrop pass so approaching pills fuse via continuous cubic smooth-minimum (`sminCubic`) liquid necks with chromatic dispersion and cross-sibling Gaussian touch glow.

<p align="center">
  <a href="https://trueglass.vercel.app/#droplet-fusion">
    <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/droplet-fusion.png" alt="TrueGlass Shared Glass Container demonstrating C2 sminCubic liquid bridge fusion between a Library pill and Search orb" width="100%" />
  </a>
</p>

### 3. UI Component Suite & Concentric Squircle Architecture
Ten zero-dependency interactive primitives — **Button**, **TabBar**, **SegmentedControl**, **Menu**, **SearchField**, **Input**, **Slider**, **Switch**, **Glass**, and **GlassContainer** — built with hardware-matched concentric radii (`concentricRadius(outer, pad) = max(0, outer - pad)`) and explicit accessibility overrides.

<p align="center">
  <a href="https://trueglass.vercel.app/#components">
    <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/components-suite.png" alt="TrueGlass UI Component Suite showcasing Button, TabBar, SegmentedControl, Menu, Search, Slider, Switch, and Concentric Squircle Accessibility" width="100%" />
  </a>
</p>

### 4. Adaptive Luminance & Contrast Sensor
Continuously samples perceptual luminance ($Y$), horizontal edge-contrast variance ($\sigma_Y$), and ambient RGB chroma beneath floating glass bars to flip light/dark polarity with hysteresis and deepen grounding shadows over dense typography.

<p align="center">
  <a href="https://trueglass.vercel.app/#adaptive">
    <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/adaptive-sensor.png" alt="TrueGlass Adaptive Luminance Sensor over a golden hour sunset scene with live Y, sigma, and grounding shadow telemetry" width="100%" />
  </a>
</p>

---

## Optical Architecture

<p align="center">
  <img src="https://raw.githubusercontent.com/kicode01/trueglass/main/docs/assets/optical-pipeline.svg" alt="TrueGlass Dual-Engine Optical Pipeline architecture diagram" width="100%" />
</p>

---

## Installation

```bash
npm install trueglass
```

Or import directly in browser ESM via CDN:

```html
<link rel="stylesheet" href="https://unpkg.com/trueglass@latest/dist-lib/styles.css" />
<script type="module">
  import { createButton, createTabBar } from "https://esm.sh/trueglass@latest";
</script>
```

### Package Entrypoints

| Import Path | Description |
| :--- | :--- |
| `trueglass` | Full library: headless optical core + all interactive UI components |
| `trueglass/core` | Headless optical engine only (refraction, springs, SDF math, adaptive sensor, a11y) |
| `trueglass/components` | Interactive UI component factories (`createButton`, `createTabBar`, `createGlass`, etc.) |
| `trueglass/styles.css` | Isolated `.lg-*` component & token stylesheet (zero global page resets) |

---

## Quick Start

### 1. Interactive UI Components

```ts
import { createButton, createSlider, createSwitch, createTabBar } from "trueglass";
import "trueglass/styles.css";

// 1. Pill button with rubber-band spring press & optical materialize-by-bending
const button = createButton({
  label: "Continue",
  variant: "glass", // "glass" | "filled"
  material: "regular", // "regular" | "clear" | "identity"
  onClick: () => console.log("Clicked"),
});

// 2. Capsule TabBar with lifted Snell meniscus lens & prismatic dispersion
const tabs = createTabBar({
  ariaLabel: "Navigation",
  value: "radio",
  items: [
    { value: "home", label: "Home" },
    { value: "browse", label: "Browse" },
    { value: "radio", label: "Radio" },
    { value: "library", label: "Library" },
  ],
  onChange: (value) => console.log("Selected tab:", value),
});

// 3. Dual-bed refraction Switch & lifted-thumb Slider
const toggle = createSwitch({
  ariaLabel: "Dark appearance",
  checked: true,
  onChange: (checked) => console.log("Switch:", checked),
});

const slider = createSlider({
  ariaLabel: "Volume",
  min: 0,
  max: 100,
  value: 60,
  onInput: (val) => console.log("Slider:", val),
});

document.body.append(tabs.element, button.element, toggle.element, slider.element);
```

### 2. Linking Glass Surfaces to a Rich Backdrop (`[data-fluid-backdrop]`)

Mark any image, canvas, video, or container with `data-fluid-backdrop` so overlapping TrueGlass elements automatically bind and refract its content:

```html
<div class="hero-stage" data-theme="dark">
  <img src="/wallpaper.webp" data-fluid-backdrop alt="" />
  <div id="hud"></div>
</div>
```

```ts
import { createGlass, refitAllGlass } from "trueglass";
import "trueglass/styles.css";

const card = createGlass({
  className: "my-floating-card",
  material: "regular",
  interactive: true,
});

document.getElementById("hud")!.appendChild(card.element);
refitAllGlass();
```

### 3. Headless Optics on Custom DOM Elements (`trueglass/core`)

Apply TrueGlass refraction, tactile rubber-band press physics, and adaptive luminance sensing to your own markup or framework components (React, Vue, Svelte, Solid, Astro):

```ts
import {
  attachInteractivePress,
  attachRefraction,
  setAccessibilityModes,
} from "trueglass/core";
import "trueglass/styles.css";

const customEl = document.querySelector<HTMLElement>(".my-pill")!;
customEl.classList.add("lg-glass");

const refraction = attachRefraction(customEl);
const stopPress = attachInteractivePress(customEl);

// Trigger optical materialize / dematerialize transition
refraction.dematerialize();
setTimeout(() => refraction.materialize(), 400);

// Clean up on unmount
function destroy() {
  stopPress();
  refraction.destroy();
}
```

---

## UI Component Suite

All component factories are exported from `trueglass` and `trueglass/components`:

### `createGlass(options)`
Universal refractive container with automatic `[data-fluid-backdrop]` binding.
- **Options**: `{ className?, tag?, interactive?, materializeOnMount?, material?: "regular" | "clear" | "identity", dimmingScrim?: boolean }`
- **Handle**: `{ element, refraction, materialize(instant?), dematerialize(instant?), setMaterial(material, dimmingScrim?), refit(), destroy() }`

### `createGlassContainer(options)`
Single-pass WebGL2 container that fuses adjacent controls with $C^2$ cubic smooth-minimum (`sminCubic`) liquid bridges, chromatic neck dispersion, and cross-sibling pointer glow. Enforces homogeneous material variants (`"regular"` and `"clear"` children cannot be mixed).
- **Options**: `{ childrenVariants, backdropSrc?, gap?: number, smoothK?: number, tint?: number, ariaLabel?, onGapChange? }`
- **Handle**: `{ element, setGap(px), getGap(), setSmoothK(k), getSmoothK(), setTint(t), setBackdropSrc(url), refit(), destroy() }`

### `createButton(options)`
Tactile glass or filled pill button with anisotropic rubber-band press physics, internal pointer-contact glow, and optical materialize-by-bending.
- **Options**: `{ label?, iconHtml?, ariaLabel?, variant?: "glass" | "filled", material?, dimmingScrim?, destructive?, tint?, iconOnly?, disabled?, materializeOnMount?, onClick? }`

### `createTabBar(options)` & `createSegmentedControl(options)`
Capsule navigation bars with a press-and-drag lifted magnifying droplet lens, curved Snell meniscus backdrop refraction, and luminous chromatic dispersion.
- **Options**: `{ items: Array<{ value, label, iconHtml? }>, value?, ariaLabel?, className?, onChange? }`
- **Handle**: `{ element, getValue(), setValue(next, instant?), refit(), destroy() }`

### `createSwitch(options)`
Dual-bed stand-in refraction toggle switch with exclusion masking, spring thumb lift, drag scrubbing, and asymptotic bounded overshoot.
- **Options**: `{ checked?, disabled?, ariaLabel, className?, onChange? }`
- **Handle**: `{ element, getChecked(), setChecked(next), setDisabled(disabled), destroy() }`

### `createSlider(options)`
Continuous or stepped range slider whose thumb lifts into a `60×40px` magnifying glass lens refracting the inset track and fill bar.
- **Options**: `{ min?, max?, step?, value?, disabled?, ariaLabel, className?, onInput? }`
- **Handle**: `{ element, input, getValue(), setValue(next), setStep(step), setDisabled(disabled), destroy() }`

### `createMenu(options)`
Trigger-to-card `clip-path` morphing popover menu with scale-coupled blur/shadow spread, icon blur drift, exponential rubber resistance, and magnetic row scrubbing.
- **Options**: `{ ariaLabel, triggerIconHtml?, align?: "start" | "end", items: Array<MenuEntryItem | { type: "separator" }> }`
- **Handle**: `{ element, isOpen(), open(), close(), toggle(), destroy() }`

### `createSearchField(options)` & `createInput(options)`
Capsule glass text and search inputs with animated clear action and focus ring.
- **Options**: `{ placeholder?, value?, disabled?, ariaLabel?, className?, onInput? }`
- **Handle**: `{ element, input, setDisabled(disabled), destroy() }`

---

## Headless Core API (`trueglass/core`)

| Module | Exports | Purpose |
| :--- | :--- | :--- |
| [optics.ts](src/core/optics.ts) | `superellipseSDF`, `squircleSDF`, `squircleNormal`, `sminCubic`, `sminCubicGradient`, `concentricRadius`, `computeBezelProfile`, `sampleBezelProfile`, `generateOpticalMaps`, `benchmarkOptics` | $G^2$ $L^4$ superellipse SDFs, $C^2$ smooth-min union & analytic gradients, hardware concentric radius solver, Snell bezel LUTs, and flat-interior-skipping `Uint32Array` kernel. |
| [lens.ts](src/core/lens.ts) | `createLens`, `createBackdropLens`, `fitBackdropLens`, `lensMap`, `lensField`, `distance`, `shapeOf`, `tuningOf` | Packed-RG sRGB `<feDisplacementMap>` SVG filter graph generator, multi-channel Cauchy dispersion, and stand-in exclusion masking. |
| [refraction.ts](src/core/refraction.ts) | `GLASS`, `rimMap`, `attachRefraction`, `refitAllRefractions`, `materializeAllRefractions` | Automatic `[data-fluid-backdrop]` discovery, viewport-culled surface tracking, idle sleep/wake loop, Fresnel rim painter, and spring bend transitions. |
| [drawn.ts](src/core/drawn.ts) | `createDrawnLens`, `drawsLens` | 3-stage WebGL2 (`BEND` / `SOFTEN` / `FINISH`) backdrop rasterizer for non-SVG `backdrop-filter` browsers. |
| [spring.ts](src/core/spring.ts) | `createSpring`, `advanceSpringState`, `isReducedMotion` | Closed-form 2nd-order harmonic oscillator supporting underdamped, critically damped, and overdamped motion. |
| [adaptive-sensor.ts](src/core/adaptive-sensor.ts) | `analyzeBackdropPixels`, `attachAdaptiveBackdropSensor` | Perceptual luminance ($Y$), horizontal edge-contrast variance ($\sigma_Y$), ambient RGB spill, and hysteresis polarity switching. |
| [interaction.ts](src/core/interaction.ts) | `attachInteractivePress`, `attachVirtualTiltLight`, `setAccessibilityModes`, `getAccessibilityModes` | Anisotropic rubber-band pointer stretch, contact glow coordinates, shortest-arc pointer/gyroscope light tilt, and accessibility state manager. |
| [webgl-stage.ts](src/core/webgl-stage.ts) | `drawCrossSectionRays`, `createWebGLBackdropLens`, `readElementRegionPixels` | Interactive Snell's law cross-section ray tracer and standalone WebGL2 lens stage. |

---

## CSS Tokens & Accessibility

### Optical & Surface Custom Properties ([src/trueglass.css](src/trueglass.css))

| Custom Property | Default (Dark / Light) | Description |
| :--- | :--- | :--- |
| `--lg-glass-bend` | `2` (`3.4` on `TabBar`) | Refracted squircle bezel displacement reach scalar. |
| `--lg-glass-dispersion` | `0.6` (`2.6` on `TabBar`) | Cauchy R/G/B chromatic separation strength along curved edges. |
| `--lg-ior` | `1.5` | Index of refraction passed to the Snell bezel solver. |
| `--lg-blur` | `3px` (`2px` on `TabBar`) | Interior frost blur radius before tint modulation. |
| `--lg-tint-amount` | `0` (`0..1`) | Continuous Clear ↔ Tinted surface density scalar. |
| `--lg-rim-shine` | `0.13` / `0.30` | Specular Fresnel rim highlight intensity. |
| `--lg-light-angle` | `-135` (degrees) | Specular rim light vector angle (rotates live on tilt or slider input). |
| `--lg-ambient-spill` | `transparent` | Backdrop mean chroma tint applied to large adaptive panels. |
| `--lg-adaptive-shadow` | dynamic (`0.06..0.42`) | Edge-contrast-driven grounding shadow opacity scalar. |

### Accessibility Modes (`setAccessibilityModes`)

```ts
import { setAccessibilityModes } from "trueglass";

setAccessibilityModes({
  reduceTransparency: true, // Sets data-a11y-transparency="reduce" on <html>
  increaseContrast: true,   // Sets data-a11y-contrast="high" on <html>
  reduceMotion: true,       // Sets data-a11y-motion="reduce" on <html>
});
```

| Mode | Root Attribute | Effect |
| :--- | :--- | :--- |
| `reduceTransparency` | `data-a11y-transparency="reduce"` | Replaces translucent glass fills with high-legibility `--lg-surface` plates while excluding active overlay lenses and filled buttons. |
| `increaseContrast` | `data-a11y-contrast="high"` | Adds crisp `1.5px` high-contrast foreground borders and outer separation shadows. |
| `reduceMotion` | `data-a11y-motion="reduce"` | Collapses CSS transition durations and snaps harmonic springs instantaneously to target values. |

---

## Development & Packaging

```bash
npm install          # Install dependencies
npm run dev          # Start local Optical Studio showcase at http://localhost:5173/
npm test             # Run Vitest unit test suite
npm run build        # Type-check and build showcase web app to dist/
npm run build:lib    # Build npm package (ESM + .d.ts + styles.css) to dist-lib/
```

---

## License

Released under the [MIT License](LICENSE).
