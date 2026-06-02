/**
 * `find` tool — fd-backed file discovery with structured output.
 *
 * Wraps `fd --glob` for glob-first file/directory discovery, returns compact
 * list for user + JSON/TOON for LLM with path, type, size, and metadata.
 */
import { Type } from '@sinclair/typebox';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';
import { encodeToon, type ToonMode } from '../../_shared/toon.js';
import { error } from '../../_shared/output.js';
import { loadSettings, type Settings } from '../../_shared/settings.js';
import { type DisplayMode, formatFindCompact, formatFindTableMarkdown, renderMarkdown } from '../../_shared/display.js';

/** Resolve fd binary path. */
function resolveFdBin(): string {
  if (process.env.FD_BIN) return process.env.FD_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which fd 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'fd';
}

const FD_BIN = resolveFdBin();

export interface FindToolParams {
  pattern?: string;
  path?: string;
  type?: 'f' | 'd' | 'l' | 's' | 'x';
  hidden?: boolean | string;
  follow_symlinks?: boolean | string;
  exclude?: string | string[];
  max_depth?: number | string;
  limit?: number | string;
  mode?: ToonMode;
  display?: string;
}

export interface FindEntry {
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'socket' | 'pipe' | 'other';
  size?: number;
  depth: number;
}

export interface FindResult {
  query: string;
  cwd: string;
  pattern: string;
  patternMode: 'glob';
  type?: string;
  entries: FindEntry[];
  totalEntries: number;
  returnedEntries: number;
  truncated: boolean;
  command: string[];
  visibleBudget: number;
  excludedPatterns: string[];
  recoveryHint: string;
  settingsWarning?: string;
}

/**
 * Execute fd with structured output.
 */
