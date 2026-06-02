/**
 * pi-structural-tools — edit tool extension entry point.
 *
 * Loads the edit tool from the compiled source.
 */
import { registerEditTool } from './src/edit.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerEditTool(pi);
}
