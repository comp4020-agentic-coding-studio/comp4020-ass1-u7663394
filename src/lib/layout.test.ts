import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOT_RADIUS,
  LATTICES,
  MAX_DEPTH,
  UNIT,
  copyIndex,
  expansionAxis,
  pointCount,
  previousDimensions,
  sourceCoordinate,
  type Vec3,
} from "./layout";
import {
  ANIMATED_POINT_BUDGET,
  DENSE_EDGE_WEIGHT,
  DENSE_FACE_WEIGHT,
  DENSE_100K_INTERIOR_WEIGHT,
  DENSE_MILLION_INTERIOR_WEIGHT,
  denseInteriorWeight,
} from "../scripts/lattice-renderer";

describe("the point is invariant", () => {
  it("has one spacing and one radius for every magnitude", () => {
    expect(UNIT).toBe(1);
    expect(DOT_RADIUS).toBeGreaterThan(0);
    expect(DOT_RADIUS).toBeLessThan(UNIT / 2);
  });
});

describe("the dimensional progression", () => {
  it("moves point → line → plane → volume, then repeats at block scale", () => {
    expect(LATTICES.map((state) => state.dimensions)).toEqual([
      [1, 1, 1],
      [10, 1, 1],
      [10, 10, 1],
      [10, 10, 10],
      [100, 10, 10],
      [100, 100, 10],
      [100, 100, 100],
    ]);
  });

  it("contains exactly 10^step points at every state", () => {
    expect(LATTICES).toHaveLength(MAX_DEPTH + 1);
    for (const state of LATTICES) {
      expect(pointCount(state.dimensions)).toBe(10 ** state.step);
      expect(state.count).toBe(10 ** state.step);
    }
  });

  it("changes one axis by exactly ×10 per step", () => {
    for (let step = 1; step <= MAX_DEPTH; step += 1) {
      const before = previousDimensions(step);
      const after = LATTICES[step].dimensions;
      const axis = expansionAxis(step);
      for (const candidate of [0, 1, 2] as const) {
        expect(after[candidate]).toBe(
          before[candidate] * (candidate === axis ? 10 : 1),
        );
      }
    }
  });
});

describe("a transition copies what was already there", () => {
  it("assigns every target point to one of ten copies", () => {
    for (let step = 1; step <= MAX_DEPTH; step += 1) {
      const dimensions = LATTICES[step].dimensions;
      const samples: Vec3[] = [
        [0, 0, 0],
        [dimensions[0] - 1, dimensions[1] - 1, dimensions[2] - 1],
        [Math.floor(dimensions[0] / 2), Math.floor(dimensions[1] / 2), 0],
      ];
      for (const coordinate of samples) {
        expect(copyIndex(step, coordinate)).toBeGreaterThanOrEqual(0);
        expect(copyIndex(step, coordinate)).toBeLessThan(10);
      }
    }
  });

  it("folds all ten copies back onto the previous lattice at progress zero", () => {
    for (let step = 1; step <= MAX_DEPTH; step += 1) {
      const axis = expansionAxis(step);
      const previous = previousDimensions(step);
      const target = LATTICES[step].dimensions;
      for (let copy = 0; copy < 10; copy += 1) {
        const coordinate: [number, number, number] = [0, 0, 0];
        coordinate[axis] = copy * previous[axis] + (previous[axis] - 1);
        const source = sourceCoordinate(step, coordinate);
        expect(source[axis]).toBe(previous[axis] - 1);
        expect(copyIndex(step, coordinate)).toBe(copy);
        expect(coordinate[axis]).toBeLessThan(target[axis]);
      }
    }
  });

  it("keeps the first point fixed in copy zero", () => {
    for (let step = 1; step <= MAX_DEPTH; step += 1) {
      expect(copyIndex(step, [0, 0, 0])).toBe(0);
      expect(sourceCoordinate(step, [0, 0, 0])).toEqual([0, 0, 0]);
    }
  });
});

describe("the moving frame budget", () => {
  it("can draw every point through 100,000 and samples only the million", () => {
    expect(ANIMATED_POINT_BUDGET).toBeGreaterThanOrEqual(100_000);
    expect(ANIMATED_POINT_BUDGET).toBeLessThan(1_000_000);
    expect(ANIMATED_POINT_BUDGET - LATTICES[5].count).toBeGreaterThan(0);
  });
});

describe("dense volume hierarchy", () => {
  it("keeps internal spheres prominent while edges retain the hierarchy", () => {
    expect(DENSE_100K_INTERIOR_WEIGHT).toBe(0.75);
    expect(DENSE_MILLION_INTERIOR_WEIGHT).toBe(0.75);
    expect(DENSE_FACE_WEIGHT).toBe(0.6);
    expect(DENSE_EDGE_WEIGHT).toBeGreaterThan(DENSE_100K_INTERIOR_WEIGHT);
    expect(DENSE_EDGE_WEIGHT).toBeLessThanOrEqual(1);
  });

  it("keeps the accepted dense treatment stable through the last transition", () => {
    expect(denseInteriorWeight(5, 5, 1)).toBe(DENSE_100K_INTERIOR_WEIGHT);
    expect(denseInteriorWeight(5, 6, 0)).toBe(DENSE_100K_INTERIOR_WEIGHT);
    expect(denseInteriorWeight(5, 6, 0.5)).toBe(0.75);
    expect(denseInteriorWeight(5, 6, 1)).toBe(DENSE_MILLION_INTERIOR_WEIGHT);
    expect(denseInteriorWeight(6, 6, 1)).toBe(DENSE_MILLION_INTERIOR_WEIGHT);
  });

  it("does not let translucent front points occlude the cube interior", () => {
    const source = readFileSync("src/scripts/lattice-renderer.ts", "utf8");
    expect(source).toContain("gl.depthMask(false)");
  });
});
