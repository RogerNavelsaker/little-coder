/**
 * `edit` tool — Linehash-backed file editing with stale-context detection.
 *
 * Wraps fs operations with linehash anchoring for change detection.
 * Returns structured diff + before/after anchors for context hygiene.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseLineHash, extractText, type LineHashRecord } from '../../_shared/linehash.js';
import { Text } from '@earendil-works/pi-tui';
import { formatDiffForTui } from '../../_shared/display.js';
import { error } from '../../_shared/output.js';
import { type DisplayMode, formatEditCompact } from '../../_shared/display.js';

// Lazy-load diff package (ESM CJS bridge)
let diffModule: typeof import('/home/rona/.pi/agent/pi-structural-tools/node_modules/diff/libcjs/index.js') | null = null;
function getDiffModule() {
  if (!diffModule) {
    diffModule = require('/home/rona/.pi/agent/pi-structural-tools/node_modules/diff/libcjs/index.js');
  }
  return diffModule;
}

/**
 * Resolve the linehash binary path.
 */
function resolveLinehashBin(): string {
  if (process.env.LINEHASH_BIN) return process.env.LINEHASH_BIN;
  try {
    const { execSync } = require('child_process');
    const whichPath = execSync('which linehash 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (whichPath) return whichPath;
  } catch { /* continue */ }
  const fallbackPaths = [
    '/home/rona/.flox/run/x86_64-linux.default.run/bin/linehash',
    '/home/rona/.flox/run/bin/linehash',
    '/run/current-system/sw/bin/linehash',
  ];
  for (const path of fallbackPaths) {
    if (existsSync(path)) return path;
  }
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
 * Strips ANSI codes for stable output.
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
    // Strip ANSI escape codes for stable output
    const raw = result.stdout.toString();
    return raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[[0-9;]*m/g, '');
  } catch {
    return null;
  }
}

export interface EditToolOptions {
  /** Pre-loaded anchor map from a prior read (for verify_hash) */
  priorAnchors?: Map<string, number>;
}

