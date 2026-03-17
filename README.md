# WebXR Visualizer Foundation

Local WebXR prototype built in plain HTML and vanilla JavaScript. The current goal is a stable XR movement and interaction baseline for an audiovisualizer: reliable locomotion, in-headset menu control, Butterchurn-driven visuals, and a codebase that stays direct enough to edit without a toolchain.

## What It Does

- immersive VR startup with `local-floor`
- desktop preview when no XR session is active
- Butterchurn visualizer starts immediately on page load, even before an audio source is selected
- XR and desktop locomotion with jumping, sprinting, airborne boost, and a right-stick XR head-height model that combines stick input with relative headset motion while ignoring absolute headset height
- collidable level geometry plus a GLB scene prop
- in-headset menu for jump mode, floor opacity, eye distance, visualizer mode, light preset, and Butterchurn preset
- Butterchurn-driven visuals with a fullscreen toroidal mode and a placeholder `stereoVolume` world mode
- audio input from shared display/tab audio, YouTube playlist, Suno Live Radio, microphone, or synthetic `Debug Audio`
- shared audio-reactive scene lighting with `Aurora Drift` and `Disco Storm`

## Project Structure

- `index.html`: standalone browser entry for local `file://` use, and also builds the desktop shell directly
- `xr-foundation.js`: shared helpers, audio analysis/control, lighting, XR-session bridge, desktop input
- `xr-light-presets.js`: light preset functions plus the preset list consumed by scene lighting
- `xr-world.js`: collision world, locomotion, GLB loading, geometry, scene rendering
- `xr-menu.js`: menu canvas view and menu interaction controller
- `xr-visualizer-modes.js`: visualizer mode functions plus the mode list consumed by the runtime
- `xr-app.js`: visualizer runtime, app config, composition, and startup

## Requirements

- a modern desktop browser with WebXR and WebGL support
- a VR headset/runtime supported by that browser for immersive mode
- permission to access microphone or shared tab/screen audio if audio-reactive presets should respond to live input

## Website
`https://phobi82.github.io/webxr_butterchurn/`

## Run Locally

There is no build step and no backend.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a WebXR-capable browser.
3. Wait for the status text to finish checking XR support.
4. Use the desktop panel to start VR or test audio, presets, and movement in preview mode.

## Audio Sources

- `Share Audio`: capture audio from a shared display, window, or tab
- `YouTube Playlist`: open the configured playlist tab, then capture that tab with tab audio enabled
- `Suno Live Radio`: open Suno Live Radio in a separate tab, then capture that tab with tab audio enabled
- `Use Microphone`: capture microphone audio
- `Debug Audio`: start a synthetic shared audio source for visualizer debugging without screen sharing
- `Stop Audio`: disconnect the active audio source

## Desktop Preview Controls

- click the main view: capture mouse look with pointer lock
- mouse: look around
- left mouse button: sprint while held
- right mouse button: crouch while held
- `W`, `A`, `S`, `D`: move
- `Space`: jump
- `M`: show or hide the VR menu overlay for desktop debugging

## VR Controls

- left stick: move
- left trigger: sprint
- right stick: turn plus persistent crouch / temporary tiptoe head-height control combined with relative headset motion
- A (right controller): jump, hold briefly for extra height
- right trigger while airborne: directional air boost
- Y (left controller): open or close the in-headset menu
- trigger on a menu control: activate buttons and drag sliders in the in-headset menu

## Architecture Summary

- The app is now organized as a few normal browser scripts instead of a long chain of tiny runtime files or a module/build setup.
- Shared helpers, world logic, menu logic, and app composition are grouped into a few direct files so navigation stays simple without collapsing everything back into one monolith.
- The runtime no longer depends on scattered `window.*` globals per subsystem; related behavior is grouped together and loaded in a clear order from `index.html`.
- The desktop shell now lives directly in `index.html`, while the in-headset and mirrored desktop menu stay isolated in `xr-menu.js`.
- Visualizer modes and light presets each live in one dedicated catalog file, so extending them means adding a function and registering it once in that file.
- The project still launches directly from `index.html` over `file://` with no build or local server requirement.

## Current Status

- `stereoVolume` is intentionally a placeholder while that world-space mode is reconsidered.

## GitHub Pages

- The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the site on every push to `main`.
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
