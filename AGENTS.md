# little-coder — source repo

Hard fork of itayinbarr/little-coder. Upstream is registered as the `upstream` git remote for inspection only — never merge, cherry-pick selectively.

## Project knowledge (grove)

Architecture decisions, issues, and specs live in grove stores in this repo:

```sh
seeds list                    # open issues + backlog
tl list                       # active specs + plans
ml query architecture         # architecture patterns + decisions
ml query tools                # tool surface reference
ml query tech                 # paths, commands, topology
ml prime architecture tools   # compact priming prompt
```

Grove stores: `.seeds/` `.mulch/` `.trellis/` `.canopy/`
Flox env provides: `seeds` (`sd`), `mulch` (`ml`), `trellis` (`tl`), `canopy` (`cn`), `bun`.

Session notes: `/home/rona/projects/little-coder/memory-bank/activeContext.md`

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

## Planner / Editor / Tester

Zellij session: `pi-tool-upgrade`, agents tab.

| Pane | Role |
|---|---|
| `terminal_0` | planner (Claude Code) |
| `terminal_1` | editor: `pi -ne -e npm:pi-continue -e npm:pi-schedule-prompt -e npm:@josephyoung/pi-file-reference` |
| `terminal_2` | tester: `pi` (plain) |

### Scripts (relative to repo root)

| Script | Who | Purpose |
|---|---|---|
| `scripts/send` | planner | dispatch prompt to editor or tester pane |
| `scripts/dump` | planner | capture pane output (ANSI or `--plain`) |
| `scripts/log` | planner | inspect Pi session logs |
| `scripts/report` | editor, tester | send report back to planner |

```nu
# Dispatch
nu scripts/send editor '<prompt>'
nu scripts/send tester '<prompt>'
nu scripts/send new editor          # reset pane
nu scripts/send reload tester       # /reload after AGENTS.md change
nu scripts/send toggle tester       # toggle last tool card
# Capture
nu scripts/dump tester              # full ANSI
nu scripts/dump tester --plain      # plain text
# Report back
nu scripts/report "EDITOR REPORT: status=done; files=...; tests=...; result=...; blockers=none"
```

### Report formats

**Editor:** `EDITOR REPORT: status=<done|blocked>; files=<changed>; tests=<cmd and pass/fail>; result=<summary>; blockers=<none|details>`

**Tester:** `TESTER REPORT: status=<done|blocked>; files=<changed or none>; tests=<cmd and pass/fail>; result=<summary>; blockers=<none|details>`

### Session hygiene

After extension source changes: compile (`bunx tsc` in extension dir) → `/reload` → `/new`.
Pi crash recovery: `/quit` + Enter → relaunch → redispatch.

<!-- mulch:start -->
## Expertise (Mulch)
<!-- mulch-onboard-v:1 -->

This project uses [Mulch](https://github.com/jayminwest/mulch) for git-native structured expertise.

**At the start of every session**, run:
```
ml prime
```

This injects compressed domain expertise (architecture patterns, tool surface, tech context) into the agent's system prompt.

**Quick reference:**
- `ml query <domain>` — Read expertise records for a domain
- `ml prime [domains...]` — Generate a priming prompt from expertise records
- `ml record <domain> --type <type> --name <name> "<content>"` — Record a new expertise entry
- `ml search <query>` — Search across all domains
- `ml status` — Show record counts per domain
- `ml sync` — Stage and commit `.mulch/` changes

**Domains:** `architecture` (patterns + decisions), `tools` (surface + parity), `tech` (paths, commands, topology)
<!-- mulch:end -->

<!-- seeds:start -->
## Issue Tracking (Seeds)
<!-- seeds-onboard-v:1 -->

This project uses [Seeds](https://github.com/jayminwest/seeds) for git-native issue tracking.

**At the start of every session**, run:
```
sd prime
```

This injects session context: rules, command reference, and workflows.

**Quick reference:**
- `sd ready` — Find unblocked work
- `sd create --title "..." --type task --priority 2` — Create issue
- `sd update <id> --status in_progress` — Claim work
- `sd close <id>` — Complete work
- `sd dep add <id> <depends-on>` — Add dependency between issues
- `sd sync` — Sync with git (run before pushing)

### Before You Finish
1. Close completed issues: `sd close <id>`
2. File issues for remaining work: `sd create --title "..."`
3. Sync and push: `sd sync && git push`
<!-- seeds:end -->

<!-- trellis:start -->
## Trellis

Trellis stores specs, plans, and handoffs as git-native artifacts under `.trellis/`.
Never open the directory directly — use the CLI so events, locks, and validations stay consistent.

- `tl init` — scaffold `.trellis/` in a repo
- `tl prime` — load current specs, plans, and recent handoffs for an agent
- `tl ready` — list unblocked work to pick up now
- `tl spec create <id>` / `tl plan create <id>` — create durable intent and execution artifacts
- `tl handoff append <plan> --from <role> --to <role> --summary "..."` — record transfer of control
- `tl sync` — stage and commit changes under `.trellis/`
<!-- trellis:end -->

<!-- canopy:start -->
## Prompt Management (Canopy)
<!-- canopy-onboard-v:2 -->

This project uses [Canopy](https://github.com/jayminwest/canopy) for git-native prompt management.

**At the start of every session**, run:
```
cn prime
```

This injects prompt workflow context: commands, conventions, and common workflows.

**Quick reference:**
- `cn list` — List all prompts
- `cn render <name>` — View rendered prompt (resolves inheritance)
- `cn emit --all` — Render prompts to files
- `cn update <name>` — Update a prompt (creates new version)
- `cn sync` — Stage and commit .canopy/ changes

**Do not manually edit emitted files.** Use `cn update` to modify prompts, then `cn emit` to regenerate.

**Mulch metadata:** Prompts can declare expertise dependencies via `mulch.prime.domains`, `mulch.prime.files`, `mulch.budget`, `mulch.on_empty`, plus a top-level `extends_mulch` flag (override-by-default; merge with parent when `true`). Canopy never shells out to `ml` — `cn render --json` surfaces the resolved declaration in a top-level `mulch` field for consumers to act on. See SPEC.md "Mulch Metadata".
<!-- canopy:end -->
