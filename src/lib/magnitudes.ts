// The seven magnitudes this explainer walks through, and the figures that go
// with each one.
//
// THE RULE FOR THIS FILE (CLAUDE.md): if a number can't be sourced, it doesn't
// go in. Every figure here is stronger than sourced — it is *derivable*, so a
// reader can check it with a calculator and no trust in me at all:
//
//   - the counting time is arithmetic on the magnitude itself: one number per
//     second, no pauses, no sleep. The assumption is printed on the page next
//     to the figure, because an unstated assumption is an unsourced number.
//   - the on-screen size of one dot is *measured from the render* at the
//     visitor's own window size, so it isn't a claim about screens in general.
//     It lives in the renderer, not here, for that reason.
//
// There is no third-party dataset. The only data is the powers of ten.
//
// Numbers are formatted with an explicit en-AU locale: a bare
// toLocaleString() renders differently on my machine and on a CI runner.

const NUMBER = new Intl.NumberFormat("en-AU");

const SECONDS_IN = [
  { label: "day", size: 86_400 },
  { label: "hour", size: 3_600 },
  { label: "minute", size: 60 },
  { label: "second", size: 1 },
] as const;

/**
 * How long it takes to count `seconds` numbers aloud at one per second.
 *
 * Joined by hand rather than with Intl.ListFormat: this string is asserted in
 * the spec suite under Node and rendered in Chrome, and the two don't have to
 * agree about list separators.
 */
export function countingTime(seconds: number): string {
  const parts: string[] = [];
  let left = seconds;
  for (const unit of SECONDS_IN) {
    const count = Math.floor(left / unit.size);
    left -= count * unit.size;
    if (count > 0) {
      parts.push(`${NUMBER.format(count)} ${unit.label}${count === 1 ? "" : "s"}`);
    }
  }
  if (parts.length === 0) return "no time at all";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export interface Magnitude {
  /** Position on the scale, 0–6. Also the nesting depth the renderer draws. */
  readonly step: number;
  readonly value: number;
  /** "1,000" — the notation, which is the thing that stays easy to read. */
  readonly numeral: string;
  /** "one thousand" — spelled out, because the words are the other half of it. */
  readonly name: string;
  /** The line that does the explaining at this magnitude. */
  readonly note: string;
  /** Counting time, derived. */
  readonly counting: string;
  /** What a screen reader is told the drawing currently shows. */
  readonly aria: string;
}

const NAMES = [
  "one",
  "ten",
  "one hundred",
  "one thousand",
  "ten thousand",
  "one hundred thousand",
  "one million",
] as const;

const NOTES = [
  "One dot. Look at how big it is, because it will not change again — " +
    "everything after this is more of exactly this.",
  "Ten. You did not really count these. You saw them and knew. " +
    "That is the last time that happens.",
  "One hundred. You could still count these, one by one, if someone made you. " +
    "Nobody is going to make you.",
  "One thousand. Ten of the block you were just looking at. " +
    "Counting stopped being an option somewhere in the last second.",
  "Ten thousand. You are no longer reading a quantity. " +
    "You are reading a texture and calling it a quantity.",
  "One hundred thousand. The first dot is still there, in the top-left corner, " +
    "still exactly the size it was. It is the marked one.",
  "One million. Four syllables. You read it faster than you read “ten thousand”, " +
    "and you are looking at a hundred times more of it.",
] as const;

export const MAGNITUDES: readonly Magnitude[] = NAMES.map((name, step) => {
  const value = 10 ** step;
  return {
    step,
    value,
    numeral: NUMBER.format(value),
    name,
    note: NOTES[step],
    counting: countingTime(value),
    aria:
      `${NUMBER.format(value)} dots, drawn at the same size as the first one, ` +
      `seen from far enough back to fit them all.`,
  };
});

export const LAST_STEP = MAGNITUDES.length - 1;

/** Format a measured pixel length for display. Never interpolated — see CLAUDE.md. */
export function formatPixels(px: number): string {
  if (px >= 10) return `${NUMBER.format(Math.round(px))} pixels`;
  if (px >= 1) return `${px.toFixed(1)} pixels`;
  if (px >= 0.01) return `${px.toFixed(2)} of one pixel`;
  return "less than a hundredth of a pixel";
}
