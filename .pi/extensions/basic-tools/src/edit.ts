/**
 * `edit` tool — Linehash-backed file editing with stale-context detection.
 *
 * Wraps fs operations with linehash anchoring for change detection.
 * Returns structured diff + before/after anchors for context hygiene.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseLineHash, type LineHashRecord } from './linehash.js';
import { Text } from '@earendil-works/pi-tui';
import { error } from './output.js';
import { type DisplayMode } from './display.js';
import { encodeToon } from './toon.js';

/** Resolve boolean-or-string param to true/false. */
function resolveBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return fallback;
}

/**
 * Resolve the linehash binary path.
 * LINEHASH_BIN env var overrides; otherwise resolves from PATH (flox-provided).
 */
function resolveLinehashBin(): string {
  if (process.env.LINEHASH_BIN) return process.env.LINEHASH_BIN;
  try {
    const { execSync } = require('child_process');
    const whichPath = execSync('which linehash 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (whichPath) return whichPath;
  } catch { /* continue */ }
  throw new Error(
    'linehash binary not found. Set LINEHASH_BIN env var, or ensure it is in PATH.'
  );
}

const LINEHASH_BIN = resolveLinehashBin();

/**
 * Resolve delta binary path (for human diff rendering).
 */
function resolveDeltaBin(): string {
  if (process.env.DELTA_BIN) return process.env.DELTA_BIN;
  try {
    const { execSync } = require('child_process');
    const whichPath = execSync('which delta 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (whichPath) return whichPath;
  } catch { /* continue */ }
  return 'delta';
}

const DELTA_BIN = resolveDeltaBin();

/**
 * Pipe plain diff text through delta for enriched human display.
 * Returns ANSI-colored output (for renderResult) or null on failure.
 */
function runDelta(diffText: string): string | null {
  try {
    const result = spawnSync(DELTA_BIN, [
      '--no-gitconfig',
      '--file-style=omit',
      '--file-decoration-style=omit',
      '--hunk-header-decoration-style=omit',
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
      input: diffText,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    if (result.status !== 0 || !result.stdout || result.stdout.length === 0) return null;
    // Return ANSI-colored output as-is
    return result.stdout.toString();
  } catch {
    return null;
  }
}

export interface EditToolOptions {
  /** Pre-loaded anchor map from a prior read (for verify_hash) */
  priorAnchors?: Map<string, number>;
}

export interface EditItem {
  path: string;
  old_text: string;
  new_text: string;
  mode?: string;
  anchor?: string;
  occurrence?: string;
  all_occurrences?: boolean | string;
  /** When true (default), fall back to fuzzy matching on exact-match miss */
  fuzzy?: boolean | string;
}

export interface EditToolParams {
  edits: EditItem[];
  dry_run?: boolean | string;
  display?: DisplayMode;
  /** Global fuzzy default (per-edit fuzzy overrides) */
  fuzzy?: boolean | string;
}

export interface EditToolResult {
  /** File path */
  path: string;
  /** Whether the edit was applied (false for dry_run or no-change) */
  applied: boolean;
  /** Lines changed count */
  linesChanged: number;
  /** Diff hunk (unified format) */
  diff: string;
  /** Before-state anchors (linehash records) */
  beforeAnchors: Array<{ line: number; anchor: string }>;
  /** After-state anchors (linehash records, null if dry_run) */
  afterAnchors: Array<{ line: number; anchor: string }> | null;
  /** Whether file was unchanged (old_text not found) */
  unchanged: boolean;
  /** Backend used for rendering */
  backend?: string;
}

/**
 * Delegate fuzzy edit to `linehash edit --fuzzy <path>`.
 * Builds JSONL edit ops from fileEdits, pipes to linehash stdin.
 * Extension stays thin — all matching logic lives in the CLI.
 * Returns { applied, linesChanged, diff, error } on success.
 */
function tryFuzzyEdit(
  absolutePath: string,
  fileEdits: EditItem[],
  dryRun: boolean,
  oldContent: string,
): Promise<{ applied: boolean; linesChanged: number; diff: string | null; error?: string }> {
  return new Promise((resolve) => {
    // Build JSONL edit ops: replace with from+to anchor range, text = new_text
    const ops = fileEdits.map(e => ({
      op: 'replace',
      from: e.old_text,
      to: e.old_text,
      text: e.new_text,
    }));
    const jsonl = ops.map(o => JSON.stringify(o)).join('\n');

    const proc = spawn(LINEHASH_BIN, ['edit', '--fuzzy', absolutePath], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdin?.write(jsonl + '\n');
    proc.stdin?.end();

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        // Read file after fuzzy edit to compute diff
        let newContent: string;
        try {
          newContent = readFileSync(absolutePath, 'utf-8');
        } catch {
          resolve({ applied: false, linesChanged: 0, diff: null, error: 'failed to read file after fuzzy edit' });
          return;
        }
        const diffText = computeDiff(oldContent, newContent, absolutePath);
        const linesChanged = countLines(diffText.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'));
        resolve({ applied: true, linesChanged, diff: diffText });
      } else {
        resolve({ applied: false, linesChanged: 0, diff: null, error: `linehash edit --fuzzy exited ${code}: ${stderr.trim()}` });
      }
    });

    proc.on('error', () => {
      resolve({ applied: false, linesChanged: 0, diff: null, error: 'linehash edit --fuzzy process error' });
    });
  });
}

/**
 * Execute linehash read on a file.
 */
function linehashRead(filePath: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(LINEHASH_BIN, ['read', filePath], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (exitCode) => { resolve({ stdout, stderr, exitCode: exitCode ?? 1 }); });
    proc.on('error', (err) => { reject(err); });
  });
}

/**
 * Compute unified diff between two strings using linehash diff.
 * Writes old/new to temp files, calls `linehash diff`, captures stdout.
 */
function computeDiff(oldContent: string, newContent: string, filePath = ''): string {
  if (oldContent === newContent) return '';
  const tmpDir = '/tmp';
  const oldFile = `${tmpDir}/.lc-old-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newFile = `${tmpDir}/.lc-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    writeFileSync(oldFile, oldContent, 'utf-8');
    writeFileSync(newFile, newContent, 'utf-8');
    const result = spawnSync(LINEHASH_BIN, ['diff', oldFile, newFile], {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    if (result.status !== 0 || !result.stdout || result.stdout.length === 0) return '';
    return result.stdout.toString().trim();
  } catch {
    return '';
  } finally {
    try { unlinkSync(oldFile); unlinkSync(newFile); } catch { /* best-effort cleanup */ }
  }
}

/**
 * Count lines in a string.
 */
function countLines(text: string): number {
  if (!text) return 0;
  // Count newline-terminated lines
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return trimmed.split('\n').length;
}

/**
 * Execute anchor-based replacement mode.
 */
async function executeReplaceByAnchor(
  absolutePath: string,
  anchor: string | null,
  oldText: string | null,
  newText: string,
  occurrence: 'first' | 'all',
  dryRun: boolean,
  records: LineHashRecord[],
  beforeAnchors: Array<{ line: number; anchor: string }>,
  oldContent: string,
  display: DisplayMode,
): Promise<{ content: Array<{ type: 'text'; text: string }>; details: Record<string, unknown>; isError?: boolean }> {
  // Step 1: Find all lines matching the anchor
  const matchingRecords = records.filter(r => r.anchor === anchor);

  // Step 2: Handle zero matches (stale anchor)
  if (matchingRecords.length === 0) {
    return {
      content: [{
        type: 'text',
        text: error('unknown', `Anchor "${anchor}" not found in ${absolutePath}. The file may have changed since you last read it.`, { tool: 'edit', path: absolutePath, details: { anchor } }).message,
      }],
      isError: true,
      details: {
        errorType: 'stale-anchor',
        path: absolutePath,
        anchor,
        beforeAnchors,
        mode: 'replace_by_anchor',
      },
    };
  }

  // Step 3: Handle multiple matches (ambiguous anchor)
  if (matchingRecords.length > 1) {
    const lines = matchingRecords.map(r => r.line).join(', ');
    return {
      content: [{
        type: 'text',
        text: error('unknown', `Anchor "${anchor}" matches multiple lines (${lines}) in ${absolutePath}. Use a more specific anchor or edit by exact text.`, { tool: 'edit', path: absolutePath, details: { anchor, matchingLines: lines } }).message,
      }],
      isError: true,
      details: {
        errorType: 'ambiguous-anchor',
        path: absolutePath,
        anchor,
        matchingLines: lines,
        beforeAnchors,
        mode: 'replace_by_anchor',
      },
    };
  }

  // Step 4: Single match — perform replacement
  const match = matchingRecords[0];
  const fileLines = oldContent.split('\n');

  // Get the current line content
  let currentLine = fileLines[match.line - 1];
  if (currentLine === undefined) {
    return {
      content: [{
        type: 'text',
        text: error('unknown', `Anchor "${anchor}" points to line ${match.line} which does not exist. The file may have changed.`, { tool: 'edit', path: absolutePath, details: { anchor, line: match.line } }).message,
      }],
      isError: true,
      details: {
        errorType: 'stale-anchor',
        path: absolutePath,
        anchor,
        line: match.line,
        beforeAnchors,
        mode: 'replace_by_anchor',
      },
    };
  }

  let newLine: string;

  if (oldText === null) {
    // Replace the whole line
    newLine = newText;
  } else {
    // Replace old_text within the line
    if (occurrence === 'all') {
      const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(currentLine)) {
        newLine = currentLine.replace(regex, newText);
      } else {
        return {
          content: [{
            type: 'text',
            text: error('not-found', `"${oldText}" not found on line ${match.line} (anchor "${anchor}") in ${absolutePath}`, { tool: 'edit', path: absolutePath, details: { line: match.line, anchor, old_text: oldText } }).message,
          }],
          isError: true,
          details: {
            errorType: 'not-found',
            path: absolutePath,
            line: match.line,
            anchor,
            old_text: oldText,
            beforeAnchors,
            mode: 'replace_by_anchor',
          },
        };
      }
    } else {
      // occurrence === 'first'
      const idx = currentLine.indexOf(oldText);
      if (idx === -1) {
        return {
          content: [{
            type: 'text',
            text: error('not-found', `"${oldText}" not found on line ${match.line} (anchor "${anchor}") in ${absolutePath}`, { tool: 'edit', path: absolutePath, details: { line: match.line, anchor, old_text: oldText } }).message,
          }],
          isError: true,
          details: {
            errorType: 'not-found',
            path: absolutePath,
            line: match.line,
            anchor,
            old_text: oldText,
            beforeAnchors,
            mode: 'replace_by_anchor',
          },
        };
      }
      newLine = currentLine.slice(0, idx) + newText + currentLine.slice(idx + oldText.length);
    }
  }

  // Check if the line actually changed
  if (newLine === currentLine) {
    return {
      content: [{ type: 'text', text: encodeToon({ edit: { [absolutePath]: [{ applied: false, linesChanged: 0, diff: null }] } }).text }],
      details: { path: absolutePath, applied: false, dry_run: dryRun, unchanged: true, linesChanged: 0, diff: null, anchor, line: match.line },
    };
  }

  // Build new content
  fileLines[match.line - 1] = newLine;
  const newContent = fileLines.join('\n');

  // Compute diff
  const diffText = computeDiff(oldContent, newContent, absolutePath);
  const linesChanged = countLines(diffText.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'));

  if (dryRun) {
    return {
      content: [{ type: 'text', text: encodeToon({ edit: { [absolutePath]: [{ applied: false, linesChanged, diff: diffText }] } }).text }],
      details: { path: absolutePath, applied: false, dry_run: true, unchanged: false, linesChanged, diff: diffText, anchor, line: match.line },
    };
  }

  // Stable machine details
  const details: Record<string, unknown> = {
    path: absolutePath,
    applied: true,
    dry_run: false,
    unchanged: false,
    linesChanged,
    diff: diffText,
    beforeAnchors,
    afterAnchors: null,
    changedAnchors: [{ line: match.line, beforeAnchor: anchor, afterAnchor: null }],
    anchor,
    line: match.line,
  };

  const anchorToon = (d: typeof details) =>
    encodeToon({ edit: { [absolutePath]: [{ applied: d.applied, linesChanged: d.linesChanged, diff: diffText }] } }).text;

  // Write new content
  try {
    writeFileSync(absolutePath, newContent, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('binary-failed', `Failed to write file: ${msg}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'binary-failed', path: absolutePath, stderr: msg },
    };
  }

  // Re-read for after-state anchors
  let afterResult: { stdout: string; stderr: string; exitCode: number };
  try {
    afterResult = await linehashRead(absolutePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    details.warning = `linehash post-edit failed: ${msg}`;
    return { content: [{ type: 'text', text: anchorToon(details) }], details };
  }

  const afterParsed = parseLineHash(afterResult.stdout);
  const afterAnchors = afterParsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
  const changedAfterAnchor = afterAnchors.find(r => r.line === match.line)?.anchor ?? null;
  details.afterAnchors = afterAnchors;
  details.changedAnchors = [{ line: match.line, beforeAnchor: anchor, afterAnchor: changedAfterAnchor }];

  return { content: [{ type: 'text', text: anchorToon(details) }], details };
}

/**
 * Apply one or more edits to a single file. Groups by old_text search (or anchor).
 * Returns a result record compatible with pi AgentToolResult shape.
 */
async function executeSingleFileEdits(
  absolutePath: string,
  fileEdits: EditItem[],
  dryRun: boolean,
  options: EditToolOptions,
  globalFuzzy: boolean,
  _ctx: unknown
): Promise<Record<string, unknown>> {
  // Validate file exists
  if (!existsSync(absolutePath)) {
    return {
      content: [{ type: 'text', text: error('not-found', `File not found: ${absolutePath}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'not-found', path: absolutePath },
    };
  }

  try {
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      return {
        content: [{ type: 'text', text: error('invalid-params', `Path is a directory: ${absolutePath}`, { tool: 'edit', path: absolutePath }).message }],
        isError: true,
        details: { errorType: 'invalid-params', path: absolutePath },
      };
    }
  } catch {
    return {
      content: [{ type: 'text', text: error('permission-denied', `Cannot read file: ${absolutePath}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'permission-denied', path: absolutePath },
    };
  }

  let oldContent: string;
  try {
    oldContent = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('binary-failed', `Failed to read file: ${msg}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'binary-failed', path: absolutePath, stderr: msg },
    };
  }

  let beforeResult: { stdout: string; stderr: string; exitCode: number };
  try {
    beforeResult = await linehashRead(absolutePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('binary-failed', `linehash read failed: ${msg}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'binary-failed', path: absolutePath, stderr: msg },
    };
  }

  if (beforeResult.exitCode !== 0) {
    return {
      content: [{ type: 'text', text: error('binary-failed', `linehash exited ${beforeResult.exitCode}: ${beforeResult.stderr.trim()}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'binary-failed', path: absolutePath, exitCode: beforeResult.exitCode, stderr: beforeResult.stderr.trim() },
    };
  }

  const beforeParsed = parseLineHash(beforeResult.stdout);
  const beforeAnchors = beforeParsed.records.map(r => ({ line: r.line, anchor: r.anchor }));

  // replace_by_anchor mode (single edit only)
  if (fileEdits.length === 1 && (fileEdits[0].mode ?? 'replace') === 'replace_by_anchor') {
    const item = fileEdits[0];
    const occurrence = (item.occurrence ?? 'first') as 'first' | 'all';
    return executeReplaceByAnchor(
      absolutePath,
      item.anchor ?? null,
      item.old_text,
      item.new_text,
      occurrence,
      dryRun,
      beforeParsed.records,
      beforeAnchors,
      oldContent,
      'compact',
    ) as unknown as Record<string, unknown>;
  }

  // Text replacement: apply all edits sequentially in memory
  let content = oldContent;
  const editResults: Array<{ old_text: string; applied: boolean; index: number }> = [];

  for (let i = 0; i < fileEdits.length; i++) {
    const { old_text, new_text, all_occurrences, fuzzy } = fileEdits[i];
    const replaceAll = all_occurrences === true || all_occurrences === 'true';
    // Resolve fuzzy: per-edit overrides global; default true
    const fuzzyEnabled = resolveBool(fuzzy !== undefined ? fuzzy : globalFuzzy, true);

    if (replaceAll) {
      const escaped = old_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(content)) {
        content = content.replace(new RegExp(escaped, 'g'), new_text);
        editResults.push({ old_text, applied: true, index: i });
      } else {
        editResults.push({ old_text, applied: false, index: i });
      }
    } else {
      const idx = content.indexOf(old_text);
      if (idx === -1) {
        editResults.push({ old_text, applied: false, index: i });
      } else {
        content = content.slice(0, idx) + new_text + content.slice(idx + old_text.length);
        editResults.push({ old_text, applied: true, index: i });
      }
    }
  }

  const unchanged = editResults.every(r => !r.applied);

  // Fuzzy fallback: if all edits failed and fuzzy is enabled, try linehash edit --fuzzy
  if (unchanged && fileEdits.length > 0 && !dryRun) {
    // Check if any edit has fuzzy enabled (or global fuzzy is enabled)
    const hasFuzzy = fileEdits.some(e => {
      const ef = resolveBool(e.fuzzy !== undefined ? e.fuzzy : globalFuzzy, true);
      return ef;
    });

    if (hasFuzzy) {
      const fuzzyResult = await tryFuzzyEdit(absolutePath, fileEdits, dryRun, oldContent);
      if (fuzzyResult.applied) {
        // Re-read for after-state anchors
        let afterResult: { stdout: string; stderr: string; exitCode: number };
        try {
          afterResult = await linehashRead(absolutePath);
        } catch {
          const details: Record<string, unknown> = {
            path: absolutePath,
            applied: true,
            dry_run: false,
            unchanged: false,
            linesChanged: fuzzyResult.linesChanged,
            diff: fuzzyResult.diff,
            beforeAnchors,
            afterAnchors: null,
            fuzzy: true,
          };
          return { content: [{ type: 'text', text: encodeToon({ edit: { [absolutePath]: [{ applied: true, linesChanged: fuzzyResult.linesChanged, diff: fuzzyResult.diff }] } }).text }], details };
        }
        const afterParsed = parseLineHash(afterResult.stdout);
        const details: Record<string, unknown> = {
          path: absolutePath,
          applied: true,
          dry_run: false,
          unchanged: false,
          linesChanged: fuzzyResult.linesChanged,
          diff: fuzzyResult.diff,
          beforeAnchors,
          afterAnchors: afterParsed.records.map(r => ({ line: r.line, anchor: r.anchor })),
          fuzzy: true,
        };
        return { content: [{ type: 'text', text: encodeToon({ edit: { [absolutePath]: [{ applied: true, linesChanged: fuzzyResult.linesChanged, diff: fuzzyResult.diff }] } }).text }], details };
      }
    }
  }
  const diffText = computeDiff(oldContent, content, absolutePath);
  const linesChanged = unchanged ? 0 : countLines(diffText.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'));
  const isBatch = fileEdits.length > 1;

  if (dryRun) {
    const dryDetails: Record<string, unknown> = {
      path: absolutePath,
      applied: false,
      dry_run: true,
      unchanged,
      linesChanged,
      diff: unchanged ? null : diffText,
      ...(isBatch ? { editResults } : {}),
    };
    return {
      content: [{ type: 'text', text: encodeToon({ edit: { [absolutePath]: [{ applied: false, linesChanged, diff: unchanged ? null : diffText }] } }).text }],
      details: dryDetails,
    };
  }

  const details: Record<string, unknown> = {
    path: absolutePath,
    applied: !unchanged,
    dry_run: false,
    unchanged,
    linesChanged,
    diff: diffText,
    ...(isBatch ? { editResults } : {}),
    beforeAnchors,
    afterAnchors: null as Array<{ line: number; anchor: string }> | null,
  };

  const editToon = (d: typeof details) =>
    encodeToon({ edit: { [absolutePath]: [{ applied: d.applied, linesChanged: d.linesChanged, diff: diffText }] } }).text;

  if (unchanged) {
    return { content: [{ type: 'text', text: editToon(details) }], details };
  }

  try {
    writeFileSync(absolutePath, content, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('binary-failed', `Failed to write file: ${msg}`, { tool: 'edit', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'binary-failed', path: absolutePath, stderr: msg },
    };
  }

  try {
    const afterResult = await linehashRead(absolutePath);
    const afterParsed = parseLineHash(afterResult.stdout);
    details.afterAnchors = afterParsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
  } catch { /* non-fatal */ }

  return { content: [{ type: 'text', text: editToon(details) }], details };
}

/**
 * Register the edit tool with pi.
 */
export function registerEditTool(pi: ExtensionAPI, options: EditToolOptions = {}) {
  const editItemSchema = Type.Object({
    path: Type.String({ description: 'File path to edit (relative or absolute)' }),
    old_text: Type.String({ description: 'Exact text to find' }),
    new_text: Type.String({ description: 'Replacement text' }),
    mode: Type.Optional(Type.Union([
      Type.Literal('replace', { description: 'Default: find and replace exact text' }),
      Type.Literal('replace_by_anchor', { description: 'Locate line by anchor, replace old_text within it' }),
    ])),
    anchor: Type.Optional(Type.String({ description: 'Linehash anchor (required for replace_by_anchor mode)' })),
    occurrence: Type.Optional(Type.Union([
      Type.Literal('first', { description: 'Replace first occurrence (default)' }),
      Type.Literal('all', { description: 'Replace all occurrences' }),
    ])),
    all_occurrences: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Replace all occurrences' }),
      Type.String({ description: 'Replace all occurrences' }),
    ])),
    fuzzy: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Fall back to fuzzy matching on exact-match miss (default: true)' }),
        Type.String({ description: 'Fall back to fuzzy matching on exact-match miss (default: true)' }),
      ], { description: 'When true, try Unicode/whitespace-normalized fuzzy match if exact match fails' })
    ),
  });

  const editSchema = Type.Object({
    edits: Type.Array(editItemSchema, {
      description: 'Edits to apply. Single edit: [{path, old_text, new_text}]. Multi-file: [{path: "a.ts", ...}, {path: "b.ts", ...}]. Same-file batch: multiple items with the same path.',
    }),
    dry_run: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Preview only, do not write' }),
      Type.String({ description: 'Preview only, do not write' }),
    ], { description: 'Show diff without applying changes' })),
    display: Type.Optional(Type.Union([
      Type.Literal('compact', { description: 'Compact: 1-5 short visible lines (default)' }),
      Type.Literal('table', { description: 'Markdown table via renderResult' }),
      Type.Literal('full', { description: 'Compact summary + diff sections' }),
    ], { description: 'Display mode for visible output' })),
  });

  pi.registerTool({
    name: 'edit',
    label: 'Edit',
    description:
      'Make surgical text replacements in files. Always pass edits[]. '
      + 'Single edit: edits: [{path, old_text, new_text}]. '
      + 'Multi-file or same-file batch: edits: [{path, ...}, {path, ...}].',
    promptSnippet: 'Edit files with surgical text replacements',
    promptGuidelines: [
      'Always pass edits: [{path, old_text, new_text}].',
      'old_text must match exactly (including whitespace and indentation).',
      'fuzzy: true (default) falls back to normalized matching on exact-match miss.',
      'fuzzy: false preserves strict exact-match behavior.',
      'Same-file batch: multiple items with the same path applied sequentially.',
      'Multi-file: items with different paths, each applied independently.',
      'Use dry_run: true to preview changes before applying.',
    ],
    parameters: editSchema,
    async execute(_toolCallId, params: EditToolParams, _signal, _onUpdate, ctx) {
      if (!params.edits || params.edits.length === 0) {
        return {
          content: [{ type: 'text', text: error('invalid-params', 'edits[] is required (e.g. edits: [{path, old_text, new_text}])', { tool: 'edit' }).message }],
          isError: true,
          details: { errorType: 'invalid-params' },
        };
      }

      const dryRun = params.dry_run === true || params.dry_run === 'true';
      const globalFuzzy = resolveBool(params.fuzzy, true);

      // Group edits by path (preserving order), then process each group
      const groups = new Map<string, EditItem[]>();
      const groupOrder: string[] = [];
      for (const item of params.edits) {
        const requestedPath = item.path.startsWith('@') ? item.path.slice(1) : item.path;
        const absolutePath = resolve(ctx.cwd, requestedPath);
        if (!groups.has(absolutePath)) {
          groups.set(absolutePath, []);
          groupOrder.push(absolutePath);
        }
        groups.get(absolutePath)!.push({ ...item, path: absolutePath });
      }

      // Single-path shortcut: existing single-file logic
      if (groupOrder.length === 1) {
        const absolutePath = groupOrder[0];
        const fileEdits = groups.get(absolutePath)!;
        return executeSingleFileEdits(absolutePath, fileEdits, dryRun, options, globalFuzzy, ctx) as any;
      }

      // Multi-file: apply each group, collect results
      const results: Array<{ path: string; result: Record<string, unknown> }> = [];
      for (const absolutePath of groupOrder) {
        const fileEdits = groups.get(absolutePath)!;
        const r = await executeSingleFileEdits(absolutePath, fileEdits, dryRun, options, globalFuzzy, ctx);
        results.push({ path: absolutePath, result: r as Record<string, unknown> });
      }

      const allApplied = results.every(r => (r.result as any).details?.applied !== false);
      const totalChanged = results.reduce((sum, r) => sum + ((r.result as any).details?.linesChanged ?? 0), 0);

      const editMap: Record<string, unknown> = {};
      for (const r of results) {
        const d = (r.result as any).details ?? {};
        editMap[r.path] = [{ applied: d.applied, linesChanged: d.linesChanged, diff: d.diff ?? '' }];
      }

      return {
        content: [{ type: 'text' as const, text: encodeToon({ edit: editMap }).text }],
        details: {
          applied: allApplied && !dryRun,
          dry_run: dryRun,
          linesChanged: totalChanged,
          files: results.map(r => ({
            path: (r.result as any).details?.path ?? r.path,
            applied: (r.result as any).details?.applied,
            linesChanged: (r.result as any).details?.linesChanged ?? 0,
            editResults: (r.result as any).details?.editResults,
            diff: (r.result as any).details?.diff ?? null,
          })),
        },
      };
    },

    renderResult(result, { expanded }, theme, _context) {
      const raw = result as any;
      const d: Record<string, any> = raw.details ?? {};
      // diff lives in details.diff (single-file) or combined from details.files[].diff (multi-file)
      const multiDiff = Array.isArray(d.files)
        ? (d.files as Array<{ diff?: string | null }>).map(f => f.diff ?? '').filter(Boolean).join('\n')
        : null;
      const diff: string | null = (d.diff as string | null | undefined) ?? multiDiff ?? null;

      if (expanded && diff) {
        // Expanded: use delta for syntax-highlighted diff (ANSI output)
        try {
          const deltaResult = spawnSync(DELTA_BIN, [
            '--no-gitconfig',
            '--file-style=omit',
            '--file-decoration-style=omit',
            '--hunk-header-decoration-style=omit',
          ], {
            input: diff,
            encoding: 'utf-8',
            timeout: 5000,
          });
          if (deltaResult.status === 0 && deltaResult.stdout) {
            return new Text(deltaResult.stdout, 1, 0);
          }
        } catch {
          // delta not available, fall through
        }
        // Fallback: plain diff
        return new Text(diff ?? '', 1, 0);
      }

      // Collapsed: heavily condensed summary
      const applied = d.applied;
      const dryRun = d.dry_run;
      const unchanged = !applied && !dryRun;
      const editResults = d.editResults as Array<{ applied: boolean }> | undefined;
      const batchCount = editResults?.length;
      const batchApplied = editResults?.filter((r: { applied: boolean }) => r.applied).length ?? 0;
      let text: string;
      if (unchanged) {
        text = batchCount ? `no changes — 0/${batchCount} edits matched` : 'no changes — old_text not found';
      } else if (dryRun) {
        text = batchCount
          ? `dry_run — ${batchApplied}/${batchCount} edits, ${d.linesChanged ?? 0} line(s) would change`
          : `dry_run — ${d.linesChanged ?? 0} line(s) would change`;
      } else {
        text = batchCount
          ? `edited — ${batchApplied}/${batchCount} edits applied, ${d.linesChanged ?? 0} line(s) changed`
          : `edited — ${d.linesChanged ?? 0} line(s) changed`;
      }
      return new Text(text, 0, 0);
    },

    });
}
