/**
 * `model_route` tool & tri-tier model split router (`voice` / `mind` / `hands`).
 *
 * Implements an asymmetric three-tier model architecture:
 * - `voice`: Fast, low-latency, "dumb" communicator (Flash, Haiku, small local model).
 *   Used for conversational responses, status updates, TUI narration (`recap`), and social interactions.
 *   Operates with 0 thinking tokens and read-only / non-destructive posture.
 * - `mind`: High-capacity frontier or local reasoning model (Sonnet 3.7, o3, Qwen-35B high-CoT).
 *   Used for architectural design, task decomposition, complex debugging, and compaction summaries.
 *   Operates with high thinking tokens (8k–16k).
 * - `hands`: Fast, deterministic, instruction-following executor (4o-mini, Qwen-27B, Haiku).
 *   Used for precision linehash edits, mechanical shell runs, file reads, and verification loops.
 *   Operates with dynamic action-based thinking tokens (0 for tests/commands, minimal for diffs).
 *
 * Backward-compatible aliases: `plan` -> `mind`, `action` -> `hands`.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { existsSync, readFileSync } from "fs";

export type ModelTierRole = "voice" | "mind" | "hands" | "plan" | "action";

export function isModelSwitchLocked(): boolean {
  if (process.env.LITTLE_CODER_FIXED_MODEL === "1") return true;
  if (process.env.WARREN_RUNTIME === "docker" || process.env.WARREN_RUNTIME === "container") return true;
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) return true;
  if (process.env.container === "docker" || process.env.container === "podman" || process.env.container === "oci") return true;
  try {
    if (existsSync("/proc/1/cgroup")) {
      const cgroup = readFileSync("/proc/1/cgroup", "utf-8");
      if (cgroup.includes("docker") || cgroup.includes("containerd") || cgroup.includes("kubepods")) {
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

export interface TriTierModelConfig {
  voiceModel?: string;
  mindModel?: string;
  handsModel?: string;
  activeRole: "voice" | "mind" | "hands";
}

export function normalizeRole(role?: string): "voice" | "mind" | "hands" {
  if (!role) return "hands";
  const lower = role.toLowerCase().trim();
  if (lower === "mind" || lower === "plan") return "mind";
  if (lower === "voice") return "voice";
  return "hands";
}

import { loadLittleCoderSettings } from "../../_shared/little-coder-config.ts";

let triConfig: TriTierModelConfig = (() => {
  const settings = loadLittleCoderSettings();
  return {
    voiceModel: settings.roles.voice_model,
    mindModel: settings.roles.mind_model,
    handsModel: settings.roles.hands_model,
    activeRole: settings.roles.default_role,
  };
})();

export function getTriModelConfig(): TriTierModelConfig {
  return { ...triConfig };
}

// Backward-compatible export
export function getDualModelConfig() {
  return {
    planModel: triConfig.mindModel,
    actionModel: triConfig.handsModel,
    activeRole: triConfig.activeRole === "mind" ? "plan" : "action",
  };
}

export function setTriModelConfig(update: Partial<TriTierModelConfig>): void {
  triConfig = {
    ...triConfig,
    ...update,
    ...(update.activeRole ? { activeRole: normalizeRole(update.activeRole) } : {}),
  };
}

export const modelRouteItemSchema = Type.Object({
  role: Type.Optional(
    Type.Union([
      Type.Literal("voice", { description: "Switch to 'dumb' fast communicator for conversation & recap" }),
      Type.Literal("mind", { description: "Switch to 'smart' frontier reasoner for architecture & decomposition" }),
      Type.Literal("hands", { description: "Switch to 'dumb' but dynamic executor for tool execution & editing" }),
      // Compatibility aliases
      Type.Literal("plan", { description: "Alias for 'mind'" }),
      Type.Literal("action", { description: "Alias for 'hands'" }),
    ]),
  ),
  voice_model: Type.Optional(Type.String({ description: "Configure voice-model (communicator)" })),
  mind_model: Type.Optional(Type.String({ description: "Configure mind-model (thinker)" })),
  hands_model: Type.Optional(Type.String({ description: "Configure hands-model (executor)" })),
  // Compatibility params
  plan_model: Type.Optional(Type.String({ description: "Alias for mind_model" })),
  action_model: Type.Optional(Type.String({ description: "Alias for hands_model" })),
});

export const modelRouteSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(modelRouteItemSchema, { description: "Batch model router operations" }),
  ),
  role: Type.Optional(
    Type.Union([
      Type.Literal("voice", { description: "Switch to 'dumb' fast communicator for conversation & recap" }),
      Type.Literal("mind", { description: "Switch to 'smart' frontier reasoner for architecture & decomposition" }),
      Type.Literal("hands", { description: "Switch to 'dumb' but dynamic executor for tool execution & editing" }),
      Type.Literal("plan", { description: "Alias for 'mind'" }),
      Type.Literal("action", { description: "Alias for 'hands'" }),
    ]),
  ),
  voice_model: Type.Optional(Type.String({ description: "Configure voice-model (communicator)" })),
  mind_model: Type.Optional(Type.String({ description: "Configure mind-model (thinker)" })),
  hands_model: Type.Optional(Type.String({ description: "Configure hands-model (executor)" })),
  plan_model: Type.Optional(Type.String({ description: "Alias for mind_model" })),
  action_model: Type.Optional(Type.String({ description: "Alias for hands_model" })),
});

export async function executeModelRouterOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx?: any,
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeModelRouterOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeModelRouterOp(_toolCallId, op, _signal, _onUpdate, ctx)),
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

  if (params.voice_model) triConfig.voiceModel = params.voice_model;
  if (params.mind_model || params.plan_model) triConfig.mindModel = params.mind_model || params.plan_model;
  if (params.hands_model || params.action_model) triConfig.handsModel = params.hands_model || params.action_model;

  let lockedNotice = "";
  if (params.role) {
    const targetRole = normalizeRole(params.role);
    triConfig.activeRole = targetRole;

    if (isModelSwitchLocked()) {
      lockedNotice = " [model switching locked in container/host mode; reasoning effort steered dynamically]";
    } else {
      const targetModel =
        targetRole === "voice"
          ? triConfig.voiceModel
          : targetRole === "mind"
            ? triConfig.mindModel
            : triConfig.handsModel;

      if (targetModel && ctx?.session?.setModel) {
        try {
          await ctx.session.setModel(targetModel);
        } catch (e: any) {
          return {
            content: [{ type: "text" as const, text: `Active role updated to ${targetRole}, but setModel failed: ${e.message}` }],
            details: { config: triConfig, error: e.message },
            isError: true,
          };
        }
      }
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Model route: role=${triConfig.activeRole} | voice=${triConfig.voiceModel || "default"} | mind=${triConfig.mindModel || "default"} | hands=${triConfig.handsModel || "default"}${lockedNotice}`,
      },
    ],
    details: { config: triConfig, modelSwitchLocked: isModelSwitchLocked() },
    isError: false,
  };
}

export function registerModelRouteTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "model_route",
    label: "Model Route",
    description: "Inspect or configure the tri-tier model split (voice=communicator, mind=thinker, hands=executor).",
    parameters: modelRouteSchema,
    execute: (_toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) =>
      executeModelRouterOp(_toolCallId, params, _signal, _onUpdate, ctx) as any,
  });

  // Slash command: /role [voice|mind|hands]
  pi.registerCommand?.("role", {
    description: "Inspect or switch active tri-tier role: /role [voice|mind|hands]",
    handler: async (args: string, ctx: any) => {
      const target = args.trim().toLowerCase();
      if (!target || target === "status") {
        const locked = isModelSwitchLocked() ? " (locked in container)" : "";
        const m = target === "voice" ? triConfig.voiceModel : target === "mind" ? triConfig.mindModel : triConfig.handsModel;
        ctx.ui?.notify?.(
          `Active role: ${triConfig.activeRole} | Model: ${m || "default"}${locked}\nRoles: voice (fast/0 thinking), mind (deep/8k thinking), hands (executor/1k thinking)`,
          "info",
        );
        return;
      }
      if (["voice", "mind", "hands", "plan", "action"].includes(target)) {
        const res = await executeModelRouterOp("slash-role", { role: target }, undefined, undefined, ctx);
        ctx.ui?.notify?.(res.content[0].text, res.isError ? "error" : "info");
      } else {
        ctx.ui?.notify?.("Usage: /role [voice|mind|hands]", "warning");
      }
    },
  });

  // Slash command: /model-route [voice|mind|hands] <model-id>
  pi.registerCommand?.("model-route", {
    description: "Configure role-specific models: /model-route <role> <model-id>",
    handler: async (args: string, ctx: any) => {
      const parts = args.trim().split(/\s+/);
      const role = parts[0]?.toLowerCase();
      const model = parts.slice(1).join(" ");
      if (!role || !model || !["voice", "mind", "hands"].includes(role)) {
        ctx.ui?.notify?.(
          `Configured models:\nvoice: ${triConfig.voiceModel || "default"}\nmind: ${triConfig.mindModel || "default"}\nhands: ${triConfig.handsModel || "default"}\n\nUsage: /model-route <voice|mind|hands> <model-id>`,
          "info",
        );
        return;
      }
      const params: any = {};
      if (role === "voice") params.voice_model = model;
      if (role === "mind") params.mind_model = model;
      if (role === "hands") params.hands_model = model;

      const res = await executeModelRouterOp("slash-model-route", params, undefined, undefined, ctx);
      ctx.ui?.notify?.(res.content[0].text, res.isError ? "error" : "info");
    },
  });

  // Slash command: /grill-me [topic]
  pi.registerCommand?.("grill-me", {
    description: "Start relentless design-tree interview: /grill-me [topic]",
    handler: async (args: string, ctx: any) => {
      // Switch active role to mind (deep thinking)
      await executeModelRouterOp("slash-grill-me", { role: "mind" }, undefined, undefined, ctx);
      const topic = args.trim() ? ` on: "${args.trim()}"` : "";
      ctx.ui?.notify?.(
        `Switched to 'mind' role for Grilling session${topic}.\nPrompting with relentless design-tree questions across the frontier.`,
        "info",
      );
    },
  });

  // Slash command: /grill-with-docs [topic]
  pi.registerCommand?.("grill-with-docs", {
    description: "Start design-tree interview with Mulch architectural recording & domain modeling: /grill-with-docs [topic]",
    handler: async (args: string, ctx: any) => {
      // Switch active role to mind (deep thinking)
      await executeModelRouterOp("slash-grill-with-docs", { role: "mind" }, undefined, undefined, ctx);
      const topic = args.trim() ? ` on: "${args.trim()}"` : "";
      ctx.ui?.notify?.(
        `Switched to 'mind' role for Grill-With-Docs session${topic}.\nActive domain modeling and Mulch architecture records (ml record architecture) enabled.`,
        "info",
      );
    },
  });
}

