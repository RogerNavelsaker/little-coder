/**
 * `write` tool — Linehash-backed file creation/overwriting/appending.
 *
 * Wraps fs operations with linehash anchoring for change detection.
 * Returns structured before/after anchors and diffs for context hygiene.
 */
import { Type } from '@sinclair/typebox';
import { spawn, spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  appendFileSync,
  unlinkSync,
} from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseLineHash, type LineHashRecord } from './linehash.js';
import { error } from './output.js';
import { type DisplayMode, formatWriteCompact, type WriteCompactResult } from './display.js';
import { encodeToon } from './toon.js';
import { Text } from '@earendil-works/pi-tui';

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

export interface WriteFileSpec {
  path: string;
  content: string;
  if_exists?: 'overwrite' | 'error' | 'append';
  create_dirs?: boolean | string;
}

export interface WriteToolParams {
  files: WriteFileSpec[];
  display?: DisplayMode;
}

export interface WriteToolResult {
  /** File path */
  path: string;
  /** Whether file was newly created */
  created: boolean;
  /** Whether existing file was overwritten */
  overwritten: boolean;
  /** Whether content was appended */
  appended: boolean;
  /** Number of bytes written */
  bytesWritten: number;
  /** Number of lines written */
  linesWritten: number;
  /** Before-state anchors (null for new files) */
  beforeAnchors: Array<{ line: number; anchor: string }> | null;
  /** After-state anchors (linehash records) */
  afterAnchors: Array<{ line: number; anchor: string }>;
  /** Plain unified diff (null for new files or append) */
  diff: string | null;
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
function computeDiff(oldContent: string, newContent: string): string {
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
  if (text.length === 0) return 0;
  // Count newlines; if text doesn't end with newline, add 1
  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith('\n') ? newlineCount : newlineCount + 1;
}

/**
 * Run tru encode for TOON compression.
 */
function runToon(text: string): { encoded: string; tokenSavings: number } {
  const jsonStr = JSON.stringify(JSON.parse(text), null, 2);
  // Try tru binary
  let toonBin = 'tru';
  try {
    const { execSync } = require('child_process');
    const whichPath = execSync('which tru 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (whichPath) toonBin = whichPath;
  } catch { /* use default */ }

  const result = spawnSync(toonBin, ['--encode'], {
    cwd: process.cwd(),
    env: { ...process.env },
    input: text,
    timeout: 5000,
    maxBuffer: 1024 * 1024 * 10,
  });

  if (result.status === 0 && result.stdout) {
    const toonStr = result.stdout.toString();
    const tokenSavings = Math.round((1 - toonStr.length / jsonStr.length) * 100);
    return { encoded: toonStr, tokenSavings };
  }

  // Fallback: return raw JSON
  return { encoded: jsonStr, tokenSavings: 0 };
}

/**
 * Write a single file spec. Returns a result record compatible with pi AgentToolResult shape.
 */
async function executeSingleFileWrite(
  spec: WriteFileSpec,
  ctx: { cwd: string }
): Promise<Record<string, unknown>> {
  const ifExists = (spec.if_exists ?? 'overwrite') as 'overwrite' | 'error' | 'append';
  const createDirs = spec.create_dirs === true || spec.create_dirs === 'true';

  const requestedPath = spec.path.startsWith('@') ? spec.path.slice(1) : spec.path;
  const absolutePath = resolve(ctx.cwd, requestedPath);

  const fileExists = existsSync(absolutePath);
  const parentDir = dirname(absolutePath);
  const parentExists = existsSync(parentDir);

  if (!parentExists) {
    if (createDirs) {
      try {
        mkdirSync(parentDir, { recursive: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: error('permission-denied', `Cannot create parent directory: ${parentDir} — ${msg}`, { tool: 'write', path: absolutePath }).message }],
          isError: true,
          details: { errorType: 'permission-denied', path: absolutePath, parentDir },
        };
      }
    } else {
      return {
        content: [{ type: 'text', text: error('not-found', `Parent directory does not exist: ${parentDir}. Set create_dirs: true to create it.`, { tool: 'write', path: absolutePath }).message }],
        isError: true,
        details: { errorType: 'not-found', path: absolutePath, parentDir },
      };
    }
  }

  if (fileExists) {
    try {
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        return {
          content: [{ type: 'text', text: error('invalid-params', `Path is a directory: ${absolutePath}`, { tool: 'write', path: absolutePath }).message }],
          isError: true,
          details: { errorType: 'invalid-params', path: absolutePath },
        };
      }
    } catch { /* fall through */ }

    if (ifExists === 'error') {
      return {
        content: [{ type: 'text', text: error('invalid-params', `File already exists: ${absolutePath}. Set if_exists: "overwrite" or "append".`, { tool: 'write', path: absolutePath }).message }],
        isError: true,
        details: { errorType: 'invalid-params', path: absolutePath },
      };
    }
  }

