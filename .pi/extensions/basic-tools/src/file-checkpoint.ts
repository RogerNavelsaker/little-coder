import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { Type, type Static } from '@sinclair/typebox';
import type { ExtensionAPI, ToolCallEvent, ToolResultEvent } from '@earendil-works/pi-coding-agent';
import { type Component, Text } from '@earendil-works/pi-tui';

const CHECKPOINT_DIR = join(homedir(), '.pi', 'checkpoints');
const MAX_PER_FILE = 10;

interface CheckpointMeta {
  id: string;
  path: string;
  timestamp: number;
  size: number;
}

function pathHash(p: string): string {
  return createHash('sha256').update(p).digest('hex').slice(0, 16);
}

function slotDir(filePath: string): string {
  return join(CHECKPOINT_DIR, pathHash(filePath));
}

export function captureFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const dir = slotDir(filePath);
    mkdirSync(dir, { recursive: true });
    const id = Date.now().toString();
    const meta: CheckpointMeta = { id, path: filePath, timestamp: parseInt(id, 10), size: content.length };
    writeFileSync(join(dir, `${id}.content`), content, 'utf-8');
    writeFileSync(join(dir, `${id}.meta`), JSON.stringify(meta), 'utf-8');
    pruneSlot(dir);
  } catch { /* silent */ }
}

function pruneSlot(dir: string): void {
  try {
    const ids = readdirSync(dir)
      .filter((f) => f.endsWith('.meta'))
      .map((f) => f.replace('.meta', ''))
      .sort((a, b) => Number(b) - Number(a));
    for (const id of ids.slice(MAX_PER_FILE)) {
      try { unlinkSync(join(dir, `${id}.content`)); } catch { /* ok */ }
      try { unlinkSync(join(dir, `${id}.meta`)); } catch { /* ok */ }
    }
  } catch { /* ok */ }
}

function listCheckpoints(filePath: string): CheckpointMeta[] {
  try {
    const dir = slotDir(filePath);
    return readdirSync(dir)
      .filter((f) => f.endsWith('.meta'))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as CheckpointMeta)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

function getCheckpoint(filePath: string, id?: string): { content: string; meta: CheckpointMeta } | null {
  try {
    const dir = slotDir(filePath);
    let targetId = id;
    if (!targetId) {
      const all = listCheckpoints(filePath);
      if (!all.length) return null;
      targetId = all[0].id;
    }
    const content = readFileSync(join(dir, `${targetId}.content`), 'utf-8');
    const meta = JSON.parse(readFileSync(join(dir, `${targetId}.meta`), 'utf-8')) as CheckpointMeta;
    return { content, meta };
  } catch {
    return null;
  }
}

// Returns raw unified diff text (no delta rendering — edit's renderResult handles that).
export function diffAgainstCheckpoint(filePath: string): string | null {
  const cp = getCheckpoint(filePath);
  if (!cp) return null;
  const tmpFile = join(tmpdir(), `pi-ckpt-${Date.now()}.tmp`);
  try {
    writeFileSync(tmpFile, cp.content, 'utf-8');
    const r = spawnSync('diff', [
      '-u',
      '--label', `a/${filePath}`,
      '--label', `b/${filePath}`,
      tmpFile,
      filePath,
    ], { encoding: 'utf-8' });
    return r.stdout ?? null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ok */ }
  }
}

const revertSchema = Type.Object({
  path: Type.String({ description: 'Absolute path to the file to revert.' }),
  checkpoint_id: Type.Optional(Type.String({ description: 'Checkpoint ID to restore. Omit for most recent.' })),
});
type RevertParams = Static<typeof revertSchema>;

interface RevertDetails {
  path: string;
  checkpoint_id?: string;
  timestamp?: number;
  error?: string;
}

export function registerFileCheckpointExtension(pi: ExtensionAPI): void {
  // Before edit/write: capture current file content as a checkpoint.
  pi.on('tool_call', (event: ToolCallEvent, _ctx) => {
    const e = event as { toolName: string; input: Record<string, unknown> };
    if (e.toolName !== 'edit' && e.toolName !== 'write') return;
    const filePath = typeof e.input['path'] === 'string' ? e.input['path'] : undefined;
    if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
      captureFile(filePath);
    }
  });

  // After edit/write: replace details.diff with a clean diff -u output so edit's
  // renderResult shows syntax-highlighted delta output without Index:/=== artifacts.
  pi.on('tool_result', (event: ToolResultEvent, _ctx) => {
    const e = event as {
      toolName: string;
      input: Record<string, unknown>;
      details: Record<string, unknown> | undefined;
    };
    if (e.toolName !== 'edit' && e.toolName !== 'write') return;
    if (!e.details) return;
    // Only replace for single-file edits (details.diff present, no details.files array).
    if (Array.isArray(e.details['files'])) return;
    const filePath = typeof e.details['path'] === 'string'
      ? e.details['path']
      : typeof e.input['path'] === 'string'
        ? e.input['path']
        : undefined;
    if (!filePath) return;
    const cleanDiff = diffAgainstCheckpoint(filePath);
    if (cleanDiff === null) return;
    return { details: { ...e.details, diff: cleanDiff } };
  });

  pi.registerTool({
    name: 'revert_file',
    label: 'Revert File',
    description: 'Restore a file to a previous checkpoint captured before an edit or write.',
    promptSnippet: 'Revert file to checkpoint',
    promptGuidelines: [
      'Use revert_file to undo an edit or write by restoring the captured pre-edit content.',
      'Omit checkpoint_id to restore the most recent checkpoint.',
      'Check the edit card\'s expanded diff first to decide whether to revert.',
    ],
    parameters: revertSchema,
    async execute(_toolCallId, params: RevertParams, _signal, _onUpdate, _ctx) {
      const cp = getCheckpoint(params.path, params.checkpoint_id);
      if (!cp) {
        const details: RevertDetails = { path: params.path, error: 'no-checkpoint' };
        return {
          content: [{ type: 'text' as const, text: `No checkpoint found for ${params.path}` }],
          isError: true,
          details,
        };
      }
      try {
        writeFileSync(params.path, cp.content, 'utf-8');
      } catch (err) {
        const details: RevertDetails = { path: params.path, error: String(err) };
        return {
          content: [{ type: 'text' as const, text: `Failed to restore: ${err}` }],
          isError: true,
          details,
        };
      }
      const ts = new Date(cp.meta.timestamp).toISOString();
      const details: RevertDetails = { path: params.path, checkpoint_id: cp.meta.id, timestamp: cp.meta.timestamp };
      return {
        content: [{ type: 'text' as const, text: `Reverted ${params.path} to checkpoint ${cp.meta.id} (${ts})` }],
        details,
      };
    },
    renderResult(result, { expanded }, theme, _context) {
      const r = result as { details?: RevertDetails; isError?: boolean };
      const d = r.details;
      if (r.isError || !d?.path) {
        return new Text(theme.fg('error', d?.error ?? 'revert failed'), 0, 0) as unknown as Component;
      }
      if (expanded) {
        const ts = d.timestamp
          ? new Date(d.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
          : '';
        const lines = [
          theme.fg('success', '✓ reverted'),
          '  ' + theme.fg('muted', d.path),
          ts ? '  ' + theme.fg('dim', `checkpoint ${d.checkpoint_id} · ${ts}`) : '',
        ].filter(Boolean).join('\n');
        return new Text(lines, 1, 0) as unknown as Component;
      }
      return new Text(
        theme.fg('success', '✓ reverted') + '  ' + theme.fg('muted', d.checkpoint_id ?? ''),
        0, 0
      ) as unknown as Component;
    },
  });
}
