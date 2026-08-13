# Assignment 1 — How big is a million?

## The breakthrough

The first version of this idea in my head was "each step makes the number
bigger". I sketched it and it was empty: a `1,000` in a larger font teaches
nothing, because scaling the *notation* is not scaling the *quantity*. The
breakthrough was inverting which thing is allowed to move. Fix the dot — one
dot, one size, forever — and move the camera instead. Suddenly every step means
something you can check with your eyes: those are the same dots, there are ten
times as many, and you are further away. The explanation stopped being narration
over a picture and became the picture.

What made it stick was writing the invariant down where code has to obey it.
`DOT_RADIUS` takes no magnitude argument, so there is no place a per-step size
could enter, and a test asserts every block holds exactly ten of the last one. I
have never before turned the *idea* of a piece of work into an assertion. It is
the thing I would do again first.

## What it changed

Halfway through, I found that my render sensor had spent the day measuring a
preview server started ten hours earlier — it answered, so I believed it. My
`CLAUDE.md` already warned about pointing a sensor at the wrong server, and I
had still been fooled, because the old rule only asked whether the server was
*alive*. The new one asks whether it is serving my build, byte for byte.

I want to be the kind of developer who is suspicious of green. Not of failure —
failure announces itself — but of a check that has never been watched going red.
Every sensor I added this week, I broke on purpose first.
