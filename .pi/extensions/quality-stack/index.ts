/**
 * `quality-stack` extension entrypoint.
 *
 * Provides closed-loop runtime quality guardrails for small models:
 * 1. `output-parser`: Multi-pass recovery of fenced/tagged tool calls from assistant text.
 * 2. `write-guard`: Path normalization, reserved name checks, and overwrite redirection to edit.
 * 3. `read-guard`: Large tool-result bounding and context blowup protection.
 * 4. `quality-monitor`: Loop, hallucinated tool, and patch-spiral detection.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { checkWritePath } from "./src/write-guard.ts";
import { guardReadOutput } from "./src/read-guard.ts";
import { extractFencedToolCalls } from "./src/output-parser.ts";
import { QualityMonitor } from "./src/quality-monitor.ts";

export default function qualityStackExtension(pi: ExtensionAPI): void {
  const monitor = new QualityMonitor();

  // 1. Tool Call Hook: write-guard
  pi.on("tool_call", async (event: any, ctx: any) => {
    try {
      const toolName = event?.toolName;
      const input = event?.input;

      if (toolName === "write" && input?.path) {
        const check = checkWritePath(
          input.path,
          ctx?.cwd || process.cwd(),
          true,
          Boolean(input.overwrite),
        );

        if (!check.allowed) {
          ctx?.ui?.notify?.(check.reason || "Write blocked by write-guard", "warning");
          return {
            block: true,
            reason: check.reason,
          };
        }
      }
    } catch {
      // Non-blocking fallback
    }
  });

  // 2. Tool Result Hook: read-guard + quality-monitor
  pi.on("tool_result", async (event: any, ctx: any) => {
    try {
      const toolName = event?.toolName;
      const result = event?.result;

      // Read guard: bound massive text payloads
      if (result && Array.isArray(result.content)) {
        for (const part of result.content) {
          if (part.type === "text" && typeof part.text === "string") {
            const guarded = guardReadOutput(part.text);
            if (guarded.truncated) {
              part.text = guarded.text;
              ctx?.ui?.notify?.("Output truncated by read-guard", "info");
            }
          }
        }
      }

      // Quality monitor: track failures and read loops
      const incident = monitor.recordToolExecution(
        toolName,
        event?.input,
        Boolean(event?.isError),
        new Set(["read", "edit", "write", "sh", "outline", "repo_map", "scratchpad", "session", "schedule", "goal"]),
      );

      if (incident) {
        ctx?.ui?.notify?.(`[Quality Warning] ${incident.suggestion}`, "warning");
      }
    } catch {}
  });

  // 3. Message End / Turn End Hook: output-parser recovery
  pi.on("turn_end", async (event: any, ctx: any) => {
    try {
      const msg = event?.message;
      if (msg?.role === "assistant") {
        const text = typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c: any) => c.text || "").join("\n")
            : "";

        const recovered = extractFencedToolCalls(text);
        if (recovered.length > 0) {
          const first = recovered[0];
          const reminder = `Notice: Fenced tool call detected in text for '${first.tool}'. Please invoke tools natively.`;
          ctx?.ui?.notify?.(reminder, "warning");
        }
      }
    } catch {}
  });

  // Reset quality monitor state on new session
  pi.on("session_start", async () => {
    monitor.reset();
  });
}
