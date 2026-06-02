/**
 * `find` tool — fd-backed file discovery with structured output.
 *
 * Wraps `fd --glob` for glob-first file/directory discovery, returns compact
 * list for user + JSON/TOON for LLM with path, type, size, and metadata.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';
import { encodeToon, type ToonMode } from './toon.js';
import { error } from './output.js';
import { loadSettings, type Settings } from './settings.js';
import { type DisplayMode, formatFindCompact, formatFileSize, makeThrottle } from './display.js';
import type { ChildProcess } from 'child_process';

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

/** Resolve nu binary path. */
function resolveNuBin(): string {
  if (process.env.NU_BIN) return process.env.NU_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which nu 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'nu';
}

const NU_BIN = resolveNuBin();

/** Resolve eza binary path. */
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

/** Normalize fd size unit string: coerce lowercase to uppercase (k→K, m→M, etc.). */
function normalizeSizeUnit(raw: string): string {
  return raw.replace(/([0-9.]+)([kmgtpe]?)(i?b?)?$/i, (_, num, unit, ib) => {
    const u = (unit || "").toUpperCase();
    const suffix = ib || "";
    return `${num}${u}${suffix}`;
  });
}

export interface FindToolParams {
  /** Operation: "glob" (default), "recent", or "sized" */
  op?: 'glob' | 'recent' | 'sized';
  /** Glob pattern (glob op) */
  pattern?: string;
  /** Root directory to search */
  path?: string;
  /** Filter by entry type (glob op) */
  type?: 'f' | 'd' | 'l' | 's' | 'x';
  /** Include hidden files (glob op) */
  hidden?: boolean | string;
  /** Follow symlinks (glob op) */
  follow_symlinks?: boolean | string;
  /** Exclude pattern (glob op) */
  exclude?: string | string[];
  /** Max depth (glob op) */
  max_depth?: number | string;
  /** Max results (all ops) */
  limit?: number | string;
  /** Sort results: "name" | "mtime" | "size" (glob op only) */
  sortBy?: 'name' | 'mtime' | 'size';
  /** Modified within duration like "1h", "30min", "2d" (recent op) */
  modifiedSince?: string;
  /** Min file size like "1M", "500K" (sized op) */
  minSize?: string;
  /** Max file size like "10M", "1G" (sized op) */
  maxSize?: string;
  mode?: ToonMode;
  display?: string;
}

export interface FindEntry {
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'socket' | 'pipe' | 'other';
  size?: number;
  mtime?: number;
  depth: number;
}


/**
 * Run fd with options and return null-delimited output as a string.
 * Supports glob, recent, and sized modes.
 */
function runFd(
  searchPath: string,
  options: {
    pattern?: string;
    type?: string;
    hidden?: boolean;
    followSymlinks?: boolean;
    exclude?: string[];
    maxDepth?: number;
    modifiedSince?: string;
    minSize?: string;
    maxSize?: string;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const args: string[] = ['--print0'];
    // Recent mode: fd --changed-within
    if (options.modifiedSince) {
      args.push('--changed-within', options.modifiedSince);
      args.push(options.pattern ?? '.');
    } else {
      // Glob mode
      args.push('--glob');
      if (options.pattern) args.push(options.pattern);
      else args.push('*');
    }
    if (options.type) args.push('-t', options.type);
    if (options.hidden) args.push('--hidden');
    if (options.followSymlinks) args.push('-L');
    if (options.exclude) {
      for (const ex of options.exclude) args.push('--exclude', ex);
    }
    if (options.maxDepth) args.push('--max-depth', String(options.maxDepth));
    // Size filters — normalize units to uppercase for fd compatibility
    if (options.minSize) args.push('--size', `+${normalizeSizeUnit(options.minSize)}`);
    if (options.maxSize) args.push('--size', `-${normalizeSizeUnit(options.maxSize)}`);

    args.push(searchPath);

    const proc = spawn(FD_BIN, args, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let buffer = Buffer.alloc(0);
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
    });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout: buffer.toString('utf-8'), stderr, exitCode: code ?? 1 });
    });

    proc.on('error', () => {
      resolve({ stdout: '', stderr: 'process error', exitCode: 1 });
    });
  });
}

