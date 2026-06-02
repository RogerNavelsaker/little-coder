/**
 * `grep` tool — ripgrep-backed search with structured output.
 *
 * Wraps `rg --json` for regex/literal search, adds linehash anchors
 * for matched lines, returns compact table for user + JSON/TOON for LLM.
 *
 * Phase 20: Context guards — default excludes, visible budgets,
 * truncation metadata, and recovery hints.
 */
import { Type } from '@sinclair/typebox';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';
import { encodeToon, type ToonMode } from './toon.js';
import { parseLineHash, type LineHashRecord } from './linehash.js';
import { error } from './output.js';
import { loadSettings, type Settings } from './settings.js';
import { type DisplayMode, formatGrepCompact, makeThrottle, batContextHighlight } from './display.js';
import type { ChildProcess } from 'child_process';

/** Resolve rg binary path. */
function resolveRgBin(): string {
  if (process.env.RG_BIN) return process.env.RG_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which rg 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'rg';
}

const RG_BIN = resolveRgBin();

export interface GrepToolParams {
  pattern: string;
  path?: string;
  literal?: boolean | string;
  ignore_case?: boolean | string;
  limit?: number | string;
  mode?: ToonMode;
  /** When true, include files that match default exclude patterns */
  include_excluded?: boolean | string;
  display?: DisplayMode;
  /** Number of context lines to include on each side (rg -B N -A N) */
  context?: number | string;
  /** Glob pattern to scope search (rg --glob <pattern>) */
  glob?: string;
}

export interface GrepMatch {
  path: string;
  line: number;
  column: number;
  text: string;
  submatches: Array<{ text: string; start: number; end: number }>;
  anchor: string | null;
  anchor_error: string | null;
  context_before?: string[];
  context_after?: string[];
}


/**
 * Stream rg --json output: call onMatch for each newline-delimited JSON line.
 * Returns { proc, kill } so the caller can abort when the limit is reached.
 */
function runRgStream(
  pattern: string,
  searchPath: string,
  options: { literal?: boolean; ignoreCase?: boolean; excludes?: string[]; context?: number; glob?: string },
  onMatch: (line: string) => void,
): { proc: ChildProcess; kill: () => void } {
  const args = ['--json', '--no-filename', '--line-number', pattern, searchPath];
  if (options.literal) args.unshift('-F');
  if (options.ignoreCase) args.push('-i');
  if (options.context) {
    args.push('-B', String(options.context), '-A', String(options.context));
  }
  if (options.glob) {
    args.push('--glob', options.glob);
  }
  if (options.excludes) {
    for (const ex of options.excludes) {
      args.push('--glob', `!${ex}`);
    }
  }

  const proc = spawn(RG_BIN, args, {
    cwd: process.cwd(),
    env: { ...process.env },
  });

  let buffer = '';
  let stderr = '';

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim()) onMatch(line);
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

  return { proc, kill: () => proc.kill() };
}

/**
 * Parse a single rg --json match line into a GrepMatch.
 */
function parseRgMatchLine(line: string): GrepMatch | null {
  let parsed: { type: string; data: unknown };
  try {
    parsed = JSON.parse(line);
  } catch { return null; }

  if (parsed.type !== 'match') return null;

  const data = (parsed.data as {
    path?: { text?: string };
    line_number?: number;
    submatches?: Array<{ match?: { text?: string; start?: number; end?: number } }>;
    lines?: { text?: string };
  });

  const match: GrepMatch = {
    path: data.path?.text ?? '',
    line: data.line_number ?? 0,
    column: 0,
    text: data.lines?.text?.trim() ?? '',
    submatches: (data.submatches ?? []).map(s => ({
      text: s.match?.text ?? '',
      start: s.match?.start ?? 0,
      end: s.match?.end ?? 0,
    })),
    anchor: null,
    anchor_error: null,
  };

  if (match.submatches.length > 0) {
    match.column = match.submatches[0].start;
  }

  return match;
}

