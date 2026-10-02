# little-coder

**A coding agent tuned for small local models, built on [pi](https://github.com/mariozechner/pi).**

Hard fork of [itayinbarr/little-coder](https://github.com/itayinbarr/little-coder). This fork replaces the upstream npm and binary-blob distribution with a **pure Nix Flake & container agent runtime** — no npm, no self-updaters, no vendored libc blobs, and fully compatible with Warren autonomous sandboxes.

The research story — why scaffold–model fit matters, how a 9.7 B Qwen beat frontier entries on Aider Polyglot — is in the upstream Substack post: [*Honey, I Shrunk the Coding Agent*](https://open.substack.com/pub/itayinbarr/p/honey-i-shrunk-the-coding-agent).

## Install (Nix)

```bash
nix profile install github:RogerNavelsaker/little-coder
```

Or run directly without installation:

```bash
nix run github:RogerNavelsaker/little-coder -- --model llamacpp/qwen3.6-35b-a3b
```

## Warren Agent Runtime

`little-coder` can run directly as an autonomous agent runtime in Warren:

```yaml
# .warren/config.yaml
agentImage: ghcr.io/rogernavelsaker/warren-agent:latest
```

When invoked by Warren with `--mode rpc`, `little-coder` operates transparently with zero startup noise, passing through all JSON-RPC events directly to the supervisor.

## Run

```bash
cd ~/your-project
little-coder
```

Pi's standard `--model` flag and all provider env vars apply:

```bash
little-coder --model anthropic/claude-haiku-4-5
little-coder --model openrouter/anthropic/claude-3.7-sonnet
```

## Architecture

little-coder packages the tailored Pi scaffold into a deterministic Nix derivation:

| Component | Packaging |
|---|---|
| `packages.default` | Compiled Bun launcher wrapped with Nix runtime dependencies (`pi`, `ripgrep`, `git`, `nushell`, `linehash`, `fd`, `eza`, `bat`, `delta`, `ast-grep`). Consumed by developers and Warren agent containers. |
| `extensions` | Pre-compiled ESM bundles loaded directly from `/nix/store`. |

### The Single Tool Pattern (`sh` as Code-as-Action)

Rather than registering a bloated registry of bespoke JSON-RPC tools that exhaust context and cause round-trip latency, `little-coder` embraces **Code-as-Action**:

1. **`sh` as the Universal Execution Tool**:
   - The agent writes **Nushell (`nu`)** code directly into the workspace.
   - Pipelining, filtering, loops, and pagination happen natively inside the sandbox (e.g. `sd ready | from json | get 0.title`). Intermediate data never bloats the LLM context.
   - **Precision Mutation via `linehash`**: Precision anchored edits (`read`, `edit`, `write`) remain available through `ops[]` with `xxhash32` 4-character hex line anchors to eliminate hallucinated line-drift.
   - Built-in POSIX `bash` tool is suppressed in favor of structured Nushell execution.

2. **Extensions as Environment Providers**:
   - Extensions contribute **CLI binaries and Nu script libraries** to the workspace `$PATH` rather than injecting separate JSON schemas into the prompt.
   - Any new tool or domain (web, docling, seeds, git) is immediately callable via `sh` pipelines without increasing system prompt token overhead.

3. **Container-Aware Sandboxing**:
   - **Containers (Warren / Podman / K8s)**: When running in container sandboxes, `burrow` (nested Bubblewrap) is automatically bypassed; the container/cgroup boundary provides complete isolation.
   - **Host Execution**: When running directly on bare-metal workstations, `burrow` enforces read-only mounts and host safety.

### Extensions Roadmap (CLI & Module Architecture)

- **`sh` Tool & Runtime** (`little-coder-2315`): Canonical `sh` tool + container detection.
- **`extra-tools`** (`little-coder-cbcc`): `repo_map`, `scratchpad`, `session` (herdr-backed), `outline` as workspace CLIs.
- **`project-context`** (`little-coder-78a9`): **Completed**: Workspace `AGENTS.md`/`CLAUDE.md` loader + baked-in `@filepath` reference expansion.
- **`context-watchdog`** (`little-coder-b2be`): Mid-run token compaction watchdog for autonomous Warren container runs (#59, #68, #128).
- **`quality-stack`** (`little-coder-c0da`): `read-guard` (50% window cap), `read-guard-edit`, `write-guard` (Windows reserved names, root path rewrites), `output-parser` (fenced tool recovery).
- **`turn-cap`** (`little-coder-071c`): Safety turn limits + 5-turn finalize warning before budget exhaustion.
- **`effort`** (`little-coder-dcee`): Dynamic thinking-budget injection per sub-goal.
- **`web-tools`** (`little-coder-6ebe`): Web research CLIs:
  - `ddgr`: Low-token search API querying (optional override: `SEARXNG_URL`, default: `""`).
  - `flyscrape` + `curl`: High-speed article extraction (Defuddle/Readability) to Markdown/TOON (optional override: `CRAWL4AI_URL`, default: `""`).
  - `aria2c` + `yt-dlp`: Fast multi-connection download and media/stream extraction.
- **`docs-tools`** (`little-coder-5030`): Document processing CLI (`docling.nu`):
  - Converts PDF, DOCX, PPTX, XLSX, scanned documents to Markdown/JSON via `DOCLING_URL` (default: `""`, set to your Docling Serve instance). Supports `--vlm` for local VLM acceleration.
- **`grove`** (`little-coder-bd7f`): Direct environment integration with `sd`, `ml`, `tl`, and `cn` CLIs.

### Source layout

```
little-coder/
├── bin/
│   └── little-coder.ts       # launcher (Nix-wrapped; RPC transparent, no self-updater)
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── _shared/          # shared TypeScript helpers across extensions
│       ├── basic-tools/      # universal Op[] schema (sh, read, edit, write, grep, find, ls)
│       ├── context/          # context scratchpad tools
│       └── project-context/  # workspace AGENTS.md/CLAUDE.md loader + @filepath expansion
├── rules/                    # behavioral standards (caveman, token-economy, defense-in-depth, etc.)
├── skills/                   # skills suite (protocols, tools, web-fetch, web-search, web-download)
├── flake.nix                 # Nix package and distroless container image
└── package.json              # devDependencies only
```

### Build

```bash
bun install                  # devDependencies (pi-coding-agent, typebox, toon, diff, typescript)
bun run build                # compile launcher binary → dist/little-coder
nix build .#default          # full Nix package wrapped with dependencies
```

`build-release.ts` steps:
1. Compile launcher → `dist/little-coder-<os>-<cpu>`.
2. Apply `patch-pi.ts` to `node_modules/@earendil-works/pi-coding-agent/dist/`, compile pi → `dist/pi-<os>-<cpu>`.
3. Compile each extension: `bun build index.ts --outfile dist/extensions/*/index.js` (no `--external`; all deps bundled).

### Patching pi

`scripts/patch-pi.ts` applies small edits to pi's installed dist:

- **Suppress "Operation aborted" marker**: harness interventions surface their own `harness intervention: …` line; the bare red marker was noise. A genuine custom error message is still shown.

Patches are idempotent. In dev mode (`bun run dev`) they are applied on every launch so pi self-heals after reinstall. In release mode `build-release.ts` bakes them into the pi binary — no runtime patching in installed mode.

### Extensions

Extensions are standard pi extensions: a TypeScript file with `export default function(pi: ExtensionAPI): void { ... }`. The launcher auto-discovers `~/.little-coder/.pi/extensions/*/index.js` and passes each as `--extension`.

Adding an extension:
- **Source build**: drop a directory into `.pi/extensions/` with an `index.ts`.
- **Installed**: compile your extension to a self-contained `index.js` and place it under `~/.little-coder/.pi/extensions/<name>/index.js`.

Removing: delete the directory (or `index.js`).

## Dev setup

```bash
git clone https://github.com/RogerNavelsaker/little-coder.git
cd little-coder
bun install
bun run dev             # runs launcher from source against node_modules pi
bun run typecheck       # tsc --noEmit
bun run test            # find .pi -name '*.test.ts' | xargs bun test
```

Dev mode uses `node_modules/@earendil-works/pi-coding-agent` directly and applies `patch-pi.ts` on every launch. Extensions are loaded as `.ts` source (bun imports them directly).

## Attribution & Upstream Heritage

- **[itayinbarr/little-coder](https://github.com/itayinbarr/little-coder)**: Upstream research and architecture for tuning coding agent scaffolding for small models.
- **[pi](https://github.com/mariozechner/pi)**: Foundational minimal agent core by Mario Zechner (Apache 2.0 / MIT).
- **[CheetahClaws / ClawSpring](https://github.com/SafeRL-Lab/clawspring)**: Early architecture antecedent (Apache 2.0).
- **[linehash](https://github.com/RogerNavelsaker/linehash)**: Deterministic hash-anchored precision file manipulation and edits.
- **[officeparser](https://github.com/nopers/officeparser)**: Fast document text and metadata parser across office file formats.

RogerNavelsaker/little-coder is a hard fork packaged natively for Nix and Warren autonomous environments.

## License

Apache 2.0 — see [LICENSE](LICENSE). [NOTICE](NOTICE) tracks upstream attribution.
