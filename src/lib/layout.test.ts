import { describe, expect, it } from "vitest";
import {
  DOT_RADIUS,
  LANDSCAPE,
  MAX_DEPTH,
  PORTRAIT,
  UNIT,
  geometryFor,
} from "./layout";

// The claim the whole page rests on is "the dot never changes size, only the
// camera moves". A reader has to take that on trust from a screenshot. These
// tests are where it stops being a promise: if any future change starts scaling
// the unit, or draws a block that doesn't hold exactly ten of the last one,
// something here goes red.
//
// Everything is checked in both phasings, because there are now two and a bug
// that only shows up on a phone is the expensive kind.

const BOTH = [
  ["landscape", LANDSCAPE],
  ["portrait", PORTRAIT],
] as const;

describe("the unit never moves", () => {
  it("is one world unit at every depth, in either phasing", () => {
    expect(UNIT).toBe(1);
    for (const [name, geometry] of BOTH) {
      expect(geometry.sizes[0], name).toEqual({ w: 1, h: 1 });
    }
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
  for (const [name, geometry] of BOTH) {
    describe(name, () => {
      it("is a block of ten at every level, and square at every second one", () => {
        for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
          const { cols, rows } = geometry.gridAt(depth);
          expect(cols * rows, `depth ${depth} is not a block of ten`).toBe(10);
        }
        for (const depth of [2, 4, 6]) {
          expect(geometry.sizes[depth].w).toBeCloseTo(geometry.sizes[depth].h, 6);
        }
      });

      it("places ten children inside the parent, none overlapping", () => {
        for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
          const boxes = Array.from({ length: 10 }, (_, index) => {
            const { x, y, child } = geometry.childOffset(depth, index);
            return { x, y, right: x + child.w, bottom: y + child.h };
          });
          for (const box of boxes) {
            expect(box.right).toBeLessThanOrEqual(geometry.sizes[depth].w + 1e-9);
            expect(box.bottom).toBeLessThanOrEqual(geometry.sizes[depth].h + 1e-9);
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
          expect(geometry.childOffset(depth, 0)).toMatchObject({ x: 0, y: 0 });
        }
      });

      it("covers exactly the fraction of each block that is dot", () => {
        for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
          const size = geometry.sizes[depth];
          const expected = (10 ** depth * Math.PI * DOT_RADIUS ** 2) / (size.w * size.h);
          expect(geometry.coverage[depth]).toBeCloseTo(expected, 12);
          expect(geometry.coverage[depth]).toBeGreaterThan(0);
          expect(geometry.coverage[depth]).toBeLessThan(1);
        }
      });
    });
  }

  it("holds the same number of dots either way, only shaped differently", () => {
    // The two phasings are the same field seen in a differently-shaped frame,
    // so their areas match and their odd levels are transposed.
    for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
      const a = LANDSCAPE.sizes[depth];
      const b = PORTRAIT.sizes[depth];
      expect(a.w * a.h).toBeCloseTo(b.w * b.h, 6);
      expect(a.w).toBeCloseTo(b.h, 6);
      expect(a.h).toBeCloseTo(b.w, 6);
      expect(LANDSCAPE.coverage[depth]).toBeCloseTo(PORTRAIT.coverage[depth], 12);
    }
  });
});

describe("picking a phasing for the frame you have", () => {
  it("gives a portrait box the tall levels and a wide box the wide ones", () => {
    expect(geometryFor(390, 700).portrait).toBe(true);
    expect(geometryFor(1900, 740).portrait).toBe(false);
  });

  it("uses more of a portrait frame at the odd magnitudes than the other way would", () => {
    // This is the bug that prompted the split: on a phone-shaped box the
    // landscape phasing left a thousand dots as a thin band.
    const [w, h] = [354, 452];
    for (const depth of [1, 3, 5]) {
      const areaOf = (geometry: typeof PORTRAIT): number => {
        const scale = geometry.fitScale(depth, w, h);
        return geometry.sizes[depth].w * scale * geometry.sizes[depth].h * scale;
      };
      expect(areaOf(PORTRAIT), `depth ${depth}`).toBeGreaterThan(areaOf(LANDSCAPE));
    }
  });
});

describe("the camera", () => {
  for (const [name, geometry] of BOTH) {
    it(`fits the whole block in the frame at every magnitude (${name})`, () => {
      const [w, h] = geometry.portrait ? [400, 700] : [900, 600];
      for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
        const scale = geometry.fitScale(depth, w, h);
        expect(geometry.sizes[depth].w * scale).toBeLessThanOrEqual(w);
        expect(geometry.sizes[depth].h * scale).toBeLessThanOrEqual(h);
      }
    });

    it(`never zooms in on the way up (${name})`, () => {
      const [w, h] = geometry.portrait ? [400, 700] : [900, 600];
      for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
        expect(geometry.fitScale(depth, w, h)).toBeLessThan(
          geometry.fitScale(depth - 1, w, h),
        );
      }
    });
  }
});

describe("the level-of-detail cut-off", () => {
  it("never asks the renderer for more fills than it can hold a frame with", () => {
    for (const [name, geometry] of BOTH) {
      for (let top = 0; top <= MAX_DEPTH; top += 1) {
        for (const scale of [0.05, 0.25, 1, 4, 20, 90]) {
          const depth = geometry.stopDepth(scale, top);
          expect(depth, name).toBeGreaterThanOrEqual(0);
          expect(depth, name).toBeLessThanOrEqual(top);
          expect(10 ** (top - depth), name).toBeLessThanOrEqual(40_000);
        }
      }
    }
  });

  it("draws real dots whenever they are big enough to see", () => {
    // At a scale where one dot is comfortably several pixels, nothing should be
    // fudged into a block fill.
    for (const [name, geometry] of BOTH) {
      expect(geometry.stopDepth(40, 2), name).toBe(0);
      expect(geometry.stopDepth(40, 3), name).toBe(0);
    }
  });
});
