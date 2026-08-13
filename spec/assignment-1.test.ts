// Assignment 1's published spec, as tests.
//
// The spec (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/):
//
//   1. deployed and live at its public GitHub Pages URL by the deadline
//   2. static and client-side throughout, and the starter's invariant checks pass
//   3. it works at both marking viewports (desktop and phone)
//   4. the visitor does something that changes what they see — state the core
//      interaction plainly enough to write a test for it
//   5. one strong idea with a point of view, and nothing else
//   6. evidence of process is in the repo: PROCESS.md, your CLAUDE.md,
//      reflections/assignment-1.md, and a commit history that grew with the work
//
// Lines 2, 4 and 6 are asserted here. The rest are covered elsewhere, on
// purpose:
//
//   line 1  liveness can't be tested from a private repo, and a network test
//           that stays red until Monday is noise, not backpressure. CI's
//           `deploy` job and the course plugin's `ship` / `preflight` skills own
//           it. What IS checkable now — that the deploy is wired and the base
//           path matches this repo — is asserted below, because those are the
//           two ways it silently fails.
//   line 3  needs a layout engine, and JSDOM has none. `pnpm check:render`
//           measures both marked viewports in real Chrome.
//   line 5  "one strong idea with a point of view" is a human judgement. No
//           test can hold it; it's answered at the crit and in PROCESS.md.
//
// These run against the BUILT site, so they check what ships, not the source.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const DIST = resolve("dist");
const REPO = "comp4020-ass1-u7663394";

function htmlFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles().map((path) => ({
  name: relative(DIST, path),
  path,
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));

/* ------------------------------------------------------------------ line 2 */

describe("A1: static and client-side throughout", () => {
  const config = readFileSync("astro.config.ts", "utf8");

  it("declares no server adapter", () => {
    expect(
      /adapter\s*:/.test(config),
      "an adapter means server rendering; A1 must be static",
    ).toBe(false);
  });

  it("does not build in server or hybrid mode", () => {
    const output = config.match(/output\s*:\s*["'`](\w+)["'`]/);
    expect(output?.[1] ?? "static").toBe("static");
  });

  it("ships only files a browser can consume directly", () => {
    // A static site is whatever the browser can fetch and run. Anything that
    // needs a runtime on the other end has no business in dist/.
    const needsARuntime = /\.(php|rb|py|jar|war|exe|node)$/i;
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (needsARuntime.test(entry.name)) offenders.push(relative(DIST, path));
      }
    };
    walk(DIST);
    expect(offenders, `not client-deliverable: ${offenders.join(", ")}`).toEqual([]);
  });

  it("wires the Pages deploy to this repo's base path", () => {
    // Getting this wrong looks perfect on localhost and 404s every asset on
    // the live URL, which is why it's asserted rather than eyeballed.
    expect(config).toMatch(new RegExp(`base:\\s*["'\`]/${REPO}/?["'\`]`));
    expect(
      existsSync(".github/workflows/checks.yml"),
      "the deploy workflow is what makes line 1 possible",
    ).toBe(true);
    expect(readFileSync(".github/workflows/checks.yml", "utf8")).toMatch(
      /deploy-pages|actions\/deploy-pages/,
    );
  });
});

/* ------------------------------------------------------------------ line 4 */

// The spec says: "state the core interaction plainly enough to write a test for
// it." This is that statement, as a convention rather than prose — the control
// the visitor acts on carries `data-core-interaction`, and the region that
// changes as a result carries `data-core-output`. Marking them in the markup is
// what lets a test assert the contract without knowing what the idea is, and it
// survives a change of approach or of stack.
//
// Structure and keyboard reachability are asserted here. Whether acting on the
// control actually changes what you see needs real events and a layout engine,
// so `pnpm check:render` asserts the behaviour.

const NATIVELY_FOCUSABLE = "a[href], button, input, select, textarea, summary, details";

describe("A1: the visitor does something that changes what they see", () => {
  const controls = pages.flatMap(({ name, doc }) =>
    [...doc.querySelectorAll("[data-core-interaction]")].map((el) => ({ page: name, el })),
  );
  const outputs = pages.flatMap(({ name, doc }) =>
    [...doc.querySelectorAll("[data-core-output]")].map((el) => ({ page: name, el })),
  );

  it("marks at least one control as the core interaction", () => {
    expect(
      controls.length,
      "no [data-core-interaction] in the built site — mark the control the " +
        "visitor acts on, so the core interaction is stated in the markup",
    ).toBeGreaterThan(0);
  });

  it("marks exactly one region as what the interaction changes", () => {
    // Several controls driving one output is fine and common — three sliders
    // over one simulation. Two separate outputs is usually two ideas, which
    // line 5 says you don't get.
    expect(
      outputs.length,
      `found ${outputs.length} [data-core-output] regions; one strong idea changes one thing`,
    ).toBe(1);
  });

  it("makes every core control reachable and operable by keyboard", () => {
    // The artefact HD band is "holds up under use it wasn't designed for: the
    // keyboard, a resize mid-interaction, a slow connection". A div with a
    // click handler fails that on the marker's first Tab press.
    for (const { page, el } of controls) {
      const focusable =
        el.matches(NATIVELY_FOCUSABLE) || Number(el.getAttribute("tabindex") ?? "-1") >= 0;
      expect(
        focusable,
        `${page}: <${el.tagName.toLowerCase()} data-core-interaction> is not ` +
          `keyboard-focusable — use a real control, or add tabindex="0" and key handling`,
      ).toBe(true);
    }
  });

  it("gives every core control an accessible name", () => {
    for (const { page, el } of controls) {
      const name =
        el.textContent?.trim() ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        (el as HTMLInputElement).labels?.length;
      expect(
        Boolean(name),
        `${page}: <${el.tagName.toLowerCase()} data-core-interaction> has no ` +
          `accessible name — a control nobody can name is a control nobody can use`,
      ).toBe(true);
    }
  });
});

/* ---------------------------------------------- carried forward from crit 2 */

describe("A1: internal links survive the base path", () => {
  // Root-absolute URLs are correct only when served at exactly the deploy
  // prefix. In crit 2 they put 13 broken links in front of CI and would have
  // blocked the deploy, since `deploy` needs `check`.
  //
  // The first version of this test banned root-absolute URLs outright, and it
  // went red on the stylesheet and the script — which Astro emits as
  // `/comp4020-ass1-u7663394/_astro/…`, already carrying the base. Those
  // resolve correctly on the deployed URL; a bare `/about/` does not. Banning
  // both put the sensor in the position of arguing against the framework's
  // correct output, which is how a check gets worked around instead of read.
  //
  // So the rule is stated as what actually breaks: a root-absolute URL is an
  // error unless it is prefixed with the configured base. The base is read
  // from astro.config.ts rather than written down a second time, because two
  // copies of a path drift.
  const BASE = (readFileSync("astro.config.ts", "utf8").match(
    /base:\s*["'`]([^"'`]*)["'`]/,
  )?.[1] ?? "").replace(/\/$/, "");

  const internal = (value: string): boolean =>
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);

  it("knows the base path it is checking against", () => {
    expect(BASE, "astro.config.ts has no `base`, so this test can't mean anything")
      .not.toBe("");
  });

  it("root-absolute URLs all carry the deploy base", () => {
    const offenders: string[] = [];
    for (const { name, doc } of pages) {
      for (const el of doc.querySelectorAll("[href], [src]")) {
        const value = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
        if (!value.startsWith("/") || value.startsWith("//")) continue;
        if (value === BASE || value.startsWith(`${BASE}/`)) continue;
        offenders.push(`${name}: ${value}`);
      }
    }
    expect(
      offenders,
      `root-absolute URLs without the base ${BASE} 404 on the deployed site.\n` +
        `Author internal links relative (./, ../) or prefix import.meta.env.BASE_URL:\n  ` +
        offenders.join("\n  "),
    ).toEqual([]);
  });

  it("resolves every internal URL to something that was built", () => {
    // Both kinds, resolved the way a browser would: relative against the page,
    // base-prefixed against dist. The same thing CI's crawl does, in
    // milliseconds instead of a pipeline run.
    const missing: string[] = [];
    for (const { name, path, doc } of pages) {
      for (const el of doc.querySelectorAll("a[href], link[href], script[src], img[src]")) {
        const raw = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
        if (!internal(raw)) continue;
        const clean = raw.split("#")[0].split("?")[0];
        if (clean === "") continue;

        const target = clean.startsWith("/")
          ? resolve(DIST, clean.slice(BASE.length + 1) || ".")
          : resolve(dirname(path), clean);
        const candidates = [target, `${target}.html`, join(target, "index.html")];
        const found = candidates.some(
          (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
        );
        if (!found) missing.push(`${name}: ${raw}`);
      }
    }
    expect(missing, `dead internal URLs:\n  ${missing.join("\n  ")}`).toEqual([]);
  });
});

describe("A1: assets are served from this repo", () => {
  it("hotlinks no images", () => {
    // A third-party CDN can block by referrer or simply move, and an asset
    // that 404s on the deployed URL counts as broken even though it loaded
    // locally. Downscale into public/ and serve from here.
    const offenders: string[] = [];
    for (const { name, doc } of pages) {
      for (const img of doc.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? "";
        if (/^https?:\/\//i.test(src)) offenders.push(`${name}: ${src}`);
      }
    }
    expect(offenders, `hotlinked images:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});

/* ------------------------------------------------------------------ line 6 */

// `pnpm check:evidence` already verifies that citations resolve to real
// commits, that reflections/assignment-1.md exists, and that CLAUDE.md is
// present. It cannot know what THIS brief adds on top, so that's what's here:
// 400–600 words, three or four moments, and a history that grew.

const MOMENTS_HEADING = /^##\s+.*moments?\b/im;

/** Prose only: no HTML comments, no fenced code, no link targets, no headings. */
function wordCount(markdown: string): number {
  const prose = markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/[*_>|-]/g, " ");
  return prose.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
}

describe("A1: evidence of process", () => {
  it("has a PROCESS.md with the template boilerplate removed", () => {
    const process = readFileSync("PROCESS.md", "utf8");
    expect(process).not.toMatch(/TEMPLATE: this file is a shape to fill in/);
    expect(
      process,
      "the worked example is there to show the shape, not to be shipped",
    ).not.toMatch(/A worked moment, for shape/);
  });

  it("runs PROCESS.md to 400–600 words, as this brief asks", () => {
    const words = wordCount(readFileSync("PROCESS.md", "utf8"));
    expect(words, `PROCESS.md is ${words} words; the brief asks for 400–600`)
      .toBeGreaterThanOrEqual(400);
    expect(words, `PROCESS.md is ${words} words; the brief asks for 400–600`)
      .toBeLessThanOrEqual(600);
  });

  it("carries three or four moments, each with a citation", () => {
    // The convention: one `###` subsection per moment, under the `##` moments
    // heading. The brief caps it at three or four "because each needs room to
    // say what you did instead of the obvious thing and how you knew the
    // result was right".
    const process = readFileSync("PROCESS.md", "utf8");
    const start = process.search(MOMENTS_HEADING);
    expect(start, "no `## ...moments...` section in PROCESS.md").toBeGreaterThan(-1);

    const after = process.slice(start);
    const nextTop = after.slice(1).search(/^##\s(?!#)/m);
    const section = nextTop === -1 ? after : after.slice(0, nextTop + 1);
    const moments = section.split(/^###\s+/m).slice(1);

    expect(
      moments.length,
      `found ${moments.length} moments (### subsections); the brief asks for three or four`,
    ).toBeGreaterThanOrEqual(3);
    expect(moments.length).toBeLessThanOrEqual(4);

    for (const [index, moment] of moments.entries()) {
      expect(
        /\]\(https:\/\/github\.com\/[^)]+\/(commit|compare)\/[^)]+\)/.test(moment),
        `moment ${index + 1} cites no commit or compare URL — a claim the ` +
          `history doesn't back doesn't count`,
      ).toBe(true);
    }
  });

  it("has a substantive reflections/assignment-1.md", () => {
    // The exact filename is the assignment's, and the week-4 retro reads this
    // same entry — there is nothing to write twice.
    const path = "reflections/assignment-1.md";
    expect(existsSync(path), `${path} is what the marker and the retro read`).toBe(true);
    const words = wordCount(readFileSync(path, "utf8"));
    expect(words, `${path} is ${words} words — that isn't a reflection yet`)
      .toBeGreaterThan(150);
  });

  it("has a CLAUDE.md grown past the template's boilerplate", () => {
    const claude = readFileSync("CLAUDE.md", "utf8");
    expect(claude.length).toBeGreaterThan(0);
    expect(
      wordCount(claude),
      "CLAUDE.md is still boilerplate-sized; the gap between it and the " +
        "starter is what's read as evidence",
    ).toBeGreaterThan(wordCount(readFileSync("spec/README.md", "utf8")));
  });

  it("has a commit history that grew with the work", () => {
    // A proxy, and deliberately a lenient one: it can't see whether the work
    // was directed well, only whether the trail was laid as it happened
    // rather than dumped the night before.
    const log = execFileSync("git", ["log", "--format=%cs"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    const days = new Set(log);
    expect(log.length, `${log.length} commits so far`).toBeGreaterThanOrEqual(6);
    expect(
      days.size,
      `every commit lands on ${[...days].join(", ")} — a trail that grew ` +
        `alongside the code spans more than one day`,
    ).toBeGreaterThanOrEqual(2);
  });
});
