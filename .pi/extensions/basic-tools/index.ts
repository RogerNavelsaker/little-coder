/**
 * Basic tools extension — Universal Op[] schema.
 *
 * All basic-tools now use a single `{ops: Op[]}` discriminated union schema.
 * Each op has a `type` discriminator and tool-specific params.
 *
 * Supported ops: read, grep, edit, write, find, ls, shell, ast_search
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerUnifiedTool } from './src/unified.js';
import { registerFileCheckpointExtension } from './src/file-checkpoint.js';

export default function basicToolsExtension(pi: ExtensionAPI): void {
  registerUnifiedTool(pi);
  registerFileCheckpointExtension(pi);

  pi.on('resources_discover', async () => {
    const active = pi.getActiveTools() as string[];
    if (!active.includes('bash') || !active.includes('shell')) return;
    pi.setActiveTools(active.filter(n => n !== 'bash'));
  });
}
