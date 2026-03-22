# WebXR Visualizer

Local WebXR prototype built with plain HTML and vanilla JavaScript. The project currently focuses on a stable XR baseline for an audiovisualizer: reliable movement, a usable in-headset menu, shared audio-reactive scene lighting, and Butterchurn-driven visuals that already run before a live audio source is selected.

## Current Feature Set

- immersive XR startup with `local-floor`, preferring `immersive-ar` and falling back to `immersive-vr`
- desktop preview when no XR session is active
- immediate Butterchurn startup on page load
- XR and desktop locomotion with jumping, sprinting, crouching, tiptoe head-height control, and airborne boost
- collision world with floor, platforms, walls, and a remote goat GLB prop
- in-headset menu plus mirrored desktop preview for debugging the same menu
- separate [`TestLab.html`](./TestLab.html) page for isolated single-effect lighting tests on desktop and in VR
- audio-reactive floor colors and shared scene lighting
- lighting presets: `Aurora Drift`, `Disco Storm`, `Neon Wash`, `Stereo Chase`, `Pulse Strobe`
- passthrough blend modes: `Uniform`, `Flashlight`
- uniform passthrough submodes: `Manual`, `Music`
- passthrough lighting modes: `None`, `Uniform`, `Spots`, `Club`
- visualizer modes: `Toroidal`, `Skysphere`, `Sky Toroid`
- audio input from shared display/tab audio, microphone, `YT Synth`, `YT House/Disco`, Suno Live Radio, or synthetic `Debug Audio`

## Project Structure

- `index.html`: browser entry point, desktop shell, buttons, status labels, and main canvas
- `xr-foundation.js`: shared browser, XR, math, and rendering helpers
- `xr-audio-controller.js`: audio capture, analyser pipeline, stereo metrics, club-lighting derived metrics, and debug synth
- `xr-light-fixture-effects.js`: shared fixture-effect families and passthrough effect semantics
- `test-lab-lighting-presets.js`: isolated single-effect preset catalog used by `TestLab.html`
- `xr-light-presets.js`: lighting preset catalog, fixture-rig builders, and scene-light derivation
- `xr-visualizer.js`: visualizer engine, Butterchurn integration, and preset lifecycle
- `xr-visualizer-modes.js`: visualizer mode catalog
- `xr-passthrough-modes.js`: pure passthrough mode catalog and blend formulas
- `xr-passthrough.js`: passthrough controller, fallback policy, background-composite state, and overlay-lighting compositor
- `xr-menu-sections.js`: generic menu section/control descriptors for lower interactive menu groups
- `xr-world.js`: collision world, locomotion, GLB loading, and scene renderer
- `xr-menu.js`: menu canvas rendering, desktop preview, and XR/desktop menu interaction
- `xr-shell.js`: explicit DOM-shell contract plus reusable shell normalization/builder helpers
- `xr-runtime.js`: shared runtime orchestration for XR sessions, desktop preview, audio wiring, and render-loop flow
- `app-composition.js`: default app configuration and shared app composition over the shell/runtime modules

## Requirements

- a modern desktop browser with WebGL support
- a browser/runtime combination with WebXR support for immersive mode
- a VR headset supported by that browser for actual headset sessions
- a passthrough-capable headset/browser combination if the AR passthrough blend modes should reveal the real environment instead of the black fallback
- depth-sensing-capable AR browser/runtime support if passthrough light effects should size themselves against sensed real-world depth instead of the built-in ceiling/wall/floor fallback anchors
- microphone or screen/tab-capture permission if live audio input should drive the scene
- popup permission if `YT Synth`, `YT House/Disco`, or `Suno Live Radio` should open their source tabs automatically

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
- `YT Synth`: opens the configured synth-oriented YouTube playlist tab and expects tab-audio sharing
- `YT House/Disco`: opens the configured house/disco YouTube playlist tab at its first selected track and expects tab-audio sharing
- `Suno Live Radio`: opens Suno Live Radio and expects tab-audio sharing
- `Stop Audio`: disconnects the active source

## Effect Test Lab

- Open [`TestLab.html`](./TestLab.html) when you want to inspect one lighting effect at a time instead of testing full presets.
- The test lab starts with `Passthrough = Uniform -> Manual -> Mix 100%`, so Butterchurn is suppressed and the effect overlay stays isolated against the fallback/room test setup.
- Its floor and grid are also kept neutral and non-audio-reactive in the lab path, using a darker gray floor and a slightly brighter gray grid so effect additive contribution and alpha-blend opening can be judged without a second moving color source.
- Its desktop preview starts outside an open-front room shell with a clearer inner floor, thicker side/back surfaces, and a front frame, so ceiling, wall, and floor effects read more like a lighting diorama before entering VR.
- Effect, variant, and semantics selection on desktop now goes through the mirrored menu, which is shown by default and can still be toggled with `M`, matching the in-headset control path instead of duplicating those controls as separate page buttons.
- Effect descriptions now belong to the effect itself, while variants only change the staging/placement inside that effect instead of masquerading as separate effects.
- The isolated effect list now also includes `Flashlight` as a normal fixture effect inside the shared Club/effect pipeline, instead of introducing a separate scene-lighting mode just for the lab.
- `Current`, `Additive Only`, and `Alpha Blend Only` let the same isolated effect be compared under matched conditions, so passthrough color contribution and passthrough opening can be judged separately before deciding on the final semantics for that effect.
- The mirrored TestLab menu now also exposes dedicated `Additive` and `Alpha Blend` sliders under `Scene Lighting`, so those shares can be tuned directly instead of only toggled by semantic mode.
- The left desktop panel now stays minimal and leaves effect, variant, and semantics readout to the mirrored menu, while still keeping audio/XR controls and the shared isolation baseline visible.
- The page keeps the normal XR enter path, so the same isolated effects can be inspected in headset instead of only on desktop.
- Its in-headset menu is also reduced to separate `Active Effect` and `Variant` cyclers, the key lighting sliders, focused audio meters, and explicit variant/audio status instead of mirroring the full production menu.
- While inside VR, the TestLab menu also includes an `Exit VR` button so the session can be ended without leaving the in-headset UI first.

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
- in-headset menu: `Exit VR` button to end the current immersive session

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
  - `Lighting Mode` cycler: `None`, `Uniform`, `Spots`, `Club` with `Spots` as the default
  - `Light Preset` cycler
  - all lighting modes except `None`: `Darkness`
