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
little-coder --model llamacpp/qwen3.6-35b-a3b
little-coder --model anthropic/claude-haiku-4-5
little-coder --model ollama/qwen3.5

export LLAMACPP_API_KEY=noop
export LLAMACPP_BASE_URL=http://127.0.0.1:8888/v1
```

## Architecture

little-coder packages the tailored Pi scaffold into a deterministic Nix derivation:

| Component | Packaging |
|---|---|
| `little-coder` | Compiled Bun launcher wrapped with Nix runtime dependencies (`pi`, `ripgrep`, `git`). |
| `extensions` | Pre-compiled ESM bundles loaded directly from `/nix/store`. |
| `warren-agent` | Minimal distroless container image built via `dockerTools.buildLayeredImage`. |
| `data.tar.gz` | Cross-platform: compiled extensions, AGENTS.md, skills, config. |

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
- **`extra-tools`** (`little-coder-cbcc`): `repo_map`, `scratchpad`, `session`, `outline` as workspace CLIs.
- **`effort`** (`little-coder-dcee`): Dynamic thinking-budget injection per sub-goal.
- **`model-router`** (`little-coder-5767`): Model routing and `model_switch` CLI.
- **`web-tools`** (`little-coder-6ebe`): Web research CLIs (`fetch`, `search`, `control` via flyscrape).
- **`docs-tools`** (`little-coder-5030`): Document processing CLI (`doc_read`, `doc_ocr`, `doc_extract` via docling).
- **`grove`** (`little-coder-bd7f`): Direct environment integration with `sd`, `ml`, `tl`, and `cn` CLIs.
- **`quality-stack`** (`little-coder-c0da`): Output parsing, write guards, and quality monitoring.
- **`security`** (`little-coder-5e37`): Permission gate and sandbox isolation.

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
│       └── pi-file-reference # @filepath reference injection
├── rules/                    # behavioral standards (caveman, token-economy, defense-in-depth, etc.)
├── skills/                   # skills suite (protocols, tools, web-fetch, web-search, web-download)
├── flake.nix                 # Nix package and distroless container image
└── package.json              # devDependencies only
```

### Build

```bash
bun install                  # devDependencies (pi-coding-agent, typebox, toon, diff, typescript)
bun run build:release        # → dist/little-coder-<os>-<cpu>, dist/pi-<os>-<cpu>, dist/data.tar.gz
```

`build-release.ts` steps:
1. Compile launcher → `dist/little-coder-<os>-<cpu>`.
2. Apply `patch-pi.ts` to `node_modules/@earendil-works/pi-coding-agent/dist/`, compile pi → `dist/pi-<os>-<cpu>`.
3. Compile each extension: `bun build index.ts --outfile dist/extensions/*/index.js` (no `--external`; all deps bundled).
4. Pack `dist/data.tar.gz`: compiled `.js` files, AGENTS.md, skills/, models.json, settings.json.

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

## Attribution

little-coder v0.0.x — derived from [CheetahClaws / ClawSpring](https://github.com/SafeRL-Lab/clawspring) (Apache 2.0).

little-coder v0.1.0+ — rebuilt on **[pi](https://github.com/mariozechner/pi)** by Mario Zechner (Apache 2.0 / MIT).

RogerNavelsaker/little-coder — hard fork; replaces npm/Node distribution with a self-contained bun binary distribution.

## License

Apache 2.0 — see [LICENSE](LICENSE). [NOTICE](NOTICE) tracks upstream attribution.
