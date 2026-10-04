/**
 * Basic tools extension — Universal Op[] schema.
 *
 * All basic-tools now use a single `{ops: Op[]}` discriminated union schema.
 * Each op has a `type` discriminator and tool-specific params.
 *
 * Supported ops: read, grep, edit, write, find, ls, shell, ast_search
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerFileCheckpointExtension } from './src/file-checkpoint.js';
import { registerShellTool, registerShellResultHook } from './src/shell.js';
import { registerReadTool } from './src/read.js';
import { registerEditTool } from './src/edit.js';
import { registerWriteTool } from './src/write.js';
import { registerGrepTool } from './src/grep.js';
import { registerFindTool } from './src/find.js';
import { registerLsTool } from './src/ls.js';
import { registerAstSearchTool } from './src/ast-search.js';

/**
 * Basic tools extension.
 *
 * Defaults to the Code-as-Action single tool pattern:
 * - Only `sh` is registered as a tool with Nushell runtime.
 * - Precision operations (read, edit, write, ast-search) are CLI aliases in Nushell backed by `linehash`.
 *
 * When `PI_DISCRETE_TOOLS=1` or `LITTLE_CODER_DISCRETE_TOOLS=1`:
 * - Exposes each tool (`read`, `edit`, `write`, `grep`, `find`, `ls`, `ast_search`)
 *   as an individual tool with homogeneous `ops[]` batching and CSV/TOON output.
 */
export default function basicToolsExtension(pi: ExtensionAPI): void {
  // Always register the shell tools (sh & shell) and execution hook
  registerShellTool(pi);
  registerShellResultHook(pi);
  registerFileCheckpointExtension(pi);

  const shouldExposeDiscreteTools =
    process.env.PI_DISCRETE_TOOLS === '1' ||
    process.env.PI_DISCRETE_TOOLS === 'true' ||
    process.env.LITTLE_CODER_DISCRETE_TOOLS === '1' ||
    process.env.LITTLE_CODER_DISCRETE_TOOLS === 'true';

  if (shouldExposeDiscreteTools) {
    registerReadTool(pi);
    registerEditTool(pi);
    registerWriteTool(pi);
    registerGrepTool(pi);
    registerFindTool(pi);
    registerLsTool(pi);
    registerAstSearchTool(pi);
  }

  pi.on('resources_discover', async () => {
    const active = pi.getActiveTools() as string[];
    if (!active.includes('bash') || (!active.includes('shell') && !active.includes('sh'))) return;
    pi.setActiveTools(active.filter(n => n !== 'bash'));
  });
}

