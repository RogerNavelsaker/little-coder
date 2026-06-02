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
import { encodeToon, type ToonMode } from '../../_shared/toon.js';
import { parseLineHash, type LineHashRecord } from '../../_shared/linehash.js';
import { error } from '../../_shared/output.js';
import { loadSettings, type Settings } from '../../_shared/settings.js';
import { type DisplayMode, formatGrepCompact, formatGrepTableMarkdown, renderMarkdown } from '../../_shared/display.js';

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
}

export interface GrepMatch {
  path: string;
  line: number;
  column: number;
  text: string;
  submatches: Array<{ text: string; start: number; end: number }>;
  anchor: string | null;
  anchor_error: string | null;
}

export interface GrepResult {
  query: string;
  cwd: string;
  mode: 'regex' | 'literal';
  matches: GrepMatch[];
  searchedPaths: string[];
  truncated: boolean;
  totalMatches: number;
  returnedMatches: number;
  patternMode?: 'regex' | 'literal';
  command: string[];
  backend: 'rg+nu';
  visibleBudget: { maxLines: number; maxBytes: number };
  visibleLines: number;
  visibleBytes: number;
  excludedPatterns: string[];
  recoveryHint: string;
  settingsWarning?: string;
}

/**
 * Execute rg with --json output.
 */
