// The spatial grammar of the explainer.
//
// A point becomes a line, the line becomes a plane, and the plane becomes a
// volume. Then the same three moves happen to whole 1,000-point cubes:
//
//   1          1 × 1 × 1
//   10        10 × 1 × 1     line
//   100       10 × 10 × 1    plane
//   1,000     10 × 10 × 10   volume
//   10,000   100 × 10 × 10   ten volumes in a line
//   100,000  100 × 100 × 10  a plane of volumes
//   1,000,000 100 × 100 × 100 a volume of volumes
//
// One point remains one world unit at every stage. A transition copies the
// whole previous lattice ten times along exactly one axis; it never scales a
// point. That is the argument of the page expressed as arithmetic.

export type Axis = 0 | 1 | 2;
export type Vec3 = readonly [number, number, number];

/** Centre-to-centre distance between neighbouring points. Never changes. */
export const UNIT = 1;

/** Radius of one point in world units. Never changes. */
export const DOT_RADIUS = 0.14;

export const MAX_DEPTH = 6;

export interface Lattice {
  readonly step: number;
  readonly dimensions: Vec3;
  readonly count: number;
  /** The axis this state gained on the way in; null for the first point. */
  readonly expansionAxis: Axis | null;
  /** Camera orbit in radians. Distance is fitted from the lattice bounds. */
  readonly camera: {
    readonly yaw: number;
    readonly pitch: number;
    readonly roll: number;
    readonly fit: number;
  };
}

const dimensionsAt = (step: number): Vec3 => {
  const dimensions: [number, number, number] = [1, 1, 1];
  for (let depth = 1; depth <= step; depth += 1) {
    dimensions[(depth - 1) % 3] *= 10;
  }
  return dimensions;
};

export const pointCount = (dimensions: Vec3): number =>
  dimensions[0] * dimensions[1] * dimensions[2];

const CAMERAS = [
  { yaw: 0.08, pitch: 0.03, roll: 0, fit: 0.35 },
  { yaw: 0.12, pitch: 0.08, roll: -0.02, fit: 0.69 },
  { yaw: 0.08, pitch: 0.11, roll: -0.03, fit: 0.72 },
  { yaw: -0.7, pitch: 0.46, roll: 0, fit: 0.62 },
  { yaw: -0.48, pitch: 0.38, roll: 0.01, fit: 0.68 },
  // The two densest overviews stay nearer the normal of their broadest face.
  // A steep angle stacked hundreds of rows into the same pixels and produced
  // moire rather than depth; the inspection camera supplies the close orbit.
  { yaw: -0.26, pitch: 0.26, roll: 0, fit: 0.82 },
  { yaw: -0.54, pitch: 0.38, roll: 0.01, fit: 0.78 },
] as const;

export const LATTICES: readonly Lattice[] = CAMERAS.map((camera, step) => {
  const dimensions = dimensionsAt(step);
  return {
    step,
    dimensions,
    count: pointCount(dimensions),
    expansionAxis: step === 0 ? null : (((step - 1) % 3) as Axis),
    camera,
  };
});

/** Which axis turns the previous state into this one. */
export function expansionAxis(step: number): Axis {
  if (step < 1 || step > MAX_DEPTH) {
    throw new RangeError(`step ${step} has no expansion axis`);
  }
  return ((step - 1) % 3) as Axis;
}

/** Dimensions of the state before `step`, repeated ten times along its axis. */
export function previousDimensions(step: number): Vec3 {
  return LATTICES[Math.max(0, step - 1)].dimensions;
}

/**
 * Which of the ten copies a target point belongs to during a ×10 transition.
 * Copy zero is the structure the visitor was already looking at.
 */
export function copyIndex(step: number, coordinate: Vec3): number {
  const axis = expansionAxis(step);
  const previous = previousDimensions(step);
  return Math.floor(coordinate[axis] / previous[axis]);
}

/** The point's coordinate inside the previous lattice before copies separate. */
export function sourceCoordinate(step: number, coordinate: Vec3): Vec3 {
  const axis = expansionAxis(step);
  const previous = previousDimensions(step);
  const source: [number, number, number] = [...coordinate];
  source[axis] %= previous[axis];
  return source;
}
