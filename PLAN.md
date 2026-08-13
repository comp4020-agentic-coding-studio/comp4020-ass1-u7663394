# Plan — Assignment 1

**How Big Is a Million?**

> Large numbers are easy to read and hard to feel.

This is the working plan: what the thing is, how the interaction does the
explaining, and how each part of the brief, the spec and the HD bands gets
answered. It is written before the code so that later commits can be read
against it.

---

## 1. The idea, in one paragraph

You already know that a million is a thousand thousands. That knowledge is
useless, because the *word* "million" is four syllables and the *quantity* is
not. This explainer puts one dot on the screen and lets the visitor multiply it
by ten, seven times, from **1** to **1,000,000**. The one rule the page never
breaks is the whole argument: **the dot never changes size.** Only the camera
moves back. So each step is not a bigger number written in a bigger font — it is
ten copies of the exact thing you were just looking at, and then the frame pulls
away to fit them. By 1,000,000 the first dot is still there, still the same
size, and you cannot see it any more. That gap — between how easily you read
"1,000,000" and how completely the quantity has escaped you — is the point of
view.

## 2. The core interaction, stated plainly enough to test

> The visitor moves along a scale of powers of ten from 1 to 1,000,000. Each
> move multiplies the number of dots by ten (or divides it by ten going back),
> and the visualisation redraws: the same-sized unit dot, ten times as many of
> them, seen from ten-times-further back. The number, its name, the time it
> would take to count it aloud, and the measured on-screen size of a single dot
> all change with it.

Three ways to move, all driving one output:

- a **range slider** over the seven magnitudes (native arrow-key stepping, and
  draggable by thumb on a phone)
- **Back / Next ×10** buttons
- **←/→** and **A/D** anywhere on the page

In the markup, per `CLAUDE.md`'s convention:

- every control carries **`data-core-interaction`**
- the figure that redraws carries **`data-core-output`** (exactly one)

The slider is deliberately **first in DOM order** among the controls, because
`scripts/render-check.mjs` focuses the *first* `[data-core-interaction]` and
sends `Enter`, `Space`, `ArrowRight`, `ArrowUp`. A range input steps natively on
two of those, from step 0, with no key handler of my own. A "Back" button first
would sit at step 0 and legitimately do nothing, and the sensor would report a
break that isn't one.

## 3. How the interaction does the explanatory work

The failure mode this design exists to avoid: **making the number bigger is not
making the quantity bigger.** A count-up animation, a growing font, a bar that
gets longer — all of those animate the *notation*. The visitor learns nothing
they didn't already know.

So three commitments, which the code has to keep at every step:

1. **The unit is invariant.** One dot always represents 1, and always occupies
   the same distance in the drawing's own coordinate space. The zoom changes;
   the unit does not.
2. **The step is shown, not skipped.** Going from *N* to *10N* is animated as:
   the block you were looking at stays put, nine identical siblings appear
   around it, and the camera pulls back to fit all ten. The visitor watches the
   ×10 happen rather than being handed the result.
3. **The structure nests.** Ten dots make a block, ten blocks make a bigger
   block, and so on — so at every magnitude you can see "ten of the previous
   thing". At 1,000,000 you are looking at one hundred blocks, each of which
   filled the whole screen two steps ago.

Payoff line, revealed at the last step: you have seen every one of these dots
before, at the same size. You just cannot find the first one any more.

## 4. Drawing a million things honestly

A million DOM nodes is not an option, and neither is a lie. The plan:

- Canvas 2D, one `<canvas>`, redrawn on state change and on resize.
- **Nested-block layout**, alternating 5×2 and 2×5 so that every second level is
  a clean square: 1 → 10 (5×2) → 100 (10×10) → 1,000 (50×20) → 10,000 (100×100)
  → 100,000 (500×200) → 1,000,000 (1000×1000).
- **Level of detail:** recurse into a block only while its children are large
  enough on screen to be distinguishable (~3 device px). Below that, fill the
  block with its exact coverage fraction — the proportion of its area the dots
  genuinely occupy. That is the correct rendering of those dots at that zoom,
  not a stand-in for them, and it keeps the work bounded (~10⁴ fills at the
  worst magnitude) instead of 10⁶.
- **Camera** interpolates in log space between the two magnitudes' fits, so the
  zoom-out reads as constant-rate rather than lurching.
- `prefers-reduced-motion: reduce` → jump straight to the settled state.
- `ResizeObserver` + `devicePixelRatio` → redraw sharp at any size, including a
  resize *mid-interaction*, which is one of the things the marker does.

