/**
 * pi-structural-tools — grep tool extension entry point.
 */
import { registerGrepTool } from './src/grep.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerGrepTool(pi);
}
