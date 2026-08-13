# COMP4020 prototype

This is your starter repo for a COMP4020 prototype. **This week's stack is
Astro**, the course default from C2 onward: pages live in `src/pages/` as
`.astro` files, layouts in `src/layouts/`, styles in `src/styles/`, and
`pnpm build` (`astro build`) emits the built site into `dist/`. The template's
own Vite/plain-HTML default was swapped out — there's no root-level
`index.html` or `main.ts` any more; a new page is a new file under
`src/pages/`. Deploys to GitHub Pages. The
**deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI. To run the links check locally you have to
  reproduce what CI now does --- serve the built site *under the base path* and
  crawl that URL, not `linkinator ./dist`:

  ```sh
  pnpm build && pnpm preview --port 4989 &
  pnpm dlx linkinator "http://localhost:4989/comp4020-ass1-u7663394/" --recurse --silent
  ```
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `astro check` runs first in `pnpm check` (it type-checks
  both `.astro` files and plain `.ts`), so a type error stops the roster before
  the build even starts. The types are extra backpressure: a red here is the
  compiler telling you a claim in the code is false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript (`.astro` files
  aren't linted by either --- `astro check` above is what catches problems in
  them). Flags code that's wrong, fragile, or non-idiomatic. Read the rule it
  names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `AGENTS.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship. CI boots `astro preview` and crawls the site **under the
  base path** (`/comp4020-ass1-u7663394/`), so this sensor now sees the same
  URLs a visitor does. That's a change from the template's old
  `linkinator ./dist`, which served `dist` as a root and so disagreed with the
  deployed site about what a root-absolute link means.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

This week is Astro: every `.astro` (or `.md`) file under `src/pages/` is a
page, and the build picks it up with no config. That's this week's choice, not
a rule (unless the week's spec says otherwise) --- a future week can swap in
plain Vite, a different generator, or hand-written HTML, because nothing in CI
names a tool. The whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so Astro needs `base` set explicitly in
`astro.config.ts` --- already done, to this repo's name, by the stack skill,
which derives it from the origin remote rather than trusting anyone to type it.
Getting `base` wrong looks fine locally while every asset 404s on the live URL.
The config also sets `build.format: "file"` (so `page.astro` builds to
`dist/page.html` and hand-written *relative* links keep working) and
`compressHTML: true`. And commit the updated `pnpm-lock.yaml`: CI installs with
`--frozen-lockfile`.

`pnpm dev` serves under the base path too, deliberately: a path bug reproduces
on localhost instead of only on the live URL. So the dev URL is
`http://localhost:4321/comp4020-ass1-u7663394/`, and the bare root correctly
404s. If 4321 is already taken --- by a dev server left running in another
course repo --- Astro silently picks the next free port. Read the port out of
its startup line rather than assuming; checking the wrong port once already
produced a "broken base path" that did not exist.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `AGENTS.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `AGENTS.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This AGENTS.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

---

# This prototype: an interactive explainer (A1)

**How big is a million?** One point is one. The visitor moves along a scale of
powers of ten from 1 to 1,000,000 — with a range slider, two buttons, or ←/→
anywhere on the page — and each step multiplies the lattice by ten. Its spatial
grammar is exact: `1×1×1 → 10×1×1 → 10×10×1 → 10×10×10`, then the same three
moves repeat at the scale of whole 1,000-point cubes until `100×100×100`. The
rule the page never breaks is the argument: **the point never changes size.** A
step is ten copies of the structure the visitor was just looking at, separated
along one new axis. By 1,000,000 the first point is still there and the quantity
has become a luminous volume. The point of view is the gap between how easily
you read "1,000,000" and how completely the quantity has escaped you.

The core interaction, stated so `spec/assignment-1.test.ts` and
`pnpm check:render` can both hold it: **operating any marked control moves the
magnitude by one power of ten, and the marked output region redraws — the field,
the numeral, its name, the counting time, and the measured on-screen size of one
dot.**

Two rules this idea adds to the ones below, both load-bearing:

- **The unit is invariant.** `DOT_RADIUS` in `src/lib/layout.ts` takes no depth
  argument, so there is nowhere for a per-magnitude size to enter, and
  `src/lib/layout.test.ts` asserts the nesting holds exactly ten of the previous
  block with child 0 at the origin. If that stops being true the page is still
  pretty and no longer says anything.
- **Below one pixel, preserve coverage.** The WebGL point sprite clamps to one
  device pixel because a display cannot emit less, then multiplies opacity by
  the square of the point's projected size. The full million-point overview
  still draws exactly one million vertices. The transition samples only future
  copies; the close inspection uses a stable `50×50×50` spatial sample. Neither
  changes the point size; see the motion rules below.

