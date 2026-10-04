import { registerCtxRecordTool } from "./src/ctx-record.js";
import { registerCtxPacketTool } from "./src/ctx-packet.js";
import { registerCtxInjectTool } from "./src/ctx-inject.js";
import {
  isEngramAvailable,
  extractCompactionContext,
  formatSessionSummary,
  saveEngramSummary,
} from "./src/bridge.js";
import { runContinuousGC, scrubMessagesForCompaction } from "./src/continuous-gc.js";
import { computeOrientation, formatOrientationBlock } from "./src/orientation.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function contextExtension(pi: ExtensionAPI): void {
  // 1. Maintain backward-compatible tools for manual invocation
  registerCtxRecordTool(pi);
  registerCtxPacketTool(pi);
  registerCtxInjectTool(pi);

  // 2. Sapling-inspired Continuous Context Garbage Collector
  // Evaluates every turn before LLM call; prunes intermediate tool outputs from older turns
  // while keeping recent turns verbatim to keep token usage flat and prevent context degradation.
  pi.on("context", async (event: any, _ctx: any) => {
    try {
      const messages = event?.messages || [];
      if (!Array.isArray(messages) || messages.length === 0) return;

      const { messages: pruned, stats } = runContinuousGC(messages);
      if (stats.prunedToolResults > 0) {
        return { messages: pruned };
      }
    } catch {
      // Non-blocking fallback to original messages
    }
  });

  // 3. Automated Engram compaction bridge & Ingestion Guard
  // Fires right before context compaction. Preserves essential state to Engram
  // and scrubs messagesToSummarize so the summarizer prompt never exceeds the model's context window.
  pi.on("session_before_compact", async (event: any, ctx: any) => {
    try {
      const preparation = event?.preparation;
      if (!preparation) return;

      const messages = preparation.messagesToSummarize || [];
      if (messages.length === 0) return;

      // Ingestion guard: mutate preparation messages in-place with bounded tool results
      // so Pi's compact() function does not exceed context window (prevents 1.7M token blowout)
      if (Array.isArray(preparation.messagesToSummarize)) {
        const { messages: scrubbed, prunedCount, charsSaved } = scrubMessagesForCompaction(preparation.messagesToSummarize);
        if (prunedCount > 0) {
          preparation.messagesToSummarize = scrubbed;
          ctx?.ui?.notify?.(`Compaction input scrubbed: pruned ${prunedCount} oversized outputs (~${Math.round(charsSaved / 1024)}KB saved)`, "info");
        }
      }

      if (Array.isArray(preparation.turnPrefixMessages) && preparation.turnPrefixMessages.length > 0) {
        const { messages: scrubbedPrefix } = scrubMessagesForCompaction(preparation.turnPrefixMessages);
        preparation.turnPrefixMessages = scrubbedPrefix;
      }

      const summaryPayload = extractCompactionContext(messages);
      const formatted = formatSessionSummary(summaryPayload);
      const cwd = ctx?.cwd || process.cwd();

      // Save session summary into Engram if available
      if (isEngramAvailable()) {
        const result = saveEngramSummary(formatted, cwd);
        if (result.success) {
          ctx?.ui?.notify?.("Compaction state saved to Engram", "info");
        }
      }
    } catch {
      // Best-effort non-blocking
    }
  });

  // 4. Orientation Block on Wake / Resume (Volition-inspired)
  let lastActiveTimestamp: number | undefined;

  pi.on("before_agent_start", async (event: any) => {
    try {
      const now = Date.now();
      const cwd = process.cwd();
      const orientation = computeOrientation(lastActiveTimestamp, cwd, now);
      lastActiveTimestamp = now;

      // Only inject orientation if there was an idle gap (>60s) or external git changes exist
      if (orientation.elapsedIdleMs > 60_000 || (orientation.gitDirtyCount && orientation.gitDirtyCount > 0)) {
        const block = formatOrientationBlock(orientation);
        if (event?.systemPrompt) {
          return {
            systemPrompt: `${event.systemPrompt}\n\n${block}`,
          };
        }
      }
    } catch {
      // Non-blocking fallback
    }
  });

  // Update activity timestamp on user input or turn start
  pi.on("turn_start", () => {
    lastActiveTimestamp = Date.now();
  });

  // 5. Automated Engram session close bridge
  pi.on("session_shutdown", async (_event: any, _ctx: any) => {
    try {
      // Clean up any ephemeral scratchpad if needed or notify
    } catch {}
  });
}
