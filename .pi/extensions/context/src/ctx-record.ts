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
import { encodeToon, type ToonMode } from '../../_shared/toon.js';
import { error } from '../../_shared/output.js';

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
 * Register the ctx_record tool with pi.
 */
export function registerCtxRecordTool(pi: ExtensionAPI) {
  const schema = Type.Object({
    type: Type.String({ description: 'Record type (e.g., decision, verified, files-changed, commands-run, blockers, handoff, next-actions)' }),
    title: Type.Optional(Type.String({ description: 'Short title for the record' })),
    data: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Arbitrary structured data' })),
    target: Type.Optional(Type.Literal('repo', { description: 'Target scope (always "repo" for now)' })),
    tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags to categorize the record' })),
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
      'Append a durable context record to .pi-context/events.jsonl. '
      + 'Records survive Pi session restarts and provide git-native work memory. '
      + 'Use for decisions, verified facts, files changed, commands/tests run, '
      + 'blockers, handoff notes, and next actions.',
    promptSnippet: 'ctx_record(type: "decision", title: "Use eza for ls", data: { rationale: "Better defaults" })',
    promptGuidelines: [
      'Use ctx_record for durable events: decisions, verified facts, files changed, commands/tests run, blockers, handoff notes, next actions.',
      'Do not record every read/search/list result.',
      'Prefer repo-local context (.pi-context/).',
      'Use ctx_packet before handoff, compaction, restart, or review.',
    ],
    parameters: schema,
    async execute(_toolCallId, params: CtxRecordParams, _signal, _onUpdate, ctx) {
      const mode = (params.mode ?? 'json') as ToonMode;
      const type = params.type;
      const title = params.title || '';
      const data = params.data || {};
      const tags = params.tags || [];
      const target = params.target || 'repo';

      // Resolve repo root — fall back to ctx.cwd when no .git is found
      const repoRoot = resolveGitRoot(ctx.cwd) || ctx.cwd;
      const hasGit = resolveGitRoot(ctx.cwd) !== null;

      // Resolve .pi-context directory
      const piContextDir = resolvePiContextDir(repoRoot);
      const eventsPath = join(piContextDir, 'events.jsonl');

      // Get git commit — null when no git repo
      const gitCommit = hasGit ? getGitCommit(repoRoot) : null;

      // Generate record
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

      // Append to JSONL
      appendFileSync(eventsPath, JSON.stringify(record) + '\n');

      // Format output
      const result: CtxRecordResult = {
        ...record,
        mode,
      };
      const llmEncoded = encodeToon(result, { mode });

      // User text: short confirmation
      const userText = `Recorded ${type} ${id}${title ? ` — ${title}` : ''}`;

      return {
        content: [{ type: 'text', text: userText }],
        details: {
          ...result,
          tokenSavings: llmEncoded.tokenSavings,
        },
      };
    },
  });
}
