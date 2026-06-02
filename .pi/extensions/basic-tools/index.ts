import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerReadTool } from './src/read.js';
import { registerEditTool } from './src/edit.js';
import { registerGrepTool } from './src/grep.js';
import { registerFindTool } from './src/find.js';
import { registerLsTool } from './src/ls.js';
import { registerShellTool } from './src/shell.js';
import { registerWriteTool } from './src/write.js';
import { registerAstSearchTool } from './src/ast-search.js';
import { registerFileCheckpointExtension } from './src/file-checkpoint.js';

export default function basicToolsExtension(pi: ExtensionAPI): void {
  registerReadTool(pi);
  registerEditTool(pi);
  registerGrepTool(pi);
  registerFindTool(pi);
  registerLsTool(pi);
  registerShellTool(pi);
  registerWriteTool(pi);
  registerAstSearchTool(pi);
  registerFileCheckpointExtension(pi);

  pi.on('resources_discover', async () => {
    const active = pi.getActiveTools() as string[];
    if (!active.includes('bash') || !active.includes('shell')) return;
    pi.setActiveTools(active.filter(n => n !== 'bash'));
  });
}
