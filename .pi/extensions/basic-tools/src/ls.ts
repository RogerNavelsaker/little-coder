/**
 * `ls` tool — directory listing with structured output.
 *
 * Backend: `nu` (Nushell) for structured metadata.
 * Display: `eza` when available for human-readable output.
 * Fallback: native `fs.readdir` + `fs.stat`.
 *
 * Phase 20: Context guards — visible entry budget and truncation metadata.
 */
import { Type } from '@sinclair/typebox';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { readdirSync, statSync, existsSync, type Stats } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';
import { encodeToon, type ToonMode } from './toon.js';
import { error } from './output.js';
import { loadSettings } from './settings.js';
import { type DisplayMode, formatLsCompact, formatFileSize } from './display.js';

export interface LsToolParams {
  path?: string;
  all?: boolean | string;
  long?: boolean | string;
  dirs_first?: boolean | string;
  limit?: number | string;
  tree?: boolean | string;
  depth?: number | string;
  mode?: ToonMode;
  display?: DisplayMode;
}

export interface LsEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'socket' | 'pipe' | 'other';
  size?: number | bigint;
  modified?: string; // ISO 8601
  depth?: number;
}

export interface LsResult {
  path: string;
  entries: LsEntry[];
  totalEntries: number;
  returnedEntries: number;
  truncated: boolean;
  backend: 'eza+nu' | 'nu-native' | 'native-fallback';
  command: string[];
  visibleBudget: number;
  all: boolean;
  settingsWarning?: string;
}

/**
 * Resolve nu binary path.
 */
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

/**
 * Resolve eza binary path.
 */
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


/**
 * Run nu ls command and parse JSON output.
 */
function runNuLs(dirPath: string, all: boolean, dirsFirst: boolean): { entries: LsEntry[]; status: number } | null {
  try {
    // Build nu script to list directory with proper options
    const nuArgs = ['-c'];

    // Build the nu command
    let nuCmd = `ls`;
    if (all) nuCmd += ' -a';
    nuCmd += ` '${dirPath}'`;

    // Select and shape fields
    nuCmd += ` | select name type size modified`;

    // Convert to JSON
    nuCmd += ` | to json --raw`;

    nuArgs.push(nuCmd);

    const result = spawnSync(NU_BIN, nuArgs, {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });

    if (result.status !== 0 || !result.stdout || result.stdout.length === 0) return null;

    const jsonStr = result.stdout.toString().trim();
    let parsed: Array<{ name: string; type: string; size?: number | string; modified?: string }>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    const entries: LsEntry[] = parsed.map(item => {
      const name = item.name;
      // nu returns full paths; extract just the filename
      const basename = name.split('/').pop() || name;
      const fullPath = name;

      // Map nu type to our type
      let type: LsEntry['type'] = 'other';
      const nuType = (item.type ?? '').toLowerCase();
      if (nuType === 'file') type = 'file';
      else if (nuType === 'dir') type = 'directory';
      else if (nuType === 'symlink') type = 'symlink';
      else if (nuType === 'socket') type = 'socket';
      else if (nuType === 'pipe') type = 'pipe';

      // Parse size (keep as number for JSON compatibility)
      let size: number | bigint | undefined;
      if (item.size !== undefined && item.size !== null) {
        const sizeNum = typeof item.size === 'string' ? parseInt(item.size, 10) : item.size;
        if (Number.isFinite(sizeNum) && sizeNum >= 0) size = sizeNum;
      }

      // Parse modified (nu returns ISO format)
      let modified: string | undefined;
      if (item.modified) {
        modified = new Date(item.modified).toISOString().replace('T', ' ').substring(0, 19);
      }

      return {
        name: basename,
        path: fullPath,
        type,
        size,
        modified,
        depth: 1,
      };
    });

    return { entries, status: result.status };
  } catch {
    return null;
  }
}

/**
 * Run eza for human display. Returns stdout or null on failure.
 */
function runEzaDisplay(dirPath: string, all: boolean, long: boolean, dirsFirst: boolean): string | null {
  try {
    const args: string[] = ['--color', 'never'];
    if (long) args.push('--long');
    if (all) args.push('--all');
    if (dirsFirst) args.push('--group-directories-first');
    args.push(dirPath);

    const result = spawnSync(EZA_BIN, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });

    if (result.status !== 0 || !result.stdout || result.stdout.length === 0) return null;
    return result.stdout.toString();
  } catch {
    return null;
  }
}

