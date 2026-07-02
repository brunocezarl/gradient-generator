# @shadercanvas/runtime-sdk

Lightweight embed SDK for ShaderCanvas scenes (WebGL2).

## Build

From the monorepo root:

```bash
npm run build
```

This compiles TypeScript to `dist/` and depends on `@shadercanvas/engine`.

## Run the demo

The demo is a static HTML page that imports the built SDK as an ES module (with an import map for workspace packages).

1. Build all packages from the repo root (see above).

2. Serve the **monorepo root** so `/packages/*` paths resolve:

   ```bash
   npx serve .
   ```

   Or from this package after building:

   ```bash
   npm run demo
   ```

   (`npm run demo` serves the repo root, not just this folder.)

3. Open `http://localhost:3000/packages/runtime-sdk/demo/` (port may vary).

The demo loads `scene.json`, mounts the canvas, and wires buttons for:

- **Play / Pause** — animation loop control
- **flowIntensity slider** — calls `setVariable("flowIntensity", value)`
- **Destroy** — tears down the WebGL context and removes the canvas

## Usage in your site

For production embeds, bundle `@shadercanvas/runtime-sdk` with your app (Vite, webpack, etc.) so dependencies resolve automatically.

```html
<div id="host"></div>
<script type="module">
  import { ShaderCanvas } from "./path/to/runtime-sdk/dist/index.js";

  const instance = await ShaderCanvas.create({
    container: document.getElementById("host"),
    sceneUrl: "/scenes/my-scene.json",
    autoplay: true,
  });

  instance.setVariable("flowIntensity", 0.5);
  instance.pause();
  instance.destroy();
</script>
```

You can pass an inline `scene` object instead of `sceneUrl`. Scene JSON must use `"version": "1.0.0"` (a quoted string).