  // Get before-state anchors and content for overwrite diff
  let beforeAnchors: Array<{ line: number; anchor: string }> | null = null;
  let beforeContent: string | null = null;
  if (fileExists && ifExists === 'overwrite') {
    try {
      beforeContent = readFileSync(absolutePath, 'utf-8');
      const beforeResult = await linehashRead(absolutePath);
      if (beforeResult.exitCode === 0) {
        const parsed = parseLineHash(beforeResult.stdout);
        beforeAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
      }
    } catch { /* non-fatal */ }
  }

  // Write
  try {
    if (ifExists === 'append' && fileExists) {
      appendFileSync(absolutePath, spec.content, 'utf-8');
    } else {
      writeFileSync(absolutePath, spec.content, 'utf-8');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: error('permission-denied', `Failed to write file: ${msg}`, { tool: 'write', path: absolutePath }).message }],
      isError: true,
      details: { errorType: 'permission-denied', path: absolutePath, stderr: msg },
    };
  }

  // Get after-state anchors
  let afterAnchors: Array<{ line: number; anchor: string }> = [];
  try {
    const afterResult = await linehashRead(absolutePath);
    if (afterResult.exitCode === 0) {
      const parsed = parseLineHash(afterResult.stdout);
      afterAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
    }
  } catch { /* non-fatal */ }

  const bytesWritten = Buffer.byteLength(spec.content, 'utf-8');
  const linesWritten = spec.content.split('\n').length;
  const appended = ifExists === 'append' && fileExists;
  const created = !fileExists;
  const overwritten = fileExists && !appended;

  // Compute diff for overwrite
  let diff: string | null = null;
  if (overwritten && beforeContent !== null) {
    diff = computeDiff(beforeContent, spec.content);
  }

  const result: WriteToolResult = {
    path: absolutePath,
    created,
    overwritten,
    appended,
    bytesWritten,
    linesWritten,
    beforeAnchors,
    afterAnchors,
    diff,
  };

  const writeToon = encodeToon({ write: { [absolutePath]: [{ created, overwritten, appended, bytesWritten, linesWritten, diff }] } }).text;
  return {
    content: [{ type: 'text', text: writeToon }],
    details: result,
  };
}

/**
 * Register the write tool with pi.
 */
