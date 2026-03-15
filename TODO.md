# Refactoring TODO

This file tracks the architectural refactoring work so no planned step gets lost.
Completed items stay checked. Open items remain unchecked until they are implemented and verified.

## Completed

- [x] Extract shared audio-source lifecycle logic from `index.html` into [`xr-audio-controller.js`](./xr-audio-controller.js).
  - [x] Move stream capture, microphone capture, debug audio, tab opening, and stream cleanup into the audio module.
  - [x] Keep audio UI updates driven by controller state instead of scattered DOM writes.
  - [x] Remove unnecessary callback and return nesting in the audio path where it did not add value.

- [x] Extract locomotion and collision logic from `index.html` into [`xr-locomotion.js`](./xr-locomotion.js).
  - [x] Move XR locomotion, jump handling, floor resolution, and desktop first-person movement into one module.
  - [x] Keep XR movement state and desktop movement state explicit instead of relying on hidden globals.

- [x] Extract menu rendering and runtime logic into [`xr-menu-ui.js`](./xr-menu-ui.js) and [`xr-menu-controller.js`](./xr-menu-controller.js).
  - [x] Move menu canvas drawing, preview overlay rendering, and hit-testing into the menu UI module.
  - [x] Move XR rays, slider dragging, menu state, and desktop overlay interaction into the menu controller.
  - [x] Remove trivial internal wrappers where they were only forwarding to `menuUi`.

- [x] Extract the shared scene render pipeline into [`xr-scene-renderer.js`](./xr-scene-renderer.js).
  - [x] Move WebGL setup, shader creation, buffer setup, floor rendering, menu plane rendering, and XR/desktop view rendering into one renderer module.
  - [x] Avoid splitting the renderer into many smaller files.

- [x] Centralize shared helpers in [`xr-visualizer-utils.js`](./xr-visualizer-utils.js).
  - [x] Consolidate duplicated color helpers such as `hslToRgb` and `hueToRgb`.
  - [x] Consolidate shared vector and quaternion helpers.
  - [x] Consolidate shared empty audio-metric defaults.
  - [x] Move shared matrix helpers such as `identityMatrix`, `multiplyMatrices`, `translateScale`, `translateRotateYScale`, and `basisScale` out of `index.html`.

- [x] Add the browser shell layer in [`xr-app-shell.js`](./xr-app-shell.js).
  - [x] Move desktop control panel creation into one top-level shell module.
  - [x] Move status label, audio controls, and canvas creation into the shell.
  - [x] Keep `index.html` closer to composition instead of DOM construction.

- [x] Add the runtime orchestration layer in [`xr-app-runtime.js`](./xr-app-runtime.js).
  - [x] Move XR session startup and shutdown into the runtime module.
  - [x] Move desktop and XR render loops into the runtime module.
  - [x] Move browser event registration and input wiring into the runtime module.
  - [x] Keep this as one large runtime module instead of splitting it into many small files.

- [x] Reduce obvious mini-functions and low-value wrapper functions.
  - [x] Remove empty callback wrappers.
  - [x] Remove direct pass-through helper functions where they did not define a meaningful API boundary.
  - [x] Replace trivial matrix-copy wrappers with direct `.set(...)` usage.

- [x] Reduce unnecessary return and callback nesting.
  - [x] Simplify audio activation flows.
  - [x] Replace `.then(function() { ... }.bind(this))` patterns where direct `async` logic was clearer.
  - [x] Simplify button handlers that only wrapped a single Promise-returning call.

- [x] Introduce grouped configuration objects in [`index.html`](./index.html).
  - [x] Group scene tuning into `sceneConfig`.
  - [x] Group shell copy and labels into `shellConfig`.
  - [x] Group audio source settings into `audioConfig`.
  - [x] Group locomotion settings into `locomotionConfig`.
  - [x] Group menu layout and defaults into `menuConfig`.
  - [x] Group runtime-specific thresholds into `runtimeConfig`.

## Open

