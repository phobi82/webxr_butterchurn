# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-03-20

### Added
- Added a `Passthrough Mix` slider to the in-headset menu so supported `immersive-ar` sessions can fade the Butterchurn background toward live headset passthrough from `0%` to `100%`.
- Added a local HTTPS Quest-testing launcher (`start-local-https-server.bat`) plus helper scripts in `local-dev-https/` so the project can be served over LAN with a self-signed certificate.

### Changed
- XR session startup now prefers `immersive-ar` when the browser and headset support it, and falls back to `immersive-vr` otherwise.
- Switched the XR WebGL path to alpha-capable rendering so AR sessions can keep the Butterchurn background partially transparent while leaving menu, floor, lights, and world geometry intact.
- Added clear menu feedback and a black fallback path when passthrough is unavailable, so the slider stays usable in desktop preview or plain VR/opaque AR sessions instead of becoming inert.
- Make the Butterchurn fullscreen background write the configured XR background alpha directly, so `Passthrough Mix = 0` is fully opaque and semi-transparent world geometry now shows the intended Butterchurn/Passthrough mix behind it instead of exposing raw passthrough directly.
- Darken the visible passthrough contribution by 50% and lift it with a music-reactive color tint from the active lighting preset, while keeping `Passthrough Mix = 0` opaque and `Passthrough Mix = 100%` free of residual Butterchurn.
- Moved passthrough UI state, visualizer blend syncing, and the lighting-tinted fallback compositor into a dedicated `xr-passthrought.js` module so the visualizer stays independent of scene-lighting and session-specific passthrough policy.
- Switch world, grid, controller-ray, and menu blending to `blendFuncSeparate(...)` so translucent draws preserve the correct XR framebuffer alpha instead of punching passthrough holes through an otherwise opaque Butterchurn background.
- Keep held XR slider drags clamped to their end values even when the controller ray overshoots slightly past the visible menu edge, so fast movements still reach the full slider range.
- Keep right-trigger air boost active while the menu is open unless the right controller is actually pointing at the menu or dragging a menu slider.

## [0.4.1] - 2026-03-19

### Changed
- Unified XR left-stick movement and airborne right-trigger boost onto the same horizontal velocity path, so air steering no longer adds a second direct position shift on top of jump momentum.
- Reworked XR horizontal damping to apply before stick steering instead of after movement resolution, keeping ground movement responsive while preserving airborne inertia.
- Restored analog XR left-stick speed scaling on top of the retained deadzone, so partial stick tilt no longer jumps straight to full movement speed.
- Expanded the former `Ground Opacity` control into `World Opacity`, so the slider now fades floor, grid, and level blocks together while GLB props keep their own opacity.

## [0.4.0] - 2026-03-18

### Added
- Skysphere visualizer mode: 3D raycasting with spherical coordinate UV mapping, roll-stable but with pole convergence at the zenith/nadir.
- Sky Toroid visualizer mode: view-space angular offsets with roll correction, combining Skysphere roll stability with Toroidal pole-free tiling.

### Changed
- Default visualizer mode is now Skysphere instead of Toroidal.

### Removed
- Stereo Volume placeholder mode replaced by the two new implemented modes.

## [0.3.0] - 2026-03-18

### Changed
- Moved the shared visualizer engine, fullscreen visualizer helper, and Butterchurn source integration out of `xr-app.js` into `xr-visualizer.js`, so app runtime wiring and visualizer internals are split into separate files again.
- Moved visualizer mode definitions into `xr-visualizer-modes.js`, with one function per mode and a single local catalog list that now drives the Visualizer Mode menu automatically.
- Moved light preset definitions into `xr-light-presets.js`, with one function per preset and a single local catalog list that now drives the Light Preset menu automatically.
- Moved the desktop shell back into `index.html` and grouped the menu view plus menu controller together in `xr-menu.js`.
- Moved shared audio analysis together with the audio-source controller into `xr-audio-controller.js`, so `xr-foundation.js` no longer mixes audio capture/runtime code with the generic browser and XR helpers.
- Start the visualizer immediately on page load and hide the mirrored desktop VR menu by default until it is toggled on.
- Rebuilt XR head-height movement around separate player and head positions so the right stick now combines with relative headset motion, ignores absolute headset height, holds crouch levels after release, and auto-returns stick-driven tiptoe height back to standing.
- Updated the README to match the current runtime structure, controls, menu options, and GitHub Pages website link.

## [0.2.1] - 2026-03-16

