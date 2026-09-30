// Pure discovery + shaping for the project-context extension, kept separate
// from the pi wiring in index.ts so it can be unit-tested without a runtime.
//
// Issue #104: little-coder launches pi with `--no-context-files` so that ITS
// AGENTS.md is the system prompt rather than whatever the cwd happens to hold.
// That default preserves the harness's prompt adaptations, but ignored a
// project's own AGENTS.md.
//
// The project file is loaded as an ADDITION rather than a replacement:
// little-coder's own system prompt still governs how the model behaves, and the
// project file tells it about this repository.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Filenames searched, in order, at each directory level. AGENTS.md is the
 *  agreed cross-agent convention; CLAUDE.md is accepted as a fallback.
 *  The FIRST hit at a level wins. */
export const CONTEXT_FILENAMES = ["AGENTS.md", "CLAUDE.md"] as const;

/** Default cap on injected characters (~1k tokens). */
export const DEFAULT_MAX_CHARS = 4000;

export interface FoundContext {
  path: string;
  content: string;
  /** Characters dropped by the cap, 0 when the file fit. */
  truncatedChars: number;
}

/**
 * Walk up from `startDir` looking for the nearest context file.
 * `skipPaths` holds files that must never be loaded (e.g. little-coder's own AGENTS.md).
 */
export function findContextFile(
  startDir: string,
  skipPaths: readonly string[] = [],
  exists: (p: string) => boolean = existsSync,
): string | undefined {
  const skip = new Set(skipPaths.map((p) => resolve(p)));
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONTEXT_FILENAMES) {
      const candidate = join(dir, name);
      if (exists(candidate) && !skip.has(resolve(candidate))) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Apply the character cap, reporting how much was dropped. Cuts at the last
 *  newline inside the budget when there is one. */
export function capContent(content: string, maxChars: number): { content: string; truncatedChars: number } {
  if (maxChars <= 0 || content.length <= maxChars) return { content, truncatedChars: 0 };
  const head = content.slice(0, maxChars);
  const lastBreak = head.lastIndexOf("\n");
  const kept = lastBreak > maxChars / 2 ? head.slice(0, lastBreak) : head;
  return { content: kept, truncatedChars: content.length - kept.length };
}

/** Read and shape the nearest context file. Returns undefined when there is
 *  none, when it is empty, or when read fails. */
export function loadProjectContext(
  startDir: string,
  opts: { skipPaths?: readonly string[]; maxChars?: number } = {},
): FoundContext | undefined {
  const path = findContextFile(startDir, opts.skipPaths ?? []);
  if (!path) return undefined;
  try {
    if (!statSync(path).isFile()) return undefined;
    const raw = readFileSync(path, "utf-8").trim();
    if (!raw) return undefined;
    const { content, truncatedChars } = capContent(raw, opts.maxChars ?? DEFAULT_MAX_CHARS);
    return { path, content, truncatedChars };
  } catch {
    return undefined;
  }
}

/**
 * The block appended to the tail context.
 */
export function formatProjectContext(found: FoundContext): string {
  const note =
    found.truncatedChars > 0
      ? `\n\n[truncated: ${found.truncatedChars} more characters in this file were not included. ` +
        `Read ${found.path} directly if you need the rest.]`
      : "";
  return (
    `\n\n<project_instructions source="${found.path}">\n` +
    `These are the instructions for THIS project, read from the file above. ` +
    `They describe the repository you are working in: its conventions, its layout, and where its rules live. ` +
    `Follow them. Where they conflict with your operating instructions above, your operating instructions win.\n\n` +
    found.content +
    note +
    `\n</project_instructions>\n`
  );
}

/** `LITTLE_CODER_PROJECT_CONTEXT=0` (or `off`/`false`) turns the whole thing off. */
export function isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.LITTLE_CODER_PROJECT_CONTEXT;
  return !(v === "0" || v === "off" || v === "false");
}

/** `LITTLE_CODER_PROJECT_CONTEXT_MAX_CHARS` overrides the cap; 0 means "no cap". */
export function maxChars(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.LITTLE_CODER_PROJECT_CONTEXT_MAX_CHARS);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_MAX_CHARS;
  return raw === 0 ? Number.MAX_SAFE_INTEGER : raw;
}
