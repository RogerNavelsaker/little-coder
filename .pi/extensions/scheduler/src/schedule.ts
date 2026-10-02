/**
 * `schedule` tool & engine — One-shot timer and recurring prompt scheduler.
 *
 * Inspired by `pi-schedule-prompt`.
 * Allows model and user to set timers or recurring intervals to re-engage the agent.
 * Dispatches prompts through Pi's user message mechanism or notifies the UI.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export interface ScheduleTask {
  id: string;
  prompt: string;
  delayMs: number;
  intervalMs?: number;
  createdAt: number;
  runAt: number;
  status: "pending" | "running" | "completed" | "cancelled";
  timerHandle?: any;
}

export const scheduleItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("create"),
      Type.Literal("list"),
      Type.Literal("cancel"),
      Type.Literal("clear"),
    ]),
  ),
  id: Type.Optional(Type.String({ description: "Schedule task ID" })),
  prompt: Type.Optional(Type.String({ description: "Prompt text to inject upon expiry" })),
  delaySeconds: Type.Optional(Type.Number({ description: "Delay in seconds before firing" })),
  intervalSeconds: Type.Optional(Type.Number({ description: "Recurring interval in seconds (optional)" })),
});

export const scheduleSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(scheduleItemSchema, { description: "Batch schedule operations array" }),
  ),
  action: Type.Optional(
    Type.Union([
      Type.Literal("create", { description: "Create a scheduled prompt task" }),
      Type.Literal("list", { description: "List all active scheduled tasks (default)" }),
      Type.Literal("cancel", { description: "Cancel a scheduled task by ID" }),
      Type.Literal("clear", { description: "Cancel and clear all scheduled tasks" }),
    ]),
  ),
  id: Type.Optional(Type.String({ description: "Schedule task ID" })),
  prompt: Type.Optional(Type.String({ description: "Prompt text to inject upon expiry" })),
  delaySeconds: Type.Optional(Type.Number({ description: "Delay in seconds" })),
  intervalSeconds: Type.Optional(Type.Number({ description: "Recurring interval in seconds" })),
});

// In-memory scheduled task registry
const scheduledTasks = new Map<string, ScheduleTask>();

export function getScheduledTasks(): ScheduleTask[] {
  return Array.from(scheduledTasks.values());
}

export function clearScheduledTasks(): void {
  for (const t of scheduledTasks.values()) {
    if (t.timerHandle) clearTimeout(t.timerHandle);
  }
  scheduledTasks.clear();
}

export async function executeScheduleOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx?: { pi?: ExtensionAPI },
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeScheduleOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeScheduleOp(_toolCallId, op, _signal, _onUpdate, ctx)),
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

  const action = params.action ?? (params.prompt ? "create" : "list");

  // 1. LIST
  if (action === "list") {
    const tasks = getScheduledTasks();
    if (tasks.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No scheduled prompt tasks active." }],
        isError: false,
        details: { count: 0, tasks: [] },
      };
    }

    const items = tasks.map((t) => {
      const remainingSec = Math.max(0, Math.round((t.runAt - Date.now()) / 1000));
      return `• [${t.id}] in ${remainingSec}s (${t.status}): "${t.prompt.slice(0, 60)}"`;
    });

    return {
      content: [{ type: "text" as const, text: `Scheduled Tasks (${tasks.length}):\n${items.join("\n")}` }],
      isError: false,
      details: { count: tasks.length, tasks },
    };
  }

  // 2. CLEAR
  if (action === "clear") {
    const count = scheduledTasks.size;
    clearScheduledTasks();
    return {
      content: [{ type: "text" as const, text: `Cancelled and cleared ${count} scheduled task(s).` }],
      isError: false,
      details: { clearedCount: count },
    };
  }

  // 3. CANCEL
  if (action === "cancel") {
    if (!params.id) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'id'." }],
        isError: true,
        details: { error: "missing_id" },
      };
    }
    const t = scheduledTasks.get(params.id);
    if (!t) {
      return {
        content: [{ type: "text" as const, text: `No scheduled task found with ID '${params.id}'.` }],
        isError: false,
        details: { cancelled: false, id: params.id },
      };
    }
    if (t.timerHandle) clearTimeout(t.timerHandle);
    t.status = "cancelled";
    scheduledTasks.delete(params.id);

    return {
      content: [{ type: "text" as const, text: `Cancelled scheduled task '${params.id}'.` }],
      isError: false,
      details: { cancelled: true, id: params.id },
    };
  }

  // 4. CREATE
  if (action === "create") {
    if (!params.prompt) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'prompt'." }],
        isError: true,
        details: { error: "missing_prompt" },
      };
    }

    const delaySec = params.delaySeconds ?? 60;
    const delayMs = Math.max(100, delaySec * 1000);
    const id = params.id || `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const runAt = Date.now() + delayMs;

    const task: ScheduleTask = {
      id,
      prompt: params.prompt,
      delayMs,
      intervalMs: params.intervalSeconds ? params.intervalSeconds * 1000 : undefined,
      createdAt: Date.now(),
      runAt,
      status: "pending",
    };

    // Attach timer
    task.timerHandle = setTimeout(() => {
      task.status = "completed";
      scheduledTasks.delete(id);
      if (ctx?.pi && typeof (ctx.pi as any).sendUserMessage === "function") {
        (ctx.pi as any).sendUserMessage(task.prompt);
      }
    }, delayMs);

    scheduledTasks.set(id, task);

    return {
      content: [{ type: "text" as const, text: `Scheduled prompt [${id}] to fire in ${delaySec}s:\n"${params.prompt}"` }],
      isError: false,
      details: { id, delaySeconds: delaySec, runAt },
    };
  }

  return {
    content: [{ type: "text" as const, text: `Error: unknown action '${action}'.` }],
    isError: true,
    details: { error: "unknown_action", action },
  };
}

export function registerScheduleTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "schedule",
    label: "Schedule",
    description: "Schedule a prompt to be injected into the conversation after a delay or recurring interval.",
    promptSnippet: "Schedule delayed or recurring prompts",
    promptGuidelines: [
      "Use schedule create with delaySeconds to set reminders or background task checkpoints.",
      "Use schedule list to inspect pending timers.",
      "Use schedule cancel to abort pending timers.",
    ],
    parameters: scheduleSchema,

    renderCall(args: any, theme: any) {
      const act = args?.action ?? (args?.prompt ? "create" : "list");
      const d = args?.delaySeconds ? ` in ${args.delaySeconds}s` : "";
      const text = theme.fg("toolTitle", "schedule ") + theme.fg("accent", `${act}${d}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const text = theme.fg("muted", result.isError ? "Schedule Error" : "Schedule OK");
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, _ctx: any) {
      return executeScheduleOp(toolCallId, params, signal, onUpdate, { pi }) as any;
    },
  });

  pi.registerCommand("schedule", {
    description: "Schedule a prompt (e.g. /schedule 60 Check compile status)",
    handler: async (args: string, ctx: any) => {
      const parts = args.trim().split(/\s+/);
      const first = parts[0];
      if (!first || first === "list") {
        const res = await executeScheduleOp("cmd", { action: "list" });
        ctx.ui?.notify?.(res.content[0].text, "info");
        return;
      }
      if (first === "clear") {
        const res = await executeScheduleOp("cmd", { action: "clear" });
        ctx.ui?.notify?.(res.content[0].text, "info");
        return;
      }

      // Check if first arg is number of seconds
      const sec = parseInt(first, 10);
      if (!isNaN(sec) && sec > 0) {
        const prompt = parts.slice(1).join(" ");
        if (!prompt) {
          ctx.ui?.notify?.("Usage: /schedule <seconds> <prompt>", "warning");
          return;
        }
        const res = await executeScheduleOp("cmd", { action: "create", delaySeconds: sec, prompt }, undefined, undefined, { pi });
        ctx.ui?.notify?.(res.content[0].text, "info");
        return;
      }

      ctx.ui?.notify?.("Usage: /schedule <seconds> <prompt> | /schedule list | /schedule clear", "warning");
    },
  });
}