function runRg(
  pattern: string,
  searchPath: string,
  options: { literal?: boolean; ignoreCase?: boolean; excludes?: string[] }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = ['--json', '--no-filename', '--line-number', pattern, searchPath];
    if (options.literal) args.unshift('-F');
    if (options.ignoreCase) args.push('-i');
    if (options.excludes) {
      for (const ex of options.excludes) {
        args.push('--glob', `!${ex}`);
      }
    }

    const proc = spawn(RG_BIN, args, {
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
 * Parse rg --json output into structured matches.
 */
function parseRgOutput(jsonl: string): { matches: GrepMatch[]; searchedPaths: string[]; stats: Record<string, unknown> } {
  const lines = jsonl.split('\n').filter(l => l.trim() !== '');
  const matches: GrepMatch[] = [];
  const searchedPaths = new Set<string>();
  let stats: Record<string, unknown> = {};

  for (const line of lines) {
    let parsed: { type: string; data: unknown };
    try {
      parsed = JSON.parse(line);
    } catch { continue; }

    if (parsed.type === 'begin') {
      const path = (parsed.data as { path?: { text?: string } }).path?.text;
      if (path) searchedPaths.add(path);
    } else if (parsed.type === 'match') {
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
      // Compute column from first submatch start
      if (match.submatches.length > 0) {
        match.column = match.submatches[0].start;
      }
      matches.push(match);
    } else if (parsed.type === 'end') {
      stats = (parsed.data as { stats?: Record<string, unknown> })?.stats ?? stats;
    }
  }

  return { matches, searchedPaths: [...searchedPaths], stats };
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
function buildGrepRecoveryHint(
  searchPath: string,
  pattern: string,
  totalMatches: number,
  returnedMatches: number,
  truncated: boolean,
): string {
  const parts: string[] = [];
  if (truncated) {
    if (totalMatches > returnedMatches) {
      parts.push(`Limit: ${returnedMatches} matches returned out of ${totalMatches} total.`);
    }
    parts.push('Narrow the search: specify a subdirectory, use literal: true, or add a more specific pattern.');
  }
  return parts.join(' ');
}

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
    mode: Type.Optional(
      Type.Union([
        Type.Literal('toon', { description: 'TOON format for LLM' }),
        Type.Literal('json', { description: 'JSON format for LLM' }),
      ], { description: 'Output format for LLM (defaults to toon)' })
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

      // Execute rg with excludes
      let rgResult: { stdout: string; stderr: string; exitCode: number };
      try {
        rgResult = await runRg(pattern, searchPath, { literal, ignoreCase, excludes });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: error('binary-failed', `rg execution failed: ${msg}`, { tool: 'grep', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, stderr: msg },
        };
      }

      if (rgResult.exitCode > 1) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `rg exited ${rgResult.exitCode}: ${rgResult.stderr.trim()}`, { tool: 'grep', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode: rgResult.exitCode, stderr: rgResult.stderr.trim() },
        };
      }

      // Parse rg output
      const { matches: allMatches, searchedPaths, stats } = parseRgOutput(rgResult.stdout);

      // Apply global limit in JS (not via rg -n, which means "line number")
      const totalMatches = allMatches.length;
      const returnedMatches = limit !== undefined ? Math.min(totalMatches, limit) : totalMatches;
      const truncated = limit !== undefined && totalMatches > limit;
      const rgMatches = limit !== undefined ? allMatches.slice(0, limit) : allMatches;

      // Phase 20: Visible budgets — truncate content.text if it exceeds budget
      const maxLines = settings.grepMaxVisibleLines;
      const maxBytes = settings.grepMaxVisibleBytes;

      // Estimate content size
      let visibleLines = 0;
      let visibleBytes = 0;
      for (const m of rgMatches) {
        visibleLines++;
        visibleBytes += m.path.length + m.text.length + 20; // path:line:anchor|text
        if (visibleBytes > maxBytes * 2) break; // allow 2x headroom
      }

      // Determine if we need to truncate for budget
      const budgetTruncated = visibleBytes > maxBytes || visibleLines > maxLines;
      const effectiveTruncated = truncated || budgetTruncated;

      // If budget-truncated, limit displayed matches
      let displayedMatches = rgMatches;
      if (budgetTruncated && !truncated) {
        // Budget exceeded but no explicit limit — truncate to fit
        let linesCount = 0;
        let bytesCount = 0;
        for (let i = 0; i < rgMatches.length; i++) {
          linesCount++;
          bytesCount += rgMatches[i].path.length + rgMatches[i].text.length + 20;
          if (bytesCount > maxBytes) {
            displayedMatches = rgMatches.slice(0, i + 1);
            break;
          }
          if (i === rgMatches.length - 1) {
            displayedMatches = rgMatches;
          }
        }
      }

      // Build narrowing hint
      const recoveryHint = buildGrepRecoveryHint(searchPath, pattern, totalMatches, returnedMatches, effectiveTruncated);

      // Enrich displayed matches with anchors (only for returned matches)
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

      // Get anchors for matched lines
      const fileAnchors = new Map<string, Map<number, string>>();
      for (const [filePath, lineSet] of fileLines) {
        fileAnchors.set(filePath, await getAnchorsForLines(filePath, lineSet));
      }

      // Enrich displayed matches with anchors
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



      // --- User-facing text output (Phase 21: display-aware) ---
      // auto/compact both use compact for content.text; renderResult handles expansion
      const display = (params.display ?? 'auto') as DisplayMode;
      const modeLabel = literal ? 'literal' : 'regex';
      let userText: string;

      const grepCompactResult = {
        query: pattern,
        totalMatches,
        returnedMatches,
        truncated: effectiveTruncated,
        filesSearched: searchedPaths.length,
        mode: modeLabel,
        matches: displayedMatches.slice(0, settings.grepMaxVisibleLines),
      };

      if (display === 'compact' || display === 'auto') {
        userText = formatGrepCompact(grepCompactResult);
      } else if (display === 'table') {
        // Table: table-only (no compact summary)
        const tableLines: string[] = [];
        tableLines.push('| Path | Line | Anchor | Text |');
        tableLines.push('|------|------|--------|------|');
        for (const m of displayedMatches) {
          const anchorStr = m.anchor ?? '—';
          const escapedText = m.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
          tableLines.push(`| ${m.path} | ${m.line} | ${anchorStr} | ${escapedText} |`);
        }
        userText = tableLines.join('\n');
      } else {
        // Full: table-only (no compact summary) — expanded view should focus on table
        const tableLines: string[] = [];
        tableLines.push('| Path | Line | Anchor | Text |');
        tableLines.push('|------|------|--------|------|');
        for (const m of displayedMatches) {
          const anchorStr = m.anchor ?? '—';
          const escapedText = m.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
          tableLines.push(`| ${m.path} | ${m.line} | ${anchorStr} | ${escapedText} |`);
        }
        userText = tableLines.join('\n');
      }

      // --- LLM-facing JSON/TOON in details ---
      const llmResult: GrepResult = {
        query: pattern,
        cwd: ctx.cwd,
        mode: literal ? 'literal' : 'regex',
        patternMode: literal ? 'literal' : 'regex',
        matches: displayedMatches.map(m => ({
          path: m.path,
          line: m.line,
          column: m.column,
          text: m.text,
          submatches: m.submatches,
          anchor: m.anchor ?? null,
          anchor_error: m.anchor_error ?? null,
        })),
        searchedPaths,
        truncated: effectiveTruncated,
        totalMatches,
        returnedMatches,
        command: [RG_BIN, '--json', ...(literal ? ['-F'] : []), ...(ignoreCase ? ['-i'] : []), pattern, searchPath],
        backend: 'rg+nu',
        visibleBudget: { maxLines, maxBytes },
        visibleLines: displayedMatches.length,
        visibleBytes,
        excludedPatterns: excludes,
        recoveryHint,
        ...(settingsWarning ? { settingsWarning } : {}),
      };
      const llmEncoded = encodeToon(llmResult, { mode });

      return {
        content: [{ type: 'text', text: userText }],
        details: {
          ...llmResult,
          mode,
          tokenSavings: llmEncoded.tokenSavings,
          source: 'rg',
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
          matches?: Array<{ line: number; anchor: string; path: string; text: string }>;
        };
      };
      const totalMatches = details.details?.totalMatches ?? 0;
      const returnedMatches = details.details?.returnedMatches ?? 0;
      const truncated = details.details?.truncated ?? false;
      const query = details.details?.query ?? '';

      // Phase 21: expanded mode is table-only for all modes except compact
      const displayParam = (result as { params?: { display?: DisplayMode } }).params?.display;
      const isCompact = displayParam === 'compact';
      const showFull = expanded && !isCompact;

      let text: string;
      if (showFull && details.details?.matches) {
        // Expanded mode (auto/full/table): table-only, no redundant compact summary
        text = formatGrepTableMarkdown(details.details.matches);
      } else {
        // Collapsed or compact mode: compact summary
        text = `${totalMatches} match${totalMatches !== 1 ? 'es' : ''} for "${query}"`;
        if (truncated) text += ' (truncated)';
      }

      return renderMarkdown(text, theme as { fg: (color: unknown, text: string) => string; bold: (text: string) => string; italic: (text: string) => string; strikethrough: (text: string) => string; underline: (text: string) => string; }) as unknown as Component;
    },
  });
}
