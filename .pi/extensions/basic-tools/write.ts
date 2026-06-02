/**
 * pi-structural-tools — write tool extension entry point.
 *
 * Loads the write tool from the compiled source.
 */
import { registerWriteTool } from './src/write.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  // Register the write tool with context hygiene tracking
  registerWriteTool(pi);
}
