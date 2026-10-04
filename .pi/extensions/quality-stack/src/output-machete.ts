/**
 * `output-machete` — Shell & command output truncation and overflow spillover (Volition-inspired).
 *
 * Prevents explosive command executions (e.g. npm test, cargo build, find, git log)
 * from overwhelming small model context windows.
 *
 * Rules:
 * - If command output <= maxChars (default: 20KB) and <= maxLines (default: 500), keep untouched.
 * - If output exceeds limits:
 *   1. Full verbatim output is spooled to `/tmp/little-coder/overflow/stdout-<timestamp>-<hash>.txt`.
 *   2. Content is sliced keeping the first headLines (default: 30) and tailLines (default: 30)
 *      with a clear tombstone pointing to the spilled file, ripgrep search, and sub-agent summarization.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export interface OutputMacheteOptions {
  maxLines: number;
  maxChars: number;
  headLines: number;
  tailLines: number;
  overflowDir?: string;
}

export const DEFAULT_MACHETE_OPTIONS: OutputMacheteOptions = {
  maxLines: 500,
  maxChars: 20_000,
  headLines: 30,
  tailLines: 30,
  overflowDir: "/tmp/little-coder/overflow",
};

export interface MacheteResult {
  truncated: boolean;
  text: string;
  originalLines: number;
  originalChars: number;
  spillPath?: string;
}

/**
 * Bounds shell and command text outputs.
 */
export function applyOutputMachete(
  content: string,
  options: OutputMacheteOptions = DEFAULT_MACHETE_OPTIONS,
): MacheteResult {
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
    spillPath = join(overflowDir, `stdout-${Date.now()}-${hash}.txt`);
    writeFileSync(spillPath, content, "utf-8");
  } catch {
    // Non-blocking fallback if disk write fails
  }

  const head = lines.slice(0, options.headLines);
  const tail = lines.slice(-options.tailLines);
  const truncatedCount = totalLines - (options.headLines + options.tailLines);

  const tombstone = spillPath
    ? `\n\n... [Output Machete: Truncated ${truncatedCount > 0 ? truncatedCount : 0} intermediate lines (${Math.round(totalChars / 1024)}KB total). Full output spooled to: ${spillPath}]\n` +
      `Recovery options:\n` +
      `• Search: \`rg '<pattern>' ${spillPath}\` via \`sh\`\n` +
      `• Tail / Head: \`tail -n 50 ${spillPath}\` or \`head -n 50 ${spillPath}\`\n` +
      `• Summarize: delegate analysis to a sub-agent or targeted pipeline ...\n\n`
    : `\n\n... [Output Machete: Truncated ${truncatedCount} lines / ${totalChars} chars] ...\n\n`;

  const boundedText = head.join("\n") + tombstone + tail.join("\n");

  return {
    truncated: true,
    text: boundedText,
    originalLines: totalLines,
    originalChars: totalChars,
    spillPath,
  };
}
