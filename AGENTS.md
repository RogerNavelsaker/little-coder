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
The devenv environment provides the project CLIs, aliases, and Bun.

Repo root: `/home/rona/Repositories/RogerNavelsaker/little-coder` (only path; no `~/projects/little-coder` or `.ru`).

## Architecture

little-coder is a Nix-native pi distribution designed for local developers and Warren autonomous agent containers. It eliminates upstream npm packaging, in-tree updaters, and vendored libc blobs in favor of pure Nix derivations.

### Packaging & Warren Runtime

| Target | Description |
|---|---|
| `packages.default` | Compiled Bun launcher wrapped with nixpkgs dependencies (`pi`, `ripgrep`, `git`) via `makeBinaryWrapper`. |
| `packages.warren-agent` | Minimal distroless container image built via `dockerTools.buildLayeredImage` for Warren RPC sandboxes. |

### Extensions & Assets

- Extensions (`.pi/extensions/*`) are pre-compiled to ESM bundles during the Nix build phase and loaded directly from `/nix/store`.
- In container mode (`--mode rpc`), `little-coder` runs with strict stdout purity, passing raw JSON-RPC messages between Pi and Warren without greeting banners.

### Source layout

```
little-coder/
├── bin/
│   └── little-coder.ts         # launcher source (RPC transparent, no self-updater)
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── _shared/            # shared TypeScript helpers (linehash, toon, display, intervention)
│       ├── basic-tools/        # universal Op[] schema (read, edit, write, grep, find, ls, shell, ast_search)
│       ├── context/            # ephemeral session scratchpads (ctx_record, ctx_packet, ctx_inject)
│       └── project-context/    # workspace AGENTS.md/CLAUDE.md loader + @filepath expansion
├── flake.nix                   # pure Nix flake packaging & dockerTools image
└── package.json                # devDependencies only
```

### Current Extensions Runtime Mechanics & The Single Tool Pattern

1. **The Single Tool Pattern (`sh` as Code-as-Action)**:
   - **Primary Action Primitive**: The agent interacts primarily through a single execution tool: **`sh`** (executing in **Nushell**).
   - **Extensions as Environment Providers**: Rather than registering dozens of bespoke JSON-RPC schemas (which bloat system prompts and trigger context rot on small models), extensions contribute **CLI utilities and Nu modules** directly into the workspace `$PATH`.
   - **Multi-step Pipelining in 1 Turn**: Agents perform filtering, pagination, and multi-step investigation natively inside the pipeline (e.g. `sd ready | from json | get 0.title`), keeping raw intermediate data out of the LLM context.
   - **Precision Mutation via `linehash`**: Precision anchored edits (`read`, `edit`, `write`) remain available through `ops[]` with `xxhash32` 4-character hex line anchors to eliminate hallucinated line-drift.

2. **Container-Aware Sandboxing (`burrow` vs. Container)**:
   - **In Containers (Warren / Podman / Docker / K8s)**: When `/.dockerenv`, `/run/.containerenv`, or container runtime flags are detected, the container/cgroup boundary already provides complete filesystem and network isolation. Nested `burrow` (Bubblewrap) is bypassed entirely to avoid permission/capability failures.
   - **Direct on Host**: When running on a bare-metal developer workstation, `burrow` (`bwrap`) wraps commands to enforce read-only bindings and protect the host filesystem.

3. **`context` & `project-context`**:
   - `context`: Automated compaction bridge and Engram memory integration, preserving active state on `session_before_compact` without leaving `.pi-context/` disk clutter in repositories.
   - `project-context`: Workspace instruction discovery (nearest `AGENTS.md` / `CLAUDE.md`, capped at 4k chars, deduplicated) with baked-in `@filepath` reference prompt expansion (replacing the vendored `pi-file-reference` extension).

### Planned Extensions Roadmap (CLI & Module Architecture)

Instead of bloated JSON tool registries, extensions deliver domain capabilities as executable CLIs and Nu modules:

