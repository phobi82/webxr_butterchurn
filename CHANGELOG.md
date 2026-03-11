# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added a `YouTube Playlist` start-page button that opens the requested playlist in a new tab and immediately prompts for tab-audio sharing so the playlist can be used as the visualizer input.
- Reused the same YouTube playlist tab on repeated clicks, added clearer capture guidance, and tightened the tab-share flow so the YouTube button automates as much of the browser-allowed sequence as possible.

### Changed
- Respaced the in-headset VR menu, enlarged its panel canvas, and scaled preset text to prevent menu label and control overlap.

## [0.0.1] - 2026-03-11

### Changed
- Lowered the preview camera and flattened its viewing angle so the horizon and background are more visible in the non-XR preview.
- Set the default Butterchurn preset to `martin - mucus cervix`.
- Exposed the toroidal background head-yaw and head-pitch buffer shift strengths as `headYawBufferShiftFactor` and `headPitchBufferShiftFactor` at the top of `xr-toroidal-background.js`.
- Removed horizontal toroidal background jump points caused by wrapped head-yaw angles when turning across the `-pi/pi` boundary.
- Delayed Butterchurn `AudioContext` creation until the first real user gesture so Chrome no longer logs autoplay warnings during page startup.
