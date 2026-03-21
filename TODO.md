# TODO

## Purpose

This file is the source of truth for the passthrough club-lighting work.

It is written for AI agents and future sessions.

Rules:

- Work in small verified steps.
- After finishing a task, update this file immediately.
- Mark completed tasks with `[x]`.
- Leave unfinished tasks as `[ ]`.
- Do not mark a task as done unless the code path exists and was verified.
- Prefer visible headset-facing improvements before further abstraction.
- Keep stick locomotion out of passthrough room anchoring.
- Preserve existing non-Club modes unless the task explicitly changes them.

## Main Goal

Build a music-reactive lighting system that makes passthrough feel like a real colorful club environment in the user's room.

Target result:

- Ceiling, walls, and floor all receive visible reactive light.
- Real headset movement changes the perceived light placement in room space.
- Stick locomotion does not move passthrough light anchors.
- The effect reads as club lighting, not as a few generic blobs.
- The VR menu exposes the relevant controls and debug information.

## Hard Constraints

- Use the real room reference space for passthrough anchoring.
- Do not regress `None`, `Uniform`, or `Spots`.
- Do not break opaque VR rendering.
- Keep the menu understandable; avoid fixture-level UI overload.
- Prefer a shared lighting rig that drives both passthrough and scene lighting.
- Treat comfort as a hard requirement: clamp excessive strobe and full-screen blowout.

## Current Implemented Baseline

- [x] Add shared derived audio metrics in `xr-audio-controller.js`
- [x] Extend shared lighting state and fixture-group support in `xr-foundation.js`
- [x] Move lighting presets toward a fixture-rig model in `xr-light-presets.js`
- [x] Add passthrough lighting mode `Club` in `xr-passthrough-modes.js`
- [x] Add Club macro controls for intensity, room fill, and strobe amount
- [x] Feed Club controller state through passthrough UI state and control handlers
- [x] Use real room-space anchoring instead of stick locomotion for passthrough placement
- [x] Add room-anchored fixture placement across ceiling, walls, and floor
- [x] Expand VR menu audio readout beyond the old five values
- [x] Add oriented ellipse masks so Club fixtures are not limited to circular spots
- [x] Fix the shader uniform upload regression that disabled passthrough lighting

## Known Gaps

- [ ] Floor lighting is still not consistently visible enough in the headset
- [ ] Ceiling, wall, and floor contributions do not yet feel clearly distinct
- [ ] Presets are not yet separated enough in visual identity
- [ ] Beam behavior is still too soft and too close to generalized spot behavior
- [ ] Wash behavior does not yet read as strong room-filling light
- [ ] Brightness and comfort tuning is incomplete
- [ ] Real headset validation is still missing for the current Club tuning
- [ ] Scene-light derivation is still less expressive than the passthrough path

## Active Execution Slices

Use this section to track the current small implementation blocks inside the larger phases.

### Slice 1: Surface Visibility Baseline

- [x] Step 1.1 Implement explicit Club surface budgets in `xr-passthrough.js`
- [x] Step 1.2 Add floor-biased strength, radius, and anchor compression so floor light has a minimum visible presence
- [x] Step 1.3 Increase ceiling-versus-wall surface shaping inside the Club renderer
- [ ] Step 1.4 Visually validate the new floor behavior and retune default values if needed
- [ ] Step 1.5 Tune the default room anchor layout once the new surface budgets are observed in-headset

### Slice 2: Surface-Specific Wall Motion

- [x] Step 2.1 Move stereo-biased Club wall fixtures onto explicit left/right ceiling-height wall tracks instead of the generic room perimeter
- [x] Step 2.2 Add front/back-biased side-wall lanes and longer wall-beam masks so wall motion reads less mechanically
- [ ] Step 2.3 Retune those wall tracks after headset observation so side-wall motion feels intentional instead of mechanical

### Slice 3: Ceiling And Floor Character

- [x] Step 3.1 Broaden and soften ceiling wash masks so overhead light reads more like room fill
- [x] Step 3.2 Strengthen floor spill with larger, softer, more numerous low-position projections
- [ ] Step 3.3 Retune ceiling and floor balance after headset observation so neither surface dominates unnaturally

