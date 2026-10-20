/**
 * `ctx_packet` tool — Deterministic context packet generation.
 *
 * Reads recent records from `.pi-context/events.jsonl`,
 * generates a structured summary packet, and appends it
 * to `.pi-context/packets.jsonl`.
 */
import { Type } from '@sinclair/typebox';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
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

/** Resolve .pi-context directory. */
function resolvePiContextDir(repoRoot: string): string | null {
  const ctxDir = join(repoRoot, '.pi-context');
  if (!existsSync(ctxDir)) return null;
  return ctxDir;
}

/** Read and parse JSONL file. Returns empty array if file missing. */
function readJsonl(filePath: string): Record<string, unknown>[] {
  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    return content.split('\n').filter(l => l.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/** Generate a deterministic packet ID from record IDs. */
function generatePacketId(records: Record<string, unknown>[]): string {
  // Use sorted record IDs for determinism (no timestamp dependency)
  const ids = records.map(r => r.id as string).filter(Boolean).sort();
  const input = ids.join(',');
  try {
    const { createHash } = require('crypto');
    const hash = createHash('sha256').update(input).digest('hex');
    return hash.slice(0, 12);
  } catch {
    return input.slice(-12) || 'empty';
  }
}

/**
 * Generate deterministic packet sections from records.
 * No LLM summarization — purely rule-based extraction.
 */
function generatePacketSections(records: Record<string, unknown>[]): {
  recentDecisions: string[];
  recentVerification: string[];
  filesChanged: string[];
  commandsTestsRun: string[];
  blockers: string[];
  nextActions: string[];
  otherEvents: Record<string, string[]>;
} {
  const sections = {
    recentDecisions: [] as string[],
    recentVerification: [] as string[],
    filesChanged: [] as string[],
    commandsTestsRun: [] as string[],
    blockers: [] as string[],
    nextActions: [] as string[],
    otherEvents: {} as Record<string, string[]>,
  };

  for (const rec of records) {
    const type = (rec.type as string) || 'other';
    const title = (rec.title as string) || '';
    const data = (rec.data as Record<string, unknown>) || {};
    const entry = title || `${type} @ ${rec.timestamp}`;

    switch (type) {
      case 'decision':
        sections.recentDecisions.push(entry);
        break;
      case 'verified':
        sections.recentVerification.push(entry);
        break;
      case 'files-changed':
        sections.filesChanged.push(entry);
        break;
      case 'commands-run':
      case 'tests-run':
        sections.commandsTestsRun.push(entry);
        break;
      case 'blocker':
        sections.blockers.push(entry);
        break;
      case 'next-actions':
        sections.nextActions.push(entry);
        break;
      default:
        if (!sections.otherEvents[type]) {
          sections.otherEvents[type] = [];
        }
        sections.otherEvents[type].push(entry);
    }
  }

  return sections;
}

export interface CtxPacketParams {
  limit?: number | string;
  includeTypes?: string[];
  mode?: ToonMode;
}

export interface CtxPacketResult {
  packetId: string;
  timestamp: string;
  repoRoot: string;
  gitCommit: string | null;
  sourceEventIds: string[];
  summary: string;
  sections: {
    recentDecisions: string[];
    recentVerification: string[];
    filesChanged: string[];
    commandsTestsRun: string[];
    blockers: string[];
    nextActions: string[];
    otherEvents: Record<string, string[]>;
  };
  path: string;
  backend: 'jsonl+nu';
  mode: ToonMode;
  totalEventsProcessed?: number;
  filteredCount?: number;
  eventTypesIncluded?: string[];
}

/**
 * Exported executeCtxPacketOp for invocation harnesses & tool dispatchers.
 */
export async function executeCtxPacketOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() }
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeCtxPacketOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeCtxPacketOp(_toolCallId, op, _signal, _onUpdate, ctx))
    );
    const allOk = results.every(r => !(r as any).isError);
    const packetMap: Record<string, unknown> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const opSpec = params.ops[i];
      const key = opSpec.limit ? `limit_${opSpec.limit}` : `packet_${i}`;
      const d = (r as any).details ?? {};
      packetMap[key] = d;
    }
    return {
      content: [{ type: 'text' as const, text: encodeToon({ ctx_packet: packetMap }).text }],
      details: {
        packets: results.map(r => (r as any).details),
        totalPackets: params.ops.length,
      },
      ...(!allOk ? { isError: true } : {}),
    };
  }

  const mode = (params.mode ?? 'json') as ToonMode;
  const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : (params.limit ?? 50);
  const includeTypes = params.includeTypes;

  const repoRoot = resolveGitRoot(ctx.cwd) || ctx.cwd;
  const piContextDir = resolvePiContextDir(repoRoot);
  
  if (!piContextDir) {
    return {
      content: [{ type: 'text', text: 'No .pi-context directory found.' }],
      details: { found: false, repoRoot, path: null },
    };
  }

  const eventsPath = join(piContextDir, 'events.jsonl');
  const packetsPath = join(piContextDir, 'packets.jsonl');

  const records = readJsonl(eventsPath);

  let filtered = records;
  if (includeTypes && includeTypes.length > 0) {
    const allowed = new Set(includeTypes);
    filtered = filtered.filter(r => allowed.has(r.type as string));
  }

  if (limit > 0 && filtered.length > limit) {
    filtered = filtered.slice(-limit);
  }

  const sections = generatePacketSections(filtered);

  const packetId = generatePacketId(filtered);
  const timestamp = new Date().toISOString();
  const gitCommit = getGitCommit(repoRoot);
  const sourceEventIds = filtered.map(r => r.id as string).filter(Boolean);

  const totalEventsProcessed = records.length;
  const eventTypesIncluded = [...new Set(filtered.map(r => r.type as string))];

  const totalEventsFormatted =
    sections.recentDecisions.length
    + sections.recentVerification.length
    + sections.filesChanged.length
    + sections.commandsTestsRun.length
    + sections.blockers.length
    + sections.nextActions.length
    + Object.values(sections.otherEvents).reduce((a, b) => a + b.length, 0);

  const summary = `${totalEventsFormatted} structured items from ${filtered.length} events`;

  const packetLine: Record<string, unknown> = {
    packetId,
    timestamp,
    repoRoot,
    gitCommit,
    sourceEventIds,
    summary,
    sections,
    source: 'ctx_packet',
    backend: 'jsonl+nu',
  };

  try {
    appendFileSync(packetsPath, JSON.stringify(packetLine) + '\n', 'utf-8');
  } catch {
    // Return with found=false if write fails
  }

  const result: CtxPacketResult = {
    packetId,
    timestamp,
    repoRoot,
    gitCommit,
    sourceEventIds,
    summary,
    totalEventsProcessed,
    filteredCount: filtered.length,
    eventTypesIncluded,
    sections,
    path: packetsPath,
    backend: 'jsonl+nu',
    mode,
  };
  const llmEncoded = encodeToon(result, { mode });

  return {
    content: [{ type: 'text', text: `Context packet generated and saved: ${packetId}\nSummary: ${summary}\nPath: ${packetsPath}` }],
    details: {
      ...result,
      tokenSavings: llmEncoded.tokenSavings,
    },
  };
}

