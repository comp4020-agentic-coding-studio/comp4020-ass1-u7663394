import { describe, expect, it } from "vitest";
import {
  ARRIVALS,
  CAMERA_SETTLES_AT,
  arrivalOffset,
  arrivalOpacity,
  arrivalProgress,
  cameraProgress,
  stepDuration,
} from "./motion";

// A transition is the one part of this page a screenshot cannot check: every
// still frame of a broken transition looks like a plausible drawing. These hold
// the two things that would actually break — the ends, and the order.

describe("the step begins and ends where the settled frames are", () => {
  it("starts with the camera where it was and nothing arrived", () => {
    expect(cameraProgress(0)).toBe(0);
    for (let index = 1; index <= ARRIVALS; index += 1) {
      expect(arrivalProgress(0, index), `copy ${index}`).toBe(0);
      expect(arrivalOpacity(0, index), `copy ${index}`).toBe(0);
      expect(arrivalOffset(0, index), `copy ${index}`).toBe(0);
    }
  });

  it("ends with the camera fitted and every copy home", () => {
    // If either of these misses 1, a settled magnitude is drawn differently
    // from the last frame of the transition into it, and the scale jumps.
    expect(cameraProgress(1)).toBe(1);
    for (let index = 1; index <= ARRIVALS; index += 1) {
      expect(arrivalProgress(1, index), `copy ${index}`).toBe(1);
      expect(arrivalOpacity(1, index), `copy ${index}`).toBe(1);
      expect(arrivalOffset(1, index), `copy ${index}`).toBe(1);
    }
  });
});

describe("the camera leads, the copies follow", () => {
  it("has the camera finished before the last copy sets out", () => {
    // The whole reason for the split: if the copies moved first they would
    // travel to places still outside the frame, and the beat would happen
    // off screen.
    expect(cameraProgress(CAMERA_SETTLES_AT)).toBeCloseTo(1, 6);
    expect(arrivalProgress(CAMERA_SETTLES_AT, ARRIVALS)).toBeLessThan(1);
  });

  it("never moves the camera backwards on the way out", () => {
    let previous = -1;
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const now = cameraProgress(u);
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = now;
    }
  });

  it("starts the copies in order", () => {
    const starts = Array.from({ length: ARRIVALS }, (_, i) => {
      for (let u = 0; u <= 1; u += 0.005) {
        if (arrivalProgress(u, i + 1) > 0) return u;
      }
      return 1;
    });
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i], `copy ${i + 1} starts before copy ${i}`).toBeGreaterThan(starts[i - 1]);
    }
  });

  it("overshoots on the way in but never leaves the path in reverse", () => {
    // easeOutBack is only safe here because the copies translate. Confirm it
    // does overshoot (that's the weight) and still lands exactly on 1.
    const samples = Array.from({ length: 201 }, (_, i) => arrivalOffset(i / 200, 1));
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(samples.at(-1)).toBe(1);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
  });
});

describe("how long a move takes", () => {
  it("gives one step room and compresses a drag across the scale", () => {
    expect(stepDuration(0)).toBe(0);
    expect(stepDuration(1)).toBeGreaterThan(1_000);
    expect(stepDuration(6)).toBeLessThan(6 * stepDuration(1));
    expect(stepDuration(6)).toBeLessThanOrEqual(2_600);
    expect(stepDuration(-3)).toBe(stepDuration(3));
  });
});
