/**
 * Display formatting module — Phase 21: TUI Render Output Contract.
 *
 * Provides display-mode-aware formatting for all structural tools:
 *   - "compact": 1-5 short visible lines (default)
 *   - "table": Markdown table via renderResult
 *   - "full": compact summary + table/diff sections
 *
 * content.text remains the plain text fallback (aligned tables, not Markdown).
 * renderResult produces Markdown for the TUI.
 */

import { Markdown, type MarkdownTheme } from '@earendil-works/pi-tui';

export type DisplayMode = 'auto' | 'compact' | 'table' | 'full';

// ---- MarkdownTheme builder ----

/**
 * Build a MarkdownTheme from a Pi theme object.
 * Maps Markdown rendering to Pi theme colors.
 */
export function buildMarkdownTheme(theme: {
  fg: (color: unknown, text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
}): MarkdownTheme {
  return {
    heading: (t) => theme.fg('mdHeading', t),
    link: (t) => theme.fg('mdLink', t),
    linkUrl: (t) => theme.fg('mdLinkUrl', t),
    code: (t) => theme.fg('mdCode', t),
    codeBlock: (t) => theme.fg('mdCodeBlock', t),
    codeBlockBorder: (t) => theme.fg('mdCodeBlockBorder', t),
    quote: (t) => theme.fg('mdQuote', t),
    quoteBorder: (t) => theme.fg('mdQuoteBorder', t),
    hr: (t) => theme.fg('mdHr', t),
    listBullet: (t) => theme.fg('mdListBullet', t),
    bold: (t) => theme.bold(t),
    italic: (t) => theme.italic(t),
    strikethrough: (t) => theme.strikethrough(t),
    underline: (t) => theme.underline(t),
  };
}

/**
 * Render Markdown text using the Markdown component.
 * @param text - Markdown-formatted text
 * @param theme - Pi theme object (from renderResult context)
 * @param paddingX - Horizontal padding (default 1)
 * @param paddingY - Vertical padding (default 0)
 */
export function renderMarkdown(
  text: string,
  theme: {
    fg: (color: unknown, text: string) => string;
    bold: (text: string) => string;
    italic: (text: string) => string;
    strikethrough: (text: string) => string;
    underline: (text: string) => string;
  },
  paddingX = 1,
  paddingY = 0,
): Markdown {
  return new Markdown(text, paddingX, paddingY, buildMarkdownTheme(theme));
}

// ---- Markdown table helpers ----

/**
 * Build a Markdown table from rows.
 * @param header - Column headers
 * @param rows - Array of row arrays (same length as header)
 */
export function markdownTable(header: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  const sep = header.map(() => '---').join(' | ');
  const lines: string[] = [];
  lines.push(header.join(' | '));
  lines.push(sep);
  for (const row of rows) {
    lines.push(row.join(' | '));
  }
  return lines.join('\n');
}

/**
 * Build a Markdown table with alignment hints.
 * @param header - Column headers
 * @param alignments - Array of 'left', 'right', or 'center' per column
 * @param rows - Array of row arrays
 */
export function markdownTableAligned(
  header: string[],
  alignments: Array<'left' | 'right' | 'center'>,
  rows: string[][],
): string {
  if (rows.length === 0) return '';
  const lines: string[] = [];
  // Header row
  lines.push(header.join(' | '));
  // Separator row with alignment
  const sepRow = header.map((_, i) => {
    const align = alignments[i];
    if (align === 'right') return '---:';
    if (align === 'center') return ':--:';
    return '---';
  });
  lines.push(sepRow.join(' | '));
  // Data rows
  for (const row of rows) {
    lines.push(row.join(' | '));
  }
  return lines.join('\n');
}

// ---- Plain text table helpers ----

/**
 * Build an aligned plain text table.
 * @param header - Column headers
 * @param rows - Array of row arrays
 */
export function plainTable(header: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return header.join('  ');
  }
  // Calculate column widths
  const allRows = [header, ...rows];
  const widths = header.map((_, i) =>
    Math.max(...allRows.map(row => (row[i] ?? '').length)),
  );
  // Build format string
  const format = widths.map(w => `{{:${w + 2}}}`).join('');
  const lines: string[] = [];
  lines.push(header.map((h, i) => h.padEnd(widths[i] + 2)).join(''));
  // Separator
  lines.push(widths.map(w => '-'.repeat(w + 2)).join(''));
  // Data rows
  for (const row of rows) {
    lines.push(row.map((cell, i) => cell.padEnd(widths[i] + 2)).join(''));
  }
  return lines.join('\n');
}

// ---- Tool-specific compact formatters ----

export interface ReadCompactResult {
  totalLines: number;
  returnedLines: number;
  truncated: boolean;
  recoveryHint?: string;
  previewLines?: Array<{ line: number; text: string }>;
  /** Max preview lines shown in compact output (default 3) */
  maxPreviewLines?: number;
}

