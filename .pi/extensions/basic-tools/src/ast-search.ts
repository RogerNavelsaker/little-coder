/**
 * `ast_search` tool — Syntax-aware code search backed by ast-grep.
 *
 * Wraps `ast-grep --pattern <pattern> --json` for AST-level code search.
 * Returns structured matches with ranges, metavariables, and linehash anchors.
 * No fallback to grep — returns binary-failed error if ast-grep is missing.
 *
 * Phase 20: Context guards — visible match budget and truncation metadata.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';
import { encodeToon, type ToonMode } from './toon.js';
import { parseLineHash, type LineHashRecord } from './linehash.js';
import { error } from './output.js';
import { loadSettings } from './settings.js';
import { type DisplayMode, formatAstSearchCompact } from './display.js';

/** Resolve ast-grep binary path. */
function resolveAstGrepBin(): string {
  if (process.env.AST_GREP_BIN) return process.env.AST_GREP_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which ast-grep 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'ast-grep';
}

function getAstGrepBin(): string {
  return resolveAstGrepBin();
}

/** Resolve linehash binary path. */
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
    if (existsSync(f)) return f;
  }
  return 'linehash';
}

const LINEHASH_BIN = resolveLinehashBin();

function resolveEzaBin(): string {
  if (process.env.EZA_BIN) return process.env.EZA_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which eza 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'eza';
}

const EZA_BIN = resolveEzaBin();

export interface AstSearchParams {
  pattern: string;
  path?: string;
  language?: string;
  glob?: string;
  limit?: number | string;
  mode?: ToonMode;
  display?: DisplayMode;
}

export interface AstRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
  byteOffset?: { start: number; end: number };
}

export interface MetaVariableInfo {
  text: string;
  range: AstRange;
}

export interface MetaVariables {
  single: Record<string, MetaVariableInfo>;
  multi: Record<string, MetaVariableInfo[]>;
  transformed: Record<string, unknown>;
}

export interface AstMatch {
  file: string;
  text: string;
  language: string;
  range: AstRange;
  metaVariables: MetaVariables;
  anchor: string | null;
  anchor_error: string | null;
}

export interface AstSearchResult {
  query: string;
  cwd: string;
  path: string;
  language: string | null;
  glob: string | null;
  backend: 'ast-grep+nu';
  command: string[];
  matches: AstMatch[];
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  visibleBudget: number;
  recoveryHint: string;
  settingsWarning?: string;
}

/**
 * Execute ast-grep with --json output.
 */
