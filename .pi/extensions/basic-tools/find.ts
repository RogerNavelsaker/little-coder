/**
 * pi-structural-tools — find tool extension entry point.
 */
import { registerFindTool } from './src/find.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerFindTool(pi);
}