export function formatReadCompact(result: ReadCompactResult): string {
  const {
    totalLines,
    returnedLines,
    truncated,
    previewLines,
    maxPreviewLines = 3,
  } = result;
  const lines: string[] = [];

  // Line count summary (single line, compact)
  if (truncated) {
    lines.push(`${returnedLines} lines returned from ${totalLines} total (truncated)`);
  } else if (returnedLines < totalLines) {
    lines.push(`${returnedLines} lines returned from ${totalLines} total`);
  } else {
    lines.push(`${totalLines} lines total`);
  }

  // Preview lines with line/text
  if (previewLines && previewLines.length > 0) {
    const shown = previewLines.slice(0, maxPreviewLines);
    for (const pl of shown) {
      const preview = pl.text.length > 60 ? pl.text.slice(0, 57) + '...' : pl.text;
      lines.push(`  L${pl.line}: ${preview}`);
    }

    // Omitted-lines affordance: hint that more lines exist beyond what's shown
    // Use returnedLines (source of truth) minus shown preview lines
    const omittedCount = returnedLines - shown.length;
    if (omittedCount > 0) {
      lines.push(`... (${omittedCount} more line${omittedCount !== 1 ? 's' : ''}, ctrl+o to expand)`);
    }
  }

  return lines.join('\n');
}

export interface WriteCompactResult {
  path: string;
  created: boolean;
  overwritten: boolean;
  appended: boolean;
  bytesWritten: number;
  linesWritten: number;
}

export function formatWriteCompact(result: WriteCompactResult): string {
  const action = result.created
    ? 'created'
    : result.overwritten
      ? 'overwritten'
      : result.appended
        ? 'appended'
        : 'wrote';
  const lines = result.linesWritten === 1 ? 'line' : 'lines';
  return `${action} — ${result.bytesWritten} bytes, ${result.linesWritten} ${lines}`;
}

export interface EditCompactResult {
  applied: boolean;
  linesChanged: number;
  unchanged: boolean;
  beforeAnchors: Array<{ line: number; anchor: string }>;
  afterAnchors: Array<{ line: number; anchor: string }> | null;
}

export function formatEditCompact(result: EditCompactResult): string {
  if (result.unchanged) {
    return `no changes — old_text not found`;
  }
  if (!result.applied) {
    return `dry_run — ${result.linesChanged} lines would change`;
  }
  const anchorChanges = result.beforeAnchors
    .filter((ba, i) => {
      const aa = result.afterAnchors?.[i];
      return aa && aa.anchor !== ba.anchor;
    })
    .slice(0, 3);
  const anchorParts = anchorChanges.map(a => `${a.line}:${a.anchor}`);
  return `edited — ${result.linesChanged} line(s) changed${anchorParts.length > 0 ? ', anchors: ' + anchorParts.join(', ') : ''}`;
}

export interface GrepCompactResult {
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  query: string;
  filesSearched: number;
}

export function formatGrepCompact(result: GrepCompactResult): string {
  const { totalMatches, filesSearched, query } = result;
  const files = filesSearched === 1 ? 'file' : 'files';
  if (result.truncated) {
    return `${totalMatches} matches in ${filesSearched} ${files} for "${query}" (truncated)`;
  }
  return `${totalMatches} match${totalMatches !== 1 ? 'es' : ''} in ${filesSearched} ${files} for "${query}"`;
}

export interface FindCompactResult {
  totalEntries: number;
  returnedEntries: number;
  truncated: boolean;
}

export function formatFindCompact(result: FindCompactResult): string {
  if (result.truncated) {
    return `found ${result.returnedEntries} of ${result.totalEntries} entries (truncated)`;
  }
  return `found ${result.totalEntries} entries`;
}

export interface LsCompactResult {
  totalEntries: number;
  returnedEntries: number;
  truncated: boolean;
  names?: string[];
}

export function formatLsCompact(result: LsCompactResult): string {
  if (result.truncated) {
    return `${result.returnedEntries} of ${result.totalEntries} entries`;
  }
  return `${result.totalEntries} entries`;
}

export interface ShellCompactResult {
  exitCode: number;
  durationMs: number;
  stdout?: string;
  stderr?: string;
}

export function formatShellCompact(result: ShellCompactResult): string {
  const status = result.exitCode === 0
    ? `exit ${result.exitCode} ${result.durationMs}ms`
    : `exit ${result.exitCode} ${result.durationMs}ms`;
  // Include first failure line if non-zero
  if (result.exitCode !== 0 && result.stderr) {
    const firstLine = result.stderr.split('\n')[0]?.slice(0, 80);
    return `${status} — ${firstLine}`;
  }
  return status;
}

export interface AstSearchCompactResult {
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  pattern: string;
}

export function formatAstSearchCompact(result: AstSearchCompactResult): string {
  if (result.truncated) {
    return `${result.returnedMatches} of ${result.totalMatches} AST matches for "${result.pattern}" (truncated)`;
  }
  return `${result.totalMatches} AST match${result.totalMatches !== 1 ? 'es' : ''} for "${result.pattern}"`;
}

// ---- Per-tool table formatters ----

export interface ReadTableRow {
  line: number;
  anchor: string;
  text: string;
}

