/**
 * `read` tool — Linehash-backed file reading with TOON/JSON/raw output.
 *
 * Wraps the `linehash` binary to provide structured file reading
 * with line-level anchors for change detection and context hygiene.
 * Renders a line/hash/text table for human display.
 *
 * Phase 20: Context guards — visible budgets and truncation hints.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { encodeToon, type ToonMode } from './toon.js';
import { parseLineHash, extractText, type LineHashRecord } from './linehash.js';
import { error } from './output.js';
import { loadSettings } from './settings.js';
import { type DisplayMode, formatReadCompact, formatReadTableMarkdown, formatReadTablePlain, renderMarkdown } from './display.js';
import { type Component, Markdown, Text } from '@earendil-works/pi-tui';

/** Resolve bat binary path. */
function resolveBatBin(): string {
  if (process.env.BAT_BIN) return process.env.BAT_BIN;
  try {
    const { execSync } = require('child_process');
    const p = execSync('which bat 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (p) return p;
  } catch { /* continue */ }
  return 'bat';
}

const BAT_BIN = resolveBatBin();

/** Simple async command executor */
function executeCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: process.cwd(), env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Resolve the linehash binary path.
 *
 * Priority:
 * 1. LINEHASH_BIN env var
 * 2. 'linehash' in PATH (via which)
 * 3. Fallback to common flox path
 *
 * @returns Absolute path to linehash binary
 * @throws Error if binary not found
 */
function resolveLinehashBin(): string {
  // 1. Explicit env var
  if (process.env.LINEHASH_BIN) {
    return process.env.LINEHASH_BIN;
  }

  // 2. Check PATH via which (if available)
  try {
    const { execSync } = require('child_process');
    const whichPath = execSync('which linehash 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (whichPath) {
      return whichPath;
    }
  } catch {
    // which not available or failed, continue to fallback
  }

  // 3. Common flox paths
  const fallbackPaths = [
    '/home/rona/.flox/run/x86_64-linux.default.run/bin/linehash',
    '/home/rona/.flox/run/bin/linehash',
    '/run/current-system/sw/bin/linehash',
  ];

  for (const path of fallbackPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    'linehash binary not found. Set LINEHASH_BIN env var to the path of the linehash binary, '
    + 'or ensure it is in your PATH.'
  );
}

const LINEHASH_BIN = resolveLinehashBin();

function escapeMarkdownCell(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function formatReadTable(filePath: string, records: LineHashRecord[]): string {
  const lines = [`File \`${filePath}\` (${records.length} line(s)):`];
  if (records.length === 0) return lines.join('\n');

  lines.push('', '| line | hash | text |', '|---:|:---:|---|');
  for (const rec of records) {
    const text = rec.text.length > 240 ? `${rec.text.slice(0, 239)}...` : rec.text;
    lines.push(`| ${rec.line} | ${rec.anchor} | ${escapeMarkdownCell(text)} |`);
  }

  return lines.join('\n');
}

export interface ReadToolOptions {
  /** Called after a successful read (for context hygiene tracking) */
  onSuccessfulRead?: (path: string) => void;
}

export interface ReadFileSpec {
  path: string;
  offset?: number | string;
  limit?: number | string;
  after_anchor?: string;
}

export interface ReadToolParams {
  files: ReadFileSpec[];
  /** Display mode for visible output: compact (default), table, or full */
  display?: DisplayMode;
}

export interface ReadToolResult {
  /** File path */
  path: string;
  /** Total lines in file */
  totalLines: number;
  /** Lines returned */
  returnedLines: number;
  /** Linehash records */
  records: LineHashRecord[];
  /** Concatenated text content */
  content: string;
  /** Token savings (if TOON was used) */
  tokenSavings?: number;
  /** Visible budget applied */
  visibleBudget: { maxLines: number; maxBytes: number };
  /** Whether content was truncated */
  truncated: boolean;
  /** Hint for follow-up reads */
  recoveryHint: string;
}

/**
 * Execute the linehash binary for a given file.
 *
 * @param filePath - Absolute path to the file
 * @param limit - Max lines to request from linehash (optional)
 * @param readAll - If true, read entire file regardless of limit
 * @returns Promise resolving to stdout string
 */
function executeLinehash(
  filePath: string,
  offset?: number,
  afterAnchor?: string,
  limit?: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = ['read', filePath];

    // --offset and --after are mutually exclusive
    if (offset !== undefined && afterAnchor !== undefined) {
      reject(new Error('--offset and --after_anchor are mutually exclusive'));
      return;
    }

    // Pass --offset if provided (line-number based windowing)
    if (offset !== undefined) {
      args.push('--offset', String(offset));
    }

    // Pass --after if provided (anchor-based windowing)
    if (afterAnchor !== undefined) {
      args.push('--after', afterAnchor);
    }

    // Pass --limit
    if (limit !== undefined) {
      args.push('--limit', String(limit));
    }

    const proc = spawn(LINEHASH_BIN, args, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Execute multi-file read: process each file spec and concatenate TOON with headers.
 */
async function executeMultiRead(
  files: ReadFileSpec[],
  cwd: string,
  params: ReadToolParams
): Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }> {
  const { loadSettings } = await import('./settings.js');
  const { settings } = loadSettings(cwd);
  const effectiveLimit = settings.readMaxVisibleLines ?? 2000;

  const fileMap: Record<string, unknown> = {};
  const fileResults: Array<{
    path: string;
    totalLines: number;
    returnedLines: number;
    truncated: boolean;
    error?: string;
  }> = [];

  for (const spec of files) {
    const requestedPath = spec.path.startsWith('@') ? spec.path.slice(1) : spec.path;
    const absolutePath = resolve(cwd, requestedPath);

    if (!existsSync(absolutePath)) {
      const msg = `not found: ${absolutePath}`;
      fileMap[spec.path] = `[error: ${msg}]`;
      fileResults.push({ path: absolutePath, totalLines: 0, returnedLines: 0, truncated: false, error: msg });
      continue;
    }

    try {
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        const msg = `is a directory: ${absolutePath}`;
        fileMap[spec.path] = `[error: ${msg}]`;
        fileResults.push({ path: absolutePath, totalLines: 0, returnedLines: 0, truncated: false, error: msg });
        continue;
      }
    } catch { /* fall through to linehash */ }

    const offset = typeof spec.offset === 'string' ? parseInt(spec.offset, 10) : spec.offset;
    const limit = typeof spec.limit === 'string' ? parseInt(spec.limit, 10) : (spec.limit ?? effectiveLimit);

    let result: { stdout: string; stderr: string; exitCode: number };
    try {
      result = await executeLinehash(absolutePath, offset, spec.after_anchor, limit + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fileMap[spec.path] = `[error: ${msg}]`;
      fileResults.push({ path: absolutePath, totalLines: 0, returnedLines: 0, truncated: false, error: msg });
      continue;
    }

    if (result.exitCode !== 0) {
      const msg = result.stderr.trim() || `linehash exited ${result.exitCode}`;
      fileMap[spec.path] = `[error: ${msg}]`;
      fileResults.push({ path: absolutePath, totalLines: 0, returnedLines: 0, truncated: false, error: msg });
      continue;
    }

    const parsed = parseLineHash(result.stdout);
    const truncated = parsed.records.length > limit;
    const records = truncated ? parsed.records.slice(0, limit) : parsed.records;

    fileMap[spec.path] = records;
    fileResults.push({
      path: absolutePath,
      totalLines: parsed.records.length,
      returnedLines: records.length,
      truncated,
    });
  }

  return {
    content: [{ type: 'text' as const, text: encodeToon({ read: fileMap }).text }],
    details: {
      files: fileResults,
      totalFiles: files.length,
    },
  };
}

/**
 * Register the read tool with pi.
 *
 * @param pi - Pi extension API
 * @param options - Optional configuration
 */
export function registerReadTool(pi: ExtensionAPI, options: ReadToolOptions = {}) {
  const readSchema = Type.Object({
    files: Type.Array(Type.Object({
      path: Type.String({ description: 'File path to read (relative or absolute)' }),
      offset: Type.Optional(Type.Union([
        Type.Number({ description: 'Start line (1-indexed)' }),
        Type.String({ description: 'Start line (1-indexed)' }),
      ])),
      limit: Type.Optional(Type.Union([
        Type.Number({ description: 'Max lines to read' }),
        Type.String({ description: 'Max lines to read' }),
      ])),
      after_anchor: Type.Optional(Type.String({ description: 'Anchor hash to start after (exclusive)' })),
    }), { description: 'Files to read. Single read: [{path}]. Multi-read: [{path}, {path}, ...].' }),
    display: Type.Optional(
      Type.Union([
        Type.Literal('auto', { description: 'Auto: compact by default, fuller when expanded (default)' }),
        Type.Literal('compact', { description: 'Compact: 1-5 short visible lines' }),
        Type.Literal('table', { description: 'Markdown table via renderResult' }),
        Type.Literal('full', { description: 'Compact summary + table/diff sections' }),
      ], { description: 'Display mode: auto (default), compact, table, or full' })
    ),
  });

  pi.registerTool({
    name: 'read',
    label: 'Read',
    description:
      'Read file contents with line anchors for change detection and follow-up edits. '
      + 'Always pass files[]. Single read: files: [{path}]. Multi-read: files: [{path}, {path}, ...].',
    promptSnippet: 'Read files with line anchors',
    promptGuidelines: [
      'Always pass files: [{path, offset?, limit?, after_anchor?}].',
      'Single read: files: [{path: "src/foo.ts"}].',
      'Multi-read: files: [{path: "src/a.ts"}, {path: "src/b.ts"}].',
      'Use offset/limit per file for large files.',
      'Keep returned anchors for follow-up edits.',
    ],
    parameters: readSchema,
    async execute(_toolCallId, params: ReadToolParams, _signal, _onUpdate, ctx) {
      if (!params.files || params.files.length === 0) {
        return {
          content: [{ type: 'text', text: error('invalid-params', 'files[] is required (e.g. files: [{path: "src/foo.ts"}])', { tool: 'read' }).message }],
          isError: true,
          details: { errorType: 'invalid-params' },
        };
      }
      return executeMultiRead(params.files, ctx.cwd, params) as any;

    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0) as unknown as Component;

      // Multi-file mode
      const multiDetails = (result as any).details as { totalFiles?: number; files?: Array<{ path: string; returnedLines: number; truncated: boolean }> } | undefined;
      if (multiDetails?.totalFiles !== undefined) {
        const count = multiDetails.totalFiles;
        if (expanded && multiDetails.files) {
          const lines = multiDetails.files.map(f => {
            const name = f.path.split('/').pop() ?? f.path;
            const trunc = f.truncated ? ` (truncated)` : '';
            return `${theme.fg('accent', name)} — ${f.returnedLines} lines${trunc}`;
          });
          return new Text(lines.join('\n'), 1, 0) as unknown as Component;
        }
        return new Text(`${count} file${count !== 1 ? 's' : ''} read`, 0, 0) as unknown as Component;
      }

      const details = result as {
        details?: {
          truncation?: {
            truncated?: boolean;
            outputLines?: number;
            totalLines?: number;
          };
          path?: string;
          startLine?: number;
          endLine?: number;
        };
      };
      const totalLines = details.details?.truncation?.totalLines ?? 0;
      const returnedLines = details.details?.truncation?.outputLines ?? 0;
      const truncated = details.details?.truncation?.truncated ?? false;
      const filePath = details.details?.path ?? '';
      const offset = (result as { params?: { offset?: number } }).params?.offset;
      const limit = (result as { params?: { limit?: number } }).params?.limit;
      const startLine = details.details?.startLine ?? (offset ?? 1);
      const endLine = details.details?.endLine ?? (offset ?? 1) + returnedLines - 1;

      let text: string;
      if (expanded && filePath) {
        // Expanded: bat directly on the file with --line-range for the returned window
        try {
          const batArgs: string[] = [
            '--color=always',
            '--style=numbers',
            '--paging=never',
            '--theme=ansi',
            '--wrap=never',
            '--line-range', `${startLine}:${endLine}`,
            filePath,
          ];
          const batResult = spawnSync(BAT_BIN, batArgs, { encoding: 'utf-8', timeout: 5000 });
          if (!batResult.error && batResult.status === 0 && batResult.stdout) {
            const more = Math.max(0, totalLines - endLine);
            const expandedFooter = truncated && more > 0
              ? `\x1b[2m── ${returnedLines} of ${totalLines} lines · ${more} more · use offset=${endLine + 1} ──\x1b[22m\n`
              : '';
            return new Text(batResult.stdout.trimEnd() + (expandedFooter ? '\n' + expandedFooter : ''), 1, 0);
          }
        } catch { /* fall through */ }
        text = `${returnedLines} lines from ${filePath}`;
      } else {
        // Collapsed: same dim style as expanded footer
        const more = Math.max(0, totalLines - endLine);
        if (truncated && more > 0) {
          text = `\x1b[2m── ${returnedLines} of ${totalLines} lines · ${more} more · use offset=${endLine + 1} ──\x1b[22;23;24;25;39m`;
        } else {
          text = `\x1b[2m── ${returnedLines} of ${totalLines} lines ──\x1b[22;23;24;25;39m`;
        }
      }

      return renderMarkdown(text, theme as { fg: (color: unknown, text: string) => string; bold: (text: string) => string; italic: (text: string) => string; strikethrough: (text: string) => string; underline: (text: string) => string; }) as Component;
    },
  });
}