function runFd(searchPath: string, options: {
  pattern?: string;
  type?: string;
  hidden?: boolean;
  followSymlinks?: boolean;
  exclude?: string[];
  maxDepth?: number;
  limit?: number;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['--print0', '--glob'];
    if (options.pattern) args.push(options.pattern);
    else args.push('*');
    if (options.type) args.push('-t', options.type);
    if (options.hidden) args.push('--hidden');
    if (options.followSymlinks) args.push('-L');
    if (options.exclude) {
      for (const ex of options.exclude) args.push('--exclude', ex);
    }
    if (options.maxDepth) args.push('--max-depth', String(options.maxDepth));
    if (options.limit !== undefined) args.push('--max-results', String(options.limit));

    args.push(searchPath);

    const proc = spawn(FD_BIN, args, {
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
 * Parse fd null-delimited output into structured entries.
 */
function parseFdOutput(stdout: string): FindEntry[] {
  const entries: FindEntry[] = [];
  if (!stdout.trim()) return entries;

  const paths = stdout.trim().split('\0').filter(p => p !== '');
  for (const rawPath of paths) {
    try {
      const stat = statSync(rawPath);
      let type: FindEntry['type'] = 'other';
      if (stat.isFile()) type = 'file';
      else if (stat.isDirectory()) type = 'directory';
      else if (stat.isSymbolicLink()) type = 'symlink';
      else if (stat.isSocket()) type = 'socket';
      else if (stat.isFIFO()) type = 'pipe';

      const depth = (rawPath.split('/').length - 1);

      entries.push({
        path: rawPath,
        type,
        size: stat.size,
        depth,
      });
    } catch {
      // If stat fails, still include the entry with minimal info
      entries.push({
        path: rawPath,
        type: 'other',
        depth: (rawPath.split('/').length - 1),
      });
    }
  }

  return entries;
}

/**
 * Register the find tool with pi.
 */
/**
 * Build a narrowing hint for truncated find results.
 */
function buildFindRecoveryHint(
  searchPath: string,
  pattern: string,
  totalEntries: number,
  returnedEntries: number,
  truncated: boolean,
): string {
  if (!truncated) return '';
  return `Narrow the search: specify a subdirectory, use a more specific glob pattern, or increase the limit.`;
}

export function registerFindTool(pi: ExtensionAPI) {
  const findSchema = Type.Object({
    pattern: Type.Optional(Type.String({ description: 'Glob pattern to match file names (e.g. "*.ts", "src/**")' })),
    patternMode: Type.Optional(Type.Literal('glob', { description: 'Pattern matching mode (always "glob" for fd)' })),
    path: Type.Optional(Type.String({ description: 'Root directory to search (defaults to cwd)' })),
    type: Type.Optional(Type.Union([
      Type.Literal('f', { description: 'Regular files only' }),
      Type.Literal('d', { description: 'Directories only' }),
      Type.Literal('l', { description: 'Symbolic links only' }),
      Type.Literal('s', { description: 'Sockets only' }),
      Type.Literal('x', { description: 'Executable files only' }),
    ], { description: 'Filter by entry type. Omit to return both files and directories.' })),
    hidden: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Include hidden files/directories' }),
      Type.String({ description: 'Include hidden files/directories' }),
    ], { description: 'Show hidden files (default: false)' })),
    follow_symlinks: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Follow symbolic links' }),
      Type.String({ description: 'Follow symbolic links' }),
    ], { description: 'Follow symlinks (default: false)' })),
    exclude: Type.Optional(Type.Union([
      Type.String({ description: 'Exclude pattern (can be repeated)' }),
    ], { description: 'Exclude files matching this glob pattern' })),
    max_depth: Type.Optional(Type.Union([
      Type.Number({ description: 'Maximum directory depth to descend' }),
      Type.String({ description: 'Maximum directory depth to descend' }),
    ], { description: 'Limit search depth' })),
    limit: Type.Optional(Type.Union([
      Type.Number({ description: 'Maximum number of results to return' }),
      Type.String({ description: 'Maximum number of results to return' }),
    ], { description: 'Limit the number of results' })),
    mode: Type.Optional(Type.Union([
      Type.Literal('toon', { description: 'TOON format for LLM' }),
      Type.Literal('json', { description: 'JSON format for LLM' }),
    ], { description: 'Output format for LLM (defaults to toon)' })),
    display: Type.Optional(
      Type.Union([
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines (default)' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + diff sections' }),
      ], { description: 'Display mode for visible output: compact (default), table, or full' })
    ),
  });

  pi.registerTool({
    name: 'find',
    label: 'Find',
    description:
      'Find files and directories by glob pattern. '
      + 'Respects .gitignore by default. '
      + 'Supports type filtering, hidden files, symlink following, '
      + 'exclusion patterns, depth limits, and result limiting.',
    promptSnippet: 'Find files by glob pattern',
    promptGuidelines: [
      'Use find to discover files and directories by glob pattern.',
      'Use type: "f" for files only, type: "d" for directories only.',
      'Use hidden: true to include hidden files/directories.',
      'Use exclude to skip unwanted patterns (e.g. "node_modules").',
      'Use max_depth to limit how deep the search goes.',
      'Use limit to cap the number of results returned.',
    ],
    parameters: findSchema,
    async execute(_toolCallId, params: FindToolParams, _signal, _onUpdate, ctx) {
      const pattern = params.pattern;
      const searchPath = params.path ? resolve(ctx.cwd, params.path.startsWith('@') ? params.path.slice(1) : params.path) : ctx.cwd;
      const type = params.type;
      const hidden = params.hidden === true || params.hidden === 'true';
      const followSymlinks = params.follow_symlinks === true || params.follow_symlinks === 'true';
      const exclude = typeof params.exclude === 'string' ? [params.exclude] : (params.exclude ?? []);
      const maxDepth = typeof params.max_depth === 'string' ? parseInt(params.max_depth, 10) : params.max_depth;
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
      const mode = (params.mode ?? 'toon') as ToonMode;

      // Load settings
      const { settings: findSettings, warnings: findWarnings } = loadSettings(ctx.cwd);
      const settingsWarning = findWarnings.length > 0 ? findWarnings.join('; ') : undefined;

      // Apply default excludes unless explicitly overridden
      const allExcludes = [...findSettings.defaultExcludes, ...exclude];

      // Validate search path
      if (!existsSync(searchPath)) {
        return {
          content: [{ type: 'text', text: error('not-found', `Path not found: ${searchPath}`, { tool: 'find', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'not-found', path: searchPath },
        };
      }

      // Execute fd
      let fdResult: { stdout: string; stderr: string; exitCode: number };
      try {
        fdResult = await runFd(searchPath, { pattern, type, hidden, followSymlinks, exclude: allExcludes, maxDepth, limit });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: error('binary-failed', `fd execution failed: ${msg}`, { tool: 'find', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, stderr: msg },
        };
      }

      if (fdResult.exitCode > 0) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `fd exited ${fdResult.exitCode}: ${fdResult.stderr.trim()}`, { tool: 'find', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode: fdResult.exitCode, stderr: fdResult.stderr.trim() },
        };
      }

      // Parse fd output.
      // To accurately detect truncation, fetch limit + 1 entries:
      // if we get limit + 1, we know there are more and can set truncated=true.
      const fetchLimit = limit !== undefined ? limit + 1 : undefined;
      const fdResult2 = await runFd(searchPath, { pattern, type, hidden, followSymlinks, exclude: allExcludes, maxDepth, limit: fetchLimit });

      if (fdResult2.exitCode > 0) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `fd exited ${fdResult2.exitCode}: ${fdResult2.stderr.trim()}`, { tool: 'find', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode: fdResult2.exitCode, stderr: fdResult2.stderr.trim() },
        };
      }

      const entries = parseFdOutput(fdResult2.stdout);
      const totalEntries = entries.length;
      const returnedEntries = limit !== undefined ? Math.min(totalEntries, limit) : totalEntries;
      const truncated = limit !== undefined && totalEntries > limit;
      const displayed = limit !== undefined ? entries.slice(0, limit) : entries;

      // --- User-facing text output (Phase 21: display-aware) ---
      const display = (params.display ?? 'compact') as DisplayMode;
      const typeLabel = type ? ` (${type})` : '';

      const findCompactResult = {
        query: pattern ?? '',
        totalEntries,
        returnedEntries,
        truncated,
        entries: displayed,
      };

      let userText: string;
      const recoveryHint = truncated
        ? buildFindRecoveryHint(searchPath, pattern ?? '*', totalEntries, returnedEntries, truncated)
        : '';

      if (display === 'compact' || display === 'auto') {
        userText = formatFindCompact(findCompactResult);
      } else if (display === 'table') {
        // Table: table-only (no compact summary)
        const tableLines: string[] = [];
        tableLines.push('| Path | Type | Size | Depth |');
        tableLines.push('|------|------|------|-------|');
        for (const e of displayed) {
          const sizeStr = e.size !== undefined ? `${(e.size / 1024).toFixed(1)}KB` : '—';
          tableLines.push(`| ${e.path} | ${e.type} | ${sizeStr} | ${e.depth} |`);
        }
        userText = tableLines.join('\n');
      } else {
        // Full: table-only (no compact summary) — expanded view should focus on table
        const tableLines: string[] = [];
        tableLines.push('| Path | Type | Size | Depth |');
        tableLines.push('|------|------|------|-------|');
        for (const e of displayed) {
          const sizeStr = e.size !== undefined ? `${(e.size / 1024).toFixed(1)}KB` : '—';
          tableLines.push(`| ${e.path} | ${e.type} | ${sizeStr} | ${e.depth} |`);
        }
        userText = tableLines.join('\n');
      }

      // --- LLM-facing JSON/TOON in details ---
      const llmResult: FindResult = {
        query: pattern ?? '',
        cwd: ctx.cwd,
        pattern: pattern ?? '',
        patternMode: 'glob',
        type,
        entries: displayed.map(e => ({
          path: e.path,
          type: e.type,
          size: e.size,
          depth: e.depth,
        })),
        totalEntries,
        returnedEntries,
        truncated,
        command: [FD_BIN, '--print0', '--glob', ...(pattern ? [pattern] : ['*']), ...(type ? ['-t', type] : []), ...(hidden ? ['--hidden'] : []), ...(followSymlinks ? ['-L'] : []), ...(allExcludes.flatMap(e => ['--exclude', e])), ...(maxDepth ? ['--max-depth', String(maxDepth)] : []), ...(limit ? ['--max-results', String(limit)] : []), searchPath],
        visibleBudget: findSettings.findMaxEntries,
        excludedPatterns: allExcludes,
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
          source: 'fd',
          backend: 'fd+nu',
        },
      };
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0) as unknown as Component;

      const details = result as {
        details?: {
          totalEntries?: number;
          returnedEntries?: number;
          truncated?: boolean;
          entries?: Array<{ type: string; size: number; path: string }>;
        };
      };
      const totalEntries = details.details?.totalEntries ?? 0;
      const returnedEntries = details.details?.returnedEntries ?? 0;
      const truncated = details.details?.truncated ?? false;

      // Phase 21: expanded mode is table-only for all modes except compact
      const displayParam = (result as { params?: { display?: DisplayMode } }).params?.display;
      const isCompact = displayParam === 'compact';
      const showFull = expanded && !isCompact;

      let text: string;
      if (showFull && details.details?.entries) {
        // Expanded mode (auto/full/table): table-only, no redundant compact summary
        text = formatFindTableMarkdown(details.details.entries);
      } else {
        // Collapsed or compact mode: compact summary
        text = `found ${totalEntries} entries`;
        if (truncated) text += ` — showing ${returnedEntries}`;
      }

      return renderMarkdown(text, theme as { fg: (color: unknown, text: string) => string; bold: (text: string) => string; italic: (text: string) => string; strikethrough: (text: string) => string; underline: (text: string) => string; }) as unknown as Component;
    },
  });
}
