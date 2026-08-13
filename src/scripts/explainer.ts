// State and controls for the spatial explainer. The renderer is deliberately
// separate: this file owns what the visitor asks for; lattice-renderer.ts owns
// what a point, line, plane, and volume look like.

import { LAST_STEP, MAGNITUDES, formatPixels } from "../lib/magnitudes";
import { INSPECTION_START_STEP, inspectionPose, type InspectionPose } from "../lib/inspection";
import { stepDuration } from "../lib/motion";
import {
  createLatticeRenderer,
  type LatticeRenderer,
  type Parallax,
} from "./lattice-renderer";

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
  const stepLabel = document.querySelector<HTMLElement>("[data-step-label]");
  const shapeLabel = document.querySelector<HTMLElement>("[data-shape-label]");
  const back = document.querySelector<HTMLButtonElement>("[data-back]");
  const next = document.querySelector<HTMLButtonElement>("[data-next]");
  const fallback = document.querySelector<HTMLElement>("[data-render-fallback]");

  if (!canvas || !frame || !slider || !back || !next) return;

  let renderer: LatticeRenderer | null = null;
  try {
    renderer = createLatticeRenderer(canvas);
  } catch (error) {
    console.error("The 3D scene could not start", error);
  }

  // The text interaction remains usable when WebGL is unavailable. Only the
  // spatial scene is replaced by a direct message; there is no blank stage.
  if (!renderer) {
    root.dataset.renderer = "fallback";
    if (fallback) fallback.hidden = false;
  }

  root.dataset.js = "on";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let width = 1;
  let height = 1;
  let position = 0;
  let target = 0;
  let lastPointPixels = 0;
  let frameId = 0;
  let tweenFrom = 0;
  let tweenStart = 0;
  let tweenLength = 0;
  let parallax: Parallax = { yaw: 0, pitch: 0 };
  let inspection: InspectionPose = { amount: 0, drift: 0 };
  let inspectionFrameId = 0;
  let inspectionStarted = 0;

  const paint = (nextPosition: number): void => {
    lastPointPixels = renderer?.render(nextPosition, parallax, inspection) ?? 0;
  };

  const syncMeasurement = (): void => {
    if (!measure) return;
    measure.textContent = renderer
      ? `${target >= INSPECTION_START_STEP ? "At full view, one" : "One"} point is ${formatPixels(lastPointPixels)} wide here.`
      : "The values still work; this browser cannot draw the 3D field.";
  };

  const stopInspection = (): void => {
    if (inspectionFrameId !== 0) cancelAnimationFrame(inspectionFrameId);
    inspectionFrameId = 0;
    inspection = { amount: 0, drift: 0 };
    root.dataset.view = "overview";
  };

  const inspect = (now: number): void => {
    const next = inspectionPose(target, now - inspectionStarted, reduceMotion.matches);
    const changed = next.amount !== inspection.amount || next.drift !== inspection.drift;
    inspection = next;
    root.dataset.view = inspection.amount > 0.04 ? "detail" : "overview";
    // During each overview hold the pose is exactly zero. Keep the animation
    // clock alive but do not redraw a million identical vertices every frame.
    if (changed) {
      paint(position);
      if (inspection.amount === 0) syncMeasurement();
    }
    inspectionFrameId = requestAnimationFrame(inspect);
  };

  const startInspection = (): void => {
    stopInspection();
    if (
      !renderer ||
      reduceMotion.matches ||
      target < INSPECTION_START_STEP ||
      position !== target
    ) {
      return;
    }
    inspectionStarted = performance.now();
    inspectionFrameId = requestAnimationFrame(inspect);
  };

  const syncText = (): void => {
    const magnitude = MAGNITUDES[target];
    slider.value = String(target);
    slider.setAttribute("aria-valuetext", `${magnitude.numeral}, ${magnitude.name}`);
    back.disabled = target === 0;
    next.disabled = target === LAST_STEP;
    root.toggleAttribute("data-at-start", target === 0);
    root.toggleAttribute("data-at-end", target === LAST_STEP);
    root.dataset.direction = target >= position ? "forward" : "backward";
    root.dataset.step = String(target);
    canvas.setAttribute("aria-label", magnitude.aria);

    for (const item of items) {
      item.toggleAttribute("data-active", Number(item.dataset.magnitude) === target);
    }
    if (stepLabel) stepLabel.textContent = `${String(target + 1).padStart(2, "0")} / 07`;
    if (shapeLabel) shapeLabel.textContent = magnitude.shape;
  };

  const step = (now: number): void => {
    const elapsed = now - tweenStart;
    const u = tweenLength === 0 ? 1 : clamp(elapsed / tweenLength, 0, 1);
    // Position advances linearly because the dimensional step already owns the
    // easing. Easing here as well front-loaded the move: the new volume was
    // mostly present before the viewer had time to register the plane.
    position = lerp(tweenFrom, target, u);
    paint(position);

    if (u < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      frameId = 0;
      position = target;
      paint(position);
      syncMeasurement();
      startInspection();
    }
  };

  const goTo = (requested: number, animate = true): void => {
    const wanted = clamp(Math.round(requested), 0, LAST_STEP);
    if (wanted === target && frameId === 0) return;
    stopInspection();
    target = wanted;
    syncText();

    if (!animate || reduceMotion.matches || !renderer) {
      if (frameId !== 0) cancelAnimationFrame(frameId);
      frameId = 0;
      position = target;
      paint(position);
      syncMeasurement();
      startInspection();
      return;
    }

    tweenFrom = position;
    tweenStart = performance.now();
    tweenLength = stepDuration(target - tweenFrom);
    if (frameId === 0) frameId = requestAnimationFrame(step);
  };

  const resize = (): void => {
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (rect.width === width && rect.height === height) return;
    width = rect.width;
    height = rect.height;
    renderer?.resize(width, height, window.devicePixelRatio || 1);
    paint(position);
    if (frameId === 0 && inspectionFrameId === 0) syncMeasurement();
  };

  slider.addEventListener("input", () => goTo(Number(slider.value)));
  back.addEventListener("click", () => goTo(target - 1));
  next.addEventListener("click", () => goTo(target + 1));

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
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

  // A few degrees of mouse parallax make the plane and volume readable as
  // space before the next transition. It never changes the data, and vanishes
  // under reduced motion or on touch.
  frame.addEventListener("pointermove", (event) => {
    if (
      reduceMotion.matches ||
      event.pointerType !== "mouse" ||
      frameId !== 0 ||
      target >= 5
    ) {
      return;
    }
    const rect = frame.getBoundingClientRect();
    parallax = {
      yaw: ((event.clientX - rect.left) / rect.width - 0.5) * 0.11,
      pitch: -((event.clientY - rect.top) / rect.height - 0.5) * 0.07,
    };
    paint(position);
  });

  frame.addEventListener("pointerleave", () => {
    if (reduceMotion.matches || frameId !== 0) return;
    parallax = { yaw: 0, pitch: 0 };
    paint(position);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(frame);

  reduceMotion.addEventListener("change", () => {
    parallax = { yaw: 0, pitch: 0 };
    stopInspection();
    if (reduceMotion.matches && frameId !== 0) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      position = target;
      syncMeasurement();
    }
    paint(position);
    syncMeasurement();
    if (!reduceMotion.matches && frameId === 0) startInspection();
  });

  window.addEventListener(
    "pagehide",
    () => {
      stopInspection();
      renderer?.dispose();
    },
    { once: true },
  );

  syncText();
  resize();
  paint(position);
  syncMeasurement();
}
