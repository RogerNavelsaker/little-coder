/**
 * pi-context — ctx_packet tool extension entry point.
 */
import { registerCtxPacketTool } from './src/ctx-packet.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piContextExtension(pi: ExtensionAPI): void {
  registerCtxPacketTool(pi);
}
