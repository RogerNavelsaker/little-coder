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
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { encodeToon, type ToonMode } from '../../_shared/toon.js';
import { parseLineHash, extractText, type LineHashRecord } from '../../_shared/linehash.js';
import { error } from '../../_shared/output.js';
import { loadSettings } from '../../_shared/settings.js';
import { type DisplayMode, formatReadCompact, formatReadTableMarkdown, formatReadTablePlain, renderMarkdown } from '../../_shared/display.js';
import { type Component, Markdown, Text } from '@earendil-works/pi-tui';

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

export interface ReadToolParams {
  path: string;
  mode?: ToonMode;
  offset?: number | string;
  limit?: number | string;
  after_anchor?: string;
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
  /** Output mode used */
  mode: ToonMode;
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
 * Register the read tool with pi.
 *
 * @param pi - Pi extension API
 * @param options - Optional configuration
 */
export function registerReadTool(pi: ExtensionAPI, options: ReadToolOptions = {}) {
  const readSchema = Type.Object({
    path: Type.String({ description: 'File path to read (relative or absolute)' }),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('toon', { description: 'TOON format (compact, 30-60% token savings)' }),
        Type.Literal('json', { description: 'Pretty-printed JSON' }),
        Type.Literal('raw', { description: 'Raw text content' }),
      ], { description: 'Output format: toon, json, or raw' })
    ),
    offset: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Start line (1-indexed)' }),
        Type.String({ description: 'Start line (1-indexed)' }),
      ], { description: 'Start reading from this line (line-number based). Future: linehash --offset flag.' })
    ),
    after_anchor: Type.Optional(
      Type.String({ description: 'Anchor hash to start after (exclusive)' }),
    ),
    limit: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Maximum number of lines to read' }),
        Type.String({ description: 'Maximum number of lines to read' }),
      ], { description: 'Limit the number of lines returned' })
    ),
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
      'Read file contents with structured line-level output. '
      + 'Returns line anchors for change detection and follow-up edits. '
      + 'Supports compact (TOON), JSON, and raw text output modes.',
    promptSnippet: 'Read file contents with line anchors for edits',
    promptGuidelines: [
      'Use read before editing a file or when exact content matters.',
      'Use mode: "toon" for compact output that reduces token usage.',
      'Use mode: "json" for structured data processing.',
      'Use mode: "raw" for plain text content.',
      'Keep returned anchors available for follow-up edits.',
      'Use offset/limit for large files to stay within visible budgets.',
    ],
    parameters: readSchema,
    async execute(_toolCallId, params: ReadToolParams, _signal, _onUpdate, ctx) {
      const requestedPath = params.path.startsWith('@') ? params.path.slice(1) : params.path;
      const absolutePath = resolve(ctx.cwd, requestedPath);
      const mode = (params.mode ?? 'json') as ToonMode;

      // Validate file exists
      if (!existsSync(absolutePath)) {
        return {
          content: [{
            type: 'text',
            text: error('not-found', `File not found: ${absolutePath}`, {
              tool: 'read',
              path: absolutePath,
              mode,
            }).message,
          }],
          isError: true,
          details: {
            errorType: 'not-found',
            path: absolutePath,
            mode,
          },
        };
      }

      // Validate file is readable
      try {
        const stats = statSync(absolutePath);
        if (stats.isDirectory()) {
          return {
            content: [{
              type: 'text',
              text: error('invalid-params', `Path is a directory, not a file: ${absolutePath}`, {
                tool: 'read',
                path: absolutePath,
                mode,
              }).message,
            }],
            isError: true,
            details: {
              errorType: 'invalid-params',
              path: absolutePath,
              mode,
            },
          };
        }
      } catch {
        return {
          content: [{
            type: 'text',
            text: error('permission-denied', `Cannot read file: ${absolutePath}`, {
              tool: 'read',
              path: absolutePath,
              mode,
            }).message,
          }],
          isError: true,
          details: {
            errorType: 'permission-denied',
            path: absolutePath,
            mode,
          },
        };
      }

      // Validate and parse offset/limit
      let offset: number | undefined;
      let limit: number | undefined;

      if (params.offset !== undefined) {
        const rawOffset = typeof params.offset === 'string' ? parseInt(params.offset, 10) : params.offset;
        if (!Number.isFinite(rawOffset) || rawOffset < 1 || Number.isNaN(rawOffset)) {
          return {
            content: [{
              type: 'text',
              text: error('invalid-params', `offset must be a finite integer >= 1, got: ${JSON.stringify(params.offset)}`, {
                tool: 'read',
                path: absolutePath,
                mode,
              }).message,
            }],
            isError: true,
            details: {
              errorType: 'invalid-params',
              path: absolutePath,
              mode,
              param: 'offset',
              value: params.offset,
            },
          };
        }
        offset = rawOffset;
      }

      if (params.limit !== undefined) {
        const rawLimit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit;
        if (!Number.isFinite(rawLimit) || rawLimit < 0 || Number.isNaN(rawLimit)) {
          return {
            content: [{
              type: 'text',
              text: error('invalid-params', `limit must be a finite integer >= 0, got: ${JSON.stringify(params.limit)}`, {
                tool: 'read',
                path: absolutePath,
                mode,
              }).message,
            }],
            isError: true,
            details: {
              errorType: 'invalid-params',
              path: absolutePath,
              mode,
              param: 'limit',
              value: params.limit,
            },
          };
        }
        limit = rawLimit;
      }

      // Load settings
      const { settings, warnings } = loadSettings(ctx.cwd);
      const settingsWarning = warnings.length > 0 ? warnings.join('; ') : undefined;

      // Phase 20: Apply visible budgets
      const maxLines = settings.readMaxVisibleLines;
      const maxBytes = settings.readMaxVisibleBytes;

      // If no explicit limit was set, apply the budget as a sensible default
      let effectiveLimit: number | undefined = limit;
      if (effectiveLimit === undefined) {
        effectiveLimit = maxLines;
      }

      // Execute linehash with offset/after_anchor/effective_limit
      let result: { stdout: string; stderr: string; exitCode: number };
      try {
        result = await executeLinehash(absolutePath, offset, params.after_anchor, effectiveLimit);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: 'text',
            text: error('binary-failed', `linehash execution failed: ${errorMessage}`, {
              tool: 'read',
              path: absolutePath,
              mode,
            }).message,
          }],
          isError: true,
          details: {
            errorType: 'binary-failed',
            path: absolutePath,
            mode,
            stderr: errorMessage,
          },
        };
      }

      // Check for binary errors
      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text',
            text: error('binary-failed', `linehash exited with code ${result.exitCode}: ${result.stderr.trim()}`, {
              tool: 'read',
              path: absolutePath,
              mode,
            }).message,
          }],
          isError: true,
          details: {
            errorType: 'binary-failed',
            path: absolutePath,
            mode,
            exitCode: result.exitCode,
            stderr: result.stderr.trim(),
          },
        };
      }

      // Get total file lines for truncation detection
      const totalFileLines = (await executeCommand('wc', ['-l', absolutePath])).stdout.trim();
      const fileTotalLines = parseInt(totalFileLines.split('\n')[0]?.trim() ?? '0', 10);

      // Parse linehash output
      let parsed2: ReturnType<typeof parseLineHash>;
      try {
        parsed2 = parseLineHash(result.stdout);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: 'text',
            text: error('parse-error', `Failed to parse linehash output: ${errorMessage}`, {
              tool: 'read',
              path: absolutePath,
              mode,
            }).message,
          }],
          isError: true,
          details: {
            errorType: 'parse-error',
            path: absolutePath,
            mode,
            stderr: errorMessage,
          },
        };
      }

      const slicedRecords = parsed2.records;
      const content = extractText(slicedRecords);

      // Call onSuccessfulRead callback if provided
      if (options.onSuccessfulRead) {
        options.onSuccessfulRead(absolutePath);
      }

      // Determine truncation: true only when file is actually truncated (not all lines shown)
      const truncated = slicedRecords.length >= maxLines || content.length > maxBytes;
      const recoveryHint = slicedRecords.length >= maxLines
        ? `Use offset/limit to read other sections. Example: offset: ${slicedRecords.length + 1}, limit: ${maxLines}.`
        : '';

      // --- User-facing text output ---
      // Phase 21: auto/compact both use compact for content.text; renderResult handles expansion
      const display = (params.display ?? 'auto') as DisplayMode;
      let userText: string;

      if (display === 'compact' || display === 'auto') {
        // Compact: summary line + preview with omitted-lines affordance
        // Use linehash totalLines as source of truth; fallback to wc -l when unknown
        const effectiveTotalLines = parsed2.totalLines > 0 ? parsed2.totalLines : fileTotalLines;
        const compactPreview = slicedRecords.slice(0, 3).map(r => ({ line: r.line, text: r.text }));
        const compactResult = {
          totalLines: effectiveTotalLines,
          returnedLines: slicedRecords.length,
          truncated,
          recoveryHint,
          previewLines: compactPreview,
          maxPreviewLines: 3,
        };
        userText = formatReadCompact(compactResult);
      } else if (display === 'table') {
        // Table: Markdown table (plain fallback)
        userText = formatReadTablePlain(slicedRecords);
      } else {
        // Full: table-only (no compact summary) — expanded view should focus on table
        if (slicedRecords.length > 0) {
          userText = formatReadTablePlain(slicedRecords);
        } else {
          userText = '(empty file)';
        }
      }

      if (truncated && recoveryHint) {
        userText += `\n\n[truncated: ${slicedRecords.length} lines shown, ${fileTotalLines} total. ${recoveryHint}]`;
      }

      // --- LLM-facing TOON/JSON in details ---
      const llmResult = {
        path: absolutePath,
        totalLines: parsed2.totalLines,
        returnedLines: slicedRecords.length,
        records: slicedRecords.map(r => ({ line: r.line, anchor: r.anchor, text: r.text })),
        content,
        visibleBudget: { maxLines, maxBytes },
        truncated,
        recoveryHint,
        ...(settingsWarning ? { settingsWarning } : {}),
      };
      const llmEncoded = encodeToon(llmResult, { mode });
      const backendUsed = 'linehash+nu';

      return {
        content: [{ type: 'text', text: userText }],
        details: {
          ...llmResult,
          mode,
          tokenSavings: llmEncoded.tokenSavings,
          source: 'linehash',
          backend: backendUsed,
        },
      };
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) return new Text(theme.fg('warning', 'Running...'), 0, 0) as unknown as Component;

      const details = result as {
        details?: {
          totalLines?: number;
          returnedLines?: number;
          truncated?: boolean;
          records?: Array<{ line: number; anchor: string; text: string }>;
          path?: string;
        };
      };
      const recs = details.details?.records ?? [];
      const totalLines = details.details?.totalLines ?? 0;
      const returnedLines = details.details?.returnedLines ?? 0;
      const truncated = details.details?.truncated ?? false;

      // Phase 21: expanded mode is table-only for all modes except compact
      const displayParam = (result as { params?: { display?: DisplayMode } }).params?.display;
      const isCompact = displayParam === 'compact';
      const showFull = expanded && !isCompact;

      let text: string;
      if (showFull && recs.length > 0) {
        // Expanded mode (auto/full/table): table-only, no redundant compact summary
        text = formatReadTableMarkdown(recs);
      } else {
        // Collapsed or compact mode: compact summary + truncated hint
        if (truncated) {
          text = `${returnedLines} lines returned from ${totalLines} total (truncated)`;
        } else if (returnedLines < totalLines) {
          text = `${returnedLines} lines returned from ${totalLines} total`;
        } else {
          text = `${totalLines} lines total`;
        }
      }

      return renderMarkdown(text, theme as { fg: (color: unknown, text: string) => string; bold: (text: string) => string; italic: (text: string) => string; strikethrough: (text: string) => string; underline: (text: string) => string; }) as Component;
    },
  });
}
