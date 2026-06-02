/**
 * pi-context — ctx_inject tool extension entry point.
 */
import { registerCtxInjectTool } from './src/ctx-inject.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piContextExtension(pi: ExtensionAPI): void {
  registerCtxInjectTool(pi);
}