The rules below are not style preferences. Each one is here because something
went wrong, and the note says what. They were earned in C1 and C2 and carried
forward; the ones that only made sense against last week's prototype have been
cut, and the ones that were about a specific page have been rewritten as the
rule underneath.

## The rendered page is the sensor, not the source

`pnpm check` proves the HTML is well-formed. It has no layout engine — Vitest
runs against JSDOM, which has none at all — so it cannot see a page that
overflows a phone or a section that never becomes visible. **`pnpm check:render`
before committing anything visual.** It builds, serves the site under its base
path, and drives real Chrome over the DevTools Protocol at both marked
viewports (1920×1080 and 390×844), failing on horizontal overflow, on a missing
or duplicated `h1`, and on `[data-reveal]` content still transparent at the
bottom of the page. `pnpm shots` writes full-page screenshots to `.shots/` —
**look at them.** It uses reduced motion to make every overview deterministic;
`pnpm shots:inspection` additionally waits for and captures the close camera
pass at every stage from 100 through 1,000,000.

It discovers its own page list from `dist/`, so a page you add is checked
without touching the script. It is not wired into `pnpm check`: it needs Chrome
and a few seconds, and the fast loop should stay fast.

Three things this cost, which are worth remembering when reading any sensor:

- A naive `chrome --headless --screenshot --window-size=390,844` cropped a
  desktop-width render and looked exactly like a broken mobile layout. Half an
  hour went into a bug that did not exist. If a measurement disagrees with a
  screenshot, trust the measurement and check the screenshot's method.
- `check:render` first compared overflow against `window.innerWidth`, which
  widens along with an overflowing grid track and so reported zero overflow on
  a page 46px too wide. **A sensor that derives its threshold from the thing
  it's measuring cannot fail.** It compares against the requested viewport now.
  Note the boundary: deriving the *page list* from `dist/` is fine, because
  that's an inventory. Deriving the *threshold* from the measurement is not.
- A sensor pointed at the wrong server measures nothing and reports success at
  it. The old version assumed a preview server was already running on 4321; it
  now starts and stops its own, because "remember to boot a server first" is a
  silent-failure mode, not an instruction. **That fix was necessary and not
  sufficient**, which is the sharper version of the lesson: `astro preview` is a
  *daemon*, it survives `subprocess.kill()`, and a second one does not start —
  it prints "already running" and exits 0. A whole day's runs measured a server
  started ten hours earlier. `check:render` now stops any daemon before and
  after, and — the part that actually holds — compares the bytes the server
  hands back against `dist/index.html`. **Check identity, not liveness.** A
  server answering is not evidence it is answering with your build.
- **Screenshot every state the interaction reaches, not the state it lands in.**
  `pnpm shots` used to take one image per page, which for an explainer means
  photographing the first magnitude and none of the six that follow — the two
  where the layout actually gets hard were never in the folder I was looking at.
  It now walks a range control with trusted keys and writes one shot per value.
  The first run of that found a real bug: turning on reduced motion mid-zoom
  only repainted, leaving the drawing parked between two magnitudes under a
  number it did not match.
- **A canvas is opaque to every DOM sensor.** Squeezing the field off the side
  of a phone left the stage blank while the markup check, the interaction check,
  the overflow check and the exception listener all stayed green. `check:render`
  now samples the canvas and reports the fraction of pixels differing from the
  corner — "there is a picture here", without knowing what the picture is. If a
  sensor suite can't see the main artefact, it isn't measuring the artefact.
- **Falsify a new check before trusting it.** Every sensor added this week was
  run against a deliberately planted fault first — `tabindex="-1"` on a control,
  a 700px div, a throwing script, an ungated `display: none`, a foreign server
  squatting on the port. A check that has never been seen to go red is a
  decoration. This is the same lesson as the overflow threshold below, one step
  earlier: don't just ask whether the check *can* fail in principle, watch it.

## Two loops that will not settle

Both are the same mistake as the overflow threshold above, one level out: a
quantity derived from a thing must not also determine that thing.

- **A layout must not depend on a figure measured from the layout.** The
  on-screen size of one dot is read off the render; the render is fitted to
  whatever space the readout leaves; on a phone the readout runs along the
  bottom edge. So letting the figure's own line-wrapping change the readout's
  height closed the circle, and the page reflowed forever — with a
  `ResizeObserver` on the overlays, this hung a whole `check:render` run rather
  than looking wrong. Text that a measurement writes into **reserves its
  height**, and the resize handler returns early unless something actually
  moved.
