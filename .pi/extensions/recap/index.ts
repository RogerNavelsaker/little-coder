import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerRecapTool } from './src/recap.js';

export default function recapExtension(pi: ExtensionAPI): void {
  registerRecapTool(pi);
}
