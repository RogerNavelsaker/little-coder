/**
 * `effort` module — Thinking-budget & reasoning effort injection.
 *
 * Implements `before_provider_request` hook logic.
 * Reads the active model and thinking level/budget configurations.
 * Injects model-specific reasoning parameters into the provider request payload:
 * - Anthropic: `thinking: { type: "enabled", budget_tokens: N }` or `thinking: { type: "adaptive" }` / `effort`
 * - OpenAI / Compatible: `reasoning_effort: "low" | "medium" | "high"` or `max_completion_tokens`
 * - Local / Ollama / Llama.cpp: adjusts `max_tokens` / `thinking_budget` based on role profiles
 *   (coordinator=high, coder=medium, reviewer=low, watchdog=off).
 */

export type ThinkingRole = "voice" | "mind" | "hands" | "coordinator" | "coder" | "reviewer" | "watchdog";

export type TaskType = "quick_fix" | "test_run" | "refactor" | "feature" | "architecture" | "debug";

export interface EffortConfig {
  roleBudgets: Record<ThinkingRole, { level: "high" | "medium" | "low" | "off"; tokens: number }>;
  taskBudgets: Record<TaskType, { level: "high" | "medium" | "low" | "off"; tokens: number }>;
}

import { loadLittleCoderSettings } from "../../_shared/little-coder-config.ts";

export function getEffortConfig(): EffortConfig {
  const s = loadLittleCoderSettings();
  return {
    roleBudgets: {
      voice: { level: "off", tokens: s.effort.voice_budget },
      mind: { level: "high", tokens: s.effort.mind_budget },
      hands: { level: "low", tokens: s.effort.hands_budget },
      coordinator: { level: "high", tokens: 4096 },
      coder: { level: "medium", tokens: 2048 },
      reviewer: { level: "low", tokens: 1024 },
      watchdog: { level: "off", tokens: 0 },
    },
    taskBudgets: { ...DEFAULT_EFFORT_CONFIG.taskBudgets },
  };
}

let activeEffortOverride: { level?: "high" | "medium" | "low" | "off"; tokens?: number } | null = null;

export function setEffortOverride(override: { level?: "high" | "medium" | "low" | "off"; tokens?: number } | null): void {
  activeEffortOverride = override;
}

export function getEffortOverride(): { level?: "high" | "medium" | "low" | "off"; tokens?: number } | null {
  return activeEffortOverride;
}

export const DEFAULT_EFFORT_CONFIG: EffortConfig = {
  roleBudgets: {
    // Tri-tier architecture roles
    voice: { level: "off", tokens: 0 },         // "Dumb" communicator: 0 thinking tokens
    mind: { level: "high", tokens: 8192 },       // "Smart" thinker: deep reasoning
    hands: { level: "low", tokens: 1024 },       // "Dumb" but dynamic executor: minimal/focused
    // Legacy / specialization aliases
    coordinator: { level: "high", tokens: 4096 },
    coder: { level: "medium", tokens: 2048 },
    reviewer: { level: "low", tokens: 1024 },
    watchdog: { level: "off", tokens: 0 },
  },
  taskBudgets: {
    quick_fix: { level: "minimal" as any, tokens: 1024 },
    test_run: { level: "off", tokens: 0 },
    refactor: { level: "low", tokens: 2048 },
    feature: { level: "medium", tokens: 4096 },
    architecture: { level: "high", tokens: 8192 },
    debug: { level: "high", tokens: 8192 },
  },
};

/**
 * Classify task intent from the last message or tool execution context.
 */
export function classifyTurnIntent(lastMessageText?: string): TaskType | undefined {
  if (!lastMessageText) return undefined;
  const lower = lastMessageText.toLowerCase();

  if (/^(fix typo|rename|format|lint|bump|spelling|whitespace)\b/.test(lower) || lower.includes("quick fix")) {
    return "quick_fix";
  }
  if (/^(bun test|cargo test|npm test|pytest|test:|run tests?|verify)\b/.test(lower) || lower.includes("run the tests")) {
    return "test_run";
  }
  if (lower.includes("architecture") || lower.includes("design") || lower.includes("rfc") || lower.includes("decompose")) {
    return "architecture";
  }
  if (lower.includes("debug") || lower.includes("investigate") || lower.includes("root cause") || lower.includes("why is it failing")) {
    return "debug";
  }
  if (lower.includes("refactor") || lower.includes("cleanup") || lower.includes("reorganize")) {
    return "refactor";
  }
  return undefined;
}

