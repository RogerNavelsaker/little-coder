/**
 * pi-structural-tools — read tool extension entry point.
 *
 * Loads the read tool from the compiled source.
 */
import { registerReadTool } from './src/read.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  // Register the read tool with context hygiene tracking
  registerReadTool(pi, {
    onSuccessfulRead: (path: string) => {
      // Context hygiene: track that this file was read
      // This can be used by other tools (like edit) to verify
      // the file hasn't changed since it was last read
      console.debug(`[pi-structural-tools] File read: ${path}`);
    },
  });
}
