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
} from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseLineHash, type LineHashRecord } from '../../_shared/linehash.js';
import { error } from '../../_shared/output.js';
import { type DisplayMode, formatWriteCompact, type WriteCompactResult, formatDiffForTui } from '../../_shared/display.js';
import { Text } from '@earendil-works/pi-tui';

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

export interface WriteToolParams {
  path: string;
  content: string;
  if_exists?: 'overwrite' | 'error' | 'append';
  create_dirs?: boolean | string;
  mode?: 'json' | 'toon';
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
  /** Source of anchoring */
  source: 'linehash';
  /** Backend label */
  backend: 'linehash+nu';
  /** Output mode used */
  mode: string;
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
 * Register the write tool with pi.
 */
export function registerWriteTool(pi: ExtensionAPI) {
  const writeSchema = Type.Object({
    path: Type.String({ description: 'File path to write (relative or absolute)' }),
    content: Type.String({ description: 'Content to write to the file' }),
    if_exists: Type.Optional(
      Type.Union([
        Type.Literal('overwrite', { description: 'Overwrite existing file' }),
        Type.Literal('error', { description: 'Fail if file exists' }),
        Type.Literal('append', { description: 'Append to existing file' }),
      ], { description: 'Behavior when file exists: overwrite (default), error, or append' })
    ),
    create_dirs: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Create parent directories if they do not exist' }),
        Type.String({ description: 'Create parent directories if they do not exist' }),
      ], { description: 'If true, create parent directories before writing' })
    ),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('json', { description: 'JSON output' }),
        Type.Literal('toon', { description: 'TOON output via tru' }),
      ], { description: 'Output mode: json or toon' })
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
    name: 'write',
    label: 'Write',
    description:
      'Create or overwrite files with anchoring and diff output. '
      + 'Supports create, overwrite, and append modes. Returns structured anchors.',
    promptSnippet: 'Write file contents (create, overwrite, append)',
    promptGuidelines: [
      'Prefer edit for small changes to existing files.',
      'Use write when creating new files, overwriting intentionally, or appending.',
      'Use if_exists: "error" to fail if file already exists.',
      'Use if_exists: "append" to append content to existing files.',
      'Use create_dirs: true to create parent directories.',
    ],
    parameters: writeSchema,
    async execute(_toolCallId, params: WriteToolParams, _signal, _onUpdate, ctx) {
      const mode = params.mode ?? 'json';
      const ifExists = (params.if_exists ?? 'overwrite') as 'overwrite' | 'error' | 'append';
      const createDirs = params.create_dirs === true || params.create_dirs === 'true';

      // Resolve path
      const requestedPath = params.path.startsWith('@') ? params.path.slice(1) : params.path;
      const absolutePath = resolve(ctx.cwd, requestedPath);

      // Check if file exists
      const fileExists = existsSync(absolutePath);

      // Check parent directory
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

      // Handle existing file
      if (fileExists) {
        // Check if it's a directory
        try {
          const stats = statSync(absolutePath);
          if (stats.isDirectory()) {
            return {
              content: [{ type: 'text', text: error('invalid-params', `Path is a directory, not a file: ${absolutePath}`, { tool: 'write', path: absolutePath }).message }],
              isError: true,
              details: { errorType: 'invalid-params', path: absolutePath },
            };
          }
        } catch {
          return {
            content: [{ type: 'text', text: error('permission-denied', `Cannot access file: ${absolutePath}`, { tool: 'write', path: absolutePath }).message }],
            isError: true,
            details: { errorType: 'permission-denied', path: absolutePath },
          };
        }

        if (ifExists === 'error') {
          return {
            content: [{ type: 'text', text: error('not-found', `File already exists: ${absolutePath}. Use if_exists: "overwrite" or "append".`, { tool: 'write', path: absolutePath }).message }],
            isError: true,
            details: { errorType: 'not-found', path: absolutePath },
          };
        }

        // Read existing content for before anchors and diff
        let oldContent: string;
        try {
          oldContent = readFileSync(absolutePath, 'utf-8');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text', text: error('permission-denied', `Cannot read existing file: ${absolutePath} — ${msg}`, { tool: 'write', path: absolutePath }).message }],
            isError: true,
            details: { errorType: 'permission-denied', path: absolutePath },
          };
        }

        // Get before anchors
        let beforeAnchors: Array<{ line: number; anchor: string }> | null = [];
        try {
          const lhResult = await linehashRead(absolutePath);
          if (lhResult.exitCode === 0) {
            const parsed = parseLineHash(lhResult.stdout);
            beforeAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
          } else {
            beforeAnchors = null;
          }
        } catch {
          beforeAnchors = null;
        }

        if (ifExists === 'overwrite') {
          // Compute diff
          const diff = computeDiff(oldContent, params.content);

          // Write file
          let bytesWritten: number;
          try {
            writeFileSync(absolutePath, params.content, 'utf-8');
            bytesWritten = Buffer.byteLength(params.content, 'utf-8');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text', text: error('permission-denied', `Cannot write file: ${absolutePath} — ${msg}`, { tool: 'write', path: absolutePath }).message }],
              isError: true,
              details: { errorType: 'permission-denied', path: absolutePath },
            };
          }

          // Get after anchors
          let afterAnchors: Array<{ line: number; anchor: string }> = [];
          try {
            const lhResult = await linehashRead(absolutePath);
            if (lhResult.exitCode === 0) {
              const parsed = parseLineHash(lhResult.stdout);
              afterAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
            }
          } catch {
            // If linehash fails after write, still return success with empty anchors
          }

          const result: WriteToolResult = {
            path: absolutePath,
            created: false,
            overwritten: true,
            appended: false,
            bytesWritten,
            linesWritten: countLines(params.content),
            beforeAnchors: beforeAnchors && beforeAnchors.length > 0 ? beforeAnchors : null,
            afterAnchors,
            diff: diff || null,
            source: 'linehash',
            backend: 'linehash+nu',
            mode,
          };

          // Format output based on display mode
          const display = (params.display ?? 'compact') as DisplayMode;
          const compactResult: WriteCompactResult = {
            path: absolutePath,
            created: false,
            overwritten: true,
            appended: false,
            bytesWritten,
            linesWritten: result.linesWritten,
          };
          let userText: string;
          let tokenSavings: number | undefined;

          if (display === 'compact' || display === 'auto') {
            userText = formatWriteCompact(compactResult);
          } else {
            // Table/Full: rich content only (diff if available, or summary)
            if (diff) {
              userText = diff;
            } else {
              userText = formatWriteCompact(compactResult);
            }
          }

          return {
            content: [{ type: 'text', text: userText }],
            details: { ...result, tokenSavings },
          };
        } else if (ifExists === 'append') {
          // Append content
          let bytesWritten: number;
          try {
            appendFileSync(absolutePath, params.content, 'utf-8');
            bytesWritten = Buffer.byteLength(params.content, 'utf-8');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text', text: error('permission-denied', `Cannot append to file: ${absolutePath} — ${msg}`, { tool: 'write', path: absolutePath }).message }],
              isError: true,
              details: { errorType: 'permission-denied', path: absolutePath },
            };
          }

          // Get after anchors (full file after append)
          let afterAnchors: Array<{ line: number; anchor: string }> = [];
          try {
            const lhResult = await linehashRead(absolutePath);
            if (lhResult.exitCode === 0) {
              const parsed = parseLineHash(lhResult.stdout);
              afterAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
            }
          } catch {
            // If linehash fails after write, still return success with empty anchors
          }

          const result: WriteToolResult = {
            path: absolutePath,
            created: false,
            overwritten: false,
            appended: true,
            bytesWritten,
            linesWritten: countLines(params.content),
            beforeAnchors: beforeAnchors && beforeAnchors.length > 0 ? beforeAnchors : null,
            afterAnchors,
            diff: null,
            source: 'linehash',
            backend: 'linehash+nu',
            mode,
          };

          // Format output based on display mode
          const display = (params.display ?? 'compact') as DisplayMode;
          const compactResult: WriteCompactResult = {
            path: absolutePath,
            created: false,
            overwritten: false,
            appended: true,
            bytesWritten,
            linesWritten: result.linesWritten,
          };
          let userText: string;
          let tokenSavings: number | undefined;

          if (display === 'compact' || display === 'auto') {
            userText = formatWriteCompact(compactResult);
          } else {
            // Table/Full: rich content only (summary)
            userText = formatWriteCompact(compactResult);
          }

          return {
            content: [{ type: 'text', text: userText }],
            details: { ...result, tokenSavings },
          };
        }
      }

      // File does not exist — create it
      let bytesWritten: number;
      try {
        writeFileSync(absolutePath, params.content, 'utf-8');
        bytesWritten = Buffer.byteLength(params.content, 'utf-8');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: error('permission-denied', `Cannot create file: ${absolutePath} — ${msg}`, { tool: 'write', path: absolutePath }).message }],
          isError: true,
          details: { errorType: 'permission-denied', path: absolutePath },
        };
      }

      // Get after anchors
      let afterAnchors: Array<{ line: number; anchor: string }> = [];
      try {
        const lhResult = await linehashRead(absolutePath);
        if (lhResult.exitCode === 0) {
          const parsed = parseLineHash(lhResult.stdout);
          afterAnchors = parsed.records.map(r => ({ line: r.line, anchor: r.anchor }));
        }
      } catch {
        // If linehash fails after write, still return success with empty anchors
      }

      const result: WriteToolResult = {
        path: absolutePath,
        created: true,
        overwritten: false,
        appended: false,
        bytesWritten,
        linesWritten: countLines(params.content),
        beforeAnchors: null,
        afterAnchors,
        diff: null,
        source: 'linehash',
        backend: 'linehash+nu',
        mode,
      };

      // Format output based on display mode
      const display = (params.display ?? 'compact') as DisplayMode;
      const compactResult: WriteCompactResult = {
        path: absolutePath,
        created: true,
        overwritten: false,
        appended: false,
        bytesWritten,
        linesWritten: result.linesWritten,
      };
      let userText: string;
      let tokenSavings: number | undefined;

      if (display === 'compact' || display === 'auto') {
        userText = formatWriteCompact(compactResult);
      } else {
        // Table/Full: rich content only (summary + diff if available)
        const action = compactResult.created ? 'created' : compactResult.overwritten ? 'overwritten' : compactResult.appended ? 'appended' : 'wrote';
        let text = `${action} — ${compactResult.bytesWritten} bytes, ${compactResult.linesWritten} ${(compactResult.linesWritten) === 1 ? 'line' : 'lines'}`;
        userText = text;
      }

      return {
        content: [{ type: 'text', text: userText }],
        details: { ...result, tokenSavings },
      };
    },
    renderResult(result, { expanded }, theme, _context) {
      const details = result as { details?: { created?: boolean; overwritten?: boolean; appended?: boolean; bytesWritten?: number; linesWritten?: number; path?: string; diff?: string | null; afterAnchors?: Array<{ line: number; anchor: string }>; beforeAnchors?: Array<{ line: number; anchor: string }> } };
      const d = details.details ?? {};
      const action = d.created ? 'created' : d.overwritten ? 'overwritten' : d.appended ? 'appended' : 'wrote';
      const lines = (d.linesWritten ?? 0) === 1 ? 'line' : 'lines';

      let text: string;
      if (expanded) {
        // Expanded mode: rich content only (diff if available, or anchors/count metadata)
        if (d.diff) {
          text = formatDiffForTui(d.diff, theme as { fg: (color: unknown, text: string) => string });
        } else {
          text = `${action} — ${d.bytesWritten ?? 0} bytes, ${d.linesWritten ?? 0} ${lines}`;
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
        text = `${action} — ${d.bytesWritten ?? 0} bytes, ${d.linesWritten ?? 0} ${lines}`;
      }
      return new Text(text, 0, 0);
    },
  });
}