export interface EditToolParams {
  path: string;
  old_text?: string;
  new_text: string;
  mode?: string;
  anchor?: string;
  occurrence?: string;
  dry_run?: boolean | string;
  verify_hash?: boolean | string;
  all_occurrences?: boolean | string;
  display?: DisplayMode;
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
 * Compute unified diff between two strings.
 */
function computeDiff(oldContent: string, newContent: string): string {
  const mod = getDiffModule();
  if (!mod || !mod.diffLines) return '';
  const diffResult = mod.diffLines(oldContent, newContent);
  // Convert to unified diff format
  const hunks: string[] = [];
  let oldLine = 1;
  let newLine = 1;
  let inHunk = false;

  for (const part of diffResult) {
    const lines = part.value.split('\n');
    // Remove trailing empty string from split
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (part.added) {
      if (!inHunk) {
        hunks.push(`@@ -${oldLine},+${newLine} @@`);
        inHunk = true;
      }
      for (const line of lines) {
        hunks.push(`+${line}`);
        newLine++;
      }
    } else if (part.removed) {
      if (!inHunk) {
        hunks.push(`@@ -${oldLine},+${newLine} @@`);
        inHunk = true;
      }
      for (const line of lines) {
        hunks.push(`-${line}`);
        oldLine++;
      }
    } else {
      // Context
      if (!inHunk) {
        hunks.push(`@@ -${oldLine},+${newLine} @@`);
        inHunk = true;
      }
      for (const line of lines) {
        hunks.push(` ${line}`);
        oldLine++;
        newLine++;
      }
    }
  }

  return hunks.join('\n');
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
      content: [{
        type: 'text',
        text: `No changes: line ${match.line} (anchor "${anchor}") is already "${newLine}"`,
      }],
      details: {
        path: absolutePath,
        applied: false,
        dry_run: dryRun,
        unchanged: true,
        linesChanged: 0,
        diff: '',
        beforeAnchors,
        afterAnchors: null,
        changedAnchors: [],
        source: 'linehash',
        backend: 'linehash+nu',
        mode: 'replace_by_anchor',
        anchor,
        line: match.line,
      },
    };
  }

  // Build new content
  fileLines[match.line - 1] = newLine;
  const newContent = fileLines.join('\n');

  // Compute diff
  const diffText = computeDiff(oldContent, newContent);
  const linesChanged = countLines(diffText.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'));

  // Try delta rendering
  const deltaOutput = runDelta(diffText);
  const backendLabel = deltaOutput ? 'linehash+delta+nu' : 'linehash+nu';

  // Build user-facing text (Phase 21: display-aware)
  const linesRemoved = diffText.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length;
  const linesAdded = diffText.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  const editCompactResult = {
    applied: !dryRun,
    linesChanged,
    unchanged: false,
    beforeAnchors,
    afterAnchors: null,
  };
  let userText: string;

  if (display === 'compact' || display === 'auto') {
    userText = formatEditCompact(editCompactResult);
  } else {
    // Table/Full: rich content only (diff if available)
    if (diffText) {
      userText = diffText;
    } else {
      userText = formatEditCompact(editCompactResult);
    }
  }

  // Stable machine details
  const details: Record<string, unknown> = {
    path: absolutePath,
    applied: !dryRun,
    dry_run: dryRun,
    unchanged: false,
    linesChanged,
    diff: diffText,
    beforeAnchors,
    afterAnchors: null,
    changedAnchors: [{ line: match.line, beforeAnchor: anchor, afterAnchor: null }],
    source: 'linehash',
    backend: backendLabel,
    mode: 'replace_by_anchor',
    anchor,
    line: match.line,
  };

  if (dryRun) {
    return {
      content: [{ type: 'text', text: userText }],
      details,
    };
  }

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
    return {
      content: [{ type: 'text', text: userText + `\n\n⚠ linehash post-edit failed: ${msg}` }],
      details,
    };
  }

  const afterParsed = parseLineHash(afterResult.stdout);
  const afterAnchors = afterParsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
  const changedAfterAnchor = afterAnchors.find(r => r.line === match.line)?.anchor ?? null;
  details.afterAnchors = afterAnchors;
  details.changedAnchors = [{ line: match.line, beforeAnchor: anchor, afterAnchor: changedAfterAnchor }];

  return {
    content: [{ type: 'text', text: userText }],
    details,
  };
}

/**
 * Register the edit tool with pi.
 */
