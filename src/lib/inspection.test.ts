import { describe, expect, it } from "vitest";

import {
  INSPECTION_CYCLE_MS,
  INSPECTION_HOLD_MS,
  inspectionPose,
} from "./inspection";

describe("dense-lattice inspection camera", () => {
  it("never changes the stages through 10,000", () => {
    for (let step = 0; step <= 4; step += 1) {
      expect(inspectionPose(step, 9_000)).toEqual({ amount: 0, drift: 0 });
    }
  });

  it("shows the complete overview before moving closer", () => {
    expect(inspectionPose(5, 0).amount).toBe(0);
    expect(inspectionPose(6, INSPECTION_HOLD_MS - 1).amount).toBe(0);
    expect(inspectionPose(5, 5_700).amount).toBe(1);
  });

  it("keeps the overview beat short after the magnitude transition", () => {
    expect(INSPECTION_HOLD_MS).toBeLessThanOrEqual(500);
    expect(inspectionPose(5, 800).amount).toBeGreaterThan(0);
  });

  it("returns to the exact overview before the cycle repeats", () => {
    expect(inspectionPose(6, 17_000)).toEqual({ amount: 0, drift: 0 });
    expect(inspectionPose(6, INSPECTION_CYCLE_MS)).toEqual({ amount: 0, drift: 0 });
  });

  it("stays still when reduced motion is requested", () => {
    expect(inspectionPose(6, 9_000, true)).toEqual({ amount: 0, drift: 0 });
  });
});
