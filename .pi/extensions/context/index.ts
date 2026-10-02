import { registerCtxRecordTool } from "./src/ctx-record.js";
import { registerCtxPacketTool } from "./src/ctx-packet.js";
import { registerCtxInjectTool } from "./src/ctx-inject.js";
import {
  isEngramAvailable,
  extractCompactionContext,
  formatSessionSummary,
  saveEngramSummary,
} from "./src/bridge.js";
import { runContinuousGC } from "./src/continuous-gc.js";
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

  // 3. Automated Engram compaction bridge
  // Fires right before context compaction. Preserves essential state to Engram
  // without creating .pi-context/ files or dirtying the git working tree.
  pi.on("session_before_compact", async (event: any, ctx: any) => {
    try {
      const messages = event?.preparation?.messagesToSummarize || [];
      if (messages.length === 0) return;

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

  // 4. Automated Engram session close bridge
  pi.on("session_shutdown", async (_event: any, _ctx: any) => {
    try {
      // Clean up any ephemeral scratchpad if needed or notify
    } catch {}
  });
}
