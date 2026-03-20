# WebXR Visualizer Foundation

Local WebXR prototype built with plain HTML and vanilla JavaScript. The project currently focuses on a stable XR baseline for an audiovisualizer: reliable movement, a usable in-headset menu, shared audio-reactive scene lighting, and Butterchurn-driven visuals that already run before a live audio source is selected.

## Current Feature Set

- immersive XR startup with `local-floor`, preferring `immersive-ar` and falling back to `immersive-vr`
- desktop preview when no XR session is active
- immediate Butterchurn startup on page load
- XR and desktop locomotion with jumping, sprinting, crouching, tiptoe head-height control, and airborne boost
- collision world with floor, platforms, walls, and a remote goat GLB prop
- in-headset menu plus mirrored desktop preview for debugging the same menu
- audio-reactive floor colors and shared scene lighting
- lighting presets: `Aurora Drift`, `Disco Storm`
- passthrough blend modes: `Uniform`, `Flashlight`
- uniform passthrough submodes: `Manual`, `Music`
- passthrough lighting modes: `None`, `Uniform`, `Spots`
- visualizer modes: `Toroidal`, `Skysphere`, `Sky Toroid`
- audio input from shared display/tab audio, microphone, YouTube playlist, Suno Live Radio, or synthetic `Debug Audio`

## Project Structure

- `index.html`: browser entry point, desktop shell, buttons, status labels, and main canvas
- `xr-foundation.js`: shared browser, XR, math, and rendering helpers
- `xr-audio-controller.js`: audio capture, analyser pipeline, stereo metrics, and debug synth
- `xr-light-presets.js`: lighting preset catalog and preset state builders
- `xr-visualizer.js`: visualizer engine, Butterchurn integration, and preset lifecycle
- `xr-visualizer-modes.js`: visualizer mode catalog
- `xr-passthrough-modes.js`: pure passthrough mode catalog and blend formulas
- `xr-passthrough.js`: passthrough controller, fallback policy, background-composite state, and overlay-lighting compositor
- `xr-menu-sections.js`: generic menu section/control descriptors for lower interactive menu groups
- `xr-world.js`: collision world, locomotion, GLB loading, and scene renderer
- `xr-menu.js`: menu canvas rendering, desktop preview, and XR/desktop menu interaction
- `xr-app.js`: app config, composition, startup, and runtime orchestration

## Requirements

- a modern desktop browser with WebGL support
- a browser/runtime combination with WebXR support for immersive mode
- a VR headset supported by that browser for actual headset sessions
- a passthrough-capable headset/browser combination if the AR passthrough blend modes should reveal the real environment instead of the black fallback
- microphone or screen/tab-capture permission if live audio input should drive the scene
- popup permission if `YouTube Playlist` or `Suno Live Radio` should open their source tabs automatically

## Website

