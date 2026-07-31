/**
 * `ctx_record` tool — Durable git-native context recording.
 *
 * Appends structured JSONL records to `.pi-context/events.jsonl`
 * for durable context that survives Pi session restarts.
 */
import { Type } from '@sinclair/typebox';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { encodeToon, type ToonMode } from './toon.js';
import { error } from './output.js';

/** Resolve git root by walking up from cwd. */
function resolveGitRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Get current git commit hash. */
function getGitCommit(repoRoot: string): string | null {
  try {
    const { execSync } = require('child_process');
    const hash = execSync(`git rev-parse HEAD 2>/dev/null || true`, {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    return hash || null;
  } catch {
    return null;
  }
}

/** Generate a deterministic ID from timestamp + type + title. */
function generateId(type: string, title: string, timestamp: string): string {
  const input = `${timestamp}-${type}-${title}`;
  // Simple hash: use first 12 chars of base64 of sha256
  try {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(input).digest('hex');
    return hash.slice(0, 12);
  } catch {
    // Fallback: use timestamp suffix
    return timestamp.replace(/[:.]/g, '').slice(-12);
  }
}

/** Resolve .pi-context directory. */
function resolvePiContextDir(repoRoot: string): string {
  const ctxDir = join(repoRoot, '.pi-context');
  if (!existsSync(ctxDir)) {
    mkdirSync(ctxDir, { recursive: true });
  }
  return ctxDir;
}

export interface CtxRecordParams {
  type: string;
  title?: string;
  data?: Record<string, unknown>;
  target?: 'repo';
  tags?: string[];
  mode?: ToonMode;
}

export interface CtxRecordResult {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  data: Record<string, unknown>;
  tags: string[];
  cwd: string;
  repoRoot: string;
  gitCommit: string | null;
  path: string;
  source: 'ctx_record';
  backend: 'jsonl+nu';
  mode: ToonMode;
}

/**
 * Exported executeCtxRecordOp for invocation harnesses & tool dispatchers.
 */
export async function executeCtxRecordOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() }
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeCtxRecordOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeCtxRecordOp(_toolCallId, op, _signal, _onUpdate, ctx))
    );
    const allOk = results.every(r => !(r as any).isError);
    const recordMap: Record<string, unknown> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const opSpec = params.ops[i];
      const key = opSpec.title ?? opSpec.type ?? `record_${i}`;
      const d = (r as any).details ?? {};
      recordMap[key] = d;
    }
    return {
      content: [{ type: 'text' as const, text: encodeToon({ ctx_record: recordMap }).text }],
      details: {
        records: results.map(r => (r as any).details),
        totalRecords: params.ops.length,
      },
      ...(!allOk ? { isError: true } : {}),
    };
  }

  const mode = (params.mode ?? 'json') as ToonMode;
  const type = params.type || 'note';
  const title = params.title || '';
  const data = params.data || {};
  const tags = params.tags || [];

  const repoRoot = resolveGitRoot(ctx.cwd) || ctx.cwd;
  const hasGit = resolveGitRoot(ctx.cwd) !== null;

  const piContextDir = resolvePiContextDir(repoRoot);
  const eventsPath = join(piContextDir, 'events.jsonl');
  const gitCommit = hasGit ? getGitCommit(repoRoot) : null;

  const timestamp = new Date().toISOString();
  const id = generateId(type, title, timestamp);
  const record: CtxRecordResult = {
    id,
    timestamp,
    type,
    title,
    data,
    tags,
    cwd: ctx.cwd,
    repoRoot,
    gitCommit,
    path: eventsPath,
    source: 'ctx_record',
    backend: 'jsonl+nu',
    mode: 'json',
  };

  appendFileSync(eventsPath, JSON.stringify(record) + '\n');

  const result: CtxRecordResult = {
    ...record,
    mode,
  };
  const llmEncoded = encodeToon(result, { mode });
  const userText = `Recorded ${type} ${id}${title ? ` — ${title}` : ''}`;

  return {
    content: [{ type: 'text', text: userText }],
    details: {
      ...result,
      tokenSavings: llmEncoded.tokenSavings,
    },
  };
}

/**
 * Register the ctx_record tool with pi.
 */
export function registerCtxRecordTool(pi: ExtensionAPI) {
  const ctxRecordItemSchema = Type.Object({
    type: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    tags: Type.Optional(Type.Array(Type.String())),
    mode: Type.Optional(Type.String()),
  });

  const schema = Type.Object({
    ops: Type.Optional(Type.Array(ctxRecordItemSchema, { description: 'ctx_record operations array' })),
    type: Type.Optional(Type.String({ description: 'Record type (e.g., decision, blocker, verification)' })),
    title: Type.Optional(Type.String({ description: 'Short description of the event' })),
    data: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Arbitrary JSON payload' })),
    tags: Type.Optional(Type.Array(Type.String(), { description: 'Filter/search tags' })),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('toon', { description: 'TOON format for LLM' }),
        Type.Literal('json', { description: 'JSON format for LLM' }),
      ], { description: 'Output format for LLM (defaults to json)' })
    ),
  });

  pi.registerTool({
    name: 'ctx_record',
    label: 'Context Record',
    description:
      'Record a structured event into .pi-context/events.jsonl. '
      + 'Pass ops: [{type: "decision", title: "..."}].',
    promptSnippet: 'ctx_record(type: "decision", title: "Use Islands Architecture")',
    promptGuidelines: [
      'Pass ops: [{type: "decision", title: "..."}].',
      'Record key decisions, verification evidence, blockers, and next actions.',
      'Prefer repo-local context (.pi-context/).',
      'Use ctx_packet before handoff, compaction, restart, or review.',
    ],
    parameters: schema,
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      return executeCtxRecordOp(toolCallId, params, signal, onUpdate as any, ctx) as any;
    },
  });
}
