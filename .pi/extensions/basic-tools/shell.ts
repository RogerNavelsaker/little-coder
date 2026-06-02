/**
 * pi-structural-tools — shell tool extension entry point.
 *
 * Loads the shell tool from the compiled source.
 */
import { registerShellTool, registerShellResultHook } from './src/shell.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerShellTool(pi);
  registerShellResultHook(pi);
}
