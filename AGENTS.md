# dsh-better-display

Reading-view plugin for DeepSeek Harness. It does not run its own server. The host loads `lib/` and registers two exact HTTP routes.

Functions and modules are camelCase (`createRevealHandler`, `ensureStyles`). React components are PascalCase (`Reader`, `SettingsSection`).

## Setup

From a clean clone, Node.js `^22.19.0 || >=24`:

```sh
npm ci
```

No database and no extra local service. These environment variables are optional. `npm test` does not need them. Empty values mean unset.

- `DSH_HOME` overrides `~/.dsh` when user skill roots are scanned.
- `DSH_AGENTS_HOME` overrides `~/.agents` for that same scan.
- `DSHX_HARNESS` is an absolute DeepSeek Harness checkout. The compat check inside `npm run build` uses it, or `~/.config/dshx/harness` when it is unset.

Names are listed in `.env.example`. Do not commit `.env`. `lib/` stays tracked; do not gitignore it.

## Build and test

```sh
npm run build
npm test
npm run typecheck
```

`npm run build` runs the harness compat check, `tsc`, and `tsdown`. The compat check needs `ripgrep` and a Harness tree. `tools/client-build.js` is vendored, so the client bundle step does not clone dshx when that file is present.

`node scripts/changelog.mjs` prints notes from `git log` and does not rewrite `CHANGELOG.md`. The npm script name is `changelog`.

## Interactive path

The plugin adds no login and no token. Use a DeepSeek Harness Web Host you can already open. If that host shows its own sign-in wall, finish the host login first. There is no plugin credential and no bypass account.

1. `npm ci`, then `npm run build` with `DSHX_HARNESS` or `~/.config/dshx/harness` set to the Harness checkout the compat check expects. `pnpm` must be on `PATH` for the plugin CLI.
2. From this repo root, install the local package into the web profile only:

```sh
dsh plugin --profile web add ./dsh-better-display
```

3. Reopen that Web Host once and reload the page. The host reads `dsh.bundle` at boot. Do not also insert the same row by hand in the profile `cordis.patch.yml`; the plugin mounts twice.
4. Open the **阅读** tab. Send a turn, or open one already in the session. While it runs you should see steps and thinking. After it succeeds, the process folds and the final answer stays. That is the interaction.
5. Settings → **Better Display** calls `GET /better-display/skill-status`. A file reveal from the reading column `POST`s `/better-display/reveal` with JSON `{"path":"...","sessionId":"..."}` and expects `{"ok":true}`. Both routes exist only after the host has loaded the plugin. Shapes are in `docs/openapi.yaml`.

Blank reader, a missing stylesheet, or a fold that never finishes: `docs/runbooks/blank-reader.md`.
