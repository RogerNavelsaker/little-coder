/**
 * `grove` extension entrypoint.
 *
 * Registers:
 * - `grove_read`: Reading Seeds, Mulch, Canopy, Trellis, and Roots
 * - `grove_write`: Creating and updating Seeds, Mulch, Canopy, and Roots
 * - `grove_search`: Full-text search across Seeds, Mulch, and Roots
 * - `grove_promote`: Closing issues, recording outcomes, and syncing grove repos
 *
 * Hooks:
 * - `before_agent_start`: Synthesizes and injects [ORIENTATION] cold-start block
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerGroveReadTool } from "./src/grove-read.ts";
import { registerGroveWriteTool } from "./src/grove-write.ts";
import { registerGroveSearchTool } from "./src/grove-search.ts";
import { registerGrovePromoteTool } from "./src/grove-promote.ts";
import { synthesizeOrientationBlock } from "./src/orientation.ts";
import { injectionResult, makeDedupe } from "../_shared/inject.ts";

export default function groveExtension(pi: ExtensionAPI): void {
  registerGroveReadTool(pi);
  registerGroveWriteTool(pi);
  registerGroveSearchTool(pi);
  registerGrovePromoteTool(pi);

  const dedupe = makeDedupe();
  let lastOrientationTime = 0;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  pi.on("session_start", () => {
    lastOrientationTime = 0;
  });

  // Synthesize orientation block on cold start or after >1h idle
  pi.on("before_agent_start", async (event: any) => {
    const now = Date.now();
    const isColdStart = lastOrientationTime === 0 || now - lastOrientationTime > ONE_HOUR_MS;

    if (isColdStart) {
      const block = synthesizeOrientationBlock();
      lastOrientationTime = now;
      if (block && dedupe(block)) {
        return injectionResult("lc-grove-orientation", block, event?.systemPrompt);
      }
    }
  });
}
