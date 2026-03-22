# TODO

## Purpose

This file is the current source of truth for the next lighting and visualizer work.

Rules:

- Work effect-first, not preset-first.
- Tune individual effect families before tuning presets.
- Validate shape first, then surface suitability, then preset composition.
- Do not keep historical or already-completed checklist items here.
- Remove obsolete tasks instead of accumulating dead planning text.
- Prefer small, testable slices with visible results.
- For isolated evaluation, prefer temporary runtime/devtools injection unless a persistent debug tool is clearly worth keeping.

## 1. Effect Lab Foundation

Goal:
Create a reliable way to inspect one lighting effect at a time in a VR-like room view on desktop and in headset.

### Open tasks

- [x] Add a separate `TestLab.html` page for isolated single-effect inspection instead of embedding the lab into the main application UI.
- [x] Add direct previous/next effect controls on the test page.
- [x] Feed live audio metrics into the test page through the normal runtime, while preserving a debug-audio path for deterministic testing.
- [x] Improve the room preview so ceiling, walls, and floor feel more spatially natural and less like clipped planes.
- [x] Improve the VR readability of the isolated effect page so the same effect isolation path works cleanly in-headset, not only on desktop.
- [x] Support explicit context variants when useful, such as `ceiling`, `wall`, and `floor` for the same effect family.
- [x] Make the active test conditions more explicit when the test page is using live audio versus debug audio.

### Next decision point

- [ ] Evaluate whether passthrough reveal versus additive tint should follow one shared rule or remain effect-family-specific by design.
- [ ] Compare the same lab variants under matched darkness and audio conditions before changing preset composition again.
- [ ] Record which families should primarily open the room, which should primarily tint it, and which intentionally mix both.

### Definition of done

- [x] Each effect can be viewed alone.
- [ ] The test view does not default to a fake glowing rectangle unless that is intentionally the effect being tested.
- [ ] Desktop preview is useful for rough form evaluation.
- [ ] Headset preview remains the final authority.

## 2. Individual Effect Tuning

Goal:
Tune each effect family until it has a clear visual identity on its own.

### 2.1 Soft Wash

Target:
A broad, soft light fill, not a hard cutout and not a rectangular window.

Open tasks:

- [ ] Make the shape read as diffuse light instead of a lit panel or window.
- [ ] Decide which surfaces it actually works on.
- [ ] Tune reveal versus additive tint behavior.
- [ ] Tune softness, spread, and falloff.
- [ ] Decide whether this remains a core effect or only a support effect.

Acceptance:

- [ ] Reads as room light, not as a projected rectangle.
- [ ] Useful as a neutral base layer.

### 2.2 Shutters

Target:
A wash with visible internal striping or slicing, without becoming a rectangular panel.

Open tasks:

- [ ] Keep the stripe idea but remove the panel/window read.
- [ ] Decide whether stripes should move or stay mostly static.
- [ ] Tune stripe spacing, contrast, and softness.
- [ ] Verify on ceiling and wall separately.

Acceptance:

- [ ] Clearly different from Soft Wash.
- [ ] Stripe structure is visible without turning into a flat screen-like shape.

### 2.3 Edge Runner

Target:
Directional moving light lanes along room edges or wall lanes.

Open tasks:

- [ ] Make the effect read as a runner, not as two glowing panels.
- [ ] Improve spatial composition on left/right wall lanes.
- [ ] Tune motion direction, travel speed, and beam length.
- [ ] Test whether the effect is better as a wall-edge effect than a general wall effect.

Acceptance:

- [ ] Clearly reads as movement along room structure.
- [ ] Strong left/right identity where intended.

### 2.4 Silhouette Cut

Target:
A harder cutout/reveal effect that intentionally opens the room through the darkness.

Open tasks:

- [ ] Decide the best shape language for the cutout.
- [ ] Tune reveal strength so the room opening is legible.
- [ ] Prevent it from becoming visually identical to `Room Window Beat`.
- [ ] Test comfort when used in motion-heavy presets.

Acceptance:

- [ ] Strong reveal identity.
- [ ] Distinct from plain strobe or plain wash.

### 2.5 Room Window Beat

