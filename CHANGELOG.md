# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Refactored menu sliders into menu-owned controls with centralized range clamping, value derivation, hover/active state, and passthrough value handoff.
- Rebuilt the WebXR depth stack around one central staged pipeline: `xr-runtime.js` now emits per-eye `DepthSourcePacket` objects, `xr-render.js` forwards only those packets plus processing policy, and `xr-depth.js` now owns canonicalization, one GPU depth-grid warp into the target view, and centralized visibility derivation.
- Unified `gpu-array`, `gpu-texture`, and CPU depth sources behind the same canonical source-depth path, so future headset-specific depth adapters can reuse the same downstream reprojection and reconstruction stages.
- Removed raw-depth decoding from the reprojection stage. Raw source values are now decoded only during canonicalization, and `normDepthBufferFromNormView` is applied only there.
- Replaced the earlier sparse inverse-reprojection plus high-resolution reconstruction path with one GPU-warped shared depth grid that renders directly into the target image and stores metric depth in `r` and reconstructed world position in `g`, `b`, `a`.
- Changed radial depth handling so radial distance is derived from reconstructed world points and the source sensor origin, while planar depth continues to use target view-space `-z`.
- Rebuilt the shared visibility path so visibility is now derived from the final warped field plus warped occupancy coverage, instead of running a second mask-only reprojection path or letting consumers fall back to `step(depth)`.
- Changed depth fade semantics in the shared shader logic: `fade = 0` is now a hard threshold on the centralized visibility path, and `fade > 0` now means fade across the exact metric interval from `threshold` to `threshold + fade`.
- Expanded the persistent depth diagnostics mode with a palette cycler (`Rainbow`, `Grayscale`, `Bands`), a diagnostic `Range` control that now defaults to 6 meters, and a `Cycles` slider that controls how many palette cycles repeat within that range.

### Fixed
- Discard warped grid triangles as a whole when any corner falls inside the near-eye guard, avoiding large projected mask wedges from very close lower-field geometry.
- Changed the warped depth-grid triangulation to use adaptive per-cell diagonals, choosing the locally more continuous split in each cell. This softens systematic blocky contour steps and reduces slanted wedge artifacts from near-field geometry.
- Removed the old runtime reprojection-profile path and renderer-side raw-depth handoff, so depth ownership is now centralized instead of split across runtime, render, and depth modules.
- Removed consumer-side fallback visibility derivation from raw depth presence, so visibility semantics are now enforced by `xr-depth.js` instead of being reimplemented in render consumers.

## [0.8.8] - 2026-04-02

### Changed
- Corrected the README XR rendering description to match the current implementation: rendering uses `XRWebGLLayer`, while `XRWebGLBinding` is only used for depth queries when available.
- Added an optional `Motion compensation` checkbox beside `real Distance Metric` for depth-aware masking, plus a `Compensation Factor` slider that shifts the sampled depth mask against recent head yaw, pitch, and translation to reduce visible lag during headset motion.
- Changed `Motion compensation` to start enabled by default whenever the depth controls are available.
- Changed the depth motion-compensation filtering to use a fixed linear velocity smoothing step instead of an adaptive response, making the visible lag feel more even during head motion.
## [0.8.7] - 2026-04-02

### Added
- Declared the repository itself as MIT-licensed and added the matching `LICENSE` file plus README licensing guidance for downstream reuse.
- Added `THIRD_PARTY_LICENSES.md` so the bundled Butterchurn assets now have an explicit upstream licensing reference inside the repository.

