# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Extended the shared Butterchurn audio analysis path with stereo-aware metrics including left/right energy, left/right bass, stereo balance, stereo width, mid level, and side level so world-space modes can react to channel structure instead of only mono loudness.
- Improved mono-input handling in the shared stereo analysis path so single-channel sources such as the built-in debug synth stay centered instead of being misread as a hard-panned stereo signal.
- Removed the current visible `stereoVolume` scene output so the mode is now an empty placeholder while the failed world-space interpretation is cleared out for a future redesign.

## [0.2.0] - 2026-03-14

### Added
- Added a modular scene-lighting controller with moving colorful top-light presets that drive shared lighting uniforms for the floor, obstacle boxes, and GLB props.
- Added `Aurora Drift` and `Disco Storm` lighting presets, plus a new VR-menu section for cycling the active light rig in-headset or from the mirrored desktop menu.

### Changed
- Replaced the old single-direction world lighting with a shared multi-light shading path so scene geometry can react consistently to the selected moving audio-reactive light preset.
- Changed the desktop preview controls so sprint now uses the left mouse button and crouch uses the right mouse button while pointer lock is active, removing the need to rely on `Shift` and `Ctrl` for movement modifiers.
- Fixed desktop preview movement so forward motion stays aligned with the current look direction after turning left or right.

## [0.1.1] - 2026-03-14

### Added
- Added a GitHub Pages deployment workflow under `.github/workflows/deploy-pages.yml` so pushes to `main` can publish the site through GitHub Actions instead of depending on branch-based auto-deploy behavior.

### Changed
- Documented that the repository Pages source should be switched to `GitHub Actions` to use the new workflow-based deployment path reliably.
- Fixed the shared alpha-render paths so `Ground Opacity` works again even after switching into the `stereoVolume` world renderer, which had been leaving WebGL blending disabled for later scene draws.
- Improved the README structure and clarified the VR control labels so sprint and airborne boost are documented on the correct triggers instead of generic face-button wording.
- Removed the debug-only audio metric overrides so `Debug Audio` now feeds a synthetic source signal through the same derived beat, bass, transient, and peak analysis path as real inputs, and tightened the shared beat detection to respond more reliably to both live and synthetic sources.

## [0.1.0] - 2026-03-14

### Added
- Added a second Butterchurn visualizer mode that compiles preset `shapes` and `waves` into simple world-space stereo geometry instead of only offering the toroidal pre-scene pass.
- Added a `Debug Audio` input mode that injects a synthetic beat/bass/transient signal into the shared Butterchurn audio path without requiring screen-share or microphone permission.
- Added a `Suno Live Radio` desktop audio shortcut that opens the requested tab and reuses the same tab-audio capture flow as the existing YouTube shortcut.
- Added first-person desktop preview controls with `WASD` movement, `Shift` sprint, `Ctrl` crouch, `Space` jump, and mouse-look on the main canvas.
- Added a desktop `M` shortcut that renders the existing headset menu canvas as a 2D overlay for menu debugging outside XR.

### Changed
- Extended the desktop controls and the in-headset VR menu so visualizer mode and Butterchurn preset can both be cycled independently from the same UI flow.
- Changed Butterchurn preset selection to keep the chosen preset index stable even before audio activation finishes, so menu labels and the first activated frame stay in sync.
- Renamed and split the XR rendering modules into `xr-visualizer-*` files, with separate utils, GL helpers, Butterchurn source, mode manager, and per-mode renderers.
- Added render-phase support to the visualizer manager so fullscreen and future world-space modes are no longer forced into a background-only architecture.
- Corrected the toroidal mode timing after the refactor so its Butterchurn canvas is prepared once per frame instead of once per eye.
- Split the shared Butterchurn source into a generic per-frame update path plus an optional canvas-render path, so world-space modes can reuse audio and preset state without depending on fullscreen texture generation.
- Reworked `stereoVolume` into a true `world`-phase mode with its own preset-compilation stage, leaving `toroidal` isolated on the shared fullscreen helper.
- Changed the shared audio source logic so stream inputs and the new synthetic debug input use the same analyser/beat pipeline and the same stop/reset path.
- Reorganized the desktop audio controls into a source row (`Share Audio`, `Use Microphone`, `Debug Audio`, `Stop Audio`) and a separate tab-source row for `YouTube Playlist` and `Suno Live Radio`.
- Removed the separate desktop preset section and now show the desktop menu overlay by default at startup, since preset and mode selection already live in the mirrored headset menu canvas.
- Raised the mirrored desktop menu canvas above the start-page control panel so the same menu stays visually in the foreground on the non-XR preview as well.
- Split the on-page controls hint into separate `VR:` and `Desktop:` lines for readability.
- Replaced the single `Audio energy` readout in the VR menu with separate bar meters for `level`, `peak`, `bass`, `transient`, and `beatPulse`.
- Tightened the VR menu layout so section borders use consistent stroke widths again, mode/preset rows live inside their own panels, and menu hit zones now derive from the same shared layout metrics as the drawn controls.
- Increased the VR click height of the visualizer-mode and preset arrow buttons so they are easier to hit in-headset.
- Made the VR menu canvas height auto-expand with its section layout so enlarged controls no longer spill out of the bottom, and scaled the in-world menu plane and desktop overlay to match the live menu aspect ratio.