- eye distance slider
- visualizer mode selector
- Butterchurn preset selector
- `Session` section with an `Exit VR` button while an immersive session is active
- live audio meters for `Level`, `Bass`, `Kick`, `Bass Hit`, `Transient`, `Beat Pulse`, `Strobe`, `Fill`, `Left Hit`, and `Right Hit`

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
- The audio-reactive `Uniform -> Music` blend now follows `beatPulse` specifically, while the other passthrough lighting behavior still uses broader audio-derived lighting metrics.
- `Left Hit` and `Right Hit` now drive stronger stereo-biased Club beam accents, with more obvious left/right intensity separation and a small additional lateral placement shift on stereo-heavy material.
- Stereo-biased Club wall fixtures now follow explicit left/right ceiling-height wall tracks instead of the generic room perimeter, so side accents read more like dedicated wall runners.
- Those side-wall runners now bias away from the room center into clearer front/back lanes, and the wall beam masks are stretched further so the side accents read more like directed beams than short blobs.
- Ceiling washes are now broader and softer, while floor spill uses larger, softer, more numerous low-position masks so overhead fill and underglow read as distinct surface behaviors.
- `Aurora Drift` now leans into aurora-style overhead light bands instead of a generic soft wash, giving that preset a more specific atmospheric identity.
- `Aurora Drift` ceiling washes are now also geometrically narrowed and striped more aggressively in the passthrough shader, so they should read more like long light bands than large ceiling blobs.
- Passthrough-specific alpha-blend opening behavior is now differentiated by fixture type: washes open the room softly, beams reveal more aggressively, and strobes cut sharper windows into the real environment instead of behaving only like additive color.
- Fixture effect families are now defined in one shared lighting module, so presets choose shuttered washes, edge-running beams, silhouette cuts, or room-window beats without duplicating the effect rules inside the passthrough renderer.
- Those passthrough-native effect families now also include aurora-curtain ceiling bands and floor-halo underglow, so `Aurora Drift` reads more like a moving northern-light canopy and the room-fill presets get a more deliberate floor spill instead of only soft blobs.
- The remaining Club presets are now pulled further apart as well: `Disco Storm` is busier and more cutout-heavy, `Neon Wash` pushes stronger ceiling-plus-wall color fill, `Stereo Chase` emphasizes mirrored side runners and split floor color, and `Pulse Strobe` keeps a darker base with sharper ceiling and wall hits.
- A separate `TestLab.html` page now isolates one effect at a time through the normal Club/passthrough pipeline, so effects can be judged on their own before being recomposed into presets.
- The app shell is now passed into `createApp(...)` explicitly instead of being read from an implicit global, and the shared runtime lives in `xr-runtime.js`, so alternative entry pages can reuse the same engine stack without baking test-specific hooks into the main app module.
- The lower interactive menu area now flows from generic section/control descriptors, so passthrough, scene lighting, world opacity, eye distance, jump mode, visualizer mode, and presets all share the same generic layout, rendering, and hit-test path.
- The passthrough controls stay grouped together, while `Scene Lighting` is separated into its own section with `Lighting Mode` and `Light Preset`; `Spots` is now the default lighting mode.
- Default startup now uses `Passthrough = Uniform -> Music` with `Intensity = -100%`, and `Scene Lighting = Club` with the `Pulse Strobe` preset selected.
- Lighting can now be disabled, applied as one music-reactive uniform additive wash, or rendered as soft colored spots derived from the active lighting preset.
- The `Spots` overlay now approximates fixed room lighting in `local-floor` space with anchors on the ceiling, floor, and side walls, so real headset movement changes the passthrough spots as if the lights were in the room, while stick locomotion no longer drags those spots through passthrough.
- `Club` extends the passthrough lighting path with fixture-rig-driven washes, wall beams, and controlled strobe accents derived from the active light preset and new audio-reactive metrics such as `kickGate`, `bassHit`, `transientGate`, `strobeGate`, `roomFill`, and stereo impact values.
- `Club` now renders those passthrough fixtures as oriented elliptical masks instead of only round blobs, so washes read broader and beams read more directional in the room.
- `Club` now applies explicit ceiling, wall, and floor surface budgets in the passthrough renderer, with a floor-biased visibility lift and stronger surface-specific shaping so floor spill stays present more reliably and walls versus ceiling read less alike.
- When the browser exposes optional WebXR depth sensing, passthrough light masks now also rescale against sensed real-world depth per eye view; when depth is missing or unsupported, the previous synthetic ceiling/wall/floor anchor behavior remains in place.
- The former Club macro sliders were removed again, so Club intensity, fill, and strobe behavior now come from the active preset and audio response; one shared `Darkness` slider controls how much the passthrough environment is darkened behind `Uniform`, `Spots`, and `Club`, with `5%` as the default.
- Lit passthrough masks now also reduce the local darkening alpha instead of only adding color, so at low `Darkness` values the real passthrough image can show through inside the light hits rather than appearing as flat colored blobs on black.
- The moving Club wall lights now run on the same ceiling-height anchor as the passthrough spots instead of tracking lower down the wall.
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
