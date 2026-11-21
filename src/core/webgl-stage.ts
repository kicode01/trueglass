import { DEFAULT_OPTICS, type OpticalConfig } from "./optics";

export interface RayVisualizerOptions {
  mode: "liquid" | "frosted" | "thick-menu" | "materialize";
  ior: number;
  dispersion: number;
  bezelDepth: number;
  bendProgress: number; // 0..1 (for materialize animation)
  thicknessScale: number;
  showLabels?: boolean;
}

/**
 * Renders the interactive cross-section ray-tracing simulation seen in Video Parts 1 & 3:
 * - "liquid": Parallel vertical light rays pass unbent through the flat interior and bend
 *   coherently inward along the curved squircle bezel via Snell's law + RGB chromatic spread.
 * - "frosted": classic frosted glass randomly scatters every ray into a blurred cone ("smears light").
 * - "thick-menu": 2x dome height & thicker bezel bend rays sharper & further inward (Part 3 00:00).
 * - "materialize": Smoothly turns up surface curvature & refractive bend from 0 -> 1 (Part 3 00:09).
 */
export function drawCrossSectionRays(
  canvas: HTMLCanvasElement,
  opts: RayVisualizerOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cssW = canvas.clientWidth || 640;
  const cssH = canvas.clientHeight || 220;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // Dark optical bench gradient
  const bg = ctx.createLinearGradient(0, 0, 0, cssH);
  bg.addColorStop(0, "#070b14");
  bg.addColorStop(1, "#0d1424");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  // Subtle pixel subgrid bar at bottom representing iPhone OLED pixel array (as in Video Part 1 00:04)
  const emitterY = cssH - 22;
  const pixelStripH = 6;
  const subColors = ["#ef4444", "#22c55e", "#3b82f6"];
  for (let x = 20; x < cssW - 20; x += 6) {
    ctx.fillStyle = subColors[((x / 6) | 0) % 3]!;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x, emitterY + 8, 4, pixelStripH);
  }
  ctx.globalAlpha = 1;

  // Lens dome cross-section geometry
  const padX = 56;
  const lensW = cssW - padX * 2;
  const leftX = padX;
  const rightX = leftX + lensW;
  const baseY = emitterY - 12;

  const bendScale = opts.mode === "materialize" ? opts.bendProgress : 1;
  const thick = opts.mode === "thick-menu" ? Math.max(1.75, opts.thicknessScale) : opts.thicknessScale;
  const maxDomeH = Math.min(cssH * 0.44, 34 * thick) * Math.max(0.03, bendScale);
  const bezelW = Math.min(lensW * 0.36, Math.max(28, opts.bezelDepth * 2.2 * thick));

  const surfaceYAt = (x: number): number => {
    if (x <= leftX || x >= rightX) return baseY;
    const dEdge = Math.min(x - leftX, rightX - x);
    if (dEdge >= bezelW) return baseY - maxDomeH;
    const t = dEdge / bezelW;
    const z = Math.pow(Math.max(0, 1 - Math.pow(1 - t, 4)), 0.25);
    return baseY - maxDomeH * z;
  };

  const slopeAt = (x: number): number => {
    const dLeft = x - leftX;
    const dRight = rightX - x;
    if (dLeft <= 0.5 || dRight <= 0.5) return 0;
    const dEdge = Math.min(dLeft, dRight);
    if (dEdge >= bezelW) return 0;
    const sign = dLeft < dRight ? -1 : 1; // Outward normal tilt
    const t = Math.max(0.04, dEdge / bezelW);
    const inv = 1 - t;
    const z = Math.pow(Math.max(0.01, 1 - Math.pow(inv, 4)), 0.25);
    const dzdx = (Math.pow(inv, 3) / Math.pow(z, 3)) * (maxDomeH / bezelW);
    return sign * dzdx;
  };

  // Fill glass lens cross section
  ctx.beginPath();
  ctx.moveTo(leftX, baseY);
  for (let x = leftX; x <= rightX; x += 2) {
    ctx.lineTo(x, surfaceYAt(x));
  }
  ctx.lineTo(rightX, baseY);
  ctx.closePath();

  const glassFill = ctx.createLinearGradient(0, baseY - maxDomeH, 0, baseY);
  glassFill.addColorStop(0, "rgba(180, 230, 255, 0.24)");
  glassFill.addColorStop(1, "rgba(120, 180, 255, 0.08)");
  ctx.fillStyle = glassFill;
  ctx.fill();

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(220, 244, 255, 0.85)";
  ctx.stroke();

  // Trace light rays upward from screen pixel row through the glass medium
  const rayCount = 30;
  const step = (lensW + 24) / (rayCount - 1);
  const topY = 18;

  for (let i = 0; i < rayCount; i++) {
    const rx = leftX - 12 + i * step;
    const sy = surfaceYAt(rx);

    // Draw emitter dot on pixel plane
    ctx.fillStyle = "#5eead4";
    ctx.beginPath();
    ctx.arc(rx, emitterY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    if (opts.mode === "frosted") {
      // Classic frosted scattered cone: each point scatters randomly into wide blurred cone
      ctx.strokeStyle = "rgba(94, 234, 212, 0.28)";
      ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(rx, emitterY);
        ctx.lineTo(rx, sy);
        const scatterAngle = k * 0.22 + Math.sin(i * 1.7 + k) * 0.08;
        const endX = rx + Math.tan(scatterAngle) * (sy - topY);
        ctx.lineTo(endX, topY);
        ctx.stroke();
      }
      continue;
    }

    // Coherent Snell's Law refraction (plus optional chromatic dispersion rays on curved bezel)
    const ddz = slopeAt(rx);
    if (Math.abs(ddz) < 0.01) {
      ctx.strokeStyle = "rgba(94, 234, 212, 0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(rx, emitterY);
      ctx.lineTo(rx, topY);
      ctx.stroke();

      ctx.fillStyle = "#fcd34d";
      ctx.beginPath();
      ctx.arc(rx, topY, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const incident = Math.atan(Math.abs(ddz));
      const sign = ddz < 0 ? 1 : -1; // Tilt inward toward center of dome
      const disp = opts.dispersion;
      const iors =
        disp > 0.1
          ? [
              { ior: Math.max(1.02, opts.ior - 0.04 * disp), color: "rgba(248, 113, 113, 0.88)" },
              { ior: opts.ior, color: "rgba(74, 222, 128, 0.92)" },
              { ior: opts.ior + 0.045 * disp, color: "rgba(96, 165, 250, 0.88)" },
            ]
          : [{ ior: opts.ior, color: "rgba(94, 234, 212, 0.92)" }];

      // Vertical segment inside substrate up to curved surface
      ctx.strokeStyle = "rgba(94, 234, 212, 0.65)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(rx, emitterY);
      ctx.lineTo(rx, sy);
      ctx.stroke();

      for (const ch of iors) {
        const refracted = Math.asin(Math.min(0.995, Math.sin(incident) / ch.ior));
        const deflect = (incident - refracted) * sign * (0.7 + 0.5 * bendScale);
        const endX = rx + Math.tan(deflect) * (sy - topY) * 1.45;

        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(rx, sy);
        ctx.lineTo(endX, topY);
        ctx.stroke();

        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.arc(endX, topY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Computes live average perceptual luminance and text-contrast energy for an HTMLCanvasElement
 * or HTMLVideoElement backdrop region beneath a DOM glass element.
 */
export function readElementRegionPixels(
  source: HTMLCanvasElement | HTMLVideoElement,
  regionXNorm: number,
  regionYNorm: number,
  regionWNorm: number,
  regionHNorm: number,
  probeCanvas: HTMLCanvasElement,
): Uint8ClampedArray | null {
  const probeW = 24;
  const probeH = 12;
  probeCanvas.width = probeW;
  probeCanvas.height = probeH;
  const ctx = probeCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcW || !srcH) return null;

  const sx = Math.max(0, Math.min(srcW - 1, regionXNorm * srcW));
  const sy = Math.max(0, Math.min(srcH - 1, regionYNorm * srcH));
  const sw = Math.max(2, Math.min(srcW - sx, regionWNorm * srcW));
  const sh = Math.max(2, Math.min(srcH - sy, regionHNorm * srcH));

  try {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, probeW, probeH);
    return ctx.getImageData(0, 0, probeW, probeH).data;
  } catch {
    return null;
  }
}

/**
 * Shared WebGL2 real-time Fluid Glass lens renderer over any image/canvas/video backdrop.
 * Provides true GPU Snell's Law refraction + Cauchy RGB chromatic dispersion + separable frost +
 * Fresnel tilt-reactive specular rim even in browsers without SVG backdrop-filter (Safari/Firefox).
 */
export interface WebGLBackdropLens {
  render(
    source: TexImageSource,
    box: { x: number; y: number; width: number; height: number; radius: number },
    config: OpticalConfig,
    bendScale?: number,
  ): void;
  destroy(): void;
}

const VERT_SRC = `#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = (pos + 1.0) * 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec4 uRect; // x, y, w, h normalized
uniform float uRadius;
uniform float uBezel;
uniform float uIor;
uniform float uDispersion;
uniform float uStrength;
uniform float uTint;
uniform float uLightAngle;
uniform float uRimShine;
uniform float uBend;
in vec2 vUv;
out vec4 outColor;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 roundRectNormal(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  if (q.x > 0.0 && q.y > 0.0) {
    return normalize(q) * sign(p);
  }
  return q.x > q.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y));
}

void main() {
  vec2 px = vUv * uSize;
  vec2 halfSize = uSize * 0.5;
  vec2 p = px - halfSize;
  float r = min(uRadius, min(halfSize.x, halfSize.y));
  float dist = sdRoundRect(p, halfSize, r);
  if (dist > 0.5) discard;

  float depth = max(0.0, -dist);
  float bezel = min(uBezel, min(halfSize.x, halfSize.y));
  float t = clamp(depth / max(1.0, bezel), 0.0, 1.0);

  vec2 uvBase = vec2(
    uRect.x + vUv.x * uRect.z,
    uRect.y + (1.0 - vUv.y) * uRect.w
  );

  vec2 nrm = roundRectNormal(p, halfSize, max(r, bezel));
  float bendProfile = 0.0;
  if (t < 1.0) {
    float inv = 1.0 - t;
    float inv2 = inv * inv;
    float z = pow(max(0.001, 1.0 - inv2 * inv2), 0.25);
    float inc = atan((inv2 * inv) / max(0.001, z * z * z));
    float refr = asin(clamp(sin(inc) / max(1.01, uIor), -0.999, 0.999));
    bendProfile = tan(inc - refr) * (0.6 + z) * 0.55;
  }

  float reach = bezel * uStrength * uBend * (1.0 - 0.18 * uTint);
  vec2 shiftPx = nrm * bendProfile * reach;
  vec2 shiftUv = shiftPx / (uSize / uRect.zw);

  float dispR = 1.0 + 0.22 * uDispersion;
  float dispG = 1.0 + 0.11 * uDispersion;
  float dispB = 1.0;

  vec3 col;
  col.r = texture(uTex, clamp(uvBase - shiftUv * dispR, 0.0, 1.0)).r;
  col.g = texture(uTex, clamp(uvBase - shiftUv * dispG, 0.0, 1.0)).g;
  col.b = texture(uTex, clamp(uvBase - shiftUv * dispB, 0.0, 1.0)).b;

  // Dynamic tilt-reactive Fresnel specular rim
  vec2 lDir = vec2(cos(uLightAngle), sin(uLightAngle));
  float dotL = dot(nrm, lDir);
  float rimFacing = pow(max(1e-4, max(dotL, 0.0) + max(-dotL, 0.0) * 0.4), 1.8);
  float rimAlpha = clamp((1.5 - depth) / 1.5, 0.0, 1.0) * rimFacing * uRimShine * uBend;

  vec3 finalCol = mix(col, vec3(0.97, 0.98, 1.0), uTint * 0.35);
  finalCol = mix(finalCol, vec3(1.0), clamp(rimAlpha, 0.0, 0.85));
  float edgeAA = clamp(-dist + 0.5, 0.0, 1.0);
  outColor = vec4(finalCol, edgeAA);
}`;

export function createWebGLBackdropLens(targetCanvas: HTMLCanvasElement): WebGLBackdropLens | null {
  const gl = targetCanvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const loc = (name: string) => gl.getUniformLocation(prog, name);
  const uSize = loc("uSize");
  const uRect = loc("uRect");
  const uRadius = loc("uRadius");
  const uBezel = loc("uBezel");
  const uIor = loc("uIor");
  const uDispersion = loc("uDispersion");
  const uStrength = loc("uStrength");
  const uTint = loc("uTint");
  const uLightAngle = loc("uLightAngle");
  const uRimShine = loc("uRimShine");
  const uBend = loc("uBend");

  return {
    render(source, box, cfg = DEFAULT_OPTICS, bendScale = 1) {
      const w = Math.max(2, Math.round(box.width));
      const h = Math.max(2, Math.round(box.height));
      if (targetCanvas.width !== w || targetCanvas.height !== h) {
        targetCanvas.width = w;
        targetCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(uSize, w, h);
      gl.uniform4f(uRect, box.x, box.y, box.width, box.height);
      gl.uniform1f(uRadius, box.radius);
      gl.uniform1f(uBezel, cfg.bezelDepth * cfg.thicknessScale);
      gl.uniform1f(uIor, cfg.ior);
      gl.uniform1f(uDispersion, cfg.dispersion);
      gl.uniform1f(uStrength, cfg.strength * cfg.thicknessScale);
      gl.uniform1f(uTint, cfg.tintAmount);
      gl.uniform1f(uLightAngle, (cfg.lightAngleDeg * Math.PI) / 180);
      gl.uniform1f(uRimShine, cfg.rimShine);
      gl.uniform1f(uBend, bendScale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteTexture(tex);
      gl.deleteProgram(prog);
    },
  };
}