| Extension / Domain | Tracked Seed | Delivered Capability & CLI/Module |
|---|---|---|
| **`sh` Single Tool** | `little-coder-2315` | Canonical `sh` execution tool + container-aware sandbox detection (bwrap bypass in containers). |
| **`extra-tools`** | `little-coder-cbcc` | Workspace tools: `repo_map`, `scratchpad`, `session` (herdr-backed), `outline` as CLIs/Nu scripts. |
| **`project-context`** | `little-coder-78a9` | Workspace `AGENTS.md`/`CLAUDE.md` injection + baked-in `@filepath` prompt expansion. |
| **`effort`** | `little-coder-dcee` | Dynamic thinking-budget injection per sub-goal. |
| **`web-tools`** | `little-coder-6ebe` | Read-only web utilities: `fetch`, `search`, `control` CLIs (flyscrape / browser-cli). |
| **`docs-tools`** | `little-coder-5030` | Document processing: `doc_read`, `doc_ocr`, `doc_extract` via docling CLI. |
| **`grove`** | `little-coder-bd7f` | Direct environment integration with `sd`, `ml`, `tl`, and `cn` CLIs. |
| **`quality-stack`** | `little-coder-c0da` | Guardrails: output parser, write guard, and quality monitors. |

### Build flow (build-release.ts)

1. Compile `bin/little-coder.ts` → `dist/little-coder-<os>-<cpu>` (launcher binary).
2. Apply `scripts/patch-pi.ts` to `node_modules/@earendil-works/pi-coding-agent/dist/`, then compile pi's entry → `dist/pi-<os>-<cpu>`.
3. Compile each `.pi/extensions/*/index.ts` → `dist/extensions/*/index.js` (all deps bundled inline; no `--external` flags).
4. Pack `dist/data.tar.gz`: compiled `index.js` files, `AGENTS.md`, `skills/`, `.pi/settings.json`, `vendor/` source.

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

## Rules & Behavioral Standards (`rules/`)

`little-coder` integrates the standardized behavioral rules from `~/.llm/rules/`:

| Rule | File | Purpose |
|---|---|---|
| **Caveman** | `rules/caveman.md` | Ultra-concise, low-token prose for conversational responses. |
| **Token Economy** | `rules/token-economy.md` | Aggressive context conservation, targeted reads, minimal tool turns. |
| **Defense in Depth** | `rules/defense-in-depth.md` | Multiple layers of verification before completing tasks. |
| **Direct Execution** | `rules/direct-execution.md` | Proactive terminal execution without unnecessary conversational hand-offs. |
| **Gentle Coding** | `rules/gentle-coding.md` | Surgical, non-destructive edits with zero collateral damage. |
| **Instruction Specificity** | `rules/instruction-specificity.md` | Unambiguous line targets and reproducible assertions. |
| **Positive Phrasing** | `rules/positive-phrasing.md` | Clear directive requirements over negative constraints. |
| **LLM Shorthand** | `rules/llm-shorthand.md` | Compact syntax patterns for agent communication. |

## Skills (`skills/`)

Skills provide high-level workflows and specialized capability guides:

- **Protocols** (`skills/protocols/`): `task_decomposition.md`.
- **Tools Reference** (`skills/tools/`): `nu.md`, `edit.md`, `read.md`, `write.md`, `grep.md`, `glob.md`, `shell_session.md`.
- **Web Skills & CLI Suite** (`skills/web/`):
  - **`web-search` (`ddgr`)**: Fast, low-token search via DuckDuckGo CLI (`ddgr`).
    - *Override*: Set `SEARXNG_URL` (default: `""`, disabled) to query a SearXNG meta-search instance first with `ddgr` fallback.
  - **`web-fetch` (`flyscrape` + `curl`)**: Scrapes and renders HTML to clean Markdown via Defuddle/Readability.
    - *Override*: Set `CRAWL4AI_URL` (default: `""`, disabled) for remote JavaScript-heavy multi-page crawls.
  - **`web-download` (`aria2c` + `yt-dlp`)**: Multi-connection fast asset downloads via `aria2c` and media/stream extraction via `yt-dlp`.
  - **`docling` (`docling.nu`)**: CLI wrapper for converting PDF, DOCX, PPTX, XLSX, and scanned documents to Markdown or JSON.
    - *Endpoint*: `DOCLING_URL` (default: `""`, required). Supports `--vlm` for accelerated inference on a local VLM endpoint.

