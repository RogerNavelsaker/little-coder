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
}

/**
 * Register the ctx_packet tool with pi.
 */
export function registerCtxPacketTool(pi: ExtensionAPI) {
  const schema = Type.Object({
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
      + 'Reads events.jsonl, extracts structured sections (decisions, verification, '
      + 'files changed, commands/tests, blockers, next actions), and writes packets.jsonl. '
      + 'Use before handoff, compaction, restart, or review.',
    promptSnippet: 'ctx_packet(limit: 30, includeTypes: ["decision", "blocker"])',
    promptGuidelines: [
      'Use ctx_packet before handoff, compaction, restart, or review.',
      'ctx_packet is deterministic — no LLM summarization.',
      'Use includeTypes to filter to specific record types.',
      'ctx_packet does not replace Pi session state.',
      '.pi-context is durable git-native work memory.',
    ],
    parameters: schema,
    async execute(_toolCallId, params: CtxPacketParams, _signal, _onUpdate, ctx) {
      const mode = (params.mode ?? 'json') as ToonMode;
      const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : params.limit || 50;
      const includeTypes = params.includeTypes || [];

      // Resolve repo root — fall back to ctx.cwd when no .git is found
      const repoRoot = resolveGitRoot(ctx.cwd) || ctx.cwd;
      const hasGit = resolveGitRoot(ctx.cwd) !== null;

      // Resolve .pi-context directory
      const piContextDir = resolvePiContextDir(repoRoot);
      if (!piContextDir) {
        // Missing store returns empty packet, not error
        const timestamp = new Date().toISOString();
        const packetId = generatePacketId([]);
        const emptyResult: CtxPacketResult = {
          packetId,
          timestamp,
          repoRoot,
          gitCommit: hasGit ? getGitCommit(repoRoot) : null,
          sourceEventIds: [],
          summary: 'No events found.',
          sections: {
            recentDecisions: [],
            recentVerification: [],
            filesChanged: [],
            commandsTestsRun: [],
            blockers: [],
            nextActions: [],
            otherEvents: {},
          },
          path: join(repoRoot, 'packets.jsonl'),
          backend: 'jsonl+nu',
          mode,
        };
        const llmEncoded = encodeToon(emptyResult, { mode });
        return {
          content: [{ type: 'text', text: `Empty packet: ${packetId} — No events found.` }],
          details: {
            ...emptyResult,
            tokenSavings: llmEncoded.tokenSavings,
          },
        };
      }

      const eventsPath = join(piContextDir, 'events.jsonl');
      const packetsPath = join(piContextDir, 'packets.jsonl');

      // Read recent records
      let allRecords = readJsonl(eventsPath);
      const totalRecords = allRecords.length;
      allRecords = allRecords.slice(-limit);

      // Filter by includeTypes
      const filteredRecords = includeTypes.length > 0
        ? allRecords.filter(r => includeTypes.includes((r.type as string) || ''))
        : allRecords;

      // Generate sections
      const sections = generatePacketSections(filteredRecords);

      // Build summary
      const summaryParts: string[] = [];
      if (sections.recentDecisions.length > 0) summaryParts.push(`Decisions: ${sections.recentDecisions.length}`);
      if (sections.recentVerification.length > 0) summaryParts.push(`Verified: ${sections.recentVerification.length}`);
      if (sections.filesChanged.length > 0) summaryParts.push(`Files changed: ${sections.filesChanged.length}`);
      if (sections.commandsTestsRun.length > 0) summaryParts.push(`Commands/tests: ${sections.commandsTestsRun.length}`);
      if (sections.blockers.length > 0) summaryParts.push(`Blockers: ${sections.blockers.length}`);
      if (sections.nextActions.length > 0) summaryParts.push(`Next actions: ${sections.nextActions.length}`);
      const summary = summaryParts.length > 0
        ? `Summary: ${summaryParts.join(', ')}. Total events: ${totalRecords}.`
        : 'No events found.';

      // Source event IDs
      const sourceEventIds = filteredRecords.map(r => r.id as string).filter(Boolean);

      // Generate packet
      const timestamp = new Date().toISOString();
      const packetId = generatePacketId(filteredRecords);
      const packet = {
        packetId,
        timestamp,
        repoRoot,
        gitCommit: hasGit ? getGitCommit(repoRoot) : null,
        sourceEventIds,
        summary,
        sections,
        source: 'ctx_packet',
        backend: 'jsonl+nu',
      };

      // Append to packets.jsonl
      appendFileSync(packetsPath, JSON.stringify(packet) + '\n');

      // Format output
      const result: CtxPacketResult = {
        ...packet,
        path: packetsPath,
        backend: 'jsonl+nu',
        mode,
      };
      const llmEncoded = encodeToon(result, { mode });

      // User text: readable summary
      const userLines = [`Context packet ${packetId}:`, ``, summary];
      if (sections.recentDecisions.length > 0) userLines.push(`\nDecisions:`, ...sections.recentDecisions.slice(-5));
      if (sections.blockers.length > 0) userLines.push(`\nBlockers:`, ...sections.blockers.slice(-5));
      if (sections.nextActions.length > 0) userLines.push(`\nNext actions:`, ...sections.nextActions.slice(-5));

      return {
        content: [{ type: 'text', text: userLines.join('\n') }],
        details: {
          ...result,
          tokenSavings: llmEncoded.tokenSavings,
        },
      };
    },
  });
}
