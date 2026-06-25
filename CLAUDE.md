# CLAUDE.md — Unipegaso AutoPlay (Chrome)

Context for future Claude Code sessions editing this repository.

## What this is

Chrome MV3 extension that watches the Unipegaso video-lesson player and
automatically advances to the next unfinished lesson once the current one is
marked complete. Chrome port of the Firefox extension
`unipegaso-autoplay`.

- Activation URL pattern: `https://lms.pegaso.multiversity.click/videolezioni/<course>/<index>`
- User-facing language: **Italian** (LMS is Italian-only). Keep popup,
  notifications, and manifest description in Italian. Source code, comments,
  commit messages and docs stay in English.

## Chrome vs Firefox notes

This port mirrors the Firefox codebase one-to-one except where the platform
differs:

- **API namespace.** Uses the native `chrome.*` MV3 APIs (promise-based), not
  `browser.*`. Types come from `@types/chrome`.
- **Background.** MV3 `service_worker` (`background.js`), not a background
  `scripts` array.
- **Async messaging.** Chrome does not honor a Promise returned from an
  `onMessage` listener, so `background.ts` replies via `sendResponse` and
  returns `true` for the async `get-settings` path.
- **No `browser_specific_settings`.** The `gecko` block (extension id, min
  version, AMO data-collection) is Firefox-only and removed.

## Behaviour rules

1. **Trigger.** A lesson row is a clickable row (`cursor-pointer`) with a play
   SVG whose `fill` is either `#2FA33D` (green, done) or `#CF1D56` (red, todo).
   The current row is identified by the visible `.bg-platform-primary.rounded-r-lg`
   left bar (non-current rows use `invisible` on that same bar).
2. **Completion.** A video row is done when its `.w-1/12` percentage cell shows
   `100%`. Once the _current_ row reaches 100%, wait
   `NAVIGATION_DELAY_MS` (3 s) and click the first following row that is:
   - not `Test di fine lezione`
   - not `Dispensa`
   - not already done
3. **Obiettivi rows.** Click them if not completed. They have no percentage —
   dwell on them for `OBIETTIVI_DWELL_MS` (3 s) and then advance to the next
   lesson.
4. **Accordion expansion.** Only expand accordions inside the currently-active
   module (wrapped by `.bg-platform-light-gray`). Never click a _grey_ module
   (different from the active one) — doing so collapses the current module and
   breaks the flow.
5. **Toggle.** Users enable/disable auto-advance from the popup. Setting lives
   in `chrome.storage.sync` under `unipegaso-autoplay:settings`. The content
   script reacts to changes via `storage.onChanged`.
6. **Notifications.** The content script asks the service worker to fire a
   `chrome.notifications` entry when: listening starts, paused, or a lesson
   transition fires.

## Source layout

```txt
src/
  manifest.json         MV3 manifest (service_worker background)
  background.ts         Service worker: message handler + notifications
  content.ts            Content script orchestrator (observe → decide → click)
  popup/                Toolbar popup (Italian UI) — html + css + ts
  lib/
    types.ts            Shared types + constants
    dom.ts              Pure DOM parsing (scanPage, getRowElement, …)
    navigator.ts        Pure decision logic (decide, findNextTarget)
    storage.ts          Settings load/save/watch helpers
  icons/                PNG icons (48 / 96 / 128)
scripts/build.mjs       esbuild bundler (entries: content, background, popup)
test/
  fixtures/
    lesson-tree.html    Trimmed DOM snapshot of a real lesson page
    synthetic.ts        Factory helpers for unit tests
  dom.test.ts           Snapshot + structural tests against the real fixture
  navigator.test.ts     Unit tests for the pure decision logic
```

## Commands

| Command                           | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `npm run build`                   | Bundle `dist/` (manifest + scripts + popup + icons) |
| `npm run dev`                     | Watch mode build                                    |
| `npm run start:chrome`            | Launch Chrome with the extension loaded             |
| `npm run package`                 | `web-ext build` a distributable zip                 |
| `npm run lint`                    | ESLint (flat config, type-aware)                    |
| `npm run format` / `format:check` | Prettier                                            |
| `npm run typecheck`               | `tsc --noEmit`                                      |
| `npm test`                        | Vitest (jsdom environment)                          |

## Required checks before reporting work done

After **any** code change (TS, JS, JSON, manifest, scripts, config), run the
full gate locally before committing — CI enforces the same checks and a miss
ships a broken build:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
```

If you touched the build pipeline, also run `npm run package` and confirm
`web-ext-artifacts/unipegaso_autoplay-<ver>.zip` is produced. Only claim a task
complete once every gate passes; if one fails, fix the root cause — do not
bypass or defer.

## Design guardrails

- Keep parsing **pure**: `dom.ts` and `navigator.ts` must not touch the
  network, storage, or timers. Side effects live in `content.ts` only. This
  keeps the logic easy to snapshot in tests without mocking browser APIs.
- When the DOM structure changes, update `lib/dom.ts` selectors _and_ the
  `test/fixtures/lesson-tree.html` fixture together so the snapshot stays
  meaningful.
- Never hard-code user strings in Italian inside `lib/`. Put them in
  `content.ts` / `popup/` so the logic layer stays locale-agnostic.
- Do not add telemetry. The extension must work entirely client-side.

## Gotchas

- `classList.contains('w-1/12')` works despite the slash — Tailwind emits the
  literal class token.
- The currently-selected lesson row often has `percentage: 0` right after the
  click while the player loads. `decide()` treats a current-row video as
  "in progress" until it actually reaches 100%, preventing premature skips.
- `chrome.storage.sync` may be unavailable in policy-restricted profiles —
  `storage.ts` transparently falls back to `chrome.storage.local`.
- Content scripts run in an isolated world and cannot observe the page's own
  `history.pushState`; the service worker watches
  `webNavigation.onHistoryStateUpdated` and messages the content script so SPA
  navigations re-arm the controller.
