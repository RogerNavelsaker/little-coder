import { registerAstSearchTool } from './src/ast-search.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piAstSearchExtension(pi: ExtensionAPI): void {
  registerAstSearchTool(pi);
}
