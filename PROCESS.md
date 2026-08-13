# Process overview

## What I built

**How big is a million?** — one dot is one, and the visitor multiplies it by ten
seven times, to 1,000,000. The rule the page never breaks is the argument: the
dot never changes size, only the camera moves back. So each step is ten copies
of what you were just looking at, not a bigger number in a bigger font. By the
end the first dot is still there, marked, and too small to see. The whole idea
lives in one invariant, so most of my effort went into building sensors that
could catch it breaking.

## The moments that mattered

### The screenshots I was looking at were of a state nobody designed

`pnpm shots` took one image per page. For a seven-state explainer that is a
photograph of the landing state and nothing else, so the two magnitudes where
the layout actually gets hard were never in the folder I was reviewing. The
obvious fix was to add a `?step=` query parameter and shoot each URL; that would
have put a feature in the artefact to serve the harness. Instead I taught the
sensor to walk the control it already knew about — if the marked control is a
range, drive it with trusted key events and shoot every value — so the page
gains nothing and the coverage is generic. The first run paid for itself: at
step 2 the drawing was parked between two magnitudes under a caption that said
`100`. Turning on reduced motion mid-zoom only repainted instead of ending the
zoom. I reproduced it by hand before touching anything, then fixed it
([`e834c21`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/e834c21)).

### A check that argues with correct output gets worked around

My carried-forward rule banned root-absolute URLs outright, and it went red on
Astro's own stylesheet — emitted as `/comp4020-ass1-u7663394/_astro/…`, already
carrying the base, and correct on the deployed URL. Two easy exits: delete the
test, or special-case `_astro`. Both leave the rule lying. I restated it as what
actually breaks — a root-absolute URL is an error *unless it carries the deploy
base* — and read the base from `astro.config.ts` rather than writing the path
down twice
([`e834c21`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/e834c21)).
I knew it was right because it stayed red against a planted bare `/about/` and
green against the framework's output.

### The sensor was measuring a server it did not own

A throwaway benchmark could not get a preview server on a free port.
`astro preview status` explained why: a daemon with 35,095 seconds of uptime.
`astro preview` survives `subprocess.kill()`, and a second one prints "already
running" and exits 0 — so every `check:render` run that day had measured a
server started ten hours before the code it was checking, and reported success.
`CLAUDE.md` already carried "a sensor pointed at the wrong server measures
nothing"; the fix it recorded, *start your own server*, turned out to be
necessary and not sufficient. So the new rule is stronger than the old one:
check identity, not liveness. The run now stops any daemon at both ends and
compares the bytes the server returns against `dist/index.html`
([`cdbc3a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/cdbc3a4)).
Verified by parking a foreign static server on the port: it now stops with "is
not serving this build" instead of measuring it.

### Refusing the obvious animation, in a test rather than in my head

The stock move for a page about big numbers is a count-up. `CLAUDE.md` forbids
it — a count-up once left `396` on screen where the source said `687` — but a
prohibition I only remember is one I will drift from at 1am. I encoded it:
figures switch discretely, and the measured dot size is written only after the
tween ends, asserted in `spec/explainer.test.ts`. The same commit holds the
invariance the idea rests on — the unit never scales, every block holds exactly
ten of the last, child 0 stays at the origin — and I falsified the reveal-gating
check with an ungated `display: none` before trusting any of it
([`928a444`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/928a444),
[`af2d3f7`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/af2d3f7)).

## Where to look

`PLAN.md` is what I wrote before any code, and reads honestly against the
result. `CLAUDE.md`'s two new sensor rules are the durable part.