- **A geometric heuristic has to be about the quantity you need, not a proxy
  for it.** Overlays clip one edge of the drawing's safe box each, and the first
  version chose the edge the overlay sat *nearest*. A full-width bar along the
  bottom of a phone is flush with the left edge too, so it cut the left off the
  whole frame and the field vanished into a 64px sliver off-screen. Choosing by
  the *area* the cut costs is correct because area is what the drawing needs.

## Motion: the step is the explanation

- **Two beats, camera first.** Pull the camera back, *then* let the copies
  arrive. Both on one eased value reads as a dissolve between two pictures; the
  copies moving first would put the beat outside the frame.
- **An arrival may translate; it may never scale.** A copy that grew into place
  would render dots at a size they never have, which is the page contradicting
  its own argument. `easeOutBack` is safe on a translation for the same reason.
- **Watch the transition before believing it.** Every still frame of a broken
  transition looks like a plausible drawing, and `pnpm shots` only photographs
  settled states. Capturing frames at fixed offsets mid-step is how the two
  beats were checked; `src/lib/motion.test.ts` holds the ends and the order so
  a settled magnitude can never differ from the last frame of the step into it.
- **Never ease the timeline twice.** The first 3D pass eased the journey across
  the scale and then applied the camera/copy curves inside each step. A contact
  sheet showed the result: the volume was mostly present before the plane had
  time to register. Position now advances linearly; the dimensional
  choreography owns the easing once. `spec/explainer.test.ts` holds that.
- **A performance sample may omit the future; it may not erase the past.** A
  million vertices every moving frame measured 5fps under software WebGL. The
  first sampled version reached 28–34fps but spread the sample across all ten
  copies, thinning the 100,000 points already on screen. The accepted renderer
  is two passes: every old point, then a deterministic sample of the nine
  arriving copies, with the exact million drawn once on settle. Visual
  continuity is part of correctness, not polish to trade for a benchmark.
- **A spatial quantity needs an overview and an inspection, not one compromise
  view.** From 100 onward, each state holds its exact overview, travels closer,
  then returns. Profiles follow the geometry: the plane glides obliquely, the
  cube orbits through its depth, and the row travels among repeated volumes.
  Reduced motion stays at the overview. `src/lib/inspection.test.ts` holds the
  timing edges, and `pnpm shots:inspection` makes both views reviewable.
- **Reveal hierarchy with light, never geometry.** At dense scales every point
  remains in its exact lattice position and at `DOT_RADIUS`. Interiors recede
  while the faces, edges, and origins of each 1,000-point volume carry the
  image. This makes the repeated unit legible without replacing a million with
  a decorative wireframe.
- **Translucent points must not write an opaque shell.** Depth testing with
  depth writes enabled made the nearest translucent points occlude every layer
  behind them, so fully populated cubes looked hollow. Dense states keep normal
  alpha blending and depth comparison but disable depth writes. Interior,
  face, and edge weights stay explicit and tested in `src/lib/layout.test.ts`.
- **An overview is a beat, not a pause.** Profiles hold their complete view for
  500–700ms before travelling closer. That is enough to register the extent
  without losing momentum. Portrait framing may crop further into long forms;
  the geometry, point size, and reduced-motion overview never change.

## The core interaction is marked in the markup

The spec asks that "the visitor does something that changes what they see" and
that I "state the core interaction plainly enough to write a test for it". That
statement is a convention, not a paragraph:

- the control the visitor acts on carries **`data-core-interaction`**
- the region that changes as a result carries **`data-core-output`** (exactly
  one — several controls driving one output is fine, two outputs is usually two
  ideas, and the spec allows one)

`spec/assignment-1.test.ts` asserts the structure: the control exists, is
keyboard-focusable, and has an accessible name. `pnpm check:render` asserts the
behaviour, by operating it with real keys and checking `[data-core-output]`
actually changed. Between them the spec's central line is mechanically checked
without either test knowing what the idea is, which is what lets the idea change
without the tests needing to.

**Build the control as a real element** — `button`, `input`, `select`,
`details` — rather than a `div` with a click handler. The artefact HD band is
"holds up under use it wasn't designed for: the keyboard, a resize
mid-interaction, a slow connection", and a `div` fails on the marker's first Tab
press. Both sensors reject one.

A note on testing keyboard input, because it cost an hour: an in-page
`dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))` does **not**
activate a native control. Synthetic events have `isTrusted: false`, so the
browser performs no default action, and the first version of the interaction
check reported `NO CHANGE` against a `<button>` that worked perfectly by hand.
It would have argued for adding a `keydown` handler to a button that never
needed one. `check:render` uses CDP's `Input.dispatchKeyEvent`, which is
trusted. **If a sensor says the page is broken, reproduce it by hand before
changing the page** — last week the same shape of error was a cropped
screenshot.

## Never make content visibility depend on JavaScript

