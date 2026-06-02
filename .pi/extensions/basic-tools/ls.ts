/**
 * pi-structural-tools — ls tool extension entry point.
 */
import { registerLsTool } from './src/ls.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerLsTool(pi);
}