### Cross-repo dependencies

Three repos must stay in sync for every linehash change. Skipping any step leaves the consumer running stale code while logs look fine.

| Repo | Path | Role |
|---|---|---|
| **linehash** | `/home/rona/Repositories/RogerNavelsaker/linehash` | Rust source. Provides anchored reads, edit, diff, fuzzy matching, patch-apply. |
| **nixpkg-linehash** | `/home/rona/Repositories/RogerNavelsaker/nixpkg-linehash` | Nix package wrapper. Pinned by commit in `devenv.yaml`. |
| **little-coder** | this repo | Consumer. The devenv environment exposes `linehash` on PATH. |

#### Sync chain (run for EVERY linehash change)

```
linehash source  →  push  →  nixpkg-linehash bumps input rev  →  push  →  little-coder updates devenv input pin
```

Concrete steps:

1. **linehash repo** — edit Rust source. Run `cargo build --release` in the project devenv. Run tests. `git commit` + `git push` to GitHub. Note the new commit SHA.
2. **nixpkg-linehash repo** — update the linehash flake input to the new commit: `nix flake lock --update-input linehash` (or `nix flake update` for all inputs). `git commit` + `git push`.
3. **little-coder repo** — bump the `linehash` commit in `devenv.yaml`, then run `devenv update` to refresh `devenv.lock`. Verify with `<new-subcommand> --help` against the `linehash` binary on PATH. **Never reference linehash by absolute path** in extension code — call `linehash` from PATH only.

#### Verification gate (before declaring a cross-repo task done)

- `linehash <new-subcommand> --help` succeeds from a fresh shell in little-coder.
- `which linehash` resolves through the devenv profile, not `~/.local/bin` or `~/.cargo`.
- Extension `LINEHASH_BIN` resolver finds it via `which linehash`, no hardcoded paths.
- Invoke harness (`bun .pi/extensions/basic-tools/src/invoke.ts ...`) produces the expected behavior end-to-end, not just unit tests.

#### Failure mode to watch for

Editor builds locally, tests pass against the local-built binary, but the devenv lock still serves the OLD binary because steps 2 or 3 were skipped. Symptom: invoke smoke fails with "unrecognized subcommand" or silent fallback to the previous implementation. Fix: walk the chain again from step 2.

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

## Agent Execution & Coordination (herdr + burrow + plot + terrarium + worktrunk)

Agent process management, background execution, sandboxing, isolation, and inter-agent communication are handled via **`herdr`**, **`burrow`**, **`plot`**, **`terrarium`**, and **`worktrunk`**:

| Tool | Alias | Role |
|---|---|---|
| **`herdr`** | `hrd` | Daemon harness & process manager for agent processes, background tasks, tabs/panes, and agent-to-agent IPC. |
| **`burrow`** | `bw` | OS-isolated sandbox runtime using `bwrap` (Bubblewrap) for executing untrusted agent code & background tasks. |
| **`plot`** | `pt` | Typed, queryable coordination object layer binding Seeds issues (`sd`), Mulch records (`ml`), agent prompts, runs, and PRs. |
| **`terrarium`** | `tr` | Isolated filesystem and environment runtime wrapper for non-interactive execution sessions. |
| **`worktrunk`** | `wt` | Workspace worktree manager providing isolated branches/workspaces for concurrent agent execution. |

### Sub-Tasks & Sub-Agents Dispatch Patterns

1. **Sub-Tasks (Shell / Background Execution)**
   - Run sub-tasks non-interactively using standard shell or background process execution inside `burrow` (`bw`) or `terrarium` (`tr`).
   - Use `herdr agent start` or `herdr` task management for commands that need background output tracking and logging without opening interactive prompt loops.

