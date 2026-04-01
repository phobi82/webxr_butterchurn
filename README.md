# WebXR Visualizer

Local WebXR prototype built with plain HTML and vanilla JavaScript. The project currently focuses on a stable XR baseline for an audiovisualizer: reliable movement, a usable in-headset menu, shared audio-reactive scene lighting, and Butterchurn-driven visuals that already run before a live audio source is selected.

## Disclaimer

> [!WARNING]
> ### Photosensitivity / Epilepsy Warning
> This project contains flashing lights, rapid visual changes, and intense motion that may trigger seizures or cause discomfort in people with photosensitive epilepsy or related conditions.
>
> Please use caution and stop immediately if you experience any discomfort.

> [!CAUTION]
> ### Motion Sickness Warning
> This project may cause motion sickness, dizziness, nausea, and disorientation, especially in VR.
>
> It intentionally includes no comfort features whatsoever.  
> No teleport. No tunnel vision. No training wheels.  
> The experience is designed to be intense, because VR should sometimes feel a little overwhelming.
>
> Proceed at your own risk - and maybe not right after lunch.

## Current Feature Set

- immersive XR startup with `local-floor`, preferring `immersive-ar` and falling back to `immersive-vr`
- desktop preview plus shared desktop/XR locomotion with jumping, sprinting, crouching, tiptoe head-height control, and airborne boost
- immediate Butterchurn startup on page load
- collision world with floating platforms, side structures, and a remote goat GLB prop
- in-headset menu plus mirrored desktop preview using the same menu system
- audio-reactive floor colors and shared scene lighting
- lighting presets: `Aurora Drift`, `Disco Storm`, `Neon Wash`, `Stereo Chase`, `Pulse Strobe`
- background mix modes: `manual`, `sound-reactive`
- passthrough controls: `Flashlight` plus optional `Depth` with shared full-resolution `Reconstruction` (`Raw`, `Edge-aware`, `Heightmap`), a `Radial` toggle for equal-range depth masking, and `Distance`/`Echo` modes in immersive AR
- passthrough lighting modes: `None`, `Uniform`, `Spots`, `Club`
- optional WebXR depth sensing for depth-aware passthrough lighting and depth punch controls in immersive AR (only Quest 3 in Quest-Browser for now)
- experimental WebXR projection-layer rendering with automatic fallback to `XRWebGLLayer`, plus runtime diagnostics that show whether the session is using the compositor-backed projection path or the legacy base-layer path
- visualizer modes: `Toroidal`, `Skysphere`, `Sky Toroid`
- audio input from shared display/tab audio, microphone, `YT Synth`, `YT House/Disco`, Suno Live Radio, or synthetic `Debug Audio`
- separate [`TestLab.html`](./TestLab.html) page for isolated single-effect lighting tests on desktop and in VR

## Project Structure

- `index.html`: browser entry point, desktop shell, buttons, status labels, and main canvas
- `xr-foundation.js`: shared browser, XR, math, and rendering helpers
- `xr-audio-controller.js`: audio capture, analyser pipeline, stereo metrics, club-lighting derived metrics, and debug synth
- `xr-light-fixture-effects.js`: shared fixture-effect families and passthrough effect semantics
- `test-lab-lighting-presets.js`: isolated single-effect preset catalog used by `TestLab.html`
- `xr-light-presets.js`: lighting preset catalog, fixture-rig builders, and scene-light derivation
- `xr-visualizer.js`: visualizer engine, Butterchurn integration, and preset lifecycle
- `xr-visualizer-modes.js`: visualizer mode catalog
- `xr-passthrough-modes.js`: background mix, passthrough, and lighting control definitions
- `xr-passthrough.js`: passthrough controller, fallback policy, background-composite state, and overlay-lighting compositor
- `xr-depth-processing.js`: shared full-resolution depth reconstruction prepass for raw, edge-aware, and heightmap depth processing, preferring float render targets to avoid 8-bit mask banding when the browser supports them
- `xr-menu-sections.js`: generic menu section/control descriptors for lower interactive menu groups
- `xr-world.js`: collision world, locomotion, GLB loading, and scene renderer
- `xr-menu.js`: menu canvas rendering, desktop preview, and XR/desktop menu interaction
- `xr-shell.js`: explicit DOM-shell contract plus reusable shell normalization/builder helpers
- `xr-runtime.js`: shared runtime orchestration for XR sessions, desktop preview, audio wiring, and render-loop flow
- `app-composition.js`: default app configuration and shared app composition over the shell/runtime modules