[https://phobi82.github.io/webxr_butterchurn/](https://phobi82.github.io/webxr_butterchurn/)

## Run Locally

There is no build step and no backend.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a WebXR-capable browser.
3. Wait for the XR status line to report readiness.
4. Use the desktop shell to test audio input, menu options, and preview movement.
5. Enter VR when the browser reports headset support.

### Local HTTPS For Quest

For headset testing in the Quest Browser on the same network, use:

- `start-local-https-server.bat`

That launcher:

- starts a small HTTPS static server on port `8443`
- uses helper files from `local-dev-https/`
- generates a local self-signed certificate in `local-dev-https/local-dev-cert.pfx` when needed
- prints the `https://...:8443/` URLs to open from the Quest on the same LAN

If the Quest Browser shows a certificate warning, continue manually once for local development.

## Audio Sources

- `Share Audio`: capture audio from a shared display, window, or tab
- `Use Microphone`: capture microphone input
- `Debug Audio`: synthetic source for visualizer and lighting debugging
- `YouTube Playlist`: opens the configured playlist tab and expects tab-audio sharing
- `Suno Live Radio`: opens Suno Live Radio and expects tab-audio sharing
- `Stop Audio`: disconnects the active source

## Desktop Preview Controls

- click the main view: request pointer lock
- mouse: look around
- left mouse button: sprint while held
- right mouse button: crouch while held
- `W`, `A`, `S`, `D`: move
- `Space`: jump
- `M`: show or hide the mirrored menu preview

The mirrored desktop menu is hidden on startup and uses the same canvas/menu system as the in-headset version.

## VR Controls

- left stick: move
- left trigger: sprint
- right stick X: turn
- right stick Y: persistent crouch / temporary tiptoe head-height input
- `A` on the right controller: jump, hold briefly for extra height
- right trigger while airborne: directional air boost
- `Y` on the left controller: open or close the in-headset menu
- trigger on menu controls: press buttons and drag sliders

XR stick movement and airborne boost now drive the same horizontal movement velocity, so steering in the air no longer stacks a separate direct stick translation on top of boost momentum, while partial stick tilt still scales movement speed analogically after the deadzone.

## In-Headset Menu

The current menu exposes:

- jump mode: `Double`, `Multi`
- world opacity slider for floor, grid, and level blocks; GLB props stay opaque
- passthrough group:
  - blend mode cycler: `Uniform`, `Flashlight`
  - `Uniform Blend`: `Manual`, `Music`
  - `Uniform` + `Manual`: `Mix`
  - `Uniform` + `Music`: bipolar `Intensity` with end labels `Vis -> Passthrough` and `Passthrough -> Vis`
  - `Flashlight`: `Radius` and `Softness`
- scene lighting group:
  - `Lighting Mode` cycler: `None`, `Uniform`, `Spots` with `Spots` as the default
  - `Light Preset` cycler
- eye distance slider
- visualizer mode selector
- Butterchurn preset selector
- live audio meters for `Level`, `Peak`, `Bass`, `Transient`, and `Beat`

## Visualizer Modes

| Mode | Mapping | Roll | Poles | Description |
|---|---|---|---|---|
| **Toroidal** | Screen-space UV + head yaw/pitch offset | Rotates with head roll | None | Flat fullscreen quad with toroidal texture wrapping driven by head orientation. Fastest and simplest mode. |
| **Skysphere** | 3D raycasting via view matrix to spherical coordinates | Stable | Convergence at poles | Computes world-space view direction per pixel, converts to yaw/pitch, and tiles the texture. Background stays fixed in world space during roll. |
| **Sky Toroid** | View-space angular offsets with roll correction + head yaw/pitch | Stable | None | Computes per-pixel angular offsets in view space, counter-rotates by the camera roll, then adds world-space head orientation. Combines the roll stability of Skysphere with the pole-free tiling of Toroidal. |

## Current Status

- The app starts the visualizer engine immediately, but audio-reactive behavior only becomes meaningful once an audio source is active.
- Passthrough now runs through a dedicated controller/orchestrator plus a separate pure mode-definition module instead of mixing mode logic into the visualizer or menu.
- `Uniform` keeps one shared full-screen blend path, while `Flashlight` reveals passthrough through two soft hand-controlled masks.
- `Uniform` splits into `Manual` and `Music`; the bipolar `Intensity` slider now spans a stronger full-range audio blend, clearly separates positive from negative direction, and labels the two directions as `Vis -> Passthrough` and `Passthrough -> Vis`.
- The lower interactive menu area now flows from generic section/control descriptors, so passthrough, scene lighting, world opacity, eye distance, jump mode, visualizer mode, and presets all share the same generic layout, rendering, and hit-test path.
- The passthrough controls stay grouped together, while `Scene Lighting` is separated into its own section with `Lighting Mode` and `Light Preset`; `Spots` is now the default lighting mode.
- Lighting can now be disabled, applied as one music-reactive uniform tint, or rendered as soft colored spots derived from the active lighting preset.
- Desktop preview, opaque VR, and unsupported AR still use the same blend modes against a black fallback instead of live passthrough.
- Translucent world and menu draws now preserve the correct XR framebuffer alpha, so grid lines and semi-transparent blocks do not leak passthrough when the configured background behind them is meant to stay opaque.
- The XR menu hit path no longer crashes when pointing at the menu after the generic section refactor; the earlier `undefined.length` hit-test regression is fixed.
- XR menu controller state now drops stale hand ownership when a tracked-pointer hand disappears for a frame, so left/right controller buttons no longer stay blocked by a stuck menu hand state.
- The goat GLB is loaded from a remote URL, so that asset depends on network availability even when `index.html` is opened locally.

## GitHub Pages

- `.github/workflows/deploy-pages.yml` deploys the site on pushes to `main`
- repository Pages settings should use `Build and deployment -> Source -> GitHub Actions`

## Acknowledgements

Parts of this project are derived from or based on Butterchurn, and this repository also bundles Butterchurn preset data.

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## License

No license has been declared for this repository itself yet.

Bundled third-party components:

- `butterchurn.min.js` is derived from or based on `jberg/butterchurn` and is covered by the MIT License
- `butterchurnPresets.min.js` is derived from or based on `jberg/butterchurn-presets`, which is published on GitHub as MIT-licensed

If you redistribute or modify the bundled Butterchurn files, keep the upstream copyright and permission notices with them and verify the current upstream license files during release review:

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## Changelog

Project history is tracked in [`CHANGELOG.md`](./CHANGELOG.md).
