import { describe, expect, it } from "vitest";

import {
  INSPECTION_CYCLE_MS,
  INSPECTION_HOLD_MS,
  inspectionPose,
  inspectionProfile,
} from "./inspection";

describe("structure inspection camera", () => {
  it("leaves the point and line at their complete overview", () => {
    for (let step = 0; step <= 1; step += 1) {
      expect(inspectionProfile(step)).toBeNull();
      expect(inspectionPose(step, 9_000)).toEqual({ amount: 0, drift: 0 });
    }
  });

  it("shows every complete structure before moving closer", () => {
    for (let step = 2; step <= 6; step += 1) {
      const profile = inspectionProfile(step);
      expect(profile).not.toBeNull();
      if (!profile) continue;
      expect(inspectionPose(step, 0)).toEqual({ amount: 0, drift: 0 });
      expect(inspectionPose(step, profile.holdMs - 1).amount).toBe(0);
      expect(inspectionPose(step, profile.holdMs + 100).amount).toBeGreaterThan(0);
      expect(inspectionPose(step, profile.approachEndsMs).amount).toBe(1);
    }
  });

  it("uses a well-ordered overview, approach, close hold, return, and rest", () => {
    for (let step = 2; step <= 6; step += 1) {
      const profile = inspectionProfile(step);
      expect(profile).not.toBeNull();
      if (!profile) continue;
      expect(profile.holdMs).toBeLessThan(profile.approachEndsMs);
      expect(profile.approachEndsMs).toBeLessThan(profile.returnStartsMs);
      expect(profile.returnStartsMs).toBeLessThan(profile.returnEndsMs);
      expect(profile.returnEndsMs).toBeLessThan(profile.cycleMs);
      expect(inspectionPose(step, profile.returnEndsMs)).toEqual({ amount: 0, drift: 0 });
      expect(inspectionPose(step, profile.cycleMs)).toEqual({ amount: 0, drift: 0 });
    }
  });

  it("adapts the close camera to each geometry", () => {
    const plane = inspectionProfile(2);
    const cube = inspectionProfile(3);
    const row = inspectionProfile(4);
    expect(plane?.pitch).toBeGreaterThan(0);
    expect(cube?.yaw).toBeGreaterThan(0);
    expect(row?.zoom).toBeLessThan(cube?.zoom ?? 0);
    expect(row?.phoneZoom).toBeLessThan(row?.zoom ?? 0);
    expect(new Set([plane?.yaw, cube?.yaw, row?.yaw]).size).toBe(3);
  });

  it("preserves the accepted dense-stage timing and camera paths", () => {
    const planeOfVolumes = inspectionProfile(5);
    const volumeOfVolumes = inspectionProfile(6);
    expect(planeOfVolumes).toMatchObject({
      cycleMs: INSPECTION_CYCLE_MS,
      holdMs: INSPECTION_HOLD_MS,
      approachEndsMs: 5_700,
      returnStartsMs: 11_500,
      returnEndsMs: 17_000,
      yaw: -0.1,
      pitch: -0.09,
      zoom: 0.54,
    });
    expect(volumeOfVolumes).toMatchObject({
      cycleMs: INSPECTION_CYCLE_MS,
      holdMs: INSPECTION_HOLD_MS,
      approachEndsMs: 5_700,
      returnStartsMs: 11_500,
      returnEndsMs: 17_000,
      yaw: 0.16,
      pitch: 0.08,
      zoom: 0.48,
    });
    expect(planeOfVolumes).not.toHaveProperty("phoneZoom");
    expect(volumeOfVolumes).not.toHaveProperty("phoneZoom");
  });

  it("stays still when reduced motion is requested", () => {
    for (let step = 2; step <= 6; step += 1) {
      expect(inspectionPose(step, 9_000, true)).toEqual({ amount: 0, drift: 0 });
    }
  });
});
