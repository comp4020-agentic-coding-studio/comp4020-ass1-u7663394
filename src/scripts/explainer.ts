// The interactive part: state, the canvas renderer, and the controls.
//
// The one rule this file exists to keep is in ../lib/layout.ts — the dot is a
// constant, and the camera is the only thing that moves. Everything below is in
// service of showing that honestly at 60fps, at any window size, from the
// keyboard.

import {
  COVERAGE,
  DOT_RADIUS,
  SIZES,
  childOffset,
  fitScale,
  stopDepth,
} from "../lib/layout";
import { LAST_STEP, MAGNITUDES, formatPixels } from "../lib/magnitudes";

const TAU = Math.PI * 2;

/** Cap on how big a single dot is allowed to look, in CSS pixels. */
const MAX_DOT_PX = 64;

const DOT_COLOUR = "#f4ede1";
const MARK_COLOUR = "#ff9f45";

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export function start(): void {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>("[data-canvas]");
  const frame = document.querySelector<HTMLElement>("[data-frame]");
  const slider = document.querySelector<HTMLInputElement>("[data-scale]");
  const items = [...document.querySelectorAll<HTMLElement>("[data-magnitude]")];
  const measure = document.querySelector<HTMLElement>("[data-measure]");
  const back = document.querySelector<HTMLButtonElement>("[data-back]");
  const next = document.querySelector<HTMLButtonElement>("[data-next]");

  if (!canvas || !frame || !slider || !back || !next) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Only now does the page get to depend on script. Everything above this line
  // is readable without it: all seven magnitudes ship in the HTML, and the CSS
  // that collapses the inactive ones is gated on this attribute.
  root.dataset.js = "on";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let cssWidth = 0;
  let cssHeight = 0;
  let position = 0; // continuous, 0–6
  let target = 0; // the step the visitor asked for
  let lastScale = 0;
  let frameId = 0;
  let tweenFrom = 0;
  let tweenStart = 0;
  let tweenLength = 0;

  /* ------------------------------------------------------------- rendering */

  const paint = (pos: number): void => {
    if (cssWidth === 0 || cssHeight === 0) return;

    // Which two magnitudes we are between, and how far. At a whole number this
    // resolves to "the upper one, fully drawn", so a settled frame and the last
    // frame of a transition are the same picture.
    const upper = pos <= 0 ? 0 : Math.ceil(pos);
    const lower = Math.max(0, upper - 1);
    const u = pos <= 0 ? 1 : clamp(pos - lower, 0, 1);

    const cap = MAX_DOT_PX / (2 * DOT_RADIUS);
    const scaleLow = Math.min(fitScale(lower, cssWidth, cssHeight), cap);
    const scaleHigh = Math.min(fitScale(upper, cssWidth, cssHeight), cap);
    // Interpolated in log space: a zoom that is linear in scale reads as a
    // lurch, because what the eye tracks is the rate of change of magnitude.
    const scale = Math.exp(lerp(Math.log(scaleLow), Math.log(scaleHigh), u));
    lastScale = scale;

    const centreX = lerp(SIZES[lower].w / 2, SIZES[upper].w / 2, u);
    const centreY = lerp(SIZES[lower].h / 2, SIZES[upper].h / 2, u);
    const originX = cssWidth / 2 - centreX * scale;
    const originY = cssHeight / 2 - centreY * scale;
    const toX = (wx: number): number => originX + wx * scale;
    const toY = (wy: number): number => originY + wy * scale;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Never fill the whole top block as one rect: the split between "the block
    // you already had" and "the nine that just arrived" is the explanation.
    const stop = Math.min(stopDepth(scale, upper), Math.max(0, upper - 1));
    const kept = new Path2D();
    const arriving = new Path2D();

    const collect = (path: Path2D, depth: number, x: number, y: number): void => {
      const size = SIZES[depth];
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

    if (upper === 0) {
      collect(kept, 0, 0, 0);
    } else {
      for (let index = 0; index < 10; index += 1) {
        const offset = childOffset(upper, index);
        collect(index === 0 ? kept : arriving, upper - 1, offset.x, offset.y);
      }
    }

    // Below the resolution of a single dot the fill carries the block's exact
    // coverage, so the average brightness is what a million real dots would
    // have produced. It is a measurement, not a stand-in.
    const solidity = stop === 0 ? 1 : COVERAGE[stop];
    ctx.fillStyle = DOT_COLOUR;
    ctx.globalAlpha = solidity;
    ctx.fill(kept);
    ctx.globalAlpha = solidity * u;
    ctx.fill(arriving);
    ctx.globalAlpha = 1;

    // The first dot, still there, still the same size. Once it is too small to
    // find, point at it — the pointer is drawn at a fixed screen size and is
    // plainly a pointer, not the dot.
    const dotPx = 2 * DOT_RADIUS * scale;
    if (pos > 1.35 && dotPx < 26) {
      const markX = toX(0.5);
      const markY = toY(0.5);
      ctx.globalAlpha = clamp((pos - 1.35) / 0.5, 0, 1);
      ctx.strokeStyle = MARK_COLOUR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(markX, markY, 13, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(markX + 13, markY);
      ctx.lineTo(markX + 21, markY);
      ctx.stroke();
      ctx.fillStyle = MARK_COLOUR;
      ctx.font = "600 12px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("1", markX + 25, markY + 1);
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
    measure.textContent =
      `On this screen, right now, one dot is ${formatPixels(dotPx)} across.`;
  };

  /* --------------------------------------------------------------- motion */

  const step = (now: number): void => {
    const t = tweenLength === 0 ? 1 : clamp((now - tweenStart) / tweenLength, 0, 1);
    position = lerp(tweenFrom, target, easeInOut(t));
    paint(position);
    if (t < 1) {
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
    // continuous pull-back, not seven jump cuts.
    tweenFrom = position;
    tweenStart = performance.now();
    tweenLength = Math.min(1800, 240 + 620 * Math.abs(target - tweenFrom));
    if (frameId === 0) frameId = requestAnimationFrame(step);
  };

  /* --------------------------------------------------------------- fitting */

  const resize = (): void => {
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    cssWidth = rect.width;
    cssHeight = rect.height;
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
