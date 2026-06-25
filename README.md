# unipegaso-autoplay-chrome

![logo](./assets/images/logo-150.png)

[![conventional-commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![test](https://github.com/veeso/unipegaso-autoplay-chrome/actions/workflows/ci.yml/badge.svg)](https://github.com/veeso/unipegaso-autoplay-chrome/actions/workflows/ci.yml)

Chrome extension that automatically advances to the next lesson on
[Unipegaso](https://lms.pegaso.multiversity.click) video-lesson pages when the
current one is marked complete.

This is the Chrome port of the
[Firefox extension](https://github.com/veeso/unipegaso-autoplay).

- **Languages:** TypeScript (logic) · Italian (UI, since the LMS is Italian-only)
- **Runtime:** Chrome (Manifest V3, service worker)
- **Host:** `https://lms.pegaso.multiversity.click/videolezioni/<corso>/<indice>`

## How it works

1. The content script observes the lesson sidebar.
2. When the current lesson reaches `100%`, it waits 3 seconds and clicks the
   next lesson that is still red (not completed).
3. `Obiettivi` rows are opened and then skipped after a 3 second dwell (they
   carry no percentage of their own).
4. `Test di fine lezione` and `Dispensa` rows are always ignored.
5. When the last lesson of a visible chapter is done, the next collapsed
   chapter **inside the same module** is expanded — grey chapters from other
   modules are left alone, because opening them collapses the active module.

The popup in the toolbar lets you enable/disable the auto-advance at any time.
Desktop notifications announce listening, pause, and each lesson transition.

## Install

### From a release

Grab the `unipegaso_autoplay-<ver>.zip` from the
[latest release](https://github.com/veeso/unipegaso-autoplay-chrome/releases/latest),
unzip it, then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

### Build it yourself

```bash
npm install
npm run build        # outputs ./dist
```

Then load `./dist` as an unpacked extension via the same steps above.

## Development

```bash
npm install
npm run dev          # watch build into ./dist
npm run start:chrome # launches Chrome with the extension loaded
```

### Quality gates

```bash
npm run lint         # eslint (flat config, type-aware)
npm run format:check # prettier
npm run typecheck    # tsc --noEmit
npm test             # vitest (jsdom)
npm run build        # esbuild bundles into ./dist
```

The same gates run in CI on every push / pull request
(`.github/workflows/ci.yml`).

### Packaging

```bash
npm run package
```

Produces a zip in `web-ext-artifacts/` using
[`web-ext`](https://github.com/mozilla/web-ext), ready to upload to the Chrome
Web Store or to load unpacked.

### Release

```bash
npm run release -- patch   # or: minor | major
git push origin main --follow-tags
```

The script bumps `package.json` + `src/manifest.json`, commits, and creates an
annotated `vX.Y.Z` tag. Pushing the tag triggers
[`.github/workflows/release.yml`](./.github/workflows/release.yml), which builds
the extension, zips `dist/`, and publishes a GitHub release with the zip
attached.

## Project layout

See [CLAUDE.md](./CLAUDE.md) for a more in-depth map of the codebase and
behaviour rules.

## Author

Christian Visintin `<christian.visintin@veeso.dev>`

## License

MIT
