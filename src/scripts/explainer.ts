// The interactive part: state, the canvas renderer, and the controls.
//
// Two rules this file exists to keep, both from CLAUDE.md:
//   - the dot is a constant (../lib/layout.ts). The camera is the only thing
//     that moves, and the copies that arrive on a step *translate* — nothing
//     ever scales a dot, because that would be the page contradicting itself.
//   - no figure is ever interpolated. The numeral switches discretely; the
//     measured dot size is written once the drawing has settled and not before.

import { DOT_RADIUS, type Geometry, geometryFor } from "../lib/layout";
import {
  arrivalOffset,
  arrivalOpacity,
  cameraProgress,
  stepDuration,
} from "../lib/motion";
import { LAST_STEP, MAGNITUDES, formatPixels } from "../lib/magnitudes";

const TAU = Math.PI * 2;

/** Cap on how big a single dot is allowed to look, in CSS pixels. */
const MAX_DOT_PX = 62;

/** Breathing room between the field and the edge of its safe box. */
const PADDING = 18;

const DOT_COLOUR = "247 241 230";
const MARK_COLOUR = "#ff9f45";
/** Must match --bg in global.css: the canvas paints its own base so the
    motion trail decays to the page colour instead of to transparency. */
const STAGE_BG = "7 8 11";

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export function start(): void {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>("[data-canvas]");
  const frame = document.querySelector<HTMLElement>("[data-frame]");
  const slider = document.querySelector<HTMLInputElement>("[data-scale]");
  const items = [...document.querySelectorAll<HTMLElement>("[data-magnitude]")];
  const measure = document.querySelector<HTMLElement>("[data-measure]");
  const back = document.querySelector<HTMLButtonElement>("[data-back]");
  const next = document.querySelector<HTMLButtonElement>("[data-next]");
  /** Overlays the drawing must stay clear of, so the field never sits under text. */
  const overlays = [...document.querySelectorAll<HTMLElement>("[data-overlay]")];

  if (!canvas || !frame || !slider || !back || !next) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Only now does the page get to depend on script. Everything above this line
  // is readable without it: all seven magnitudes ship in the HTML, and the CSS
  // that lifts them into an overlay — and collapses the inactive ones — is
  // gated on this attribute.
  root.dataset.js = "on";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let cssWidth = 0;
  let cssHeight = 0;
  /** The rectangle inside the canvas that no overlay covers. */
  let safe = { x: 0, y: 0, w: 0, h: 0 };
  /** Which phasing of the nesting suits that rectangle's shape. */
  let geometry: Geometry = geometryFor(1, 0);
  let position = 0; // continuous, 0–6
  let target = 0; // the step the visitor asked for
  let lastScale = 0;
  let frameId = 0;
  let tweenFrom = 0;
  let tweenStart = 0;
  let tweenLength = 0;

  /* ------------------------------------------------------------- rendering */

  const paint = (pos: number, trail = false): void => {
    if (safe.w <= 0 || safe.h <= 0) return;

    // Which two magnitudes we are between, and how far. At a whole number this
    // resolves to "the upper one, fully drawn", so a settled frame and the last
    // frame of a transition are the same picture.
    const upper = pos <= 0 ? 0 : Math.ceil(pos);
    const lower = Math.max(0, upper - 1);
    const u = pos <= 0 ? 1 : clamp(pos - lower, 0, 1);
    const camera = cameraProgress(u);

    const { sizes, coverage, childOffset } = geometry;
    const cap = MAX_DOT_PX / (2 * DOT_RADIUS);
    const scaleLow = Math.min(geometry.fitScale(lower, safe.w, safe.h), cap);
    const scaleHigh = Math.min(geometry.fitScale(upper, safe.w, safe.h), cap);
    // Interpolated in log space: a zoom that is linear in scale reads as a
    // lurch, because what the eye tracks is the rate of change of magnitude.
    const scale = Math.exp(lerp(Math.log(scaleLow), Math.log(scaleHigh), camera));
    lastScale = scale;

    const centreX = lerp(sizes[lower].w / 2, sizes[upper].w / 2, camera);
    const centreY = lerp(sizes[lower].h / 2, sizes[upper].h / 2, camera);
    const originX = safe.x + safe.w / 2 - centreX * scale;
    const originY = safe.y + safe.h / 2 - centreY * scale;
    const toX = (wx: number): number => originX + wx * scale;
    const toY = (wy: number): number => originY + wy * scale;

    // A trail during the move and a hard base at rest. The blur is camera
    // language, not data: the settled frame is always painted clean.
    ctx.fillStyle = trail ? `rgb(${STAGE_BG} / 40%)` : `rgb(${STAGE_BG})`;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Never fill the whole top block as one rect: the split between "the block
    // you already had" and "the nine that just arrived" is the explanation.
    const stop = Math.min(geometry.stopDepth(scale, upper), Math.max(0, upper - 1));
    const solidity = stop === 0 ? 1 : coverage[stop];

    const collect = (path: Path2D, depth: number, x: number, y: number): void => {
      const size = sizes[depth];
      const left = toX(x);
      const top = toY(y);
      const width = size.w * scale;
      const height = size.h * scale;
      if (left > cssWidth + 8 || top > cssHeight + 8) return;
      if (left + width < -8 || top + height < -8) return;

      if (depth === stop) {
        if (depth === 0) {
          const radius = DOT_RADIUS * scale;
          path.moveTo(left + 0.5 * scale + radius, top + 0.5 * scale);
          path.arc(left + 0.5 * scale, top + 0.5 * scale, radius, 0, TAU);
        } else {
          path.rect(left, top, width, height);
        }
        return;
      }
      for (let index = 0; index < 10; index += 1) {
        const offset = childOffset(depth, index);
        collect(path, depth - 1, x + offset.x, y + offset.y);
      }
    };

    const fill = (path: Path2D, alpha: number): void => {
      ctx.fillStyle = `rgb(${DOT_COLOUR} / ${(solidity * alpha * 100).toFixed(2)}%)`;
      ctx.fill(path);
    };

    if (upper === 0) {
      const only = new Path2D();
      collect(only, 0, 0, 0);
      fill(only, 1);
    } else {
      // Copy 0 is the block you were already looking at: it is home from the
      // start and never moves. The other nine travel out of it, in order.
      const kept = new Path2D();
      collect(kept, upper - 1, 0, 0);
      fill(kept, 1);

      for (let index = 1; index < 10; index += 1) {
        const home = childOffset(upper, index);
        const travelled = arrivalOffset(u, index);
        const alpha = arrivalOpacity(u, index);
        if (alpha <= 0.001) continue;
        const path = new Path2D();
        // Pure translation from copy 0's position to its own. Nothing here
        // touches the dot's size.
        collect(path, upper - 1, home.x * travelled, home.y * travelled);
        fill(path, alpha);
      }
    }

    // The previous magnitude's footprint, so "ten of these" stays visible once
    // the individual dots do not. One hairline, no label.
    if (upper >= 2) {
      const box = sizes[upper - 1];
      ctx.strokeStyle = `rgb(${DOT_COLOUR} / 16%)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        toX(0) - 3,
        toY(0) - 3,
        box.w * scale + 6,
        box.h * scale + 6,
      );
    }

    // The first dot, still there, still the same size. Once it is too small to
    // find, point at it — the pointer is drawn at a fixed screen size and is
    // plainly a pointer, not the dot.
    const dotPx = 2 * DOT_RADIUS * scale;
    if (pos > 1.3 && dotPx < 24) {
      const markX = toX(0.5);
      const markY = toY(0.5);
      ctx.globalAlpha = clamp((pos - 1.3) / 0.5, 0, 1);
      ctx.strokeStyle = MARK_COLOUR;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(markX, markY, 12, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(markX + 12, markY);
      ctx.lineTo(markX + 20, markY);
      ctx.stroke();
      ctx.fillStyle = MARK_COLOUR;
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("1", markX + 24, markY + 1);
      ctx.globalAlpha = 1;
    }
  };

  /* -------------------------------------------------------------- the text */

  // Discrete, and switched the instant the visitor asks for a step. No figure
  // on this page is ever interpolated: a count-up that stops early leaves a
  // number on screen that was never true (CLAUDE.md).
  const syncText = (): void => {
    const magnitude = MAGNITUDES[target];
    for (const item of items) {
      item.hidden = Number(item.dataset.magnitude) !== target;
    }
    canvas.setAttribute("aria-label", magnitude.aria);
    slider.value = String(target);
    slider.setAttribute("aria-valuetext", `${magnitude.numeral}, ${magnitude.name}`);
    back.disabled = target === 0;
    next.disabled = target === LAST_STEP;
    root.toggleAttribute("data-at-end", target === LAST_STEP);
  };

  /** Written only once the drawing has settled — it is read off the render. */
  const syncMeasurement = (): void => {
    if (!measure) return;
    const dotPx = 2 * DOT_RADIUS * lastScale;
    measure.textContent = `one dot: ${formatPixels(dotPx)} across`;
  };

  /* --------------------------------------------------------------- motion */

  const step = (now: number): void => {
    const t = tweenLength === 0 ? 1 : clamp((now - tweenStart) / tweenLength, 0, 1);
    position = lerp(tweenFrom, target, t);
    if (t < 1) {
      paint(position, !reduceMotion.matches);
      frameId = requestAnimationFrame(step);
    } else {
      frameId = 0;
      position = target;
      paint(position);
      syncMeasurement();
    }
  };

  const goTo = (requested: number, animate = true): void => {
    const wanted = clamp(Math.round(requested), 0, LAST_STEP);
    if (wanted === target && frameId === 0) return;
    target = wanted;
    syncText();

    if (!animate || reduceMotion.matches) {
      if (frameId !== 0) cancelAnimationFrame(frameId);
      frameId = 0;
      position = target;
      paint(position);
      syncMeasurement();
      return;
    }

    // Interrupting mid-zoom picks up from wherever the camera actually is,
    // rather than snapping — a visitor holding the arrow key should see one
    // continuous pull-back, not seven jump cuts. The easing lives in
    // ../lib/motion.ts and is applied per magnitude, so `position` advances
    // linearly and each power of ten gets the full two beats.
    tweenFrom = position;
    tweenStart = performance.now();
    tweenLength = stepDuration(target - tweenFrom);
    if (frameId === 0) frameId = requestAnimationFrame(step);
  };

  /* --------------------------------------------------------------- fitting */

  /**
   * The part of the canvas no overlay covers, in CSS pixels.
   *
   * Each overlay clips one frame edge, and which one is chosen by how much room
   * the cut costs — not by which edge the overlay sits nearest. Distance was the
   * first attempt and it was wrong in a way worth keeping a note about: the
   * readout runs the full width of a phone, so it is flush with the left edge as
   * well as the bottom one, and the nearest-edge rule cut the *left* side off
   * the whole frame. The field was squeezed into a 64px sliver off the right of
   * the screen and the phone stage came out blank.
   *
   * Reading the layout instead of being told about it per breakpoint is what
   * lets one renderer serve the phone (title above, readout and control below)
   * and the wide screen (readout in a column down the left) — but the rule has
   * to be about area, because area is what the drawing actually needs.
   */
  const measureSafeBox = (): void => {
    const box = frame.getBoundingClientRect();
    const edges = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    for (const overlay of overlays) {
      const rect = overlay.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cost = {
        top: box.width * Math.max(0, rect.bottom - box.top),
        bottom: box.width * Math.max(0, box.bottom - rect.top),
        left: box.height * Math.max(0, rect.right - box.left),
        right: box.height * Math.max(0, box.right - rect.left),
      };
      const cheapest = (Object.keys(cost) as (keyof typeof cost)[]).reduce((best, edge) =>
        cost[edge] < cost[best] ? edge : best,
      );
      if (cheapest === "top") edges.top = Math.max(edges.top, rect.bottom);
      else if (cheapest === "bottom") edges.bottom = Math.min(edges.bottom, rect.top);
      else if (cheapest === "left") edges.left = Math.max(edges.left, rect.right);
      else edges.right = Math.min(edges.right, rect.left);
    }
    const width = edges.right - edges.left - PADDING * 2;
    const height = edges.bottom - edges.top - PADDING * 2;
    // If the overlays have eaten the frame, draw in the whole thing rather than
    // in a sliver: an unreadable overlap is a better failure than a blank stage.
    const room = width > box.width * 0.2 && height > box.height * 0.2;
    safe = room
      ? {
          x: edges.left - box.left + PADDING,
          y: edges.top - box.top + PADDING,
          w: width,
          h: height,
        }
      : {
          x: PADDING,
          y: PADDING,
          w: Math.max(64, box.width - PADDING * 2),
          h: Math.max(64, box.height - PADDING * 2),
        };
    geometry = geometryFor(safe.w, safe.h);
  };

  const resize = (): void => {
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Belt to the CSS's braces. The overlays are observed, and this handler
    // writes text into one of them, so a change that did feed back would
    // reflow forever. Nothing downstream runs unless something actually moved.
    const before = { ...safe, cssWidth, cssHeight };
    cssWidth = rect.width;
    cssHeight = rect.height;
    measureSafeBox();
    const unchanged =
      before.cssWidth === cssWidth &&
      before.cssHeight === cssHeight &&
      before.x === safe.x &&
      before.y === safe.y &&
      before.w === safe.w &&
      before.h === safe.h;
    if (unchanged) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(cssWidth * ratio));
    canvas.height = Math.max(1, Math.round(cssHeight * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(position);
    if (frameId === 0) syncMeasurement();
  };

  /* -------------------------------------------------------------- controls */

  slider.addEventListener("input", () => goTo(Number(slider.value)));
  back.addEventListener("click", () => goTo(target - 1));
  next.addEventListener("click", () => goTo(target + 1));

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    // The slider steps natively on the arrows; handling them here as well would
    // move two magnitudes for one key press.
    const from = event.target as HTMLElement | null;
    if (from === slider) return;
    if (from && /^(input|textarea|select)$/i.test(from.tagName)) return;

    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "arrowup" || key === "d") {
      goTo(target + 1);
      event.preventDefault();
    } else if (key === "arrowleft" || key === "arrowdown" || key === "a") {
      goTo(target - 1);
      event.preventDefault();
    }
  });

  const observer = new ResizeObserver(resize);
  observer.observe(frame);
  for (const overlay of overlays) observer.observe(overlay);

  // Turning reduced motion on mid-zoom has to *end* the zoom, not just repaint
  // it. The first version only repainted, so a visitor who switched the setting
  // while the camera was moving was left parked between two magnitudes,
  // looking at a number the drawing did not match. It showed up in the
  // screenshots before it showed up anywhere else.
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches && frameId !== 0) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      position = target;
      syncMeasurement();
    }
    paint(position);
  });

  syncText();
  resize();
  syncMeasurement();
}
