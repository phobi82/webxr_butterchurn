# WebXR Visualizer Foundation

Local WebXR prototype in plain HTML and vanilla JavaScript. The current focus is stable VR movement, jumping, headset menu interaction, and Butterchurn-driven XR visualizer modes that can react to live audio.

## Current Scope

This repository is the foundation phase of a browser-based WebXR audiovisualizer.

Implemented currently:

- immersive VR startup with `local-floor` reference space
- desktop preview rendering when no XR session is active
- desktop preview locomotion with `WASD`, `Shift`, `Ctrl`, `Space`, and mouse-look on the main canvas
- desktop preview toggle for the in-headset VR menu overlay via `M`
- left-stick locomotion with head-relative movement
- right-stick smooth turning
- right-stick crouch and tiptoe height control layered on top of relative headset movement
- sprint on the left controller face button
- jump, hold-to-jump-higher variable jump physics, double-jump, and multi-jump modes
- in-air directional boost on the right controller face button
- simple collidable level geometry with platforms, walls, landing surfaces, ceiling checks, and smooth climbable obstacles
- a textured goat model placed on the ground as a scene prop
- automatic pose reset after falling out of bounds
- redesigned in-headset menu for jump mode, ground opacity, eye distance, audio energy/peak/beat feedback, visualizer-mode switching, and preset switching
- Butterchurn preset rendering on an offscreen canvas sized to the active display viewport for 1:1 texture sampling in canvas-driven modes
- toroidal fullscreen visualizer pass driven by head orientation
- stereoscopic Butterchurn world mode that turns preset `shapes` and `waves` into simple 3D scene primitives
- modular visualizer architecture with a shared Butterchurn source, phase-aware mode modules, and a mode manager
- audio input from shared screen/tab audio, a dedicated YouTube playlist tab, Suno Live Radio, or microphone capture with beat/peak analysis
- a built-in `Debug Audio` synth path that simulates repeatable beat/bass/transient activity without requiring screen-share permission

## Project Files

- `index.html`: single-page app entry point and main XR logic
- `glb-asset-manager.js`: reusable GLB loading and rendering path for simple scene props configured from `index.html`
- `xr-visualizer-utils.js`: shared pose and math helpers for XR visualizer modes
- `xr-visualizer-gl-utils.js`: reusable WebGL helpers for shader and fullscreen-pass setup
- `xr-visualizer-source-butterchurn.js`: Butterchurn preset source, shared audio/frame analysis, and optional canvas output for canvas-driven modes
- `xr-visualizer-manager.js`: mode registry, mode switching, and render-phase orchestration
- `xr-visualizer-mode-fullscreen.js`: reusable fullscreen textured-mode helper for canvas-driven passes
- `xr-visualizer-mode-toroidal.js`: toroidal pre-scene visualizer mode
- `xr-visualizer-mode-stereo-volume.js`: stereoscopic world-space preset interpreter mode
- `butterchurn.min.js`: bundled Butterchurn runtime
- `butterchurnPresets.min.js`: bundled Butterchurn preset pack
- `CHANGELOG.md`: notable user-facing changes

## Requirements

- a modern desktop browser with WebXR and WebGL support
- a VR headset/runtime supported by that browser for immersive mode
- permission to access microphone or shared tab/screen audio if audio-reactive presets should respond to live input

## Run Locally

There is no build step and no backend.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a WebXR-capable browser.
3. Wait for the status text to finish checking XR support.
4. Use the desktop panel to start VR or test audio/preset behavior in preview mode.

## Desktop Panel

- `Enter VR`: start an immersive session
- `Exit VR`: end the immersive session
- `Share Audio`: capture audio from a shared display, window, or tab
- `YouTube Playlist`: open the configured playlist tab, then capture that tab with tab audio enabled
- `Suno Live Radio`: open Suno Live Radio in a separate tab, then capture that tab with tab audio enabled
- `Use Microphone`: capture microphone audio
- `Debug Audio`: start a synthetic shared audio source for visualizer debugging without screen sharing
- `Stop Audio`: disconnect the active audio source

## Desktop Preview Controls

- click the main view: capture mouse look with pointer lock
- mouse: look around
- `W`, `A`, `S`, `D`: move
- `Shift`: sprint
- `Ctrl`: crouch
- `Space`: jump
- `M`: show or hide the VR menu overlay for desktop debugging

## VR Controls

- left stick: move
- left trigger: sprint
- right stick: turn, crouch, and tiptoe
- A (right controller): jump, hold briefly for extra height
- right trigger while airborne: directional air boost
- Y (left controller): open or close the in-headset menu
- trigger on a menu control: activate menu buttons and drag the eye-distance slider

## Notes

- Everything runs locally in the browser.
- The project intentionally stays simple: one HTML entry point, plain JavaScript, no framework, no bundler.
- Current work prioritizes XR locomotion and render-loop stability before deeper audiovisual features.
- `toroidal` still uses the shared Butterchurn canvas, while `stereoVolume` now advances from the same shared audio/preset state without depending on that canvas render path.
- `Debug Audio` drives the same shared audio-analysis path as real inputs, so beat-reactive visuals can be tested locally even when browser share dialogs cannot be automated.
- The desktop preview now uses a first-person camera instead of the old orbiting debug camera, and the headset menu overlay is shown by default on page load. `M` toggles that same menu canvas for desktop debugging.
- The stereo mode is currently a first V2 step: it compiles preset `shapes` and `waves` into simple world-space geometry, while deeper Milkdrop/Butterchurn runtime interpretation can be layered into the same file later.
- The modular split keeps shared audio metrics and preset handling in one place so new visualizer modes can be developed in their own files without rewriting the Butterchurn bridge.

## Development

- Open the page directly in a browser for verification.
- Use browser devtools for logging and debugging.
- Keep movement changes small and testable so locomotion regressions stay easy to spot.

## GitHub Pages

- The repository now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the site on every push to `main`.
- In the repository Pages settings, set `Build and deployment -> Source` to `GitHub Actions` so GitHub uses the workflow-based deploy path instead of branch auto-publishing.

## Acknowledgements

Parts of this project are derived from or based on Butterchurn, and this repository also bundles Butterchurn preset data.

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## License

No license has been declared for this repository itself yet.

Bundled third-party components:

- `butterchurn.min.js` is derived from or based on `jberg/butterchurn` and is covered by the MIT License.
- `butterchurnPresets.min.js` is derived from or based on `jberg/butterchurn-presets`, which is published on GitHub as MIT-licensed.

If you redistribute or modify the bundled Butterchurn files, keep the upstream copyright and permission notices with them and verify the current upstream license files during release review:

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## Changelog

Project history is tracked in [`CHANGELOG.md`](./CHANGELOG.md).
