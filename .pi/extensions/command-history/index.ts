import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerCommandHistoryTool } from './src/command-history.js';

export default function commandHistoryExtension(pi: ExtensionAPI): void {
  registerCommandHistoryTool(pi);
}
