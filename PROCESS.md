# Process overview

## What I built

**How big is a million?** — one dot is one, and the visitor multiplies it by ten
seven times, to 1,000,000. The rule the page never breaks is the argument: the
dot never changes size, only the camera moves back. Each step is ten copies of
what you were just looking at, not a bigger number in a bigger font. By the end
the first dot is still there, marked, and too small to see. The whole idea rests
on one invariant, so most of my effort went into sensors that could catch it
breaking — and into refusing the count-up a page about big numbers begs for, in
a test rather than in my head.

## The moments that mattered

### The screenshots were of a state nobody designed

`pnpm shots` took one image per page: for a seven-state explainer, the landing
state and nothing else. The two magnitudes where layout gets hard were never in
the folder I was reviewing. The obvious fix was a `?step=` parameter — a feature
in the artefact to serve the harness. Instead I taught the sensor to walk the
control it already knew about: if the marked control is a range, drive it with
trusted keys and shoot every value. The page gains nothing and the coverage is
generic. The first run paid for itself — at step 2 the drawing sat parked between
two magnitudes under a caption reading `100`, because turning on reduced motion
mid-zoom only repainted instead of ending the zoom. I reproduced it by hand
before touching the page, then fixed it
([`e834c21`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/e834c21)).

### A check that argues with correct output gets worked around

My carried-forward rule banned root-absolute URLs outright, and went red on
Astro's own stylesheet — emitted with the deploy base already on it, and correct
live. Two easy exits: delete the test, or special-case `_astro`. Both leave the
rule lying. I restated it as what actually breaks — root-absolute is an error
*unless it carries the base* — reading the base from `astro.config.ts` rather
than writing the path twice
([`e834c21`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/e834c21)).
It stayed red against a planted bare `/about/` and green against the framework.

### The sensor was measuring a server it did not own

A benchmark could not get a preview server on a free port. `astro preview
status` explained it: a daemon with 35,095 seconds of uptime. `astro preview`
survives `subprocess.kill()`, and a second one prints "already running" and
exits 0 — so every `check:render` run that day had measured a server started ten
hours before the code, and reported success. `CLAUDE.md` already said "a sensor
pointed at the wrong server measures nothing"; the fix it recorded, *start your
own server*, was necessary and not sufficient. The new rule is stronger: check
identity, not liveness. The run stops any daemon at both ends and compares the
served bytes against `dist/index.html`
([`cdbc3a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/cdbc3a4)).
Verified by parking a foreign server on the port.

### The stage was blank and every check said it was fine

Going full-screen meant the renderer had to know which parts of the canvas the
words cover, so overlays clip one edge each — and I picked the edge each overlay
sat *nearest*. A phone's readout spans the full width, so it is flush with the
left edge too; it cut the left off the frame and the field vanished off-screen.
Markup, interaction, overflow and exceptions all stayed green. I found it by
opening the screenshots, which is not a sensor. So beyond fixing the heuristic —
cost by area, because area is what the drawing needs — I taught `check:render`
to sample the canvas and report the fraction of pixels differing from the
corner, then falsified it by restoring the old heuristic: `ink 0.0%`, FAIL on
phone, green on desktop
([`5ecc256`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-u7663394/commit/5ecc256)).

## Where to look

`PLAN.md` predates the code and reads honestly against it. The rules in
`CLAUDE.md` are the durable part.
