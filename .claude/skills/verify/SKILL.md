---
name: verify
description: Build, launch and drive the gradient generator end-to-end in headless Chromium (WebGL via SwiftShader) to verify changes at the real UI.
---

# Verifying the Gradient Generator

## Build and server

```bash
npm ci                 # if node_modules does not exist
npm run build          # includes type checking
nohup npm run start > /tmp/server.log 2>&1 &   # serves at http://localhost:3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # expect 200
```

Gotcha: an old `next start` holds port 3000 and serves HTML referencing stale
chunks (400/404 pages, the canvas never mounts). Before re-testing after a
rebuild: `pkill -f next-server` and confirm only one process remains.

## Driving it (Playwright + headless WebGL)

The pre-installed Chromium renders the WebGL shader through SwiftShader:

```js
import { chromium } from "playwright-core" // npm install playwright-core in the scratchpad
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
})
```

### Deterministic state

`reducedMotion: "reduce"` on the context makes the app start paused with the
animation clock at exactly 0 — two renders of the same configuration become
comparable pixel by pixel. To pin the configuration, inject the store before
load:

```js
await page.addInitScript((value) => {
  window.localStorage.setItem("gradient-store", value)
}, JSON.stringify({ state: { /* ... */ }, version: 1 }))
```

Omitting `version` reproduces the localStorage of older releases: zustand does
not call `migrate` in that case, and normalization happens in the persist
`merge`.

### Flows worth driving

- **Canvas mounts**: `page.locator("canvas").count()` ≥ 1 after ~2s. In
  multi-layer mode the answer is **1** canvas (compositing uses render targets,
  not one WebGL context per layer).
- **Store state**: read
  `JSON.parse(localStorage.getItem("gradient-store")).state` for assertions
  (speed, customStops, randomHistory, savedPresets…).
- **Artboard**: the `<canvas>` takes the aspect ratio of the selected artboard —
  `boundingBox()` confirms it. Exporting without touching "Dimensions" inherits
  the artboard size.
- **Export image**: `getByRole("button", { name: "Export Image" })` (the visible
  label is "Image", the accessible name is the full one) → dialog → "Export"
  button → `waitForEvent("download")`; PNG dimensions: `buf.readUInt32BE(16)` ×
  `buf.readUInt32BE(20)`.
- **Timeline**: the thumb has an accessible name —
  `page.getByRole("slider", { name: "Animation time" })` takes focus and arrow
  keys (`Home`/`End` jump to the ends). Play/pause: buttons with aria-label
  "Play animation" / "Pause animation".
- **Seamless loop**: with `loopDuration > 0`, the frame at `t=0` (`Home`) is
  identical to the frame at `t=T` (`End`).
- **Export video**: WebCodecs exists in headless Chromium, but only with **VP9**
  (there is no software AVC/H.264 encoder here) — the app detects this at
  runtime and offers WebM only. Duration and dimensions can be measured by
  loading the blob into a `<video>` on the page itself; comparing the frame at
  `t=0` with the one a cycle later verifies the loop seam.
- **Color stops**: the "Colors" tab exposes the stop list, harmonies, palette
  extraction and the WCAG readout. Stop positions live in `state.customStops`.
- **Share**: "Share" button → `#share-url` input; open the URL in a clean
  `browser.newContext()` and compare the imported state.
- **UI language**: the interface is English-only — selectors use labels such as
  "Randomize", "Restore Defaults", the "Presets" tab.

A 404 in the console used to be the missing favicon; `app/icon.svg` now covers
it, so a 404 is worth investigating.
