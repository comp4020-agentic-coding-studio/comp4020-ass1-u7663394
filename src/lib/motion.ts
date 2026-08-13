// The shape of a single ×10 step, in time.
//
// The first version moved everything at once: the camera pulled back while nine
// copies faded in, both on the same eased value. It was legible and it was
// flat — the step read as a cross-fade between two pictures rather than as a
// multiplication.
//
// A step is now two overlapping beats, in this order:
//
//   1. the camera pulls back, opening empty space around what you had
//   2. nine copies of it travel out from it into that space, one after another
//
// The order matters. Pulling back first means the arrivals happen *on screen*;
// the other way round they would appear outside the current frame and the whole
// point of the beat would be invisible.
//
// One hard constraint on the arrival: it is a **translation**. A copy that
// scaled up into place would render dots at a size they never have, and the
// invariant in ./layout.ts — one dot, one size, forever — is the argument the
// page is making. Copies move; they do not grow.
//
// No DOM, no canvas, no clock: this is the timing curve as arithmetic, so
// ./motion.test.ts can hold its edges instead of me squinting at a screenshot.

/** Camera has finished pulling back by this fraction of the step. */
export const CAMERA_SETTLES_AT = 0.58;

/** The first copy starts moving here, the last one starts here. */
export const ARRIVAL_FIRST_START = 0.26;
export const ARRIVAL_LAST_START = 0.74;

/** How long any one copy takes to travel. */
export const ARRIVAL_SPAN = 0.26;

/** Number of copies that arrive on a step. The tenth is the one you had. */
export const ARRIVALS = 9;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/**
 * A little overshoot, so a copy arrives with weight instead of gliding to a
 * halt. Safe on a translation in a way it would not be on a scale.
 */
export const easeOutBack = (t: number, pull = 1.25): number =>
  1 + (pull + 1) * (t - 1) ** 3 + pull * (t - 1) ** 2;

/** How far the camera has pulled back, given progress `u` through the step. */
export function cameraProgress(u: number): number {
  return easeInOutCubic(clamp01(u / CAMERA_SETTLES_AT));
}

/**
 * How far copy `index` (1–9) has travelled from the block it came from.
 *
 * Staggered by index, so ten things becoming a hundred reads as a sequence you
 * could count rather than a single flash.
 */
export function arrivalProgress(u: number, index: number): number {
  const slot = ARRIVALS <= 1 ? 0 : (index - 1) / (ARRIVALS - 1);
  const start = ARRIVAL_FIRST_START + (ARRIVAL_LAST_START - ARRIVAL_FIRST_START) * slot;
  return clamp01((u - start) / ARRIVAL_SPAN);
}

/** Opacity of copy `index`, which leads its travel slightly so it isn't a ghost. */
export function arrivalOpacity(u: number, index: number): number {
  return easeOutCubic(clamp01(arrivalProgress(u, index) * 1.6));
}

/** Position of copy `index` along its path, 0 = where it came from, 1 = home. */
export function arrivalOffset(u: number, index: number): number {
  const t = arrivalProgress(u, index);
  return t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(t);
}

/**
 * Milliseconds for a move of `distance` magnitudes.
 *
 * Deliberately slow for one step: the beats need room, and a visitor who has
 * just watched a hundred become a thousand should feel that it took something.
 * A drag across the whole scale compresses rather than taking seven times as
 * long.
 */
export function stepDuration(distance: number): number {
  const steps = Math.abs(distance);
  if (steps === 0) return 0;
  return Math.min(2600, 420 + 900 * steps ** 0.72);
}
