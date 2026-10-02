import { registerCtxRecordTool } from "./src/ctx-record.js";
import { registerCtxPacketTool } from "./src/ctx-packet.js";
import { registerCtxInjectTool } from "./src/ctx-inject.js";
import {
  isEngramAvailable,
  extractCompactionContext,
  formatSessionSummary,
  saveEngramSummary,
} from "./src/bridge.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function contextExtension(pi: ExtensionAPI): void {
  // 1. Maintain backward-compatible tools for manual invocation
  registerCtxRecordTool(pi);
  registerCtxPacketTool(pi);
  registerCtxInjectTool(pi);

  // 2. Automated Engram compaction bridge
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

  // 3. Automated Engram session close bridge
  pi.on("session_shutdown", async (_event: any, ctx: any) => {
    try {
      // Clean up any ephemeral scratchpad if needed or notify
    } catch {}
  });
}
