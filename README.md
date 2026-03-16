# WebXR Visualizer Foundation

Local WebXR prototype built in plain HTML and vanilla JavaScript. The current goal is a stable movement and interaction baseline for an XR audiovisualizer: reliable locomotion, jumping, in-headset menu control, and Butterchurn-driven visuals that can respond to live audio.

## What It Does

- immersive VR startup with `local-floor`
- desktop preview when no XR session is active
- XR and desktop locomotion with jumping, sprinting, crouching, tiptoe height control, and airborne boost
- collidable level geometry plus a GLB scene prop
- in-headset menu for jump mode, floor opacity, eye distance, visualizer mode, light preset, and Butterchurn preset
- Butterchurn-driven visuals with a fullscreen toroidal mode and a placeholder `stereoVolume` world mode
- audio input from shared display/tab audio, YouTube playlist, Suno Live Radio, microphone, or synthetic `Debug Audio`
- shared audio-reactive scene lighting with `Aurora Drift` and `Disco Storm`

## Project Structure

- `index.html`: composition root and grouped config
- `xr-app-shell.js`: desktop UI shell and main canvas
- `xr-app-runtime.js`: XR session lifecycle, loops, and input orchestration
- `xr-audio-controller.js`, `xr-locomotion.js`, `xr-menu-ui.js`, `xr-menu-controller.js`: feature modules for audio, movement, and menu handling
- `xr-scene-renderer.js`, `xr-scene-lighting.js`, `glb-asset-manager.js`: scene rendering, lighting, and prop loading
- `xr-visualizer-*.js`: Butterchurn source, mode manager, shared helpers, and render modes

## Requirements

- a modern desktop browser with WebXR and WebGL support
- a VR headset/runtime supported by that browser for immersive mode
- permission to access microphone or shared tab/screen audio if audio-reactive presets should respond to live input

## Run Locally

There is no build step and no backend.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a WebXR-capable browser.
3. Wait for the status text to finish checking XR support.
4. Use the desktop panel to start VR or test audio, presets, and movement in preview mode.

## Audio Sources

The start page can switch between these audio inputs:

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
- right stick: turn, crouch, and tiptoe
- A (right controller): jump, hold briefly for extra height
- right trigger while airborne: directional air boost
- Y (left controller): open or close the in-headset menu
- trigger on a menu control: activate buttons and drag sliders in the in-headset menu

## Architecture Summary

- `index.html` is now a composition root with grouped config and module wiring.
- Browser UI, runtime orchestration, audio, locomotion, menu, scene rendering, lighting, GLB loading, and visualizer logic are separated into coherent modules.
- Shared math, color helpers, and empty audio-metric defaults are centralized in `xr-visualizer-utils.js`.
- Browser-specific dependencies are passed explicitly where useful so modules are less tied to globals.

## Current Status

- `stereoVolume` is intentionally a placeholder while that world-space mode is reconsidered

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