export function registerEditTool(pi: ExtensionAPI, options: EditToolOptions = {}) {
  const editSchema = Type.Object({
    path: Type.String({ description: 'File path to edit (relative or absolute)' }),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('replace', { description: 'Default: find and replace exact text in the file' }),
        Type.Literal('replace_by_anchor', { description: 'Replace by linehash anchor: locate line by anchor, replace old_text within that line (or replace whole line if old_text omitted)' }),
      ], { description: 'Edit mode: "replace" for exact text matching, "replace_by_anchor" for anchor-based line replacement' })
    ),
    anchor: Type.Optional(Type.String({ description: 'Linehash anchor to locate the target line (required when mode is "replace_by_anchor")' })),
    old_text: Type.Optional(Type.String({ description: 'Exact text to find and replace within the anchored line (omit to replace the whole line)' })),
    new_text: Type.String({ description: 'Replacement text' }),
    occurrence: Type.Optional(
      Type.Union([
        Type.Literal('first', { description: 'Replace only the first occurrence of old_text within the anchored line' }),
        Type.Literal('all', { description: 'Replace all occurrences of old_text within the anchored line' }),
      ], { description: 'When old_text is provided, how many occurrences to replace (default: "first")' })
    ),
    dry_run: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Show diff only, do not apply' }),
        Type.String({ description: 'Show diff only, do not apply' }),
      ], { description: 'If true, compute and show the diff without writing to disk' })
    ),
    verify_hash: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Verify file has not changed since last read' }),
        Type.String({ description: 'Verify file has not changed since last read' }),
      ], { description: 'If true, verify linehash anchors match a prior read before editing' })
    ),
    all_occurrences: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Replace all occurrences of old_text' }),
        Type.String({ description: 'Replace all occurrences of old_text' }),
      ], { description: 'If true, replace all occurrences instead of just the first' })
    ),
    display: Type.Optional(
      Type.Union([
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines (default)' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + diff sections' }),
      ], { description: 'Display mode for visible output: compact (default), table, or full' })
    ),
  });

  pi.registerTool({
    name: 'edit',
    label: 'Edit',
    description:
      'Make surgical replacements in existing files. '
      + 'Finds exact text and replaces it. Returns structured diff and line anchors. '
      + 'Supports dry_run (preview only) and verify_hash (stale-context detection).',
    promptSnippet: 'Edit file contents with surgical replacements',
    promptGuidelines: [
      'Use edit for precise changes (old_text must match exactly).',
      'Use dry_run: true to preview changes before applying.',
      'Use verify_hash: true to ensure file has not changed since last read.',
      'Use all_occurrences: true to replace every instance of old_text.',
      'Use anchor-targeted mode for linehash-safe replacements when available.',
    ],
    parameters: editSchema,
    async execute(_toolCallId, params: EditToolParams, _signal, _onUpdate, ctx) {
      const requestedPath = params.path.startsWith('@') ? params.path.slice(1) : params.path;
      const absolutePath = resolve(ctx.cwd, requestedPath);
      const dryRun = params.dry_run === true || params.dry_run === 'true';
      const verifyHash = params.verify_hash === true || params.verify_hash === 'true';
      const allOccurrences = params.all_occurrences === true || params.all_occurrences === 'true';
      const mode = (params.mode ?? 'replace') as 'replace' | 'replace_by_anchor';
      const occurrence = (params.occurrence ?? 'first') as 'first' | 'all';
      const anchor = params.anchor ?? null;

      // Validate file exists
      if (!existsSync(absolutePath)) {
        return {
          content: [{ type: 'text', text: error('not-found', `File not found: ${absolutePath}`, { tool: 'edit', path: absolutePath }).message }],
          isError: true,
          details: { errorType: 'not-found', path: absolutePath },
        };
      }

      // Validate file is not a directory
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

      // Step 1: Read file content
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

      // Step 2: Get before-state anchors via linehash
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

      // Step 3: Handle replace_by_anchor mode
      if (mode === 'replace_by_anchor') {
        const display = (params.display ?? 'compact') as DisplayMode;
        return executeReplaceByAnchor(
          absolutePath,
          anchor,
          params.old_text ?? null,
          params.new_text,
          occurrence,
          dryRun,
          beforeParsed.records,
          beforeAnchors,
          oldContent,
          display,
        );
      }

      // Step 4: Verify hash if requested (only for replace mode)
      if (verifyHash && options.priorAnchors) {
        const currentAnchors = new Map(beforeParsed.records.map(r => [r.anchor, r.line]));
        let mismatchCount = 0;
        for (const [anchor, line] of options.priorAnchors) {
          const currentLine = currentAnchors.get(anchor);
          if (currentLine !== line) {
            mismatchCount++;
          }
        }
        if (mismatchCount > 0) {
          return {
            content: [{
              type: 'text',
              text: error('invalid-params',
                `File changed since last read: ${mismatchCount}/${options.priorAnchors.size} anchors mismatched. `
                + 'Read the file again before editing.',
                { tool: 'edit', path: absolutePath }
              ).message,
            }],
            isError: true,
            details: { errorType: 'invalid-params', path: absolutePath, mismatchedAnchors: mismatchCount },
          };
        }
      }

      // Step 5: Find and replace old_text with new_text (replace mode)
      // In replace mode, old_text is required
      if (!params.old_text) {
        return {
          content: [{
            type: 'text',
            text: error('invalid-params', `old_text is required in "replace" mode`, { tool: 'edit', path: absolutePath }).message,
          }],
          isError: true,
          details: {
            errorType: 'invalid-params',
            path: absolutePath,
            mode: 'replace',
            beforeAnchors,
          },
        };
      }
      const oldText = params.old_text;
      const newText = params.new_text;
      let newContent = oldContent;
      let unchanged = false;

      if (allOccurrences) {
        const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        if (regex.test(oldContent)) {
          newContent = oldContent.replace(regex, newText);
        } else {
          unchanged = true;
        }
      } else {
        const idx = oldContent.indexOf(oldText);
        if (idx === -1) {
          unchanged = true;
        } else {
          newContent = oldContent.slice(0, idx) + newText + oldContent.slice(idx + oldText.length);
        }
      }

      // Step 6: Compute diff
      const diffText = computeDiff(oldContent, newContent);
      const linesChanged = unchanged ? 0 : countLines(diffText.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'));

      // Step 7: Try delta rendering (display only, details keep plain diff)
      const deltaOutput = runDelta(diffText);
      const backendLabel = deltaOutput ? 'linehash+delta+nu' : 'linehash+nu';

      // Step 8: Build user-facing text output (Phase 21: display-aware)
      const display = (params.display ?? 'compact') as DisplayMode;
      const linesRemoved = diffText.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length;
      const linesAdded = diffText.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const editCompactResult = {
        applied: !dryRun && !unchanged,
        linesChanged,
        unchanged,
        beforeAnchors,
        afterAnchors: null,
      };
      let userText: string;

      if (display === 'compact' || display === 'auto') {
        userText = formatEditCompact(editCompactResult);
      } else {
        // Table/Full: rich content only (diff if available)
        if (!unchanged && diffText) {
          userText = diffText;
        } else {
          userText = formatEditCompact(editCompactResult);
        }
      }

      // Stable machine details (contract)
      const details: Record<string, unknown> = {
        path: absolutePath,
        applied: !dryRun && !unchanged,
        dry_run: dryRun,
        unchanged,
        linesChanged,
        diff: diffText,
        beforeAnchors,
        afterAnchors: null as Array<{ line: number; anchor: string }> | null,
        source: 'linehash',
        backend: backendLabel,
        mode,
      };

      if (dryRun || unchanged) {
        return {
          content: [{ type: 'text', text: userText }],
          details,
        };
      }

      // Step 9: Write new content
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

      // Step 10: Re-read for after-state anchors
      let afterResult: { stdout: string; stderr: string; exitCode: number };
      try {
        afterResult = await linehashRead(absolutePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        details.warning = `linehash post-edit failed: ${msg}`;
        return {
          content: [{ type: 'text', text: userText + `\n\n⚠ linehash post-edit failed: ${msg}` }],
          details,
        };
      }

      const afterParsed = parseLineHash(afterResult.stdout);
      details.afterAnchors = afterParsed.records.map(r => ({ line: r.line, anchor: r.anchor }));

      return {
        content: [{ type: 'text', text: userText }],
        details,
      };
    },
    renderResult(result, { expanded }, theme, _context) {
      const details = result as { details?: { applied?: boolean; dry_run?: boolean; linesChanged?: number; diff?: string | null; beforeAnchors?: Array<{ line: number; anchor: string }>; afterAnchors?: Array<{ line: number; anchor: string }> } };
      const d = details.details ?? {};

      let text: string;
      if (expanded) {
        // Expanded mode: rich content only (diff if available)
        if (d.diff) {
          text = formatDiffForTui(d.diff, theme as { fg: (color: unknown, text: string) => string });
        } else {
          const statusLine = d.dry_run
            ? 'Dry run'
            : d.applied
              ? 'Applied'
              : 'No change';
          text = `${statusLine} — ${d.linesChanged ?? 0} line(s) changed`;
          if (d.afterAnchors) {
            const before = d.beforeAnchors;
            const changed = d.afterAnchors.filter((a, i) => {
              return before && before[i] && before[i].anchor !== a.anchor;
            });
            if (changed.length > 0) {
              text += `\nChanged anchors: ${changed.length}`;
            }
          }
        }
      } else {
        // Collapsed mode: compact summary
        const applied = d.applied;
        const dryRun = d.dry_run;
        const unchanged = !applied && !dryRun;
        if (unchanged) {
          text = 'no changes — old_text not found';
        } else if (dryRun) {
          text = `dry_run — ${d.linesChanged ?? 0} line(s) would change`;
        } else {
          text = `edited — ${d.linesChanged ?? 0} line(s) changed`;
        }
      }
      return new Text(text, 0, 0);
    },

    });
}
