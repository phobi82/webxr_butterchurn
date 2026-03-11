# WebXR Visualizer Foundation

Plain HTML and vanilla JavaScript WebXR prototype with locomotion, jumping, an in-headset control panel, and a Butterchurn-driven toroidal background.

## Current Scope

This repository is the foundation phase of a local browser-based WebXR audiovisualizer.

Implemented today:

- Immersive VR session startup with `local-floor` reference space
- Left-stick movement and right-stick snapless turning
- Double-jump and multi-jump modes
- In-headset menu for jump mode, eye distance, and preset switching
- Butterchurn preset rendering on an offscreen canvas
- Toroidal fullscreen background pass driven by head orientation
- Audio input from shared system audio or microphone
- Desktop preview rendering when no XR session is active

## Project Files

- `index.html`: main app entry point and all WebXR/app logic
- `xr-toroidal-background.js`: toroidal background renderer and Butterchurn preset bridge
- `butterchurn.min.js`: bundled Butterchurn runtime
- `butterchurnPresets.min.js`: bundled Butterchurn preset pack
- `CHANGELOG.md`: notable user-facing changes

## Requirements

- A modern desktop browser with WebXR support
- A VR headset/runtime supported by that browser
- WebGL enabled
- Microphone or display audio permissions if audio-reactive presets should respond to live input

## Run Locally

There is no build step.

1. Clone or download the repository.
2. Open [`index.html`](./index.html) in a modern browser.
3. Wait for the status panel to report XR readiness.
4. Click `Enter VR` to start the immersive session.

## Desktop Controls

- `Enter VR`: start immersive mode
- `Exit VR`: end immersive mode
- `Share Audio`: capture system/display audio
- `Use Microphone`: capture microphone audio
- `Stop Audio`: disconnect active audio input
- `Prev Preset` / `Next Preset`: cycle Butterchurn presets

## VR Controls

- Left stick: move
- Right stick: turn
- `A`: jump
- `Y`: open or close menu
- Trigger: interact with menu buttons and eye-distance slider

## Notes

- Everything runs locally in the browser. No backend is required.
- The codebase intentionally stays simple: single-page app, plain JavaScript, no framework, no bundler.
- Current work is focused on stable XR foundations first. More advanced audiovisual behavior can be layered on later.

## Acknowledgements

Parts of this project are derived from or based on Butterchurn, and this repository also bundles Butterchurn preset data. Thanks to those projects and their contributors:

- https://github.com/jberg/butterchurn
- https://github.com/jberg/butterchurn-presets

## Development

- Open the page directly in a browser for verification.
- Use browser devtools for logging and debugging.
- Keep changes small and testable, especially around XR movement and render-loop behavior.

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