### Changed
- Moved audio-source lifecycle logic into a dedicated `xr-audio-controller.js` module so capture setup, debug-audio activation, tab opening, stream cleanup, and audio UI state are no longer mixed into `index.html`.
- Moved collision handling, floor detection, XR movement physics, eye-height adjustment, and desktop first-person locomotion into a dedicated `xr-locomotion.js` module so the movement baseline is easier to maintain and no longer relies on hidden shared globals.
- Split the VR menu canvas rendering, layout math, mirrored desktop preview, and hit testing into a dedicated `xr-menu-ui.js` module so `index.html` stays smaller and focused on XR, movement, and scene orchestration.
- Split the remaining VR-menu runtime state into `xr-menu-controller.js` so menu pose updates, XR controller rays, desktop overlay interaction, slider dragging, and action dispatch no longer sit in `index.html`.
- Moved the shared WebGL setup and scene draw pipeline into `xr-scene-renderer.js` so `index.html` now orchestrates rendering instead of also owning shader setup, buffers, floor drawing, menu drawing, and per-view render logic.
- Moved the browser control panel, status labels, audio buttons, and main canvas creation into `xr-app-shell.js` so `index.html` is reduced further toward app composition instead of direct DOM construction.
- Moved XR session startup and shutdown, the desktop and XR render loops, browser input handling, and module orchestration into `xr-app-runtime.js` so `index.html` now acts more clearly as configuration plus composition instead of also owning the whole runtime control flow.
- Tightened the module API boundaries again by routing XR control-state updates through `xr-app-shell.js`, moving desktop menu-preview event wiring into `xr-menu-controller.js`, and passing browser globals explicitly into reusable browser-facing modules instead of reaching for them implicitly.
- Made the shell and mirrored menu preview less app-specific by moving desktop layout assumptions into explicit style options, and let the shell own viewport canvas sizing plus pointer-lock helpers instead of scattering those details through the runtime.
- Removed the desktop viewport-resize assumption from `xr-scene-renderer.js` so preview sizing stays at the shell/runtime boundary and the renderer stays focused on drawing.
- Reduced the visualizer-manager view API further by replacing chained narrow render/projection setters with clearer preview and render-view entry points.
- Cleaned up a few last architecture-era names by renaming the audio-to-visualizer sync path and the visualizer source option bag so they describe the current manager/source responsibilities more directly.
- Consolidated the lighting and visualizer menu-selection APIs into snapshot-style accessors so runtime menu wiring no longer has to assemble the same UI state through several parallel getters.
- Reduced browser-global coupling in the audio controller by injecting media-device and popup dependencies instead of always reaching for `navigator.mediaDevices` and `window.open`.
- Documented the effective public APIs of the main runtime modules in the README so the refactored architecture is easier to navigate without rediscovering each module boundary from source.
- Standardized the visualizer session lifecycle names on `startSession` and `endSession` so the runtime, manager, and Butterchurn source use the same session-boundary terminology.
- Added a concrete XR hardware-verification checklist to the README so the last remaining headset-only validation step can be executed consistently when hardware is available.
- Simplified the README structure by removing the overloaded module API and notes detail in favor of a shorter overview, clearer project structure, and a compact architecture/status summary.
- Tightened the reusable module APIs further by hiding scene-lighting preset state and visualizer-manager internal helpers behind smaller public surfaces instead of exposing mutable controller internals and unused alias methods.
- Reduced runtime wiring data clumps by replacing loose `factories`, `sceneMath`, `math`, and `config` option bags with a smaller domain-oriented `services` structure plus explicit mutable runtime resources grouped into `scene` and `visualizer` domains.
- Aligned the visualizer runtime naming so the mode/state owner is now treated consistently as a manager instead of mixing `renderer` and `manager` terminology across the runtime, scene, and audio modules.
- Reduced implicit browser-global coupling again by passing browser-specific dependencies into the GLB asset manager, visualizer manager, and Butterchurn source instead of having those modules always reach for globals directly.
- Tightened the visualizer manager internals by replacing repeated mode-notification loops with a shared dispatcher and by copying render matrices with typed-array `.set(...)`.
- Centralized shared color helpers such as `hslToRgb` and `hueToRgb` in `xr-visualizer-utils.js` so menu, scene-lighting, and main-scene code stop carrying duplicate implementations.
- Centralized shared vector and quaternion helpers such as `rotateXZ`, `normalizeVec3`, `dotVec3`, and forward-direction extraction in `xr-visualizer-utils.js` so locomotion and menu code stop duplicating the same math.
- Centralized shared empty audio-metric defaults in `xr-visualizer-utils.js` so lighting, menu rendering, and visualizer management use the same fallback object.
- Reduced repeated menu-content fallback defaults by grouping the remaining visualizer and lighting fallback labels in the runtime and menu UI instead of scattering them through multiple inline expressions.
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
