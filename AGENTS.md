# little-coder — source repo

Hard fork of itayinbarr/little-coder. Upstream is registered as the `upstream` git remote for inspection only — never merge, cherry-pick selectively.

## Planning project

Architecture decisions, extension design, and work items live here:

    /home/rona/projects/little-coder/

Read `AGENTS.md` and `memory-bank/` there before making structural changes.

## Architecture

little-coder is a self-contained pi distribution. It ships two compiled binaries per platform plus a cross-platform data archive.

### Release artifacts

| Asset | Description |
|---|---|
| `little-coder-<os>-<cpu>` | Launcher binary. Handles `install`/`update`/`uninstall`/`version` + spawns pi. |
| `pi-<os>-<cpu>` | Compiled pi runtime with patches baked in. No node_modules needed at runtime. |
| `data.tar.gz` | Cross-platform archive: compiled extensions, AGENTS.md, skills, config. |

### Installed layout (`~/.little-coder/`)

```
~/.little-coder/
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── basic-tools/index.js        # read,edit,write,grep,find,ls,shell,ast_search,revert_file
│       ├── context/index.js            # ctx_record,ctx_packet,ctx_inject
│       └── pi-file-reference/index.js  # @filepath reference injection
├── vendor/
│   └── pi/
│       └── pi-<os>-<cpu>              # compiled pi (patches baked in at build time)
├── AGENTS.md
├── models.json
└── skills/
```

No `node_modules`. Extensions are self-contained ESM bundles (all deps inlined at build time). The pi binary is standalone — no bun required at runtime.

### Source layout

```
little-coder/
├── bin/
│   └── little-coder.ts         # launcher source
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── _shared/            # shared TypeScript helpers
│       ├── basic-tools/        # index.ts + src/
│       ├── context/            # index.ts + src/
│       └── pi-file-reference -> ../../vendor/pi-file-reference/extensions
├── vendor/
│   └── pi-file-reference/      # vendored @josephyoung/pi-file-reference v0.1.7
├── scripts/
│   ├── build-release.ts        # builds all release artifacts
│   └── patch-pi.ts             # patches pi dist (baked into pi binary at build time)
├── skills/
├── models.json
├── install.sh
├── flake.nix
└── package.json                # devDependencies only
```

### Build flow (build-release.ts)

1. Compile `bin/little-coder.ts` → `dist/little-coder-<os>-<cpu>` (launcher binary).
2. Apply `scripts/patch-pi.ts` to `node_modules/@earendil-works/pi-coding-agent/dist/`, then compile pi's entry → `dist/pi-<os>-<cpu>`.
3. Compile each `.pi/extensions/*/index.ts` → `dist/extensions/*/index.js` (all deps bundled inline; no `--external` flags).
4. Pack `dist/data.tar.gz`: compiled `index.js` files, `AGENTS.md`, `skills/`, `models.json`, `.pi/settings.json`, `vendor/` source.

### Dev vs installed mode

The launcher detects its mode from `process.argv[1]`:

- **Dev** (`bun bin/little-coder.ts`): `pkgRoot` = repo root; uses `bun + node_modules/@earendil-works/pi-coding-agent`; applies `patch-pi.ts` at runtime.
- **Installed** (compiled binary): `pkgRoot` = `~/.little-coder`; uses `vendor/pi/pi-<os>-<cpu>` directly; no bun needed.

## Key paths

- Extensions: `.pi/extensions/`
- Shared helpers: `.pi/extensions/_shared/`
- Launcher: `bin/little-coder.ts`
- Build: `scripts/build-release.ts`
- Patches: `scripts/patch-pi.ts`

## Dev commands

```sh
bun install                          # install devDependencies (pi-coding-agent, typebox, etc.)
bun run dev                          # run launcher from source (dev mode)
bun run typecheck                    # tsc --noEmit
bun run test                         # run .test.ts files under .pi/extensions/
bun run build                        # compile launcher binary → dist/little-coder
bun run build:release                # full release: launcher + pi binary + data.tar.gz
```

## Patching pi

`scripts/patch-pi.ts` applies idempotent, best-effort edits to pi's installed dist. In dev mode the launcher applies them on every launch (self-healing). In release mode `build-release.ts` applies them before compiling pi so patches are baked into the binary — no runtime patching needed.

Current patches:
- Suppress bare "Operation aborted" assistant-message marker (harness interventions surface their own line; ESC is self-evident).
