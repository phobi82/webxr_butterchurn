# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the single-page entry that wires up styles/scripts and analytics; keep IDs and layout hooks stable.
- Assets (e.g., `test.mp3`, images) live beside the HTML and are referenced with relative paths.
- For future external file ingestion (textures/audio/media), follow `EXTERNAL_ASSET_WORKFLOW.md`.

## Build, Test, and Development Commands
- No build step: open `index.html` in a modern browser to play or verify changes.
- Use browser devtools for logging; avoid adding new dependencies or bundlers without discussion.

## Technology and Scope

- Use **plain HTML + Vanilla JavaScript only**.
- Do **not** use frameworks or external libraries (no React, Vue, jQuery, TypeScript, bundlers, etc.) unless explicitly requested.
- Everything runs **locally in the browser**, no backend, unless explicitly requested.
- This repository is evolving into a **phased WebXR audiovisualizer**:
  - First establish stable XR foundations such as scene bootstrapping, locomotion, jumping, and render-loop stability.
  - Later phases can layer in audio analysis and spatial visualization, but should preserve the working movement baseline unless the user asks to replace it.
- Implement **only what is explicitly requested**:
  - Do not add "nice-to-have" features, abstractions, or refactors on your own, but ask proactively
  - Do not invent mini-frameworks or complex architectures unless requested

## Coding Style & Naming Conventions
- Plain ES5 with global scope; use lowerCamelCase for functions/variables and keep boolean flags suffixed (e.g., `threnodyLoadedBool`).
- Default HTML skeleton (if not overridden by the user):

    <!DOCTYPE html>
    <html>
    	<body>
    		<script>
    			// Code here
    		</script>
    	</body>
    </html>

- Only add `<head>`, `<title>`, `<meta>` and similar if clearly useful or explicitly requested.

### Default body styling

Use this as default when the user does not specify other styles:

    document.body.style.backgroundColor = "#000020";
    document.body.style.color = "#ffff00";
    document.body.style.margin = "0";
    document.body.style.padding = "10px";

### Color conventions (guideline)

- Page background: `#000020`
- Default text: `#ffff00`
- Success / OK: `#00ff00`
- Error / warning: `#ff4040`

### DOM and layout construction

- Create all UI elements with `document.createElement(...)`.
- Configure them via properties and styles, for example:
  - `element.textContent = "...";`
  - `element.value = "...";`
  - `element.style.display = "flex";`
- Append elements using `appendChild` or `append`.
- Use `innerHTML` only for very small, controlled snippets (e.g. an icon span), not for whole layouts.
- For layout, prefer simple **flexbox** or block layout with inline styles, for example:

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "10px";
    document.body.appendChild(container);

- Use clear logical sections, e.g.:
  - Left: controls / script input.
  - Right: logs, diagrams, or results.
  - Top: title or header.

## JavaScript Style

- Use `const` and `let`, never `var`.
- **Indentation** must use **tabs**, not spaces.
- Code must be commented adequately for maintainability, especially around module boundaries, shared state, non-obvious control flow, rendering paths, movement/physics, and any logic that would otherwise require reconstruction by reading line by line.
- Add comments where they meaningfully improve orientation or readability.
- **All comments must be in English and stay short but useful.**
- Keep code concise and contained; avoid sprawl and unnecessary variables while staying efficient, maintainable, and well-structured.
- Prefer a direct top-down style:
  - Show the main flow first and let it call real subproblems below.
  - Use free functions as the default.
  - Use visible state objects instead of hiding mutable state in factory closures.
  - Small domain objects are allowed only when they have a few real methods such as `start`, `stop`, or `render`.
  - Do not add functions whose only job is returning a stored value or forwarding another call.
  - If a function exists, it should change state, derive data, validate input, or run a real step in the flow.
  - Prefer direct state access or direct method references over getter and forwarder wrappers.
  - Avoid meta-factories such as `createXActions`, `createXQueries`, `createXRuntime`, `buildControllerApi`, or similar abstraction layers.
  - Avoid export boilerplate and self-listing objects when they add no real structure.
  - Extract only real subproblems; keep trivial one-off steps inline.
  - Accept some duplication when it keeps the code more direct and readable.
  - Use lists or maps only for real data or a flat visible dispatch, not for hidden meta-logic.
- Prefer **straight-line code** over unnecessary abstractions:
  - Do **not** introduce tiny helper functions ("mini-functions") that are only used once, if the inline code is clear and short.
  - Do **not** introduce single-use variables that only alias another expression once, unless they significantly reduce duplication, make a complex expression clearer, or noticeably keep the code shorter.
  - When in doubt, prefer fewer layers and fewer indirections, as long as readability is not harmed.
- Keep logic localized and simple; avoid overengineering or premature generalization.

Recommended structure order:

1. Constants / configuration
2. State variables
3. DOM creation
4. Event handlers
5. Helper / logic functions (only when they clearly reduce repetition or complexity)
6. Initialization (e.g. `init()` call)

## Behavior and Logic

- Follow the user's description **literally and precisely**.
- If there is any relevant ambiguity or uncertainty, ask a focused clarifying question before implementing instead of guessing.
- Before starting implementation, **ask targeted clarifying questions to confirm exactly what the user wants**.
- **Follow-up questions must take previous answers into account so the clarification adapts to the current result** instead of repeating a fixed checklist.
- Use clarification not only to confirm the request, but also to reveal better, simpler, or safer implementation options when relevant.
- Prefer at 1 to 3 focused clarification questions per round.
- After each answer, reassess what is still unknown before asking the next question.
- Stop asking once the remaining uncertainty no longer affects implementation or verification.
- When working on WebXR movement, prefer small, testable iterations over large rewrites so walking/jumping behavior stays easy to verify against the current baseline.
- If the user wants expressions evaluated (e.g. `setVolt(3+3)` or `setVolt((2+1)*8)`), implement this behavior:
  - Use the simplest robust approach that matches the request (for example, JavaScript expression evaluation when acceptable).