- [ ] Consolidate module APIs so the top-level architecture is more uniform and reusable.
  - [ ] Review every custom module and document its effective public API.
  - [ ] Standardize lifecycle methods where useful.
    - [ ] Prefer consistent meanings for `init`, `reset`, `endSession`, and similar transitions.
    - [ ] Remove redundant public getters if a clearer shared state or config boundary exists.
  - [ ] Standardize state access patterns.
    - [x] Introduce a consolidated `getState()` path for menu runtime state and move runtime and renderer call sites away from multiple narrow menu getters.
    - [x] Route XR button-state changes through the shell API so runtime and entry wiring stop mutating XR control elements directly.
    - [x] Move desktop preview event registration into the menu controller so runtime no longer binds directly to preview-canvas internals.
    - [ ] Decide where `getState()` is better than multiple narrow getters.
    - [ ] Keep narrow getters only when they make call sites significantly clearer or reduce coupling.

- [ ] Reduce remaining data clumps inside the runtime and module wiring.
  - [ ] Review the `sharedResources` object in [`index.html`](./index.html) and [`xr-app-runtime.js`](./xr-app-runtime.js).
    - [ ] Verify that each entry belongs there and is not a hidden global in disguise.
    - [ ] Extract a clearer runtime resource shape if the current object becomes too broad.
  - [ ] Review `sceneMath`, `math`, `factories`, and `config` passed into `createXrAppRuntime(...)`.
    - [ ] Merge or rename groups where that would reduce cognitive overhead.
    - [ ] Avoid turning config objects into generic dumping grounds.

- [ ] Tighten the composition root in [`index.html`](./index.html) further without adding new modules.
  - [x] Check whether any remaining function in `index.html` is still runtime behavior instead of configuration.
  - [x] Keep only configuration, composition, and low-level shared math there.
  - [ ] Move any new runtime drift back into [`xr-app-runtime.js`](./xr-app-runtime.js) if it appears.

- [ ] Clean up remaining odd constructions in [`xr-app-runtime.js`](./xr-app-runtime.js).
  - [ ] Review repeated defensive patterns and inline fallbacks.
  - [ ] Check whether callback objects can be simplified further without hiding behavior.
  - [ ] Review event-handler closures for repeated logic that should be centralized.
  - [ ] Remove any remaining one-off variables that only alias a value once without improving readability.

- [ ] Review module reusability with the goal of making feature modules usable in other projects.
  - [ ] Check whether modules depend on browser globals more than necessary.
  - [x] Reduce coupling to `window.*` where a dependency can be passed explicitly in reusable browser-facing modules such as the shell, runtime, menu UI, and scene renderer.
  - [ ] Verify that modules do not assume this specific app layout unless that is their explicit responsibility.
  - [ ] Keep each module large enough to stay coherent, but generic enough to be reused.

- [ ] Review naming consistency and conceptual consistency.
  - [ ] Align names like `renderer`, `controller`, `manager`, `source`, and `shell` with their real responsibility.
  - [ ] Rename any misleading terms that still reflect old architecture rather than current behavior.
  - [ ] Check boolean naming consistency and state-field naming consistency.

- [ ] Review comments for adequacy and usefulness.
  - [ ] Ensure every major module boundary has a short English orientation comment.
  - [ ] Ensure non-obvious logic in movement, rendering, and runtime orchestration is commented.
  - [ ] Remove comments that only restate trivial code.

- [ ] Do a final repo-wide smell pass after the API and state consolidation.
  - [ ] Search again for mini-functions.
  - [ ] Search again for unnecessary callback wrappers and return nesting.
  - [ ] Search again for duplicate fallback logic.
  - [ ] Search again for dead config fields or dead helper functions.

- [ ] Keep documentation in sync with each remaining architectural step.
  - [ ] Update [`README.md`](./README.md) when a public-facing architectural boundary changes.
  - [ ] Update [`CHANGELOG.md`](./CHANGELOG.md) for notable structural changes in the Unreleased section.

- [ ] Keep manual verification attached to each checkpoint.
  - [ ] Reload the app in the browser after each substantial refactoring step.
  - [ ] Check for console errors.
  - [ ] Verify `Debug Audio` and `Stop Audio`.
  - [ ] Recheck XR session flow when headset testing is available.

## Next Recommended Execution Order

- [ ] Phase 1: API consolidation in existing modules.
- [ ] Phase 2: State and config consolidation between `index.html` and `xr-app-runtime.js`.
- [ ] Phase 3: Final runtime smell cleanup.
- [ ] Phase 4: Final documentation and verification pass.
