/**
 * `ctx_inject` tool — Manual injection of context packets into compaction.
 *
 * Reads a packet from `.pi-context/packets.jsonl` and produces an
 * injection-ready text block using stable compaction template headings.
 * Does **not** write files, mutate the active Pi session, or run compaction.
 */
import { Type } from '@sinclair/typebox';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { encodeToon, type ToonMode } from './toon.js';

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

/** Packet sections type (matches ctx_packet output). */
export interface PacketSections {
  recentDecisions: string[];
  recentVerification: string[];
  filesChanged: string[];
  commandsTestsRun: string[];
  blockers: string[];
  nextActions: string[];
  otherEvents: Record<string, string[]>;
}

/** Section mapping: packet section key → template heading. */
interface SectionMapping {
  key: keyof PacketSections;
  heading: string;
  isArray: boolean;
}

const SECTION_MAP: SectionMapping[] = [
  { key: 'recentDecisions', heading: '## Decisions', isArray: true },
  { key: 'filesChanged', heading: '## Files And Anchors', isArray: true },
  { key: 'commandsTestsRun', heading: '## Commands Run', isArray: true },
  { key: 'recentVerification', heading: '## Verification', isArray: true },
  { key: 'blockers', heading: '## Open Risks', isArray: true },
  { key: 'nextActions', heading: '## Next Action', isArray: true },
  { key: 'otherEvents', heading: '## Decisions', isArray: false },
];

export interface InjectPacket {
  packetId: string;
  timestamp: string;
  repoRoot: string;
  gitCommit: string | null;
  sourceEventIds: string[];
  summary: string;
  sections: PacketSections;
  source: string;
  backend: string;
}

export interface CtxInjectParams {
  packetId?: string | null;
  repoRoot?: string;
  mode?: ToonMode;
}

export interface CtxInjectResult {
  packetId: string;
  timestamp: string;
  repoRoot: string;
  gitCommit: string | null;
  packetsPath: string;
  found: boolean;
  headingsIncluded: string[];
  source: 'ctx_inject';
  backend: 'jsonl+nu';
  mode: ToonMode;
}

/**
 * Format a packet into an injection-ready text block.
 * Only includes headings for non-empty sections.
 */
function formatInjectionBlock(packet: InjectPacket): {
  text: string;
  headings: string[];
} {
  const lines: string[] = [];
  const headings: string[] = [];

  const sectionEntries = new Map<string, string[]>();
  for (const { key, heading, isArray } of SECTION_MAP) {
    const section = packet.sections[key];
    if (!section || (isArray ? (section as unknown[]).length === 0 : Object.keys(section).length === 0)) {
      continue;
    }

    const entries = sectionEntries.get(heading) ?? [];
    if (isArray) {
      for (const entry of section as unknown[]) {
        entries.push(String(entry));
      }
    } else {
      // otherEvents — merge into Decisions heading
      const obj = section as Record<string, string[]>;
      for (const values of Object.values(obj)) {
        for (const entry of values) {
          entries.push(entry);
        }
      }
    }
    sectionEntries.set(heading, entries);
  }

  for (const [heading, entries] of sectionEntries.entries()) {
    if (entries.length === 0) continue;
    headings.push(heading);
    if (lines.length > 0) lines.push('');
    lines.push(heading);
    for (const entry of entries) {
      lines.push(`- ${entry}`);
    }
  }

  // Add Packet IDs section (always included if packet found)
  headings.push('## Packet IDs');
  if (lines.length > 0) lines.push('');
  lines.push('## Packet IDs');
  lines.push(`- packetId: ${packet.packetId}`);
  lines.push(`- timestamp: ${packet.timestamp}`);
  lines.push(`- repoRoot: ${packet.repoRoot}`);
  lines.push(`- gitCommit: ${packet.gitCommit ?? 'null'}`);

  return { text: lines.join('\n'), headings };
}

/**
 * Exported executeCtxInjectOp for invocation harnesses & tool dispatchers.
 */
