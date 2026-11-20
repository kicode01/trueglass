import { createSpring } from "./core/spring";

const VERT_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uField;   // R: encoded sdf, G: smooth dome height, B: crisp alpha, A: caustic blur
uniform vec2 uTexSize;      // texture pixel dimensions
uniform float uPadPx;       // padding in texels
uniform float uScale;       // texels per CSS px
uniform vec2 uTilt;         // normalized pointer tilt [-1..1]
uniform float uTime;        // subtle ambient phase

// High-contrast dark-studio softbox environment map (pure clear crystal glass, never opaque metal)
vec3 sampleStudioReflection(vec3 R, vec2 uv) {
  vec2 shift = uTilt * vec2(0.26, 0.20);
  vec3 r = normalize(R + vec3(shift.x, shift.y, 0.0));

  // Deep pitch-clear dark studio so normal-incidence center stays genuinely transparent!
  vec3 env = vec3(0.010, 0.014, 0.022);

  // 1. Crisp diagonal overhead-left studio softbox strip (-135 deg: catches tops AND vertical stems)
  float diagKey = -(r.x * 0.56 + r.y * 0.83);
  float keyBand = smoothstep(0.20, 0.50, diagKey) * smoothstep(0.99, 0.72, diagKey);
  float keyGlint = exp(-pow((diagKey - 0.56) * 9.5, 2.0));
  env += vec3(0.99, 0.995, 1.0) * (keyBand * 0.88 + keyGlint * 1.30);

  // 2. Crisp vertical left rim softbox (gives T, r, u, l vertical stems sharp glassy meniscus)
  float leftStrip = exp(-pow((r.x + 0.60 - r.y * 0.10) * 9.5, 2.0)) * smoothstep(0.60, -0.58, r.y);
  env += vec3(0.92, 0.97, 1.0) * leftStrip * 0.96;

  // 3. Lower-right crystalline bounce arc (signature liquid-glass dual-sided refraction)
  float diagBounce = r.x * 0.48 + r.y * 0.88;
  float botStrip = smoothstep(0.24, 0.56, diagBounce) * smoothstep(0.99, 0.75, diagBounce);
  float botGlint = exp(-pow((diagBounce - 0.60) * 9.2, 2.0));
  env += vec3(0.72, 0.89, 1.0) * (botStrip * 0.56 + botGlint * 0.98);

  // 4. Razor-thin glossy studio horizon line curving gently across letter bowls
  float horizonCurve = r.y + 0.08 - 0.14 * r.x + 0.03 * sin(uv.x * 5.2 + uTime);
  float horizonGlint = exp(-pow(horizonCurve * 20.0, 2.0));
  env += vec3(0.86, 0.94, 1.0) * horizonGlint * 0.34;

  return env;
}

// Subtle optical light caustic field refracted internally across the curved glass walls
float sampleCausticField(vec2 p, vec2 tilt) {
  float wave = p.y - (0.55 - 0.30 * p.x + 0.06 * sin(p.x * 4.4 + tilt.x * 0.7));
  float ribbon = exp(-pow(wave * 4.4, 2.0));
  float sweep = pow(clamp(0.5 + 0.5 * sin((p.x * 2.8 - p.y * 1.7 + tilt.x * 0.45) * 3.14159), 0.0, 1.0), 4.0);
  return 0.22 + 0.58 * ribbon + 0.32 * sweep;
}