Target:
A beat-driven room opening effect that intentionally behaves like a rhythmic reveal window.

Open tasks:

- [ ] Clarify how this differs from Silhouette Cut.
- [ ] Tune beat timing and pulse sharpness.
- [ ] Decide whether the shape should stay geometric or become less literal.
- [ ] Validate whether it belongs on walls only or also on the ceiling.

Acceptance:

- [ ] Strong beat-linked reveal behavior.
- [ ] Not confused with generic strobe flashes.

### 2.6 Aurora Curtain

Target:
Aurora-like overhead bands or ribbons, not blobs and not windows.

Open tasks:

- [ ] Make the effect clearly read as bands/ribbons in isolation.
- [ ] Tune stripe density, band separation, and sway.
- [ ] Improve ceiling-only composition.
- [ ] Confirm whether multiple narrower lanes work better than fewer broad ones.
- [ ] Avoid blob-like clustering.

Acceptance:

- [ ] Immediately reads as aurora-like bands.
- [ ] Clearly works on ceiling.
- [ ] Does not read as flat glowing panels.

### 2.7 Floor Halo

Target:
A clear underlighting effect for the floor with glow/ring/core character.

Open tasks:

- [ ] Make the floor effect clearly visible and grounded.
- [ ] Tune ring versus core balance.
- [ ] Tune radius, softness, and density.
- [ ] Confirm whether it should remain symmetric or become more directional in some presets.
- [ ] Verify visibility during real headset movement.

Acceptance:

- [ ] Clearly readable on the floor.
- [ ] Does not disappear too easily.
- [ ] Feels like underglow/spill, not a flat sticker.

## 3. Surface Mapping

Goal:
Decide which effect families belong on which room surfaces.

### Open tasks

- [ ] Create an explicit mapping table for `ceiling`, `wall`, and `floor`.
- [ ] Mark which effects are primary, secondary, or unsuitable on each surface.
- [ ] Decide which effect/surface combinations should be avoided completely.
- [ ] Define when an effect should change shape depending on surface.
- [ ] Validate that ceiling, wall, and floor reads stay visually distinct.

### Required output

- [ ] A simple effect-to-surface compatibility table.
- [ ] A short `do not use` list for bad combinations.

## 4. Preset Composition

Goal:
Build presets only after the individual effects and their surface roles are understood.

### Open tasks

- [ ] Rebuild preset composition from the validated effect families.
- [ ] Define the primary and secondary effects for each preset.
- [ ] Define dominant surfaces for each preset.
- [ ] Define audio-driving priorities per preset.
- [ ] Ensure presets are visually distinct even before headset fine-tuning.

### Preset targets

#### Aurora Drift

- [ ] Lead with `Aurora Curtain`.
- [ ] Add only subtle supporting effects.
- [ ] Keep the preset atmospheric, slow, and ceiling-led.
- [ ] Avoid anything that breaks the aurora identity.

#### Disco Storm

- [ ] Make it chaotic, mixed, and hit-heavy.
- [ ] Use more aggressive beam/strobe/reveal combinations.
- [ ] Keep it clearly distinct from `Pulse Strobe`.

#### Neon Wash

- [ ] Make it the broad room-fill preset.
- [ ] Prefer large, colorful wash behavior over aggressive runners or cuts.
- [ ] Keep the room feeling filled rather than punctured.

#### Stereo Chase

- [ ] Make left/right movement unmistakable.
- [ ] Use runner-style behavior and stereo-reactive placement.
- [ ] Ensure the preset is spatially readable, not just brighter on one side.

#### Pulse Strobe

- [ ] Make it dark, peak-driven, and sharp.
- [ ] Keep the base mood darker than the other presets.
- [ ] Use strong transient/beat punctuation without losing comfort control.

### Definition of done

- [ ] Each preset has a clear identity sentence.
- [ ] Each preset has a clear effect stack.
- [ ] No two presets feel like minor variants of the same thing.

## 5. Butterchurn Background / Sky Presentation

Goal:
Improve the visualizer background so it works better behind or alongside the lighting system.

### 5.1 Rear sky seam diagnosis