/**
 * Sort entries using Nu pipeline (name/mtime/size).
 * Returns sorted array of FindEntry.
 */
async function sortEntries(entries: FindEntry[], sortBy: string): Promise<FindEntry[]> {
  if (!sortBy || sortBy === 'name') return entries;

  return new Promise<FindEntry[]>((resolve) => {
    const jsonInput = JSON.stringify(entries);
    const tmpFile = join(tmpdir(), `nu-sort-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(tmpFile, jsonInput);

    let sortExpr: string;
    switch (sortBy) {
      case 'mtime':
        sortExpr = `open "${tmpFile}" | sort-by mtime | where mtime != null | reverse | to json`;
        break;
      case 'size':
        sortExpr = `open "${tmpFile}" | sort-by size | reverse | to json`;
        break;
      default:
        sortExpr = `open "${tmpFile}" | to json`;
    }

    const proc = spawn(NU_BIN, ['-c', sortExpr], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      if (code === 0 && stdout.trim()) {
        try {
          const sorted: FindEntry[] = JSON.parse(stdout.trim());
          resolve(sorted);
        } catch {
          resolve(entries); // fallback to unsorted
        }
      } else {
        resolve(entries); // fallback to unsorted
      }
    });
    proc.on('error', () => {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      resolve(entries);
    });
  }).catch(() => entries);
}

/**
 * Stream fd output: call onEntry for each null-delimited path as it arrives.
 * Returns { proc, kill } so the caller can abort when the limit is reached.
 */
function runFdStream(
  searchPath: string,
  options: {
    pattern?: string;
    type?: string;
    hidden?: boolean;
    followSymlinks?: boolean;
    exclude?: string[];
    maxDepth?: number;
  },
  onEntry: (rawPath: string) => void,
): { proc: ChildProcess; kill: () => void } {
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
  // Do NOT pass --max-results here — we kill manually when limit is hit.

  args.push(searchPath);

  const proc = spawn(FD_BIN, args, {
    cwd: process.cwd(),
    env: { ...process.env },
  });

  let buffer = Buffer.alloc(0);
  let stderr = '';

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    let nullIndex: number;
    while ((nullIndex = buffer.indexOf(0)) !== -1) {
      const path = buffer.slice(0, nullIndex).toString('utf-8');
      buffer = buffer.slice(nullIndex + 1);
      if (path) onEntry(path);
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

  return { proc, kill: () => proc.kill() };
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
        mtime: stat.mtimeMs,
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

export function registerFindTool(pi: ExtensionAPI) {
  const findSchema = Type.Object({
    op: Type.Optional(
      Type.Union([
        Type.Literal('glob', { description: 'Glob-based file search (default)' }),
        Type.Literal('recent', { description: 'Files modified within a duration (e.g. modifiedSince: "1h")' }),
        Type.Literal('sized', { description: 'Files within size bounds (e.g. minSize: "1M", maxSize: "10M")' }),
      ], { description: 'Operation type: glob (default), recent, or sized' })
    ),
    pattern: Type.Optional(Type.String({ description: 'Glob pattern to match file names (e.g. "*.ts", "src/**")' })),
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
    sortBy: Type.Optional(
      Type.Union([
        Type.Literal('name', { description: 'Sort by file name' }),
        Type.Literal('mtime', { description: 'Sort by modification time (newest first)' }),
        Type.Literal('size', { description: 'Sort by file size (largest first)' }),
      ], { description: 'Sort order for glob results (applied via Nu pipeline)' })
    ),
    modifiedSince: Type.Optional(
      Type.String({ description: 'Duration string like "1h", "30min", "2d" — files modified within this period (recent op)' })
    ),
    minSize: Type.Optional(
      Type.String({ description: 'Minimum file size like "1M", "500K" (sized op)' })
    ),
    maxSize: Type.Optional(
      Type.String({ description: 'Maximum file size like "10M", "1G" (sized op)' })
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
      const op = (params.op ?? 'glob') as 'glob' | 'recent' | 'sized';
      const pattern = params.pattern;
      const searchPath = params.path ? resolve(ctx.cwd, params.path.startsWith('@') ? params.path.slice(1) : params.path) : ctx.cwd;
      const type = params.type;
      const hidden = params.hidden === true || params.hidden === 'true';
      const followSymlinks = params.follow_symlinks === true || params.follow_symlinks === 'true';
      const exclude = typeof params.exclude === 'string' ? [params.exclude] : (params.exclude ?? []);
      const maxDepth = typeof params.max_depth === 'string' ? parseInt(params.max_depth, 10) : params.max_depth;
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
      const sortBy = params.sortBy;
      const modifiedSince = params.modifiedSince;
      const minSize = params.minSize;
      const maxSize = params.maxSize;
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

      // --- recent op: fd --changed-within ---
      if (op === 'recent') {
        if (!modifiedSince) {
          return {
            content: [{ type: 'text', text: error('invalid-params', 'recent op requires modifiedSince (e.g. "1h", "30min", "2d")', { tool: 'find' }).message }],
            isError: true,
            details: { errorType: 'invalid-params' },
          };
        }
        const result = await runFd(searchPath, { modifiedSince, hidden, followSymlinks, exclude: allExcludes, maxDepth });
        if (result.exitCode > 0) {
          return {
            content: [{ type: 'text', text: error('binary-failed', `fd exited ${result.exitCode}: ${result.stderr.trim()}`, { tool: 'find', path: searchPath }).message }],
            isError: true,
            details: { errorType: 'binary-failed', path: searchPath, exitCode: result.exitCode, stderr: result.stderr.trim() },
          };
        }
        const entries = parseFdOutput(result.stdout);
        const sorted = sortBy ? await sortEntries(entries, sortBy) : entries;
        const totalEntries = sorted.length;
        const returnedEntries = limit !== undefined ? Math.min(totalEntries, limit) : totalEntries;
        const truncated = limit !== undefined && totalEntries > limit;
        const displayed = truncated ? sorted.slice(0, limit) : sorted;
        const contentEntries = displayed.map(e => ({ path: e.path, type: e.type, size: e.size, mtime: e.mtime, depth: e.depth }));
        return {
          content: [{ type: 'text', text: encodeToon({ find: { [`recent:${modifiedSince}`]: contentEntries } }).text }],
          details: {
            op: 'recent',
            modifiedSince,
            totalEntries,
            returnedEntries,
            truncated,
            entries: contentEntries,
            ...(settingsWarning ? { settingsWarning } : {}),
          },
        };
      }

      // --- sized op: fd --size ---
      if (op === 'sized') {
        const result = await runFd(searchPath, {
          pattern: pattern ?? '*',
          type, hidden, followSymlinks, exclude: allExcludes, maxDepth,
          minSize, maxSize,
        });
        if (result.exitCode > 0) {
          return {
            content: [{ type: 'text', text: error('binary-failed', `fd exited ${result.exitCode}: ${result.stderr.trim()}`, { tool: 'find', path: searchPath }).message }],
            isError: true,
            details: { errorType: 'binary-failed', path: searchPath, exitCode: result.exitCode, stderr: result.stderr.trim() },
          };
        }
        const entries = parseFdOutput(result.stdout);
        const sorted = sortBy ? await sortEntries(entries, sortBy) : entries;
        const totalEntries = sorted.length;
        const returnedEntries = limit !== undefined ? Math.min(totalEntries, limit) : totalEntries;
        const truncated = limit !== undefined && totalEntries > limit;
        const displayed = truncated ? sorted.slice(0, limit) : sorted;
        const contentEntries = displayed.map(e => ({ path: e.path, type: e.type, size: e.size, mtime: e.mtime, depth: e.depth }));
        const sizeLabel = minSize && maxSize ? `${minSize}..${maxSize}` : minSize ? `+${minSize}` : maxSize ? `-${maxSize}` : 'any';
        return {
          content: [{ type: 'text', text: encodeToon({ find: { [`sized:${sizeLabel}`]: contentEntries } }).text }],
          details: {
            op: 'sized',
            minSize: minSize ?? null,
            maxSize: maxSize ?? null,
            totalEntries,
            returnedEntries,
            truncated,
            entries: contentEntries,
            ...(settingsWarning ? { settingsWarning } : {}),
          },
        };
      }

      // --- glob op (default): fd --glob ---
      const throttle = makeThrottle(500);
      const entries: FindEntry[] = [];
      let killedEarly = false;
      let fdStderr = '';

      const { proc, kill } = runFdStream(searchPath, { pattern, type, hidden, followSymlinks, exclude: allExcludes, maxDepth }, (rawPath) => {
        try {
          const stat = statSync(rawPath);
          let type: FindEntry['type'] = 'other';
          if (stat.isFile()) type = 'file';
          else if (stat.isDirectory()) type = 'directory';
          else if (stat.isSymbolicLink()) type = 'symlink';
          else if (stat.isSocket()) type = 'socket';
          else if (stat.isFIFO()) type = 'pipe';

          const depth = (rawPath.split('/').length - 1);
          entries.push({ path: rawPath, type, size: stat.size, mtime: stat.mtimeMs, depth });
        } catch {
          const depth = (rawPath.split('/').length - 1);
          entries.push({ path: rawPath, type: 'other', depth });
        }

        // Kill when limit reached
        if (limit !== undefined && entries.length >= limit) {
          killedEarly = true;
          kill();
        }

        // Throttled progress update
        throttle(() => {
          _onUpdate?.({
            content: [],
            details: { totalEntries: entries.length, truncated: false },
          });
        });
      });

      // Wait for process to close (may have been killed early)
      const { exitCode, stderr } = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
        proc.on('close', (code) => resolve({ exitCode: code ?? 1, stderr: '' }));
        proc.on('error', () => resolve({ exitCode: 1, stderr: 'process error' }));
      });
      fdStderr = stderr;

      if (exitCode > 0 && !killedEarly) {
        return {
          content: [{ type: 'text', text: error('binary-failed', `fd exited ${exitCode}: ${fdStderr.trim()}`, { tool: 'find', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'binary-failed', path: searchPath, exitCode, stderr: fdStderr.trim() },
        };
      }

      // Sort entries if sortBy specified
      const sorted = sortBy ? await sortEntries(entries, sortBy) : entries;

      const totalEntries = sorted.length;
      const returnedEntries = limit !== undefined ? Math.min(totalEntries, limit) : totalEntries;
      const truncated = killedEarly || (limit !== undefined && totalEntries > limit);
      const displayed = truncated ? sorted.slice(0, limit) : sorted;

      // --- content.text: entries JSON → TOON ---
      const contentEntries = displayed.map(e => ({ path: e.path, type: e.type, size: e.size, mtime: e.mtime, depth: e.depth }));
      const searchLabel = pattern ?? '.';
      const contentToon = encodeToon({ find: { [searchLabel]: contentEntries } });

      return {
        content: [{ type: 'text', text: contentToon.text }],
        details: {
          op: 'glob',
          pattern: pattern ?? '',
          sortBy: sortBy ?? null,
          totalEntries,
          returnedEntries,
          truncated,
          entries: contentEntries,
          ...(settingsWarning ? { settingsWarning } : {}),
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

      if (expanded && details.details?.entries && details.details.entries.length > 0) {
        const entries = details.details.entries;
        const paths = entries.map(e => e.path);
        try {
          const r = spawnSync(EZA_BIN, [
            '--color=always', '--icons', '--oneline', '--group-directories-first',
            ...paths,
          ], { encoding: 'utf-8', timeout: 5000 });
          if (r.status === 0 && r.stdout) {
            const footer = truncated ? `\n${theme.fg('muted', `… ${totalEntries - returnedEntries} more`)}` : '';
            return new Text(r.stdout.trimEnd() + footer, 1, 0);
          }
        } catch { /* fall through */ }
        // Fallback: plain path list
        const lines = entries.map(e => {
          const name = e.path.split('/').pop() ?? e.path;
          const dir = e.path.slice(0, e.path.length - name.length - 1);
          return `${dir}/${theme.fg('accent', name)}`;
        });
        const footer = truncated ? `\n${theme.fg('muted', `… ${totalEntries - returnedEntries} more`)}` : '';
        return new Text(lines.join('\n') + footer, 1, 0);
      }

      // Collapsed: compact summary
      const countLabel = totalEntries === 0
        ? theme.fg('muted', '0 files')
        : truncated
          ? theme.fg('success', `${returnedEntries} of ${totalEntries} files`)
          : theme.fg('success', `${totalEntries} file${totalEntries !== 1 ? 's' : ''}`);
      return new Text(countLabel, 0, 0);
    },
  });
}