function runAstGrep(
  binPath: string,
  pattern: string,
  searchPath: string,
  options: {
    language?: string;
    glob?: string;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['run', '--pattern', pattern, '--json', searchPath];
    if (options.language) args.splice(args.length - 1, 0, '--lang', options.language);
    if (options.glob) args.splice(args.length - 1, 0, '--globs', options.glob);

    const proc = spawn(binPath, args, {
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
 * Parse ast-grep --json output into structured matches.
 */
function parseAstGrepOutput(json: string): AstMatch[] {
  const matches: AstMatch[] = [];
  if (!json.trim()) return matches;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return matches;
  }

  const results = Array.isArray(parsed) ? parsed : [parsed];

  for (const entry of results) {
    const e = entry as Record<string, unknown>;
    const range = e.range as Record<string, unknown> | undefined;
    const start = range?.start as Record<string, unknown> | undefined;
    const end = range?.end as Record<string, unknown> | undefined;
    const byteOffset = range?.byteOffset as Record<string, unknown> | undefined;
    const metaVariables = e.metaVariables as Record<string, unknown> | undefined;

    const match: AstMatch = {
      file: (e.file as string) ?? '',
      text: (e.text as string) ?? '',
      language: (e.language as string) ?? '',
      range: {
        start: {
          line: (start?.line as number) ?? 0,
          column: (start?.column as number) ?? 0,
        },
        end: {
          line: (end?.line as number) ?? 0,
          column: (end?.column as number) ?? 0,
        },
      },
      metaVariables: {
        single: (metaVariables?.single as Record<string, MetaVariableInfo>) ?? {},
        multi: (metaVariables?.multi as Record<string, MetaVariableInfo[]>) ?? {},
        transformed: (metaVariables?.transformed as Record<string, unknown>) ?? {},
      },
      anchor: null,
      anchor_error: null,
    };

    if (byteOffset) {
      match.range.byteOffset = {
        start: (byteOffset.start as number) ?? 0,
        end: (byteOffset.end as number) ?? 0,
      };
    }

    matches.push(match);
  }

  return matches;
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
  } catch {
    // Return empty map — caller will set anchor_error
  }

  return result;
}

/**
 * Register the ast_search tool with pi.
 */
export function registerAstSearchTool(pi: ExtensionAPI) {
  const schema = Type.Object({
    pattern: Type.String({ description: 'AST pattern to search for (e.g., console.log($A))' }),
    path: Type.Optional(
      Type.String({ description: 'File or directory to search (defaults to cwd)' })
    ),
    language: Type.Optional(
      Type.String({ description: 'Language to parse (e.g., typescript, javascript, rust)' })
    ),
    glob: Type.Optional(
      Type.String({ description: 'Glob pattern to filter files (e.g., "*.ts")' })
    ),
    limit: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Maximum number of matches to return' }),
        Type.String({ description: 'Maximum number of matches to return' }),
      ], { description: 'Limit the number of matches returned' })
    ),

    display: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto: compact by default, fuller when expanded (default)' }),
        Type.Literal('compact', { description: 'Compact: match count + pattern' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + full match table' }),
      ], { description: 'Display mode: auto (default), compact, table, or full' })
    ),
  });

  pi.registerTool({
    name: 'ast_search',
    label: 'AST Search',
    description:
      'Syntax-aware code search using AST patterns. '
      + 'Searches code structure instead of plain text, enabling queries about imports, '
      + 'calls, function shapes, and object patterns. Returns structured '
      + 'matches with ranges, metavariables, and line anchors. '
      + 'Returns error if the AST backend is unavailable.',
    promptSnippet: 'ast_search(pattern: "console.log($A)")',
    promptGuidelines: [
      'Use ast_search for syntax-aware code searches that need AST context.',
      'Use metavariables like $A, $B to match variable parts of patterns.',
      'Specify language for precise parsing (typescript, javascript, rust, etc.).',
      'Use glob to restrict search to specific file patterns.',
      'Use limit to cap the number of results.',
      'Use returned line anchors when a match will be edited.',
      'Large result sets are bounded; use narrowing hints to focus.',
    ],
    parameters: schema,
    async execute(_toolCallId, params: AstSearchParams, _signal, _onUpdate, ctx) {
      const pattern = params.pattern;
      const searchPath = params.path
        ? resolve(ctx.cwd, params.path.startsWith('@') ? params.path.slice(1) : params.path)
        : ctx.cwd;
      const language = params.language || null;
      const glob = params.glob || null;
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
      const mode = (params.mode ?? 'toon') as ToonMode;

      // Load settings
      const { settings, warnings } = loadSettings(ctx.cwd);
      const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;

      // Phase 20: Visible match budget
      const maxMatches = settings.astSearchMaxMatches;
      const effectiveLimit = limit !== undefined ? Math.min(limit, maxMatches) : maxMatches;

      // Validate search path
      if (!existsSync(searchPath)) {
        return {
          content: [{ type: 'text', text: error('not-found', `Path not found: ${searchPath}`, { tool: 'ast_search', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'not-found', path: searchPath },
        };
      }

      // Resolve binary path (dynamic for test injection)
      const binPath = getAstGrepBin();

      // Check ast-grep binary availability
      const whichResult = spawnSync('which', [binPath], {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout: 5000,
      });
      if (whichResult.status !== 0) {
        return {
          content: [{ type: 'text', text: error('binary-failed', 'ast-grep is not installed or not in PATH', { tool: 'ast_search' }).message }],
          isError: true,
          details: { errorType: 'binary-failed' },
        };
      }

      // Execute ast-grep
      let agResult: { stdout: string; stderr: string; exitCode: number };
      try {
        agResult = await runAstGrep(binPath, pattern, searchPath, { language: language || undefined, glob: glob || undefined });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: error('binary-failed', `ast-grep execution failed: ${msg}`, { tool: 'ast_search', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, stderr: msg },
        };
      }

      if (agResult.exitCode > 1) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `ast-grep exited ${agResult.exitCode}: ${agResult.stderr.trim()}`, { tool: 'ast_search', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode: agResult.exitCode, stderr: agResult.stderr.trim() },
        };
      }

      // Parse ast-grep output
      const allMatches = parseAstGrepOutput(agResult.stdout);

      // Apply global limit in JS (capped by visible budget)
      const totalMatches = allMatches.length;
      const returnedMatches = Math.min(totalMatches, effectiveLimit);
      const truncated = totalMatches > effectiveLimit;
      const agMatches = allMatches.slice(0, returnedMatches);

      // Group returned matches by file and get anchors for matched lines
      const matchesByFile = new Map<string, AstMatch[]>();
      const fileLines = new Map<string, Set<number>>();

      for (const m of agMatches) {
        if (!matchesByFile.has(m.file)) {
          matchesByFile.set(m.file, []);
          fileLines.set(m.file, new Set());
        }
        matchesByFile.get(m.file)!.push(m);
        fileLines.get(m.file)!.add(m.range.start.line);
      }

      // Get anchors for matched lines
      const fileAnchors = new Map<string, Map<number, string>>();
      for (const [filePath, lineSet] of fileLines) {
        fileAnchors.set(filePath, await getAnchorsForLines(filePath, lineSet));
      }

      // Enrich returned matches with anchors
      for (const m of agMatches) {
        const anchors = fileAnchors.get(m.file);
        if (anchors) {
          const anchor = anchors.get(m.range.start.line);
          if (anchor !== undefined) {
            m.anchor = anchor;
          } else {
            m.anchor_error = `linehash did not return anchor for line ${m.range.start.line}`;
          }
        } else {
          m.anchor_error = 'linehash failed for this file';
        }
      }

      // Add recovery hint
      const recoveryHint = totalMatches > effectiveLimit
        ? `Narrow the search: specify a subdirectory, use a more specific pattern, or restrict with glob/language.`
        : '';

      const recoveryHintText = totalMatches > effectiveLimit
        ? `Narrow the search: specify a subdirectory, use a more specific pattern, or restrict with glob/language.`
        : '';

      // --- LLM-facing JSON/TOON in details ---
      const llmResult: AstSearchResult = {
        query: pattern,
        cwd: ctx.cwd,
        path: searchPath,
        language,
        glob,
        backend: 'ast-grep+nu',
        command: [
          binPath,
          'run',
          '--pattern',
          pattern,
          ...(language ? ['--lang', language] : []),
          ...(glob ? ['--globs', glob] : []),
          '--json',
          searchPath,
        ],
        matches: agMatches.map(m => ({
          file: m.file,
          text: m.text,
          language: m.language,
          range: m.range,
          metaVariables: m.metaVariables,
          anchor: m.anchor,
          anchor_error: m.anchor_error,
        })),
        totalMatches,
        returnedMatches,
        truncated,
        visibleBudget: settings.astSearchMaxMatches,
        recoveryHint,
        ...(settingsWarning ? { settingsWarning } : {}),
      };
      // --- content.text: matches JSON → TOON ---
      const contentMatches = agMatches.map(m => ({ file: m.file, line: m.range?.start?.line ?? null, text: m.text, anchor: m.anchor ?? null }));
      const contentToon = encodeToon({ ast_search: { [pattern]: contentMatches } });

      return {
        content: [{ type: 'text', text: contentToon.text }],
        details: {
          query: pattern,
          cwd: ctx.cwd,
          path: searchPath,
          language,
          glob,
          totalMatches,
          returnedMatches,
          truncated,
          matches: contentMatches,
        },
      };
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0);

      const details = (result as {
        details?: {
          totalMatches?: number;
          returnedMatches?: number;
          truncated?: boolean;
          query?: string;
          matches?: Array<{ file: string; text: string; line?: number | null }>;
        };
      }).details;
      const totalMatches = details?.totalMatches ?? 0;
      const returnedMatches = details?.returnedMatches ?? 0;
      const truncated = details?.truncated ?? false;
      const query = details?.query ?? '';

      if (expanded && details?.matches && details.matches.length > 0) {
        // File list with per-file match counts via eza, up to 20 files
        const byFile = new Map<string, number>();
        for (const m of (details.matches ?? [])) {
          byFile.set(m.file, (byFile.get(m.file) ?? 0) + 1);
        }
        const allEntries = [...byFile.entries()];
        const paths = allEntries.map(([p]) => p);
        const footer = truncated ? `\n${theme.fg('muted', `… ${totalMatches - returnedMatches} more matches`)}` : '';
        try {
          const r = spawnSync(EZA_BIN, [
            '--color=always', '--icons', '--oneline', '--group-directories-first',
            ...paths,
          ], { encoding: 'utf-8', timeout: 5000 });
          if (r.status === 0 && r.stdout) {
            const ezaLines = r.stdout.trimEnd().split('\n');
            const annotated = ezaLines.map((line, i) => {
              const entry = allEntries[i];
              if (!entry) return line;
              const matchWord = entry[1] === 1 ? 'match' : 'matches';
              return `${line} ${theme.fg('dim', `(${entry[1]} ${matchWord})`)}`;
            });
            return new Text(annotated.join('\n') + footer, 1, 0);
          }
        } catch { /* fall through */ }
        // Fallback: plain path list with match counts
        const lines = allEntries.map(([filePath, count]) => {
          const name = filePath.split('/').pop() ?? filePath;
          const dir = filePath.slice(0, filePath.length - name.length);
          const matchWord = count === 1 ? 'match' : 'matches';
          return `  ${theme.fg('dim', dir)}${theme.fg('accent', name)} ${theme.fg('dim', `(${count} ${matchWord})`)}`;
        });
        return new Text(lines.join('\n') + footer, 1, 0);
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