### Changed
- Added a `Sound-reactive` checkbox plus a bipolar `Intensity` slider to passthrough `Depth -> Distance`, so the near-depth threshold can now respond to audio with optional inversion.
- Added one shared bipolar `Intensity` slider for passthrough `Depth -> Echo` whenever any Echo sound-reactive checkbox is active, so the active Echo audio modulation can be scaled or inverted without adding per-checkbox sliders.
- Simplified `TestLab.html` back to one isolated setup per effect, removing the extra variant cycler and replacing it with a focused `use Depth` checkbox that switches between `using Depth` and `using fallback` when sensor depth is available.
- Changed the `TestLab.html` `use Depth` path so it now only enables the depth sensor plus reconstruction buffers for depth-aware light effects, instead of also activating the shared passthrough `Distance` or `Echo` masking visuals.
- Separated visualizer-background visibility from passthrough/depth state at the app/runtime render-policy level, so `TestLab.html` can exclude Butterchurn from the framegraph without routing that decision through the passthrough controller.
- Reworked the shared XR menu interaction path to use structured declarative `action` objects plus `hoverKey` metadata, and replaced the runtime string-key `if (...)` chain with one central runtime action registry that maps actions onto the existing domain methods.
- Split `xr-world.js` into `xr-collision.js` (collision world), `xr-locomotion.js` (movement, physics, jumping), and the remaining `xr-world.js` (GLB asset loading and scene renderer).
- Unified slider hover tracking into the shared `hoveredActionKeys` system, removing the separate `hoveredMenuSliderControlKeys`, `eyeDistanceHoverBool`, and `floorAlphaHoverBool` state paths.
- Cached the menu action handler registry once at runtime creation instead of rebuilding it on every dispatch call.
- Replaced ~20 ternary fallback chains in `getMenuContentState` with default selection state objects.
- Removed the dead `createSourceBackend` option from `createVisualizerEngine` since the source backend is now injected externally via `init()`.
- Deduplicated the slider builder loop in `test-lab-menu.js` by reusing the shared `appendSliderMenuControls` helper.
- Rewrote `README.md` with grouped features, control tables, requirements table, collapsible project structure and Quest setup sections, in-headset menu screenshot, and removed the verbose `Current Status` section.

### Fixed
- Restored Butterchurn startup on page load by wiring the audio controller back through the visualizer engine adapter, so the initial activation path reaches the source backend again.

## [0.8.6] - 2026-04-01

### Changed
- Added a `Radial` checkbox under the passthrough `Depth` controls, so depth masking can switch between the WebXR camera-plane depth metric and a reconstructed equal-range radial distance metric without changing the existing default behavior.

### Fixed
- Restored `TestLab.html` to the shared depth-processing script loadout used by `index.html`, so immersive AR capability checks and the runtime path for passthrough/depth no longer break there because the extracted `xr-depth-processing.js` module was missing.
- Restored the immersive-AR per-eye viewport after processed-depth reconstruction and skipped processed-depth work entirely when `Depth` is off, fixing the depth-toggle regression where one eye could show a warped VR image while the other still showed passthrough.

## [0.8.5] - 2026-03-31

### Changed
- Documented Quest debugging over Wi-Fi in the README, including `adb tcpip`, DevTools port forwarding, target reattachment after reloads, and the note that remote `Enter VR` clicks are not a reliable Quest WebXR user gesture.
- Changed the shared processed-depth render targets to prefer float color attachments plus `highp` depth-composite shaders when supported, reducing visible banding in depth-derived modified-reality and passthrough masks on large flat real-world surfaces.

## [0.8.4] - 2026-03-29

### Changed
- Changed the default passthrough `Flashlight` tuning to `Radius 15%` and `Softness 5%`, and changed the `Echo` depth-mode default `MR Blend` to `95%` without changing the startup depth mode.
- Added a shared full-resolution depth reconstruction prepass for immersive AR, so low-resolution sensor depth is rebuilt once per eye and then reused by passthrough punch, passthrough overlay, and VR world masking instead of being sampled directly in each layer.
- Replaced the passthrough `Depth` upsampling controls with a `Reconstruction` cycler (`Raw`, `Edge-aware`, `Heightmap`) directly under the `Depth` toggle, and removed the earlier `Median` and `Temporal` options.
- Moved the shared depth reconstruction pipeline out of `xr-world.js` into `xr-depth-processing.js`, and made `Edge-aware` and `Heightmap` use clearly separated reconstruction logic.
- Changed the default reconstruction mode from `Edge-aware` to `Heightmap`, and rebuilt `Heightmap` as a dedicated two-pass smoothing plus spline reconstruction path for smoother height-map-style gradients at lower cost than the earlier full-res nested smoothing version.

### Fixed
- Changed the passthrough overlay alpha accumulation so the global `Visualizer -> Modified Reality` transition no longer leaves an extra bright direct-passthrough seam between those two layers, while explicit `MR Blend = 0%` and punch/depth openings can still reveal true direct passthrough where intended.

## [0.8.3] - 2026-03-28

### Changed
- Switched the remaining XR visualizer, passthrough, and world texture sampling paths from `NEAREST` to `LINEAR` filtering so Quest output no longer uses deliberate point sampling in those runtime paths.
- Extended the passthrough `Depth` controls with a `Depth Mode` cycler, keeping `Distance` as the existing near-cutout mode and adding a new animated `Echo` mode with `Wavelength`, `DutyCycle`, `Fade`, and `Phase-Speed`, while `MR Blend` now applies across all depth modes.

