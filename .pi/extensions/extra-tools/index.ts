/**
 * `extra-tools` extension entrypoint.
 *
 * Registers:
 * - `scratchpad`: Ephemeral session clipboard and working memory ([ACTIVE_CLIPBOARD]).
 * - `repo_map`: Compact repository topology, entrypoints detection, and recent changes.
 * - `outline`: Structural symbol index and JIT signature disclosure (lines:N-M).
 * - `session`: Herdr-backed process & pane session management (replaces legacy Zellij).
 *
 * Hooks:
 * - `before_agent_start`: Injects [ACTIVE_CLIPBOARD] into prompt if scratchpad has entries.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { injectionResult, makeDedupe } from "../_shared/inject.ts";
import { registerScratchpadTool, formatActiveClipboard, getScratchpadEntries } from "./src/scratchpad.ts";
import { registerRepoMapTool } from "./src/repo-map.ts";
import { registerOutlineTool } from "./src/outline.ts";
import { registerSessionTool } from "./src/session.ts";

export default function extraToolsExtension(pi: ExtensionAPI): void {
  registerScratchpadTool(pi);
  registerRepoMapTool(pi);
  registerOutlineTool(pi);
  registerSessionTool(pi);

  const dedupe = makeDedupe();

  // Hook before_agent_start to inject active clipboard if populated
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    const entries = getScratchpadEntries();
    if (entries.length === 0) return;

    const block = formatActiveClipboard();
    if (!block || !dedupe(block)) return;

    return injectionResult("lc-scratchpad", block, event?.systemPrompt);
  });
}
