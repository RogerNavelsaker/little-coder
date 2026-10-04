/**
 * `read-guard` — Large output guardrail & context preservation.
 *
 * Prevents small models from blowing their context window on huge accidental reads
 * (e.g. minified bundles, lockfiles, node_modules, build artifacts).
 * Truncates massive tool results with clear tombstones directing surgical reads.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export interface ReadGuardOptions {
  maxLines: number;
  maxChars: number;
  overflowDir?: string;
}

export const DEFAULT_READ_GUARD_OPTIONS: ReadGuardOptions = {
  maxLines: 800,
  maxChars: 40_000,
  overflowDir: "/tmp/little-coder/overflow",
};

export interface ReadGuardResult {
  truncated: boolean;
  text: string;
  originalLines: number;
  originalChars: number;
  spillPath?: string;
}

/**
 * Enforces reading bounds on tool outputs.
 * When output exceeds bounds, writes complete payload to a disk overflow artifact
 * and provides clear instructions for targeted reading, ripgrep search, or sub-agent summarization.
 */
export function guardReadOutput(
  content: string,
  options: ReadGuardOptions = DEFAULT_READ_GUARD_OPTIONS,
): ReadGuardResult {
  if (!content || typeof content !== "string") {
    return { truncated: false, text: content, originalLines: 0, originalChars: 0 };
  }

  const lines = content.split("\n");
  const totalLines = lines.length;
  const totalChars = content.length;

  if (totalLines <= options.maxLines && totalChars <= options.maxChars) {
    return { truncated: false, text: content, originalLines: totalLines, originalChars: totalChars };
  }

  // Spool full output to disk artifact
  let spillPath: string | undefined;
  const overflowDir = options.overflowDir || "/tmp/little-coder/overflow";
  try {
    mkdirSync(overflowDir, { recursive: true });
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
    spillPath = join(overflowDir, `overflow-${Date.now()}-${hash}.txt`);
    writeFileSync(spillPath, content, "utf-8");
  } catch {
    // Non-blocking fallback if disk write fails
  }

  // Truncate to first 30 lines + actionable cutoff notice
  const headLines = lines.slice(0, 30);
  const spillNotice = spillPath
    ? `\n\n[Context Cutoff Notice: Output exceeded inline budget (${totalLines} lines / ${Math.round(totalChars / 1024)}KB). Full payload spooled to disk at: ${spillPath}]\n` +
      `Options:\n` +
      `1. Search: run \`rg '<pattern>' ${spillPath}\` via \`sh\`\n` +
      `2. Slice: read targeted lines via \`read\` with offset/limit\n` +
      `3. Sub-Agent: delegate summarization using an isolated sub-agent or \`sh\` pipeline`
    : `\n\n... [Read Guard: Truncated ${totalLines - 30} lines / ${totalChars} chars. Use 'outline' or read specific line slices: lines:N-M]`;

  return {
    truncated: true,
    text: headLines.join("\n") + spillNotice,
    originalLines: totalLines,
    originalChars: totalChars,
    spillPath,
  };
}
