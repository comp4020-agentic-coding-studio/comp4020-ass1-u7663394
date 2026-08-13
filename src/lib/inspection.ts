// A dense lattice needs two views: an overview that proves its total extent,
// then a closer pass where the 1,000-point building blocks can be inspected.
// This timeline loops slowly and always returns to the same overview. It is
// kept separate from the multiplication transition so neither motion can hide
// the other.

export const INSPECTION_START_STEP = 5;
export const INSPECTION_CYCLE_MS = 18_000;
/** A brief overview beat before the camera continues into the structure. */
export const INSPECTION_HOLD_MS = 500;

export interface InspectionPose {
  /** 0 is the fitted overview; 1 is the closest inspection view. */
  readonly amount: number;
  /** A slow signed value used for the small travelling orbit. */
  readonly drift: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Camera pose for a settled magnitude. Earlier stages and reduced motion stay still. */
export function inspectionPose(
  step: number,
  elapsedMs: number,
  reducedMotion = false,
): InspectionPose {
  if (step < INSPECTION_START_STEP || reducedMotion) return { amount: 0, drift: 0 };

  const time = Math.max(0, elapsedMs) % INSPECTION_CYCLE_MS;
  const approachEnds = 5_700;
  const returnStarts = 11_500;
  const returnEnds = 17_000;

  let amount = 0;
  if (time >= INSPECTION_HOLD_MS && time < approachEnds) {
    amount = smoothstep((time - INSPECTION_HOLD_MS) / (approachEnds - INSPECTION_HOLD_MS));
  } else if (time >= approachEnds && time < returnStarts) {
    amount = 1;
  } else if (time >= returnStarts && time < returnEnds) {
    amount = 1 - smoothstep((time - returnStarts) / (returnEnds - returnStarts));
  }

  const travel = clamp01((time - INSPECTION_HOLD_MS) / (returnEnds - INSPECTION_HOLD_MS));
  return {
    amount,
    drift: amount === 0 ? 0 : amount * Math.sin(travel * Math.PI * 2),
  };
}