/**
 * Format file size in human-readable form.
 */
function formatSize(bytes: number | bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Build native ls user-facing text.
 */
function buildNativeLsText(
  searchPath: string,
  totalEntries: number,
  displayed: LsEntry[],
  long: boolean,
  effectiveLimit: number,
): string {
  const userParts: string[] = [];
  userParts.push(`Directory: ${searchPath}`);
  const truncated = totalEntries > effectiveLimit;
  if (truncated) {
    userParts.push(`Found ${totalEntries} entries (showing ${displayed.length} of ${totalEntries}).`);
  } else {
    userParts.push(`Found ${totalEntries} entry${totalEntries !== 1 ? 'ies' : 'y'} (showing ${displayed.length}).`);
  }

  if (long) {
    userParts.push('\n| Type | Size | Modified | Name |');
    userParts.push('|------|------|----------|------|');
    for (const e of displayed) {
      const typeChar = e.type === 'directory' ? 'D' : (e.type === 'symlink' ? 'L' : '-');
      const sizeStr = e.size !== undefined ? formatSize(e.size) : '-';
      const modStr = e.modified ?? '-';
      const nameStr = e.type === 'directory' ? `${e.name}/` : e.name;
      userParts.push(`| ${typeChar} | ${sizeStr} | ${modStr} | ${nameStr} |`);
    }
  } else {
    const names = displayed.map(e => {
      const prefix = e.type === 'directory' ? '/' : '';
      return e.name + prefix;
    });
    userParts.push('\n' + names.join('  '));
  }

  return userParts.join('\n');
}

/**
 * Register the ls tool with pi.
 */
export function registerLsTool(pi: ExtensionAPI) {
  const lsSchema = Type.Object({
    path: Type.Optional(Type.String({ description: 'Directory to list (defaults to cwd)' })),
    all: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Include hidden files/directories (dotfiles)' }),
      Type.String({ description: 'Include hidden files/directories (dotfiles)' }),
    ], { description: 'Show hidden entries (default: false)' })),
    long: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Include size and modified time' }),
      Type.String({ description: 'Include size and modified time' }),
    ], { description: 'Show detailed info (default: false)' })),
    dirs_first: Type.Optional(Type.Union([
      Type.Boolean({ description: 'List directories before files' }),
      Type.String({ description: 'List directories before files' }),
    ], { description: 'Directories first (default: true)' })),
    limit: Type.Optional(Type.Union([
      Type.Number({ description: 'Maximum number of entries to return' }),
      Type.String({ description: 'Maximum number of entries to return' }),
    ], { description: 'Limit results (default: 200)' })),
    tree: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Show recursive tree view via eza --tree' }),
      Type.String({ description: 'Show recursive tree view via eza --tree' }),
    ], { description: 'Tree view: shows full recursive directory structure (default: false)' })),
    depth: Type.Optional(Type.Union([
      Type.Number({ description: 'Max depth for tree view (default: 3)' }),
      Type.String({ description: 'Max depth for tree view (default: 3)' }),
    ], { description: 'Max recursion depth for tree mode (default: 3)' })),

    display: Type.Optional(
      Type.Union([
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines (default)' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + table/diff sections' }),
      ], { description: 'Display mode for visible output: compact (default), table, or full' })
    ),
  });

  pi.registerTool({
    name: 'ls',
    label: 'Ls',
    description:
      'List directory contents with entry details. '
      + 'Returns entries with type, size, and modified time. '
      + 'Supports hidden files, detailed output, dirs-first ordering, and result limiting.',
    promptSnippet: 'List directory contents with entry details',
    promptGuidelines: [
      'Use ls to list files and directories.',
      'Use tree: true for a recursive tree view of a directory (depth defaults to 3).',
      'Use depth to control tree recursion depth (e.g. depth: 2 for two levels).',
      'Use all: true to include hidden files (dotfiles).',
      'Use long: true to include size and modification time.',
      'Use dirs_first: true (default) to list directories before files.',
      'Use limit to cap the number of entries returned in flat mode.',
    ],
    parameters: lsSchema,
    async execute(_toolCallId, params: LsToolParams, _signal, _onUpdate, ctx) {
      const searchPath = params.path ? resolve(ctx.cwd, params.path.startsWith('@') ? params.path.slice(1) : params.path) : ctx.cwd;
      const all = params.all === true || params.all === 'true';
      const long = params.long === true || params.long === 'true';
      const dirsFirst = params.dirs_first !== false && params.dirs_first !== 'false'; // default true
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : (params.limit ?? 200);
      const treeMode = params.tree === true || params.tree === 'true';
      const treeDepth = typeof params.depth === 'string' ? parseInt(params.depth, 10) : (params.depth ?? 3);
      const mode = (params.mode ?? 'toon') as ToonMode;

      // Load settings
      const { settings, warnings } = loadSettings(ctx.cwd);
      const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;

      // Use settings budget as the default limit if no explicit limit
      const effectiveLimit = params.limit !== undefined ? limit : settings.lsMaxEntries;

      // Validate search path
      if (!existsSync(searchPath)) {
        return {
          content: [{ type: 'text', text: error('not-found', `Path not found: ${searchPath}`, { tool: 'ls', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'not-found', path: searchPath },
        };
      }

      // Check if path is a file (not a directory)
      const stat = statSync(searchPath);
      if (stat.isFile()) {
        return {
          content: [{ type: 'text', text: error('invalid-params', `${searchPath} is a file, not a directory. Use read tool for file contents.`, { tool: 'ls', path: searchPath }).message }],
          isError: true,
          details: { errorType: 'invalid-params', path: searchPath, isFile: true },
        };
      }

      let entries: LsEntry[];
      let backend: LsResult['backend'];
      let command: string[];

      // Try nu first for structured metadata
      const nuResult = runNuLs(searchPath, all, dirsFirst);
      if (nuResult && nuResult.entries.length > 0) {
        // Sort if needed (nu ls doesn't guarantee dirs-first)
        if (dirsFirst) {
          nuResult.entries.sort((a, b) => {
            const aIsDir = a.type === 'directory' ? 0 : 1;
            const bIsDir = b.type === 'directory' ? 0 : 1;
            return (aIsDir - bIsDir) || a.name.localeCompare(b.name);
          });
        }

        entries = nuResult.entries;

        // Determine backend: eza+nu if eza available, else nu-native
        const ezaAvailable = runEzaDisplay(searchPath, all, long, dirsFirst) !== null;
        if (ezaAvailable) {
          backend = 'eza+nu';
          command = [EZA_BIN, '--color', 'never', ...(long ? ['--long'] : []), ...(all ? ['--all'] : []), ...(dirsFirst ? ['--group-directories-first'] : []), searchPath];
        } else {
          backend = 'nu-native';
          command = [NU_BIN, '-c', `ls${all ? ' -a' : ''} '${searchPath}' | select name type size modified`];
        }
      } else {
        // Fallback to native fs
        backend = 'native-fallback';
        command = ['ls', ...(all ? ['-a'] : []), ...(long ? ['-l'] : []), searchPath];

        const rawEntries = readdirSync(searchPath, { withFileTypes: true });
        entries = rawEntries
          .filter(e => all || !e.name.startsWith('.'))
          .map(e => {
            const fullPath = resolve(searchPath, e.name);
            let entryStat: Stats;
            try {
              entryStat = statSync(fullPath);
            } catch {
              entryStat = {
                isFile: () => false,
                isDirectory: () => false,
                isSymbolicLink: () => true,
                isSocket: () => false,
                isFIFO: () => false,
                mtime: new Date(0),
                size: BigInt(0),
              } as unknown as Stats;
            }

            let type: LsEntry['type'] = 'other';
            if (entryStat.isFile()) type = 'file';
            else if (entryStat.isDirectory()) type = 'directory';
            else if (entryStat.isSymbolicLink()) type = 'symlink';
            else if (entryStat.isSocket()) type = 'socket';
            else if (entryStat.isFIFO()) type = 'pipe';

            return {
              name: e.name,
              path: fullPath,
              type,
              size: entryStat.size,
              modified: new Date(entryStat.mtime).toISOString().replace('T', ' ').substring(0, 19),
              depth: 1,
            };
          });

        // Sort: dirs first if requested
        if (dirsFirst) {
          entries.sort((a, b) => {
            const aIsDir = a.type === 'directory' ? 0 : 1;
            const bIsDir = b.type === 'directory' ? 0 : 1;
            return (aIsDir - bIsDir) || a.name.localeCompare(b.name);
          });
        } else {
          entries.sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      const totalEntries = entries.length;
      const truncated = totalEntries > effectiveLimit;
      const displayed = entries.slice(0, effectiveLimit);

      // --- details: structured metadata for agents + renderResult ---
      const displayedEntries = displayed.map(e => ({
        name: e.name,
        path: e.path,
        type: e.type,
        size: e.size,
        modified: e.modified,
      }));
      const detailsObj = {
        path: searchPath,
        entries: displayedEntries,
        totalEntries,
        returnedEntries: displayed.length,
        truncated,
        all,
        tree: treeMode,
        ...(settingsWarning ? { settingsWarning } : {}),
      };

      // --- content.text: TOON-encoded for LLM (tree text in tree mode) ---
      let llmContentText: string;
      if (treeMode) {
        const treeArgs = [
          '--tree', '--color=never',
          '--level', String(treeDepth),
          '--group-directories-first',
          ...(all ? ['--all'] : []),
          searchPath,
        ];
        const treeOut = spawnSync(EZA_BIN, treeArgs, { encoding: 'utf-8', timeout: 10000 });
        llmContentText = treeOut.status === 0 && treeOut.stdout
          ? treeOut.stdout.trimEnd()
          : encodeToon({ ls: { [searchPath]: displayedEntries } }).text;
      } else {
        llmContentText = encodeToon({ ls: { [searchPath]: displayedEntries } }).text;
      }

      return {
        content: [{ type: 'text', text: llmContentText }],
        details: detailsObj,
      };
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0) as unknown as Component;

      const details = result as {
        details?: {
          totalEntries?: number;
          returnedEntries?: number;
          truncated?: boolean;
          path?: string;
          tree?: boolean;
          depth?: number;
          all?: boolean;
          entries?: Array<{ name: string; type: string; size: number | bigint }>;
        };
      };
      const totalEntries = details.details?.totalEntries ?? 0;
      const returnedEntries = details.details?.returnedEntries ?? 0;
      const truncated = details.details?.truncated ?? false;
      const dirPath = details.details?.path ?? '';
      const treeView = details.details?.tree ?? false;
      const treeDepth = details.details?.depth ?? 3;
      const showAll = details.details?.all ?? false;

      if (expanded) {
        try {
          // Always tree+icons in expanded view — shows structure at a glance
          const ezaArgs = [
            '--tree', '--icons', '--color=always',
            '--level', String(treeView ? treeDepth : 2),
            '--group-directories-first',
            ...(showAll ? ['--all'] : []),
            dirPath,
          ];
          const ezaResult = spawnSync(EZA_BIN, ezaArgs, { encoding: 'utf-8', timeout: 10000 });
          if (ezaResult.status === 0 && ezaResult.stdout) {
            return new Text(ezaResult.stdout.trimEnd(), 1, 0);
          }
        } catch {
          // eza not available, fall through
        }
        // Fallback: compact entry list from details
        const fallbackEntries = details.details?.entries ?? [];
        const entryLines = fallbackEntries.map(e => {
          const typeChar = e.type === 'directory' ? 'D' : (e.type === 'symlink' ? 'L' : '-');
          const sizeNum = typeof e.size === 'bigint' ? Number(e.size) : (e.size ?? 0);
          const sizeStr = e.size !== undefined ? formatFileSize(sizeNum) : '-';
          return `${typeChar} ${sizeStr.padEnd(8)} ${e.name}`;
        });
        return new Text(entryLines.join('\n'), 1, 0);
      }

      // Collapsed: compact summary
      let text = treeView ? `tree — ${dirPath}` : `${totalEntries} entries`;
      if (!treeView && truncated) text += ` — showing ${returnedEntries}`;
      return new Text(text, 0, 0);
    },
  });
}
