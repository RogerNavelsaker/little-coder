/**
 * pi-context — ctx_record tool extension entry point.
 */
import { registerCtxRecordTool } from './src/ctx-record.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piContextExtension(pi: ExtensionAPI): void {
  registerCtxRecordTool(pi);
}