float decodeSdfTexels(float encoded) {
  return (encoded - 0.5) * (uPadPx * 1.5);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 texel = 1.0 / max(uTexSize, vec2(1.0));

  vec4 center = texture(uField, uv);
  float sdfPx = decodeSdfTexels(center.r) / max(uScale, 1.0); // CSS px (< 0 inside)
  float h = center.g;
  float glyphAlpha = center.b;

  // Ultra-tight whisper caustic right beneath the lower-right glass edge (razor-clean silhouette)
  vec2 causticShift = vec2(1.6 - uTilt.x * 1.5, 2.6 - uTilt.y * 1.2) * uScale * texel;
  float shiftedBlur = texture(uField, clamp(uv - causticShift, texel, 1.0 - texel)).a;
  float outsideMask = smoothstep(0.0, 1.0, 1.0 - glyphAlpha);
  float causticGlow = shiftedBlur * exp(-max(0.0, sdfPx) * 0.52) * outsideMask * 0.038;

  if (glyphAlpha <= 0.002) {
    vec3 floorRgb = vec3(0.66, 0.86, 1.0) * causticGlow;
    outColor = vec4(floorRgb, clamp(causticGlow, 0.0, 1.0));
    return;
  }

  // 3x3 Scharr gradient of the smooth 3D convex glass dome height field
  float hTL = texture(uField, uv + vec2(-texel.x, -texel.y)).g;
  float hTC = texture(uField, uv + vec2(     0.0, -texel.y)).g;
  float hTR = texture(uField, uv + vec2( texel.x, -texel.y)).g;
  float hML = texture(uField, uv + vec2(-texel.x,      0.0)).g;
  float hMR = texture(uField, uv + vec2( texel.x,      0.0)).g;
  float hBL = texture(uField, uv + vec2(-texel.x,  texel.y)).g;
  float hBC = texture(uField, uv + vec2(     0.0,  texel.y)).g;
  float hBR = texture(uField, uv + vec2( texel.x,  texel.y)).g;

  float gx = (3.0 * hTR + 10.0 * hMR + 3.0 * hBR - 3.0 * hTL - 10.0 * hML - 3.0 * hBL) / 32.0;
  float gy = (3.0 * hBL + 10.0 * hBC + 3.0 * hBR - 3.0 * hTL - 10.0 * hTC - 3.0 * hTR) / 32.0;

  // Convex crystal lens dome: dark transparent center crown + lush curved refracting bevels
  float slopeGain = 3.05 * uScale;
  vec3 N = normalize(vec3(-gx * slopeGain, -gy * slopeGain, 1.0));
  vec2 n2 = length(vec2(-gx, -gy)) > 1e-5 ? normalize(vec2(-gx, -gy)) : vec2(0.0, -1.0);

  vec3 V = normalize(vec3((0.5 - uv.x) * 0.14, (0.5 - uv.y) * 0.08, 1.0));
  float NdotV = clamp(dot(N, V), 0.0, 1.0);

  // Authentic Schlick Fresnel for clear optical glass (n = 1.52 => F0 = 0.0426)
  // Keeps interior center genuinely dark/clear while curved glass edges blaze cleanly!
  float fresnel = 0.0426 + 0.9574 * pow(1.0 - NdotV, 3.05);

  // Studio softbox reflection with crisp optical chromatic fringe at grazing angles
  vec3 reflDir = reflect(-V, N);
  float dispEdge = (1.0 - NdotV) * 0.017;
  vec3 reflR = sampleStudioReflection(normalize(reflDir + vec3(-dispEdge, -dispEdge * 0.7, 0.0)), uv);
  vec3 reflG = sampleStudioReflection(reflDir, uv);
  vec3 reflB = sampleStudioReflection(normalize(reflDir + vec3( dispEdge * 1.2,  dispEdge * 0.9, 0.0)), uv);
  vec3 reflection = vec3(reflR.r, reflG.g, reflB.b);

  // Snell's Law RGB chromatic refraction through the 3D crystal volume (Cauchy nR/nG/nB)
  vec3 Tr = refract(-V, N, 1.0 / 1.44);
  vec3 Tg = refract(-V, N, 1.0 / 1.52);
  vec3 Tb = refract(-V, N, 1.0 / 1.62);

  // Trace refracted rays through physical thickness to illuminate the inner back glass wall (TIR)
  float thicknessPx = (3.6 + 2.6 * h) * uScale;
  vec2 uvBackR = clamp(uv + Tr.xy * thicknessPx * texel, texel, 1.0 - texel);
  vec2 uvBackG = clamp(uv + Tg.xy * thicknessPx * texel, texel, 1.0 - texel);
  vec2 uvBackB = clamp(uv + Tb.xy * thicknessPx * texel, texel, 1.0 - texel);

  float backSdfR = decodeSdfTexels(texture(uField, uvBackR).r) / max(uScale, 1.0);
  float backSdfG = decodeSdfTexels(texture(uField, uvBackG).r) / max(uScale, 1.0);
  float backSdfB = decodeSdfTexels(texture(uField, uvBackB).r) / max(uScale, 1.0);

  // Back-wall Total Internal Reflection caustic ring (shows unmistakable hollow crystal thickness!)
  float tirR = smoothstep(-2.35, 0.55, backSdfR) * smoothstep(2.95, -0.15, backSdfR);
  float tirG = smoothstep(-2.35, 0.55, backSdfG) * smoothstep(2.95, -0.15, backSdfG);
  float tirB = smoothstep(-2.35, 0.55, backSdfB) * smoothstep(2.95, -0.15, backSdfB);

  vec2 keyDir2 = normalize(vec2(-0.68 + uTilt.x * 0.24, -0.73 + uTilt.y * 0.20));
  float tirWeight = 0.40 + 0.60 * smoothstep(-0.4, 0.85, dot(n2, -keyDir2));
  float cfR = sampleCausticField(uvBackR, uTilt);
  float cfG = sampleCausticField(uvBackG, uTilt);
  float cfB = sampleCausticField(uvBackB, uTilt);

  // Genuinely dark, translucent crystal glass body (NOT opaque silver chrome!)
  // Faint upper skylight tint + dark internal optical absorption channel just inside the rim
  float depthCss = max(0.0, -sdfPx);
  float wallAbsorption = exp(-pow((depthCss - 1.75) / 0.85, 2.0));
  float clearSkylight = 0.072 + 0.088 * smoothstep(0.95, 0.06, uv.y) * h;
  vec3 crystalCore = vec3(0.62, 0.78, 0.96) * clearSkylight * (1.0 - 0.56 * wallAbsorption);

  // Luminous refracted internal back-wall light (creates 3D glass depth inside every stroke)
  vec3 internalTir = vec3(tirR * cfR * 0.82, tirG * cfG * 0.94, tirB * cfB * 1.12) * tirWeight * 0.58;

  // Jewel-like micro-pixel Cauchy RGB chromatic prism fringe ONLY along curved refracting bevels
  vec3 prismDispersion = vec3(
    max(0.0, tirR - tirG) * 0.98,
    max(0.0, tirG - tirB) * 0.48 + max(0.0, tirB - tirG) * 0.44,
    max(0.0, tirB - tirR) * 1.30
  ) * (0.35 + 0.65 * pow(1.0 - NdotV, 1.8)) * 0.66;

  // Tight, razor-glossy wet meniscus specular glints (high exponent = clear wet glass, zero matte chrome)
  vec3 L1 = normalize(vec3(-0.54 + uTilt.x * 0.32, -0.68 + uTilt.y * 0.24, 0.50));
  vec3 H1 = normalize(L1 + V);
  float specWetKey = pow(max(dot(N, H1), 0.0), 72.0) * 1.50;

  vec3 L2 = normalize(vec3(0.52 - uTilt.x * 0.22, 0.66 - uTilt.y * 0.18, 0.54));
  vec3 H2 = normalize(L2 + V);
  float specWetBounce = pow(max(dot(N, H2), 0.0), 38.0) * 0.66;

  // Pure Fresnel-weighted glass composition:
  // Center (NdotV ~ 1): dark transparent crystalCore + crisp internal caustics
  // Curved shoulders (NdotV -> 0): mirror-bright studio softbox reflection + wet specular glints
  vec3 glassCol = crystalCore * (1.0 - fresnel * 0.68)
                + internalTir * (1.0 - fresnel * 0.32)
                + prismDispersion
                + reflection * (0.10 + 0.90 * fresnel)
                + vec3(1.0) * specWetKey
                + vec3(0.74, 0.91, 1.0) * specWetBounce;

  // Razor-crisp 1.3px TrueGlass dual-facing Fresnel contour rim (commanding hero legibility!)
  float rimBand = smoothstep(1.38, 0.0, depthCss);
  float topLeftFace = clamp(dot(n2, keyDir2), 0.0, 1.0);
  float botRightFace = clamp(dot(n2, -keyDir2), 0.0, 1.0);
  float aniso = 1.0 + 0.08 * (n2.y * n2.y - n2.x * n2.x);
  float rimStrength = (0.34 + 0.74 * pow(topLeftFace, 1.12) + 0.58 * pow(botRightFace, 1.25)) * aniso;
  vec3 rimColor = mix(vec3(0.84, 0.94, 1.0), vec3(1.0), topLeftFace);
  glassCol = mix(glassCol, rimColor, clamp(rimBand * rimStrength, 0.0, 0.98));

  // Gentle highlight rolloff preserving deep clear shadows and crisp pure-white glints
  glassCol = glassCol / (1.0 + glassCol * 0.12);
  glassCol = clamp(glassCol, 0.0, 1.0);

  vec3 floorRgb = vec3(0.66, 0.86, 1.0) * causticGlow;
  vec3 finalRgb = glassCol * glyphAlpha + floorRgb * (1.0 - glyphAlpha);
  float finalA = clamp(glyphAlpha + causticGlow * (1.0 - glyphAlpha), 0.0, 1.0);

  outColor = vec4(finalRgb, finalA);
}
`;

const INF = 1e12;
const NEG_INF = -1e30;
const POS_INF = 1e30;

function edt1d(
  f: Float32Array,
  d: Float32Array,
  v: Int32Array,
  z: Float32Array,
  n: number,
): void {
  v[0] = 0;
  z[0] = NEG_INF;
  z[1] = POS_INF;
  let k = 0;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (k > 0 && s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = POS_INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const dx = q - v[k]!;
    d[q] = dx * dx + f[v[k]!]!;
  }
}

function edt2d(grid: Float32Array, w: number, h: number): Float32Array {
  const maxDim = Math.max(w, h);
  const f = new Float32Array(maxDim);
  const d = new Float32Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float32Array(maxDim + 1);
  const out = new Float32Array(w * h);

  // Transform columns
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]!;
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y]!;
  }

  // Transform rows
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) f[x] = out[rowOff + x]!;
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) out[rowOff + x] = Math.sqrt(d[x]!);
  }

  return out;
}

function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 2.6));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  const inv2s2 = 1 / (2 * sigma * sigma);
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-i * i * inv2s2);
    kernel[i + radius] = val;
    sum += val;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] = kernel[i]! / sum;

  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        acc += src[row + sx]! * kernel[k + radius]!;
      }
      tmp[row + x] = acc;
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        acc += tmp[sy * w + x]! * kernel[k + radius]!;
      }
      dst[row + x] = acc;
    }
  }

  return dst;
}

const PAD_CSS = 24;

export function mountGlassTitle(heading: HTMLElement, textEl: HTMLElement, text: string): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return () => {};
  }

  const canvas = document.createElement("canvas");
  canvas.className = "title-glass-canvas";
  canvas.setAttribute("aria-hidden", "true");
  heading.prepend(canvas);

  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    gl = null;
  }

  if (!gl) {
    canvas.remove();
    return () => {};
  }

  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl!.createShader(type);
    if (!sh) return null;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
      gl!.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) {
    canvas.remove();
    return () => {};
  }

  const program = gl.createProgram();
  if (!program) {
    canvas.remove();
    return () => {};
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    canvas.remove();
    return () => {};
  }

  const fieldTex = gl.createTexture();
  if (!fieldTex) {
    gl.deleteProgram(program);
    canvas.remove();
    return () => {};
  }
  gl.bindTexture(gl.TEXTURE_2D, fieldTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uField = gl.getUniformLocation(program, "uField");
  const uTexSize = gl.getUniformLocation(program, "uTexSize");
  const uPadPx = gl.getUniformLocation(program, "uPadPx");
  const uScale = gl.getUniformLocation(program, "uScale");
  const uTilt = gl.getUniformLocation(program, "uTilt");
  const uTime = gl.getUniformLocation(program, "uTime");

  let destroyed = false;
  let texW = 2;
  let texH = 2;
  let padTexels = PAD_CSS * 2;
  let texScale = 2;
  let hasField = false;
  let lastKey = "";

  let drawQueued = false;
  let drawRaf = 0;

  const isReducedMotion = () =>
    document.documentElement.getAttribute("data-a11y-motion") === "reduce" ||
    (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const draw = () => {
    drawQueued = false;
    drawRaf = 0;
    if (destroyed || !gl || !hasField) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.uniform1i(uField, 0);
    gl.uniform2f(uTexSize, texW, texH);
    gl.uniform1f(uPadPx, padTexels);
    gl.uniform1f(uScale, texScale);
    gl.uniform2f(uTilt, tiltX.get(), tiltY.get());
    gl.uniform1f(uTime, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const scheduleDraw = () => {
    if (destroyed || drawQueued || !hasField) return;
    drawQueued = true;
    drawRaf = requestAnimationFrame(draw);
  };

  const tiltX = createSpring(0, 120, 18, scheduleDraw);
  const tiltY = createSpring(0, 120, 18, scheduleDraw);

  const bakeField = (force = false) => {
    if (destroyed || !gl) return;
    const rect = textEl.getBoundingClientRect();
    const boxW = Math.ceil(rect.width);
    const boxH = Math.ceil(rect.height);
    if (boxW < 8 || boxH < 8) return;

    const style = getComputedStyle(heading);
    const fontSize = parseFloat(style.fontSize) || 64;
    const fontWeight = style.fontWeight || "700";
    const fontFamily = style.fontFamily || "Inter, sans-serif";
    const letterSpacing = style.letterSpacing || "normal";
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

    const key = `${boxW}x${boxH}|${fontSize}|${fontWeight}|${fontFamily}|${letterSpacing}|${dpr}`;
    if (!force && key === lastKey) return;
    lastKey = key;

    const cssW = boxW + PAD_CSS * 2;
    const cssH = boxH + PAD_CSS * 2;
    texScale = dpr;
    padTexels = PAD_CSS * dpr;
    texW = Math.max(2, Math.round(cssW * dpr));
    texH = Math.max(2, Math.round(cssH * dpr));

    canvas.width = texW;
    canvas.height = texH;
    canvas.style.left = `${-PAD_CSS}px`;
    canvas.style.top = `${-PAD_CSS}px`;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const off = document.createElement("canvas");
    off.width = texW;
    off.height = texH;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, texW, texH);
    ctx.scale(dpr, dpr);
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = letterSpacing;
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";

    // Match CSS half-leading baseline inside the line box so canvas aligns with selectable text
    const metrics = ctx.measureText(text);
    const fontAscent = metrics.fontBoundingBoxAscent || fontSize * 0.82;
    const fontDescent = metrics.fontBoundingBoxDescent || fontSize * 0.18;
    const baselineY = PAD_CSS + (boxH - (fontAscent + fontDescent)) * 0.5 + fontAscent;

    // Slight horizontal alignment adjustment if Canvas letterSpacing differs subtly from DOM
    const measuredW = metrics.width || boxW;
    const drawX = PAD_CSS + (boxW - measuredW) * 0.5;
    ctx.fillText(text, drawX, baselineY);

    const img = ctx.getImageData(0, 0, texW, texH).data;
    const n = texW * texH;
    const alpha = new Float32Array(n);
    const outSeed = new Float32Array(n);
    const inSeed = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const a = img[i * 4 + 3]! / 255;
      alpha[i] = a;
      if (a >= 0.5) {
        outSeed[i] = 0;
        inSeed[i] = INF;
      } else {
        outSeed[i] = INF;
        inSeed[i] = 0;
      }
    }

    const dOut = edt2d(outSeed, texW, texH);
    const dIn = edt2d(inSeed, texW, texH);

    const sdf = new Float32Array(n);
    const hRaw = new Float32Array(n);
    // Dome radius matched to Inter Bold stroke half-width so stems become smooth convex glass lenses
    const domeRadius = Math.max(3.6, fontSize * 0.075) * dpr;

    for (let i = 0; i < n; i++) {
      const a = alpha[i]!;
      let sd: number;
      if (a > 0 && a < 1) {
        sd = 0.5 - a;
      } else if (a >= 1) {
        sd = -(Math.max(1, dIn[i]!) - 0.5);
      } else {
        sd = Math.max(1, dOut[i]!) - 0.5;
      }
      sdf[i] = sd;
      const depth = sd < 0 ? -sd : 0;
      const t = Math.min(1, depth / domeRadius);
      hRaw[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    }

    // Smooth the dome height field to eliminate medial-axis creases while preserving crisp silhouette
    const hSmooth = gaussianBlur(hRaw, texW, texH, 1.25 * dpr);
    const causticBlur = gaussianBlur(alpha, texW, texH, 2.4 * dpr);

    const range = padTexels * 1.5;
    const floatPixels = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const encodedSdf = Math.max(0, Math.min(1, 0.5 + sdf[i]! / range));
      const o = i * 4;
      floatPixels[o] = encodedSdf;
      floatPixels[o + 1] = Math.max(0, Math.min(1, hSmooth[i]!));
      floatPixels[o + 2] = alpha[i]!;
      floatPixels[o + 3] = Math.max(0, Math.min(1, causticBlur[i]!));
    }

    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.getError();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, texW, texH, 0, gl.RGBA, gl.FLOAT, floatPixels);
    if (gl.getError() !== gl.NO_ERROR) {
      // Safe RGBA8 fallback if half-float upload is unavailable on any driver
      const u8 = new Uint8Array(n * 4);
      for (let i = 0; i < floatPixels.length; i++) {
        u8[i] = Math.round(floatPixels[i]! * 255);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8);
    }

    hasField = true;
    heading.setAttribute("data-glass-ready", "true");
    draw();
  };

  // Interactive subtle studio light tilt as pointer glides over the hero header
  const onPointerMove = (e: PointerEvent) => {
    if (destroyed || isReducedMotion()) return;
    const r = heading.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top + r.height * 0.5;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / Math.max(240, r.width * 0.85)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / 220));
    tiltX.set(nx);
    tiltY.set(ny);
  };

  const onPointerLeave = () => {
    if (destroyed) return;
    tiltX.set(0);
    tiltY.set(0);
  };

  const heroScope = heading.closest(".hero-block") ?? heading.parentElement ?? document.documentElement;
  heroScope.addEventListener("pointermove", onPointerMove as EventListener, { passive: true });
  heroScope.addEventListener("pointerleave", onPointerLeave as EventListener, { passive: true });

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => bakeField(false));
    ro.observe(textEl);
  }

  const onFontsReady = () => {
    if (!destroyed) bakeField(true);
  };
  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    document.fonts.ready.then(onFontsReady);
    document.fonts.addEventListener?.("loadingdone", onFontsReady);
  }

  // Initial synchronous + post-layout bake
  bakeField(true);
  requestAnimationFrame(() => bakeField(false));

  return () => {
    destroyed = true;
    if (drawRaf) cancelAnimationFrame(drawRaf);
    tiltX.stop();
    tiltY.stop();
    ro?.disconnect();
    heroScope.removeEventListener("pointermove", onPointerMove as EventListener);
    heroScope.removeEventListener("pointerleave", onPointerLeave as EventListener);
    document.fonts?.removeEventListener?.("loadingdone", onFontsReady);
    if (gl) {
      gl.deleteTexture(fieldTex);
      gl.deleteProgram(program);
    }
    canvas.remove();
    heading.removeAttribute("data-glass-ready");
  };
}
