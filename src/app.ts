import {
  analyzeBackdropPixels,
  attachAdaptiveBackdropSensor,
  attachVirtualTiltLight,
  benchmarkOptics,
  concentricRadius,
  drawCrossSectionRays,
  setAccessibilityModes,
  type BackdropSample,
} from "./core";
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
  materializeAllGlass,
  refitAllGlass,
  type GlassMaterial,
} from "./components";

const ICON_PATHS = {
  search:
    "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z",
  share:
    "M216,112v96a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V112A16,16,0,0,1,56,96H80a8,8,0,0,1,0,16H56v96H200V112H176a8,8,0,0,1,0-16h24A16,16,0,0,1,216,112ZM93.66,69.66,120,43.31V136a8,8,0,0,0,16,0V43.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,69.66Z",
  heart:
    "M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z",
  trash:
    "M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z",
  home:
    "M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z",
  browse:
    "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z",
  radio:
    "M104,168a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H96A8,8,0,0,1,104,168Zm-8-40H64a8,8,0,0,0,0,16H96a8,8,0,0,0,0-16Zm0-32H64a8,8,0,0,0,0,16H96a8,8,0,0,0,0-16ZM232,80V192a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V72a8,8,0,0,1,5.7-7.66l160-48a8,8,0,0,1,4.6,15.33L86.51,64H216A16,16,0,0,1,232,80ZM216,192V80H40V192H216Zm-16-56a40,40,0,1,1-40-40A40,40,0,0,1,200,136Zm-16,0a24,24,0,1,0-24,24A24,24,0,0,0,184,136Z",
  library:
    "M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm6.62,31.47,46.82-10.05,3.34,15.9L146,97.53Zm6.64,31.57,46.82-10.06,13.3,63.24-46.82,10.06ZM216,197.94l-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm0,32h48v96H56Zm48,128H56V192h48v16Z",
  pin: "M235.32,81.37,174.63,20.69a16,16,0,0,0-22.63,0L98.37,74.49c-10.66-3.34-35-7.37-60.4,13.14a16,16,0,0,0-1.29,23.78L85,159.71,42.34,202.34a8,8,0,0,0,11.32,11.32L96.29,171l48.29,48.29A16,16,0,0,0,155.9,224c.38,0,.75,0,1.13,0a15.93,15.93,0,0,0,11.64-6.33c19.64-26.1,17.75-47.32,13.19-60L235.33,104A16,16,0,0,0,235.32,81.37ZM224,92.69h0l-57.27,57.46a8,8,0,0,0-1.49,9.22c9.46,18.93-1.8,38.59-9.34,48.62L48,100.08c12.08-9.74,23.64-12.31,32.48-12.31A40.13,40.13,0,0,1,96.81,91a8,8,0,0,0,9.25-1.51L163.32,32,224,92.68Z",
  pencil:
    "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z",
  copy: "M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z",
};

