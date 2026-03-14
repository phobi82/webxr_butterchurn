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
  - Do not add “nice-to-have” features, abstractions, or refactors on your own.
  - Do not invent mini-frameworks or complex architectures.

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
  - `element.textContent = "..."`;
  - `element.value = "..."`;
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
- **All comments must be in English.**
- Keep code concise and contained; avoid sprawl and unnecessary variables while staying efficient, maintainable, and well-structured.
- Prefer **straight-line code** over unnecessary abstractions:
  - Do **not** introduce tiny helper functions (“mini-functions”) that are only used once, if the inline code is clear and short.
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

- Follow the user’s description **literally and precisely**.
- When working on WebXR movement, prefer small, testable iterations over large rewrites so walking/jumping behavior stays easy to verify against the current baseline.
- If the user wants expressions evaluated (e.g. `setVolt(3+3)` or `setVolt((2+1)*8)`), implement this behavior:
  - Use the simplest robust approach that matches the request (for example, JavaScript expression evaluation when acceptable).
- Avoid building overengineered parsers or AST frameworks unless explicitly requested.
- Avoid unnecessary wrapper functions or one-off abstractions; only introduce helpers when they clearly reduce repetition or complexity and keep the code compact.

## 7. Error Handling

- Do not let a single faulty input crash the entire app.
- Use `try { ... } catch (err) { ... }` when evaluating user expressions or running user scripts.
- Error messages should be concise and technical, without jokes.

## Testing Guidelines
- when Chrome DevTools MCP is available, use it to its full extent for manual verification (console, network, storage, performance, screenshots, viewport/device emulation, and interaction automation as applicable).
- If required to inspect external web content, prefer Chrome DevTools MCP.
- When Chrome DevTools MCP opens a blank `about:blank` page alongside the local app page during verification, close the blank page immediately so only the relevant project pages remain open.
- To inspect the in-VR menu without changing repository code, prefer a temporary Chrome DevTools script injection that opens the existing `menuCanvas` as a large DOM overlay or refreshes an `img` from `menuCanvas.toDataURL(...)`; use this only for manual verification and reload afterward instead of committing preview-only helpers.
- For logic changes, add temporary console diagnostics during development and remove before commit; document manual test steps in the PR.

## Changelog
- Maintain `CHANGELOG.md` using Keep a Changelog format; update the Unreleased section with notable user-facing changes.
- Maintain `README.md` alongside code changes so feature descriptions, controls, and local usage stay in sync with the current project state.

## Commit & Pull Request Guidelines
- Commits use short, imperative subjects (e.g., `Tighten auto-wire pacing`) with focused diffs; include a brief body when behavior shifts.
- When the user wants to commit, explicitly suggest whether a `major`, `minor`, or `patch` version bump is appropriate under Semantic Versioning, based on how much the public behavior changed: breaking changes imply `major`, backward-compatible feature additions imply `minor`, and backward-compatible fixes or polish imply `patch`.
- When a checkpoint visibly matches the user's intent and the worktree is in a sensible state to snapshot, proactively suggest making a commit and include the corresponding Semantic Versioning bump recommendation if a version increment is warranted.
- PRs should explain the change, list reproduction steps, and attach before/after screenshots for UI tweaks; link issues when applicable and call out gameplay balance impacts.

## Security & Configuration Tips
- Do not commit secrets or service keys; analytics ID already lives in `index2.html`.
- Keep assets checked in and referenced via relative paths to support offline hosting.
