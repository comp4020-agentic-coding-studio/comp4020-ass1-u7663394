# Assignment 1 — How big is a million?

## The breakthrough

The first version of this idea in my head was “each step makes the number
bigger”. I sketched it and it was empty: a `1,000` in a larger font teaches
nothing, because scaling the notation is not scaling the quantity. The
breakthrough was giving each multiplication a spatial consequence. Fix the
point — one point, one size, forever — then let ten points become a line, ten
lines become a plane, and ten planes become a volume. After that, the same three
moves repeat at the scale of whole thousand-point cubes.

Suddenly every step means something I can check with my eyes: the previous form
is still there, nine copies arrive along a new axis, and the camera retreats only
far enough to keep the result in view. The explanation stopped being narration
over a picture and became the picture.

What made it stick was writing that invariant down where code has to obey it.
`DOT_RADIUS` takes no magnitude argument, so there is nowhere a per-step size
could enter. The lattice dimensions and tests assert that every state has
exactly ten times the points of the last and changes only one axis. I have never
before turned the idea of a piece of work into an assertion. It is the thing I
would do again first.

## What it changed

Halfway through, I found that a correct endpoint could hide an incorrect
transition. Fixed-time motion frames showed I had eased the journey twice, so
the new volume appeared before the old plane had time to register. Removing the
outer easing restored the intended two beats: camera first, copies second.

The million-point step exposed a second trap. Drawing every point on every frame
fell to 5fps in software WebGL. Sampling made it fast, but my first sample erased
most of the previous 100,000-point plane. The final transition keeps every old
point and samples only what is arriving, then renders the exact million once it
settles. That distinction — optimise the future without falsifying the past —
is now a rule in `AGENTS.md`.

I want to be the kind of developer who is suspicious of green. Not of failure —
failure announces itself — but of a check that has never been watched going red.
The most important sensor I added copies the WebGL canvas into a surface it can
sample, because a green DOM check cannot tell me whether the main artefact
contains a picture at all.
