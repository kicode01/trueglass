import {
  analyzeBackdropPixels,
  attachAdaptiveBackdropSensor,
  attachVirtualTiltLight,
  concentricRadius,
  createSpring,
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
  refitAllGlass,
  type GlassMaterial,
} from "./components";
import { mountGlassTitle } from "./glass-title";

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

const GITHUB_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.66.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.82-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/></svg>`;

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

const CANVAS_INTER = '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

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

    ctx.fillStyle = "#5b4d56";
    ctx.beginPath();
    ctx.moveTo(0, 338);
    ctx.bezierCurveTo(180, 312, 340, 326, w, 334);
    ctx.lineTo(w, 346);
    ctx.lineTo(0, 346);
    ctx.closePath();
    ctx.fill();

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
    ctx.font = `600 13px ${CANVAS_INTER}`;
    ctx.fillText("OPTICAL FIELD NOTE", 56, 566);
    ctx.font = `700 28px ${CANVAS_INTER}`;
    ctx.fillText("Lensing Over Structured Typography", 56, 604);

    ctx.strokeStyle = "rgba(24, 24, 27, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, 624);
    ctx.lineTo(w - 56, 624);
    ctx.stroke();

    ctx.fillStyle = "#27272a";
    ctx.font = `400 18px ${CANVAS_INTER}`;
    [
      "Curved superellipse bezels bend high-frequency typography cleanly",
      "along perimeter normals while leaving center glyphs razor-sharp.",
      "High edge variance (σ_Y) automatically deepens grounding shadow.",
    ].forEach((line, idx) => {
      ctx.fillText(line, 56, 660 + idx * 32);
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 805, w, 235);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 14px ${CANVAS_INTER}`;
    ctx.fillText("Plain White Card Zone — Low Edge Variance (Lightened Shadow)", 160, 928);

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
    ctx.font = `700 28px ${CANVAS_INTER}`;
    ctx.fillText("Utilities (High-Contrast Text)", 56, 106);
    ["Favorites", "Hidden", "Recently Deleted", "Duplicates", "Receipts", "Handwriting"].forEach((label, idx) => {
      const y = 158 + idx * 72;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(52, y - 32, w - 104, 54);
      ctx.fillStyle = "#0f172a";
      ctx.font = `600 19px ${CANVAS_INTER}`;
      ctx.fillText(label, 76, y + 2);
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 16px ${CANVAS_INTER}`;
    ctx.fillText("Plain White Region — Adaptive Shadow Lightens", 180, 1140);
  }
}

function stepMagnifierSpring(s: { value: number; speed: number }, target: number, dt: number): void {
  s.speed += (150 * (target - s.value) - 19 * s.speed) * dt;
  s.value += s.speed * dt;
}

function studioSection(
  id: string,
  title: string,
  description: string,
  badge: string,
  ...children: HTMLElement[]
): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "section";
  sec.id = id;
  const header = document.createElement("div");
  header.className = "section-header";
  const headText = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.textContent = title;
  headText.appendChild(h2);
  if (description) {
    const desc = document.createElement("p");
    desc.className = "section-desc";
    desc.textContent = description;
    headText.appendChild(desc);
  }
  header.appendChild(headText);
  if (badge) {
    const pill = createGlass({ tag: "span", className: "section-glass-pill" });
    pill.element.textContent = badge;
    header.appendChild(pill.element);
  }
  sec.append(header, ...children);
  return sec;
}

function studioCard(title: string, meta: string, ...children: HTMLElement[]): HTMLElement {
  const card = document.createElement("article");
  card.className = "studio-card";
  const head = document.createElement("div");
  head.className = "studio-card-head";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  const sub = document.createElement("span");
  sub.className = "studio-card-meta";
  sub.textContent = meta;
  head.append(h3, sub);
  card.append(head, ...children);
  return card;
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

function codeBlock(initial = ""): { wrap: HTMLDivElement; set(text: string): void } {
  const wrap = document.createElement("div");
  wrap.className = "code-wrap";
  const pre = document.createElement("pre");
  pre.className = "code-block";
  const code = document.createElement("code");
  code.textContent = initial;
  pre.appendChild(code);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "code-copy";
  copyBtn.textContent = "Copy";
  let timer = 0;
  copyBtn.addEventListener("click", () => {
    const text = code.textContent ?? "";
    navigator.clipboard?.writeText(text).catch(() => {});
    copyBtn.textContent = "Copied";
    copyBtn.dataset.copied = "true";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      copyBtn.textContent = "Copy";
      delete copyBtn.dataset.copied;
    }, 1400);
  });

  wrap.append(pre, copyBtn);
  return {
    wrap,
    set(text: string) {
      code.textContent = text;
    },
  };
}

function mountApp(): void {
  const root = document.getElementById("app")!;
  document.documentElement.setAttribute("data-theme", "dark");

  // Floating Sticky TrueGlass Navigation Capsule (dogfoods real Snell bezel + bowed Fresnel rim over live scrolling content)
  const topbar = document.createElement("header");
  topbar.className = "topbar";

  const topbarGlass = createGlass({ tag: "div", className: "topbar-glass" });
  topbarGlass.element.innerHTML = `
    <div class="topbar-inner">
      <a class="brand-link" href="#top" aria-label="TrueGlass">
        <img class="brand-mark" src="/icon.png" alt="" width="26" height="26" draggable="false" />
        <span class="brand-name">TrueGlass</span>
      </a>
      <nav class="topnav" aria-label="Primary sections">
        <span class="topnav-indicator" aria-hidden="true"></span>
        <a href="#refraction" data-section="refraction">Refraction</a>
        <a href="#optics-lab" data-section="optics-lab">Optics Lab</a>
        <a href="#droplet-fusion" data-section="droplet-fusion">Droplet Fusion</a>
        <a href="#components" data-section="components">Components</a>
        <a href="#adaptive" data-section="adaptive">Adaptive</a>
      </nav>
      <div class="topbar-actions">
        <a class="version-tag" href="https://www.npmjs.com/package/trueglass" target="_blank" rel="noreferrer" title="View trueglass on npm">npm v1.0.0</a>
        <a class="gh-link" href="https://github.com/kicode01/trueglass" target="_blank" rel="noreferrer">
          ${GITHUB_SVG}<span>GitHub</span>
        </a>
      </div>
    </div>
  `;
  topbar.appendChild(topbarGlass.element);
  root.appendChild(topbar);

  // Spring-gliding active pill indicator inside the TrueGlass navbar
  const navEl = topbarGlass.element.querySelector<HTMLElement>(".topnav");
  const navIndicator = topbarGlass.element.querySelector<HTMLElement>(".topnav-indicator");
  const navLinks = Array.from(topbarGlass.element.querySelectorAll<HTMLAnchorElement>(".topnav a[data-section]"));
  let activeSectionId = "refraction";
  let navReady = false;

  const paintIndicator = () => {
    if (!navIndicator) return;
    navIndicator.style.transform = `translate3d(${indX.get().toFixed(2)}px, 0, 0)`;
    navIndicator.style.width = `${indW.get().toFixed(2)}px`;
  };
  const indX = createSpring(0, 260, 26, paintIndicator);
  const indW = createSpring(0, 260, 26, paintIndicator);

  const setActiveNav = (id: string, instant = false) => {
    activeSectionId = id;
    let activeLink: HTMLAnchorElement | null = null;
    for (const a of navLinks) {
      const match = a.dataset.section === id;
      a.toggleAttribute("data-active", match);
      a.setAttribute("aria-current", match ? "true" : "false");
      if (match) activeLink = a;
    }
    if (!activeLink || !navEl || !navIndicator) return;
    const x = activeLink.offsetLeft;
    const w = activeLink.offsetWidth;
    if (w <= 0) return;
    indX.set(x, instant || !navReady);
    indW.set(w, instant || !navReady);
    navIndicator.setAttribute("data-visible", "true");
    navReady = true;
  };

  for (const a of navLinks) {
    a.addEventListener("click", () => {
      if (a.dataset.section) setActiveNav(a.dataset.section, false);
    });
  }

  // Floating TrueGlass "Back to Top" button (optically materializes once scrolled past hero)
  const UP_ARROW_SVG = `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"/></svg>`;
  const backToTopBtn = createButton({
    iconHtml: UP_ARROW_SVG,
    iconOnly: true,
    ariaLabel: "Back to top",
    materializeOnMount: false,
    onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  });
  backToTopBtn.element.classList.add("back-to-top-glass");
  backToTopBtn.dematerialize(true);
  root.appendChild(backToTopBtn.element);

  const main = document.createElement("main");
  main.className = "standalone";
  main.id = "top";
  root.appendChild(main);

  // 1. Hero Header + Spec Strip
  const heroBlock = document.createElement("div");
  heroBlock.className = "hero-block";

  const titleHeading = document.createElement("h1");
  titleHeading.className = "title-wrap";
  titleHeading.innerHTML = `
    <svg class="title-glass" aria-hidden="true" focusable="false">
      <defs>
        <text id="trueglass-title-lettering" x="0" y="1">TrueGlass</text>
        <linearGradient id="trueglass-title-face" x1="0" y1="0" x2="0.4" y2="1">
          <stop stop-color="#e8f4ff" stop-opacity="0.22"/>
          <stop offset="0.38" stop-color="#9ec6f2" stop-opacity="0.06"/>
          <stop offset="0.72" stop-color="#7fb4ec" stop-opacity="0.09"/>
          <stop offset="1" stop-color="#cde8ff" stop-opacity="0.24"/>
        </linearGradient>
        <linearGradient id="trueglass-title-rim" x1="0" y1="0" x2="0.7" y2="1">
          <stop stop-color="#ffffff" stop-opacity="0.96"/>
          <stop offset="0.35" stop-color="#d8ecff" stop-opacity="0.48"/>
          <stop offset="0.65" stop-color="#8ec7ff" stop-opacity="0.38"/>
          <stop offset="1" stop-color="#e8f6ff" stop-opacity="0.88"/>
        </linearGradient>
        <filter id="trueglass-title-bevel" x="-12%" y="-24%" width="124%" height="156%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="dome"/>
          <feSpecularLighting in="dome" surfaceScale="5.2" specularConstant="1.25" specularExponent="54" lighting-color="#ffffff" result="keySpec">
            <feDistantLight azimuth="235" elevation="38"/>
          </feSpecularLighting>
          <feSpecularLighting in="dome" surfaceScale="4.5" specularConstant="0.72" specularExponent="34" lighting-color="#8fd4ff" result="bounceSpec">
            <feDistantLight azimuth="52" elevation="32"/>
          </feSpecularLighting>
          <feComposite in="keySpec" in2="SourceAlpha" operator="in" result="keyClip"/>
          <feComposite in="bounceSpec" in2="SourceAlpha" operator="in" result="bounceClip"/>
          <feMerge>
            <feMergeNode in="SourceGraphic"/>
            <feMergeNode in="bounceClip"/>
            <feMergeNode in="keyClip"/>
          </feMerge>
        </filter>
        <filter id="trueglass-title-edge" x="-10%" y="-20%" width="120%" height="150%" color-interpolation-filters="sRGB">
          <feMorphology in="SourceAlpha" operator="erode" radius="0.85" result="interior"/>
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
    "Zero-dependency TypeScript optical glass engine and UI suite — real-time Snell’s law squircle bezels, RGB chromatic dispersion, GPU tilt lighting, Clear ↔ Tinted continuum, C² droplet fusion, and adaptive luminance sensing.";

  const specStrip = document.createElement("div");
  specStrip.className = "spec-strip";
  specStrip.innerHTML = `
    <span class="spec-item"><strong>~22.3 KiB</strong> gzipped core</span>
    <span class="spec-sep" aria-hidden="true"></span>
    <span class="spec-item"><strong>0</strong> runtime dependencies</span>
    <span class="spec-sep" aria-hidden="true"></span>
    <span class="spec-item"><strong>Snell Bezel + WebGL2 + sRGB SVG</strong> pipeline</span>
    <span class="spec-sep" aria-hidden="true"></span>
    <span class="spec-item"><strong>MIT</strong> licensed</span>
  `;

  heroBlock.append(titleHeading, intro, specStrip);
  main.appendChild(heroBlock);

  const titleTextEl = titleHeading.querySelector<HTMLElement>(".title-text");
  if (titleTextEl) {
    mountGlassTitle(titleHeading, titleTextEl, "TrueGlass");
  }

  if (typeof IntersectionObserver !== "undefined") {
    let wasScrolled = false;
    const heroObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        const scrolled = !visible;
        topbar.toggleAttribute("data-scrolled", scrolled);
        if (scrolled !== wasScrolled) {
          wasScrolled = scrolled;
          if (scrolled) {
            backToTopBtn.materialize();
          } else {
            backToTopBtn.dematerialize();
          }
        }
      },
      { rootMargin: "-68px 0px 0px 0px", threshold: 0 },
    );
    heroObserver.observe(titleHeading);
  }

  // 2. Hero Interactive Refraction Stage
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
  imgLight.decoding = "async";

  const imgDark = document.createElement("img");
  imgDark.className = "wallpaper-dark";
  imgDark.src = "/img/fluid-dark.webp";
  imgDark.alt = "";
  imgDark.draggable = false;
  imgDark.loading = "eager";
  imgDark.setAttribute("fetchpriority", "high");
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
  imgDark.addEventListener("load", centerScrollerIfNeeded);

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

  const stageHint = document.createElement("div");
  stageHint.className = "stage-hint";
  stageHint.textContent = "Drag backdrop · Hold tabs, slider, or switch to lift";

  stageEl.append(scroller, stageOverlay, stageThemeCtrl, stageHint);

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

  const heroStageSection = document.createElement("section");
  heroStageSection.className = "section hero-section";
  heroStageSection.id = "refraction";
  heroStageSection.appendChild(stageEl);
  main.appendChild(heroStageSection);

  // 3. Optics Lab: 2-Column Magnifier + Live Parameters Console
  const magnifierBox = document.createElement("div");
  magnifierBox.className = "magnifier";

  const magScene = document.createElement("div");
  magScene.className = "scene";
  magScene.setAttribute("data-fluid-backdrop", "");

  const magImg = document.createElement("img");
  magImg.src = "/img/fluid-magnifier.webp";
  magImg.alt = "";
  magImg.draggable = false;
  magImg.decoding = "async";

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

  const recenterMag = () => {
    if (magnifierBox.clientWidth > 0 && magnifierBox.clientHeight > 0) {
      magPos = { x: magnifierBox.clientWidth * 0.5, y: magnifierBox.clientHeight * 0.5 };
      magPrev = { ...magPos };
      paintMag();
    }
  };
  requestAnimationFrame(recenterMag);
  magImg.addEventListener("load", () => {
    recenterMag();
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

  const opticsPanel = document.createElement("div");
  opticsPanel.className = "studio-panel";

  const opticsHead = document.createElement("div");
  opticsHead.className = "panel-head";
  const opticsTitleWrap = document.createElement("div");
  opticsTitleWrap.innerHTML = `<h3 class="panel-title">Optical Parameters</h3><p class="panel-sub">Real-time Snell refraction &amp; GPU rim lighting</p>`;
  const resetOpticsBtn = document.createElement("button");
  resetOpticsBtn.type = "button";
  resetOpticsBtn.className = "reset-btn";
  resetOpticsBtn.textContent = "Reset";
  opticsHead.append(opticsTitleWrap, resetOpticsBtn);

  const settingsWrap = document.createElement("div");
  settingsWrap.className = "settings";
  let stopVirtualTilt: (() => void) | null = null;
  let currentLightAngle = -135;
  let rimRaf = 0;

  const setDynamicLightAngle = (deg: number, active: boolean) => {
    currentLightAngle = deg;
    if (active) {
      const rad = (deg * Math.PI) / 180;
      document.documentElement.setAttribute("data-dynamic-light", "");
      document.documentElement.style.setProperty("--lg-light-angle", deg.toFixed(1));
      document.documentElement.style.setProperty("--lg-lx", Math.cos(rad).toFixed(4));
      document.documentElement.style.setProperty("--lg-ly", Math.sin(rad).toFixed(4));
    } else {
      document.documentElement.removeAttribute("data-dynamic-light");
      document.documentElement.style.removeProperty("--lg-light-angle");
      document.documentElement.style.removeProperty("--lg-lx");
      document.documentElement.style.removeProperty("--lg-ly");
    }
  };

  const addGroupLabel = (parent: HTMLElement, text: string) => {
    const lbl = document.createElement("div");
    lbl.className = "panel-group-label";
    lbl.textContent = text;
    parent.appendChild(lbl);
  };

  const addOpticalSlider = (
    parent: HTMLElement,
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
    valEl.textContent = `${Number.isInteger(step) ? initial : initial.toFixed(2)}${unit}`;
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
    parent.appendChild(row);
    return {
      sl,
      valEl,
      reset() {
        sl.setValue(initial);
        valEl.textContent = `${Number.isInteger(step) ? initial : initial.toFixed(2)}${unit}`;
        onChange(initial);
      },
    };
  };

  addGroupLabel(settingsWrap, "Refraction");
  const bendCtrl = addOpticalSlider(settingsWrap, "Bend", 0, 1, 0.01, 0.45, "", (v) => {
    lensGlass.element.style.setProperty("--lg-glass-bend", String(v));
    lensGlass.refit();
  });
  const dispCtrl = addOpticalSlider(settingsWrap, "Dispersion", 0, 2, 0.05, 0.4, "", (v) => {
    lensGlass.element.style.setProperty("--lg-glass-dispersion", String(v));
    lensGlass.refit();
  });
  const frostCtrl = addOpticalSlider(settingsWrap, "Frost", 0, 12, 0.5, 0, "px", (v) => {
    lensGlass.element.style.setProperty("--lg-blur", `${v}px`);
    lensGlass.refit();
  });

  addGroupLabel(settingsWrap, "Surface & Lighting");
  const rimCtrl = addOpticalSlider(settingsWrap, "Rim", 0, 1, 0.01, 0.13, "", (v) => {
    lensGlass.element.style.setProperty("--lg-rim-shine", String(v));
    if (document.documentElement.hasAttribute("data-dynamic-light")) return;
    if (!rimRaf) {
      rimRaf = requestAnimationFrame(() => {
        rimRaf = 0;
        lensGlass.refraction.repaintRim();
      });
    }
  });
  const tintCtrl = addOpticalSlider(settingsWrap, "Clear ↔ Tinted", 0, 1, 0.01, 0, "", (v) => {
    document.documentElement.style.setProperty("--lg-tint-amount", String(v));
    lensGlass.element.style.backgroundColor = v > 0 ? `rgb(255 255 255 / ${(v * 0.28).toFixed(2)})` : "";
  });
  const tiltCtrl = addOpticalSlider(settingsWrap, "Light Tilt", -180, 180, 1, -135, "°", (v) => {
    if (stopVirtualTilt) {
      stopVirtualTilt();
      stopVirtualTilt = null;
      tiltModeSwitch.setChecked(false);
      tiltModeState.textContent = "Off";
    }
    setDynamicLightAngle(v, Math.abs(v + 135) > 0.01);
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
      tiltModeState.textContent = on ? "On" : "Off";
      if (on) {
        if (!stopVirtualTilt) {
          let lastShown = Math.round(currentLightAngle);
          setDynamicLightAngle(currentLightAngle, true);
          stopVirtualTilt = attachVirtualTiltLight((deg) => {
            setDynamicLightAngle(deg, true);
            const rounded = Math.round(deg);
            if (rounded !== lastShown) {
              lastShown = rounded;
              tiltCtrl.sl.setValue(rounded);
              tiltCtrl.valEl.textContent = `${rounded}°`;
            }
          }, currentLightAngle);
        }
      } else {
        stopVirtualTilt?.();
        stopVirtualTilt = null;
        setDynamicLightAngle(-135, false);
        tiltCtrl.sl.setValue(-135);
        tiltCtrl.valEl.textContent = "-135°";
      }
    },
  });
  tiltModeRow.append(tiltModeLabel, tiltModeSwitch.element, tiltModeState);
  settingsWrap.appendChild(tiltModeRow);

  resetOpticsBtn.addEventListener("click", () => {
    stopVirtualTilt?.();
    stopVirtualTilt = null;
    tiltModeSwitch.setChecked(false);
    tiltModeState.textContent = "Off";
    bendCtrl.reset();
    dispCtrl.reset();
    frostCtrl.reset();
    rimCtrl.reset();
    tintCtrl.reset();
    tiltCtrl.reset();
    recenterMag();
  });

  opticsPanel.append(opticsHead, settingsWrap);

  const opticsWorkbench = document.createElement("div");
  opticsWorkbench.className = "workbench";
  opticsWorkbench.append(magnifierBox, opticsPanel);

  main.appendChild(
    studioSection(
      "optics-lab",
      "Glass Magnifier & Optical Lab",
      "Drag the lens across the typography to feel velocity-coupled spring deformation and inspect refraction, dispersion, frost, and dynamic rim lighting side-by-side.",
      "Snell + WebGL2",
      opticsWorkbench,
    ),
  );

  // 4. Shared Glass Container (C2 sminCubic Droplet Fusion)
  const dropletPanel = document.createElement("div");
  dropletPanel.className = "studio-panel";
  const dropletHead = document.createElement("div");
  dropletHead.className = "panel-head";
  dropletHead.innerHTML = `<div><h3 class="panel-title">Fusion Bridge Parameters</h3><p class="panel-sub">Single WebGL2 pass · C² cubic smooth-min (sminCubic)</p></div>`;

  const dropletSettings = document.createElement("div");
  dropletSettings.className = "settings";

  let gapCtrl!: ReturnType<typeof addOpticalSlider>;
  const dropletContainer = createGlassContainer({
    childrenVariants: ["regular", "regular"],
    backdropSrc: "/img/fluid-dark.webp",
    gap: 8,
    smoothK: 34,
    tint: 0.08,
    ariaLabel: "Shared TrueGlass Droplet Container",
    onGapChange(g) {
      gapCtrl.sl.setValue(g);
      gapCtrl.valEl.textContent = `${g}px`;
    },
  });

  gapCtrl = addOpticalSlider(dropletSettings, "Droplet Gap", -16, 64, 1, 8, "px", (v) => {
    dropletContainer.setGap(v);
  });
  const smoothKCtrl = addOpticalSlider(dropletSettings, "Fusion Bridge k", 0, 56, 1, 34, "px", (v) => {
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
    "Drag the Search orb horizontally or press either pill to observe chromatic neck bending and cross-sibling Gaussian touch glow.";

  dropletPanel.append(dropletHead, dropletSettings, dropletPresets, dropletCaption);

  const dropletWorkbench = document.createElement("div");
  dropletWorkbench.className = "workbench";
  dropletWorkbench.append(dropletContainer.element, dropletPanel);

  main.appendChild(
    studioSection(
      "droplet-fusion",
      "Shared Glass Container",
      "Unites adjacent controls inside one shared backdrop pass so approaching pills fuse via continuous C² liquid bridges.",
      "C² sminCubic",
      dropletWorkbench,
    ),
  );

  // 5. UI Component Suite (Full-width Button + 2-Column Bento Grid + Concentric Accessibility)
  const btnStage = document.createElement("div");
  btnStage.className = "btn-stage";
  btnStage.setAttribute("data-theme", "dark");

  const btnBackdrop = document.createElement("img");
  btnBackdrop.className = "btn-stage-backdrop";
  btnBackdrop.src = "/img/fluid-dark.webp";
  btnBackdrop.alt = "";
  btnBackdrop.draggable = false;
  btnBackdrop.decoding = "async";
  btnBackdrop.setAttribute("data-fluid-backdrop", "");

  const btnDemo = document.createElement("div");
  btnDemo.className = "demo row btn-stage-row";
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
    },
  });
  iconBtnSlot.appendChild(btnIconHandle.element);
  textBtnSlot.appendChild(btnTextHandle.element);
  btnDemo.append(iconBtnSlot, textBtnSlot, matTrigger.element);
  btnStage.append(btnBackdrop, btnDemo);
  btnBackdrop.addEventListener("load", () => {
    btnIconHandle.refit();
    btnTextHandle.refit();
    matTrigger.refit();
  });

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
    requestAnimationFrame(() => {
      btnIconHandle.refit();
      btnTextHandle.refit();
    });
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

  const buttonCard = studioCard(
    "Button",
    "Rubber-band spring press, optical variants & materialize-by-bending",
    btnStage,
    optionPills(["Glass", "Filled", "Tinted", "Tinted filled", "Destructive", "Destructive filled"], "Glass", rebuildButtons),
    materialPills,
    btnCode.wrap,
  );

  // Tab bar card
  const tabWell = document.createElement("div");
  tabWell.className = "demo-well";
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
    tabCode.set(
      `<TabBar aria-label="Library" value="${curTab}"${curLift === 16 ? "" : ` style={{ "--lg-lens-grow-x": "${Math.round(1.5 * curLift)}px", "--lg-lens-grow-y": "${curLift}px" }}`} />`,
    );
  };
  applyLift(16);
  tabWell.appendChild(demoTabs.element);
  const liftRow = document.createElement("label");
  liftRow.className = "setting";
  liftRow.style.marginTop = "10px";
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
  const tabCard = studioCard("Tab bar", "Snell meniscus lift & dispersion", tabWell, liftRow, tabCode.wrap);

  // Segmented control card
  const segWell = document.createElement("div");
  segWell.className = "demo-well";
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
  segWell.appendChild(seg.element);
  const segCard = studioCard("Segmented control", "Synchronized 3-layer ink lens", segWell, segCode.wrap);

  // Menu card
  const menuWell = document.createElement("div");
  menuWell.className = "demo-well";
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
  menuWell.appendChild(demoMenu.element);
  const menuCard = studioCard("Menu", "Clip-path morph & magnetic scrub", menuWell, menuCode.wrap);

  // Input card
  const inputWell = document.createElement("div");
  inputWell.className = "demo-well";
  const demoSearch = createSearchField({ placeholder: "Search", ariaLabel: "Search" });
  inputWell.appendChild(demoSearch.element);
  const inputCard = studioCard(
    "Search & Input",
    "Capsule glass field with animated clear",
    inputWell,
    optionPills(["Default", "Disabled"], "Default", (opt) => demoSearch.setDisabled(opt === "Disabled")),
  );

  // Slider card
  const sliderWell = document.createElement("div");
  sliderWell.className = "demo-well";
  const demoSlider = createSlider({ ariaLabel: "Volume", value: 40, className: "demo-slider" });
  sliderWell.appendChild(demoSlider.element);
  const sliderCard = studioCard(
    "Slider",
    "Lifted magnifying thumb lens",
    sliderWell,
    optionPills(["Continuous", "Stepped", "Disabled"], "Continuous", (opt) => {
      demoSlider.setDisabled(opt === "Disabled");
      demoSlider.setStep(opt === "Stepped" ? 10 : 1);
    }),
  );

  // Switch card
  const switchWell = document.createElement("div");
  switchWell.className = "demo-well";
  const demoSwitch = createSwitch({ ariaLabel: "Wi-Fi", checked: true });
  switchWell.appendChild(demoSwitch.element);
  const switchCard = studioCard(
    "Switch",
    "Dual-bed stand-in refraction & scrub",
    switchWell,
    optionPills(["Default", "Disabled"], "Default", (opt) => demoSwitch.setDisabled(opt === "Disabled")),
  );

  const componentGrid = document.createElement("div");
  componentGrid.className = "component-grid";
  componentGrid.append(tabCard, segCard, menuCard, inputCard, sliderCard, switchCard);

  // Concentric Squircle Architecture & Accessibility Card
  const concentricStage = document.createElement("div");
  concentricStage.className = "concentric-stage";
  concentricStage.setAttribute("data-theme", "dark");
  const concentricBg = document.createElement("img");
  concentricBg.className = "concentric-backdrop";
  concentricBg.src = "/img/fluid-dark.webp";
  concentricBg.alt = "";
  concentricBg.decoding = "async";
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

  const concentricCard = studioCard(
    "Concentric Squircle Architecture & Accessibility",
    "Hardware-matched nested radii & opt-in a11y overrides",
    concentricStage,
    concentricPills,
    concentricCaption,
  );
  concentricCard.style.marginTop = "20px";

  main.appendChild(
    studioSection(
      "components",
      "UI Component Suite",
      "Accessible, zero-dependency controls with closed-form harmonic springs, tactile rubber-banding, and physical glass optics.",
      "10 Primitives",
      buttonCard,
      componentGrid,
      concentricCard,
    ),
  );

  // 6. Adaptive Luminance Sensor (2-Column Workbench)
  const sunsetStage = document.createElement("div");
  sunsetStage.className = "sunset-stage";
  sunsetStage.setAttribute("data-theme", "light");
  sunsetStage.setAttribute("data-scroll-edge", "none");
  sunsetStage.setAttribute("data-surface-size", "small");

  const sunsetScroller = document.createElement("div");
  sunsetScroller.className = "sunset-scroller";
  const sunsetContent = document.createElement("div");
  const sunsetCanvas = document.createElement("canvas");
  sunsetCanvas.className = "sunset-canvas";
  sunsetContent.appendChild(sunsetCanvas);
  sunsetScroller.appendChild(sunsetContent);
  let currentScene: "sunset-night" | "white-text" = "sunset-night";
  paintSunsetNightCanvas(sunsetCanvas, currentScene);

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

  // Event-driven adaptive sensor (intervalMs: 0 -> zero background polling CPU)
  const adaptiveSensor = attachAdaptiveBackdropSensor(
    sunsetStage,
    () => {
      const canvasScale = sunsetCanvas.height / Math.max(1, sunsetCanvas.clientHeight || sunsetCanvas.height);
      const hudCenterY = (sunsetScroller.scrollTop + Math.max(80, sunsetStage.clientHeight) - 46) * canvasScale;
      const sy = Math.max(0, Math.min(sunsetCanvas.height - 24, Math.round(hudCenterY - 12)));
      const ctx = sunsetCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      return analyzeBackdropPixels(ctx.getImageData(220, sy, 320, 24).data, 320, 24);
    },
    {
      intervalMs: 0,
      surfaceSize: "small",
      onSample(s: BackdropSample) {
        telPill.element.textContent = `Y=${s.luminance.toFixed(2)} | σ=${s.contrastVariance.toFixed(2)} | Shadow=${s.adaptiveShadowAlpha.toFixed(2)} | ${s.recommendedTheme.toUpperCase()}`;
      },
    },
  );
  let sunsetScrollRaf = 0;
  sunsetScroller.addEventListener(
    "scroll",
    () => {
      if (sunsetScrollRaf) return;
      sunsetScrollRaf = requestAnimationFrame(() => {
        sunsetScrollRaf = 0;
        const top = sunsetScroller.scrollTop;
        sunsetHud.dataset.minimized = top > 48 ? "true" : "false";
        const jumpLabel = jumpBtn.element.querySelector(".lg-button-label") ?? jumpBtn.element;
        jumpLabel.textContent = top > 650 ? "Scroll to Sunset" : "Scroll to Night";
        adaptiveSensor.update();
      });
    },
    { passive: true },
  );
  requestAnimationFrame(() => adaptiveSensor.update());

  // Repaint canvas text in crisp Inter once web fonts finish loading
  document.fonts?.ready.then(() => {
    paintSunsetNightCanvas(sunsetCanvas, currentScene);
    adaptiveSensor.update();
  });

  const sensorPanel = document.createElement("div");
  sensorPanel.className = "studio-panel";
  const sensorHead = document.createElement("div");
  sensorHead.className = "panel-head";
  sensorHead.innerHTML = `<div><h3 class="panel-title">Backdrop Sensor Modes</h3><p class="panel-sub">Hysteresis polarity switching &amp; contrast-driven shadows</p></div>`;

  addGroupLabel(sensorPanel, "Backdrop Scene");
  const scenePills = optionPills(["Sunset → Night", "Text ↔ Plain White"], "Sunset → Night", (m) => {
    currentScene = m === "Sunset → Night" ? "sunset-night" : "white-text";
    paintSunsetNightCanvas(sunsetCanvas, currentScene);
    sunsetScroller.scrollTop = 0;
    sunsetHud.dataset.minimized = "false";
    adaptiveSensor.update();
  });

  const edgeLbl = document.createElement("div");
  edgeLbl.className = "panel-group-label";
  edgeLbl.textContent = "Scroll Edge Treatment";
  const edgePills = optionPills(["No Scroll Edge", "Soft Scroll Edge", "Hard Scroll Edge"], "No Scroll Edge", (m) => {
    sunsetStage.setAttribute("data-scroll-edge", m === "Soft Scroll Edge" ? "soft" : m === "Hard Scroll Edge" ? "hard" : "none");
  });

  const surfLbl = document.createElement("div");
  surfLbl.className = "panel-group-label";
  surfLbl.textContent = "Surface Size Behavior";
  const surfPills = optionPills(
    ["Small Bar (Auto-Flip Polarity)", "Large Panel (Stable Polarity + Ambient Spill)"],
    "Small Bar (Auto-Flip Polarity)",
    (m) => {
      const isLarge = m.startsWith("Large");
      sunsetStage.setAttribute("data-surface-size", isLarge ? "large" : "small");
      adaptiveSensor.setSurfaceSize(isLarge ? "large" : "small");
    },
  );

  const sensorCaption = document.createElement("p");
  sensorCaption.className = "caption";
  sensorCaption.textContent =
    "Scroll inside the viewport to watch perceptual luminance (Y) and spatial edge variance (σ) flip light/dark polarity with hysteresis and adapt grounding shadows.";

  sensorPanel.prepend(sensorHead);
  sensorPanel.append(scenePills, edgeLbl, edgePills, surfLbl, surfPills, sensorCaption);

  const sensorWorkbench = document.createElement("div");
  sensorWorkbench.className = "workbench";
  sensorWorkbench.append(sunsetStage, sensorPanel);

  main.appendChild(
    studioSection(
      "adaptive",
      "Adaptive Luminance Sensor",
      "Samples underlying scene luminance, spatial contrast variance, and ambient chroma to maintain crisp legibility over arbitrary content.",
      "Hysteresis Y / σ",
      sensorWorkbench,
    ),
  );

  // Scroll-spy for the floating TrueGlass navigation capsule
  const sectionIds = ["refraction", "optics-lab", "droplet-fusion", "components", "adaptive"];
  const observedSections = sectionIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  if (typeof IntersectionObserver !== "undefined" && observedSections.length > 0) {
    const visibleRatios = new Map<string, number>();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId = "";
        let bestRatio = 0;
        for (const id of sectionIds) {
          const r = visibleRatios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestId && bestId !== activeSectionId) {
          setActiveNav(bestId, false);
        }
      },
      { rootMargin: "-90px 0px -45% 0px", threshold: [0, 0.15, 0.35, 0.6] },
    );
    for (const sec of observedSections) sectionObserver.observe(sec);
  }
  requestAnimationFrame(() => setActiveNav(activeSectionId, true));
  document.fonts?.ready.then(() => setActiveNav(activeSectionId, true));
  window.addEventListener("resize", () => setActiveNav(activeSectionId, true), { passive: true });

  // Footer
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <span>TrueGlass — Physically-based optical glass engine &amp; UI suite</span>
    <span><a href="https://www.npmjs.com/package/trueglass" target="_blank" rel="noreferrer">npmjs.com/package/trueglass</a> · <a href="https://github.com/kicode01/trueglass" target="_blank" rel="noreferrer">github.com/kicode01/trueglass</a> · MIT License</span>
  `;
  main.appendChild(footer);

  requestAnimationFrame(() => {
    refitAllGlass();
    if (typeof location !== "undefined" && location.hash.length > 1) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    }
  });
  void createInput;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountApp);
  } else {
    mountApp();
  }
}