- Avoid building overengineered parsers or AST frameworks unless explicitly requested.
- Avoid unnecessary wrapper functions or one-off abstractions; only introduce helpers when they clearly reduce repetition or complexity and keep the code compact.

## Collaboration and Architecture

- When the task is complex, cross-cutting, performance-sensitive, architecture-sensitive, or otherwise risky, spawn specialized agents or a small agent team as needed so design, implementation, review, and verification are covered with enough depth.
- Use spawned agents to help keep the result clean, minimal, performant, maintainable, and readable, and to verify that repository design rules and style constraints are still being followed after the change.

## 7. Error Handling

- Do not let a single faulty input crash the entire app.
- Use `try { ... } catch (err) { ... }` when evaluating user expressions or running user scripts.
- Error messages should be concise and technical, without jokes.

## Testing Guidelines
- when Chrome DevTools MCP is available, use it to its full extent for manual verification (console, network, storage, performance, screenshots, viewport/device emulation, and interaction automation as applicable).
- If required to inspect external web content, prefer Chrome DevTools MCP.
- When Chrome DevTools MCP opens a blank `about:blank` page alongside the local app page during verification, close the blank page immediately so only the relevant project pages remain open.
- For longer Quest XR debugging after USB authorization, prefer `adb` over Wi-Fi so the headset can stay on power while the data connection stays available.
- For Quest Browser remote debugging, forward `tcp:9222` to `localabstract:chrome_devtools_remote` and refresh `http://127.0.0.1:9222/json/list` after reloads or crashes before reattaching.
- Remote Quest Browser reload is acceptable for debugging, but do not assume a remote-triggered `Enter VR` click will satisfy WebXR user-gesture requirements.
- To inspect the in-VR menu without changing repository code, prefer a temporary Chrome DevTools script injection that opens the existing `menuCanvas` as a large DOM overlay or refreshes an `img` from `menuCanvas.toDataURL(...)`; use this only for manual verification and reload afterward instead of committing preview-only helpers.
- When the user wants to judge one specific feature in isolation, prefer a temporary Chrome DevTools script injection that isolates the relevant runtime path in the running page and also sets the relevant runtime conditions as completely as possible; make the active test conditions explicit in the temporary UI or status text so the user can tell what is currently being evaluated, and keep this test harness temporary and restorable by reload instead of committing it.
- For logic changes, add temporary console diagnostics during development and remove before commit; document manual test steps in the PR.

## Changelog
- Maintain `CHANGELOG.md` using Keep a Changelog format; update the Unreleased section with notable user-facing changes.
- Maintain `README.md` alongside code changes so feature descriptions, controls, and local usage stay in sync with the current project state.

## Commit & Pull Request Guidelines
- Commits use short, imperative subjects (e.g., `Tighten auto-wire pacing`) with focused diffs; include a brief body when behavior shifts.
- When the user wants to commit, explicitly suggest whether a `major`, `minor`, or `patch` version bump is appropriate under Semantic Versioning, based on how much the public behavior changed: breaking changes imply `major`, backward-compatible feature additions imply `minor`, and backward-compatible fixes or polish imply `patch`.
- When a checkpoint visibly matches the user's intent and the worktree is in a sensible state to snapshot, proactively suggest making a commit and include the corresponding Semantic Versioning bump recommendation if a version increment is warranted.
- When suggesting a commit, explicitly say whether the current state looks like a release candidate or only an intermediate checkpoint.
- If the state looks like a release candidate and a concrete semantic version is already implied by the changelog or agreed with the user, explicitly suggest creating the matching Git tag as part of the release flow.
- If the state is only an intermediate checkpoint, explicitly say that no release tag should be created yet.
- PRs should explain the change, list reproduction steps, and attach before/after screenshots for UI tweaks; link issues when applicable and call out gameplay balance impacts.

## Recurring Error Prevention
- If the same avoidable working mistake happens repeatedly, add a short prevention rule here.
- Only add rules that are concrete and operational.

### Rules
- For large file moves or refactors, never use one large `apply_patch` spanning multiple files.
- Split the work into small patches with one clear purpose each.
- In PowerShell `shell_command` calls, never use `&&`; run commands separately unless a PowerShell-safe separator is explicitly required.
- Before implementing UI or module changes, decide the target architecture and grouping first, record the work as a detailed task list, and then implement in small verified steps instead of patching isolated examples.
- Before claiming menu or layout work is done, inspect the actual local menu preview in the browser and verify the affected states visually.
- Before any Chrome DevTools MCP reload, console check, snapshot, or interaction, verify that the selected page is the real app page and not `about:blank`; if `about:blank` exists, close it or explicitly select the app page first.
- For local HTTPS debugging, if browser automation is blocked by an untrusted certificate, state that explicitly before drawing conclusions from local page-load attempts.
- For Quest Browser tab cleanup, never infer the visible tab strip from DevTools target lists, Android task state, or `am force-stop`; verify the visible tabs with a fresh `uiautomator dump` first.
- Before closing any Quest Browser tab, identify the exact tab label and matching `Tab schließen` bounds from the current UI dump; never close a tab-strip button by guesswork.

## Security & Configuration Tips
- Do not commit secrets or service keys; analytics ID already lives in `index2.html`.
- Keep assets checked in and referenced via relative paths to support offline hosting.
