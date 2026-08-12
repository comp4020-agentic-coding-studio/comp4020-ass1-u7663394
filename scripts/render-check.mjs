// Render the built site in real Chrome and report what it actually does.
//
// `pnpm check` proves the HTML is well-formed; it cannot see a layout that
// overflows its viewport, and JSDOM has no layout engine at all. This drives
// Chrome over the DevTools Protocol so the two marked viewports -- 1920x1080
// and 390x844 -- are measured rather than assumed.
//
//   node scripts/render-check.mjs [--shots <dir>]
//
// Exits non-zero if any page overflows its viewport horizontally, loses its
// single h1, or leaves [data-reveal] content transparent at the bottom of the
// page.
//
// Carried forward from comp4020-crit2. Three things are derived rather than
// hardcoded, because the crit2 version pinned all three to that repo and each
// would have failed quietly here:
//   - the base path, read from astro.config.ts (the actual source of truth)
//   - the page list, discovered from dist/ so a new page is checked for free
//   - the preview server, started and stopped by this script rather than
//     assumed to be already running on 4321
// The viewport widths stay hardcoded on purpose: a threshold derived from the
// thing it measures cannot fail, which is the bug that cost the most last week.

import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9333;
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT ?? 4988);
const ORIGIN = `http://localhost:${PREVIEW_PORT}`;