### Slice 4: Preset Characterization

- [x] Step 4.1 Pull the Club presets further apart with more distinct fixture mixes and motion density
- [x] Step 4.2 Rework `Aurora Drift` toward aurora-like overhead light bands instead of generic soft wash
- [x] Step 4.3 Continue separating the remaining presets until each one has a clearer passthrough-specific identity in code and local preview
- [ ] Step 4.4 Validate that those stronger preset identities still read clearly in-headset

### Slice 5: Passthrough-Native Effects

- [x] Step 5.1 Give wash, beam, and strobe fixtures different passthrough-reveal strength so light hits can act as different kinds of windows into the real room
- [x] Step 5.2 Implement moving reveal shutters, edge runners, silhouette cuts, and room-window beats as selectable fixture effect families
- [x] Step 5.3 Move fixture-effect semantics into a shared lighting module so presets choose effect families and passthrough only resolves and renders them
- [x] Step 5.4 Add preset-specific aurora-curtain and floor-halo effect families so `Aurora Drift` and room-fill presets read less like generic soft blobs
- [ ] Step 5.5 Retune the new effect families in-headset so each one stays readable without collapsing into generic blobs

## Working Protocol For Future AI Sessions

1. Read this file first.
2. Read only the modules relevant to the next unchecked block.
3. Choose one focused block and finish it before starting another.
4. Verify with:
   - `node --check` on changed JS files
   - local browser launch of `index.html`
   - console check for new errors
5. If the change affects the VR menu, inspect the real menu preview before claiming completion.
6. Update this file by checking completed items and, if needed, splitting remaining work into smaller tasks.
7. Update `README.md` and `CHANGELOG.md` when behavior visible to users changes.

## Phase 1: Surface Visibility Baseline

Goal: make ceiling, walls, and especially floor visibly participate in Club lighting before deeper polish.

- [ ] Add explicit per-surface energy budgets for ceiling, walls, and floor
- [ ] Guarantee a minimum visible floor contribution when Club mode is active
- [ ] Prevent the floor contribution from disappearing on low-angle or low-energy tracks
- [ ] Keep floor visibility without washing out the full passthrough image
- [ ] Tune the default room anchor layout so every surface gets at least one strong readable contribution
- [ ] Verify that floor, wall, and ceiling are all represented at default Club settings

Definition of done:

- Floor lighting is visible in headset tests on normal music, not only on extreme bass peaks.
- Ceiling, walls, and floor each have a distinct readable contribution at default Club settings.

## Phase 2: Surface-Specific Fixture Behavior

Goal: make each room surface feel intentional instead of sharing the same generalized spot logic.

- [ ] Give ceiling fixtures wider wash behavior with larger soft ellipses
- [ ] Give wall fixtures more directional beam behavior with longer aspect ratios
- [ ] Give floor fixtures stronger spill behavior with broader low-position projection
- [ ] Separate surface defaults for size, softness, intensity, and motion
- [ ] Add per-surface weighting from audio metrics instead of one shared multiplier
- [ ] Ensure left/right stereo impact can bias side walls without breaking overall room balance

Definition of done:

- Ceiling reads as overhead wash.
- Walls read as side beams or wall lighting.
- Floor reads as spill or underglow, not as missing or accidental light.

## Phase 3: Better Fixture Types

Goal: make wash, beam, and strobe behave like distinct lighting families.

- [ ] Strengthen wash fixtures as broad ambient color fills
- [ ] Make beam fixtures narrower, longer, and more directional
- [ ] Give strobe fixtures short and controlled peak behavior instead of generic intensity boosts
- [ ] Add surface-aware fixture routing so not every fixture type appears equally on every surface
- [ ] Tune fixture layering so a strong wash can coexist with sharper beam accents
- [ ] Avoid a result where all fixture types collapse into overlapping blobs

Definition of done:

- Wash, beam, and strobe can be identified by look alone in Club mode.