export function registerWriteTool(pi: ExtensionAPI) {
  const writeFileSpecSchema = Type.Object({
    path: Type.String({ description: 'File path to write (relative or absolute)' }),
    content: Type.String({ description: 'Content to write' }),
    if_exists: Type.Optional(Type.Union([
      Type.Literal('overwrite', { description: 'Overwrite existing file (default)' }),
      Type.Literal('error', { description: 'Fail if file exists' }),
      Type.Literal('append', { description: 'Append to existing file' }),
    ])),
    create_dirs: Type.Optional(Type.Union([
      Type.Boolean({ description: 'Create parent directories if missing' }),
      Type.String({ description: 'Create parent directories if missing' }),
    ])),
  });

  const writeSchema = Type.Object({
    files: Type.Array(writeFileSpecSchema, {
      description: 'Files to write. Single: files: [{path, content}]. Multi: files: [{path, content}, {path, content}].',
    }),
    display: Type.Optional(Type.Union([
      Type.Literal('compact', { description: 'Compact: 1-5 short visible lines (default)' }),
      Type.Literal('table', { description: 'Markdown table via renderResult' }),
      Type.Literal('full', { description: 'Compact summary + diff sections' }),
    ], { description: 'Display mode for visible output' })),
  });

  pi.registerTool({
    name: 'write',
    label: 'Write',
    description:
      'Create or overwrite files. Always pass files[]. '
      + 'Single: files: [{path, content}]. Multi: files: [{path, content}, ...].',
    promptSnippet: 'Write files (create, overwrite, append)',
    promptGuidelines: [
      'Prefer edit for small changes to existing files.',
      'Always pass files: [{path, content, if_exists?, create_dirs?}].',
      'Single write: files: [{path: "src/foo.ts", content: "..."}].',
      'Multi-write: files: [{path: "a.ts", content: "..."}, {path: "b.ts", content: "..."}].',
      'Use if_exists: "append" to append; if_exists: "error" to guard.',
    ],
    parameters: writeSchema,
    async execute(_toolCallId, params: WriteToolParams, _signal, _onUpdate, ctx) {
      if (!params.files || params.files.length === 0) {
        return {
          content: [{ type: 'text', text: error('invalid-params', 'files[] is required (e.g. files: [{path, content}])', { tool: 'write' }).message }],
          isError: true,
          details: { errorType: 'invalid-params' },
        };
      }

      if (params.files.length === 1) {
        return executeSingleFileWrite(params.files[0], ctx) as any;
      }

      // Multi-file: apply each, collect results
      const results: Array<Record<string, unknown>> = [];
      for (const spec of params.files) {
        const r = await executeSingleFileWrite(spec, ctx);
        results.push(r);
      }

      const allOk = results.every(r => !(r as any).isError);
      const writeMap: Record<string, unknown> = {};
      for (const r of results) {
        const d = (r as any).details ?? {};
        writeMap[d.path ?? ''] = [{ created: d.created, overwritten: d.overwritten, appended: d.appended, bytesWritten: d.bytesWritten, linesWritten: d.linesWritten, diff: d.diff ?? '' }];
      }
      return {
        content: [{ type: 'text' as const, text: encodeToon({ write: writeMap }).text }],
        details: {
          files: results.map(r => (r as any).details),
        },
        ...(allOk ? {} : { isError: true }),
      };
    },

    renderResult(result, { expanded }, theme, _context) {
      // Multi-file mode
      const raw = (result as any).details;
      if (Array.isArray(raw?.files)) {
        const count = raw.files.length;
        if (expanded) {
          const lines = raw.files.map((f: any) => {
            const name = (f?.path ?? '').split('/').pop() ?? '?';
            const op = f?.created ? 'created' : f?.appended ? 'appended' : 'overwritten';
            return `${theme.fg('accent', name)} — ${op} ${f?.bytesWritten ?? 0}B`;
          });
          return new Text(lines.join('\n'), 1, 0);
        }
        return new Text(`${count} file${count !== 1 ? 's' : ''} written`, 0, 0);
      }

      // Single-file mode
      const details = result as { details?: { created?: boolean; overwritten?: boolean; appended?: boolean; bytesWritten?: number; linesWritten?: number; path?: string; diff?: string | null } };
      const d = details.details ?? {};

      if (expanded) {
        // Expanded: use bat for syntax-highlighted file content
        const filePath = d.path ?? '';
        try {
          const batResult = spawnSync(BAT_BIN, [
            '--color=always',
            '--style=numbers',
            '--paging=never',
            '--file-name', filePath.split('/').pop() ?? filePath,
            filePath,
          ], { encoding: 'utf-8', timeout: 5000 });
          if (batResult.status === 0 && batResult.stdout) {
            return new Text(batResult.stdout, 1, 0);
          }
        } catch {
          // bat not available, fall through
        }
        // Fallback: summary
        const action = d.created ? 'created' : d.overwritten ? 'overwritten' : d.appended ? 'appended' : 'wrote';
        const lines = (d.linesWritten ?? 0) === 1 ? 'line' : 'lines';
        return new Text(`${action} — ${d.bytesWritten ?? 0} bytes, ${d.linesWritten ?? 0} ${lines}`, 1, 0);
      }

      // Collapsed: compact summary
      const action = d.created ? 'created' : d.overwritten ? 'overwritten' : d.appended ? 'appended' : 'wrote';
      const lines = (d.linesWritten ?? 0) === 1 ? 'line' : 'lines';
      return new Text(`${action} — ${d.bytesWritten ?? 0} bytes, ${d.linesWritten ?? 0} ${lines}`, 0, 0);
    },
  });
}