## [0.8.2] - 2026-03-28

### Changed
- Added `B` on the right controller as a second in-headset menu toggle, so the same menu can now be opened and closed from either controller face-button side instead of only `Y` on the left controller.
- Changed `Skysphere` to use a fixed `4x` horizontal wrap over `360` degrees and a mode-specific source-canvas width derived from target height plus vertical FOV, so the sky closes consistently after full turns without skewing the calibrated source aspect.
- Added a global `Mirror Horizontal` checkbox in the visualizer menu, letting `Toroidal`, `Skysphere`, and `Sky Toroid` switch between normal horizontal wrap and mirrored repetition without introducing extra visualizer modes.

## [0.8.1] - 2026-03-28

### Changed
- The depth-aware passthrough cutout now also suppresses the full VR world layer inside the near-object region, so darkened modified reality and passthrough light effects can show through there without floor, GLB, or other world geometry leaking into the same cutout.
- Changed the default `MR Blend` value from `0%` to `30%`, so the depth-aware cutout starts with some retained modified reality instead of opening immediately to direct passthrough only.

### Fixed
- Restored the original additive and alpha-blend passthrough light semantics inside the depth-aware overlay path, so depth-enabled lighting matches the non-depth passthrough effects again instead of using a drifted shader approximation.


## [0.8.0] - 2026-03-27

### Changed
- Added optional WebXR depth sensing for immersive AR with a proper fallback ladder: request GPU depth first when supported, fall back to CPU depth when necessary, and fall back again to plain AR when depth is unavailable.
- Depth-aware passthrough now uses sensed real-world depth in two places: passthrough light masks rescale against real depth, and the passthrough `Depth` punch path exposes `Distance`, `Fade`, and `MR Blend` controls when usable depth data exists.
- When live passthrough is active, the background now defaults to `sound-reactive` at `100%`, and the `Depth` toggle auto-enables itself as soon as usable depth data actually arrives.
- Renamed the shared passthrough effect semantics from `Tint` and `Reveal` to `Additive` and `Alpha Blend` across the controller, shader contract, and TestLab review flow.

### Fixed
- Fixed the XR menu slider interaction regression from the generic slider refactor by separating raw hover hits from captured slider drags again, so in-headset slider hover and trigger-drag both keep working without falling back to slider-specific state paths.

## [0.7.1] - 2026-03-22

### Added
- Added a separate `TestLab.html` page with isolated single-effect presets plus direct previous/next effect controls, so individual lighting behaviors can be inspected through the normal XR/passthrough pipeline on desktop and in VR without embedding the test UI into the main application.
- Added a dedicated reduced TestLab menu configuration, so the effect-lab page no longer shows the full production VR menu and can focus on effect selection, the key lighting slider, and relevant audio meters.
- Added explicit TestLab effect variants, so the same effect can now be judged deliberately on `ceiling`, `wall`, `floor`, or directional layouts instead of only through one default placement.
- Added a shared fixture effect `Flashlight` plus isolated TestLab variants for it, so flashlight-like reveal/tint behavior can be evaluated inside the normal Club/effect architecture instead of through a separate lighting mode.

