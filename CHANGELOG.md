# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
