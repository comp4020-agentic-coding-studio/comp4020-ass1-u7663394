import { describe, expect, it } from "vitest";
import { LAST_STEP, MAGNITUDES, countingTime, formatPixels } from "./magnitudes";

// Every figure on this page is arithmetic on a power of ten. That makes them
// checkable, and a figure that could be checked and wasn't is just a claim.
// A typo in a counting time is a wrong number on a live page that nothing else
// in this repo would notice.

describe("counting time", () => {
  it("is the arithmetic it says it is", () => {
    expect(countingTime(1)).toBe("1 second");
    expect(countingTime(10)).toBe("10 seconds");
    expect(countingTime(100)).toBe("1 minute and 40 seconds");
    expect(countingTime(1_000)).toBe("16 minutes and 40 seconds");
    expect(countingTime(10_000)).toBe("2 hours, 46 minutes and 40 seconds");
    expect(countingTime(100_000)).toBe("1 day, 3 hours, 46 minutes and 40 seconds");
    expect(countingTime(1_000_000)).toBe(
      "11 days, 13 hours, 46 minutes and 40 seconds",
    );
  });

  it("adds back up to the seconds it was given", () => {
    // The stronger form of the test above: whatever the wording, the parts have
    // to reconstruct the input exactly.
    const sizes: Record<string, number> = {
      day: 86_400,
      hour: 3_600,
      minute: 60,
      second: 1,
    };
    for (const magnitude of MAGNITUDES) {
      const total = [...magnitude.counting.matchAll(/([\d,]+) (day|hour|minute|second)/g)]
        .reduce(
          (sum, [, count, unit]) => sum + Number(count.replace(/,/g, "")) * sizes[unit],
          0,
        );
      expect(total, `${magnitude.numeral}: "${magnitude.counting}"`).toBe(magnitude.value);
    }
  });
});

describe("the seven magnitudes", () => {
  it("are the powers of ten from 1 to a million", () => {
    expect(MAGNITUDES.map((m) => m.value)).toEqual([
      1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
    ]);
    expect(LAST_STEP).toBe(6);
  });

  it("format numerals with an explicit locale", () => {
    // A bare toLocaleString renders differently on my machine and on a runner.
    expect(MAGNITUDES[6].numeral).toBe("1,000,000");
    expect(MAGNITUDES[3].numeral).toBe("1,000");
  });

  it("each says something specific without turning into interface prose", () => {
    for (const magnitude of MAGNITUDES) {
      expect(magnitude.note.length, `step ${magnitude.step} has no note`).toBeGreaterThan(15);
      expect(magnitude.note.length, `step ${magnitude.step} is too wordy`).toBeLessThan(58);
      expect(magnitude.note.toLowerCase()).not.toMatch(/explore|discover|journey|experience/);
      expect(magnitude.shape.length).toBeGreaterThan(2);
    }
  });
});

describe("the measured dot size", () => {
  it("never rounds a sub-pixel dot up to a whole one", () => {
    // The payoff of the last two magnitudes is that one dot is smaller than a
    // pixel. Printing "0 pixels" or "1 pixel" there would throw it away.
    expect(formatPixels(0.19)).toBe("0.19 of one pixel");
    expect(formatPixels(0.004)).toBe("less than a hundredth of a pixel");
    expect(formatPixels(8.62)).toBe("8.6 pixels");
    expect(formatPixels(64)).toBe("64 pixels");
  });
});