/**
 * Register the ctx_packet tool with pi.
 */
export function registerCtxPacketTool(pi: ExtensionAPI) {
  const ctxPacketItemSchema = Type.Object({
    limit: Type.Optional(Type.Union([Type.Number(), Type.String()])),
    includeTypes: Type.Optional(Type.Array(Type.String())),
    mode: Type.Optional(Type.String()),
  });

  const schema = Type.Object({
    ops: Type.Optional(Type.Array(ctxPacketItemSchema, { description: 'ctx_packet operations array' })),
    limit: Type.Optional(
      Type.Union([
        Type.Number({ description: 'Maximum number of recent records to include' }),
        Type.String({ description: 'Maximum number of recent records to include' }),
      ], { description: 'Limit the number of recent records (default 50)' })
    ),
    includeTypes: Type.Optional(Type.Array(Type.String(), { description: 'Filter to only these record types' })),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('toon', { description: 'TOON format for LLM' }),
        Type.Literal('json', { description: 'JSON format for LLM' }),
      ], { description: 'Output format for LLM (defaults to json)' })
    ),
  });

  pi.registerTool({
    name: 'ctx_packet',
    label: 'Context Packet',
    description:
      'Generate a deterministic context packet from recent .pi-context records. '
      + 'Pass ops: [{limit?: 30}].',
    promptSnippet: 'ctx_packet(limit: 30, includeTypes: ["decision", "blocker"])',
    parameters: schema,
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      return executeCtxPacketOp(toolCallId, params, signal, onUpdate as any, ctx) as any;
    },
  });
}
