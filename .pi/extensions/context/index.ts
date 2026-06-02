import { registerCtxRecordTool } from './src/ctx-record.js';
import { registerCtxPacketTool } from './src/ctx-packet.js';
import { registerCtxInjectTool } from './src/ctx-inject.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function contextExtension(pi: ExtensionAPI): void {
  registerCtxRecordTool(pi);
  registerCtxPacketTool(pi);
  registerCtxInjectTool(pi);
}
