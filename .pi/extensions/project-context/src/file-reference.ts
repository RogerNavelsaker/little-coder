/**
 * File reference parsing and resolution for project context and prompt inputs.
 *
 * Capabilities:
 * - Parses `@filepath` and `@"path with spaces"` references
 * - Resolves relative paths against baseDir, absolute paths, and `~/` home directory
 * - Filters to `.md` and `.mdc` documentation formats
 * - Expands directory references at depth 1 (non-dotfiles, sorted)
 * - Enforces 100KB per-file size guard
 * - Formats `<project_references>` blocks for injection
 * - Expands user prompt `@refs` for input hooks
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const MAX_FILE_SIZE = 100 * 1024; // 100KB per file

export interface RefContent {
  path: string;
  content: string;
}

/**
 * Parse @filepath references from a line of text.
 *
 * Rules:
 * - @ must be preceded by whitespace or start-of-line
 * - @ followed by a double-quoted string: extract inside quotes
 * - @ followed by unquoted text: extract until whitespace
 * - Only .md and .mdc file extensions are accepted (directories with no dot in last segment allowed)
 */
export function parseRefs(line: string): string[] {
  const refs: string[] = [];
  let i = 0;

  while (i < line.length) {
    const atIdx = line.indexOf("@", i);
    if (atIdx === -1) break;

    // @ must be preceded by start-of-line or whitespace
    if (atIdx > 0 && line[atIdx - 1] !== " " && line[atIdx - 1] !== "\t") {
      i = atIdx + 1;
      continue;
    }

    i = atIdx + 1;
    let ref: string;

    if (line[i] === '"') {
      // Quoted reference: @"path/to/file"
      const close = line.indexOf('"', i + 1);
      ref = close === -1 ? line.slice(i + 1) : line.slice(i + 1, close);
      i = close === -1 ? line.length : close + 1;
    } else {
      // Unquoted reference: @path/to/file (until whitespace)
      const start = i;
      while (i < line.length && !/\s/.test(line[i])) i++;
      ref = line.slice(start, i);
    }

    if (ref && (ref.includes("/") || ref.includes("."))) {
      const lastSeg = ref.split("/").pop()!;
      const dotIdx = lastSeg.lastIndexOf(".");
      if (dotIdx !== -1) {
        const ext = lastSeg.slice(dotIdx);
        if (ext !== ".md" && ext !== ".mdc") continue;
      }
      refs.push(ref);
    }
  }

  return refs;
}

/**
 * Resolve a reference path against baseDir.
 *
 * Handles:
 * - Absolute paths (/foo/bar) — used as-is
 * - Tilde paths (~/foo or ~user/foo) — expanded via os.homedir()
 * - Relative paths — resolved against baseDir
 */
export function resolveRef(ref: string, baseDir: string): string {
  if (ref.startsWith("/")) return ref;
  if (ref.startsWith("~")) {
    const slashIdx = ref.indexOf("/");
    if (slashIdx === -1) {
      return path.join(os.homedir(), ref.slice(1));
    }
    const userPart = ref.slice(1, slashIdx);
    if (!userPart) {
      return path.join(os.homedir(), ref.slice(slashIdx + 1));
    }
    return path.join(os.homedir(), userPart, ref.slice(slashIdx + 1));
  }
  return path.resolve(baseDir, ref);
}

/**
 * Collect all resolved file paths from context file contents.
 *
 * Parses refs, deduplicates, resolves paths, expands directories,
 * and filters by extension (.md/.mdc), dot-files, and size limit (100KB).
 */
export function getAllFilePathFromContextFiles(
  contextFiles: Array<{ path: string; content: string }>,
): string[] {
  const seen = new Set<string>();
  const resolvedPaths: string[] = [];

  for (const { path: filePath, content } of contextFiles) {
    const baseDir = path.dirname(filePath);

    const allRefs: string[] = [];
    for (const line of content.split("\n")) {
      allRefs.push(...parseRefs(line));
    }

    const uniqueRefs = allRefs.filter((ref) => {
      if (seen.has(ref)) return false;
      seen.add(ref);
      return true;
    });

    for (const ref of uniqueRefs) {
      const cleanRef = ref.endsWith("/") ? ref.slice(0, -1) : ref;
      const resolvedPath = resolveRef(cleanRef, baseDir);

      if (!fs.existsSync(resolvedPath)) {
        continue;
      }

      try {
        const stat = fs.statSync(resolvedPath);

        if (stat.isDirectory()) {
          const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
          const files = entries
            .filter((e) => {
              if (!e.isFile()) return false;
              if (e.name.startsWith(".")) return false;
              const ext = path.extname(e.name);
              return ext === ".md" || ext === ".mdc";
            })
            .map((e) => e.name)
            .sort();

          for (const fileName of files) {
            const childPath = path.join(resolvedPath, fileName);
            const fileStat = fs.statSync(childPath);
            if (fileStat.size > MAX_FILE_SIZE) {
              continue;
            }
            resolvedPaths.push(childPath);
          }
        } else {
          if (stat.size > MAX_FILE_SIZE) {
            continue;
          }
          resolvedPaths.push(resolvedPath);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return resolvedPaths;
}

/**
 * Read file contents for a list of resolved paths.
 */
export function parseFileAndContent(paths: string[]): RefContent[] {
  const results: RefContent[] = [];
  for (const resolvedPath of paths) {
    try {
      const content = fs.readFileSync(resolvedPath, "utf-8");
      results.push({ path: resolvedPath, content });
    } catch {
      // Ignore unreadable
    }
  }
  return results;
}

/**
 * Format loaded file contents into <project_references> blocks.
 */
export function formatProjectReferences(contents: RefContent[]): string {
  if (!contents.length) return "";
  return contents
    .map(
      (r) => `<project_references path="${r.path}">\n${r.content}\n</project_references>`,
    )
    .join("\n\n");
}

/**
 * Expand @filepath references found inside user input prompt text.
 * Returns transformed text with referenced file content blocks appended,
 * or original text if no valid references were found.
 */
export function expandPromptRefs(
  text: string,
  baseDir: string = process.cwd(),
): { expandedText: string; expandedCount: number; refs: string[] } {
  if (!text.includes("@")) {
    return { expandedText: text, expandedCount: 0, refs: [] };
  }

  const rawRefs: string[] = [];
  for (const line of text.split("\n")) {
    rawRefs.push(...parseRefs(line));
  }

  if (rawRefs.length === 0) {
    return { expandedText: text, expandedCount: 0, refs: [] };
  }

  const paths = getAllFilePathFromContextFiles([{ path: path.join(baseDir, "prompt.md"), content: text }]);
  if (paths.length === 0) {
    return { expandedText: text, expandedCount: 0, refs: rawRefs };
  }

  const contents = parseFileAndContent(paths);
  if (contents.length === 0) {
    return { expandedText: text, expandedCount: 0, refs: rawRefs };
  }

  const refBlocks = contents
    .map(c => `\n\n<referenced_file path="${c.path}">\n${c.content}\n</referenced_file>`)
    .join("");

  return {
    expandedText: text + refBlocks,
    expandedCount: contents.length,
    refs: paths,
  };
}