## Requirements

- a modern desktop browser with WebGL support
- a browser/runtime combination with WebXR support if immersive mode should be available
- a supported headset/browser combination for actual VR or AR sessions
- a passthrough-capable headset/browser combination if immersive AR should reveal the real environment instead of the black fallback
- depth-sensing-capable AR browser/runtime support if depth-aware passthrough controls and light scaling should use sensed real-world depth instead of the built-in ceiling/wall/floor fallback anchors
- microphone or screen/tab-capture permission if live audio input should drive the scene
- popup permission if `YT Synth`, `YT House/Disco`, or `Suno Live Radio` should open their source tabs automatically

## Website

[https://phobi82.github.io/webxr_butterchurn/](https://phobi82.github.io/webxr_butterchurn/)

## Run Locally

There is no build step and no backend.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a modern browser.
3. Wait for the XR status line to report readiness.
4. Use the desktop shell to test audio input, menu options, and preview movement.
5. Enter immersive mode when the browser and headset report support.

### Local HTTPS For Quest

For headset testing in the Quest Browser on the same network, use:

- `start-local-https-server.bat`

That launcher:

- starts a small HTTPS static server on port `8443`
- uses helper files from `local-dev-https/`
- generates a local self-signed certificate in `local-dev-https/local-dev-cert.pfx` when needed
- prints the `https://...:8443/` URLs to open from the Quest on the same LAN

If the Quest Browser shows a certificate warning, continue manually once for local development.

### Quest Debugging Over Wi-Fi

For longer Quest debugging sessions, switch `adb` from USB to Wi-Fi after the headset is authorized once over USB.

1. Connect the Quest once over USB and confirm USB debugging on the headset.
2. Run `adb tcpip 5555`.
3. Read the Quest Wi-Fi address, for example with `adb shell ip addr show wlan0`.
4. Connect over Wi-Fi with `adb connect <quest-ip>:5555`.
5. Verify that `adb devices` lists the Quest on `<quest-ip>:5555`, then unplug USB if needed.

For Quest Browser remote debugging, forward the DevTools socket and inspect the target list:

- `adb forward tcp:9222 localabstract:chrome_devtools_remote`
- open `http://127.0.0.1:9222/json/list`

Notes:

- Quest Browser page targets can change after reloads or crashes, so refresh `json/list` before attaching again.
- Remote reload is useful, but `Enter VR` usually still needs a real headset-side user interaction; a remote button click is not a reliable WebXR user gesture on Quest.

## Audio Sources

- `Select Audio-Source`: capture audio from a shared display, window, or tab
- `Use Microphone`: capture microphone input
- `Debug Audio`: synthetic source for visualizer and lighting debugging
- `YT Synth`: opens the configured synth-oriented YouTube playlist tab and expects tab-audio sharing
- `YT House/Disco`: opens the configured house/disco YouTube playlist tab at its first selected track and expects tab-audio sharing
- `Suno Live Radio`: opens Suno Live Radio and expects tab-audio sharing
- `Stop Audio`: disconnects the active source

## Effect Test Lab

- Open [`TestLab.html`](./TestLab.html) when you want to inspect one lighting effect at a time instead of testing full presets.
- The test lab starts with `Passthrough = Uniform -> Manual -> Mix 100%`, neutral floor/grid colors, and a room-style preview so the active effect stays easy to judge in isolation.
- Desktop control goes through the mirrored menu, which is visible by default and still toggled with `M`, matching the in-headset interaction path.
- The catalog cycles one isolated setup per effect, and also includes `Flashlight` inside the shared Club/effect pipeline.
- The page keeps the normal XR entry path, including the same shared depth/passthrough runtime modules as `index.html`, and uses a reduced in-headset menu with `Active Effect`, `use Depth`, `Darkness`, `Additive`, `Alpha Blend`, focused audio meters, and `Exit VR`. In the test lab, the visualizer background layer is disabled by the app render policy, and `use Depth` only enables the sensor plus reconstruction pipeline for depth-aware light placement; it does not turn on the separate shared `Distance` or `Echo` passthrough mask visuals.
- Both pages now use the same declarative menu action path: controls provide structured `action` objects plus `hoverKey` metadata, and desktop clicks plus XR triggers go through one shared runtime dispatcher/registry instead of page-specific control branches or menu-aware domain modules.

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
- `Y` on the left controller or `B` on the right controller: open or close the in-headset menu
- trigger on menu controls: press buttons and drag sliders
- in-headset menu: `Exit VR` button to end the current immersive session

XR stick movement and airborne boost now drive the same horizontal movement velocity, so steering in the air no longer stacks a separate direct stick translation on top of boost momentum, while partial stick tilt still scales movement speed analogically after the deadzone.

## In-Headset Menu

The current menu exposes:

- jump mode: `Double`, `Multi`
- eye distance slider
- world opacity slider for floor, grid, and level blocks; GLB props stay opaque
- `Background` section:
  - `Mix Mode`: `manual`, `sound-reactive`
  - `manual`: `Mix`
  - `sound-reactive`: bipolar `Intensity` with end labels `Vis -> Mod. Reality` and `Mod. Reality -> Vis`
- `Passthrough` section:
  - `Flashlight` toggle with `Radius` and `Softness`
  - when usable depth data exists: `Depth` toggle, then a `Reconstruction` cycler and a `Depth Mode` cycler
  - `Reconstruction`: `Raw`, `Edge-aware`, `Heightmap` (default)
  - `Distance`: `Sound-reactive`, optional bipolar `Intensity`, `Distance`, `Fade`, `MR Blend`
  - `Echo`: `Sound-reactive` row for `Phase` and `DutyCycle`, shared optional bipolar `Intensity`, then `Phase`, `Phase-Speed`, `Wavelength`, `DutyCycle`, `Fade`, `MR Blend`
  - in `Echo`, the modified-reality/passthrough bands and the VR-world masking do not use the same blend rule: passthrough still follows the depth band mask, while the VR world stays proportionally present according to `MR Blend`
- `Scene Lighting` section:
  - `Lighting Mode` cycler: `None`, `Uniform`, `Spots`, `Club`
  - `Light Preset` cycler
  - all lighting modes except `None`: `Darkness`
- visualizer mode selector
- `Mirror Horizontal` checkbox for mirrored horizontal sampling in `Toroidal`, `Skysphere`, and `Sky Toroid`
- Butterchurn preset selector
- `Session` section with an `Exit VR` button while an immersive session is active
- live audio meters for `Level`, `Bass`, `Kick`, `Bass Hit`, `Transient`, `Beat Pulse`, `Strobe`, `Fill`, `Left Hit`, and `Right Hit`

## Visualizer Modes

| Mode | Mapping | Roll | Poles | Description |
|---|---|---|---|---|
| **Toroidal** | Screen-space UV + head yaw/pitch offset | Rotates with head roll | None | Flat fullscreen quad with toroidal texture wrapping driven by head orientation. Fastest and simplest mode. The `Mirror Horizontal` checkbox can replace the normal horizontal wrap with mirrored repetition. |
| **Skysphere** | 3D raycasting via view matrix to spherical coordinates with fixed `4x` horizontal wrap | Stable | Convergence at poles | Computes world-space view direction per pixel, converts to yaw/pitch, and closes the full `360` degrees with a fixed four-repeat wrap. The mode also derives its own source-canvas width from the current target height and vertical FOV so the calibrated horizontal wrap stays visually proportionate. The `Mirror Horizontal` checkbox swaps the horizontal wrap for mirrored segments. |
| **Sky Toroid** | View-space angular offsets with roll correction + head yaw/pitch | Stable | None | Computes per-pixel angular offsets in view space, counter-rotates by the camera roll, then adds world-space head orientation. Combines the roll stability of Skysphere with the pole-free tiling of Toroidal. The `Mirror Horizontal` checkbox swaps its horizontal wrap for mirrored repetition. |

## Passthrough Modes

### Flashlight

`Flashlight` opens controller-driven circular passthrough cutouts with `Radius` and `Softness`. It is independent from the depth-driven modes and can run alongside them.

### Depth Reconstruction

The runtime first converts the raw low-resolution WebXR sensor depth into one shared full-resolution processed depth texture per eye/view in `xr-depth-processing.js`. When possible, that processed depth now stays on float render targets instead of being quantized to `RGBA8`, which reduces visible contour banding in the depth-derived modified-reality and passthrough masks. `Raw` keeps the native block structure as a diagnostic baseline, `Edge-aware` reconstructs a denser depth field while resisting depth bleeding across real discontinuities, and `Heightmap` runs a dedicated two-pass smoothing plus spline reconstruction path so larger walls, floors, and tabletops read as smoother continuous gradients instead of stepped blocks.

That processed depth is reused by the passthrough opening, the modified-reality world mask, and the passthrough overlay logic so those paths no longer each sample the low-resolution sensor depth independently.

### Depth Mode: Distance

`Distance` is the direct near-depth cutout mode. Geometry closer than the configured `Distance` is opened toward passthrough, `Fade` softens that edge in meters, and `MR Blend` controls how much modified reality remains in the opened region instead of switching to pure passthrough immediately. An optional `Sound-reactive` toggle can modulate the depth distance threshold, and its bipolar `Intensity` slider controls both strength and inversion of that modulation.

### Depth Mode: Echo

`Echo` creates repeating depth bands that alternate between passthrough-heavy and modified-reality-heavy regions. It supports a manual phase offset, a moving phase, and selective sound-reactivity for the `Phase` and `DutyCycle` controls. When any Echo sound-reactive checkbox is active, one shared bipolar `Intensity` slider scales or inverts the active Echo modulation.

| Parameter | Meaning |
|---|---|
| `Phase` | Manual offset of the repeating depth pattern in meters within the current wavelength. |
| `Phase-Speed` | Constant motion of the depth bands in `m/s`. Positive values move the pattern forward, negative values backward. |
| `Wavelength` | Full depth period of one on/off cycle in meters. |
| `DutyCycle` | Fraction of the wavelength that is occupied by the active band. Lower values make thinner bands, higher values make wider bands. |
| `Fade` | Softness of the transition between active and inactive depth bands. |
| `MR Blend` | Amount of modified reality retained inside the Echo band instead of cutting directly to passthrough. |
| `Sound-reactive: Phase` | Audio drives the phase position across the wavelength on top of the manual phase and phase-speed motion. |
| `Sound-reactive: Duty` | Audio widens and narrows the active Echo band around the base `DutyCycle`. |

## Current Status

- The app starts the visualizer engine immediately, but audio-reactive behavior only becomes meaningful once an audio source is active.
- Live passthrough uses the shared background and overlay pipeline in AR, while desktop preview, opaque AR, and VR fall back to a black background.
- `Background` now stays on `manual` by default instead of auto-switching to `sound-reactive` when live passthrough appears.
- The global `Background` mix now crossfades the visualizer into the darkened modified-reality layer without leaving an extra direct-passthrough gap in between; true direct passthrough should still appear only in explicit openings such as `MR Blend = 0%`, `Flashlight`, or depth punch.
- The runtime requests optional WebXR depth sensing for immersive AR with a fallback ladder: GPU depth first, CPU depth second, plain AR last.
- When usable depth data is present, the `Depth` toggle auto-enables, the shared per-eye full-resolution depth reconstruction pass feeds the passthrough punch, world mask, and overlay logic, and the depth punch can run as a near-distance cutout or as animated periodic `Echo` bands while lighting still falls back to synthetic ceiling, wall, and floor anchors when sensed depth is unavailable.
- `Background` handles full-frame visualizer-to-modified-reality mixing, `Flashlight` and optional `Depth` open passthrough masks, and scene lighting runs as `None`, `Uniform`, `Spots`, or `Club`; `Club` is the richer preset- and audio-driven mode.
- The passthrough defaults now start with `Flashlight` at `Radius 15%` and `Softness 5%`, while the `Echo` depth-mode default `MR Blend` starts at `95%` without changing the startup depth mode.
- The lower menu is one shared state-driven system, `TestLab.html` reuses the same runtime with its own reduced menu/preset setup, and translucent world/menu rendering preserves XR framebuffer alpha.

## GitHub Pages

- `.github/workflows/deploy-pages.yml` deploys the site on pushes to `main`
- repository Pages settings should use `Build and deployment -> Source -> GitHub Actions`

## Acknowledgements

Parts of this project are derived from or based on Butterchurn, and this repository also bundles Butterchurn preset data.

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## License

This repository is licensed under the [MIT License](./LICENSE).

Bundled third-party components:

- `butterchurn.min.js` is derived from or based on `jberg/butterchurn` and is covered by the MIT License
- `butterchurnPresets.min.js` is derived from or based on `jberg/butterchurn-presets`, which is published on GitHub as MIT-licensed
- bundled third-party licensing details are collected in [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)

If you redistribute or modify the bundled Butterchurn files, keep the upstream copyright and permission notices with them and verify the current upstream license files during release review:

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## Changelog

Project history is tracked in [`CHANGELOG.md`](./CHANGELOG.md).
