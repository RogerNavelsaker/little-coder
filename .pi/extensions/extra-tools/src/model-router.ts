/**
 * `model_route` tool & dual-model split router (Volition / Abe pattern).
 *
 * Implements an asymmetric dual-model architecture:
 * - `plan-model`: High-capacity frontier or local reasoning model (Sonnet, o3, Qwen 35B high CoT).
 *   Used for architectural design, task decomposition, complex debugging, and compaction summaries.
 * - `action-model`: Fast, low-latency, deterministic execution model (Qwen 27B/35B minimal CoT, Haiku, 4o-mini).
 *   Used for mechanical shell execution, linehash edits, file reads, and test loops.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface DualModelConfig {
  planModel?: string;
  actionModel?: string;
  activeRole: "plan" | "action";
}

let dualConfig: DualModelConfig = {
  planModel: process.env.LITTLE_CODER_PLAN_MODEL,
  actionModel: process.env.LITTLE_CODER_ACTION_MODEL,
  activeRole: "action",
};

export function getDualModelConfig(): DualModelConfig {
  return { ...dualConfig };
}

export function setDualModelConfig(update: Partial<DualModelConfig>): void {
  dualConfig = { ...dualConfig, ...update };
}

export const modelRouteSchema = Type.Object({
  role: Type.Optional(
    Type.Union([
      Type.Literal("plan", { description: "Switch to high-capacity plan-model for design/decomposition" }),
      Type.Literal("action", { description: "Switch to lean action-model for tool execution & editing" }),
    ]),
  ),
  plan_model: Type.Optional(Type.String({ description: "Configure plan-model (provider/id or id)" })),
  action_model: Type.Optional(Type.String({ description: "Configure action-model (provider/id or id)" })),
});

export function registerModelRouteTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "model_route",
    label: "Model Route",
    description: "Inspect or configure the asymmetric dual-model split (plan-model vs action-model).",
    parameters: modelRouteSchema,
    async execute(_toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
      if (params.plan_model) dualConfig.planModel = params.plan_model;
      if (params.action_model) dualConfig.actionModel = params.action_model;
      if (params.role) {
        dualConfig.activeRole = params.role;

        // If session provides setModel, switch immediately
        const targetModel = params.role === "plan" ? dualConfig.planModel : dualConfig.actionModel;
        if (targetModel && ctx?.session?.setModel) {
          try {
            await ctx.session.setModel(targetModel);
          } catch (e: any) {
            return {
              content: [{ type: "text", text: `Active role updated to ${params.role}, but setModel failed: ${e.message}` }],
              details: { config: dualConfig, error: e.message },
              isError: true,
            } as any;
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Dual-model route: role=${dualConfig.activeRole} | planModel=${dualConfig.planModel || "default"} | actionModel=${dualConfig.actionModel || "default"}`,
          },
        ],
        details: { config: dualConfig },
      } as any;
    },
  });
}