export async function executeCtxInjectOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: { cwd: string } = { cwd: process.cwd() }
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeCtxInjectOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map(op => executeCtxInjectOp(_toolCallId, op, _signal, _onUpdate, ctx))
    );
    const allOk = results.every(r => !(r as any).isError);
    const injectMap: Record<string, unknown> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const opSpec = params.ops[i];
      const key = opSpec.packetId ?? `packet_${i}`;
      const d = (r as any).details ?? {};
      injectMap[key] = d;
    }
    return {
      content: [{ type: 'text' as const, text: encodeToon({ ctx_inject: injectMap }).text }],
      details: {
        injections: results.map(r => (r as any).details),
        totalInjections: params.ops.length,
      },
      ...(!allOk ? { isError: true } : {}),
    };
  }

  const mode = (params.mode ?? 'json') as ToonMode;
  const packetId = params.packetId ?? null;
  const repoRoot = params.repoRoot || ctx.cwd;
  const piContextDir = resolvePiContextDir(repoRoot);
  const packetsPath = join(repoRoot, '.pi-context', 'packets.jsonl');

  if (!piContextDir) {
    const result: CtxInjectResult = {
      packetId: '',
      timestamp: new Date().toISOString(),
      repoRoot,
      gitCommit: null,
      packetsPath,
      found: false,
      headingsIncluded: [],
      source: 'ctx_inject',
      backend: 'jsonl+nu',
      mode,
    };
    const llmEncoded = encodeToon(result, { mode });
    return {
      content: [{ type: 'text', text: 'No .pi-context directory found. Run ctx_packet first.' }],
      details: {
        ...result,
        tokenSavings: llmEncoded.tokenSavings,
      },
    };
  }

  const packets = readJsonl(packetsPath);

  if (packets.length === 0) {
    const result: CtxInjectResult = {
      packetId: '',
      timestamp: new Date().toISOString(),
      repoRoot,
      gitCommit: null,
      packetsPath,
      found: false,
      headingsIncluded: [],
      source: 'ctx_inject',
      backend: 'jsonl+nu',
      mode,
    };
    const llmEncoded = encodeToon(result, { mode });
    return {
      content: [{ type: 'text', text: 'No packets found. Run ctx_packet first.' }],
      details: {
        ...result,
        tokenSavings: llmEncoded.tokenSavings,
      },
    };
  }

  let packet: InjectPacket | null = null;
  if (packetId) {
    const found = packets.find(p => (p.packetId as string) === packetId);
    if (found) {
      packet = {
        packetId: found.packetId as string,
        timestamp: found.timestamp as string,
        repoRoot: found.repoRoot as string,
        gitCommit: (found.gitCommit as string) ?? null,
        sourceEventIds: found.sourceEventIds as string[],
        summary: found.summary as string,
        sections: found.sections as PacketSections,
        source: found.source as string,
        backend: found.backend as string,
      };
    }
  } else {
    const last = packets[packets.length - 1];
    packet = {
      packetId: last.packetId as string,
      timestamp: last.timestamp as string,
      repoRoot: last.repoRoot as string,
      gitCommit: (last.gitCommit as string) ?? null,
      sourceEventIds: last.sourceEventIds as string[],
      summary: last.summary as string,
      sections: last.sections as PacketSections,
      source: last.source as string,
      backend: last.backend as string,
    };
  }

  if (!packet) {
    const result: CtxInjectResult = {
      packetId: packetId || '',
      timestamp: new Date().toISOString(),
      repoRoot,
      gitCommit: null,
      packetsPath,
      found: false,
      headingsIncluded: [],
      source: 'ctx_inject',
      backend: 'jsonl+nu',
      mode,
    };
    const llmEncoded = encodeToon(result, { mode });
    return {
      content: [{ type: 'text', text: `Packet ${packetId} not found in packets.jsonl.` }],
      details: {
        ...result,
        tokenSavings: llmEncoded.tokenSavings,
      },
    };
  }

  const { text: textBlock, headings: headingsIncluded } = formatInjectionBlock(packet);

  const result: CtxInjectResult = {
    packetId: packet.packetId,
    timestamp: packet.timestamp,
    repoRoot: packet.repoRoot,
    gitCommit: packet.gitCommit,
    packetsPath,
    found: true,
    headingsIncluded,
    source: 'ctx_inject',
    backend: 'jsonl+nu',
    mode,
  };
  const llmEncoded = encodeToon(result, { mode });

  return {
    content: [{ type: 'text', text: textBlock }],
    details: {
      ...result,
      tokenSavings: llmEncoded.tokenSavings,
    },
  };
}

/**
 * Register the ctx_inject tool with pi.
 */
export function registerCtxInjectTool(pi: ExtensionAPI) {
  const ctxInjectItemSchema = Type.Object({
    packetId: Type.Optional(Type.String()),
    repoRoot: Type.Optional(Type.String()),
    mode: Type.Optional(Type.String()),
  });

  const schema = Type.Object({
    ops: Type.Optional(Type.Array(ctxInjectItemSchema, { description: 'ctx_inject operations array' })),
    packetId: Type.Optional(
      Type.String({ description: 'Packet ID to read (e.g. "abc123def456"). Defaults to latest.' })
    ),
    repoRoot: Type.Optional(
      Type.String({ description: 'Directory containing .pi-context/ (defaults to ctx.cwd)' })
    ),
    mode: Type.Optional(
      Type.Union([
        Type.Literal('toon', { description: 'TOON format for LLM' }),
        Type.Literal('json', { description: 'JSON format for LLM' }),
      ], { description: 'Output encoding for LLM consumption (defaults to json)' })
    ),
  });

  pi.registerTool({
    name: 'ctx_inject',
    label: 'Context Inject',
    description:
      'Read a ctx_packet from .pi-context/packets.jsonl and produce an '
      + 'injection-ready text block using stable compaction template headings. '
      + 'Pass ops: [{packetId?: "..."}].',
    promptSnippet: 'ctx_inject(packetId: "abc123def456")',
    promptGuidelines: [
      'Pass ops: [{packetId?: "..."}].',
      'Use ctx_inject to produce an injection-ready text block from a ctx_packet.',
      'ctx_inject reads packets.jsonl and produces text for manual copy.',
      'ctx_inject does not write files or mutate the active Pi session.',
      'Use packetId to select a specific packet, or omit for the latest.',
      'ctx_inject is a manual step — automation is deferred.',
    ],
    parameters: schema,
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      return executeCtxInjectOp(toolCallId, params, signal, onUpdate as any, ctx) as any;
    },
  });
}