## 5. Honesty rules for the figures

`CLAUDE.md` says every figure carries its source and period, and that no figure
is ever animated. This explainer's figures are chosen so they are **derivable
rather than asserted**, which is the strongest form of that rule:

- **Counting time** — "count these aloud, one per second, without stopping" is
  arithmetic on the magnitude itself. 1,000,000 seconds is 11 days 13 hours 46
  minutes 40 seconds. The assumption is printed next to the number.
- **Dot size** — the on-screen width of one unit is *measured from the render*
  and reported in CSS pixels. At 1,000,000 on a phone it is a fraction of a
  pixel. It is true for the visitor's actual screen, not a claim about screens
  in general.
- Both are written only when the animation has **settled**. No digit is ever
  interpolated, because a wrong number on screen — even for 300 ms — is the
  thing the rule exists to prevent.

No third-party dataset, so no citation block beyond a short note stating those
two assumptions.

## 6. Accessibility and robustness (the artefact HD band)

The band is "holds up under use it wasn't designed for: the keyboard, a resize
mid-interaction, a slow connection."

- **Real controls only** — `<input type="range">` and `<button>`. No div with a
  click handler.
- **Keyboard** — the slider steps natively; buttons take Enter and Space
  natively; ←/→ and A/D work globally but stand down when the slider itself has
  focus, so native stepping is never doubled.
- **Screen readers** — the canvas gets `role="img"` and an `aria-label` that
  restates the current magnitude in words; the caption is an `aria-live="polite"`
  region so the change is announced; the slider has a real `<label>` and
  `aria-valuetext` naming the magnitude rather than reading "3".
- **Focus** — visible `:focus-visible` rings that survive the dark background.
- **Slow connection / no JS** — all seven captions are in the served HTML. The
  script marks the page `data-js="on"`, and only then does CSS collapse the
  inactive ones. Without JS you get a readable static list of every magnitude
  instead of a blank screen. This is `CLAUDE.md`'s rule: never make content
  visibility depend on JavaScript, and if it must be gated, gate it behind
  something JavaScript has already set, with the text still in the HTML.
- **Both viewports** — one column, `clamp()`-based type, the stage sized in
  `svh` so the phone's dynamic toolbar doesn't crop it. Verified with
  `pnpm check:render` at 1920×1080 and 390×844, and by looking at `pnpm shots`.

## 7. Scope: what is deliberately not in this

One idea, carried all the way. So: no other pages, no navbar beyond the single
landmark the invariants require, no scroll-driven sections, no comparison to a
billion, no "fun facts about big numbers", no charts. If it does not serve
*this dot, multiplied by ten*, it does not ship.

## 8. Sensors, and what each one is for

| Sensor | Catches |
| --- | --- |
| `pnpm check` | types, build, lint, and the spec suite (structure, links, evidence) |
| `spec/assignment-1.test.ts` | the core-interaction markup contract, base path, no root-absolute URLs, PROCESS/reflection shape |
| `pnpm check:render` | real Chrome at both marked viewports: overflow, single `h1`, and that *keyboard* operation actually changes `[data-core-output]` |
| `pnpm shots` | what it looks like — read the images, don't assume |

Additions to the harness planned as part of this work, in `spec/`:

- assert the unit-invariance and no-animated-figures rules structurally where
  they can be: that every magnitude's caption text ships in the HTML, and that
  the reveal is gated on `data-js` rather than hidden by default.
- assert the counting-time strings are the arithmetic they claim to be, so a
  typo in a figure is a red test rather than a wrong number on a live page.

`starter.test.ts` gets deleted with the starter page it describes — that is what
its own failure message asks for.

## 9. Order of work, one commit per step

1. Delete the starter page and its test; skeleton page, layout, styles.
2. Magnitude data module (numbers, names, counting time, captions) + its test.
3. Canvas renderer: nested-block layout, LOD, camera fit. Static, no animation.
4. Controls + state wiring; caption and `aria` updates; `data-js` gating.
5. The ×10 transition animation, with reduced-motion honoured.
6. Type, colour, and the two viewports; `check:render` and `shots` green.
7. Harness: the extra spec tests, and any `CLAUDE.md` rule this work earned.
8. `PROCESS.md` (400–600 words, three or four cited moments) and
   `reflections/assignment-1.md`.
9. Ship: public, Pages, verify the live URL at both viewports.