/**
 * Get linehash anchors for specific lines in a file.
 */
async function getAnchorsForLines(
  filePath: string,
  lineNumbers: Set<number>
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (lineNumbers.size === 0) return result;
  const maxLine = Math.max(...lineNumbers);
  if (maxLine <= 0) return result;

  try {
    const { spawn: sp } = require('child_process');
    const lhProc = sp(LINEHASH_BIN, ['read', filePath, '--limit', String(maxLine)], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let lhStdout = '';
    lhProc.stdout.on('data', (chunk: Buffer) => { lhStdout += chunk.toString(); });
    await new Promise<void>((resolve) => {
      lhProc.on('close', () => resolve());
    });

    const parsed = parseLineHash(lhStdout);
    for (const rec of parsed.records) {
      if (lineNumbers.has(rec.line)) {
        result.set(rec.line, rec.anchor);
      }
    }
  } catch (err) {
    // Return empty map — caller will set anchor_error
  }

  return result;
}

// Resolve linehash binary (same as read.ts)
function resolveLinehashBin(): string {
  if (process.env.LINEHASH_BIN) return process.env.LINEHASH_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which linehash 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  const fallbacks = [
    '/home/rona/.flox/run/x86_64-linux.default.run/bin/linehash',
    '/home/rona/.flox/run/bin/linehash',
    '/run/current-system/sw/bin/linehash',
  ];
  for (const f of fallbacks) {
    if (require('fs').existsSync(f)) return f;
  }
  return 'linehash';
}

const LINEHASH_BIN = resolveLinehashBin();

/**
 * Build a narrowing hint for truncated grep results.
 */

/**
 * Register the grep tool with pi.
 */
export function registerGrepTool(pi: ExtensionAPI) {
  const grepSchema = Type.Object({
    pattern: Type.String({ description: 'Search pattern (regex or literal)' }),
    path: Type.Optional(Type.String({ description: 'File or directory to search (defaults to cwd)' })),
    literal: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Treat pattern as literal string (not regex)' }),
        Type.String({ description: 'Treat pattern as literal string (not regex)' }),
      ], { description: 'If true, use rg -F for literal matching' })
    ),
    ignore_case: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Case-insensitive search' }),
        Type.String({ description: 'Case-insensitive search' }),
      ], { description: 'If true, use rg -i for case-insensitive matching' })
    ),
    limit: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Maximum number of matches to return' }),
        Type.String({ description: 'Maximum number of matches to return' }),
      ], { description: 'Limit the number of matches returned' })
    ),
    context: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Number of context lines before and after each match (rg -B N -A N)' }),
        Type.String({ description: 'Number of context lines before and after each match (rg -B N -A N)' }),
      ], { description: 'Show surrounding context lines' })
    ),
    glob: Type.Optional(
      Type.String({ description: 'Glob pattern to scope search (rg --glob <pattern>)' })
    ),

    display: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto: compact by default, fuller when expanded (default)' }),
        Type.Literal('compact', { description: 'Compact: match count + pattern' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + anchored match rows' }),
      ], { description: 'Display mode: auto (default), compact, table, or full' })
    ),
  });

  pi.registerTool({
    name: 'grep',
    label: 'Grep',
    description:
      'Search text and regex patterns across files. '
      + 'Returns structured matches with line anchors for follow-up edits. '
      + 'Supports regex (default) and literal mode, case-insensitive search, '
      + 'and result limiting. Applies default excludes unless include_excluded: true.',
    promptSnippet: 'Search text and regex patterns across files',
    promptGuidelines: [
      'Use grep for text and regex search across files.',
      'Use literal: true for exact string matching (no regex).',
      'Use ignore_case: true for case-insensitive search.',
      'Use limit to cap the number of results.',
      'Use context: N to show N lines of surrounding context (rg -B N -A N).',
      'Use glob: "*.ext" to scope search to specific file patterns.',
      'Use returned line anchors when a match will be edited.',
      'Use include_excluded: true only when you need to search excluded directories.',
      'For broad searches (e.g. ~/.pi/agent), use a targeted path or limit to avoid overflow.',
    ],
    parameters: grepSchema,
    async execute(_toolCallId, params: GrepToolParams, _signal, _onUpdate, ctx) {
      const pattern = params.pattern;
      const searchPath = params.path ? resolve(ctx.cwd, params.path.startsWith('@') ? params.path.slice(1) : params.path) : ctx.cwd;
      const literal = params.literal === true || params.literal === 'true';
      const ignoreCase = params.ignore_case === true || params.ignore_case === 'true';
      const includeExcluded = params.include_excluded === true || params.include_excluded === 'true';
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
      const context = typeof params.context === 'string' ? parseInt(params.context, 10) : params.context;
      const glob = params.glob;
      const mode = (params.mode ?? 'toon') as ToonMode;

      // Load settings
      const { settings, warnings } = loadSettings(ctx.cwd);
      const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;

      // Apply default excludes unless include_excluded is true
      const excludes = includeExcluded ? [] : settings.defaultExcludes;

      // Validate search path
      if (!existsSync(searchPath)) {
        return {
          content: [{ type: 'text', text: error('not-found', `Path not found: ${searchPath}`, { tool: 'grep', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'not-found', path: searchPath },
        };
      }

      // Stream rg output with throttled onUpdate
      const throttle = makeThrottle(500);
      const matches: GrepMatch[] = [];
      const searchedPathsSet = new Set<string>();
      let killedEarly = false;
      let rgStderr = '';
      let pendingContextBefore: string[] | undefined;

      const { proc, kill } = runRgStream(pattern, searchPath, { literal, ignoreCase, excludes, context, glob }, (line) => {
        let parsed: { type: string; data: unknown };
        try {
          parsed = JSON.parse(line);
        } catch { return; }

        if (parsed.type === 'begin') {
          const path = (parsed.data as { path?: { text?: string } }).path?.text;
          if (path) searchedPathsSet.add(path);
        } else if (parsed.type === 'match') {
          const m = parseRgMatchLine(line);
          if (m) {
            // Attach pending context_before from preceding context lines
            if (pendingContextBefore) {
              m.context_before = pendingContextBefore;
              pendingContextBefore = undefined;
            }
            matches.push(m);

            // Kill when limit reached
            if (limit !== undefined && matches.length >= limit) {
              killedEarly = true;
              kill();
            }

            // Throttled progress update
            throttle(() => {
              _onUpdate?.({
                content: [],
                details: { totalMatches: matches.length, truncated: false },
              });
            });
          }
        } else if (parsed.type === 'context') {
          const data = (parsed.data as {
            path?: { text?: string };
            line_number?: number;
            lines?: { text?: string };
          });
          const ctxLine = data.lines?.text;
          if (ctxLine !== undefined) {
            const last = matches[matches.length - 1];
            if (last) {
              // context_after → previous match
              if (!last.context_after) last.context_after = [];
              last.context_after.push(ctxLine);
            } else {
              // context_before → pending for next match
              if (!pendingContextBefore) pendingContextBefore = [];
              pendingContextBefore.push(ctxLine);
            }
          }
        }
      });

      // Wait for process to close
      const { exitCode, stderr } = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
        proc.on('close', (code) => resolve({ exitCode: code ?? 1, stderr: '' }));
        proc.on('error', () => resolve({ exitCode: 1, stderr: 'process error' }));
      });
      rgStderr = stderr;

      if (exitCode > 1) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `rg exited ${exitCode}: ${rgStderr.trim()}`, { tool: 'grep', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode, stderr: rgStderr.trim() },
        };
      }

      const totalMatches = matches.length;
      const returnedMatches = limit !== undefined ? Math.min(totalMatches, limit) : totalMatches;
      const truncated = killedEarly || (limit !== undefined && totalMatches > limit);
      const displayedMatches = truncated ? matches.slice(0, limit) : matches;

      // Enrich displayed matches with anchors (batch on final set)
      const matchesByFile = new Map<string, GrepMatch[]>();
      const fileLines = new Map<string, Set<number>>();

      for (const m of displayedMatches) {
        if (!matchesByFile.has(m.path)) {
          matchesByFile.set(m.path, []);
          fileLines.set(m.path, new Set());
        }
        matchesByFile.get(m.path)!.push(m);
        fileLines.get(m.path)!.add(m.line);
      }

      const fileAnchors = new Map<string, Map<number, string>>();
      for (const [filePath, lineSet] of fileLines) {
        fileAnchors.set(filePath, await getAnchorsForLines(filePath, lineSet));
      }

      for (const m of displayedMatches) {
        const anchors = fileAnchors.get(m.path);
        if (anchors) {
          const anchor = anchors.get(m.line);
          if (anchor !== undefined) {
            m.anchor = anchor;
          } else {
            m.anchor_error = `linehash did not return anchor for line ${m.line}`;
          }
        } else {
          m.anchor_error = 'linehash failed for this file';
        }
      }

      // --- content.text: matches JSON → TOON ---
      const contentMatches = displayedMatches.map(m => ({ path: m.path, line: m.line, text: m.text, anchor: m.anchor ?? null }));
      const contentToon = encodeToon({ grep: { [pattern]: contentMatches } });

      return {
        content: [{ type: 'text', text: contentToon.text }],
        details: {
          query: pattern,
          cwd: ctx.cwd,
          patternMode: literal ? 'literal' : 'regex',
          searchedPaths: [...searchedPathsSet],
          truncated,
          totalMatches,
          returnedMatches,
          matches: displayedMatches.map(m => ({ path: m.path, line: m.line, anchor: m.anchor ?? null, text: m.text, context_before: m.context_before ?? null, context_after: m.context_after ?? null })),
          context,
          ...(settingsWarning ? { settingsWarning } : {}),
        },
      };
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0) as unknown as Component;

      const details = result as {
        details?: {
          totalMatches?: number;
          returnedMatches?: number;
          truncated?: boolean;
          query?: string;
          patternMode?: string;
          context?: number;
          matches?: Array<{ line: number; anchor: string; path: string; text: string }>;
        };
      };
      const totalMatches = details.details?.totalMatches ?? 0;
      const returnedMatches = details.details?.returnedMatches ?? 0;
      const truncated = details.details?.truncated ?? false;
      const query = details.details?.query ?? '';
      const ctxLines = details.details?.context ?? 1;

      if (expanded && details.details?.matches && details.details.matches.length > 0) {
        // bat ±context per file, muted amber background on matched text only
        const patternMode = details.details?.patternMode ?? 'regex';
        let highlightRe: RegExp | null = null;
        try {
          const src = patternMode === 'literal'
            ? query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : query;
          highlightRe = new RegExp(src, 'g');
        } catch { /* invalid regex — no highlight */ }

        const byFile = new Map<string, number[]>();
        for (const m of details.details.matches) {
          if (!byFile.has(m.path)) byFile.set(m.path, []);
          byFile.get(m.path)!.push(m.line);
        }
        const blocks: string[] = [];
        for (const [filePath, lines] of byFile) {
          const block = batContextHighlight(filePath, lines, highlightRe, ctxLines);
          if (block) blocks.push(block);
        }
        if (truncated) blocks.push(theme.fg('muted', `… ${totalMatches - returnedMatches} more`));
        if (blocks.length > 0) return new Text(blocks.join('\n'), 1, 0);
      }

      // Collapsed: compact summary
      const countLabel = totalMatches === 0
        ? theme.fg('muted', '0 matches')
        : truncated
          ? theme.fg('success', `${returnedMatches} of ${totalMatches} matches`)
          : theme.fg('success', `${totalMatches} match${totalMatches !== 1 ? 'es' : ''}`);
      return new Text(`${countLabel} for "${query}"`, 0, 0);
    },
  });
}
