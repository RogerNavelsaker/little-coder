/**
 * `command-history` tool & extension — per-CWD command history in ~/.pi/folder-history/.
 *
 * Capabilities:
 * 1. Hooks `pi.on('input')` to persist user prompts per-CWD in ~/.pi/folder-history/<slug>_<hash>.jsonl.
 * 2. Provides `command_history` tool for querying, searching, and managing command history.
 * 3. Supports Universal Tool Contract (executeCommandHistoryOp, ops[] schema).
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { homedir } from 'os';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { Text } from '@earendil-works/pi-tui';

export interface HistoryEntry {
  timestamp: string;
  cwd: string;
  text: string;
}

export function getHistoryDir(): string {
  return process.env.PI_FOLDER_HISTORY_DIR || join(homedir(), '.pi', 'folder-history');
}

export function getHistoryFilePath(cwd: string, baseDir = getHistoryDir()): string {
  const hash = createHash('sha256').update(cwd).digest('hex').slice(0, 16);
  const slug = cwd.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-32);
  return join(baseDir, `${slug}_${hash}.jsonl`);
}

export function appendHistoryEntry(cwd: string, text: string, baseDir = getHistoryDir()): void {
  if (!text || !text.trim()) return;
  mkdirSync(baseDir, { recursive: true });
  const filePath = getHistoryFilePath(cwd, baseDir);
  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    cwd,
    text: text.trim(),
  };
  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

export function readHistoryEntries(cwd: string, limit = 50, baseDir = getHistoryDir()): HistoryEntry[] {
  const filePath = getHistoryFilePath(cwd, baseDir);
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const lines = raw.split('\n').filter(Boolean);
    return lines
      .map(l => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter((e): e is HistoryEntry => e !== null)
      .slice(-limit);
  } catch {
    return [];
  }
}

export function clearHistoryEntries(cwd: string, baseDir = getHistoryDir()): boolean {
  const filePath = getHistoryFilePath(cwd, baseDir);
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export const commandHistoryItemSchema = Type.Object({
  action: Type.Optional(Type.Union([
    Type.Literal('list'),
    Type.Literal('search'),
    Type.Literal('clear'),
  ])),
  query: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  cwd: Type.Optional(Type.String()),
});

export const commandHistorySchema = Type.Object({
  ops: Type.Optional(Type.Array(commandHistoryItemSchema, { description: 'Command history operations array' })),
  action: Type.Optional(
    Type.Union([
      Type.Literal('list', { description: 'List recent history entries (default)' }),
      Type.Literal('search', { description: 'Search history for matching substring' }),
      Type.Literal('clear', { description: 'Clear history for the current working directory' }),
    ], { description: 'Action to perform' })
  ),
  query: Type.Optional(Type.String({ description: 'Search query for filtering history' })),
  limit: Type.Optional(Type.Number({ description: 'Maximum number of items to return (default: 20)' })),
  cwd: Type.Optional(Type.String({ description: 'Directory to query history for (default: current cwd)' })),
});

export async function executeCommandHistoryOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() }
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeCommandHistoryOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeCommandHistoryOp(_toolCallId, op, _signal, _onUpdate, ctx))
    );
    const allEntries = results.flatMap((r: any) => r.details?.entries ?? []);
    return {
      content: [{ type: 'text' as const, text: results.map(r => r.content[0].text).join('\n---\n') }],
      isError: false,
      details: {
        totalOps: results.length,
        entries: allEntries,
      },
    };
  }

  const action = params.action ?? 'list';
  const targetCwd = params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd;
  const limit = typeof params.limit === 'number' ? Math.max(1, params.limit) : 20;

  if (action === 'clear') {
    const cleared = clearHistoryEntries(targetCwd);
    const msg = cleared ? `Cleared history for ${targetCwd}` : `No history to clear for ${targetCwd}`;
    return {
      content: [{ type: 'text' as const, text: msg }],
      isError: false,
      details: { action: 'clear', cwd: targetCwd, cleared },
    };
  }

  const entries = readHistoryEntries(targetCwd, 200);

  let filtered = entries;
  if (action === 'search' && params.query) {
    const q = params.query.toLowerCase();
    filtered = filtered.filter(e => e.text.toLowerCase().includes(q));
  }
  const sliced = filtered.slice(-limit);

  const formatted = sliced.map((e, idx) => `[${idx + 1}] (${e.timestamp.slice(11, 19)}) ${e.text}`).join('\n');
  const userText = formatted || `(no command history found for ${targetCwd})`;

  return {
    content: [{ type: 'text' as const, text: userText }],
    isError: false,
    details: {
      action,
      cwd: targetCwd,
      totalEntries: sliced.length,
      entries: sliced,
    },
  };
}

export function registerCommandHistoryTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'command_history',
    label: 'Command History',
    description: 'Inspect, search, and recall per-CWD prompt and command history from ~/.pi/folder-history/.',
    promptSnippet: 'Query and search per-directory command and prompt history',
    promptGuidelines: [
      'Use command_history to review previous user instructions, queries, and commands run in this workspace.',
    ],
    parameters: commandHistorySchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? 'list';
      const q = args?.query ? ` "${args.query}"` : '';
      const text = theme.fg('toolTitle', 'command_history ') + theme.fg('accent', `${action}${q}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const details = result?.details;
      const count = details?.totalEntries ?? 0;
      const text = theme.fg('muted', `History (${count} entries)`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return (executeCommandHistoryOp(toolCallId, params, signal, onUpdate, ctx) as any);
    },
  });

  // Hook input to record commands into folder-history
  pi.on('input', async (event: any, ctx: any) => {
    const text = event?.text || event?.input || '';
    const cwd = ctx?.cwd || process.cwd();
    if (text && typeof text === 'string') {
      appendHistoryEntry(cwd, text);
      if (ctx?.ui?.setStatus) {
        try {
          ctx.ui.setStatus('folder-history', `History saved (${cwd})`);
        } catch { /* ignore */ }
      }
    }
    return undefined;
  });
}
