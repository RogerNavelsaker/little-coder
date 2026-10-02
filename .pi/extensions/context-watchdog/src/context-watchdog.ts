/**
 * `context-watchdog` tool & extension — mid-run token compaction watchdog.
 *
 * Capabilities:
 * 1. Monitors token usage via `ctx.getContextUsage()` on each turn.
 * 2. Triggers mid-run compaction when usage exceeds threshold (default: 80%).
 * 3. Incorporates elide-rescue loop prevention (issue #68).
 * 4. Local context estimation for untrusted post-truncation providers (issue #128).
 * 5. Provides `context_watchdog` tool conforming to Universal Tool Contract (executeContextWatchdogOp, ops[] schema).
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  thresholdPercent,
  shouldCompactNow,
  compactionHelped,
  canCompactMidRun,
  classifyCompactionError,
  MIN_PROGRESS_PCT,
  DEFAULT_PERCENT,
  RESUME_MESSAGE,
  type ContextUsageLike,
} from "./watchdog.ts";
import {
  estimateContextTokens,
  looksTruncated,
  reconcileUsage,
  reportsPostTruncationInput,
} from "./local-estimate.ts";

export const contextWatchdogItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("status"),
      Type.Literal("compact"),
      Type.Literal("pause"),
      Type.Literal("resume"),
    ]),
  ),
  threshold: Type.Optional(Type.Number({ description: "Compaction trigger threshold (1..99)" })),
});

export const contextWatchdogSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(contextWatchdogItemSchema, { description: "Batch watchdog operations array" }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("status", { description: "Inspect watchdog state and context usage" }),
        Type.Literal("compact", { description: "Force an immediate compaction check/trigger" }),
        Type.Literal("pause", { description: "Pause automated watchdog compaction" }),
        Type.Literal("resume", { description: "Resume automated watchdog compaction" }),
      ],
      { description: "Action to perform" },
    ),
  ),
  threshold: Type.Optional(Type.Number({ description: "Compaction trigger threshold override" })),
});

export interface WatchdogState {
  enabled: boolean;
  threshold: number;
  paused: boolean;
  compacting: boolean;
  measurePending: boolean;
  preCompactPercent: number | null;
  lastUsage: ContextUsageLike | null;
}

export const watchdogState: WatchdogState = {
  enabled: true,
  threshold: DEFAULT_PERCENT,
  paused: false,
  compacting: false,
  measurePending: false,
  preCompactPercent: null,
  lastUsage: null,
};

export async function executeContextWatchdogOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx?: any,
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeContextWatchdogOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeContextWatchdogOp(_toolCallId, op, _signal, _onUpdate, ctx)),
    );
    return {
      content: [{ type: "text" as const, text: results.map((r: any) => r.content[0].text).join("\n---\n") }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map((r: any) => r.details),
      },
    };
  }

  const action = params.action ?? "status";

  if (typeof params.threshold === "number" && params.threshold > 0 && params.threshold < 100) {
    watchdogState.threshold = params.threshold;
  }

  if (action === "pause") {
    watchdogState.paused = true;
    return {
      content: [{ type: "text" as const, text: "Context watchdog paused." }],
      isError: false,
      details: { paused: true, threshold: watchdogState.threshold },
    };
  }

  if (action === "resume") {
    watchdogState.paused = false;
    return {
      content: [{ type: "text" as const, text: "Context watchdog resumed." }],
      isError: false,
      details: { paused: false, threshold: watchdogState.threshold },
    };
  }

  if (action === "compact") {
    let triggered = false;
    if (ctx && typeof ctx.compact === "function") {
      ctx.compact();
      triggered = true;
    }
    return {
      content: [
        {
          type: "text" as const,
          text: triggered ? "Manual compaction triggered." : "Compaction not available in current context.",
        },
      ],
      isError: false,
      details: { triggered },
    };
  }

  // Action: status
  const usage = watchdogState.lastUsage;
  const usageStr = usage?.percent !== null && usage?.percent !== undefined
    ? `${Math.round(usage.percent)}% (${usage.tokens}/${usage.contextWindow} tokens)`
    : "unknown";

  const statusText = [
    `Watchdog Status: ${watchdogState.enabled ? "enabled" : "disabled"}`,
    `Threshold: ${watchdogState.threshold}%`,
    `Paused: ${watchdogState.paused ? "yes" : "no"}`,
    `Compacting: ${watchdogState.compacting ? "in-flight" : "idle"}`,
    `Current Context Usage: ${usageStr}`,
  ].join("\n");

  return {
    content: [{ type: "text" as const, text: statusText }],
    isError: false,
    details: {
      enabled: watchdogState.enabled,
      threshold: watchdogState.threshold,
      paused: watchdogState.paused,
      compacting: watchdogState.compacting,
      lastUsage: watchdogState.lastUsage,
    },
  };
}

export function registerContextWatchdog(pi: ExtensionAPI): void {
  const pct = thresholdPercent();
  if (pct <= 0) {
    watchdogState.enabled = false;
    return;
  }
  watchdogState.threshold = pct;

  let outstanding = 0;
  let truncationNotified = false;

  pi.registerTool({
    name: "context_watchdog",
    label: "Context Watchdog",
    description: "Inspect or manage mid-run context watchdog threshold and token compaction status.",
    promptSnippet: "Monitor or control mid-run token compaction watchdog",
    promptGuidelines: [
      "Use context_watchdog to check token usage percentage or pause/resume automatic mid-run compaction.",
    ],
    parameters: contextWatchdogSchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? "status";
      const text = theme.fg("toolTitle", "context_watchdog ") + theme.fg("accent", action);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const details = result?.details;
      const paused = details?.paused ? " [paused]" : "";
      const text = theme.fg("muted", `Watchdog (${details?.threshold ?? pct}%)${paused}`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeContextWatchdogOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("watchdog", {
    description: "Show context watchdog status and token usage",
    handler: async (_args: string, ctx: any) => {
      const u = watchdogState.lastUsage;
      const usageStr = u?.percent !== null && u?.percent !== undefined
        ? `${Math.round(u.percent)}%`
        : "unknown";
      ctx.ui?.notify?.(
        `Watchdog: ${watchdogState.paused ? "paused" : "active"} (threshold: ${watchdogState.threshold}%, usage: ${usageStr})`,
        "info",
      );
    },
  });

  pi.on("before_agent_start", async () => {
    if (outstanding === 0) {
      watchdogState.compacting = false;
    }
  });

  function readUsage(ctx: any): ContextUsageLike | undefined {
    const reported = ctx.getContextUsage?.();
    if (!reportsPostTruncationInput(ctx?.model?.provider)) return reported;
    let estimated = 0;
    try {
      estimated = estimateContextTokens(
        ctx.sessionManager?.buildContextEntries?.(),
        ctx.getSystemPrompt?.(),
      );
    } catch {
      return reported;
    }
    if (!truncationNotified && looksTruncated(reported?.tokens ?? null, estimated)) {
      truncationNotified = true;
      ctx.ui?.notify?.(
        `This provider reports prompt size after truncation (reported ~${reported?.tokens}, actual ~${estimated} tokens). ` +
          `Compaction driven by local estimate (issue #128).`,
        "warning",
      );
    }
    return reconcileUsage(reported, estimated, true);
  }

  function queueResume(): void {
    try {
      pi.sendUserMessage(RESUME_MESSAGE, { deliverAs: "followUp" });
    } catch {
      // Best-effort
    }
  }

  function fire(ctx: any, usage: ContextUsageLike): Promise<void> {
    watchdogState.compacting = true;
    outstanding += 1;
    watchdogState.preCompactPercent = usage.percent;

    const ui = ctx.ui;
    const notify = (message: string, level: "info" | "warning") => {
      try { ui.notify(message, level); } catch { /* best effort */ }
    };
    const resumeRun = queueResume;

    const windowK = Math.round((usage.contextWindow / 1000) * 10) / 10;
    notify(
      `Context at ${Math.round(usage.percent!)}% of ${windowK}k, compacting mid-run to stay within window`,
      "info",
    );

    return new Promise<void>((settled) => {
      ctx.compact({
        onComplete: () => {
          outstanding = Math.max(0, outstanding - 1);
          watchdogState.compacting = false;
          watchdogState.measurePending = true;
          resumeRun();
          settled();
        },
        onError: (err?: { message?: string }) => {
          outstanding = Math.max(0, outstanding - 1);
          watchdogState.compacting = false;
          try {
            switch (classifyCompactionError(err?.message)) {
              case "already":
                watchdogState.measurePending = true;
                resumeRun();
                return;
              case "cancelled":
                return;
              default: {
                watchdogState.paused = true;
                const why = err?.message ? ` (${err.message})` : "";
                notify(
                  `Automatic compaction could not proceed${why} — paused to prevent loops (issue #68).`,
                  "warning",
                );
              }
            }
          } finally {
            settled();
          }
        },
      });
    });
  }

  pi.on("turn_start", async (_event, ctx) => {
    const usage = readUsage(ctx);
    if (usage) {
      watchdogState.lastUsage = usage;
    }

    if (watchdogState.measurePending && usage && usage.percent !== null) {
      watchdogState.measurePending = false;
      if (!compactionHelped(usage.percent, watchdogState.threshold)) {
        watchdogState.paused = true;
        const freed = watchdogState.preCompactPercent !== null
          ? ` (freed ~${Math.max(0, Math.round(watchdogState.preCompactPercent - usage.percent))}%)`
          : "";
        ctx.ui?.notify?.(
          `Context still at ${Math.round(usage.percent)}% after compaction${freed} — ` +
            `automatic compaction paused to avoid loop (issue #68). Re-arms below ${Math.round(watchdogState.threshold - MIN_PROGRESS_PCT)}%.`,
          "warning",
        );
      }
    }

    if (
      watchdogState.paused &&
      usage &&
      usage.percent !== null &&
      usage.percent < watchdogState.threshold - MIN_PROGRESS_PCT
    ) {
      watchdogState.paused = false;
    }
    if (watchdogState.paused) return;

    if (!shouldCompactNow(usage, watchdogState.threshold, watchdogState.compacting)) return;
    if (!canCompactMidRun((ctx as any)?.mode)) return;

    void fire(ctx, usage!);
  });

  pi.on("session_compact", async (event, ctx) => {
    if (canCompactMidRun((ctx as any)?.mode)) return;
    if ((event as { willRetry?: boolean }).willRetry) return;
    queueResume();
  });
}