export function formatReadTableMarkdown(rows: ReadTableRow[]): string {
  return markdownTableAligned(
    ['line', 'hash', 'text'],
    ['right', 'center', 'left'],
    rows.map(r => [String(r.line), r.anchor, r.text.slice(0, 80)]),
  );
}

export function formatReadTablePlain(rows: ReadTableRow[]): string {
  return plainTable(
    ['line', 'hash', 'text'],
    rows.map(r => [String(r.line), r.anchor, r.text.slice(0, 80)]),
  );
}

export interface EditDiffRow {
  line: number;
  before: string;
  after: string;
}

export function formatEditDiffMarkdown(beforeAnchors: EditCompactResult['beforeAnchors'], afterAnchors: EditCompactResult['afterAnchors'] | null): string {
  if (!beforeAnchors || !afterAnchors) return '';
  const rows: EditDiffRow[] = [];
  for (let i = 0; i < beforeAnchors.length; i++) {
    const ba = beforeAnchors[i];
    const aa = afterAnchors[i];
    if (aa && aa.anchor !== ba.anchor) {
      rows.push({ line: ba.line, before: ba.anchor, after: aa.anchor });
    }
  }
  return markdownTableAligned(
    ['line', 'before', 'after'],
    ['right', 'center', 'center'],
    rows.map(r => [String(r.line), r.before, r.after]),
  );
}

export interface FindTableRow {
  type: string;
  size: string;
  path: string;
}

export function formatFindTableMarkdown(entries: Array<{ type: string; size: number; path: string }>): string {
  return markdownTableAligned(
    ['type', 'size', 'path'],
    ['left', 'right', 'left'],
    entries.map(e => [e.type, formatFileSize(e.size), e.path]),
  );
}

export interface LsTableRow {
  name: string;
  type: string;
  size: string;
  modified: string;
}

export function formatLsTableMarkdown(entries: Array<{ name: string; type: string; size: number; modified: string }>): string {
  return markdownTableAligned(
    ['name', 'type', 'size', 'modified'],
    ['left', 'left', 'right', 'left'],
    entries.map(e => [e.name, e.type, formatFileSize(e.size), e.modified]),
  );
}

export interface GrepTableRow {
  line: number;
  anchor: string;
  file: string;
  text: string;
}

export function formatGrepTableMarkdown(matches: Array<{ line: number; anchor: string; path: string; text: string }>): string {
  return markdownTableAligned(
    ['line', 'hash', 'file', 'text'],
    ['right', 'center', 'left', 'left'],
    matches.map(m => [String(m.line), m.anchor, m.path, m.text.slice(0, 60)]),
  );
}

export interface AstSearchTableRow {
  line: number;
  anchor: string;
  file: string;
  text: string;
  metavars?: string;
}

export function formatAstSearchTableMarkdown(matches: Array<{ line: number; anchor: string; path: string; text: string; metaVariables?: Record<string, string> }>): string {
  return markdownTableAligned(
    ['line', 'hash', 'file', 'text', 'metavars'],
    ['right', 'center', 'left', 'left', 'left'],
    matches.map(m => [
      String(m.line),
      m.anchor,
      m.path,
      m.text.slice(0, 50),
      m.metaVariables ? Object.entries(m.metaVariables).map(([k, v]) => `${k}=${v}`).join('; ') : '',
    ]),
  );
}

// ---- Fenced diff block ----

export function fencedDiff(diff: string): string {
  return '```diff\n' + diff + '\n```';
}

// ---- Diff renderer for TUI (Phase 21 nitpick) ----

/**
 * Format a unified diff for TUI display with theme-aware coloring.
 * Adds ANSI color codes to diff lines based on line type:
 *   - additions (+): success/accent
 *   - removals (-): error
 *   - context (spaces): muted/dim
 *   - hunk headers (@@): accent
 */
export function formatDiffForTui(diff: string, theme: { fg: (color: unknown, text: string) => string }): string {
  const lines = diff.split('\n');
  const colored: string[] = [];
  for (const line of lines) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      // File header — dim
      colored.push(theme.fg('dim', line));
    } else if (line.startsWith('@@')) {
      // Hunk header — accent
      colored.push(theme.fg('accent', line));
    } else if (line.startsWith('+')) {
      // Addition — success
      colored.push(theme.fg('success', line));
    } else if (line.startsWith('-')) {
      // Removal — error
      colored.push(theme.fg('error', line));
    } else if (line.startsWith(' ')) {
      // Context — muted
      colored.push(theme.fg('muted', line));
    } else {
      // Everything else (e.g., empty lines) — dim
      colored.push(theme.fg('dim', line));
    }
  }
  return colored.join('\n');
}

// ---- Shell guidance text ----

export const SHELL_GUIDANCE = `shell uses Nushell syntax:
- Use ; instead of &&
- Use out+err> / o+e> instead of 2>&1
- Do not use 2>/dev/null
- false is a boolean; use exit 1 for failure tests
- Use ^external-command to force external commands`;

// ---- File size formatter ----

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}
