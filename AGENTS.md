# little-coder

Hard fork of itayinbarr/little-coder. This repo is our own distribution — we do not merge back upstream.

Upstream (itayinbarr/little-coder) is registered as the `upstream` git remote for inspection only:
- `git fetch upstream` to inspect upstream changes
- Never `git merge upstream/main` — cherry-pick selectively if needed

## Project planning

Architecture decisions, extension design, and work items live in the planning project:

    /home/rona/projects/little-coder/

Start there (read `AGENTS.md` and `memory-bank/`) before making structural changes.

## This repo

Source for the little-coder Pi distribution. Current layout mirrors the upstream fork; migration to the new extension architecture is underway (see `memory-bank/littleCoderMigration.md` in the planning project).

### Key paths

- `.pi/extensions/` — Pi extensions (upstream set; new extensions added here during migration)
- `bin/little-coder.mjs` — launcher
- `skills/` — bundled skills and knowledge files
- `models.json` — model compatibility table

### Dev commands

```sh
bun test           # run tests
bun run typecheck  # tsc --noEmit
```