## Phase 4: Audio-Reactivity Refinement

Goal: make the new metrics drive convincing club behavior instead of broad generic reactivity.

- [x] Introduce derived metrics such as `kickGate`, `bassHit`, `transientGate`, `strobeGate`, `roomFill`, `leftImpact`, and `rightImpact`
- [ ] Re-tune attack, decay, and cooldown values for headset-visible behavior
- [ ] Make floor spill react more strongly to low-end events
- [ ] Make side-wall beams react more strongly to stereo imbalance
- [ ] Make wash color tempo react to smoothed momentum instead of jittery instantaneous changes
- [ ] Prevent rapid metric chatter from producing uncomfortable flicker
- [ ] Confirm mono or narrow stereo content still produces a convincing room result

Definition of done:

- Bass visibly drives room fill and floor presence.
- Transients create short readable accents.
- Stereo-heavy tracks create noticeable side-wall asymmetry.

## Phase 5: Preset Differentiation

Goal: make presets feel clearly different in the headset, not only numerically different in code.

- [x] Add preset families beyond the older directional-light presets
- [x] Re-tune `Aurora Drift` as the softer, flowing baseline
- [x] Re-tune `Disco Storm` as a more energetic mixed-beam preset
- [x] Re-tune `Neon Wash` as a strong color-fill preset
- [x] Re-tune `Stereo Chase` as a clearly left/right-driven preset
- [x] Re-tune `Pulse Strobe` as the aggressive transient preset with strong safety limits
- [ ] Verify each preset remains recognizable after shared comfort clamps
- [ ] Document the intended identity of each preset in code comments or README where useful

Definition of done:

- A user can switch presets in headset and immediately understand that each preset has a different visual role.

## Phase 6: Shader And Mask Quality

Goal: improve the visual shape language of Club lighting.

- [x] Replace circle-only Club masks with oriented ellipses
- [x] Add shared fixture effect families for shuttered washes, edge-running beams, silhouette cuts, and room-window beat accents
- [x] Add preset-specific aurora-curtain and floor-halo effects to strengthen overhead banding and floor underglow
- [ ] Improve edge shaping so washes, beams, and strobe accents have more distinct falloff
- [ ] Add better softness controls per fixture type
- [ ] Add stronger elongated beam masks for wall and side fixtures
- [ ] Reduce visual repetition so multiple fixtures do not all look mathematically identical
- [ ] Check that mask growth does not create unexpected full-screen overlays or clipping artifacts

Definition of done:

- Club lighting no longer reads as "the same spot rendered in different places."

## Phase 7: Room Calibration And Spatial Plausibility

Goal: make the lighting feel like it exists in the user's room.

- [ ] Revisit default ceiling height, wall distance, and floor projection assumptions
- [ ] Tune anchor placement so lights feel room-mounted rather than camera-attached
- [ ] Check real head translation for spatial plausibility across multiple surfaces
- [ ] Ensure stick locomotion does not affect passthrough anchor placement
- [ ] Add optional calibration constants only if the current defaults cannot achieve stable results
- [ ] Avoid exposing calibration UI unless it is clearly needed

Definition of done:

- The user can move physically and the lights still feel anchored in the room.

## Phase 8: VR Menu And Debugging

Goal: expose enough control and debugging to tune Club mode without clutter.

- [x] Add Club macro controls to the scene-lighting menu flow
- [x] Expand the VR menu audio display to include the new Club-relevant metrics
- [ ] Verify the menu layout remains readable with the larger audio panel
- [ ] Decide whether to add a dedicated Club debug subsection or keep the current compact panel
- [ ] Add temporary tuning views only if they materially speed up headset iteration
- [ ] Ensure desktop and XR slider interactions both work for all Club controls
- [ ] Confirm hidden/inactive controls never capture input accidentally

Definition of done:

- Club tuning can be performed from the menu without guessing internal state.

## Phase 9: Virtual Scene Lighting Derivation

Goal: make the virtual scene feel connected to the passthrough rig without overpowering it.

