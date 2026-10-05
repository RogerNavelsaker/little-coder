/**
 * `quality-stack` extension entrypoint.
 *
 * Provides closed-loop runtime quality guardrails for small models:
 * 1. `output-parser`: Multi-pass recovery of fenced/tagged tool calls from assistant text.
 * 2. `write-guard`: Path normalization, reserved name checks, and overwrite redirection to edit.
 * 3. `read-guard`: Large tool-result bounding and context blowup protection.
 * 4. `quality-monitor`: Loop, hallucinated tool, and patch-spiral detection.
 * 5. `turn-cap`: Runaway loop safety cap and 5-turn finalize warning before budget exhaustion.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { checkWritePath } from "./src/write-guard.ts";
import { guardReadOutput } from "./src/read-guard.ts";
import { applyOutputMachete } from "./src/output-machete.ts";
import { extractFencedToolCalls, filterKnownTools } from "./src/output-parser.ts";
import { QualityMonitor } from "./src/quality-monitor.ts";
import { TurnCapGuard } from "./src/turn-cap.ts";
import { Governor } from "./src/governor.ts";
import { ReadGuardEditTracker } from "./src/read-guard-edit.ts";

export default function qualityStackExtension(pi: ExtensionAPI): void {
  const monitor = new QualityMonitor();
  const turnCap = new TurnCapGuard();
  const governor = new Governor();
  const readGuardEdit = new ReadGuardEditTracker();

  // 1. Turn Start Hook: turn-cap + finalize-warn + velocity governor
  pi.on("turn_start", async (event: any, ctx: any) => {
    try {
      const turnIndex = event?.turnIndex ?? 0;
      const evalResult = turnCap.evaluateTurn(turnIndex);

      if (evalResult.action === "warn") {
        ctx?.ui?.notify?.(evalResult.message, "warning");
        if (typeof (pi as any).sendUserMessage === "function") {
          (pi as any).sendUserMessage(
            `[SYSTEM WARNING] ${evalResult.message}\nPlease conclude current edits, run verifications, and provide your final answer now.`,
            { deliverAs: "steer" },
          );
        }
      } else if (evalResult.action === "abort") {
        ctx?.ui?.notify?.(evalResult.message, "error");
        if (typeof ctx?.abort === "function") {
          ctx.abort();
        }
        return;
      }

      // Check turn velocity governor (rapid-fire runaway loop detection)
      const govResult = governor.evaluateTurn();
      if (govResult.action === "throttle") {
        ctx?.ui?.notify?.(govResult.message, "warning");
        if (typeof (pi as any).sendUserMessage === "function") {
          (pi as any).sendUserMessage(
            `[GOVERNOR CIRCUIT BREAKER] ${govResult.message}\nTake a deliberate pause before the next action.`,
            { deliverAs: "steer" },
          );
        }
      }
    } catch {
      // Non-blocking fallback
    }
  });

  // 2. Tool Call Hook: write-guard
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

      // Read-before-edit invariant
      if (toolName === "edit") {
        const editPath = input?.path || input?.file_path || (Array.isArray(input?.edits) && input.edits[0]?.path);
        if (typeof editPath === "string") {
          const check = readGuardEdit.checkEdit(editPath, ctx?.cwd || process.cwd());
          if (!check.allowed) {
            ctx?.ui?.notify?.("Edit blocked: File must be read first", "warning");
            return {
              block: true,
              reason: check.reason,
            };
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }
  });

  // 3. Tool Result Hook: read-guard + quality-monitor + read-guard-edit tracking
  pi.on("tool_result", async (event: any, ctx: any) => {
    try {
      const toolName = event?.toolName;
      const result = event?.result;
      const input = event?.input;
      const isError = Boolean(event?.isError);

      // Track read/authored files for read-guard-edit
      if (!isError) {
        if (toolName === "read" && input?.path) {
          readGuardEdit.recordAccess(input.path, ctx?.cwd || process.cwd());
        } else if (toolName === "write" && input?.path) {
          readGuardEdit.recordAccess(input.path, ctx?.cwd || process.cwd());
        } else if (toolName === "edit") {
          const editPath = input?.path || input?.file_path || (Array.isArray(input?.edits) && input.edits[0]?.path);
          if (typeof editPath === "string") {
            readGuardEdit.recordAccess(editPath, ctx?.cwd || process.cwd());
          }
        }
      }

      // Ingestion bounding: read-guard for reads / output-machete for shell
      if (result && Array.isArray(result.content)) {
        for (const part of result.content) {
          if (part.type === "text" && typeof part.text === "string") {
            if (toolName === "sh" || toolName === "shell") {
              const bounded = applyOutputMachete(part.text);
              if (bounded.truncated) {
                part.text = bounded.text;
                ctx?.ui?.notify?.("Shell output truncated by output-machete", "info");
              }
            } else {
              const guarded = guardReadOutput(part.text);
              if (guarded.truncated) {
                part.text = guarded.text;
                ctx?.ui?.notify?.("Output truncated by read-guard", "info");
              }
            }
          }
        }
      }

      // Quality monitor: track failures and read loops
      const activeTools = typeof (pi as any).getActiveTools === "function"
        ? new Set<string>((pi as any).getActiveTools())
        : new Set<string>([
            "basic-tools", "sh", "shell", "read", "edit", "write", "grep", "find", "ls", "ast_search",
            "outline", "repo_map", "scratchpad", "session", "schedule", "goal", "grove_search",
            "passive_ui", "context_watchdog", "revert_file",
          ]);
      // Always allow basic-tools and grove tools
      activeTools.add("basic-tools");
      activeTools.add("sh");
      activeTools.add("shell");
      activeTools.add("grove_search");

      const incident = monitor.recordToolExecution(
        toolName,
        event?.input,
        Boolean(event?.isError),
        activeTools,
        ctx?.cwd || process.cwd(),
      );

      if (incident) {
        ctx?.ui?.notify?.(`[Quality Warning] ${incident.suggestion}`, "warning");
        // Also inject guidance directly into LLM-visible tool_result content to guide the model
        if (result && Array.isArray(result.content)) {
          result.content.push({
            type: "text",
            text: `\n[Quality Guidance: ${incident.suggestion}]`,
          });
        }

        // Singularity pattern: auto-switch role to 'mind' to stop mechanical thrashing
        if (incident.recommendRoleSwitch === "mind") {
          try {
            const { setTriModelConfig } = await import("../extra-tools/src/model-router.ts");
            setTriModelConfig({ activeRole: "mind" });
          } catch {
            // best-effort
          }
        }
      }
    } catch {}
  });

  // 4. Message End / Turn End Hook: output-parser recovery
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
          let knownNames: string[] | undefined;
          try {
            const all = (ctx as any)?.getAllTools?.();
            if (Array.isArray(all)) {
              knownNames = all.map((t: any) => String(t?.name ?? "")).filter(Boolean);
            }
          } catch {
            knownNames = undefined;
          }

          const filtered = filterKnownTools(recovered, knownNames);
          if (filtered.length > 0) {
            const first = filtered[0];
            const reminder = `Notice: Fenced tool call detected in text for '${first.tool}'. Please invoke tools natively.`;
            ctx?.ui?.notify?.(reminder, "warning");
          }
        }
      }
    } catch {}
  });

  // Reset quality monitor, governor & turn-cap state on new session / before agent start
  pi.on("session_start", async () => {
    monitor.reset();
    turnCap.reset();
    governor.reset();
    readGuardEdit.reset();
  });

  // Reset read counts on session compaction so summarized state starts fresh
  pi.on("session_compact", async () => {
    monitor.reset();
    governor.reset();
  });

  pi.on("before_agent_start", async () => {
    turnCap.reset();
    governor.reset();
  });
}