## [0.0.3] - 2026-03-13

### Added
- Added simple collidable level geometry with visible box platforms and walls so movement and jumping can be verified against real obstacles instead of only the floor plane.
- Added the requested goat GLB as a textured ground prop loaded directly into the existing WebGL scene.

### Changed
- Changed jump handling to support variable jump height by holding the jump button briefly after takeoff, while keeping the existing double-jump and multi-jump modes.
- Added beat and peak detection on top of the existing audio energy tracking and wired those signals into the floor, obstacle, and menu feedback.
- Moved the GLB loading and rendering code into a dedicated helper file so `index.html` now only declares scene-model parameters such as URL, position, scale, and rotation.
- Refactored the VR locomotion flow into clearer input, eye-height, walking, and reset paths to simplify future movement tuning.
- Changed eye-height handling to use relative headset motion with persistent right-stick crouch and temporary right-stick tiptoe motion clamped between `0.5 m` and `2.0 m`.
- Changed climbable obstacle handling so reachable surfaces can be stepped onto smoothly instead of blocking movement or snapping the player abruptly upward.

## [0.0.2] - 2026-03-11

### Added
- Added a `YouTube Playlist` start-page button that opens the requested playlist in a new tab and immediately prompts for tab-audio sharing so the playlist can be used as the visualizer input.
- Reused the same YouTube playlist tab on repeated clicks, added clearer capture guidance, and tightened the tab-share flow so the YouTube button automates as much of the browser-allowed sequence as possible.
- Added a `Ground Opacity` slider to the in-headset VR menu so floor transparency can be adjusted continuously without leaving VR.

### Changed
- Respaced the in-headset VR menu, enlarged its panel canvas, and scaled preset text to prevent menu label and control overlap.
- Restyled the in-headset VR menu into a richer control panel layout with clearer grouping, audio energy feedback, and higher-resolution menu rendering.
- Changed the floor quad and grid from static colors to a slow rainbow fade that becomes brighter and more saturated with stronger audio input.
- Added an in-air right-trigger boost in the right-controller pointer direction and introduced horizontal movement momentum so airborne acceleration carries forward smoothly, including upward flight when aiming above the horizon.
- Corrected the README VR control labels to use `trigger`, `Y`, and `A`, and removed the undocumented `reset pose` mapping.
- Changed the toroidal background upload path to use the exact viewport-sized Butterchurn canvas as the sampled texture, removing the power-of-two staging texture and its content scaling step.
- Changed XR session startup to request the native `XRWebGLLayer` framebuffer scale factor when the browser exposes it, so the headset render target can match the device's native framebuffer resolution.

## [0.0.1] - 2026-03-11

### Changed
- Lowered the preview camera and flattened its viewing angle so the horizon and background are more visible in the non-XR preview.
- Set the default Butterchurn preset to `martin - mucus cervix`.
- Exposed the toroidal background head-yaw and head-pitch buffer shift strengths as `headYawBufferShiftFactor` and `headPitchBufferShiftFactor` at the top of `xr-toroidal-background.js`.
- Removed horizontal toroidal background jump points caused by wrapped head-yaw angles when turning across the `-pi/pi` boundary.
- Delayed Butterchurn `AudioContext` creation until the first real user gesture so Chrome no longer logs autoplay warnings during page startup.