- [ ] Confirm whether the rear seam is caused by UV wrap, texture edge mismatch, buffer tiling count, or another mapping issue.
- [ ] Reproduce the seam in a controlled way.
- [ ] Identify whether the seam appears in all visualizer modes or only some.

### 5.2 Horizontal buffer alignment

- [ ] Test whether the sky texture should map to exactly 4 horizontal buffer spans across 360 degrees.
- [ ] Verify whether the current mapping drifts off exact quarter segmentation.
- [ ] Confirm whether exact 4-panel alignment reduces the rear seam.

### 5.3 Edge sampling strategy

- [ ] Compare left/right mirror sampling versus standard horizontal wrapping.
- [ ] Keep the horizontal strategy consistent with the already-handled top/bottom behavior where appropriate.
- [ ] Check whether mirrored edges create better continuity than wrap.
- [ ] Check whether mirroring introduces visible symmetry artifacts.

### 5.4 Cross-mode audit

- [ ] Inspect the same seam/sampling issue in the other visualizer modes.
- [ ] Decide whether the fix belongs in a shared sky sampling path or only in specific modes.
- [ ] Document mode-specific exceptions if a global fix is wrong.

### 5.5 Acceptance

- [ ] No obvious rear seam during headset rotation.
- [ ] No obvious left/right edge discontinuity.
- [ ] No new mirrored-artifact problems worse than the current seam.
- [ ] Visual motion remains continuous.

## 6. Menu Architecture And Reliability

Goal:
Stabilize the shared menu architecture before attempting another dynamic sizing refactor.

### Open tasks

- [ ] Document the currently stable baseline for the shared menu path, including which parts still rely on a fixed safety cap and why.
- [ ] Reproduce the recent menu regression in a controlled way:
  - blank desktop menu preview
  - stretched main-app menu
  - XR hit-test misalignment
  - one-eye XR failure when opening the menu
- [ ] Identify which menu responsibilities must always share one model:
  - logical section list
  - logical layout height
  - rendered texture height
  - desktop preview size
  - XR plane size
  - desktop pointer hit regions
  - XR ray hit regions
- [ ] Add a mandatory verification checklist for future menu sizing work:
  - main app desktop preview
  - main app XR menu
  - TestLab desktop preview
  - TestLab XR menu
  - button and slider hit accuracy
- [ ] If dynamic sizing is retried, reintroduce it only in small slices instead of one large refactor.
- [ ] If dynamic sizing is retried, derive one central menu layout model and ensure every menu path reads only that model.
- [ ] Add a safe fallback rule:
  - if the menu exceeds a chosen limit, degrade predictably instead of rendering blank, stretching, or breaking one XR eye
- [ ] Add a regression-prevention note for menu changes once the architecture is stable again.

### Definition of done

- [ ] Render, preview, plane size, and hit testing cannot diverge from each other for the same menu state.
- [ ] Main app and TestLab both remain stable when sections are added or removed.
- [ ] Menu architecture changes can be validated quickly without breaking the live XR menu path.

## 7. Headset Validation

Goal:
Use headset checks as the final gate after desktop and isolated tests.

### Open tasks

- [ ] Validate each effect family individually in the headset.
- [ ] Validate surface suitability in the headset.
- [ ] Validate final preset composition in the headset.
- [ ] Validate floor visibility in real room movement.
- [ ] Validate comfort for strobes, cuts, and high-motion effects.
- [ ] Validate Butterchurn sky seam behavior by rotating fully through the rear view.

### Required reporting format

Use short notes only:

- `Effect: ...`
- `Surface: ...`
- `Preset: ...`
- `Global: ...`

### Definition of done

- [ ] Effect shapes read correctly in the headset.
- [ ] Surface mapping feels natural in room scale.
- [ ] Presets are clearly differentiated.
- [ ] Background seam issues are either fixed or narrowed to a specific remaining cause.

## Execution Order

Work in this order:

1. Effect Lab Foundation
2. Individual Effect Tuning
3. Surface Mapping
4. Preset Composition
5. Butterchurn Background / Sky Presentation
6. Menu Architecture And Reliability
7. Headset Validation

Do not skip ahead to preset tuning before the effect families are individually credible.