### Changed
- Opened `createSceneLighting(...)` to custom preset-definition lists, so the new test lab can reuse the shared lighting pipeline with its own isolated effect catalog instead of patching the main preset list.
- Split the previous mixed entry/runtime layer into an explicit shell contract in `xr-shell.js`, a shared runtime core in `xr-runtime.js`, and a thinner shared app composition module, so alternate pages such as `TestLab.html` can reuse the same engine stack without relying on an implicit `window.appShell`.
- Changed the TestLab desktop preview to start outside a more architectural open-front room shell, adding clearer floor mass, thicker room surfaces, and a front frame so isolated ceiling, wall, and floor effects read less like clipped planes.
- Added an `Exit VR` button to the in-headset menu, including the reduced TestLab menu, so immersive sessions can be ended from inside the menu without remapping controller buttons.
- Made the TestLab status path more explicit on both desktop and in-headset, so the active effect, variant, audio mode, and `Uniform / Manual / Mix 100%` isolation baseline stay visible while comparing single-effect behavior.
- Changed the TestLab effect catalog to a direct `effect -> variants` model, so each effect now owns one description and the runtime/menu state no longer has to reconstruct variant semantics from flat preset metadata.
- Split the reduced TestLab VR menu into separate `Active Effect` and `Variant` cyclers, so variant switching is no longer hidden inside the effect control path.
- Removed the duplicate desktop effect/variant/semantics buttons from `TestLab.html`, so desktop review now uses the same mirrored menu path as the in-headset UI instead of maintaining two competing control surfaces.
- Reduced the remaining left-side TestLab desktop panel further, so effect, variant, and semantics readout now lives only in the mirrored menu instead of being repeated beside it.
- Changed the TestLab desktop start state so the mirrored VR menu is visible immediately on page load, removing the extra open-menu step before desktop review.
- Restored generic TestLab semantic comparison modes `Current`, `Tint Only`, and `Reveal Only` through the shared passthrough/runtime/menu path, so reveal and tint can be judged per effect without introducing a separate flashlight lighting mode.
- Added direct `Tint` and `Reveal` sliders to the TestLab scene-lighting controls, so the strength of both semantic contributions can now be tuned independently inside the VR menu.
- Changed the TestLab floor and grid to static neutral grays instead of music-reactive color, so isolated effect review can focus on passthrough reveal and tint behavior without competing animated floor feedback.
- Moved shared Club fixture-effect semantics into a dedicated `xr-light-fixture-effects.js` module, so presets now choose named effect families and the passthrough renderer consumes one centralized effect contract for shutters, edge runners, silhouette cuts, and room-window beats.
- Renamed the desktop `YouTube Playlist` shortcut to `YT Synth` and added a second desktop tab-audio shortcut `YT House/Disco` that opens the configured house/disco playlist on its selected first track.
- Added new passthrough-native `auroraCurtain` and `floorHalo` fixture effect families, wiring them into `Aurora Drift` and the room-fill presets so the ceiling can read as moving light bands and the floor can read as deliberate underglow instead of only broad soft washes.
- Tightened `Aurora Drift` further by narrowing its ceiling masks and sharpening the internal aurora striping, so the passthrough result should read more like bands than like large overhead blobs.
- Retuned the remaining Club presets so `Disco Storm`, `Neon Wash`, `Stereo Chase`, and `Pulse Strobe` now have more clearly separated passthrough roles through denser mixed hits, stronger room-fill wash, mirrored side chases, and a darker sharper strobe layout.
- Retuned the shared `Soft Wash` and `Shutters` effect families toward softer overlapping plumes and less panel-like striping, so the first isolated effect passes in the TestLab read less like glowing windows.
- Replaced the old preset-first work tracker with a new effect-first `TODO.md` structure, so the next work now flows from the separate isolated test lab to surface mapping, preset composition, Butterchurn seam work, and headset validation.

## [0.7.0] - 2026-03-21

### Added
- Added a new passthrough lighting mode `Club` with fixture-rig-driven washes, wall beams, and controlled strobe accents, plus three new hybrid club presets: `Neon Wash`, `Stereo Chase`, and `Pulse Strobe`.
- Extended the shared audio analysis output with club-oriented derived metrics including `kickGate`, `bassHit`, `transientGate`, `strobeGate`, `colorMomentum`, `motionEnergy`, `roomFill`, and stereo impact values for left/right accents.
- Expanded the VR menu audio meter block beyond the old five values so the new club-lighting debug metrics are visible in-headset.
- Added one shared `Darkness` slider under `Scene Lighting` so passthrough can range from nearly lights-only darkening to fully additive lighting without exposing Club-specific macro sliders.

