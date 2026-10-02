/**
 * `goal` tool & autonomous loop controller.
 *
 * Inspired by `pi-goal` and `pi-goal-x`.
 * Manages autonomous multi-turn objective tracking, sub-goals, verification checkpoints,
 * and completion convergence without stopping prematurely.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export interface SubGoal {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  verificationCmd?: string;
  verified?: boolean;
}

export interface ActiveGoal {
  id: string;
  objective: string;
  status: "active" | "completed" | "failed" | "paused";
  createdAt: number;
  subgoals: SubGoal[];
  checkpoints: string[];
}

export const goalItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("start"),
      Type.Literal("status"),
      Type.Literal("subgoal_add"),
      Type.Literal("subgoal_update"),
      Type.Literal("checkpoint"),
      Type.Literal("complete"),
      Type.Literal("abort"),
    ]),
  ),
  objective: Type.Optional(Type.String({ description: "High-level goal objective" })),
  subgoalId: Type.Optional(Type.String({ description: "Subgoal identifier" })),
  title: Type.Optional(Type.String({ description: "Subgoal title" })),
  status: Type.Optional(Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed"), Type.Literal("failed")])),
  note: Type.Optional(Type.String({ description: "Checkpoint note or completion summary" })),
});

export const goalSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(goalItemSchema, { description: "Batch goal operations array" }),
  ),
  action: Type.Optional(
    Type.Union([
      Type.Literal("start", { description: "Initialize a new autonomous goal" }),
      Type.Literal("status", { description: "Inspect active goal progress (default)" }),
      Type.Literal("subgoal_add", { description: "Add a subgoal milestone" }),
      Type.Literal("subgoal_update", { description: "Update status of a subgoal" }),
      Type.Literal("checkpoint", { description: "Record a progress checkpoint" }),
      Type.Literal("complete", { description: "Mark the goal completed" }),
      Type.Literal("abort", { description: "Abort the active goal" }),
    ]),
  ),
  objective: Type.Optional(Type.String({ description: "Goal objective" })),
  subgoalId: Type.Optional(Type.String({ description: "Subgoal ID" })),
  title: Type.Optional(Type.String({ description: "Title" })),
  status: Type.Optional(Type.String({ description: "Status" })),
  note: Type.Optional(Type.String({ description: "Note" })),
});

let activeGoal: ActiveGoal | null = null;

export function getActiveGoal(): ActiveGoal | null {
  return activeGoal;
}

export function resetActiveGoal(): void {
  activeGoal = null;
}

export async function executeGoalOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  _ctx?: any,
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeGoalOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeGoalOp(_toolCallId, op, _signal, _onUpdate, _ctx)),
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

  const action = params.action ?? (params.objective ? "start" : "status");

  // 1. STATUS
  if (action === "status") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "No active goal running." }],
        isError: false,
        details: { active: false },
      };
    }

    const subRows = activeGoal.subgoals.map(
      (s) => `  [${s.status.toUpperCase()}] ${s.id}: ${s.title}${s.verified ? " (verified)" : ""}`,
    );

    const cpRows = activeGoal.checkpoints.map((c) => `  • ${c}`);

    const text = [
      `Active Goal: ${activeGoal.objective} [${activeGoal.status.toUpperCase()}]`,
      activeGoal.subgoals.length > 0 ? `Subgoals:\n${subRows.join("\n")}` : "No subgoals defined yet.",
      activeGoal.checkpoints.length > 0 ? `Checkpoints:\n${cpRows.join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    return {
      content: [{ type: "text" as const, text }],
      isError: false,
      details: { active: true, goal: activeGoal },
    };
  }

  // 2. START
  if (action === "start") {
    if (!params.objective) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'objective'." }],
        isError: true,
        details: { error: "missing_objective" },
      };
    }

    activeGoal = {
      id: `goal_${Date.now().toString(36)}`,
      objective: params.objective,
      status: "active",
      createdAt: Date.now(),
      subgoals: [],
      checkpoints: [`Initialized goal: ${params.objective}`],
    };

    return {
      content: [{ type: "text" as const, text: `Started autonomous goal: "${params.objective}"` }],
      isError: false,
      details: { goal: activeGoal },
    };
  }

  // 3. SUBGOAL_ADD
  if (action === "subgoal_add") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "Error: no active goal. Start a goal first." }],
        isError: true,
        details: { error: "no_active_goal" },
      };
    }
    const id = params.subgoalId || `sub_${activeGoal.subgoals.length + 1}`;
    const title = params.title || "Untitled step";
    const sub: SubGoal = {
      id,
      title,
      status: "pending",
    };
    activeGoal.subgoals.push(sub);

    return {
      content: [{ type: "text" as const, text: `Added subgoal [${id}]: ${title}` }],
      isError: false,
      details: { subgoal: sub },
    };
  }

  // 4. SUBGOAL_UPDATE
  if (action === "subgoal_update") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "Error: no active goal." }],
        isError: true,
        details: { error: "no_active_goal" },
      };
    }
    const sub = activeGoal.subgoals.find((s) => s.id === params.subgoalId);
    if (!sub) {
      return {
        content: [{ type: "text" as const, text: `Error: subgoal '${params.subgoalId}' not found.` }],
        isError: true,
        details: { error: "subgoal_not_found" },
      };
    }
    if (params.status) sub.status = params.status;
    if (params.note) activeGoal.checkpoints.push(`Subgoal [${sub.id}] update: ${params.note}`);

    return {
      content: [{ type: "text" as const, text: `Updated subgoal [${sub.id}] status to ${sub.status}` }],
      isError: false,
      details: { subgoal: sub },
    };
  }

  // 5. CHECKPOINT
  if (action === "checkpoint") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "Error: no active goal." }],
        isError: true,
        details: { error: "no_active_goal" },
      };
    }
    const note = params.note || "Progress checkpoint";
    activeGoal.checkpoints.push(note);
    return {
      content: [{ type: "text" as const, text: `Recorded checkpoint: "${note}"` }],
      isError: false,
      details: { checkpoint: note },
    };
  }

  // 6. COMPLETE
  if (action === "complete") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "No active goal to complete." }],
        isError: false,
        details: { completed: false },
      };
    }
    activeGoal.status = "completed";
    const summary = params.note || "All criteria satisfied.";
    activeGoal.checkpoints.push(`Completed: ${summary}`);
    const finished = activeGoal;
    activeGoal = null;

    return {
      content: [{ type: "text" as const, text: `Goal completed successfully! Summary: ${summary}` }],
      isError: false,
      details: { completed: true, goal: finished },
    };
  }

  // 7. ABORT
  if (action === "abort") {
    if (!activeGoal) {
      return {
        content: [{ type: "text" as const, text: "No active goal to abort." }],
        isError: false,
        details: { aborted: false },
      };
    }
    activeGoal = null;
    return {
      content: [{ type: "text" as const, text: "Aborted active goal." }],
      isError: false,
      details: { aborted: true },
    };
  }

  return {
    content: [{ type: "text" as const, text: `Error: unknown action '${action}'.` }],
    isError: true,
    details: { error: "unknown_action", action },
  };
}

export function registerGoalTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "goal",
    label: "Goal",
    description: "Manage autonomous multi-turn goals, subgoals, verification checkpoints, and completion criteria.",
    promptSnippet: "Autonomous goal tracking and verification loop",
    promptGuidelines: [
      "Use goal start to define high-level objective and completion conditions.",
      "Use goal subgoal_add and subgoal_update to decompose complex tasks into verifiable units.",
      "Do not complete until verification passes.",
    ],
    parameters: goalSchema,

    renderCall(args: any, theme: any) {
      const act = args?.action ?? (args?.objective ? "start" : "status");
      const obj = args?.objective ? ` "${args.objective.slice(0, 30)}..."` : "";
      const text = theme.fg("toolTitle", "goal ") + theme.fg("accent", `${act}${obj}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const text = theme.fg("muted", result.isError ? "Goal Error" : "Goal OK");
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeGoalOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("goal", {
    description: "Manage or start an autonomous goal (e.g. /goal Fix authentication bug)",
    handler: async (args: string, ctx: any) => {
      const trimmed = args.trim();
      if (!trimmed || trimmed === "status") {
        const res = await executeGoalOp("cmd", { action: "status" });
        ctx.ui?.notify?.(res.content[0].text, "info");
        return;
      }
      if (trimmed === "abort") {
        const res = await executeGoalOp("cmd", { action: "abort" });
        ctx.ui?.notify?.(res.content[0].text, "info");
        return;
      }
      const res = await executeGoalOp("cmd", { action: "start", objective: trimmed });
      ctx.ui?.notify?.(res.content[0].text, "info");
    },
  });
}