const VIEWPORTS = [
  { name: "desktop", width: 1920, height: 1080, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

const shotsIndex = process.argv.indexOf("--shots");
const shotsDir = shotsIndex === -1 ? null : process.argv[shotsIndex + 1];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The base path Astro is actually configured with, not one we hope matches. */
async function readBase() {
  const config = await readFile("astro.config.ts", "utf8");
  const match = config.match(/base:\s*["'`]([^"'`]*)["'`]/);
  if (!match) throw new Error("no `base` found in astro.config.ts");
  return match[1].replace(/\/$/, "");
}

/** Every built HTML page, as the URL path the preview server serves it at. */
async function discoverPages(dir = "dist", prefix = "") {
  const pages = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...(await discoverPages(full, `${prefix}${entry.name}/`)));
    } else if (entry.name.endsWith(".html")) {
      const isIndex = entry.name === "index.html";
      pages.push({
        path: `/${prefix}${isIndex ? "" : entry.name}`,
        name: (prefix + entry.name.replace(/\.html$/, "")).replace(/\/$/, "") || "index",
      });
    }
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

/** Wait for the preview server to actually answer, rather than sleeping. */
async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`preview server never answered at ${url}`);
}

/** Ask the browser for its debugger websocket, retrying while it boots. */
async function debuggerUrl() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      const info = await response.json();
      return info.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome did not expose a debugger port");
}

/** Minimal CDP client: send a command, resolve on the matching id. */
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = (nextId += 1);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    close: () => socket.close(),
  };
}

/* Runs inside the page. Reports the horizontal overflow and names the
   widest offenders, because "something overflows" is not actionable.
   Compares against the width we asked the browser to emulate, not
   window.innerWidth: a grid track with a min larger than the screen widens
   the layout viewport too, so measuring against innerWidth reported an
   overflow of zero on a page that was 46px too wide for the phone. */
const probeSource = (emulatedWidth) => `(() => {
  const docWidth = document.documentElement.scrollWidth;
  const viewport = ${emulatedWidth};
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const right = rect.right + window.scrollX;
    if (right <= viewport + 1) continue;
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\\s+/).join(".")
      : "";
    offenders.push({
      selector: el.tagName.toLowerCase() + id + cls,
      right: Math.round(right),
      width: Math.round(rect.width),
    });
  }
  offenders.sort((a, b) => b.right - a.right);
  return JSON.stringify({
    docWidth,
    viewport,
    overflow: Math.max(0, docWidth - viewport),
    height: document.documentElement.scrollHeight,
    title: document.title,
    h1: document.querySelectorAll("h1").length,
    offenders: offenders.slice(0, 8),
  });
})()`;

/* Spec line 4: "the visitor does something that changes what they see."
   spec/assignment-1.test.ts asserts the control exists and is reachable; only a
   real browser can answer whether operating it changes anything.

   The keys go through Input.dispatchKeyEvent, NOT an in-page
   `dispatchEvent(new KeyboardEvent(...))`. Synthetic events have
   isTrusted: false, so the browser performs no default action: a perfectly
   good <button> is never activated by Enter and the check reported NO CHANGE on
   a control that worked fine by hand. That false negative would have argued for
   adding a keydown handler to a button that never needed one. CDP-injected keys
   are trusted, so native activation and native range-stepping both just work.

   Operated by keyboard rather than by .click() on purpose -- the marker tabs
   through it, and a mouse-only control passes a click test while still failing
   the artefact band. */
const KEYS = [
  { key: "Enter", code: "Enter", vk: 13, text: "\r" },
  { key: " ", code: "Space", vk: 32, text: " " },
  { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  { key: "ArrowUp", code: "ArrowUp", vk: 38 },
];

const readOutput = `(() => {
  const control = document.querySelector("[data-core-interaction]");
  const output = document.querySelector("[data-core-output]");
  if (!control || !output) return JSON.stringify({ present: false });
  return JSON.stringify({
    present: true,
    focused: document.activeElement === control || control.contains(document.activeElement),
    state: output.innerHTML + "|" + output.textContent.trim()
      + "|" + JSON.stringify(getComputedStyle(output).transform),
  });
})()`;

async function evaluate(client, sessionId, expression) {
  const { result } = await client.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  return JSON.parse(result.value);
}

async function probeInteraction(client, sessionId) {
  await evaluate(
    client,
    sessionId,
    `(() => { document.querySelector("[data-core-interaction]")?.focus(); return "null"; })()`,
  );
  const before = await evaluate(client, sessionId, readOutput);
  if (!before.present) return { present: false };

  for (const { key, code, vk, text } of KEYS) {
    await client.send(
      "Input.dispatchKeyEvent",
      {
        type: text ? "keyDown" : "rawKeyDown",
        key,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        ...(text ? { text } : {}),
      },
      sessionId,
    );
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk },
      sessionId,
    );
    await sleep(150);
  }
  await sleep(300);

  const after = await evaluate(client, sessionId, readOutput);
  return {
    present: true,
    focused: before.focused,
    changed: before.state !== after.state,
  };
}

const BASE = await readBase();
const PAGES = await discoverPages();

if (PAGES.length === 0) {
  console.error("no built pages found in dist/ — run `pnpm build` first");
  process.exit(1);
}

console.log(`base ${BASE}  pages ${PAGES.length}  preview :${PREVIEW_PORT}`);

const preview = spawn(
  "pnpm",
  ["exec", "astro", "preview", "--port", String(PREVIEW_PORT)],
  { stdio: "ignore" },
);

let chrome;
let failures = 0;
let interactionPages = 0;
let interactionWorking = 0;

try {
  await waitForServer(`${ORIGIN}${BASE}/`);

  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${CDP_PORT}`,
      "--user-data-dir=/tmp/render-check-profile",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const client = connect(await debuggerUrl());
  await client.ready;

  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);

  if (shotsDir) await mkdir(shotsDir, { recursive: true });

  for (const viewport of VIEWPORTS) {
    console.log(`\n${viewport.name}  ${viewport.width}x${viewport.height}`);
    for (const page of PAGES) {
      await client.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.mobile,
        },
        sessionId,
      );

      const url = `${ORIGIN}${BASE}${page.path}`;
      await client.send("Page.navigate", { url }, sessionId);
      await sleep(700);

      // Walk the page down in fast steps and stop at the bottom. Measuring
      // here rather than after scrolling back up is the point: at the bottom
      // every reveal should have fired, so anything still hidden is content a
      // reader would never see. Scrolling back first would hide the bug,
      // because low elements are legitimately unrevealed at the top.
      await client.send(
        "Runtime.evaluate",
        {
          expression: `(async () => {
            const step = window.innerHeight * 0.8;
            for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 40));
            }
            await new Promise((r) => setTimeout(r, 250));
          })()`,
          awaitPromise: true,
        },
        sessionId,
      );

      const { result } = await client.send(
        "Runtime.evaluate",
        { expression: probeSource(viewport.width), returnByValue: true },
        sessionId,
      );
      const probe = JSON.parse(result.value);

      // Measured at the bottom of the page, after a deliberately fast scroll:
      // anything still transparent here is content a reader could scroll
      // straight past and never see. Checks computed opacity rather than a
      // class, so it holds however the reveal is implemented.
      const { result: hidden } = await client.send(
        "Runtime.evaluate",
        {
          expression: `[...document.querySelectorAll("[data-reveal]")].filter((el) => {
            const rect = el.getBoundingClientRect();
            const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
            return onScreen && Number(getComputedStyle(el).opacity) < 0.9;
          }).length`,
          returnByValue: true,
        },
        sessionId,
      );

      // Spec line 4: "the visitor does something that changes what they see."
      // spec/assignment-1.test.ts asserts the control exists and is reachable;
      // only a real browser can answer whether operating it changes anything.
      // Acted on by keyboard, not by .click(), because the marker tabs through
      // it -- a mouse-only control passes a click test and still fails the
      // artefact band.
      const core = await probeInteraction(client, sessionId);

      // A page without the marked control isn't a failure -- an explainer may
      // have an about page. A *site* without one is, so that's asserted once at
      // the end rather than per page.
      if (core.present) {
        interactionPages += 1;
        if (core.focused && core.changed) interactionWorking += 1;
      }

      const ok =
        probe.overflow === 0 &&
        probe.h1 === 1 &&
        hidden.value === 0 &&
        (!core.present || (core.focused && core.changed));
      if (!ok) failures += 1;
      const coreStatus = !core.present
        ? "n/a"
        : !core.focused
          ? "not focusable"
          : core.changed
            ? "changes"
            : "NO CHANGE";
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${page.name.padEnd(11)} ` +
          `doc ${String(probe.docWidth).padStart(5)}px  ` +
          `overflow ${String(probe.overflow).padStart(4)}px  ` +
          `h1 ${probe.h1}  unrevealed ${hidden.value}  ` +
          `interaction ${coreStatus.padEnd(13)} height ${probe.height}px`,
      );
      // Only when the document itself overflows. An element wider than the
      // viewport inside an `overflow: hidden` ancestor is a full-bleed
      // background doing its job, not a bug.
      if (probe.overflow > 0) {
        for (const offender of probe.offenders) {
          console.log(`         overflows to ${offender.right}px: ${offender.selector}`);
        }
      }

      if (shotsDir) {
        // Reveals are a scroll-driven animation, so a full-page composite
        // would catch everything below the fold mid-animation. Emulating
        // `prefers-reduced-motion: reduce` switches them off at the media
        // query, giving an honest picture of the layout — and exercising the
        // reduced-motion path at the same time.
        await client.send(
          "Emulation.setEmulatedMedia",
          { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
          sessionId,
        );
        await client.send(
          "Runtime.evaluate",
          {
            expression: `(async () => {
              window.scrollTo(0, 0);
              await new Promise((r) => setTimeout(r, 250));
            })()`,
            awaitPromise: true,
          },
          sessionId,
        );

        const { data } = await client.send(
          "Page.captureScreenshot",
          { format: "png", captureBeyondViewport: true },
          sessionId,
        );
        await writeFile(
          join(shotsDir, `${viewport.name}-${page.name.replace(/\//g, "-")}.png`),
          Buffer.from(data, "base64"),
        );
        await client.send("Emulation.setEmulatedMedia", { features: [] }, sessionId);
      }
    }
  }

  client.close();
} finally {
  chrome?.kill();
  preview.kill();
}

// Spec line 4 is a claim about the site, not about any one page.
if (interactionWorking === 0) {
  failures += 1;
  console.error(
    interactionPages === 0
      ? "\nNo [data-core-interaction] anywhere in the built site. Spec line 4 " +
          "asks that the visitor does something that changes what they see — " +
          "mark the control and the region it changes."
      : "\n[data-core-interaction] found, but operating it by keyboard changed " +
          "nothing in [data-core-output] on any page or viewport.",
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll pages fit both marked viewports, and the core interaction responds.");