2. **Sub-Agents (Non-Interactive Headless Agents)**
   - Dispatch sub-agents in headless / non-interactive mode (`pi -ne -p "..."` or `agy --print "..."` / `agy -p "..."`) to eliminate TUI prompt input overhead.
   - For sub-agents spawned via `herdr`, target specific non-interactive sub-agent commands or use `invoke_subagent` for detached background execution.

### Agent Roles

| Worker | Role & Command |
|---|---|
| `planner` | Lead orchestrator (Claude Code / AGY CLI). Manages plots (`pt`), issues (`sd`), and dispatches worker agents. |
| `editor` | Code modification agent running via `herdr`: `pi -ne -e npm:pi-continue -e npm:pi-schedule-prompt` inside a `burrow` (`bw`) sandbox. |
| `tester` | Verification agent running via `herdr`: `pi` (plain) inside a `burrow` (`bw`) sandbox. |

### Tooling & Management Scripts (relative to repo root)

| Script / Command | Purpose |
|---|---|
| `herdr spawn <role> <cmd>` | Launch a background agent worker or task inside a `burrow` sandbox |
| `herdr send <role> <msg>` | Dispatch prompt or instruction to a running worker agent |
| `herdr dump <role>` | Capture plain text or ANSI output stream from a background worker |
| `herdr log <role>` | Inspect structured session logs |
| `plot create / plot query` | Bind run results, issues, and records into a tracked coordination plot (`pt`) |
| `.pi/extensions/basic-tools/src/invoke.ts` | Drive basic-tools deterministically for ground-truth verification |

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

```sh
# Herdr IPC commands
herdr send editor '<prompt>'
herdr send tester '<prompt>'
herdr restart editor                # reset worker
herdr reload tester                 # reload context after AGENTS.md change

# Herdr output inspection
herdr dump tester                   # full output stream
herdr log tester                    # structured logs

# Report back via Herdr IPC
herdr report "EDITOR REPORT: status=done; files=...; tests=...; result=...; blockers=none"
```

### Report formats

**Editor:** `EDITOR REPORT: status=<done|blocked>; files=<changed>; tests=<cmd and pass/fail>; result=<summary>; blockers=<none|details>`

**Tester:** `TESTER REPORT: status=<done|blocked>; files=<changed or none>; tests=<cmd and pass/fail>; result=<summary>; blockers=<none|details>`

### Planner workflow

Sequential, never parallel: **editor → wait for `EDITOR REPORT` → tester → wait for `TESTER REPORT` → next task**.

1. Pick next ticket: `sd ready --priority=0..3` (Backlog hidden).
2. `sd update <id> --status=in_progress`. Bind to plot: `pt link <plot-id> <id>`.
3. Dispatch to editor via `herdr` with substrate refs (`ml prime --files <paths>`, `sd show <id>`) and explicit acceptance: files to edit, tests to add, `bun run typecheck && bun test <file>` command inside `burrow`.
4. Wait for `EDITOR REPORT` via `herdr`. Do not dispatch tester before it arrives.
5. After editor reports done on extension code, tester must reload artifacts. Rules:
   - Extension `.ts` source edited (schema, handler, display) → `herdr restart tester` (fresh pi process re-imports the module).
   - `AGENTS.md` or `skills/` changed (no code change) → `herdr reload tester`.
   - Both changed → `reload` then `restart`.
   - Pure prompt-only test (no code change) → no reload needed.
6. Dispatch tester via `herdr` with the exact exercise (tool call + inputs + expected shape). Tester runs, then `herdr report "TESTER REPORT: ..."`.
7. Planner inspects (in order of trust):
   - `bun .pi/extensions/basic-tools/src/invoke.ts <tool> '<json>'` → **deterministic ground truth**.
   - `herdr dump tester` → check output stream, rendering, colors, diffs.
   - `herdr log tester` → inspect structured session logs.
8. On pass: `sd close <id>`, record insight (`ml record ...`), sync plot (`pt sync`), `sd sync && ml sync`. On fail: dispatch fix to editor with dump excerpt as evidence.

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
