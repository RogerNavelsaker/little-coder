/**
 * pi-structural-tools — ast_search tool extension entry point.
 */
import { registerAstSearchTool } from './src/ast-search.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piStructuralToolsExtension(pi: ExtensionAPI): void {
  registerAstSearchTool(pi);
}
