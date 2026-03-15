# WebXR Visualizer Foundation

Local WebXR prototype built in plain HTML and vanilla JavaScript. The current goal is a stable movement and interaction baseline for an XR audiovisualizer: reliable locomotion, jumping, in-headset menu control, and Butterchurn-driven visuals that can respond to live audio.

## Overview

This repository is the foundation phase of a browser-based WebXR audiovisualizer. It deliberately stays small: one HTML entry point, local browser execution, and no framework or build tooling.

Current capabilities:

- immersive VR startup with `local-floor` reference space
- desktop preview rendering when no XR session is active
- first-person desktop preview controls with `WASD`, `Shift`, `Ctrl`, `Space`, mouse-look, and `M` for the mirrored VR menu
- left-stick locomotion with head-relative movement
- right-stick smooth turning plus crouch and tiptoe height control
- sprint on the left trigger
- jump, hold-to-jump-higher variable jump physics, double-jump, and multi-jump modes
- in-air directional boost on the right trigger
- simple collidable level geometry with platforms, walls, landing surfaces, ceiling checks, and smooth climbable obstacles
- a textured goat model placed on the ground as a scene prop
- automatic pose reset after falling out of bounds
- an in-headset menu for jump mode, ground opacity, eye distance, audio metrics, visualizer-mode switching, light-preset switching, and preset switching
- Butterchurn preset rendering on an offscreen canvas sized to the active display viewport for 1:1 texture sampling in canvas-driven modes
- a toroidal fullscreen visualizer pass driven by head orientation
- a layered Butterchurn world mode that turns preset structure into warped sky shells, luma-sliced feedback planes, embossed portal surfaces, hotspot shards, volumetric shape architecture, tube-like wave ribbons, halo gates, and motion-vector streaks
- shared scene lighting with moving, audio-reactive, colorful top-light rigs that affect the floor, obstacle boxes, and GLB props
- two lighting presets: `Aurora Drift` for slower overhead motion and `Disco Storm` for aggressive disco-style strobing
- modular visualizer code split into shared Butterchurn source, render-phase-aware mode modules, and a mode manager
- modular scene-lighting code split into a dedicated controller that feeds shared lighting uniforms to the world render paths
- audio input from shared screen or tab audio, a dedicated YouTube playlist tab, Suno Live Radio, or microphone capture with beat and peak analysis
- a built-in `Debug Audio` synth path that generates a repeatable synthetic source without requiring screen-share permission

## Project Files

- `index.html`: single-page app entry point and main XR logic
- `glb-asset-manager.js`: reusable GLB loading and rendering path for simple scene props configured from `index.html`
- `xr-visualizer-utils.js`: shared pose and math helpers for XR visualizer modes
- `xr-scene-lighting.js`: shared moving light presets and lighting-uniform helpers for scene geometry
- `xr-visualizer-gl-utils.js`: reusable WebGL helpers for shader and fullscreen-pass setup
- `xr-visualizer-source-butterchurn.js`: Butterchurn preset source, shared audio/frame analysis, and optional canvas output for canvas-driven modes
- `xr-visualizer-manager.js`: mode registry, mode switching, and render-phase orchestration
- `xr-visualizer-mode-fullscreen.js`: reusable fullscreen textured-mode helper for canvas-driven passes
- `xr-visualizer-mode-toroidal.js`: toroidal pre-scene visualizer mode
- `xr-visualizer-mode-stereo-volume.js`: layered world-space preset interpreter mode for textured shells, portals, and spatial geometry
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
4. Use the desktop panel to start VR or test audio, presets, and movement in preview mode.

## Audio Sources

The start page can switch between these audio inputs:

- `Share Audio`: capture audio from a shared display, window, or tab
- `YouTube Playlist`: open the configured playlist tab, then capture that tab with tab audio enabled
- `Suno Live Radio`: open Suno Live Radio in a separate tab, then capture that tab with tab audio enabled
- `Use Microphone`: capture microphone audio
- `Debug Audio`: start a synthetic shared audio source for visualizer debugging without screen sharing
- `Stop Audio`: disconnect the active audio source

## Desktop Panel

- `Enter VR`: start an immersive session
- `Exit VR`: end the immersive session
- audio buttons: select or stop the active audio source
- mirrored menu overlay: visible on desktop by default for preset, mode, and movement-debug interaction outside XR
- lighting presets: switch between calmer and more aggressive audio-reactive world-light rigs from the mirrored VR menu

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

## Notes

- Everything runs locally in the browser.
- Current work prioritizes XR locomotion and render-loop stability before deeper audiovisual features.
- `toroidal` still uses the shared Butterchurn canvas as a fullscreen pass
- `Debug Audio` now only provides a synthetic source signal; beat, bass, transient, and peak values are derived through the same shared analysis path as real inputs.
- Shared audio analysis now exposes stereo-aware metrics such as left/right level, stereo balance, and stereo width, while mono-style inputs are auto-centered so they do not collapse into a false hard-left spatial bias.
- `Aurora Drift` keeps the world lighting in a slower colorful overhead sweep, while `Disco Storm` pushes faster moving beams and stronger strobes for a more aggressive disco look.
- The desktop preview now uses a first-person camera instead of the old orbiting debug camera, and the headset menu overlay is shown by default on page load. `M` toggles that same menu canvas for desktop debugging.
- `stereoVolume` is currently stripped back to an empty placeholder mode while the previous world-space interpretation is being removed and reconsidered from scratch.
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