function iconSvg(path: string): string {
  return `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}

function sunOrMoonSvg(dark: boolean): string {
  return dark
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
}

const TAB_CHOICES = [
  { value: "home", label: "Home", iconHtml: iconSvg(ICON_PATHS.home) },
  { value: "browse", label: "Browse", iconHtml: iconSvg(ICON_PATHS.browse) },
  { value: "radio", label: "Radio", iconHtml: iconSvg(ICON_PATHS.radio) },
  { value: "library", label: "Library", iconHtml: iconSvg(ICON_PATHS.library) },
];

function paintSunsetNightCanvas(canvas: HTMLCanvasElement, mode: "sunset-night" | "white-text"): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = (canvas.width = 760);
  const h = (canvas.height = 1600);

  if (mode === "sunset-night") {
    // Zone 1 (0..520px): Atmospheric Golden Hour Sky, Horizon Ridge & Specular Water Glints
    const sky = ctx.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, "#334766");
    sky.addColorStop(0.38, "#945f57");
    sky.addColorStop(0.76, "#e89f5c");
    sky.addColorStop(1, "#ffebc2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, 340);

    const sun = ctx.createRadialGradient(w * 0.52, 265, 8, w * 0.52, 265, 250);
    sun.addColorStop(0, "rgba(255, 253, 240, 0.98)");
    sun.addColorStop(0.22, "rgba(255, 224, 152, 0.86)");
    sun.addColorStop(0.65, "rgba(245, 165, 98, 0.25)");
    sun.addColorStop(1, "rgba(245, 165, 98, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 40, w, 320);

    // Distant headland silhouette
    ctx.fillStyle = "#5b4d56";
    ctx.beginPath();
    ctx.moveTo(0, 338);
    ctx.bezierCurveTo(180, 312, 340, 326, w, 334);
    ctx.lineTo(w, 346);
    ctx.lineTo(0, 346);
    ctx.closePath();
    ctx.fill();

    // Evening sea reflection with crisp fine horizontal ripples to showcase bezel Snell bending
    const sea = ctx.createLinearGradient(0, 338, 0, 520);
    sea.addColorStop(0, "#b9876e");
    sea.addColorStop(0.45, "#595e74");
    sea.addColorStop(1, "#2a3347");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 338, w, 182);

    for (let r = 0; r < 22; r++) {
      const ry = 346 + r * 7.5;
      const rw = 240 - r * 5 + (r % 3) * 28;
      ctx.fillStyle = `rgba(255, 228, 178, ${Math.max(0.08, 0.44 - r * 0.015)})`;
      ctx.fillRect(w * 0.52 - rw * 0.5 + ((r % 2) * 10 - 5), ry, rw, 1.8);
    }

    // Zone 2 (520..1040px): High-Contrast Editorial Typography & Plain White Comparison Card
    ctx.fillStyle = "#f7f4ec";
    ctx.fillRect(0, 520, w, 285);

    ctx.fillStyle = "#18181b";
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText("OPTICAL FIELD NOTE", 56, 566);
    ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText("Lensing Over Structured Typography", 56, 604);

    ctx.strokeStyle = "rgba(24, 24, 27, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, 624);
    ctx.lineTo(w - 56, 624);
    ctx.stroke();

    ctx.fillStyle = "#27272a";
    ctx.font = '400 18px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    [
      "Curved superellipse bezels bend high-frequency typography cleanly",
      "along perimeter normals while leaving center glyphs razor-sharp.",
      "High edge variance (σ_Y) automatically deepens grounding shadow.",
    ].forEach((line, idx) => {
      ctx.fillText(line, 56, 660 + idx * 32);
    });

    // Pure white card zone (805..1040px): uniform zero variance so adaptive grounding shadow lightens
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 805, w, 235);
    ctx.fillStyle = "#94a3b8";
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText("Plain White Card Zone — Low Edge Variance (Lightened Shadow)", 168, 928);

    // Zone 3 (1040..1600px): Deep Starry Night & Nebula
    const night = ctx.createLinearGradient(0, 1040, 0, h);
    night.addColorStop(0, "#10192d");
    night.addColorStop(0.28, "#080d1b");
    night.addColorStop(0.7, "#0b152a");
    night.addColorStop(1, "#04060d");
    ctx.fillStyle = night;
    ctx.fillRect(0, 1040, w, h - 1040);

    const nebula = ctx.createRadialGradient(w * 0.62, 1290, 20, w * 0.62, 1290, 310);
    nebula.addColorStop(0, "rgba(79, 124, 224, 0.22)");
    nebula.addColorStop(0.55, "rgba(56, 86, 168, 0.08)");
    nebula.addColorStop(1, "rgba(8, 13, 27, 0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 1040, w, h - 1040);

    for (let s = 0; s < 140; s++) {
      const sx = (s * 173 + 37) % w;
      const sy = 1070 + ((s * 97) % 480);
      const sr = (s % 4) * 0.45 + 0.55;
      ctx.fillStyle = s % 9 === 0 ? "rgba(186, 220, 255, 0.88)" : `rgba(235, 244, 255, ${0.35 + (s % 5) * 0.12})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.fillText("Utilities (High-Contrast Text)", 56, 106);
    ["Favorites", "Hidden", "Recently Deleted", "Duplicates", "Receipts", "Handwriting"].forEach((label, idx) => {
      const y = 158 + idx * 72;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(52, y - 32, w - 104, 54);
      ctx.fillStyle = "#0f172a";
      ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.fillText(label, 76, y + 2);
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.fillText("Plain White Region — Adaptive Shadow Lightens", 185, 1140);
  }
}

function stepMagnifierSpring(s: { value: number; speed: number }, target: number, dt: number): void {
  s.speed += (150 * (target - s.value) - 19 * s.speed) * dt;
  s.value += s.speed * dt;
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "section";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  sec.append(h2, ...children);
  return sec;
}

function optionPills(options: string[], initial: string, onSelect: (opt: string) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "options";
  let active = initial;
  const btns = options.map((opt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = opt;
    b.setAttribute("aria-pressed", String(opt === active));
    b.addEventListener("click", () => {
      active = opt;
      btns.forEach((el, idx) => el.setAttribute("aria-pressed", String(options[idx] === active)));
      onSelect(opt);
    });
    return b;
  });
  wrap.append(...btns);
  return wrap;
}

function codeBlock(initial = ""): { pre: HTMLPreElement; set(text: string): void } {
  const pre = document.createElement("pre");
  pre.className = "code-block";
  const code = document.createElement("code");
  code.textContent = initial;
  pre.appendChild(code);
  return {
    pre,
    set(text: string) {
      code.textContent = text;
    },
  };
}

function mountApp(): void {
  const root = document.getElementById("app")!;
  document.documentElement.setAttribute("data-theme", "dark");

  const main = document.createElement("main");
  main.className = "standalone";
  root.appendChild(main);

  // 1. 3D Specular Beveled SVG Glass Header
  const titleHeading = document.createElement("h1");
  titleHeading.className = "title-wrap";
  titleHeading.innerHTML = `
    <svg class="title-glass" aria-hidden="true" focusable="false">
      <defs>
        <text id="trueglass-title-lettering" x="0" y="1">TrueGlass</text>
        <linearGradient id="trueglass-title-face" x1="0" y1="0" x2="0.7" y2="1">
          <stop stop-color="#edf5ff" stop-opacity="0.78"/>
          <stop offset="0.32" stop-color="#c4d1e3" stop-opacity="0.44"/>
          <stop offset="0.62" stop-color="#a6b5ce" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#e3efff" stop-opacity="0.68"/>
        </linearGradient>
        <linearGradient id="trueglass-title-rim" x1="0" y1="0" x2="0.6" y2="1">
          <stop stop-color="#fff" stop-opacity="0.96"/>
          <stop offset="0.3" stop-color="#dae6f6" stop-opacity="0.62"/>
          <stop offset="0.55" stop-color="#9eafc7" stop-opacity="0.18"/>
          <stop offset="0.78" stop-color="#e0ebfa" stop-opacity="0.42"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0.92"/>
        </linearGradient>
        <filter id="trueglass-title-bevel" x="-10%" y="-20%" width="120%" height="150%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.75" result="surface"/>
          <feSpecularLighting in="surface" surfaceScale="2.5" specularConstant="0.9" specularExponent="24" lighting-color="#f5f9ff" result="reflection">
            <feDistantLight azimuth="225" elevation="45"/>
          </feSpecularLighting>
          <feComposite in="reflection" in2="SourceAlpha" operator="in" result="bevel"/>
          <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="bevel"/></feMerge>
        </filter>
        <filter id="trueglass-title-edge" x="-10%" y="-20%" width="120%" height="150%" color-interpolation-filters="sRGB">
          <feMorphology in="SourceAlpha" operator="erode" radius="0.55" result="interior"/>
          <feComposite in="SourceAlpha" in2="interior" operator="out" result="rim"/>
          <feComposite in="SourceGraphic" in2="rim" operator="in"/>
        </filter>
      </defs>
      <use href="#trueglass-title-lettering" fill="url(#trueglass-title-face)" filter="url(#trueglass-title-bevel)"/>
      <use href="#trueglass-title-lettering" fill="url(#trueglass-title-rim)" filter="url(#trueglass-title-edge)"/>
    </svg><span class="title-text">TrueGlass</span>
  `;

  const intro = document.createElement("p");
  intro.className = "intro";
  intro.textContent =
    "Zero-dependency TypeScript implementation of physically-based TrueGlass for the web — combining stand-in lens refraction, Snell’s law squircle bezels, chromatic dispersion, live tilt lighting, Clear ↔ Tinted continuum, Materialize-by-Bending, and adaptive luminance sensing.";

  const linksRow = document.createElement("div");
  linksRow.className = "links-row";
  linksRow.innerHTML = `
    <span class="chip"><strong>~22.3 KiB</strong> gzipped Core Engine</span>
    <span class="chip">Runtime Deps: <strong>0</strong></span>
    <span class="chip">Pipeline: <strong>Snell Bezel + WebGL2 + sRGB SVG</strong></span>
  `;

  main.append(titleHeading, intro, linksRow);

  // 2. Refraction: 2D Pannable Fluid Wave Stage
  let stageScheme: "light" | "dark" = "dark";
  const stageEl = document.createElement("div");
  stageEl.className = "stage";
  stageEl.setAttribute("data-theme", stageScheme);

  const scroller = document.createElement("div");
  scroller.className = "scroller";
  const wallpapers = document.createElement("div");
  wallpapers.className = "wallpapers";
  wallpapers.setAttribute("data-fluid-backdrop", "");

  const imgLight = document.createElement("img");
  imgLight.src = "/img/fluid-light.webp";
  imgLight.alt = "";
  imgLight.draggable = false;

  const imgDark = document.createElement("img");
  imgDark.className = "wallpaper-dark";
  imgDark.src = "/img/fluid-dark.webp";
  imgDark.alt = "";
  imgDark.draggable = false;
  wallpapers.append(imgLight, imgDark);
  scroller.appendChild(wallpapers);

  const centerScrollerIfNeeded = () => {
    if (scroller.scrollLeft === 0 && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) * 0.325;
      scroller.scrollTop = scroller.scrollHeight * 0.3;
    }
    refitAllGlass();
  };
  imgLight.addEventListener("load", centerScrollerIfNeeded);
  imgDark.addEventListener("load", () => refitAllGlass());

  const stageOverlay = document.createElement("div");
  stageOverlay.className = "overlay";

  const stageTabBar = createTabBar({
    ariaLabel: "Library",
    items: TAB_CHOICES,
    value: "radio",
  });
  const stageRow = document.createElement("div");
  stageRow.className = "stage-row";
  const stageShare = createButton({ iconHtml: iconSvg(ICON_PATHS.share), iconOnly: true, ariaLabel: "Share" });
  const stageContinue = createButton({ label: "Continue" });
  stageRow.append(stageShare.element, stageContinue.element);

  const stageSlider = createSlider({ ariaLabel: "Volume", value: 60, className: "stage-slider" });
  const stageSearch = createSearchField({ placeholder: "Search", ariaLabel: "Search", className: "stage-search" });
  stageOverlay.append(stageTabBar.element, stageRow, stageSlider.element, stageSearch.element);

  const stageThemeCtrl = document.createElement("div");
  stageThemeCtrl.className = "stage-theme";
  const sunSpan = document.createElement("span");
  sunSpan.innerHTML = sunOrMoonSvg(false);
  const moonSpan = document.createElement("span");
  moonSpan.innerHTML = sunOrMoonSvg(true);
  const themeSwitch = createSwitch({
    ariaLabel: "Dark appearance",
    checked: true,
    onChange(dark) {
      stageScheme = dark ? "dark" : "light";
      stageEl.setAttribute("data-theme", stageScheme);
      refitAllGlass();
    },
  });
  stageThemeCtrl.append(sunSpan, themeSwitch.element, moonSpan);
  stageEl.append(scroller, stageOverlay, stageThemeCtrl);

  // Panning physics for the interactive backdrop viewport
  requestAnimationFrame(() => {
    scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) * 0.325;
    scroller.scrollTop = scroller.scrollHeight * 0.3;
  });
  let panState: { id: number; x: number; y: number; left: number; top: number } | null = null;
  scroller.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    panState = { id: e.pointerId, x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
    scroller.setPointerCapture(e.pointerId);
    scroller.dataset.dragging = "";
  });
  scroller.addEventListener("pointermove", (e) => {
    if (e.pointerId !== panState?.id) return;
    scroller.scrollLeft = panState.left - (e.clientX - panState.x);
    scroller.scrollTop = panState.top - (e.clientY - panState.y);
  });
  const endPan = (e: PointerEvent) => {
    if (e.pointerId !== panState?.id) return;
    panState = null;
    delete scroller.dataset.dragging;
  };
  scroller.addEventListener("pointerup", endPan);
  scroller.addEventListener("pointercancel", endPan);

  const stageCaption = document.createElement("p");
  stageCaption.className = "caption";
  stageCaption.textContent = "Drag the Fluid silk-wave wallpaper under the glass, or hold the tabs, slider or switch to lift them into lenses.";
  main.appendChild(section("Refraction (2D Interactive Fluid Stage)", stageEl, stageCaption));

  // 3. Interactive Glass Magnifier (Magnifier + Clear<->Tinted + Tilt)
  const magnifierBox = document.createElement("div");
  magnifierBox.className = "magnifier";

  const magScene = document.createElement("div");
  magScene.className = "scene";
  magScene.setAttribute("data-fluid-backdrop", "");

  const magImg = document.createElement("img");
  magImg.src = "/img/fluid-magnifier.webp";
  magImg.alt = "";
  magImg.draggable = false;

  const magText = document.createElement("p");
  magText.className = "magnifier-text";
  magText.setAttribute("aria-hidden", "true");
  magText.innerHTML = "True<br/>Glass";
  magScene.append(magImg, magText);

  const lensGlass = createGlass({ className: "lens" });
  lensGlass.element.style.setProperty("--lg-glass-bend", "0.45");
  lensGlass.element.style.setProperty("--lg-glass-dispersion", "0.4");
  lensGlass.element.style.setProperty("--lg-blur", "0px");
  lensGlass.element.style.setProperty("--lg-rim-shine", "0.13");
  magnifierBox.append(magScene, lensGlass.element);

  // 4-substep velocity deformation spring physics for the draggable pill
  let magPos = { x: 240, y: 180 };
  let magPrev = { ...magPos };
  const magVel = { x: 0, y: 0 };
  const magHover = { value: 0, speed: 0 };
  const magDx = { value: 0, speed: 0 };
  const magDy = { value: 0, speed: 0 };
  let magGrabbed = false;
  let magPointer: { id: number; dx: number; dy: number } | null = null;
  let magRaf = 0;
  let magLast = 0;

  const paintMag = () => {
    const e = magHover.value;
    const sx = (1 + 0.08 * 0.2 * magHover.speed) * (1 + magDx.value) * (1 - magDy.value);
    const sy = (0.8 + 0.2 * e) * (1 + magDy.value) * (1 - magDx.value);
    lensGlass.element.style.transform = `translate(${magPos.x - 105}px, ${magPos.y - 75}px) scale(${sx}, ${sy})`;
    lensGlass.element.style.boxShadow =
      `${4 * e}px ${4 + 12 * e}px ${9 + 15 * e}px rgb(0 0 0 / ${0.16 + 0.06 * e}), ` +
      `inset ${2 * e}px ${2 + 6 * e}px 24px rgb(0 0 0 / ${0.2 + 0.07 * e}), ` +
      `inset ${-2 * e}px ${-2 - 6 * e}px 24px rgb(255 255 255 / ${0.2 + 0.07 * e})`;
  };

  const stepMag = (now: number) => {
    const dt = Math.min(1 / 30, (now - magLast) / 1000) || 1 / 60;
    magLast = now;
    magVel.x += ((magPos.x - magPrev.x) / dt - magVel.x) * Math.min(1, 20 * dt);
    magVel.y += ((magPos.y - magPrev.y) / dt - magVel.y) * Math.min(1, 20 * dt);
    magPrev.x = magPos.x;
    magPrev.y = magPos.y;
    for (let i = 0; i < 4; i++) {
      stepMagnifierSpring(magHover, magGrabbed ? 1 : 0, dt / 4);
      stepMagnifierSpring(magDx, Math.min(0.3, 18e-5 * Math.abs(magVel.x)), dt / 4);
      stepMagnifierSpring(magDy, Math.min(0.3, 18e-5 * Math.abs(magVel.y)), dt / 4);
    }
    paintMag();
    const settled =
      !magPointer &&
      Math.abs(magHover.speed) < 0.001 &&
      Math.abs(magDx.speed) < 0.001 &&
      Math.abs(magDy.speed) < 0.001 &&
      Math.abs(magHover.value - (magGrabbed ? 1 : 0)) < 0.001 &&
      Math.abs(magDx.value) + Math.abs(magDy.value) < 0.001;
    magRaf = settled ? 0 : requestAnimationFrame(stepMag);
  };

  const wakeMag = () => {
    if (!magRaf) {
      magLast = performance.now();
      magRaf = requestAnimationFrame(stepMag);
    }
  };

  requestAnimationFrame(() => {
    if (magnifierBox.clientWidth > 0) {
      magPos = { x: magnifierBox.clientWidth * 0.5, y: magnifierBox.clientHeight * 0.5 };
      magPrev = { ...magPos };
    }
    paintMag();
  });
  magImg.addEventListener("load", () => {
    if (magnifierBox.clientWidth > 0) {
      magPos = { x: magnifierBox.clientWidth * 0.5, y: magnifierBox.clientHeight * 0.5 };
      magPrev = { ...magPos };
      paintMag();
    }
    lensGlass.refit();
    refitAllGlass();
  });

  lensGlass.element.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    const rect = magnifierBox.getBoundingClientRect();
    magPointer = { id: e.pointerId, dx: e.clientX - rect.left - magPos.x, dy: e.clientY - rect.top - magPos.y };
    lensGlass.element.setPointerCapture(e.pointerId);
    magGrabbed = true;
    wakeMag();
  });
  lensGlass.element.addEventListener("pointermove", (e) => {
    if (e.pointerId !== magPointer?.id) return;
    const rect = magnifierBox.getBoundingClientRect();
    magPos.x = Math.min(rect.width, Math.max(0, e.clientX - rect.left - magPointer.dx));
    magPos.y = Math.min(rect.height, Math.max(0, e.clientY - rect.top - magPointer.dy));
    wakeMag();
  });
  const releaseMag = (e: PointerEvent) => {
    if (e.pointerId !== magPointer?.id) return;
    magPointer = null;
    magGrabbed = false;
    wakeMag();
  };
  lensGlass.element.addEventListener("pointerup", releaseMag);
  lensGlass.element.addEventListener("pointercancel", releaseMag);

  // Settings Sliders below Magnifier
  const settingsWrap = document.createElement("div");
  settingsWrap.className = "settings";
  let autoTilt = false;

  const addOpticalSlider = (
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    unit: string,
    onChange: (v: number) => void,
  ) => {
    const row = document.createElement("label");
    row.className = "setting";
    const nameEl = document.createElement("span");
    nameEl.textContent = label;
    const valEl = document.createElement("span");
    valEl.textContent = `${initial}${unit}`;
    const sl = createSlider({
      ariaLabel: label,
      min,
      max,
      step,
      value: initial,
      onInput: (v) => {
        valEl.textContent = `${Number.isInteger(step) ? v : v.toFixed(2)}${unit}`;
        onChange(v);
      },
    });
    row.append(nameEl, sl.element, valEl);
    settingsWrap.appendChild(row);
    return { sl, valEl };
  };

  addOpticalSlider("Bend", 0, 1, 0.01, 0.45, "", (v) => {
    lensGlass.element.style.setProperty("--lg-glass-bend", String(v));
    lensGlass.refit();
  });
  addOpticalSlider("Dispersion", 0, 2, 0.05, 0.4, "", (v) => {
    lensGlass.element.style.setProperty("--lg-glass-dispersion", String(v));
    lensGlass.refit();
  });
  addOpticalSlider("Frost", 0, 12, 0.5, 0, "px", (v) => {
    lensGlass.element.style.setProperty("--lg-blur", `${v}px`);
    lensGlass.refit();
  });
  addOpticalSlider("Rim", 0, 1, 0.01, 0.13, "", (v) => {
    lensGlass.element.style.setProperty("--lg-rim-shine", String(v));
    lensGlass.refit();
  });
  addOpticalSlider("Clear ↔ Tinted", 0, 1, 0.01, 0, "", (v) => {
    document.documentElement.style.setProperty("--lg-tint-amount", String(v));
    lensGlass.element.style.backgroundColor = v > 0 ? `rgb(255 255 255 / ${(v * 0.28).toFixed(2)})` : "";
    refitAllGlass();
  });

  const tiltCtrl = addOpticalSlider("Light Tilt", -180, 180, 5, -135, "°", (v) => {
    autoTilt = false;
    tiltModeSwitch.setChecked(false);
    tiltModeState.textContent = "Off";
    document.documentElement.style.setProperty("--lg-light-angle", String(v));
    refitAllGlass();
  });

  const tiltModeRow = document.createElement("div");
  tiltModeRow.className = "setting";
  const tiltModeLabel = document.createElement("span");
  tiltModeLabel.textContent = "Pointer Tilt Light";
  const tiltModeState = document.createElement("span");
  tiltModeState.textContent = "Off";
  const tiltModeSwitch = createSwitch({
    ariaLabel: "Pointer Tilt Light",
    checked: false,
    onChange(on) {
      autoTilt = on;
      tiltModeState.textContent = on ? "On" : "Off";
      if (!on) {
        document.documentElement.style.removeProperty("--lg-light-angle");
        tiltCtrl.sl.setValue(-135);
        tiltCtrl.valEl.textContent = "-135°";
        refitAllGlass();
      }
    },
  });
  tiltModeRow.append(tiltModeLabel, tiltModeSwitch.element, tiltModeState);
  settingsWrap.appendChild(tiltModeRow);

  let tiltRefitQueued = false;
  attachVirtualTiltLight((deg) => {
    if (!autoTilt) return;
    const rounded = Math.round(deg);
    document.documentElement.style.setProperty("--lg-light-angle", String(rounded));
    tiltCtrl.sl.setValue(rounded);
    tiltCtrl.valEl.textContent = `${rounded}°`;
    if (!tiltRefitQueued) {
      tiltRefitQueued = true;
      requestAnimationFrame(() => {
        tiltRefitQueued = false;
        refitAllGlass();
      });
    }
  });

  main.appendChild(section("Glass Magnifier & Optical Controls", magnifierBox, settingsWrap));

  // 3b. Shared Glass Container (C2 sminCubic Droplet Fusion & Cross-Sibling Light Bleed)
  const dropletSettings = document.createElement("div");
  dropletSettings.className = "settings";

  const addDropletSlider = (
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    unit: string,
    onChange: (v: number) => void,
  ) => {
    const row = document.createElement("label");
    row.className = "setting";
    const nameEl = document.createElement("span");
    nameEl.textContent = label;
    const valEl = document.createElement("span");
    valEl.textContent = `${initial}${unit}`;
    const sl = createSlider({
      ariaLabel: label,
      min,
      max,
      step,
      value: initial,
      onInput: (v) => {
        valEl.textContent = `${v}${unit}`;
        onChange(v);
      },
    });
    row.append(nameEl, sl.element, valEl);
    dropletSettings.appendChild(row);
    return { sl, valEl };
  };

  let gapCtrl!: { sl: ReturnType<typeof createSlider>; valEl: HTMLSpanElement };
  const dropletContainer = createGlassContainer({
    childrenVariants: ["regular", "regular"],
    backdropSrc: "/img/fluid-dark.webp",
    gap: 8,
    smoothK: 34,
    tint: 0.08,
    ariaLabel: "Shared Fluid Glass Droplet Container",
    onGapChange(g) {
      gapCtrl.sl.setValue(g);
      gapCtrl.valEl.textContent = `${g}px`;
    },
  });

  gapCtrl = addDropletSlider("Droplet Gap", -16, 64, 1, 8, "px", (v) => {
    dropletContainer.setGap(v);
  });
  const smoothKCtrl = addDropletSlider("Fusion Bridge k", 0, 56, 1, 34, "px", (v) => {
    dropletContainer.setSmoothK(v);
  });

  const dropletPresets = optionPills(
    ["Kissing Bridge (8px)", "Deep Fusion (-10px)", "Separated (42px)"],
    "Kissing Bridge (8px)",
    (opt) => {
      const nextGap = opt.includes("-10") ? -10 : opt.includes("42") ? 42 : 8;
      const nextK = opt.includes("42") ? 20 : 34;
      dropletContainer.setGap(nextGap);
      dropletContainer.setSmoothK(nextK);
      gapCtrl.sl.setValue(nextGap);
      gapCtrl.valEl.textContent = `${nextGap}px`;
      smoothKCtrl.sl.setValue(nextK);
      smoothKCtrl.valEl.textContent = `${nextK}px`;
    },
  );
  const dropletCaption = document.createElement("p");
  dropletCaption.className = "caption";
  dropletCaption.textContent =
    "One shared backdrop pass evaluates both controls via C2 cubic smooth-min (sminCubic). Drag the Search orb horizontally or press either pill to see chromatic neck bending and cross-sibling touch glow.";

  main.appendChild(
    section(
      "Shared Glass Container (Droplet Fusion & Light Bleed)",
      dropletContainer.element,
      dropletSettings,
      dropletPresets,
      dropletCaption,
    ),
  );

  // 4. Button Section (with Material Variants + Materialize by Bending)
  const btnDemo = document.createElement("div");
  btnDemo.className = "demo row";
  let currentBtnVariant: "glass" | "filled" = "glass";
  let currentBtnTint: string | undefined;
  let currentBtnDestructive = false;
  let currentBtnMaterial: GlassMaterial = "regular";
  let currentBtnScrim = false;

  const iconBtnSlot = document.createElement("span");
  const textBtnSlot = document.createElement("span");
  let btnIconHandle = createButton({ iconHtml: iconSvg(ICON_PATHS.share), iconOnly: true, ariaLabel: "Share" });
  let btnTextHandle = createButton({ label: "Continue" });
  const matTrigger = createButton({
    label: "Materialize",
    variant: "glass",
    onClick: () => {
      btnIconHandle.materialize(false);
      btnTextHandle.materialize(false);
      materializeAllGlass();
    },
  });
  iconBtnSlot.appendChild(btnIconHandle.element);
  textBtnSlot.appendChild(btnTextHandle.element);
  btnDemo.append(iconBtnSlot, textBtnSlot, matTrigger.element);

  const btnCode = codeBlock(`<Button icon={<ShareIcon />} aria-label="Share" />\n<Button>Continue</Button>`);
  const updateButtonCode = (iconName: string, label: string) => {
    const props = `${currentBtnVariant === "filled" ? ' variant="filled"' : ""}${currentBtnMaterial !== "regular" ? ` material="${currentBtnMaterial}"` : ""}${currentBtnScrim ? " dimmingScrim" : ""}${currentBtnDestructive ? " destructive" : ""}${currentBtnTint ? ` tint="${currentBtnTint}"` : ""}`;
    btnCode.set(`<Button icon={<${iconName} />} aria-label="${label}"${props} />\n<Button${props}>${label}</Button>`);
  };
  let lastIconName = "ShareIcon";
  let lastLabel = "Continue";

  const rebuildButtons = (opt: string) => {
    btnIconHandle.destroy();
    btnTextHandle.destroy();
    iconBtnSlot.innerHTML = "";
    textBtnSlot.innerHTML = "";
    currentBtnDestructive = opt.startsWith("Destructive");
    currentBtnVariant = opt.toLowerCase().endsWith("filled") ? "filled" : "glass";
    currentBtnTint = opt.startsWith("Tinted") ? "#ff8d28" : undefined;
    const icon = currentBtnDestructive ? ICON_PATHS.trash : opt.startsWith("Tinted") ? ICON_PATHS.heart : ICON_PATHS.share;
    lastLabel = currentBtnDestructive ? "Delete" : opt.startsWith("Tinted") ? "Favorite" : "Continue";
    lastIconName = currentBtnDestructive ? "TrashIcon" : opt.startsWith("Tinted") ? "HeartIcon" : "ShareIcon";
    btnIconHandle = createButton({
      iconHtml: iconSvg(icon),
      iconOnly: true,
      ariaLabel: lastLabel,
      variant: currentBtnVariant,
      material: currentBtnMaterial,
      dimmingScrim: currentBtnScrim,
      destructive: currentBtnDestructive,
      tint: currentBtnTint,
    });
    btnTextHandle = createButton({
      label: lastLabel,
      variant: currentBtnVariant,
      material: currentBtnMaterial,
      dimmingScrim: currentBtnScrim,
      destructive: currentBtnDestructive,
      tint: currentBtnTint,
    });
    iconBtnSlot.appendChild(btnIconHandle.element);
    textBtnSlot.appendChild(btnTextHandle.element);
    updateButtonCode(lastIconName, lastLabel);
  };

  const materialPills = optionPills(
    ["Regular", "Clear", "Clear + 35% Scrim", "Identity (Off)", "Dematerialize", "Materialize"],
    "Regular",
    (opt) => {
      if (opt === "Dematerialize") {
        btnIconHandle.dematerialize(false);
        btnTextHandle.dematerialize(false);
        return;
      }
      if (opt === "Materialize") {
        btnIconHandle.materialize(false);
        btnTextHandle.materialize(false);
        return;
      }
      currentBtnMaterial = opt.startsWith("Clear") ? "clear" : opt.startsWith("Identity") ? "identity" : "regular";
      currentBtnScrim = opt.includes("35% Scrim");
      btnIconHandle.materialize(true);
      btnTextHandle.materialize(true);
      btnIconHandle.setMaterial(currentBtnMaterial, currentBtnScrim);
      btnTextHandle.setMaterial(currentBtnMaterial, currentBtnScrim);
      updateButtonCode(lastIconName, lastLabel);
    },
  );

  main.appendChild(
    section(
      "Button",
      btnDemo,
      optionPills(["Glass", "Filled", "Tinted", "Tinted filled", "Destructive", "Destructive filled"], "Glass", rebuildButtons),
      materialPills,
      btnCode.pre,
    ),
  );

  // 5. Tab bar
  const tabDemo = document.createElement("div");
  tabDemo.className = "demo";
  const tabCode = codeBlock();
  let curTab = "radio";
  let curLift = 16;
  const demoTabs = createTabBar({
    ariaLabel: "Library",
    items: TAB_CHOICES,
    value: curTab,
    onChange(v) {
      curTab = v;
      updateTabCode();
    },
  });
  const applyLift = (y: number) => {
    curLift = y;
    demoTabs.element.style.setProperty("--lg-lens-grow-x", `${Math.round(1.5 * y)}px`);
    demoTabs.element.style.setProperty("--lg-lens-grow-y", `${y}px`);
    updateTabCode();
  };
  const updateTabCode = () => {
    tabCode.set(`<TabBar aria-label="Library" value="${curTab}"${curLift === 16 ? "" : ` style={{ "--lg-lens-grow-x": "${Math.round(1.5 * curLift)}px", "--lg-lens-grow-y": "${curLift}px" }}`} />`);
  };
  applyLift(16);
  tabDemo.appendChild(demoTabs.element);
  const liftRow = document.createElement("label");
  liftRow.className = "setting";
  const liftVal = document.createElement("span");
  liftVal.textContent = "16px";
  const liftSlider = createSlider({
    ariaLabel: "Lift",
    min: 0,
    max: 36,
    step: 1,
    value: 16,
    onInput: (v) => {
      liftVal.textContent = `${v}px`;
      applyLift(v);
    },
  });
  liftRow.append(Object.assign(document.createElement("span"), { textContent: "Lift" }), liftSlider.element, liftVal);
  main.appendChild(section("Tab bar", tabDemo, liftRow, tabCode.pre));

  // 6. Segmented control
  const segDemo = document.createElement("div");
  segDemo.className = "demo";
  const segCode = codeBlock('<SegmentedControl aria-label="Range" value="week" />');
  const seg = createSegmentedControl({
    ariaLabel: "Range",
    value: "week",
    items: [
      { value: "day", label: "Day" },
      { value: "week", label: "Week" },
      { value: "month", label: "Month" },
    ],
    onChange: (v) => segCode.set(`<SegmentedControl aria-label="Range" value="${v}" />`),
  });
  segDemo.appendChild(seg.element);
  main.appendChild(section("Segmented control", segDemo, segCode.pre));

  // 7. Menu (morphing trigger-to-card + scrubbing)
  const menuDemo = document.createElement("div");
  menuDemo.className = "demo";
  const menuCode = codeBlock('<Menu aria-label="Options" items={[...]} />');
  const demoMenu = createMenu({
    ariaLabel: "Options",
    align: "start",
    items: [
      { label: "Pin", iconHtml: iconSvg(ICON_PATHS.pin), onSelect: () => menuCode.set('<Menu aria-label="Options" /> // chose Pin') },
      { label: "Rename", iconHtml: iconSvg(ICON_PATHS.pencil), onSelect: () => menuCode.set('<Menu aria-label="Options" /> // chose Rename') },
      { label: "Duplicate", iconHtml: iconSvg(ICON_PATHS.copy), onSelect: () => menuCode.set('<Menu aria-label="Options" /> // chose Duplicate') },
      { type: "separator" },
      { label: "Delete", iconHtml: iconSvg(ICON_PATHS.trash), destructive: true, onSelect: () => menuCode.set('<Menu aria-label="Options" /> // chose Delete') },
    ],
  });
  menuDemo.appendChild(demoMenu.element);
  main.appendChild(section("Menu", menuDemo, menuCode.pre));

  // 8. Input
  const inputDemo = document.createElement("div");
  inputDemo.className = "demo";
  const demoSearch = createSearchField({ placeholder: "Search", ariaLabel: "Search" });
  inputDemo.appendChild(demoSearch.element);
  main.appendChild(
    section(
      "Input",
      inputDemo,
      optionPills(["Default", "Disabled"], "Default", (opt) => demoSearch.setDisabled(opt === "Disabled")),
    ),
  );

  // 9. Slider
  const sliderDemo = document.createElement("div");
  sliderDemo.className = "demo";
  const demoSlider = createSlider({ ariaLabel: "Volume", value: 40, className: "demo-slider" });
  sliderDemo.appendChild(demoSlider.element);
  main.appendChild(
    section(
      "Slider",
      sliderDemo,
      optionPills(["Continuous", "Stepped", "Disabled"], "Continuous", (opt) => {
        demoSlider.setDisabled(opt === "Disabled");
        demoSlider.setStep(opt === "Stepped" ? 10 : 1);
      }),
    ),
  );

  // 10. Switch
  const switchDemo = document.createElement("div");
  switchDemo.className = "demo";
  const demoSwitch = createSwitch({ ariaLabel: "Wi-Fi", checked: true });
  switchDemo.appendChild(demoSwitch.element);
  main.appendChild(
    section(
      "Switch",
      switchDemo,
      optionPills(["Default", "Disabled"], "Default", (opt) => demoSwitch.setDisabled(opt === "Disabled")),
    ),
  );

  // 10b. Hardware Concentricity & Accessibility Fallbacks
  const concentricStage = document.createElement("div");
  concentricStage.className = "concentric-stage";
  concentricStage.setAttribute("data-theme", "dark");
  const concentricBg = document.createElement("img");
  concentricBg.className = "concentric-backdrop";
  concentricBg.src = "/img/fluid-dark.webp";
  concentricBg.alt = "";
  concentricBg.setAttribute("data-fluid-backdrop", "");

  const rOuter = 28;
  const rMid = concentricRadius(rOuter, 8);
  const rInner = concentricRadius(rMid, 6);

  const concentricOuter = createGlass({ className: "concentric-outer" });
  concentricOuter.element.style.borderRadius = `${rOuter}px`;
  const concentricMid = document.createElement("div");
  concentricMid.className = "concentric-mid";
  concentricMid.style.borderRadius = `${rMid}px`;

  const concentricMeta = document.createElement("span");
  concentricMeta.className = "concentric-meta";
  concentricMeta.textContent = `Outer ${rOuter}px → Group ${rMid}px → Action ${rInner}px`;

  const concentricInner = document.createElement("span");
  concentricInner.className = "concentric-inner";
  concentricInner.style.borderRadius = `${rInner}px`;
  concentricInner.textContent = "Flat Fill Inside Glass";

  concentricMid.append(concentricMeta, concentricInner);
  concentricOuter.element.appendChild(concentricMid);
  concentricStage.append(concentricBg, concentricOuter.element);

  const concentricPills = optionPills(
    ["Standard Optics", "Reduce Transparency", "Increase Contrast", "Reduce Motion"],
    "Standard Optics",
    (opt) => {
      setAccessibilityModes({
        reduceTransparency: opt === "Reduce Transparency",
        increaseContrast: opt === "Increase Contrast",
        reduceMotion: opt === "Reduce Motion",
      });
      refitAllGlass();
    },
  );
  const concentricCaption = document.createElement("p");
  concentricCaption.className = "caption";
  concentricCaption.textContent =
    "Nested squircles follow concentricRadius(outer, pad) = max(0, outer - pad). Inner surfaces use flat vibrant fills (never glass-on-glass); explicit accessibility toggles drive data-a11y-* overrides.";

  main.appendChild(
    section(
      "Concentric Squircle Architecture & Accessibility",
      concentricStage,
      concentricPills,
      concentricCaption,
    ),
  );

  // 11. Adaptive Luminance Sensor, Scroll Choreography, Snell Ray-Tracer & Kernel Benchmark
  const sunsetStage = document.createElement("div");
  sunsetStage.className = "sunset-stage";
  sunsetStage.setAttribute("data-theme", "light");
  sunsetStage.setAttribute("data-scroll-edge", "soft");
  sunsetStage.setAttribute("data-surface-size", "small");

  const sunsetScroller = document.createElement("div");
  sunsetScroller.className = "sunset-scroller";
  const sunsetContent = document.createElement("div");
  sunsetContent.setAttribute("data-fluid-backdrop", "");
  const sunsetCanvas = document.createElement("canvas");
  sunsetCanvas.className = "sunset-canvas";
  sunsetContent.appendChild(sunsetCanvas);
  sunsetScroller.appendChild(sunsetContent);
  paintSunsetNightCanvas(sunsetCanvas, "sunset-night");

  const sunsetScrollEdge = document.createElement("div");
  sunsetScrollEdge.className = "sunset-scroll-edge";

  const telBar = document.createElement("div");
  telBar.className = "telemetry-bar";
  const telPill = createGlass({ className: "telemetry-pill" });
  telPill.element.textContent = "Y=-- | σ=-- | Shadow=--";
  const jumpBtn = createButton({
    label: "Scroll to Night",
    onClick: () => {
      const deep = sunsetScroller.scrollTop > 650;
      sunsetScroller.scrollTo({ top: deep ? 0 : 1080, behavior: "smooth" });
    },
  });
  telBar.append(telPill.element, jumpBtn.element);

  const sunsetHud = document.createElement("div");
  sunsetHud.className = "sunset-hud";
  sunsetHud.dataset.minimized = "false";
  const sunsetNavRow = document.createElement("div");
  sunsetNavRow.className = "sunset-nav-row";
  const hudTabs = createTabBar({
    ariaLabel: "Photos Adaptive Bar",
    value: "library",
    items: [
      { value: "library", label: "Library", iconHtml: iconSvg(ICON_PATHS.home) },
      { value: "collections", label: "Collections", iconHtml: iconSvg(ICON_PATHS.library) },
    ],
  });
  const hudSearch = createButton({
    iconHtml: iconSvg(ICON_PATHS.search),
    iconOnly: true,
    ariaLabel: "Search Photos",
  });
  sunsetNavRow.append(hudTabs.element, hudSearch.element);
  sunsetHud.appendChild(sunsetNavRow);
  sunsetStage.append(sunsetScroller, sunsetScrollEdge, telBar, sunsetHud);

  const adaptiveSensor = attachAdaptiveBackdropSensor(
    sunsetStage,
    () => {
      const ratio = sunsetScroller.scrollTop / Math.max(1, sunsetCanvas.height - sunsetStage.clientHeight);
      const sy = Math.round(Math.min(0.92, Math.max(0.05, ratio * 0.72 + 0.14)) * sunsetCanvas.height);
      const ctx = sunsetCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      return analyzeBackdropPixels(ctx.getImageData(120, sy, 28, 12).data, 28, 12);
    },
    {
      intervalMs: 90,
      surfaceSize: "small",
      onSample(s: BackdropSample) {
        telPill.element.textContent = `Y=${s.luminance.toFixed(2)} | σ=${s.contrastVariance.toFixed(2)} | Shadow=${s.adaptiveShadowAlpha.toFixed(2)} | ${s.recommendedTheme.toUpperCase()}`;
      },
    },
  );
  sunsetScroller.addEventListener(
    "scroll",
    () => {
      const top = sunsetScroller.scrollTop;
      sunsetHud.dataset.minimized = top > 48 ? "true" : "false";
      jumpBtn.element.textContent = top > 650 ? "Scroll to Sunset" : "Scroll to Night";
      adaptiveSensor.update();
    },
    { passive: true },
  );
  requestAnimationFrame(() => adaptiveSensor.update());

  const rayCanvas = document.createElement("canvas");
  rayCanvas.className = "ray-canvas";
  let rayMode: "liquid" | "frosted" | "thick-menu" | "materialize" = "liquid";
  const paintRays = (bend = 1) =>
    drawCrossSectionRays(rayCanvas, {
      mode: rayMode,
      ior: 1.5,
      dispersion: 0.7,
      bezelDepth: 22,
      bendProgress: bend,
      thicknessScale: rayMode === "thick-menu" ? 1.9 : 1,
    });
  requestAnimationFrame(() => paintRays(1));

  const benchCard = document.createElement("div");
  benchCard.className = "bench-card";
  const benchBtn = createButton({
    label: "Run Kernel Benchmark",
    variant: "filled",
    onClick: () => {
      const res = benchmarkOptics(280, 56, 28, 24);
      benchOut.textContent = `Full-grid scan: ${res.fullGridScanMs.toFixed(2)}ms | TrueGlass kernel: ${res.fluidKernelMs.toFixed(2)}ms (${res.speedup}× faster, ${(res.pixelsSkippedRatio * 100).toFixed(0)}% interior skipped)`;
    },
  });
  const benchOut = document.createElement("div");
  benchOut.style.marginTop = "10px";
  benchOut.style.color = "#5eead4";
  benchCard.innerHTML = `
    <div style="margin-bottom:10px"><strong>Optical Kernel Benchmark (Flat-Interior-Skipping <code>Uint32Array</code> vs. Full-Grid Scan):</strong></div>
  `;
  benchCard.append(benchBtn.element, benchOut);

  let currentScene: "sunset-night" | "white-text" = "sunset-night";
  main.appendChild(
    section(
      "Adaptive Luminance Sensor, Snell Ray-Tracer & Kernel Benchmark",
      sunsetStage,
      optionPills(["Sunset → Night", "Text ↔ Plain White", "Soft Scroll Edge", "Hard Scroll Edge"], "Sunset → Night", (m) => {
        if (m === "Soft Scroll Edge") {
          sunsetStage.setAttribute("data-scroll-edge", "soft");
          return;
        }
        if (m === "Hard Scroll Edge") {
          sunsetStage.setAttribute("data-scroll-edge", "hard");
          return;
        }
        currentScene = m === "Sunset → Night" ? "sunset-night" : "white-text";
        paintSunsetNightCanvas(sunsetCanvas, currentScene);
        sunsetScroller.scrollTop = 0;
        sunsetHud.dataset.minimized = "false";
        adaptiveSensor.update();
      }),
      optionPills(
        ["Small Bar (Auto-Flip Polarity)", "Large Panel (Stable Polarity + Ambient Spill)"],
        "Small Bar (Auto-Flip Polarity)",
        (m) => {
          const isLarge = m.startsWith("Large");
          sunsetStage.setAttribute("data-surface-size", isLarge ? "large" : "small");
          adaptiveSensor.setSurfaceSize(isLarge ? "large" : "small");
        },
      ),
      rayCanvas,
      optionPills(["TrueGlass (Snell)", "Classic Frosted Blur", "2× Thick Menu", "Materialize Bending"], "TrueGlass (Snell)", (m) => {
        rayMode = m.startsWith("Classic") ? "frosted" : m.startsWith("2×") ? "thick-menu" : m.startsWith("Materialize") ? "materialize" : "liquid";
        if (rayMode === "materialize") {
          const t0 = performance.now();
          const anim = (now: number) => {
            const p = Math.min(1, (now - t0) / 1300);
            paintRays(p);
            if (p < 1) requestAnimationFrame(anim);
          };
          requestAnimationFrame(anim);
        } else {
          paintRays(1);
        }
      }),
      benchCard,
    ),
  );

  requestAnimationFrame(() => refitAllGlass());
  void stageEl;
  void createInput;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountApp);
  } else {
    mountApp();
  }
}
