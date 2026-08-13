# Process overview

## What I built

**How big is a million?** begins with one point and asks the visitor to multiply
it by ten, six times. The point never changes size. Instead, one point becomes a
line, ten lines become a plane, and ten planes become a volume. The same three
moves then repeat at the scale of whole 1,000-point cubes until the browser is
drawing `100 × 100 × 100`: one million points. The page is deliberately one
screen—one title, one number, one sentence, and one scale—because the spatial
transformation is the explanation.

## The moments that mattered

### The old camera moved, but the idea stayed flat

The first renderer nested ten 2D blocks at every step. It obeyed “ten of the
previous thing”, but every state was still a decorated rectangle; the claimed
camera move did not create spatial understanding. I replaced the layout with an
exact dimensional grammar: `1×1×1 → 10×1×1 → 10×10×1 → 10×10×10`, repeated at
block scale to `100×100×100`. A raw WebGL shader derives all coordinates from
`gl_VertexID`, so the final state is an actual million vertices rather than a
texture labelled “million”. Unit tests hold the ×10 axis change and copy
folding, and all seven desktop/phone screenshots made the conceptual change
visible
([`7b0d858`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/7b0d858)).

### A plausible endpoint hid a bad transition

The settled plane and volume looked right, but fixed-time motion frames showed
the volume mostly present before the plane had time to register. I had eased the
journey across the scale, then eased the camera and copy arrivals again inside
the renderer. Removing the outer easing made the camera’s pull-back readable
before the copies separated. I added a source contract to
`spec/explainer.test.ts` because a screenshot of either endpoint cannot catch
double easing
([`3f2348b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/3f2348b)).

### Faster motion was wrong when it deleted the old state

The `100,000 → 1,000,000` transition measured 5fps under software WebGL because
one million vertices ran on every frame. A deterministic 120,000-point sample
raised that to 28fps desktop and 34fps phone with no long tasks—but its first
frame thinned the 100,000-point plane the visitor already understood. The final
renderer uses two passes: every old point first, then a distributed sample of
the nine arriving copies. The exact million is drawn once on settle. Performance
sampling may reduce future detail; it may not erase the past
([`3f2348b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/3f2348b)).

### One camera view could not show extent and detail

At 100,000 and 1,000,000, additive points collapsed into interference patterns.
A permanent close-up made individual blocks clear but concealed the total size;
the fitted overview did the opposite. I separated those jobs. Each dense state
now holds a complete overview, travels into the lattice, then returns. Every
point stays fixed, while the faces and edges of each 1,000-point volume carry
the structure. A later review found those blocks looked hollow: translucent
front points were writing depth like an opaque shell and hiding every interior
layer. Disabling dense-state depth writes and restoring a clear interior weight
made the full quantity visible without losing the gaps. The overview now holds
for 500ms rather than 1.8 seconds, so inspection begins while the transition
still has momentum. The million overview remains exact and its moving close
view keeps the stable `50×50×50` sample. `pnpm shots:inspection` captures both
views at both marked sizes
([`ec6d17d..85c27db`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/compare/ec6d17d..85c27db)).

## Where to look

`src/lib/layout.ts` is the spatial argument, `src/lib/inspection.ts` is the
dense-state camera path, `src/scripts/lattice-renderer.ts` is the WebGL
implementation, and `CLAUDE.md` records the rules this iteration earned.
