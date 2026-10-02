/**
 * `autonomous` extension entrypoint.
 *
 * Registers:
 * - `goal` tool: for model-driven task decomposition and milestone verification.
 * - `/goal` command: for user-driven autonomous mission dispatch.
 *
 * Hooks:
 * - `before_agent_start`: Injects active goal & milestones summary into conversation tail.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { injectionResult, makeDedupe } from "../_shared/inject.ts";
import { registerGoalTool, getActiveGoal } from "./src/goal.ts";

export default function autonomousExtension(pi: ExtensionAPI): void {
  registerGoalTool(pi);

  const dedupe = makeDedupe();

  // Tail injection for active goal milestones
  pi.on("before_agent_start", async (event: any, _ctx: any) => {
    const goal = getActiveGoal();
    if (!goal || goal.status !== "active") return;

    const subgoals = goal.subgoals
      .map((s) => `  [${s.status.toUpperCase()}] ${s.id}: ${s.title}`)
      .join("\n");

    const block = [
      "<active_goal>",
      `Objective: ${goal.objective}`,
      subgoals ? `Milestones:\n${subgoals}` : "",
      "</active_goal>",
    ].filter(Boolean).join("\n");

    if (!dedupe(block)) return;
    return injectionResult("lc-autonomous-goal", block, event?.systemPrompt);
  });
}
