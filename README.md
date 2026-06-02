# little-coder

**A coding agent tuned for small local models, built on [pi](https://github.com/mariozechner/pi).**

Hard fork of [itayinbarr/little-coder](https://github.com/itayinbarr/little-coder). This repo replaces the upstream npm/Node distribution with a self-contained bun binary distribution — no Node.js, no npm, no global pi install required.

The research story — why scaffold–model fit matters, how a 9.7 B Qwen beat frontier entries on Aider Polyglot — is in the upstream Substack post: [*Honey, I Shrunk the Coding Agent*](https://open.substack.com/pub/itayinbarr/p/honey-i-shrunk-the-coding-agent).

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/RogerNavelsaker/little-coder/main/install.sh | sh
```

This downloads the `little-coder` launcher binary to `~/.local/bin/` and runs `little-coder install` to set up `~/.little-coder/` (extensions, vendored pi runtime, AGENTS.md, skills).

**Nix:**

```bash
nix profile install github:RogerNavelsaker/little-coder
little-coder install    # set up ~/.little-coder/
```

**Requirements:** bun is required for dev/source builds. The installed binary distribution needs no runtime — not Node, not bun, not a global pi install.

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

## Update / uninstall

```bash
little-coder update      # fetch latest release; update data dir + binaries in-place
little-coder uninstall   # remove ~/.little-coder/
```

The launcher binary itself is updated in-place by `update`. To remove it: `rm $(which little-coder)`.

## Architecture

little-coder ships as two compiled binaries per platform plus one cross-platform data archive:

| Release asset | Description |
|---|---|
| `little-coder-<os>-<cpu>` | Launcher. Manages install/update/uninstall and spawns pi. |
| `pi-<os>-<cpu>` | Compiled pi runtime with patches baked in. Self-contained. |
| `data.tar.gz` | Cross-platform: compiled extensions, AGENTS.md, skills, config. |

### How it works

`little-coder install` downloads `data.tar.gz` + the platform pi binary into `~/.little-coder/`. At launch the launcher:

1. Finds extensions under `~/.little-coder/.pi/extensions/*/index.js`.
2. Spawns `~/.little-coder/vendor/pi/pi-<os>-<cpu>` with `--no-extensions --no-context-files --system-prompt AGENTS.md --extension <each index.js>`.

No bun, no node_modules, no global pi. Extensions are self-contained ESM bundles (all deps — typebox, toon, diff, pi-tui — inlined at build time).

### Installed data dir

```
~/.little-coder/
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── basic-tools/
│       │   └── index.js      # read, edit, write, grep, find, ls, shell, ast_search, revert_file
│       ├── context/
│       │   └── index.js      # ctx_record, ctx_packet, ctx_inject
│       └── pi-file-reference/
│           └── index.js      # @filepath reference injection in AGENTS.md
├── vendor/
│   └── pi/
│       └── pi-<os>-<cpu>    # compiled pi runtime (patches baked in)
├── AGENTS.md                 # system prompt
├── models.json               # model compatibility table
└── skills/                   # skill-inject knowledge base
```

### Source layout

```
little-coder/
├── bin/
│   └── little-coder.ts       # launcher (bun source; compiled for releases)
├── .pi/
│   ├── settings.json
│   └── extensions/
│       ├── _shared/          # shared TypeScript helpers across extensions
│       ├── basic-tools/      # index.ts + src/ (structural tools)
│       ├── context/          # index.ts + src/ (context tools)
│       └── pi-file-reference -> ../../vendor/pi-file-reference/extensions
├── vendor/
│   └── pi-file-reference/    # vendored @josephyoung/pi-file-reference v0.1.7
├── scripts/
│   ├── build-release.ts      # builds all release artifacts
│   └── patch-pi.ts           # idempotent pi dist patches (baked into pi binary at release)
├── skills/                   # bundled skill and knowledge markdown files
├── models.json
├── install.sh                # bootstrap installer (curl | sh)
├── flake.nix                 # Nix package (build from source or fetchurl)
└── package.json              # devDependencies only; no runtime npm deps
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
