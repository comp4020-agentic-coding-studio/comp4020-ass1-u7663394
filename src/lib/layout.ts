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

/** 5 wide x 2 tall on odd levels, 2 wide x 5 tall on even ones. */
export function gridAt(depth: number): { cols: number; rows: number } {
  return depth % 2 === 1 ? { cols: 5, rows: 2 } : { cols: 2, rows: 5 };
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

/** Size of a block at each depth, in world units. */
export const SIZES: readonly Size[] = (() => {
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
  return sizes;
})();

/** Where child `index` of a depth-`depth` block sits, relative to its parent. */
export function childOffset(
  depth: number,
  index: number,
): { x: number; y: number; child: Size } {
  const { cols } = gridAt(depth);
  const gap = gapAt(depth);
  const child = SIZES[depth - 1];
  return {
    x: (index % cols) * child.w * (1 + gap),
    y: Math.floor(index / cols) * child.h * (1 + gap),
    child,
  };
}

/**
 * The fraction of a depth-`depth` block's area that is actually dot.
 *
 * This is the honest-rendering constant. Past a certain zoom a single dot is
 * smaller than one pixel and cannot be drawn as a dot at all. Rather than
 * inventing a stand-in, the renderer fills the block at this coverage, which
 * reproduces exactly the average brightness those dots would have produced.
 */
export const COVERAGE: readonly number[] = SIZES.map((size, depth) => {
  const dots = 10 ** depth;
  return (dots * Math.PI * DOT_RADIUS ** 2) / (size.w * size.h);
});

/** Scale (screen px per world unit) that fits a depth-`depth` block in `w`x`h`. */
export function fitScale(depth: number, w: number, h: number, fit = 0.92): number {
  const size = SIZES[depth];
  return (Math.min(w / size.w, h / size.h) * fit) || 0;
}

/**
 * How deep to recurse before filling blocks wholesale.
 *
 * Two guards, both necessary. The first is about truth: below `minPx` a block's
 * children are not separable on screen, so drawing them individually would draw
 * a lie at pixel resolution. The second is about frame budget: a million
 * individual fills will not hold 60fps, and a renderer that stutters during the
 * transition destroys the one thing the transition is there to show.
 */
export function stopDepth(scale: number, top: number, minPx = 2.4, maxFills = 40_000): number {
  let depth = 0;
  while (depth < top && SIZES[depth].w * scale < minPx) depth += 1;
  while (depth < top && 10 ** (top - depth) > maxFills) depth += 1;
  return depth;
}
