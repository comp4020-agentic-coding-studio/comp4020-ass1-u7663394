// The geometry of the field of dots.
//
// The argument the page is making lives in this file, so it is worth stating
// plainly: **one dot is one world unit, at every magnitude, forever.** Nothing
// here scales the dot. Ten dots make a block, ten blocks make a bigger block,
// and so on up to a million. When the visitor moves a step, the camera moves
// back; the dot does not grow or shrink. That invariant is the whole point of
// the explainer, so it is expressed as data — `UNIT` is a constant and there
// is no code path that changes it — rather than as a promise in a comment.
//
// The nesting alternates 5x2 and 2x5, so every second level is a clean square:
//
//   depth 0        1  dot
//   depth 1       10  dots      5 x 2
//   depth 2      100  dots     10 x 10
//   depth 3    1,000  dots     50 x 20
//   depth 4   10,000  dots    100 x 100
//   depth 5  100,000  dots    500 x 200
//   depth 6  1,000,000 dots  1000 x 1000
//
// Which of 5x2 and 2x5 comes first depends on the shape of the screen, and that
// is not cosmetic. On a phone the landscape phasing above makes every odd
// magnitude a 2.5:1 band using a third of the available height, so a thousand
// dots floated in a sea of nothing — the drawing looked small at exactly the
// magnitudes that are supposed to feel large. Starting with 2x5 on a portrait
// frame gives the odd levels the screen's own proportions. Even levels stay
// square either way, so the nesting is untouched: ten of the previous block,
// always.
//
// Kept free of DOM and canvas on purpose: it is arithmetic, so it can be
// checked by a test under Node instead of by looking at a picture.

/** Centre-to-centre distance between two neighbouring dots. Never changes. */
export const UNIT = 1;

/** Radius of one dot, in world units. Never changes. */
export const DOT_RADIUS = 0.44;

export const MAX_DEPTH = 6;

/**
 * Gap between siblings, as a fraction of a sibling's own size. Wider at the
 * upper levels because that is what makes "ten of the previous thing" legible
 * once the individual dots are too small to resolve — the structure has to
 * survive the zoom even when the dots do not.
 */
function gapAt(depth: number): number {
  return depth <= 2 ? 0.15 : 0.25;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Geometry {
  /** True when odd levels are tall (2 wide x 5 tall) rather than wide. */
  readonly portrait: boolean;
  /** Size of a block at each depth, in world units. */
  readonly sizes: readonly Size[];
  /** Fraction of each depth's area that is actually dot. */
  readonly coverage: readonly number[];
  gridAt(depth: number): { cols: number; rows: number };
  childOffset(depth: number, index: number): { x: number; y: number; child: Size };
  fitScale(depth: number, w: number, h: number, fit?: number): number;
  stopDepth(scale: number, top: number, minPx?: number, maxFills?: number): number;
}

function build(portrait: boolean): Geometry {
  const gridAt = (depth: number): { cols: number; rows: number } => {
    const wide = depth % 2 === 1 ? !portrait : portrait;
    return wide ? { cols: 5, rows: 2 } : { cols: 2, rows: 5 };
  };

  const sizes: Size[] = [{ w: UNIT, h: UNIT }];
  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    const { cols, rows } = gridAt(depth);
    const gap = gapAt(depth);
    const child = sizes[depth - 1];
    sizes.push({
      w: child.w * (cols + (cols - 1) * gap),
      h: child.h * (rows + (rows - 1) * gap),
    });
  }

  // The honest-rendering constant. Past a certain zoom a single dot is smaller
  // than one pixel and cannot be drawn as a dot at all. Rather than inventing a
  // stand-in, the renderer fills the block at this coverage, which reproduces
  // exactly the average brightness those dots would have produced.
  const coverage = sizes.map(
    (size, depth) => (10 ** depth * Math.PI * DOT_RADIUS ** 2) / (size.w * size.h),
  );

  return {
    portrait,
    sizes,
    coverage,
    gridAt,

    childOffset(depth, index) {
      const { cols } = gridAt(depth);
      const gap = gapAt(depth);
      const child = sizes[depth - 1];
      return {
        x: (index % cols) * child.w * (1 + gap),
        y: Math.floor(index / cols) * child.h * (1 + gap),
        child,
      };
    },

    fitScale(depth, w, h, fit = 0.92) {
      const size = sizes[depth];
      return (Math.min(w / size.w, h / size.h) * fit) || 0;
    },

    /**
     * How deep to recurse before filling blocks wholesale.
     *
     * Two guards, both necessary. The first is about truth: below `minPx` a
     * block's children are not separable on screen, so drawing them
     * individually would draw a lie at pixel resolution. The second is about
     * frame budget: a million individual fills will not hold 60fps, and a
     * renderer that stutters during the transition destroys the one thing the
     * transition is there to show.
     */
    stopDepth(scale, top, minPx = 2.4, maxFills = 40_000) {
      let depth = 0;
      while (depth < top && sizes[depth].w * scale < minPx) depth += 1;
      while (depth < top && 10 ** (top - depth) > maxFills) depth += 1;
      return depth;
    },
  };
}

export const LANDSCAPE = build(false);
export const PORTRAIT = build(true);

/** Whichever phasing suits the box the field has to live in. */
export function geometryFor(width: number, height: number): Geometry {
  return height > width ? PORTRAIT : LANDSCAPE;
}
