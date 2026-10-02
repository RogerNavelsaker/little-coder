/**
 * `read-guard` — Large output guardrail & context preservation.
 *
 * Prevents small models from blowing their context window on huge accidental reads
 * (e.g. minified bundles, lockfiles, node_modules, build artifacts).
 * Truncates massive tool results with clear tombstones directing surgical reads.
 */

export interface ReadGuardOptions {
  maxLines: number;
  maxChars: number;
}

export const DEFAULT_READ_GUARD_OPTIONS: ReadGuardOptions = {
  maxLines: 800,
  maxChars: 40_000,
};

export interface ReadGuardResult {
  truncated: boolean;
  text: string;
  originalLines: number;
  originalChars: number;
}

/**
 * Enforces reading bounds on tool outputs.
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

  // Truncate to first 30 lines + tombstone
  const headLines = lines.slice(0, 30);
  const tombstone = `\n... [Read Guard: Truncated ${totalLines - 30} lines / ${totalChars} chars. File is too large for single read. Use 'outline' or read specific line slices: lines:N-M]`;

  return {
    truncated: true,
    text: headLines.join("\n") + tombstone,
    originalLines: totalLines,
    originalChars: totalChars,
  };
}
