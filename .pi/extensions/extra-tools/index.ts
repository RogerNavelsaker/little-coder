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
 * - `before_provider_request`: Injects reasoning effort / thinking budget per role profile.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { injectionResult, makeDedupe } from "../_shared/inject.ts";
import { registerScratchpadTool, formatActiveClipboard, getScratchpadEntries } from "./src/scratchpad.ts";
import { registerRepoMapTool } from "./src/repo-map.ts";
import { registerOutlineTool } from "./src/outline.ts";
import { registerSessionTool } from "./src/session.ts";
import { registerModelRouteTool } from "./src/model-router.ts";
import { registerEffortCommands, injectThinkingEffort, getEffortOverride, getEffortConfig, type ThinkingRole } from "./src/effort.ts";
import { registerTurnTransitionHooks } from "./src/turn-transition.ts";

export default function extraToolsExtension(pi: ExtensionAPI): void {
  registerScratchpadTool(pi);
  registerRepoMapTool(pi);
  registerOutlineTool(pi);
  registerSessionTool(pi);
  registerModelRouteTool(pi);
  registerEffortCommands(pi);
  registerTurnTransitionHooks(pi);

  const dedupe = makeDedupe();

  // Hook before_agent_start to inject active clipboard if populated
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    const entries = getScratchpadEntries();
    if (entries.length === 0) return;

    const block = formatActiveClipboard();
    if (!block || !dedupe(block)) return;

    return injectionResult("lc-scratchpad", block, event?.systemPrompt);
  });

  // Hook before_provider_request to inject dynamic thinking budget / effort
  pi.on("before_provider_request", async (event: any, ctx: any) => {
    try {
      const payload = event?.payload;
      if (!payload) return;

      const effortOverride = getEffortOverride();
      if (effortOverride) {
        return injectThinkingEffort(
          payload,
          effortOverride.level,
          effortOverride.tokens,
          getEffortConfig(),
        );
      }

      // Check intent from last message if available
      const messages = payload?.messages || ctx?.session?.messages || [];
      const lastMsg = messages[messages.length - 1];
      let lastText: string | undefined;
      if (typeof lastMsg?.content === "string") {
        lastText = lastMsg.content;
      } else if (Array.isArray(lastMsg?.content)) {
        lastText = lastMsg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ");
      }

      const { classifyTurnIntent } = await import("./src/effort.ts");
      const { getTriModelConfig } = await import("./src/model-router.ts");
      const triCfg = getTriModelConfig();
      const detectedTask = classifyTurnIntent(lastText);
      const activeRole = triCfg.activeRole || ((process.env.LITTLE_CODER_ROLE as ThinkingRole) || "hands");

      // If active role is "voice", force thinking off (0 tokens) regardless of prompt
      // Otherwise apply task-specific intent or fallback to role budget
      const steeringTarget = activeRole === "voice" ? "voice" : (detectedTask || activeRole);
      const modifiedPayload = injectThinkingEffort(payload, steeringTarget, undefined, getEffortConfig());
      return modifiedPayload;
    } catch {
      // Non-blocking fallback
    }
  });
}
