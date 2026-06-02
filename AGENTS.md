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

Repo root: `/home/rona/Repositories/.ru/RogerNavelsaker/little-coder` (only path; no `~/projects/little-coder`).

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

### Cross-repo dependencies

Three repos must stay in sync for every linehash change. Skipping any step leaves the consumer running stale code while logs look fine.

| Repo | Path | Role |
|---|---|---|
| **linehash** | `/home/rona/Repositories/.ru/RogerNavelsaker/linehash` | Rust source. Provides anchored reads, edit, diff, fuzzy matching, patch-apply. |
| **nixpkg-linehash** | `/home/rona/Repositories/.ru/RogerNavelsaker/nixpkg-linehash` | Nix package wrapper. Pinned in `.flox/env/manifest.toml` as `linehash.flake = "github:RogerNavelsaker/nixpkg-linehash"`. |
| **little-coder** | this repo | Consumer. Flox env exposes `linehash` on PATH. |

#### Sync chain (run for EVERY linehash change)

```
linehash source  →  push  →  nixpkg-linehash bumps input rev  →  push  →  little-coder flox update
```

Concrete steps:

1. **linehash repo** — edit Rust source. Run `cargo build --release` (use `CC=/usr/bin/gcc` inside the flox env; the flox cc wrapper rejects `-m64`). Run tests. `git commit` + `git push` to GitHub. Note the new commit SHA.
2. **nixpkg-linehash repo** — update the linehash flake input to the new commit: `nix flake lock --update-input linehash` (or `nix flake update` for all inputs). `git commit` + `git push`. The flake on GitHub is what flox resolves.
3. **little-coder repo** — `flox update` (or `flox update -i linehash`) to refresh the env to the latest nixpkg-linehash. Verify with `<new-subcommand> --help` against the `linehash` binary on PATH. **Never reference linehash by absolute path** in extension code — call `linehash` from PATH only.

#### Verification gate (before declaring a cross-repo task done)

- `linehash <new-subcommand> --help` succeeds from a fresh shell in little-coder.
- `which linehash` resolves through flox, not `~/.local/bin` or `~/.cargo`.
- Extension `LINEHASH_BIN` resolver finds it via `which linehash`, no hardcoded paths.
- Invoke harness (`bun .pi/extensions/basic-tools/src/invoke.ts ...`) produces the expected behavior end-to-end, not just unit tests.

#### Failure mode to watch for

Editor builds locally, tests pass against the local-built binary, but flox env still serves the OLD binary because steps 2 or 3 were skipped. Symptom: invoke smoke fails with "unrecognized subcommand" or silent fallback to the previous implementation. Fix: walk the chain again from step 2.

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
| `.pi/extensions/basic-tools/src/invoke.ts` | planner, editor | drive any basic-tool deterministically; print all three output channels |

### Tool inspection layer — `invoke.ts`

`bun .pi/extensions/basic-tools/src/invoke.ts <tool> '<json-params>' [--cwd <dir>]` drives a basic-tool exactly as pi would and prints **all four channels** in one shot:

1. **`details` JSON** — structured tool result (the source of truth for state, anchors, applied flags).
2. **`content.text`** — TOON-encoded payload the LLM actually sees.
3. **`── collapsed ──`** — the one-line summary card.
4. **`── expanded ──`** — the full rendered card (ANSI colors, diffs, highlights).

Use it for:

- **Schema verification.** If a tester report claims a parameter doesn't exist, drive `invoke.ts` with that parameter — if it succeeds, the bug is the tester model, not the extension.
- **Display verification.** Compare collapsed vs expanded output without toggling the tester pane.
- **Pre-tester sanity.** Run the exact tool call locally before dispatching tester. Saves a round trip when the issue is obvious.
- **Channel separation.** Confirm that LLM-visible data (`content.text`) contains the field, even if the human renderer (`expanded`) doesn't surface it yet.

Examples:
```sh
bun .pi/extensions/basic-tools/src/invoke.ts grep '{"pattern":"foo","path":"src","context":3}'
bun .pi/extensions/basic-tools/src/invoke.ts edit '{"edits":[{"path":"/tmp/x","old_text":"a","new_text":"b"}]}'
bun .pi/extensions/basic-tools/src/invoke.ts find '{"path":"src","type":"file","limit":10}'
```

Supported tools: `read, edit, write, grep, find, ls, shell, ast-search`.

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

### Planner workflow

Sequential, never parallel: **editor → wait for `EDITOR REPORT` → tester → wait for `TESTER REPORT` → next task**.

1. Pick next ticket: `sd ready --priority=0..3` (Backlog hidden).
2. `sd update <id> --status=in_progress`.
3. Dispatch to editor with substrate refs (`ml prime --files <paths>`, `sd show <id>`) and explicit acceptance: files to edit, tests to add, `bun run typecheck && bun test <file>` command.
4. Wait for `EDITOR REPORT` in planner pane. Do not dispatch tester before it arrives.
5. After editor reports done on extension code, tester must reload artifacts. `/reload` only re-reads context/settings — it does **not** re-import extension modules or refresh tool schemas. Rules:
   - Extension `.ts` source edited (schema, handler, display) → `nu scripts/send new tester` (fresh pi process re-imports the module).
   - `AGENTS.md` or `skills/` changed (no code change) → `nu scripts/send reload tester`.
   - Both changed → `reload` then `new`.
   - Pure prompt-only test (no code change) → no reload needed.
6. Dispatch tester with the exact exercise (tool call + inputs + expected shape). Tester runs, then `nu scripts/report "TESTER REPORT: ..."`.
7. Planner inspects (in order of trust):
   - `bun .pi/extensions/basic-tools/src/invoke.ts <tool> '<json>'` → **deterministic ground truth**. Drives the tool exactly as pi would and prints details JSON, content.text (LLM-visible TOON), collapsed render, and expanded render. Use this first when a tester report looks wrong — the tester model may pass an unexpected param shape and misreport schema.
   - `nu scripts/dump tester` (with ANSI) → check tester-pane rendering, color/highlight, transparency artifacts.
   - `nu scripts/dump tester --plain` → check tester-visible response text.
   - Pi session logs: `nu scripts/log tester` for structured tool calls in the tester run.
8. On pass: `sd close <id>`, record insight (`ml record ...`), `sd sync && ml sync`. On fail: dispatch fix to editor with the dump excerpt as evidence.

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
