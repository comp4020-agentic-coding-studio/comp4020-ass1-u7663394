// Contracts this explainer has to keep, asserted against the BUILT page.
//
// These are the "one strong idea" rules written down where a test can hold
// them: what has to be in the served HTML, what may only be hidden once script
// has run, and which figures may never be animated. They describe the page's
// obligations, not its implementation, so they survive a rewrite of the
// renderer or a change of stack.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { MAGNITUDES } from "../src/lib/magnitudes";

const html = readFileSync(resolve("dist/index.html"), "utf8");
const doc = new JSDOM(html).window.document;
const source = readFileSync(resolve("src/scripts/explainer.ts"), "utf8");

describe("the explainer ships its content, not a promise of it", () => {
  it("has every magnitude's text in the served HTML", () => {
    // CLAUDE.md: never make content visibility depend on JavaScript. With the
    // script blocked or still in flight, this page is a readable list of all
    // seven magnitudes rather than a blank frame.
    for (const magnitude of MAGNITUDES) {
      const item = doc.querySelector(`[data-magnitude="${magnitude.step}"]`);
      expect(item, `no served markup for ${magnitude.numeral}`).toBeTruthy();
      expect(item?.textContent).toContain(magnitude.numeral);
      expect(item?.textContent).toContain(magnitude.name);
      expect(item?.textContent).toContain(magnitude.counting);
    }
  });

  it("hides none of it in the served HTML", () => {
    const hidden = [...doc.querySelectorAll("[data-magnitude]")].filter((el) =>
      el.hasAttribute("hidden"),
    );
    expect(
      hidden.length,
      "a magnitude ships hidden, so a reader without script loses it",
    ).toBe(0);
  });

  it("hides nothing except behind an attribute script has already set", () => {
    // The payoff line is the one thing this page withholds. It may only be
    // withheld once script has announced itself with data-js — otherwise a
    // reader whose script never arrives is left with content that is in the
    // HTML and permanently invisible, which is the failure mode with no error
    // message anywhere (CLAUDE.md).
    const href = doc.querySelector("link[rel=stylesheet]")?.getAttribute("href");
    expect(href, "the page ships no stylesheet").toBeTruthy();
    const css = readFileSync(resolve("dist", href!.replace(/^\/[^/]+\//, "")), "utf8");

    const ungated = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, , body]) => /display:\s*none|visibility:\s*hidden|opacity:\s*0\b/.test(body))
      .map(([, selector]) => selector.trim())
      .filter((selector) => /\.payoff|\[data-magnitude/.test(selector))
      .filter((selector) => !selector.includes("[data-js"));

    expect(
      ungated,
      `these rules hide explainer content without waiting for script:\n  ${ungated.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("the core interaction is what the spec says it is", () => {
  it("points every control at the one region that changes", () => {
    const controls = doc.querySelectorAll("[data-core-interaction]");
    const output = doc.querySelectorAll("[data-core-output]");
    expect(controls.length).toBeGreaterThanOrEqual(3);
    expect(output.length).toBe(1);
    for (const control of controls) {
      expect(output[0].contains(control), "a control sits inside its own output").toBe(false);
    }
  });

  it("puts a natively-arrow-steppable control first, where the sensor looks", () => {
    // check:render focuses the FIRST [data-core-interaction] and sends real key
    // events from step 0. A "back" button first would sit disabled at the start
    // of the scale and correctly do nothing, and the sensor would report a
    // break that isn't one.
    const first = doc.querySelector("[data-core-interaction]");
    expect(first?.tagName).toBe("INPUT");
    expect(first?.getAttribute("type")).toBe("range");
    expect(first?.getAttribute("value")).toBe("0");
    expect(Number(first?.getAttribute("max"))).toBe(MAGNITUDES.length - 1);
  });

  it("names the control, and lets a screen reader hear the magnitude", () => {
    const slider = doc.querySelector("[data-scale]");
    const id = slider?.getAttribute("id");
    expect(doc.querySelector(`label[for="${id}"]`)?.textContent?.trim()).toBeTruthy();
    // "3" is not a magnitude. aria-valuetext is what makes the value mean
    // something out loud.
    expect(slider?.getAttribute("aria-valuetext")).toContain(MAGNITUDES[0].numeral);
  });

  it("uses real elements, not divs wearing a handler", () => {
    for (const control of doc.querySelectorAll("[data-core-interaction]")) {
      expect(
        ["INPUT", "BUTTON", "SELECT", "A", "SUMMARY"],
        `<${control.tagName.toLowerCase()}> is not an operable control`,
      ).toContain(control.tagName);
    }
  });
});

describe("no figure is ever animated", () => {
  // CLAUDE.md, earned the hard way: a count-up left 396 on screen where the
  // source said 687. Showing a false number for a second is not a trade worth
  // making, and a number ticking up is exactly the flourish that gets
  // suggested for a page about big numbers.
  it("writes the numeral straight from the data, with no tweening", () => {
    expect(source).not.toMatch(/requestAnimationFrame[\s\S]{0,400}(textContent|innerHTML)\s*=/);
    expect(source).not.toMatch(/\btoFixed\([^)]*\)[\s\S]{0,80}\+=/);
  });

  it("only writes the measured dot size once the drawing has settled", () => {
    // syncMeasurement reads the scale off the render, so calling it mid-tween
    // would print a size that was true for one frame.
    const stepBody = source.slice(source.indexOf("const step = "), source.indexOf("const goTo"));
    const settleIndex = stepBody.indexOf("syncMeasurement()");
    expect(settleIndex, "the measurement is never written").toBeGreaterThan(-1);
    expect(
      stepBody.slice(0, settleIndex),
      "the measurement is written before the tween finishes",
    ).toContain("frameId = 0");
  });
});

describe("the dimensional transition owns its timing once", () => {
  it("feeds linear position into the renderer instead of double-easing it", () => {
    const stepBody = source.slice(source.indexOf("const step = "), source.indexOf("const goTo"));
    expect(stepBody).toContain("lerp(tweenFrom, target, u)");
    expect(stepBody).not.toMatch(/lerp\(tweenFrom, target, ease/i);
  });
});