/**
 * Injects or adjusts reasoning effort parameters in a raw provider request payload.
 */
export function injectThinkingEffort(
  payload: any,
  roleOrLevelOrTask?: ThinkingRole | TaskType | "high" | "medium" | "low" | "minimal" | "off",
  customTokens?: number,
  config: EffortConfig = DEFAULT_EFFORT_CONFIG,
): any {
  if (!payload || typeof payload !== "object") return payload;

  let level: "high" | "medium" | "low" | "minimal" | "off" = "medium";
  let tokens = customTokens ?? 2048;

  if (roleOrLevelOrTask) {
    if (roleOrLevelOrTask in config.taskBudgets) {
      const taskSetting = config.taskBudgets[roleOrLevelOrTask as TaskType];
      level = taskSetting.level as any;
      tokens = customTokens ?? taskSetting.tokens;
    } else if (roleOrLevelOrTask in config.roleBudgets) {
      const roleSetting = config.roleBudgets[roleOrLevelOrTask as ThinkingRole];
      level = roleSetting.level as any;
      tokens = customTokens ?? roleSetting.tokens;
    } else if (["high", "medium", "low", "minimal", "off"].includes(roleOrLevelOrTask)) {
      level = roleOrLevelOrTask as any;
    }
  }

  const cloned = { ...payload };

  if (level === "off" || tokens === 0) {
    if ("thinking" in cloned) {
      delete cloned.thinking;
    }
    if ("reasoning_effort" in cloned) {
      delete cloned.reasoning_effort;
    }
    return cloned;
  }

  // 1. Anthropic-style payload (has messages or system)
  if ("messages" in cloned && !("max_completion_tokens" in cloned)) {
    cloned.thinking = {
      type: "enabled",
      budget_tokens: tokens,
    };
  }

  // 2. OpenAI / o-series / reasoning compatible payload
  if ("reasoning_effort" in cloned || "max_completion_tokens" in cloned || cloned.model?.includes("o1") || cloned.model?.includes("o3") || cloned.model?.includes("r1")) {
    cloned.reasoning_effort = level;
    if (tokens > 0) {
      cloned.max_completion_tokens = Math.max(cloned.max_completion_tokens || 0, tokens + 1024);
    }
  }

  return cloned;
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerEffortCommands(pi: ExtensionAPI): void {
  const handler = async (args: string, ctx: any) => {
    const raw = args.trim().toLowerCase();
    const currentOverride = getEffortOverride();
    const config = getEffortConfig();

    if (!raw || raw === "status") {
      const overrideStr = currentOverride
        ? ` (override: ${currentOverride.level || currentOverride.tokens + " tokens"})`
        : " (dynamic / default)";
      ctx.ui?.notify?.(
        `Thinking effort${overrideStr}:\n` +
          `• voice: ${config.roleBudgets.voice.tokens} tokens (off)\n` +
          `• mind: ${config.roleBudgets.mind.tokens} tokens (high)\n` +
          `• hands: ${config.roleBudgets.hands.tokens} tokens (dynamic)\n\n` +
          `Usage: /effort [off|low|medium|high|<tokens>|reset] (alias: /thinking)`,
        "info",
      );
      return;
    }

    if (raw === "reset" || raw === "auto" || raw === "default") {
      setEffortOverride(null);
      ctx.ui?.notify?.("Thinking effort override cleared. Reverted to dynamic role/intent budgets.", "info");
      return;
    }

    if (["off", "low", "medium", "high"].includes(raw)) {
      setEffortOverride({ level: raw as any });
      ctx.ui?.notify?.(`Thinking effort override set to: ${raw}`, "info");
      return;
    }

    const tokens = parseInt(raw, 10);
    if (!isNaN(tokens) && tokens >= 0) {
      if (tokens === 0) {
        setEffortOverride({ level: "off", tokens: 0 });
        ctx.ui?.notify?.("Thinking effort turned off (0 tokens).", "info");
      } else {
        setEffortOverride({ tokens });
        ctx.ui?.notify?.(`Thinking effort budget set to ${tokens} tokens.`, "info");
      }
      return;
    }

    ctx.ui?.notify?.("Usage: /effort [off|low|medium|high|<tokens>|reset] (alias: /thinking)", "warning");
  };

  pi.registerCommand?.("effort", {
    description: "Inspect or configure thinking / reasoning effort: /effort [off|low|medium|high|<tokens>|reset]",
    handler,
  });

  pi.registerCommand?.("thinking", {
    description: "Alias for /effort: /thinking [off|low|medium|high|<tokens>|reset]",
    handler,
  });
}