If content is hidden by default and revealed by script, the reveal is a race and
the failure is invisible. `IntersectionObserver` only reports a *change* in
intersection, so an element that crosses the viewport between two deliveries —
a flick-scroll, an End keypress, a jump to an anchor — is never reported and
stays at `opacity: 0` permanently, with no error anywhere. Measured last week: 4
of 19 elements revealed at a 40ms scroll step, 19 of 19 at 120ms. A scroll
handler lost the same race.

Reveals go in CSS (`animation-timeline: view()`). If one ever needs to move back
into JavaScript, the hidden state must be gated behind something JavaScript has
already set, and the text must still be in the served HTML — assert that in
`spec/assignment-1.test.ts`.

This matters more this week, not less: an explainer where the visitor scrolls or
drags *is* the genre, so the reveal path is on the critical path to the mark.

## If the explainer carries data, the data has to be honest

Both of these were earned against a corporate site that printed
`9.3 million merchants` with no date — the number was from Q3 2022, and fixing
that was the point of the redesign. They apply here only if the explainer shows
figures, which most explainers do. If it turns out to be a pure mechanic with no
dataset, these two are dead weight and can go.

- **Every figure carries its source and period.** Keep them in a data module
  with the rule stated at the top of the file: if a number can't be sourced, it
  doesn't go in. An explainer's whole claim on a reader's attention is that it's
  telling them something true.
- **Never animate the value of a figure.** A count-up left `396` on screen where
  the source said `687`, and `3.03` for `5.27`, whenever `requestAnimationFrame`
  stopped early. Showing a false number for a second — or leaving one there — is
  not a trade worth making. Motion goes on containers, never on the digits.
  Watch for this one: a number ticking up is a stock explainer flourish, so it's
  exactly the thing that gets suggested.

## Two things the toolchain will keep telling you

- **TypeScript drops `const` narrowing inside hoisted `function` declarations.**
  Thirty-one `'ctx' is possibly 'null'` errors came from guarding
  `getContext("2d")` at the top of a module and reading it inside
  `function paint()`. Arrow consts declared after the guard keep the narrowing.
  Don't reach for `!` — the guard is real, the compiler just can't see the
  ordering.
- **Conform to the linter rather than loosening it.** `stylelint-config-standard`
  rejects BEM `block__element` class names. The obvious move was to relax
  `selector-class-pattern`; the rule went in the config for a reason and my
  naming preference is not one. Renaming to kebab-case cost one command. Change
  a rule when it is *wrong about this codebase*, not when it is inconvenient.

## URLs: relative in the built output, never root-absolute

The site deploys under `…github.io/<repo>/`, so a root-absolute `/about/` is
correct only when served at exactly that prefix. Last week root-absolute links
put 13 broken links in front of CI and would have blocked the deploy, since
`deploy` needs `check`.

The mechanism is different this week, so don't carry last week's fix: there's no
`relative-urls` build integration and no `src/lib/url.ts` here. Instead
`build.format: "file"` means a plain relative `href` resolves correctly both
locally and deployed. So: **author internal links relative** (`./`, `../x/`), or
prefix `import.meta.env.BASE_URL`. Never root-absolute. Assert it in
`spec/assignment-1.test.ts` by resolving every internal link against `dist` —
the same thing CI's crawl does, in milliseconds instead of a pipeline run.

One correction to how that rule is *stated*, which matters more than the rule.
Written as "no root-absolute URLs at all" it went red on Astro's own stylesheet
and script, which it emits as `/comp4020-ass1-u7663394/_astro/…` — already
carrying the base, and correct on the deployed URL. A check that argues with the
framework's correct output is a check that gets worked around instead of read.
It now says what actually breaks: **a root-absolute URL is an error unless it
carries the deploy base**, and the base is read from `astro.config.ts` rather
than written down a second time. When a sensor goes red on something that is
fine, the bug is usually in how the rule is phrased, not in the page — but fix
the phrasing, never the threshold.

## Layout rules that bit

- `repeat(auto-fit, minmax(26rem, 1fr))` **cannot shrink below 26rem**, so it
  overflowed a 390px phone. Always
  `repeat(auto-fit, minmax(min(<size>, 100%), 1fr))`.
- A `position: fixed` header takes no flow height, so the first section slides
  under it. Give the offset back in one place and keep the number in a single
  custom property (`--header-h`) rather than repeating it — two copies drift.
- Format dates with an explicit `en-AU` locale. A bare `toLocaleDateString()`
  renders differently on my machine and on the runner.

## Images and assets: served from this repo, never hotlinked

Downscale into `public/` and serve from here. A third-party CDN can block by
referrer or simply move, and an asset that 404s on the deployed URL counts as
broken even though it loaded locally. Assert no `<img>` has an `http(s)` src.