### Changed
- Rebuilt the lighting preset layer around shared fixture groups and derived scene lights, so passthrough and virtual scene lighting now follow the same preset-defined musical intent instead of only sharing a small directional-light set.
- Upgraded the passthrough overlay masks from circle-only spots to oriented ellipses, so `Club` washes and beams read more like distinct fixture types instead of the same rounded blobs.
- Added explicit ceiling, wall, and floor surface budgets inside the `Club` passthrough renderer, including a floor-visibility lift and stronger surface-specific shaping so floor spill stays visible more reliably and walls read more differently from ceiling wash.
- Removed the `Club Intensity`, `Room Fill`, and `Strobe Amount` menu sliders again, so Club passthrough behavior is driven by the active preset and audio response while the new shared `Darkness` slider handles passthrough darkening across lighting modes.
- Changed the passthrough overlay compositing so lit masks now open the local darkening instead of only drawing additive color, making low-darkness Club and Spots lighting reveal the real passthrough image inside the light hits.
- Lowered the shared `Darkness` default from `20%` to `5%` and moved the moving Club wall-light track up to the same ceiling-height anchor used by the passthrough spots.
- Changed the audio-reactive `Uniform -> Music` passthrough blend to follow `beatPulse` specifically instead of the broader weighted audio drive, and renamed the VR menu readout from `Beat` to `Beat Pulse` for clarity.
- Strengthened `Left Hit` and `Right Hit` so stereo-heavy material now produces more obvious side-biased Club beam intensity and a small extra left/right spatial offset in passthrough.
- Changed the startup defaults to `Passthrough = Uniform -> Music` with `Intensity = -100%`, and `Scene Lighting = Club` with `Pulse Strobe` as the initial light preset.
- Moved stereo-biased Club wall fixtures onto explicit left/right ceiling-height wall tracks, so side accents no longer wander around the generic room perimeter.
- Pushed the Club side-wall tracks toward clearer front/back lanes and stretched the wall beam masks further, so side accents read less mechanically and more like directed wall beams.
- Broadened ceiling wash masks and strengthened floor spill with larger, softer, more numerous low-position projections, so overhead fill and underglow separate more clearly.
- Reworked `Aurora Drift` toward aurora-like overhead light bands, so that preset now reads less like a generic soft wash and more like a specific atmospheric lighting variant.
- Differentiated passthrough reveal strength by fixture type, so washes, beams, and strobes now open the real room through the darkening with visibly different behavior instead of only adding colored light.

### Fixed
- Re-anchored passthrough `Spots` lighting to the real `local-floor` room space with approximate ceiling, floor, and side-wall anchors, so real headset movement changes the colored passthrough spots like room lights while stick locomotion no longer shifts them through passthrough.

## [0.6.0] - 2026-03-20

### Changed
- Split passthrough into a dedicated controller/orchestrator in `xr-passthrough.js` plus pure mode definitions in `xr-passthrough-modes.js`, so mode catalogs and blend formulas are separated cleanly from runtime fallback and overlay rendering.
- Added `xr-menu-sections.js` and moved the lower interactive menu area onto generic section/control descriptors, so passthrough, scene lighting, jump mode, world opacity, eye distance, visualizer mode, and preset selection all share the same generic layout, render, and hit-test path.
- Replaced the old single `Passthrough Mix` control with a structured passthrough menu: a `Blend Mode` cycler for `Uniform` and `Flashlight`, a separate `Scene Lighting` section with `Lighting Mode` and `Light Preset` cyclers, and a uniform-only submode row for `Manual` and `Music`.
- Replaced the old directional audio toggle with one bipolar `Intensity` slider, so negative values push Butterchurn into passthrough and positive values push passthrough into Butterchurn.
- Extended the visualizer background-composite path from one global alpha to a generic uniform-or-masked opacity state, allowing the new hand-driven `Flashlight` passthrough mode without moving headset-specific logic into the visualizer module.
- Added soft music-reactive passthrough spot lighting derived from the active scene-lighting preset, alongside the retained uniform tint mode and black fallback path for non-passthrough sessions.
- Changed the default `Lighting Mode` to `Spots`.
- Tightened passthrough menu hit zones and slider ownership so lighting buttons no longer move sliders, the blend mode uses a proper cycler, and `Flashlight` drags no longer drive both sliders at once.
- Rebuilt the lower menu as a state-driven flow layout so active passthrough controls stay grouped together, scene-lighting controls live in their own section, and the lower menu panels now move automatically with the active mode state.
- Keep a grabbed XR slider captured even when the ray moves above or below its row, instead of only continuing while the pointer stays directly over the original slider track.
- Strengthened the music-reactive uniform blend so full bipolar intensity reaches a much wider practical Butterchurn/passthrough range and positive vs. negative values now read more clearly apart, with the end labels now shown as `Vis -> Passthrough` and `Passthrough -> Vis`.
- Fixed the XR menu hit-test regression from the generic menu refactor that could crash the XR frame loop with `Cannot read properties of undefined (reading 'length')` when pointing at the menu.
- Released stale XR menu hand ownership when a tracked-pointer hand disappears for a frame, fixing the bug where left or right controller buttons could stop responding after menu interaction.

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
- Moved passthrough UI state, visualizer blend syncing, and the lighting-tinted fallback compositor into a dedicated `xr-passthrough.js` module so the visualizer stays independent of scene-lighting and session-specific passthrough policy.
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
