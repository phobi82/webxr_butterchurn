# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added a second Butterchurn visualizer mode that interprets the active preset as a stereoscopic image-space volume instead of only the existing toroidal wrap.

### Changed
- Extended the desktop controls and the in-headset VR menu so visualizer mode and Butterchurn preset can both be cycled independently from the same UI flow.
- Changed Butterchurn preset selection to keep the chosen preset index stable even before audio activation finishes, so menu labels and the first activated frame stay in sync.
- Renamed and split the XR rendering modules into `xr-visualizer-*` files, with separate utils, GL helpers, Butterchurn source, mode manager, and per-mode renderers.
- Added render-phase support to the visualizer manager so fullscreen and future world-space modes are no longer forced into a background-only architecture.
- Corrected the toroidal mode timing after the refactor so its Butterchurn canvas is prepared once per frame instead of once per eye.

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