- [ ] Revisit how fixture groups derive ambient, directional, and accent scene lighting
- [ ] Make the scene follow the same musical language as passthrough while staying calmer
- [ ] Improve beam-derived scene accents without making opaque VR harsh or noisy
- [ ] Check that Club presets still produce coherent opaque VR lighting even without passthrough
- [ ] Preserve compatibility with existing fallback and non-passthrough paths

Definition of done:

- Passthrough and virtual scene feel related, but passthrough remains the visual priority.

## Phase 10: Comfort, Clamping, And Safety

Goal: keep the effect intense but usable.

- [ ] Re-tune brightness clamps to avoid white blowout
- [ ] Re-tune strobe limits and cooldowns for comfort
- [ ] Prevent full-room flashing on dense transient-heavy material
- [ ] Ensure high-energy tracks stay colorful instead of collapsing toward white or gray
- [ ] Check that low-energy tracks still retain visible structure and do not disappear
- [ ] Validate that defaults are exciting without being fatiguing

Definition of done:

- Club mode feels intense, colorful, and readable without becoming hostile.

## Phase 11: Headset Validation

Goal: treat real XR testing as a required deliverable, not optional polish.

- [ ] Test with at least one bass-heavy track
- [ ] Test with at least one stereo-active track
- [ ] Test with at least one transient-heavy track
- [ ] Validate floor visibility specifically
- [ ] Validate side-wall stereo behavior specifically
- [ ] Validate head translation vs stick locomotion specifically
- [ ] Record tuning notes and feed them back into this TODO

Definition of done:

- Real headset observations confirm that the room effect works, not just the code path.

## Phase 12: Documentation And Release Readiness

Goal: close the loop once the lighting actually works in the headset.

- [ ] Keep `README.md` aligned with the current Club controls, presets, and behavior
- [ ] Keep `CHANGELOG.md` aligned with visible lighting changes
- [ ] Decide whether `Club` should remain optional or become the default passthrough lighting mode
- [ ] Only consider a release candidate after headset validation and comfort tuning are complete
- [ ] Only create a tag if the state is explicitly treated as a release candidate

## Phase 13: Motion Programs And Cue Logic

Goal: add more recognizable club-light movement patterns beyond static reactive placement.

- [ ] Add slow sweep programs for ceiling and wall fixtures
- [ ] Add beat-synced chase patterns that travel across room surfaces
- [ ] Add alternating left/right cue programs for stereo-active music
- [ ] Add fixture phase offsets so groups do not pulse in perfect lockstep
- [ ] Add preset-level control over motion density and motion speed
- [ ] Add restrained idle motion so lights still feel alive on quieter passages
- [ ] Ensure motion programs respect comfort limits and do not create nausea-inducing drift

Definition of done:

- Club mode can produce recognizable movement patterns, not only reactive intensity changes.

## Phase 14: Color System Improvements

Goal: make the lighting color language more intentional and more club-like.

- [ ] Add preset-level color palette definitions instead of relying mostly on free-running hue movement
- [ ] Add palette families such as warm club, neon cyan-magenta, acid green, sunset, and monochrome accent
- [ ] Add controlled palette stepping on beat events
- [ ] Add slow palette morphing for atmospheric presets
- [ ] Add color contrast rules so adjacent surfaces do not collapse into the same hue too often
- [ ] Add saturation protection so high-energy peaks remain colorful
- [ ] Add optional reduced-color presets for cleaner, more deliberate looks

Definition of done:

- Presets have a distinct color identity and maintain that identity under high energy.

## Phase 15: Surface Zoning And Room Composition

Goal: treat the room as a set of lighting zones instead of one generic canvas.

- [ ] Split the room into zones such as front wall, rear wall, left wall, right wall, ceiling center, ceiling edge, and floor center
- [ ] Allow presets to emphasize different zone groups
- [ ] Add zone-specific fixture density so not every area is populated equally
- [ ] Add front/back asymmetry for more club-like stage orientation
- [ ] Add center-versus-perimeter behaviors for floor and ceiling
- [ ] Ensure room zoning still works plausibly in smaller physical spaces

Definition of done:

- The room composition feels staged and intentional rather than evenly distributed.

## Phase 16: Advanced Fixture Effects

Goal: add richer fixture behavior once the baseline room lighting is solid.

- [ ] Experiment with gobo-like breakup patterns for selected beam fixtures
- [ ] Add narrow scanner-style sweeps for high-energy presets
- [ ] Add soft pulse halos around strong bass-driven floor or ceiling hits
- [ ] Add layered dual-beam looks for selected wall fixtures
- [ ] Add restrained flash accents that feel like club hits instead of full-screen strobes
- [ ] Add rotating or oscillating beam orientation for selected presets
- [ ] Reject any effect that looks synthetic in passthrough or destroys room readability

Definition of done:

- At least one advanced effect adds obvious value without making passthrough look fake or noisy.

## Phase 18: Preset Management And Authoring

Goal: make the lighting system easier to extend once the core behavior is correct.

- [ ] Define a cleaner preset schema for fixture groups, palettes, motion, and comfort limits
- [ ] Add comments or lightweight docs describing how to create a new Club preset
- [x] Move shared fixture-effect semantics into one dedicated module instead of keeping them split between presets and passthrough
- [ ] Reduce repeated preset boilerplate where it is safe to do so
- [ ] Add validation or safe defaults for incomplete preset definitions
- [ ] Consider whether per-preset macro defaults should override global defaults
- [ ] Keep preset authoring simple enough for future manual tuning sessions

Definition of done:

- Adding or tuning a preset becomes predictable and low-risk.

## Phase 19: Performance And Fallback Strategy

Goal: keep advanced lighting features viable on real devices.

- [ ] Measure the cost of additional fixtures and more complex masks
- [ ] Define a soft maximum for active passthrough fixtures per frame
- [ ] Add quality tiers or graceful degradation if advanced effects become too expensive
- [ ] Ensure menu responsiveness stays stable while Club mode is active
- [ ] Ensure fallback paths remain valid when advanced Club features are disabled
- [ ] Avoid adding features that only work on desktop preview but fail on headset hardware

Definition of done:

- New features scale without silently making the headset experience unstable.

## Phase 20: Experimental Feature Backlog

Goal: track optional ideas without letting them distract from the main quality path.

- [ ] Test whether room-edge vignette lighting can increase immersion without becoming obvious post-processing
- [ ] Test whether a subtle virtual haze approximation improves beam readability in passthrough
- [ ] Test whether beat-synced scene geometry accents should inherit Club color palettes
- [ ] Test whether selected fixtures should react to detected musical sections such as buildup, drop, or breakdown
- [ ] Test whether "DJ booth" or "front stage" orientation presets help room composition
- [ ] Test whether user-selectable room size profiles are worth exposing
- [ ] Discard any experiment that improves screenshots but not actual headset perception

Definition of done:

- Only experiments with clear headset value graduate into the main implementation phases.

## Next Recommended Execution Order

- [ ] Finish floor visibility and per-surface energy budgets
- [ ] Improve ceiling, wall, and floor differentiation
- [ ] Strengthen beam length, directionality, and stereo side behavior
- [ ] Tune wash size, color fill, and floor spill response
- [ ] Separate preset identities in headset tests
- [ ] Perform comfort tuning and brightness clamp tuning
- [ ] Revisit scene derivation after passthrough quality is solid
- [ ] Add motion programs and color-palette differentiation after the baseline room effect is reliable
- [ ] Explore advanced fixture effects only after comfort and performance stay stable
- [ ] Decide on release readiness only after real headset validation

## Notes For The Next Agent

- The current highest-priority complaint is that the floor is still not visible enough.
- The fixture-effect architecture was cleaned up into one shared module; do not spread effect semantics back across multiple files.
- Do not spend the next session on more architecture unless it directly helps visible room lighting.
- Prefer improvements that are easy to judge in-headset over deeper abstraction work.
- If a task only changes internal structure but does not improve visible output, defer it.
- Treat Phases 13-20 as optional expansion tracks unless they directly help the current visible quality problems.
