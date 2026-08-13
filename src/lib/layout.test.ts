import { describe, expect, it } from "vitest";
import {
  COVERAGE,
  DOT_RADIUS,
  MAX_DEPTH,
  SIZES,
  UNIT,
  childOffset,
  fitScale,
  gridAt,
  stopDepth,
} from "./layout";

// The claim the whole page rests on is "the dot never changes size, only the
// camera moves". A reader has to take that on trust from a screenshot. These
// tests are where it stops being a promise: if any future change starts scaling
// the unit, or draws a block that doesn't hold exactly ten of the last one,
// something here goes red.

describe("the unit never moves", () => {
  it("is one world unit at every depth", () => {
    expect(UNIT).toBe(1);
    expect(SIZES[0]).toEqual({ w: 1, h: 1 });
  });

  it("is the same dot at 1 as at 1,000,000", () => {
    // Expressed as the thing that would actually break: the drawing code reads
    // DOT_RADIUS with no depth argument, so there is nowhere for a per-magnitude
    // size to enter. This asserts the shape of that, not just the value.
    expect(typeof DOT_RADIUS).toBe("number");
    expect(DOT_RADIUS).toBeGreaterThan(0);
    expect(DOT_RADIUS).toBeLessThanOrEqual(0.5);
  });
});

describe("each block holds exactly ten of the last one", () => {
  it("alternates 5x2 and 2x5, so every second level is square", () => {
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      const { cols, rows } = gridAt(depth);
      expect(cols * rows, `depth ${depth} is not a block of ten`).toBe(10);
    }
    for (const depth of [2, 4, 6]) {
      expect(SIZES[depth].w).toBeCloseTo(SIZES[depth].h, 6);
    }
  });

  it("places ten children inside the parent, none overlapping", () => {
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      const boxes = Array.from({ length: 10 }, (_, index) => {
        const { x, y, child } = childOffset(depth, index);
        return { x, y, right: x + child.w, bottom: y + child.h };
      });
      for (const box of boxes) {
        expect(box.right).toBeLessThanOrEqual(SIZES[depth].w + 1e-9);
        expect(box.bottom).toBeLessThanOrEqual(SIZES[depth].h + 1e-9);
      }
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          const overlaps =
            a.x < b.right - 1e-9 &&
            b.x < a.right - 1e-9 &&
            a.y < b.bottom - 1e-9 &&
            b.y < a.bottom - 1e-9;
          expect(overlaps, `depth ${depth}: two children overlap`).toBe(false);
        }
      }
    }
  });

  it("keeps the first dot at the origin, all the way up", () => {
    // The page points at "the first dot" with a marker and says it is still
    // there. It is only still there if child 0 is at (0, 0) at every level.
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      expect(childOffset(depth, 0)).toMatchObject({ x: 0, y: 0 });
    }
  });
});

describe("the honest-fill coverage", () => {
  it("is the real fraction of the block that is dot", () => {
    for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
      const dots = 10 ** depth;
      const expected = (dots * Math.PI * DOT_RADIUS ** 2) / (SIZES[depth].w * SIZES[depth].h);
      expect(COVERAGE[depth]).toBeCloseTo(expected, 12);
      expect(COVERAGE[depth]).toBeGreaterThan(0);
      expect(COVERAGE[depth]).toBeLessThan(1);
    }
  });
});

describe("the camera", () => {
  it("fits the whole block in the frame at every magnitude", () => {
    const [w, h] = [900, 600];
    for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
      const scale = fitScale(depth, w, h);
      expect(SIZES[depth].w * scale).toBeLessThanOrEqual(w);
      expect(SIZES[depth].h * scale).toBeLessThanOrEqual(h);
    }
  });

  it("pulls back monotonically — the view never zooms in on the way up", () => {
    const [w, h] = [900, 600];
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      expect(fitScale(depth, w, h)).toBeLessThan(fitScale(depth - 1, w, h));
    }
  });
});

describe("the level-of-detail cut-off", () => {
  it("never asks the renderer for more fills than it can hold a frame with", () => {
    for (let top = 0; top <= MAX_DEPTH; top += 1) {
      for (const scale of [0.05, 0.25, 1, 4, 20, 90]) {
        const depth = stopDepth(scale, top);
        expect(depth).toBeGreaterThanOrEqual(0);
        expect(depth).toBeLessThanOrEqual(top);
        expect(10 ** (top - depth)).toBeLessThanOrEqual(40_000);
      }
    }
  });

  it("draws real dots whenever they are big enough to see", () => {
    // At a scale where one dot is comfortably several pixels, nothing should be
    // fudged into a block fill.
    expect(stopDepth(40, 2)).toBe(0);
    expect(stopDepth(40, 3)).toBe(0);
  });
});
