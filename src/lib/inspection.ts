// From the first plane onward, each settled magnitude gets two views: an
// overview that proves its complete extent, then a closer pass that reveals
// how its points organise themselves in space. The timing and camera movement
// remain separate from the multiplication transition so neither can hide the
// other.

export const INSPECTION_START_STEP = 2;
// Kept as the public dense-stage values: the existing 100,000 and 1,000,000
// paths retain their exact timing while earlier geometries use shorter cycles.
export const INSPECTION_CYCLE_MS = 18_000;
export const INSPECTION_HOLD_MS = 500;

export interface InspectionPose {
  /** 0 is the fitted overview; 1 is the closest inspection view. */
  readonly amount: number;
  /** A slow signed value used for the small travelling orbit. */
  readonly drift: number;
}

export interface InspectionProfile {
  readonly cycleMs: number;
  readonly holdMs: number;
  readonly approachEndsMs: number;
  readonly returnStartsMs: number;
  readonly returnEndsMs: number;
  /** Camera changes relative to the settled overview. */
  readonly yaw: number;
  readonly pitch: number;
  readonly zoom: number;
  /** Optional tighter crop where a portrait frustum otherwise fits a long axis. */
  readonly phoneZoom?: number;
  readonly orbitYaw: number;
  readonly orbitPitch: number;
  readonly orbitY: number;
  readonly desktopPan: number;
  readonly phonePan: number;
}

// Each path answers a different spatial question. The plane tilts just enough
// to expose rows, the cube orbits around its depth, and the long row travels
// far enough in to make its repeated 1,000-point volumes inspectable. The two
// dense profiles are the existing accepted camera treatment, unchanged.
const INSPECTION_PROFILES: Readonly<Record<number, InspectionProfile>> = {
  2: {
    cycleMs: 13_000,
    holdMs: 700,
    approachEndsMs: 3_900,
    returnStartsMs: 7_900,
    returnEndsMs: 11_500,
    yaw: -0.18,
    pitch: 0.16,
    zoom: 0.58,
    phoneZoom: 0.43,
    orbitYaw: 0.025,
    orbitPitch: 0.018,
    orbitY: 0.012,
    desktopPan: 0.03,
    phonePan: 0.008,
  },
  3: {
    cycleMs: 14_500,
    holdMs: 650,
    approachEndsMs: 4_350,
    returnStartsMs: 8_750,
    returnEndsMs: 12_900,
    yaw: 0.18,
    pitch: -0.1,
    zoom: 0.56,
    phoneZoom: 0.5,
    orbitYaw: 0.035,
    orbitPitch: 0.022,
    orbitY: 0.016,
    desktopPan: 0.045,
    phonePan: 0.01,
  },
  4: {
    cycleMs: 16_000,
    holdMs: 550,
    approachEndsMs: 4_950,
    returnStartsMs: 10_000,
    returnEndsMs: 14_600,
    yaw: -0.08,
    pitch: -0.06,
    zoom: 0.46,
    phoneZoom: 0.24,
    orbitYaw: 0.055,
    orbitPitch: 0.018,
    orbitY: 0.018,
    desktopPan: 0.065,
    phonePan: 0.015,
  },
  5: {
    cycleMs: INSPECTION_CYCLE_MS,
    holdMs: INSPECTION_HOLD_MS,
    approachEndsMs: 5_700,
    returnStartsMs: 11_500,
    returnEndsMs: 17_000,
    yaw: -0.1,
    pitch: -0.09,
    zoom: 0.54,
    orbitYaw: 0.035,
    orbitPitch: 0.025,
    orbitY: 0.025,
    desktopPan: 0.055,
    phonePan: 0.015,
  },
  6: {
    cycleMs: INSPECTION_CYCLE_MS,
    holdMs: INSPECTION_HOLD_MS,
    approachEndsMs: 5_700,
    returnStartsMs: 11_500,
    returnEndsMs: 17_000,
    yaw: 0.16,
    pitch: 0.08,
    zoom: 0.48,
    orbitYaw: 0.035,
    orbitPitch: 0.025,
    orbitY: 0.025,
    desktopPan: 0.055,
    phonePan: 0.015,
  },
};

export const inspectionProfile = (step: number): InspectionProfile | null =>
  INSPECTION_PROFILES[step] ?? null;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Camera pose for a settled magnitude. The point, line, and reduced-motion
 * states remain at their complete fitted overview. */
export function inspectionPose(
  step: number,
  elapsedMs: number,
  reducedMotion = false,
): InspectionPose {
  const profile = inspectionProfile(step);
  if (!profile || reducedMotion) return { amount: 0, drift: 0 };

  const time = Math.max(0, elapsedMs) % profile.cycleMs;
  let amount = 0;
  if (time >= profile.holdMs && time < profile.approachEndsMs) {
    amount = smoothstep(
      (time - profile.holdMs) / (profile.approachEndsMs - profile.holdMs),
    );
  } else if (time >= profile.approachEndsMs && time < profile.returnStartsMs) {
    amount = 1;
  } else if (time >= profile.returnStartsMs && time < profile.returnEndsMs) {
    amount = 1 - smoothstep(
      (time - profile.returnStartsMs) / (profile.returnEndsMs - profile.returnStartsMs),
    );
  }

  const travel = clamp01(
    (time - profile.holdMs) / (profile.returnEndsMs - profile.holdMs),
  );
  return {
    amount,
    drift: amount === 0 ? 0 : amount * Math.sin(travel * Math.PI * 2),
  };
}
